const APP_VERSION = '1.10.4-canonical-sync';
const DATABASE_SPREADSHEET_ID = '1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI';
const GOOGLE_WEB_CLIENT_ID = '1057611730150-6ds8o36jv1haln4h6tcl1gilh31o7hqn.apps.googleusercontent.com';
const AUTH_BROKER_URL = 'https://taqhung95-cloud.github.io/sungrow-service/data-entry-login.html';
const WARRANTY_LOOKUP_SHEET_ID = '1CPQkL-FJVxaXwuPKJUO-PnK9ML3s2KYXg8ZvmnfPev8';
const CASE_EVIDENCE_FOLDERS = Object.freeze({
  'Sungrow Service Center': '1oSqOD50t9O2VXZX7WHSDcagHUbYpJk67',
  'XBSolar Center': '1I6W-C0hvJ4sJ4L7NE6v1rWe-drYM8coy',
  'DAT Center': '1J_BodbodjndAJicA22FiM8ZXjQp9vfrQ',
  'BKE Center': '1oS2Ub1fsl6kTywc-_zThQxOZdYpxEDhK',
  'JGP Center': '1O9XohztuMW4utxCSPiIFoLVyghqETZr4'
});

const SHEETS = Object.freeze({
  cases: 'Hồ sơ thiết bị',
  workOrders: 'Công việc trung tâm',
  transfers: 'Luân chuyển thiết bị',
  issues: 'Lỗi thiết bị',
  parts: 'Linh kiện sử dụng',
  holds: 'Tạm dừng SLA',
  users: 'Người dùng',
  audit: 'Nhật ký thay đổi',
  dashboard: 'Dữ liệu dashboard',
  caseIndex: 'Chỉ mục hồ sơ'
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
const PORTAL_CASE_INDEX_HEADERS = Object.freeze([
  'Mã hồ sơ', 'Dòng nguồn', 'Loại thiết bị', 'Số sê-ri (S/N)', 'Model',
  'Trung tâm tiếp nhận khách', 'Trung tâm đang giữ hàng', 'Trạng thái hồ sơ',
  'Tình trạng bảo hành', 'Ngày nhận từ khách', 'Các trung tâm xử lý',
  'Mã công việc gần nhất', 'Trung tâm xử lý gần nhất', 'Trạng thái xử lý gần nhất',
  'Kết quả gần nhất', 'Ngày nhận công việc gần nhất', 'Ngày hoàn tất kỹ thuật gần nhất',
  'Có luân chuyển', 'Số lượng', 'Tìm kiếm', 'Ngày cập nhật chỉ mục'
]);
const ROLE_CODES = Object.freeze({
  serviceManager: 'service_manager',
  centerManager: 'center_manager',
  centerStaff: 'center_staff'
});
const ROLE_CAPABILITIES = Object.freeze({
  service_manager: Object.freeze({ viewDashboard: true, viewCases: true, createCase: true, updateWorkOrder: true, createTransfer: true, acceptTransfer: true, returnToCustomer: true, approveWarranty: true }),
  center_manager: Object.freeze({ viewDashboard: false, viewCases: true, createCase: true, updateWorkOrder: true, createTransfer: true, acceptTransfer: true, returnToCustomer: true, approveWarranty: false }),
  center_staff: Object.freeze({ viewDashboard: false, viewCases: true, createCase: true, updateWorkOrder: true, createTransfer: false, acceptTransfer: true, returnToCustomer: true, approveWarranty: false })
});

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.authBrokerUrl = AUTH_BROKER_URL;
  template.appVersion = APP_VERSION;
  return template.evaluate()
    .setTitle('Sungrow Service Center - Quản lý & nhập liệu')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getPortalDatabaseRevision_() {
  const store = PropertiesService.getScriptProperties();
  let revision = Number(store.getProperty('PORTAL_DATA_REVISION') || 0);
  if (!revision) {
    revision = Date.now();
    store.setProperty('PORTAL_DATA_REVISION', String(revision));
  }
  return String(revision);
}

function bumpPortalDatabaseRevision_() {
  const store = PropertiesService.getScriptProperties();
  const previous = Number(store.getProperty('PORTAL_DATA_REVISION') || 0);
  const next = Math.max(Date.now(), previous + 1);
  store.setProperty('PORTAL_DATA_REVISION', String(next));
  return String(next);
}

function getPortalSyncState(idToken) {
  authenticate_(idToken);
  const revision = getPortalDatabaseRevision_();
  return {
    revision: revision,
    changedAt: new Date(Number(revision)).toISOString(),
    pollMs: 60000
  };
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

function handlePortalApi_(request) {
  request = request || {};
  const functionName = clean_(request.functionName);
  const args = Array.isArray(request.args) ? request.args : [];
  const allowed = {
    getBootstrap: getBootstrap,
    getPortalSyncState: getPortalSyncState,
    listCases: listCases,
    getCaseDetail: getCaseDetail,
    searchCases: searchCases,
    lookupWarranty: lookupWarranty,
    createCase: createCase,
    getCreationStatus: getCreationStatus,
    cancelCase: cancelCase,
    confirmWarranty: confirmWarranty,
    updateWorkOrder: updateWorkOrder,
    correctCase: correctCase,
    createTransfer: createTransfer,
    acceptTransfer: acceptTransfer,
    returnToCustomer: returnToCustomer
  };
  if (!Object.prototype.hasOwnProperty.call(allowed, functionName)) {
    throw publicError_('Thao tác không được phép.');
  }
  return allowed[functionName].apply(null, args);
}

function listCases(idToken, filters) {
  const actor = authenticate_(idToken);
  let revision = '';
  let cache = null;
  let cacheKey = '';
  try {
    revision = getPortalDatabaseRevision_();
    const cacheSeed = JSON.stringify({
      user: actor.googleSub || actor.email,
      revision: revision,
      filters: filters || {}
    });
    const digest = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cacheSeed)
    ).replace(/=+$/g, '');
    cache = CacheService.getScriptCache();
    cacheKey = 'portal-cases-v1-' + digest;
    const cached = filters && filters.refresh === true ? null : cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (cacheError) {
    console.warn('Portal list cache read skipped: ' + String(cacheError && cacheError.message || cacheError));
    cache = null;
    cacheKey = '';
  }
  let result = listCasesUncached_(idToken, filters, actor, revision);
  const latestRevision = getPortalDatabaseRevision_();
  if (latestRevision !== revision) {
    // A mutation completed while the shared snapshot was warming. Do not put
    // mixed-revision data under the old key; rebuild once from the new version.
    revision = latestRevision;
    result = listCasesUncached_(idToken, filters, actor, revision);
    cache = null;
    cacheKey = '';
  }
  if (result.stale) {
    // Never pin a stale-while-refresh response in the user/filter cache. The
    // next revision poll should pick up the freshly published shared tables.
    cache = null;
    cacheKey = '';
  }
  if (revision) result.revision = revision;
  if (cache && cacheKey) {
    try {
      const serialized = JSON.stringify(result);
      if (Utilities.newBlob(serialized).getBytes().length < 90000) {
        cache.put(cacheKey, serialized, 300);
      }
    } catch (cacheError) {
      console.warn('Portal list cache write skipped: ' + String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

function listCasesUncached_(idToken, filters, authenticatedActor, dataRevision) {
  const actor = authenticatedActor || authenticate_(idToken);
  assertCapability_(actor, 'viewCases');
  filters = filters || {};
  const query = clean_(filters.query).toLowerCase();
  const status = clean_(filters.status);
  const warrantyStatus = clean_(filters.warrantyStatus);
  const center = clean_(filters.center);
  if (center && CENTERS.indexOf(center) === -1) throw publicError_('Trung tâm lọc không hợp lệ.');
  if (center && !actor.isGlobalManager) assertCenterAllowed_(actor, center);
  const pageSize = Math.max(10, Math.min(200, Number(filters.pageSize) || 20));
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const revision = clean_(dataRevision) || getPortalDatabaseRevision_();
  const cases = readPortalCaseIndex_(revision);

  const filtered = cases.filter(function (item) {
    if (clean_(item['Trạng thái hồ sơ']) === 'Đã hủy') return false;
    if (!canSeeIndexedCase_(actor, item)) return false;
    const searchable = clean_(item['Tìm kiếm']).toLowerCase();
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
  const items = filtered.slice(start, start + pageSize).map(function (item) { return publicIndexedCase_(actor, item); });
  return { items: items, total: total, page: page, pageSize: pageSize, totalPages: totalPages, stale: Boolean(cases.__cacheStale) };
}

function searchCases(idToken, rawQuery) {
  const query = clean_(rawQuery);
  if (query.length < 2) throw publicError_('Nhập ít nhất 2 ký tự để tìm kiếm.');
  const actor = authenticate_(idToken);
  const matches = listCases(idToken, { query: query, page: 1, pageSize: 20 }).items;
  return matches.map(function (item) { return getCaseDetailForActor_(actor, item.caseId); });
}

function getCaseDetail(idToken, caseId) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'viewCases');
  return getCaseDetailForActor_(actor, required_(caseId, 'mã hồ sơ'));
}

function lookupWarranty(idToken, serialNumber) {
  authenticate_(idToken);
  const serial = clean_(serialNumber).toUpperCase();
  if (!serial) return { status: 'no_information', label: 'Không có thông tin' };
  if (serial.length > 100) throw publicError_('Số sê-ri quá dài.');
  const sheetId = PropertiesService.getScriptProperties().getProperty('WARRANTY_LOOKUP_SHEET_ID') || WARRANTY_LOOKUP_SHEET_ID;
  const sheet = SpreadsheetApp.openById(sheetId).getSheets().find(function (candidate) {
    if (!candidate.getLastRow() || !candidate.getLastColumn()) return false;
    const names = candidate.getRange(1, 1, 1, candidate.getLastColumn()).getDisplayValues()[0].map(function (value) { return clean_(value).toLowerCase(); });
    return names.indexOf('sn') !== -1 && names.indexOf('start date') !== -1 && names.indexOf('warranty package') !== -1;
  });
  if (!sheet) throw publicError_('Nguồn bảo hành không có tab với các cột SN, Start date, Warranty package.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
  const serialColumn = headers.findIndex(function (value) { return value.toUpperCase() === 'SN'; }) + 1;
  const startColumn = headers.findIndex(function (value) { return value.toLowerCase() === 'start date'; }) + 1;
  const packageColumn = headers.findIndex(function (value) { return value.toLowerCase() === 'warranty package'; }) + 1;
  if (!serialColumn || !startColumn || !packageColumn) throw publicError_('Nguồn bảo hành thiếu cột SN, Start date hoặc Warranty package.');
  const found = sheet.getRange(2, serialColumn, Math.max(1, sheet.getLastRow() - 1), 1)
    .createTextFinder(serial).matchEntireCell(true).matchCase(false).findNext();
  if (!found) return { status: 'no_information', label: 'Không có thông tin' };
  const row = sheet.getRange(found.getRow(), 1, 1, headers.length).getValues()[0];
  const start = warrantyDate_(row[startColumn - 1]);
  const packageName = clean_(row[packageColumn - 1]);
  const years = /extended/i.test(packageName) ? 10 : (/standard/i.test(packageName) ? 5 : 0);
  if (!start || !years) return { status: 'insufficient', label: 'Thiếu thông tin bảo hành', package: packageName };
  const expires = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { status: today <= expires ? 'valid' : 'expired', label: today <= expires ? 'Còn bảo hành' : 'Hết bảo hành', package: packageName, startDate: iso_(start), expiryDate: iso_(expires) };
}

function warrantyDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = clean_(value);
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return validWarrantyDate_(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  return match ? validWarrantyDate_(Number(match[3]), Number(match[2]), Number(match[1])) : null;
}

function validWarrantyDate_(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

// Có thể chạy một lần để kiểm tra nguồn và lưu ID trong Script Properties.
// Nếu không chạy, hệ thống vẫn dùng WARRANTY_LOOKUP_SHEET_ID ở trên.
function configureWarrantyLookupSheet() {
  const copy = SpreadsheetApp.openById(WARRANTY_LOOKUP_SHEET_ID);
  const valid = copy.getSheets().some(function (sheet) {
    if (sheet.getLastRow() < 1000 || !sheet.getLastColumn()) return false;
    const names = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (value) { return clean_(value).toLowerCase(); });
    return ['sn', 'start date', 'warranty package'].every(function (name) { return names.indexOf(name) !== -1; });
  });
  if (!valid) throw new Error('Google Sheet bảo hành thiếu cột hoặc số dòng; chưa đổi nguồn tra cứu.');
  PropertiesService.getScriptProperties().setProperty('WARRANTY_LOOKUP_SHEET_ID', WARRANTY_LOOKUP_SHEET_ID);
  return WARRANTY_LOOKUP_SHEET_ID;
}

function getCreationStatus(idToken, requestId) {
  const actor = authenticate_(idToken);
  const id = clean_(requestId);
  if (!id) throw publicError_('Thiếu mã yêu cầu tạo hồ sơ.');
  const record = readTable_(SHEETS.cases).find(function (row) {
    return clean_(row['Mã yêu cầu tạo']) === id && clean_(row['Người tạo']).toLowerCase() === actor.email.toLowerCase();
  });
  if (!record) return { found: false };
  const work = readTable_(SHEETS.workOrders).find(function (row) { return row['Mã hồ sơ'] === record['Mã hồ sơ']; });
  if (!work) throw publicError_('Hồ sơ đã ghi nhưng công việc chưa hoàn tất. Vui lòng kiểm tra hồ sơ ' + record['Mã hồ sơ'] + ', không gửi lại.');
  return { found: true, caseId: record['Mã hồ sơ'], workOrderId: work['Mã công việc'], cancelled: clean_(record['Trạng thái hồ sơ']) === 'Đã hủy' };
}

function createCase(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'createCase');
  payload = payload || {};
  const center = required_(payload.intakeCenter, 'Trung tâm tiếp nhận');
  assertCenterAllowed_(actor, center);
  const receivedAt = parseDateRequired_(payload.receivedAt, 'Ngày nhận từ khách');
  const deviceType = required_(payload.deviceType, 'Loại thiết bị');
  const model = required_(payload.model, 'Model');
  const serial = clean_(payload.serialNumber);
  if (deviceType !== 'Fan' && !serial) throw publicError_('Số sê-ri (S/N) là bắt buộc, trừ thiết bị Fan.');
  const customerName = required_(payload.customerName, 'Tên khách hàng');
  const customerAddress = required_(payload.customerAddress, 'Địa chỉ khách hàng');
  const customerPhone = required_(payload.customerPhone, 'Số điện thoại khách hàng');
  const customerEmail = emailOptional_(payload.customerEmail, 'Email khách hàng');
  const project = clean_(payload.project);
  const initialIssue = required_(payload.initialIssue, 'Hiện tượng ban đầu');
  const quantity = Math.max(1, Number(payload.quantity || 1));
  if (!Number.isFinite(quantity)) throw publicError_('Số lượng không hợp lệ.');
  const requestId = clean_(payload.requestId);
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) throw publicError_('Vui lòng tải lại giao diện để tạo mã yêu cầu hợp lệ.');

  // Reserve this request before uploading. Drive I/O must not hold the shared
  // database lock; uncertain uploads are not automatically repeated.
  const receiptKey = 'CREATE_UPLOAD_' + requestId;
  const receipts = PropertiesService.getScriptProperties();
  const reservation = LockService.getScriptLock();
  reservation.waitLock(20000);
  let evidenceLink;
  try {
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    const existing = getCreationStatus(idToken, requestId);
    if (existing.found) return existing;
    const raw = receipts.getProperty(receiptKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.owner !== actor.email) throw publicError_('Mã yêu cầu thuộc người dùng khác.');
      if (!saved.link) throw publicError_('File của yêu cầu này đang tải hoặc chưa xác định kết quả. Không gửi lại file; vui lòng kiểm tra với quản lý. Mã: ' + requestId);
      evidenceLink = saved.link;
    } else {
      receipts.setProperty(receiptKey, JSON.stringify({ owner: actor.email, startedAt: new Date().toISOString() }));
    }
  } finally {
    reservation.releaseLock();
  }
  if (!evidenceLink) {
    evidenceLink = uploadCaseEvidence_(center, receivedAt, serial, model, customerName, payload.attachment);
    receipts.setProperty(receiptKey, JSON.stringify({ owner: actor.email, link: evidenceLink }));
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (requestId) {
      const existing = getCreationStatus(idToken, requestId);
      if (existing.found) return existing;
    }
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    ensureSheetColumns_(SHEETS.cases, ['GSP', 'MA']);
    ensureSheetColumns_(SHEETS.cases, ['Mã yêu cầu tạo']);
    const caseId = makeId_('HS');
    const workOrderId = makeId_('CV');
    const now = new Date();
    appendObject_(SHEETS.cases, {
      'Mã hồ sơ': caseId,
      'Mã yêu cầu tạo': requestId,
      'Loại thiết bị': deviceType,
      'Số sê-ri (S/N)': serial,
      'Model': model,
      'GSP': '',
      'MA': '',
      'Số lượng': quantity,
      'Trung tâm tiếp nhận khách': center,
      'Ngày nhận từ khách': receivedAt,
      'Trung tâm đang giữ hàng': center,
      'Trạng thái hồ sơ': 'Mới tiếp nhận',
      'Tình trạng bảo hành': 'Chờ xác nhận',
      'Nơi gửi hàng': customerName,
      'Đơn vị gửi hàng': customerName,
      'Dự án/Địa điểm': project,
      'Ghi chú chung': clean_(payload.note),
      'Liên kết hồ sơ Drive': evidenceLink,
      'Tên khách hàng': customerName,
      'Địa chỉ khách hàng': customerAddress,
      'Số điện thoại khách hàng': customerPhone,
      'Email khách hàng': customerEmail,
      'Tên công ty gửi hàng': '',
      'Tên người gửi hàng': '',
      'Địa chỉ gửi hàng': '',
      'Số điện thoại gửi hàng': '',
      'Email gửi hàng': '',
      'Đơn vị vận chuyển': '',
      'Mã vận đơn': '',
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
    SpreadsheetApp.flush();
    receipts.deleteProperty(receiptKey);
    bumpPortalDatabaseRevision_();
    try { audit_(actor, 'Tạo hồ sơ', 'Hồ sơ', caseId, center, null, { workOrderId: workOrderId }); }
    catch (error) { console.error('Hồ sơ đã tạo, lỗi ghi nhật ký: ' + String(error)); }
    syncDashboardProjectionCase_(caseId);
    syncPortalCaseIndexCase_(caseId);
    bumpPortalDatabaseRevision_();
    return { caseId: caseId, workOrderId: workOrderId };
  } finally {
    lock.releaseLock();
  }
}

function confirmWarranty() {
  var args = Array.prototype.slice.call(arguments);
  return withSerializedWrite_('xác nhận bảo hành', function () {
    return confirmWarrantyUnlocked_.apply(null, args);
  });
}

function cancelCase(idToken, payload) {
  try {
    return cancelCaseUnlocked_(idToken, payload);
  } catch (error) {
    if (error && error.publicMessage) throw error;
    console.error('Lỗi xóa hồ sơ: ' + String(error && error.stack || error));
    throw publicError_('Không thể xóa hồ sơ. Chi tiết: ' + String(error && error.message || error || 'Lỗi không xác định'));
  }
}

function cancelCaseUnlocked_(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'createCase');
  payload = payload || {};
  const caseId = required_(payload.caseId, 'Mã hồ sơ');
  const reason = required_(payload.reason, 'Lý do xóa hồ sơ');
  if (reason.length > 500) throw publicError_('Lý do xóa hồ sơ không được vượt quá 500 ký tự.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw publicError_('Dữ liệu đang được cập nhật. Vui lòng chờ vài giây rồi xóa lại hồ sơ.');
  try {
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    ensureSheetColumns_(SHEETS.cases, ['Người hủy', 'Ngày hủy', 'Lý do hủy']);
    const table = readTableWithRows_(SHEETS.cases);
    const record = table.rows.find(function (item) { return clean_(item['Mã hồ sơ']) === caseId; });
    if (!record) throw publicError_('Không tìm thấy hồ sơ cần xóa.');
    if (!actor.isGlobalManager && actor.centers.indexOf(clean_(record['Trung tâm tiếp nhận khách'])) === -1) {
      throw publicError_('Chỉ nhân viên của center tiếp nhận mới được xóa hồ sơ này.');
    }
    if (clean_(record['Trạng thái hồ sơ']) === 'Đã hủy') {
      removeDashboardProjectionCase_(caseId, record);
      syncPortalCaseIndexCase_(caseId);
      SpreadsheetApp.flush();
      bumpPortalDatabaseRevision_();
      return { caseId: caseId, cancelled: true };
    }
    if (clean_(record['Tình trạng bảo hành']) !== 'Chờ xác nhận') {
      throw publicError_('Không thể xóa hồ sơ sau khi đã xác nhận tình trạng bảo hành.');
    }
    const intakeCenter = clean_(record['Trung tâm tiếp nhận khách']);
    const currentCenter = clean_(record['Trung tâm đang giữ hàng']);
    if (!actor.isGlobalManager && actor.centers.indexOf(intakeCenter) === -1) {
      throw publicError_('Chỉ nhân viên của center tiếp nhận mới được xóa hồ sơ này.');
    }
    if (currentCenter !== intakeCenter) throw publicError_('Không thể xóa hồ sơ đã rời center tiếp nhận.');
    const hasTransfer = readTable_(SHEETS.transfers).some(function (item) { return clean_(item['Mã hồ sơ']) === caseId; });
    if (hasTransfer) throw publicError_('Không thể xóa hồ sơ đã phát sinh luân chuyển center.');
    const now = new Date();
    const changes = {
      'Trạng thái hồ sơ': 'Đã hủy',
      'Người hủy': actor.email,
      'Ngày hủy': now,
      'Lý do hủy': reason,
      'Người cập nhật gần nhất': actor.email,
      'Ngày cập nhật gần nhất': now
    };
    const headers = tableHeaders_(SHEETS.cases);
    allowCancelledCaseStatus_(headers, record.__rowNumber);
    updateObjectRow_(SHEETS.cases, headers, record.__rowNumber, changes);
    SpreadsheetApp.flush();
    const saved = readTable_(SHEETS.cases).find(function (row) { return clean_(row['Mã hồ sơ']) === caseId; });
    if (!saved || clean_(saved['Trạng thái hồ sơ']) !== 'Đã hủy') throw publicError_('Chưa xác nhận được việc xóa hồ sơ trong database. Vui lòng thử lại.');
    try { audit_(actor, 'Xóa hồ sơ trước xác nhận bảo hành', 'Hồ sơ', caseId, intakeCenter, record, changes); }
    catch (auditError) { console.error('Hồ sơ đã hủy nhưng chưa ghi được audit ' + caseId + ': ' + String(auditError && auditError.message || auditError)); }
    try { removeDashboardProjectionCase_(caseId, record); }
    catch (projectionError) { console.error('Hồ sơ đã hủy nhưng không thể xóa projection ' + caseId + ': ' + String(projectionError && projectionError.message || projectionError)); }
    syncPortalCaseIndexCase_(caseId);
    bumpPortalDatabaseRevision_();
    return { caseId: caseId, cancelled: true };
  } finally {
    lock.releaseLock();
  }
}

// Extend only the target cell's dropdown, retaining existing choices and
// rejection policy. Never clear validation or modify a shared lookup range.
function allowListValidationValue_(sheetName, headers, rowNumber, header, value, invalidMessage) {
  const column = headers.indexOf(header) + 1;
  if (!column) throw publicError_('Không tìm thấy cột ' + header + '.');
  const cell = spreadsheet_().getSheetByName(sheetName).getRange(rowNumber, column);
  const rule = cell.getDataValidation();
  if (!rule) return;
  const type = rule.getCriteriaType();
  const args = rule.getCriteriaValues();
  let values;
  if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) values = args[0].slice();
  else if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) values = args[0].getDisplayValues().reduce(function (all, row) { return all.concat(row); }, []).filter(String);
  else throw publicError_(invalidMessage || ('Quy tắc của cột ' + header + ' không phải danh sách.'));
  if (values.indexOf(value) !== -1) return;
  values.push(value);
  cell.setDataValidation(rule.copy().requireValueInList(values, args[1] !== false).build());
}

function allowCancelledCaseStatus_(headers, rowNumber) {
  allowListValidationValue_(SHEETS.cases, headers, rowNumber, 'Trạng thái hồ sơ', 'Đã hủy',
    'Quy tắc trạng thái không phải danh sách. Cần quản lý kiểm tra validation trước khi hủy.');
}

function allowHistoricalWarrantyStatus_(headers, rowNumber, warrantyStatus) {
  allowListValidationValue_(SHEETS.cases, headers, rowNumber, 'Tình trạng bảo hành', warrantyStatus,
    'Quy tắc tình trạng bảo hành không phải danh sách. Cần quản lý kiểm tra validation.');
}

function confirmWarrantyUnlocked_(idToken, payload) {
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
  allowHistoricalWarrantyStatus_(table.headers, record.__rowNumber, warrantyStatus);
  updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
  audit_(actor, 'Xác nhận bảo hành', 'Hồ sơ', caseId, record['Trung tâm đang giữ hàng'], record, changes);
  syncDashboardProjectionCase_(caseId);
  syncPortalCaseIndexCase_(caseId);
  bumpPortalDatabaseRevision_();
  SpreadsheetApp.flush();
  return { ok: true, warrantyStatus: warrantyStatus };
}

/**
 * Serialize every state-changing transaction across all signed-in users.
 *
 * Google Sheets does not provide row-level transactions. ScriptLock ensures
 * that a second employee cannot read/write the database while another write
 * is still in progress. The lock is acquired before the original mutation
 * re-reads its target rows, so all permission and state checks run against
 * the latest committed data.
 */
/**
 * Transfer routing rule:
 * - Sungrow/global management may send to any center.
 * - Every other center may send only to Sungrow.
 * This backend rule also blocks direct API calls that bypass the form.
 */
function assertTransferDestinationPolicy_(sourceCenter, destination) {
  if (sourceCenter === SUNGROW_CENTER) return;
  if (destination !== SUNGROW_CENTER) {
    throw publicError_('Center của bạn chỉ được phép luân chuyển thiết bị về Sungrow.');
  }
}

function transferDestinationsForSource_(sourceCenter) {
  if (sourceCenter === SUNGROW_CENTER) {
    return CENTERS.filter(function (center) { return center !== sourceCenter; });
  }
  return [SUNGROW_CENTER];
}

function withSerializedWrite_(operationName, callback) {
  var lock = LockService.getScriptLock();
  // Existing-record mutations must never wait and then overwrite a newer
  // value submitted by another employee. Reject the overlapping request so
  // the second user is forced to reload the latest record first.
  if (!lock.tryLock(1)) {
    throw publicError_(
      'Dữ liệu đang được một nhân viên khác cập nhật. ' +
      'Vui lòng chờ vài giây, tải lại hồ sơ rồi thử lại thao tác “' + operationName + '”.'
    );
  }

  try {
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    return callback();
  } finally {
    lock.releaseLock();
  }
}

/** Administrative correction updates the existing case; never creates a case or transfer. */
function correctCase(idToken, payload) {
  return withSerializedWrite_('sửa thông tin hồ sơ', function () {
    const actor = authenticate_(idToken);
    if (!actor.isGlobalManager) throw publicError_('Chỉ quản lý toàn hệ thống được sửa thông tin gốc.');
    payload = payload || {};
    const caseId = required_(payload.caseId, 'Mã hồ sơ');
    const reason = required_(payload.reason, 'Lý do sửa');
    if (reason.length > 500) throw publicError_('Lý do sửa tối đa 500 ký tự.');
    if (!payload.expectedRevision || String(payload.expectedRevision) !== getPortalDatabaseRevision_()) throw publicError_('Dữ liệu đã thay đổi. Tải lại hồ sơ trước khi sửa.');
    const table = readTableWithRows_(SHEETS.cases);
    const matches = table.rows.filter(function (c) { return clean_(c['Mã hồ sơ']) === caseId; });
    if (matches.length !== 1) throw publicError_('Không tìm thấy đúng một hồ sơ để sửa.');
    const record = matches[0];
    if (clean_(record['Trạng thái hồ sơ']) === 'Đã hủy') throw publicError_('Không sửa hồ sơ đã hủy.');
    const fields = {serialNumber:'Số sê-ri (S/N)',model:'Model',quantity:'Số lượng',receivedAt:'Ngày nhận từ khách',readyAt:'Ngày sẵn sàng trả khách',returnedAt:'Ngày trả khách',sender:'Đơn vị gửi hàng',customerName:'Tên khách hàng',customerAddress:'Địa chỉ khách hàng',customerPhone:'Số điện thoại khách hàng',customerEmail:'Email khách hàng',note:'Ghi chú chung',evidenceLink:'Liên kết hồ sơ Drive'};
    const input = payload.changes || {}, changes = {}, dates = ['receivedAt','readyAt','returnedAt'];
    Object.keys(input).forEach(function (key) {
      if (!fields[key]) throw publicError_('Trường không được phép sửa: ' + key);
      if (table.headers.indexOf(fields[key]) === -1) throw publicError_('Thiếu cột đích: ' + fields[key]);
      let value = clean_(input[key]);
      if (value.length > (key === 'note' ? 20000 : 2000)) throw publicError_('Thông tin quá dài: ' + key);
      if (dates.indexOf(key) !== -1) { const raw=value; value = value ? parseDateRequired_(value, key) : ''; if(raw && (!/^\d{4}-\d{2}-\d{2}$/.test(raw)||iso_(value)!==raw)) throw publicError_('Ngày không hợp lệ: '+key); }
      else if (key === 'quantity') { value = Number(value); if (!Number.isInteger(value) || value < 1) throw publicError_('Số lượng phải là số nguyên từ 1.'); }
      else if (key === 'customerEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw publicError_('Email không hợp lệ.');
      else if (key === 'evidenceLink' && value && !safeDriveLink_(value)) throw publicError_('Link hồ sơ phải là Google Drive hợp lệ.');
      else if ((key === 'serialNumber' || key === 'model') && !value) throw publicError_('S/N và Model không được để trống khi sửa.');
      if (typeof value === 'string' && /^[=+@]/.test(value)) throw publicError_('Không nhập công thức vào thông tin hồ sơ.');
      changes[fields[key]] = value;
      if(key==='sender' && table.headers.indexOf('Nơi gửi hàng')>=0)changes['Nơi gửi hàng']=value;
    });
    if (!Object.keys(changes).length) throw publicError_('Chưa chọn thông tin cần sửa.');
    const next = Object.assign({}, record, changes), received = asDate_(next['Ngày nhận từ khách']), ready = asDate_(next['Ngày sẵn sàng trả khách']), returned = asDate_(next['Ngày trả khách']);
    if (clean_(next['Nguồn dữ liệu']) === 'Quy trình mới' && !received) throw publicError_('Hồ sơ quy trình mới phải có ngày nhận.');
    if (received && ((ready && ready < received) || (returned && returned < received))) throw publicError_('Ngày sẵn sàng/trả không được trước ngày nhận.');
    if (ready && returned && returned < ready) throw publicError_('Ngày trả không được trước ngày sẵn sàng trả.');
    if (clean_(record['Trạng thái hồ sơ']) === 'Đã hoàn tất' && asDate_(record['Ngày trả khách']) && !returned) throw publicError_('Hồ sơ đã hoàn tất phải giữ ngày trả khách.');
    const works = findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);
    const transfers = findTableRowsByField_(SHEETS.transfers, 'Mã hồ sơ', [caseId]);
    if (received && Object.prototype.hasOwnProperty.call(changes, 'Ngày nhận từ khách') && works.some(function(w){const d=asDate_(w['Ngày trung tâm nhận hàng']);return d && d < received;})) throw publicError_('Ngày nhận khách không được sau ngày nhận một chặng xử lý.');
    if (returned && transfers.some(function(t){const d=asDate_(t['Ngày xác nhận nhận']);return d && d > returned;})) throw publicError_('Ngày trả khách không được trước ngày nhận luân chuyển đã ghi.');
    const normalize = function(v){return clean_(v).toUpperCase().replace(/\s+/g,'');};
    const identityChanged = normalize(next['Số sê-ri (S/N)']) !== normalize(record['Số sê-ri (S/N)']) || iso_(next['Ngày nhận từ khách']) !== iso_(record['Ngày nhận từ khách']);
    if (identityChanged && received && table.rows.some(function(c){return clean_(c['Mã hồ sơ'])!==caseId && clean_(c['Trạng thái hồ sơ'])!=='Đã hủy' && normalize(c['Số sê-ri (S/N)'])===normalize(next['Số sê-ri (S/N)']) && iso_(c['Ngày nhận từ khách'])===iso_(received);})) throw publicError_('S/N và ngày nhận trùng hồ sơ khác. Cần đối chiếu case trước khi sửa.');
    changes['Người cập nhật gần nhất'] = actor.email;
    changes['Ngày cập nhật gần nhất'] = new Date();
    updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
    audit_(actor, 'Sửa thông tin hồ sơ', 'Hồ sơ', caseId, record['Trung tâm tiếp nhận khách'], record, {reason:reason,changes:changes});
    const projection = syncDashboardProjectionCase_(caseId), index = syncPortalCaseIndexCase_(caseId);
    const revision = bumpPortalDatabaseRevision_();
    if (!projection || !projection.ok || !index || !index.ok) throw publicError_('Thông tin đã lưu nhưng đồng bộ dashboard/chỉ mục chưa hoàn tất. Tải lại hồ sơ và kiểm tra trước khi tiếp tục.');
    return {ok:true,caseId:caseId,revision:revision};
  });
}

function updateWorkOrder() {
  var args = Array.prototype.slice.call(arguments);
  return withSerializedWrite_('cập nhật hồ sơ', function () {
    return updateWorkOrderUnlocked_.apply(null, args);
  });
}

function updateWorkOrderUnlocked_(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'updateWorkOrder');
  payload = payload || {};
  const workOrderId = required_(payload.workOrderId, 'Mã công việc');
  const table = readTableWithRows_(SHEETS.workOrders);
  const record = table.rows.find(function (row) { return row['Mã công việc'] === workOrderId; });
  if (!record) throw publicError_('Không tìm thấy công việc.');
  assertCenterAllowed_(actor, record['Trung tâm xử lý']);
  if (!actor.isGlobalManager && ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(record['Trạng thái xử lý']) !== -1) {
    throw publicError_('Công việc đã kết thúc tại center này và không thể cập nhật thêm.');
  }

  ensureSheetColumns_(SHEETS.cases, ['GSP', 'MA']);
  const caseTable = readTableWithRows_(SHEETS.cases);
  const caseRecord = caseTable.rows.find(function (row) { return row['Mã hồ sơ'] === record['Mã hồ sơ']; });
  if (!caseRecord) throw publicError_('Không tìm thấy hồ sơ của công việc.');
  assertCaseEditable_(actor, caseRecord);
  const gsp = clean_(payload.gsp);
  const ma = clean_(payload.ma);
  if (gsp.length > 100 || ma.length > 100) throw publicError_('GSP hoặc MA không được vượt quá 100 ký tự.');
  const requestedStatus = required_(payload.workflowStatus, 'Trạng thái xử lý');
  const warrantyPending = clean_(caseRecord['Tình trạng bảo hành']) === 'Chờ xác nhận';
  const hasParts = (payload.parts || []).some(function (item) { return clean_(item.partNumber) || clean_(item.name); });
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
  updateObjectRow_(SHEETS.cases, caseTable.headers, caseRecord.__rowNumber, {
    'GSP': gsp,
    'MA': ma,
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': new Date()
  });
  updateCaseAfterWork_(record['Mã hồ sơ'], actor, changes);
  replaceWorkOrderChildren_(actor, workOrderId, payload.issues || [], payload.parts || []);
  if (changes['Ngày hoàn tất kỹ thuật']) fillMissingPartUsageDates_(workOrderId, changes['Ngày hoàn tất kỹ thuật']);
  appendWorkOrderHolds_(actor, workOrderId, payload.holds || []);
  audit_(actor, 'Cập nhật xử lý', 'Công việc', workOrderId, record['Trung tâm xử lý'], record, changes);
  syncDashboardProjectionCase_(record['Mã hồ sơ']);
  syncPortalCaseIndexCase_(record['Mã hồ sơ']);
  bumpPortalDatabaseRevision_();
  return { ok: true };
}

function createTransfer() {
  var args = Array.prototype.slice.call(arguments);
  return withSerializedWrite_('luân chuyển center', function () {
    return createTransferUnlocked_.apply(null, args);
  });
}

function createTransferUnlocked_(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'createTransfer');
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
  assertTransferDestinationPolicy_(source, destination);
  if (source === destination) throw publicError_('Trung tâm nhận phải khác trung tâm gửi.');

  const sourceWork = latestWorkOrder_(caseId, source);
  if (!sourceWork) throw publicError_('Không tìm thấy công việc của trung tâm gửi.');
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
  syncDashboardProjectionCase_(caseId);
  syncPortalCaseIndexCase_(caseId);
  bumpPortalDatabaseRevision_();
  return { transferId: transferId, destinationWorkOrderId: destinationWorkId };
}

function acceptTransfer() {
  var args = Array.prototype.slice.call(arguments);
  return withSerializedWrite_('xác nhận nhận máy', function () {
    return acceptTransferUnlocked_.apply(null, args);
  });
}

function acceptTransferUnlocked_(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'acceptTransfer');
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
  syncDashboardProjectionCase_(transfer['Mã hồ sơ']);
  syncPortalCaseIndexCase_(transfer['Mã hồ sơ']);
  bumpPortalDatabaseRevision_();
  return { ok: true };
}

function returnToCustomer() {
  var args = Array.prototype.slice.call(arguments);
  return withSerializedWrite_('trả máy cho khách hàng', function () {
    return returnToCustomerUnlocked_.apply(null, args);
  });
}

function returnToCustomerUnlocked_(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'returnToCustomer');
  payload = payload || {};
  const caseId = required_(payload.caseId, 'Mã hồ sơ');
  const readyAt = parseDateOptional_(payload.readyAt);
  const returnedAt = parseDateRequired_(payload.returnedAt, 'Ngày trả khách');
  const returnCompany = clean_(payload.returnCompany);
  const returnCustomer = required_(payload.returnCustomer, 'Tên khách hàng nhận');
  const returnAddress = required_(payload.returnAddress, 'Địa chỉ giao trả');
  const returnPhone = required_(payload.returnPhone, 'Số điện thoại người nhận');
  const returnEmail = emailOptional_(payload.returnEmail, 'Email người nhận');
  const returnCarrier = required_(payload.returnCarrier, 'Đơn vị vận chuyển');
  const returnTrackingCode = required_(payload.returnTrackingCode, 'Mã vận đơn');
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
    'Tên công ty gửi hàng': returnCompany,
    'Tên người gửi hàng': returnCustomer,
    'Địa chỉ gửi hàng': returnAddress,
    'Số điện thoại gửi hàng': returnPhone,
    'Email gửi hàng': returnEmail,
    'Đơn vị vận chuyển': returnCarrier,
    'Mã vận đơn': returnTrackingCode,
    'Trạng thái hồ sơ': 'Đã hoàn tất',
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': new Date()
  };
  updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
  audit_(actor, 'Trả khách hàng', 'Hồ sơ', caseId, record['Trung tâm tiếp nhận khách'], record, changes);
  syncDashboardProjectionCase_(caseId);
  syncPortalCaseIndexCase_(caseId);
  bumpPortalDatabaseRevision_();
  return { ok: true };
}

