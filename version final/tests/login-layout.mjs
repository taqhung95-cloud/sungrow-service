// Local fixture only: no real Google authentication or production API requests.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const docs=path.resolve(import.meta.dirname,'../../docs');
const output=path.resolve(docs,'../../analysis/login-preview');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.SUNGROW_CONFIG={googleClientId:"fixture",appsScriptUrl:location.origin+"/api"};');return}
 const name=url.pathname.slice(1);if(!/^[\w.-]+$/.test(name)||!fs.existsSync(path.join(docs,name))){res.writeHead(404).end();return}
 res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.jpg')?'image/jpeg':name.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(path.join(docs,name)));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 for(const [width,height]of [[1440,900],[1024,768],[390,844],[360,640]]){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(()=>{window.google={accounts:{id:{initialize(){},renderButton(slot){const button=document.createElement('button');button.textContent='Đăng nhập bằng Google';button.style.cssText='width:300px;max-width:100%;height:44px;border:1px solid #dadce0;border-radius:4px;background:white;color:#333;font:14px Arial';slot.append(button)},disableAutoSelect(){}}}}});
  for(const file of ['index.html','entry.html','data-entry-login.html']){
   await page.goto(base+'/'+file,{waitUntil:'networkidle'});
   const layout=page.locator('.sg-auth-layout').first();await layout.waitFor({state:'visible'});
   assert.equal(await layout.locator('h1').count(),1);
   assert.equal(await layout.locator('.sg-auth-hero').count(),1);
   const card=await layout.locator('.sg-auth-card').boundingBox();
   const hero=await layout.locator('.sg-auth-hero').boundingBox();const form=await layout.locator('.sg-auth-form').boundingBox();
   assert.ok(card.x>=0&&card.x+card.width<=width+1,'Card must fit viewport '+file+width);
   if(width<=760){assert.ok(form.y>=hero.y+hero.height-1,'Phone should stack image and form');assert.ok(form.height>=240)}
   else assert.ok(form.x>=hero.x+hero.width-1,'Desktop should have two columns');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+file+width);
   assert.equal(await page.locator('input[type=password]').count(),0,'Keep Google login, do not invent password auth');
   const button=layout.locator('.sg-auth-login-slot button');
   if(file!=='data-entry-login.html'){assert.equal(await button.count(),1);const box=await button.boundingBox();assert.ok(box.x>=form.x&&box.x+box.width<=form.x+form.width+1,'Google button fits form')}
   if(file==='index.html'&&(width===1440||width===390))await page.screenshot({path:path.join(output,'login-'+width+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[],'No JavaScript errors');await context.close();
 }
 console.log('Login layout passed: all three login surfaces, 1440/1024/390/360px, Google button, unchanged auth mode, no horizontal overflow or JS errors. Local fixtures only.');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
