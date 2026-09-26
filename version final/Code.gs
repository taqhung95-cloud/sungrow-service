const APP_VERSION = '1.1.1-final';
const DATABASE_SPREADSHEET_ID = '1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI';
const GOOGLE_WEB_CLIENT_ID = '1057611730150-6ds8o36jv1haln4h6tcl1gilh31o7hqn.apps.googleusercontent.com';
const AUTH_BROKER_URL = 'https://taqhung95-cloud.github.io/sungrow-service/data-entry-login.html';

const SHEETS = Object.freeze({
  cases: 'Hồ sơ thiết bị',
  workOrders: 'Công việc trung tâm',
  transfers: 'Luân chuyển thiết bị',
  issues: 'Lỗi thiết bị',
  parts: 'Linh kiện sử dụng',
  holds: 'Tạm dừng SLA',
  users: 'Người dùng',
  audit: 'Nhật ký thay đổi',
  dashboard: 'Dữ liệu dashboard'
});

const CENTERS = Object.freeze([
  'Sungrow Service Center',
  'XBSolar Center',
  'DAT Center',
  'BKE Center',
  'JGP Center'
]);
const WARRANTY_STATUSES = Object.freeze(['Trong bảo hành', 'Ngoài bảo hành', 'Sửa làm hàng good']);
const PRE_WARRANTY_WORKFLOW_STATUSES = Object.freeze(['Đã nhận hàng', 'Đang kiểm tra']);
const SUNGROW_CENTER = 'Sungrow Service Center';

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.authBrokerUrl = AUTH_BROKER_URL;
  template.appVersion = APP_VERSION;
  return template.evaluate()
    .setTitle('Sungrow Service Center - Quản lý & nhập liệu')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getBootstrap(idToken) {
  const actor = authenticate_(idToken);
  return {
    actor: publicActor_(actor),
    centers: actor.isGlobalManager ? CENTERS.slice() : actor.centers.slice(),
    allCenters: CENTERS.slice(),
    version: APP_VERSION
  };
}

function listCases(idToken, filters) {
  const actor = authenticate_(idToken);
  filters = filters || {};
  const query = clean_(filters.query).toLowerCase();
  const status = clean_(filters.status);
  const warrantyStatus = clean_(filters.warrantyStatus);
  const center = clean_(filters.center);
  const pageSize = Math.max(10, Math.min(200, Number(filters.pageSize) || 20));
  const requestedPage = Math.max(1, Number(filters.page) || 1);

  const cases = readTable_(SHEETS.cases);
  const workOrders = readTable_(SHEETS.workOrders);
  const transfers = readTable_(SHEETS.transfers);
  const workByCase = groupBy_(workOrders, 'Mã hồ sơ');
  const transferByCase = groupBy_(transfers, 'Mã hồ sơ');

  const filtered = cases.filter(function (item) {
    const ownWorks = workByCase[item['Mã hồ sơ']] || [];
    if (!canSeeCase_(actor, item, ownWorks)) return false;
    const searchable = [
      item['Mã hồ sơ'], item['Số sê-ri (S/N)'], item.Model, senderFromCase_(item), item['Dự án/Địa điểm'],
      item['Tên khách hàng'], item['Số điện thoại khách hàng'], item['Email khách hàng'],
      item['Tên công ty gửi hàng'], item['Tên người gửi hàng'], item['Số điện thoại gửi hàng'],
      item['Email gửi hàng'], item['Đơn vị vận chuyển'], item['Mã vận đơn']
    ].join(' ').toLowerCase();
    if (query && searchable.indexOf(query) === -1) return false;
    if (status && item['Trạng thái hồ sơ'] !== status) return false;
    if (warrantyStatus && item['Tình trạng bảo hành'] !== warrantyStatus) return false;
    if (center && item['Trung tâm đang giữ hàng'] !== center) return false;
    return true;
  }).reverse();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map(function (item) {
    return publicCase_(actor, item, workByCase[item['Mã hồ sơ']] || [], transferByCase[item['Mã hồ sơ']] || []);
  });
  return { items: items, total: total, page: page, pageSize: pageSize, totalPages: totalPages };
}

function searchCases(idToken, rawQuery) {
  const query = clean_(rawQuery);
  if (query.length < 2) throw publicError_('Nhập ít nhất 2 ký tự để tìm kiếm.');
  return listCases(idToken, { query: query, page: 1, pageSize: 200 }).items;
}

