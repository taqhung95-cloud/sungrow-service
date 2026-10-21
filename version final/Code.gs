const APP_VERSION = '1.11.16-batched-case-reads';
var PORTAL_RUNTIME_TIMEZONE_ = null;
var PORTAL_RUNTIME_SPREADSHEET_ = null;
var PORTAL_WRITE_TIMING_ = null;
var PORTAL_WRITE_HEADERS_ = null;
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
  'Có luân chuyển', 'Số lượng', 'Tìm kiếm', 'Ngày cập nhật chỉ mục', 'Kiểu hồ sơ', 'S/N inverter liên quan', 'Tiến độ Fan'
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

function doGet(e) {
  if (e && e.parameter && e.parameter.portal_bridge === '1') return renderPortalBridge_(e.parameter);
  const template = HtmlService.createTemplateFromFile('Index');
  template.authBrokerUrl = AUTH_BROKER_URL;
  template.appVersion = APP_VERSION;
  return template.evaluate()
    .setTitle('Sungrow Service Center - Quản lý & nhập liệu')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// HTMLService RPC keeps the existing API dispatcher/authentication, without a
// browser fetch through ContentService's one-time redirect URL.
function renderPortalBridge_(parameters) {
  const origin = String(parameters.bridge_origin || '');
  const channel = String(parameters.bridge_channel || '');
  const allowed = ['https://sungrow-service.sungrowvietnam.com.vn', 'https://taqhung95-cloud.github.io'];
  if (allowed.indexOf(origin) < 0 || !/^[a-f0-9]{48}$/.test(channel)) throw Error('Invalid bridge origin or channel.');
  const template = HtmlService.createTemplateFromFile('PortalBridge');
  template.bridgeConfigJson = JSON.stringify({origin:origin,channel:channel,version:APP_VERSION}).replace(/</g,'\\u003c');
  return template.evaluate().setTitle('Service Center data connection').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function portalBridgeCall(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || ['portal.call','dashboard.read','tickets.page','tickets.search'].indexOf(request.action) < 0) {
    return JSON.stringify({ok:false,error:{code:'BAD_REQUEST',message:'Yêu cầu không hợp lệ.'}});
  }
  const contents = JSON.stringify(request);
  return LEGACY_DASHBOARD_API.handlePost({postData:{contents:contents}}).getContent();
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

function getBootstrap(idToken, options) {
  const actor = authenticate_(idToken);
  if(actor.isGlobalManager&&typeof fmgMarkWebRuntime_==='function')fmgMarkWebRuntime_();
  return {
    actor: publicActor_(actor),
    centers: actor.isGlobalManager ? CENTERS.slice() : actor.centers.slice(),
    allCenters: CENTERS.slice(),
    deviceTypes: readDeviceTypes_(!!(options && options.refreshCatalog)),
    version: APP_VERSION,
    entrySuggestions: typeof getEntrySuggestions === 'function',
    warrantyBatchLookup: true,
    caseLatestResultFilter: true,
    systemCaseCorrections: typeof flAdminCorrectionReady_==='function'&&flAdminCorrectionReady_(),
    fanLotModels: typeof flModelsReady_==='function'&&flModelsReady_(),
    notifications: typeof listNotifications === 'function',
    portalSessions: typeof createPortalSession === 'function',
    dashboardRanges: true,
    reportExports: typeof readReportPage === 'function',
    customerDirectory: typeof cdPrepareCase_ === 'function',
    temporaryUploads: typeof temporaryUploadsEnabled_ === 'function' && temporaryUploadsEnabled_(),
    supplementalAttachments: typeof commitCaseAttachments === 'function',
    fanLots: typeof flEnabled_ === 'function' && flEnabled_(),
    fanLotReader: typeof flPublic_ === 'function',
    fanSharedForms: typeof fwSharedFormsReady_ === 'function' && fwSharedFormsReady_(),
    fanLotPartsWithTechnical: typeof flPartUsageRequests_ === 'function',
    uploadCategories: typeof uploadCategoriesEnabled_ === 'function' && uploadCategoriesEnabled_()
  };
}

function handlePortalApi_(request) {
  request = request || {};
  const functionName = clean_(request.functionName);
  const args = Array.isArray(request.args) ? request.args : [];
  const allowed = {
    getReportBootstrap: function(){if(typeof getReportBootstrap!=='function')throw publicError_('Chưa cài đặt Báo cáo.');return getReportBootstrap.apply(null,arguments);},
    readReportPage: function(){if(typeof readReportPage!=='function')throw publicError_('Chưa cài đặt Báo cáo.');return readReportPage.apply(null,arguments);},
    getBootstrap: getBootstrap,
    getEntrySuggestions: function(){if(typeof getEntrySuggestions!=='function')throw publicError_('Cần cập nhật EntrySuggestions.gs.');return getEntrySuggestions.apply(null,arguments);},
    createPortalSession: function(){if(typeof createPortalSession!=='function')throw publicError_('Chưa cài đặt phiên đăng nhập 8 giờ.');return createPortalSession.apply(null,arguments);},
    revokePortalSession: function(){if(typeof revokePortalSession!=='function')throw publicError_('Chưa cài đặt phiên đăng nhập 8 giờ.');return revokePortalSession.apply(null,arguments);},
    getPortalSyncState: getPortalSyncState,
    listCases: listCases,
    getCaseDetail: getCaseDetail,
    searchCases: searchCases,
    lookupWarranty: lookupWarranty,
    lookupWarrantyBatch: lookupWarrantyBatch,
    searchCustomers: function(){if(typeof searchCustomers!=='function')throw publicError_('Chưa cài đặt danh bạ khách hàng.');return searchCustomers.apply(null,arguments);},
    saveCustomer: function(){if(typeof saveCustomer!=='function')throw publicError_('Chưa cài đặt danh bạ khách hàng.');return saveCustomer.apply(null,arguments);},
    createCase: createCase,
    updateFanLot: function(){if(typeof updateFanLot!=='function')throw publicError_('Chưa cài FanLots.gs.');return updateFanLot.apply(null,arguments);},
    reconcileFanLot: function(){return reconcileFanLot.apply(null,arguments);},
    getFanLotHistory: function(){return getFanLotHistory.apply(null,arguments);},
    previewFanGroup: function(){return previewFanGroup.apply(null,arguments);},
    createFanGroup: function(){return createFanGroup.apply(null,arguments);},
    listFanGroups: function(){return listFanGroups.apply(null,arguments);},
    getFanGroup: function(){return getFanGroup.apply(null,arguments);},
    getCreationStatus: getCreationStatus,
    beginCaseUpload: function(){if(typeof beginCaseUpload!=='function')throw publicError_('Chưa cài đặt upload tạm.');return beginCaseUpload.apply(null,arguments);},
    uploadCaseFile: function(){if(typeof uploadCaseFile!=='function')throw publicError_('Chưa cài đặt upload tạm.');return uploadCaseFile.apply(null,arguments);},
    getCaseUploadSession: function(){if(typeof getCaseUploadSession!=='function')throw publicError_('Chưa cài đặt upload tạm.');return getCaseUploadSession.apply(null,arguments);},
    removeCaseUploadFile: function(){if(typeof removeCaseUploadFile!=='function')throw publicError_('Chưa cài đặt upload tạm.');return removeCaseUploadFile.apply(null,arguments);},
    setCaseUploadCategory: function(){if(typeof setCaseUploadCategory!=='function')throw publicError_('Chưa cài đặt nhóm upload.');return setCaseUploadCategory.apply(null,arguments);},
    commitCaseAttachments: function(){if(typeof commitCaseAttachments!=='function')throw publicError_('Chưa cài đặt bổ sung đính kèm.');return commitCaseAttachments.apply(null,arguments);},
    getCaseAttachmentReceipt: function(){if(typeof getCaseAttachmentReceipt!=='function')throw publicError_('Chưa cài đặt bổ sung đính kèm.');return getCaseAttachmentReceipt.apply(null,arguments);},
    cancelCase: cancelCase,
    confirmWarranty: confirmWarranty,
    requestWarrantyReview: function(){if(typeof requestWarrantyReview!=='function')throw publicError_('Cần cập nhật Notifications.gs.');return requestWarrantyReview.apply(null,arguments);},
    listNotifications: function(){if(typeof listNotifications!=='function')throw publicError_('Cần cập nhật Notifications.gs.');return listNotifications.apply(null,arguments);},
    markNotificationsRead: function(){if(typeof markNotificationsRead!=='function')throw publicError_('Cần cập nhật Notifications.gs.');return markNotificationsRead.apply(null,arguments);},
    updateWorkOrder: updateWorkOrder,
    correctCase: correctCase,
    createTransfer: createTransfer,
    acceptTransfer: acceptTransfer,
    returnToCustomer: returnToCustomer
  };
  if (!Object.prototype.hasOwnProperty.call(allowed, functionName)) {
    throw publicError_('Thao tác không được phép.');
  }
  const data = allowed[functionName].apply(null, args);
  const snapshotActions = ['updateWorkOrder','correctCase','confirmWarranty','createTransfer','acceptTransfer','returnToCustomer','updateFanLot','reconcileFanLot','commitCaseAttachments'];
  if (request.returnCaseDetail && snapshotActions.indexOf(functionName) >= 0 && data && typeof data === 'object') {
    const caseId=clean_(request.returnCaseDetail);
    if(caseId.length<=150){
      try { data.caseDetail = getCaseDetail(args[0],caseId); }
      catch (error) { data.caseDetailUnavailable = true; }
    }
  }
  return data;
}

function listCases(idToken, filters) {
  const startedAt = Date.now();
  const actor = authenticate_(idToken);
  let revision = '';
  let cache = null;
  let cacheKey = '';
  try {
    revision = getPortalDatabaseRevision_();
    const cacheSeed = JSON.stringify({
      user: actor.googleSub || actor.email,
      version: APP_VERSION,
      revision: revision,
      filters: filters || {}
    });
    const digest = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cacheSeed)
    ).replace(/=+$/g, '');
    cache = CacheService.getScriptCache();
    cacheKey = 'portal-cases-v1-' + digest;
    const cached = filters && filters.refresh === true ? null : cache.get(cacheKey);
    if (cached) { const result = JSON.parse(cached); result.timing = { serverMs: Date.now() - startedAt, cacheHit: true }; return result; }
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
  result.timing = { serverMs: Date.now() - startedAt, cacheHit: false };
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

// Manual Sheet edits do not bump the case revision. Use a separate short cache;
// explicit sync and validation before a write always read the small catalog fresh.
function readDeviceTypes_(fresh) {
  const key = 'device-types-' + APP_VERSION + '-' + DATABASE_SPREADSHEET_ID;
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const raw = cache.get(key);
    if (raw) { try { const saved = JSON.parse(raw); if (Array.isArray(saved) && saved.every(function(v){return typeof v === 'string';})) return saved; } catch (e) {} }
  }
  const sheet = spreadsheet_().getSheetByName('Danh mục');
  if (!sheet) throw publicError_('Thiếu tab Danh mục để đọc loại thiết bị.');
  const last = sheet.getLastRow();
  if (last > 5000) throw publicError_('Tab Danh mục quá lớn; vui lòng kiểm tra lại danh mục.');
  const values = sheet.getRange(1, 1, Math.max(1,last), 4).getValues();
  const headers = (values[0] || []).map(clean_);
  const indexes = ['Nhóm danh mục','Mã','Giá trị hiển thị','Đang sử dụng'].map(function(h){return headers.indexOf(h);});
  if (indexes.some(function(i){return i < 0;})) throw publicError_('Tab Danh mục thiếu cột nhóm, mã, giá trị hiển thị hoặc đang sử dụng.');
  const types = [];
  values.slice(1).forEach(function(row){
    if (clean_(row[indexes[0]]) !== 'LOẠI_THIẾT_BỊ' || !bool_(row[indexes[3]])) return;
    const code = clean_(row[indexes[1]]), label = clean_(row[indexes[2]]);
    if (!code || !label || label.length > 2000 || /^[=+@]/.test(label)) throw publicError_('Loại thiết bị đang sử dụng phải có mã và tên hợp lệ trong Danh mục.');
    if (types.indexOf(label) < 0) types.push(label);
  });
  cache.put(key, JSON.stringify(types), 60);
  return types;
}

function assertDeviceType_(value, current) {
  // Preserve the exact existing value on unrelated edits, even when deactivated.
  if (current && value === current) return;
  if (readDeviceTypes_(true).indexOf(value) < 0) throw publicError_('Loại thiết bị không hợp lệ hoặc đã ngừng sử dụng. Bấm Đồng bộ để cập nhật danh mục.');
}

function listCasesUncached_(idToken, filters, authenticatedActor, dataRevision) {
  const actor = authenticatedActor || authenticate_(idToken);
  assertCapability_(actor, 'viewCases');
  filters = filters || {};
  const query = clean_(filters.query).toLowerCase();
  const status = clean_(filters.status);
  const warrantyStatus = clean_(filters.warrantyStatus);
  const latestResult = clean_(filters.latestResult);
  const center = clean_(filters.center);
  if (center && CENTERS.indexOf(center) === -1) throw publicError_('Trung tâm lọc không hợp lệ.');
  if (center && !actor.isGlobalManager) assertCenterAllowed_(actor, center);
  const pageSize = Math.max(10, Math.min(200, Number(filters.pageSize) || 20));
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const revision = clean_(dataRevision) || getPortalDatabaseRevision_();
  const readStarted = Date.now();
  const cases = readPortalCaseIndex_(revision);
  const filterStarted = Date.now();

  const resultOptions = new Set();
  const filtered = cases.filter(function (item) {
    if (clean_(item['Trạng thái hồ sơ']) === 'Đã hủy') return false;
    if (!canSeeIndexedCase_(actor, item)) return false;
    const searchable = clean_(item['Tìm kiếm']).toLowerCase();
    if (query && (filters.exactKey === true
      ? clean_(item['Mã hồ sơ']).toLowerCase() !== query && clean_(item['Số sê-ri (S/N)']).toLowerCase() !== query && !(typeof flExactIndexMatch_==='function'&&flExactIndexMatch_(item,query))
      : searchable.indexOf(query) === -1)) return false;
    if (status && item['Trạng thái hồ sơ'] !== status) return false;
    if (warrantyStatus && item['Tình trạng bảo hành'] !== warrantyStatus) return false;
    if (center && item['Trung tâm đang giữ hàng'] !== center) return false;
    const canSeeLatest=clean_(item['Mã công việc gần nhất'])&&(actor.isGlobalManager||(actor.centers||[]).indexOf(clean_(item['Trung tâm xử lý gần nhất']))!==-1);
    const displayedResult=canSeeLatest?(clean_(item['Kết quả gần nhất'])||clean_(item['Trạng thái xử lý gần nhất'])||'Chưa cập nhật'):'Chưa cập nhật';resultOptions.add(displayedResult);
    if(latestResult&&displayedResult!==latestResult)return false;
    return true;
  });
  const sortStarted = Date.now();
  const timezone = Session.getScriptTimeZone();
  const ordered = filtered.map(function (item) {
    return { item: item, day: portalReceiptSortKey_(item['Ngày nhận từ khách'], timezone), id: clean_(item['Mã hồ sơ']) };
  }).sort(function (a, b) {
    if (a.day === null || b.day === null) return a.day === null ? (b.day === null ? a.id.localeCompare(b.id) : 1) : -1;
    return (filters.sortOrder === 'oldest' ? a.day - b.day : b.day - a.day) || a.id.localeCompare(b.id);
  });
  const publicStarted = Date.now();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const items = ordered.slice(start, start + pageSize).map(function (entry) { return publicIndexedCase_(actor, entry.item); });
  return { items: items, total: total, page: page, pageSize: pageSize, totalPages: totalPages, latestResultFilter:true, latestResultOptions:Array.from(resultOptions).sort(function(a,b){return a.localeCompare(b,'vi');}), stale: Boolean(cases.__cacheStale), phasesMs: { index: filterStarted - readStarted, filter: sortStarted - filterStarted, sort: publicStarted - sortStarted, serialize: Date.now() - publicStarted } };
}

function portalReceiptSortKey_(value, timezone) {
  const date = asDate_(value);
  if (!date || isNaN(date.getTime())) return null;
  // The production database uses Vietnam calendar days (UTC+7, no DST).
  // Never call Apps Script services from a sort comparator.
  const offset = /^(Asia\/(Saigon|Ho_Chi_Minh|Bangkok)|Etc\/GMT-7)$/.test(timezone) ? 7 * 3600000 : /^(UTC|Etc\/UTC|GMT)$/.test(timezone) ? 0 : null;
  if (offset !== null) {
    const local = new Date(date.getTime() + offset);
    return local.getUTCFullYear() * 10000 + (local.getUTCMonth() + 1) * 100 + local.getUTCDate();
  }
  // Preserve other configured timezones; at most one formatting call per row.
  return Number(Utilities.formatDate(date, timezone, 'yyyyMMdd'));
}

function searchCases(idToken, rawQuery, options) {
  const query = clean_(rawQuery);
  if (query.length < 2) throw publicError_('Nhập ít nhất 2 ký tự để tìm kiếm.');
  const actor = authenticate_(idToken);
  if (options && options.exactKey === true) {
    const result = listCasesUncached_(idToken, {
      query: query, exactKey: true, page: options.page, pageSize: options.pageSize
    }, actor, getPortalDatabaseRevision_());
    // One match: keep a single HTTP round trip. Multiple matches: summaries only.
    result.detailed = result.total === 1;
    if (result.detailed) result.items = [getCaseDetailForActor_(actor, result.items[0].caseId)];
    return result;
  }
  const matches = listCases(idToken, { query: query, page: 1, pageSize: 20 }).items;
  return matches.map(function (item) { return getCaseDetailForActor_(actor, item.caseId); });
}

function getCaseDetail(idToken, caseId, options) {
  const started=Date.now();
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'viewCases');
  const result=getCaseDetailForActor_(actor, required_(caseId, 'mã hồ sơ'), {refresh:!!(options&&options.refresh)});
  result.readTiming=Object.assign({path:'legacy',cacheHit:false},result.readTiming||{},{serverMs:Date.now()-started});
  return result;
}

