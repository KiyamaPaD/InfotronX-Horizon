// Measures real map loading and memory numbers for docs/MAP_ENGINE.md (plan step 1.5).
// Usage: serve the repo on 127.0.0.1:4173, then `node scripts/map-performance.mjs [runs] [sessionSeconds]`.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const APP_URL = "http://127.0.0.1:4173/";
const RUNS = Number(process.argv[2] || 3);
const SESSION_SECONDS = Number(process.argv[3] || 120);
const VIEWPORTS = [
    { name: "desktop-1480", width: 1480, height: 960 },
    { name: "mobile-375", width: 375, height: 812 }
];
const TILE_SELECTOR = ".map-tile, .map-background-tile, .map-context-tile, .map-hires-tile";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

function median(values)
{
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
}

async function openPage(viewport)
{
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    await context.addInitScript(selector =>
    {
        window.__perf = { firstRealImage: null, lcp: null, lcpElement: null };
        new PerformanceObserver(list =>
        {
            const entry = list.getEntries().at(-1);
            window.__perf.lcp = entry.startTime;
            window.__perf.lcpElement = entry.element ? entry.element.tagName + "." + entry.element.className : entry.url || null;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // A tile reaches data-state="loaded" only when its full NASA image decoded, never for a preview or placeholder.
        new MutationObserver(() =>
        {
            if (window.__perf.firstRealImage === null && document.querySelector(selector.split(", ").map(item => item + "[data-state='loaded']").join(", ")))
            {
                window.__perf.firstRealImage = performance.now();
            }
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    }, TILE_SELECTOR);
    const page = await context.newPage();
    return { context, page };
}

async function coldLoad(viewport)
{
    const { context, page } = await openPage(viewport);

    try
    {
        await page.goto(APP_URL, { waitUntil: "load" });
        await page.waitForFunction(() => window.__perf.firstRealImage !== null, null, { timeout: 30000 });
        // LCP is final once the page is idle and before any user input.
        await page.waitForTimeout(4000);
        return await page.evaluate(() =>
        {
            const navigation = performance.getEntriesByType("navigation")[0];
            const paint = performance.getEntriesByName("first-contentful-paint")[0];
            return {
                firstRealImageMs: Math.round(window.__perf.firstRealImage),
                lcpMs: Math.round(window.__perf.lcp),
                lcpElement: window.__perf.lcpElement,
                fcpMs: paint ? Math.round(paint.startTime) : null,
                domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
                loadMs: Math.round(navigation.loadEventEnd)
            };
        });
    }
    finally
    {
        await context.close();
    }
}

async function metrics(session, page)
{
    const { metrics: list } = await session.send("Performance.getMetrics");
    const value = name => list.find(item => item.name === name)?.value;
    const dom = await page.evaluate(selector => ({ tiles: document.querySelectorAll(selector).length, images: document.querySelectorAll("img").length }), TILE_SELECTOR);
    return { jsHeapMb: Number((value("JSHeapUsedSize") / 1048576).toFixed(1)), domNodes: value("Nodes"), ...dom };
}

async function panZoomSession(viewport)
{
    const { context, page } = await openPage(viewport);

    try
    {
        await page.goto(APP_URL, { waitUntil: "load" });
        await page.waitForFunction(() => window.__perf.firstRealImage !== null, null, { timeout: 30000 });
        const session = await context.newCDPSession(page);
        await session.send("Performance.enable");
        await page.evaluate(() => document.querySelector('[data-layer="hirise"]').click());
        await page.waitForTimeout(3000);
        await session.send("HeapProfiler.collectGarbage");
        const before = await metrics(session, page);
        const box = await page.locator("#map-root").boundingBox();
        const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]];
        const zoomCycle = [8, 9, 10, 11, 10, 9];
        const started = Date.now();
        let gestures = 0;

        while (Date.now() - started < SESSION_SECONDS * 1000)
        {
            const [dx, dy] = directions[gestures % directions.length];
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + dx * box.width * 0.3, y + dy * box.height * 0.3, { steps: 8 });
            await page.mouse.up();

            if (gestures % 3 === 2)
            {
                const target = zoomCycle[Math.floor(gestures / 3) % zoomCycle.length];
                const current = Number((await page.locator("#zoom-text").textContent()).match(/\d+/)[0]);
                if (target !== current) await page.evaluate(action => document.querySelector('[data-action="' + action + '"]').click(), target > current ? "zoom-in" : "zoom-out");
            }

            if (gestures % 12 === 11)
            {
                await page.evaluate(() => document.querySelector('[data-action="reset-map"]').click());
            }

            gestures++;
            await page.waitForTimeout(350);
        }

        const after = await metrics(session, page);
        await session.send("HeapProfiler.collectGarbage");
        await page.waitForTimeout(500);
        const afterGc = await metrics(session, page);
        return { seconds: SESSION_SECONDS, gestures, before, after, afterGc };
    }
    finally
    {
        await context.close();
    }
}

const report = { date: new Date().toISOString(), browser: "Chromium " + browser.version() + " headless", runs: RUNS, viewports: [] };

try
{
    for (const viewport of VIEWPORTS)
    {
        const loads = [];

        for (let run = 0; run < RUNS; run++)
        {
            loads.push(await coldLoad(viewport));
        }

        const summary = Object.fromEntries(["firstRealImageMs", "lcpMs", "fcpMs", "domContentLoadedMs", "loadMs"].map(key => [key, median(loads.map(item => item[key]))]));
        const session = await panZoomSession(viewport);
        report.viewports.push({ viewport, medianColdLoad: summary, coldLoads: loads, panZoomSession: session });
        console.log(JSON.stringify({ viewport: viewport.name, medianColdLoad: summary, lcpElements: [...new Set(loads.map(item => item.lcpElement))], session }));
    }

    await mkdir("browser-map-evidence", { recursive: true });
    await writeFile("browser-map-evidence/performance.json", JSON.stringify(report, null, 2));
}
finally
{
    await browser.close();
}
