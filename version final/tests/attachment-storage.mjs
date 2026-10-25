import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const harness=read('./temporary-uploads.mjs').split('begin(1);')[0].replace(/^import .*;\r?\n/gm,'').replace(/import\.meta\.url/g,JSON.stringify(new URL('./temporary-uploads.mjs',import.meta.url).href));
const {ctx,props,folders,files,cases,Folder,File,sid,payload,drive}=new Function('fs','vm','assert','crypto',harness+';return {ctx,props,folders,files,cases,Folder,File,sid,payload,drive};')(fs,vm,assert,crypto);
const owner='sungrowservicecenter@gmail.com',oldOwner='taqhung.95@gmail.com',secret=crypto.randomBytes(32).toString('base64url'),workerProps=new Map();
let inWorker=false,workerLocked=false,loseResponse=false,tamperReply=false,calls=0;
Folder.prototype.getOwner=function(){return{getEmail:()=>this.owner||oldOwner}};
Folder.prototype.getAccess=()=> 'EDIT';Folder.prototype.getDescription=function(){return this.description||''};Folder.prototype.setDescription=function(s){drive();this.description=s;};
File.prototype.getOwner=Folder.prototype.getOwner;File.prototype.getBlob=function(){return{getBytes:()=>this.bytes}};File.prototype.moveTo=function(folder){drive();this.parent=folder.id;};
const createFolder=Folder.prototype.createFolder,createFile=Folder.prototype.createFile;
Folder.prototype.createFolder=function(name){const folder=createFolder.call(this,name);folder.owner=inWorker?owner:oldOwner;return folder;};
Folder.prototype.createFile=function(blob){const file=createFile.call(this,blob);file.owner=inWorker?owner:oldOwner;return file;};
const getProps=map=>({getProperty:k=>map.get(k)||null,setProperty:(k,v)=>map.set(k,v),deleteProperty:k=>map.delete(k),getProperties:()=>Object.fromEntries(map)});
ctx.DriveApp.Permission={OWNER:'OWNER',EDIT:'EDIT',ORGANIZER:'ORGANIZER'};
Object.assign(ctx.Utilities,{getUuid:()=>crypto.randomUUID(),base64Encode:b=>Buffer.from(b).toString('base64'),computeHmacSha256Signature:(text,key)=>[...crypto.createHmac('sha256',key).update(text).digest()]});
workerProps.set('ATTACHMENT_STORAGE_SECRET',secret);
const worker={...ctx,Session:{getEffectiveUser:()=>({getEmail:()=>owner})},PropertiesService:{getScriptProperties:()=>getProps(workerProps)},
 LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(workerLocked,false);workerLocked=true;return true},releaseLock:()=>{workerLocked=false}})},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this}})}};
vm.createContext(worker);vm.runInContext(read('../../attachment-storage/StorageWorker.gs'),worker);
const roots=vm.runInContext('SW_ROOTS',worker);for(const id of roots)new Folder(id,'Center '+id);const dat=roots[2];ctx.CASE_EVIDENCE_FOLDERS['DAT Center']=dat;
ctx.Session={getEffectiveUser:()=>({getEmail:()=>oldOwner}),getActiveUser:()=>({getEmail:()=>oldOwner})};
ctx.UrlFetchApp={fetch:(url,options)=>{
 calls++;assert.equal(url,'https://script.google.com/macros/s/test-worker/exec');const envelope=JSON.parse(options.payload);
 assert.equal(envelope.body.includes('idToken'),false);assert.equal(envelope.body.includes('staff@example.test'),false);
 inWorker=true;let reply;try{reply=worker.doPost({postData:{contents:options.payload}}).text;}finally{inWorker=false;}
 if(loseResponse){loseResponse=false;throw Error('lost response');}if(tamperReply)reply=reply.replace('signature','invalidSignature');
 return{getResponseCode:()=>200,getContentText:()=>reply};}};