function warrantyLookupSource_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('WARRANTY_LOOKUP_SHEET_ID') || WARRANTY_LOOKUP_SHEET_ID;
  const sheets = SpreadsheetApp.openById(sheetId).getSheets();
  const canonicalSheet = sheets.find(function (candidate) {
    return typeof candidate.getName === 'function' && candidate.getName() === 'All SN list';
  });
  const sheet = (canonicalSheet ? [canonicalSheet] : sheets).find(function (candidate) {
    if (!candidate.getLastRow() || !candidate.getLastColumn()) return false;
    const names = candidate.getRange(1, 1, 1, candidate.getLastColumn()).getDisplayValues()[0].map(function (value) { return clean_(value).toLowerCase(); });
    return names.indexOf('sn') !== -1 && names.indexOf('start date') !== -1 && names.indexOf('warranty package') !== -1;
  });
  if (!sheet) throw publicError_('Nguồn bảo hành không có tab với các cột SN, Start date, Warranty package.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(clean_);
  const serialColumn = headers.findIndex(function (value) { return value.toUpperCase() === 'SN'; }) + 1;
  const startColumn = headers.findIndex(function (value) { return value.toLowerCase() === 'start date'; }) + 1;
  const packageColumn = headers.findIndex(function (value) { return value.toLowerCase() === 'warranty package'; }) + 1;
  const modelColumn = headers.findIndex(function (value) { return value.toLowerCase() === 'model'; }) + 1;
  const standardModelColumn = headers.findIndex(function (value) { return value.toLowerCase() === 'model chuẩn'; }) + 1;
  if (!serialColumn || !startColumn || !packageColumn) throw publicError_('Nguồn bảo hành thiếu cột SN, Start date hoặc Warranty package.');
  return {sheet:sheet,headers:headers,startColumn:startColumn,packageColumn:packageColumn,modelColumn:modelColumn,standardModelColumn:standardModelColumn,serialColumn:serialColumn};
}
function warrantyLookupResult_(row, source) {
  const startColumn=source.startColumn,packageColumn=source.packageColumn,modelColumn=source.modelColumn,standardModelColumn=source.standardModelColumn;
  const modelValue = standardModelColumn ? clean_(row[standardModelColumn - 1]) : (modelColumn ? clean_(row[modelColumn - 1]) : '');
  const modelNeedsReview = /^cần xác minh$/i.test(modelValue) || /^#(?:REF!|N\/A|ERROR!|VALUE!|NAME\?|DIV\/0!|NUM!|SPILL!)/i.test(modelValue);
  const model = modelNeedsReview ? '' : modelValue;
  const modelStatus = modelNeedsReview ? 'needs_review' : (model ? 'found' : 'missing');
  const start = warrantyDate_(row[startColumn - 1]);
  const packageName = clean_(row[packageColumn - 1]);
  const years = /extended/i.test(packageName) ? 10 : (/standard/i.test(packageName) ? 5 : 0);
  if (!start || !years) return { status: 'insufficient', label: 'Thiếu thông tin bảo hành', package: packageName, model:model, modelStatus:modelStatus };
  const expires = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { status: today <= expires ? 'valid' : 'expired', label: today <= expires ? 'Còn bảo hành' : 'Hết bảo hành', package: packageName, startDate: iso_(start), expiryDate: iso_(expires), model:model, modelStatus:modelStatus };
}
function lookupWarranty(idToken, serialNumber) {
  return lookupWarrantyBatch(idToken,[serialNumber]).items[0].result;
}
function lookupWarrantyBatch(idToken, serialNumbers) {
  authenticate_(idToken);
  if(!Array.isArray(serialNumbers)||!serialNumbers.length||serialNumbers.length>20)throw publicError_('Mỗi lần tra tối đa 20 S/N.');
  const serials=serialNumbers.map(function(value){const sn=clean_(value).toUpperCase();if(sn.length>100)throw publicError_('Số sê-ri quá dài.');return sn;});
  const cache=CacheService.getScriptCache(),day=iso_(new Date()),results={},missing=[];
  serials.forEach(function(sn){if(Object.prototype.hasOwnProperty.call(results,sn))return;const key='warranty-v2:'+day+':'+digest_(sn);let hit;try{hit=cache.get(key);if(hit)hit=JSON.parse(hit);}catch(_){}if(hit)results[sn]=hit;else if(!sn)results[sn]={status:'no_information',label:'Không có thông tin',model:'',modelStatus:'not_found'};else if(missing.indexOf(sn)<0)missing.push(sn);});
  if(missing.length){
    const source=warrantyLookupSource_(),sheet=source.sheet;
    const expression='^(?:'+missing.map(function(sn){return sn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|')+')$';
    const matches=sheet.getRange(2,source.serialColumn,Math.max(1,sheet.getLastRow()-1),1).createTextFinder(expression).useRegularExpression(true).matchEntireCell(true).matchCase(false).findAll();
    const rows={};matches.forEach(function(cell){const row=cell.getRow();if(!rows[row])rows[row]=sheet.getRange(row,1,1,source.headers.length).getValues()[0];});
    Object.keys(rows).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(row){const values=rows[row],sn=clean_(values[source.serialColumn-1]).toUpperCase();if(missing.indexOf(sn)>=0&&!Object.prototype.hasOwnProperty.call(results,sn))results[sn]=warrantyLookupResult_(values,source);});
    missing.forEach(function(sn){if(!results[sn])results[sn]={status:'no_information',label:'Không có thông tin',model:'',modelStatus:'not_found'};try{cache.put('warranty-v2:'+day+':'+digest_(sn),JSON.stringify(results[sn]),300);}catch(_){} });
  }
  return {items:serials.map(function(sn){return {serialNumber:sn,result:results[sn]};})};
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
  return { found: true, fanPending:typeof flIsLot_==='function'&&flIsLot_(record)&&!!PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+record['Mã hồ sơ']), caseId: record['Mã hồ sơ'], workOrderId: work['Mã công việc'], cancelled: clean_(record['Trạng thái hồ sơ']) === 'Đã hủy' };
}

