/** Add evidence to the canonical case folder; never accept a client folder URL. */
function saScope_(token,caseId) {
  const actor=authenticate_(token);assertCapability_(actor,'updateWorkOrder');
  const record=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',[required_(caseId,'Mã hồ sơ')])[0];
  if(!record||clean_(record['Trạng thái hồ sơ'])==='Đã hủy')throw publicError_('Hồ sơ không tồn tại hoặc đã bị hủy.');
  assertCaseEditable_(actor,record);
  const center=clean_(record['Trung tâm đang giữ hàng']);assertCenterAllowed_(actor,center);
  if(!actor.isGlobalManager){
    const works=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',[caseId]);
    if(!works.some(function(w){return actor.centers.indexOf(clean_(w['Trung tâm xử lý']))>=0&&['Đã chuyển hàng đi','Đã đóng công việc'].indexOf(clean_(w['Trạng thái xử lý']))<0;}))throw publicError_('Bạn không có công việc đang xử lý để bổ sung file.');
  }
  const match=clean_(record['Liên kết hồ sơ Drive']).match(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)(?:[?#].*)?$/);
  if(!match)throw publicError_('Hồ sơ chưa có liên kết thư mục Drive hợp lệ.');
  return {actor:actor,record:record,center:center,folderId:match[1]};
}
function saVerifyFolder_(scope) {
  const roots=Object.keys(CASE_EVIDENCE_FOLDERS).map(function(k){return CASE_EVIDENCE_FOLDERS[k];});
  if(roots.indexOf(scope.folderId)>=0||scope.folderId===TU_FOLDER_ID)throw publicError_('Liên kết hồ sơ đang trỏ vào thư mục gốc, không thể bổ sung.');
  const folder=DriveApp.getFolderById(scope.folderId);
  if(folder.isTrashed())throw publicError_('Thư mục hồ sơ đã bị xóa trên Drive.');
  let current=folder;
  for(let depth=0;depth<20;depth++){
    const parents=current.getParents();if(!parents.hasNext())break;
    current=parents.next();if(parents.hasNext())throw publicError_('Thư mục hồ sơ có vị trí không xác định.');
    if(roots.indexOf(current.getId())>=0)return folder;
  }
  throw publicError_('Thư mục hồ sơ không nằm trong vùng lưu trữ của hệ thống.');
}
function saCanSupplement_(actor,record,works) {
  return typeof temporaryUploadsEnabled_==='function'&&temporaryUploadsEnabled_()&&hasCapability_(actor,'updateWorkOrder')&&
    clean_(record['Trạng thái hồ sơ'])!=='Đã hủy'&&(actor.isGlobalManager||clean_(record['Trạng thái hồ sơ'])!=='Đã hoàn tất')&&
    (actor.isGlobalManager||actor.centers.indexOf(clean_(record['Trung tâm đang giữ hàng']))>=0&&works.some(function(w){return actor.centers.indexOf(clean_(w['Trung tâm xử lý']))>=0&&['Đã chuyển hàng đi','Đã đóng công việc'].indexOf(clean_(w['Trạng thái xử lý']))<0;}))&&
    /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+/.test(clean_(record['Liên kết hồ sơ Drive']));
}
function getCaseAttachmentReceipt(token,payload) {
  const scope=saScope_(token,required_(payload&&payload.caseId,'Mã hồ sơ')),id=tuId_(payload.sessionId);
  const row=findTableRowsByField_(SHEETS.audit,'Mã đối tượng',[payload.caseId]).find(function(r){
    if(clean_(r['Email người dùng']).toLowerCase()!==scope.actor.email.toLowerCase())return false;
    try{const data=parseJson_(r['Dữ liệu sau']);return data&&data.attachmentSessionId===id;}catch(_){return false;}
  });
  if(!row)return {found:false};
  const data=parseJson_(row['Dữ liệu sau']);return {found:true,receipt:{ok:true,caseId:payload.caseId,sessionId:id,added:(data.files||[]).length}};
}
function commitCaseAttachments(token,payload) {
  payload=payload||{};
  let scope=saScope_(token,required_(payload.caseId,'Mã hồ sơ'));
  const id=tuId_(payload.sessionId),ids=payload.uploadIds;
  let record=tuOwned_(scope.actor,id,false);
  if(record.supplementalCaseId!==payload.caseId||record.targetFolderId!==scope.folderId||record.center!==scope.center)throw publicError_('Hồ sơ, center hoặc thư mục đã thay đổi. Kiểm tra lại trước khi bổ sung.');
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||record.files.length!==ids.length||record.files.some(function(f){return ids.indexOf(f.id)<0||f.status!=='READY';}))throw publicError_('Danh sách file chưa sẵn sàng hoặc không khớp.');
  if(record.state==='COMMITTED')return record.receipt;
  const target=saVerifyFolder_(scope),lease=Utilities.getUuid();
  record=tuLock_(function(){const r=tuOwned_(scope.actor,id,false);
    if(r.state==='COMMITTED')return r;
    if(r.expiresAt<=Date.now())throw publicError_('Phiên đính kèm đã hết hạn.');
    if(r.state==='ATTACHING'&&r.leaseUntil>Date.now())throw publicError_('File đang được gắn vào hồ sơ. Vui lòng kiểm tra lại sau.');
    if(!['OPEN','ATTACHING'].includes(r.state))throw publicError_('Phiên đính kèm không thể sử dụng.');
    if(r.files.length!==ids.length||r.files.some(function(f){return f.status!=='READY'||ids.indexOf(f.id)<0;}))throw publicError_('Danh sách file đã thay đổi. Kiểm tra lại trước khi lưu.');
    r.state='ATTACHING';r.lease=lease;r.leaseUntil=Date.now()+TU_LEASE;tuWrite_(r);return r;});
  if(record.state==='COMMITTED')return record.receipt;
  try{
    record.files.forEach(function(f){
      scope=saScope_(token,payload.caseId);
      if(scope.center!==record.center||scope.folderId!==record.targetFolderId)throw publicError_('Center hoặc thư mục hồ sơ đã thay đổi khi đang bổ sung.');
      const saved=DriveApp.getFileById(f.fileId),parents=saved.getParents();
      const parent=parents.hasNext()?parents.next().getId():'';
      if(parents.hasNext()||[record.folderId,record.targetFolderId].indexOf(parent)<0||saved.isTrashed()||saved.getSize()!==f.size)throw publicError_('File đã thay đổi hoặc không còn ở vị trí được phép.');
      // fileId stays in the journal. Retrying after move/ack loss adopts the same file.
      saved.setName((TU_CATEGORIES[f.category]?TU_CATEGORIES[f.category]+'--':'')+f.name);
      if(parent!==record.targetFolderId)saved.moveTo(target);
    });
    return withSerializedWrite_('bổ sung đính kèm',function(){
      const current=tuOwned_(scope.actor,id,false);if(current.state==='COMMITTED')return current.receipt;
      if(current.lease!==lease)throw publicError_('Phiên bổ sung đã được xử lý bởi yêu cầu khác.');
      const latest=saScope_(token,payload.caseId);
      if(latest.center!==record.center||latest.folderId!==record.targetFolderId)throw publicError_('Hồ sơ đã thay đổi. File được giữ nguyên, vui lòng kiểm tra lại.');
      syncDashboardProjectionCase_(payload.caseId);syncPortalCaseIndexCase_(payload.caseId);bumpPortalDatabaseRevision_();
      const audited=findTableRowsByField_(SHEETS.audit,'Mã đối tượng',[payload.caseId]).some(function(r){try{const data=parseJson_(r['Dữ liệu sau']);return data&&data.attachmentSessionId===id;}catch(_){return false;}});
      if(!audited){
        const after={attachmentSessionId:id,message:'Bổ sung đính kèm',files:current.files.map(function(f){return {name:f.name,category:f.category,fileId:f.fileId};})};
        // Reuse the existing case_updated audience with the precise attachment title.
        if(typeof notificationMetadata_==='function')after.__notification=notificationMetadata_(latest.actor,'Sửa thông tin hồ sơ','Hồ sơ',payload.caseId,latest.center,latest.record,after);
        audit_(latest.actor,'Bổ sung đính kèm','Hồ sơ',payload.caseId,latest.center,latest.record,after);
      }
      current.state='COMMITTED';current.leaseUntil=0;current.receipt={ok:true,caseId:payload.caseId,sessionId:id,added:current.files.length};tuWrite_(current);
      return current.receipt;
    });
  }catch(error){
    tuLock_(function(){const r=tuRead_(id);if(r&&r.state==='ATTACHING'&&r.lease===lease){r.state='ATTACHING';r.leaseUntil=0;tuWrite_(r);}});
    throw error;
  }
}
