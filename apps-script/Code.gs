const APP_VERSION = '1.8.0';
const SLA_DAYS = 7;
const FIRST_REPORT_YEAR = 2024;
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
    let data;
    if (request.action === 'dashboard.read') data = getDashboard_(request, actor);
    else if (request.action === 'tickets.search') data = searchTickets_(request, actor);
    else throw apiError_('ACTION_NOT_ALLOWED', 'Action is not allowed.');
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

  const annualMode = request.includeAnnual === false ? 'compact' : 'full';
  const ticketMode = request.includeTickets === false ? 'no-tickets' : 'tickets';
  const cacheKey = ['dash', APP_VERSION, annualMode, ticketMode, actor.role, scope.sort().join(','), period.key].join(':');
  const cache = CacheService.getScriptCache();
  const cached = request.refresh === true ? null : cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID).trim();
  const source = readSheetValuesAny_(spreadsheetId, period.year);
  const values = source.values;
  if (!values.length) throw apiError_('SOURCE_EMPTY', 'Tab dữ liệu không có nội dung.');
  const schema = schemaForHeaders_(values[0]);

  const records = values.slice(1).map(function (row, index) { return normalizeRow_(row, index + 2, String(period.year), centers, schema); })
    .filter(function (r) { return r.hasData && scope.includes(r.center); });
  const yearlyTotals = request.includeAnnual === false ? [] : buildYearlyTotals_(spreadsheetId, period.year, source, scope, centers, actor.role === 'service_manager' && requestedCenter === 'all');
  const output = buildDashboard_(records, period, scope, source.sheetName, source.lastRow, spreadsheetId, actor, yearlyTotals);
  if (request.includeTickets === false) output.tickets = [];
  safeCachePut_(cache, cacheKey, output, 300);
  return output;
}

function searchTickets_(request, actor) {
  const query = clean_(request.query);
  if (query.length < 2 || query.length > 100) throw apiError_('INVALID_QUERY', 'Nhập ít nhất 2 và không quá 100 ký tự để tra cứu thiết bị.');

  const centers = centerRegistry_();
  const allowed = actor.role === 'service_manager'
    ? centers.map(function (c) { return c.name; })
    : centers.filter(function (c) { return actor.centers.includes(c.id) || actor.centers.includes(c.name); }).map(function (c) { return c.name; });
  if (!allowed.length) throw apiError_('FORBIDDEN', 'Tài khoản chưa được gán service center.');

  const requestedCenter = request.center && request.center !== 'all' ? String(request.center) : 'all';
  if (requestedCenter !== 'all' && !allowed.includes(requestedCenter)) throw apiError_('FORBIDDEN', 'Không có quyền xem service center đã chọn.');
  const scope = requestedCenter === 'all' ? allowed : [requestedCenter];
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(request.year);
  const years = Number.isInteger(requestedYear) && requestedYear >= FIRST_REPORT_YEAR && requestedYear <= currentYear
    ? [requestedYear]
    : Array.from({length:currentYear - FIRST_REPORT_YEAR + 1}, function (_, index) { return FIRST_REPORT_YEAR + index; });
  const cache = CacheService.getScriptCache();
  const cacheKey = ['ticket-search', APP_VERSION, actor.role, scope.slice().sort().join(','), years.join('-'), digest_(query.toUpperCase())].join(':');
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID).trim();
  const lowerQuery = query.toLowerCase();
  const compactQuery = normalizeDeviceKey_(query);
  const matches = [];
  for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
    const year = years[yearIndex];
    let source;
    try { source = readSheetValuesAny_(spreadsheetId, year); }
    catch (error) {
      if (error.code === 'SOURCE_TAB_NOT_FOUND') continue;
      throw error;
    }
    const values = source.values;
    if (!values.length) continue;
    const schema = schemaForHeaders_(values[0]);
    values.slice(1).forEach(function (row, index) {
      const record = normalizeRow_(row, index + 2, String(year), centers, schema);
      if (!record.hasData || !scope.includes(record.center)) return;
      const searchable = [record.id, record.sourceNo, record.serialNumber, record.model].join(' ');
      const textMatch = searchable.toLowerCase().includes(lowerQuery);
      const compactMatch = compactQuery && normalizeDeviceKey_(searchable).includes(compactQuery);
      if (!textMatch && !compactMatch) return;
      const ticket = publicTicket_(record);
      ticket.sourceYear = year;
      ticket.sourceRow = record.rowNumber;
      matches.push(ticket);
    });
  }

  matches.sort(function (a, b) { return String(b.receivedDate || '').localeCompare(String(a.receivedDate || '')) || String(a.id).localeCompare(String(b.id)); });
  const limit = 200;
  const output = { tickets: matches.slice(0, limit), total: matches.length, truncated: matches.length > limit, fromYear: years[0], toYear: years[years.length - 1] };
  safeCachePut_(cache, cacheKey, output, 120);
  return output;
}

