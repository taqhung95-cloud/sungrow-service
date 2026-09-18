const APP_VERSION = '1.1.0';
const DEFAULT_SPREADSHEET_ID = '16lh3d4nDmmnGx6vBdKTrdWCLHFYMhf-g3cZjuupSv0s';
const DEFAULT_CENTERS = [
  { id: 'sungrow', name: 'Sungrow Service Center', aliases: ['WSHCM', 'Sungrow Service Center'] },
  { id: 'dat', name: 'DAT Center', aliases: ['DAT', 'DAT Center'] },
  { id: 'xbsolar', name: 'XBSolar Center', aliases: ['XB', 'XB Solar', 'XBSOLAR', 'XBSolar Center'] },
  { id: 'bke', name: 'BKE Center', aliases: ['BKE', 'BKE Center'] }
];

function doGet() {
  return json_({ ok: true, service: 'Sungrow Service Center API', version: APP_VERSION, authRequired: true });
}

function doPost(e) {
  try {
    const request = parseRequest_(e);
    const actor = authenticate_(request.idToken);
    if (request.action !== 'dashboard.read') throw apiError_('ACTION_NOT_ALLOWED', 'Action is not allowed.');
    const data = getDashboard_(request, actor);
    return json_({ ok: true, data: data });
  } catch (error) {
    console.error(String(error && error.stack || error));
    return json_({
      ok: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.publicMessage || 'Không thể xử lý yêu cầu.'
      }
    });
  }
}

function parseRequest_(e) {
  let raw = e && e.parameter && e.parameter.payload;
  if (!raw && e && e.postData && e.postData.contents) raw = e.postData.contents;
  if (!raw) throw apiError_('BAD_REQUEST', 'Thiếu nội dung request.');
  try { return JSON.parse(raw); } catch (_) { throw apiError_('BAD_REQUEST', 'Request JSON không hợp lệ.'); }
}

function authenticate_(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 5000) {
    throw apiError_('AUTH_REQUIRED', 'Vui lòng đăng nhập bằng tài khoản Google được cấp quyền.');
  }

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('GOOGLE_WEB_CLIENT_ID');
  const users = parseJsonProperty_(props, 'USERS_JSON', []);
  if (!clientId || !users.length) throw apiError_('AUTH_NOT_CONFIGURED', 'Hệ thống chưa cấu hình tài khoản truy cập.');

  const cache = CacheService.getScriptCache();
  const tokenKey = 'token:' + digest_(idToken);
  let claims = parseJson_(cache.get(tokenKey));
  if (!claims) {
    const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (response.getResponseCode() !== 200) throw apiError_('INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    claims = JSON.parse(response.getContentText());
    if (claims.aud !== clientId) throw apiError_('INVALID_TOKEN', 'Token không thuộc ứng dụng này.');
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw apiError_('INVALID_TOKEN', 'Nguồn token không hợp lệ.');
    if (Number(claims.exp || 0) * 1000 <= Date.now()) throw apiError_('INVALID_TOKEN', 'Phiên đăng nhập đã hết hạn.');
    if (!(claims.email_verified === true || claims.email_verified === 'true')) throw apiError_('INVALID_TOKEN', 'Email Google chưa được xác minh.');
    const ttl = Math.max(1, Math.min(300, Math.floor(Number(claims.exp) - Date.now() / 1000)));
    cache.put(tokenKey, JSON.stringify(claims), ttl);
  }

  const email = String(claims.email || '').toLowerCase();
  const user = users.find(function (u) {
    return u && u.active !== false && ((u.sub && String(u.sub) === String(claims.sub)) || (!u.sub && String(u.email || '').toLowerCase() === email));
  });
  if (!user) throw apiError_('FORBIDDEN', 'Tài khoản chưa được cấp quyền truy cập dashboard.');
  return {
    sub: String(claims.sub),
    email: email,
    role: String(user.role || 'center_manager'),
    centers: Array.isArray(user.centers) ? user.centers.map(String) : []
  };
}

