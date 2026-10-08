import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../TemporaryUploads.gs',import.meta.url),'utf8');
let now=Date.now(),locked=false,seq=0,driveWrites=0;
class Clock extends Date{static now(){return now}}
const props=new Map([['TEMP_UPLOAD_ENABLED','1']]),folders=new Map(),files=new Map(),cases=[];
const iterator=values=>{let n=0;return{hasNext:()=>n<values.length,next:()=>values[n++]}};
function drive(){assert.equal(locked,false,'Drive I/O must not hold database lock');driveWrites++}
class Folder{
 constructor(id,name,parent){this.id=id;this.name=name;this.parent=parent;this.trash=false;folders.set(id,this)}
 getId(){return this.id}getUrl(){return'https://drive.google.com/drive/folders/'+this.id}getName(){return this.name}isTrashed(){return this.trash}
 getParents(){return iterator(this.parent?[folders.get(this.parent)]:[])}
 getFoldersByName(name){return iterator([...folders.values()].filter(f=>f.parent===this.id&&f.name===name&&!f.trash))}
 getFolders(){return iterator([...folders.values()].filter(f=>f.parent===this.id&&!f.trash))}
 getFiles(){return iterator([...files.values()].filter(f=>f.parent===this.id&&!f.trash))}
 createFolder(name){drive();return new Folder('folder-'+(++seq),name,this.id)}
 createFile(blob){drive();return new File('file-'+(++seq),blob,this.id)}
 getFilesByName(name){return iterator([...files.values()].filter(f=>f.parent===this.id&&f.name===name&&!f.trash))}
 setName(name){drive();this.name=name}moveTo(parent){drive();this.parent=parent.id}setTrashed(value){drive();this.trash=value}
 getSharingAccess(){return'PRIVATE'}
}
class File{
 constructor(id,blob,parent){this.id=id;this.name=blob.name;this.bytes=blob.bytes;this.parent=parent;this.trash=false;files.set(id,this)}
 getId(){return this.id}getName(){return this.name}getSize(){return this.bytes.length}getParents(){return iterator([folders.get(this.parent)])}isTrashed(){return this.trash}
 setName(name){drive();this.name=name}setTrashed(value){drive();this.trash=value}
}
new Folder('181f6qWxeV3N9Sv8ua7aqWjT-V7Ak4trY','File upload temporary');new Folder('dat','DAT');new Folder('bke','BKE');
const ctx={Date:Clock,console,Set,unescape,encodeURIComponent,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)})},
 LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(locked,false);locked=true;return true},releaseLock:()=>{locked=false}})},
 DriveApp:{Access:{PRIVATE:'PRIVATE'},getFolderById:id=>{drive();if(!folders.has(id))throw Error('Missing folder');return folders.get(id)},getFileById:id=>{drive();return files.get(id)}},
 Utilities:{base64Decode:s=>[...Buffer.from(s,'base64')],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeDigest:(_,b)=>[...crypto.createHash('sha256').update(Buffer.from(b)).digest()],DigestAlgorithm:{SHA_256:'sha'},newBlob:(bytes,mime,name)=>({bytes,mime,name})},
 CASE_EVIDENCE_FOLDERS:{'DAT Center':'dat','BKE Center':'bke'},SHEETS:{cases:'cases',users:'users'},readTable_:()=>cases,
 clean_:x=>String(x??'').trim(),required_:x=>{if(!x)throw Error('Missing');return x},parseJson_:x=>x?JSON.parse(x):null,publicError_:m=>Error(m),
 authenticate_:t=>{if(t==='expired')throw Error('Phiên hết hạn');return{email:t,centers:t==='other'?['BKE Center']:['DAT Center'],capabilities:{createCase:t!=='viewer'}}},
 assertCapability_:(a,c)=>{if(!a.capabilities[c])throw Error('Forbidden')},assertCenterAllowed_:(a,c)=>{if(!a.centers.includes(c))throw Error('Wrong center')}
};
vm.createContext(ctx);vm.runInContext(source,ctx);
const sid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const begin=n=>ctx.beginCaseUpload('staff',{center:'DAT Center',sessionId:sid(n)});
const payload=(n,i=1,ext='pdf',bytes=[37,80,68,70,45])=>({center:'DAT Center',sessionId:sid(n),uploadId:sid(100+i),name:'fixture.'+ext,base64:Buffer.from(bytes).toString('base64')});
begin(1);assert.equal(ctx.beginCaseUpload('staff',{center:'DAT Center',sessionId:sid(1)}).sessionId,sid(1));
assert.throws(()=>ctx.beginCaseUpload('other',{center:'BKE Center',sessionId:sid(1)}),/tài khoản/);
assert.throws(()=>ctx.beginCaseUpload('viewer',{center:'DAT Center',sessionId:sid(2)}),/Forbidden/);
assert.throws(()=>ctx.uploadCaseFile('expired',payload(1)),/hết hạn/);
assert.throws(()=>ctx.uploadCaseFile('staff',payload(1,1,'exe')),/Chỉ nhận/);
assert.throws(()=>ctx.uploadCaseFile('staff',payload(1,1,'png')),/khớp/);
assert.throws(()=>ctx.uploadCaseFile('staff',payload(1,1,'pdf',new Array(8*1024*1024+1).fill(1))),/8 MB/);
for(let i=1;i<=10;i++)ctx.uploadCaseFile('staff',payload(1,i));
assert.equal(files.size,10);ctx.uploadCaseFile('staff',payload(1));assert.equal(files.size,10,'Retry must not duplicate file');
assert.throws(()=>ctx.uploadCaseFile('staff',payload(1,11)),/10 file/);
assert.throws(()=>ctx.getCaseUploadSession('other',sid(1)),/tài khoản/);
const readsBefore=driveWrites;ctx.getCaseUploadSession('staff',sid(1));assert.equal(driveWrites,readsBefore,'Status reads must not scan Drive');
const staged={uploadSessionId:sid(1),uploadIds:Array.from({length:10},(_,i)=>sid(101+i)),requestId:sid(999),intakeCenter:'DAT Center'};
const actor=ctx.authenticate_('staff');
assert.throws(()=>ctx.tuPrepareCase_(actor,{...staged,uploadIds:[sid(101)]},'Case'),/danh sách/);
const link=ctx.tuPrepareCase_(actor,staged,'Case');
assert.throws(()=>ctx.tuPrepareCase_(actor,{...staged,requestId:sid(998)},'Case'),/yêu cầu khác/);
cases.push({'Liên kết hồ sơ Drive':link});ctx.tuCommitCase_(actor,staged,'case-1');assert.equal(props.has('TEMP_UPLOAD_V1:'+sid(1)),false);
begin(2);ctx.uploadCaseFile('staff',payload(2));
ctx.removeCaseUploadFile('staff',{center:'DAT Center',sessionId:sid(2),uploadId:sid(101)});assert.equal(ctx.getCaseUploadSession('staff',sid(2)).files.length,0);
begin(3);ctx.uploadCaseFile('staff',payload(3));
const uncertain=JSON.parse(props.get('TEMP_UPLOAD_V1:'+sid(3)));uncertain.files[0].status='UPLOADING';delete uncertain.files[0].fileId;props.set('TEMP_UPLOAD_V1:'+sid(3),JSON.stringify(uncertain));
const before=files.size;ctx.uploadCaseFile('staff',payload(3));assert.equal(files.size,before,'Lost acknowledgement should adopt existing file');
begin(4);const rec=JSON.parse(props.get('TEMP_UPLOAD_V1:'+sid(4)));rec.files=[{id:sid(107),name:'x.pdf',size:5,hash:'x',status:'UPLOADING',startedAt:now}];props.set('TEMP_UPLOAD_V1:'+sid(4),JSON.stringify(rec));
for(let n=5;n<=7;n++){begin(n);const r=JSON.parse(props.get('TEMP_UPLOAD_V1:'+sid(n)));r.files=[{id:sid(100+n),name:'x.pdf',size:5,hash:'x',status:'UPLOADING',startedAt:now}];props.set('TEMP_UPLOAD_V1:'+sid(n),JSON.stringify(r));}
begin(8);const driveBeforeBusy=driveWrites;assert.throws(()=>ctx.uploadCaseFile('staff',payload(8)),/UPLOAD_BUSY/);assert.equal(driveWrites,driveBeforeBusy,'Full pool must reject before Drive I/O');
begin(9);const unknownFolder=folders.get(JSON.parse(props.get('TEMP_UPLOAD_V1:'+sid(9))).folderId);new File('unrelated',{name:'manual-user-document.pdf',bytes:[1]},unknownFolder.id);
now+=25*60*60*1000;
ctx.cleanupTemporaryUploads();assert.equal([...folders.values()].find(f=>f.getUrl()===link).trash,false,'Case attachment must never be cleaned');
assert.equal([...folders.values()].filter(f=>f.name==='TMP-'+sid(3))[0].trash,true);
assert.equal(unknownFolder.trash,false,'Cleanup must not trash manually added unrelated files');
// Exercise real Code.gs creation with the real staging helper, not a fake upload branch.
const code=fs.readFileSync(new URL('../Code.gs',import.meta.url),'utf8'),start=code.indexOf('\nfunction getCreationStatus('),create=code.indexOf('\nfunction createCase('),end=code.indexOf('\nfunction ',create+1);
const works=[],issues=[];
Object.assign(ctx,{SHEETS:{cases:'cases',users:'users',workOrders:'works',issues:'issues'},readTable_:name=>name==='cases'?cases:name==='works'?works:issues,
  appendObject_:(name,row)=>{(name==='cases'?cases:name==='works'?works:issues).push(row)},ensureSheetColumns_:()=>{},makeId_:prefix=>prefix+'-'+(++seq),
  parseDateRequired_:x=>new Date(x),emailOptional_:x=>x||'',iso_:x=>new Date(x).toISOString().slice(0,10),
  SpreadsheetApp:{flush(){}},bumpPortalDatabaseRevision_(){},audit_(){},syncDashboardProjectionCase_(){},syncPortalCaseIndexCase_(){},
  uploadCaseEvidence_:()=>{throw Error('Staged case must never use legacy upload')},
  LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(locked,false);locked=true;return true},waitLock:()=>{assert.equal(locked,false);locked=true},releaseLock:()=>{locked=false}})}});
vm.runInContext(code.slice(start,end),ctx);
begin(10);ctx.uploadCaseFile('staff',payload(10));
const p={uploadSessionId:sid(10),uploadIds:[sid(101)],requestId:sid(990),intakeCenter:'DAT Center',receivedAt:'2026-10-08',deviceType:'Inverter',model:'Fixture',serialNumber:'TEST',customerName:'Fixture',customerPhone:'0900000000',customerAddress:'Fixture',initialIssue:'Fixture'};
const saved=ctx.createCase('staff',p),count=files.size,caseCount=cases.length;
assert.ok(saved.caseId&&saved.workOrderId);const retry=ctx.createCase('staff',p);
assert.equal(retry.caseId,saved.caseId);assert.equal(cases.length,caseCount);assert.equal(files.size,count,'Real create retry must not reupload');
assert.equal(props.has('TEMP_UPLOAD_V1:'+sid(10)),false);
console.log('Temporary uploads passed: formats/8MB/10files, staff access/center isolation, expired auth, idempotent upload/lost acknowledgement, private staging/move, no Drive under lock, metadata-only status and expiry without deleting case evidence.');
