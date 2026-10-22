/** Targeted, editor-only repair. Original rows/IDs are retained; no child rows are deleted. */
function kiemTraLuanChuyen7D323A(){portalReadDiagnosticActor_();return trRepairPlan7D323A_().report;}
function suaLuanChuyen7D323A(){
  return withSerializedWrite_('đối soát lượt nhận trùng 7D323A',function(){
    var actor=portalReadDiagnosticActor_(),plan=trRepairPlan7D323A_();
    if(!plan.actions.length)return Object.assign({},plan.report,{writtenToDatabase:false,alreadyRepaired:true});
    if(typeof flBatch_!=='function'||typeof flUpdateRequest_!=='function')throw publicError_('Cần giữ FanLots.gs để ghi sửa đồng bộ một lần.');
    plan.actions.filter(function(a){return a.table===SHEETS.transfers;}).forEach(function(a){allowListValidationValue_(a.table,tableHeaders_(a.table),a.row.__rowNumber,'Trạng thái luân chuyển','Đã hủy');});
    var now=new Date();plan.actions.forEach(function(a){if(a.table===SHEETS.cases){a.changes['Người cập nhật gần nhất']=actor.email;a.changes['Ngày cập nhật gần nhất']=now;}else if(a.table===SHEETS.workOrders){a.changes['Người cập nhật']=actor.email;a.changes['Ngày cập nhật']=now;}});
    var requests=[];plan.actions.forEach(function(a){requests=requests.concat(flUpdateRequest_(a.table,a.row.__rowNumber,a.changes));});
    flBatch_(requests);
    audit_(actor,'Đối soát lượt nhận trùng','Hồ sơ',plan.caseId,plan.center,{records:plan.actions.map(function(a){return {table:a.table,record:a.row};})},{reason:'Hai lần nhận cho cùng chặng XBSolar → Sungrow; giữ công việc đã hoàn tất, đóng bản trùng và chuyển quyền giao trả về center cuối.',changes:plan.actions.map(function(a){return {table:a.table,row:a.row.__rowNumber,changes:a.changes};})});
    var synced=syncCaseDerived_(plan.caseId);bumpPortalDatabaseRevision_();
    if(!synced.projection.ok||!synced.index.ok)throw publicError_('Đã sửa nguồn nhưng chưa đồng bộ đủ dashboard/chỉ mục. Không sửa lại dữ liệu nguồn; kiểm tra đồng bộ.');
    return Object.assign({},plan.report,{writtenToDatabase:true});
  });
}
function trRepairPlan7D323A_(){
  var caseId='HS-20261015-092607-7D323A',keepId='CV-20261015-154648-AF003F',duplicateId='CV-20261015-152557-CA2136',center='Sungrow Service Center';
  var cases=readScopedTable_(SHEETS.cases,'Mã hồ sơ',[caseId]).rows,works=readScopedTable_(SHEETS.workOrders,'Mã hồ sơ',[caseId]).rows,transfers=readScopedTable_(SHEETS.transfers,'Mã hồ sơ',[caseId]).rows;
  var row=cases.length===1&&cases[0],keep=works.filter(function(w){return w['Mã công việc']===keepId;}),duplicates=works.filter(function(w){return w['Mã công việc']===duplicateId;});
  if(!row||keep.length!==1||duplicates.length!==1||row['Trung tâm đang giữ hàng']!==center||['Đang luân chuyển','Đã hủy'].indexOf(clean_(row['Trạng thái hồ sơ']))>=0)throw publicError_('Hồ sơ/center đã khác dữ liệu đã đối chiếu. Dừng sửa tự động.');
  keep=keep[0];var duplicate=duplicates[0];
  if(keep['Trung tâm xử lý']!==center||duplicate['Trung tâm xử lý']!==center||clean_(keep['Trạng thái xử lý'])!=='Hoàn tất kỹ thuật'||!keep['Ngày hoàn tất kỹ thuật']||!clean_(keep['Kết quả xử lý']))throw publicError_('Công việc giữ lại chưa đầy đủ kết quả/ngày hoàn tất.');
  if(['Đã nhận hàng','Đã đóng công việc'].indexOf(clean_(duplicate['Trạng thái xử lý']))<0||duplicate['Ngày hoàn tất kỹ thuật']||duplicate['Ngày hoàn tất chẩn đoán']||clean_(duplicate['Kết quả xử lý']))throw publicError_('Bản nhận trùng đã có xử lý; cần đối soát riêng.');
  [SHEETS.issues,SHEETS.parts,SHEETS.holds].forEach(function(table){if(readScopedTable_(table,'Mã công việc',[duplicateId]).rows.length)throw publicError_('Bản nhận trùng có lỗi/linh kiện/SLA. Không tự chuyển hoặc xóa dữ liệu.');});
  if(transfers.some(function(t){return t['Mã công việc gửi']===duplicateId;}))throw publicError_('Bản trùng đã có chặng đi tiếp. Dừng sửa tự động.');
  var duplicateTransfers=transfers.filter(function(t){return t['Mã công việc nhận']===duplicateId;}),keepTransfers=transfers.filter(function(t){return t['Mã công việc nhận']===keepId;});
  if(duplicateTransfers.length!==1||keepTransfers.length!==1||keepTransfers[0]['Trạng thái luân chuyển']!=='Đã nhận'||duplicateTransfers[0]['Trung tâm gửi']!==keepTransfers[0]['Trung tâm gửi']||duplicateTransfers[0]['Trung tâm nhận']!==center||['Đã nhận','Đã hủy'].indexOf(duplicateTransfers[0]['Trạng thái luân chuyển'])<0)throw publicError_('Hai chặng luân chuyển không còn khớp bản trùng đã xác minh.');
  var actions=[],marker='[Đối soát trùng: giữ '+keepId+']',note=function(value){value=clean_(value);return value.indexOf(marker)>=0?value:[value,marker].filter(Boolean).join('\n');};
  function change(table,record,values){var diff=changedRowValues_(record,values);if(Object.keys(diff).length)actions.push({table:table,row:record,changes:diff});}
  change(SHEETS.workOrders,duplicate,{'Trạng thái xử lý':'Đã đóng công việc','Ghi chú nội bộ':note(duplicate['Ghi chú nội bộ'])});
  change(SHEETS.transfers,duplicateTransfers[0],{'Trạng thái luân chuyển':'Đã hủy','Ghi chú bàn giao':note(duplicateTransfers[0]['Ghi chú bàn giao'])});
  if(row['Trạng thái hồ sơ']!=='Đã hoàn tất')change(SHEETS.cases,row,{'Trạng thái hồ sơ':'Sẵn sàng trả khách','Ngày sẵn sàng trả khách':keep['Ngày hoàn tất kỹ thuật']});
  return {caseId:caseId,center:center,actions:actions,report:{caseId:caseId,keepWorkOrderId:keepId,duplicateWorkOrderId:duplicateId,changedRecords:actions.length,resultingStatus:row['Trạng thái hồ sơ']==='Đã hoàn tất'?'Đã hoàn tất':'Sẵn sàng trả khách',writtenToDatabase:false}};
}