function createCase(idToken, payload) {
  const actor = authenticate_(idToken);
  assertCapability_(actor, 'createCase');
  payload = payload || {};
  const center = required_(payload.intakeCenter, 'Trung tâm tiếp nhận');
  assertCenterAllowed_(actor, center);
  const receivedAt = parseDateRequired_(payload.receivedAt, 'Ngày nhận từ khách');
  const deviceType = required_(payload.deviceType, 'Loại thiết bị');
  assertDeviceType_(deviceType);
  let model = required_(payload.model, 'Model');
  const serial = clean_(payload.serialNumber);
  if (deviceType !== 'Fan' && !serial) throw publicError_('Số sê-ri (S/N) là bắt buộc, trừ thiết bị Fan.');
  const customerName = required_(payload.customerName, 'Tên khách hàng');
  const customerAddress = required_(payload.customerAddress, 'Địa chỉ khách hàng');
  const customerPhone = required_(payload.customerPhone, 'Số điện thoại khách hàng');
  const customerEmail = emailOptional_(payload.customerEmail, 'Email khách hàng');
  const project = clean_(payload.project);
  const initialIssue = required_(payload.initialIssue, 'Hiện tượng ban đầu');
  const fanState = typeof flPrepareCreate_ === 'function' ? flPrepareCreate_(payload) : null;
  if(payload.fanMode==='lot'&&!fanState)throw publicError_('Cần cập nhật backend Fan theo lô.');
  if(fanState&&fanState.lines.some(function(l){return !!l.fanModel;}))model=SungrowFanLotRules.modelLabel(fanState);
  const quantity = fanState ? SungrowFanLotRules.totals(fanState).received : Math.max(1, Number(payload.quantity || 1));
  if (!Number.isFinite(quantity)) throw publicError_('Số lượng không hợp lệ.');
  const requestId = clean_(payload.requestId);
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) throw publicError_('Vui lòng tải lại giao diện để tạo mã yêu cầu hợp lệ.');

  // Reserve this request before uploading. Drive I/O must not hold the shared
  // database lock; uncertain uploads are not automatically repeated.
  const receiptKey = 'CREATE_UPLOAD_' + requestId;
  const receipts = PropertiesService.getScriptProperties();
  let evidenceLink;
  if (payload.uploadSessionId) {
    const existing = getCreationStatus(idToken, requestId);
    if (existing.found) return existing;
    if (typeof tuPrepareCase_ !== 'function') throw publicError_('Chưa cài đặt upload tạm.');
    const safe = function(v){return clean_(v).replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,80)||'Chua-co';};
    evidenceLink = tuPrepareCase_(actor,payload,[iso_(receivedAt),safe(serial||'Fan-khong-SN'),safe(model),safe(customerName)].join('-'));
  } else {
  const reservation = LockService.getScriptLock();
  reservation.waitLock(20000);
  try {
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    if (typeof cmsAssertPortalWrites_ === 'function') cmsAssertPortalWrites_();
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
  }

  if(fanState)flAttachInitialFiles_(actor,payload,fanState);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (requestId) {
      const existing = getCreationStatus(idToken, requestId);
      if (existing.found) return existing;
    }
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    if (typeof cmsAssertPortalWrites_ === 'function') cmsAssertPortalWrites_();
    if(fanState)ensureSheetColumns_(SHEETS.cases,['Kiểu hồ sơ','Chi tiết lô Fan']);
    ensureSheetColumns_(SHEETS.cases, ['GSP', 'MA']);
    ensureSheetColumns_(SHEETS.cases, ['Mã yêu cầu tạo']);
    var customerId = '';
    if (payload.customerId || (payload.saveCustomer && bool_(payload.saveCustomer))) {
      if (typeof cdPrepareCase_ !== 'function') throw publicError_('Chưa cài đặt danh bạ khách hàng trên backend.');
      var customerActor = authenticate_(idToken); assertCapability_(customerActor,'createCase'); assertCenterAllowed_(customerActor,center);
      customerId = cdPrepareCase_(customerActor,payload,center);
    }
    if (typeof cdPrepareCase_ === 'function') ensureSheetColumns_(SHEETS.cases,['Mã khách hàng']);
    const caseId = makeId_('HS');
    const workOrderId = makeId_('CV');
    const now = new Date();
    const caseData = {
      'Mã hồ sơ': caseId,
      'Mã yêu cầu tạo': requestId,
      'Mã khách hàng': customerId,
      'Kiểu hồ sơ': fanState ? 'Fan theo lô' : '',
      'Chi tiết lô Fan': fanState ? SungrowFanLotRules.pack(fanState) : '',
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
    };
    const workData = {
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
    };
    const issueData = initialIssue ? {
        'Mã ghi nhận lỗi': makeId_('LOI'),
        'Mã công việc': workOrderId,
        'Loại ghi nhận': 'Hiện tượng ban đầu',
        'Tên lỗi': initialIssue,
        'Ngày xác nhận lỗi': receivedAt,
        'Ghi chú lỗi': ''
      } : null;
    if(fanState){
      receipts.setProperty('FAN_PENDING_'+caseId,requestId);
      const writes=[flAppendRequest_(SHEETS.cases,caseData),flAppendRequest_(SHEETS.workOrders,workData)];
      if(issueData)writes.push(flAppendRequest_(SHEETS.issues,issueData));
      try{flBatch_(writes);}catch(error){if(error.fanNoWrite)receipts.deleteProperty('FAN_PENDING_'+caseId);throw error;}
    }else{
      appendObject_(SHEETS.cases,caseData);appendObject_(SHEETS.workOrders,workData);
      if(issueData)appendObject_(SHEETS.issues,issueData);
    }
    SpreadsheetApp.flush();
    if (payload.uploadSessionId && typeof tuCommitCase_ === 'function') {
      try { tuCommitCase_(actor,payload,caseId); } catch(error) { console.error('TEMP_UPLOAD_COMMIT '+caseId+': '+String(error)); }
    }
    receipts.deleteProperty(receiptKey);
    bumpPortalDatabaseRevision_();
    try { audit_(actor, 'Tạo hồ sơ', 'Hồ sơ', caseId, center, null, { workOrderId: workOrderId }); }
    catch (error) { console.error('Hồ sơ đã tạo, lỗi ghi nhật ký: ' + String(error)); }
    if(fanState)flFinishSync_(caseId);
    else{syncCaseDerived_(caseId);bumpPortalDatabaseRevision_();}
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

function canDeleteAnyCase_(actor){return !!actor&&actor.canDeleteAnyCase===true;}
function canDeleteCaseRecord_(actor,record,hasTransfer){
  if(clean_(record['Trạng thái hồ sơ'])==='Đã hủy')return false;
  if(canDeleteAnyCase_(actor))return true;
  return clean_(record['Trạng thái hồ sơ'])!=='Đã hoàn tất'&&clean_(record['Tình trạng bảo hành'])==='Chờ xác nhận'&&!hasTransfer&&clean_(record['Trung tâm đang giữ hàng'])===clean_(record['Trung tâm tiếp nhận khách'])&&(actor.isGlobalManager||(actor.centers||[]).indexOf(clean_(record['Trung tâm tiếp nhận khách']))!==-1);
}
function cancelCaseUnlocked_(idToken, payload) {
  const actor = authenticate_(idToken);
  const unrestrictedDelete=canDeleteAnyCase_(actor);
  assertCapability_(actor, 'createCase');
  payload = payload || {};
  const caseId = required_(payload.caseId, 'Mã hồ sơ');
  const reason = required_(payload.reason, 'Lý do xóa hồ sơ');
  if (reason.length > 500) throw publicError_('Lý do xóa hồ sơ không được vượt quá 500 ký tự.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw publicError_('Dữ liệu đang được cập nhật. Vui lòng chờ vài giây rồi xóa lại hồ sơ.');
  try {
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    if (typeof cmsAssertPortalWrites_ === 'function') cmsAssertPortalWrites_();
    ensureSheetColumns_(SHEETS.cases, ['Người hủy', 'Ngày hủy', 'Lý do hủy']);
    const table = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [caseId]);
    const record = table.rows.find(function (item) { return clean_(item['Mã hồ sơ']) === caseId; });
    if (!record) throw publicError_('Không tìm thấy hồ sơ cần xóa.');
    if (!unrestrictedDelete && !actor.isGlobalManager && actor.centers.indexOf(clean_(record['Trung tâm tiếp nhận khách'])) === -1) {
      throw publicError_('Chỉ nhân viên của center tiếp nhận mới được xóa hồ sơ này.');
    }
    if (clean_(record['Trạng thái hồ sơ']) === 'Đã hủy') {
      removeDashboardProjectionCase_(caseId, record);
      syncPortalCaseIndexCase_(caseId);
      SpreadsheetApp.flush();
      bumpPortalDatabaseRevision_();
      return { caseId: caseId, cancelled: true };
    }
    if(typeof flIsLot_==='function'&&flIsLot_(record)&&PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+caseId))throw publicError_('Lô Fan đang chờ đối soát giao dịch. Hoàn tất đối soát trước khi xóa.');
    const intakeCenter = clean_(record['Trung tâm tiếp nhận khách']);
    if(!unrestrictedDelete){
    if(clean_(record['Trạng thái hồ sơ'])==='Đã hoàn tất')throw publicError_('Chỉ quản lý hệ thống được xóa hồ sơ đã hoàn tất.');
    if(typeof flIsLot_==='function'&&flIsLot_(record)&&findTableRowsByField_(FL_EVENT_SHEET_,'Mã hồ sơ',[caseId]).length)throw publicError_('Lô đã có nghiệp vụ; không hủy bằng thao tác tiếp nhận.');
    if (clean_(record['Tình trạng bảo hành']) !== 'Chờ xác nhận') {
      throw publicError_('Không thể xóa hồ sơ sau khi đã xác nhận tình trạng bảo hành.');
    }
    const currentCenter = clean_(record['Trung tâm đang giữ hàng']);
    if (!actor.isGlobalManager && actor.centers.indexOf(intakeCenter) === -1) {
      throw publicError_('Chỉ nhân viên của center tiếp nhận mới được xóa hồ sơ này.');
    }
    if (currentCenter !== intakeCenter) throw publicError_('Không thể xóa hồ sơ đã rời center tiếp nhận.');
    const hasTransfer = readTable_(SHEETS.transfers).some(function (item) { return clean_(item['Mã hồ sơ']) === caseId; });
    if (hasTransfer) throw publicError_('Không thể xóa hồ sơ đã phát sinh luân chuyển center.');
    }
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
    try { audit_(actor, unrestrictedDelete?'Quản lý hệ thống xóa hồ sơ':'Xóa hồ sơ trước xác nhận bảo hành', 'Hồ sơ', caseId, intakeCenter, record, changes); }
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
  const table = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [caseId]);
  const record = table.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!record) throw publicError_('Không tìm thấy hồ sơ.');
  if(typeof flIsLot_==='function'&&flIsLot_(record)&&typeof fwConfirmWarranty_==='function'&&payload.fanSelections)return fwConfirmWarranty_(actor,record,payload);
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
  if(typeof flWarrantyChanges_==='function')Object.assign(changes,flWarrantyChanges_(record,warrantyStatus,payload.fanFingerprint));
  allowHistoricalWarrantyStatus_(table.headers, record.__rowNumber, warrantyStatus);
  if(typeof flIsLot_==='function'&&flIsLot_(record)){PropertiesService.getScriptProperties().setProperty('FAN_PENDING_'+caseId,'warranty');try{flBatch_(flUpdateRequest_(SHEETS.cases,record.__rowNumber,changes));}catch(error){if(error.fanNoWrite)PropertiesService.getScriptProperties().deleteProperty('FAN_PENDING_'+caseId);throw error;}}else updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
  audit_(actor, 'Xác nhận bảo hành', 'Hồ sơ', caseId, record['Trung tâm đang giữ hàng'], record, changes);
  if(typeof flIsLot_==='function'&&flIsLot_(record))flFinishSync_(caseId);else{syncCaseDerived_(caseId);bumpPortalDatabaseRevision_();}
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

  var previousTiming = PORTAL_WRITE_TIMING_;
  var previousHeaders = PORTAL_WRITE_HEADERS_;
  var timing = { event: 'portal-save-timing', version: APP_VERSION, operation: operationName, projectionMs: 0, indexMs: 0, ok: false };
  var startedAt = Date.now();
  PORTAL_WRITE_TIMING_ = timing;
  PORTAL_WRITE_HEADERS_ = Object.create(null);
  try {
    if (typeof xbmAssertPortalWrites_ === 'function') xbmAssertPortalWrites_();
    if (typeof cmsAssertPortalWrites_ === 'function') cmsAssertPortalWrites_();
    var result = callback();
    timing.ok = true;
    return result;
  } finally {
    timing.serverMs = Date.now() - startedAt;
    PORTAL_WRITE_TIMING_ = previousTiming;
    PORTAL_WRITE_HEADERS_ = previousHeaders;
    lock.releaseLock();
    // Only timings and operation labels; no identifiers, payloads or tokens.
    try { console.log(JSON.stringify(timing)); } catch (_) {}
  }
}

