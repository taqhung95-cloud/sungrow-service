/** SEPARATE Apps Script project. Never copy into the business backend. */
const SW_OWNER = 'sungrowservicecenter@gmail.com';
const SW_TEMP = '181f6qWxeV3N9Sv8ua7aqWjT-V7Ak4trY';
const SW_ROOTS = ['1oSqOD50t9O2VXZX7WHSDcagHUbYpJk67','1I6W-C0hvJ4sJ4L7NE6v1rWe-drYM8coy','1J_BodbodjndAJicA22FiM8ZXjQp9vfrQ','1oS2Ub1fsl6kTywc-_zThQxOZdYpxEDhK','1O9XohztuMW4utxCSPiIFoLVyghqETZr4'];
const SW_LEASE = 10*60*1000;
function swAssert_(condition,message) { if(!condition)throw Error(message); }
function swOwner_() { swAssert_(String(Session.getEffectiveUser().getEmail()).toLowerCase()===SW_OWNER,'Sai tài khoản thực thi.'); }
function swSecret_() {
  const secret=PropertiesService.getScriptProperties().getProperty('ATTACHMENT_STORAGE_SECRET')||'';
  swAssert_(secret.length>=43,'Chưa cấu hình khóa dịch vụ.');return secret;
}
function swMac_(text,secret) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text,secret)).replace(/=+$/g,''); }
function swEqual_(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
function swLock_(work) {
  const lock=LockService.getScriptLock();swAssert_(lock.tryLock(1500),'Dịch vụ đang bận. Kiểm tra lại cùng phiên.');
  try{return work();}finally{lock.releaseLock();}
}
function swId_(value) { swAssert_(/^[A-Za-z0-9-]{16,100}$/.test(value||''),'Mã upload không hợp lệ.');return value; }
function swName_(value,max) { swAssert_(typeof value==='string'&&value.length>0&&value.length<=(max||160)&&!/[\\/\x00-\x1f]/.test(value),'Tên file/thư mục không hợp lệ.');return value; }
function swParent_(item) {
  const parents=item.getParents();swAssert_(parents.hasNext(),'Không có thư mục cha.');const id=parents.next().getId();
  swAssert_(!parents.hasNext(),'Vị trí không xác định.');return id;
}
function swPrivate_(folder) { swAssert_(!folder.isTrashed()&&folder.getSharingAccess()===DriveApp.Access.PRIVATE,'Thư mục không ở chế độ Hạn chế.');return folder; }
function swTarget_(id) {
  swAssert_(id!==SW_TEMP&&SW_ROOTS.indexOf(id)<0,'Không sử dụng root làm thư mục hồ sơ.');
  const folder=swPrivate_(DriveApp.getFolderById(id));let current=folder;
  for(let i=0;i<20;i++){
    const parent=swParent_(current);if(SW_ROOTS.indexOf(parent)>=0){swPrivate_(DriveApp.getFolderById(parent));return folder;}
    swAssert_(parent!==SW_TEMP,'Không gắn file vào thư mục tạm.');current=swPrivate_(DriveApp.getFolderById(parent));
  }
  throw Error('Thư mục ngoài vùng lưu trữ.');
}
function swSession_(payload,allowFinal) {
  swId_(payload.sessionId);
  const folder=swPrivate_(DriveApp.getFolderById(payload.folderId));
  swAssert_(folder.getOwner().getEmail().toLowerCase()===SW_OWNER,'Thư mục không thuộc dịch vụ lưu trữ.');
  swAssert_(folder.getDescription()==='SC_UPLOAD_V1:'+payload.sessionId,'Thư mục không khớp phiên upload.');
  const parent=swParent_(folder);
  swAssert_(parent===SW_TEMP||allowFinal&&SW_ROOTS.indexOf(parent)>=0,'Thư mục không ở vị trí cho phép.');
  swPrivate_(DriveApp.getFolderById(parent));return folder;
}
function swDigest_(bytes) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)).replace(/=+$/g,''); }
function swFile_(spec,parents) {
  const file=DriveApp.getFileById(spec.fileId);
  swAssert_(file.getOwner().getEmail().toLowerCase()===SW_OWNER,'File không thuộc dịch vụ lưu trữ.');
  swAssert_(parents.indexOf(swParent_(file))>=0&&file.getSize()===spec.size,'Vị trí/kích thước file đã thay đổi.');
  return file;
}
function swStored_(payload) { return swId_(payload.uploadId)+'--'+swName_(payload.name,150); }
function swFind_(folder,payload) {
  const found=folder.getFilesByName(swStored_(payload));if(!found.hasNext())return null;
  const file=found.next();swAssert_(!found.hasNext()&&!file.isTrashed()&&file.getSize()===payload.size,'Có file trùng hoặc khác kích thước.');
  swAssert_(file.getOwner().getEmail().toLowerCase()===SW_OWNER&&swDigest_(file.getBlob().getBytes())===payload.hash,'Nội dung file không khớp.');
  return file;
}
function swNonce_(message) {
  swLock_(function(){
    const props=PropertiesService.getScriptProperties(),now=Date.now(),all=props.getProperties();
    Object.keys(all).filter(k=>k.indexOf('SW_NONCE:')===0&&Number(all[k])<now-300000).forEach(k=>props.deleteProperty(k));
    Object.keys(all).filter(k=>k.indexOf('SW_PUT:')===0).forEach(function(k){const r=JSON.parse(all[k]);if(r.done&&r.at<now-72*60*60*1000)props.deleteProperty(k);});
    const key='SW_NONCE:'+message.nonce;swAssert_(!props.getProperty(key),'Yêu cầu đã nhận.');
    swAssert_(Object.keys(props.getProperties()).filter(k=>k.indexOf('SW_NONCE:')===0).length<1500,'Dịch vụ đang quá tải.');
    props.setProperty(key,String(now));
  });
}
function doGet() { return ContentService.createTextOutput('Attachment storage service'); }
function doPost(event) {
  let nonce='',secret='';
  try{
    swOwner_();secret=swSecret_();
    const text=event&&event.postData&&event.postData.contents;
    swAssert_(typeof text==='string'&&text.length<49000000,'Yêu cầu quá lớn hoặc không hợp lệ.');
    const message=JSON.parse(text);nonce=message.nonce;
    swAssert_(message.version===1&&/^[A-Za-z0-9-]{16,100}$/.test(nonce||'')&&Number.isFinite(message.timestamp)&&Math.abs(Date.now()-message.timestamp)<=300000&&typeof message.body==='string','Yêu cầu hết hạn/không hợp lệ.');
    swAssert_(swEqual_(message.signature,swMac_([message.version,nonce,message.timestamp,message.body].join('\n'),secret)),'Chữ ký không hợp lệ.');
    swNonce_(message);
    const command=JSON.parse(message.body),result=swDispatch_(command.action,command.payload||{});
    return swReply_(nonce,{ok:true,result:result},secret);
  }catch(error){
    // Never return stack traces, OAuth tokens, signed request content or secret values.
    return swReply_(nonce,{ok:false,error:String(error.message||'Không xử lý được yêu cầu.').slice(0,250)},secret);
  }
}
function swReply_(nonce,value,secret) {
  const body=JSON.stringify(value);
  return ContentService.createTextOutput(JSON.stringify({nonce:nonce,body:body,signature:secret?swMac_(nonce+'\n'+body,secret):''})).setMimeType(ContentService.MimeType.JSON);
}
function swDispatch_(action,p) {
  swOwner_();
  if(action==='probe'){
    const roots=[SW_TEMP].concat(SW_ROOTS).map(function(id){const folder=swPrivate_(DriveApp.getFolderById(id));
      swAssert_([DriveApp.Permission.OWNER,DriveApp.Permission.EDIT,DriveApp.Permission.ORGANIZER].indexOf(folder.getAccess(SW_OWNER))>=0,'Thiếu quyền ghi vào thư mục.');
      return {id:id,name:folder.getName(),restricted:true};});
    return {executor:SW_OWNER,version:1,roots:roots};
  }
  if(action==='begin')return swLock_(function(){
    const id=swId_(p.sessionId),root=swPrivate_(DriveApp.getFolderById(SW_TEMP)),found=root.getFoldersByName('TMP-'+id);
    let folder;if(found.hasNext()){folder=found.next();swAssert_(!found.hasNext(),'Trùng thư mục tạm.');swSession_({sessionId:id,folderId:folder.getId()},false);}
    else{folder=root.createFolder('TMP-'+id);folder.setDescription('SC_UPLOAD_V1:'+id);}
    return {folderId:folder.getId()};
  });
  if(action==='put'||action==='find'){
    const folder=swSession_(p,false);swStored_(p);
    swAssert_(Number.isInteger(p.size)&&p.size>0&&p.size<=32*1024*1024&&/^[A-Za-z0-9_-]{43}$/.test(p.hash||''),'Kích thước/hash không hợp lệ (tối đa 32 MB/file).');
    const found=swFind_(folder,p);
    if(found)return {fileId:found.getId(),size:p.size,hash:p.hash};
    if(action==='find')return {fileId:''};
    swAssert_(typeof p.base64==='string'&&p.base64.length<=48000000&&/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64),'File không hợp lệ.');
    const bytes=Utilities.base64Decode(p.base64);swAssert_(bytes.length===p.size&&swDigest_(bytes)===p.hash,'Nội dung/hash không khớp.');
    const key='SW_PUT:'+folder.getId()+':'+p.uploadId,props=PropertiesService.getScriptProperties();
    const lease=Utilities.getUuid();
    swLock_(function(){const old=JSON.parse(props.getProperty(key)||'null');
      swAssert_(!old||old.hash===p.hash,'Mã upload đã dùng cho nội dung khác.');
      // A Google execution ends within six minutes. Keep a ten-minute reservation;
      // only a later explicit retry with no matching file may recover a failed create.
      swAssert_(!old||!old.done&&Date.now()-old.at>SW_LEASE,'File đang tải hoặc kết quả chưa rõ. Kiểm tra lại cùng phiên.');
      const all=props.getProperties();swAssert_(JSON.stringify(all).length<350000,'Kho biên nhận đầy, cần dọn upload hết hạn.');
      props.setProperty(key,JSON.stringify({lease:lease,hash:p.hash,at:Date.now()}));});
    const file=folder.createFile(Utilities.newBlob(bytes,p.mime,swStored_(p)));
    props.setProperty(key,JSON.stringify({lease:lease,hash:p.hash,at:Date.now(),done:true}));
    return {fileId:file.getId(),size:p.size,hash:p.hash};
  }
  if(action==='remove'){
    const folder=swSession_(p,false),file=swFile_(p.file,[folder.getId()]);
    if(!file.isTrashed())file.setTrashed(true);
    return {removed:true};
  }
  if(action==='prepare'||action==='supplement'){
    const folder=swSession_(p,action==='prepare');
    swAssert_(Array.isArray(p.files)&&p.files.length>0&&new Set(p.files.map(f=>f.fileId)).size===p.files.length,'Danh sách file không hợp lệ.');
    let target;
    if(action==='prepare'){
      swAssert_(SW_ROOTS.indexOf(p.parentId)>=0,'Root không hợp lệ.');
      swAssert_([SW_TEMP,p.parentId].indexOf(swParent_(folder))>=0,'Folder đã chuyển sang center khác.');
      target=swPrivate_(DriveApp.getFolderById(p.parentId));swName_(p.name,400);
    }else target=swTarget_(p.targetFolderId);
    const allowed=action==='prepare'?[folder.getId()]:[folder.getId(),target.getId()];
    const files=p.files.map(function(spec){swName_(spec.finalName,180);const file=swFile_(spec,allowed);swAssert_(!file.isTrashed(),'File đã bị xóa.');return {file:file,spec:spec};});
    files.forEach(function(item){item.file.setName(item.spec.finalName);if(action==='supplement'&&swParent_(item.file)!==target.getId())item.file.moveTo(target);});
    if(action==='prepare'){folder.setName(p.name);if(swParent_(folder)!==p.parentId)folder.moveTo(target);}
    return {url:action==='prepare'?folder.getUrl():target.getUrl(),count:files.length};
  }
  if(action==='cleanup'||action==='tidy'){
    if(!p.folderId){
      const found=swPrivate_(DriveApp.getFolderById(SW_TEMP)).getFoldersByName('TMP-'+swId_(p.sessionId));
      if(!found.hasNext())return {trashed:true};p.folderId=found.next().getId();swAssert_(!found.hasNext(),'Trùng thư mục.');
    }
    const raw=DriveApp.getFolderById(p.folderId);
    if(!raw.isTrashed()){
      const folder=swSession_(p,action==='cleanup'),parent=swParent_(folder);
      swAssert_(parent===SW_TEMP||parent===p.parentId,'Vị trí đã đổi, không dọn.');
      swAssert_(!folder.getFolders().hasNext(),'Không dọn thư mục có thư mục con.');
      if(action==='tidy')swAssert_(!folder.getFiles().hasNext(),'Thư mục bổ sung còn file; giữ nguyên để kiểm tra.');
      const contents=folder.getFiles();while(contents.hasNext()){
        const file=contents.next();swAssert_((p.files||[]).some(f=>f.fileId===file.getId()||swStored_({uploadId:f.uploadId,name:f.name})===file.getName()&&f.size===file.getSize()),'Có file ngoài phiên, không dọn.');
      }
      folder.setTrashed(true);
    }else{
      swAssert_(raw.getOwner().getEmail().toLowerCase()===SW_OWNER&&raw.getDescription()==='SC_UPLOAD_V1:'+swId_(p.sessionId),'Sai thư mục.');
    }
    const props=PropertiesService.getScriptProperties(),prefix='SW_PUT:'+p.folderId+':';
    Object.keys(props.getProperties()).filter(k=>k.indexOf(prefix)===0).forEach(k=>props.deleteProperty(k));
    return {trashed:true};
  }
  throw Error('Lệnh không được hỗ trợ.');
}
/** Run in this separate project's editor; reads permissions only. */
function kiemTraDichVuLuuTru() { return swDispatch_('probe',{}); }
