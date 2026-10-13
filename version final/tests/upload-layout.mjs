import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'../../'),entry=fs.readFileSync(path.join(root,'docs/entry.html'),'utf8');
const style=entry.match(/<style>([\s\S]*?)<\/style>/)[1],form=entry.match(/<form id="receiveForm">[\s\S]*?<\/form>/)[0];
const loading=entry.slice(entry.indexOf('(function installLoadingIndicators(){'),entry.indexOf('</script>',entry.indexOf('(function installLoadingIndicators(){')));
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${style}body{padding:20px;background:#f4f7f9}#receiveForm{max-width:1200px;margin:auto}</style><link rel="stylesheet" href="/case-uploads.css">${form}<script>
window.state={actor:{email:'fixture@example.invalid'},token:'fixture',temporaryUploads:true,uploadCategories:true};window.messages=[];window.showMessage=m=>messages.push(m);window.remote=[];
document.querySelector('[name=intakeCenter]').innerHTML='<option>DAT Center</option>';
window.fileToBase64=async()=> 'Zml4dHVyZQ==';
window.call=async(name,args)=>{const p=args[1];if(name==='beginCaseUpload'){if(!JSON.parse(localStorage.getItem('sungrow:temp-uploads:v1:fixture@example.invalid:DAT Center')).uploadStarted)throw Error('Persist upload intent before network');return {};}if(name==='uploadCaseFile'){remote.push({uploadId:p.uploadId,name:p.name,size:12,status:'READY',category:p.category});}if(name==='removeCaseUploadFile')remote=remote.filter(x=>x.uploadId!==p.uploadId);if(name==='setCaseUploadCategory')remote.find(x=>x.uploadId===p.uploadId).category=p.category;return {files:remote};};
</script><script>${loading}</script><script src="/attachment-ui.js"></script><script src="/case-uploads.js"></script><script src="/supplement-attachments.js"></script><div id="supplementTest"></div>`;
const server=http.createServer((req,res)=>{const name=req.url.split('?')[0];if(!['/','/case-uploads.css','/case-uploads.js','/attachment-ui.js','/supplement-attachments.js'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html');res.end(name==='/'?html:fs.readFileSync(path.join(root,'docs',name.slice(1))));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 assert.equal(await page.locator('.attachment-group').count(),5);
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('[data-attachment-group="incident"] [data-add]').click()]);
 await chooser.setFiles(Array.from({length:14},(_,i)=>({name:i%2?'nhat-ky-'+i+'.txt':'du-lieu-'+i+'.csv',mimeType:'text/plain',buffer:Buffer.from('Thời gian,Giá trị\n12:00,42')})));
 await page.waitForFunction(()=>document.querySelector('.attachment-status').textContent==='14/14 file đã tải lên');
 assert.equal(await page.locator('progress').count(),0,'Completed uploads do not need a full-width progress bar');
 const out=path.join(root,'analysis/upload-layout');fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.locator('.attachment-widget').scrollIntoViewIfNeeded();
  const g=await page.locator('.attachment-file').first().evaluate(el=>{const s=el.querySelector('[data-file-action="view"]').getBoundingClientRect(),b=el.querySelector('[data-file-action="remove"]').getBoundingClientRect(),list=el.closest('.attachment-files');return {delta:Math.abs(s.top-b.top),heightDelta:Math.abs(s.height-b.height),overflow:document.documentElement.scrollWidth>innerWidth,listHeight:list.clientHeight,scroll:list.scrollHeight};});
  assert.equal(g.delta,0,'File action icons align');assert.equal(g.heightDelta,0);assert.equal(g.overflow,false);assert.ok(g.scroll>g.listHeight);
  await page.screenshot({path:path.join(out,'upload-'+width+'.png')});
 }
 await page.locator('[data-file-action="remove"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.attachment-file').length===13);
 assert.equal(await page.evaluate(()=>portalUploads.prepare().uploadIds.length),13);
 await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File(['log'],'drag-log.txt',{type:'text/plain'}));document.querySelector('[data-attachment-group="deviceLog"] .attachment-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>document.querySelector('.attachment-status').textContent==='14/14 file đã tải lên');
 await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([255,216,255])],'paste-photo.jpg',{type:'image/jpeg'}));document.querySelector('[data-attachment-group="centerPhotos"] .attachment-drop').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>document.querySelector('.attachment-status').textContent==='15/15 file đã tải lên');
 assert.deepEqual(await page.evaluate(()=>messages),[]);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{const box=document.createElement('div');box.id='spinnerProbe';box.innerHTML='<div role="status">Đang kiểm tra file đính kèm của trung tâm…</div>';document.body.append(box);});
 await page.waitForFunction(()=>document.querySelector('#spinnerProbe .loading-spinner'));
 assert.equal(await page.locator('#spinnerProbe .loading-spinner').count(),1,'Only the leaf loading status gets a spinner');
 await page.evaluate(()=>{
  window.suppFiles=[];window.commitCalls=0;window.uploadDelay=0;window.lostAck=true;window.requests=[];
  window.call=async(name,args)=>{requests.push([name,args]);const p=args[1];
   if(name==='beginCaseUpload')return {};
   if(name==='uploadCaseFile'){await new Promise(r=>setTimeout(r,uploadDelay));suppFiles.push({uploadId:p.uploadId,name:p.name,size:12,status:'READY',category:p.category});return {files:suppFiles};}
   if(name==='commitCaseAttachments'){commitCalls++;if(lostAck){lostAck=false;throw Error('Lost acknowledgement');}return {ok:true,caseId:p.caseId,sessionId:p.sessionId,added:suppFiles.length};}
   return {files:suppFiles};};
  SungrowSupplementAttachments.mount(document.querySelector('#supplementTest'),{caseId:'C1',currentCenter:'DAT Center'});
 });
 const supp=page.locator('#supplementTest');
 await supp.locator('[data-attachment-group="centerPhotos"] input').setInputFiles({name:'center.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,255])});
 await page.waitForFunction(()=>document.querySelector('#supplementTest [data-save]').disabled===false);
 await supp.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('#supplementTest .attachment-status').textContent.includes('Lost acknowledgement'));
 assert.equal(await supp.locator('.attachment-file').count(),1,'Keep files after lost commit response');
 await supp.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('#supplementTest .attachment-status').textContent.includes('Đã bổ sung 1'));
 assert.equal(await page.evaluate(()=>requests.filter(x=>x[0]==='uploadCaseFile').length),1,'Retry commit does not reupload');
 assert.equal(await page.evaluate(()=>requests.find(x=>x[0]==='commitCaseAttachments')[1][1].caseId),'C1');
 await page.evaluate(()=>uploadDelay=200);await supp.locator('[data-attachment-group="deviceLog"] input').setInputFiles({name:'log.txt',mimeType:'text/plain',buffer:Buffer.from('log')});
 await page.waitForFunction(()=>document.querySelector('#supplementTest [data-save]').disabled);
 assert.equal(await page.evaluate(()=>SungrowSupplementAttachments.canLeave()),false,'Block closing/changing case while upload pending');
 await page.waitForFunction(()=>document.querySelector('#supplementTest [data-save]').disabled===false);
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>{
  SungrowSupplementAttachments.dispose();localStorage.setItem('sungrow:supplement:v1:fixture@example.invalid:C1',JSON.stringify({sessionId:'unused-id',center:'DAT Center'}));
  const original=window.call;window.call=async(name,args)=>{if(name==='getCaseUploadSession')throw Error('Không tìm thấy phiên upload của tài khoản này.');if(name==='getCaseAttachmentReceipt')return {found:false};return original(name,args);};
  SungrowSupplementAttachments.mount(document.querySelector('#supplementTest'),{caseId:'C1',currentCenter:'DAT Center'});
 });
 await page.waitForFunction(()=>document.querySelector('#supplementTest .attachment-status').textContent.includes('chọn lại file'));
 assert.equal(await supp.locator('[data-add]').first().isEnabled(),true,'Unstarted supplement restores without permanently locking picker');
 await page.evaluate(()=>{
  SungrowSupplementAttachments.dispose();localStorage.setItem('sungrow:supplement:v1:fixture@example.invalid:C1',JSON.stringify({sessionId:'old-id',center:'DAT Center'}));
  window.restoreFailure=true;window.call=async(name,args)=>{if(name==='getCaseUploadSession'){if(restoreFailure)throw Error('Network failed');return {state:'COMMITTED',supplementalCaseId:'C1',files:[]};}return {};};
  SungrowSupplementAttachments.mount(document.querySelector('#supplementTest'),{caseId:'C1',currentCenter:'DAT Center'});
 });
 await supp.getByRole('button',{name:'Kiểm tra lại',exact:true}).waitFor();assert.equal(await supp.locator('[data-add]').first().isEnabled(),false);
 await page.evaluate(()=>restoreFailure=false);await supp.getByRole('button',{name:'Kiểm tra lại',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#supplementTest .attachment-status').textContent.includes('thành công'));
 assert.equal(await supp.locator('[data-add]').first().isEnabled(),true);
 console.log('Upload layout passed: desktop/mobile alignment, compact picker, TXT/CSV multi-select, >10 files, scroll, remove, category and prepare.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