/** Administrative correction updates the existing case; never creates a case or transfer. */
function systemCaseManager_(actor){return !!actor&&(actor.roleCode===ROLE_CODES.serviceManager||(actor.roleCode===ROLE_CODES.centerManager&&actor.homeCenter===SUNGROW_CENTER));}
function correctCase(idToken, payload) {
  return withSerializedWrite_('sửa thông tin hồ sơ', function () {
    const actor = authenticate_(idToken);
    if (!systemCaseManager_(actor)) throw publicError_('Chỉ quản lý hệ thống hoặc quản lý Sungrow Center được sửa thông tin gốc.');
    payload = payload || {};
    const caseId = required_(payload.caseId, 'Mã hồ sơ');
    const reason = required_(payload.reason, 'Lý do sửa');
    if (reason.length > 500) throw publicError_('Lý do sửa tối đa 500 ký tự.');
    if (!payload.expectedRevision || String(payload.expectedRevision) !== getPortalDatabaseRevision_()) throw publicError_('Dữ liệu đã thay đổi. Tải lại hồ sơ trước khi sửa.');
    const table = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [caseId]);
    const matches = table.rows.filter(function (c) { return clean_(c['Mã hồ sơ']) === caseId; });
    if (matches.length !== 1) throw publicError_('Không tìm thấy đúng một hồ sơ để sửa.');
    const record = matches[0];
    const isLot=typeof flIsLot_==='function'&&flIsLot_(record);
    if(isLot&&PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+caseId))throw publicError_('Đối soát giao dịch đang chờ trước khi sửa hồ sơ.');
    const fields = {deviceType:'Loại thiết bị',serialNumber:'Số sê-ri (S/N)',model:'Model',quantity:'Số lượng',receivedAt:'Ngày nhận từ khách',readyAt:'Ngày sẵn sàng trả khách',returnedAt:'Ngày trả khách',sender:'Đơn vị gửi hàng',customerName:'Tên khách hàng',customerAddress:'Địa chỉ khách hàng',customerPhone:'Số điện thoại khách hàng',customerEmail:'Email khách hàng',note:'Ghi chú chung',evidenceLink:'Liên kết hồ sơ Drive',gsp:'GSP',ma:'MA',project:'Dự án/Địa điểm',senderCompany:'Tên công ty gửi hàng',senderCustomer:'Tên người gửi hàng',senderAddress:'Địa chỉ gửi hàng',senderPhone:'Số điện thoại gửi hàng',senderEmail:'Email gửi hàng',carrier:'Đơn vị vận chuyển',trackingCode:'Mã vận đơn'};
    const input = payload.changes || {}, changes = {}, dates = ['receivedAt','readyAt','returnedAt'];
    let adminFanPlan=null;
    if(Object.prototype.hasOwnProperty.call(input,'fanLines')){if(!isLot||typeof flAdminPrepareCorrection_!=='function')throw publicError_('Cần cập nhật bộ sửa hồ sơ quản lý hệ thống.');adminFanPlan=flAdminPrepareCorrection_(actor,record,input.fanLines,reason,payload);Object.assign(changes,adminFanPlan.changes);}
    if(isLot&&!adminFanPlan&&['serialNumber','quantity'].some(function(k){return Object.prototype.hasOwnProperty.call(input,k);}))throw publicError_('Sửa S/N và số lượng của lô trong bảng từng inverter.');
    if(isLot&&input.deviceType&&input.deviceType!=='Fan')throw publicError_('Lô Fan phải giữ loại Fan để bảo toàn các dòng công việc.');
    if(adminFanPlan&&Object.prototype.hasOwnProperty.call(input,'fanModels'))throw publicError_('Chỉ gửi một bảng dòng Fan.');
    if(Object.prototype.hasOwnProperty.call(input,'fanModels'))Object.assign(changes,flCorrectModels_(record,input.fanModels));
    if(typeof flIsLot_==='function'&&flIsLot_(record)&&flState_(record).lines.some(function(l){return l.fanModel;})&&Object.prototype.hasOwnProperty.call(input,'model'))throw publicError_('Model Fan của lô phải sửa theo từng S/N inverter.');
    Object.keys(input).forEach(function (key) {
      if(key==='fanModels'||key==='fanLines')return;
      if(isLot&&['serialNumber','quantity','model'].indexOf(key)>=0&&adminFanPlan)return;
      if (!fields[key]) throw publicError_('Trường không được phép sửa: ' + key);
      if (table.headers.indexOf(fields[key]) === -1) { if(!clean_(input[key]))return;throw publicError_('Thiếu cột đích: ' + fields[key]); }
      let value = clean_(input[key]);
      if (value.length > (key === 'note' ? 20000 : 2000)) throw publicError_('Thông tin quá dài: ' + key);
      if (dates.indexOf(key) !== -1) { const raw=value; value = value ? parseDateRequired_(value, key) : ''; if(raw && (!/^\d{4}-\d{2}-\d{2}$/.test(raw)||iso_(value)!==raw)) throw publicError_('Ngày không hợp lệ: '+key); }
      else if (key === 'quantity') { value = Number(value); if (!Number.isInteger(value) || value < 1) throw publicError_('Số lượng phải là số nguyên từ 1.'); }
      else if (['customerEmail','senderEmail'].indexOf(key)>=0 && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw publicError_('Email không hợp lệ.');
      else if (key === 'evidenceLink' && value && !safeDriveLink_(value)) throw publicError_('Link hồ sơ phải là Google Drive hợp lệ.');
      else if (key === 'deviceType') assertDeviceType_(value, clean_(record['Loại thiết bị'])); else if (key === 'model' && !value) throw publicError_('S/N và Model không được để trống khi sửa.');
      if (typeof value === 'string' && /^[=+@]/.test(value)) throw publicError_('Không nhập công thức vào thông tin hồ sơ.');
      changes[fields[key]] = value;
      if(key==='sender' && table.headers.indexOf('Nơi gửi hàng')>=0)changes['Nơi gửi hàng']=value;
    });
    if (!Object.keys(changes).length) throw publicError_('Chưa chọn thông tin cần sửa.');
    if(!isLot&&Object.prototype.hasOwnProperty.call(input,'returnedAt')){const proposed=Object.assign({},record,changes);changes['Trạng thái hồ sơ']=proposed['Ngày trả khách']?'Đã hoàn tất':proposed['Ngày sẵn sàng trả khách']?'Sẵn sàng trả khách':'Đang xử lý';}
    if(adminFanPlan){
      const totals=SungrowFanLotRules.totals(SungrowFanLotRules.parse(changes['Chi tiết lô Fan']));
      const effective=payload.correctionDate||Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd');
      if(totals.returned===totals.received){if(!(Object.prototype.hasOwnProperty.call(changes,'Ngày trả khách')?changes['Ngày trả khách']:record['Ngày trả khách']))changes['Ngày trả khách']=parseDateRequired_(effective,'Ngày trả khách');}
      else changes['Ngày trả khách']='';
      if(totals.waiting>0){if(!(Object.prototype.hasOwnProperty.call(changes,'Ngày sẵn sàng trả khách')?changes['Ngày sẵn sàng trả khách']:record['Ngày sẵn sàng trả khách']))changes['Ngày sẵn sàng trả khách']=parseDateRequired_(effective,'Ngày sẵn sàng trả');}
      else if(totals.returned!==totals.received)changes['Ngày sẵn sàng trả khách']='';
    }
    const next = Object.assign({}, record, changes), received = asDate_(next['Ngày nhận từ khách']), ready = asDate_(next['Ngày sẵn sàng trả khách']), returned = asDate_(next['Ngày trả khách']);
    if ((Object.prototype.hasOwnProperty.call(input,'deviceType')||Object.prototype.hasOwnProperty.call(input,'serialNumber')) && clean_(next['Loại thiết bị'])!=='Fan' && !clean_(next['Số sê-ri (S/N)'])) throw publicError_('S/N bắt buộc, trừ thiết bị Fan.'); if (clean_(next['Nguồn dữ liệu']) === 'Quy trình mới' && !received) throw publicError_('Hồ sơ quy trình mới phải có ngày nhận.');
    if (received && ((ready && ready < received) || (returned && returned < received))) throw publicError_('Ngày sẵn sàng/trả không được trước ngày nhận.');
    if (ready && returned && returned < ready) throw publicError_('Ngày trả không được trước ngày sẵn sàng trả.');
    changes['Người cập nhật gần nhất'] = actor.email;
    changes['Ngày cập nhật gần nhất'] = new Date();
    if(adminFanPlan)flAdminCommitCorrection_(actor,record,changes,adminFanPlan,reason,payload);
    else updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes);
    audit_(actor, 'Sửa thông tin hồ sơ', 'Hồ sơ', caseId, record['Trung tâm tiếp nhận khách'], record, {reason:reason,changes:changes});
    if(adminFanPlan){flFinishSync_(caseId);return {ok:true,caseId:caseId,revision:getPortalDatabaseRevision_()};}
    const synced = syncCaseDerived_(caseId), projection = synced.projection, index = synced.index;
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
  const table = readScopedTable_(SHEETS.workOrders, 'Mã công việc', [workOrderId]);
  const record = table.rows.find(function (row) { return row['Mã công việc'] === workOrderId; });
  if (!record) throw publicError_('Không tìm thấy công việc.');
  assertCenterAllowed_(actor, record['Trung tâm xử lý']);

  const caseTable = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [record['Mã hồ sơ']]);
  const caseRecord = caseTable.rows.find(function (row) { return row['Mã hồ sơ'] === record['Mã hồ sơ']; });
  if (!caseRecord) throw publicError_('Không tìm thấy hồ sơ của công việc.');
  if(typeof flIsLot_==='function'&&flIsLot_(caseRecord)&&typeof fwUpdateWorkOrder_==='function')return fwUpdateWorkOrder_(actor,caseRecord,record,payload);
  if (!actor.isGlobalManager && ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(record['Trạng thái xử lý']) !== -1) {
    throw publicError_('Công việc đã kết thúc tại center này và không thể cập nhật thêm.');
  }
  assertCaseEditable_(actor, caseRecord);
  if(typeof flAssertOrdinary_==='function')flAssertOrdinary_(caseRecord);
  const ruleErrors=SungrowWorkOrderRules.validate(payload,{currentStatus:clean_(record['Trạng thái xử lý']),previousReplacementType:clean_(record['Loại thiết bị đổi']),receivedAt:iso_(record['Ngày trung tâm nhận hàng']),warrantyPending:clean_(caseRecord['Tình trạng bảo hành'])==='Chờ xác nhận',caseClosed:clean_(caseRecord['Trạng thái hồ sơ'])==='Đã hoàn tất',today:Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd')});
  if(ruleErrors.length)throw publicError_(ruleErrors.join('\n'));
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
  if (['GSP', 'MA'].some(function (name) { return caseTable.headers.indexOf(name) < 0; })) {
    ensureSheetColumns_(SHEETS.cases, ['GSP', 'MA']);
    caseTable.headers = tableHeaders_(SHEETS.cases);
  }
  if(changes['Loại thiết bị đổi']==='Fan'&&typeof allowListValidationValue_==='function')allowListValidationValue_(SHEETS.workOrders,table.headers,record.__rowNumber,'Loại thiết bị đổi','Fan','Quy tắc loại thiết bị đổi cần quản lý đối soát.');
  updateObjectRow_(SHEETS.workOrders, table.headers, record.__rowNumber, changedRowValues_(record, changes));
  updateCaseAfterWork_(record['Mã hồ sơ'], actor, changes, caseTable, { 'GSP': gsp, 'MA': ma });
  replaceWorkOrderChildren_(actor, workOrderId, payload.issues || [], payload.parts || []);
  if (changes['Ngày hoàn tất kỹ thuật'] && (payload.parts || []).some(function (part) {
    return (clean_(part.partNumber) || clean_(part.name)) && !parseDateOptional_(part.usedAt);
  })) fillMissingPartUsageDates_(workOrderId, changes['Ngày hoàn tất kỹ thuật']);
  appendWorkOrderHolds_(actor, workOrderId, payload.holds || []);
  audit_(actor, 'Cập nhật xử lý', 'Công việc', workOrderId, record['Trung tâm xử lý'], record, changes);
  syncCaseDerived_(record['Mã hồ sơ']);
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

  const caseTable = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [caseId]);
  const caseRecord = caseTable.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!caseRecord) throw publicError_('Không tìm thấy hồ sơ.');
  assertCaseEditable_(actor, caseRecord);
  if(typeof flIsLot_==='function'&&flIsLot_(caseRecord)){
    if(PropertiesService.getScriptProperties().getProperty('FAN_PENDING_'+caseId))throw publicError_('Lô cần đối soát đồng bộ trước khi luân chuyển.');
    const state=flState_(caseRecord),totals=SungrowFanLotRules.totals(state);
    if(totals.remaining===0)throw publicError_('Lô đã giao hết.');
  }
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
  syncCaseDerived_(caseId);
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
  const transferTable = readScopedTable_(SHEETS.transfers, 'Mã luân chuyển', [transferId]);
  const transfer = transferTable.rows.find(function (row) { return row['Mã luân chuyển'] === transferId; });
  if (!transfer) throw publicError_('Không tìm thấy lần luân chuyển.');
  assertCenterAllowed_(actor, transfer['Trung tâm nhận']);
  if (transfer['Trạng thái luân chuyển'] === 'Đã nhận') throw publicError_('Luân chuyển này đã được xác nhận nhận.');
  const sentAt = asDate_(transfer['Ngày gửi']);
  if (sentAt && receivedAt < sentAt) throw publicError_('Ngày nhận không được trước ngày gửi.');

  const workTable = readScopedTable_(SHEETS.workOrders, 'Mã công việc', [transfer['Mã công việc nhận']]);
  const work = workTable.rows.find(function (row) { return row['Mã công việc'] === transfer['Mã công việc nhận']; });
  const caseTable = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [transfer['Mã hồ sơ']]);
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
  syncCaseDerived_(transfer['Mã hồ sơ']);
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
  const table = readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [caseId]);
  const record = table.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!record) throw publicError_('Không tìm thấy hồ sơ.');
  if(typeof flIsLot_==='function'&&flIsLot_(record)&&typeof fwReturn_==='function')return fwReturn_(actor,record,payload);
  assertCaseEditable_(actor, record);
  if(typeof flAssertOrdinary_==='function')flAssertOrdinary_(record);
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
  syncCaseDerived_(caseId);
  bumpPortalDatabaseRevision_();
  return { ok: true };
}

