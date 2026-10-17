// Read-only exports. No Drive staging, schema writes or history scans.
var REPORT_READER_;
const REPORT_COLUMN_DEFS_ = Object.freeze({
  cases: [
    ['caseId','Mã hồ sơ','text',true],['deviceType','Loại thiết bị','text',true],['model','Model','text',true],['serialNumber','S/N','text',true],['quantity','Thiết bị/Hồ sơ','number',true],['caseKind','Kiểu hồ sơ','text',true],['fanQuantity','Fan tiếp nhận (chiếc)','number',true],['fanCompleted','Fan hoàn tất tại ngày chốt','number',true],['fanReturned','Fan đã trả tại ngày chốt','number',true],
    ['center','Trung tâm xử lý gần nhất','text',true],['status','Trạng thái xử lý hiện tại','text',true],['warrantyStatus','Bảo hành hiện tại','text',true],['receivedAt','Ngày tiếp nhận','date',true],
    ['technicalAt','Ngày hoàn tất kỹ thuật','date',true],['returnedAt','Ngày trả khách','date',true],['processingDays','Thời gian đến ngày chốt (ngày)','number',true],
    ['gsp','GSP','text',false],['ma','MA','text',false],['customerName','Tên khách hàng','text',false],['customerPhone','Số điện thoại','text',false],
    ['customerEmail','Email','text',false],['customerAddress','Địa chỉ','text',false],['note','Ghi chú nội bộ','text',false]
  ],
  centers: [
    ['center','Trung tâm','text',true],['received','Tiếp nhận trong kỳ (thiết bị)','number',true],['technicalCompleted','Hoàn tất kỹ thuật trong kỳ (thiết bị)','number',true],
    ['returned','Đã giao trong kỳ (thiết bị)','number',true],['opening','Tồn đầu kỳ (thiết bị)','number',true],['open','Tồn tại ngày chốt (thiết bị)','number',true],
    ['overdue','Quá hạn trên 14 ngày (thiết bị)','number',true],['waitingDelivery','Chờ giao tại ngày chốt (thiết bị)','number',true],['slaRate','Đạt SLA 7 ngày','percent',true],
    ['slaActualDays','SLA thực tế TB (ngày)','number',true],['slaNetDays','SLA trừ dừng TB (ngày)','number',false],['slaEligible','Thiết bị đủ căn cứ SLA','number',false],
    ['slaMet','Thiết bị đạt SLA','number',false],['unknownQuantityCases','Hồ sơ chưa xác định số lượng','number',true],['stockBalanceGap','Chênh lệch cân bằng tồn (thiết bị)','number',false]
  ]
});
function installReportReader_(reader) { REPORT_READER_ = reader; }
function reportActor_(idToken) {
  const actor = authenticate_(idToken);
  if (actor.isGlobalManager !== true) { const error=publicError_('Chỉ quản lý toàn bộ trung tâm được xuất báo cáo.');error.code='FORBIDDEN';throw error; }
  return actor;
}
function getReportBootstrap(idToken) {
  const actor=reportActor_(idToken);
  if (typeof REPORT_READER_ !== 'function') throw publicError_('Cần cập nhật LegacyDashboardApi để dùng Báo cáo.');
  const columns={};Object.keys(REPORT_COLUMN_DEFS_).forEach(function(type){columns[type]=REPORT_COLUMN_DEFS_[type].map(function(c){return {key:c[0],label:c[1],type:c[2],default:c[3]};});});
  return Object.assign({version:APP_VERSION,columns:columns,pageSize:200,maxRows:20000},REPORT_READER_({schema:true},actor));
}
function readReportPage(idToken, request) {
  const actor=reportActor_(idToken);
  if (typeof REPORT_READER_ !== 'function') throw publicError_('Cần cập nhật LegacyDashboardApi để dùng Báo cáo.');
  return REPORT_READER_(request||{},actor);
}
