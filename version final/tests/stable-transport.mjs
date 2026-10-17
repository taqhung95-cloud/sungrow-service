import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../../docs/apps-script-transport.js',import.meta.url),'utf8');
const productionConfig={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../docs/config.js',import.meta.url),'utf8'),productionConfig);
assert.equal(productionConfig.window.SUNGROW_CONFIG.appsScriptTransport,'bridge','Production must never re-enable ContentService fallback.');
const origin='https://sungrow-service.sungrowvietnam.com.vn', google='https://n-fixture-script.googleusercontent.com';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

// Exercise the real public bridge entry point and existing portal dispatcher.
let template,dispatches=0;
const backend={console:{...console,error(){}},HtmlService:{XFrameOptionsMode:{ALLOWALL:'all'},createTemplateFromFile:name=>{
  assert.equal(name,'PortalBridge');template={evaluate:()=>({setTitle(){return this},setXFrameOptionsMode(){return this}})};return template;
}},ContentService:{MimeType:{JSON:'json'},createTextOutput:content=>({setMimeType(){return this},getContent:()=>content})}};
vm.createContext(backend);vm.runInContext(read('Code.gs'),backend);vm.runInContext(read('LegacyDashboardApi.gs'),backend);
backend.getBootstrap=token=>{dispatches++;if(token!=='valid')throw Object.assign(Error('Denied'),{code:'UNAUTHORIZED',publicMessage:'Denied'});return {actor:{email:'fixture'},at:new Date('2026-10-17T00:00:00Z')};};
backend.renderPortalBridge_({bridge_origin:origin,bridge_channel:'a'.repeat(48)});
assert.equal(JSON.parse(template.bridgeConfigJson).origin,origin);
assert.throws(()=>backend.renderPortalBridge_({bridge_origin:origin+'.evil.test',bridge_channel:'a'.repeat(48)}),/Invalid bridge/);
assert.throws(()=>backend.renderPortalBridge_({bridge_origin:origin,bridge_channel:'<script>'}),/Invalid bridge/);
assert.equal(JSON.parse(backend.portalBridgeCall({action:'portal.call',functionName:'getBootstrap',args:['valid']})).data.at,'2026-10-17T00:00:00.000Z');
assert.equal(JSON.parse(backend.portalBridgeCall({action:'portal.call',functionName:'getBootstrap',args:['invalid']})).error.code,'UNAUTHORIZED');
assert.equal(JSON.parse(backend.portalBridgeCall({action:'portal.call',functionName:'readTable_',args:[]})).ok,false,'Existing whitelist still rejects internal functions.');
assert.equal(JSON.parse(backend.portalBridgeCall({action:'arbitrary'})).ok,false);assert.equal(dispatches,2);
assert.equal(JSON.parse(backend.portalBridgeCall({action:'portal.call',functionName:'getBootstrap',args:['valid',{base64:'A'.repeat(9*1024*1024)}]})).ok,true,'Transport must not introduce a new upload size restriction.');

// HTMLService runs inside Google's wrapper iframe, rather than directly inside
// the application. Only the intended ancestor receives ready/data messages.
let bridgeListener,success,calls=0;const messages=[];
const owner={postMessage:(message,target)=>messages.push({message,target})};owner.parent=owner;
const wrapper={parent:owner,postMessage(){}};
const runner={withSuccessHandler:fn=>{success=fn;return runner},withFailureHandler:()=>runner,portalBridgeCall:()=>{calls++}};
const bridgeWindow={addEventListener:(_,fn)=>bridgeListener=fn};
const config={origin,channel:'a'.repeat(48),version:'fixture'};
const html=read('PortalBridge.html');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('<?!= bridgeConfigJson ?>',JSON.stringify(config));
vm.runInNewContext(script,{window:bridgeWindow,parent:wrapper,google:{script:{run:runner}},Set,JSON});
assert.equal(messages.length,1);assert.equal(messages[0].target,origin);assert.equal(messages[0].message.type,'sungrow-bridge-ready');
const request={type:'sungrow-bridge-request',channel:config.channel,id:'request-1',payload:{action:'portal.call'}};
bridgeListener({origin:origin+'.evil',source:owner,data:request});
bridgeListener({origin,source:{},data:request});
bridgeListener({origin,source:owner,data:{...request,channel:'wrong'}});assert.equal(calls,0);
bridgeListener({origin,source:owner,data:request});bridgeListener({origin,source:owner,data:request});assert.equal(calls,1,'Duplicate active messages must not replay a save.');
success('{"ok":true,"data":1}');assert.equal(messages.at(-1).message.json,'{"ok":true,"data":1}');

function harness() {
  const listeners=new Set(),timers=new Map(),sent=[];let timerId=0,frame,nativeCalls=0,now=0;
  class Clock extends Date {static now(){return now;}}
  const win={location:{origin,href:origin+'/'},SUNGROW_CONFIG:{},fetch:async()=>{nativeCalls++;return new Response('{"ok":true,"data":"legacy"}')},addEventListener:(_,f)=>listeners.add(f),removeEventListener:(_,f)=>listeners.delete(f)};win.parent=win;
  const document={body:{append:f=>{frame=f}},createElement:()=>({setAttribute(){},remove(){this.removed=true},contentWindow:{parent:win}})};
  const child={get parent(){return frame.contentWindow},postMessage:(message,target)=>sent.push({message,target})};
  const ctx={window:win,parent:win,location:win.location,document,crypto:webcrypto,URL,Response,AbortController,Error,Uint8Array,Map,JSON,Promise,Date:Clock,setTimeout:(f,ms)=>{const id=++timerId;timers.set(id,{f,ms});return id},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(client,ctx);
  const emit=(data,source=child,eventOrigin=google)=>listeners.forEach(fn=>fn({data,source,origin:eventOrigin}));
  const ready=()=>emit({type:'sungrow-bridge-ready',protocol:1,channel:new URL(frame.src).searchParams.get('bridge_channel'),version:'fixture'});
  const reply=(index,data={ok:true,data:'bridge'})=>{const m=sent[index].message;emit({type:'sungrow-bridge-result',channel:m.channel,id:m.id,json:JSON.stringify(data)});};
  return {transport:win.SungrowTransport,win,ready,emit,reply,sent,timers,advance:ms=>{now+=ms},get frame(){return frame},get nativeCalls(){return nativeCalls}};
}
const url='https://script.google.com/macros/s/deployment/exec';
const opts=(name='getBootstrap',signal)=>({method:'POST',body:new URLSearchParams({payload:JSON.stringify({action:'portal.call',functionName:name,args:['secret-fixture']})}),signal});
const h=harness(),initial=h.transport.fetch(url,opts());
assert.ok(!h.frame.src.includes('secret-fixture'),'Credentials must not enter iframe/query/referrer URLs.');
h.emit({type:'sungrow-bridge-ready',protocol:1,channel:new URL(h.frame.src).searchParams.get('bridge_channel')},{parent:h.win},'https://evil.test');
await tick();assert.equal(h.sent.length,0);h.ready();await tick();assert.equal(h.sent.length,1);h.reply(0);assert.equal((await (await initial).json()).data,'bridge');assert.equal(h.nativeCalls,0,'A healthy bridge never fetches ContentService.');
const requests=Array.from({length:6},()=>h.transport.fetch(url,opts()));await tick();assert.equal(h.sent.length,5,'At most four calls are in flight.');h.reply(1);await tick();assert.equal(h.sent.length,6);h.reply(2);await tick();assert.equal(h.sent.length,7);for(let i=3;i<7;i++)h.reply(i);await Promise.all(requests);
const controller=new AbortController(),cancelled=h.transport.fetch(url,opts('listCases',controller.signal));const rejected=assert.rejects(cancelled,{name:'AbortError'});await tick();const cancelledIndex=h.sent.length-1;controller.abort();await rejected;assert.equal(h.transport.info()[0].active,1,'Cancelled server work retains its concurrency slot until it finishes.');h.reply(cancelledIndex);assert.equal(h.transport.info()[0].active,0);
const mutation=h.transport.fetch(url,opts('createCase'));await tick();const index=h.sent.length-1;h.reply(index,{ok:false,error:{code:'BRIDGE_SERVER_ERROR',message:'Uncertain'}});assert.equal((await (await mutation).json()).ok,false);assert.equal(h.nativeCalls,0,'Never replay an uncertain save through the old transport.');
const old=harness(),legacy=old.transport.fetch(url,opts('createCase'));[...old.timers.values()].find(t=>t.ms===20000).f();assert.equal((await (await legacy).json()).data,'legacy');assert.equal(old.nativeCalls,1,'Pre-dispatch fallback sends an operation once.');
const strict=harness();strict.win.SUNGROW_CONFIG.appsScriptTransport='bridge';const strictPending=strict.transport.fetch(url,opts());const strictError=assert.rejects(strictPending,{code:'BRIDGE_UNAVAILABLE'});[...strict.timers.values()].find(t=>t.ms===20000).f();await strictError;assert.equal(strict.nativeCalls,0,'Strict bridge mode never falls back to ContentService.');
strict.advance(5001);const recovered=strict.transport.fetch(url,opts());strict.ready();await tick();strict.reply(0);assert.equal((await (await recovered).json()).data,'bridge','A failed handshake can reconnect after the cooldown without a page reload.');
const stopped=harness(),abort=new AbortController(),pending=stopped.transport.fetch(url,opts('createCase',abort.signal));const noSend=assert.rejects(pending,{name:'AbortError'});abort.abort();stopped.ready();await noSend;assert.equal(stopped.sent.length,0);assert.equal(stopped.nativeCalls,0);
console.log('Stable transport passed: real dispatcher/auth whitelist, JSON dates, trusted origins/ancestors/channels, nested Google wrapper, single connection, four concurrent calls, cancellation, no replay of uncertain saves and pre-dispatch legacy fallback.');
