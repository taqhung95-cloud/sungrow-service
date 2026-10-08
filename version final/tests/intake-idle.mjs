// Run the actual entry frontend against a local fake API. Never creates production cases.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const docs=path.resolve(import.meta.dirname,'../../docs');
let mode='valid',created=0;
const uploadSessions=new Map(),createdRequests=new Map();let lastCreatedPayload=null;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/config.js'){
    res.setHeader('Content-Type','text/javascript');res.end('window.SUNGROW_CONFIG={appsScriptUrl:location.origin+"/api",googleClientId:"fixture"};');return;
  }
  if(url.pathname==='/api'){
    let body='';for await(const chunk of req)body+=chunk;
    const request=JSON.parse(new URLSearchParams(body).get('payload'));
    const fn=request.functionName;
    let data={};
    if(mode==='expired'&&fn==='getCreationStatus'){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:{code:'PUBLIC_ERROR',message:'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'}}));return;
    }
    if(fn==='getBootstrap')data={actor:{email:'fixture@example.invalid',name:'Fixture',role:'center_staff',centers:['DAT Center'],homeCenter:'DAT Center',capabilities:{viewCases:true,createCase:true}},centers:['DAT Center'],allCenters:['DAT Center'],customerDirectory:false,temporaryUploads:mode==='staged'};
    if(fn==='getPortalSyncState')data={revision:'fixture-revision',pollMs:60000};
    if(fn==='lookupWarranty')data={status:'unknown',label:'Chưa có thông tin',modelStatus:'missing'};
    if(fn==='getCreationStatus')data=createdRequests.get(request.args[1])||{found:false};
    if(fn==='createCase'){created++;lastCreatedPayload=request.args[1];data={caseId:'fixture-case',workOrderId:'fixture-work'};createdRequests.set(request.args[1].requestId,{found:true,...data});}
    if(fn==='beginCaseUpload'){const p=request.args[1];if(!uploadSessions.has(p.sessionId))uploadSessions.set(p.sessionId,{sessionId:p.sessionId,center:p.center,state:'OPEN',expiresAt:Date.now()+86400000,files:[]});data=uploadSessions.get(p.sessionId);}
    if(fn==='uploadCaseFile'){const p=request.args[1];data=uploadSessions.get(p.sessionId);if(!data.files.some(f=>f.uploadId===p.uploadId))data.files.push({uploadId:p.uploadId,name:p.name,size:Buffer.from(p.base64,'base64').length,status:'READY'});}
    if(fn==='getCaseUploadSession')data=uploadSessions.get(request.args[1]);
    if(fn==='removeCaseUploadFile'){const p=request.args[1];data=uploadSessions.get(p.sessionId);data.files=data.files.filter(f=>f.uploadId!==p.uploadId);}
    if(fn==='listCases')data={items:[],total:0,page:1,pageSize:20,totalPages:1,revision:'fixture-revision'};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,data}));return;
  }
  const name=url.pathname.slice(1);
  if(!['entry.html','form-drafts.js','mobile-ui.css','mobile-ui.js','favicon.png','case-uploads.js','case-uploads.css'].includes(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(path.join(docs,name)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  for(const scenario of ['valid','expired','staged']){
    mode=scenario==='staged'?'staged':'valid';const startCreated=created;
    const context=await browser.newContext();const page=await context.newPage();
    await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await page.addInitScript(()=>sessionStorage.setItem('sungrow_id_token','LOCAL-FIXTURE-NOT-A-REAL-TOKEN'));
    await page.clock.install();
    await page.goto(base+'/entry.html#receive');
    await page.locator('#receive').waitFor({state:'visible'});
    const form=page.locator('#receiveForm');
    await form.locator('[name=deviceType]').selectOption('Inverter');
    await form.locator('[name=serialNumber]').fill('FIXTURE-IDLE-TEST');
    await form.locator('[name=model]').fill('SG110CX');
    await form.locator('[name=customerName]').fill('Khách hàng giả lập');
    await form.locator('[name=customerPhone]').fill('0900000000');
    await form.locator('[name=customerAddress]').fill('Địa chỉ giả lập');
    await form.locator('[name=initialIssue]').fill('Kiểm thử local, không gửi production');
    if(scenario==='staged'){
      await page.waitForFunction(()=>document.querySelector('#receiveForm [name=evidenceFile]').multiple);
      assert.equal(await page.locator('.upload-label .upload-label-note').count(),1);
      assert.equal(await page.locator('.case-upload-panel>p').count(),0,'Long upload notes must not be below the progress bar');
      assert.equal(await page.locator('.case-upload-panel progress').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
      await form.locator('[name=evidenceFile]').setInputFiles([{name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-fixture')},{name:'fixture.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])}]);
      await page.waitForFunction(()=>document.querySelector('.upload-summary')?.textContent.startsWith('2/2'));
      assert.equal(created,startCreated,'Selecting files must not create a case');
      assert.equal(await page.locator('.case-upload-panel progress').getAttribute('value'),'2');
      await page.reload();await page.locator('#receive').waitFor({state:'visible'});
      await page.waitForFunction(()=>document.querySelector('.upload-summary')?.textContent.startsWith('2/2'));
      await page.locator('[data-upload-remove]').first().click();
      await page.waitForFunction(()=>document.querySelector('.upload-summary')?.textContent.startsWith('1/1'));
      // Fill after reload to focus this assertion on upload restoration, not a changing draft baseline.
      await form.locator('[name=deviceType]').selectOption('Inverter');await form.locator('[name=model]').fill('SG110CX');await form.locator('[name=serialNumber]').fill('FIXTURE-STAGED');
      await form.locator('[name=customerName]').fill('Khách hàng giả lập');await form.locator('[name=customerPhone]').fill('0900000000');await form.locator('[name=customerAddress]').fill('Địa chỉ giả lập');await form.locator('[name=initialIssue]').fill('Không gửi production');
    }else await form.locator('[name=evidenceFile]').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:Buffer.from([80,75,3,4])});
    await page.clock.fastForward(361000);
    assert.equal(await form.locator('[name=customerName]').inputValue(),'Khách hàng giả lập');
    if(scenario!=='staged')assert.equal(await form.locator('[name=evidenceFile]').evaluate(el=>el.files[0]?.name),'fixture.zip');
    assert.equal(await page.locator('#receive').isVisible(),true,'Idle/revision sync must not navigate away from Receive');
    mode=scenario;
    await form.locator('button[type=submit]').click();
    if(scenario==='valid'||scenario==='staged'){
      await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Đã tạo hồ sơ'));
      assert.equal(created,startCreated+1,'Valid session should create exactly once after six minutes idle');
      if(scenario==='staged'){assert.equal(lastCreatedPayload.uploadIds.length,1);assert.equal('attachment' in lastCreatedPayload,false);assert.ok(lastCreatedPayload.uploadSessionId);}
    }else{
      await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('hết hạn'));
      assert.equal(created,startCreated,'Auth rejection must not upload or create');
      assert.equal(await form.locator('[name=customerName]').inputValue(),'Khách hàng giả lập');
      assert.equal(await form.locator('[name=evidenceFile]').evaluate(el=>el.files[0]?.name),'fixture.zip');
    }
    await context.close();
  }
  console.log('Intake idle/staged UI passed: actual frontend 6m01s idle, expired-session preservation, automatic two-file upload before create, verified progress, reload restoration, remove, and create references without reupload. No production calls.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
