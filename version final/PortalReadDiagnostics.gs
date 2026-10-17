/** Editor-only diagnostics: no Sheet writes or customer data in output. */
function portalReadDiagnosticActor_() {
  const email = clean_(Session.getActiveUser().getEmail()).toLowerCase();
  const users = readTableWithRows_(SHEETS.users).rows.filter(function (row) { return clean_(row['Email Google']).toLowerCase() === email && bool_(row['Đang hoạt động']); });
  if (!email || users.length !== 1) throw Error('Chạy bằng tài khoản quản lý trong Apps Script Editor.');
  const role = resolveRole_(users[0]['Vai trò'], users[0]['Trung tâm']);
  if (!role.isGlobalManager) throw Error('Chỉ quản lý toàn hệ thống được chạy chẩn đoán.');
  return { email: email, role: role.code, isGlobalManager: true, centers: CENTERS.slice(), capabilities: role.capabilities };
}
function diagnosePortalReadPath() {
  const actor = portalReadDiagnosticActor_();
  const report = { version: APP_VERSION, scriptTimeZone: Session.getScriptTimeZone(), observedAt: new Date().toISOString(), writtenToDatabase: false, stages: [] };
  function stage(name, work) {
    const started = Date.now();
    try { const details = work() || {}; const result = Object.assign({ stage: name, ok: true, elapsedMs: Date.now() - started }, details); report.stages.push(result); console.log(JSON.stringify(result)); }
    catch (error) { const result = { stage: name, ok: false, elapsedMs: Date.now() - started, error: String(error && error.message || error).slice(0,300) }; report.stages.push(result); console.log(JSON.stringify(result)); }
  }
  stage('gzip-direct-roundtrip', function () {
    const expected = JSON.stringify({ text: 'Kiểm tra UTF-8 bảo hành Việt Nam', records: 15 });
    const bytes = Utilities.gzip(Utilities.newBlob(expected, 'application/json')).getBytes();
    const actual = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(Utilities.base64Encode(bytes)), 'application/gzip', 'probe.json.gz')).getDataAsString('UTF-8');
    if (actual !== expected) throw Error('Gzip roundtrip không khớp.');
    return { byteCount: bytes.length };
  });
  stage('shared-cache-codec', function () {
    const cache = CacheService.getScriptCache(), key = 'portal-read-probe-' + Utilities.getUuid();
    const expected = { h: ['value'], d: [[2, 'Dữ liệu kiểm tra '.repeat(250)]] };
    if (!writePortalChunkedCache_(cache, key, expected, 60)) throw Error('Không ghi được cache probe.');
    const actual = readPortalChunkedCache_(cache, key);
    if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Cache codec đọc lại không khớp hoặc bị miss.');
    return { chunkCount: Number(cache.get(key + ':count')) };
  });
  const revision = getPortalDatabaseRevision_();
  report.revision = revision;
  stage('index-cache-before', function () {
    const cache = CacheService.getScriptCache(), key = 'portal-table-v3-' + digest_(SHEETS.caseIndex + '|' + revision);
    const packed = readPortalChunkedCache_(cache, key);
    const lease = parseJson_(PropertiesService.getScriptProperties().getProperty('PORTAL_TABLE_LEASE_' + digest_(SHEETS.caseIndex)));
    return { hit: Boolean(packed), chunkCount: Number(cache.get(key + ':count')) || 0, leaseAgeMs: lease ? Date.now() - Number(lease.startedAt) : null, sameRevisionLease: Boolean(lease && lease.revision === revision) };
  });
  for (let pass = 1; pass <= 2; pass++) {
    stage('index-read-' + pass, function () { const rows = readPortalCaseIndex_(revision); return { indexedRows: rows.length, stale: Boolean(rows.__cacheStale) }; });
  }
  stage('page-from-index', function () { const page = listCasesUncached_('', { page: 1, pageSize: 20, sortOrder: 'newest' }, actor, revision); return { total: page.total, returnedRows: page.items.length, stale: Boolean(page.stale), phasesMs: page.phasesMs || null }; });
  stage('revision-after', function () { const latest = getPortalDatabaseRevision_(); return { unchanged: latest === revision }; });
  console.log('PORTAL_READ_DIAGNOSTICS ' + JSON.stringify(report));
  return report;
}

function diagnoseWebReadPaths() {
  const actor = portalReadDiagnosticActor_();
  const period = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  const report = LEGACY_DASHBOARD_API.readDiagnostics(actor, period);
  report.writtenToDatabase = false;
  report.observedAt = new Date().toISOString();
  const detailStarted = Date.now();
  try {
    const index = readPortalCaseIndex_(getPortalDatabaseRevision_());
    const candidate = index.find(function (row) { return clean_(row['Mã hồ sơ']) && clean_(row['Trạng thái hồ sơ']) !== 'Đã hủy'; });
    if (candidate) {
      const detail = getCaseDetailForActor_(actor, clean_(candidate['Mã hồ sơ']));
      report.stages.push({ stage: 'case-detail', ok: true, elapsedMs: Date.now() - detailStarted, workOrders: (detail.workOrders || []).length });
    } else report.stages.push({ stage: 'case-detail', ok: true, elapsedMs: Date.now() - detailStarted, empty: true });
  } catch (error) { report.stages.push({ stage: 'case-detail', ok: false, elapsedMs: Date.now() - detailStarted, error: String(error && error.message || error).slice(0,300) }); }
  if (typeof buildManagerDashboardForActor_ === 'function') {
    const started = Date.now();
    try {
      const parts = period.split('-');
      const data = buildManagerDashboardForActor_(actor, { year: Number(parts[0]), month: Number(parts[1]) });
      report.stages.push({ stage: 'manager-direct', ok: true, elapsedMs: Date.now() - started, attentionRows: data.attention.length });
    } catch (error) { report.stages.push({ stage: 'manager-direct', ok: false, elapsedMs: Date.now() - started, error: String(error && error.message || error).slice(0,300) }); }
  }
  console.log('WEB_READ_DIAGNOSTICS ' + JSON.stringify(report));
  return report;
}