function createCase(idToken, payload) {
  const actor = authenticate_(idToken);
  payload = payload || {};
  const center = required_(payload.intakeCenter, 'Trung tâm tiếp nhận');
  assertCenterAllowed_(actor, center);
  const receivedAt = parseDateRequired_(payload.receivedAt, 'Ngày nhận từ khách');
  const deviceType = required_(payload.deviceType, 'Loại thiết bị');
  const model = required_(payload.model, 'Model');
  const serial = required_(payload.serialNumber, 'Số sê-ri (S/N)');
  const customerName = required_(payload.customerName, 'Tên khách hàng');
  const customerAddress = required_(payload.customerAddress, 'Địa chỉ khách hàng');
  const customerPhone = required_(payload.customerPhone, 'Số điện thoại khách hàng');
  const customerEmail = emailOptional_(payload.customerEmail, 'Email khách hàng');
  const senderCompany = clean_(payload.senderCompany);
  const senderCustomer = required_(payload.senderCustomer, 'Tên người gửi hàng');
  const senderAddress = required_(payload.senderAddress, 'Địa chỉ gửi hàng');
  const senderPhone = required_(payload.senderPhone, 'Số điện thoại gửi hàng');
  const senderEmail = emailOptional_(payload.senderEmail, 'Email gửi hàng');
  const carrier = required_(payload.carrier, 'Đơn vị vận chuyển');
  const trackingCode = required_(payload.trackingCode, 'Mã vận đơn');
  const sender = senderCompany || senderCustomer;
  const project = clean_(payload.project);
  const initialIssue = required_(payload.initialIssue, 'Hiện tượng ban đầu');
  const evidenceLink = required_(payload.evidenceLink, 'Liên kết hồ sơ Drive');
  validateDriveLink_(evidenceLink);
  const quantity = Math.max(1, Number(payload.quantity || 1));
  if (!Number.isFinite(quantity)) throw publicError_('Số lượng không hợp lệ.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const caseId = makeId_('HS');
    const workOrderId = makeId_('CV');
    const now = new Date();
    appendObject_(SHEETS.cases, {
      'Mã hồ sơ': caseId,
      'Loại thiết bị': deviceType,
      'Số sê-ri (S/N)': serial,
      'Model': model,
      'Số lượng': quantity,
      'Trung tâm tiếp nhận khách': center,
      'Ngày nhận từ khách': receivedAt,
      'Trung tâm đang giữ hàng': center,
      'Trạng thái hồ sơ': 'Mới tiếp nhận',
      'Tình trạng bảo hành': 'Chờ xác nhận',
      'Nơi gửi hàng': sender,
      'Đơn vị gửi hàng': sender,
      'Dự án/Địa điểm': project,
      'Ghi chú chung': clean_(payload.note),
      'Liên kết hồ sơ Drive': evidenceLink,
      'Tên khách hàng': customerName,
      'Địa chỉ khách hàng': customerAddress,
      'Số điện thoại khách hàng': customerPhone,
      'Email khách hàng': customerEmail,
      'Tên công ty gửi hàng': senderCompany,
      'Tên người gửi hàng': senderCustomer,
      'Địa chỉ gửi hàng': senderAddress,
      'Số điện thoại gửi hàng': senderPhone,
      'Email gửi hàng': senderEmail,
      'Đơn vị vận chuyển': carrier,
      'Mã vận đơn': trackingCode,
      'Nguồn dữ liệu': 'Quy trình mới',
      'Người tạo': actor.email,
      'Ngày tạo': now,
      'Người cập nhật gần nhất': actor.email,
      'Ngày cập nhật gần nhất': now
    });
    appendObject_(SHEETS.workOrders, {
      'Mã công việc': workOrderId,
      'Mã hồ sơ': caseId,
      'Trung tâm xử lý': center,
      'Ngày trung tâm nhận hàng': receivedAt,
      'Trạng thái xử lý': 'Đã nhận hàng',
      'Ghi chú nội bộ': initialIssue,
      'Người tạo': actor.email,
      'Ngày tạo': now,
      'Người cập nhật': actor.email,
      'Ngày cập nhật': now
    });
    if (initialIssue) {
      appendObject_(SHEETS.issues, {
        'Mã ghi nhận lỗi': makeId_('LOI'),
        'Mã công việc': workOrderId,
        'Loại ghi nhận': 'Hiện tượng ban đầu',
        'Tên lỗi': initialIssue,
        'Ngày xác nhận lỗi': receivedAt,
        'Ghi chú lỗi': ''
      });
    }
    audit_(actor, 'Tạo hồ sơ', 'Hồ sơ', caseId, center, null, { workOrderId: workOrderId });
    refreshDashboardData_();
    return { caseId: caseId, workOrderId: workOrderId };
  } finally {
    lock.releaseLock();
  }
}

function confirmWarranty(idToken, payload) {
  const actor = authenticate_(idToken);
  payload = payload || {};
  if (!canApproveWarranty_(actor)) {
    throw publicError_('Chỉ Quản lý dịch vụ hoặc Quản lý Sungrow Service Center được xác nhận bảo hành.');
  }
  const caseId = required_(payload.caseId, 'Mã hồ sơ');
  const warrantyStatus = required_(payload.warrantyStatus, 'Tình trạng bảo hành');
  if (WARRANTY_STATUSES.indexOf(warrantyStatus) === -1) throw publicError_('Tình trạng bảo hành không hợp lệ.');
  const table = readTableWithRows_(SHEETS.cases);
  const record = table.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!record) throw publicError_('Không tìm thấy hồ sơ.');
  assertCaseEditable_(actor, record);
  const note = clean_(payload.note);
  const currentStatus = clean_(record['Tình trạng bảo hành']);
  if (WARRANTY_STATUSES.indexOf(currentStatus) !== -1 && currentStatus !== warrantyStatus && !note) {
    throw publicError_('Cần ghi chú khi thay đổi kết quả xác nhận bảo hành.');
  }
  const changes = {
    'Tình trạng bảo hành': warrantyStatus,
    'Người xác nhận bảo hành': actor.email,
    'Ngày xác nhận bảo hành': new Date(),
    'Ghi chú xác nhận bảo hành': note,
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': new Date()
  };
  updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
  audit_(actor, 'Xác nhận bảo hành', 'Hồ sơ', caseId, record['Trung tâm đang giữ hàng'], record, changes);
  refreshDashboardData_();
  return { ok: true, warrantyStatus: warrantyStatus };
}