function getDashboard_(request, actor) {
  const period = normalizePeriod_(request.period);
  const centers = centerRegistry_();
  const allowed = actor.role === 'service_manager'
    ? centers.map(function (c) { return c.name; })
    : centers.filter(function (c) { return actor.centers.includes(c.id) || actor.centers.includes(c.name); }).map(function (c) { return c.name; });
  if (!allowed.length) throw apiError_('FORBIDDEN', 'Tài khoản chưa được gán service center.');

  const requestedCenter = request.center && request.center !== 'all' ? String(request.center) : 'all';
  if (requestedCenter !== 'all' && !allowed.includes(requestedCenter)) throw apiError_('FORBIDDEN', 'Không có quyền xem service center đã chọn.');
  const scope = requestedCenter === 'all' ? allowed : [requestedCenter];

  const cacheKey = ['dash', APP_VERSION, actor.role, scope.sort().join(','), period.key].join(':');
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID).trim();
  const source = readSheetValues_(spreadsheetId, String(period.year));
  const values = source.values;
  if (!values.length) throw apiError_('SOURCE_EMPTY', 'Tab dữ liệu không có nội dung.');
  validateSchema_(values[0]);

  const records = values.slice(1).map(function (row, index) { return normalizeRow_(row, index + 2, String(period.year), centers); })
    .filter(function (r) { return r.hasData && scope.includes(r.center); });
  const output = buildDashboard_(records, period, scope, source.sheetName, source.lastRow, spreadsheetId, actor);
  safeCachePut_(cache, cacheKey, output, 300);
  return output;
}

function readSheetValues_(spreadsheetId, sheetName) {
  const range = "'" + String(sheetName).replace(/'/g, "''") + "'!A:AE";
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId)
    + '/values/' + encodeURIComponent(range)
    + '?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
    followRedirects: true
  });
  const status = response.getResponseCode();
  let payload = {};
  try { payload = JSON.parse(response.getContentText() || '{}'); } catch (_) {}
  const detail = String(payload.error && payload.error.message || '');
  if (status === 401 || status === 403) {
    if (/disabled|has not been used/i.test(detail)) {
      throw apiError_('SOURCE_API_DISABLED', 'Google Sheets API chưa được bật cho Apps Script project.');
    }
    throw apiError_('SOURCE_ACCESS_DENIED', 'Tài khoản deploy không có quyền đọc Google Sheet nguồn.');
  }
  if (status === 400 || status === 404) {
    throw apiError_('SOURCE_TAB_NOT_FOUND', 'Không tìm thấy tab dữ liệu ' + sheetName + ' hoặc Spreadsheet ID không đúng.');
  }
  if (status < 200 || status >= 300) {
    throw apiError_('SOURCE_READ_FAILED', 'Google Sheets API không trả về dữ liệu hợp lệ.');
  }
  const values = Array.isArray(payload.values) ? payload.values : [];
  return { values: values, sheetName: sheetName, lastRow: values.length };
}