function authenticate_(idToken) {
  if (typeof idToken === 'string' && idToken.indexOf('sgs1.') === 0) {
    if (typeof authenticatePortalSession_ !== 'function') throw publicError_('Phiên đăng nhập không được hỗ trợ.');
    return authenticatePortalSession_(idToken);
  }
  const tokenDigest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idToken || ''))
  ).replace(/=+$/g, '');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'portal-actor-v1-' + tokenDigest + '-' + APP_VERSION;
  const cached = cache.get(cacheKey);
  const claims = parseJson_(cache.get('entry-token:' + digest_(String(idToken || ''))));
  if (cached && claims && Number(claims.exp || 0) * 1000 > Date.now()) {
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
  }
  if (claims.aud !== GOOGLE_WEB_CLIENT_ID) throw publicError_('Token không thuộc ứng dụng này.');
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(claims.iss) === -1) throw publicError_('Nguồn đăng nhập không hợp lệ.');
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp || 0) * 1000 <= Date.now()) throw publicError_('Phiên đăng nhập đã hết hạn.');
  if (!(claims.email_verified === true || claims.email_verified === 'true')) throw publicError_('Email Google chưa được xác minh.');
  cache.put(key, JSON.stringify(claims), Math.max(1, Math.min(300, Math.floor(Number(claims.exp) - Date.now() / 1000))));
  return portalActorFromIdentity_(claims, true);
}

