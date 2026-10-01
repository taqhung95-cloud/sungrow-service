import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const readDocs = name => fs.readFileSync(path.resolve(root, '..', 'docs', name), 'utf8');

for (const file of ['Code.gs', 'ManagerDashboard.gs', 'LegacyDashboardApi.gs']) {
  new vm.Script(read(file), {filename:file});
}

const html = read('Index.html');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.ok(scripts.length, 'Index.html phải có script ứng dụng.');
scripts.forEach((source, index) => {
  const normalized = source.replace(/<\?[\s\S]*?\?>/g, '"template-value"');
  new vm.Script(normalized, {filename:`Index.inline.${index + 1}.js`});
});

const entryHtml = readDocs('entry.html');
const entryScripts = [...entryHtml.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.ok(entryScripts.length, 'docs/entry.html phải có script ứng dụng.');
entryScripts.forEach((source, index) => new vm.Script(source, {filename:`docs.entry.inline.${index + 1}.js`}));

const dashboardSource = read('ManagerDashboard.gs');
const tables = {
  'Hồ sơ thiết bị': [
    {'Mã hồ sơ':'HS-1','Số sê-ri (S/N)':'SN-1','Model':'SG110CX','Số lượng':2,'Trung tâm tiếp nhận khách':'Sungrow Service Center','Ngày nhận từ khách':new Date('2026-09-01'),'Trung tâm đang giữ hàng':'Sungrow Service Center','Trạng thái hồ sơ':'Đã hoàn tất','Tình trạng bảo hành':'Trong bảo hành','Ngày trả khách':new Date('2026-09-05'),'Ngày cập nhật gần nhất':new Date('2026-09-05')},
    {'Mã hồ sơ':'HS-2','Số sê-ri (S/N)':'SN-2','Model':'SG33CX','Số lượng':1,'Trung tâm tiếp nhận khách':'DAT Center','Ngày nhận từ khách':new Date('2026-09-01'),'Trung tâm đang giữ hàng':'DAT Center','Trạng thái hồ sơ':'Đang xử lý','Tình trạng bảo hành':'Chờ xác nhận','Ngày cập nhật gần nhất':new Date('2026-09-15')}
  ],
  'Công việc trung tâm': [
    {'Mã hồ sơ':'HS-1','Trung tâm xử lý':'Sungrow Service Center','Ngày hoàn tất kỹ thuật':new Date('2026-09-04'),'Kết quả xử lý':'Đã sửa chữa','Trạng thái xử lý':'Hoàn tất kỹ thuật'},
    {'Mã hồ sơ':'HS-2','Trung tâm xử lý':'DAT Center','Trạng thái xử lý':'Đang kiểm tra'}
  ]
};

const sandbox = {
  console,
  APP_VERSION:'test',
  SHEETS:{cases:'Hồ sơ thiết bị',workOrders:'Công việc trung tâm'},
  CENTERS:['Sungrow Service Center','DAT Center'],
  authenticate_:token => token === 'manager' ? {isGlobalManager:true} : {isGlobalManager:false},
  readTable_:name => tables[name] || [],
  groupBy_:(rows, field) => rows.reduce((out, row) => ((out[row[field]] ||= []).push(row), out), {}),
  asDate_:value => value ? new Date(value) : null,
  clean_:value => value == null ? '' : String(value).trim(),
  senderFromCase_:() => '',
  publicError_:message => new Error(message),
  Utilities:{formatDate:date => date.toISOString().slice(0,10)},
  Session:{getScriptTimeZone:() => 'Asia/Ho_Chi_Minh'}
};
vm.createContext(sandbox);
vm.runInContext(dashboardSource, sandbox);

assert.throws(() => sandbox.getManagerDashboard('center', {year:2026,month:9}), /không có quyền/i);
const result = sandbox.getManagerDashboard('manager', {year:2026,month:9});
assert.equal(result.kpis.received, 3, 'KPI tiếp nhận phải cộng Số lượng.');
assert.equal(result.kpis.technicalCompleted, 2, 'KPI kỹ thuật phải dùng ngày hoàn tất kỹ thuật.');
assert.equal(result.kpis.returned, 2, 'KPI đã trả phải cộng Số lượng.');
assert.equal(result.kpis.openAtEnd, 1, 'Tồn cuối kỳ phải loại hồ sơ đã trả.');
assert.equal(result.kpis.pendingWarranty, 1, 'Phải nhận diện hồ sơ chờ bảo hành.');
assert.equal(result.kpis.slaRate, 100, 'SLA phải tính theo số lượng và khoảng nhận–trả.');

assert.match(html, /id="dashboardTab" class="tab hidden"/, 'Dashboard phải ẩn mặc định.');
assert.match(html, /data\.actor\.isGlobalManager\?'dashboard':'cases'/, 'Điểm vào phải phụ thuộc role.');
assert.match(dashboardSource, /assertManagerDashboardAccess_\(actor\)/, 'API dashboard phải có server-side guard.');
const codeSource = read('Code.gs');
const extractFunction = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Không tìm thấy hàm ${name}.`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Hàm ${name} không đóng ngoặc.`);
};
let validationValues = ['Mới tiếp nhận','Đang xử lý','Đã hoàn tất'];
let validationWrites = 0;
const validationSandbox = {
  SHEETS:{cases:'cases'}, publicError_:message=>new Error(message),
  SpreadsheetApp:{DataValidationCriteria:{VALUE_IN_LIST:'list',VALUE_IN_RANGE:'range'}},
  spreadsheet_:()=>({getSheetByName:()=>({getRange:(row,column)=>{
    assert.equal(row,1522); assert.equal(column,2);
    return {getDataValidation:()=>({getCriteriaType:()=> 'list',getCriteriaValues:()=>[validationValues,false],copy:()=>({requireValueInList:(values,visible)=>{assert.equal(visible,false);return {build:()=>values}}})}),setDataValidation:values=>{validationValues=values;validationWrites++}};
  }})})
};
vm.createContext(validationSandbox);
vm.runInContext(extractFunction(codeSource,'allowListValidationValue_'),validationSandbox);
vm.runInContext(extractFunction(codeSource,'allowCancelledCaseStatus_'),validationSandbox);
vm.runInContext(extractFunction(codeSource,'allowHistoricalWarrantyStatus_'),validationSandbox);
validationSandbox.allowCancelledCaseStatus_(['Mã hồ sơ','Trạng thái hồ sơ'],1522);
assert.equal(JSON.stringify(validationValues),JSON.stringify(['Mới tiếp nhận','Đang xử lý','Đã hoàn tất','Đã hủy']));
validationSandbox.allowCancelledCaseStatus_(['Mã hồ sơ','Trạng thái hồ sơ'],1522);
assert.equal(validationWrites,1,'Validation migration must be idempotent');
assert.ok(codeSource.indexOf('allowCancelledCaseStatus_(headers, record.__rowNumber)') < codeSource.indexOf('updateObjectRow_(SHEETS.cases, headers, record.__rowNumber, changes)'));
validationValues = ['Trong bảo hành','Ngoài bảo hành','Chờ xác nhận'];
validationSandbox.allowHistoricalWarrantyStatus_(['Mã hồ sơ','Tình trạng bảo hành'],1522,'Sửa làm hàng good');
assert.equal(JSON.stringify(validationValues),JSON.stringify(['Trong bảo hành','Ngoài bảo hành','Chờ xác nhận','Sửa làm hàng good']));
validationSandbox.allowHistoricalWarrantyStatus_(['Mã hồ sơ','Tình trạng bảo hành'],1522,'Sửa làm hàng good');
assert.equal(validationWrites,2,'Warranty validation migration must be idempotent');
assert.ok(codeSource.indexOf("allowHistoricalWarrantyStatus_(table.headers, record.__rowNumber, warrantyStatus)") < codeSource.indexOf('updateObjectRow_(SHEETS.cases, table.headers, record.__rowNumber, changes)'));
assert.ok(codeSource.indexOf("if (changes['Tình trạng bảo hành']) allowHistoricalWarrantyStatus_(cases.headers, record.__rowNumber, expected)") < codeSource.indexOf('updateObjectRow_(SHEETS.cases,cases.headers,record.__rowNumber,changes)'));
const roleConstants = codeSource.slice(codeSource.indexOf('const ROLE_CODES'), codeSource.indexOf('function doGet'));
const roleSandbox = {
  Object,
  clean_:value => value == null ? '' : String(value).trim(),
  publicError_:message => new Error(message),
  SUNGROW_CENTER:'Sungrow Service Center',
  CENTERS:['Sungrow Service Center','XBSolar Center','DAT Center','BKE Center','JGP Center']
};
vm.createContext(roleSandbox);
vm.runInContext(`${roleConstants}\n${extractFunction(codeSource,'resolveRole_')}\n${extractFunction(codeSource,'hasCapability_')}\n${extractFunction(codeSource,'assertCapability_')}\nthis.resolveRole_=resolveRole_;this.hasCapability_=hasCapability_;this.assertCapability_=assertCapability_;`, roleSandbox);
const serviceManagerRole = roleSandbox.resolveRole_('service_manager','');
assert.equal(serviceManagerRole.isGlobalManager,true,'service_manager phải có phạm vi toàn hệ thống.');
assert.equal(serviceManagerRole.capabilities.viewDashboard,true,'service_manager phải xem được dashboard.');
const sungrowManagerRole = roleSandbox.resolveRole_('Quản lý trung tâm','Sungrow Service Center');
assert.equal(sungrowManagerRole.code,'service_manager','Quản lý Sungrow phải được nâng thành service_manager.');
assert.equal(sungrowManagerRole.isGlobalManager,true,'Quản lý Sungrow phải được xem dashboard tổng thể.');
const datManagerRole = roleSandbox.resolveRole_('center_manager','DAT Center');
assert.equal(datManagerRole.isGlobalManager,false,'Quản lý DAT không được có phạm vi toàn hệ thống.');
assert.equal(datManagerRole.capabilities.createTransfer,true,'Quản lý center phải được luân chuyển thiết bị.');
const staffRole = roleSandbox.resolveRole_('Nhân viên trung tâm','DAT Center');
assert.equal(staffRole.capabilities.createCase,true,'Nhân viên center phải tiếp nhận được hồ sơ.');
assert.equal(staffRole.capabilities.updateWorkOrder,true,'Nhân viên center phải cập nhật được công việc.');
assert.equal(staffRole.capabilities.acceptTransfer,true,'Nhân viên center phải xác nhận được hàng đến.');
assert.equal(staffRole.capabilities.createTransfer,false,'Nhân viên center không được chủ động luân chuyển.');
assert.equal(staffRole.capabilities.returnToCustomer,true,'Nhân viên center phải cập nhật được giao trả khách.');
assert.equal(staffRole.capabilities.approveWarranty,false,'Nhân viên center không được xác nhận bảo hành.');
assert.throws(() => roleSandbox.resolveRole_('admin tùy ý','DAT Center'),/không hợp lệ/i,'Role không nhận diện phải bị từ chối.');
assert.match(codeSource, /1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/, 'Code phải trỏ tới database production.');
assert.match(codeSource, /1\.10\.2-ticket-coverage/, 'Code phải khai báo đúng version triển khai mới.');
assert.match(extractFunction(codeSource,'authenticate_'), /cache\.put\(cacheKey, JSON\.stringify\(actor\), 300\)/, 'Xác thực người dùng phải được cache 5 phút để không đọc tab Người dùng liên tục.');
const listCasesUncachedSource = extractFunction(codeSource,'listCasesUncached_');
assert.match(listCasesUncachedSource, /readPortalCaseIndex_\(revision\)/, 'Danh sách hồ sơ phải chỉ đọc chỉ mục nhẹ theo revision.');
assert.doesNotMatch(listCasesUncachedSource, /SHEETS\.(cases|workOrders|transfers|issues|parts|holds)/, 'Danh sách hồ sơ không được đọc các bảng nghiệp vụ lớn.');
assert.match(extractFunction(codeSource,'searchCases'), /getCaseDetailForActor_/, 'Tìm kiếm nghiệp vụ chỉ tải chi tiết cho các hồ sơ kết quả.');
assert.match(extractFunction(codeSource,'getCaseDetailForActor_'), /findTableRowsByField_\(SHEETS\.workOrders/, 'Chi tiết hồ sơ phải đọc theo khóa, không tải toàn bảng công việc.');
assert.match(extractFunction(codeSource,'listCases'), /latestRevision !== revision/, 'Danh sách phải phát hiện dữ liệu đổi trong lúc làm ấm cache.');
assert.match(codeSource, /function warmPortalReadCache\(/, 'Backend phải có hàm làm ấm cache trước khi người dùng truy cập.');
assert.doesNotMatch(extractFunction(codeSource,'warmPortalReadCache'), /SHEETS\.(cases|workOrders|transfers|issues|parts|holds)/, 'Làm ấm cache không được tải lại toàn bộ bảng nghiệp vụ.');
assert.match(codeSource, /function auditHistoricalDashboardProjection\(/, 'Phải có đối soát chỉ đọc cho toàn bộ projection lịch sử.');
const projectionRepairSource = extractFunction(codeSource,'reconcileHistoricalDashboardProjection_');
for (const field of ['Warranty confirmation','Issue 4','Replace PN Board 4','Qty 4','Return date']) {
  assert.match(projectionRepairSource, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')), `Đối soát projection phải bao phủ ${field}.`);
}
assert.match(projectionRepairSource, /reason:'user_edited'/, 'Đối soát không được ghi đè dữ liệu lịch sử đã được người dùng cập nhật.');

const sharedCacheValues = new Map();
const sharedProperties = new Map();
let sharedSheetReads = 0;
const sharedCacheSandbox = {
  console,
  CacheService:{getScriptCache:()=>({
    get:key=>sharedCacheValues.get(key) ?? null,
    getAll:keys=>Object.fromEntries(keys.filter(key=>sharedCacheValues.has(key)).map(key=>[key,sharedCacheValues.get(key)])),
    put:(key,value)=>sharedCacheValues.set(key,String(value)),
    putAll:values=>Object.entries(values).forEach(([key,value])=>sharedCacheValues.set(key,String(value)))
  })},
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>sharedProperties.get(key) ?? null,
    setProperty:(key,value)=>sharedProperties.set(key,String(value)),
    deleteProperty:key=>sharedProperties.delete(key)
  })},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  Utilities:{getUuid:()=>`owner-${sharedSheetReads}`,sleep:()=>{}},
  clean_:value=>String(value ?? '').trim(),
  digest_:value=>String(value).replace(/[^a-z0-9]/gi,'').slice(0,40),
  parseJson_:value=>{try{return value?JSON.parse(value):null}catch{return null}},
  publicError_:message=>new Error(message),
  getPortalDatabaseRevision_:()=> 'r1',
  readTableWithRows_:name=>{sharedSheetReads++;return {headers:['id'],rows:[{id:`${name}-row`}]} }
};
vm.createContext(sharedCacheSandbox);
vm.runInContext([
  extractFunction(codeSource,'packPortalTable_'),
  extractFunction(codeSource,'unpackPortalTable_'),
  extractFunction(codeSource,'stalePortalRows_'),
  extractFunction(codeSource,'readPortalChunkedCache_'),
  extractFunction(codeSource,'writePortalChunkedCache_'),
  extractFunction(codeSource,'readTableShared_')
].join('\n'),sharedCacheSandbox);
for(let user=0;user<10;user++) assert.equal(sharedCacheSandbox.readTableShared_('Hồ sơ thiết bị','r1')[0].id,'Hồ sơ thiết bị-row');
assert.equal(sharedSheetReads,1,'Mười lượt đọc cùng revision chỉ được chạm Sheet một lần.');
sharedCacheSandbox.readTableShared_('Hồ sơ thiết bị','r2');
assert.equal(sharedSheetReads,2,'Revision mới phải tạo đúng một snapshot mới.');
const contendedRevision='r3';
const leaseKey='PORTAL_TABLE_LEASE_'+sharedCacheSandbox.digest_('Hồ sơ thiết bị');
sharedProperties.set(leaseKey,JSON.stringify({owner:'another-request',revision:contendedRevision,startedAt:Date.now()}));
let contentionSleeps=0;
sharedCacheSandbox.Utilities.sleep=()=>{contentionSleeps++};
const staleRows=sharedCacheSandbox.readTableShared_('Hồ sơ thiết bị',contendedRevision);
assert.equal(staleRows[0].id,'Hồ sơ thiết bị-row');
assert.equal(staleRows.__cacheStale,true,'Fallback phải được đánh dấu stale để không cache theo người dùng.');
assert.equal(contentionSleeps,0,'Khi builder khác đang làm việc phải trả snapshot cũ ngay, không giữ request chờ.');
assert.equal(sharedSheetReads,2,'Request đồng thời phải dùng snapshot cũ, không đọc Sheet lần nữa.');
assert.match(codeSource, /cancelCase: cancelCase/, 'API phải cho phép thao tác hủy hồ sơ có kiểm soát.');
const cancelSource = extractFunction(codeSource, 'cancelCaseUnlocked_');
assert.match(cancelSource, /Tình trạng bảo hành.*Chờ xác nhận/s, 'Chỉ hồ sơ chờ xác nhận bảo hành mới được hủy.');
assert.match(cancelSource, /Trung tâm tiếp nhận khách/, 'Backend phải giới hạn quyền hủy theo center tiếp nhận.');
assert.match(cancelSource, /readTable_\(SHEETS\.transfers\)/, 'Hồ sơ đã luân chuyển không được phép hủy.');
assert.match(cancelSource, /Trạng thái hồ sơ': 'Đã hủy'/, 'Xóa hồ sơ phải là soft-delete có kiểm toán.');
assert.doesNotMatch(extractFunction(codeSource,'getPortalDatabaseRevision_'), /DriveApp/, 'Revision hot path không được yêu cầu thêm OAuth scope Google Drive.');
assert.match(codeSource, /function handlePortalApi_\(request\)/, 'Backend phải có cổng API allowlist cho GitHub Pages.');
assert.match(codeSource, /getPortalSyncState: getPortalSyncState/, 'API GitHub Pages phải cho phép kiểm tra revision dữ liệu.');
assert.match(codeSource, /function getPortalDatabaseRevision_\(/, 'Backend phải tạo revision nhẹ để đồng bộ gần real-time.');
assert.match(codeSource, /portal-cases-v1-/, 'Danh sách hồ sơ phải có cache theo user, revision và bộ lọc.');
assert.match(codeSource, /portal-actor-v1-/, 'Actor đã xác thực phải có cache ngắn hạn để giảm đọc tab Người dùng.');
assert.match(codeSource, /PORTAL_DATA_REVISION/, 'Các thao tác ghi phải cập nhật revision của database.');
assert.match(cancelSource, /bumpPortalDatabaseRevision_\(\)/, 'Xóa hồ sơ phải vô hiệu hóa cache của danh sách hồ sơ và dashboard ngay lập tức.');
assert.match(codeSource, /matchesLegacyProjection/, 'Xóa hồ sơ phải loại cả dòng projection cũ theo S\/N và ngày nhận.');
assert.match(codeSource, /function syncDashboardProjectionCase_\(/, 'Mỗi case phải có cơ chế upsert tăng dần sang Dữ liệu dashboard.');
assert.match(codeSource, /function reconcileDashboardProjection\(\)/, 'Phải có hàm đối soát và bù các case mới còn thiếu trong projection.');
assert.match(codeSource, /function removeOrphanDashboardProjections_\(/, 'Đối soát phải dọn các dòng dashboard mồ côi của hồ sơ đã xóa.');
assert.match(extractFunction(codeSource, 'reconcileDashboardProjection'), /removedOrphans/, 'Kết quả đối soát phải báo số dòng dashboard mồ côi đã xóa.');
for (const mutation of ['createCase','confirmWarrantyUnlocked_','updateWorkOrderUnlocked_','createTransferUnlocked_','acceptTransferUnlocked_','returnToCustomerUnlocked_']) {
  assert.match(extractFunction(codeSource, mutation), /syncDashboardProjectionCase_\(/, `${mutation} phải đồng bộ case sang Dữ liệu dashboard.`);
  assert.match(extractFunction(codeSource, mutation), /syncPortalCaseIndexCase_\(/, `${mutation} phải cập nhật chỉ mục hồ sơ.`);
}
assert.match(extractFunction(codeSource,'cancelCaseUnlocked_'), /syncPortalCaseIndexCase_\(/, 'Xóa hồ sơ phải cập nhật trạng thái Đã hủy vào chỉ mục.');
assert.match(codeSource, /getCaseDetail: getCaseDetail/, 'API phải cho phép tải chi tiết một hồ sơ theo yêu cầu.');
assert.match(entryHtml, /call\('getCaseDetail'/, 'Ngăn chi tiết phải tải dữ liệu đầy đủ khi người dùng bấm mở.');
assert.match(entryHtml, /'getCaseDetail'.*\.includes\(name\)/, 'Tải chi tiết phải được đánh dấu là thao tác chỉ đọc để có retry an toàn.');
assert.match(html, /checkPortalRevision/, 'Apps Script UI phải tự kiểm tra dữ liệu mới.');
assert.match(entryHtml, /checkPortalRevision/, 'GitHub Pages UI phải tự kiểm tra dữ liệu mới.');
assert.match(entryHtml, /Có dữ liệu mới · Bấm để tải lại/, 'UI phải bảo vệ form đang mở trước khi làm mới dữ liệu.');
assert.match(readDocs('live-data.js'), /checkDashboardRevision/, 'Dashboard quản lý phải kiểm tra revision nhẹ trước khi tải lại dữ liệu.');
assert.match(readDocs('live-data.js'), /\['Tình trạng bảo hành',ticket\.warrantyStatus \|\| 'Chưa có thông tin'\]/, 'Chi tiết dashboard phải hiển thị tình trạng bảo hành, không hiển thị nguồn dữ liệu hoặc email xác nhận.');
assert.doesNotMatch(readDocs('live-data.js'), /\['Bảo hành',ticket\.warranty \|\| ticket\.warrantyStatus/, 'Không được ưu tiên người xác nhận hoặc nguồn dữ liệu dưới nhãn bảo hành.');
assert.match(codeSource, /'JGP Center'/, 'Danh sách center phải có JGP.');
assert.match(codeSource, /claims\.sub/, 'Xác thực phải kiểm tra Google sub.');
assert.match(codeSource, /email_verified/, 'Xác thực phải kiểm tra email_verified.');
assert.match(codeSource, /function resolveRole_\(/, 'Backend phải chuẩn hóa role từ tab Người dùng.');
assert.match(codeSource, /function assertCapability_\(/, 'Backend phải kiểm capability cho từng thao tác.');
for (const [action, capability] of Object.entries({
  createCase:'createCase', updateWorkOrderUnlocked_:'updateWorkOrder', createTransferUnlocked_:'createTransfer',
  acceptTransferUnlocked_:'acceptTransfer', returnToCustomerUnlocked_:'returnToCustomer'
})) {
  const body = extractFunction(codeSource, action);
  assert.match(body, new RegExp(`assertCapability_\\(actor, '${capability}'\\)`), `${action} phải kiểm quyền ${capability} ở backend.`);
}
assert.match(extractFunction(codeSource,'updateWorkOrder'), /withSerializedWrite_/, 'Cập nhật hồ sơ phải được khóa giao dịch.');
assert.match(extractFunction(codeSource,'confirmWarranty'), /withSerializedWrite_/, 'Xác nhận bảo hành phải được khóa giao dịch.');
assert.match(extractFunction(codeSource,'createTransfer'), /withSerializedWrite_/, 'Tạo luân chuyển phải được khóa giao dịch.');
assert.match(extractFunction(codeSource,'acceptTransfer'), /withSerializedWrite_/, 'Nhận luân chuyển phải được khóa giao dịch.');
assert.match(extractFunction(codeSource,'returnToCustomer'), /withSerializedWrite_/, 'Giao trả khách phải được khóa giao dịch.');
vm.runInContext(`${extractFunction(codeSource,'assertTransferDestinationPolicy_')}\n${extractFunction(codeSource,'transferDestinationsForSource_')}\nthis.assertTransferDestinationPolicy_=assertTransferDestinationPolicy_;this.transferDestinationsForSource_=transferDestinationsForSource_;`, roleSandbox);
assert.deepEqual(Array.from(roleSandbox.transferDestinationsForSource_('DAT Center')),['Sungrow Service Center'],'Center ngoài Sungrow chỉ được chuyển về Sungrow.');
assert.deepEqual(Array.from(roleSandbox.transferDestinationsForSource_('Sungrow Service Center')),['XBSolar Center','DAT Center','BKE Center','JGP Center'],'Sungrow phải chuyển được đến mọi center còn lại.');
assert.throws(() => roleSandbox.assertTransferDestinationPolicy_('DAT Center','BKE Center'),/chỉ được phép.*Sungrow/i,'Backend phải chặn luân chuyển giữa hai center ngoài Sungrow.');
assert.doesNotThrow(() => roleSandbox.assertTransferDestinationPolicy_('DAT Center','Sungrow Service Center'));
assert.doesNotThrow(() => roleSandbox.assertTransferDestinationPolicy_('Sungrow Service Center','DAT Center'));
assert.match(codeSource, /hasPrivateAccess \? item\['Số điện thoại khách hàng'\] : ''/, 'Center lịch sử không được nhận PII khách hàng khi không còn liên quan vận hành.');
assert.match(codeSource, /Cấu hình người dùng bị trùng GoogleSub/, 'Cấu hình trùng GoogleSub phải bị từ chối.');
assert.match(codeSource, /function auditUserAccessConfiguration\(\)/, 'Phải có hàm audit cấu hình user trước production.');
assert.match(codeSource, /'Tên khách hàng': customerName/, 'Backend phải ghi thông tin khách hàng.');
assert.match(codeSource, /'Mã vận đơn': returnTrackingCode/, 'Backend phải ghi thông tin vận chuyển ở bước giao trả.');
assert.match(read('LegacyDashboardApi.gs'), /authenticateDashboardManager_\(request\.idToken\)/, 'Dashboard cũ phải dùng role manager của hệ thống hợp nhất.');
assert.doesNotMatch(read('LegacyDashboardApi.gs'), /USERS_JSON/, 'Không được duy trì nguồn phân quyền USERS_JSON song song với tab Người dùng.');
assert.match(read('LegacyDashboardApi.gs'), /request\.action === 'portal\.call'/, 'Apps Script phải định tuyến API cho platform GitHub Pages.');
assert.match(read('LegacyDashboardApi.gs'), /1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/, 'Dashboard cũ phải đọc database production.');
const legacyApiSource = read('LegacyDashboardApi.gs');
assert.match(extractFunction(legacyApiSource,'readOperationalRecords_'), /confirmedIssues = issues\.filter/, 'Dashboard chỉ đọc lỗi đã xác nhận từ tab Lỗi thiết bị.');
assert.match(extractFunction(codeSource,'syncDashboardProjectionCase_'), /'Loại ghi nhận'\]\) !== 'Hiện tượng ban đầu'/, 'Bản xuất từng hồ sơ không được đưa hiện tượng ban đầu vào Issue 1-4.');
assert.match(extractFunction(codeSource,'refreshDashboardData_'), /confirmedIssues = issues\.filter/, 'Bản xuất toàn bộ không được đưa hiện tượng ban đầu vào Issue 1-4.');
const operationalFixture = {
  'Hồ sơ thiết bị':[['Mã hồ sơ','Nguồn dữ liệu','Số sê-ri (S/N)','Model','Ngày nhận từ khách','Trung tâm đang giữ hàng'],['HS-ISSUE','Quy trình mới','SN-FAN','SG110CX',new Date('2026-09-27'),'Sungrow Service Center']],
  'Công việc trung tâm':[['Mã hồ sơ','Mã công việc','Trung tâm xử lý'],['HS-ISSUE','CV-ISSUE','Sungrow Service Center']],
  'Lỗi thiết bị':[['Mã công việc','Loại ghi nhận','Mã lỗi','Tên lỗi'],['CV-ISSUE','Hiện tượng ban đầu','','Hỏng quạt F3 và F4'],['CV-ISSUE','Lỗi xác nhận','36','Cảnh báo quạt']]
};
const operationalSandbox = {
  SpreadsheetApp:{openById:() => ({getSheetByName:name => operationalFixture[name] ? {getLastRow:() => operationalFixture[name].length,getDataRange:() => ({getValues:() => operationalFixture[name]})} : null})},
  clean_:value => value == null ? '' : String(value).trim(),
  date_:value => value instanceof Date ? value : null,
  resolveCenter_:value => value,
  number_:value => Number(value) || 1
};
vm.createContext(operationalSandbox);
vm.runInContext(extractFunction(legacyApiSource,'readOperationalRecords_') + '\nthis.readOperationalRecords_=readOperationalRecords_;',operationalSandbox);
const operationalIssueRecord = operationalSandbox.readOperationalRecords_('fixture',[]).records[0];
assert.deepEqual(Array.from(operationalIssueRecord.issues),['Cảnh báo quạt'],'Hiện tượng ban đầu phải bị loại khỏi nguồn lỗi dashboard; lỗi xác nhận vẫn được giữ.');
assert.equal(operationalIssueRecord.errorCode,'36','Mã lỗi dashboard phải lấy từ lỗi xác nhận.');
assert.match(legacyApiSource, /function readOperationalRecords_\(/, 'Dashboard phải đọc trực tiếp các tab nghiệp vụ hợp nhất.');
assert.match(legacyApiSource, /objects\('Hồ sơ thiết bị'\)/, 'Dashboard phải lấy hồ sơ từ cùng nguồn với platform nhập liệu.');
assert.match(legacyApiSource, /function readHybridRecordsForYear_\(/, 'Dashboard phải giữ tab lịch sử làm nền và ghép dữ liệu nhập liệu.');
assert.match(legacyApiSource, /readSheetValues_\(spreadsheetId, 'Dữ liệu dashboard'\)/, 'Dashboard phải dùng Dữ liệu dashboard làm nguồn lịch sử dự phòng khi không có tab năm.');
assert.match(legacyApiSource, /sourceType:\s*clean_\(item\['Nguồn dữ liệu'\]\)/, 'Dashboard phải phân biệt hồ sơ quy trình mới với dữ liệu migrate.');
assert.match(legacyApiSource, /output\.dataQuality\.hybridMerge/, 'Dashboard phải công bố thống kê đối soát dữ liệu lai.');
const hybridSandbox = {
  Object,
  Session:{getScriptTimeZone:() => 'Asia/Ho_Chi_Minh'},
  Utilities:{formatDate:date => date.toISOString().slice(0,10)},
  clean_:value => value == null ? '' : String(value).trim(),
  normalizeDeviceKey_:value => (value == null ? '' : String(value)).toUpperCase().replace(/[^A-Z0-9]/g,'')
};
vm.createContext(hybridSandbox);
vm.runInContext([
  extractFunction(legacyApiSource,'hybridDateKey_'),
  extractFunction(legacyApiSource,'strongHybridKey_'),
  extractFunction(legacyApiSource,'fallbackHybridKey_'),
  extractFunction(legacyApiSource,'overlayOperationalRecord_'),
  extractFunction(legacyApiSource,'mergeLegacyAndOperational_'),
  extractFunction(legacyApiSource,'groupConfirmedIssueCategories_'),
  'this.mergeLegacyAndOperational_=mergeLegacyAndOperational_;this.groupConfirmedIssueCategories_=groupConfirmedIssueCategories_;'
].join('\n'), hybridSandbox);
const legacyRow = {hasData:true,id:'2026-2',serialNumber:'SN-OLD',model:'SG110CX',receivedDate:new Date('2026-09-01T00:00:00Z'),center:'Sungrow Service Center',status:'Đang kiểm tra',deliveryStatus:'Chưa giao máy',issues:[],parts:[]};
const operationalOverlay = {hasData:true,id:'HS-MIGRATED',sourceType:'Dữ liệu migrate',serialNumber:'SN-OLD',model:'SG110CX',receivedDate:new Date('2026-09-01T00:00:00Z'),center:'Sungrow Service Center',status:'Hoàn tất kỹ thuật',deliveryStatus:'Chờ giao máy',issues:['Hỏng IGBT'],parts:[]};
const operationalNew = {hasData:true,id:'HS-NEW',sourceType:'Quy trình mới',serialNumber:'SN-NEW',model:'SG50CX',receivedDate:new Date('2026-09-02T00:00:00Z'),center:'DAT Center',status:'Đã nhận hàng',deliveryStatus:'Chưa giao máy',issues:[],parts:[]};
const unmatchedHistorical = {hasData:true,id:'HS-UNMATCHED',sourceType:'Dữ liệu migrate',serialNumber:'SN-NOT-IN-LEGACY',model:'SG33CX',receivedDate:new Date('2026-09-03T00:00:00Z'),center:'DAT Center',status:'Đang xử lý',deliveryStatus:'Chưa giao máy',issues:[],parts:[]};
const hybridResult = hybridSandbox.mergeLegacyAndOperational_([legacyRow],[operationalOverlay,operationalNew,unmatchedHistorical],2026);
assert.equal(hybridResult.records.length,2,'Dữ liệu lai chỉ được cộng hồ sơ quy trình mới, không cộng lại dữ liệu migrate chưa ghép được.');
assert.equal(hybridResult.records[0].id,'2026-2','Overlay phải giữ ID và hàng dữ liệu lịch sử làm nền.');
assert.equal(hybridResult.records[0].status,'Hoàn tất kỹ thuật','Cập nhật nghiệp vụ phải ghi đè trạng thái lên hồ sơ lịch sử khớp khóa.');
assert.equal(hybridResult.stats.matchedOverlay,1,'Phải đếm được hồ sơ lịch sử đã ghép cập nhật.');
assert.equal(hybridResult.stats.appendedNew,1,'Phải đếm được hồ sơ quy trình mới được bổ sung.');
assert.equal(hybridResult.stats.unmatchedHistorical,1,'Phải cảnh báo dữ liệu migrate chưa ghép thay vì đếm trùng.');
const projectedIntake = {...legacyRow,projectedCaseId:'HS-NEW-PROJECTION',issues:['Hỏng quạt F3 và F4','Nhiệt độ bên trong máy cao','Cảnh báo quạt']};
const newCaseWithoutConfirmedIssue = {...operationalOverlay,id:'HS-NEW-PROJECTION',sourceType:'Quy trình mới',serialNumber:'SN-CHANGED',model:'SG50CX',issues:[]};
const projectedMerge = hybridSandbox.mergeLegacyAndOperational_([projectedIntake],[newCaseWithoutConfirmedIssue],2026);
assert.equal(projectedMerge.records.length,1,'Projection phải ghép theo Mã hồ sơ dù S/N hoặc model được chỉnh sau đó.');
assert.equal(projectedMerge.records[0].issues.length,0,'Projection của hồ sơ mới không được giữ hiện tượng ban đầu như lỗi xác nhận.');
const repair2025 = {...legacyRow,id:'2025-342',legacySourceKey:'2025!342',serialNumber:'A24C2718388',receivedDate:new Date('2025-07-09'),warrantyStatus:'Trong bảo hành',parts:[{pn:'ASG02271',qty:1}]};
const repair2026 = {...repair2025,id:'2026-167',legacySourceKey:'2026!167',warrantyStatus:'Sửa làm hàng good',parts:[{pn:'BP012029',qty:1},{pn:'B0P01309',qty:1},{pn:'BP007144',qty:1},{pn:'B0P01333',qty:1}]};
const imported2026 = {...operationalOverlay,id:'HS-OLD-2026-0167',legacySourceKey:'2026!167',hasWorkflowEdits:false,serialNumber:'A24C2718388',receivedDate:new Date('2025-07-09'),warrantyStatus:'Chờ xác nhận',parts:[]};
const historical2026 = hybridSandbox.mergeLegacyAndOperational_([repair2026],[imported2026],2026);
assert.equal(historical2026.stats.matchedOverlay,1,'Phải ghép theo dòng nguồn khi năm ngày nhận khác năm của tab.');
assert.equal(historical2026.records[0].warrantyStatus,'Sửa làm hàng good');
assert.equal(historical2026.records[0].parts.length,4);
const historical2025 = hybridSandbox.mergeLegacyAndOperational_([repair2025],[imported2026],2025);
assert.equal(historical2025.stats.matchedOverlay,0,'Không được ghi đè lượt sửa năm 2025 bằng lượt 2026 cùng SN và ngày nhận.');
assert.equal(historical2025.records[0].parts[0].pn,'ASG02271');
const edited2026 = {...imported2026,hasWorkflowEdits:true,status:'Đang theo dõi'};
const editedHistory = hybridSandbox.mergeLegacyAndOperational_([repair2026],[edited2026],2026).records[0];
assert.equal(editedHistory.status,'Đang theo dõi');
assert.equal(editedHistory.warrantyStatus,'Sửa làm hàng good');
vm.runInContext(extractFunction(legacyApiSource,'historicalWarrantyStatus_')+'\n'+extractFunction(legacyApiSource,'date_'),hybridSandbox);
assert.equal(hybridSandbox.historicalWarrantyStatus_('Trong bảo hành','Đổi Inverter'),'Trong bảo hành');
assert.equal(hybridSandbox.historicalWarrantyStatus_('Sửa làm hàng good','Đã sửa chữa'),'Sửa làm hàng good');
assert.equal(hybridSandbox.date_('09/07/2025').getMonth(),6);
assert.equal(hybridSandbox.date_('B111-Aug-26').getDate(),11);
assert.equal(hybridSandbox.date_('31/02/2025'),null);
assert.match(extractFunction(legacyApiSource,'normalizeRow_'), /projectedCaseId \? \[\] : schema\.issues/, 'Cột Issue của projection không được coi là lỗi xác nhận.');
const groupedIssues = hybridSandbox.groupConfirmedIssueCategories_([
  {issues:['Hỏng quạt F3 và F4','Nhiệt độ bên trong máy cao','Cảnh báo quạt']},
  {issues:['Hỏng External Fan']},
  {issues:['Nhiệt độ bên trong máy cao']},
  {issues:['Hỏng IGBT','Hỏng IGBT']}
]);
assert.equal(groupedIssues.find(item => item.name === 'Lỗi quạt').count,2,'Ba mô tả lỗi quạt trên một inverter chỉ tính một thiết bị trong nhóm quạt.');
assert.equal(groupedIssues.find(item => item.name === 'Hỏng IGBT').count,1,'Lỗi trùng tên trên một thiết bị chỉ được tính một lần.');
assert.equal(groupedIssues.find(item => item.name === 'Nhiệt độ bên trong máy cao').count,1,'Nhiệt độ cao đứng riêng không tự bị coi là lỗi quạt.');
assert.match(read('LegacyDashboardApi.gs'), /dataRevision/, 'Cache dashboard và tìm kiếm phải thay đổi theo revision dữ liệu.');
const cacheItems = new Map();
const cacheStub = {
  get:key => cacheItems.get(key) || null,
  getAll:keys => Object.fromEntries(keys.filter(key => cacheItems.has(key)).map(key => [key,cacheItems.get(key)])),
  put:(key,value) => cacheItems.set(key,value),
  putAll:entries => Object.entries(entries).forEach(([key,value]) => cacheItems.set(key,value))
};
const cacheSandbox = {console, Utilities:{newBlob:value => ({getBytes:() => [...Buffer.from(value,'utf8')]})}};
vm.createContext(cacheSandbox);
vm.runInContext([
  extractFunction(legacyApiSource,'safeCacheGet_'),
  extractFunction(legacyApiSource,'safeCachePut_'),
  'this.safeCacheGet_=safeCacheGet_;this.safeCachePut_=safeCachePut_;'
].join('\n'), cacheSandbox);
const largeDashboard = {centers:[{center:'JGP Center'}],tickets:'Thiết bị '.repeat(15000)};
cacheSandbox.safeCachePut_(cacheStub,'dashboard-test',largeDashboard,300);
assert.match(cacheItems.get('dashboard-test'),/^chunks:\d+$/,'Dashboard lớn phải được cache theo nhiều phần.');
assert.equal(cacheSandbox.safeCacheGet_(cacheStub,'dashboard-test').tickets,largeDashboard.tickets,'Cache nhiều phần phải khôi phục đầy đủ tiếng Việt.');
cacheItems.delete('dashboard-test:part:0');
assert.equal(cacheSandbox.safeCacheGet_(cacheStub,'dashboard-test'),null,'Thiếu một phần cache phải đọc lại nguồn, không trả dữ liệu hỏng.');
assert.match(legacyApiSource, /year === selectedYear && selectedYearRecords/, 'Không được đọc lại Sheet của năm đang chọn khi tính tổng năm.');
assert.match(legacyApiSource, /actor\.role, scope\.slice\(\)\.sort/, 'Cache phải dùng chung theo vai trò và phạm vi center.');
assert.match(legacyApiSource, /cached\.actor = \{ email: actor\.email/, 'Dashboard lấy từ cache phải gắn lại đúng danh tính người đang xem.');
const registrySandbox = {
  DEFAULT_CENTERS:[{id:'sungrow',name:'Sungrow Service Center'},{id:'jgp',name:'JGP Center'}],
  PropertiesService:{getScriptProperties:() => ({})},
  parseJsonProperty_:() => [{id:'sungrow',name:'Sungrow Service Center'}],
  clean_:value => value == null ? '' : String(value).trim()
};
vm.createContext(registrySandbox);
vm.runInContext(extractFunction(legacyApiSource,'centerRegistry_') + '\nthis.centerRegistry_=centerRegistry_;',registrySandbox);
assert.equal(registrySandbox.centerRegistry_().length,2,'Cấu hình center cũ không được làm mất JGP khỏi dashboard.');
assert.match(html, /navigateToCase\('update',item\.caseId\)/, 'Sau xác nhận bảo hành phải tải lại hồ sơ mới nhất trước khi cập nhật kỹ thuật.');
assert.match(entryHtml, /navigateToCase\('update',item\.caseId\)/, 'GitHub Pages phải tải lại hồ sơ sau xác nhận bảo hành.');
for (const field of ['issues','parts','holds']) {
  assert.match(extractFunction(codeSource,'publicWorkOrder_'), new RegExp(`${field}:`), `Payload công việc phải trả lại ${field} đã lưu.`);
}
assert.match(extractFunction(codeSource,'replaceWorkOrderChildren_'), /updateObjectRow_/, 'Lỗi và linh kiện đã có ID phải được cập nhật tại chỗ.');
assert.match(extractFunction(codeSource,'replaceWorkOrderChildren_'), /deleteRowsDescending_/, 'Lỗi và linh kiện bị xóa trên form phải được xóa khỏi database.');
assert.match(extractFunction(codeSource,'appendWorkOrderHolds_'), /updateObjectRow_/, 'Tạm dừng SLA đã có ID phải được cập nhật tại chỗ.');
assert.match(entryHtml, /data-part-usage-id/, 'Form cập nhật phải giữ ID linh kiện để không tạo dòng trùng.');
assert.match(entryHtml, /rowsOrBlank\(w\.parts,partRow\)/, 'Form cập nhật phải nạp các linh kiện đã lưu.');
assert.match(entryHtml, /rowsOrBlank\(w\.issues,issueRow\)/, 'Form cập nhật phải nạp các lỗi đã lưu.');
assert.match(entryHtml, /rowsOrBlank\(w\.holds,holdRow\)/, 'Form cập nhật phải nạp các khoảng tạm dừng SLA đã lưu.');
assert.match(entryHtml, /item\.returnedAt\|\|today\(\)/, 'Form giao trả phải nạp ngày trả đã lưu.');
assert.match(entryHtml, /item\.carrier\|\|''/, 'Form giao trả phải nạp đơn vị vận chuyển đã lưu.');
assert.match(entryHtml, /attempt<1/, 'Request chỉ đọc chỉ thử lại một lần để hạn chế tải khi có lỗi.');
assert.match(entryHtml, /state\.caseLoading/, 'Polling không được chạy chồng với request tải danh sách.');
assert.match(html, /id="legacyDashboardFrame"/, 'Giao diện final phải giữ dashboard cũ cho quản lý.');
assert.doesNotMatch(entryHtml, /google\.script\.run|<\?=/, 'GitHub Pages không được phụ thuộc runtime template của Apps Script.');
assert.match(entryHtml, /action:'portal\.call'/, 'GitHub Pages phải gọi Apps Script dưới dạng API.');
assert.match(entryHtml, /sessionStorage\.setItem\('sungrow_id_token'/, 'Phiên đăng nhập phải được giữ trên cùng origin GitHub Pages.');
assert.match(entryHtml, /Thông tin giao trả/, 'Thông tin vận chuyển phải nằm ở bước giao trả khách hàng.');
assert.match(entryHtml, /name="returnTrackingCode"/, 'Form giao trả phải có mã vận đơn.');
assert.match(entryHtml, /item\.transferDestinations\|\|\[\]/, 'Dropdown luân chuyển phải dùng danh sách đích do backend cấp.');
const receiveForm = entryHtml.match(/<form id="receiveForm"[\s\S]*?<\/form>/i)?.[0] || '';
assert.doesNotMatch(receiveForm, /Thông tin gửi hàng|senderCompany|trackingCode/, 'Form tiếp nhận không được yêu cầu thông tin gửi hàng.');
assert.match(readDocs('config.js'), /dataEntryPage:\s*'entry\.html'/, 'Dashboard phải điều hướng tới trang nhập liệu GitHub Pages.');
const liveDataSource = readDocs('live-data.js');
new vm.Script(liveDataSource, {filename:'docs/live-data.js'});
for (const field of ['gsp', 'ma']) assert.doesNotMatch(receiveForm, new RegExp(`name="${field}"`), `Form tiếp nhận không được nhập ${field}.`);
assert.match(receiveForm, /id="warrantyLookup"/, 'Form tiếp nhận phải hiển thị kết quả tra cứu bảo hành ngay dưới S/N.');
assert.doesNotMatch(receiveForm, /<label>Tình trạng bảo hành<\/label>/, 'Form tiếp nhận không được hiển thị ô trạng thái bảo hành cố định.');
assert.match(entryHtml, /call\('lookupWarranty',\[state\.token,serial\]\)/, 'Giao diện phải gọi tra cứu bảo hành khi nhập S/N.');
for (const field of ['gsp', 'ma']) assert.match(entryHtml, new RegExp(`function openWork[\\s\\S]*name="${field}"`), `Form cập nhật công việc thiếu ${field}.`);
assert.match(receiveForm, /name="evidenceFile"[^>]*accept="\.zip,\.rar"/, 'Form phải chọn hồ sơ nén .zip/.rar.');
assert.match(codeSource, /const serial = clean_\(payload\.serialNumber\)/, 'Fan phải có thể bỏ trống S/N ở backend.');
assert.match(codeSource, /ensureSheetColumns_\(SHEETS\.cases, \['GSP', 'MA'\]\)/, 'GSP/MA phải được lưu trong bảng hồ sơ.');
assert.match(codeSource, /function lookupWarranty\(/, 'Backend phải tra cứu bảo hành theo S/N.');
const warrantySandbox = { clean_: value => String(value ?? '').trim() };
vm.createContext(warrantySandbox);
vm.runInContext(extractFunction(codeSource, 'validWarrantyDate_') + '\n' + extractFunction(codeSource, 'warrantyDate_'), warrantySandbox);
assert.equal(warrantySandbox.warrantyDate_('20/07/2026').getFullYear(), 2026, 'Ngày Start date dạng dd/MM/yyyy phải đọc đúng.');
assert.equal(warrantySandbox.warrantyDate_('2026-07-20').getMonth(), 6, 'Ngày Start date dạng ISO phải đọc đúng.');
assert.equal(warrantySandbox.warrantyDate_('31/02/2026'), null, 'Ngày không hợp lệ không được kết luận bảo hành.');
assert.match(liveDataSource, /return t\.status \|\| t\.deliveryStatus/, 'Dropdown và bảng phải dùng trạng thái xử lý thống nhất.');
assert.match(liveDataSource, /Linh kiện sử dụng/, 'Chi tiết sửa chữa phải hiển thị linh kiện sử dụng.');
assert.match(liveDataSource, /sg-main\.sg-portal-mode>\.sg-content\{display:none!important\}/, 'Platform phải ẩn hoàn toàn nội dung dashboard để không chồng lớp.');
assert.match(liveDataSource, /classList\.remove\('sg-portal-mode'\)/, 'Quay lại dashboard phải khôi phục nguyên nội dung KPI.');
assert.doesNotMatch(liveDataSource, /nav\.replaceChildren\(\)/, 'Không được thay sidebar dashboard gốc.');
assert.match(liveDataSource, /button\[data-page\]/, 'Phải giữ menu dashboard gốc.');
assert.match(liveDataSource, /textContent = 'Đăng xuất'/, 'Sidebar phải có nút đăng xuất.');
assert.match(liveDataSource, /sessionStorage\.removeItem\('sungrow_id_token'\)/, 'Đăng xuất phải xóa phiên đăng nhập.');
assert.match(liveDataSource, /root\.hidden = true/, 'Dashboard phải ẩn trước khi xác thực.');
assert.match(readDocs('index.html'), /id="sg-preview"[^>]*hidden/, 'Dashboard phải được ẩn ngay từ HTML để không nháy trước trang login.');
assert.match(liveDataSource, /id = 'sg-auth-page'/, 'Phải có trang đăng nhập riêng.');
assert.match(liveDataSource, /function revealApplication\(\)/, 'Chỉ hiển thị ứng dụng sau khi xác thực thành công.');
assert.match(liveDataSource, /root\.hidden = false/, 'Ứng dụng phải được mở sau khi backend trả phân quyền.');
assert.match(liveDataSource, /sg-auth-login-slot/, 'Nút Google phải nằm trên trang đăng nhập riêng.');
assert.match(liveDataSource, /\.sg-role-hidden\{display:none!important\}/, 'Menu dashboard của center phải bị ẩn bất kể CSS display mặc định.');
assert.match(liveDataSource, /classList\.add\('sg-role-hidden'\)/, 'Account center phải được gắn lớp ẩn menu quản lý.');
assert.match(liveDataSource, /function applyPortalCapabilities\(actor\)/, 'Sidebar platform phải hiển thị theo capability backend.');
assert.match(entryHtml, /function viewAllowed\(id\)/, 'Trang nhập liệu phải chặn điều hướng view không đúng capability.');
assert.match(liveDataSource, /tabIndex = -1/, 'Menu quản lý ẩn không được nhận focus bàn phím.');
const casesView = entryHtml.match(/<section id="cases"[\s\S]*?<\/section>/i)?.[0] || '';
assert.doesNotMatch(casesView, /Quản lý hồ sơ thiết bị|\+ Tiếp nhận thiết bị/, 'Danh sách hồ sơ không được lặp lại tiêu đề và nút tiếp nhận phía trên.');
assert.match(entryHtml, /\.search-field::after\{[^}]*top:50%;[^}]*translateY\(-50%\)/, 'Icon tìm kiếm phải căn giữa bên phải ô nhập.');
assert.match(entryHtml, /\.case-table-shell\{[^}]*flex:1 1 auto;[^}]*scrollbar-width:thin/, 'Bảng hồ sơ phải dùng vùng cuộn linh hoạt giống dashboard.');
assert.match(entryHtml, /#cases\.view\.panel\{[^}]*display:flex;[^}]*overflow:hidden/, 'Trang danh sách phải dùng toàn bộ chiều cao khả dụng và chỉ cuộn phần bảng.');
assert.match(liveDataSource, /v=62#/, 'Iframe nhập liệu phải dùng cache key mới.');
assert.match(liveDataSource, /function syncCenterOptions\(data\)/, 'Bộ lọc center phải lấy center từ phản hồi dashboard.');
assert.match(liveDataSource, /syncCenterOptions\(live\)/, 'Bộ lọc center phải cập nhật sau khi tải dashboard.');
assert.match(liveDataSource, /Chưa có lỗi xác nhận trong kỳ/, 'Thẻ lỗi phải phân biệt lỗi xác nhận với hiện tượng tiếp nhận.');
assert.match(readDocs('index.html'), /live-data\.js\?v=67/, 'GitHub Pages phải nạp bản giao diện mới.');
assert.match(liveDataSource, /delta === 0 \? '--'/, 'KPI bằng kỳ trước phải hiển thị ký hiệu -- gọn trên cùng một dòng.');
assert.match(liveDataSource, /\.sg-live-text\{display:flex;align-items:center;gap:6px/, 'Trạng thái đồng bộ và thời gian phải có khoảng cách rõ ràng.');
assert.match(entryHtml, /function cancelCaseUI\(/, 'Giao diện phải có thao tác xóa hồ sơ trước xác nhận bảo hành.');
assert.match(entryHtml, /caseLoadFailures:0, caseRetryTimer:null/, 'Danh sách hồ sơ phải theo dõi phục hồi tải lỗi mà không reload trang.');
assert.match(entryHtml, /includeDetails:false/, 'Tải danh sách hồ sơ phải dùng payload nhẹ, không chờ lỗi và linh kiện toàn database.');
assert.match(entryHtml, /retryDelays=\[3000,7000,15000,30000\]/, 'Danh sách hồ sơ phải tự thử lại với backoff có giới hạn.');
assert.match(entryHtml, /đang được chuẩn bị/, 'Lỗi làm ấm cache phải được coi là lỗi đọc tạm thời và tự thử lại.');
assert.match(entryHtml, /item\.canDelete/, 'Nút xóa phải phụ thuộc quyền do backend trả về.');
assert.match(entryHtml, /case-row-actions/, 'Nút xóa phải nằm cạnh nút mở chi tiết trong cột thao tác.');
assert.doesNotMatch(entryHtml, /drawer-actions">\$\{deleteAction\}/, 'Nút xóa không được nằm trong ngăn chi tiết thiết bị.');
assert.match(legacyApiSource, /request\.action === 'tickets\.page'/, 'Dashboard phải có API phân trang toàn bộ danh sách thiết bị.');
const ticketPageSource = extractFunction(legacyApiSource,'pageTickets_');
assert.match(ticketPageSource, /ticket-index/, 'Danh sách thiết bị phải dùng chỉ mục dùng chung thay vì đọc Sheet ở từng trang.');
assert.match(ticketPageSource, /for \(let year = FIRST_REPORT_YEAR; year <= lastYear; year\+\+\)/, 'Chỉ mục thiết bị phải bao phủ toàn bộ các năm dữ liệu.');
assert.match(ticketPageSource, /LockService\.getScriptLock\(\)/, 'Chỉ một request được phép xây chỉ mục khi nhiều người truy cập đồng thời.');
assert.doesNotMatch(ticketPageSource, /request\.year/, 'Danh sách thiết bị không được giới hạn theo năm đang chọn trên dashboard.');
assert.match(ticketPageSource, /recordInScope_\(record, scope, includeUnassigned, centers\)/, 'Tất cả trung tâm phải giữ cả hồ sơ có center chưa chuẩn hóa cho quản lý toàn hệ thống.');
assert.match(legacyApiSource, /unallocatedReceived/, 'KPI tích lũy phải công khai số hồ sơ thiếu hoặc lệch ngày nhận.');
assert.match(legacyApiSource, /cancelledStrongKeys/, 'Dashboard phải loại projection của hồ sơ đã hủy theo S/N và ngày nhận.');
assert.match(legacyApiSource, /canUseSharedTables\) return readTableShared_\(sheetName, sharedRevision\)/, 'Dashboard phải dùng chung cache bảng nghiệp vụ với danh sách hồ sơ.');
assert.doesNotMatch(legacyApiSource, /\['dash',[^\n]*actor\.email/, 'Cache dashboard không được tách theo email khi role và phạm vi center giống nhau.');
assert.match(liveDataSource, /idToken:token,query:term[\s\S]*action:'tickets\.page'|action:'tickets\.page'[\s\S]*idToken:token/, 'Frontend phải gọi API phân trang thiết bị.');
assert.doesNotMatch(liveDataSource, /refresh:Boolean\(term\)/, 'Tìm kiếm không được phá cache và quét lại Sheet ở mỗi lần nhập.');
assert.match(liveDataSource, /function ticketLoading\(\)/, 'Danh sách thiết bị phải có trạng thái loading riêng.');
assert.match(liveDataSource, /sg-ticket-spinner/, 'Trạng thái loading phải hiển thị vòng xoay trực quan.');
assert.match(liveDataSource, /name:'Tích lũy'/, 'Nhãn tích lũy phải ngắn gọn để không tràn khỏi ô chú giải.');
assert.match(liveDataSource, /hồ sơ chưa tính do thiếu, sai hoặc lệch năm ngày nhận/, 'Tooltip phải giải thích rõ phạm vi số liệu tích lũy.');
assert.doesNotMatch(liveDataSource, /sg-annual-coverage-note/, 'Không được chèn cảnh báo dài làm tràn thẻ KPI.');
assert.match(liveDataSource, /<th>GSP<\/th><th>MA<\/th><th>Thiết bị \/ S\/N<\/th>/, 'GSP và MA phải đứng trước cột Thiết bị / S/N.');
assert.match(liveDataSource, /sg-parts-inline/, 'Linh kiện sử dụng phải hiển thị theo bố cục ngang gọn.');
assert.match(liveDataSource, /yearSelect\.id = 'sg-period-year'/, 'Dashboard phải có bộ chọn năm độc lập.');
assert.match(liveDataSource, /yearSelect\.type = 'number'/, 'Năm báo cáo phải cho phép nhập trực tiếp năm tương lai, không dùng dropdown cố định.');
assert.match(liveDataSource, /legacyLabel\.style\.display = 'none'/, 'Bộ chọn kỳ YYYY-MM cũ phải được ẩn hoàn toàn.');
assert.match(liveDataSource, /monthSelect\.id = 'sg-period-month'/, 'Dashboard phải có bộ chọn tháng độc lập.');
assert.match(liveDataSource, /for \(let month = 1; month <= 12; month\+\+\)/, 'Bộ lọc tháng phải luôn có đủ 12 tháng.');
assert.doesNotMatch(liveDataSource, /const lastMonth = year === maxYear \? maxMonth : 12/, 'Không được giới hạn tháng theo danh sách cố định hoặc tháng mặc định cũ.');
assert.match(entryHtml, /html\.embedded \.content\{padding:10px 22px\}/, 'Khoảng hở trang nhập liệu phải đồng bộ với vùng nội dung dashboard.');
assert.match(liveDataSource, /sg-dashboard-parent/, 'Sidebar phải có nhóm cha Dashboard quản lý.');
assert.match(liveDataSource, /function setNavGroup\(/, 'Các nhóm sidebar phải hỗ trợ expand/collapse.');
assert.match(liveDataSource, /sg-nav-parent\[aria-expanded="true"\]/, 'Trạng thái mở của nhóm sidebar phải được thể hiện trực quan.');
assert.match(liveDataSource, /border-right:2px solid currentColor;border-bottom:2px solid currentColor/, 'Chevron sidebar phải được vẽ bằng CSS thay vì ký tự chữ bị lệch.');
assert.doesNotMatch(liveDataSource, /content:"⌄"/, 'Sidebar không được dùng ký tự glyph làm icon expand.');
assert.match(liveDataSource, /sg-nav-parent\{[^}]*white-space:nowrap/, 'Tiêu đề nhóm sidebar phải giữ trên một dòng.');
assert.match(liveDataSource, /sg-side\{padding-left:14px!important;padding-right:14px!important/, 'Nội dung sidebar desktop phải được dịch nhẹ sang trái.');
assert.match(liveDataSource, /\.sg-official-logo svg\{[^}]*width:150px!important;[^}]*height:20px!important/, 'Logo sidebar phải có cùng kích thước cố định cho mọi role.');
for (const field of ['customerName','customerAddress','customerPhone','customerEmail']) {
  assert.match(html, new RegExp(`name="${field}"`), `Form thiếu trường ${field}.`);
}
for (const field of ['returnCompany','returnCustomer','returnAddress','returnPhone','returnEmail','returnCarrier','returnTrackingCode']) {
  assert.match(html, new RegExp(`name="${field}"`), `Form giao trả thiếu trường ${field}.`);
}

// Exercise actual creation logic: a lost response must not upload/append twice,
// and slow Drive uploads must not hold the database lock.
const creationRows = { cases: [], works: [], issues: [] };
const receipts = new Map();
let locked = false, uploadCount = 0, nextId = 0;
const creationSandbox = {
  console, SHEETS: { cases:'cases', workOrders:'works', issues:'issues' },
  authenticate_: token => ({ email:token }), assertCapability_:()=>{}, assertCenterAllowed_:()=>{},
  clean_: value => String(value ?? '').trim(), required_: value => value,
  parseDateRequired_: value => new Date(value), emailOptional_: value => value,
  publicError_: message => new Error(message),
  readTable_: name => creationRows[name] || [],
  appendObject_: (name,row) => creationRows[name].push(row),
  ensureSheetColumns_:()=>{}, makeId_: prefix => prefix + (++nextId),
  SpreadsheetApp:{flush:()=>{}}, bumpPortalDatabaseRevision_:()=>{}, audit_:()=>{}, syncDashboardProjectionCase_:()=>{}, syncPortalCaseIndexCase_:()=>({ok:true}),
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>receipts.get(key),setProperty:(key,value)=>receipts.set(key,value),deleteProperty:key=>receipts.delete(key)})},
  LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true},releaseLock:()=>{locked=false}})},
  uploadCaseEvidence_:()=>{assert.equal(locked,false,'Drive upload must run outside database lock');uploadCount++;return 'https://drive.google.com/test'}
};
vm.createContext(creationSandbox);
vm.runInContext(extractFunction(codeSource,'getCreationStatus')+'\n'+extractFunction(codeSource,'createCase'),creationSandbox);
const draft={requestId:'12345678-abcd-1234-abcd-123456789abc',intakeCenter:'Center',receivedAt:'2026-09-29',deviceType:'Inverter',model:'Model',serialNumber:'SN',customerName:'Test',customerAddress:'Test',customerPhone:'123',initialIssue:'Test'};
const created=creationSandbox.createCase('owner',draft);
const recovered=creationSandbox.createCase('owner',draft);
assert.equal(recovered.caseId,created.caseId);
assert.equal(uploadCount,1);
assert.equal(creationRows.cases.length,1);
assert.equal(creationSandbox.getCreationStatus('other',draft.requestId).found,false);
const pendingId='12345678-abcd-1234-abcd-987654321abc';
receipts.set('CREATE_UPLOAD_'+pendingId,JSON.stringify({owner:'owner'}));
assert.throws(()=>creationSandbox.createCase('owner',{...draft,requestId:pendingId}),/đang tải/);
assert.equal(uploadCount,1);
assert.equal(locked,false);
console.log('Validation passed: syntax, roles/KPI, shared cache (10 readers / 1 Sheet read), contention hand-off, creation idempotency and upload lock isolation.');
