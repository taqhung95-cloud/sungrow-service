import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const docs=path.resolve(import.meta.dirname,'../../docs');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1024,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://assistant-motion.invalid/**',async route=>{const p=new URL(route.request().url()).pathname.slice(1);if(!p){await route.fulfill({contentType:'text/html',body:'<html><head><meta charset="utf-8"><link rel="stylesheet" href="/quick-assistant.css"></head><body style="background:linear-gradient(40deg,#9acada,#f2e1c8)"><script src="/quick-assistant.js"></script></body></html>'});return;}if(!['quick-assistant.js','quick-assistant.css','assistant-robot.png'].includes(p)){await route.fulfill({status:404});return;}await route.fulfill({body:fs.readFileSync(path.join(docs,p)),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'image/png'});});
const install=()=>page.evaluate(()=>window.SungrowQuickAssistant.configure({actor:{email:'fixture@example.invalid',role:'center_staff',centers:['DAT']},openCase:()=>{},request:async()=>({answer:'## Cách tính SLA\n**SLA = thời gian thực tế − tạm dừng hợp lệ.**\n- Khoảng chồng nhau chỉ trừ một lần.\n- Không tự trừ chờ giao.\n\n## Ví dụ\n1. Thực tế: 11 ngày.\n2. Được trừ: 4 ngày.\n3. SLA còn: 7 ngày.',cases:[],generatedAt:'2026-10-28T06:00:00Z'})}));
const drag=async(x,y)=>{const b=await page.locator('.sgqa-launch').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(x,y,{steps:8});await page.mouse.up();};
const finish=()=>page.locator('.sgqa-panel').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
const bounds=async()=>{const p=await page.locator('.sgqa-panel').boundingBox(),size=page.viewportSize();assert.ok(p.x>=7&&p.y>=7&&p.x+p.width<=size.width-7&&p.y+p.height<=size.height-7,JSON.stringify(p));};
try{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('https://assistant-motion.invalid/');await install();await page.evaluate(()=>{window.motionCalls=[];const native=Element.prototype.animate;Element.prototype.animate=function(frames,options){window.motionCalls.push({frames,options});return native.call(this,frames,options);};});
 for(const [x,y]of[[35,40],[990,40],[510,390],[990,760],[35,760]]){
  await drag(x,y);assert.equal(await page.locator('.sgqa-launch').getAttribute('aria-expanded'),'false','Drag must not open chat');
  await page.locator('.sgqa-launch').click();assert.equal(await page.evaluate(()=>window.motionCalls.at(-1).options.duration),340,'Opening animation');await finish();await bounds();
  await page.locator('[data-close]').click();await page.locator('.sgqa-panel').waitFor({state:'hidden'});
 }
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sungrow-assistant-position-v1')));assert.deepEqual(Object.keys(saved).sort(),['x','y']);
 const before=await page.locator('.sgqa-launch').boundingBox();await page.reload();await install();const restored=await page.locator('.sgqa-launch').boundingBox();assert.ok(Math.abs(before.x-restored.x)<2&&Math.abs(before.y-restored.y)<2);
 await page.locator('.sgqa-launch').focus();await page.keyboard.press('ArrowRight');const keyMoved=await page.locator('.sgqa-launch').boundingBox();assert.ok(keyMoved.x>restored.x);
 await page.locator('.sgqa-launch').click();await finish();await page.locator('input').fill('Giải thích SLA');await page.locator('.sgqa-form button').click();await page.locator('.sgqa-message h3').first().waitFor();
 assert.equal(await page.locator('.sgqa-message ul li').count(),2);assert.equal(await page.locator('.sgqa-message ol li').count(),3);assert.equal(await page.locator('.sgqa-message strong').count(),1);
 assert.ok((await page.locator('.sgqa-panel').evaluate(e=>getComputedStyle(e).backdropFilter)).includes('blur'));
 await page.setViewportSize({width:390,height:700});await bounds();await drag(40,45);await bounds();
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-close]').click();await page.locator('.sgqa-panel').waitFor({state:'hidden'});await page.locator('.sgqa-launch').click();assert.equal(await page.locator('.sgqa-panel').evaluate(e=>e.getAnimations().length),0);
 assert.deepEqual(errors,[]);console.log('Assistant motion passed: pointer drag without click, corners/center, viewport bounds, position persistence, keyboard move, open/close animation, reduced motion, glass blur and structured safe text.');
}finally{await browser.close();}