function portalActorFromIdentity_(claims, allowBinding) {
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
      if (!allowBinding) throw publicError_('Định danh tài khoản đã thay đổi. Vui lòng đăng nhập lại.');
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
    canDeleteAnyCase: roleDefinition.canDeleteAnyCase===true,
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
  const fanFields=typeof flIndexFields_==='function'?flIndexFields_(caseRecord):{};
  return Object.assign({
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
    'Tìm kiếm': searchable+' '+(fanFields['S/N inverter liên quan']||'')+' '+(fanFields['Tìm kiếm nguồn Fan']||''),
    'Ngày cập nhật chỉ mục': new Date()
  },fanFields);
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

function syncCaseDerived_(caseId) {
  let source;
  try {
    SpreadsheetApp.flush();
    source = {
      record: findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0],
      works: findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]),
      transfers: findTableRowsByField_(SHEETS.transfers, 'Mã hồ sơ', [caseId])
    };
  } catch (error) {
    // Keep the independent synchronizers' existing error handling on read failure.
    return { projection: syncDashboardProjectionCase_(caseId), index: syncPortalCaseIndexCase_(caseId) };
  }
  return { projection: syncDashboardProjectionCase_(caseId, source), index: syncPortalCaseIndexCase_(caseId, source) };
}

function syncPortalCaseIndexCase_(caseId, source) {
  const timingStarted = Date.now();
  caseId = clean_(caseId);
  if (!caseId) return { ok: false, reason: 'missing_case_id' };
  try {
    const record = source ? source.record : findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0] || null;
    if (!record) return { ok: false, reason: 'missing_case' };
    const works = source ? source.works : findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);
    const transfers = source ? source.transfers : findTableRowsByField_(SHEETS.transfers, 'Mã hồ sơ', [caseId]);
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
  } finally {
    if (PORTAL_WRITE_TIMING_) PORTAL_WRITE_TIMING_.indexMs += Date.now() - timingStarted;
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
  const canDelete = canDeleteCaseRecord_(actor,item,bool_(item['Có luân chuyển']));
  const latestWork = clean_(item['Mã công việc gần nhất']) && (isManager || actor.centers.indexOf(clean_(item['Trung tâm xử lý gần nhất'])) !== -1) ? [{
    workOrderId: clean_(item['Mã công việc gần nhất']),
    center: clean_(item['Trung tâm xử lý gần nhất']),
    receivedAt: iso_(item['Ngày nhận công việc gần nhất']),
    workflowStatus: clean_(item['Trạng thái xử lý gần nhất']),
    technicalCompletedAt: iso_(item['Ngày hoàn tất kỹ thuật gần nhất']),
    outcome: clean_(item['Kết quả gần nhất']), issues: [], parts: [], holds: []
  }] : [];
  return {
    fanLotSummary: clean_(item['Kiểu hồ sơ'])==='Fan theo lô' ? parseJson_(item['Tiến độ Fan']) : null,
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

function readScopedTable_(sheetName, field, wantedValues) {
  return readTableWithRows_(sheetName, { field: field, values: wantedValues });
}

function findTableRowsByField_(sheetName, field, wantedValues, suppliedHeaders) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2 || !wantedValues.length) return [];
  const headers = suppliedHeaders || tableHeaders_(sheetName);
  const column = headers.indexOf(field) + 1;
  if (!column) return [];
  const wanted = wantedValues.reduce(function (map, value) { map[clean_(value)] = true; return map; }, Object.create(null));
  const keyRange = sheet.getRange(2, column, sheet.getLastRow() - 1, 1);
  const terms = Object.keys(wanted);
  const pattern = '^\\s*(?:' + terms.map(function (term) { return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\s*$';
  let rowNumbers;
  if (terms.length <= 20 && !wanted[''] && pattern.length <= 4000) {
    // Search the key column inside Sheets instead of transferring every key.
    rowNumbers = keyRange.createTextFinder(pattern).useRegularExpression(true).matchCase(true).matchEntireCell(true).matchFormulaText(false).findAll().map(function (range) { return range.getRow(); }).sort(function (a,b) { return a-b; });
  } else {
    rowNumbers = [];
    keyRange.getDisplayValues().forEach(function (row, index) { if (wanted[clean_(row[0])]) rowNumbers.push(index + 2); });
  }
  if (!rowNumbers.length) return [];
  // Keep source order and row identity, but read adjacent matches together.
  // Do not include gaps: they may contain another case's private data.
  const objects = [];
  for (let cursor = 0; cursor < rowNumbers.length;) {
    const first = rowNumbers[cursor++];
    let last = first;
    while (cursor < rowNumbers.length && rowNumbers[cursor] === last + 1) last = rowNumbers[cursor++];
    sheet.getRange(first, 1, last - first + 1, headers.length).getValues().forEach(function (values, offset) {
      const object = { __rowNumber: first + offset };
      headers.forEach(function (header, index) { object[header] = values[index]; });
      objects.push(object);
    });
  }
  return objects;
}

function columnLetter_(column) {
  let result = '';
  while (column > 0) { column--; result = String.fromCharCode(65 + (column % 26)) + result; column = Math.floor(column / 26); }
  return result;
}

function getCaseDetailForActor_(actor, caseId, options) {
  options=options||{};
  if(typeof readFastCaseBundle_==='function'){
    const started=Date.now();let read;
    try{read=readFastCaseBundle_(caseId,getPortalDatabaseRevision_(),0,options.refresh);}
    catch(error){console.warn('Batched case reader fallback: '+(/^FAST_[A-Z_0-9]+$/.test(error.message||'')?error.message:'FAST_READ_FAILED'));}
    if(read){
      const b=read.bundle,record=b.record;
      if(!record||(clean_(record['Trạng thái hồ sơ'])==='Đã hủy'&&!systemCaseManager_(actor)))throw publicError_('Không tìm thấy hồ sơ hoặc hồ sơ đã bị hủy.');
      if(clean_(record['Kiểu hồ sơ'])==='Fan nguồn đã nhập lô'){
        const link=parseJson_(record['Chi tiết lô Fan']),visited=options.visited||[];
        if(link&&link.parentCaseId&&link.parentCaseId!==caseId){if(visited.length>=8||visited.indexOf(link.parentCaseId)>=0)throw publicError_('Liên kết hồ sơ lô không hợp lệ.');return getCaseDetailForActor_(actor,link.parentCaseId,{refresh:options.refresh,visited:visited.concat(caseId)});}
      }
      if(!canSeeCase_(actor,record,b.works))throw publicError_('Bạn không có quyền xem hồ sơ này.');
      const result=publicCase_(actor,record,b.works,b.transfers,groupBy_(b.issues,'Mã công việc'),groupBy_(b.parts,'Mã công việc'),groupBy_(b.holds,'Mã công việc'));
      if(typeof notificationRequestState_==='function'&&clean_(record['Tình trạng bảo hành'])==='Chờ xác nhận')result.warrantyRequest=fastWarrantyRequest_(b.audit,canApproveWarranty_(actor));
      result.dataRevision=read.revision;result.readTiming={serverMs:Date.now()-started,cacheHit:read.cacheHit,path:'batch'};
      return result;
    }
  }
  const revision = getPortalDatabaseRevision_();
  const indexed = readPortalCaseIndex_(revision).find(function (item) { return clean_(item['Mã hồ sơ']) === clean_(caseId); });
  if(indexed&&clean_(indexed['Kiểu hồ sơ'])==='Fan nguồn đã nhập lô'){const archived=objectFromSheetRow_(SHEETS.cases,Number(indexed['Dòng nguồn'])),link=archived&&parseJson_(archived['Chi tiết lô Fan']);if(link&&link.parentCaseId&&link.parentCaseId!==caseId)return getCaseDetailForActor_(actor,link.parentCaseId);}
  if (!indexed || (clean_(indexed['Trạng thái hồ sơ']) === 'Đã hủy'&&!systemCaseManager_(actor))) throw publicError_('Không tìm thấy hồ sơ hoặc hồ sơ đã bị hủy.');
  let record = objectFromSheetRow_(SHEETS.cases, Number(indexed['Dòng nguồn']));
  if (!record || clean_(record['Mã hồ sơ']) !== clean_(caseId)) {
    record = findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0] || null;
  }
  if (!record) throw publicError_('Không tìm thấy dữ liệu nguồn của hồ sơ.');
  if (clean_(record['Trạng thái hồ sơ']) === 'Đã hủy'&&!systemCaseManager_(actor)) throw publicError_('Hồ sơ đã bị hủy.');
  const works = findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);
  if (!canSeeCase_(actor, record, works)) throw publicError_('Bạn không có quyền xem hồ sơ này.');
  const transfers = findTableRowsByField_(SHEETS.transfers, 'Mã hồ sơ', [caseId]);
  const workIds = works.map(function (work) { return clean_(work['Mã công việc']); }).filter(Boolean);
  const issues = findTableRowsByField_(SHEETS.issues, 'Mã công việc', workIds);
  const parts = findTableRowsByField_(SHEETS.parts, 'Mã công việc', workIds);
  const holds = findTableRowsByField_(SHEETS.holds, 'Mã công việc', workIds);
  const result=publicCase_(actor, record, works, transfers, groupBy_(issues, 'Mã công việc'), groupBy_(parts, 'Mã công việc'), groupBy_(holds, 'Mã công việc'));
  if(typeof notificationRequestState_==='function'&&clean_(record['Tình trạng bảo hành'])==='Chờ xác nhận')result.warrantyRequest=notificationRequestState_(caseId,canApproveWarranty_(actor));
  return result;
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
  const canDeleteCase = canDeleteCaseRecord_(actor,item,transfers.length>0);
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
    fanLot: typeof flPublic_==='function'?flPublic_(item):null,
    fanGroups: typeof flGroupRefs_==='function'?flGroupRefs_(actor,item):[],
    caseId: item['Mã hồ sơ'], deviceType: item['Loại thiết bị'], serialNumber: item['Số sê-ri (S/N)'], model: item.Model,
    gsp: clean_(item.GSP), ma: clean_(item.MA),
    quantity: Number(item['Số lượng'] || 1), intakeCenter: item['Trung tâm tiếp nhận khách'], currentCenter: item['Trung tâm đang giữ hàng'],
    caseStatus: item['Trạng thái hồ sơ'], warrantyStatus: typeof flWarrantyLabel_==='function'?flWarrantyLabel_(item):item['Tình trạng bảo hành'],
    sender: hasPrivateAccess ? senderFromCase_(item) : '', project: hasPrivateAccess ? projectFromCase_(item) : '', evidenceLink: hasPrivateAccess ? safeDriveLink_(item['Liên kết hồ sơ Drive']) : '', note: hasPrivateAccess ? item['Ghi chú chung'] : '',
    customerName: hasPrivateAccess ? item['Tên khách hàng'] : '', customerAddress: hasPrivateAccess ? item['Địa chỉ khách hàng'] : '', customerPhone: hasPrivateAccess ? item['Số điện thoại khách hàng'] : '', customerEmail: hasPrivateAccess ? item['Email khách hàng'] : '',
    senderCompany: hasPrivateAccess ? item['Tên công ty gửi hàng'] : '', senderCustomer: hasPrivateAccess ? item['Tên người gửi hàng'] : '', senderAddress: hasPrivateAccess ? item['Địa chỉ gửi hàng'] : '', senderPhone: hasPrivateAccess ? item['Số điện thoại gửi hàng'] : '',
    senderEmail: hasPrivateAccess ? item['Email gửi hàng'] : '', carrier: hasPrivateAccess ? item['Đơn vị vận chuyển'] : '', trackingCode: hasPrivateAccess ? item['Mã vận đơn'] : '',
    createdBy: item['Người tạo'], createdAt: iso_(item['Ngày tạo']),
    warrantyConfirmedBy: item['Người xác nhận bảo hành'], warrantyConfirmedAt: iso_(item['Ngày xác nhận bảo hành']), warrantyNote: item['Ghi chú xác nhận bảo hành'],
    isClosed: isClosed, canEditCase: canEditCase, canSupplementAttachments: typeof saCanSupplement_==='function'&&saCanSupplement_(actor,item,workOrders), canConfirmWarranty: canEditCase && canApproveWarranty_(actor), receivedAt: isIntake ? iso_(item['Ngày nhận từ khách']) : null,
    canDelete: canDeleteCase,
    canRequestWarranty: typeof requestWarrantyReview==='function'&&!canApproveWarranty_(actor)&&hasCapability_(actor,'viewCases')&&(typeof flWarrantyLabel_==='function'?flWarrantyLabel_(item):clean_(item['Tình trạng bảo hành']))==='Chờ xác nhận'&&clean_(item['Trạng thái hồ sơ'])!=='Đã hủy',
    canCorrectCase: systemCaseManager_(actor), correctionRevision: systemCaseManager_(actor) ? getPortalDatabaseRevision_() : '',
    readyAt: isIntake ? iso_(item['Ngày sẵn sàng trả khách']) : null, returnedAt: isIntake ? iso_(item['Ngày trả khách']) : null,
    workOrders: ownWorks.map(function (work) { const workId = clean_(work['Mã công việc']); const value = publicWorkOrder_(work, (issuesByWork && issuesByWork[workId]) || [], (partsByWork && partsByWork[workId]) || [], (holdsByWork && holdsByWork[workId]) || []); value.canUpdate = (isManager || !isClosed) && hasCapability_(actor, 'updateWorkOrder') && (isManager || ['Đã chuyển hàng đi', 'Đã đóng công việc'].indexOf(work['Trạng thái xử lý']) === -1); return value; }), transfers: relevantTransfers,
    canTransfer: (isManager || !isClosed) && hasCapability_(actor, 'createTransfer') && (isManager || actor.centers.indexOf(item['Trung tâm đang giữ hàng']) !== -1),
    transferDestinations: transferDestinationsForSource_(item['Trung tâm đang giữ hàng']),
    canReturn: (isManager || !isClosed) && hasCapability_(actor, 'returnToCustomer') && isIntake && item['Trung tâm đang giữ hàng'] === item['Trung tâm tiếp nhận khách'] && (item['Tình trạng bảo hành'] !== 'Chờ xác nhận' || (typeof flIsLot_==='function'&&flIsLot_(item)&&SungrowFanLotRules.totals(flState_(item)).completed>0))
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
  const issueTable = readScopedTable_(SHEETS.issues, 'Mã công việc', [workOrderId]);
  const currentIssues = issueTable.rows.filter(function (row) { return row['Mã công việc'] === workOrderId && clean_(row['Loại ghi nhận']) !== 'Hiện tượng ban đầu'; });
  const currentIssueById = currentIssues.reduce(function (map, row) { map[clean_(row['Mã ghi nhận lỗi'])] = row; return map; }, {});
  const keptIssueIds = {};
  const newIssues = [];
  (issues || []).filter(function (item) { return clean_(item.name); }).forEach(function (item) {
    const issueId = clean_(item.issueId);
    const values = {
      'Mã công việc': workOrderId, 'Loại ghi nhận': clean_(item.type) || 'Lỗi xác nhận',
      'Mã lỗi': clean_(item.code), 'Tên lỗi': clean_(item.name), 'Ngày xác nhận lỗi': parseDateOptional_(item.confirmedAt) || new Date(), 'Ghi chú lỗi': clean_(item.note)
    };
    if (issueId && currentIssueById[issueId]) {
      updateObjectRow_(SHEETS.issues, issueTable.headers, currentIssueById[issueId].__rowNumber, changedRowValues_(currentIssueById[issueId], values));
      keptIssueIds[issueId] = true;
    } else {
      values['Mã ghi nhận lỗi'] = makeId_('LOI');
      newIssues.push(values);
    }
  });
  appendObjects_(SHEETS.issues, newIssues, issueTable.headers);
  deleteRowsDescending_(SHEETS.issues, currentIssues.filter(function (row) { return !keptIssueIds[clean_(row['Mã ghi nhận lỗi'])]; }).map(function (row) { return row.__rowNumber; }));

  const partTable = readScopedTable_(SHEETS.parts, 'Mã công việc', [workOrderId]);
  const currentParts = partTable.rows.filter(function (row) { return row['Mã công việc'] === workOrderId; });
  const currentPartById = currentParts.reduce(function (map, row) { map[clean_(row['Mã sử dụng linh kiện'])] = row; return map; }, {});
  const keptPartIds = {};
  const newParts = [];
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
      updateObjectRow_(SHEETS.parts, partTable.headers, currentPartById[partUsageId].__rowNumber, changedRowValues_(currentPartById[partUsageId], values));
      keptPartIds[partUsageId] = true;
    } else {
      values['Mã sử dụng linh kiện'] = makeId_('LK');
      newParts.push(values);
    }
  });
  appendObjects_(SHEETS.parts, newParts, partTable.headers);
  deleteRowsDescending_(SHEETS.parts, currentParts.filter(function (row) { return !keptPartIds[clean_(row['Mã sử dụng linh kiện'])]; }).map(function (row) { return row.__rowNumber; }));
}