function authenticate_(idToken) {
  const tokenDigest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idToken || ''))
  ).replace(/=+$/g, '');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'portal-actor-v1-' + tokenDigest;
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  const actor = authenticateUncached_(idToken);
  cache.put(cacheKey, JSON.stringify(actor), 300);
  return actor;
}

function authenticateUncached_(idToken) {
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
  const subMatches = usersTable.rows.filter(function (item) {
    return clean_(item.GoogleSub) === googleSub && bool_(item['Đang hoạt động']);
  });
  if (subMatches.length > 1) throw publicError_('Cấu hình người dùng bị trùng GoogleSub. Vui lòng liên hệ quản lý hệ thống.');
  let user = subMatches[0] || null;
  if (!user) {
    const emailMatches = usersTable.rows.filter(function (item) {
      return String(item['Email Google'] || '').toLowerCase() === email && bool_(item['Đang hoạt động']);
    });
    if (emailMatches.length > 1) throw publicError_('Cấu hình người dùng bị trùng email. Vui lòng liên hệ quản lý hệ thống.');
    user = emailMatches[0] || null;
    if (user && clean_(user.GoogleSub) && clean_(user.GoogleSub) !== googleSub) {
      throw publicError_('Tài khoản Google không khớp định danh đã được cấp quyền.');
    }
    if (user && !clean_(user.GoogleSub)) {
      const lock = LockService.getScriptLock();
      // First-time account binding is serialized; leave room for several users
      // signing in together instead of failing at the former 10-second limit.
      lock.waitLock(30000);
      try {
        usersTable = readTableWithRows_(SHEETS.users);
        const lockedEmailMatches = usersTable.rows.filter(function (item) {
          return String(item['Email Google'] || '').toLowerCase() === email && bool_(item['Đang hoạt động']);
        });
        if (lockedEmailMatches.length > 1) throw publicError_('Cấu hình người dùng bị trùng email. Vui lòng liên hệ quản lý hệ thống.');
        user = lockedEmailMatches[0] || null;
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
  const homeCenter = clean_(user['Trung tâm']);
  const roleDefinition = resolveRole_(user['Vai trò'], homeCenter);
  if (!roleDefinition.isGlobalManager && CENTERS.indexOf(homeCenter) === -1) {
    throw publicError_('Tài khoản chưa được gán đúng trung tâm trong tab Người dùng.');
  }
  return {
    email: email,
    googleSub: googleSub,
    name: clean_(user['Họ và tên']),
    role: roleDefinition.label,
    roleCode: roleDefinition.code,
    homeCenter: homeCenter,
    centers: roleDefinition.isGlobalManager ? CENTERS.slice() : [homeCenter],
    isGlobalManager: roleDefinition.isGlobalManager,
    capabilities: Object.assign({}, roleDefinition.capabilities)
  };
}

// Run once from the Apps Script editor after deploying a new backend version.
// This performs the first Sheet read before end users arrive and returns only
// counts/timing, never customer data.
function warmPortalReadCache() {
  const revision = getPortalDatabaseRevision_();
  const startedAt = Date.now();
  const rows = readPortalCaseIndex_(revision);
  return { version: APP_VERSION, revision: revision, indexedCases: rows.length, elapsedMs: Date.now() - startedAt };
}

function authenticateDashboardManager_(idToken) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'viewDashboard');
  return { email: actor.email, role: 'service_manager', centers: actor.centers.slice() };
}

function ensurePortalCaseIndexSheet_() {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEETS.caseIndex);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEETS.caseIndex);
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('PORTAL_CASE_INDEX_READY') !== '1') {
    if (sheet.getMaxColumns() < PORTAL_CASE_INDEX_HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), PORTAL_CASE_INDEX_HEADERS.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, PORTAL_CASE_INDEX_HEADERS.length).setValues([PORTAL_CASE_INDEX_HEADERS.slice()]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function portalCaseIndexObject_(caseRecord, works, transfers) {
  const latest = works.length ? works[works.length - 1] : {};
  const workCenters = Array.from(new Set(works.map(function (work) { return clean_(work['Trung tâm xử lý']); }).filter(Boolean)));
  const searchable = [
    caseRecord['Mã hồ sơ'], caseRecord['Số sê-ri (S/N)'], caseRecord.Model,
    senderFromCase_(caseRecord), caseRecord['Dự án/Địa điểm'], caseRecord['Tên khách hàng'],
    caseRecord['Số điện thoại khách hàng'], caseRecord['Email khách hàng'],
    caseRecord['Tên công ty gửi hàng'], caseRecord['Tên người gửi hàng'],
    caseRecord['Số điện thoại gửi hàng'], caseRecord['Email gửi hàng'],
    caseRecord['Đơn vị vận chuyển'], caseRecord['Mã vận đơn']
  ].map(clean_).filter(Boolean).join(' ');
  return {
    'Mã hồ sơ': clean_(caseRecord['Mã hồ sơ']),
    'Dòng nguồn': Number(caseRecord.__rowNumber || 0),
    'Loại thiết bị': clean_(caseRecord['Loại thiết bị']),
    'Số sê-ri (S/N)': clean_(caseRecord['Số sê-ri (S/N)']),
    'Model': clean_(caseRecord.Model),
    'Trung tâm tiếp nhận khách': clean_(caseRecord['Trung tâm tiếp nhận khách']),
    'Trung tâm đang giữ hàng': clean_(caseRecord['Trung tâm đang giữ hàng']),
    'Trạng thái hồ sơ': clean_(caseRecord['Trạng thái hồ sơ']),
    'Tình trạng bảo hành': clean_(caseRecord['Tình trạng bảo hành']),
    'Ngày nhận từ khách': caseRecord['Ngày nhận từ khách'] || '',
    'Các trung tâm xử lý': workCenters.join('|'),
    'Mã công việc gần nhất': clean_(latest['Mã công việc']),
    'Trung tâm xử lý gần nhất': clean_(latest['Trung tâm xử lý']),
    'Trạng thái xử lý gần nhất': clean_(latest['Trạng thái xử lý']),
    'Kết quả gần nhất': clean_(latest['Kết quả xử lý']),
    'Ngày nhận công việc gần nhất': latest['Ngày trung tâm nhận hàng'] || '',
    'Ngày hoàn tất kỹ thuật gần nhất': latest['Ngày hoàn tất kỹ thuật'] || '',
    'Có luân chuyển': transfers.length > 0,
    'Số lượng': Math.max(1, Number(caseRecord['Số lượng']) || 1),
    'Tìm kiếm': searchable,
    'Ngày cập nhật chỉ mục': new Date()
  };
}

function portalCaseIndexValues_(object) {
  return PORTAL_CASE_INDEX_HEADERS.map(function (header) { return object[header] == null ? '' : object[header]; });
}

function rebuildPortalCaseIndex() {
  const startedAt = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    SpreadsheetApp.flush();
    const cases = readTable_(SHEETS.cases);
    const worksByCase = groupBy_(readTable_(SHEETS.workOrders), 'Mã hồ sơ');
    const transfersByCase = groupBy_(readTable_(SHEETS.transfers), 'Mã hồ sơ');
    const rows = cases.filter(function (item) { return clean_(item['Mã hồ sơ']); }).map(function (item) {
      const caseId = clean_(item['Mã hồ sơ']);
      return portalCaseIndexValues_(portalCaseIndexObject_(item, worksByCase[caseId] || [], transfersByCase[caseId] || []));
    });
    const sheet = ensurePortalCaseIndexSheet_();
    if (sheet.getMaxRows() < rows.length + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), PORTAL_CASE_INDEX_HEADERS.length)).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, PORTAL_CASE_INDEX_HEADERS.length).setValues(rows);
    sheet.getRange(2, 10, Math.max(1, rows.length), 1).setNumberFormat('yyyy-mm-dd');
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty('PORTAL_CASE_INDEX_READY', '1');
    const revision = bumpPortalDatabaseRevision_();
    const result = { version: APP_VERSION, revision: revision, indexed: rows.length, elapsedMs: Date.now() - startedAt };
    console.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

