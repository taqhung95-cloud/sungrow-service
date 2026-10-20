const LEGACY_DASHBOARD_API = (function () {
const LEGACY_API_VERSION = '1.11.11-system-case-corrections';
let runtimeTimeZone_ = null;
const runtimeSerialHashes_ = Object.create(null);
const SLA_DAYS = 7;
const FIRST_REPORT_YEAR = 2024;
const DEFAULT_SPREADSHEET_ID = '1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI';
const DEFAULT_CENTERS = [
  { id: 'sungrow', name: 'Sungrow Service Center', aliases: ['WSHCM', 'Sungrow Service Center'] },
  { id: 'dat', name: 'DAT Center', aliases: ['DAT', 'DAT Center'] },
  { id: 'xbsolar', name: 'XBSolar Center', aliases: ['XB', 'XB Solar', 'XBSOLAR', 'XBSolar Center'] },
  { id: 'bke', name: 'BKE Center', aliases: ['BKE', 'BKE Center'] },
  { id: 'jgp', name: 'JGP Center', aliases: ['JGP', 'JGP Center'] }
];

function doGet() {
  return json_({ ok: true, service: 'Sungrow Service Center API', version: LEGACY_API_VERSION, authRequired: true });
}

function doPost(e) {
  try {
    const request = parseRequest_(e);
    if (request.action === 'portal.call') {
      return json_({ ok: true, data: handlePortalApi_(request) });
    }
    const actor = authenticateDashboardManager_(request.idToken);
    let data;
    if (request.action === 'dashboard.read') data = getDashboard_(request, actor);
    else if (request.action === 'tickets.search') data = searchTickets_(request, actor);
    else if (request.action === 'tickets.page') data = pageTickets_(request, actor);
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

function readCanonicalSnapshot_(spreadsheetId, centers, revision) {
  // Canonical cases already contain all approved historical migrations.
  // Never rescan yearly tabs or use a stale table under a newer revision.
  const cache = CacheService.getScriptCache();
  const key = ['canonical-records', LEGACY_API_VERSION, spreadsheetId, revision].join(':');
  const packed = safeCacheGet_(cache, key);
  if (packed && packed.headers && packed.rows) {
    const records = packed.rows.map(function (values) {
      const record = {};
      packed.headers.forEach(function (header, index) { record[header] = values[index]; });
      ['receivedDate', 'checkDate', 'technicalCompletedDate', 'readyDate', 'sparePartDate', 'returnDate'].forEach(function (field) {
        record[field] = date_(record[field]);
      });
      return record;
    });
    return { records: records, sheetName: packed.sheetName, lastRow: packed.lastRow };
  }
  // Shared table readers own their short-lived builder leases. Do not hold
  // ScriptLock here: nested locks serialize viewers and can block mutations.
  const snapshot = readOperationalRecords_(spreadsheetId, centers, revision);
  assertCanonicalRevision_(revision);
  const headers = snapshot.records.length ? Object.keys(snapshot.records[0]) : [];
  safeCachePut_(cache, key, {
    headers: headers,
    rows: snapshot.records.map(function (record) { return headers.map(function (header) { return record[header]; }); }),
    sheetName: snapshot.sheetName, lastRow: snapshot.lastRow
  }, 1800);
  return snapshot;
}

function assertCanonicalRevision_(revision) {
  if (revision && typeof getPortalDatabaseRevision_ === 'function' && getPortalDatabaseRevision_() !== revision) {
    throw apiError_('DATA_CHANGED', 'Dữ liệu vừa được cập nhật. Vui lòng tải lại danh sách.');
  }
}

function getDashboard_(request, actor) {
  const period = normalizePeriod_(request.period);
  if (period.start > period.asOf) throw apiError_('INVALID_PERIOD', 'Kỳ báo cáo chưa bắt đầu; chưa có KPI thực tế cho kỳ này.');
  const centers = centerRegistry_();
  const allowed = actor.role === 'service_manager'
    ? centers.map(function (c) { return c.name; })
    : centers.filter(function (c) { return actor.centers.includes(c.id) || actor.centers.includes(c.name); }).map(function (c) { return c.name; });
  if (!allowed.length) throw apiError_('FORBIDDEN', 'Tài khoản chưa được gán service center.');

  const requestedCenter = request.center && request.center !== 'all' ? String(request.center) : 'all';
  if (requestedCenter !== 'all' && !allowed.includes(requestedCenter)) throw apiError_('FORBIDDEN', 'Không có quyền xem service center đã chọn.');
  const scope = requestedCenter === 'all' ? allowed : [requestedCenter];
  const includeUnassigned = actor.role === 'service_manager' && requestedCenter === 'all';

  const annualMode = request.includeAnnual === false ? 'compact' : 'full';
  const ticketMode = request.includeTickets === false ? 'no-tickets' : 'tickets';
  const dataRevision = typeof getPortalDatabaseRevision_ === 'function' ? getPortalDatabaseRevision_() : '';
  const cacheKey = ['dash', LEGACY_API_VERSION, dataRevision, annualMode, ticketMode, actor.role, scope.slice().sort().join(','), period.key, iso_(new Date())].join(':');
  const cache = CacheService.getScriptCache();
  const cached = request.refresh === true ? null : safeCacheGet_(cache, cacheKey);
  if (cached) {
    cached.actor = { email: actor.email, role: actor.role, centers: scope };
    return cached;
  }

  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID).trim();
  const operational = readCanonicalSnapshot_(spreadsheetId, centers, dataRevision);
  const records = operational.records.filter(function (r) { return r.hasData && recordInScope_(r, scope, includeUnassigned, centers); });
  const yearlyTotals = request.includeAnnual === false ? [] : buildYearlyTotalsFromRecords_(records, period.year);
  const output = buildDashboard_(records, period, scope, operational.sheetName, operational.lastRow, spreadsheetId, actor, yearlyTotals, operational.records);
  output.cumulative.records = records.length;
  output.cumulative.unallocatedReceived = records.filter(function (r) { return !r.receivedDate; }).length;
  output.cumulative.unknownQuantityCases = records.filter(function (r) { return !deviceQuantity_(r); }).length;
  output.source.revision = dataRevision;
  output.dataQuality.canonical = { activeCases: operational.records.length, visibleCases: records.length, revision: dataRevision };
  assertCanonicalRevision_(dataRevision);
  if (request.includeTickets === false) output.tickets = [];
  safeCachePut_(cache, cacheKey, output, 1800);
  return output;
}

function searchTickets_(request, actor) {
  const query = clean_(request.query);
  if (query.length < 2 || query.length > 100) throw apiError_('INVALID_QUERY', 'Nhập ít nhất 2 và không quá 100 ký tự để tra cứu thiết bị.');
  const page = pageTickets_(Object.assign({}, request, { page: 1, pageSize: 100 }), actor);
  return { tickets: page.tickets, total: page.total, truncated: page.total > page.tickets.length, fromYear: page.fromYear, toYear: page.toYear };
}

function readOperationalRecords_(spreadsheetId, centers, pinnedRevision) {
  let spreadsheet = null;
  const sharedRevision = pinnedRevision || (typeof getPortalDatabaseRevision_ === 'function' ? getPortalDatabaseRevision_() : '');
  const canUseSharedTables = typeof readTableShared_ === 'function' && sharedRevision &&
    (typeof DATABASE_SPREADSHEET_ID === 'undefined' || spreadsheetId === DATABASE_SPREADSHEET_ID);
  function objects(sheetName) {
    if (canUseSharedTables) return readTableShared_(sheetName, sharedRevision, false);
    if (!spreadsheet) spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(clean_);
    return values.slice(1).map(function (row, index) {
      const item = { __rowNumber: index + 2 };
      headers.forEach(function (header, column) { if (header) item[header] = row[column]; });
      return item;
    }).filter(function (item) {
      return Object.keys(item).some(function (key) { return key !== '__rowNumber' && item[key] !== '' && item[key] !== null; });
    });
  }
  function grouped(rows, key) {
    return rows.reduce(function (map, row) {
      const value = clean_(row[key]);
      if (!map[value]) map[value] = [];
      map[value].push(row);
      return map;
    }, {});
  }

  const allCases = objects('Hồ sơ thiết bị');
  const cancelledCaseIds = {};
  const cancelledStrongKeys = {};
  const cancelledSourceKeys = {};
  allCases.filter(function (item) { return clean_(item['Trạng thái hồ sơ']) === 'Đã hủy'; }).forEach(function (item) {
    const caseId = clean_(item['Mã hồ sơ']);
    const serial = normalizeDeviceKey_(item['Số sê-ri (S/N)']);
    const received = date_(item['Ngày nhận từ khách']);
    if (caseId) cancelledCaseIds[caseId] = true;
    const sourceKey = clean_(item['Mã dòng dữ liệu cũ']);
    if (sourceKey) cancelledSourceKeys[sourceKey] = true;
    if (serial && received) cancelledStrongKeys['SN|' + serial + '|' + hybridDateKey_(received)] = true;
  });
  const cases = allCases.filter(function (item) { return clean_(item['Trạng thái hồ sơ']) !== 'Đã hủy'; });
  if (!cases.length) {
    const emptyRecords = [];
    emptyRecords.cancelledCaseIds = cancelledCaseIds;
    emptyRecords.cancelledStrongKeys = cancelledStrongKeys;
    emptyRecords.cancelledSourceKeys = cancelledSourceKeys;
    return { records: emptyRecords, sheetName: 'Hồ sơ thiết bị', lastRow: 0 };
  }
  const worksByCase = grouped(objects('Công việc trung tâm'), 'Mã hồ sơ');
  const issuesByWork = grouped(objects('Lỗi thiết bị'), 'Mã công việc');
  const partsByWork = grouped(objects('Linh kiện sử dụng'), 'Mã công việc');
  const holdsByWork = grouped(objects('Tạm dừng SLA'), 'Mã công việc');
  const fanEventsByCase = cases.some(function(r){return clean_(r['Kiểu hồ sơ'])==='Fan theo lô';}) ? grouped(objects('Nhật ký lô Fan'),'Mã hồ sơ') : {};
  const records = cases.map(function (item) {
    const caseId = clean_(item['Mã hồ sơ']);
    const fanState = clean_(item['Kiểu hồ sơ'])==='Fan theo lô' ? flState_(item) : null;
    const works = worksByCase[caseId] || [];
    const latest = works.length ? works[works.length - 1] : {};
    const issues = [];
    const parts = [];
    const holds = [];
    works.forEach(function (work) {
      (issuesByWork[clean_(work['Mã công việc'])] || []).forEach(function (issue) { issues.push(issue); });
      (partsByWork[clean_(work['Mã công việc'])] || []).forEach(function (part) { parts.push(part); });
      (holdsByWork[clean_(work['Mã công việc'])] || []).forEach(function (hold) { holds.push({start: iso_(date_(hold['Ngày bắt đầu'])), end: iso_(date_(hold['Ngày kết thúc']))}); });
    });
    const confirmedIssues = issues.filter(function (issue) { return clean_(issue['Loại ghi nhận']) !== 'Hiện tượng ban đầu'; });
    const issueNames = confirmedIssues.map(function (issue) { return clean_(issue['Tên lỗi']); }).filter(Boolean);
    const errorCode = confirmedIssues.map(function (issue) { return clean_(issue['Mã lỗi']); }).filter(Boolean)[0] || '';
    const caseStatus = clean_(item['Trạng thái hồ sơ']);
    const deliveryStatus = caseStatus === 'Đã hoàn tất' ? 'Đã giao máy' : (caseStatus === 'Sẵn sàng trả khách' ? 'Chờ giao máy' : 'Chưa giao máy');
    const note = [clean_(item['Ghi chú chung']), clean_(latest['Ghi chú nội bộ'])].filter(Boolean).join(' ');
    return {
      hasData: Boolean(caseId || clean_(item['Số sê-ri (S/N)']) || clean_(item.Model)),
      rowNumber: item.__rowNumber,
      id: caseId || ('operational-' + item.__rowNumber),
      sourceNo: caseId,
      sourceType: clean_(item['Nguồn dữ liệu']),
      legacySourceKey: clean_(item['Mã dòng dữ liệu cũ']),
      hasWorkflowEdits: Boolean(clean_(item['Người cập nhật gần nhất']) && clean_(item['Người cập nhật gần nhất']) !== 'Đồng bộ dữ liệu cũ'),
      deviceType: clean_(item['Loại thiết bị']),
      serialNumber: clean_(item['Số sê-ri (S/N)']),
      model: clean_(item.Model),
      quantity: clean_(item['Loại thiết bị']) === 'Fan' ? 1 : knownQuantity_(item['Số lượng']),
      modelQuantity: fanState ? SungrowFanLotRules.totals(fanState).received : knownQuantity_(item['Số lượng']),
      caseCount: 1,
      fanLot: fanState ? {totals:SungrowFanLotRules.totals(fanState),lines:fanState.lines,events:(fanEventsByCase[caseId]||[]).reduce(function(all,e){const date=iso_(date_(e['Ngày thực tế'])),lineId=e['Mã dòng Fan'];if(e['Loại thao tác']==='correction'){const d=parseJson_(e['Nội dung'])||{};all.push({kind:'technical',quantity:Number(d.completedDelta)||0,date:date,lineId:lineId},{kind:'return',quantity:Number(d.returnedDelta)||0,date:date,lineId:lineId});}else all.push({kind:e['Loại thao tác'],quantity:Number(e['Số lượng']),date:date,lineId:lineId,outcome:e['Kết quả']});return all;},[])} : null,
      relatedCaseIds: fanState&&fanState.legacyImport?fanState.legacyImport.sources.map(function(r){return r.caseId;}):[],
      relatedSerials: fanState ? fanState.lines.map(function(l){return l.serialNumber;}).filter(Boolean) : [],
      gsp: clean_(item.GSP),
      ma: clean_(item.MA),
      receivedDate: date_(item['Ngày nhận từ khách']),
      distributor: clean_(item['Tên khách hàng']) || clean_(item['Đơn vị gửi hàng']) || clean_(item['Nơi gửi hàng']),
      workshop: clean_(item['Trung tâm đang giữ hàng']),
      errorCode: errorCode,
      issues: issueNames,
      fanIssues: fanState?confirmedIssues.map(function(i){return {name:clean_(i['Tên lỗi']),lineId:clean_(i['Mã dòng Fan']),quantity:Number(i['Số Fan xác nhận'])};}):[],
      warrantyConfirmation: clean_(item['Người xác nhận bảo hành']),
      warrantyStatus: fanState&&typeof flWarrantyLabel_==='function'?flWarrantyLabel_(item):clean_(item['Tình trạng bảo hành']),
      center: resolveCenter_(latest['Trung tâm xử lý'] || item['Trung tâm đang giữ hàng'] || item['Trung tâm tiếp nhận khách'], centers),
      checkDate: date_(latest['Ngày hoàn tất kỹ thuật'] || latest['Ngày hoàn tất chẩn đoán']),
      technicalCompletedDate: latestDate_(works.map(function (work) { return work['Ngày hoàn tất kỹ thuật']; })),
      readyDate: date_(item['Ngày sẵn sàng trả khách']),
      deliveryStatus: deliveryStatus,
      status: clean_(latest['Trạng thái xử lý']) || caseStatus,
      sparePartDate: parts.map(function (part) { return date_(part['Ngày nhận linh kiện']); }).filter(Boolean)[0] || null,
      parts: parts.map(function (part) {
        const work = works.find(function (w) { return clean_(w['Mã công việc']) === clean_(part['Mã công việc']); }) || {};
        return { pn: clean_(part['Mã linh kiện (Part Number)']) || clean_(part['Tên linh kiện']), qty: knownQuantity_(part['Số lượng']), usedDate: iso_(date_(part['Ngày sử dụng'])), center: resolveCenter_(work['Trung tâm xử lý'], centers) };
      }).filter(function (part) { return part.pn; }),
      holds: holds,
      returnDate: date_(item['Ngày trả khách']),
      waitingParts: /chờ|thiếu.+(?:board|part)|đề xuất.+board/i.test(note + ' ' + clean_(item['Tình trạng bảo hành']) + ' ' + clean_(latest['Trạng thái xử lý'])),
      unnamedAD: '',
      unnamedAE: ''
    };
  });
  records.cancelledCaseIds = cancelledCaseIds;
  records.cancelledStrongKeys = cancelledStrongKeys;
  records.cancelledSourceKeys = cancelledSourceKeys;
  return { records: records, sheetName: 'Hồ sơ thiết bị + dữ liệu nghiệp vụ', lastRow: cases.length + 1 };
}

function pageTickets_(request, actor) {
  const query = clean_(request.query);
  if (query.length === 1 || query.length > 100) throw apiError_('INVALID_QUERY', 'Nhập ít nhất 2 và không quá 100 ký tự để tra cứu thiết bị.');

  const centers = centerRegistry_();
  const allowed = actor.role === 'service_manager'
    ? centers.map(function (c) { return c.name; })
    : centers.filter(function (c) { return actor.centers.includes(c.id) || actor.centers.includes(c.name); }).map(function (c) { return c.name; });
  if (!allowed.length) throw apiError_('FORBIDDEN', 'Tài khoản chưa được gán service center.');

  const requestedCenter = request.center && request.center !== 'all' ? String(request.center) : 'all';
  if (requestedCenter !== 'all' && !allowed.includes(requestedCenter)) throw apiError_('FORBIDDEN', 'Không có quyền xem service center đã chọn.');
  const scope = requestedCenter === 'all' ? allowed : [requestedCenter];
  const includeUnassigned = actor.role === 'service_manager' && requestedCenter === 'all';
  const pageSize = [20, 50, 100].includes(Number(request.pageSize)) ? Number(request.pageSize) : 20;
  const requestedPage = Math.max(1, Math.floor(Number(request.page) || 1));
  const statusFilter = clean_(request.status);
  const dataRevision = typeof getPortalDatabaseRevision_ === 'function' ? getPortalDatabaseRevision_() : '';
  const cache = CacheService.getScriptCache();
  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID).trim();
  const indexKey = ['ticket-index', LEGACY_API_VERSION, dataRevision, actor.role, scope.slice().sort().join(','), includeUnassigned ? 'with-unassigned' : 'assigned-only', iso_(new Date())].join(':');
  let index = safeCacheGet_(cache, indexKey);
  if (!index) {
    const operational = readCanonicalSnapshot_(spreadsheetId, centers, dataRevision);
    const tickets = operational.records.filter(function (record) {
      return record.hasData && recordInScope_(record, scope, includeUnassigned, centers);
    }).map(publicTicket_).sort(function (a, b) {
      return String(b.receivedDate || '').localeCompare(String(a.receivedDate || '')) || String(a.id).localeCompare(String(b.id));
    });
    const years = tickets.map(function (ticket) { return Number(String(ticket.receivedDate || '').slice(0, 4)); }).filter(function (year) { return year > 0; });
    index = {
      tickets: tickets,
      statuses: Array.from(new Set(tickets.map(function (ticket) { return clean_(ticket.status || ticket.deliveryStatus) || 'Chưa cập nhật'; }))).sort(function (a, b) { return a.localeCompare(b, 'vi'); }),
      fromYear: years.length ? Math.min.apply(null, years) : null,
      toYear: years.length ? Math.max.apply(null, years) : null
    };
    assertCanonicalRevision_(dataRevision);
    safeCachePut_(cache, indexKey, index, 1800);
  }
  const lowerQuery = query.toLowerCase();
  const compactQuery = normalizeDeviceKey_(query);
  let tickets = (index.tickets || []).filter(function (ticket) {
    if (!query) return true;
    const searchable = [ticket.serialNumber, ticket.model, (ticket.relatedSerials||[]).join(' '),(ticket.relatedCaseIds||[]).join(' ')].join(' ');
    return searchable.toLowerCase().includes(lowerQuery) || (compactQuery && normalizeDeviceKey_(searchable).includes(compactQuery));
  });
  const statuses = index.statuses || [];
  if (statusFilter && statusFilter !== 'all') {
    tickets = tickets.filter(function (ticket) { return (clean_(ticket.status || ticket.deliveryStatus) || 'Chưa cập nhật') === statusFilter; });
  }
  const total = tickets.length;
  tickets.sort(function (a, b) {
    const ad = String(a.receivedDate || ''), bd = String(b.receivedDate || '');
    if (!ad || !bd) return ad ? -1 : bd ? 1 : String(a.id).localeCompare(String(b.id));
    return (request.sortOrder === 'oldest' ? ad.localeCompare(bd) : bd.localeCompare(ad)) || String(a.id).localeCompare(String(b.id));
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  return {
    tickets: tickets.slice(start, start + pageSize), total: total, page: page,
    pageSize: pageSize, totalPages: totalPages, statuses: statuses,
    fromYear: index.fromYear, toYear: index.toYear, scope: 'all-years'
  };
}

function readHybridRecordsForYear_(spreadsheetId, year, centers, operationalRecords) {
  let source = { values: [], sheetName: String(year), lastRow: 0 };
  let combinedDashboardSource = false;
  try { source = readSheetValuesAny_(spreadsheetId, year); }
  catch (error) {
    if (error.code !== 'SOURCE_TAB_NOT_FOUND') throw error;
    try {
      source = readSheetValues_(spreadsheetId, 'Dữ liệu dashboard');
      combinedDashboardSource = true;
    } catch (dashboardError) {
      if (dashboardError.code !== 'SOURCE_TAB_NOT_FOUND') throw dashboardError;
    }
  }
  let legacyRecords = [];
  if (source.values.length) {
    const schema = schemaForHeaders_(source.values[0]);
    legacyRecords = source.values.slice(1).map(function (row, index) {
      return normalizeRow_(row, index + 2, String(year), centers, schema);
    }).filter(function (record) { return record.hasData && (!combinedDashboardSource || inYear_(record.receivedDate, year)); });
  }
  const cancelledCaseIds = operationalRecords && operationalRecords.cancelledCaseIds || {};
  const cancelledStrongKeys = operationalRecords && operationalRecords.cancelledStrongKeys || {};
  const cancelledSourceKeys = operationalRecords && operationalRecords.cancelledSourceKeys || {};
  legacyRecords = legacyRecords.filter(function (record) {
    return !cancelledCaseIds[clean_(record.projectedCaseId)] && !cancelledSourceKeys[record.legacySourceKey] && !(combinedDashboardSource && cancelledStrongKeys[strongHybridKey_(record)]);
  });
  const merged = mergeLegacyAndOperational_(legacyRecords, operationalRecords || [], year);
  return {
    records: merged.records,
    stats: merged.stats,
    sheetName: source.sheetName + ' + cập nhật nhập liệu',
    lastRow: source.lastRow + merged.stats.appendedNew
  };
}

function hybridDateKey_(value) {
  return iso_(value) || '';
}

function strongHybridKey_(record) {
  const serial = normalizeDeviceKey_(record.serialNumber);
  const received = hybridDateKey_(record.receivedDate);
  return serial && received ? 'SN|' + serial + '|' + received : '';
}

function fallbackHybridKey_(record) {
  const model = normalizeDeviceKey_(record.model);
  const received = hybridDateKey_(record.receivedDate);
  const center = clean_(record.center).toLowerCase();
  return model && received && center ? 'MODEL|' + model + '|' + received + '|' + center : '';
}

function overlayOperationalRecord_(legacy, operational) {
  const merged = Object.assign({}, legacy);
  // An untouched imported row is a snapshot, not a user correction. Keep the
  // original year's facts when an earlier importer mapped them incorrectly.
  if (operational.legacySourceKey && !operational.hasWorkflowEdits) {
    merged.operationalCaseId = operational.id;
    return merged;
  }
  ['warrantyConfirmation', 'warrantyStatus', 'center', 'checkDate', 'status', 'sparePartDate', 'returnDate', 'errorCode', 'gsp', 'ma'].forEach(function (field) {
    if (field === 'warrantyStatus' && operational[field] === 'Chờ xác nhận' && ['Trong bảo hành','Ngoài bảo hành','Sửa làm hàng good'].indexOf(legacy.warrantyStatus) !== -1) return;
    if (operational[field] !== '' && operational[field] !== null && operational[field] !== undefined) merged[field] = operational[field];
  });
  if (operational.deliveryStatus && (!merged.deliveryStatus || !/^chưa\s+giao/i.test(operational.deliveryStatus))) {
    merged.deliveryStatus = operational.deliveryStatus;
  }
  // New-workflow projections can still contain intake symptoms in Issue 1-4.
  // An empty confirmed-issue list must clear them when the operational case is authoritative.
  if (/^quy\s*trình\s*mới$/i.test(clean_(operational.sourceType)) || (operational.issues && operational.issues.length)) {
    merged.issues = (operational.issues || []).slice();
  }
  if (operational.parts && operational.parts.length) merged.parts = operational.parts.slice();
  merged.waitingParts = Boolean(operational.waitingParts || merged.waitingParts);
  merged.operationalCaseId = operational.id;
  merged.sourceType = legacy.sourceType || 'Dữ liệu lịch sử';
  return merged;
}

function mergeLegacyAndOperational_(legacyRecords, operationalRecords, year) {
  const records = legacyRecords.slice();
  const byCaseId = {};
  const bySourceKey = {};
  const strong = {};
  const fallback = {};
  function addIndex(map, key, index) {
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(index);
  }
  records.forEach(function (record, index) {
    addIndex(bySourceKey, record.legacySourceKey, index);
    if (record.projectedCaseId) addIndex(byCaseId, record.projectedCaseId, index);
    addIndex(strong, strongHybridKey_(record), index);
    addIndex(fallback, fallbackHybridKey_(record), index);
  });
  const stats = { legacyRows: records.length, matchedOverlay: 0, appendedNew: 0, duplicateNew: 0, unmatchedHistorical: 0 };
  operationalRecords.forEach(function (operational) {
    if (!operational.hasData) return;
    const sourceMatch = /^(\d{4})!(\d+)$/.exec(clean_(operational.legacySourceKey));
    if (sourceMatch ? Number(sourceMatch[1]) !== Number(year) : (!operational.receivedDate || operational.receivedDate.getFullYear() !== Number(year))) return;
    const sourceMatches = bySourceKey[operational.legacySourceKey] || [];
    const caseMatches = byCaseId[operational.id] || [];
    const strongMatches = strong[strongHybridKey_(operational)] || [];
    const fallbackMatches = fallback[fallbackHybridKey_(operational)] || [];
    // With provenance present, a failed source match must not fall back to a
    // different repair cycle sharing the same serial and intake date.
    const matches = sourceMatch ? sourceMatches : (caseMatches.length === 1 ? caseMatches : (strongMatches.length === 1 ? strongMatches : (!normalizeDeviceKey_(operational.serialNumber) && fallbackMatches.length === 1 ? fallbackMatches : [])));
    const isNew = /^quy\s*trình\s*mới$/i.test(clean_(operational.sourceType));
    if (matches.length === 1) {
      records[matches[0]] = overlayOperationalRecord_(records[matches[0]], operational);
      stats.matchedOverlay++;
      if (isNew) stats.duplicateNew++;
      return;
    }
    if (isNew) {
      const index = records.length;
      records.push(operational);
      addIndex(strong, strongHybridKey_(operational), index);
      addIndex(fallback, fallbackHybridKey_(operational), index);
      stats.appendedNew++;
    } else {
      stats.unmatchedHistorical++;
    }
  });
  return { records: records, stats: stats };
}

function yearlyTotalFromRecords_(records, year) {
  let received = 0, returned = 0, slaEligible = 0, slaMet = 0;
  const monthlyReceived = Array(12).fill(0);
  records.forEach(function (record) {
    if (inYear_(record.receivedDate, year)) {
      received++;
      monthlyReceived[record.receivedDate.getMonth()]++;
    }
    if (inYear_(record.returnDate, year)) returned++;
    if (record.receivedDate && record.returnDate && record.returnDate >= record.receivedDate && inYear_(record.returnDate, year)) {
      slaEligible++;
      if (ageDays_(record.receivedDate, record.returnDate) <= SLA_DAYS) slaMet++;
    }
  });
  const monthlyCumulative = [];
  monthlyReceived.reduce(function (sum, value, index) {
    monthlyCumulative[index] = sum + value;
    return monthlyCumulative[index];
  }, 0);
  return {
    year: year,
    sourceRecords: records.length,
    received: received,
    unallocatedReceived: Math.max(0, records.length - received),
    returned: returned,
    monthlyReceived: monthlyReceived,
    monthlyCumulative: monthlyCumulative,
    throughMonth: year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12,
    slaEligible: slaEligible,
    slaMet: slaMet,
    slaRate: slaEligible ? slaMet / slaEligible : null
  };
}

function buildHybridYearlyTotals_(spreadsheetId, selectedYear, scope, centers, operationalRecords, selectedYearRecords, includeUnassigned) {
  const lastYear = Math.max(new Date().getFullYear(), selectedYear);
  const totals = [];
  for (let year = FIRST_REPORT_YEAR; year <= lastYear; year++) {
    const yearRecords = year === selectedYear && selectedYearRecords
      ? selectedYearRecords
      : readHybridRecordsForYear_(spreadsheetId, year, centers, operationalRecords).records;
    const scoped = yearRecords.filter(function (record) { return record.hasData && recordInScope_(record, scope, includeUnassigned, centers); });
    totals.push(yearlyTotalFromRecords_(scoped, year));
  }
  return totals;
}

function buildYearlyTotalsFromRecords_(records, selectedYear) {
  const lastYear = Math.max(new Date().getFullYear(), selectedYear);
  const totals = [];
  const receiptYears = records.filter(function (record) { return record.receivedDate; }).map(function (record) { return record.receivedDate.getFullYear(); });
  const firstYear = receiptYears.length ? Math.min(FIRST_REPORT_YEAR, Math.min.apply(null, receiptYears)) : FIRST_REPORT_YEAR;
  const finalYear = receiptYears.length ? Math.max(lastYear, Math.max.apply(null, receiptYears)) : lastYear;
  for (let year = firstYear; year <= finalYear; year++) {
    let received = 0, returned = 0, slaEligible = 0, slaMet = 0;
    const monthlyReceived = Array(12).fill(0);
    records.forEach(function (record) {
      if (inYear_(record.receivedDate, year) && record.receivedDate <= new Date()) {
        received += deviceQuantity_(record);
        monthlyReceived[record.receivedDate.getMonth()] += deviceQuantity_(record);
      }
      if (validReturn_(record) && inYear_(record.returnDate, year) && record.returnDate <= new Date()) returned += deviceQuantity_(record);
      if (validReturn_(record) && inYear_(record.returnDate, year) && record.returnDate <= new Date()) {
        slaEligible += deviceQuantity_(record);
        if (ageDays_(record.receivedDate, record.returnDate) <= SLA_DAYS) slaMet += deviceQuantity_(record);
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
  }
  return totals;
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
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(String(sheetName));
  if (!sheet) throw apiError_('SOURCE_TAB_NOT_FOUND', 'Không tìm thấy tab dữ liệu ' + sheetName + '.');
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.min(Math.max(sheet.getLastColumn(), 1), 40);
  const values = lastRow ? sheet.getRange(1, 1, lastRow, lastColumn).getValues() : [];
  return { values: values, sheetName: sheetName, lastRow: values.length };
}

function buildDashboard_(records, period, scope, sheetName, sourceLastRow, spreadsheetId, actor, yearlyTotals, partRecords) {
  const periodRows = records.filter(function (r) { return inPeriod_(r.receivedDate, period); });
  const yearPeriod = normalizePeriod_(String(period.year));
  const yearRows = records.filter(function (r) { return inPeriod_(r.receivedDate, yearPeriod); });
  const yearReturned = records.filter(function (r) { return validReturn_(r) && inPeriod_(r.returnDate, yearPeriod); });
  const yearParts = groupPartsForPeriod_(partRecords || records, normalizePeriod_(String(period.year)), scope);
  const yearPartQuantity = yearParts.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  const prior = previousPeriod_(period);
  const metricCenters = scope.concat(records.some(function (r) { return !scope.includes(r.center); }) ? ['Chưa xác định'] : []);
  function inMetricCenter(r, center) { return center === 'Chưa xác định' ? !scope.includes(r.center) : r.center === center; }
  const centerMetrics = metricCenters.map(function (center) {
    const rows = records.filter(function (r) { return inMetricCenter(r, center); });
    const currentReceived = rows.filter(function (r) { return inPeriod_(r.receivedDate, period); });
    const completed = rows.filter(function (r) { return validReturn_(r) && inPeriod_(r.returnDate, period); });
    const open = rows.filter(function (r) { return isOpenAt_(r, period.asOf); });
    const priorOpen = rows.filter(function (r) { return isOpenAt_(r, prior.end); });
    const opening = rows.filter(function (r) { return isOpenAt_(r, new Date(period.start.getTime() - 1)); });
    const overdue = open.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > 14; });
    const waitingParts = open.filter(function (r) { return r.waitingParts; });
    const durations = completed.map(function (r) { return ageDays_(r.receivedDate, r.returnDate); }).filter(function (n) { return n >= 0; });
    const centerSla = slaAverages_(completed);
    const slaEligible = sumDevices_(completed);
    const slaMet = sumDevices_(completed.filter(function (r) { return ageDays_(r.receivedDate, r.returnDate) <= SLA_DAYS; }));
    const slaBreachedOpen = sumDevices_(open.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > SLA_DAYS; }));
    const coverage = dataCoverage_(currentReceived);
    const delta = sumDevices_(open) - sumDevices_(priorOpen);
    const volumeShare = sumDevices_(periodRows) ? sumDevices_(currentReceived) / sumDevices_(periodRows) : 0;
    const overdueRate = sumDevices_(open) ? sumDevices_(overdue) / sumDevices_(open) : 0;
    const outflowInflowRatio = sumDevices_(currentReceived) ? sumDevices_(completed) / sumDevices_(currentReceived) : null;
    const lowVolume = currentReceived.length < 5;
    let status = 'good';
    if (coverage < 85 || slaBreachedOpen > 0 || (open.length >= 3 && overdueRate >= 0.3)) status = 'action';
    else if (lowVolume || slaMet < slaEligible || overdue.length || delta > 0 || coverage < 95) status = 'watch';
    let reason = 'Dòng công việc cân bằng; chưa thấy tín hiệu tồn hoặc quá hạn tăng';
    if (coverage < 85) reason = 'Dữ liệu chưa đủ để đánh giá đáng tin cậy';
    else if (slaBreachedOpen > 0) reason = slaBreachedOpen + ' thiết bị đang mở quá cam kết SLA ' + SLA_DAYS + ' ngày';
    else if (!currentReceived.length) reason = 'Không có thiết bị tiếp nhận; chưa đủ cơ sở đánh giá hiệu quả';
    else if (status === 'action') reason = 'Quá hạn chiếm ' + Math.round(overdueRate * 100) + '% trên ' + sumDevices_(open) + ' thiết bị đang mở' + (lowVolume ? '; mẫu tiếp nhận còn nhỏ' : '');
    else if (lowVolume) reason = sumDevices_(currentReceived) + ' thiết bị trong kỳ; mẫu nhỏ, chỉ theo dõi và chưa xếp hạng';
    else if (delta > 0) reason = 'Tồn tăng ' + delta + ' thiết bị; cần kiểm tra năng lực xử lý và chờ linh kiện';
    else if (overdue.length) reason = sumDevices_(overdue) + ' thiết bị quá hạn, chiếm ' + Math.round(overdueRate * 100) + '% tồn đang mở';
    if (center === 'Chưa xác định') { status = 'watch'; reason = 'Center nguồn chưa chuẩn hóa; giữ trong tổng nhưng không xếp hạng center.'; }
    return {
      center: center,
      fan: fanPhysicalSummary_(rows,period),
      unassigned: center === 'Chưa xác định',
      received: sumDevices_(currentReceived),
      completed: sumDevices_(completed),
      opening: sumDevices_(opening),
      carriedOpen: sumDevices_(open.filter(function (r) { return r.receivedDate < period.start; })),
      stockBalanceGap: sumDevices_(open) - (sumDevices_(opening) + sumDevices_(currentReceived) - sumDevices_(completed)),
      unknownQuantityCases: rows.filter(function (r) { return !deviceQuantity_(r); }).length,
      volumeShare: volumeShare,
      outflowInflowRatio: outflowInflowRatio,
      open: sumDevices_(open),
      delta: delta,
      overdue: sumDevices_(overdue),
      overdueRate: overdueRate,
      waitingParts: sumDevices_(waitingParts),
      medianDays: median_(durations),
      slaActualDays: centerSla.actual,
      slaNetDays: centerSla.net,
      slaPauseDays: centerSla.paused,
      slaTargetDays: SLA_DAYS,
      slaEligible: slaEligible,
      slaMet: slaMet,
      slaRate: slaEligible ? slaMet / slaEligible : null,
      slaBreachedOpen: slaBreachedOpen,
      repeatRate: null,
      coverage: coverage,
      lowVolume: lowVolume,
      status: status,
      reason: reason
    };
  });

  const openAll = records.filter(function (r) { return isOpenAt_(r, period.asOf); });
  const waitingDelivery = openAll.filter(function (r) { return isWaitingAt_(r, period.asOf); });
  const technicalCompleted = records.filter(function (r) { return validTechnicalDate_(r) && inPeriod_(r.technicalCompletedDate, period); });
  const returned = records.filter(function (r) { return validReturn_(r) && inPeriod_(r.returnDate, period); });
  const slaDurations = returned.map(function (r) { return ageDays_(r.receivedDate, r.returnDate); }).filter(function (n) { return n >= 0; });
  const summarySla = slaAverages_(returned);
  const slaEligible = sumDevices_(returned);
  const slaMet = sumDevices_(returned.filter(function (r) { return ageDays_(r.receivedDate, r.returnDate) <= SLA_DAYS; }));
  const slaBreachedOpen = sumDevices_(openAll.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > SLA_DAYS; }));
  const models = groupCount_(periodRows, function (r) { return r.model || (r.fanLot ? 'Fan theo lô' : r.deviceType ? r.deviceType + ' | chưa có model' : 'Chưa xác định'); });
  const modelDeviceStats = groupModelDeviceStats_(periodRows);
  const modelCatalog = Object.keys(records.reduce(function (catalog, r) {
    const model = clean_(r.model);
    if (model) catalog[model] = true;
    return catalog;
  }, {})).sort(function (a, b) { return a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }); });
  const modelTypes = groupModelTypes_(periodRows);
  const errors = groupConfirmedIssueCategories_(periodRows);
  const parts = groupPartsForPeriod_(partRecords || records, period, scope);
  const quality = qualitySummary_(records, periodRows, sourceLastRow);
  quality.kpi = {
    unknownQuantityCases: records.filter(function (r) { return !deviceQuantity_(r); }).length,
    unknownReceiptQuantityCases: periodRows.filter(function (r) { return !deviceQuantity_(r); }).length,
    missingTechnicalDateCases: records.filter(function (r) { return /hoàn tất|chờ\s*giao|đã\s*giao/i.test(r.status + ' ' + r.deliveryStatus) && !validTechnicalDate_(r); }).length,
    missingReturnDateCases: records.filter(function (r) { return /đã\s*giao/i.test(r.deliveryStatus) && !validReturn_(r); }).length,
    missingReadyDateCases: records.filter(function (r) { return /chờ\s*giao/i.test(r.deliveryStatus) && !r.readyDate; }).length,
    unallocatedPartRows: (partRecords || records).reduce(function (n, r) { return n + (r.parts || []).filter(function (p) { return scope.includes(p.center || r.center) && (!p.qty || !date_(p.usedDate)); }).length; }, 0)
  };
  const tickets = records.slice().sort(function (a, b) { return time_(b.receivedDate) - time_(a.receivedDate); }).slice(0, 250).map(publicTicket_);

  return {
    schemaVersion: '1.8.2',
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
      fan: fanPhysicalSummary_(records,period),
      received: sumDevices_(periodRows),
      receivedCases: periodRows.length,
      technicalCompleted: sumDevices_(technicalCompleted),
      technicalCompletedCases: technicalCompleted.length,
      processing: sumDevices_(openAll.filter(function (r) { return !isWaitingAt_(r, period.asOf); })),
      waitingDelivery: sumDevices_(waitingDelivery),
      returned: sumDevices_(returned),
      overdue: sumDevices_(openAll.filter(function (r) { return ageDays_(r.receivedDate, period.asOf) > 14; })),
      slaActualDays: summarySla.actual,
      slaNetDays: summarySla.net,
      slaPauseDays: summarySla.paused,
      slaTargetDays: SLA_DAYS,
      slaEligible: slaEligible,
      slaMet: slaMet,
      slaRate: slaEligible ? slaMet / slaEligible : null,
      slaBreachedOpen: slaBreachedOpen
    },
    annual: {
      year: period.year,
      received: sumDevices_(yearRows),
      returned: sumDevices_(yearReturned),
      partsQuantity: yearPartQuantity,
      partTypes: yearParts.length,
      parts: yearParts
    },
    yearlyTotals: yearlyTotals,
    cumulative: {
      fromYear: yearlyTotals.length ? yearlyTotals[0].year : FIRST_REPORT_YEAR,
      toYear: yearlyTotals.length ? yearlyTotals[yearlyTotals.length - 1].year : period.year,
      records: yearlyTotals.reduce(function (sum, item) { return sum + Number(item.sourceRecords || item.received || 0); }, 0),
      received: yearlyTotals.reduce(function (sum, item) { return sum + item.received; }, 0),
      unallocatedReceived: yearlyTotals.reduce(function (sum, item) { return sum + Number(item.unallocatedReceived || 0); }, 0)
    },
    evaluation: {
      minimumSampleSize: 5,
      failureRateAvailable: false,
      incidentDenominator: 'Thiết bị tiếp nhận tại service center',
      failureRateRequirement: 'Cần số máy bán hoặc đang vận hành theo model và khu vực'
    },
    centers: centerMetrics,
    trends: backlogTrend_(records.map(function (r) { return scope.includes(r.center) ? r : Object.assign({}, r, {center:'Chưa xác định'}); }), period, metricCenters),
    models: models,
    modelDeviceStats: modelDeviceStats,
    modelCatalog: modelCatalog,
    modelTypes: modelTypes,
    modelDistributionUnit: 'physical-items',
    fanModelDistribution: 'per-line',
    errors: errors,
    parts: parts,
    tickets: tickets,
    dataQuality: quality
  };
}

