import assert from "node:assert/strict";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { unproject } from "../src/geo.js";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1480, height: 960 }, deviceScaleFactor: 1 });
const network = [];
const errors = [];
const responses = [];
page.on("response", response =>
{
    if (response.url().includes("/tiles/Mars/EQ/"))
    {
        responses.push({ status: response.status(), url: response.url() });
    }
});
page.on("pageerror", error => errors.push(error.message));
page.on("request", request =>
{
    if (request.url().includes("/tiles/Mars/EQ/") && !request.url().endsWith("WMTSCapabilities.xml"))
    {
        network.push(request.url());
    }
});

async function inspect(label)
{
    const info = await page.evaluate(() =>
    {
        const visible = element =>
        {
            const rect = element.getBoundingClientRect();
            const map = document.querySelector("#map-root").getBoundingClientRect();
            return element.style.display !== "none" && rect.right > map.left
                && rect.left < map.right && rect.bottom > map.top && rect.top < map.bottom;
        };
        const backdrop = [...document.querySelectorAll(".map-background-tile")].filter(visible);
        const detail = [...document.querySelectorAll(".map-hires-tile")].filter(visible);
        const context = [...document.querySelectorAll(".map-context-tile")].filter(visible);
        const loaded = image => image.naturalWidth >= 240 && image.dataset.state === "loaded";
        const banner = document.querySelector("#map-root .map-load-notice");

        return {
            zoom: document.querySelector("#zoom-text").textContent,
            backdropVisible: backdrop.length,
            backdropLoaded: backdrop.filter(loaded).length,
            detailVisible: detail.length,
            detailLoaded: detail.filter(loaded).length,
            contextVisible: context.length,
            contextLoaded: context.filter(loaded).length,
            backdropWidths: [...new Set(backdrop.map(item => Math.round(item.getBoundingClientRect().width)))],
            detailWidths: [...new Set(detail.map(item => Math.round(item.getBoundingClientRect().width)))],
            contextWidths: [...new Set(context.map(item => Math.round(item.getBoundingClientRect().width)))],
            bannerHidden: banner.hidden,
            bannerText: banner.textContent
        };
    });

    console.log(JSON.stringify({ label, ...info }));
    console.log(JSON.stringify({ nasaResponses: responses.length, failed: responses.filter(item => item.status >= 400).slice(-8) }));
    return info;
}

async function waitForLoadedTiles(selector)
{
    await page.waitForFunction(selector =>
    {
        const map = document.querySelector("#map-root").getBoundingClientRect();
        const tiles = [...document.querySelectorAll(selector)].filter(tile =>
        {
            const rect = tile.getBoundingClientRect();
            return tile.style.display !== "none" && rect.right > map.left
                && rect.left < map.right && rect.bottom > map.top && rect.top < map.bottom;
        });

        return tiles.length > 0 && tiles.every(tile => tile.dataset.state === "loaded");
    }, selector, { timeout: 25000 });
}

async function zoomUntil(target)
{
    for (let attempts = 0; attempts < 8; attempts++)
    {
        const current = Number((await page.locator("#zoom-text").textContent()).match(/\d+/)?.[0]);

        if (current === target)
        {
            return;
        }

        assert.ok(Number.isFinite(current) && Math.abs(target - current) <= 8);
        await page.evaluate(direction =>
        {
            document.querySelector('[data-action="' + (direction > 0 ? "zoom-in" : "zoom-out") + '"]').click();
        }, Math.sign(target - current));
        await page.waitForTimeout(80);
    }

    throw new Error("Could not reach zoom " + target);
}

const APP_URL = "http://127.0.0.1:4173/";
const VIEWPORTS = [
    { name: "mobile-375", width: 375, height: 812 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1480", width: 1480, height: 960 }
];
// The map retries a failed tile after 16 s; anything re-requested sooner, or without a prior failure, is a real duplicate.
const RETRY_GAP_MS = 15000;

function isTileUrl(url)
{
    return url.includes("/tiles/Mars/EQ/") && !url.endsWith("WMTSCapabilities.xml");
}

function tileLevel(url)
{
    const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.(png|jpg)/);
    return match ? Number(match[1]) : null;
}

const HIRISE_ENVELOPE = { south: 18.3068, north: 18.6693, west: 77.2229, east: 77.5840 };
const JEZERO_CENTER = { lat: 18.4446, lon: 77.4509 };

// Tile grid is 2^(z+1) x 2^z tiles of 256 px, the same equirectangular convention as project/unproject in src/geo.js.
function tileBounds(url)
{
    const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.(png|jpg)/);

    if (!match)
    {
        return null;
    }

    const [zoom, row, col] = match.slice(1, 4).map(Number);
    const northwest = unproject({ x: col * 256, y: row * 256 }, zoom);
    const southeast = unproject({ x: (col + 1) * 256, y: (row + 1) * 256 }, zoom);
    return { url, north: northwest.lat, west: northwest.lon, south: southeast.lat, east: southeast.lon };
}

function intersects(tile, envelope)
{
    return tile.west < envelope.east && tile.east > envelope.west && tile.south < envelope.north && tile.north > envelope.south;
}