// Read-only audit and explicit repair for warranty facts imported from old tabs.
function auditHistoricalWarrantyData() { return reconcileHistoricalWarrantyData_(false); }
function repairHistoricalWarrantyData() { return reconcileHistoricalWarrantyData_(true); }
function auditHistoricalDashboardProjection() { return reconcileHistoricalDashboardProjection_(false); }
function repairHistoricalDashboardProjection() { return reconcileHistoricalDashboardProjection_(true); }

function historicalWarrantyValue_(value) {
  const text = clean_(value).toLowerCase();
  return WARRANTY_STATUSES.find(function (status) { return status.toLowerCase() === text; }) || '';
}

function reconcileHistoricalWarrantyData_(apply) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const report = { applied: Boolean(apply), checked: 0, mismatches: [], skipped: [], repairedCases: 0, repairedProjections: 0 };
  try {
    const spreadsheet = spreadsheet_();
    const sources = {};
    ['2024', '2025', '2026'].forEach(function (year) {
      const sheet = spreadsheet.getSheetByName(year);
      if (sheet) sources[year] = sheet.getDataRange().getValues();
    });
    const cases = readTableWithRows_(SHEETS.cases);
    const projection = readTableWithRows_(SHEETS.dashboard);
    const projectionsBySource = {};
    const projectionsById = groupBy_(projection.rows, 'Mã hồ sơ');
    projection.rows.forEach(function (row) {
      const match = /\[Nguồn (\d{4}), dòng (\d+),/.exec(clean_(row.Note));
      if (!match) return;
      const key = match[1] + '!' + match[2];
      if (!projectionsBySource[key]) projectionsBySource[key] = [];
      projectionsBySource[key].push(row);
    });
    cases.rows.forEach(function (record) {
      const key = clean_(record['Mã dòng dữ liệu cũ']);
      const match = /^(\d{4})!(\d+)$/.exec(key);
      if (!match || clean_(record['Trạng thái hồ sơ']) === 'Đã hủy') return;
      report.checked++;
      const values = sources[match[1]];
      const source = values && values[Number(match[2]) - 1];
      if (!source) { report.skipped.push({caseId:record['Mã hồ sơ'],source:key,reason:'missing_source'}); return; }
      const headers = values[0].map(function (value) { return clean_(value).toLowerCase(); });
      const serialColumn = headers.indexOf('s/n');
      const confirmationColumn = headers.indexOf('warranty confirmation');
      const statusColumn = headers.indexOf('warranty status');
      if (serialColumn < 0 || normalizeProjectionKey_(source[serialColumn]) !== normalizeProjectionKey_(record['Số sê-ri (S/N)'])) {
        report.skipped.push({caseId:record['Mã hồ sơ'],source:key,reason:'source_identity_changed'}); return;
      }
      const expected = historicalWarrantyValue_(source[confirmationColumn]) || historicalWarrantyValue_(source[statusColumn]);
      if (!expected) return;
      const confirmer = clean_(record['Người xác nhận bảo hành']);
      const editor = clean_(record['Người cập nhật gần nhất']);
      if ((confirmer && confirmer !== 'Dữ liệu lịch sử') || (editor && editor !== 'Đồng bộ dữ liệu cũ')) {
        report.skipped.push({caseId:record['Mã hồ sơ'],source:key,reason:'user_edited'}); return;
      }
      const changes = {};
      if (clean_(record['Tình trạng bảo hành']) !== expected) changes['Tình trạng bảo hành'] = expected;
      if (!confirmer) changes['Người xác nhận bảo hành'] = 'Dữ liệu lịch sử';
      if (Object.keys(changes).length) {
        report.mismatches.push({caseId:record['Mã hồ sơ'],source:key,current:clean_(record['Tình trạng bảo hành']),expected:expected});
        if (apply) {
          if (changes['Tình trạng bảo hành']) allowHistoricalWarrantyStatus_(cases.headers, record.__rowNumber, expected);
          updateObjectRow_(SHEETS.cases,cases.headers,record.__rowNumber,changes);
          report.repairedCases++;
        }
      }
      const candidates = projectionsById[clean_(record['Mã hồ sơ'])] || projectionsBySource[key] || [];
      if (candidates.length !== 1) {
        report.skipped.push({caseId:record['Mã hồ sơ'],source:key,reason:'projection_missing_or_ambiguous'}); return;
      }
      const row = candidates[0];
      if (normalizeProjectionKey_(row['S/N']) !== normalizeProjectionKey_(record['Số sê-ri (S/N)'])) return;
      if (clean_(row['Warranty confirmation']) !== expected && apply) {
        updateObjectRow_(SHEETS.dashboard,projection.headers,row.__rowNumber,{'Warranty confirmation':expected});
        report.repairedProjections++;
      }
    });
    if (apply) { SpreadsheetApp.flush(); bumpPortalDatabaseRevision_(); }
    console.log(JSON.stringify(report));
  } finally { lock.releaseLock(); }
  return report;
}

