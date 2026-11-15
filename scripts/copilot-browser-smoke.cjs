const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1480,height:960}});
 if(process.env.MARS_TEST_PROXY_ASSETS==='1') await require('./browser-public-assets.cjs')(page);
 const errors=[]; const aiRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/functions/v1/mars-mission-copilot')) aiRequests.push(r.url());});
 await page.goto(process.env.MARS_ATLAS_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 await page.locator('button[data-step="all"]').click();
 await page.locator('[data-action="open-copilot"]').click();
 assert.equal(await page.locator('.copilot-section .analytics-section-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#copilot-output .assistant-metrics strong').count(),4);
 assert.equal(await page.locator('#copilot-question, #copilot-use-ai').count(),0);
 assert.doesNotMatch(await page.locator('.copilot-section').innerText(),/API|billing|secret|prompt|generative|OpenAI|DETERMINISTIC/i);
 await page.locator('[data-topic="terrain"]').click();
 assert.match(await page.locator('#copilot-output').textContent(),/Load Jezero/);
 await page.locator('.copilot-section .analytics-section-toggle').click();
 assert.equal(await page.locator('.assistant-topics').isVisible(),false);
 await page.locator('.copilot-section .analytics-section-toggle').focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('[data-topic="terrain"]').getAttribute('aria-pressed'),'true');
 const mapToggle=page.locator('.workspace-panel-toggle').filter({hasText:'MAP DATA'});
 await mapToggle.click();
 assert.ok(await page.locator('#layer-buttons').isVisible());
 await mapToggle.click();
 const planner=page.locator('.workspace-panel-toggle').filter({hasText:'ROUTE PLANNER'});
 await planner.click();
 assert.equal(await page.locator('#route-list').isVisible(),false);
 await planner.focus(); await page.keyboard.press('Enter');
 assert.ok(await page.locator('#route-list').isVisible());
 // Actual route input, editing and reload, rather than test-only state injection.
 for(const [lat,lon] of [['18.4446','77.4509'],['18.446','77.452']]) {
   await page.locator('.route-primary-actions [data-action="add-coordinates"]').click();
   await page.locator('#latitude-input').fill(lat); await page.locator('#longitude-input').fill(lon);
   await page.locator('#coordinate-form button[type="submit"]').click();
 }
 await page.locator('[data-action="open-copilot"]').click();
 await page.locator('[data-topic="overview"]').click();
 assert.equal(await page.locator('.assistant-metrics strong').nth(1).textContent(),'2');
 await page.locator('[data-topic="resources"]').click();
 assert.match(await page.locator('#copilot-output').textContent(),/kg/);
 await page.locator('[data-group="terrain"]').click();
 await page.locator('#dem-load-official').click();
 await page.waitForFunction(()=>!document.querySelector('#terrain-compare').disabled);
 const terrain3d=page.locator('.terrain-3d-panel');
 if(await terrain3d.locator('.analytics-section-toggle').getAttribute('aria-expanded')==='false') await terrain3d.locator('.analytics-section-toggle').click();
 await page.locator('#terrain-3d-open > summary').click();
 await page.waitForFunction(()=>/valid samples|WebGL unavailable/.test(document.querySelector('#terrain-3d-info').textContent));
 assert.match(await page.locator('#terrain-3d-info').textContent(),/valid samples/,'Numeric 3D must render actual samples');
 assert.ok(await page.locator('#terrain-3d-canvas').isVisible());
 await page.locator('[data-action="open-copilot"]').click();
 await page.locator('[data-topic="terrain"]').click();
 assert.match(await page.locator('#copilot-output').textContent(),/2\/2/);
 await page.locator('#copilot-propose').click();
 await page.waitForFunction(()=>document.querySelectorAll('#terrain-strategies .strategy-card').length===3);
 assert.equal((await page.locator('#route-list').innerText()).includes('terrain candidate'),false);
 // Export a real mission and import the resulting file through Mission Center.
 await page.locator('#mission-hub-open').click();
 await page.locator('[data-hub-tab="export"]').click();
 const downloaded=page.waitForEvent('download');
 await page.locator('[data-action="export-json"]').click();
 const download=await downloaded;
 const backup=await require('node:fs/promises').readFile(await download.path());
 const exported=JSON.parse(backup);
 assert.equal(exported.routes.find(r=>r.id===exported.activeRouteId).points.length,2);
 await page.locator('[data-hub-tab="device"]').click();
 await page.locator('#import-json').setInputFiles({name:'review-mission.json',mimeType:'application/json',buffer:backup});
 await page.waitForFunction(()=>!document.querySelector('.cloud-modal').open);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="open-copilot"]').click();
 assert.equal(await page.locator('.assistant-metrics strong').nth(1).textContent(),'2');
 for(const tab of ['device','cloud','crew','chat','export']) {
   await page.locator('#mission-hub-open').click();
   await page.locator('[data-hub-tab="'+tab+'"]').click();
   assert.ok(await page.locator('#hub-'+tab).isVisible());
   if(tab==='cloud') assert.ok(await page.locator('#cloud-auth-form').isVisible() || /unavailable|not configured/i.test(await page.locator('#cloud-status').textContent()),'Cloud screen must show login or its connection state');
   if(tab==='crew') assert.equal(await page.locator('#crew-profile-content').isVisible(),false);
   if(tab==='chat') assert.equal(await page.locator('#team-chat-signed').isVisible(),false);
   await page.locator('#cloud-close').click();
 }
 await page.locator('#mission-hub-open').click();
 await page.locator('[data-hub-tab="device"]').focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('[data-hub-tab="cloud"]').getAttribute('aria-selected'),'true');
 assert.ok(await page.locator('#hub-cloud').isVisible());
 await page.keyboard.press('End');
 assert.equal(await page.locator('[data-hub-tab="export"]').getAttribute('aria-selected'),'true');
 await page.keyboard.press('Home');
 assert.equal(await page.locator('[data-hub-tab="device"]').getAttribute('aria-selected'),'true');
 await page.locator('#cloud-close').click();
 // All drawing/navigation controls and modal tabs must fit the shipped layout.
 for(const width of [320,375,390,768,1024,1480,1920]) {
   await page.setViewportSize({width,height:900});
   if(width<=1200) await page.locator('[data-action="show-analytics"]').click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Page overflow at '+width);
   await page.locator('[data-action="open-copilot"]').click();
   const gaps=await page.locator('.assistant-topics button').evaluateAll(buttons=>buttons.slice(1).map((b,i)=>b.getBoundingClientRect().left-buttons[i].getBoundingClientRect().right));
   assert.ok(gaps.every(gap=>gap>=3),'Overlapping topic controls at '+width);
   await page.locator('#mission-hub-open').click();
   for(const tab of ['device','cloud','crew','chat','export']) {
     await page.locator('[data-hub-tab="'+tab+'"]').click();
     assert.ok(await page.locator('.cloud-modal').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+2;}),'Modal overflow in '+tab+' at '+width);
   }
   await page.locator('#cloud-close').click();
 }
 assert.deepEqual(aiRequests,[]);
 assert.deepEqual(errors,[]);
 console.log('PASS: calculated insights, keyboard/disclosures, route input/reload, DEM preview, 5 Mission Center tabs, 7 viewport widths, control gaps, no admin copy or AI calls.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
