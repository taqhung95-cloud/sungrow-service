/** Private staged evidence. Drive I/O runs outside the database lock. */
const TU_FOLDER_ID = '181f6qWxeV3N9Sv8ua7aqWjT-V7Ak4trY';
const TU_PREFIX = 'TEMP_UPLOAD_V1:';
const TU_TTL = 24 * 60 * 60 * 1000;
const TU_LEASE = 10 * 60 * 1000;
const TU_TYPES = Object.freeze({doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',zip:'application/zip',rar:'application/vnd.rar',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'});

function tuLock_(work) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw publicError_('Hệ thống đang cập nhật. Vui lòng thử lại, không chọn lại file.');
  try { return work(); } finally { lock.releaseLock(); }
}
function tuId_(value) {
  const id = clean_(value);
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(id)) throw publicError_('Mã phiên upload không hợp lệ.');
  return id;
}
function tuRead_(id) { return parseJson_(PropertiesService.getScriptProperties().getProperty(TU_PREFIX + tuId_(id))); }
function tuWrite_(record) {
  const raw = JSON.stringify(record);
  if (unescape(encodeURIComponent(raw)).length > 8000) throw publicError_('Thông tin phiên upload quá lớn. Vui lòng rút gọn tên file.');
  PropertiesService.getScriptProperties().setProperty(TU_PREFIX + record.id, raw);
}
function tuActor_(token, center) {
  const actor = authenticate_(token);
  assertCapability_(actor, 'createCase'); assertCenterAllowed_(actor, center);
  if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
  if (typeof cmsAssertPortalWrites_ === 'function') cmsAssertPortalWrites_();
  return actor;
}
function tuOwned_(actor, id, editable) {
  const record = tuRead_(id);
  if (!record || record.owner !== actor.email) throw publicError_('Không tìm thấy phiên upload của tài khoản này.');
  assertCenterAllowed_(actor, record.center);
  if (editable && (record.state !== 'OPEN' || record.expiresAt <= Date.now())) throw publicError_('Phiên upload đã hết hạn hoặc đã gắn vào hồ sơ. Không gửi lại file.');
  return record;
}
function tuPublic_(record) {
  return {sessionId:record.id,center:record.center,state:record.state,expiresAt:record.expiresAt,
    files:record.files.map(function(f){return {uploadId:f.id,name:f.name,size:f.size,status:f.status};})};
}
function temporaryUploadsEnabled_() { return PropertiesService.getScriptProperties().getProperty('TEMP_UPLOAD_ENABLED') === '1'; }

function beginCaseUpload(idToken, payload) {
  if (!temporaryUploadsEnabled_()) throw publicError_('Upload tạm chưa được quản lý khởi tạo.');
  const center = required_(payload && payload.center, 'Trung tâm tiếp nhận');
  const actor = tuActor_(idToken, center), id = tuId_(payload.sessionId);
  let newSession = false;
  let record = tuLock_(function(){
    const current = tuRead_(id);
    if (current) {
      if (current.owner !== actor.email || current.center !== center) throw publicError_('Phiên upload không thuộc tài khoản/center này.');
      if (current.expiresAt <= Date.now()) throw publicError_('Phiên upload đã hết hạn 24 giờ.');
      if (!['OPEN','INIT'].includes(current.state)) throw publicError_('Phiên upload đã được sử dụng.');
      return current;
    }
    const all = PropertiesService.getScriptProperties().getProperties();
    const sessions = Object.keys(all).filter(function(k){return k.indexOf(TU_PREFIX)===0;});
    if (sessions.length >= 40 || unescape(encodeURIComponent(JSON.stringify(all))).length > 350000) throw publicError_('Kho phiên upload tạm đang đầy. Quản lý cần chạy cleanupTemporaryUploads trước khi tải thêm.');
    const next = {id:id,owner:actor.email,center:center,state:'INIT',createdAt:Date.now(),expiresAt:Date.now()+TU_TTL,files:[]};
    newSession = true;
    tuWrite_(next);return next;
  });
  if (!record.folderId) {
    const parent = DriveApp.getFolderById(TU_FOLDER_ID), name = 'TMP-' + id;
    const existing = parent.getFoldersByName(name);
    if (!newSession && !existing.hasNext() && Date.now()-record.createdAt<TU_LEASE) throw publicError_('Thư mục upload đang được chuẩn bị. Vui lòng kiểm tra lại.');
    const folder = existing.hasNext() ? existing.next() : parent.createFolder(name);
    if (existing.hasNext()) throw publicError_('Có thư mục upload trùng mã. Liên hệ quản lý.');
    record = tuLock_(function(){const current=tuRead_(id);current.folderId=folder.getId();current.state='OPEN';tuWrite_(current);return current;});
  }
  return tuPublic_(record);
}