function updateWorkOrder(idToken, payload) {
  const actor = authenticate_(idToken);
  payload = payload || {};
  const workOrderId = required_(payload.workOrderId, 'Mã công việc');
  const table = readTableWithRows_(SHEETS.workOrders);
  const record = table.rows.find(function (row) { return row['Mã công việc'] === workOrderId; });
  if (!record) throw publicError_('Không tìm thấy công việc.');
  assertCenterAllowed_(actor, record['Trung tâm xử lý']);
  if (!actor.isGlobalManager && ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(record['Trạng thái xử lý']) !== -1) {
    throw publicError_('Công việc đã kết thúc tại center này và không thể cập nhật thêm.');
  }

  const caseRecord = readTable_(SHEETS.cases).find(function (row) { return row['Mã hồ sơ'] === record['Mã hồ sơ']; });
  if (!caseRecord) throw publicError_('Không tìm thấy hồ sơ của công việc.');
  assertCaseEditable_(actor, caseRecord);
  const requestedStatus = required_(payload.workflowStatus, 'Trạng thái xử lý');
  const warrantyPending = clean_(caseRecord['Tình trạng bảo hành']) === 'Chờ xác nhận';
  const hasParts = (payload.parts || []).some(function (item) { return clean_(item.partNumber); });
  if (warrantyPending && (PRE_WARRANTY_WORKFLOW_STATUSES.indexOf(requestedStatus) === -1 || payload.technicalCompletedAt || payload.outcome || hasParts)) {
    throw publicError_('Quản lý dịch vụ hoặc Quản lý Sungrow phải xác nhận tình trạng bảo hành trước khi sửa chữa, sử dụng linh kiện hoặc hoàn tất kỹ thuật.');
  }

  const changes = {
    'Trạng thái xử lý': requestedStatus,
    'Ngày hoàn tất chẩn đoán': parseDateOptional_(payload.diagnosisCompletedAt),
    'Ngày hoàn tất kỹ thuật': parseDateOptional_(payload.technicalCompletedAt),
    'Kết quả xử lý': clean_(payload.outcome),
    'Loại thiết bị đổi': clean_(payload.replacementType),
    'Ghi chú nội bộ': clean_(payload.note),
    'Người cập nhật': actor.email,
    'Ngày cập nhật': new Date()
  };
  if ((requestedStatus === 'Hoàn tất kỹ thuật' || changes['Kết quả xử lý']) && !changes['Ngày hoàn tất kỹ thuật']) {
    throw publicError_('Hoàn tất kỹ thuật bắt buộc có Ngày hoàn tất kỹ thuật.');
  }
  if (requestedStatus === 'Hoàn tất kỹ thuật' && !changes['Kết quả xử lý']) {
    throw publicError_('Hoàn tất kỹ thuật bắt buộc có Kết quả xử lý.');
  }
  if (changes['Kết quả xử lý'] === 'Đổi thiết bị' && !changes['Loại thiết bị đổi']) {
    throw publicError_('Vui lòng chọn loại thiết bị đổi.');
  }
  validateTechnicalDates_(record, changes);
  updateObjectRow_(SHEETS.workOrders, table.headers, record.__rowNumber, changes);
  updateCaseAfterWork_(record['Mã hồ sơ'], actor, changes);
  replaceWorkOrderChildren_(actor, workOrderId, payload.issues || [], payload.parts || []);
  if (changes['Ngày hoàn tất kỹ thuật']) fillMissingPartUsageDates_(workOrderId, changes['Ngày hoàn tất kỹ thuật']);
  appendWorkOrderHolds_(actor, workOrderId, payload.holds || []);
  audit_(actor, 'Cập nhật xử lý', 'Công việc', workOrderId, record['Trung tâm xử lý'], record, changes);
  refreshDashboardData_();
  return { ok: true };
}

function createTransfer(idToken, payload) {
  const actor = authenticate_(idToken);
  payload = payload || {};
  const caseId = required_(payload.caseId, 'Mã hồ sơ');
  const destination = required_(payload.toCenter, 'Trung tâm nhận');
  const sentAt = parseDateRequired_(payload.dispatchedAt, 'Ngày gửi');
  if (CENTERS.indexOf(destination) === -1) throw publicError_('Trung tâm nhận không hợp lệ.');

  const caseTable = readTableWithRows_(SHEETS.cases);
  const caseRecord = caseTable.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!caseRecord) throw publicError_('Không tìm thấy hồ sơ.');
  assertCaseEditable_(actor, caseRecord);
  const source = caseRecord['Trung tâm đang giữ hàng'];
  assertCenterAllowed_(actor, source);
  if (source === destination) throw publicError_('Trung tâm nhận phải khác trung tâm gửi.');

  const sourceWork = latestWorkOrder_(caseId, source);
  if (!sourceWork) throw publicError_('Không tìm thấy công việc của trung tâm gửi.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const transferId = makeId_('LC');
    const destinationWorkId = makeId_('CV');
    const now = new Date();
    appendObject_(SHEETS.workOrders, {
      'Mã công việc': destinationWorkId,
      'Mã hồ sơ': caseId,
      'Trung tâm xử lý': destination,
      'Trạng thái xử lý': 'Chờ nhận hàng',
      'Người tạo': actor.email,
      'Ngày tạo': now,
      'Người cập nhật': actor.email,
      'Ngày cập nhật': now
    });
    appendObject_(SHEETS.transfers, {
      'Mã luân chuyển': transferId,
      'Mã hồ sơ': caseId,
      'Mã công việc gửi': sourceWork['Mã công việc'],
      'Mã công việc nhận': destinationWorkId,
      'Trung tâm gửi': source,
      'Trung tâm nhận': destination,
      'Ngày gửi': sentAt,
      'Trạng thái luân chuyển': 'Đang vận chuyển',
      'Mã vận chuyển': clean_(payload.trackingReference),
      'Người bàn giao': actor.email,
      'Ghi chú bàn giao': clean_(payload.note)
    });
    updateObjectRow_(SHEETS.workOrders, tableHeaders_(SHEETS.workOrders), sourceWork.__rowNumber, {
      'Trạng thái xử lý': 'Đã chuyển hàng đi',
      'Ngày chuyển hàng đi': sentAt,
      'Người cập nhật': actor.email,
      'Ngày cập nhật': now
    });
    updateObjectRow_(SHEETS.cases, caseTable.headers, caseRecord.__rowNumber, {
      'Trạng thái hồ sơ': 'Đang luân chuyển',
      'Người cập nhật gần nhất': actor.email,
      'Ngày cập nhật gần nhất': now
    });
    audit_(actor, 'Tạo luân chuyển', 'Luân chuyển', transferId, source, null, { toCenter: destination, caseId: caseId });
    refreshDashboardData_();
    return { transferId: transferId, destinationWorkOrderId: destinationWorkId };
  } finally {
    lock.releaseLock();
  }
}