function buildDashboard_(records, period, scope, sheetName, sourceLastRow, spreadsheetId, actor) {
  const periodRows = records.filter(function (r) { return inPeriod_(r.receivedDate, period); });
  const yearRows = records.filter(function (r) { return inYear_(r.receivedDate, period.year); });
  const yearReturned = records.filter(function (r) { return inYear_(r.returnDate, period.year); });
  const yearParts = groupParts_(records.filter(function (r) { return inYear_(r.checkDate, period.year); }));
  const yearPartQuantity = yearParts.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  const prior = previousPeriod_(period);
  const centerMetrics = scope.map(function (center) {
    const rows = records.filter(function (r) { return r.center === center; });
    const currentReceived = rows.filter(function (r) { return inPeriod_(r.receivedDate, period); });
    const completed = rows.filter(function (r) { return inPeriod_(r.returnDate, period); });
    const open = rows.filter(function (r) { return isOpenAt_(r, period.end); });
    const priorOpen = rows.filter(function (r) { return isOpenAt_(r, prior.end); });
    const overdue = open.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > 14; });
    const waitingParts = open.filter(function (r) { return r.waitingParts; });
    const durations = completed.map(function (r) { return ageDays_(r.receivedDate, r.returnDate); }).filter(function (n) { return n >= 0; });
    const coverage = dataCoverage_(currentReceived);
    const delta = open.length - priorOpen.length;
    const volumeShare = periodRows.length ? currentReceived.length / periodRows.length : 0;
    const overdueRate = open.length ? overdue.length / open.length : 0;
    const outflowInflowRatio = currentReceived.length ? completed.length / currentReceived.length : null;
    const lowVolume = currentReceived.length < 5;
    let status = 'good';
    if (coverage < 85 || (open.length >= 3 && overdueRate >= 0.3)) status = 'action';
    else if (lowVolume || overdue.length || delta > 0 || coverage < 95) status = 'watch';
    let reason = 'Dòng công việc cân bằng; chưa thấy tín hiệu tồn hoặc quá hạn tăng';
    if (!currentReceived.length) reason = 'Không có thiết bị tiếp nhận; chưa đủ cơ sở đánh giá hiệu quả';
    else if (coverage < 85) reason = 'Dữ liệu chưa đủ để đánh giá đáng tin cậy';
    else if (status === 'action') reason = 'Quá hạn chiếm ' + Math.round(overdueRate * 100) + '% trên ' + open.length + ' thiết bị đang mở' + (lowVolume ? '; mẫu tiếp nhận còn nhỏ' : '');
    else if (lowVolume) reason = currentReceived.length + ' thiết bị trong kỳ; mẫu nhỏ, chỉ theo dõi và chưa xếp hạng';
    else if (delta > 0) reason = 'Tồn tăng ' + delta + ' thiết bị; cần kiểm tra năng lực xử lý và chờ linh kiện';
    else if (overdue.length) reason = overdue.length + ' thiết bị quá hạn, chiếm ' + Math.round(overdueRate * 100) + '% tồn đang mở';
    return {
      center: center,
      received: currentReceived.length,
      completed: completed.length,
      volumeShare: volumeShare,
      outflowInflowRatio: outflowInflowRatio,
      open: open.length,
      delta: delta,
      overdue: overdue.length,
      overdueRate: overdueRate,
      waitingParts: waitingParts.length,
      medianDays: median_(durations),
      repeatRate: null,
      coverage: coverage,
      lowVolume: lowVolume,
      status: status,
      reason: reason
    };
  });

  const openAll = records.filter(function (r) { return isOpenAt_(r, period.end); });
  const waitingDelivery = openAll.filter(function (r) { return /chờ\s*giao/i.test(r.deliveryStatus); });
  const returned = records.filter(function (r) { return inPeriod_(r.returnDate, period); });
  const models = groupCount_(periodRows, function (r) { return r.model || (r.deviceType ? r.deviceType + ' · chưa có model' : 'Chưa xác định'); });
  const errors = groupCountMulti_(periodRows, function (r) { return r.issues; });
  const parts = groupParts_(records.filter(function (r) { return inPeriod_(r.checkDate, period); }));
  const quality = qualitySummary_(records, periodRows, sourceLastRow);
  const tickets = records.slice().sort(function (a, b) { return time_(b.receivedDate) - time_(a.receivedDate); }).slice(0, 250).map(publicTicket_);

  return {
    schemaVersion: '1.1',
    generatedAt: new Date().toISOString(),
    period: { key: period.key, label: period.label, start: iso_(period.start), end: iso_(period.end), asOf: iso_(period.asOf) },
    actor: { email: actor.email, role: actor.role, centers: scope },
    source: {
      spreadsheetId: undefined,
      sheetName: sheetName,
      sourceUpdatedAt: new Date().toISOString(),
      rowCount: records.length,
      status: 'ok'
    },
    summary: {
      centers: scope.length,
      received: periodRows.length,
      processing: openAll.filter(function (r) { return !/chờ\s*giao/i.test(r.deliveryStatus); }).length,
      waitingDelivery: waitingDelivery.length,
      returned: returned.length,
      overdue: openAll.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > 14; }).length
    },
    annual: {
      year: period.year,
      received: yearRows.length,
      returned: yearReturned.length,
      partsQuantity: yearPartQuantity,
      partTypes: yearParts.length,
      parts: yearParts
    },
    evaluation: {
      minimumSampleSize: 5,
      failureRateAvailable: false,
      incidentDenominator: 'Thiết bị tiếp nhận tại service center',
      failureRateRequirement: 'Cần số máy bán hoặc đang vận hành theo model và khu vực'
    },
    centers: centerMetrics,
    trends: backlogTrend_(records, period, scope),
    models: models,
    errors: errors,
    parts: parts,
    tickets: tickets,
    dataQuality: quality
  };
}