function tuFileBytes_(payload) {
  const name = clean_(payload.name).replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,80);
  const ext = name.split('.').pop().toLowerCase();
  if (!TU_TYPES[ext]) throw publicError_('Chỉ nhận DOC/DOCX, PDF, XLS/XLSX, ZIP/RAR, JPG/JPEG và PNG.');
  const base64 = String(payload.base64 || '');
  if (!base64 || base64.length > Math.ceil(8*1024*1024/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw publicError_('File không hợp lệ hoặc vượt quá 8 MB.');
  const bytes = Utilities.base64Decode(base64), signature = bytes.slice(0,8).map(function(b){return b&255;});
  if (!bytes.length || bytes.length > 8*1024*1024) throw publicError_('Mỗi file phải lớn hơn 0 và tối đa 8 MB.');
  const starts = function(values){return values.every(function(v,i){return signature[i]===v;});};
  const zip = starts([80,75,3,4]) || starts([80,75,5,6]) || starts([80,75,7,8]);
  const valid = ext==='pdf'?starts([37,80,68,70,45]):ext==='png'?starts([137,80,78,71,13,10,26,10]):/^(jpg|jpeg)$/.test(ext)?starts([255,216,255]):ext==='rar'?starts([82,97,114,33,26,7]):/^(doc|xls)$/.test(ext)?starts([208,207,17,224,161,177,26,225]):zip;
  if (!valid) throw publicError_('Nội dung file không khớp định dạng: '+name+'.');
  return {name:name,bytes:bytes,mime:TU_TYPES[ext],hash:Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)).replace(/=+$/g,'')};
}
function tuStoredName_(file) { return file.id + '--' + file.name; }
function tuActiveUploads_() {
  const all=PropertiesService.getScriptProperties().getProperties();
  return Object.keys(all).filter(function(k){return k.indexOf(TU_PREFIX)===0;}).reduce(function(n,k){const r=parseJson_(all[k]);return n+(r?r.files.filter(function(f){return f.status==='UPLOADING'&&f.startedAt+TU_LEASE>Date.now();}).length:0);},0);
}
function tuRecoverFile_(record, file) {
  const found = DriveApp.getFolderById(record.folderId).getFilesByName(tuStoredName_(file));
  if (!found.hasNext()) return null;
  const saved = found.next();
  if (found.hasNext() || saved.getSize() !== file.size) throw publicError_('File upload chưa xác định được chính xác. Liên hệ quản lý; không tải lại.');
  return saved.getId();
}
function uploadCaseFile(idToken, payload) {
  const actor = tuActor_(idToken, required_(payload && payload.center,'Trung tâm tiếp nhận'));
  const id = tuId_(payload.sessionId), fileId = tuId_(payload.uploadId);
  let record = tuOwned_(actor,id,true);
  if (record.center !== payload.center) throw publicError_('Center của file không khớp phiên upload.');
  let file = record.files.find(function(f){return f.id===fileId;});
  if(!file&&tuActiveUploads_()>=4)throw publicError_('[UPLOAD_BUSY] Đang có nhiều file tải lên. Hệ thống sẽ chờ để giữ tốc độ đọc dữ liệu.');
  const input = tuFileBytes_(payload);
  if (file) {
    if (file.hash !== input.hash || file.size !== input.bytes.length || file.name !== input.name) throw publicError_('Mã upload đã dùng cho một file khác.');
    if (file.status==='READY') return tuPublic_(record);
    const recovered = tuRecoverFile_(record,file);
    if (recovered) return tuLock_(function(){const current=tuOwned_(actor,id,true),item=current.files.find(function(f){return f.id===fileId;});item.fileId=recovered;item.status='READY';tuWrite_(current);return tuPublic_(current);});
    if (Date.now()-file.startedAt<TU_LEASE) throw publicError_('File đang tải hoặc chưa xác định kết quả. Bấm kiểm tra lại, không chọn lại file.');
  }
  record = tuLock_(function(){
    const current = tuOwned_(actor,id,true);
    if(tuActiveUploads_()>=4)throw publicError_('[UPLOAD_BUSY] Đang có nhiều file tải lên. Hệ thống sẽ chờ để giữ tốc độ đọc dữ liệu.');
    const existing = current.files.find(function(f){return f.id===fileId;});
    if (existing && (!file || existing.startedAt !== file.startedAt)) throw publicError_('Một yêu cầu khác đang tải file này.');
    if (!existing && current.files.length>=10) throw publicError_('Mỗi hồ sơ tối đa 10 file.');
    file = {id:fileId,name:input.name,size:input.bytes.length,hash:input.hash,status:'UPLOADING',startedAt:Date.now()};
    if (existing) current.files[current.files.indexOf(existing)]=file;else current.files.push(file);
    tuWrite_(current);return current;
  });
  const saved = DriveApp.getFolderById(record.folderId).createFile(Utilities.newBlob(input.bytes,input.mime,tuStoredName_(file)));
  return tuLock_(function(){
    const current=tuOwned_(actor,id,true),item=current.files.find(function(f){return f.id===fileId;});
    item.fileId=saved.getId();item.status='READY';tuWrite_(current);return tuPublic_(current);
  });
}
function getCaseUploadSession(idToken, sessionId) {
  const actor=authenticate_(idToken),record=tuOwned_(actor,sessionId,false);
  assertCapability_(actor,'createCase');
  // No scans of Drive on the read path. Reconcile only an uncertain upload explicitly on retry.
  return tuPublic_(record);
}
function removeCaseUploadFile(idToken, payload) {
  const actor=tuActor_(idToken,required_(payload && payload.center,'Trung tâm tiếp nhận'));
  const id=tuId_(payload.sessionId),uploadId=tuId_(payload.uploadId);
  const record=tuLock_(function(){const current=tuOwned_(actor,id,true),file=current.files.find(function(f){return f.id===uploadId;});
    if (!file) return current;
    if (!['READY','REMOVING'].includes(file.status)) throw publicError_('File chưa xác định kết quả upload; kiểm tra lại trước khi bỏ.');
    file.status='REMOVING';tuWrite_(current);return current;});
  const file=record.files.find(function(f){return f.id===uploadId;});
  if (!file) return tuPublic_(record);
  const saved=DriveApp.getFileById(file.fileId),parents=saved.getParents();
  if (!saved.isTrashed()) {
    if (!parents.hasNext() || parents.next().getId()!==record.folderId || parents.hasNext()) throw publicError_('File không còn thuộc thư mục upload tạm; không xóa.');
    saved.setTrashed(true);
  }
  return tuLock_(function(){const current=tuOwned_(actor,id,true);current.files=current.files.filter(function(f){return f.id!==uploadId;});tuWrite_(current);return tuPublic_(current);});
}