function acceptTransfer(idToken, payload) {
  const actor = authenticate_(idToken);
  payload = payload || {};
  const transferId = required_(payload.transferId, 'Mã luân chuyển');
  const receivedAt = parseDateRequired_(payload.receivedAt, 'Ngày nhận');
  const transferTable = readTableWithRows_(SHEETS.transfers);
  const transfer = transferTable.rows.find(function (row) { return row['Mã luân chuyển'] === transferId; });
  if (!transfer) throw publicError_('Không tìm thấy lần luân chuyển.');
  assertCenterAllowed_(actor, transfer['Trung tâm nhận']);
  if (transfer['Trạng thái luân chuyển'] === 'Đã nhận') throw publicError_('Luân chuyển này đã được xác nhận nhận.');
  const sentAt = asDate_(transfer['Ngày gửi']);
  if (sentAt && receivedAt < sentAt) throw publicError_('Ngày nhận không được trước ngày gửi.');

  const workTable = readTableWithRows_(SHEETS.workOrders);
  const work = workTable.rows.find(function (row) { return row['Mã công việc'] === transfer['Mã công việc nhận']; });
  const caseTable = readTableWithRows_(SHEETS.cases);
  const caseRecord = caseTable.rows.find(function (row) { return row['Mã hồ sơ'] === transfer['Mã hồ sơ']; });
  if (!caseRecord) throw publicError_('Không tìm thấy hồ sơ của lần luân chuyển.');
  assertCaseEditable_(actor, caseRecord);
  const now = new Date();
  updateObjectRow_(SHEETS.transfers, transferTable.headers, transfer.__rowNumber, {
    'Ngày xác nhận nhận': receivedAt,
    'Trạng thái luân chuyển': 'Đã nhận',
    'Người xác nhận nhận': actor.email
  });
  updateObjectRow_(SHEETS.workOrders, workTable.headers, work.__rowNumber, {
    'Ngày trung tâm nhận hàng': receivedAt,
    'Trạng thái xử lý': 'Đã nhận hàng',
    'Người cập nhật': actor.email,
    'Ngày cập nhật': now
  });
  updateObjectRow_(SHEETS.cases, caseTable.headers, caseRecord.__rowNumber, {
    'Trung tâm đang giữ hàng': transfer['Trung tâm nhận'],
    'Trạng thái hồ sơ': 'Đang xử lý',
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': now
  });
  audit_(actor, 'Xác nhận nhận luân chuyển', 'Luân chuyển', transferId, transfer['Trung tâm nhận'], transfer, { receivedAt: receivedAt });
  refreshDashboardData_();
  return { ok: true };
}

function returnToCustomer(idToken, payload) {
  const actor = authenticate_(idToken);
  payload = payload || {};
  const caseId = required_(payload.caseId, 'Mã hồ sơ');
  const readyAt = parseDateOptional_(payload.readyAt);
  const returnedAt = parseDateRequired_(payload.returnedAt, 'Ngày trả khách');
  const table = readTableWithRows_(SHEETS.cases);
  const record = table.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!record) throw publicError_('Không tìm thấy hồ sơ.');
  assertCaseEditable_(actor, record);
  assertCenterAllowed_(actor, record['Trung tâm tiếp nhận khách']);
  if (record['Trung tâm đang giữ hàng'] !== record['Trung tâm tiếp nhận khách']) throw publicError_('Thiết bị phải được chuyển về center tiếp nhận trước khi trả khách.');
  if (clean_(record['Tình trạng bảo hành']) === 'Chờ xác nhận') throw publicError_('Cần xác nhận tình trạng bảo hành trước khi giao trả khách hàng.');
  const receivedAt = asDate_(record['Ngày nhận từ khách']);
  if (receivedAt && returnedAt < receivedAt) throw publicError_('Ngày trả khách không được trước ngày nhận.');
  if (readyAt && returnedAt < readyAt) throw publicError_('Ngày trả khách không được trước ngày sẵn sàng trả.');
  const changes = {
    'Ngày sẵn sàng trả khách': readyAt,
    'Ngày trả khách': returnedAt,
    'Trạng thái hồ sơ': 'Đã hoàn tất',
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': new Date()
  };
  updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
  audit_(actor, 'Trả khách hàng', 'Hồ sơ', caseId, record['Trung tâm tiếp nhận khách'], record, changes);
  refreshDashboardData_();
  return { ok: true };
}

