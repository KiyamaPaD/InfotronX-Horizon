import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

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
        const loaded = image => image.naturalWidth >= 240 && image.dataset.state === "loaded";
        const banner = document.querySelector("#map-root .map-load-notice");

        return {
            zoom: document.querySelector("#zoom-text").textContent,
            backdropVisible: backdrop.length,
            backdropLoaded: backdrop.filter(loaded).length,
            detailVisible: detail.length,
            detailLoaded: detail.filter(loaded).length,
            backdropWidths: [...new Set(backdrop.map(item => Math.round(item.getBoundingClientRect().width)))],
            detailWidths: [...new Set(detail.map(item => Math.round(item.getBoundingClientRect().width)))],
            bannerHidden: banner.hidden,
            bannerText: banner.textContent
        };
    });

    console.log(JSON.stringify({ label, ...info }));
    console.log(JSON.stringify({ nasaResponses: responses.length, failed: responses.filter(item => item.status >= 400).slice(-8) }));
    return info;
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
    assert.ok(view8.bannerHidden);
    await page.locator("#map-root").screenshot({ path: "browser-map-evidence/zoom8.png" });

    const requestsAt8 = network.filter(url => url.includes("Mars_Viking_MDIM21")).length;

    await zoomUntil(11);
    await page.waitForFunction(() =>
        [...document.querySelectorAll(".map-hires-tile")].some(item => item.dataset.state === "loaded" && item.style.display !== "none" && item.getBoundingClientRect().right > document.querySelector("#map-root").getBoundingClientRect().left),
        null, { timeout: 25000 });

    const view11 = await inspect("HiRISE at zoom 11");
    assert.ok(view11.backdropLoaded > 0);
    assert.ok(view11.detailLoaded > 0);
    assert.ok(view11.bannerHidden);
    assert.ok(view11.detailWidths.every(width => width === 256));
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

    const unique = new Set(network);
    console.log(JSON.stringify({
        browser: "Chromium", totalNasaRequests: network.length,
        uniqueNasaUrls: unique.size, vikingRequestsAt8: requestsAt8,
        vikingRequestsAt11: requestsAt11, vikingRequestsAfterReturn: requestsAfter,
        pageErrors: errors
    }));

    assert.ok(!errors.some(item => /map\.js|Cannot read properties|Uncaught SyntaxError/.test(item)),
        "Map browser JS errors: " + errors.join("; "));
}
finally
{
    await browser.close();
}