function trackPage(target)
{
    const log = { requests: [], responses: [], failures: [], jsErrors: [], networkConsole: [], pending: 0, lastActivity: Date.now() };
    const attempts = new Map();
    const touch = () => { log.lastActivity = Date.now(); };

    target.on("request", request =>
    {
        if (isTileUrl(request.url()))
        {
            const attempt = { url: request.url(), at: Date.now(), status: null, error: null };
            attempts.set(request, attempt);
            log.requests.push(attempt);
            log.pending++;
            touch();
        }
    });
    target.on("response", response =>
    {
        if (isTileUrl(response.url()))
        {
            const attempt = attempts.get(response.request());
            if (attempt) attempt.status = response.status();
            log.responses.push({ url: response.url(), status: response.status(), at: Date.now() });
            touch();
        }
    });
    target.on("requestfinished", request =>
    {
        if (isTileUrl(request.url()))
        {
            log.pending = Math.max(0, log.pending - 1);
            touch();
        }
    });
    target.on("requestfailed", request =>
    {
        if (isTileUrl(request.url()))
        {
            const error = request.failure()?.errorText || "failed";
            const attempt = attempts.get(request);
            if (attempt) attempt.error = error;
            log.failures.push({ url: request.url(), error, at: Date.now() });
            log.pending = Math.max(0, log.pending - 1);
            touch();
        }
    });
    target.on("pageerror", error => log.jsErrors.push(error.message));
    target.on("console", message =>
    {
        if (message.type() !== "error")
        {
            return;
        }

        const text = message.text();

        if (/Failed to load resource/i.test(text))
        {
            log.networkConsole.push({ text, url: message.location()?.url || "" });
        }
        else
        {
            log.jsErrors.push(text);
        }
    });
    return log;
}

async function settle(target, log, timeout = 25000)
{
    const start = Date.now();

    while (Date.now() - start < timeout)
    {
        await target.waitForTimeout(250);

        if (log.pending === 0 && Date.now() - log.lastActivity >= 900)
        {
            return true;
        }
    }

    return false;
}

const DUPLICATE_SEVERITY = ["retry-after-error", "reissue-after-abort", "real-duplicate"];

// Judged on the final outcome of the earlier attempt: only an aborted or never-answered request may be reissued freely.
function classifyRepeat(previous, current)
{
    if (previous.error === "net::ERR_ABORTED" || (previous.status === null && previous.error === null))
    {
        return "reissue-after-abort";
    }

    const failed = previous.error !== null || previous.status >= 400;
    return failed && current.at - previous.at >= RETRY_GAP_MS ? "retry-after-error" : "real-duplicate";
}

function findDuplicates(log)
{
    const byUrl = new Map();

    for (const item of log.requests)
    {
        byUrl.set(item.url, [...(byUrl.get(item.url) || []), item]);
    }

    const duplicates = [];

    for (const [url, attempts] of byUrl)
    {
        if (attempts.length < 2)
        {
            continue;
        }

        const repeats = attempts.slice(1).map((attempt, index) => classifyRepeat(attempts[index], attempt));
        const kind = DUPLICATE_SEVERITY[Math.max(...repeats.map(item => DUPLICATE_SEVERITY.indexOf(item)))];
        const outcomes = attempts.map(item => ({ afterMs: item.at - attempts[0].at, status: item.status, error: item.error }));
        duplicates.push({ url, level: tileLevel(url), count: attempts.length, kind, repeats, outcomes });
    }

    return duplicates;
}

function summarize(log)
{
    const statusCodes = {};

    for (const item of log.responses)
    {
        statusCodes[item.status] = (statusCodes[item.status] || 0) + 1;
    }

    const levels = [...new Set(log.requests.map(item => tileLevel(item.url)).filter(level => level !== null))].sort((a, b) => a - b);

    return {
        requests: log.requests.length,
        uniqueUrls: new Set(log.requests.map(item => item.url)).size,
        levelsRequested: levels,
        statusCodes,
        httpErrors: log.responses.filter(item => item.status >= 400).map(item => ({ url: item.url, level: tileLevel(item.url), status: item.status })),
        failedRequests: log.failures.map(item => ({ url: item.url, level: tileLevel(item.url), error: item.error })),
        duplicates: findDuplicates(log),
        jsErrors: log.jsErrors,
        networkConsoleErrors: log.networkConsole
    };
}

async function readView(target)
{
    return target.evaluate(() => (
    {
        zoom: Number(document.querySelector("#zoom-text").textContent.match(/\d+/)?.[0]),
        layer: document.querySelector(".layer-btn.active")?.dataset.layer || null,
        coordinates: document.querySelector("#live-coordinates")?.textContent || ""
    }));
}

async function clickZoom(target, direction)
{
    await target.evaluate(action => document.querySelector('[data-action="' + action + '"]').click(), direction > 0 ? "zoom-in" : "zoom-out");
}

async function wheelZoom(target, direction)
{
    const box = await target.locator("#map-root").boundingBox();
    await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await target.mouse.wheel(0, direction > 0 ? -100 : 100);
}

async function stepZoom(target, zoom, method, pause)
{
    const before = (await readView(target)).zoom;

    if (before === zoom)
    {
        return;
    }

    await (method === "wheel" ? wheelZoom(target, Math.sign(zoom - before)) : clickZoom(target, Math.sign(zoom - before)));
    await target.waitForFunction(expected => document.querySelector("#zoom-text").textContent.trim() === "ZOOM " + expected, zoom, { timeout: 4000 });

    if (pause)
    {
        await target.waitForTimeout(pause);
    }
}

