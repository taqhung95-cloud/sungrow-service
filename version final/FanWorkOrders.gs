/* Fan scope extension to the existing work-order, warranty and return APIs.
 * Same source tables/readers, one atomic batch, CAS + durable retry receipt.
 * Call only from the existing serialized and authenticated entry points.
 */
function fwSharedFormsReady_(){return typeof LEGACY_DASHBOARD_API!=='undefined'&&LEGACY_DASHBOARD_API.fanSharedFormsReady===true&&typeof FL_SHARED_RECEIPT_GUARD_!=='undefined'&&FL_SHARED_RECEIPT_GUARD_===true&&SungrowWorkOrderRules.replacements.indexOf('Fan')>=0;}
function fwBegin_(actor,row,payload,kind){
  if(!fwSharedFormsReady_())throw publicError_('Chưa cập nhật đủ các file biểu mẫu Fan. Không ghi dữ liệu.');
  flAssertEnabled_();
  var id=flRequest_(payload),digest=digest_(JSON.stringify(payload)),receipt=findTableRowsByField_(FL_EVENT_SHEET_,'Mã thao tác',[id])[0];
  if(receipt){var detail=parseJson_(receipt['Nội dung'])||{};if(receipt['Mã hồ sơ']!==row['Mã hồ sơ']||receipt['Người thực hiện']!==actor.email||detail.payloadDigest!==digest||detail.operation!==kind)throw publicError_('Mã thao tác đã dùng cho nội dung hoặc tài khoản khác.');return {replayed:true,result:fwFinish_(row['Mã hồ sơ'])};}
  assertCaseEditable_(actor,row);assertCenterAllowed_(actor,row['Trung tâm đang giữ hàng']);
  if(['Đã hủy','Đã hoàn tất','Đang luân chuyển'].indexOf(clean_(row['Trạng thái hồ sơ']))>=0)throw publicError_('Hồ sơ không ở trạng thái cho phép cập nhật.');
  if(PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+row['Mã hồ sơ']))throw publicError_('Hồ sơ cần đối soát đồng bộ trước khi cập nhật tiếp.');
  var state=flState_(row);if(!state||digest_(SungrowFanLotRules.pack(state))!==clean_(payload.fanFingerprint))throw publicError_('Hồ sơ đã thay đổi. Mở lại biểu mẫu trước khi lưu.');
  var selection=payload.fanSelections,seen={};
  if(!Array.isArray(selection)||!selection.length||selection.length>120)throw publicError_('Chọn ít nhất một S/N inverter.');
  var selected=selection.map(function(s){var line=state.lines.find(function(l){return l.lineId===s.lineId;});if(!line||seen[s.lineId])throw publicError_('S/N được chọn không hợp lệ hoặc bị lặp.');seen[s.lineId]=true;return {line:line,quantity:Number(s.quantity)};});
  return {id:id,digest:digest,state:state,selected:selected,requests:[],now:new Date(),today:Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd')};
}
function fwDay_(value,label,min,max){
  var day;try{day=SungrowFanLotRules.day(value);}catch(e){throw publicError_(label+' không hợp lệ.');}
  if((min&&day<min)||(max&&day>max))throw publicError_(label+' nằm ngoài khoảng ngày cho phép.');return day;
}
function fwChildId_(id,scope){return 'FW-'+digest_(id+'|'+scope).slice(0,40);}
function fwValues_(object){var out={};Object.keys(object).forEach(function(k){out[k]=object[k] instanceof Date?iso_(object[k]):clean_(object[k]);});return out;}
function fwFinish_(caseId){return flFinishSync_(caseId);}
function fwVerifyPending_(caseId){
  var pending=PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+caseId);
  if(pending){var receipt=findTableRowsByField_(FL_EVENT_SHEET_,'Mã thao tác',[pending])[0],d=receipt&&(parseJson_(receipt['Nội dung'])||{});
    if(d&&d.stateDigest){var row=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',[caseId])[0];if(!row||digest_(SungrowFanLotRules.pack(flState_(row)))!==d.stateDigest)throw publicError_('Nguồn lô chưa khớp biên nhận. Giữ nguyên chặn đồng bộ để đối soát.');
      var verify=function(actual,expected){var values=fwValues_(actual||{});if(!actual||Object.keys(expected).some(function(k){return values[k]!==expected[k];}))throw publicError_('Dữ liệu đã ghi chưa khớp biên nhận. Cần đối soát, không gửi thao tác mới.');};verify(row,d.caseExpected||{});
      if(d.workExpected){var w=findTableRowsByField_(SHEETS.workOrders,'Mã công việc',[d.workExpected.id])[0],values={};d.workExpected.keys.forEach(function(k){values[k]=w&&w[k];});if(!w||digest_(JSON.stringify(fwValues_(values)))!==d.workExpected.digest)throw publicError_('Công việc chưa khớp biên nhận. Cần đối soát trước khi tiếp tục.');}
      (d.childExpected||[]).forEach(function(c){verify(findTableRowsByField_(SHEETS[c.table],c.key,[c.id])[0],c.values);});
    }
  }
}
function fwEvent_(tx,row,actor,kind,lineId,quantity,date,outcome,detail,id){
  return flAppendRequest_(FL_EVENT_SHEET_,{'Mã thao tác':id||tx.id,'Mã hồ sơ':row['Mã hồ sơ'],'Mã dòng Fan':lineId||'','Loại thao tác':kind,'Số lượng':quantity||0,'Ngày thực tế':parseDateRequired_(date,'Ngày thao tác'),'Kết quả':outcome||'','Nội dung':JSON.stringify(detail||{}),'Người thực hiện':actor.email,'Thời gian':tx.now});
}
function fwCommit_(tx,row,actor,operation,changes,details){
  tx.state.revision++;changes['Chi tiết lô Fan']=SungrowFanLotRules.pack(tx.state);changes['Người cập nhật gần nhất']=actor.email;changes['Ngày cập nhật gần nhất']=tx.now;
  tx.requests=tx.requests.concat(flUpdateRequest_(SHEETS.cases,row.__rowNumber,changes));
  var caseExpected=Object.assign({},changes);delete caseExpected['Chi tiết lô Fan'];
  details=Object.assign({},details,{operation:operation,payloadDigest:tx.digest,stateDigest:digest_(changes['Chi tiết lô Fan']),caseExpected:fwValues_(caseExpected),workExpected:tx.workExpected||null,childExpected:tx.childExpected||[],selectedLineIds:tx.selected.map(function(s){return s.line.lineId;})});
  tx.requests.push(fwEvent_(tx,row,actor,operation,'',0,tx.today,'',details));
  PropertiesService.getScriptProperties().setProperty('FAN_PENDING_'+row['Mã hồ sơ'],tx.id);
  try{flBatch_(tx.requests);}catch(e){if(e.fanNoWrite)PropertiesService.getScriptProperties().deleteProperty('FAN_PENDING_'+row['Mã hồ sơ']);throw e;}
  return fwFinish_(row['Mã hồ sơ']);
}
// Previously journaled consumption remains immutable. It can be linked to a new
// completion, never silently edited, removed or counted as newly consumed.
function fwParts_(work,payload){
  var current=findTableRowsByField_(SHEETS.parts,'Mã công việc',[work['Mã công việc']]),by={},fresh=[],seen={};
  current.forEach(function(r){by[r['Mã sử dụng linh kiện']]=r;});
  if(!Array.isArray(payload.parts))throw publicError_('Danh sách linh kiện không hợp lệ.');
  payload.parts.forEach(function(p){var id=clean_(p.partUsageId);if(!id){if(clean_(p.partNumber)||clean_(p.name))fresh.push(Object.assign({},p));return;}
    var r=by[id];if(!r||seen[id])throw publicError_('Mã linh kiện không thuộc công việc hoặc bị lặp.');seen[id]=true;
    if(clean_(p.partNumber)!==clean_(r['Mã linh kiện (Part Number)'])||clean_(p.name)!==clean_(r['Tên linh kiện'])||Number(p.quantity)!==Number(r['Số lượng'])||clean_(p.usedAt)!==iso_(r['Ngày sử dụng']))throw publicError_('Linh kiện đã lưu cần đối soát trước khi chỉnh sửa.');
  });
  if(current.some(function(r){return !seen[r['Mã sử dụng linh kiện']];}))throw publicError_('Không xóa linh kiện đã ghi nhận khỏi lô.');
  return {fresh:fresh,current:current};
}
function fwChildren_(tx,row,work,actor,payload){
  var issues=findTableRowsByField_(SHEETS.issues,'Mã công việc',[work['Mã công việc']]),holds=findTableRowsByField_(SHEETS.holds,'Mã công việc',[work['Mã công việc']]),seen={},index=0;
  (payload.issues||[]).forEach(function(p){
    if(p.issueId){var old=issues.find(function(r){return r['Mã ghi nhận lỗi']===p.issueId;});if(!old||seen[p.issueId]||clean_(p.name)!==clean_(old['Tên lỗi'])||clean_(p.code)!==clean_(old['Mã lỗi'])||clean_(p.confirmedAt)!==iso_(old['Ngày xác nhận lỗi']))throw publicError_('Lỗi đã ghi nhận cần đối soát trước khi chỉnh sửa.');seen[p.issueId]=true;return;}
    if(!clean_(p.name)&&!clean_(p.code))return;var name=required_(p.name,'Tên lỗi'),code=clean_(p.code),date=fwDay_(p.confirmedAt||tx.today,'Ngày xác nhận lỗi',iso_(work['Ngày trung tâm nhận hàng']),tx.today);if(name.length>500||code.length>100)throw publicError_('Thông tin lỗi quá dài.');
    tx.selected.forEach(function(s){var issueQty=s.quantity===0&&s.line.completed===s.line.quantity?s.line.quantity:s.quantity;if(!Number.isSafeInteger(issueQty)||issueQty<1||issueQty>s.line.quantity)throw publicError_('Nhập số Fan có lỗi của từng S/N.');tx.requests.push(flAppendRequest_(SHEETS.issues,{'Mã ghi nhận lỗi':fwChildId_(tx.id,'issue-'+(++index)),'Mã công việc':work['Mã công việc'],'Loại ghi nhận':'Lỗi xác nhận','Mã lỗi':code,'Tên lỗi':name,'Ngày xác nhận lỗi':parseDateRequired_(date,'Ngày lỗi'),'Ghi chú lỗi':clean_(p.note),'Mã dòng Fan':s.line.lineId,'Số Fan xác nhận':issueQty}));});
  });
  if(issues.some(function(r){return clean_(r['Loại ghi nhận'])!=='Hiện tượng ban đầu'&&!seen[r['Mã ghi nhận lỗi']];}))throw publicError_('Không xóa lỗi đã ghi nhận của lô.');
  seen={};(payload.holds||[]).forEach(function(p){if(!clean_(p.reason)&&!p.startAt&&!p.endAt)return;
    var start=fwDay_(p.startAt,'Ngày bắt đầu tạm dừng',iso_(work['Ngày trung tâm nhận hàng']),tx.today),end=p.endAt?fwDay_(p.endAt,'Ngày kết thúc tạm dừng',start,tx.today):'',reason=required_(p.reason,'Lý do tạm dừng');if(reason.length>500)throw publicError_('Lý do tạm dừng quá dài.');
    var changes={'Lý do tạm dừng':reason,'Ngày bắt đầu':parseDateRequired_(start,'Bắt đầu'),'Ngày kết thúc':end?parseDateRequired_(end,'Kết thúc'):'','Ghi chú/Xác nhận':clean_(p.note),'Người cập nhật':actor.email};
    if(p.holdId){var old=holds.find(function(r){return r['Mã tạm dừng']===p.holdId;});if(!old||seen[p.holdId])throw publicError_('Khoảng tạm dừng không thuộc công việc hoặc bị lặp.');seen[p.holdId]=true;tx.requests=tx.requests.concat(flUpdateRequest_(SHEETS.holds,old.__rowNumber,changes));}
    else tx.requests.push(flAppendRequest_(SHEETS.holds,Object.assign(changes,{'Mã tạm dừng':fwChildId_(tx.id,'hold-'+(++index)),'Mã công việc':work['Mã công việc']})));
  });
}
function fwUpdateWorkOrder_(actor,row,work,payload){
  var tx=fwBegin_(actor,row,payload,'work');if(tx.replayed)return tx.result;
  if(work['Trung tâm xử lý']!==row['Trung tâm đang giữ hàng']||['Chờ nhận hàng','Đã chuyển hàng đi','Đã đóng công việc'].indexOf(clean_(work['Trạng thái xử lý']))>=0)throw publicError_('Công việc không còn mở tại center đang giữ hàng.');
  var parts=fwParts_(work,payload),status=clean_(payload.workflowStatus),pending=tx.selected.some(function(s){return WARRANTY_STATUSES.indexOf(s.line.warrantyStatus||clean_(row['Tình trạng bảo hành']))<0;}),input=Object.assign({},payload,{parts:parts.fresh});
  var errors=SungrowWorkOrderRules.validate(input,{currentStatus:clean_(work['Trạng thái xử lý']),previousReplacementType:clean_(work['Loại thiết bị đổi']),receivedAt:iso_(work['Ngày trung tâm nhận hàng']),warrantyPending:pending,caseClosed:false,today:tx.today});
  if(errors.length)throw publicError_(errors.join('\n'));if(['Đã chuyển hàng đi','Đã đóng công việc'].indexOf(status)>=0)throw publicError_('Dùng chức năng Luân chuyển hoặc Giao trả để đóng công việc.');
  var note=clean_(payload.note),gsp=clean_(payload.gsp),ma=clean_(payload.ma);if(note.length>20000||gsp.length>100||ma.length>100)throw publicError_('Ghi chú hoặc GSP/MA quá dài.');
  var upper=payload.technicalCompletedAt||tx.today;
  parts.fresh.forEach(function(p){p.usedAt=p.usedAt||payload.technicalCompletedAt;if(!p.usedAt)throw publicError_('Nhập ngày sử dụng linh kiện khi chưa hoàn tất kỹ thuật.');});
  var usage=flPartUsageRequests_(work,{parts:parts.fresh,partUsageIds:payload.fanExistingPartIds||[]},tx.id,tx.selected.map(function(s){return s.line.lineId;}).join(','),upper);tx.requests=tx.requests.concat(usage.requests);
  var history=findTableRowsByField_(FL_EVENT_SHEET_,'Mã hồ sơ',[row['Mã hồ sơ']]),newDates=[],newOutcomes=[];
  if(tx.state.workflowWorkId!==work['Mã công việc']){tx.state.workflowWorkId=work['Mã công việc'];tx.state.workflowDefault=clean_(work['Trạng thái xử lý']);tx.state.lines.forEach(function(l){delete l.workflowStatus;});}
  tx.selected.forEach(function(s){var line=s.line;if(!Number.isSafeInteger(s.quantity)||s.quantity<0||s.quantity>line.quantity)throw publicError_('Số Fan của S/N không hợp lệ.');
    if(status==='Hoàn tất kỹ thuật'&&s.quantity){var date=fwDay_(payload.technicalCompletedAt,'Ngày hoàn tất',iso_(work['Ngày trung tâm nhận hàng']),tx.today);
      var last=history.filter(function(e){return e['Mã dòng Fan']===line.lineId&&['technical','return'].indexOf(e['Loại thao tác'])>=0;}).reduce(function(d,e){return iso_(e['Ngày thực tế'])>d?iso_(e['Ngày thực tế']):d;},'');if(last&&date<last)throw publicError_('Ngày hoàn tất không được trước lần xử lý hoặc giao trả đã lưu.');
      var action={kind:'technical',lineId:line.lineId,quantity:s.quantity,date:date,outcome:payload.outcome,partUsageIds:usage.entries.map(function(p){return p.partUsageId;})};
      tx.state=SungrowFanLotRules.apply(tx.state,action,{today:tx.today,receivedAt:iso_(row['Ngày nhận từ khách']),warrantyApproved:!pending});
      tx.requests.push(fwEvent_(tx,row,actor,'technical',line.lineId,s.quantity,date,payload.outcome,{workOrderId:work['Mã công việc'],parentRequestId:tx.id,partUsageIds:action.partUsageIds},fwChildId_(tx.id,line.lineId)));newDates.push(date);newOutcomes.push(payload.outcome);
    }else if(status==='Hoàn tất kỹ thuật'&&line.completed!==line.quantity)throw publicError_('Nhập số Fan hoàn tất của S/N.');
    else if(status!=='Hoàn tất kỹ thuật'&&line.completed===line.quantity)throw publicError_('S/N đã hoàn tất; không đưa về trạng thái đang xử lý qua biểu mẫu này.');
    var target=tx.state.lines.find(function(l){return l.lineId===line.lineId;});if(status==='Hoàn tất kỹ thuật'&&s.quantity){target.technicalCompletedAt=payload.technicalCompletedAt;target.outcome=payload.outcome;}target.workflowStatus=target.completed===target.quantity?'Hoàn tất kỹ thuật':status==='Hoàn tất kỹ thuật'?'Đang sửa chữa':status;
  });
  fwChildren_(tx,row,work,actor,payload);
  var totals=SungrowFanLotRules.totals(tx.state),all=totals.completed===totals.received,dates=history.filter(function(e){return e['Loại thao tác']==='technical';}).map(function(e){return iso_(e['Ngày thực tế']);}).concat(newDates).sort(),outcomes=history.filter(function(e){return e['Loại thao tác']==='technical';}).map(function(e){return clean_(e['Kết quả']);}).concat(newOutcomes);
  var workChanges={'Trạng thái xử lý':all?'Hoàn tất kỹ thuật':status==='Hoàn tất kỹ thuật'?'Đang sửa chữa':status,'Ngày hoàn tất chẩn đoán':payload.diagnosisCompletedAt?parseDateRequired_(payload.diagnosisCompletedAt,'Ngày chẩn đoán'):'','Ngày hoàn tất kỹ thuật':all&&dates.length?parseDateRequired_(dates[dates.length-1],'Ngày hoàn tất'):'','Kết quả xử lý':all&&outcomes.length&&outcomes.every(function(o){return o===outcomes[0];})?outcomes[0]:'','Loại thiết bị đổi':all?clean_(payload.replacementType):'','Ghi chú nội bộ':note,'Người cập nhật':actor.email,'Ngày cập nhật':tx.now};
  tx.workExpected={id:work['Mã công việc'],keys:Object.keys(workChanges),digest:digest_(JSON.stringify(fwValues_(workChanges)))};tx.requests=tx.requests.concat(flUpdateRequest_(SHEETS.workOrders,work.__rowNumber,workChanges));
  var changes={'GSP':gsp,'MA':ma,'Trạng thái hồ sơ':totals.waiting>0&&row['Trung tâm đang giữ hàng']===row['Trung tâm tiếp nhận khách']?'Sẵn sàng trả khách':'Đang xử lý'};
  if(totals.waiting>0&&!row['Ngày sẵn sàng trả khách']&&row['Trung tâm đang giữ hàng']===row['Trung tâm tiếp nhận khách'])changes['Ngày sẵn sàng trả khách']=parseDateRequired_(newDates[0]||tx.today,'Ngày sẵn sàng');
  return fwCommit_(tx,row,actor,'work',changes,{workOrderId:work['Mã công việc'],workflowStatus:status,note:note,parts:usage.entries});
}
function fwConfirmWarranty_(actor,row,payload){
  var tx=fwBegin_(actor,row,payload,'warranty');if(tx.replayed)return tx.result;
  if(!canApproveWarranty_(actor))throw publicError_('Không có quyền duyệt bảo hành.');var status=clean_(payload.warrantyStatus),note=clean_(payload.note);if(WARRANTY_STATUSES.indexOf(status)<0||note.length>2000)throw publicError_('Tình trạng bảo hành hoặc ghi chú không hợp lệ.');
  tx.selected.forEach(function(s){var old=s.line.warrantyStatus||clean_(row['Tình trạng bảo hành']);if(old!==status&&(s.line.completed||s.line.returned))throw publicError_('S/N đã xử lý cần đối soát trước khi đổi bảo hành.');if(WARRANTY_STATUSES.indexOf(old)>=0&&old!==status&&!note)throw publicError_('Nhập ghi chú khi đổi kết luận bảo hành.');s.line.warrantyStatus=status;});
  var values=tx.state.lines.map(function(l){return l.warrantyStatus||clean_(row['Tình trạng bảo hành']);}),label=values.every(function(v){return v===values[0];})?values[0]:'Theo từng S/N';
  return fwCommit_(tx,row,actor,'warranty',{'Tình trạng bảo hành':label,'Người xác nhận bảo hành':actor.email,'Ngày xác nhận bảo hành':tx.now,'Ghi chú xác nhận bảo hành':note},{note:note,warrantyStatus:status});
}
function fwReturn_(actor,row,payload){
  var tx=fwBegin_(actor,row,payload,'return-batch');if(tx.replayed)return tx.result;
  assertCenterAllowed_(actor,row['Trung tâm tiếp nhận khách']);if(row['Trung tâm đang giữ hàng']!==row['Trung tâm tiếp nhận khách'])throw publicError_('Chuyển hồ sơ về center tiếp nhận trước khi giao trả.');
  var current=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',[row['Mã hồ sơ']]).filter(function(w){return w['Trung tâm xử lý']===row['Trung tâm đang giữ hàng'];}).pop();if(!current||['Chờ nhận hàng','Đã chuyển hàng đi','Đã đóng công việc'].indexOf(clean_(current['Trạng thái xử lý']))>=0)throw publicError_('Center chưa có công việc mở để giao trả.');var earliest=[iso_(row['Ngày nhận từ khách']),iso_(current['Ngày trung tâm nhận hàng'])].sort().pop();var date=fwDay_(payload.returnedAt,'Ngày trả khách',earliest,tx.today);if(payload.readyAt&&date<fwDay_(payload.readyAt,'Ngày sẵn sàng',iso_(row['Ngày nhận từ khách']),tx.today))throw publicError_('Ngày trả trước ngày sẵn sàng.');
  var history=findTableRowsByField_(FL_EVENT_SHEET_,'Mã hồ sơ',[row['Mã hồ sơ']]),changes={};
  var fields={returnCompany:'Tên công ty gửi hàng',returnCustomer:'Tên người gửi hàng',returnAddress:'Địa chỉ gửi hàng',returnPhone:'Số điện thoại gửi hàng',returnEmail:'Email gửi hàng',returnCarrier:'Đơn vị vận chuyển',returnTrackingCode:'Mã vận đơn'};
  Object.keys(fields).forEach(function(k){var v=clean_(payload[k]);if(!v&&['returnCompany','returnEmail'].indexOf(k)<0)throw publicError_('Thiếu thông tin giao trả: '+k);if(v.length>500)throw publicError_('Thông tin giao trả quá dài.');changes[fields[k]]=v;});
  tx.selected.forEach(function(s){if(!Number.isSafeInteger(s.quantity)||s.quantity<1)throw publicError_('Nhập số Fan giao lần này.');var line=s.line,last=history.filter(function(e){return e['Mã dòng Fan']===line.lineId&&['technical','return'].indexOf(e['Loại thao tác'])>=0;}).reduce(function(d,e){return iso_(e['Ngày thực tế'])>d?iso_(e['Ngày thực tế']):d;},'');if(last&&date<last)throw publicError_('Ngày trả trước lần xử lý/giao trả gần nhất.');
    tx.state=SungrowFanLotRules.apply(tx.state,{kind:'return',lineId:line.lineId,quantity:s.quantity,date:date},{today:tx.today,receivedAt:iso_(row['Ngày nhận từ khách']),warrantyApproved:WARRANTY_STATUSES.indexOf(line.warrantyStatus||clean_(row['Tình trạng bảo hành']))>=0});
    tx.requests.push(fwEvent_(tx,row,actor,'return',line.lineId,s.quantity,date,'',Object.assign({},{returnCustomer:payload.returnCustomer,returnCarrier:payload.returnCarrier,returnTrackingCode:payload.returnTrackingCode}),fwChildId_(tx.id,line.lineId)));
  });
  var totals=SungrowFanLotRules.totals(tx.state);changes['Trạng thái hồ sơ']=totals.returned===totals.received?'Đã hoàn tất':totals.waiting>0?'Sẵn sàng trả khách':'Đang xử lý';if(totals.returned===totals.received)changes['Ngày trả khách']=parseDateRequired_(date,'Ngày trả khách');
  return fwCommit_(tx,row,actor,'return-batch',changes,{returnCustomer:payload.returnCustomer,returnCarrier:payload.returnCarrier,returnTrackingCode:payload.returnTrackingCode});
}

// Editor-only validation. No source rows are created, migrated or rewritten.
function kiemTraFanBieuMauChung(){return withSerializedWrite_('kiểm tra biểu mẫu Fan',function(){portalReadDiagnosticActor_();var report={version:APP_VERSION,sharedFormsAvailable:fwSharedFormsReady_(),enabled:flEnabled_(),writtenToDatabase:false,audit:doiSoatFanTheoLo()};console.log('FAN_SHARED_FORMS_CHECK '+JSON.stringify(report));return report;});}
