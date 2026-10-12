import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../docs/case-uploads.js',import.meta.url),'utf8');
async function fixture(mode){
  const picker={},panel={},form={elements:{intakeCenter:{value:'DAT'}}};
  const saved=JSON.stringify({sessionId:'same-session',requestId:'same-request'});
  const storage=new Map([['sungrow:temp-uploads:v1:staff:DAT',saved]]);
  const calls=[];
  let release;
  const ctx={console,Date,Map,JSON,crypto:{randomUUID:()=> 'new-id'},state:{temporaryUploads:false,actor:{email:'staff'},token:'fixture'},
    document:{body:{}},MutationObserver:class{observe(){}},showMessage(){},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    call:async(name,args)=>{calls.push([name,args]);if(name==='getCreationStatus')return {found:false};
      if(mode==='slow')await new Promise(r=>release=r);
      if(mode==='missing')throw Error('Không tìm thấy phiên upload của tài khoản này.');
      if(mode==='network')throw Error('Network failed');
      return {state:mode==='claimed'?'CLAIMED':'OPEN',expiresAt:Date.now()+60000,files:[{uploadId:'existing',name:'old.pdf',size:5,status:'READY'}]};},
    testForm:form,testPanel:panel,testPicker:picker};
  vm.createContext(ctx);
  vm.runInContext(source.replace('return {enabled,prepare,reset,requestId:()=>requestId};','return {scope,prepare,setup(){form=testForm;panel=testPanel;pickers=[testPicker];},snapshot:()=>({sessionId,requestId,items,restoring,restoreFailed})};'),ctx);
  ctx.portalUploads.setup();ctx.state.temporaryUploads=true;
  return {ctx,picker,panel,form,storage,saved,calls,release:()=>release()};
}
for(const mode of ['missing','network','ready','claimed']){
  const f=await fixture(mode);await f.ctx.portalUploads.scope();
  assert.equal(f.picker.disabled,mode==='network'||mode==='claimed',mode);
  assert.equal(f.storage.values().next().value,f.saved,'Preserve session IDs');
  assert.equal(f.calls.length,2,'Read-only recovery');
  if(mode==='network'){assert.match(f.panel.innerHTML,/Network failed/);assert.match(f.panel.innerHTML,/data-upload-check-session/);assert.throws(()=>f.ctx.portalUploads.prepare(),/kiểm tra lại/);}
  if(mode==='ready')assert.equal(f.ctx.portalUploads.prepare().uploadIds[0],'existing');
}
const f=await fixture('slow'),pending=f.ctx.portalUploads.scope();
await new Promise(r=>setImmediate(r));
assert.equal(f.picker.disabled,true);assert.match(f.panel.innerHTML,/Đang kiểm tra/);
assert.throws(()=>f.ctx.portalUploads.prepare(),/Vui lòng chờ/);
f.form.elements.intakeCenter.value='BKE';await f.ctx.portalUploads.scope();
f.release();await pending;
assert.equal(f.picker.disabled,false);assert.equal(f.ctx.portalUploads.snapshot().items.length,0,'Ignore old center response');
console.log('Upload restore passed: missing session, network failure, existing files, claimed session, pending guard, center race.');