vm.runInContext(read('../AttachmentStorage.gs'),ctx);
// Installing adapter alone has no impact on existing uploads; activate explicitly.
assert.equal(ctx.asEnabled_(),false);props.set('ATTACHMENT_STORAGE_MODE','typo');assert.throws(()=>ctx.asEnabled_(),/không hợp lệ/);
props.set('ATTACHMENT_STORAGE_MODE','dedicated-v1');props.set('ATTACHMENT_STORAGE_URL','https://script.google.com/macros/s/test-worker/exec');props.set('ATTACHMENT_STORAGE_SECRET',secret);
const probe=ctx.kiemTraKhoDinhKemRieng();assert.equal(probe.mainExecutor,oldOwner);assert.equal(probe.storage.executor,owner);
const begin=n=>ctx.beginCaseUpload('staff',{center:'DAT Center',sessionId:sid(n)});
begin(1);assert.equal(ctx.tuRead_(sid(1)).owner,'staff');assert.equal(ctx.tuRead_(sid(1)).storageMode,'dedicated-v1');
loseResponse=true;assert.throws(()=>ctx.uploadCaseFile('staff',payload(1)),/Chưa xác định/);assert.equal(files.size,1);
ctx.uploadCaseFile('staff',payload(1));assert.equal(files.size,1,'Lost ack recovers exact worker-owned file');
const ready=ctx.tuRead_(sid(1));assert.equal(files.get(ready.files[0].fileId).owner,owner);
const committedUrl=ctx.tuPrepareCase_({email:'staff',centers:['DAT Center']},{uploadSessionId:sid(1),uploadIds:[sid(101)],intakeCenter:'DAT Center',requestId:sid(201)},'Case 1');
assert.match(committedUrl,/drive\/folders/);assert.equal(folders.get(ready.folderId).parent,dat);
ctx.tuPrepareCase_({email:'staff',centers:['DAT Center']},{uploadSessionId:sid(1),uploadIds:[sid(101)],intakeCenter:'DAT Center',requestId:sid(201)},'Case 1');assert.equal(files.size,1);
begin(2);ctx.uploadCaseFile('staff',payload(2));const removed=ctx.tuRead_(sid(2)).files[0].fileId;
ctx.removeCaseUploadFile('staff',{center:'DAT Center',sessionId:sid(2),uploadId:sid(101)});assert.equal(files.get(removed).trash,true);
assert.equal(ctx.tuRead_(sid(2)).files.length,0);
// Old sessions stay on original account even after activation.
props.delete('ATTACHMENT_STORAGE_MODE');begin(3);props.set('ATTACHMENT_STORAGE_MODE','dedicated-v1');ctx.uploadCaseFile('staff',payload(3));
assert.equal(files.get(ctx.tuRead_(sid(3)).files[0].fileId).owner,oldOwner);
const before=calls;ctx.getCaseUploadSession('staff',sid(2));assert.equal(calls,before,'Session read must not contact worker');
tamperReply=true;assert.throws(()=>ctx.kiemTraKhoDinhKemRieng(),/Chưa xác định/);tamperReply=false;
props.set('ATTACHMENT_STORAGE_URL','https://attacker.test/exec');assert.throws(()=>ctx.kiemTraKhoDinhKemRieng(),/Chưa cấu hình/);props.set('ATTACHMENT_STORAGE_URL','https://script.google.com/macros/s/test-worker/exec');
// Exercise authenticated wire protocol, replay, expired/tampered messages and wrong executor.
const sign=(command,nonce=crypto.randomUUID(),timestamp=Date.now())=>{const body=JSON.stringify(command);return{version:1,nonce,timestamp,body,signature:ctx.asMac_([1,nonce,timestamp,body].join('\n'),secret)}};
const post=envelope=>JSON.parse(JSON.parse(worker.doPost({postData:{contents:JSON.stringify(envelope)}}).text).body);
const signed=sign({action:'probe',payload:{}});assert.equal(post(signed).ok,true);assert.equal(post(signed).ok,false);
assert.equal(post({...sign({action:'probe'}),signature:'bad'}).ok,false);
assert.equal(post(sign({action:'probe'},crypto.randomUUID(),Date.now()-400000)).ok,false);
worker.Session={getEffectiveUser:()=>({getEmail:()=>oldOwner})};assert.equal(post(sign({action:'probe'})).ok,false);worker.Session={getEffectiveUser:()=>({getEmail:()=>owner})};
assert.throws(()=>worker.swDispatch_('supplement',{sessionId:sid(2),folderId:ctx.tuRead_(sid(2)).folderId,targetFolderId:dat,files:[{fileId:removed,size:5}]}),/root/);
const originalFetch=ctx.UrlFetchApp.fetch;ctx.UrlFetchApp.fetch=()=>{throw Error('offline')};
assert.throws(()=>begin(4),/Chưa xác định/);assert.equal(ctx.tuRead_(sid(4)).storageMode,'dedicated-v1');ctx.UrlFetchApp.fetch=originalFetch;
begin(4);assert.equal(folders.get(ctx.tuRead_(sid(4)).folderId).owner,owner,'No silent fallback to old executor');
// Supplemental commit retains business actor and adopts files after partial save.
const target=new Folder('existing-case','Existing case',dat);let audits=0;
Object.assign(ctx,{SHEETS:{cases:'cases',workOrders:'works',audit:'audit'},authenticate_:()=>({email:'staff',centers:['DAT Center'],capabilities:{updateWorkOrder:true},isGlobalManager:false}),
 hasCapability_:()=>true,assertCaseEditable_:()=>{},findTableRowsByField_:table=>table==='cases'?[{'Mã hồ sơ':'C1','Trung tâm đang giữ hàng':'DAT Center','Trạng thái hồ sơ':'Đang xử lý','Liên kết hồ sơ Drive':target.getUrl()}]:table==='works'?[{'Trung tâm xử lý':'DAT Center','Trạng thái xử lý':'Đã nhận hàng'}]:[],
 syncDashboardProjectionCase_:()=>{},syncPortalCaseIndexCase_:()=>{},bumpPortalDatabaseRevision_:()=>{},audit_:actor=>{assert.equal(actor.email,'staff');audits++;},withSerializedWrite_:(_,cb)=>ctx.tuLock_(cb)});
