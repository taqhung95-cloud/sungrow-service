import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const harness=fs.readFileSync(new URL('./temporary-uploads.mjs',import.meta.url),'utf8').split('begin(1);')[0].replace(/^import .*;\r?\n/gm,'').replace(/import\.meta\.url/g,JSON.stringify(new URL('./temporary-uploads.mjs',import.meta.url).href));
const {ctx,props,folders,files,Folder,File,sid,payload,drive}=new Function('fs','vm','assert','crypto',harness+';return {ctx,props,folders,files,Folder,File,sid,payload,drive};')(fs,vm,assert,crypto);
File.prototype.moveTo=function(folder){drive();this.parent=folder.id;};
const target=new Folder('case-folder','Existing case','dat'),old=new File('old-file',{name:'existing.pdf',bytes:[1]},target.id),audit=[];
let current={email:'staff',centers:['DAT Center'],capabilities:{updateWorkOrder:true,createCase:false},isGlobalManager:false};
const record={'Mã hồ sơ':'C1','Trung tâm đang giữ hàng':'DAT Center','Trung tâm tiếp nhận khách':'DAT Center','Liên kết hồ sơ Drive':'https://drive.google.com/drive/folders/case-folder','Trạng thái hồ sơ':'Đang xử lý'};
Object.assign(ctx,{SHEETS:{cases:'cases',workOrders:'works',audit:'audit'},authenticate_:token=>{if(token==='expired')throw Error('expired');return current;},hasCapability_:(a,c)=>!!a.capabilities[c],
 assertCaseEditable_:(a,r)=>{if(!a.isGlobalManager&&r['Trạng thái hồ sơ']==='Đã hoàn tất')throw Error('closed');},
 findTableRowsByField_:(table)=>table==='cases'?[record]:table==='works'?[{'Trung tâm xử lý':'DAT Center','Trạng thái xử lý':'Đã nhận hàng'}]:audit,
 syncDashboardProjectionCase_:()=>{},syncPortalCaseIndexCase_:()=>{},bumpPortalDatabaseRevision_:()=>{},
 audit_:(actor,action,type,id,center,before,after)=>audit.push({'Email người dùng':actor.email,'Hành động':action,'Dữ liệu sau':JSON.stringify(after)}),withSerializedWrite_:(_,cb)=>ctx.tuLock_(cb)});
ctx.Utilities.getUuid=()=>crypto.randomUUID();
vm.runInContext(fs.readFileSync(new URL('../SupplementalAttachments.gs',import.meta.url),'utf8'),ctx);
const begin=n=>ctx.beginCaseUpload('staff',{sessionId:sid(n),center:'DAT Center',caseId:'C1'});
begin(50);ctx.uploadCaseFile('staff',{...payload(50),category:'centerPhotos'});
const request={caseId:'C1',sessionId:sid(50),uploadIds:[sid(101)]};
assert.throws(()=>ctx.commitCaseAttachments('expired',request),/expired/);
assert.throws(()=>ctx.tuPrepareCase_(current,{uploadSessionId:sid(50)},'wrong'),/không được dùng/);
record['Trung tâm đang giữ hàng']='BKE Center';assert.throws(()=>ctx.commitCaseAttachments('staff',request),/Wrong center/);record['Trung tâm đang giữ hàng']='DAT Center';
record['Liên kết hồ sơ Drive']='https://drive.google.com/drive/folders/bke';assert.throws(()=>ctx.commitCaseAttachments('staff',request),/thư mục đã thay đổi/);record['Liên kết hồ sơ Drive']='https://drive.google.com/drive/folders/case-folder';
record['Trạng thái hồ sơ']='Đã hủy';assert.throws(()=>ctx.commitCaseAttachments('staff',request),/bị hủy/);record['Trạng thái hồ sơ']='Đang xử lý';
const result=ctx.commitCaseAttachments('staff',request);assert.equal(result.added,1);assert.equal(audit.length,1);
const added=[...files.values()].find(f=>f.id!==old.id);assert.equal(added.parent,target.id);assert.match(added.name,/^05_Hinh anh tai center--/);assert.equal(old.name,'existing.pdf');assert.equal(old.parent,target.id);
const fileCount=files.size;assert.equal(ctx.commitCaseAttachments('staff',request).added,1);assert.equal(files.size,fileCount);assert.equal(audit.length,1,'Lost ack must not duplicate audit');
assert.throws(()=>ctx.removeCaseUploadFile('staff',{sessionId:sid(50),center:'DAT Center',uploadId:sid(101)}),/đã gắn/);
begin(51);ctx.uploadCaseFile('staff',{...payload(51),category:'deviceLog'});
const retry={caseId:'C1',sessionId:sid(51),uploadIds:[sid(101)]};
const realAudit=ctx.audit_;ctx.audit_=()=>{throw Error('audit unavailable');};
assert.throws(()=>ctx.commitCaseAttachments('staff',retry),/audit unavailable/);
assert.equal(ctx.tuRead_(sid(51)).state,'ATTACHING');
ctx.audit_=realAudit;const afterPartial=files.size;ctx.commitCaseAttachments('staff',retry);assert.equal(files.size,afterPartial,'Adopt already moved file after partial commit');
record['Trạng thái hồ sơ']='Đã hoàn tất';assert.throws(()=>begin(52),/closed/);record['Trạng thái hồ sơ']='Đang xử lý';
current.capabilities.updateWorkOrder=false;assert.throws(()=>begin(52),/Forbidden/);current.capabilities.updateWorkOrder=true;
new Folder('outside','Outside',null);record['Liên kết hồ sơ Drive']='https://drive.google.com/drive/folders/outside';assert.throws(()=>begin(52),/không nằm/);
record['Liên kết hồ sơ Drive']='https://drive.google.com/drive/folders/dat';assert.throws(()=>begin(52),/thư mục gốc/);
record['Liên kết hồ sơ Drive']='https://drive.google.com/file/d/file-id/view';assert.throws(()=>begin(52),/thư mục Drive hợp lệ/);
assert.equal(props.has('TEMP_UPLOAD_V1:'+sid(52)),false,'No staging folder/session for invalid target');
record['Liên kết hồ sơ Drive']='https://drive.google.com/drive/folders/case-folder';
assert.equal(ctx.getCaseAttachmentReceipt('staff',{caseId:'C1',sessionId:sid(50)}).found,true);
assert.equal(ctx.getCaseAttachmentReceipt('staff',{caseId:'C1',sessionId:sid(99)}).found,false);
assert.equal(audit[0]['Hành động'],'Bổ sung đính kèm');
console.log('Supplement attachments passed: canonical folder, group names, no overwrite, permissions/center/closed/deleted, foreign-folder guards, partial/lost-ack retry and single audit.');