function fillMissingPartUsageDates_(workOrderId, usedAt) {
  const table = readScopedTable_(SHEETS.parts, 'Mã công việc', [workOrderId]);
  table.rows.filter(function (row) { return row['Mã công việc'] === workOrderId && !row['Ngày sử dụng']; }).forEach(function (row) {
    updateObjectRow_(SHEETS.parts, table.headers, row.__rowNumber, { 'Ngày sử dụng': usedAt });
  });
}

function appendWorkOrderHolds_(actor, workOrderId, holds) {
  const table = readScopedTable_(SHEETS.holds, 'Mã công việc', [workOrderId]);
  const current = table.rows.filter(function (row) { return row['Mã công việc'] === workOrderId; });
  const currentById = current.reduce(function (map, row) { map[clean_(row['Mã tạm dừng'])] = row; return map; }, {});
  const keptIds = {};
  const newHolds = [];
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
      updateObjectRow_(SHEETS.holds, table.headers, currentById[holdId].__rowNumber, changedRowValues_(currentById[holdId], values));
      keptIds[holdId] = true;
    } else {
      values['Mã tạm dừng'] = makeId_('TD');
      newHolds.push(values);
    }
  });
  appendObjects_(SHEETS.holds, newHolds, table.headers);
  deleteRowsDescending_(SHEETS.holds, current.filter(function (row) { return !keptIds[clean_(row['Mã tạm dừng'])]; }).map(function (row) { return row.__rowNumber; }));
}

function appendObjects_(sheetName, objects, headers) {
  if (!objects.length) return;
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const start = sheet.getLastRow() + 1;
  const end = start + objects.length - 1;
  if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows());
  sheet.getRange(start, 1, objects.length, headers.length).setValues(objects.map(function (object) {
    return headers.map(function (header) { return object[header] == null ? '' : object[header]; });
  }));
}

function deleteRowsDescending_(sheetName, rowNumbers) {
  if (!rowNumbers || !rowNumbers.length) return;
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet ' + sheetName);
  const lastRow = sheet.getLastRow();
  const ordered = Array.from(new Set(rowNumbers)).filter(function (row) { return row > 1 && row <= lastRow; }).sort(function (a, b) { return b - a; });
  for (let cursor = 0; cursor < ordered.length;) {
    const last = ordered[cursor++];
    let first = last;
    while (cursor < ordered.length && ordered[cursor] === first - 1) first = ordered[cursor++];
    if (last === first) sheet.deleteRow(first);
    else sheet.deleteRows(first, last - first + 1);
  }
}
function updateCaseAfterWork_(caseId, actor, changes, suppliedTable, extraChanges) {
  const table = suppliedTable || readScopedTable_(SHEETS.cases, 'Mã hồ sơ', [caseId]);
  const record = table.rows.find(function (row) { return row['Mã hồ sơ'] === caseId; });
  if (!record) return;
  const terminal = ['Hoàn tất kỹ thuật','Đã chuyển hàng đi','Đã đóng công việc'].indexOf(changes['Trạng thái xử lý'])>=0&&!!changes['Kết quả xử lý']&&!!changes['Ngày hoàn tất kỹ thuật'];
  const closed=clean_(record['Trạng thái hồ sơ'])==='Đã hoàn tất';
  const atIntakeCenter = record['Trung tâm đang giữ hàng'] === record['Trung tâm tiếp nhận khách'];
  updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changedRowValues_(record, Object.assign({}, extraChanges || {}, {
    'Trạng thái hồ sơ': closed?'Đã hoàn tất':terminal && atIntakeCenter ? 'Sẵn sàng trả khách' : 'Đang xử lý',
    'Ngày sẵn sàng trả khách': closed?record['Ngày sẵn sàng trả khách']:terminal && atIntakeCenter ? changes['Ngày hoàn tất kỹ thuật'] : '',
    'Người cập nhật gần nhất': actor.email,
    'Ngày cập nhật gần nhất': new Date()
  })));
}