function reconcileHistoricalDashboardProjection_(apply) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const fields = [
    'Device Type', 'S/N', 'Model', 'Received date', 'Distributor', 'Where sent to Workshop',
    'Error Code', 'Issue 1', 'Issue 2', 'Issue 3', 'Issue 4', 'Warranty confirmation',
    'Warranty Status', 'Service Center', 'Check / Repair date', 'Delivery Status', 'Status',
    'Receive spare part date', 'Replace PN Board 1', 'Qty 1', 'Replace PN Board 2', 'Qty 2',
    'Replace PN Board 3', 'Qty 3', 'Replace PN Board 4', 'Qty 4', 'Return date'
  ];
  const dateFields = { 'Received date':true, 'Check / Repair date':true, 'Receive spare part date':true, 'Return date':true };
  const report = { applied:Boolean(apply), checked:0, mismatchedRows:0, repairedRows:0, mismatchedCells:0, skipped:[], samples:[] };
  try {
    const spreadsheet = spreadsheet_();
    const casesBySource = groupBy_(readTable_(SHEETS.cases), 'Mã dòng dữ liệu cũ');
    const projection = readTableWithRows_(SHEETS.dashboard);
    const projectionsBySource = {};
    projection.rows.forEach(function (row) {
      const match = /\[Nguồn (\d{4}), dòng (\d+),/.exec(clean_(row.Note));
      if (!match) return;
      const key = match[1] + '!' + match[2];
      if (!projectionsBySource[key]) projectionsBySource[key] = [];
      projectionsBySource[key].push(row);
    });
    ['2024','2025','2026'].forEach(function (year) {
      const sourceSheet = spreadsheet.getSheetByName(year);
      if (!sourceSheet || sourceSheet.getLastRow() < 2) return;
      const values = sourceSheet.getDataRange().getValues();
      const sourceHeaders = values[0].map(clean_);
      const indexes = {};
      fields.forEach(function (field) { indexes[field] = sourceHeaders.findIndex(function (header) { return header.toLowerCase() === field.toLowerCase(); }); });
      values.slice(1).forEach(function (source, offset) {
        if (!source.some(function (value) { return value !== '' && value !== null; })) return;
        const sourceRow = offset + 2;
        const key = year + '!' + sourceRow;
        report.checked++;
        const targets = projectionsBySource[key] || [];
        if (targets.length !== 1) { report.skipped.push({source:key,reason:'projection_missing_or_ambiguous'}); return; }
        const cases = casesBySource[key] || [];
        const edited = cases.some(function (record) {
          const editor = clean_(record['Người cập nhật gần nhất']);
          const confirmer = clean_(record['Người xác nhận bảo hành']);
          return (editor && editor !== 'Đồng bộ dữ liệu cũ') || (confirmer && confirmer !== 'Dữ liệu lịch sử');
        });
        if (edited) { report.skipped.push({source:key,reason:'user_edited'}); return; }
        const target = targets[0];
        const changes = {};
        fields.forEach(function (field) {
          const index = indexes[field];
          if (index < 0 || projection.headers.indexOf(field) === -1) return;
          let expected = source[index];
          if (dateFields[field]) expected = historicalProjectionDate_(expected) || '';
          if (historicalProjectionComparable_(target[field], dateFields[field]) === historicalProjectionComparable_(expected, dateFields[field])) return;
          changes[field] = expected;
        });
        const names = Object.keys(changes);
        if (!names.length) return;
        report.mismatchedRows++;
        report.mismatchedCells += names.length;
        if (report.samples.length < 200) report.samples.push({source:key,fields:names});
        if (apply) {
          updateObjectRow_(SHEETS.dashboard, projection.headers, target.__rowNumber, changes);
          report.repairedRows++;
        }
      });
    });
    if (apply) { SpreadsheetApp.flush(); bumpPortalDatabaseRevision_(); }
    console.log(JSON.stringify(report));
  } finally { lock.releaseLock(); }
  return report;
}

