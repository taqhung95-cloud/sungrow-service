import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../../docs/entry.html',import.meta.url),'utf8');
const app=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const CONFIG ='));
function boot(source,embedded){
  const nodes=new Map(),messages=[];
  const get=key=>{if(!nodes.has(key))nodes.set(key,{style:{},textContent:'Chưa đồng bộ',classList:{add(){},contains:()=>false},querySelectorAll:()=>[],addEventListener(){},setAttribute(){}});return nodes.get(key)};
  const parent={postMessage:data=>messages.push(data)},win={SUNGROW_CONFIG:{},self:{},top:{},addEventListener(){}};
  if(!embedded)win.top=win.self;
  const ctx={window:win,parent,document:{documentElement:get('html'),body:get('body'),querySelector:get,querySelectorAll:()=>[],addEventListener(){}},location:{origin:'https://fixture'},MutationObserver:class{observe(){}},sessionStorage:{getItem:()=> 'saved-token'},console,setTimeout(){},clearTimeout(){},Date};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  assert.equal(typeof win.onload,'function','Startup must reach window.onload registration');
  vm.runInContext("bindEvents=()=>{};onCredential=response=>window.restoredToken=response.credential;",ctx);
  win.onload();assert.equal(win.restoredToken,'saved-token','Startup must begin restoring the authenticated session');
  if(embedded){assert.equal(get('#portalSyncBar').style.display,'none');assert.equal(messages[0].type,'sungrow-portal-sync-status')}
}
boot(app,true);boot(app,false);
// The former placement must reproduce the TDZ failure: this is a behavioral regression test.
const block=app.split(/\r?\n/).find(l=>l.includes("if(EMBEDDED){$('#portalSyncBar')"));
const bad=app.replace(block,'').replace("    const state =",block+'\n    const state =');
assert.throws(()=>boot(bad,true),/Cannot access '\$' before initialization/);
console.log('Entry startup passed: embedded and standalone full application script, authenticated-session restoration, former TDZ regression reproduced.');