function readSheetValuesAny_(spreadsheetId, year) {
  const candidates = [String(year), 'Warranty_Tracking_' + year, 'Warranty_Tracking_' + year + ' '];
  let lastError = null;
  for (let i = 0; i < candidates.length; i++) {
    try { return readSheetValues_(spreadsheetId, candidates[i]); }
    catch (error) {
      lastError = error;
      if (error.code !== 'SOURCE_TAB_NOT_FOUND') throw error;
    }
  }
  throw lastError || apiError_('SOURCE_TAB_NOT_FOUND', 'Không tìm thấy tab dữ liệu năm ' + year + '.');
}

function buildYearlyTotals_(spreadsheetId, selectedYear, selectedSource, scope, centers, includeUnassigned) {
  const lastYear = Math.max(new Date().getFullYear(), selectedYear);
  const totals = [];
  for (let year = FIRST_REPORT_YEAR; year <= lastYear; year++) {
    try {
      const source = year === selectedYear ? selectedSource : readSheetValuesAny_(spreadsheetId, year);
      const schema = schemaForHeaders_(source.values[0] || []);
      let received = 0, returned = 0, slaEligible = 0, slaMet = 0;
      const monthlyReceived = Array(12).fill(0);
      source.values.slice(1).forEach(function (row) {
        const center = resolveCenter_(row[schema.center], centers);
        if (!scope.includes(center) && !(includeUnassigned && center === 'Chưa xác định')) return;
        const receivedDate = date_(row[schema.receivedDate]);
        const returnDate = date_(row[schema.returnDate]);
        if (inYear_(receivedDate, year)) {
          received++;
          monthlyReceived[receivedDate.getMonth()]++;
        }
        if (inYear_(returnDate, year)) returned++;
        if (receivedDate && returnDate && returnDate >= receivedDate && inYear_(returnDate, year)) {
          slaEligible++;
          if (ageDays_(receivedDate, returnDate) <= SLA_DAYS) slaMet++;
        }
      });
      const monthlyCumulative = [];
      monthlyReceived.reduce(function (sum, value, index) {
        monthlyCumulative[index] = sum + value;
        return monthlyCumulative[index];
      }, 0);
      totals.push({
        year: year,
        received: received,
        returned: returned,
        monthlyReceived: monthlyReceived,
        monthlyCumulative: monthlyCumulative,
        throughMonth: year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12,
        slaEligible: slaEligible,
        slaMet: slaMet,
        slaRate: slaEligible ? slaMet / slaEligible : null
      });
    } catch (error) {
      if (error.code !== 'SOURCE_TAB_NOT_FOUND') throw error;
    }
  }
  return totals;
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

function buildDashboard_(records, period, scope, sheetName, sourceLastRow, spreadsheetId, actor, yearlyTotals) {
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
    const open = rows.filter(function (r) { return isOpenAt_(r, period.asOf); });
    const priorOpen = rows.filter(function (r) { return isOpenAt_(r, prior.end); });
    const overdue = open.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > 14; });
    const waitingParts = open.filter(function (r) { return r.waitingParts; });
    const durations = completed.map(function (r) { return ageDays_(r.receivedDate, r.returnDate); }).filter(function (n) { return n >= 0; });
    const slaMet = durations.filter(function (n) { return n <= SLA_DAYS; }).length;
    const slaBreachedOpen = open.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > SLA_DAYS; }).length;
    const coverage = dataCoverage_(currentReceived);
    const delta = open.length - priorOpen.length;
    const volumeShare = periodRows.length ? currentReceived.length / periodRows.length : 0;
    const overdueRate = open.length ? overdue.length / open.length : 0;
    const outflowInflowRatio = currentReceived.length ? completed.length / currentReceived.length : null;
    const lowVolume = currentReceived.length < 5;
    let status = 'good';
    if (coverage < 85 || slaBreachedOpen > 0 || (open.length >= 3 && overdueRate >= 0.3)) status = 'action';
    else if (lowVolume || slaMet < durations.length || overdue.length || delta > 0 || coverage < 95) status = 'watch';
    let reason = 'Dòng công việc cân bằng; chưa thấy tín hiệu tồn hoặc quá hạn tăng';
    if (coverage < 85) reason = 'Dữ liệu chưa đủ để đánh giá đáng tin cậy';
    else if (slaBreachedOpen > 0) reason = slaBreachedOpen + ' thiết bị đang mở quá cam kết SLA ' + SLA_DAYS + ' ngày';
    else if (!currentReceived.length) reason = 'Không có thiết bị tiếp nhận; chưa đủ cơ sở đánh giá hiệu quả';
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
      slaTargetDays: SLA_DAYS,
      slaEligible: durations.length,
      slaMet: slaMet,
      slaRate: durations.length ? slaMet / durations.length : null,
      slaBreachedOpen: slaBreachedOpen,
      repeatRate: null,
      coverage: coverage,
      lowVolume: lowVolume,
      status: status,
      reason: reason
    };
  });

  const openAll = records.filter(function (r) { return isOpenAt_(r, period.asOf); });
  const waitingDelivery = openAll.filter(function (r) { return /chờ\s*giao/i.test(r.deliveryStatus); });
  const returned = records.filter(function (r) { return inPeriod_(r.returnDate, period); });
  const slaDurations = returned.map(function (r) { return ageDays_(r.receivedDate, r.returnDate); }).filter(function (n) { return n >= 0; });
  const slaMet = slaDurations.filter(function (n) { return n <= SLA_DAYS; }).length;
  const slaBreachedOpen = openAll.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > SLA_DAYS; }).length;
  const models = groupCount_(periodRows, function (r) { return r.model || (r.deviceType ? r.deviceType + ' · chưa có model' : 'Chưa xác định'); });
  const modelDeviceStats = groupModelDeviceStats_(periodRows);
  const modelCatalog = Object.keys(records.reduce(function (catalog, r) {
    const model = clean_(r.model);
    if (model) catalog[model] = true;
    return catalog;
  }, {})).sort(function (a, b) { return a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }); });
  const modelTypes = groupModelTypes_(periodRows);
  const errors = groupCountMulti_(periodRows, function (r) { return r.issues; });
  const parts = groupParts_(records.filter(function (r) { return inPeriod_(r.checkDate, period); }));
  const quality = qualitySummary_(records, periodRows, sourceLastRow);
  const tickets = records.slice().sort(function (a, b) { return time_(b.receivedDate) - time_(a.receivedDate); }).slice(0, 250).map(publicTicket_);

  return {
    schemaVersion: '1.8.0',
    generatedAt: new Date().toISOString(),
    period: { key: period.key, year: period.year, month: period.month, label: period.label, start: iso_(period.start), end: iso_(period.end), asOf: iso_(period.asOf), isYear: period.isYear },
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
      overdue: openAll.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > 14; }).length,
      slaTargetDays: SLA_DAYS,
      slaEligible: slaDurations.length,
      slaMet: slaMet,
      slaRate: slaDurations.length ? slaMet / slaDurations.length : null,
      slaBreachedOpen: slaBreachedOpen
    },
    annual: {
      year: period.year,
      received: yearRows.length,
      returned: yearReturned.length,
      partsQuantity: yearPartQuantity,
      partTypes: yearParts.length,
      parts: yearParts
    },
    yearlyTotals: yearlyTotals,
    cumulative: {
      fromYear: yearlyTotals.length ? yearlyTotals[0].year : FIRST_REPORT_YEAR,
      toYear: yearlyTotals.length ? yearlyTotals[yearlyTotals.length - 1].year : period.year,
      received: yearlyTotals.reduce(function (sum, item) { return sum + item.received; }, 0)
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
    modelDeviceStats: modelDeviceStats,
    modelCatalog: modelCatalog,
    modelTypes: modelTypes,
    errors: errors,
    parts: parts,
    tickets: tickets,
    dataQuality: quality
  };
}

