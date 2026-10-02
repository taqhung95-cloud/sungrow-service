import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for(const relative of ['../../docs/entry.html','../Index.html']){
  const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8');
  const extract=(name,next)=>source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'(',source.indexOf('function '+name+'('))).replace(/\basync\s*$/,'');
  const form={},panel={innerHTML:'',querySelector:()=>form},calls=[],messages=[];
  const item={caseId:'HS1',canCorrectCase:true,correctionRevision:'r7',serialNumber:'<SN>',model:'SG110CX',quantity:1,workOrders:[],transfers:[]};
  const ctx={CSS:{escape:v=>v},$:()=>panel,state:{token:'token',caseCache:{old:1}},esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),shortCenter:v=>v,badgeClass:()=>'',busy:()=>{},formData:()=>({model:'SG125CX',reason:'Kiểm tra nguồn'}),showMessage:v=>messages.push(v),refreshCurrent:()=>calls.push(['refresh']),call:async(name,args)=>{calls.push([name,args]);return name==='getCaseDetail'?item:{ok:true}}};
  vm.createContext(ctx);
  vm.runInContext(extract('renderCaseDetail','openCaseDrawer'),ctx);
  assert.equal(typeof ctx.renderCaseDetail(item),'string');
  const start=source.indexOf('async function openCorrection('),end=source.indexOf('function openTransfer(',start);
  vm.runInContext(source.slice(start,end),ctx);
  await ctx.openCorrection(JSON.stringify({caseId:'HS1',correctionRevision:'stale'}));
  assert.match(panel.innerHTML,/&lt;SN&gt;/);
  assert.match(panel.innerHTML,/name="reason" required/);
  await form.onsubmit({preventDefault(){},submitter:{},target:form});
  const sent=calls.find(c=>c[0]==='correctCase')[1][1];
  assert.equal(sent.expectedRevision,'r7');assert.equal(sent.caseId,'HS1');assert.equal(sent.reason,'Kiểm tra nguồn');assert.equal(sent.changes.reason,undefined);
  item.canCorrectCase=false;panel.innerHTML='';await ctx.openCorrection(JSON.stringify(item));assert.equal(panel.innerHTML,'');assert.match(messages.at(-1),/Không có quyền/);
}
console.log('Correction UI: detail rendering, escaping, fresh revision, submit and role guard passed on both frontends.');