function historicalProjectionDate_(value) {
  if (value instanceof Date && !isNaN(value)) return value;
  if (typeof value === 'number' && isFinite(value)) return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
  const text = clean_(value).replace(/^B1(?=\d{1,2}-[A-Za-z]{3}-\d{2,4}$)/, '');
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (dmy) {
    const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return date.getFullYear() === Number(dmy[3]) && date.getMonth() === Number(dmy[2]) - 1 && date.getDate() === Number(dmy[1]) ? date : null;
  }
  const parsed = text ? new Date(text) : null;
  return parsed && !isNaN(parsed) ? parsed : null;
}

function historicalProjectionComparable_(value, isDate) {
  if (!isDate) return clean_(value);
  const date = historicalProjectionDate_(value);
  return date ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}

function syncPortalCaseIndexCase_(caseId) {
  caseId = clean_(caseId);
  if (!caseId) return { ok: false, reason: 'missing_case_id' };
  try {
    const record = findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0] || null;
    if (!record) return { ok: false, reason: 'missing_case' };
    const works = findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);
    const transfers = findTableRowsByField_(SHEETS.transfers, 'Mã hồ sơ', [caseId]);
    const sheet = ensurePortalCaseIndexSheet_();
    let targetRow = 0;
    if (sheet.getLastRow() >= 2) {
      const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      for (let index = 0; index < ids.length; index++) if (clean_(ids[index][0]) === caseId) { targetRow = index + 2; break; }
    }
    if (!targetRow) targetRow = Math.max(2, sheet.getLastRow() + 1);
    sheet.getRange(targetRow, 1, 1, PORTAL_CASE_INDEX_HEADERS.length).setValues([portalCaseIndexValues_(portalCaseIndexObject_(record, works, transfers))]);
    sheet.getRange(targetRow, 10).setNumberFormat('yyyy-mm-dd');
    return { ok: true, row: targetRow };
  } catch (error) {
    console.error('Không thể cập nhật chỉ mục hồ sơ ' + caseId + ': ' + String(error && error.message || error));
    return { ok: false, reason: String(error && error.message || error) };
  }
}

function readPortalCaseIndex_(revision) {
  if (PropertiesService.getScriptProperties().getProperty('PORTAL_CASE_INDEX_READY') !== '1') {
    throw publicError_('Chỉ mục hồ sơ chưa sẵn sàng. Quản trị viên cần chạy hàm rebuildPortalCaseIndex một lần.');
  }
  return readTableShared_(SHEETS.caseIndex, revision, false);
}

function indexedWorkCenters_(item) {
  return clean_(item['Các trung tâm xử lý']).split('|').map(clean_).filter(Boolean);
}

function canSeeIndexedCase_(actor, item) {
  if (actor.isGlobalManager) return true;
  if (actor.centers.indexOf(clean_(item['Trung tâm tiếp nhận khách'])) !== -1) return true;
  if (actor.centers.indexOf(clean_(item['Trung tâm đang giữ hàng'])) !== -1) return true;
  return indexedWorkCenters_(item).some(function (center) { return actor.centers.indexOf(center) !== -1; });
}

function publicIndexedCase_(actor, item) {
  const isManager = actor.isGlobalManager;
  const intakeCenter = clean_(item['Trung tâm tiếp nhận khách']);
  const currentCenter = clean_(item['Trung tâm đang giữ hàng']);
  const isIntake = isManager || actor.centers.indexOf(intakeCenter) !== -1;
  const canDelete = clean_(item['Tình trạng bảo hành']) === 'Chờ xác nhận' &&
    clean_(item['Trạng thái hồ sơ']) !== 'Đã hủy' && !bool_(item['Có luân chuyển']) &&
    currentCenter === intakeCenter && isIntake;
  const latestWork = clean_(item['Mã công việc gần nhất']) && (isManager || actor.centers.indexOf(clean_(item['Trung tâm xử lý gần nhất'])) !== -1) ? [{
    workOrderId: clean_(item['Mã công việc gần nhất']),
    center: clean_(item['Trung tâm xử lý gần nhất']),
    receivedAt: iso_(item['Ngày nhận công việc gần nhất']),
    workflowStatus: clean_(item['Trạng thái xử lý gần nhất']),
    technicalCompletedAt: iso_(item['Ngày hoàn tất kỹ thuật gần nhất']),
    outcome: clean_(item['Kết quả gần nhất']), issues: [], parts: [], holds: []
  }] : [];
  return {
    caseId: clean_(item['Mã hồ sơ']), deviceType: clean_(item['Loại thiết bị']),
    serialNumber: clean_(item['Số sê-ri (S/N)']), model: clean_(item.Model),
    quantity: Math.max(1, Number(item['Số lượng']) || 1), intakeCenter: intakeCenter,
    currentCenter: currentCenter, caseStatus: clean_(item['Trạng thái hồ sơ']),
    warrantyStatus: clean_(item['Tình trạng bảo hành']), receivedAt: isIntake ? iso_(item['Ngày nhận từ khách']) : null,
    canDelete: canDelete, workOrders: latestWork, transfers: []
  };
}

function objectFromSheetRow_(sheetName, rowNumber) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet || rowNumber < 2 || rowNumber > sheet.getLastRow()) return null;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  const values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const object = { __rowNumber: rowNumber };
  headers.forEach(function (header, index) { object[header] = values[index]; });
  return object;
}

function findTableRowsByField_(sheetName, field, wantedValues) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2 || !wantedValues.length) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  const column = headers.indexOf(field) + 1;
  if (!column) return [];
  const wanted = wantedValues.reduce(function (map, value) { map[clean_(value)] = true; return map; }, {});
  const keys = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues();
  const rowNumbers = [];
  keys.forEach(function (row, index) { if (wanted[clean_(row[0])]) rowNumbers.push(index + 2); });
  if (!rowNumbers.length) return [];
  return sheet.getRangeList(rowNumbers.map(function (row) { return 'A' + row + ':' + columnLetter_(headers.length) + row; })).getRanges().map(function (range, rangeIndex) {
    const values = range.getValues()[0];
    const object = { __rowNumber: rowNumbers[rangeIndex] };
    headers.forEach(function (header, index) { object[header] = values[index]; });
    return object;
  });
}

function columnLetter_(column) {
  let result = '';
  while (column > 0) { column--; result = String.fromCharCode(65 + (column % 26)) + result; column = Math.floor(column / 26); }
  return result;
}

