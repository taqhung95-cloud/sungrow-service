// Actual production CSS/JS with offline fixture data, including range filters and glass theme.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'../../'),docs=path.join(root,'docs'),out=path.join(root,'analysis/mobile-dashboard');fs.mkdirSync(out,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/mobile-dashboard.json',import.meta.url),'utf8'));
fixture.models=Array.from({length:18},(_,i)=>({name:'SG110CX-MODEL-'+i,count:1}));fixture.modelTypes=[{name:'Inverter',count:18,models:fixture.models}];fixture.summary.received=18;
fixture.tickets=Array.from({length:200},(_,i)=>({...fixture.tickets.at(-1),id:'fixture-'+i,model:'SG110CX-V112',serialNumber:'TEST-'+i}));
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{const request=JSON.parse(new URLSearchParams(body).get('payload'));const data=request.action==='portal.call'?{dashboardRanges:true,actor:{...fixture.actor,isGlobalManager:true,capabilities:['viewCases','createCase','updateWorkOrder']}}:structuredClone(fixture);if(request.period?.includes('..')&&data.period){const[start,end]=request.period.split('..');Object.assign(data.period,{key:request.period,start,end,asOf:end,label:start+'–'+end});}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,data}));});return;}
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','application/javascript');res.end('window.SUNGROW_CONFIG={googleClientId:"fixture",appsScriptUrl:location.origin+"/api"};');return;}
 const file=path.join(docs,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(docs+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{sessionStorage.setItem('sungrow_id_token','fixture');window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}}});
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('#sg-preview[data-live-data=true]');
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});
  await page.locator('.mobile-filter-toggle').click();
  const state=await page.evaluate(()=>{const toolbar=document.querySelector('.sg-period-toolbar'),donut=document.querySelector('.sg-model-donut'),d=getComputedStyle(donut);return {overflow:document.documentElement.scrollWidth>innerWidth,filterOverflow:toolbar.scrollWidth>toolbar.clientWidth,filterWidth:toolbar.getBoundingClientRect().width,rangeWidth:document.querySelector('.sg-period-picker').getBoundingClientRect().width,centerFont:getComputedStyle(document.querySelector('#sg-center')).fontSize,donutBackground:d.backgroundImage,donutAfter:getComputedStyle(donut,'::after').display,summary:document.querySelector('.mobile-filter-summary').textContent,centerColumns:getComputedStyle(document.querySelector('.sg-compare-list-row')).gridTemplateColumns};});
  await page.screenshot({path:path.join(out,'filters-'+width+'.png'),fullPage:false});console.log(width,state);
  assert.equal(state.overflow,false,'Page must fit phone');assert.equal(state.filterOverflow,false,'Period toolbar must wrap on mobile');assert.equal(state.centerFont,'16px','Readable center selector');assert.match(state.donutBackground,/conic-gradient/,'Donut segments must remain visible');
  assert.equal(state.centerColumns.split(' ').length,2,'Expanded center metrics use mobile columns');
  assert.match(state.summary,/Tháng/,'Summary follows the actual range control');
  await page.locator('.mobile-filter-toggle').click();
  assert.equal(await page.locator('.sg-filter-panel').isVisible(),false,'Closed filters stay hidden');
  const first=page.locator('.sg-compare-list-row').first();await first.locator('.mobile-center-expand').click();assert.equal(await first.locator('>span:nth-child(2)').isVisible(),true);await first.locator('.mobile-center-expand').click();
  const models=page.locator('.sg-model-list-body');assert.equal(await models.locator('.sg-donut-item:visible').count(),5);await models.locator('..').locator('.mobile-preview-more').click();assert.equal(await models.locator('.sg-donut-item:visible').count(),10);await models.locator('..').locator('.mobile-preview-less').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<5000),'Overview stays bounded with hundreds of rows');
  await page.screenshot({path:path.join(out,'overview-'+width+'.png'),fullPage:true});
 }
 await page.locator('.mobile-filter-toggle').click();await page.getByRole('button',{name:'Năm',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.mobile-filter-summary').textContent.includes('Năm 20'));assert.equal(await page.locator('#sg-compare-mode').inputValue(),'year');
 await page.getByRole('button',{name:'Tùy chọn',exact:true}).click();await page.locator('.sg-range-dialog').waitFor({state:'visible'});assert.ok(await page.locator('.sg-range-dialog').evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;}),'Calendar fits mobile');await page.getByRole('button',{name:'Hủy',exact:true}).click();
 await page.locator('.mobile-filter-toggle').click();await page.locator('.mobile-menu-toggle').click();const glass=page.getByRole('switch',{name:'Transparency'});await glass.uncheck();assert.match(await page.locator('.sg-model-donut').evaluate(e=>getComputedStyle(e).backgroundImage),/conic-gradient/);await glass.check();await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1080});assert.equal(await page.locator('.sg-period-toolbar').evaluate(e=>e.scrollWidth>e.clientWidth),false,'Desktop toolbar remains one row');assert.equal(await page.locator('.sg-model-list-body .sg-donut-item:visible').count(),18,'Desktop retains rows');
 assert.deepEqual(errors,[]);console.log('Production mobile dashboard passed: current period controls, glass/donut, two-column details, preview expansion, calendar, 360/390/430 and desktop.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
