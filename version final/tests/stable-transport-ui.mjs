import {fanDashboardFixture as dashboard} from './fan-lot-analytics.mjs';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const docs=path.resolve(import.meta.dirname,'../../docs'),bridgeHtml=fs.readFileSync(new URL('../PortalBridge.html',import.meta.url),'utf8');
const endpoint='https://script.google.com/macros/s/fixture/exec',calls=[];let legacyPosts=0;
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname;
 if(p==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.SUNGROW_CONFIG='+JSON.stringify({appsScriptUrl:endpoint,googleClientId:'fixture'})+';');return;}
 const file=path.join(docs,p==='/'?'index.html':p.slice(1));if(!file.startsWith(docs+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureBridgeDispatch',async payload=>{
  calls.push(payload.functionName||payload.action);let data={};
  if(payload.action==='dashboard.read')data=dashboard;
  else if(payload.functionName==='getBootstrap')data={actor:{role:'service_manager',isGlobalManager:true,email:'fixture',centers:[],capabilities:{viewDashboard:true,viewCases:true,createCase:true}},allCenters:['Sungrow Service Center'],centers:['Sungrow Service Center'],deviceTypes:['Fan','Inverter']};
  else if(payload.functionName==='getPortalSyncState')data={revision:'fixture',pollMs:60000};
  else if(payload.functionName==='listCases')data={items:[],total:0,page:1,pageSize:20,totalPages:1};
  else if(payload.functionName==='uncertainSave')throw Error('Disconnected after dispatch');
  return JSON.stringify({ok:true,data});
 });
 await page.addInitScript(()=>{sessionStorage.setItem('sungrow_id_token','fixture');window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
  if(url.hostname==='script.google.com'){
   if(req.method()==='POST'){legacyPosts++;return route.abort();}
   const inner=new URL('https://n-fixture-script.googleusercontent.com/bridge');inner.search=url.search;
   return route.fulfill({contentType:'text/html',body:'<!doctype html><iframe src="'+inner.href.replaceAll('&','&amp;')+'"></iframe>'});
  }
  if(url.hostname==='n-fixture-script.googleusercontent.com'){
   const config={origin:url.searchParams.get('bridge_origin'),channel:url.searchParams.get('bridge_channel'),version:'fixture'};
   const mock=`<script>google.script={run:{withSuccessHandler(fn){this.success=fn;return this},withFailureHandler(fn){this.failure=fn;return this},portalBridgeCall(payload){const ok=this.success,fail=this.failure;window.fixtureBridgeDispatch(payload).then(ok,fail)}}};</script>`;
   return route.fulfill({contentType:'text/html',body:bridgeHtml.replace('<body>','<body>'+mock).replace('<?!= bridgeConfigJson ?>',JSON.stringify(config))});
  }
  return route.abort();
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('#sg-preview[data-live-data=true]');
 assert.equal(await page.locator('.sg-data-state').isVisible(),false);assert.ok(calls.includes('dashboard.read'));assert.equal(legacyPosts,0);
 assert.equal(await page.locator('iframe[title="Kết nối dữ liệu Service Center"]').count(),1);
 await page.locator('[data-portal-view=receive]').first().evaluate(el=>el.click());await page.waitForFunction(()=>document.querySelector('.sg-portal-frame')?.contentDocument?.querySelector('#appView:not(.hidden)'));
 const shared=await page.evaluate(()=>document.querySelector('.sg-portal-frame').contentWindow.SungrowTransport===window.SungrowTransport);assert.equal(shared,true,'Entry uses the parent connection.');
 const save=await page.evaluate(async endpoint=>{const body=new URLSearchParams({payload:JSON.stringify({action:'portal.call',functionName:'uncertainSave',args:['fixture']})});return (await SungrowTransport.fetch(endpoint,{method:'POST',body})).json();},endpoint);
 assert.equal(save.error.code,'BRIDGE_SERVER_ERROR');assert.equal(calls.filter(x=>x==='uncertainSave').length,1);assert.equal(legacyPosts,0,'Never replay an uncertain write after a bridge failure.');
 assert.deepEqual(errors,[]);console.log('Stable transport browser passed: actual dashboard + entry, nested Google origins, bridge-only API traffic, shared connection, data rendering, error propagation and no replay after an uncertain save.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