function normalizeRow_(row, rowNumber, year, centers) {
  const center = resolveCenter_(row[14], centers);
  const issues = [row[8], row[9], row[10], row[11]].map(clean_).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
  const parts = [[row[19], row[20]], [row[21], row[22]], [row[23], row[24]], [row[25], row[26]]]
    .filter(function (p) { return clean_(p[0]); }).map(function (p) { return { pn: clean_(p[0]), qty: number_(p[1]) }; });
  const note = clean_(row[28]);
  return {
    hasData: row.some(function (v) { return v !== '' && v !== null; }),
    rowNumber: rowNumber,
    id: year + '-' + rowNumber,
    sourceNo: clean_(row[0]),
    deviceType: clean_(row[1]),
    serialNumber: clean_(row[2]),
    model: clean_(row[3]),
    receivedDate: date_(row[4]),
    distributor: clean_(row[5]),
    workshop: clean_(row[6]),
    errorCode: clean_(row[7]),
    issues: issues,
    warrantyConfirmation: clean_(row[12]),
    warrantyStatus: clean_(row[13]),
    center: center,
    checkDate: date_(row[15]),
    deliveryStatus: clean_(row[16]),
    status: clean_(row[17]),
    sparePartDate: date_(row[18]),
    parts: parts,
    returnDate: date_(row[27]),
    waitingParts: /chờ|thiếu.+(?:board|part)|đề xuất.+board/i.test(note + ' ' + clean_(row[13])),
    unnamedAD: clean_(row[29]),
    unnamedAE: clean_(row[30])
  };
}

function publicTicket_(r) {
  return {
    id: r.id,
    sourceNo: r.sourceNo,
    serialNumber: r.serialNumber,
    model: r.model,
    deviceType: r.deviceType,
    receivedDate: iso_(r.receivedDate),
    center: r.center,
    error: r.issues.join(', ') || r.errorCode || 'Chưa ghi nhận',
    warranty: r.warrantyConfirmation,
    warrantyStatus: r.warrantyStatus,
    deliveryStatus: r.deliveryStatus,
    status: r.status,
    ageDays: ageDays_(r.receivedDate, new Date()),
    parts: r.parts
  };
}

function qualitySummary_(records, periodRows, sourceLastRow) {
  const seen = {};
  records.forEach(function (r) { if (r.sourceNo) seen[r.sourceNo] = (seen[r.sourceNo] || 0) + 1; });
  return {
    missingStableTicketId: records.length,
    duplicateSourceNo: Object.keys(seen).filter(function (k) { return seen[k] > 1; }).length,
    missingModelInPeriod: periodRows.filter(function (r) { return /inverter/i.test(r.deviceType) && !r.model; }).length,
    deliveredMissingReturnDate: records.filter(function (r) { return /đã\s*giao/i.test(r.deliveryStatus) && !r.returnDate; }).length,
    unnamedColumnADRows: records.filter(function (r) { return r.unnamedAD; }).length,
    unnamedColumnAERows: records.filter(function (r) { return r.unnamedAE; }).length,
    sourceLastRow: sourceLastRow
  };
}

function backlogTrend_(records, period, scope) {
  const out = [];
  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(period.year, period.month - offset + 1, 0, 23, 59, 59, 999);
    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
    const values = {};
    scope.forEach(function (center) {
      values[center] = records.filter(function (r) { return r.center === center && isOpenAt_(r, d); }).length;
    });
    out.push({ key: key, label: 'T' + (d.getMonth() + 1), values: values });
  }
  return out;
}

function groupCount_(rows, keyFn) {
  const counts = {};
  rows.forEach(function (r) { const k = keyFn(r); counts[k] = (counts[k] || 0) + 1; });
  return Object.keys(counts).map(function (name) { return { name: name, count: counts[name] }; }).sort(function (a, b) { return b.count - a.count; });
}