function getCaseDetailForActor_(actor, caseId) {
  const revision = getPortalDatabaseRevision_();
  const indexed = readPortalCaseIndex_(revision).find(function (item) { return clean_(item['Mã hồ sơ']) === clean_(caseId); });
  if (!indexed || clean_(indexed['Trạng thái hồ sơ']) === 'Đã hủy') throw publicError_('Không tìm thấy hồ sơ hoặc hồ sơ đã bị hủy.');
  let record = objectFromSheetRow_(SHEETS.cases, Number(indexed['Dòng nguồn']));
  if (!record || clean_(record['Mã hồ sơ']) !== clean_(caseId)) {
    record = findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0] || null;
  }
  if (!record) throw publicError_('Không tìm thấy dữ liệu nguồn của hồ sơ.');
  if (clean_(record['Trạng thái hồ sơ']) === 'Đã hủy') throw publicError_('Hồ sơ đã bị hủy.');
  const works = findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);
  if (!canSeeCase_(actor, record, works)) throw publicError_('Bạn không có quyền xem hồ sơ này.');
  const transfers = findTableRowsByField_(SHEETS.transfers, 'Mã hồ sơ', [caseId]);
  const workIds = works.map(function (work) { return clean_(work['Mã công việc']); }).filter(Boolean);
  const issues = findTableRowsByField_(SHEETS.issues, 'Mã công việc', workIds);
  const parts = findTableRowsByField_(SHEETS.parts, 'Mã công việc', workIds);
  const holds = findTableRowsByField_(SHEETS.holds, 'Mã công việc', workIds);
  return publicCase_(actor, record, works, transfers, groupBy_(issues, 'Mã công việc'), groupBy_(parts, 'Mã công việc'), groupBy_(holds, 'Mã công việc'));
}

function canSeeCase_(actor, item, workOrders) {
  if (actor.isGlobalManager) return true;
  if (actor.centers.indexOf(item['Trung tâm tiếp nhận khách']) !== -1) return true;
  if (actor.centers.indexOf(item['Trung tâm đang giữ hàng']) !== -1) return true;
  return workOrders.some(function (work) { return actor.centers.indexOf(work['Trung tâm xử lý']) !== -1; });
}

function publicCase_(actor, item, workOrders, transfers, issuesByWork, partsByWork, holdsByWork) {
  const isManager = actor.isGlobalManager;
  const isClosed = clean_(item['Trạng thái hồ sơ']) === 'Đã hoàn tất';
  const hasPrivateAccess = isManager || actor.centers.indexOf(item['Trung tâm tiếp nhận khách']) !== -1 || actor.centers.indexOf(item['Trung tâm đang giữ hàng']) !== -1;
  const isIntake = isManager || actor.centers.indexOf(item['Trung tâm tiếp nhận khách']) !== -1;
  const ownWorks = isManager ? workOrders : workOrders.filter(function (work) { return actor.centers.indexOf(work['Trung tâm xử lý']) !== -1; });
  const hasEditableWork = ownWorks.some(function (work) { return ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(work['Trạng thái xử lý']) === -1; });
  const canEditCase = (isManager || !isClosed) && (isManager || (hasCapability_(actor, 'updateWorkOrder') && hasEditableWork));
  const canDeleteCase = clean_(item['Tình trạng bảo hành']) === 'Chờ xác nhận' &&
    clean_(item['Trạng thái hồ sơ']) !== 'Đã hủy' && transfers.length === 0 &&
    clean_(item['Trung tâm đang giữ hàng']) === clean_(item['Trung tâm tiếp nhận khách']) &&
    (isManager || actor.centers.indexOf(item['Trung tâm tiếp nhận khách']) !== -1);
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
      trackingReference: transfer['Mã vận chuyển'],
      note: transfer['Ghi chú bàn giao'],
      canAccept: !isClosed && hasCapability_(actor, 'acceptTransfer') && actor.centers.indexOf(transfer['Trung tâm nhận']) !== -1 && transfer['Trạng thái luân chuyển'] === 'Đang vận chuyển'
    };
  });
  return {
    caseId: item['Mã hồ sơ'], deviceType: item['Loại thiết bị'], serialNumber: item['Số sê-ri (S/N)'], model: item.Model,
    gsp: clean_(item.GSP), ma: clean_(item.MA),
    quantity: Number(item['Số lượng'] || 1), intakeCenter: item['Trung tâm tiếp nhận khách'], currentCenter: item['Trung tâm đang giữ hàng'],
    caseStatus: item['Trạng thái hồ sơ'], warrantyStatus: item['Tình trạng bảo hành'],
    sender: hasPrivateAccess ? senderFromCase_(item) : '', project: hasPrivateAccess ? projectFromCase_(item) : '', evidenceLink: hasPrivateAccess ? safeDriveLink_(item['Liên kết hồ sơ Drive']) : '', note: hasPrivateAccess ? item['Ghi chú chung'] : '',
    customerName: hasPrivateAccess ? item['Tên khách hàng'] : '', customerAddress: hasPrivateAccess ? item['Địa chỉ khách hàng'] : '', customerPhone: hasPrivateAccess ? item['Số điện thoại khách hàng'] : '', customerEmail: hasPrivateAccess ? item['Email khách hàng'] : '',
    senderCompany: hasPrivateAccess ? item['Tên công ty gửi hàng'] : '', senderCustomer: hasPrivateAccess ? item['Tên người gửi hàng'] : '', senderAddress: hasPrivateAccess ? item['Địa chỉ gửi hàng'] : '', senderPhone: hasPrivateAccess ? item['Số điện thoại gửi hàng'] : '',
    senderEmail: hasPrivateAccess ? item['Email gửi hàng'] : '', carrier: hasPrivateAccess ? item['Đơn vị vận chuyển'] : '', trackingCode: hasPrivateAccess ? item['Mã vận đơn'] : '',
    createdBy: item['Người tạo'], createdAt: iso_(item['Ngày tạo']),
    warrantyConfirmedBy: item['Người xác nhận bảo hành'], warrantyConfirmedAt: iso_(item['Ngày xác nhận bảo hành']), warrantyNote: item['Ghi chú xác nhận bảo hành'],
    isClosed: isClosed, canEditCase: canEditCase, canConfirmWarranty: canEditCase && canApproveWarranty_(actor), receivedAt: isIntake ? iso_(item['Ngày nhận từ khách']) : null,
    canDelete: canDeleteCase,
    canCorrectCase: isManager, correctionRevision: isManager ? getPortalDatabaseRevision_() : '',
    readyAt: isIntake ? iso_(item['Ngày sẵn sàng trả khách']) : null, returnedAt: isIntake ? iso_(item['Ngày trả khách']) : null,
    workOrders: ownWorks.map(function (work) { const workId = clean_(work['Mã công việc']); const value = publicWorkOrder_(work, (issuesByWork && issuesByWork[workId]) || [], (partsByWork && partsByWork[workId]) || [], (holdsByWork && holdsByWork[workId]) || []); value.canUpdate = (isManager || !isClosed) && hasCapability_(actor, 'updateWorkOrder') && (isManager || ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(work['Trạng thái xử lý']) === -1); return value; }), transfers: relevantTransfers,
    canTransfer: (isManager || !isClosed) && hasCapability_(actor, 'createTransfer') && (isManager || actor.centers.indexOf(item['Trung tâm đang giữ hàng']) !== -1),
    transferDestinations: transferDestinationsForSource_(item['Trung tâm đang giữ hàng']),
    canReturn: (isManager || !isClosed) && hasCapability_(actor, 'returnToCustomer') && isIntake && item['Trung tâm đang giữ hàng'] === item['Trung tâm tiếp nhận khách'] && item['Tình trạng bảo hành'] !== 'Chờ xác nhận'
  };
}

function publicWorkOrder_(work, issues, parts, holds) {
  const relatedIssues = (issues || []).filter(function (row) { return clean_(row['Loại ghi nhận']) !== 'Hiện tượng ban đầu'; });
  const relatedParts = parts || [];
  const relatedHolds = holds || [];
  return {
    workOrderId: work['Mã công việc'], center: work['Trung tâm xử lý'], receivedAt: iso_(work['Ngày trung tâm nhận hàng']),
    workflowStatus: work['Trạng thái xử lý'], diagnosisCompletedAt: iso_(work['Ngày hoàn tất chẩn đoán']),
    technicalCompletedAt: iso_(work['Ngày hoàn tất kỹ thuật']), outcome: work['Kết quả xử lý'], replacementType: work['Loại thiết bị đổi'],
    releasedAt: iso_(work['Ngày chuyển hàng đi']), note: work['Ghi chú nội bộ'],
    issues: relatedIssues.map(function (row) { return { issueId: row['Mã ghi nhận lỗi'], type: row['Loại ghi nhận'], code: row['Mã lỗi'], name: row['Tên lỗi'], confirmedAt: iso_(row['Ngày xác nhận lỗi']), note: row['Ghi chú lỗi'] }; }),
    parts: relatedParts.map(function (row) { return { partUsageId: row['Mã sử dụng linh kiện'], partNumber: row['Mã linh kiện (Part Number)'], name: row['Tên linh kiện'], quantity: Number(row['Số lượng'] || 0), receivedAt: iso_(row['Ngày nhận linh kiện']), usedAt: iso_(row['Ngày sử dụng']), note: row['Ghi chú'] }; }),
    holds: relatedHolds.map(function (row) { return { holdId: row['Mã tạm dừng'], reason: row['Lý do tạm dừng'], startAt: iso_(row['Ngày bắt đầu']), endAt: iso_(row['Ngày kết thúc']), note: row['Ghi chú/Xác nhận'] }; })
  };
}

function replaceWorkOrderChildren_(actor, workOrderId, issues, parts) {
  const issueTable = readTableWithRows_(SHEETS.issues);
  const currentIssues = issueTable.rows.filter(function (row) { return row['Mã công việc'] === workOrderId && clean_(row['Loại ghi nhận']) !== 'Hiện tượng ban đầu'; });
  const currentIssueById = currentIssues.reduce(function (map, row) { map[clean_(row['Mã ghi nhận lỗi'])] = row; return map; }, {});
  const keptIssueIds = {};
  (issues || []).filter(function (item) { return clean_(item.name); }).forEach(function (item) {
    const issueId = clean_(item.issueId);
    const values = {
      'Mã công việc': workOrderId, 'Loại ghi nhận': clean_(item.type) || 'Lỗi xác nhận',
      'Mã lỗi': clean_(item.code), 'Tên lỗi': clean_(item.name), 'Ngày xác nhận lỗi': parseDateOptional_(item.confirmedAt) || new Date(), 'Ghi chú lỗi': clean_(item.note)
    };
    if (issueId && currentIssueById[issueId]) {
      updateObjectRow_(SHEETS.issues, issueTable.headers, currentIssueById[issueId].__rowNumber, values);
      keptIssueIds[issueId] = true;
    } else {
      values['Mã ghi nhận lỗi'] = makeId_('LOI');
      appendObject_(SHEETS.issues, values);
    }
  });
  deleteRowsDescending_(SHEETS.issues, currentIssues.filter(function (row) { return !keptIssueIds[clean_(row['Mã ghi nhận lỗi'])]; }).map(function (row) { return row.__rowNumber; }));

  const partTable = readTableWithRows_(SHEETS.parts);
  const currentParts = partTable.rows.filter(function (row) { return row['Mã công việc'] === workOrderId; });
  const currentPartById = currentParts.reduce(function (map, row) { map[clean_(row['Mã sử dụng linh kiện'])] = row; return map; }, {});
  const keptPartIds = {};
  (parts || []).filter(function (item) { return clean_(item.partNumber) || clean_(item.name); }).forEach(function (item) {
    const partNumber = clean_(item.partNumber);
    const partName = required_(item.name, 'Tên linh kiện');
    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw publicError_('Số lượng linh kiện phải lớn hơn 0.');
    const partUsageId = clean_(item.partUsageId);
    const values = {
      'Mã công việc': workOrderId, 'Mã linh kiện (Part Number)': partNumber,
      'Tên linh kiện': partName, 'Số lượng': quantity, 'Ngày nhận linh kiện': parseDateOptional_(item.receivedAt),
      'Ngày sử dụng': parseDateOptional_(item.usedAt), 'Ghi chú': clean_(item.note)
    };
    if (partUsageId && currentPartById[partUsageId]) {
      updateObjectRow_(SHEETS.parts, partTable.headers, currentPartById[partUsageId].__rowNumber, values);
      keptPartIds[partUsageId] = true;
    } else {
      values['Mã sử dụng linh kiện'] = makeId_('LK');
      appendObject_(SHEETS.parts, values);
    }
  });
  deleteRowsDescending_(SHEETS.parts, currentParts.filter(function (row) { return !keptPartIds[clean_(row['Mã sử dụng linh kiện'])]; }).map(function (row) { return row.__rowNumber; }));
}

