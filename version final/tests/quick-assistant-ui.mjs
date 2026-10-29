import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const docs=path.resolve(import.meta.dirname,'../../docs');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1024,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://assistant-fixture.invalid/**',async route=>{
  const pathname=new URL(route.request().url()).pathname.slice(1);
  if(!pathname){await route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/quick-assistant.css"></head><body><script src="/quick-assistant.js"></script></body></html>'});return;}
  if(!['quick-assistant.css','quick-assistant.js','assistant-robot.png'].includes(pathname)){await route.fulfill({status:404,body:''});return;}
  await route.fulfill({contentType:pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'image/png',body:fs.readFileSync(path.join(docs,pathname))});
});
try{
 await page.goto('https://assistant-fixture.invalid/');
 assert.equal(await page.locator('.sgqa').count(),0,'Anonymous must not see assistant');
 for(const role of ['center_staff','center_manager','service_manager']){
  await page.evaluate(role=>{
   window.requests=[];window.opened=[];
   window.SungrowQuickAssistant.configure({actor:{email:role+'@example.invalid',role,centers:['DAT']},request:async payload=>{window.requests.push(payload);return{mode:'lookup',answer:'Tìm thấy hồ sơ.',cases:[{caseId:'HS-TEST-001',model:'SG110CX',serialNumber:'SN12345',center:'DAT',receivedAt:'2026-10-15',status:'Chờ linh kiện',issues:'Lỗi quạt'}]};},openCase:async(id,options)=>window.opened.push({id,options})});
  },role);
  assert.equal(await page.locator('.sgqa').count(),1);assert.equal(await page.locator('.sgqa-launch').textContent(),'');
  await page.locator('.sgqa-launch').click();await page.locator('.sgqa-form input').fill('SN12345');await page.locator('.sgqa-form button').click();
  await page.locator('.sgqa-record').waitFor();assert.equal(await page.getByText('Tra cứu hệ thống',{exact:true}).count(),0);assert.equal(await page.locator('.sgqa-sources').count(),0);assert.equal(await page.locator('.sgqa-links a').count(),2);
  await page.locator('.sgqa-links a').nth(1).click();
  assert.deepEqual(await page.evaluate(()=>window.opened[0]),{id:'HS-TEST-001',options:{history:true}});
  await page.locator('.sgqa-panel').waitFor({state:'hidden'});assert.equal(await page.locator('.sgqa-panel').isVisible(),false);
 }
 await page.locator('.sgqa-launch').click();
 await page.evaluate(()=>window.SungrowQuickAssistant.configure({actor:{email:'service_manager@example.invalid',role:'service_manager',centers:['DAT']},request:async()=>({answer:'<img src=x onerror=alert(1)>',cases:[]}),openCase:()=>{}}));
 await page.locator('.sgqa-form input').fill('Câu hỏi tự nhiên');await page.locator('.sgqa-form button').click();
 await page.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await page.locator('.sgqa-log img').count(),0,'AI text must not create markup');
 await page.setViewportSize({width:390,height:800});const bounds=await page.locator('.sgqa-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
 await page.evaluate(()=>window.SungrowQuickAssistant.configure({actor:{email:'pending@example.invalid',role:'center_staff',centers:['DAT']},request:()=>new Promise(resolve=>window.resolveOld=resolve),openCase:()=>{}}));
 await page.locator('.sgqa-launch').click();await page.locator('.sgqa-form input').fill('Hỏi tiếp');await page.locator('.sgqa-form button').click();
 await page.locator('.sgqa-pending').waitFor();await page.waitForFunction(()=>document.querySelector('.sgqa-pending')?.textContent.includes('1 giây'));
 await page.evaluate(()=>window.resolveOld({answer:'Một câu trả lời đủ dài để kiểm tra hiệu ứng xuất hiện dần từng ký tự và giữ nguyên định dạng.',sources:[{title:'PRIVATE SOURCE'}],cases:[]}));
 await page.waitForFunction(()=>document.querySelector('.sgqa-message[aria-busy="true"]'));
 assert.equal(await page.getByText('PRIVATE SOURCE').count(),0);
 await page.evaluate(()=>window.SungrowQuickAssistant.configure(null));
 await page.evaluate(()=>window.resolveOld({answer:'OLD ACCOUNT DATA',cases:[]}));assert.equal(await page.locator('.sgqa').count(),0);assert.equal(await page.getByText('OLD ACCOUNT DATA').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Quick assistant UI passed: all roles, no anonymous widget/topic tabs/text label, scoped record/history callbacks, escaped AI text, mobile fit and logout/in-flight isolation.');
}finally{await browser.close();}