function groupCountMulti_(rows, keysFn) {
  const counts = {};
  rows.forEach(function (r) { keysFn(r).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; }); });
  return Object.keys(counts).map(function (name) { return { name: name, count: counts[name] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
}

function groupParts_(rows) {
  const counts = {};
  rows.forEach(function (r) { r.parts.forEach(function (p) { counts[p.pn] = (counts[p.pn] || 0) + p.qty; }); });
  return Object.keys(counts).map(function (pn) { return { pn: pn, quantity: counts[pn] }; }).sort(function (a, b) { return b.quantity - a.quantity; });
}

function centerRegistry_() {
  const custom = parseJsonProperty_(PropertiesService.getScriptProperties(), 'CENTERS_JSON', null);
  return Array.isArray(custom) && custom.length ? custom : DEFAULT_CENTERS;
}

function resolveCenter_(value, centers) {
  const input = clean_(value).toLowerCase();
  const found = centers.find(function (c) { return [c.name].concat(c.aliases || []).some(function (a) { return String(a).toLowerCase() === input; }); });
  return found ? found.name : (clean_(value) || 'Chưa xác định');
}

function validateSchema_(headers) {
  const required = { 0: 'No.', 1: 'Device Type', 2: 'S/N', 3: 'Model', 4: 'Received date', 14: 'Service Center', 27: 'Return date' };
  Object.keys(required).forEach(function (index) {
    if (clean_(headers[Number(index)]) !== required[index]) throw apiError_('SCHEMA_MISMATCH', 'Cấu trúc cột tab nguồn đã thay đổi tại cột ' + (Number(index) + 1) + '.');
  });
}

function normalizePeriod_(value) {
  const now = new Date();
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ''));
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const asOf = now < end ? now : end;
  return { year: year, month: month, start: start, end: end, asOf: asOf, key: Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM'), label: 'Tháng ' + String(month + 1).padStart(2, '0') + '/' + year };
}

function previousPeriod_(period) { return normalizePeriod_(Utilities.formatDate(new Date(period.year, period.month - 1, 1), Session.getScriptTimeZone(), 'yyyy-MM')); }
function inPeriod_(date, period) { return date && date >= period.start && date <= period.end; }
function inYear_(date, year) { return !!date && date.getFullYear() === year; }
function isOpenAt_(r, date) { return !!r.receivedDate && r.receivedDate <= date && !(r.returnDate && r.returnDate <= date) && !(/đã\s*giao/i.test(r.deliveryStatus) && !r.returnDate && periodIsCurrent_(date)); }
function periodIsCurrent_(date) { const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); }
function dataCoverage_(rows) {
  if (!rows.length) return 100;
  let present = 0, total = 0;
  rows.forEach(function (r) { [r.deviceType, r.receivedDate, r.center, r.warrantyStatus || r.deliveryStatus].forEach(function (v) { total++; if (v) present++; }); if (/inverter/i.test(r.deviceType)) { total += 2; if (r.serialNumber) present++; if (r.model) present++; } });
  return Math.round(100 * present / total);
}
function median_(values) { if (!values.length) return null; const a = values.slice().sort(function (x, y) { return x - y; }); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); }
function ageDays_(a, b) { if (!a || !b) return -1; return Math.floor((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000); }
function date_(value) {
  if (value instanceof Date && !isNaN(value)) return value;
  if (typeof value === 'number' && isFinite(value)) return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
function time_(value) { return value ? value.getTime() : 0; }
function iso_(value) { return value ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd') : null; }
function clean_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function number_(value) { const n = Number(value); return isFinite(n) && n > 0 ? n : 1; }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).slice(0, 40); }
function safeCachePut_(cache, key, value, ttl) {
  try {
    const serialized = JSON.stringify(value);
    if (Utilities.newBlob(serialized).getBytes().length <= 95000) cache.put(key, serialized, ttl);
  } catch (error) {
    console.warn('Dashboard cache skipped: ' + String(error && error.message || error));
  }
}
function parseJson_(value) { if (!value) return null; try { return JSON.parse(value); } catch (_) { return null; } }
function parseJsonProperty_(props, key, fallback) { const value = parseJson_(props.getProperty(key)); return value === null ? fallback : value; }
function apiError_(code, message) { const e = new Error(code); e.code = code; e.publicMessage = message; return e; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