function normalizeRow_(row, rowNumber, year, centers, schema) {
  const center = resolveCenter_(row[schema.center], centers);
  const projectedCaseId = schema.projectedCaseId === undefined ? '' : clean_(row[schema.projectedCaseId]);
  // Issue columns in workflow projections may contain intake symptoms. Read confirmed issues from the operational tab instead.
  const issues = projectedCaseId ? [] : schema.issues.map(function (index) { return row[index]; }).map(clean_).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
  const parts = schema.parts.map(function (pair) { return [row[pair[0]], row[pair[1]]]; })
    .filter(function (part) { return clean_(part[0]); }).map(function (part) { return { pn: clean_(part[0]), qty: number_(part[1]) }; });
  const note = clean_(row[schema.note]);
  return {
    hasData: row.some(function (value) { return value !== '' && value !== null; }),
    rowNumber: rowNumber,
    id: year + '-' + rowNumber,
    projectedCaseId: projectedCaseId,
    sourceNo: clean_(row[schema.sourceNo]),
    sourceType: 'Dữ liệu lịch sử',
    legacySourceKey: String(year) + '!' + rowNumber,
    deviceType: clean_(row[schema.deviceType]),
    serialNumber: clean_(row[schema.serialNumber]),
    model: clean_(row[schema.model]),
    gsp: clean_(row[schema.gsp]),
    ma: clean_(row[schema.ma]),
    receivedDate: date_(row[schema.receivedDate]),
    distributor: clean_(row[schema.distributor]),
    workshop: clean_(row[schema.workshop]),
    errorCode: clean_(row[schema.errorCode]),
    issues: issues,
    warrantyConfirmation: clean_(row[schema.warrantyConfirmation]),
    warrantyStatus: historicalWarrantyStatus_(row[schema.warrantyConfirmation], row[schema.warrantyStatus]),
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
  const deliveredWithoutReturn = /đã\s*giao/i.test(r.deliveryStatus) && !r.returnDate;
  const processingState = r.returnDate ? 'completed' : (deliveredWithoutReturn ? 'missing_return_date' : 'open');
  const processingDays = deliveredWithoutReturn ? -1 : ageDays_(r.receivedDate, r.returnDate || new Date());
  return {
    id: r.id,
    serialNumber: r.serialNumber,
    model: r.model,
    gsp: r.gsp || '',
    ma: r.ma || '',
    deviceType: r.deviceType,
    fanLot: r.fanLot ? {totals:r.fanLot.totals} : null,
    relatedSerials: r.relatedSerials || [],
    relatedCaseIds: r.relatedCaseIds || [],
    receivedDate: iso_(r.receivedDate),
    returnDate: iso_(r.returnDate),
    center: r.center,
    error: r.issues.join(', ') || r.errorCode || 'Chưa ghi nhận',
    warranty: r.warrantyConfirmation,
    warrantyStatus: r.warrantyStatus,
    deliveryStatus: r.deliveryStatus,
    status: r.status,
    ageDays: processingDays,
    processingState: processingState,
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
    const key = iso_(d).slice(0,7);
    const values = {};
    scope.forEach(function (center) {
      values[center] = sumDevices_(records.filter(function (r) { return r.center === center && isOpenAt_(r, d < period.asOf ? d : period.asOf); }));
    });
    out.push({ key: key, label: 'T' + (d.getMonth() + 1), values: values });
  }
  return out;
}

function groupCount_(rows, keyFn) {
  const counts = {};
  rows.forEach(function (r) { const k = keyFn(r); counts[k] = (counts[k] || 0) + deviceQuantity_(r); });
  return Object.keys(counts).map(function (name) { return { name: name, count: counts[name] }; }).sort(function (a, b) { return b.count - a.count; });
}

function normalizeDeviceKey_(value) {
  return clean_(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function serialHash_(value) {
  const normalized = normalizeDeviceKey_(value);
  if (!normalized) return '';
  if (!runtimeSerialHashes_[normalized]) runtimeSerialHashes_[normalized] = serialSha256Key_(normalized);
  return runtimeSerialHashes_[normalized];
}

// FIPS 180-4 SHA-256 for normalized ASCII serials only, not authentication.
// Output stays exactly base64url(SHA256(serial)).slice(0,22).
function serialSha256Key_(value) {
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const bytes = Array.from(value, function (c) { return c.charCodeAt(0); });
  const bits = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
  const rotate = function (n, b) { return (n >>> b) | (n << (32 - b)); };
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) { const at = offset + i * 4; w[i] = (bytes[at] << 24) | (bytes[at+1] << 16) | (bytes[at+2] << 8) | bytes[at+3]; }
    for (let i = 16; i < 64; i++) { const s0 = rotate(w[i-15],7) ^ rotate(w[i-15],18) ^ (w[i-15] >>> 3), s1 = rotate(w[i-2],17) ^ rotate(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0; }
    let a=state[0],b=state[1],c=state[2],d=state[3],e=state[4],f=state[5],g=state[6],h=state[7];
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e,6) ^ rotate(e,11) ^ rotate(e,25), choose = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choose + k[i] + w[i]) | 0;
      const s0 = rotate(a,2) ^ rotate(a,13) ^ rotate(a,22), majority = (a & b) ^ (a & c) ^ (b & c), t2 = (s0 + majority) | 0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    const next = [a,b,c,d,e,f,g,h];
    for (let i = 0; i < 8; i++) state[i] = (state[i] + next[i]) | 0;
  }
  const digest = [];
  state.forEach(function (word) { for (let i = 3; i >= 0; i--) digest.push((word >>> (i * 8)) & 255); });
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let encoded = '';
  for (let i = 0; i < digest.length; i += 3) {
    const n = (digest[i] << 16) | ((digest[i+1] || 0) << 8) | (digest[i+2] || 0);
    encoded += alphabet[(n >>> 18) & 63] + alphabet[(n >>> 12) & 63];
    if (i+1 < digest.length) encoded += alphabet[(n >>> 6) & 63];
    if (i+2 < digest.length) encoded += alphabet[n & 63];
  }
  return encoded.slice(0,22);
}