vm.runInContext(read('../SupplementalAttachments.gs'),ctx);
ctx.beginCaseUpload('staff',{center:'DAT Center',sessionId:sid(5),caseId:'C1'});ctx.uploadCaseFile('staff',payload(5));
ctx.commitCaseAttachments('staff',{caseId:'C1',sessionId:sid(5),uploadIds:[sid(101)]});const supplementary=files.get(ctx.tuRead_(sid(5)).files[0].fileId);assert.equal(supplementary.parent,target.id);assert.equal(supplementary.owner,owner);assert.equal(audits,1);
ctx.commitCaseAttachments('staff',{caseId:'C1',sessionId:sid(5),uploadIds:[sid(101)]});assert.equal(audits,1);
// Cleanup must retain canonical folders and moved supplementary files.
cases.push({'Liên kết hồ sơ Drive':committedUrl,'Mã yêu cầu tạo':sid(201)});
for(const n of [1,2,3,4,5]){const record=ctx.tuRead_(sid(n));record.expiresAt=0;record.leaseUntil=0;ctx.tuWrite_(record);}
const tidyFolder=ctx.tuRead_(sid(5)).folderId;const cleanup=ctx.cleanupTemporaryUploads();
assert.ok(cleanup.trashed>=3);assert.equal(folders.get(ready.folderId).trash,false);assert.equal(folders.get(tidyFolder).trash,true);
assert.equal(supplementary.trash,false);assert.equal(supplementary.parent,target.id);assert.equal(ctx.tuRead_(sid(1)),null);
// Legacy ZIP route also writes through the worker, not the main executor.
const code=read('../Code.gs'),legacy=code.slice(code.indexOf('function uploadCaseEvidence_('),code.indexOf('/**',code.indexOf('function uploadCaseEvidence_(')));
ctx.iso_=()=> '2026-10-25';vm.runInContext(legacy,ctx);
const zip={name:'evidence.zip',base64:Buffer.from([80,75,3,4,1,2,3]).toString('base64')};
const legacyUrl=ctx.uploadCaseEvidence_('DAT Center',new Date(),'SN','Model','Customer',zip,sid(300));
const legacyFolder=legacyUrl.split('/').pop();assert.equal(folders.get(legacyFolder).owner,owner);
assert.equal([...files.values()].filter(f=>f.parent===legacyFolder).every(f=>f.owner===owner),true);
// New sessions cannot proceed with an incomplete install.
ctx.asEnabled_=undefined;assert.throws(()=>ctx.beginCaseUpload('staff',{center:'DAT Center',sessionId:sid(10)}),/Thiếu module/);
console.log('Attachment storage passed: signed protocol/replay, dedicated ownership, lost response/recovery, staged create/prepare/remove, legacy ZIP, supplemental actor/commit, safe cleanup/canonical preservation, old sessions, no read dependency and no silent fallback.');