async function zoomTo(target, zoom)
{
    for (let attempts = 0; attempts < 10 && (await readView(target)).zoom !== zoom; attempts++)
    {
        const current = (await readView(target)).zoom;
        await stepZoom(target, current + Math.sign(zoom - current), "buttons", 0);
    }

    assert.equal((await readView(target)).zoom, zoom, "Could not reach zoom " + zoom);
}

async function selectLayer(target, id)
{
    await target.evaluate(layer => document.querySelector('[data-layer="' + layer + '"]').click(), id);
    await target.waitForFunction(layer => document.querySelector(".layer-btn.active")?.dataset.layer === layer, id, { timeout: 5000 });
}

async function openScenario(viewport)
{
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const target = await context.newPage();
    const log = trackPage(target);
    await target.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await target.waitForSelector("#map-root");
    return { context, target, log };
}

async function capture(target, log, steps, name)
{
    const settled = await settle(target, log);
    const file = "browser-map-evidence/" + name + ".png";
    await target.screenshot({ path: file });
    steps.push({ step: name, settled, view: await readView(target), requestsSoFar: log.requests.length, screenshot: file });
}

async function coldLoadScenario(viewport)
{
    const { context, target, log } = await openScenario(viewport);
    const steps = [];

    try
    {
        const first = await readView(target);
        assert.equal(first.zoom, 7, "Default view must start at zoom 7");
        assert.equal(first.layer, "viking", "Default view must start on Viking");
        await capture(target, log, steps, "cold-" + viewport.name + "-viking-z7");
        await selectLayer(target, "hirise");

        for (const zoom of [8, 9, 10, 11])
        {
            await zoomTo(target, zoom);
            await capture(target, log, steps, "cold-" + viewport.name + "-hirise-z" + zoom);
        }
    }
    finally
    {
        await context.close();
    }

    return { scenario: "cold-load-" + viewport.name, viewport, steps, ...summarize(log) };
}

async function rapidZoomScenario(method)
{
    const { context, target, log } = await openScenario(VIEWPORTS[2]);
    const steps = [];

    try
    {
        await selectLayer(target, "hirise");
        await zoomTo(target, 7);
        await capture(target, log, steps, "rapid-" + method + "-start-z7");

        for (const zoom of [8, 9, 10, 11, 10, 8, 7])
        {
            const current = (await readView(target)).zoom;

            for (let next = current + Math.sign(zoom - current); next !== zoom + Math.sign(zoom - current); next += Math.sign(zoom - current))
            {
                await stepZoom(target, next, method, method === "wheel" ? 0 : 60);
            }
        }

        await capture(target, log, steps, "rapid-" + method + "-end-z7");
    }
    finally
    {
        await context.close();
    }

    return { scenario: "rapid-zoom-" + method, viewport: VIEWPORTS[2], sequence: [7, 8, 9, 10, 11, 10, 8, 7], steps, ...summarize(log) };
}

async function largePanScenario()
{
    const { context, target, log } = await openScenario(VIEWPORTS[2]);
    const steps = [];

    try
    {
        await selectLayer(target, "hirise");
        await zoomTo(target, 11);
        await capture(target, log, steps, "pan-z11-start");
        const box = await target.locator("#map-root").boundingBox();
        const startX = box.x + box.width * 0.75;
        const startY = box.y + box.height * 0.5;
        let travelled = 0;

        // The map element is narrower than 1000 px, so the large pan is done as repeated right-to-left drags.
        while (travelled < 1100)
        {
            const distance = Math.min(box.width * 0.6, 1100 - travelled);
            await target.mouse.move(startX, startY);
            await target.mouse.down();
            await target.mouse.move(startX - distance, startY - distance * 0.1, { steps: 14 });
            await target.mouse.up();
            travelled += distance;
            await target.waitForTimeout(120);
        }

        await capture(target, log, steps, "pan-z11-after-" + Math.round(travelled) + "px");
        await target.evaluate(() => document.querySelector('[data-action="reset-map"]').click());
        await capture(target, log, steps, "pan-z11-recentered");
        const view = await readView(target);
        assert.equal(view.zoom, 11, "Recenter must return to zoom 11");

        const sources = await target.evaluate(() =>
        {
            const root = document.querySelector("#map-root").getBoundingClientRect();
            return [...document.querySelectorAll(".map-hires-tile")].filter(tile =>
            {
                const rect = tile.getBoundingClientRect();
                return tile.style.display !== "none" && tile.dataset.state === "loaded"
                    && rect.right > root.left && rect.left < root.right && rect.bottom > root.top && rect.top < root.bottom;
            }).map(tile => tile.src);
        });
        const tiles = sources.map(tileBounds).filter(Boolean);
        const outside = tiles.filter(tile => !intersects(tile, HIRISE_ENVELOPE));
        const centerTile = tiles.some(tile => tile.south <= JEZERO_CENTER.lat && tile.north >= JEZERO_CENTER.lat
            && tile.west <= JEZERO_CENTER.lon && tile.east >= JEZERO_CENTER.lon);
        steps.push({ step: "recenter-envelope-check", visibleHiriseTiles: tiles.length, outsideEnvelope: outside.map(tile => tile.url), containsJezeroCenter: centerTile });
        assert.ok(tiles.length > 0, "Recenter must show loaded HiRISE tiles");
        assert.deepEqual(outside.map(tile => tile.url), [], "HiRISE tiles after recenter must intersect the Jezero envelope");
        assert.ok(centerTile, "Recenter must show the HiRISE tile that contains Jezero");
    }
    finally
    {
        await context.close();
    }

    return { scenario: "large-pan-z11-recenter", viewport: VIEWPORTS[2], steps, ...summarize(log) };
}