function changedRowValues_(record, values) {
  const changes = {};
  Object.keys(values).forEach(function (key) {
    const before = record[key], after = values[key];
    const same = before instanceof Date && after instanceof Date
      ? before.getTime() === after.getTime()
      : (before == null || before === '') && (after == null || after === '') || before === after;
    if (!same) changes[key] = after;
  });
  return changes;
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
  const rows = readScopedTable_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]).rows.filter(function (row) { return row['Mã hồ sơ'] === caseId && row['Trung tâm xử lý'] === center; });
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
  const canDeleteAnyCase = code === ROLE_CODES.serviceManager;
  const sungrowGlobalManager = code === ROLE_CODES.centerManager && homeCenter === SUNGROW_CENTER;
  const isGlobalManager = code === ROLE_CODES.serviceManager || sungrowGlobalManager;
  if (sungrowGlobalManager) code = ROLE_CODES.serviceManager;
  const labels = {};
  labels[ROLE_CODES.serviceManager] = 'Quản lý dịch vụ';
  labels[ROLE_CODES.centerManager] = 'Quản lý trung tâm';
  labels[ROLE_CODES.centerStaff] = 'Nhân viên trung tâm';
  return { code: code, label: labels[code], isGlobalManager: isGlobalManager, canDeleteAnyCase: canDeleteAnyCase, capabilities: ROLE_CAPABILITIES[code] };
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
  const baseKey = 'portal-table-v3-' + digest_(sheetName + '|' + version);
  const pointerKey = 'portal-table-current-v3-' + digest_(sheetName);
  const cache = CacheService.getScriptCache();
  const cached = readPortalChunkedCache_(cache, baseKey);
  if (cached) return unpackPortalTable_(cached);
  const previousVersion = clean_(cache.get(pointerKey));
  const previousKey = previousVersion && previousVersion !== version ? 'portal-table-v3-' + digest_(sheetName + '|' + previousVersion) : '';
  const stale = previousKey && allowStale !== false ? readPortalChunkedCache_(cache, previousKey) : null;

  const leaseKey = 'PORTAL_TABLE_LEASE_' + digest_(sheetName);
  const owner = Utilities.getUuid();
  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  let ownsLease = false;
  if (lock.tryLock(150)) {
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
    for (let attempt = 0; attempt < 3; attempt++) {
      Utilities.sleep(300);
      const ready = readPortalChunkedCache_(cache, baseKey);
      if (ready) return unpackPortalTable_(ready);
      // The previous lock may have belonged to a short write rather than a
      // cache builder. Periodically attempt to become the builder ourselves.
      if (attempt === 2) {
        const retryLock = LockService.getScriptLock();
        if (retryLock.tryLock(100)) {
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
    if (release.tryLock(150)) {
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
    const payload = keys.map(function (key) { return chunks[key]; }).join('');
    return JSON.parse(payload.indexOf('gz:') === 0 ? Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(payload.slice(3)), 'application/gzip', 'cache.json.gz')).getDataAsString('UTF-8') : payload);
  } catch (error) {
    console.warn('Shared table cache read skipped: ' + String(error && error.message || error));
    return null;
  }
}

function writePortalChunkedCache_(cache, baseKey, value, ttl) {
  try {
    let serialized = JSON.stringify(value);
    if (typeof Utilities.gzip === 'function' && typeof Utilities.base64Encode === 'function') {
      const compressed = 'gz:' + Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(serialized, 'application/json')).getBytes());
      if (compressed.length < serialized.length) serialized = compressed;
    }
    const chunks = serialized.match(serialized.indexOf('gz:') === 0 ? /[\s\S]{1,60000}/g : /[\s\S]{1,24000}/g) || [];
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

function readTableWithRows_(sheetName, selector) {
  if (selector) {
    const headers = tableHeaders_(sheetName);
    return { headers: headers, rows: findTableRowsByField_(sheetName, selector.field, selector.values, headers) };
  }
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
  if (sheetName === SHEETS.cases && Object.prototype.hasOwnProperty.call(object,'Loại thiết bị')) {
    const row = sheet.getLastRow() + 1;
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),1);
    setDeviceTypeCellValidation_(sheet, headers, row, object['Loại thiết bị']);
  }
  sheet.appendRow(headers.map(function (header) { return object[header] == null ? '' : object[header]; }));
}

function setDeviceTypeCellValidation_(sheet, headers, row, current) {
  const column = headers.indexOf('Loại thiết bị');
  if (column < 0) throw publicError_('Thiếu cột Loại thiết bị trong hồ sơ.');
  const types = readDeviceTypes_(false).slice();
  const existing = clean_(current);
  if (existing && types.indexOf(existing) < 0) types.push(existing);
  if (!types.length) throw publicError_('Danh mục loại thiết bị đang trống.');
  // Refresh only the target cell; retain strict validation and every other cell.
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(types,true).setAllowInvalid(false).build();
  sheet.getRange(row,column+1,1,1).setDataValidation(rule);
}

function updateObjectRow_(sheetName, headers, rowNumber, changes) {
  if (!Object.keys(changes).length) return;
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (sheetName === SHEETS.cases && Object.prototype.hasOwnProperty.call(changes,'Loại thiết bị')) setDeviceTypeCellValidation_(sheet,headers,rowNumber,changes['Loại thiết bị']);
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
  if (PORTAL_WRITE_HEADERS_ && Object.prototype.hasOwnProperty.call(PORTAL_WRITE_HEADERS_, sheetName)) return PORTAL_WRITE_HEADERS_[sheetName].slice();
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  if (PORTAL_WRITE_HEADERS_) PORTAL_WRITE_HEADERS_[sheetName] = headers.slice();
  return headers;
}

function audit_(actor, action, type, id, center, before, after) {
  if(typeof notificationMetadata_==='function'){
    const metadata=notificationMetadata_(actor,action,type,id,center,before,after);
    if(metadata)after=Object.assign({},after||{},{__notification:metadata});
  }
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
    if (PORTAL_WRITE_HEADERS_) delete PORTAL_WRITE_HEADERS_[sheetName];
    if(typeof fastReadCacheKey_==='function'){try{const cache=CacheService.getScriptCache(),key=fastReadCacheKey_('schema');cache.remove(key+':count');}catch(_){} }
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
function syncDashboardProjectionCase_(caseId, source) {
  const timingStarted = Date.now();
  try {
    caseId = clean_(caseId);
    if (!caseId) return { ok: false, reason: 'missing_case_id' };
    if (!source) SpreadsheetApp.flush();
    const spreadsheet = spreadsheet_();
    const sheet = spreadsheet.getSheetByName(SHEETS.dashboard);
    if (!sheet) return { ok: false, reason: 'missing_dashboard_sheet' };
    const caseRecord = source ? source.record : findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0];
    if (!caseRecord) return { ok: false, reason: 'missing_case' };
    if (clean_(caseRecord['Trạng thái hồ sơ']) === 'Đã hủy') return removeDashboardProjectionCase_(caseId, caseRecord);

    const works = source ? source.works : findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);
    const latest = works.length ? works[works.length - 1] : {};
    const workIds = works.map(function (item) { return clean_(item['Mã công việc']); }).filter(Boolean);
    const issues = findTableRowsByField_(SHEETS.issues, 'Mã công việc', workIds).filter(function (item) {
      return clean_(item['Loại ghi nhận']) !== 'Hiện tượng ban đầu';
    });
    const parts = findTableRowsByField_(SHEETS.parts, 'Mã công việc', workIds);
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
  } finally {
    if (PORTAL_WRITE_TIMING_) PORTAL_WRITE_TIMING_.projectionMs += Date.now() - timingStarted;
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
    const matchesLegacyProjection = (!caseIdColumn||!clean_(row[caseIdColumn-1])) && serial && received && normalizeProjectionKey_(row[2]) === serial && iso_(row[4]) === received;
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

function spreadsheet_() { if (!PORTAL_RUNTIME_SPREADSHEET_) PORTAL_RUNTIME_SPREADSHEET_ = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID); return PORTAL_RUNTIME_SPREADSHEET_; }

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
function publicActor_(actor) { return { email: actor.email, name: actor.name, role: actor.role, roleCode: actor.roleCode, homeCenter: actor.homeCenter, centers: actor.centers.slice(), isGlobalManager: actor.isGlobalManager, canDeleteAnyCase: canDeleteAnyCase_(actor), canCorrectCaseSources: systemCaseManager_(actor), capabilities: Object.assign({}, actor.capabilities), canApproveWarranty: canApproveWarranty_(actor) }; }
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
function iso_(value) {
  const date = asDate_(value);
  if (!date) return '';
  if (!PORTAL_RUNTIME_TIMEZONE_) PORTAL_RUNTIME_TIMEZONE_ = Session.getScriptTimeZone();
  const timezone = PORTAL_RUNTIME_TIMEZONE_;
  if (date.getUTCFullYear() >= 1976 && /^(Asia\/(Saigon|Ho_Chi_Minh|Bangkok)|Etc\/GMT-7|UTC|Etc\/UTC|GMT)$/.test(timezone)) {
    const day = String(portalReceiptSortKey_(date, timezone)).padStart(8, '0');
    return day.slice(0,4) + '-' + day.slice(4,6) + '-' + day.slice(6,8);
  }
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
}
function makeId_(prefix) { return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase(); }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).slice(0, 40); }
function parseJson_(value) { if (!value) return null; try { return JSON.parse(value); } catch (_) { return null; } }
function publicError_(message) { const error = new Error(message); error.publicMessage = message; return error; }