function tuPrepareCase_(actor, payload, folderName) {
  const id=tuId_(payload.uploadSessionId),ids=payload.uploadIds;
  const record=tuLock_(function(){
    const current=tuOwned_(actor,id,false);
    if (current.center!==payload.intakeCenter) throw publicError_('Center hồ sơ khác center của file upload.');
    if (current.requestId && current.requestId!==payload.requestId) throw publicError_('Phiên file đã gắn với yêu cầu khác.');
    if (!Array.isArray(ids)||!ids.length||ids.length>10||new Set(ids).size!==ids.length||ids.length!==current.files.length||current.files.some(function(f){return f.status!=='READY'||ids.indexOf(f.id)<0;})) throw publicError_('Các file đính kèm chưa tải xong hoặc danh sách file không khớp.');
    if (current.state==='COMMITTED') return current;
    if (!['OPEN','CLAIMED'].includes(current.state)||current.expiresAt<=Date.now()) throw publicError_('Phiên file tạm đã hết hạn 24 giờ.');
    current.state='CLAIMED';current.requestId=payload.requestId;current.leaseUntil=Date.now()+60*60*1000;
    current.targetParent=CASE_EVIDENCE_FOLDERS[current.center];tuWrite_(current);return current;
  });
  const folder=DriveApp.getFolderById(record.folderId),parents=folder.getParents();
  const parentId=parents.hasNext()?parents.next().getId():'';
  if (parents.hasNext()||[TU_FOLDER_ID,record.targetParent].indexOf(parentId)<0) throw publicError_('Thư mục file không ở vị trí được phép.');
  record.files.forEach(function(f){const saved=DriveApp.getFileById(f.fileId),p=saved.getParents();if(!p.hasNext()||p.next().getId()!==record.folderId||p.hasNext()||saved.getSize()!==f.size||saved.isTrashed())throw publicError_('File đã thay đổi hoặc không còn tồn tại.');saved.setName(f.name);});
  folder.setName(folderName);
  if (parentId===TU_FOLDER_ID) folder.moveTo(DriveApp.getFolderById(record.targetParent));
  return folder.getUrl();
}
// Called inside the existing createCase lock after canonical rows have been written.
function tuCommitCase_(actor, payload, caseId) {
  if (!payload.uploadSessionId) return;
  const record=tuOwned_(actor,payload.uploadSessionId,false);
  if(record.requestId!==payload.requestId)throw publicError_('Mã yêu cầu file không khớp hồ sơ.');
  // Canonical case owns the folder now; drop this journal, never the actual files.
  PropertiesService.getScriptProperties().deleteProperty(TU_PREFIX+record.id);
}