function authenticate_(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 5000) throw publicError_('Vui lòng đăng nhập bằng tài khoản Google được cấp quyền.');
  const cache = CacheService.getScriptCache();
  const key = 'entry-token:' + digest_(idToken);
  let claims = parseJson_(cache.get(key));
  if (!claims) {
    const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw publicError_('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    claims = JSON.parse(response.getContentText());
    if (claims.aud !== GOOGLE_WEB_CLIENT_ID) throw publicError_('Token không thuộc ứng dụng này.');
    if (['accounts.google.com', 'https://accounts.google.com'].indexOf(claims.iss) === -1) throw publicError_('Nguồn đăng nhập không hợp lệ.');
    if (Number(claims.exp || 0) * 1000 <= Date.now()) throw publicError_('Phiên đăng nhập đã hết hạn.');
    if (!(claims.email_verified === true || claims.email_verified === 'true')) throw publicError_('Email Google chưa được xác minh.');
    cache.put(key, JSON.stringify(claims), Math.max(1, Math.min(300, Math.floor(Number(claims.exp) - Date.now() / 1000))));
  }
  if (!clean_(claims.sub)) throw publicError_('Token Google thiếu định danh tài khoản.');
  const email = String(claims.email || '').toLowerCase();
  const googleSub = clean_(claims.sub);
  let usersTable = readTableWithRows_(SHEETS.users);
  let user = usersTable.rows.find(function (item) {
    return clean_(item.GoogleSub) === googleSub && bool_(item['Đang hoạt động']);
  });
  if (!user) {
    user = usersTable.rows.find(function (item) {
      return String(item['Email Google'] || '').toLowerCase() === email && bool_(item['Đang hoạt động']);
    });
    if (user && clean_(user.GoogleSub) && clean_(user.GoogleSub) !== googleSub) {
      throw publicError_('Tài khoản Google không khớp định danh đã được cấp quyền.');
    }
    if (user && !clean_(user.GoogleSub)) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        usersTable = readTableWithRows_(SHEETS.users);
        user = usersTable.rows.find(function (item) {
          return String(item['Email Google'] || '').toLowerCase() === email && bool_(item['Đang hoạt động']);
        });
        if (!user) throw publicError_('Tài khoản chưa được cấp quyền sử dụng hệ thống.');
        if (clean_(user.GoogleSub) && clean_(user.GoogleSub) !== googleSub) {
          throw publicError_('Tài khoản Google không khớp định danh đã được cấp quyền.');
        }
        if (!clean_(user.GoogleSub)) {
          updateObjectRow_(SHEETS.users, usersTable.headers, user.__rowNumber, { GoogleSub: googleSub });
          user.GoogleSub = googleSub;
        }
      } finally {
        lock.releaseLock();
      }
    }
  }
  if (!user) throw publicError_('Tài khoản chưa được cấp quyền sử dụng ứng dụng nhập liệu.');
  const isGlobalManager = user['Vai trò'] === 'Quản lý dịch vụ' || (user['Vai trò'] === 'Quản lý trung tâm' && user['Trung tâm'] === SUNGROW_CENTER);
  const all = isGlobalManager;
  return { email: email, googleSub: googleSub, name: clean_(user['Họ và tên']), role: user['Vai trò'], homeCenter: clean_(user['Trung tâm']), centers: all ? CENTERS.slice() : [user['Trung tâm']], isGlobalManager: isGlobalManager };
}

function authenticateDashboardManager_(idToken) {
  const actor = authenticate_(idToken);
  if (!actor.isGlobalManager) throw publicError_('Chỉ tài khoản quản lý Sungrow được xem dashboard.');
  return { email: actor.email, role: 'service_manager', centers: actor.centers.slice() };
}

function canSeeCase_(actor, item, workOrders) {
  if (actor.isGlobalManager) return true;
  if (actor.centers.indexOf(item['Trung tâm tiếp nhận khách']) !== -1) return true;
  if (actor.centers.indexOf(item['Trung tâm đang giữ hàng']) !== -1) return true;
  return workOrders.some(function (work) { return actor.centers.indexOf(work['Trung tâm xử lý']) !== -1; });
}

function publicCase_(actor, item, workOrders, transfers) {
  const isManager = actor.isGlobalManager;
  const isClosed = clean_(item['Trạng thái hồ sơ']) === 'Đã hoàn tất';
  const canEditCase = !isClosed || isManager;
  const isIntake = isManager || actor.centers.indexOf(item['Trung tâm tiếp nhận khách']) !== -1;
  const ownWorks = isManager ? workOrders : workOrders.filter(function (work) { return actor.centers.indexOf(work['Trung tâm xử lý']) !== -1; });
  const relevantTransfers = transfers.filter(function (transfer) {
    return isManager || actor.centers.indexOf(transfer['Trung tâm gửi']) !== -1 || actor.centers.indexOf(transfer['Trung tâm nhận']) !== -1;
  }).map(function (transfer) {
    return {
      transferId: transfer['Mã luân chuyển'],
      fromCenter: transfer['Trung tâm gửi'],
      toCenter: transfer['Trung tâm nhận'],
      dispatchedAt: iso_(transfer['Ngày gửi']),
      receivedAt: iso_(transfer['Ngày xác nhận nhận']),
      status: transfer['Trạng thái luân chuyển'],
      canAccept: canEditCase && actor.centers.indexOf(transfer['Trung tâm nhận']) !== -1 && transfer['Trạng thái luân chuyển'] === 'Đang vận chuyển'
    };
  });
  return {
    caseId: item['Mã hồ sơ'], deviceType: item['Loại thiết bị'], serialNumber: item['Số sê-ri (S/N)'], model: item.Model,
    quantity: Number(item['Số lượng'] || 1), intakeCenter: item['Trung tâm tiếp nhận khách'], currentCenter: item['Trung tâm đang giữ hàng'],
    caseStatus: item['Trạng thái hồ sơ'], warrantyStatus: item['Tình trạng bảo hành'],
    sender: senderFromCase_(item), project: projectFromCase_(item), evidenceLink: safeDriveLink_(item['Liên kết hồ sơ Drive']), note: item['Ghi chú chung'],
    customerName: item['Tên khách hàng'], customerAddress: item['Địa chỉ khách hàng'], customerPhone: item['Số điện thoại khách hàng'], customerEmail: item['Email khách hàng'],
    senderCompany: item['Tên công ty gửi hàng'], senderCustomer: item['Tên người gửi hàng'], senderAddress: item['Địa chỉ gửi hàng'], senderPhone: item['Số điện thoại gửi hàng'],
    senderEmail: item['Email gửi hàng'], carrier: item['Đơn vị vận chuyển'], trackingCode: item['Mã vận đơn'],
    createdBy: item['Người tạo'], createdAt: iso_(item['Ngày tạo']),
    warrantyConfirmedBy: item['Người xác nhận bảo hành'], warrantyConfirmedAt: iso_(item['Ngày xác nhận bảo hành']), warrantyNote: item['Ghi chú xác nhận bảo hành'],
    isClosed: isClosed, canEditCase: canEditCase, canConfirmWarranty: canEditCase && canApproveWarranty_(actor), receivedAt: isIntake ? iso_(item['Ngày nhận từ khách']) : null,
    readyAt: isIntake ? iso_(item['Ngày sẵn sàng trả khách']) : null, returnedAt: isIntake ? iso_(item['Ngày trả khách']) : null,
    workOrders: ownWorks.map(function (work) { const value = publicWorkOrder_(work); value.canUpdate = canEditCase && (isManager || ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(work['Trạng thái xử lý']) === -1); return value; }), transfers: relevantTransfers,
    canTransfer: canEditCase && (isManager || actor.centers.indexOf(item['Trung tâm đang giữ hàng']) !== -1),
    canReturn: canEditCase && isIntake && item['Trung tâm đang giữ hàng'] === item['Trung tâm tiếp nhận khách'] && item['Tình trạng bảo hành'] !== 'Chờ xác nhận'
  };
}

