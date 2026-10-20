/* Fan lots: additive source snapshot + immutable operation journal. Legacy groups
 * only link existing case IDs; never rewrite their quantities, warranty or dates.
 * No history tab reads. Mutations require request IDs, CAS and ScriptLock.
 */
var FL_RELEASE_ = 'fan-lots-1';
var FL_SHARED_RECEIPT_GUARD_ = true;
var FL_EVENT_SHEET_ = 'Nhật ký lô Fan';
var FL_GROUP_SHEET_ = 'Nhóm tiếp nhận Fan';
var FL_EVENT_HEADERS_ = ['Mã thao tác','Mã hồ sơ','Mã dòng Fan','Loại thao tác','Số lượng','Ngày thực tế','Kết quả','Nội dung','Người thực hiện','Thời gian'];
var FL_GROUP_HEADERS_ = ['Mã nhóm','Tên nhóm','Danh sách hồ sơ','Dấu đối soát','Người tạo','Ngày tạo'];
function flEnabled_(){return PropertiesService.getScriptProperties().getProperty('FAN_LOTS_ENABLED')==='1';}
function flAssertEnabled_(){if(!flEnabled_())throw publicError_('Chế độ Fan theo lô chưa được bật trên backend.');}
function flIsLot_(row){return clean_(row['Kiểu hồ sơ'])==='Fan theo lô';}
function flState_(row){if(!flIsLot_(row))return null;try{return SungrowFanLotRules.parse(row['Chi tiết lô Fan']);}catch(e){throw publicError_('Hồ sơ lô Fan cần đối soát: '+clean_(row['Mã hồ sơ'])+'. '+e.message);}}
function flModelsReady_(){return typeof SungrowFanLotRules.modelLabel==='function'&&typeof LEGACY_DASHBOARD_API!=='undefined'&&LEGACY_DASHBOARD_API.fanModels===true;}
function flCorrectModels_(row,rows){var state=flState_(row);if(!state||!flModelsReady_())throw publicError_('Cần cập nhật đầy đủ Apps Script 1.11.9.');if(!Array.isArray(rows)||rows.length!==state.lines.length)throw publicError_('Danh sách Model Fan phải giữ đầy đủ các dòng S/N.');var seen={};rows.forEach(function(r){var line=state.lines.find(function(l){return l.lineId===r.lineId;});if(!line||seen[r.lineId])throw publicError_('Dòng S/N không hợp lệ hoặc bị lặp.');seen[r.lineId]=true;var model=SungrowFanLotRules.model(r.fanModel);if(!model)throw publicError_('Nhập Model Fan cho từng S/N.');line.fanModel=model;if(Object.prototype.hasOwnProperty.call(r,'inverterModel'))line.inverterModel=SungrowFanLotRules.model(r.inverterModel);});state.revision++;return {'Chi tiết lô Fan':SungrowFanLotRules.pack(state),'Model':SungrowFanLotRules.modelLabel(state)};}
function flPrepareCreate_(payload){
  if(!payload||payload.fanMode!=='lot')return null;flAssertEnabled_();
  if(payload.fanModelsVersion===1&&!flModelsReady_())throw publicError_('Cần cập nhật đầy đủ Apps Script 1.11.9 trước khi lưu Model Fan theo từng S/N.');
  if(payload.deviceType!=='Fan')throw publicError_('Chế độ lô chỉ dành cho Fan.');
  try{var received=SungrowFanLotRules.day(payload.receivedAt);if(received>Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd'))throw Error('Ngày nhận Fan không được ở tương lai.');}catch(e){throw publicError_(e.message);}
  var state;try{state=SungrowFanLotRules.create(payload.fanLines);}catch(e){throw publicError_(e.message);}
  if((payload.fanModelsVersion===1||state.lines.some(function(l){return !!l.fanModel;}))&&state.lines.some(function(l){return !l.fanModel;}))throw publicError_('Nhập Model/Mã Fan cho từng dòng inverter.');
  if(clean_(payload.serialNumber))throw publicError_('S/N inverter phải nhập trong bảng lô, không nhập vào S/N chính.');
  return state;
}
function flAttachInitialFiles_(actor,payload,state){
  state.files=[];if(!payload.uploadSessionId)return;
  var session=tuOwned_(actor,payload.uploadSessionId,false),scopes=payload.fanFileScopes||{};
  if(session.requestId!==payload.requestId||session.center!==payload.intakeCenter)throw publicError_('Phiên file không khớp yêu cầu lô Fan.');
  session.files.forEach(function(f){var serial=clean_(scopes[f.id]).toUpperCase(),line=serial&&state.lines.find(function(l){return l.serialNumber===serial;});if(serial&&!line)throw publicError_('Phạm vi file không còn trong danh sách S/N.');if(f.status!=='READY'||!f.fileId)throw publicError_('File chưa sẵn sàng.');state.files.push({fileId:f.fileId,name:f.name,serialNumber:serial,lineId:line?line.lineId:'',url:'https://drive.google.com/file/d/'+f.fileId+'/view'});});
  SungrowFanLotRules.pack(state);
}
function flWarrantyLabel_(row){var state=flState_(row);if(!state)return clean_(row['Tình trạng bảo hành']);var statuses=state.lines.map(function(l){return l.warrantyStatus||clean_(row['Tình trạng bảo hành']);});if(statuses.some(function(v){return WARRANTY_STATUSES.indexOf(v)<0;}))return 'Chờ xác nhận';return statuses.every(function(v){return v===statuses[0];})?statuses[0]:'Theo từng S/N';}
function flPublic_(row){var state=flState_(row);if(!state)return null;var statuses=state.lines.map(function(l){return l.warrantyStatus||clean_(row['Tình trạng bảo hành']);});return {state:state,inverterModelCorrection:true,totals:SungrowFanLotRules.totals(state),warrantySummary:flWarrantyLabel_(row),fingerprint:digest_(SungrowFanLotRules.pack(state)),pendingSync:!!PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+row['Mã hồ sơ'])};}
function flWarrantyChanges_(row,status,fingerprint){var state=flState_(row);if(!state)return {};if(PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+row['Mã hồ sơ']))throw publicError_('Đối soát lô trước khi duyệt bảo hành.');if(digest_(SungrowFanLotRules.pack(state))!==fingerprint)throw publicError_('Lô đã thay đổi. Mở lại khung duyệt bảo hành.');state.lines.forEach(function(l){if(l.completed&&(l.warrantyStatus||row['Tình trạng bảo hành'])!==status)throw publicError_('Fan đã xử lý cần đối soát trước khi đổi bảo hành.');l.warrantyStatus=status;});state.revision++;return {'Chi tiết lô Fan':SungrowFanLotRules.pack(state)};}
function flIndexFields_(row){var s=flState_(row);return Object.assign(s?{'Tình trạng bảo hành':flWarrantyLabel_(row)}:{},{'Kiểu hồ sơ':s?'Fan theo lô':clean_(row['Kiểu hồ sơ'])==='Fan nguồn đã nhập lô'?'Fan nguồn đã nhập lô':'','S/N inverter liên quan':s?s.lines.map(function(r){return r.serialNumber;}).filter(Boolean).join('|'):'','Tiến độ Fan':s?JSON.stringify(SungrowFanLotRules.totals(s)):'','Tìm kiếm nguồn Fan':s?s.lines.map(function(l){return (l.fanModel||'')+' '+(l.inverterModel||'');}).join(' ')+' '+(s.legacyImport?s.legacyImport.sources.map(function(r){return r.caseId+' '+r.inverterModel;}).join(' '):''):''});}
function flExactIndexMatch_(row,query){return clean_(row['S/N inverter liên quan']).toLowerCase().split('|').indexOf(query)>=0||(/^hs-/i.test(query)&&clean_(row['Kiểu hồ sơ'])==='Fan theo lô'&&clean_(row['Tìm kiếm']).toLowerCase().split(/\s+/).indexOf(query)>=0);}
function flGroupRefs_(actor,row){
  if(row['Loại thiết bị']!=='Fan'||flIsLot_(row))return [];
  var revision=getPortalDatabaseRevision_(),visible={};readPortalCaseIndex_(revision).forEach(function(r){if(canSeeIndexedCase_(actor,r)&&r['Trạng thái hồ sơ']!=='Đã hủy')visible[r['Mã hồ sơ']]=true;});
  return readTableShared_(FL_GROUP_SHEET_,revision,false).filter(function(g){var ids=parseJson_(g['Danh sách hồ sơ'])||[];return ids.indexOf(row['Mã hồ sơ'])>=0&&ids.every(function(id){return visible[id];});}).map(function(g){return {groupId:g['Mã nhóm'],name:g['Tên nhóm']};});
}
function flAssertOrdinary_(row){if(flIsLot_(row))throw publicError_('Dùng bảng tiến độ Fan để cập nhật/giao trả lô.');}
function flRow_(actor,caseId,capability){
  if(capability)assertCapability_(actor,capability);
  var rows=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',[required_(caseId,'Mã hồ sơ')]),row=rows[0];
  if(!row||clean_(row['Trạng thái hồ sơ'])==='Đã hủy')throw publicError_('Không tìm thấy hồ sơ.');
  var works=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',[caseId]);
  if(!canSeeCase_(actor,row,works))throw publicError_('Bạn không có quyền xem hồ sơ.');
  return {row:row,works:works};
}
function flRequest_(payload){var id=clean_(payload.requestId);if(!/^[a-zA-Z0-9-]{16,100}$/.test(id))throw publicError_('Thiếu mã thao tác chống trùng.');return id;}
function flCell_(v){
  // Sheets serials represent local wall time, not UTC. Production is UTC+7.
  if(v instanceof Date)return {userEnteredValue:{numberValue:(v.getTime()+7*3600000)/86400000+25569},userEnteredFormat:{numberFormat:{type:'DATE_TIME',pattern:'dd/MM/yyyy HH:mm'}}};
  return {userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v==null?'':String(v)}};
}
function flUpdateRequest_(name,row,changes){var sheet=spreadsheet_().getSheetByName(name),headers=tableHeaders_(name),requests=[];Object.keys(changes).forEach(function(k){var c=headers.indexOf(k);if(c<0)throw publicError_('Thiếu cột '+k+'. Chạy chuẩn bị Fan trước.');requests.push({updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:row-1,endRowIndex:row,startColumnIndex:c,endColumnIndex:c+1},rows:[{values:[flCell_(changes[k])]}],fields:'userEnteredValue'+(changes[k] instanceof Date?',userEnteredFormat.numberFormat':'')}});});return requests;}
function flAppendRequest_(name,object){var sheet=spreadsheet_().getSheetByName(name),headers=tableHeaders_(name);if(!sheet)throw publicError_('Chưa chuẩn bị bảng '+name);return {appendCells:{sheetId:sheet.getSheetId(),rows:[{values:headers.map(function(k){return flCell_(object[k]);})}],fields:'userEnteredValue,userEnteredFormat.numberFormat'}};}
function flBatch_(requests){
  SpreadsheetApp.flush();
  var response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+spreadsheet_().getId()+':batchUpdate',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:requests}),muteHttpExceptions:true});
  if(response.getResponseCode()<200||response.getResponseCode()>=300){var code=response.getResponseCode(),error=publicError_('Không ghi được giao dịch Fan. Giữ mã thao tác và tải lại để kiểm tra. HTTP '+code);error.fanNoWrite=code>=400&&code<500&&code!==408;throw error;}
}
function flVerifyPartLedger_(events, suppliedParts) {
  var expected=[];events.forEach(function(e){var d=parseJson_(e['Nội dung'])||{};(d.parts||[]).forEach(function(p){expected.push({part:p,event:e});});});
  if(!expected.length)return;
  var ids=Array.from(new Set(expected.map(function(x){return x.part.partUsageId;}))),rows=suppliedParts||findTableRowsByField_(SHEETS.parts,'Mã sử dụng linh kiện',ids),by={};
  rows.forEach(function(r){var id=clean_(r['Mã sử dụng linh kiện']);if(!by[id])by[id]=[];by[id].push(r);});
  expected.forEach(function(x){var p=x.part,matches=by[p.partUsageId]||[],r=matches[0];if(matches.length!==1||clean_(r['Mã công việc'])!==clean_(x.event.workOrderId||((parseJson_(x.event['Nội dung'])||{}).workOrderId))||clean_(r['Mã linh kiện (Part Number)'])!==p.partNumber||Number(r['Số lượng'])!==Number(p.quantity)||iso_(r['Ngày sử dụng'])!==p.usedAt)throw publicError_('Spare part lệch nguồn hoặc bị ghi trùng: '+p.partUsageId);});
}
function flFinishSync_(caseId){
  if(typeof fwVerifyPending_==='function')fwVerifyPending_(caseId);
  var props=PropertiesService.getScriptProperties();
  var source=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',[caseId])[0],state=source&&flState_(source);
  if(!state||SungrowFanLotRules.totals(state).received!==Number(source['Số lượng']))throw publicError_('Nguồn lô không cân bằng. Chưa bỏ chặn đồng bộ.');
  var evidence=findTableRowsByField_(FL_EVENT_SHEET_,'Mã hồ sơ',[caseId]),totals={};
  evidence.forEach(function(e){var key=e['Mã dòng Fan'];if(!totals[key])totals[key]={done:0,returned:0};if(e['Loại thao tác']==='technical')totals[key].done+=Number(e['Số lượng']);if(e['Loại thao tác']==='return')totals[key].returned+=Number(e['Số lượng']);});
  state.lines.forEach(function(l){var t=totals[l.lineId]||{done:0,returned:0};if(t.done!==l.completed||t.returned!==l.returned)throw publicError_('Tiến độ lô lệch nhật ký. Cần quản lý đối soát.');});
  var pendingId=props.getProperty('FAN_PENDING_'+caseId);if(pendingId)flVerifyPartLedger_(evidence.filter(function(e){return e['Mã thao tác']===pendingId;}));
  var projection=syncDashboardProjectionCase_(caseId),index=syncPortalCaseIndexCase_(caseId);
  bumpPortalDatabaseRevision_();
  if(!projection||!projection.ok||!index||!index.ok)throw publicError_('Đã lưu Fan nhưng chưa đồng bộ đủ dashboard/chỉ mục. Tải lại và bấm đối soát, không tạo thao tác mới.');
  props.deleteProperty('FAN_PENDING_'+caseId);return {ok:true,caseId:caseId};
}
function getFanLotHistory(idToken,payload){
  var actor=authenticate_(idToken);payload=payload||{};var found=flRow_(actor,payload.caseId,'viewCases'),source=found.row;
  if(!actor.isGlobalManager&&actor.centers.indexOf(source['Trung tâm tiếp nhận khách'])<0&&actor.centers.indexOf(source['Trung tâm đang giữ hàng'])<0)throw publicError_('Chỉ center tiếp nhận/đang giữ hàng được xem đầy đủ giao nhận và tài liệu lô.');
  var offset=Math.max(0,Math.floor(Number(payload.offset)||0)),pageSize=30,sheet=spreadsheet_().getSheetByName(FL_EVENT_SHEET_),headers=tableHeaders_(FL_EVENT_SHEET_),column=headers.indexOf('Mã hồ sơ')+1;
  var keys=sheet.getLastRow()>1?sheet.getRange(2,column,sheet.getLastRow()-1,1).getDisplayValues():[],numbers=[];
  keys.forEach(function(r,i){if(clean_(r[0])===payload.caseId)numbers.push(i+2);});numbers.reverse();
  var selected=numbers.slice(offset,offset+pageSize),rows=[];
  if(selected.length)rows=sheet.getRangeList(selected.map(function(n){return 'A'+n+':'+columnLetter_(headers.length)+n;})).getRanges().map(function(range){var values=range.getValues()[0],row={};headers.forEach(function(h,i){row[h]=values[i];});return row;});
  return {events:rows.map(function(r){return {requestId:r['Mã thao tác'],lineId:r['Mã dòng Fan'],kind:r['Loại thao tác'],quantity:r['Số lượng'],date:iso_(r['Ngày thực tế']),outcome:r['Kết quả'],detail:parseJson_(r['Nội dung']),actor:r['Người thực hiện'],at:iso_(r['Thời gian'])};}),total:numbers.length,nextOffset:offset+pageSize<numbers.length?offset+pageSize:null};
}
// All Fan consumption uses the existing work-order parts ledger and shared readers.
function flPartUsageRequests_(work, action, requestId, scope, upperDate) {
  var parts=action.parts===undefined?[]:action.parts,ids=action.partUsageIds===undefined?[]:action.partUsageIds;
  if(!Array.isArray(parts)||!Array.isArray(ids)||parts.length+ids.length>20)throw publicError_('Tối đa 20 dòng linh kiện cho mỗi lần xử lý.');
  var requests=[],entries=[],seen={};
  function entry(part,existing,index){
    var pn=required_(part.partNumber,'Part Number'),name=required_(part.name,'Tên linh kiện'),qty=Number(part.quantity),note=clean_(part.note),date;
    try{date=SungrowFanLotRules.day(part.usedAt||upperDate);}catch(e){throw publicError_(e.message);}
    if(pn.length>100||name.length>500||note.length>2000)throw publicError_('Thông tin linh kiện quá dài.');
    if(!Number.isSafeInteger(qty)||qty<1||qty>100000)throw publicError_('Số lượng linh kiện không hợp lệ.');
    if(date<iso_(work['Ngày trung tâm nhận hàng'])||date>upperDate||(iso_(work['Ngày hoàn tất kỹ thuật'])&&date>iso_(work['Ngày hoàn tất kỹ thuật'])))throw publicError_('Ngày dùng linh kiện phải thuộc công việc và không sau ngày xử lý.');
    var id=existing?part.partUsageId:'FAN-'+requestId+'-P'+(index+1);
    entries.push({partUsageId:id,partNumber:pn,name:name,quantity:qty,usedAt:date,existing:existing});
    if(!existing)requests.push(flAppendRequest_(SHEETS.parts,{'Mã sử dụng linh kiện':id,'Mã công việc':work['Mã công việc'],'Mã linh kiện (Part Number)':pn,'Tên linh kiện':name,'Số lượng':qty,'Ngày sử dụng':parseDateRequired_(date,'Ngày dùng'),'Ghi chú':'Fan '+(scope||'chung lô')+'; '+note}));
  }
  parts.forEach(function(p,i){if(!p||typeof p!=='object'||p.partUsageId)throw publicError_('Dùng danh sách linh kiện đã ghi nhận để liên kết bản ghi cũ.');entry(p,false,i);});
  if(ids.length){var rows=findTableRowsByField_(SHEETS.parts,'Mã sử dụng linh kiện',ids);ids.forEach(function(raw){var id=clean_(raw);if(!id||seen[id])throw publicError_('Linh kiện liên kết bị trùng hoặc thiếu mã.');seen[id]=true;var matches=rows.filter(function(r){return r['Mã sử dụng linh kiện']===id;});if(matches.length!==1||matches[0]['Mã công việc']!==work['Mã công việc'])throw publicError_('Linh kiện đã ghi nhận không thuộc công việc này.');var r=matches[0];if(!iso_(r['Ngày sử dụng']))throw publicError_('Cần đối soát ngày dùng của linh kiện đã ghi nhận.');entry({partUsageId:id,partNumber:r['Mã linh kiện (Part Number)'],name:r['Tên linh kiện'],quantity:r['Số lượng'],usedAt:iso_(r['Ngày sử dụng'])},true,0);});}
  return {requests:requests,entries:entries};
}
function updateFanLot(idToken,payload){
  return withSerializedWrite_('cập nhật lô Fan',function(){
    flAssertEnabled_();payload=payload||{};var actor=authenticate_(idToken),id=flRequest_(payload),found=flRow_(actor,payload.caseId,'updateWorkOrder'),row=found.row,state=flState_(row);
    if(!state)throw publicError_('Hồ sơ không phải lô Fan.');
    assertCaseEditable_(actor,row);assertCenterAllowed_(actor,row['Trung tâm đang giữ hàng']);
    var receipt=findTableRowsByField_(FL_EVENT_SHEET_,'Mã thao tác',[id])[0];
    if(receipt){var oldDetail=parseJson_(receipt['Nội dung'])||{};if(receipt['Mã hồ sơ']!==payload.caseId||receipt['Người thực hiện']!==actor.email||oldDetail.actionDigest!==digest_(JSON.stringify(payload.action||{})))throw publicError_('Mã thao tác đã dùng cho nội dung/tài khoản khác.');return flFinishSync_(payload.caseId);}
    if(PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+payload.caseId))throw publicError_('Hồ sơ cần đồng bộ lại trước khi cập nhật tiếp.');
    if(clean_(payload.expectedFingerprint)!==digest_(SungrowFanLotRules.pack(state)))throw publicError_('Lô đã thay đổi. Tải lại trước khi cập nhật.');
    if(clean_(row['Trạng thái hồ sơ'])==='Đã hoàn tất')throw publicError_('Lô đã giao hết.');
    if(clean_(row['Trạng thái hồ sơ'])==='Đang luân chuyển')throw publicError_('Chờ center nhận hàng xác nhận trước khi cập nhật Fan.');
    var work=found.works.filter(function(w){return clean_(w['Trung tâm xử lý'])===clean_(row['Trung tâm đang giữ hàng']);}).pop();
    if(!work||['Chờ nhận hàng','Đã chuyển hàng đi','Đã đóng công việc'].indexOf(clean_(work['Trạng thái xử lý']))>=0)throw publicError_('Không có công việc đang mở tại center này.');
    var action=payload.action||{},kind=clean_(action.kind),today=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd'),date;
    try{date=SungrowFanLotRules.day(action.date);}catch(e){throw publicError_(e.message);}
    if(date>today||date<iso_(row['Ngày nhận từ khách']))throw publicError_('Ngày thao tác phải từ ngày nhận đến hôm nay.');
    var details={workOrderId:work['Mã công việc'],note:clean_(action.note),actionDigest:digest_(JSON.stringify(action))};if(details.note.length>2000)throw publicError_('Ghi chú tối đa 2.000 ký tự.');
    var requests=[],now=new Date(),changes={'Người cập nhật gần nhất':actor.email,'Ngày cập nhật gần nhất':now},next=state;
    if(kind==='technical'||kind==='return'){
      var received=iso_(row['Ngày nhận từ khách']),workReceived=iso_(work['Ngày trung tâm nhận hàng']);
      if(workReceived&&date<workReceived)throw publicError_('Ngày thao tác trước ngày center nhận hàng.');
      var selectedLine=state.lines.find(function(l){return l.lineId===action.lineId;}),warranty=selectedLine&&(selectedLine.warrantyStatus||clean_(row['Tình trạng bảo hành']));
      try{next=SungrowFanLotRules.apply(state,action,{receivedAt:received,today:today,warrantyApproved:WARRANTY_STATUSES.indexOf(warranty)>=0});}catch(e){throw publicError_(e.message);}
      // A dated return cannot consume a technical completion that happened later.
      var history=findTableRowsByField_(FL_EVENT_SHEET_,'Mã hồ sơ',[payload.caseId]);
      var lastDate=history.filter(function(e){return e['Mã dòng Fan']===action.lineId&&['technical','return'].indexOf(e['Loại thao tác'])>=0;}).reduce(function(s,e){var d=iso_(e['Ngày thực tế']);return d>s?d:s;},'');
      if(lastDate&&date<lastDate)throw publicError_('Ngày thao tác không được trước lần xử lý/giao trả gần nhất của dòng này.');
      var totals=SungrowFanLotRules.totals(next);
      if(kind==='return'){
        assertCapability_(actor,'returnToCustomer');assertCenterAllowed_(actor,row['Trung tâm tiếp nhận khách']);
        if(row['Trung tâm đang giữ hàng']!==row['Trung tâm tiếp nhận khách'])throw publicError_('Chuyển lô về center tiếp nhận trước khi trả khách.');
        ['returnCustomer','returnAddress','returnPhone','returnCarrier','returnTrackingCode'].forEach(function(k){details[k]=required_(action[k],k);if(details[k].length>500)throw publicError_('Thông tin giao nhận quá dài.');});
        changes['Tên người gửi hàng']=details.returnCustomer;changes['Địa chỉ gửi hàng']=details.returnAddress;changes['Số điện thoại gửi hàng']=details.returnPhone;changes['Đơn vị vận chuyển']=details.returnCarrier;changes['Mã vận đơn']=details.returnTrackingCode;
        if(totals.returned===totals.received){changes['Trạng thái hồ sơ']='Đã hoàn tất';changes['Ngày trả khách']=parseDateRequired_(date,'Ngày trả khách');}
      }
      if(!changes['Trạng thái hồ sơ'])changes['Trạng thái hồ sơ']=totals.waiting>0&&row['Trung tâm đang giữ hàng']===row['Trung tâm tiếp nhận khách']?'Sẵn sàng trả khách':'Đang xử lý';
      if(totals.waiting>0&&!row['Ngày sẵn sàng trả khách']&&row['Trung tâm đang giữ hàng']===row['Trung tâm tiếp nhận khách'])changes['Ngày sẵn sàng trả khách']=parseDateRequired_(date,'Ngày sẵn sàng trả');
      if(totals.waiting===0)changes['Ngày sẵn sàng trả khách']='';
      if(totals.completed===totals.received&&kind==='technical'){
        var outcomes=history.filter(function(e){return e['Loại thao tác']==='technical';}).map(function(e){return clean_(e['Kết quả']);}).concat([action.outcome]);
        var sameOutcome=outcomes.every(function(o){return o===outcomes[0];});
        var allTechnicalDates=history.filter(function(e){return e['Loại thao tác']==='technical';}).map(function(e){return iso_(e['Ngày thực tế']);}).concat([date]).sort();
        requests=requests.concat(flUpdateRequest_(SHEETS.workOrders,work.__rowNumber,{'Trạng thái xử lý':'Hoàn tất kỹ thuật','Ngày hoàn tất kỹ thuật':parseDateRequired_(allTechnicalDates.pop(),'Ngày hoàn tất'),'Kết quả xử lý':sameOutcome?outcomes[0]:'','Ghi chú nội bộ':[clean_(work['Ghi chú nội bộ']),'Kết quả từng phần: xem lịch sử lô Fan.'].filter(Boolean).join('\n'),'Người cập nhật':actor.email,'Ngày cập nhật':now}));
      }
      if(kind==='technical'){
        var usage=flPartUsageRequests_(work,action,id,action.lineId,date);
        if(action.outcome==='Đổi thiết bị'&&!usage.entries.length)throw publicError_('Đổi Fan cần ghi nhận spare part hoặc chọn linh kiện đã ghi nhận.');
        requests=requests.concat(usage.requests);details.parts=usage.entries;
      }
    }else if(kind==='part'){
      if(date<iso_(work['Ngày trung tâm nhận hàng'])||date>today||(iso_(work['Ngày hoàn tất kỹ thuật'])&&date>iso_(work['Ngày hoàn tất kỹ thuật'])))throw publicError_('Ngày dùng linh kiện không hợp lệ.');
      var lineId=clean_(action.lineId);if(lineId&&!state.lines.some(function(l){return l.lineId===lineId;}))throw publicError_('Phạm vi S/N không hợp lệ.');
      var partScope=state.lines.filter(function(l){return !lineId||l.lineId===lineId;});if(!partScope.every(function(l){return WARRANTY_STATUSES.indexOf(l.warrantyStatus||clean_(row['Tình trạng bảo hành']))>=0;}))throw publicError_('Cần duyệt bảo hành của phạm vi sử dụng linh kiện.');
      var usage=flPartUsageRequests_(work,{parts:[{partNumber:action.partNumber,name:action.name,quantity:action.quantity,usedAt:date,note:details.note}]},id,lineId,date);
      requests=requests.concat(usage.requests);details.parts=usage.entries;details.partNumber=usage.entries[0].partNumber;details.name=usage.entries[0].name;details.scope=lineId||'lot';details.partUsageId=usage.entries[0].partUsageId;
      next=SungrowFanLotRules.parse(state);next.revision++;
    }else if(kind==='info'){
      if(date>today||date<iso_(work['Ngày trung tâm nhận hàng'])||(iso_(work['Ngày hoàn tất kỹ thuật'])&&date>iso_(work['Ngày hoàn tất kỹ thuật'])))throw publicError_('Ngày chẩn đoán không hợp lệ.');
      ['gsp','ma'].forEach(function(k){if(clean_(action[k]).length>100)throw publicError_('GSP/MA tối đa 100 ký tự.');changes[k.toUpperCase()]=clean_(action[k]);});
      requests=requests.concat(flUpdateRequest_(SHEETS.workOrders,work.__rowNumber,{'Ngày hoàn tất chẩn đoán':parseDateRequired_(date,'Ngày chẩn đoán'),'Ghi chú nội bộ':details.note,'Người cập nhật':actor.email,'Ngày cập nhật':now}));next=SungrowFanLotRules.parse(state);next.revision++;
    }else if(kind==='issue'){
      var issueLine=state.lines.find(function(l){return l.lineId===action.lineId;}),issueQty=Number(action.quantity);if(!issueLine||!Number.isSafeInteger(issueQty)||issueQty<1||issueQty>issueLine.quantity)throw publicError_('Chọn dòng S/N và số Fan có lỗi hợp lệ.');
      if(date>today||date<iso_(work['Ngày trung tâm nhận hàng']))throw publicError_('Ngày xác nhận lỗi không hợp lệ.');
      details.name=required_(action.name,'Tên lỗi');details.code=clean_(action.code);if(details.name.length>500||details.code.length>100)throw publicError_('Thông tin lỗi quá dài.');
      requests.push(flAppendRequest_(SHEETS.issues,{'Mã ghi nhận lỗi':'FAN-'+id,'Mã công việc':work['Mã công việc'],'Loại ghi nhận':'Lỗi xác nhận','Mã lỗi':details.code,'Tên lỗi':details.name,'Ngày xác nhận lỗi':parseDateRequired_(date,'Ngày xác nhận lỗi'),'Ghi chú lỗi':details.note,'Mã dòng Fan':issueLine.lineId,'Số Fan xác nhận':issueQty}));next=SungrowFanLotRules.parse(state);next.revision++;
    }else if(kind==='hold'){
      var start=clean_(action.startAt),end=clean_(action.endAt);try{SungrowFanLotRules.day(start);if(end)SungrowFanLotRules.day(end);}catch(e){throw publicError_(e.message);}
      if(start<iso_(work['Ngày trung tâm nhận hàng'])||start>today||(end&&(end<start||end>today)))throw publicError_('Khoảng tạm dừng SLA không hợp lệ.');
      details.reason=required_(action.reason,'Lý do tạm dừng');details.startAt=start;details.endAt=end;details.holdId=clean_(action.holdId)||'FAN-'+id;
      if(details.holdId!=='FAN-'+id){var hold=findTableRowsByField_(SHEETS.holds,'Mã tạm dừng',[details.holdId])[0];if(!hold||hold['Mã công việc']!==work['Mã công việc'])throw publicError_('Không tìm thấy tạm dừng của công việc.');requests=requests.concat(flUpdateRequest_(SHEETS.holds,hold.__rowNumber,{'Ngày bắt đầu':parseDateRequired_(start,'Bắt đầu'),'Ngày kết thúc':end?parseDateRequired_(end,'Kết thúc'):'','Lý do tạm dừng':details.reason,'Ghi chú/Xác nhận':details.note}));}
      else requests.push(flAppendRequest_(SHEETS.holds,{'Mã tạm dừng':details.holdId,'Mã công việc':work['Mã công việc'],'Ngày bắt đầu':parseDateRequired_(start,'Bắt đầu'),'Ngày kết thúc':end?parseDateRequired_(end,'Kết thúc'):'','Lý do tạm dừng':details.reason,'Người cập nhật':actor.email,'Ghi chú/Xác nhận':details.note}));next=SungrowFanLotRules.parse(state);next.revision++;
    }else if(kind==='warranty'){
      if(!canApproveWarranty_(actor))throw publicError_('Không có quyền duyệt bảo hành.');
      next=SungrowFanLotRules.parse(state);var warrantyLine=next.lines.find(function(l){return l.lineId===action.lineId;});
      if(!warrantyLine||WARRANTY_STATUSES.indexOf(action.warrantyStatus)<0)throw publicError_('Chọn dòng S/N và kết luận bảo hành hợp lệ.');
      if(warrantyLine.completed||warrantyLine.returned)throw publicError_('Dòng đã xử lý cần quản lý đối soát trước khi đổi bảo hành.');
      if(warrantyLine.warrantyStatus&&warrantyLine.warrantyStatus!==action.warrantyStatus&&!details.note)throw publicError_('Cần ghi chú khi đổi kết luận bảo hành.');
      warrantyLine.warrantyStatus=action.warrantyStatus;details.warrantyStatus=action.warrantyStatus;next.revision++;
    }else if(kind==='attachment'){
      var scope=clean_(action.lineId);if(scope&&!state.lines.some(function(l){return l.lineId===scope;}))throw publicError_('Phạm vi file không hợp lệ.');
      var link=safeDriveLink_(action.url);if(!link)throw publicError_('Chỉ liên kết file Google Drive.');
      // References must belong to this case folder; do not grant cross-case file access.
      var folderId=(clean_(row['Liên kết hồ sơ Drive']).match(/folders\/([a-zA-Z0-9_-]+)/)||[])[1],fileId=(link.match(/\/d\/([a-zA-Z0-9_-]+)/)||link.match(/[?&]id=([a-zA-Z0-9_-]+)/)||[])[1];
      if(!folderId||!fileId)throw publicError_('Chọn file đã tải vào thư mục hồ sơ này.');
      var parents=DriveApp.getFileById(fileId).getParents(),belongs=false;while(parents.hasNext())if(parents.next().getId()===folderId)belongs=true;
      if(!belongs)throw publicError_('File không thuộc thư mục hồ sơ.');
      details.url=link;details.name=clean_(action.name)||'Tài liệu';if(details.name.length>500)throw publicError_('Tên file quá dài.');details.scope=scope||'lot';next=SungrowFanLotRules.parse(state);next.revision++;
    }else throw publicError_('Thao tác Fan không hợp lệ.');
    changes['Chi tiết lô Fan']=SungrowFanLotRules.pack(next);
    requests=requests.concat(flUpdateRequest_(SHEETS.cases,row.__rowNumber,changes));
    requests.push(flAppendRequest_(FL_EVENT_SHEET_,{'Mã thao tác':id,'Mã hồ sơ':payload.caseId,'Mã dòng Fan':clean_(action.lineId),'Loại thao tác':kind,'Số lượng':Number(action.quantity)||0,'Ngày thực tế':parseDateRequired_(date,'Ngày thao tác'),'Kết quả':clean_(action.outcome),'Nội dung':JSON.stringify(details),'Người thực hiện':actor.email,'Thời gian':now}));
    PropertiesService.getScriptProperties().setProperty('FAN_PENDING_'+payload.caseId,id);
    try{flBatch_(requests);}catch(error){if(error.fanNoWrite)PropertiesService.getScriptProperties().deleteProperty('FAN_PENDING_'+payload.caseId);throw error;}return flFinishSync_(payload.caseId);
  });
}
function reconcileFanLot(idToken,payload){return withSerializedWrite_('đối soát lô Fan',function(){var actor=authenticate_(idToken),found=flRow_(actor,payload.caseId,'updateWorkOrder');assertCenterAllowed_(actor,found.row['Trung tâm đang giữ hàng']);var state=flState_(found.row);if(!state||SungrowFanLotRules.totals(state).received!==Number(found.row['Số lượng']))throw publicError_('Tổng Fan không cân bằng với hồ sơ nguồn.');return flFinishSync_(payload.caseId);});}
function flGroupPreview_(actor,payload){
  var ids=payload.caseIds;if(!Array.isArray(ids)||ids.length<2||ids.length>120||new Set(ids).size!==ids.length)throw publicError_('Chọn từ 2 đến 120 hồ sơ Fan khác nhau.');
  var selected=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',ids),works=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',ids);
  if(selected.length!==ids.length)throw publicError_('Có hồ sơ không còn tồn tại.');
  var identity=null,rows=selected.map(function(r){
    if(!canSeeCase_(actor,r,works.filter(function(w){return w['Mã hồ sơ']===r['Mã hồ sơ'];})))throw publicError_('Không có quyền xem tất cả hồ sơ đã chọn.');
    assertCenterAllowed_(actor,r['Trung tâm tiếp nhận khách']);
    if(clean_(r['Loại thiết bị'])!=='Fan'||flIsLot_(r)||clean_(r['Trạng thái hồ sơ'])==='Đã hủy')throw publicError_('Chỉ nhóm hồ sơ Fan thường còn hiệu lực.');
    var key=[clean_(r['Tên khách hàng']).normalize('NFC').toLowerCase(),clean_(r['Trung tâm tiếp nhận khách']),iso_(r['Ngày nhận từ khách'])].join('|');
    if(!clean_(r['Tên khách hàng'])||!iso_(r['Ngày nhận từ khách']))throw publicError_('Hồ sơ thiếu khách hàng/ngày nhận.');
    if(identity&&identity!==key)throw publicError_('Chỉ nhóm cùng khách hàng, center tiếp nhận và ngày nhận.');identity=key;
    var qty=Number(r['Số lượng']);if(!Number.isSafeInteger(qty)||qty<1)throw publicError_('Cần xác nhận số Fan của '+r['Mã hồ sơ']);
    return {caseId:r['Mã hồ sơ'],serialNumber:clean_(r['Số sê-ri (S/N)']),quantity:qty,model:clean_(r.Model),warrantyStatus:clean_(r['Tình trạng bảo hành']),status:clean_(r['Trạng thái hồ sơ'])};
  }).sort(function(a,b){return a.caseId.localeCompare(b.caseId);});
  var existing=readTable_(FL_GROUP_SHEET_);existing.forEach(function(g){var linked=parseJson_(g['Danh sách hồ sơ'])||[];if(linked.some(function(id){return ids.indexOf(id)>=0;}))throw publicError_('Một hồ sơ đã thuộc nhóm '+g['Mã nhóm']);});
  return {caseIds:rows.map(function(r){return r.caseId;}),rows:rows,lines:SungrowFanLotRules.group(rows),totalFans:rows.reduce(function(n,r){return n+r.quantity;},0),fingerprint:digest_(JSON.stringify(selected.slice().sort(function(a,b){return clean_(a['Mã hồ sơ']).localeCompare(clean_(b['Mã hồ sơ']));}))),revision:getPortalDatabaseRevision_()};
}
function previewFanGroup(idToken,payload){flAssertEnabled_();var actor=authenticate_(idToken);assertCapability_(actor,'createCase');return flGroupPreview_(actor,payload||{});}
function createFanGroup(idToken,payload){return withSerializedWrite_('gom hồ sơ Fan',function(){flAssertEnabled_();var actor=authenticate_(idToken);assertCapability_(actor,'createCase');payload=payload||{};var id=flRequest_(payload),existing=findTableRowsByField_(FL_GROUP_SHEET_,'Mã nhóm',[id])[0];if(existing){if(existing['Người tạo']!==actor.email||existing['Tên nhóm']!==clean_(payload.name)||JSON.stringify((parseJson_(existing['Danh sách hồ sơ'])||[]).slice().sort())!==JSON.stringify((payload.caseIds||[]).slice().sort()))throw publicError_('Mã nhóm đã dùng cho nội dung/tài khoản khác.');return {groupId:id,replayed:true};}var preview=flGroupPreview_(actor,payload);if(preview.fingerprint!==payload.expectedFingerprint||preview.revision!==payload.expectedRevision)throw publicError_('Dữ liệu đã thay đổi. Xem đối soát lại trước khi gom.');var name=required_(payload.name,'Tên nhóm');if(name.length>200)throw publicError_('Tên nhóm quá dài.');flBatch_([flAppendRequest_(FL_GROUP_SHEET_,{'Mã nhóm':id,'Tên nhóm':name,'Danh sách hồ sơ':JSON.stringify(preview.caseIds),'Dấu đối soát':preview.fingerprint,'Người tạo':actor.email,'Ngày tạo':new Date()})]);bumpPortalDatabaseRevision_();return {groupId:id,totalFans:preview.totalFans,sourceCases:preview.rows.length};});}
function listFanGroups(idToken,payload){var actor=authenticate_(idToken);assertCapability_(actor,'viewCases');var rev=getPortalDatabaseRevision_(),index=readPortalCaseIndex_(rev),visible={};index.forEach(function(r){if(clean_(r['Trạng thái hồ sơ'])!=='Đã hủy'&&canSeeIndexedCase_(actor,r))visible[r['Mã hồ sơ']]=true;});var rows=readTableShared_(FL_GROUP_SHEET_,rev,false).filter(function(g){var ids=parseJson_(g['Danh sách hồ sơ'])||[];return clean_(g['Hồ sơ lô Fan'])?!!visible[g['Hồ sơ lô Fan']]:ids.length&&ids.every(function(id){return visible[id];});});var page=Math.max(1,Math.floor(Number(payload&&payload.page)||1)),start=(page-1)*20;return {items:rows.slice().reverse().slice(start,start+20).map(function(g){return {groupId:g['Mã nhóm'],name:g['Tên nhóm'],lotCaseId:clean_(g['Hồ sơ lô Fan']),caseIds:parseJson_(g['Danh sách hồ sơ'])};}),total:rows.length,page:page};}
function getFanGroup(idToken,payload){var actor=authenticate_(idToken);assertCapability_(actor,'viewCases');var g=findTableRowsByField_(FL_GROUP_SHEET_,'Mã nhóm',[payload.groupId])[0];if(!g)throw publicError_('Không tìm thấy nhóm.');if(clean_(g['Hồ sơ lô Fan'])){getCaseDetailForActor_(actor,g['Hồ sơ lô Fan']);return {groupId:g['Mã nhóm'],name:g['Tên nhóm'],lotCaseId:g['Hồ sơ lô Fan']};}var ids=parseJson_(g['Danh sách hồ sơ'])||[],selected=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',ids),works=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',ids);if(selected.length!==ids.length)throw publicError_('Nhóm thiếu hồ sơ nguồn.');selected.forEach(function(r){if(!canSeeCase_(actor,r,works.filter(function(w){return w['Mã hồ sơ']===r['Mã hồ sơ'];})))throw publicError_('Không có quyền xem nhóm.');});var rows=selected.map(function(r){return {caseId:r['Mã hồ sơ'],serialNumber:r['Số sê-ri (S/N)'],quantity:Number(r['Số lượng']),status:r['Trạng thái hồ sơ'],warrantyStatus:r['Tình trạng bảo hành'],cancelled:r['Trạng thái hồ sơ']==='Đã hủy'};});return {groupId:g['Mã nhóm'],name:g['Tên nhóm'],rows:rows,lines:SungrowFanLotRules.group(rows.filter(function(r){return !r.cancelled;}))};}
function flEnsureTable_(name,headers){var ss=spreadsheet_(),sheet=ss.getSheetByName(name);if(!sheet){sheet=ss.insertSheet(name);if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);}else{var actual=tableHeaders_(name);headers.forEach(function(h,i){if(actual[i]!==h)throw Error('Cấu trúc '+name+' không đúng. Dừng chuẩn bị.');});}}
// Editor-only setup. Does not enable the feature or rewrite historical records.
function flSourceFingerprint_(){return digest_(JSON.stringify(readTable_(SHEETS.cases).map(function(r){var copy={};Object.keys(r).sort().forEach(function(k){if(['Kiểu hồ sơ','Chi tiết lô Fan'].indexOf(k)<0)copy[k]=r[k];});return copy;})));}
function chuanBiFanTheoLo(){return withSerializedWrite_('chuẩn bị Fan',function(){
  portalReadDiagnosticActor_();if(flEnabled_())throw Error('Tắt tạo lô trước khi chuẩn bị lại.');
  if(['Asia/Saigon','Asia/Ho_Chi_Minh','Asia/Bangkok'].indexOf(spreadsheet_().getSpreadsheetTimeZone())<0)throw Error('Database phải dùng múi giờ Việt Nam UTC+7.');
  var check=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+DATABASE_SPREADSHEET_ID+'?fields=spreadsheetId',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(check.getResponseCode()!==200)throw Error('Chưa truy cập được Google Sheets API. Bật Google Sheets API trước khi chuẩn bị. HTTP '+check.getResponseCode());
  var before=flSourceFingerprint_(),backup=DriveApp.getFileById(DATABASE_SPREADSHEET_ID).makeCopy('Backup truoc Fan '+Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyyMMdd-HHmmss'));
  var props=PropertiesService.getScriptProperties();props.setProperty('FAN_BACKUP_ID',backup.getId());
  ensureSheetColumns_(SHEETS.cases,['Kiểu hồ sơ','Chi tiết lô Fan']);ensureSheetColumns_(SHEETS.issues,['Mã dòng Fan','Số Fan xác nhận']);
  flEnsureTable_(FL_EVENT_SHEET_,FL_EVENT_HEADERS_);flEnsureTable_(FL_GROUP_SHEET_,FL_GROUP_HEADERS_);ensureSheetColumns_(SHEETS.caseIndex,['Kiểu hồ sơ','S/N inverter liên quan','Tiến độ Fan']);
  if(before!==flSourceFingerprint_())throw Error('Nguồn hồ sơ thay đổi ngoài phần bổ sung schema. Chưa cho bật Fan.');
  props.setProperty('FAN_SCHEMA_RELEASE',FL_RELEASE_);bumpPortalDatabaseRevision_();
  var result={backupId:backup.getId(),sourceUnchanged:true,enabled:false,audit:doiSoatFanTheoLo()};console.log(JSON.stringify(result));return result;
});}
function doiSoatFanTheoLo(){
  portalReadDiagnosticActor_();var startRevision=getPortalDatabaseRevision_();
  var cases=readTable_(SHEETS.cases),index=readTable_(SHEETS.caseIndex),events=readTable_(FL_EVENT_SHEET_),by={},errors=[],fanCount=0,lotCount=0,physical=0,seenEvents={};index.forEach(function(r){if(by[r['Mã hồ sơ']])errors.push(r['Mã hồ sơ']+': trùng chỉ mục');by[r['Mã hồ sơ']]=r;});
  var eventTotals={};events.forEach(function(e){var id=e['Mã thao tác'];if(seenEvents[id])errors.push('Trùng mã thao tác Fan');seenEvents[id]=true;var key=e['Mã hồ sơ']+'|'+e['Mã dòng Fan'];if(!eventTotals[key])eventTotals[key]={completed:0,returned:0};if(e['Loại thao tác']==='technical')eventTotals[key].completed+=Number(e['Số lượng']);if(e['Loại thao tác']==='return')eventTotals[key].returned+=Number(e['Số lượng']);});
  cases.forEach(function(r){if(clean_(r['Loại thiết bị'])!=='Fan'||r['Trạng thái hồ sơ']==='Đã hủy')return;fanCount++;if(!flIsLot_(r))return;lotCount++;try{var state=flState_(r),totals=SungrowFanLotRules.totals(state);physical+=totals.received;if(totals.received!==Number(r['Số lượng']))errors.push(r['Mã hồ sơ']+': lệch tổng Fan');var ix=by[r['Mã hồ sơ']];if(!ix||ix['S/N inverter liên quan']!==flIndexFields_(r)['S/N inverter liên quan']||ix['Tiến độ Fan']!==JSON.stringify(totals)||Number(ix['Số lượng'])!==totals.received)errors.push(r['Mã hồ sơ']+': lệch chỉ mục S/N/tiến độ');state.lines.forEach(function(l){var t=eventTotals[r['Mã hồ sơ']+'|'+l.lineId]||{completed:0,returned:0};if(t.completed!==l.completed||t.returned!==l.returned)errors.push(r['Mã hồ sơ']+'/'+l.lineId+': tiến độ lệch nhật ký');});if(totals.returned===totals.received&&(!r['Ngày trả khách']||r['Trạng thái hồ sơ']!=='Đã hoàn tất'))errors.push(r['Mã hồ sơ']+': thiếu đóng lô/ngày trả cuối');}catch(e){errors.push(r['Mã hồ sơ']+': '+e.message);}});
  try{flVerifyPartLedger_(events,readTable_(SHEETS.parts));}catch(e){errors.push(e.message);}
  var pending=Object.keys(PropertiesService.getScriptProperties().getProperties()).filter(function(k){return k.indexOf('FAN_PENDING_')===0;});
  if(startRevision!==getPortalDatabaseRevision_())errors.push('Dữ liệu thay đổi trong lúc đối soát. Chạy lại.');
  var report={release:FL_RELEASE_,revision:getPortalDatabaseRevision_(),sourceCases:cases.length,fanCases:fanCount,lotCases:lotCount,lotFanQuantity:physical,pending:pending,errors:errors,ok:!errors.length&&!pending.length};
  PropertiesService.getScriptProperties().setProperty('FAN_LAST_AUDIT',JSON.stringify(report));console.log(JSON.stringify(report));return report;
}
function batFanTheoLo(){return withSerializedWrite_('bật Fan',function(){portalReadDiagnosticActor_();var p=PropertiesService.getScriptProperties();if(!p.getProperty('FAN_BACKUP_ID')||p.getProperty('FAN_SCHEMA_RELEASE')!==FL_RELEASE_)throw Error('Chạy chuanBiFanTheoLo trước.');var audit=doiSoatFanTheoLo();if(!audit.ok)throw Error('Đối soát chưa đạt.');p.setProperty('FAN_LOTS_ENABLED','1');return {enabled:true,audit:audit};});}
function tatFanTheoLo(){portalReadDiagnosticActor_();PropertiesService.getScriptProperties().setProperty('FAN_LOTS_ENABLED','0');return {enabled:false,note:'Giữ nguyên dữ liệu; không khôi phục đè backup.'};}

// Editor-only candidate grouping. Persist only a fingerprint of the preview;
// applying re-reads the source under the write lock and rejects any drift.
function flLegacyGroupPlan_(){
  var existing=readTable_(FL_GROUP_SHEET_),linked={};existing.forEach(function(g){(parseJson_(g['Danh sách hồ sơ'])||[]).forEach(function(id){linked[id]=true;});});
  var groups={},rows=readTable_(SHEETS.cases);
  rows.forEach(function(r){
    if(r['Loại thiết bị']!=='Fan'||flIsLot_(r)||r['Trạng thái hồ sơ']==='Đã hủy'||linked[r['Mã hồ sơ']]||clean_(r['Nguồn dữ liệu'])!=='Quy trình mới')return;
    var name=clean_(r['Tên khách hàng']),date=iso_(r['Ngày nhận từ khách']),center=clean_(r['Trung tâm tiếp nhận khách']);
    if(!name||!date||!center||!Number.isSafeInteger(Number(r['Số lượng']))||Number(r['Số lượng'])<1)return;
    var key=[name.normalize('NFC').toLowerCase(),date,center].join('|');if(!groups[key])groups[key]={name:name+' · '+date,rows:[]};groups[key].rows.push(r);
  });
  var candidates=Object.keys(groups).sort().filter(function(k){return groups[k].rows.length>1&&groups[k].rows.length<=120;}).map(function(k){var g=groups[k],source=g.rows.slice().sort(function(a,b){return clean_(a['Mã hồ sơ']).localeCompare(clean_(b['Mã hồ sơ']));}),publicRows=source.map(function(r){return {caseId:r['Mã hồ sơ'],serialNumber:r['Số sê-ri (S/N)'],quantity:Number(r['Số lượng'])};});return {groupId:'FG-'+digest_(k).slice(0,32),name:g.name,caseIds:publicRows.map(function(r){return r.caseId;}),fans:publicRows.reduce(function(n,r){return n+r.quantity;},0),serials:SungrowFanLotRules.group(publicRows).length,fingerprint:digest_(JSON.stringify(source))};});
  if(candidates.length>100)throw Error('Có hơn 100 nhóm; dùng chọn nhóm trên giao diện để chia đợt.');return candidates;
}
function xemTruocNhomFanCu(){
  portalReadDiagnosticActor_();var plan=flLegacyGroupPlan_(),fingerprint=digest_(JSON.stringify(plan));
  PropertiesService.getScriptProperties().setProperty('FAN_GROUP_PREVIEW',JSON.stringify({fingerprint:fingerprint,at:Date.now()}));
  var output={writtenToDatabase:false,fingerprint:fingerprint,groups:plan.map(function(g){return {groupId:g.groupId,name:g.name,sourceCases:g.caseIds.length,serials:g.serials,fans:g.fans};})};console.log(JSON.stringify(output));return output;
}
function apDungNhomFanCu(){return withSerializedWrite_('gom Fan đã có',function(){
  var actor=portalReadDiagnosticActor_(),props=PropertiesService.getScriptProperties(),preview=parseJson_(props.getProperty('FAN_GROUP_PREVIEW')),plan=flLegacyGroupPlan_();
  if(!props.getProperty('FAN_BACKUP_ID'))throw Error('Chạy chuanBiFanTheoLo trước.');
  if(!preview||Date.now()-preview.at>1800000||preview.fingerprint!==digest_(JSON.stringify(plan)))throw Error('Xem trước đã cũ hoặc nguồn thay đổi. Chạy xemTruocNhomFanCu lại.');
  if(!plan.length)return {ok:true,createdGroups:0};
  var before=digest_(JSON.stringify(readTable_(SHEETS.cases)));
  flBatch_(plan.map(function(g){return flAppendRequest_(FL_GROUP_SHEET_,{'Mã nhóm':g.groupId,'Tên nhóm':g.name,'Danh sách hồ sơ':JSON.stringify(g.caseIds),'Dấu đối soát':g.fingerprint,'Người tạo':actor.email,'Ngày tạo':new Date()});}));
  bumpPortalDatabaseRevision_();var after=digest_(JSON.stringify(readTable_(SHEETS.cases)));
  if(before!==after)throw Error('Nguồn thay đổi trong lúc gom nhóm; kiểm tra đối soát trước thao tác tiếp theo.');
  props.deleteProperty('FAN_GROUP_PREVIEW');return {ok:true,createdGroups:plan.length,sourceUnchanged:true,kpiUnchanged:true};
});}

function flLegacyGroupReaderReady_(){return true;}

// Self-check only; no Sheets, Drive, migration or business writes.
function kiemTraFanNhieuModel(){if(!flModelsReady_())throw Error('Cập nhật đủ Code.gs, LegacyDashboardApi.gs, FanLots.gs và FanLotRules.gs bản1.11.9.');var s=SungrowFanLotRules.create([{serialNumber:'SN-MAU-A',fanModel:'FAN-A',inverterModel:'SG110CX',quantity:2},{serialNumber:'SN-MAU-B',fanModel:'FAN-B',inverterModel:'SG125CX-P2',quantity:3}]);if(SungrowFanLotRules.modelLabel(s)!=='2 Model Fan'||SungrowFanLotRules.totals(s).received!==5||SungrowFanLotRules.kpiQuantity(s)!==1||SungrowFanLotRules.parse(SungrowFanLotRules.pack(s)).lines[1].fanModel!=='FAN-B')throw Error('Đối soát Fan nhiều Model chưa đạt.');return {ok:true,version:APP_VERSION,models:2,fans:5,kpiCases:1,writtenToDatabase:false};}