function fillMissingPartUsageDates_(workOrderId, usedAt) {
  const table = readTableWithRows_(SHEETS.parts);
  table.rows.filter(function (row) { return row['Mã công việc'] === workOrderId && !row['Ngày sử dụng']; }).forEach(function (row) {
    updateObjectRow_(SHEETS.parts, table.headers, row.__rowNumber, { 'Ngày sử dụng': usedAt });
  });
}

function appendWorkOrderHolds_(actor, workOrderId, holds) {
  const table = readTableWithRows_(SHEETS.holds);
  const current = table.rows.filter(function (row) { return row['Mã công việc'] === workOrderId; });
  const currentById = current.reduce(function (map, row) { map[clean_(row['Mã tạm dừng'])] = row; return map; }, {});
  const keptIds = {};
  (holds || []).filter(function (item) { return clean_(item.reason) && item.startAt; }).forEach(function (item) {
    const startAt = parseDateRequired_(item.startAt, 'Ngày bắt đầu tạm dừng');
    const endAt = parseDateOptional_(item.endAt);
    if (endAt && endAt < startAt) throw publicError_('Ngày kết thúc tạm dừng không được trước ngày bắt đầu.');
    const holdId = clean_(item.holdId);
    const values = {
      'Mã công việc': workOrderId, 'Lý do tạm dừng': clean_(item.reason),
      'Ngày bắt đầu': startAt, 'Ngày kết thúc': endAt, 'Ghi chú/Xác nhận': clean_(item.note), 'Người cập nhật': actor.email
    };
    if (holdId && currentById[holdId]) {
      updateObjectRow_(SHEETS.holds, table.headers, currentById[holdId].__rowNumber, values);
      keptIds[holdId] = true;
    } else {
      values['Mã tạm dừng'] = makeId_('TD');
      appendObject_(SHEETS.holds, values);
    }
  });
  deleteRowsDescending_(SHEETS.holds, current.filter(function (row) { return !keptIds[clean_(row['Mã tạm dừng'])]; }).map(function (row) { return row.__rowNumber; }));
}

function deleteRowsDescending_(sheetName, rowNumbers) {
  if (!rowNumbers || !rowNumbers.length) return;
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet ' + sheetName);
  rowNumbers.slice().sort(function (a, b) { return b - a; }).forEach(function (rowNumber) {
    if (rowNumber > 1 && rowNumber <= sheet.getLastRow()) sheet.deleteRow(rowNumber);
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

function resolveRole_(rawRole, homeCenter) {
  const raw = clean_(rawRole).toLowerCase();
  const aliases = {};
  ['service_manager', 'quản lý dịch vụ', 'quan ly dich vu', 'quản lý hệ thống', 'quan ly he thong'].forEach(function (value) { aliases[value] = ROLE_CODES.serviceManager; });
  ['center_manager', 'sungrow_manager', 'quản lý trung tâm', 'quan ly trung tam', 'quản lý', 'quan ly'].forEach(function (value) { aliases[value] = ROLE_CODES.centerManager; });
  ['center_staff', 'center_editor', 'nhân viên trung tâm', 'nhan vien trung tam', 'nhân viên', 'nhan vien'].forEach(function (value) { aliases[value] = ROLE_CODES.centerStaff; });
  let code = aliases[raw];
  if (!code) throw publicError_('Vai trò trong tab Người dùng không hợp lệ: ' + clean_(rawRole) + '.');
  const sungrowGlobalManager = code === ROLE_CODES.centerManager && homeCenter === SUNGROW_CENTER;
  const isGlobalManager = code === ROLE_CODES.serviceManager || sungrowGlobalManager;
  if (sungrowGlobalManager) code = ROLE_CODES.serviceManager;
  const labels = {};
  labels[ROLE_CODES.serviceManager] = 'Quản lý dịch vụ';
  labels[ROLE_CODES.centerManager] = 'Quản lý trung tâm';
  labels[ROLE_CODES.centerStaff] = 'Nhân viên trung tâm';
  return { code: code, label: labels[code], isGlobalManager: isGlobalManager, capabilities: ROLE_CAPABILITIES[code] };
}

function hasCapability_(actor, capability) {
  return !!(actor && actor.capabilities && actor.capabilities[capability]);
}

function assertCapability_(actor, capability) {
  if (!hasCapability_(actor, capability)) throw publicError_('Vai trò của bạn không được phép thực hiện thao tác này.');
}

function readTable_(sheetName) { return readTableWithRows_(sheetName).rows; }

/**
 * Read-only shared cache for the operational tables. The revision is bumped by
 * every mutation, so cached rows never need a user-specific key. A short lease
 * prevents a burst of browser requests from reading the same Sheet together.
 * Sheet I/O happens outside the script lock so writes are not blocked.
 */
function readTableShared_(sheetName, revision, allowStale) {
  const version = clean_(revision) || getPortalDatabaseRevision_();
  const baseKey = 'portal-table-v2-' + digest_(sheetName + '|' + version);
  const pointerKey = 'portal-table-current-v2-' + digest_(sheetName);
  const cache = CacheService.getScriptCache();
  const cached = readPortalChunkedCache_(cache, baseKey);
  if (cached) return unpackPortalTable_(cached);
  const previousVersion = clean_(cache.get(pointerKey));
  const previousKey = previousVersion && previousVersion !== version ? 'portal-table-v2-' + digest_(sheetName + '|' + previousVersion) : '';
  const stale = previousKey && allowStale !== false ? readPortalChunkedCache_(cache, previousKey) : null;

  const leaseKey = 'PORTAL_TABLE_LEASE_' + digest_(sheetName);
  const owner = Utilities.getUuid();
  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  let ownsLease = false;
  if (lock.tryLock(3000)) {
    try {
      const secondRead = readPortalChunkedCache_(cache, baseKey);
      if (secondRead) return unpackPortalTable_(secondRead);
      const lease = parseJson_(properties.getProperty(leaseKey));
      const leaseAge = lease && Number(lease.startedAt) ? Date.now() - Number(lease.startedAt) : Infinity;
      if (!lease || lease.revision !== version || leaseAge > 45000) {
        properties.setProperty(leaseKey, JSON.stringify({ owner: owner, revision: version, startedAt: Date.now() }));
        ownsLease = true;
      }
    } finally {
      lock.releaseLock();
    }
  }

  if (!ownsLease) {
    // Keep the application usable while one request refreshes the new revision.
    // The revision poll will fetch again after the builder publishes its cache.
    if (stale) return stalePortalRows_(stale);
    for (let attempt = 0; attempt < 50; attempt++) {
      Utilities.sleep(300);
      const ready = readPortalChunkedCache_(cache, baseKey);
      if (ready) return unpackPortalTable_(ready);
      // The previous lock may have belonged to a short write rather than a
      // cache builder. Periodically attempt to become the builder ourselves.
      if (attempt % 10 === 9) {
        const retryLock = LockService.getScriptLock();
        if (retryLock.tryLock(500)) {
          try {
            const lease = parseJson_(properties.getProperty(leaseKey));
            const leaseAge = lease && Number(lease.startedAt) ? Date.now() - Number(lease.startedAt) : Infinity;
            if (!lease || lease.revision !== version || leaseAge > 45000) {
              properties.setProperty(leaseKey, JSON.stringify({ owner: owner, revision: version, startedAt: Date.now() }));
              ownsLease = true;
              break;
            }
          } finally {
            retryLock.releaseLock();
          }
        }
      }
    }
    if (!ownsLease) throw publicError_('Dữ liệu đang được chuẩn bị cho nhiều người truy cập. Hệ thống sẽ tự thử lại, không cần tải lại trang.');
  }

  try {
    const table = readTableWithRows_(sheetName);
    if (writePortalChunkedCache_(cache, baseKey, packPortalTable_(table), 1800)) cache.put(pointerKey, version, 1800);
    return table.rows;
  } catch (error) {
    if (stale) {
      console.warn('Serving previous table snapshot after refresh failure for ' + sheetName + ': ' + String(error && error.message || error));
      return stalePortalRows_(stale);
    }
    throw error;
  } finally {
    const release = LockService.getScriptLock();
    if (release.tryLock(3000)) {
      try {
        const current = parseJson_(properties.getProperty(leaseKey));
        if (current && current.owner === owner) properties.deleteProperty(leaseKey);
      } finally {
        release.releaseLock();
      }
    }
  }
}

function packPortalTable_(table) {
  const headers = table.headers || [];
  return {
    h: headers,
    d: (table.rows || []).map(function (row) {
      return [row.__rowNumber].concat(headers.map(function (header) { return row[header]; }));
    })
  };
}

function unpackPortalTable_(packed) {
  if (!packed || !Array.isArray(packed.h) || !Array.isArray(packed.d)) return [];
  return packed.d.map(function (values) {
    const row = { __rowNumber: values[0] };
    packed.h.forEach(function (header, index) { row[header] = values[index + 1]; });
    return row;
  });
}

function stalePortalRows_(packed) {
  const rows = unpackPortalTable_(packed);
  rows.__cacheStale = true;
  return rows;
}

function readPortalChunkedCache_(cache, baseKey) {
  try {
    const count = Number(cache.get(baseKey + ':count'));
    if (!Number.isInteger(count) || count < 1 || count > 250) return null;
    const keys = Array.from({ length: count }, function (_, index) { return baseKey + ':part:' + index; });
    const chunks = cache.getAll(keys);
    if (keys.some(function (key) { return typeof chunks[key] !== 'string'; })) return null;
    return JSON.parse(keys.map(function (key) { return chunks[key]; }).join(''));
  } catch (error) {
    console.warn('Shared table cache read skipped: ' + String(error && error.message || error));
    return null;
  }
}

function writePortalChunkedCache_(cache, baseKey, value, ttl) {
  try {
    const serialized = JSON.stringify(value);
    const chunks = serialized.match(/[\s\S]{1,12000}/g) || [];
    if (!chunks.length || chunks.length > 250) return false;
    const entries = {};
    chunks.forEach(function (chunk, index) { entries[baseKey + ':part:' + index] = chunk; });
    cache.putAll(entries, ttl);
    cache.put(baseKey + ':count', String(chunks.length), ttl);
    return true;
  } catch (error) {
    console.warn('Shared table cache write skipped: ' + String(error && error.message || error));
    return false;
  }
}

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
  const indexes = headers.map(function (header, index) { return Object.prototype.hasOwnProperty.call(changes, header) ? index : -1; }).filter(function (index) { return index >= 0; });
  // Batch adjacent changed cells without overwriting unrelated cells or formulas.
  for (let cursor = 0; cursor < indexes.length;) {
    const first = indexes[cursor];
    const values = [];
    let last = first - 1;
    while (cursor < indexes.length && indexes[cursor] === last + 1) {
      last = indexes[cursor++];
      const value = changes[headers[last]];
      values.push(value == null ? '' : value);
    }
    sheet.getRange(rowNumber, first + 1, 1, values.length).setValues([values]);
  }
}

function tableHeaders_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
}

function audit_(actor, action, type, id, center, before, after) {
  bumpPortalDatabaseRevision_();
  appendObject_(SHEETS.audit, {
    'Thời gian': new Date(), 'Email người dùng': actor.email, 'Hành động': action, 'Loại đối tượng': type,
    'Mã đối tượng': id, 'Trung tâm': center, 'Dữ liệu trước': before ? JSON.stringify(stripInternal_(before)) : '', 'Dữ liệu sau': after ? JSON.stringify(after) : ''
  });
}

function ensureSheetColumns_(sheetName, names) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const headers = tableHeaders_(sheetName);
  names.forEach(function (name) {
    if (headers.indexOf(name) !== -1) return;
    const column = headers.length + 1;
    sheet.getRange(1, column).setValue(name);
    headers.push(name);
  });
}

function uploadCaseEvidence_(center, receivedAt, serial, model, customerName, attachment) {
  if (!attachment || !attachment.base64 || !attachment.name) throw publicError_('Vui lòng đính kèm hồ sơ .zip hoặc .rar.');
  const filename = clean_(attachment.name).replace(/[\\/]/g, '_').slice(0, 150);
  if (!/\.(zip|rar)$/i.test(filename)) throw publicError_('Chỉ nhận file .zip hoặc .rar.');
  if (attachment.base64.length > 11200000) throw publicError_('File vượt quá 8 MB. Vui lòng nén nhỏ hơn.');
  const bytes = Utilities.base64Decode(attachment.base64);
  if (bytes.length > 8 * 1024 * 1024) throw publicError_('File vượt quá 8 MB.');
  const isZip = bytes[0] === 80 && bytes[1] === 75 && [3, 5, 7].indexOf(bytes[2]) !== -1;
  const isRar = bytes[0] === 82 && bytes[1] === 97 && bytes[2] === 114 && bytes[3] === 33;
  if ((/\.zip$/i.test(filename) && !isZip) || (/\.rar$/i.test(filename) && !isRar)) throw publicError_('Nội dung file không đúng định dạng .zip/.rar.');
  const parentId = CASE_EVIDENCE_FOLDERS[center];
  if (!parentId) throw publicError_('Chưa cấu hình thư mục Drive cho center.');
  const safe = function (value) { return clean_(value).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 80) || 'Chua-co'; };
  const folderName = [iso_(receivedAt), safe(serial || 'Fan-khong-SN'), safe(model), safe(customerName)].join('-');
  const parent = DriveApp.getFolderById(parentId);
  const existing = parent.getFoldersByName(folderName);
  const folder = existing.hasNext() ? existing.next() : parent.createFolder(folderName);
  const blob = Utilities.newBlob(bytes, /\.zip$/i.test(filename) ? 'application/zip' : 'application/vnd.rar', filename);
  folder.createFile(blob);
  return folder.getUrl();
}