function publicWorkOrder_(work) {
  return {
    workOrderId: work['Mã công việc'], center: work['Trung tâm xử lý'], receivedAt: iso_(work['Ngày trung tâm nhận hàng']),
    workflowStatus: work['Trạng thái xử lý'], diagnosisCompletedAt: iso_(work['Ngày hoàn tất chẩn đoán']),
    technicalCompletedAt: iso_(work['Ngày hoàn tất kỹ thuật']), outcome: work['Kết quả xử lý'], replacementType: work['Loại thiết bị đổi'],
    releasedAt: iso_(work['Ngày chuyển hàng đi']), note: work['Ghi chú nội bộ']
  };
}

function replaceWorkOrderChildren_(actor, workOrderId, issues, parts) {
  issues.filter(function (item) { return clean_(item.name); }).forEach(function (item) {
    appendObject_(SHEETS.issues, {
      'Mã ghi nhận lỗi': makeId_('LOI'), 'Mã công việc': workOrderId, 'Loại ghi nhận': clean_(item.type) || 'Lỗi xác nhận',
      'Mã lỗi': clean_(item.code), 'Tên lỗi': clean_(item.name), 'Ngày xác nhận lỗi': parseDateOptional_(item.confirmedAt) || new Date(), 'Ghi chú lỗi': clean_(item.note)
    });
  });
  parts.filter(function (item) { return clean_(item.partNumber); }).forEach(function (item) {
    const partNumber = required_(item.partNumber, 'Mã linh kiện');
    const partName = required_(item.name, 'Tên linh kiện');
    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw publicError_('Số lượng linh kiện phải lớn hơn 0.');
    appendObject_(SHEETS.parts, {
      'Mã sử dụng linh kiện': makeId_('LK'), 'Mã công việc': workOrderId, 'Mã linh kiện (Part Number)': partNumber,
      'Tên linh kiện': partName, 'Số lượng': quantity, 'Ngày nhận linh kiện': parseDateOptional_(item.receivedAt),
      'Ngày sử dụng': parseDateOptional_(item.usedAt), 'Ghi chú': clean_(item.note)
    });
  });
}

function fillMissingPartUsageDates_(workOrderId, usedAt) {
  const table = readTableWithRows_(SHEETS.parts);
  table.rows.filter(function (row) { return row['Mã công việc'] === workOrderId && !row['Ngày sử dụng']; }).forEach(function (row) {
    updateObjectRow_(SHEETS.parts, table.headers, row.__rowNumber, { 'Ngày sử dụng': usedAt });
  });
}

function appendWorkOrderHolds_(actor, workOrderId, holds) {
  holds.filter(function (item) { return clean_(item.reason) && item.startAt; }).forEach(function (item) {
    const startAt = parseDateRequired_(item.startAt, 'Ngày bắt đầu tạm dừng');
    const endAt = parseDateOptional_(item.endAt);
    if (endAt && endAt < startAt) throw publicError_('Ngày kết thúc tạm dừng không được trước ngày bắt đầu.');
    appendObject_(SHEETS.holds, {
      'Mã tạm dừng': makeId_('TD'), 'Mã công việc': workOrderId, 'Lý do tạm dừng': clean_(item.reason),
      'Ngày bắt đầu': startAt, 'Ngày kết thúc': endAt, 'Ghi chú/Xác nhận': clean_(item.note), 'Người cập nhật': actor.email
    });
  });
}
function updateCaseAfterWork_(caseId, actor, changes) {
  const table = readTableWithRows_(SHEETS.cases);
  const record = table.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!record) return;
  const terminal = !!changes['Kết quả xử lý'];
  const atIntakeCenter = record['Trung tâm đang giữ hàng'] === record['Trung tâm tiếp nhận khách'];
  updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, {
    'Trạng thái hồ sơ': terminal && atIntakeCenter ? 'Sẵn sàng trả khách' : 'Đang xử lý',
    'Ngày sẵn sàng trả khách': terminal && atIntakeCenter ? changes['Ngày hoàn tất kỹ thuật'] : record['Ngày sẵn sàng trả khách'],
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': new Date()
  });
}

