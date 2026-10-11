// Render real frontend markup locally; no production login or data writes.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const docs=path.resolve(import.meta.dirname,'../../docs'),out=path.resolve(import.meta.dirname,'../../../analysis/glass-preview');fs.mkdirSync(out,{recursive:true});
const live=fs.readFileSync(path.join(docs,'live-data.js'),'utf8');let runtimeStyle;
vm.runInNewContext(live.slice(live.indexOf('  const style ='),live.indexOf('  const authPage =')),{document:{createElement:()=>({textContent:''}),head:{appendChild:el=>runtimeStyle=el}}});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.join(docs,url.pathname==='/'?'index.html':url.pathname.slice(1));
 if(!file.startsWith(docs+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':'text/javascript');
 res.end(file.endsWith('.html')?data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>','<script src="glass-theme.js?v=2"></script></body>'):data);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage();
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const records=[];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:960});await page.goto(base,{waitUntil:'networkidle'});
  await page.addStyleTag({content:runtimeStyle.textContent});
  await page.evaluate(()=>{
   document.getElementById('sg-preview').hidden=false;
   document.getElementById('sg-kpis').innerHTML=['Tiếp nhận trong kỳ','Hoàn tất kỹ thuật','Chờ giao','Đã giao trong kỳ','Đạt SLA 7 ngày'].map((name,i)=>`<div class="sg-kpi"><div class="sg-kpi-label">${name}</div><div class="sg-kpi-value">${i?65:15}</div><div class="sg-kpi-note">Dữ liệu mẫu kiểm thử giao diện</div></div>`).join('');
  });
  await page.addScriptTag({url:base+'/mobile-ui.js'});
  const dashboard=await page.evaluate(()=>{
   const card=document.querySelector('.sg-kpi'),side=document.querySelector('.sg-side');
   return {background:getComputedStyle(card).backgroundColor,opacity:getComputedStyle(card).opacity,
    blur:getComputedStyle(side).backdropFilter,image:getComputedStyle(document.body,'::before').backgroundImage,filter:getComputedStyle(document.body,'::before').filter,
    overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.match(dashboard.background,/rgba/);assert.equal(dashboard.opacity,'1');assert.match(dashboard.image,/login-ess-background/);assert.equal(dashboard.overflow,false);
  assert.equal(dashboard.blur,width===390?'none':'blur(10px)');
  assert.equal(dashboard.filter,'none','Keep the original photo colors');
  const markup=await page.locator('#sg-kpis').innerHTML();
  const toggle=page.locator('[data-glass-switch]');await toggle.evaluate(el=>el.click());
  assert.equal(await toggle.getAttribute('aria-label'),'Transparency');
  assert.equal((await page.locator('.sg-glass-toggle-copy').textContent()).trim(),'Transparency');
  assert.equal(await page.locator('[data-glass-state]').count(),0);
  assert.equal(await page.locator('.sg-glass-toggle-slot').evaluate(el=>getComputedStyle(el).borderBottomWidth),'0px');
  assert.equal(await page.locator('#sg-glass-theme').evaluate(el=>el.media),'not all');
  await page.reload({waitUntil:'networkidle'});
  await page.addStyleTag({content:runtimeStyle.textContent});
  await page.evaluate(markup=>{document.getElementById('sg-preview').hidden=false;document.getElementById('sg-kpis').innerHTML=markup;},markup);
  await page.addScriptTag({url:base+'/mobile-ui.js'});
  assert.equal(await toggle.isChecked(),false,'Off preference survives reload');
  await toggle.evaluate(el=>el.click());
  assert.equal(await page.locator('#sg-glass-theme').evaluate(el=>el.media),'all');
  await page.evaluate(()=>{const frame=document.createElement('iframe');frame.id='glass-test-frame';frame.hidden=true;frame.src='/entry.html';document.body.appendChild(frame);});
  await page.waitForFunction(()=>document.querySelector('#glass-test-frame').contentDocument?.querySelector('#sg-glass-theme')?.media==='all');
  await toggle.evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#glass-test-frame').contentDocument?.querySelector('#sg-glass-theme')?.media==='not all');
  await toggle.evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#glass-test-frame').contentDocument?.querySelector('#sg-glass-theme')?.media==='all');
  await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'sungrow-glass-enabled-v1',newValue:'on'})));
  await page.screenshot({path:path.join(out,'dashboard-'+width+'.png'),fullPage:false});
  await page.goto(base+'/entry.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>{document.querySelector('#loginView').classList.add('hidden');document.querySelector('#appView').classList.remove('hidden');document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));document.querySelector('#receive').classList.remove('hidden');});
  const entry=await page.evaluate(()=>{const input=document.querySelector('#receiveForm input'),card=document.querySelector('#receive');return {background:getComputedStyle(card).backgroundColor,opacity:getComputedStyle(input).opacity,input:getComputedStyle(input).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.match(entry.background,/rgba/);assert.equal(entry.opacity,'1');assert.match(entry.input,/0\.96/);assert.equal(entry.overflow,false);
  const model=page.locator('#receiveForm [name=model]');await model.fill('Draft model');
  await page.locator('[data-glass-switch]').evaluate(el=>el.click());assert.equal(await model.inputValue(),'Draft model');
  await page.locator('[data-glass-switch]').evaluate(el=>el.click());
  await page.screenshot({path:path.join(out,'entry-'+width+'.png'),fullPage:false});
  await page.evaluate(()=>document.documentElement.classList.add('embedded'));
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').display),'none','Embedded entry must reuse parent backdrop');
  records.push({width,dashboard,entry});
 }
 await page.emulateMedia({forcedColors:'active'});await page.goto(base,{waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').display),'none');
 // Worst-case black photo under 86% white: foreground remains solid and readable.
 const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 const l=rgb=>.2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2]);
 const contrast=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);
 const minimum=contrast([76,91,102],[209,209,209]);assert.ok(minimum>=4.5);
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({records,minimumSecondaryTextContrast:minimum},null,2));
 console.log('Glass layout passed: dashboard/entry desktop and mobile, text opacity, controls, no overflow, iframe backdrop, forced colors and contrast floor '+minimum.toFixed(2)+':1.');
}finally{await browser?.close();server.close();}