function normalizeRow_(row, rowNumber, year, centers, schema) {
  const center = resolveCenter_(row[schema.center], centers);
  const issues = schema.issues.map(function (index) { return row[index]; }).map(clean_).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
  const parts = schema.parts.map(function (pair) { return [row[pair[0]], row[pair[1]]]; })
    .filter(function (part) { return clean_(part[0]); }).map(function (part) { return { pn: clean_(part[0]), qty: number_(part[1]) }; });
  const note = clean_(row[schema.note]);
  return {
    hasData: row.some(function (value) { return value !== '' && value !== null; }),
    rowNumber: rowNumber,
    id: year + '-' + rowNumber,
    sourceNo: clean_(row[schema.sourceNo]),
    deviceType: clean_(row[schema.deviceType]),
    serialNumber: clean_(row[schema.serialNumber]),
    model: clean_(row[schema.model]),
    receivedDate: date_(row[schema.receivedDate]),
    distributor: clean_(row[schema.distributor]),
    workshop: clean_(row[schema.workshop]),
    errorCode: clean_(row[schema.errorCode]),
    issues: issues,
    warrantyConfirmation: clean_(row[schema.warrantyConfirmation]),
    warrantyStatus: clean_(row[schema.warrantyStatus]),
    center: center,
    checkDate: date_(row[schema.checkDate]),
    deliveryStatus: clean_(row[schema.deliveryStatus]),
    status: clean_(row[schema.status]),
    sparePartDate: date_(row[schema.sparePartDate]),
    parts: parts,
    returnDate: date_(row[schema.returnDate]),
    waitingParts: /chờ|thiếu.+(?:board|part)|đề xuất.+board/i.test(note + ' ' + clean_(row[schema.warrantyStatus])),
    unnamedAD: clean_(row[schema.unnamedAD]),
    unnamedAE: clean_(row[schema.unnamedAE])
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
    returnDate: iso_(r.returnDate),
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
  const points = period.isYear ? Math.min(12, period.asOf.getMonth() + 1) : 6;
  for (let index = 0; index < points; index++) {
    const d = period.isYear
      ? new Date(period.year, index + 1, 0, 23, 59, 59, 999)
      : new Date(period.year, period.month - (points - 1 - index) + 1, 0, 23, 59, 59, 999);
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

function normalizeDeviceKey_(value) {
  return clean_(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function serialHash_(value) {
  const normalized = normalizeDeviceKey_(value);
  if (!normalized) return '';
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 22);
}

function groupModelDeviceStats_(rows) {
  const groups = {};
  rows.forEach(function (r) {
    const name = r.model || (r.deviceType ? r.deviceType + ' · chưa có model' : 'Chưa xác định');
    const key = normalizeDeviceKey_(name);
    if (!groups[key]) groups[key] = { name: name, key: key, rowCount: 0, missingSerialRows: 0, serialKeys: {} };
    const group = groups[key];
    group.rowCount++;
    const serialKey = serialHash_(r.serialNumber);
    if (serialKey) group.serialKeys[serialKey] = true;
    else group.missingSerialRows++;
  });
  return Object.keys(groups).map(function (key) {
    const group = groups[key];
    return {
      name: group.name,
      key: group.key,
      rowCount: group.rowCount,
      uniqueSerialKeys: Object.keys(group.serialKeys),
      missingSerialRows: group.missingSerialRows
    };
  }).sort(function (a, b) { return b.rowCount - a.rowCount || a.name.localeCompare(b.name); });
}
function groupModelTypes_(rows) {
  const groups = {};
  rows.forEach(function (r) {
    const type = r.deviceType || 'Chưa xác định';
    const model = r.model || (r.deviceType ? r.deviceType + ' · chưa có model' : 'Chưa xác định');
    if (!groups[type]) groups[type] = { count: 0, models: {} };
    groups[type].count++;
    groups[type].models[model] = (groups[type].models[model] || 0) + 1;
  });
  return Object.keys(groups).map(function (name) {
    const group = groups[name];
    return {
      name: name,
      count: group.count,
      models: Object.keys(group.models).map(function (model) { return { name: model, count: group.models[model] }; })
        .sort(function (a, b) { return b.count - a.count; })
    };
  }).sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
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

function schemaForHeaders_(headers) {
  const byName = {};
  headers.forEach(function (value, index) { byName[clean_(value).replace(/\s+/g, ' ').toLowerCase()] = index; });
  function get(name, required) {
    const index = byName[String(name).toLowerCase()];
    if (required && index === undefined) throw apiError_('SCHEMA_MISMATCH', 'Thiếu cột bắt buộc: ' + name + '.');
    return index;
  }
  const schema = {
    sourceNo: get('No.', true), deviceType: get('Device Type', true), serialNumber: get('S/N', false), model: get('Model', false),
    receivedDate: get('Received date', true), distributor: get('Distributor', false), workshop: get('Where sent to Workshop', false),
    errorCode: get('Error Code', false), warrantyConfirmation: get('Warranty confirmation', false), warrantyStatus: get('Warranty Status', false),
    center: get('Service Center', true), checkDate: get('Check / Repair date', false), deliveryStatus: get('Delivery Status', false),
    status: get('Status', false), sparePartDate: get('Receive spare part date', false), returnDate: get('Return date', true), note: get('Note', false),
    unnamedAD: 29, unnamedAE: 30,
    issues: ['Issue 1','Issue 2','Issue 3','Issue 4'].map(function (name) { return get(name, false); }).filter(function (index) { return index !== undefined; }),
    parts: []
  };
  for (let number = 1; number <= 4; number++) {
    const pn = get('Replace PN Board ' + number, false);
    if (pn !== undefined) schema.parts.push([pn, pn + 1]);
  }
  return schema;
}

function normalizePeriod_(value) {
  const now = new Date();
  const yearMatch = /^(\d{4})$/.exec(String(value || ''));
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    const asOf = now < end ? now : end;
    return { year: year, month: null, isYear: true, start: start, end: end, asOf: asOf, key: String(year), label: 'Năm ' + year };
  }
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ''));
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const asOf = now < end ? now : end;
  return { year: year, month: month, isYear: false, start: start, end: end, asOf: asOf, key: Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM'), label: 'Tháng ' + String(month + 1).padStart(2, '0') + '/' + year };
}

function previousPeriod_(period) { return period.isYear ? normalizePeriod_(String(period.year - 1)) : normalizePeriod_(Utilities.formatDate(new Date(period.year, period.month - 1, 1), Session.getScriptTimeZone(), 'yyyy-MM')); }
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