function validateTechnicalDates_(record, changes) {
  const received = asDate_(record['Ngày trung tâm nhận hàng']);
  const diagnosis = asDate_(changes['Ngày hoàn tất chẩn đoán']);
  const completed = asDate_(changes['Ngày hoàn tất kỹ thuật']);
  if (received && diagnosis && diagnosis < received) throw publicError_('Ngày hoàn tất chẩn đoán không được trước ngày trung tâm nhận hàng.');
  if (received && completed && completed < received) throw publicError_('Ngày hoàn tất kỹ thuật không được trước ngày trung tâm nhận hàng.');
  if (diagnosis && completed && completed < diagnosis) throw publicError_('Ngày hoàn tất kỹ thuật không được trước ngày hoàn tất chẩn đoán.');
}

function latestWorkOrder_(caseId, center) {
  const rows = readTableWithRows_(SHEETS.workOrders).rows.filter(function (row) { return row['Mã hồ sơ'] === caseId && row['Trung tâm xử lý'] === center; });
  return rows.length ? rows[rows.length - 1] : null;
}

function assertCenterAllowed_(actor, center) {
  if (!actor.isGlobalManager && actor.centers.indexOf(center) === -1) throw publicError_('Bạn không có quyền thao tác dữ liệu của trung tâm này.');
}

function readTable_(sheetName) { return readTableWithRows_(sheetName).rows; }

function readTableWithRows_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Thiếu tab ' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0].map(clean_);
  const rows = values.slice(1).map(function (row, index) {
    const item = { __rowNumber: index + 2 };
    headers.forEach(function (header, col) { item[header] = row[col]; });
    return item;
  }).filter(function (item) { return headers.some(function (header) { return item[header] !== '' && item[header] != null; }); });
  return { headers: headers, rows: rows };
}

function appendObject_(sheetName, object) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const headers = tableHeaders_(sheetName);
  sheet.appendRow(headers.map(function (header) { return object[header] == null ? '' : object[header]; }));
}

function updateObjectRow_(sheetName, headers, rowNumber, changes) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  headers.forEach(function (header, index) {
    if (!Object.prototype.hasOwnProperty.call(changes, header)) return;
    sheet.getRange(rowNumber, index + 1).setValue(changes[header] == null ? '' : changes[header]);
  });
}

function tableHeaders_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
}

function audit_(actor, action, type, id, center, before, after) {
  appendObject_(SHEETS.audit, {
    'Thời gian': new Date(), 'Email người dùng': actor.email, 'Hành động': action, 'Loại đối tượng': type,
    'Mã đối tượng': id, 'Trung tâm': center, 'Dữ liệu trước': before ? JSON.stringify(stripInternal_(before)) : '', 'Dữ liệu sau': after ? JSON.stringify(after) : ''
  });
}

function refreshDashboardData_() {
  try {
    const sheet = spreadsheet_().getSheetByName(SHEETS.dashboard);
    if (!sheet) return;
    const cases = readTable_(SHEETS.cases);
    const worksByCase = groupBy_(readTable_(SHEETS.workOrders), 'Mã hồ sơ');
    const issuesByWork = groupBy_(readTable_(SHEETS.issues), 'Mã công việc');
    const partsByWork = groupBy_(readTable_(SHEETS.parts), 'Mã công việc');
    const rows = cases.map(function (item, index) {
      const works = worksByCase[item['Mã hồ sơ']] || [];
      const latest = works.length ? works[works.length - 1] : {};
      const issues = [];
      const parts = [];
      works.forEach(function (work) {
        (issuesByWork[work['Mã công việc']] || []).forEach(function (issue) { issues.push(issue); });
        (partsByWork[work['Mã công việc']] || []).forEach(function (part) { parts.push(part); });
      });
      const issueNames = issues.map(function (issue) { return clean_(issue['Tên lỗi']); }).filter(Boolean);
      const errorCode = issues.map(function (issue) { return clean_(issue['Mã lỗi']); }).filter(Boolean)[0] || '';
      const caseStatus = clean_(item['Trạng thái hồ sơ']);
      const deliveryStatus = caseStatus === 'Đã hoàn tất' ? 'Đã giao máy' : (caseStatus === 'Sẵn sàng trả khách' ? 'Chờ giao máy' : 'Chưa giao máy');
      const row = [
        index + 1, item['Loại thiết bị'] || '', item['Số sê-ri (S/N)'] || '', item.Model || '',
        item['Ngày nhận từ khách'] || '', '', senderFromCase_(item), errorCode,
        issueNames[0] || '', issueNames[1] || '', issueNames[2] || '', issueNames[3] || '',
        item['Tình trạng bảo hành'] || '', latest['Kết quả xử lý'] || '',
        latest['Trung tâm xử lý'] || item['Trung tâm đang giữ hàng'] || '',
        latest['Ngày hoàn tất kỹ thuật'] || latest['Ngày hoàn tất chẩn đoán'] || '',
        deliveryStatus, latest['Trạng thái xử lý'] || '',
        parts.map(function (part) { return part['Ngày nhận linh kiện']; }).filter(Boolean)[0] || ''
      ];
      for (let partIndex = 0; partIndex < 4; partIndex += 1) {
        const part = parts[partIndex] || {};
        row.push(part['Mã linh kiện (Part Number)'] || '', part['Số lượng'] || '');
      }
      row.push(
        item['Ngày trả khách'] || '',
        [projectFromCase_(item) ? 'Dự án/Địa điểm: ' + projectFromCase_(item) : '', clean_(item['Ghi chú chung']), clean_(latest['Ghi chú nội bộ'])].filter(Boolean).join(' | '),
        safeDriveLink_(item['Liên kết hồ sơ Drive'])
      );
      return row;
    });
    if (sheet.getMaxColumns() < 30) sheet.insertColumnsAfter(sheet.getMaxColumns(), 30 - sheet.getMaxColumns());
    const dashboardHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const distributorColumn = dashboardHeaders.findIndex(function (header) { return clean_(header).toLowerCase() === 'distributor'; });
    if (distributorColumn >= 0 && !sheet.isColumnHiddenByUser(distributorColumn + 1)) sheet.hideColumns(distributorColumn + 1);
    if (sheet.getRange(1, 30).getValue() !== 'Drive Link') sheet.getRange(1, 30).setValue('Drive Link');
    if (rows.length > sheet.getMaxRows() - 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length - sheet.getMaxRows() + 1);
    const bodyRows = Math.max(sheet.getLastRow() - 1, 0);
    if (bodyRows) sheet.getRange(2, 1, bodyRows, 30).clearContent();
    if (rows.length) {
      sheet.getRange(2, 1, rows.length, 30).setValues(rows);
      [5, 16, 19, 28].forEach(function (column) {
        sheet.getRange(2, column, rows.length, 1).setNumberFormat('dd/MM/yyyy');
      });
    }
  } catch (error) {
    console.error('Không thể làm mới Dữ liệu dashboard: ' + error.message);
  }
}

