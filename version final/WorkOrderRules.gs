/* Shared validation contract: mirrored verbatim in WorkOrderRules.gs. */
var SungrowWorkOrderRules=(()=>{
 const active=['Đã nhận hàng','Đang kiểm tra','Chờ linh kiện','Đang sửa chữa','Đang kiểm tra sau sửa','Đang theo dõi'];
 const controlled=['Đã chuyển hàng đi','Đã đóng công việc'];
 const outcomes=['Đã sửa chữa','Không thể sửa chữa','Đổi thiết bị','Không phát hiện lỗi'];
 const replacements=['Inverter','Battery','Logger','Meter','Khác','Fan'];
 const clean=v=>String(v??'').trim();
 function validate(p,c){
  const errors=[],status=clean(p.workflowStatus),outcome=clean(p.outcome),completed=clean(p.technicalCompletedAt),replacement=clean(p.replacementType);
  if(![...active,'Hoàn tất kỹ thuật',...controlled].includes(status))errors.push('Chọn trạng thái xử lý hợp lệ.');
  if(controlled.includes(status)&&status!==c.currentStatus)errors.push('Chuyển hàng/đóng công việc phải thực hiện qua chức năng Luân chuyển hoặc Giao trả khách hàng.');
  if(c.caseClosed&&status!==c.currentStatus)errors.push('Hồ sơ đã hoàn tất: không đổi trạng thái công việc qua biểu mẫu cập nhật kỹ thuật.');
  if(outcome&&!outcomes.includes(outcome))errors.push('Kết quả xử lý không hợp lệ.');
  if(active.includes(status)&&(outcome||completed||replacement))errors.push('Trạng thái đang xử lý chưa được có kết quả cuối, ngày hoàn tất kỹ thuật hoặc loại thiết bị đổi.');
  if(status==='Hoàn tất kỹ thuật'&&(!outcome||!completed))errors.push('Hoàn tất kỹ thuật phải có kết quả xử lý và ngày hoàn tất kỹ thuật.');
  if(controlled.includes(status)&&Boolean(outcome)!==Boolean(completed))errors.push('Kết quả xử lý và ngày hoàn tất kỹ thuật phải đi cùng nhau.');
  if(outcome==='Đổi thiết bị'&&!replacement)errors.push('Chọn loại thiết bị đổi.');
  if(replacement&&outcome!=='Đổi thiết bị')errors.push('Chỉ nhập loại thiết bị đổi khi kết quả là Đổi thiết bị.');
  if(replacement&&!replacements.includes(replacement)&&replacement!==c.previousReplacementType)errors.push('Loại thiết bị đổi không hợp lệ.');
  function date(value,label,min){
   value=clean(value);if(!value)return;
   const d=new Date(value+'T00:00:00Z');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||isNaN(d.getTime())||d.toISOString().slice(0,10)!==value){errors.push(label+' không hợp lệ.');return;}
   if(value>c.today)errors.push(label+' không được ở tương lai.');
   if(min&&value<min)errors.push(label+' không được trước ngày '+min+'.');
  }
  date(p.diagnosisCompletedAt,'Ngày hoàn tất chẩn đoán',c.receivedAt);
  date(completed,'Ngày hoàn tất kỹ thuật',clean(p.diagnosisCompletedAt)||c.receivedAt);
  const lists={};for(const kind of ['issues','parts','holds']){if(p[kind]!=null&&!Array.isArray(p[kind]))errors.push('Danh sách '+kind+' không hợp lệ.');lists[kind]=Array.isArray(p[kind])?p[kind]:[];}
  if(c.warrantyPending&&(!['Đã nhận hàng','Đang kiểm tra'].includes(status)||outcome||completed||replacement||lists.parts.some(x=>clean(x.partNumber)||clean(x.name))))errors.push('Cần xác nhận bảo hành trước khi sửa chữa, sử dụng linh kiện hoặc hoàn tất kỹ thuật.');
  lists.issues.forEach(x=>{if(clean(x.code)&&!clean(x.name))errors.push('Nhập tên lỗi cho mã lỗi đã điền.');if(clean(x.name))date(x.confirmedAt,'Ngày xác nhận lỗi',c.receivedAt);});
  lists.parts.forEach(x=>{
   if(!clean(x.partNumber)&&!clean(x.name))return;
   if(!clean(x.name))errors.push('Nhập tên linh kiện.');
   if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0)errors.push('Số lượng linh kiện phải lớn hơn 0.');
   const label=clean(x.partNumber)||clean(x.name);
   date(x.receivedAt,'Ngày nhận linh kiện '+label);
   date(x.usedAt,'Ngày sử dụng linh kiện '+label,clean(x.receivedAt)||c.receivedAt);
  });
  lists.holds.forEach(x=>{if(!clean(x.reason)&&!clean(x.startAt)&&!clean(x.endAt))return;if(!clean(x.reason)||!clean(x.startAt))errors.push('Tạm dừng SLA phải có lý do và ngày bắt đầu.');date(x.startAt,'Ngày bắt đầu tạm dừng',c.receivedAt);date(x.endAt,'Ngày kết thúc tạm dừng',clean(x.startAt)||c.receivedAt);});
  return Array.from(new Set(errors));
 }
 return {active,controlled,outcomes,replacements,validate};
})();
