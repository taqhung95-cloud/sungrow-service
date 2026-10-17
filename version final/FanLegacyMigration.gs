/* Editor-only migration of explicitly selected, unprocessed reception groups.
 * Parts/issue IDs remain attached to their original work IDs. No history writes.
 * The first source case becomes the lot; other sources remain as soft archives.
 */
function fmgMarkWebRuntime_(){if(typeof LEGACY_DASHBOARD_API==='undefined'||!LEGACY_DASHBOARD_API.fanLegacyKpiReady||typeof FAN_MANAGER_LEGACY_KPI_READY_==='undefined'||!FAN_MANAGER_LEGACY_KPI_READY_||typeof flLegacyGroupReaderReady_!=='function'||typeof SungrowFanLotRules.kpiQuantity!=='function'){PropertiesService.getScriptProperties().deleteProperty('FAN_LEGACY_WEB_READY');return false;}PropertiesService.getScriptProperties().setProperty('FAN_LEGACY_WEB_READY',JSON.stringify({version:APP_VERSION,at:Date.now()}));}
function fmgPlan_(group, cases, works, issues, parts, holds, transfers) {
  var ids=parseJson_(group['Danh sách hồ sơ']);
  if(!Array.isArray(ids)||ids.length<2||ids.length>120||new Set(ids).size!==ids.length)throw Error('Nhóm có danh sách nguồn không hợp lệ.');
  if(clean_(group['Hồ sơ lô Fan']))return {converted:true,groupId:group['Mã nhóm'],caseId:group['Hồ sơ lô Fan']};
  var source=ids.map(function(id){var found=cases.filter(function(r){return r['Mã hồ sơ']===id;});if(found.length!==1)throw Error('Thiếu hoặc trùng hồ sơ nguồn.');return found[0];}).sort(function(a,b){return clean_(a['Mã hồ sơ']).localeCompare(clean_(b['Mã hồ sơ']));});
  var anchor=source[0],identity=null,sourceWorks=[],bySn={};
  source.forEach(function(r){
    var id=r['Mã hồ sơ'],key=[clean_(r['Mã khách hàng'])||clean_(r['Tên khách hàng']).normalize('NFC').toLowerCase(),iso_(r['Ngày nhận từ khách']),clean_(r['Trung tâm tiếp nhận khách']),clean_(r['Trung tâm đang giữ hàng'])].join('|');
    if(identity&&identity!==key)throw Error('Khác khách hàng/ngày nhận/center.');identity=key;
    if(!clean_(r['Tên khách hàng'])||!iso_(r['Ngày nhận từ khách'])||r['Trung tâm đang giữ hàng']!==r['Trung tâm tiếp nhận khách'])throw Error('Nguồn thiếu định danh hoặc không ở center tiếp nhận.');
    if(r['Loại thiết bị']!=='Fan'||clean_(r['Kiểu hồ sơ'])||r['Nguồn dữ liệu']!=='Quy trình mới'||r['Trạng thái hồ sơ']!=='Mới tiếp nhận'||r['Ngày trả khách']||r['Ngày sẵn sàng trả khách'])throw Error('Chỉ chuyển Fan thường mới tiếp nhận, chưa xử lý/giao trả.');
    var related=works.filter(function(w){return w['Mã hồ sơ']===id;});
    if(related.length!==1)throw Error('Nguồn cần đúng một công việc tiếp nhận.');
    var w=related[0];if(w['Trung tâm xử lý']!==r['Trung tâm đang giữ hàng']||iso_(w['Ngày trung tâm nhận hàng'])!==iso_(r['Ngày nhận từ khách'])||w['Trạng thái xử lý']!=='Đã nhận hàng'||w['Ngày hoàn tất chẩn đoán']||w['Ngày hoàn tất kỹ thuật']||w['Kết quả xử lý']||w['Ngày chuyển hàng đi'])throw Error('Công việc đã có xử lý, cần chuyển đổi riêng sau đối soát.');
    sourceWorks.push(w);
    var sn=clean_(r['Số sê-ri (S/N)']).toUpperCase(),warranty=clean_(r['Tình trạng bảo hành'])||'Chờ xác nhận';
    if(!sn)throw Error('Nguồn cần S/N inverter rõ ràng.');
    if(bySn[sn]&&bySn[sn]!==warranty)throw Error('Cùng S/N có bảo hành khác nhau; cần giữ các phần riêng trước khi chuyển.');bySn[sn]=warranty;
  });
  var workIds=sourceWorks.map(function(w){return w['Mã công việc'];});
  if(parts.some(function(p){return workIds.indexOf(p['Mã công việc'])>=0;})||holds.some(function(h){return workIds.indexOf(h['Mã công việc'])>=0;})||transfers.some(function(t){return ids.indexOf(t['Mã hồ sơ'])>=0;})||issues.some(function(i){return workIds.indexOf(i['Mã công việc'])>=0&&i['Loại ghi nhận']!=='Hiện tượng ban đầu';}))throw Error('Nguồn có linh kiện/lỗi xác nhận/luân chuyển/tạm dừng; dừng để bảo toàn lịch sử.');
  var state=SungrowFanLotRules.create(source.map(function(r){return {serialNumber:r['Số sê-ri (S/N)'],quantity:r['Số lượng']};}));
  state.lines.forEach(function(l){l.warrantyStatus=bySn[l.serialNumber];});
  state.legacyImport={version:1,groupId:group['Mã nhóm'],kpiQuantity:source.reduce(function(n,r){return n+Number(r['Số lượng']);},0),sourceCaseCount:source.length,sources:source.map(function(r){var w=sourceWorks.find(function(x){return x['Mã hồ sơ']===r['Mã hồ sơ'];});return {caseId:r['Mã hồ sơ'],workOrderId:w['Mã công việc'],serialNumber:clean_(r['Số sê-ri (S/N)']).toUpperCase(),inverterModel:clean_(r.Model),quantity:Number(r['Số lượng']),warrantyStatus:clean_(r['Tình trạng bảo hành']),warrantyBy:clean_(r['Người xác nhận bảo hành']),warrantyAt:iso_(r['Ngày xác nhận bảo hành']),warrantyNote:clean_(r['Ghi chú xác nhận bảo hành']),evidenceUrl:clean_(r['Liên kết hồ sơ Drive'])};})};
  state.files=state.legacyImport.sources.filter(function(r){return r.evidenceUrl;}).map(function(r){return {name:'Tài liệu hồ sơ nguồn '+r.caseId,url:r.evidenceUrl,serialNumber:r.serialNumber};});
  SungrowFanLotRules.parse(state);
  return {converted:false,groupId:group['Mã nhóm'],groupRow:group.__rowNumber,caseId:anchor['Mã hồ sơ'],source:source,works:sourceWorks,state:state,sourceCaseIds:source.map(function(r){return r['Mã hồ sơ'];}),kpiBefore:state.legacyImport.kpiQuantity,kpiAfter:SungrowFanLotRules.kpiQuantity(state),fans:SungrowFanLotRules.totals(state).received,serials:state.lines.length};
}
function fmgCapture_(groupIds) {
  if(!Array.isArray(groupIds)||!groupIds.length||groupIds.length>10||new Set(groupIds).size!==groupIds.length)throw Error('Chọn rõ từ 1 đến 10 mã nhóm.');
  var groups=findTableRowsByField_(FL_GROUP_SHEET_,'Mã nhóm',groupIds);if(groups.length!==groupIds.length)throw Error('Thiếu hoặc trùng nhóm.');
  groups.sort(function(a,b){return clean_(a['Mã nhóm']).localeCompare(clean_(b['Mã nhóm']));});
  var allGroups=readTable_(FL_GROUP_SHEET_),ids=[];groups.forEach(function(g){ids=ids.concat(parseJson_(g['Danh sách hồ sơ'])||[]);});
  if(ids.length>120)throw Error('Mỗi đợt tối đa 120 hồ sơ nguồn.');
  if(new Set(ids).size!==ids.length)throw Error('Nhóm bị chồng hồ sơ.');
  allGroups.filter(function(g){return groupIds.indexOf(g['Mã nhóm'])<0;}).forEach(function(g){if((parseJson_(g['Danh sách hồ sơ'])||[]).some(function(id){return ids.indexOf(id)>=0;}))throw Error('Nguồn còn nằm trong một nhóm khác.');});
  var cases=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',ids),works=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',ids),workIds=works.map(function(w){return w['Mã công việc'];});
  var parts=findTableRowsByField_(SHEETS.parts,'Mã công việc',workIds),issues=findTableRowsByField_(SHEETS.issues,'Mã công việc',workIds),holds=findTableRowsByField_(SHEETS.holds,'Mã công việc',workIds),transfers=findTableRowsByField_(SHEETS.transfers,'Mã hồ sơ',ids);
  var plans=groups.map(function(g){return fmgPlan_(g,cases,works,issues,parts,holds,transfers);});
  var snapshot={groups:groups.map(function(g){return {id:g['Mã nhóm'],name:g['Tên nhóm'],ids:g['Danh sách hồ sơ'],lot:clean_(g['Hồ sơ lô Fan'])};}),cases:cases,works:works,parts:parts,issues:issues,holds:holds,transfers:transfers};
  return {plans:plans,snapshot:snapshot,fingerprint:digest_(JSON.stringify(snapshot)),groupIds:groupIds.slice().sort()};
}
function fmgPreview_(groupIds) {
  portalReadDiagnosticActor_();var capture=fmgCapture_(groupIds),props=PropertiesService.getScriptProperties();
  props.setProperty('FAN_CONVERSION_PREVIEW',JSON.stringify({groupIds:capture.groupIds,fingerprint:capture.fingerprint,revision:getPortalDatabaseRevision_(),at:Date.now()}));
  var result={writtenToDatabase:false,groups:capture.plans.map(function(p){return {groupId:p.groupId,lotCaseId:p.caseId,alreadyConverted:p.converted,sourceCases:p.sourceCaseIds?p.sourceCaseIds.length:null,fans:p.fans,serials:p.serials,kpiBefore:p.kpiBefore,kpiAfter:p.kpiAfter};})};console.log(JSON.stringify(result));return result;
}
function fmgVerifyApplied_(receipt) {
  var before=JSON.parse(DriveApp.getFileById(receipt.receiptId).getBlob().getDataAsString()).before,nowCases=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',receipt.caseIds),nowWorks=findTableRowsByField_(SHEETS.workOrders,'Mã công việc',before.works.map(function(w){return w['Mã công việc'];}));
  if(nowCases.length!==before.cases.length||nowWorks.length!==before.works.length)throw Error('Thiếu nguồn/công việc sau chuyển đổi.');
  before.groups.forEach(function(g){var ids=parseJson_(g.ids),anchor=ids.slice().sort()[0],parent=nowCases.find(function(r){return r['Mã hồ sơ']===anchor;}),state=flState_(parent),m=state&&state.legacyImport;
    if(!m||m.groupId!==g.id||m.backupId!==receipt.backupId||m.receiptId!==receipt.receiptId||JSON.stringify(m.sources.map(function(x){return x.caseId;}).sort())!==JSON.stringify(ids.slice().sort()))throw Error('Lô không khớp nguồn chuyển đổi.');
    ids.forEach(function(id){var old=before.cases.find(function(r){return r['Mã hồ sơ']===id;}),row=nowCases.find(function(r){return r['Mã hồ sơ']===id;});if(id!==anchor){var link=parseJson_(row['Chi tiết lô Fan']);if(row['Trạng thái hồ sơ']!=='Đã hủy'||row['Kiểu hồ sơ']!=='Fan nguồn đã nhập lô'||!link||link.parentCaseId!==anchor)throw Error('Nguồn chưa liên kết đúng lô.');['Số sê-ri (S/N)','Model','Số lượng','Tình trạng bảo hành','Liên kết hồ sơ Drive'].forEach(function(k){if(row[k]!==old[k])throw Error('Nguồn bị đổi ngoài phạm vi: '+k);});}
      var work=before.works.find(function(w){return w['Mã hồ sơ']===id;}),saved=nowWorks.find(function(w){return w['Mã công việc']===work['Mã công việc'];});if(saved['Mã hồ sơ']!==anchor)throw Error('Công việc chưa về đúng lô.');var left=Object.assign({},work),right=Object.assign({},saved);delete left['Mã hồ sơ'];delete right['Mã hồ sơ'];if(JSON.stringify(left)!==JSON.stringify(right))throw Error('Công việc bị đổi ngoài liên kết hồ sơ.');
    });
  });
  var workIds=before.works.map(function(w){return w['Mã công việc'];});if(findTableRowsByField_(SHEETS.parts,'Mã công việc',workIds).length)throw Error('Có linh kiện phát sinh trong đợt chuyển đổi chưa xử lý.');
  return true;
}
function fmgSync_(receipt) {
  var props=PropertiesService.getScriptProperties(),failures=[];fmgVerifyApplied_(receipt);
  receipt.caseIds.forEach(function(id){var p=syncDashboardProjectionCase_(id),i=syncPortalCaseIndexCase_(id);if(!p||!p.ok||!i||!i.ok)failures.push(id);});
  bumpPortalDatabaseRevision_();
  if(failures.length)throw Error('Nguồn đã chuyển nhưng chưa đồng bộ đủ. Chạy lại hàm áp dụng để phục hồi, không khôi phục đè backup.');
  receipt.lotIds.forEach(function(id){flFinishSync_(id);});
  var audit=doiSoatFanTheoLo();if(!audit.ok)throw Error('Đã đồng bộ nhưng audit chưa đạt. Giữ nguyên nguồn để đối soát.');
  props.deleteProperty('FAN_CONVERSION_PENDING');props.deleteProperty('FAN_CONVERSION_PREVIEW');
  var output={ok:true,convertedLots:receipt.lotIds.length,sourceCases:receipt.caseIds.length,lotCaseIds:receipt.lotIds,backupId:receipt.backupId,receiptId:receipt.receiptId,kpiBefore:receipt.kpi,kpiAfter:receipt.kpi,partsBefore:0,partsAfter:0,audit:audit};console.log(JSON.stringify(output));return output;
}
function fmgApply_(groupIds) {return withSerializedWrite_('chuyển nhóm Fan thành lô',function(){
  var actor=portalReadDiagnosticActor_(),props=PropertiesService.getScriptProperties();flAssertEnabled_();
  var pending=parseJson_(props.getProperty('FAN_CONVERSION_PENDING'));
  if(pending){if(JSON.stringify(groupIds.slice().sort())!==JSON.stringify(pending.groupIds))throw Error('Có đợt chuyển đổi khác đang chờ đối soát.');var check=fmgCapture_(groupIds);if(!check.plans.every(function(p){return p.converted;}))throw Error('Đợt trước chưa xác định trạng thái ghi. Kiểm tra log trước khi tiếp tục.');return fmgSync_(pending);}
  var live=parseJson_(props.getProperty('FAN_LEGACY_WEB_READY'));if(!live||live.version!==APP_VERSION||Date.now()-live.at>1800000)throw Error('Deploy New version và đăng nhập lại portal bằng tài khoản quản lý trước khi chuyển, để dashboard dùng đúng quy tắc giữ KPI.');
  var capture=fmgCapture_(groupIds),preview=parseJson_(props.getProperty('FAN_CONVERSION_PREVIEW'));
  if(capture.plans.every(function(p){return p.converted;}))return {ok:true,alreadyConverted:true,lotCaseIds:capture.plans.map(function(p){return p.caseId;})};
  if(capture.plans.some(function(p){return p.converted;}))throw Error('Không trộn nhóm đã chuyển và chưa chuyển.');
  if(!preview||Date.now()-preview.at>1800000||preview.fingerprint!==capture.fingerprint||preview.revision!==getPortalDatabaseRevision_()||JSON.stringify(preview.groupIds)!==JSON.stringify(capture.groupIds))throw Error('Nguồn thay đổi hoặc preview hết hạn. Chạy xem trước lại.');
  var stamp=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyyMMdd-HHmmss'),backup=DriveApp.getFileById(DATABASE_SPREADSHEET_ID).makeCopy('Backup chuyen Fan thanh lo '+stamp),receiptFile=DriveApp.createFile('Fan-conversion-'+stamp+'.json',JSON.stringify({actor:actor.email,backupId:backup.getId(),before:capture.snapshot}),MimeType.PLAIN_TEXT);
  if(fmgCapture_(groupIds).fingerprint!==capture.fingerprint)throw Error('Nguồn thay đổi trong lúc tạo backup. Chưa ghi dữ liệu.');
  ensureSheetColumns_(FL_GROUP_SHEET_,['Hồ sơ lô Fan']);var requests=[],now=new Date(),caseIds=[],lotIds=[],kpi=0;
  capture.plans.forEach(function(p){
    caseIds=caseIds.concat(p.sourceCaseIds);lotIds.push(p.caseId);kpi+=p.kpiBefore;
    p.state.legacyImport.backupId=backup.getId();p.state.legacyImport.receiptId=receiptFile.getId();
    var parent=p.source[0],changes={'Kiểu hồ sơ':'Fan theo lô','Chi tiết lô Fan':SungrowFanLotRules.pack(p.state),'Số sê-ri (S/N)':'','Model':'','Số lượng':p.fans,'Tình trạng bảo hành':p.state.lines.every(function(l){return l.warrantyStatus===p.state.lines[0].warrantyStatus;})?p.state.lines[0].warrantyStatus:'Chờ xác nhận','Ghi chú chung':[clean_(parent['Ghi chú chung']),'Chuyển từ '+p.source.length+' hồ sơ Fan; model inverter, bảo hành và tài liệu nguồn nằm trong chi tiết lô.'].filter(Boolean).join('\n'),'Người cập nhật gần nhất':actor.email,'Ngày cập nhật gần nhất':now};
    requests=requests.concat(flUpdateRequest_(SHEETS.cases,parent.__rowNumber,changes));
    p.source.slice(1).forEach(function(r){requests=requests.concat(flUpdateRequest_(SHEETS.cases,r.__rowNumber,{'Kiểu hồ sơ':'Fan nguồn đã nhập lô','Chi tiết lô Fan':JSON.stringify({parentCaseId:p.caseId,groupId:p.groupId,originalStatus:r['Trạng thái hồ sơ'],backupId:backup.getId()}),'Trạng thái hồ sơ':'Đã hủy','Người hủy':actor.email,'Ngày hủy':now,'Lý do hủy':'Chuyển vào lô Fan '+p.caseId+'; giữ nguyên hàng nguồn để truy vết.','Người cập nhật gần nhất':actor.email,'Ngày cập nhật gần nhất':now}));});
    p.works.forEach(function(w){if(w['Mã hồ sơ']!==p.caseId)requests=requests.concat(flUpdateRequest_(SHEETS.workOrders,w.__rowNumber,{'Mã hồ sơ':p.caseId}));});
    requests=requests.concat(flUpdateRequest_(FL_GROUP_SHEET_,p.groupRow,{'Hồ sơ lô Fan':p.caseId}));
    requests.push(flAppendRequest_(SHEETS.audit,{'Thời gian':now,'Email người dùng':actor.email,'Hành động':'Chuyển nhóm Fan thành lô','Loại đối tượng':'Hồ sơ thiết bị','Mã đối tượng':p.caseId,'Trung tâm':parent['Trung tâm đang giữ hàng'],'Dữ liệu trước':JSON.stringify({groupId:p.groupId,sourceCaseIds:p.sourceCaseIds,kpi:p.kpiBefore}),'Dữ liệu sau':JSON.stringify({lotCaseId:p.caseId,fans:p.fans,kpi:p.kpiAfter,backupId:backup.getId(),receiptId:receiptFile.getId()})}));
    requests.push(flAppendRequest_(FL_EVENT_SHEET_,{'Mã thao tác':'FM-'+p.groupId,'Mã hồ sơ':p.caseId,'Mã dòng Fan':'','Loại thao tác':'migration','Số lượng':0,'Ngày thực tế':now,'Kết quả':'Chuyển hồ sơ cũ thành lô','Nội dung':JSON.stringify({backupId:backup.getId(),receiptId:receiptFile.getId(),sourceCaseIds:p.sourceCaseIds,kpiBefore:p.kpiBefore,kpiAfter:p.kpiAfter}),'Người thực hiện':actor.email,'Thời gian':now}));
  });
  var receipt={groupIds:capture.groupIds,caseIds:caseIds,lotIds:lotIds,kpi:kpi,backupId:backup.getId(),receiptId:receiptFile.getId()};props.setProperty('FAN_CONVERSION_PENDING',JSON.stringify(receipt));lotIds.forEach(function(id){props.setProperty('FAN_PENDING_'+id,'conversion');});
  try{flBatch_(requests);}catch(error){if(error.fanNoWrite){props.deleteProperty('FAN_CONVERSION_PENDING');lotIds.forEach(function(id){props.deleteProperty('FAN_PENDING_'+id);});}throw error;}
  return fmgSync_(receipt);
});}