function spreadsheet_() { return SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID); }

function migrateLegacyProjectToSender() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = spreadsheet_().getSheetByName(SHEETS.cases);
    if (!sheet) throw new Error('Thiếu tab ' + SHEETS.cases);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { moved: 0, skipped: 0, total: 0 };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
    const projectColumn = headers.indexOf('Dự án/Địa điểm') + 1;
    const senderColumns = ['Nơi gửi hàng', 'Đơn vị gửi hàng'].map(function (header) { return headers.indexOf(header) + 1; }).filter(function (column) { return column > 0; });
    if (!projectColumn || !senderColumns.length) throw new Error('Thiếu cột Nơi gửi hàng hoặc Dự án/Địa điểm.');
    const rowCount = lastRow - 1;
    const projects = sheet.getRange(2, projectColumn, rowCount, 1).getValues();
    const senderValues = senderColumns.map(function (column) { return sheet.getRange(2, column, rowCount, 1).getValues(); });
    let moved = 0;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const sender = senderValues.map(function (values) { return clean_(values[rowIndex][0]); }).filter(Boolean)[0] || '';
      const legacySender = clean_(projects[rowIndex][0]);
      if (sender || !legacySender) continue;
      senderValues.forEach(function (values) { values[rowIndex][0] = legacySender; });
      projects[rowIndex][0] = '';
      moved += 1;
    }
    senderColumns.forEach(function (column, index) { sheet.getRange(2, column, rowCount, 1).setValues(senderValues[index]); });
    sheet.getRange(2, projectColumn, rowCount, 1).setValues(projects);
    refreshDashboardData_();
    const result = { moved: moved, skipped: rowCount - moved, total: rowCount };
    console.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function canApproveWarranty_(actor) { return !!actor.isGlobalManager; }
function assertCaseEditable_(actor, caseRecord) {
  if (!actor.isGlobalManager && clean_(caseRecord['Trạng thái hồ sơ']) === 'Đã hoàn tất') {
    throw publicError_('Hồ sơ đã hoàn tất. Chỉ quản lý toàn bộ center được phép điều chỉnh.');
  }
}
function safeDriveLink_(value) {
  const link = clean_(value);
  return /^https:\/\/(drive|docs)\.google\.com\//i.test(link) ? link : '';
}
function validateDriveLink_(value) {
  if (!safeDriveLink_(value)) throw publicError_('Liên kết hồ sơ phải là link Google Drive hợp lệ.');
}
function publicActor_(actor) { return { email: actor.email, name: actor.name, role: actor.role, homeCenter: actor.homeCenter, centers: actor.centers.slice(), isGlobalManager: actor.isGlobalManager, canApproveWarranty: canApproveWarranty_(actor) }; }
function groupBy_(rows, field) { return rows.reduce(function (out, row) { const key = row[field]; if (!out[key]) out[key] = []; out[key].push(row); return out; }, {}); }
function stripInternal_(value) { const copy = Object.assign({}, value); delete copy.__rowNumber; return copy; }
function required_(value, label) { const result = clean_(value); if (!result) throw publicError_('Thiếu ' + label + '.'); return result; }
function emailOptional_(value, label) { const result = clean_(value).toLowerCase(); if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw publicError_(label + ' không hợp lệ.'); return result; }
function clean_(value) { return value == null ? '' : String(value).trim(); }
function explicitSenderFromCase_(item) { return clean_(item && (item['Nơi gửi hàng'] || item['Đơn vị gửi hàng'])); }
function senderFromCase_(item) { return explicitSenderFromCase_(item) || clean_(item && item['Dự án/Địa điểm']); }
function projectFromCase_(item) { return explicitSenderFromCase_(item) ? clean_(item && item['Dự án/Địa điểm']) : ''; }
function bool_(value) { return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'có'; }
function parseDateRequired_(value, label) { const date = parseDateOptional_(value); if (!date) throw publicError_('Thiếu hoặc sai ' + label + '.'); return date; }
function parseDateOptional_(value) { if (!value) return null; const date = value instanceof Date ? value : new Date(String(value) + (String(value).length === 10 ? 'T00:00:00+07:00' : '')); return isNaN(date.getTime()) ? null : date; }
function asDate_(value) { if (!value) return null; const date = value instanceof Date ? value : new Date(value); return isNaN(date.getTime()) ? null : date; }
function iso_(value) { const date = asDate_(value); return date ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''; }
function makeId_(prefix) { return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase(); }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).slice(0, 40); }
function parseJson_(value) { if (!value) return null; try { return JSON.parse(value); } catch (_) { return null; } }
function publicError_(message) { const error = new Error(message); error.publicMessage = message; return error; }
