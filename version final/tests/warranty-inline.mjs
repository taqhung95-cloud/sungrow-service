import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../../docs/entry.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('    function openWarranty(raw)'),html.indexOf('    function workStatuses('));
function setup(inDrawer=true){
 let resolve,reject;
 const form={dataset:{}},panel={innerHTML:'',querySelector:()=>form},drawer={hidden:false,classList:{contains:()=>drawer.hidden}},body={contains:()=>inDrawer};
 const effects={writes:0,drawers:0,lists:0,refresh:0,messages:[],busy:[]};
 const state={token:'test',currentView:inDrawer?'cases':'update',caseDetailRequestId:'case-a-request'};
 const ctx={CSS:{escape:v=>v},$:s=>s==='#caseDrawer'?drawer:s==='#caseDrawerBody'?body:panel,state,esc:v=>String(v??''),formData:()=>({caseId:'A',warrantyStatus:'Trong bảo hành'}),busy:(b,v)=>effects.busy.push(v),showMessage:(...v)=>effects.messages.push(v),call:()=>{effects.writes++;return new Promise((a,b)=>{resolve=a;reject=b})},openCaseDrawer:async raw=>{assert.equal(JSON.parse(raw).caseId,'A');effects.drawers++},loadCases:async(reset,force)=>{assert.equal(reset,false);assert.equal(force,true);effects.lists++},refreshCurrent:()=>effects.refresh++,navigateToCase:()=>{throw Error('Warranty must never navigate')}};
 vm.createContext(ctx);vm.runInContext(source,ctx);ctx.openWarranty('{"caseId":"A","warrantyStatus":"Chờ xác nhận"}');
 return {form,panel,drawer,state,effects,submit:()=>form.onsubmit({preventDefault(){},target:form,submitter:{}}),resolve:()=>resolve({ok:true}),reject:()=>reject(Error('Không có quyền'))};
}
const normal=setup(),pending=normal.submit();await normal.submit();assert.equal(normal.effects.writes,1);normal.resolve();await pending;
assert.equal(normal.effects.drawers,1);assert.equal(normal.effects.lists,1);assert.equal(normal.state.currentView,'cases');assert.equal(normal.effects.refresh,0);assert.equal(normal.form.dataset.saving,undefined);assert.equal(normal.effects.busy.at(-1),false);
const closed=setup(),p2=closed.submit();closed.drawer.hidden=true;closed.state.caseDetailRequestId='';closed.resolve();await p2;assert.equal(closed.effects.drawers,0);assert.equal(closed.effects.refresh,0);
const switched=setup(),p3=switched.submit();switched.state.caseDetailRequestId='case-b-request';switched.resolve();await p3;assert.equal(switched.effects.drawers,0);
const denied=setup(),p4=denied.submit();denied.reject();await p4;assert.equal(denied.effects.drawers,0);assert.equal(denied.effects.messages[0][1],true);assert.equal(denied.form.dataset.saving,undefined);
const outside=setup(false),p5=outside.submit();outside.resolve();await p5;assert.equal(outside.effects.refresh,1);assert.equal(outside.effects.drawers,0);assert.equal(outside.state.currentView,'update');
assert.match(html,/navigateToCase\("transfer"/);assert.match(html,/navigateToCase\("update"/);
console.log('Warranty inline passed: save stays in drawer, refreshed detail/list, duplicate submission blocked, close/switch races, failure retry and existing-view refresh.');
