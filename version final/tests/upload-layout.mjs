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
</script><script>${loading}</script><script src="/case-uploads.js"></script>`;
const server=http.createServer((req,res)=>{const name=req.url.split('?')[0];if(!['/','/case-uploads.css','/case-uploads.js'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html');res.end(name==='/'?html:fs.readFileSync(path.join(root,'docs',name.slice(1))));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 assert.equal(await page.locator('.upload-toolbar').count(),1);assert.equal(await page.locator('.upload-groups').count(),0);
 await page.locator('#uploadNewCategory').selectOption('incident');
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.upload-add').click()]);
 await chooser.setFiles(Array.from({length:14},(_,i)=>({name:i%2?'nhat-ky-'+i+'.txt':'du-lieu-'+i+'.csv',mimeType:'text/plain',buffer:Buffer.from('Thời gian,Giá trị\n12:00,42')})));
 await page.waitForFunction(()=>document.querySelector('.upload-summary').textContent==='14/14 file đã tải lên');
 assert.equal(await page.locator('progress').count(),0,'Completed uploads do not need a full-width progress bar');
 const out=path.join(root,'analysis/upload-layout');fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.locator('.upload-toolbar').scrollIntoViewIfNeeded();
  const g=await page.locator('.upload-item').first().evaluate(el=>{const s=el.querySelector('select').getBoundingClientRect(),b=el.querySelector('[data-upload-remove]').getBoundingClientRect(),list=el.parentElement;return {delta:Math.abs(s.top-b.top),heightDelta:Math.abs(s.height-b.height),overflow:document.documentElement.scrollWidth>innerWidth,listHeight:list.clientHeight,scroll:list.scrollHeight};});
  assert.equal(g.delta,0,'Xóa aligns with category');assert.equal(g.heightDelta,0);assert.equal(g.overflow,false);assert.ok(g.scroll>g.listHeight);
  await page.screenshot({path:path.join(out,'upload-'+width+'.png')});
 }
 await page.locator('[data-upload-remove]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.upload-item').length===13);
 await page.locator('.upload-category').first().selectOption('deviceLog');assert.equal(await page.locator('.upload-category').first().inputValue(),'deviceLog');
 assert.equal(await page.evaluate(()=>portalUploads.prepare().uploadIds.length),13);
 assert.deepEqual(await page.evaluate(()=>messages),[]);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{const box=document.createElement('div');box.id='spinnerProbe';box.innerHTML='<div role="status">Đang kiểm tra file đính kèm của trung tâm…</div>';document.body.append(box);});
 await page.waitForFunction(()=>document.querySelector('#spinnerProbe .loading-spinner'));
 assert.equal(await page.locator('#spinnerProbe .loading-spinner').count(),1,'Only the leaf loading status gets a spinner');
 console.log('Upload layout passed: desktop/mobile alignment, compact picker, TXT/CSV multi-select, >10 files, scroll, remove, category and prepare.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