/**
 * Keep the legacy dashboard table as an auditable projection without using it
 * as the transaction source. New workflow tables remain authoritative.
 * A stable case-id column prevents duplicate projection rows; older projected
 * rows are adopted once by their unique S/N + received-date key.
 */
function syncDashboardProjectionCase_(caseId) {
  try {
    caseId = clean_(caseId);
    if (!caseId) return { ok: false, reason: 'missing_case_id' };
    SpreadsheetApp.flush();
    const spreadsheet = spreadsheet_();
    const sheet = spreadsheet.getSheetByName(SHEETS.dashboard);
    if (!sheet) return { ok: false, reason: 'missing_dashboard_sheet' };
    const caseRecord = readTable_(SHEETS.cases).find(function (item) { return clean_(item['Mã hồ sơ']) === caseId; });
    if (!caseRecord) return { ok: false, reason: 'missing_case' };
    if (clean_(caseRecord['Trạng thái hồ sơ']) === 'Đã hủy') return removeDashboardProjectionCase_(caseId, caseRecord);

    const works = readTable_(SHEETS.workOrders).filter(function (item) { return clean_(item['Mã hồ sơ']) === caseId; });
    const latest = works.length ? works[works.length - 1] : {};
    const workIds = works.reduce(function (map, item) { map[clean_(item['Mã công việc'])] = true; return map; }, {});
    const issues = readTable_(SHEETS.issues).filter(function (item) {
      return workIds[clean_(item['Mã công việc'])] && clean_(item['Loại ghi nhận']) !== 'Hiện tượng ban đầu';
    });
    const parts = readTable_(SHEETS.parts).filter(function (item) { return workIds[clean_(item['Mã công việc'])]; });
    const issueNames = issues.map(function (item) { return clean_(item['Tên lỗi']); }).filter(Boolean);
    const errorCode = issues.map(function (item) { return clean_(item['Mã lỗi']); }).filter(Boolean)[0] || '';
    const caseStatus = clean_(caseRecord['Trạng thái hồ sơ']);
    const deliveryStatus = caseStatus === 'Đã hoàn tất' ? 'Đã giao máy' : (caseStatus === 'Sẵn sàng trả khách' ? 'Chờ giao máy' : 'Chưa giao máy');

    if (sheet.getMaxColumns() < 31) sheet.insertColumnsAfter(sheet.getMaxColumns(), 31 - sheet.getMaxColumns());
    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
    let caseIdColumn = headers.indexOf('Mã hồ sơ') + 1;
    if (!caseIdColumn) {
      caseIdColumn = sheet.getLastColumn() + 1;
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, caseIdColumn).setValue('Mã hồ sơ');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
    }
    if (sheet.getRange(1, 30).getValue() !== 'Drive Link') sheet.getRange(1, 30).setValue('Drive Link');

    let targetRow = 0;
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, caseIdColumn, lastRow - 1, 1).getDisplayValues();
      for (let index = 0; index < ids.length; index++) {
        if (clean_(ids[index][0]) === caseId) { targetRow = index + 2; break; }
      }
      if (!targetRow) {
        const serial = normalizeProjectionKey_(caseRecord['Số sê-ri (S/N)']);
        const received = iso_(caseRecord['Ngày nhận từ khách']);
        if (serial && received) {
          const serials = sheet.getRange(2, 3, lastRow - 1, 1).getDisplayValues();
          const dates = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
          const candidates = [];
          for (let index = 0; index < serials.length; index++) {
            if (normalizeProjectionKey_(serials[index][0]) === serial && iso_(dates[index][0]) === received) candidates.push(index + 2);
          }
          if (candidates.length === 1) targetRow = candidates[0];
        }
      }
    }

    const isNewRow = !targetRow;
    if (!targetRow) targetRow = Math.max(2, lastRow + 1);
    if (targetRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), targetRow - sheet.getMaxRows());
    let sequence = Number(sheet.getRange(targetRow, 1).getValue()) || 0;
    if (!sequence) {
      const existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
      sequence = existing.reduce(function (max, row) { const value = Number(row[0]); return isFinite(value) ? Math.max(max, value) : max; }, 0) + 1;
    }
    const row = [
      sequence, caseRecord['Loại thiết bị'] || '', caseRecord['Số sê-ri (S/N)'] || '', caseRecord.Model || '',
      caseRecord['Ngày nhận từ khách'] || '', '', senderFromCase_(caseRecord), errorCode,
      issueNames[0] || '', issueNames[1] || '', issueNames[2] || '', issueNames[3] || '',
      caseRecord['Tình trạng bảo hành'] || '', latest['Kết quả xử lý'] || '',
      latest['Trung tâm xử lý'] || caseRecord['Trung tâm đang giữ hàng'] || '',
      latest['Ngày hoàn tất kỹ thuật'] || latest['Ngày hoàn tất chẩn đoán'] || '',
      deliveryStatus, latest['Trạng thái xử lý'] || '',
      parts.map(function (part) { return part['Ngày nhận linh kiện']; }).filter(Boolean)[0] || ''
    ];
    for (let partIndex = 0; partIndex < 4; partIndex++) {
      const part = parts[partIndex] || {};
      row.push(part['Mã linh kiện (Part Number)'] || '', part['Số lượng'] || '');
    }
    row.push(
      caseRecord['Ngày trả khách'] || '',
      [projectFromCase_(caseRecord) ? 'Dự án/Địa điểm: ' + projectFromCase_(caseRecord) : '', clean_(caseRecord['Ghi chú chung']), clean_(latest['Ghi chú nội bộ'])].filter(Boolean).join(' | '),
      safeDriveLink_(caseRecord['Liên kết hồ sơ Drive'])
    );
    sheet.getRange(targetRow, 1, 1, 30).setValues([row]);
    sheet.getRange(targetRow, caseIdColumn).setValue(caseId);
    [5, 16, 19, 28].forEach(function (column) { sheet.getRange(targetRow, column).setNumberFormat('dd/MM/yyyy'); });
    return { ok: true, row: targetRow, inserted: isNewRow };
  } catch (error) {
    console.error('Không thể đồng bộ hồ sơ ' + clean_(caseId) + ' sang Dữ liệu dashboard: ' + String(error && error.message || error));
    return { ok: false, reason: String(error && error.message || error) };
  }
}

function removeDashboardProjectionCase_(caseId, caseRecord) {
  const sheet = spreadsheet_().getSheetByName(SHEETS.dashboard);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, removed: 0 };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
  const caseIdColumn = headers.indexOf('Mã hồ sơ') + 1;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const serial = normalizeProjectionKey_(caseRecord && caseRecord['Số sê-ri (S/N)']);
  const received = iso_(caseRecord && caseRecord['Ngày nhận từ khách']);
  let removed = 0;
  for (let index = values.length - 1; index >= 0; index--) {
    const row = values[index];
    const matchesCaseId = caseIdColumn && clean_(row[caseIdColumn - 1]) === clean_(caseId);
    const matchesLegacyProjection = serial && received && normalizeProjectionKey_(row[2]) === serial && iso_(row[4]) === received;
    if (!matchesCaseId && !matchesLegacyProjection) continue;
    sheet.deleteRow(index + 2);
    removed++;
  }
  return { ok: true, removed: removed };
}

function normalizeProjectionKey_(value) {
  return clean_(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function removeOrphanDashboardProjections_(validCaseIds) {
  const sheet = spreadsheet_().getSheetByName(SHEETS.dashboard);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
  const caseIdColumn = headers.indexOf('Mã hồ sơ') + 1;
  if (!caseIdColumn) return 0;
  const values = sheet.getRange(2, caseIdColumn, sheet.getLastRow() - 1, 1).getDisplayValues();
  let removed = 0;
  for (let index = values.length - 1; index >= 0; index--) {
    const caseId = clean_(values[index][0]);
    if (!caseId || !/^HS-/i.test(caseId) || validCaseIds[caseId]) continue;
    sheet.deleteRow(index + 2);
    removed++;
  }
  return removed;
}

/** Run once after deploying to backfill new-workflow cases and purge deleted projections. */
function reconcileDashboardProjection() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const allCases = readTable_(SHEETS.cases);
    const validCaseIds = {};
    allCases.forEach(function (item) {
      const caseId = clean_(item['Mã hồ sơ']);
      if (caseId) validCaseIds[caseId] = true;
    });
    const cases = allCases.filter(function (item) { return clean_(item['Nguồn dữ liệu']) === 'Quy trình mới'; });
    const result = {
      total: cases.length,
      synced: 0,
      inserted: 0,
      removedOrphans: removeOrphanDashboardProjections_(validCaseIds),
      errors: []
    };
    cases.forEach(function (item) {
      const caseId = clean_(item['Mã hồ sơ']);
      const sync = syncDashboardProjectionCase_(caseId);
      if (sync.ok) {
        result.synced++;
        if (sync.inserted) result.inserted++;
      } else result.errors.push({ caseId: caseId, reason: sync.reason });
    });
    SpreadsheetApp.flush();
    console.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
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
      const confirmedIssues = issues.filter(function (issue) { return clean_(issue['Loại ghi nhận']) !== 'Hiện tượng ban đầu'; });
      const issueNames = confirmedIssues.map(function (issue) { return clean_(issue['Tên lỗi']); }).filter(Boolean);
      const errorCode = confirmedIssues.map(function (issue) { return clean_(issue['Mã lỗi']); }).filter(Boolean)[0] || '';
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

/**
 * Chạy thủ công trong Apps Script trước khi deploy production.
 * Hàm chỉ đọc tab Người dùng, không thay đổi dữ liệu.
 */
function auditUserAccessConfiguration() {
  const rows = readTable_(SHEETS.users);
  const errors = [];
  const warnings = [];
  const activeEmails = {};
  const activeSubs = {};
  const users = rows.map(function (row) {
    const email = clean_(row['Email Google']).toLowerCase();
    const center = clean_(row['Trung tâm']);
    const active = bool_(row['Đang hoạt động']);
    const sub = clean_(row.GoogleSub);
    const configured = !!(email || clean_(row['Họ và tên']) || center || clean_(row['Vai trò']));
    if (!configured && !active) return null;
    let role = null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Dòng ' + row.__rowNumber + ': Email Google không hợp lệ.');
    try { role = resolveRole_(row['Vai trò'], center); }
    catch (error) { errors.push('Dòng ' + row.__rowNumber + ': ' + error.message); }
    if (role && !role.isGlobalManager && CENTERS.indexOf(center) === -1) errors.push('Dòng ' + row.__rowNumber + ': Trung tâm không hợp lệ cho tài khoản ' + email + '.');
    if (active && email) {
      if (activeEmails[email]) errors.push('Email đang hoạt động bị trùng: ' + email + '.');
      activeEmails[email] = true;
    }
    if (active && sub) {
      if (activeSubs[sub]) errors.push('GoogleSub đang hoạt động bị trùng ở dòng ' + row.__rowNumber + '.');
      activeSubs[sub] = true;
    }
    if (active && !sub) warnings.push(email + ': GoogleSub sẽ được khóa ở lần đăng nhập hợp lệ đầu tiên.');
    return { row: row.__rowNumber, email: email, active: active, roleCode: role ? role.code : '', center: center, googleSubBound: !!sub && sub.toLowerCase() !== 'false' };
  }).filter(Boolean);
  const report = { ok: errors.length === 0, activeUsers: users.filter(function (user) { return user.active; }).length, errors: errors, warnings: warnings, users: users };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

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

function canApproveWarranty_(actor) { return hasCapability_(actor, 'approveWarranty'); }
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
function publicActor_(actor) { return { email: actor.email, name: actor.name, role: actor.role, roleCode: actor.roleCode, homeCenter: actor.homeCenter, centers: actor.centers.slice(), isGlobalManager: actor.isGlobalManager, capabilities: Object.assign({}, actor.capabilities), canApproveWarranty: canApproveWarranty_(actor) }; }
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