function groupModelDeviceStats_(rows) {
  const groups = {};
  rows.forEach(function (r) {
    const name = r.model || (r.fanLot ? 'Fan theo lô' : r.deviceType ? r.deviceType + ' | chưa có model' : 'Chưa xác định');
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
// This card measures received physical units by model, independently of case KPIs.
function modelDistributionQuantity_(r) {
  if(!/^fan$/i.test(clean_(r.deviceType)))return deviceQuantity_(r);
  if(r.fanLot)return Number(r.fanLot.totals.received)||0;
  if(r.modelQuantity!==undefined)return knownQuantity_(r.modelQuantity)||0;
  return deviceQuantity_(r); // A historical source row represents one Fan.
}
function modelDistributionLabel_(r) {
  if(/^fan$/i.test(clean_(r.deviceType))){const model=clean_(r.model);return 'Fan | '+(!model||/^fan$/i.test(model)?'Chưa xác định model':model);}
  return r.model || (r.deviceType ? r.deviceType+' | chưa có model' : 'Chưa xác định');
}
function groupModelTypes_(rows) {
  const groups = {};
  rows.forEach(function (r) {
    const type = r.deviceType || 'Chưa xác định';
    if (!groups[type]) groups[type] = { count: 0, models: {} };
    const entries=r.fanLot&&Array.isArray(r.fanLot.lines) ? r.fanLot.lines.map(function(l){return {name:modelDistributionLabel_({deviceType:r.deviceType,model:l.fanModel||r.model}),quantity:l.quantity};}) : [{name:modelDistributionLabel_(r),quantity:modelDistributionQuantity_(r)}];
    entries.forEach(function(e){groups[type].count+=e.quantity;groups[type].models[e.name]=(groups[type].models[e.name]||0)+e.quantity;});
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

function groupConfirmedIssueCategories_(rows) {
  const counts = {};
  const labels = {};
  rows.forEach(function (record) {
    if(record.fanLot){const categories={};(record.fanIssues||[]).forEach(function(i){if(!i.name||!i.lineId||!Number.isSafeInteger(i.quantity)||i.quantity<1)return;const issueName=typeof SungrowIssueCatalog!=='undefined'?SungrowIssueCatalog.normalize(i.name):clean_(i.name),category=/\bfan\b|quạt/i.test(issueName)?'Lỗi quạt':issueName,key=category.toLocaleLowerCase('vi'),line=record.fanLot.lines.find(function(l){return l.lineId===i.lineId;});if(!line)return;if(!categories[key])categories[key]={label:category,lines:{}};categories[key].lines[i.lineId]=Math.min(line.quantity,(categories[key].lines[i.lineId]||0)+i.quantity);});Object.keys(categories).forEach(function(k){counts[k]=(counts[k]||0)+Object.keys(categories[k].lines).reduce(function(n,id){return n+categories[k].lines[id];},0);labels[k]=categories[k].label;});return;}
    const issues = (record.issues || []).map(function (name) { return typeof SungrowIssueCatalog!=='undefined'?SungrowIssueCatalog.normalize(name):clean_(name).replace(/\s+/g, ' '); }).filter(Boolean);
    const hasFanIssue = issues.some(function (name) { return /\bfan\b|quạt/i.test(name); });
    const categoriesForDevice = {};
    issues.forEach(function (name) {
      // Keep a temperature symptom with the fan category only when this device also has a fan issue.
      const category = /\bfan\b|quạt/i.test(name) || (hasFanIssue && /nhiệt\s*độ|quá\s*nhiệt/i.test(name)) ? 'Lỗi quạt' : name;
      const key = category.toLocaleLowerCase('vi');
      categoriesForDevice[key] = category;
    });
    Object.keys(categoriesForDevice).forEach(function (key) {
      counts[key] = (counts[key] || 0) + deviceQuantity_(record);
      labels[key] = categoriesForDevice[key];
    });
  });
  return Object.keys(counts).map(function (key) { return { name: labels[key], count: counts[key] }; })
    .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'vi'); }).slice(0, 10);
}

function historicalWarrantyStatus_(confirmation, status) {
  const values = [clean_(confirmation), clean_(status)];
  const statuses = ['Trong bảo hành', 'Ngoài bảo hành', 'Sửa làm hàng good', 'Chờ xác nhận'];
  for (let i = 0; i < values.length; i++) {
    const match = statuses.find(function (value) { return value.toLowerCase() === values[i].toLowerCase(); });
    if (match) return match;
  }
  return '';
}

function groupParts_(rows) {
  const counts = {};
  rows.forEach(function (r) { r.parts.forEach(function (p) { counts[p.pn] = (counts[p.pn] || 0) + p.qty; }); });
  return Object.keys(counts).map(function (pn) { return { pn: pn, quantity: counts[pn] }; }).sort(function (a, b) { return b.quantity - a.quantity; });
}

function centerRegistry_() {
  const custom = parseJsonProperty_(PropertiesService.getScriptProperties(), 'CENTERS_JSON', null);
  if (!Array.isArray(custom) || !custom.length) return DEFAULT_CENTERS;
  const registry = custom.slice();
  DEFAULT_CENTERS.forEach(function (center) {
    if (!registry.some(function (item) { return clean_(item.id).toLowerCase() === center.id || clean_(item.name).toLowerCase() === center.name.toLowerCase(); })) {
      registry.push(center);
    }
  });
  return registry;
}

function resolveCenter_(value, centers) {
  const input = clean_(value).toLowerCase();
  const found = centers.find(function (c) { return [c.name].concat(c.aliases || []).some(function (a) { return String(a).toLowerCase() === input; }); });
  return found ? found.name : (clean_(value) || 'Chưa xác định');
}

function recordInScope_(record, scope, includeUnassigned, centers) {
  if (scope.includes(record.center)) return true;
  if (!includeUnassigned) return false;
  const normalized = clean_(record.center).toLowerCase();
  return !centers.some(function (center) { return clean_(center.name).toLowerCase() === normalized; });
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
    sourceNo: get('No.', true), projectedCaseId: get('Mã hồ sơ', false), deviceType: get('Device Type', true), serialNumber: get('S/N', false), model: get('Model', false),
    receivedDate: get('Received date', true), distributor: get('Distributor', false), workshop: get('Where sent to Workshop', false),
    errorCode: get('Error Code', false), warrantyConfirmation: get('Warranty confirmation', false), warrantyStatus: get('Warranty Status', false),
    gsp: get('GSP', false) === undefined ? get('Column AD', false) : get('GSP', false), ma: get('MA', false),
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

function slaAverages_(rows) {
  let quantity=0,actualTotal=0,netTotal=0;
  rows.forEach(function(r){const q=deviceQuantity_(r);if(!validReturn_(r)||!q)return;const actual=ageDays_(r.receivedDate,r.returnDate),ranges=[];
    (r.holds||[]).forEach(function(h){const a=date_(h.start),b=h.end?date_(h.end):r.returnDate;if(!a||!b||b<a)return;const lo=Math.max(time_(r.receivedDate),time_(a)),hi=Math.min(time_(r.returnDate),time_(b));if(hi>lo)ranges.push([lo,hi]);});
    ranges.sort(function(a,b){return a[0]-b[0];});const union=[];ranges.forEach(function(pair){const last=union[union.length-1];if(last&&pair[0]<=last[1])last[1]=Math.max(last[1],pair[1]);else union.push(pair.slice());});
    const paused=Math.min(actual,union.reduce(function(sum,p){return sum+ageDays_(new Date(p[0]),new Date(p[1]));},0));quantity+=q;actualTotal+=actual*q;netTotal+=(actual-paused)*q;
  });
  if(!quantity)return {actual:null,net:null,paused:null};const round=function(v){return Math.round(v*10)/10;};return {actual:round(actualTotal/quantity),net:round(netTotal/quantity),paused:round((actualTotal-netTotal)/quantity)};
}

function normalizePeriod_(value) {
  const now = new Date();
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(String(value || ''));
  if (range) {
    // Range inputs are Vietnam calendar days, not UTC date-only timestamps.
    const start = new Date(range[1] + 'T00:00:00+07:00'), last = new Date(range[2] + 'T00:00:00+07:00');
    if (!start || !last || iso_(start) !== range[1] || iso_(last) !== range[2] || start > last || start.getFullYear() < FIRST_REPORT_YEAR || last > new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999)) throw apiError_('INVALID_PERIOD','Khoảng ngày không hợp lệ.');
    const end = new Date(range[2] + 'T23:59:59.999+07:00');
    return {year:start.getFullYear(),month:start.getMonth(),isYear:false,isRange:true,start:start,end:end,asOf:now<end?now:end,key:range[0],label:range[1].split('-').reverse().join('/')+'–'+range[2].split('-').reverse().join('/')};
  }
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
  return { year: year, month: month, isYear: false, start: start, end: end, asOf: asOf, key: iso_(start).slice(0,7), label: 'Tháng ' + String(month + 1).padStart(2, '0') + '/' + year };
}

function previousPeriod_(period) { if(period.isRange){const a=new Date(period.start),b=new Date(period.end);a.setDate(1);a.setMonth(a.getMonth()-1);const last=new Date(a.getFullYear(),a.getMonth()+1,0).getDate();a.setDate(Math.min(period.start.getDate(),last));b.setDate(1);b.setMonth(b.getMonth()-1);b.setDate(Math.min(period.end.getDate(),new Date(b.getFullYear(),b.getMonth()+1,0).getDate()));return Object.assign({},period,{start:a,end:b,asOf:b,key:iso_(a)+'..'+iso_(b)});} return period.isYear ? normalizePeriod_(String(period.year - 1)) : normalizePeriod_(iso_(new Date(period.year, period.month - 1, 1)).slice(0,7)); }
function inPeriod_(date, period) { return date && date >= period.start && date <= period.end && (!period.asOf || date <= period.asOf); }
function inYear_(date, year) { return !!date && date.getFullYear() === year; }
// Delivered without a valid return date has unknown historical stock, not an invented open date.
function isOpenAt_(r, date) { return !!r.receivedDate && r.receivedDate <= date && !(validReturn_(r) && r.returnDate <= date) && !(/đã\s*giao/i.test(r.deliveryStatus) && !validReturn_(r)); }
function knownQuantity_(value) { const n = Number(value); return isFinite(n) && n > 0 && Math.floor(n) === n ? n : null; }
function fanPhysicalSummary_(records,period) {
  const out={lots:0,received:0,technicalCompleted:0,returned:0,remaining:0,waiting:0,completedToDate:0,returnedToDate:0};
  records.forEach(function(r){if(!r.fanLot||!r.receivedDate||r.receivedDate>period.asOf)return;out.lots++;const qty=r.fanLot.totals.received;let done=0,returned=0;if(inPeriod_(r.receivedDate,period))out.received+=qty;
    (r.fanLot.events||[]).forEach(function(e){const d=date_(e.date);if(!d||d>period.asOf)return;if(e.kind==='technical'){done+=e.quantity;if(inPeriod_(d,period))out.technicalCompleted+=e.quantity;}if(e.kind==='return'){returned+=e.quantity;if(inPeriod_(d,period))out.returned+=e.quantity;}});
    out.completedToDate+=done;out.returnedToDate+=returned;out.remaining+=qty-returned;out.waiting+=done-returned;
  });return out;
}
function deviceQuantity_(r) { return knownQuantity_(r.quantity) || (r.sourceType === 'Dữ liệu lịch sử' && r.quantity === undefined ? 1 : 0); }
function sumDevices_(rows) { return rows.reduce(function (sum, r) { return sum + deviceQuantity_(r); }, 0); }
function latestDate_(values) { const dates = values.map(date_).filter(Boolean); return dates.length ? new Date(Math.max.apply(null, dates.map(time_))) : null; }
function validReturn_(r) { return !!r.receivedDate && !!r.returnDate && r.returnDate >= r.receivedDate; }
function validTechnicalDate_(r) { return !!r.receivedDate && !!r.technicalCompletedDate && r.technicalCompletedDate >= r.receivedDate && (!validReturn_(r) || r.technicalCompletedDate <= r.returnDate); }
// Technical completion alone does not prove ready-to-return after a transfer.
function isWaitingAt_(r, asOf) { if(r.fanLot){if(!isOpenAt_(r,asOf))return false;let waiting=0;(r.fanLot.events||[]).forEach(function(e){const d=date_(e.date);if(d&&d<=asOf)waiting+=(e.kind==='technical'?e.quantity:e.kind==='return'?-e.quantity:0);});return waiting>0;} const ready = r.readyDate; return isOpenAt_(r, asOf) && !!ready && ready >= r.receivedDate && ready <= asOf && (!validReturn_(r) || ready <= r.returnDate); }
function groupPartsForPeriod_(records, period, scope) {
  const counts = {};
  records.forEach(function (r) { (r.parts || []).forEach(function (p) {
    if (!p.pn || !p.qty || !scope.includes(p.center || r.center) || !inPeriod_(date_(p.usedDate), period)) return;
    counts[p.pn] = (counts[p.pn] || 0) + p.qty;
  }); });
  return Object.keys(counts).map(function (pn) { return { pn: pn, quantity: counts[pn] }; }).sort(function (a, b) { return b.quantity - a.quantity; });
}
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
    const text = value.trim().replace(/^B1(?=\d{1,2}-[A-Za-z]{3}-\d{2,4}$)/, '');
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (dmy) {
      const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      return date.getFullYear() === Number(dmy[3]) && date.getMonth() === Number(dmy[2]) - 1 && date.getDate() === Number(dmy[1]) ? date : null;
    }
    const parsed = new Date(text);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
function time_(value) { return value ? value.getTime() : 0; }
function iso_(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  if (!runtimeTimeZone_) runtimeTimeZone_ = Session.getScriptTimeZone();
  const timezone = runtimeTimeZone_;
  const offset = /^(Asia\/(Saigon|Ho_Chi_Minh|Bangkok)|Etc\/GMT-7)$/.test(timezone) ? 7 * 3600000 : /^(UTC|Etc\/UTC|GMT)$/.test(timezone) ? 0 : null;
  if (offset !== null && date.getUTCFullYear() >= 1976) return new Date(date.getTime() + offset).toISOString().slice(0,10);
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
}
function clean_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function number_(value) { const n = Number(value); return isFinite(n) && n > 0 ? n : 1; }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).slice(0, 40); }
function safeCacheGet_(cache, key) {
  try {
    const stored = cache.get(key);
    if (!stored) return null;
    if (stored === 'shared:v3') return typeof readPortalChunkedCache_ === 'function' ? readPortalChunkedCache_(cache, key) : null;
    if (stored.indexOf('chunks:') !== 0) return JSON.parse(stored);
    const count = Number(stored.slice(7));
    if (!Number.isInteger(count) || count < 1 || count > 250) return null;
    const keys = Array.from({length: count}, function (_, index) { return key + ':part:' + index; });
    const chunks = cache.getAll(keys);
    if (keys.some(function (partKey) { return !chunks[partKey]; })) return null;
    return JSON.parse(keys.map(function (partKey) { return chunks[partKey]; }).join(''));
  } catch (error) {
    console.warn('Dashboard cache read skipped: ' + String(error && error.message || error));
    return null;
  }
}
function safeCachePut_(cache, key, value, ttl) {
  try {
    const serialized = JSON.stringify(value);
    if (Utilities.newBlob(serialized).getBytes().length <= 95000) {
      cache.put(key, serialized, ttl);
      return;
    }
    // CacheService limits each value to 100 KB. Split the response so large dashboards can still be cached.
    if (typeof writePortalChunkedCache_ === 'function' && writePortalChunkedCache_(cache, key, value, ttl)) {
      cache.put(key, 'shared:v3', ttl);
      return;
    }
    const parts = serialized.match(/[\s\S]{1,15000}/g) || [];
    if (!parts.length || parts.length > 250) return;
    const entries = {};
    parts.forEach(function (part, index) { entries[key + ':part:' + index] = part; });
    cache.putAll(entries, ttl);
    cache.put(key, 'chunks:' + parts.length, ttl);
  } catch (error) {
    console.warn('Dashboard cache skipped: ' + String(error && error.message || error));
  }
}
function parseJson_(value) { if (!value) return null; try { return JSON.parse(value); } catch (_) { return null; } }
function parseJsonProperty_(props, key, fallback) { const value = parseJson_(props.getProperty(key)); return value === null ? fallback : value; }
function apiError_(code, message) { const e = new Error(code); e.code = code; e.publicMessage = message; return e; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function diagnoseReadPaths_(actor, period) {
  if (!actor || !actor.isGlobalManager || actor.role !== 'service_manager') throw apiError_('FORBIDDEN', 'Chỉ quản lý được chạy chẩn đoán.');
  const stages = [];
  function measure(name, read, summarize) {
    const started = Date.now();
    try { const data = read(); stages.push(Object.assign({ stage: name, ok: true, elapsedMs: Date.now() - started }, summarize(data))); }
    catch (error) { stages.push({ stage: name, ok: false, elapsedMs: Date.now() - started, error: String(error && error.message || error).slice(0,300) }); }
  }
  measure('dashboard-build', function () { return getDashboard_({ period: period, center: 'all', refresh: true }, actor); }, function (data) { return { visibleCases: data.cumulative.records, parts: data.parts.length, previewRows: data.tickets.length }; });
  measure('dashboard-cache', function () { return getDashboard_({ period: period, center: 'all' }, actor); }, function (data) { return { visibleCases: data.cumulative.records }; });
  measure('devices-build', function () { return pageTickets_({ page: 1, pageSize: 20 }, actor); }, function (data) { return { total: data.total, returnedRows: data.tickets.length }; });
  measure('devices-next-page', function () { return pageTickets_({ page: 2, pageSize: 20 }, actor); }, function (data) { return { total: data.total, returnedRows: data.tickets.length }; });
  return { version: LEGACY_API_VERSION, period: period, stages: stages };
}
function readReportData_(request, actor) {
  if (!actor || actor.isGlobalManager !== true) throw apiError_('FORBIDDEN','Chỉ quản lý toàn bộ trung tâm được xuất báo cáo.');
  if(request.schema===true){
    const registry=centerRegistry_(),revision=getPortalDatabaseRevision_();
    const spreadsheetId=String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID')||DEFAULT_SPREADSHEET_ID).trim();
    const records=readCanonicalSnapshot_(spreadsheetId,registry,revision).records.filter(function(r){return r.hasData;});
    const choices=function(field){return Array.from(new Set(records.map(function(r){return clean_(r[field]);}).filter(Boolean))).sort();};
    assertCanonicalRevision_(revision);
    return {centers:registry.map(function(c){return c.name;}),statuses:choices('status'),warrantyStatuses:choices('warrantyStatus'),deviceTypes:choices('deviceType')};
  }
  const type=String(request.type||'cases'),defs=REPORT_COLUMN_DEFS_[type];
  if (!Array.isArray(defs)) throw apiError_('INVALID_REPORT','Mẫu báo cáo không hợp lệ.');
  const basis=String(request.dateBasis||'received');
  if (['received','technical','returned','open'].indexOf(basis)<0) throw apiError_('INVALID_REPORT','Loại ngày không hợp lệ.');
  const columns=request.columns;
  if (!Array.isArray(columns)||!columns.length||columns.length>defs.length||new Set(columns).size!==columns.length||columns.some(function(key){return !defs.some(function(c){return c[0]===key;});})) throw apiError_('INVALID_REPORT','Chọn các cột báo cáo hợp lệ.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(request.start||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(request.end||'')))throw apiError_('INVALID_PERIOD','Chọn ngày bắt đầu và ngày kết thúc hợp lệ.');
  const period=normalizePeriod_(String(request.start)+'..'+String(request.end));
  if (period.start>period.asOf) throw apiError_('INVALID_PERIOD','Kỳ báo cáo chưa bắt đầu.');
  if (request.asOf) { const asOf=new Date(request.asOf);if(isNaN(asOf)||asOf>period.asOf||asOf<period.start)throw apiError_('INVALID_REPORT','Ngày chốt không hợp lệ.');period.asOf=asOf; }
  const centers=centerRegistry_(),all=centers.map(function(c){return c.name;});
  if (!Array.isArray(request.centers)||request.centers.some(function(c){return all.indexOf(c)<0;})) throw apiError_('INVALID_REPORT','Trung tâm báo cáo không hợp lệ.');
  const scope=request.centers.length?Array.from(new Set(request.centers)):all,includeUnassigned=!request.centers.length;
  const query=clean_(request.query).toLowerCase(),status=clean_(request.status),warranty=clean_(request.warrantyStatus),deviceType=clean_(request.deviceType);
  if(query.length>100||[status,warranty,deviceType].some(function(v){return v.length>2000;}))throw apiError_('INVALID_REPORT','Bộ lọc quá dài.');
  if(type==='centers'&&(query||status||warranty||deviceType))throw apiError_('INVALID_REPORT','Tổng hợp trung tâm chỉ lọc theo kỳ và trung tâm.');
  const offset=request.offset===undefined?0:Number(request.offset),size=request.limit===undefined?200:Number(request.limit);
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(size)||size<1||size>200)throw apiError_('INVALID_REPORT','Phân trang báo cáo không hợp lệ.');
  const revision=getPortalDatabaseRevision_();
  if(request.revision&&String(request.revision)!==revision)throw apiError_('REPORT_CHANGED','Dữ liệu đã thay đổi. Vui lòng xem trước và xuất lại báo cáo.');
  const spreadsheetId=String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID')||DEFAULT_SPREADSHEET_ID).trim();
  const snapshot=readCanonicalSnapshot_(spreadsheetId,centers,revision);
  const records=snapshot.records.filter(function(r){return r.hasData&&recordInScope_(r,scope,includeUnassigned,centers);});
  let selected;
  if(type==='centers'){
    const dashboard=buildDashboard_(records,period,scope,snapshot.sheetName,snapshot.lastRow,spreadsheetId,{role:'service_manager',email:actor.email},[],records);
    selected=dashboard.centers.map(function(c){const local=records.filter(function(r){return c.unassigned?scope.indexOf(r.center)<0:r.center===c.center;});return Object.assign({},c,{returned:c.completed,technicalCompleted:sumDevices_(local.filter(function(r){return validTechnicalDate_(r)&&inPeriod_(r.technicalCompletedDate,period);})),waitingDelivery:sumDevices_(local.filter(function(r){return isWaitingAt_(r,period.asOf);} ))});});
  }else{
    selected=records.filter(function(r){
      const within=basis==='open'?isOpenAt_(r,period.asOf):basis==='technical'?validTechnicalDate_(r)&&inPeriod_(r.technicalCompletedDate,period):basis==='returned'?validReturn_(r)&&inPeriod_(r.returnDate,period):inPeriod_(r.receivedDate,period);
      return within&&(!status||r.status===status)&&(!warranty||r.warrantyStatus===warranty)&&(!deviceType||r.deviceType===deviceType)&&(!query||[r.id,r.model,r.serialNumber,(r.relatedSerials||[]).join(' '),(r.relatedCaseIds||[]).join(' ')].join(' ').toLowerCase().indexOf(query)>=0);
    });
    selected.sort(function(a,b){const delta=time_(b.receivedDate)-time_(a.receivedDate);return delta||(String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);});
  }
  if(selected.length>20000)throw apiError_('REPORT_TOO_LARGE','Báo cáo vượt 20.000 dòng. Hãy thu hẹp bộ lọc.');
  const knownDevices=type==='cases'?sumDevices_(selected):null;
  const unknownQuantityCases=type==='cases'?selected.filter(function(r){return r.quantity===null||r.quantity===undefined;}).length:null;
  const contacts={};
  if(type==='cases'&&columns.some(function(c){return /^customer/.test(c);}))readTableShared_('Hồ sơ thiết bị',revision,false).forEach(function(c){contacts[clean_(c['Mã hồ sơ'])]=c;});
  const rows=selected.slice(offset,offset+size).map(function(r){
    const customer=contacts[r.id]||{};
    const values=type==='cases'?Object.assign({},r,{caseId:r.id,fanQuantity:r.fanLot?r.fanLot.totals.received:null,fanCompleted:r.fanLot?fanPhysicalSummary_([r],period).completedToDate:null,fanReturned:r.fanLot?fanPhysicalSummary_([r],period).returnedToDate:null,caseKind:r.fanLot?'Fan theo lô':'Thông thường',receivedAt:iso_(r.receivedDate),technicalAt:iso_(r.technicalCompletedDate),returnedAt:iso_(r.returnDate),processingDays:!r.receivedDate||(/đã\s*giao/i.test(r.deliveryStatus)&&!validReturn_(r))?null:ageDays_(r.receivedDate,validReturn_(r)&&r.returnDate<=period.asOf?r.returnDate:period.asOf),customerName:clean_(customer['Tên khách hàng']),customerPhone:clean_(customer['Số điện thoại khách hàng']),customerEmail:clean_(customer['Email khách hàng']),customerAddress:clean_(customer['Địa chỉ khách hàng'])}):r;
    const row={};columns.forEach(function(key){row[key]=values[key]===undefined?null:values[key];});return row;
  });
  assertCanonicalRevision_(revision);
  const spec={type:type,start:iso_(period.start),end:iso_(period.end),asOf:period.asOf.toISOString(),dateBasis:basis,centers:request.centers.slice().sort(),columns:columns.slice(),query:query,status:status,warrantyStatus:warranty,deviceType:deviceType};
  return {rows:rows,total:selected.length,knownDevices:knownDevices,unknownQuantityCases:unknownQuantityCases,offset:offset,nextOffset:offset+rows.length<selected.length?offset+rows.length:null,revision:revision,asOf:spec.asOf,fingerprint:digest_(JSON.stringify(spec)),spec:spec,columns:columns.map(function(key){const c=defs.find(function(d){return d[0]===key;});return {key:c[0],label:c[1],type:c[2]};}),definitions:['Hồ sơ: một dòng mỗi lượt tiếp nhận; không gộp theo S/N.','Thiết bị/Hồ sơ: Fan nhập thường tính 1 thiết bị; mỗi lô Fan tính 1 hồ sơ, kể cả lô chuyển đổi. Các loại thiết bị khác giữ số lượng đã biết. Số Fan thực tế ở chi tiết lô; hồ sơ nguồn đã nhập lô không cộng thêm.','Tồn tính tại ngày chốt, gồm hồ sơ tiếp nhận trước kỳ.','Trung tâm/trạng thái/bảo hành là thông tin hiện tại hoặc chặng gần nhất, không tái dựng lịch sử từng ngày.','SLA dùng ngày nhận–trả hợp lệ, trọng số thiết bị; bảng tổng hợp giữ quy tắc dashboard.'],generatedAt:new Date().toISOString()};
}
if (typeof installReportReader_==='function') installReportReader_(readReportData_);
return { handlePost: doPost, readDiagnostics: diagnoseReadPaths_ };
})();

function doPost(e) {
  return LEGACY_DASHBOARD_API.handlePost(e);
}

// Release capability checked before legacy-source conversion.
LEGACY_DASHBOARD_API.fanLegacyKpiReady = true;

LEGACY_DASHBOARD_API.fanSharedFormsReady = true;

// Bootstrap refuses line-model writes if this reader is not installed.
LEGACY_DASHBOARD_API.fanModels = true;

LEGACY_DASHBOARD_API.systemCorrections = true;