function initializeTemporaryUploads() {
  const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  const users=readTable_(SHEETS.users).filter(function(u){return clean_(u['Email Google']).toLowerCase()===email&&bool_(u['Đang hoạt động']);});
  if(users.length!==1||!resolveRole_(users[0]['Vai trò'],users[0]['Trung tâm']).isGlobalManager)throw publicError_('Chỉ quản lý toàn hệ thống được khởi tạo upload.');
  const folder=DriveApp.getFolderById(TU_FOLDER_ID);
  if(folder.isTrashed()||folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw publicError_('Thư mục tạm phải ở chế độ Hạn chế, không chia sẻ public/domain.');
  if([DriveApp.Permission.EDIT,DriveApp.Permission.OWNER,DriveApp.Permission.ORGANIZER].indexOf(folder.getAccess(email))<0)throw publicError_('Tài khoản chạy script chưa có quyền ghi vào thư mục tạm.');
  PropertiesService.getScriptProperties().setProperty('TEMP_UPLOAD_ENABLED','1');
  if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='cleanupTemporaryUploads';}))ScriptApp.newTrigger('cleanupTemporaryUploads').timeBased().everyHours(1).create();
  return {enabled:true,folderName:folder.getName(),folderId:TU_FOLDER_ID,expiresHours:24,maxFiles:10,maxFileMB:8};
}
function cleanupTemporaryUploads() {
  if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
  if (typeof cmsAssertPortalWrites_ === 'function') cmsAssertPortalWrites_();
  const started=Date.now(),props=PropertiesService.getScriptProperties(),all=props.getProperties();
  const expired=Object.keys(all).filter(function(k){return k.indexOf(TU_PREFIX)===0;}).map(function(k){return parseJson_(all[k]);}).filter(function(r){return r&&r.expiresAt<=Date.now()&&(!r.leaseUntil||r.leaseUntil<=Date.now());}).slice(0,10);
  if(!expired.length)return {checked:0,trashed:0};
  // Read canonical evidence once, only in maintenance; never scan Drive for website lists.
  const cases=readTable_(SHEETS.cases),links=new Set(cases.map(function(c){return clean_(c['Liên kết hồ sơ Drive']);}));
  const folderIds=new Set(cases.map(function(c){const m=clean_(c['Liên kết hồ sơ Drive']).match(/\/folders\/([a-zA-Z0-9_-]+)/);return m?m[1]:'';}));
  const requests=new Set(cases.map(function(c){return clean_(c['Mã yêu cầu tạo']);}).filter(Boolean));
  let trashed=0;
  expired.forEach(function(r){
    if(Date.now()-started>240000)return;
    try{
      const claimed=tuLock_(function(){const current=tuRead_(r.id);if(!current||current.expiresAt>Date.now()||(current.leaseUntil||0)>Date.now())return null;
        if(current.files.some(function(f){return f.status==='UPLOADING'&&f.startedAt+TU_LEASE>Date.now();}))return null;
        const folderUrl=current.folderId?'https://drive.google.com/drive/folders/'+current.folderId:'';
        if(current.state==='COMMITTED'||current.caseId||links.has(folderUrl)||folderIds.has(current.folderId)||(current.requestId&&requests.has(current.requestId))){props.deleteProperty(TU_PREFIX+current.id);return null;}
        current.state='CLEANING';tuWrite_(current);return current;});
      if(!claimed)return;
      if(!claimed.folderId){const folders=DriveApp.getFolderById(TU_FOLDER_ID).getFoldersByName('TMP-'+claimed.id);if(!folders.hasNext()){props.deleteProperty(TU_PREFIX+claimed.id);return;}const found=folders.next();if(folders.hasNext())return;claimed.folderId=found.getId();tuWrite_(claimed);}
      const folder=DriveApp.getFolderById(claimed.folderId),p=folder.getParents();
      if(!p.hasNext()||[TU_FOLDER_ID,claimed.targetParent].filter(Boolean).indexOf(p.next().getId())<0||p.hasNext())return;
      if(folder.getFolders().hasNext())return;
      const contents=folder.getFiles();
      while(contents.hasNext()){const file=contents.next();if(!claimed.files.some(function(f){return f.fileId===file.getId()||(tuStoredName_(f)===file.getName()&&f.size===file.getSize());}))return;}
      folder.setTrashed(true);props.deleteProperty(TU_PREFIX+claimed.id);trashed++;
    }catch(error){console.error('TEMP_UPLOAD_CLEANUP '+r.id+': '+String(error));}
  });
  return {checked:expired.length,trashed:trashed};
}
