/** Main-project adapter. No OAuth/session token is sent to the storage worker. */
const AS_MODE = 'dedicated-v1';
function asEnabled_() {
  const mode=PropertiesService.getScriptProperties().getProperty('ATTACHMENT_STORAGE_MODE');
  if(mode && mode!==AS_MODE)throw publicError_('Cấu hình kho đính kèm không hợp lệ.');
  return mode===AS_MODE;
}
function asRemote_(record) { return record.storageMode===AS_MODE; }
function asMac_(text,secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text,secret)).replace(/=+$/g,'');
}
function asCall_(action,payload) {
  const props=PropertiesService.getScriptProperties(),url=props.getProperty('ATTACHMENT_STORAGE_URL')||'',secret=props.getProperty('ATTACHMENT_STORAGE_SECRET')||'';
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)||secret.length<43)throw publicError_('Chưa cấu hình dịch vụ đính kèm chuyên dụng.');
  const message={version:1,nonce:Utilities.getUuid(),timestamp:Date.now(),body:JSON.stringify({action:action,payload:payload||{}})};
  const signed=[message.version,message.nonce,message.timestamp,message.body].join('\n');
  message.signature=asMac_(signed,secret);
  let response;
  try{
    const raw=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(message),muteHttpExceptions:true,followRedirects:true});
    if(raw.getResponseCode()!==200)throw Error('HTTP');
    response=JSON.parse(raw.getContentText());
    if(response.nonce!==message.nonce||typeof response.body!=='string'||response.signature!==asMac_(message.nonce+'\n'+response.body,secret))throw Error('Signature');
  }catch(error){throw publicError_('Chưa xác định kết quả lưu file. Kiểm tra lại cùng phiên upload; không chọn lại file.');}
  const result=JSON.parse(response.body);
  if(!result.ok)throw publicError_('Dịch vụ đính kèm: '+String(result.error||'Không xử lý được yêu cầu.'));
  return result.result;
}
function asFolder_(record) {
  const result=asCall_('begin',{sessionId:record.id});
  if(!result||!result.folderId)throw publicError_('Không xác định được thư mục upload.');
  return result.folderId;
}
function asUpload_(record,file,input) {
  if(file.size>32*1024*1024)throw publicError_('Kho đính kèm riêng nhận tối đa 32 MB/file. Vui lòng chia nhỏ file.');
  const result=asCall_('put',{sessionId:record.id,folderId:record.folderId,uploadId:file.id,name:file.name,mime:input.mime,hash:file.hash,size:file.size,base64:Utilities.base64Encode(input.bytes)});
  if(!result||!result.fileId||result.size!==file.size||result.hash!==file.hash)throw publicError_('Biên nhận upload không khớp file.');
  return result.fileId;
}
function asFind_(record,file) {
  const result=asCall_('find',{sessionId:record.id,folderId:record.folderId,uploadId:file.id,name:file.name,hash:file.hash,size:file.size});
  return result.fileId||null;
}
function asFileSpec_(file) { return {fileId:file.fileId,uploadId:file.id,name:file.name,size:file.size,hash:file.hash,finalName:(TU_CATEGORIES[file.category]?TU_CATEGORIES[file.category]+'--':'')+file.name}; }
function asPrepare_(record,name) {
  return asCall_('prepare',{sessionId:record.id,folderId:record.folderId,parentId:record.targetParent,name:name,files:record.files.map(asFileSpec_)}).url;
}
function asSupplement_(record) {
  return asCall_('supplement',{sessionId:record.id,folderId:record.folderId,targetFolderId:record.targetFolderId,files:record.files.map(asFileSpec_)});
}
function asRemove_(record,file) {
  return asCall_('remove',{sessionId:record.id,folderId:record.folderId,file:asFileSpec_(file)});
}
function asCleanup_(record) {
  return asCall_('cleanup',{sessionId:record.id,folderId:record.folderId||'',parentId:record.targetParent||'',files:record.files.map(asFileSpec_)});
}
/** Editor-only read-only check; does not activate the new storage mode. */
function kiemTraKhoDinhKemRieng() {
  const effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase(),active=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  if(!effective||active!==effective)throw Error('Chỉ chạy kiểm tra này từ Apps Script Editor bằng tài khoản thực thi chính.');
  const result=asCall_('probe',{});
  if(result.executor!=='sungrowservicecenter@gmail.com')throw Error('Sai tài khoản thực thi dịch vụ lưu trữ.');
  return {ok:true,enabled:asEnabled_(),storage:result,mainExecutor:Session.getEffectiveUser().getEmail(),mainDeploymentUnchanged:true};
}