function countBy(items, key)
{
    const counts = {};

    for (const item of items)
    {
        counts[item[key]] = (counts[item[key]] || 0) + 1;
    }

    return Object.entries(counts).map(([name, count]) => name + " ×" + count).join(", ") || "—";
}

async function writeStepSummary(report)
{
    if (!process.env.GITHUB_STEP_SUMMARY)
    {
        return;
    }

    const kinds = item => kind => item.duplicates.filter(entry => entry.kind === kind).length;
    const lines = [
        "## Map stability scenarios",
        "",
        "| Scenario | Requests | Unique | HTTP codes | Real duplicates | Reissue after abort | Retry after error | Failed requests | JS errors | Failed to load |",
        "|---|---:|---:|---|---:|---:|---:|---|---:|---:|",
        ...report.scenarios.map(item => "| " + [
            item.scenario, item.requests, item.uniqueUrls,
            Object.entries(item.statusCodes).map(([code, count]) => code + " ×" + count).join(", ") || "—",
            kinds(item)("real-duplicate"), kinds(item)("reissue-after-abort"), kinds(item)("retry-after-error"),
            item.failedRequests.length ? item.failedRequests.length + " (" + countBy(item.failedRequests, "error") + ")" : "0",
            item.jsErrors.length, item.networkConsoleErrors.length
        ].join(" | ") + " |"),
        ""
    ];
    const duplicates = report.scenarios.flatMap(item => item.duplicates.map(entry => ({ scenario: item.scenario, ...entry })));

    if (duplicates.length)
    {
        lines.push("<details><summary>Repeated tile URLs (" + duplicates.length + ")</summary>", "",
            "| Scenario | Kind | Count | Attempts | URL |", "|---|---|---:|---|---|",
            ...duplicates.slice(0, 60).map(entry => "| " + [entry.scenario, entry.kind, entry.count,
                entry.outcomes.map(item => "+" + item.afterMs + "ms " + (item.error || item.status || "no response")).join("; "),
                entry.url.replace(/^https:\/\/trek\.nasa\.gov\/tiles\/Mars\/EQ\//, "")].join(" | ") + " |"),
            "", "</details>", "");
    }

    lines.push(...report.notes.map(note => "> " + note), "");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

async function runStabilityScenarios()
{
    const report = {
        browser: "Chromium",
        notes: [
            "Cold load opens a fresh browser context on the default view (Viking zoom 7, set in src/map.js). It is not a URL deep link: no ?z=&layer= parameter exists yet.",
            "Duplicates are tile URLs requested more than once in one scenario. retry-after-error means every repeat followed an HTTP error or failed request by at least 15 s (the map retries after 16 s)."
        ],
        scenarios: []
    };

    try
    {
        for (const viewport of VIEWPORTS)
        {
            report.scenarios.push(await coldLoadScenario(viewport));
        }

        report.scenarios.push(await rapidZoomScenario("buttons"));
        report.scenarios.push(await rapidZoomScenario("wheel"));
        report.scenarios.push(await largePanScenario());
    }
    finally
    {
        await writeFile("browser-map-evidence/report.json", JSON.stringify(report, null, 2));
        await writeStepSummary(report);
        console.log("STABILITY_REPORT " + JSON.stringify(report.scenarios.map(item => (
        {
            scenario: item.scenario, requests: item.requests, statusCodes: item.statusCodes,
            httpErrors: item.httpErrors.length, realDuplicates: item.duplicates.filter(entry => entry.kind === "real-duplicate").length,
            reissueAfterAbort: item.duplicates.filter(entry => entry.kind === "reissue-after-abort").length,
            retries: item.duplicates.filter(entry => entry.kind === "retry-after-error").length,
            failedRequests: item.failedRequests.length,
            jsErrors: item.jsErrors.length, networkConsoleErrors: item.networkConsoleErrors.length
        }))));

        for (const item of report.scenarios)
        {
            for (const entry of item.duplicates)
            {
                console.log("DUPLICATE " + item.scenario + " " + entry.kind + " " + entry.count + "x " + entry.url + " " + JSON.stringify(entry.outcomes));
            }

            for (const entry of item.failedRequests)
            {
                console.log("FAILED_REQUEST " + item.scenario + " " + entry.error + " " + entry.url);
            }
        }
    }

    const notFound = report.scenarios.flatMap(item => item.httpErrors.filter(entry => entry.status === 404).map(entry => item.scenario + " " + entry.url));
    const duplicates = report.scenarios.flatMap(item => item.duplicates.filter(entry => entry.kind === "real-duplicate").map(entry => item.scenario + " " + entry.count + "x " + entry.url));
    const jsErrors = report.scenarios.flatMap(item => item.jsErrors.map(text => item.scenario + " " + text));
    assert.deepEqual(notFound, [], "Tile 404s on used levels");
    assert.deepEqual(duplicates, [], "Duplicate tile requests");
    assert.deepEqual(jsErrors, [], "JavaScript console errors");
}

try
{
    await mkdir("browser-map-evidence", { recursive: true });
    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#map-root");

    await page.evaluate(() =>
    {
        const button = document.querySelector('[data-layer="hirise"]');
        if (!button)
        {
            throw new Error("HiRISE layer button not found");
        }
        button.click();
    });

    await zoomUntil(8);

    try
    {
        await page.waitForFunction(() =>
            [...document.querySelectorAll(".map-background-tile")].some(item => item.dataset.state === "loaded" && item.style.display !== "none" && item.getBoundingClientRect().right > document.querySelector("#map-root").getBoundingClientRect().left && item.getBoundingClientRect().left < document.querySelector("#map-root").getBoundingClientRect().right),
            null, { timeout: 12000 });
    }
    catch (error)
    {
        const diagnostic = await page.evaluate(() =>
        {
            const root = document.querySelector("#map-root").getBoundingClientRect();
            return [...document.querySelectorAll(".map-background-tile")].map(img =>
            {
                const rect = img.getBoundingClientRect();
                return {
                    state: img.dataset.state, width: img.naturalWidth,
                    complete: img.complete, display: img.style.display,
                    visible: rect.right > root.left && rect.left < root.right && rect.bottom > root.top && rect.top < root.bottom && img.style.display !== "none",
                    url: img.src, position: [Math.round(rect.left), Math.round(rect.top)]
                };
            });
        });

        console.log("BROWSER_TILE_DIAGNOSTIC " + JSON.stringify(diagnostic));
        console.log("NASA_RESPONSE_DIAGNOSTIC " + JSON.stringify(responses.slice(-45)));
        console.log("PAGE_ERRORS " + JSON.stringify(errors));
        await page.locator("#map-root").screenshot({ path: "browser-map-evidence/zoom8-failed.png" });
        throw error;
    }

    const view8 = await inspect("HiRISE selector at zoom 8");
    assert.ok(view8.backdropLoaded > 0);
    assert.equal(view8.detailVisible, 0);
    assert.equal(view8.contextVisible, 0, "Zoom 8 must not show a sharp isolated CTX rectangle");
    assert.equal(await page.locator(".map-overlays .route-node").count(), 0,
        "Fresh missions must not contain automatically created waypoints");
    assert.ok(view8.bannerHidden);
    await page.locator("#map-root").screenshot({ path: "browser-map-evidence/zoom8.png" });

    const requestsAt8 = network.filter(url => url.includes("Mars_Viking_MDIM21")).length;

    await zoomUntil(9);
    await page.waitForFunction(() =>
        [...document.querySelectorAll(".map-context-tile")].some(item => item.dataset.state === "loaded" && item.style.display !== "none"),
        null, { timeout: 20000 });
    await waitForLoadedTiles(".map-context-tile");
    const view9 = await inspect("NASA controlled CTX at zoom 9");
    assert.ok(view9.contextLoaded > 0);
    assert.ok(view9.contextWidths.every(width => width === 256));
    const contextMask = await page.locator(".map-context-tiles").evaluate(element => getComputedStyle(element).maskImage);
    assert.match(contextMask, /linear-gradient/i, "CTX must use a geographic feather mask");
    await page.locator("#map-root").screenshot({ path: "browser-map-evidence/zoom9-context.png" });

    await zoomUntil(11);
    await page.waitForFunction(() =>
        [...document.querySelectorAll(".map-hires-tile")].some(item => item.dataset.state === "loaded" && item.style.display !== "none" && item.getBoundingClientRect().right > document.querySelector("#map-root").getBoundingClientRect().left),
        null, { timeout: 25000 });

    const view11 = await inspect("HiRISE at zoom 11");
    assert.ok(view11.backdropLoaded > 0);
    assert.ok(view11.detailLoaded > 0);
    await page.waitForFunction(() =>
        [...document.querySelectorAll(".map-context-tile")].some(item => item.dataset.state === "loaded" && item.style.display !== "none"),
        null, { timeout: 20000 });
    await waitForLoadedTiles(".map-context-tile");
    await waitForLoadedTiles(".map-hires-tile");
    const full11 = await inspect("CTX under HiRISE at zoom 11");
    assert.equal(full11.contextLoaded, full11.contextVisible);
    assert.equal(full11.detailLoaded, full11.detailVisible);
    assert.ok(full11.contextWidths.every(width => width === 256));
    assert.ok(view11.bannerHidden);
    assert.ok(view11.detailWidths.every(width => width === 256));
    const hiriseMask = await page.locator(".map-tiles").evaluate(element => getComputedStyle(element).maskImage);
    assert.match(hiriseMask, /linear-gradient/i, "HiRISE must use a geographic feather mask");
    await page.locator("#map-root").screenshot({ path: "browser-map-evidence/zoom11.png" });

    const requestsAt11 = network.filter(url => url.includes("Mars_Viking_MDIM21")).length;
    assert.ok(requestsAt11 - requestsAt8 <= 3,
        "Zooming in downloaded too many duplicate Viking images: " + (requestsAt11 - requestsAt8));

    await zoomUntil(7);
    const view7 = await inspect("HiRISE selector at zoom 7");
    assert.equal(view7.detailVisible, 0);
    await zoomUntil(8);
    await zoomUntil(11);
    const viewReturn = await inspect("After zoom 11 → 7 → 8 → 11");

    const requestsAfter = network.filter(url => url.includes("Mars_Viking_MDIM21")).length;
    assert.ok(requestsAfter - requestsAt11 <= 8, "Repeated zoom downloads too many Viking images");
    assert.ok(viewReturn.backdropVisible > 0);

    const mapBox = await page.locator("#map-root").boundingBox();
    assert.ok(mapBox && mapBox.width > 400);
    const originX = mapBox.x + mapBox.width * 0.45;
    const originY = mapBox.y + mapBox.height * 0.48;

    await page.mouse.move(originX, originY);
    await page.mouse.down();
    await page.mouse.move(originX + 320, originY + 45, { steps: 12 });
    await page.mouse.up();

    await page.waitForFunction(() =>
    {
        const root = document.querySelector("#map-root").getBoundingClientRect();
        return [...document.querySelectorAll(".map-background-tile")].some(item =>
        {
            const rect = item.getBoundingClientRect();
            return item.dataset.state === "loaded" && item.style.display !== "none"
                && rect.right > root.left && rect.left < root.right
                && rect.bottom > root.top && rect.top < root.bottom;
        });
    }, null, { timeout: 15000 });

    const afterPan = await inspect("After 320px pan at zoom 11");
    assert.ok(afterPan.backdropLoaded > 0);
    assert.equal(afterPan.bannerHidden, true);
    assert.ok(afterPan.detailWidths.every(width => width === 256));
    await page.locator("#map-root").screenshot({ path: "browser-map-evidence/zoom11-panned.png" });

    const failedContext = responses.filter(item =>
        item.url.includes("JEZ_ctx_B_soc_008_orthoMosaic_6m") && item.status !== 200);
    assert.deepEqual(failedContext, [], "NASA Jezero CTX tiles must load without HTTP errors");

    // Editor V2: manual creation, metadata, local persistence and editable map markers.
    await page.locator('[data-action="add-coordinates"]').click();
    await page.locator("#latitude-input").fill("18.4446");
    await page.locator("#longitude-input").fill("77.4509");
    await page.locator('#coordinate-form button[type="submit"]').click();
    await page.locator(".map-overlays .route-node").first().click();
    await page.locator("#waypoint-name-input").fill("Delta science site");
    await page.locator("#waypoint-description-input").fill("User-proposed geological sampling stop");
    await page.locator("#waypoint-category-input").selectOption("science");
    await page.locator("#waypoint-icon-input").selectOption("star");
    await page.locator("#waypoint-use-route-color").uncheck();
    await page.locator("#waypoint-color-input").fill("#75d1c8");
    await page.locator('#waypoint-editor-form button[type="submit"]').click();

    assert.match(await page.locator("#waypoint-list .waypoint-coordinates strong").first().textContent(), /Delta science site/);
    await page.waitForFunction(() => document.querySelector(".map-overlays .route-node")?.getAttribute("fill") === "#75d1c8",
        null, { timeout: 7000 });
    await page.locator('[data-action="undo-edit"]').click();
    assert.doesNotMatch(await page.locator("#waypoint-list .waypoint-coordinates strong").first().textContent(), /Delta science site/);
    await page.locator('[data-action="redo-edit"]').click();
    assert.match(await page.locator("#waypoint-list .waypoint-coordinates strong").first().textContent(), /Delta science site/);

    await page.locator(".map-overlays .route-node").first().click({ button: "right" });
    assert.equal(await page.locator('#map-context-menu [data-context-action="edit-waypoint"]').isVisible(), true);
    await page.locator('#map-context-menu [data-context-action="edit-waypoint"]').click();
    assert.equal(await page.locator("#waypoint-name-input").inputValue(), "Delta science site");
    await page.locator("#waypoint-editor-modal").screenshot({ path: "browser-map-evidence/waypoint-editor-v2.png" });
    await page.locator("#waypoint-editor-modal .modal-x").click();

    await page.reload({ waitUntil: "domcontentloaded" });
    assert.match(await page.locator("#waypoint-list .waypoint-coordinates strong").first().textContent(), /Delta science site/,
        "Manual waypoint metadata must persist after a browser reload");
    await page.waitForFunction(() => document.querySelector(".map-overlays .route-node")?.getAttribute("fill") === "#75d1c8",
        null, { timeout: 7000 });

    // Direct on-map editing and deletion of turquoise field observation markers.
    await page.locator(".mode-btn[data-mode='observe']").click();
    const observationMapBox = await page.locator("#map-root").boundingBox();
    await page.locator("#map-root").click({ position: { x: observationMapBox.width * .77, y: observationMapBox.height * .58 } });
    await page.locator("#observation-title").fill("Test removable observation");
    await page.locator("#observation-note").fill("User-entered field note");
    await page.locator("#observation-submit").click();
    await page.waitForFunction(() => document.querySelectorAll(".map-overlays .observation-node").length === 1);
    await page.locator(".map-overlays .observation-node").first().click();
    assert.equal(await page.locator("#observation-modal h2").textContent(), "Edit field observation");
    await page.locator("#observation-title").fill("Updated observation");
    await page.locator("#observation-submit").click();
    assert.match(await page.locator("#observation-list").textContent(), /Updated observation/);

    await page.locator(".map-overlays .observation-node").first().click({ button: "right" });
    assert.equal(await page.locator('#map-context-menu [data-context-action="delete-observation"]').isVisible(), true);
    page.once("dialog", dialog => dialog.accept());
    await page.locator('#map-context-menu [data-context-action="delete-observation"]').click();
    await page.waitForFunction(() => document.querySelectorAll(".map-overlays .observation-node").length === 0);
    await page.locator('[data-action="undo-edit"]').click();
    await page.waitForFunction(() => document.querySelectorAll(".map-overlays .observation-node").length === 1);
    await page.locator(".map-overlays .observation-node").first().click();
    assert.equal(await page.locator("#observation-delete").isVisible(), true);
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#observation-delete").click();
    await page.waitForFunction(() => document.querySelectorAll(".map-overlays .observation-node").length === 0);

    // Numeric DEM: waypoint segment, profile selection, map probe and provenance.
    await page.locator('[data-action="add-coordinates"]').click();
    await page.locator("#latitude-input").fill("18.446");
    await page.locator("#longitude-input").fill("77.452");
    await page.locator('#coordinate-form button[type="submit"]').click();
    await page.locator('.analytics-categories [data-group="terrain"]').click();
    await page.locator("#dem-load-official").click();
    await page.waitForFunction(() => document.querySelector("#terrain-v2-slider")?.disabled === false,
        null, { timeout: 20000 });
    assert.equal(await page.locator("#terrain-v2-waypoints .terrain-v2-waypoint").count(), 2);
    await page.locator("#terrain-v2-slider").focus();
    await page.locator("#terrain-v2-slider").press("End");
    await page.waitForFunction(() => document.querySelector(".map-overlays .terrain-probe-marker") !== null);
    assert.match(await page.locator("#terrain-v2-readout").textContent(), /along route/);
    await page.locator("#terrain-profile").screenshot({ path: "browser-map-evidence/terrain-profile-v2.png" });
    await page.locator("#terrain-v2-clear").click();
    assert.equal(await page.locator(".map-overlays .terrain-probe-marker").count(), 0);

    // Judge-facing A* explanation: same DEM and anchors, three preferences, no AI scoring.
    await page.locator("#terrain-grade").evaluate(input =>
    {
        input.closest("details").open = true;
    });
    await page.locator("#terrain-grade").fill("100");
    await page.locator("#terrain-grade").dispatchEvent("change");
    await page.locator("#terrain-compare").click();
    await page.waitForFunction(() =>
    {
        const report = document.querySelector("#terrain-why-report");
        return report?.querySelector(".why-verdict") || /No valid modeled alternatives/.test(report?.textContent || "");
    }, null, { timeout: 20000 });
    const resultState = await page.locator("#terrain-why-report").textContent();
    assert.match(resultState, /minimum|equivalent|no valid modeled alternatives/i);
    assert.equal(await page.locator("#terrain-why-preference").isDisabled(), false);
    assert.equal(await page.locator("#terrain-strategies .strategy-card").count(), 3);

    if (await page.locator("#terrain-why-report .why-verdict").count())
    {
        assert.equal(await page.locator("#terrain-why-report .why-data-table tbody tr").count() >= 1, true);
        assert.equal(await page.locator("#terrain-why-report .why-bar-row").count() >= 1, true);
        assert.equal(await page.locator("#terrain-why-report .why-scatter svg").count(), 1);
        const beforePreference = await page.locator("#terrain-why-report .why-verdict").textContent();
        await page.locator("#terrain-why-preference").selectOption("distance");
        assert.match(await page.locator("#terrain-why-report .why-verdict").textContent(), /λ = 0/);
        await page.locator("#terrain-why-preference").selectOption("gentle");
        assert.match(await page.locator("#terrain-why-report .why-verdict").textContent(), /λ = 24/);
        assert.equal(await page.locator("#waypoint-list [data-waypoint-row]").count(), 2,
            "Changing preference must not add or move user waypoints");
        await page.locator("#terrain-why").screenshot({ path: "browser-map-evidence/why-this-route-v2.png" });
        console.log(JSON.stringify({ label: "WHY THIS ROUTE checks", feasible: true, beforePreference }));
    }
    else
    {
        assert.match(resultState, /no valid modeled alternatives/i);
        console.log(JSON.stringify({ label: "WHY THIS ROUTE checks", feasible: false,
            note: "Bundled DEM route contains no valid path; the UI correctly declines to recommend a route." }));
    }


    // Analytics usability audit: the V2 waypoint list must not squeeze names into vertical letters.
    await page.locator('.analytics-categories [data-group="overview"]').click();
    const layout = await page.locator('[data-waypoint-row]').first().evaluate(row =>
    {
        const info = row.querySelector(".waypoint-coordinates");
        const title = info.querySelector("strong");
        const actions = row.querySelector(".waypoint-actions");
        const list = row.closest("#waypoint-list");
        const infoRect = info.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();

        return {
            infoWidth: infoRect.width,
            titleWhitespace: getComputedStyle(title).whiteSpace,
            buttonCount: actions.querySelectorAll("button").length,
            actionsWithinRow: actionsRect.right <= rowRect.right + 2,
            rowWithinPanel: rowRect.right <= listRect.right + 2,
            stacked: actionsRect.top >= infoRect.bottom - 2
        };
    });
    console.log(JSON.stringify({ label: "Waypoint layout 1480px", ...layout }));
    assert.ok(layout.infoWidth >= 130, "Waypoint names need a full-width text row");
    assert.equal(layout.titleWhitespace, "nowrap");
    assert.equal(layout.actionsWithinRow, true);
    assert.equal(layout.rowWithinPanel, true);
    assert.equal(layout.stacked, true);
    await page.locator("#waypoint-list").screenshot({ path: "browser-map-evidence/waypoint-layout-v3.png" });

    assert.equal(await page.locator('[data-ready-item="route"]').getAttribute("data-ready"), "true");
    assert.equal(await page.locator('[data-ready-item="dem"]').getAttribute("data-ready"), "true");
    assert.equal(await page.locator('[data-ready-item="alternative"]').getAttribute("data-ready"), "false");
    assert.ok(await page.locator("#route-connectivity-graph svg line").count() > 0,
        "Waypoint graph must show real segment edges");

    // Crew Profile requires authentication; private profile data are never exposed signed-out.
    await page.locator("#mission-hub-open").click();
    await page.locator('[data-hub-tab="crew"]').click();
    assert.equal(await page.locator("#hub-crew").isVisible(), true);
    assert.equal(await page.locator("#crew-profile-login").isVisible(), true);
    assert.equal(await page.locator("#crew-profile-content").isVisible(), false);
    await page.locator("#crew-go-login").click();
    assert.equal(await page.locator("#hub-cloud").isVisible(), true);
    await page.locator("#cloud-close").click();

    // Responsive viewport audit: the screenshot regression on the waypoint sidebar.
    for (const width of [320, 375, 768, 1024, 1480])
    {
        await page.setViewportSize({ width, height: width >= 1200 ? 960 : 820 });

        if (width <= 1200)
        {
            await page.evaluate(() => document.querySelector('[data-action="show-analytics"]').click());
        }

        await page.locator('.analytics-categories [data-group="overview"]').click();
        const geometry = await page.locator('[data-waypoint-row]').first().evaluate(row =>
        {
            const list = row.closest("#waypoint-list");
            const actions = row.querySelector(".waypoint-actions");
            const label = row.querySelector(".waypoint-coordinates strong");
            const bounds = row.getBoundingClientRect();
            const actionBounds = actions.getBoundingClientRect();
            const listBounds = list.getBoundingClientRect();
            return {
                usableWidth: bounds.width,
                labelWidth: label.getBoundingClientRect().width,
                titleWhitespace: getComputedStyle(label).whiteSpace,
                buttonsVisible: [...actions.querySelectorAll("button")].every(button =>
                    button.getBoundingClientRect().width > 25),
                noSideOverflow: actionBounds.left >= bounds.left - 2 &&
                    actionBounds.right <= bounds.right + 2 &&
                    bounds.right <= listBounds.right + 2,
                noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2
            };
        });
        console.log(JSON.stringify({ label: "Waypoint responsive QA", viewport: width, ...geometry }));
        assert.equal(geometry.titleWhitespace, "nowrap");
        assert.ok(geometry.labelWidth >= 90);
        assert.equal(geometry.buttonsVisible, true);
        assert.equal(geometry.noSideOverflow, true);
        assert.equal(geometry.noPageOverflow, true);

        if (width === 375)
        {
            await page.locator("#waypoint-list").screenshot({ path: "browser-map-evidence/waypoint-mobile-375.png" });
        }
    }

    // Guided actions are explicit and do not insert an unrequested example.
    const beforeGuide = await page.locator('[data-waypoint-row]').count();
    await page.locator('[data-ready-action="alternative"]').click();
    assert.equal(await page.locator('[data-ready-item="alternative"]').getAttribute("data-ready"), "true");
    assert.equal(await page.locator('[data-waypoint-row]').count(), 0,
        "New alternative routes start empty, never with random example points");
    assert.equal(beforeGuide, 2);

    const unique = new Set(network);
    console.log(JSON.stringify({
        browser: "Chromium", totalNasaRequests: network.length,
        uniqueNasaUrls: unique.size, vikingRequestsAt8: requestsAt8,
        vikingRequestsAt11: requestsAt11, vikingRequestsAfterReturn: requestsAfter,
        controlledCtxRequests: network.filter(url => url.includes("JEZ_ctx_B_soc_008_orthoMosaic_6m")).length,
        contextFailures: failedContext.length, pageErrors: errors
    }));

    assert.ok(!errors.some(item => /map\.js|Cannot read properties|Uncaught SyntaxError/.test(item)),
        "Map browser JS errors: " + errors.join("; "));

    await runStabilityScenarios();
}
finally
{
    await browser.close();
}
