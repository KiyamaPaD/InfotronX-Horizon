import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "https://mars-atlas-map.netlify.app/";
const browser = await chromium.launch({headless:true,args:["--no-sandbox"], executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const context = await browser.newContext({viewport:{width:1480,height:960}});

await context.addInitScript(() =>
{
    try { localStorage.setItem("mars-atlas.workflow-step","all"); }
    catch {}
});

const page = await context.newPage();
const results = [];
const errors = [];
page.on("pageerror",error => errors.push(error.message.slice(0,160)));

async function check(label,task)
{
    try
    {
        const detail = await task();
        results.push({label,result:"PASS",detail:String(detail || "").slice(0,160)});
        console.log("PASS " + label + " " + String(detail || ""));
    }
    catch(error)
    {
        results.push({label,result:"FAIL",detail:error.message.slice(0,200)});
        console.log("FAIL " + label + " " + error.message);
    }
}

await check("PUBLIC_PAGE",async () =>
{
    const response = await page.goto(origin,{waitUntil:"domcontentloaded",timeout:25000});
    assert.equal(response?.status(),200);
    await page.locator("#mission-hub-open").waitFor({timeout:12000});
    return page.title();
});

await check("TEAM_CHAT_SIGNED_OUT",async () =>
{
    await page.locator("#mission-hub-open").click();
    await page.locator('[data-hub-tab="chat"]').click();
    assert.equal(await page.locator("#hub-chat").isVisible(),true);
    assert.equal(await page.locator("#team-chat-login").isVisible(),true);
    assert.equal(await page.locator("#team-chat-signed").isVisible(),false);
    await page.locator("#cloud-close").click();
    return "Private conversations correctly require login";
});

await check("DEM_AND_WEBGL_3D",async () =>
{
    await page.locator('[data-action="load-review-demo"]').click();
    await page.locator('.analytics-categories [data-group="terrain"]').click();
    await page.locator("#dem-load-official").click();
    await page.waitForFunction(() => /USGS CTX DTM|GRID LOADED|could not load/i.test(
        document.querySelector("#dem-status")?.textContent || ""),null,{timeout:25000});
    const demLabel = await page.locator("#dem-status").textContent();
    assert.match(demLabel,/USGS CTX DTM|GRID LOADED/, "The public DEM failed: " + demLabel);
    const section = page.locator('.terrain-3d-panel');
    if (await section.locator('.analytics-section-toggle').getAttribute('aria-expanded') === 'false')
    {
        await section.locator('.analytics-section-toggle').click();
    }
    await page.locator("#terrain-3d-open").evaluate(element => { element.open=true; });
    await page.waitForFunction(() => /valid samples|WebGL unavailable/.test(
        document.querySelector("#terrain-3d-info")?.textContent || ""),null,{timeout:15000});
    const status=await page.locator("#terrain-3d-info").textContent();
    assert.match(status,/valid samples/);
    await mkdir("browser-map-evidence",{recursive:true});
    await page.locator(".terrain-3d-view").screenshot({path:"browser-map-evidence/public-netlify-3d.png"});
    return status;
});

await check("LOCAL_COPILOT",async () =>
{
    await page.locator('.analytics-categories [data-group="models"]').click();
    await page.locator('[data-topic="overview"]').click();
    assert.equal(await page.locator("#copilot-output .assistant-metrics strong").count(),4);
    return "Local math works without cloud or AI";
});

await check("AI_STATUS_DIAGNOSTIC_PRESENT",async () =>
{
    assert.equal(await page.locator("#copilot-health").count(),1);
    await page.locator("#copilot-health").click();
    assert.match(await page.locator("#copilot-output").textContent(),/Sign in through Mission Center/);
    return "Signed-out diagnostics correctly require login";
});

await check("MAP_3D_ACTION",async () =>
{
    assert.ok(await page.locator('[data-action="open-3d"]').count());
    await page.locator('[data-action="open-3d"]').click();
    await page.locator(".map-3d-layer").waitFor({timeout:7000});
    await page.waitForTimeout(1800);
    const status = await page.locator('[data-3d="status"]').textContent();
    await page.locator('[data-3d="close"]').click();
    assert.doesNotMatch(status,/could not load/i);
    return status;
});

const report={origin,commit:process.env.GITHUB_SHA,checks:results,
    browserErrors:errors,failed:results.filter(x=>x.result==="FAIL").length};
await writeFile("public-site-browser.json",JSON.stringify(report,null,2)+"\n");
if(report.failed||errors.length)
{
    console.log("::warning title=Public site browser audit::Some functions failed; see public-site-browser.json.");
}
console.log(JSON.stringify({publicAudit:results.map(x=>({name:x.label,status:x.result})),errors}));
await browser.close();
