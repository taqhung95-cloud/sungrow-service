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
const roleConstants = codeSource.slice(codeSource.indexOf('const ROLE_CODES'), codeSource.indexOf('function doGet'));
const roleSandbox = {
  Object,
  clean_:value => value == null ? '' : String(value).trim(),
  publicError_:message => new Error(message),
  SUNGROW_CENTER:'Sungrow Service Center'
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
assert.equal(staffRole.capabilities.returnToCustomer,false,'Nhân viên center không được giao trả khách.');
assert.throws(() => roleSandbox.resolveRole_('admin tùy ý','DAT Center'),/không hợp lệ/i,'Role không nhận diện phải bị từ chối.');
assert.match(codeSource, /1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/, 'Code phải trỏ tới database production.');
assert.match(codeSource, /1\.2\.0-production-auth/, 'Code phải khai báo đúng version production hiện tại.');
assert.match(codeSource, /function handlePortalApi_\(request\)/, 'Backend phải có cổng API allowlist cho GitHub Pages.');
assert.match(codeSource, /'JGP Center'/, 'Danh sách center phải có JGP.');
assert.match(codeSource, /claims\.sub/, 'Xác thực phải kiểm tra Google sub.');
assert.match(codeSource, /email_verified/, 'Xác thực phải kiểm tra email_verified.');
assert.match(codeSource, /function resolveRole_\(/, 'Backend phải chuẩn hóa role từ tab Người dùng.');
assert.match(codeSource, /function assertCapability_\(/, 'Backend phải kiểm capability cho từng thao tác.');
for (const [action, capability] of Object.entries({
  createCase:'createCase', updateWorkOrder:'updateWorkOrder', createTransfer:'createTransfer',
  acceptTransfer:'acceptTransfer', returnToCustomer:'returnToCustomer'
})) {
  const body = codeSource.match(new RegExp(`function ${action}\\([\\s\\S]*?\\n}`))?.[0] || '';
  assert.match(body, new RegExp(`assertCapability_\\(actor, '${capability}'\\)`), `${action} phải kiểm quyền ${capability} ở backend.`);
}
assert.match(codeSource, /hasPrivateAccess \? item\['Số điện thoại khách hàng'\] : ''/, 'Center lịch sử không được nhận PII khách hàng khi không còn liên quan vận hành.');
assert.match(codeSource, /Cấu hình người dùng bị trùng GoogleSub/, 'Cấu hình trùng GoogleSub phải bị từ chối.');
assert.match(codeSource, /function auditUserAccessConfiguration\(\)/, 'Phải có hàm audit cấu hình user trước production.');
assert.match(codeSource, /'Tên khách hàng': customerName/, 'Backend phải ghi thông tin khách hàng.');
assert.match(codeSource, /'Mã vận đơn': returnTrackingCode/, 'Backend phải ghi thông tin vận chuyển ở bước giao trả.');
assert.match(read('LegacyDashboardApi.gs'), /authenticateDashboardManager_\(request\.idToken\)/, 'Dashboard cũ phải dùng role manager của hệ thống hợp nhất.');
assert.doesNotMatch(read('LegacyDashboardApi.gs'), /USERS_JSON/, 'Không được duy trì nguồn phân quyền USERS_JSON song song với tab Người dùng.');
assert.match(read('LegacyDashboardApi.gs'), /request\.action === 'portal\.call'/, 'Apps Script phải định tuyến API cho platform GitHub Pages.');
assert.match(read('LegacyDashboardApi.gs'), /1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/, 'Dashboard cũ phải đọc database production.');
assert.match(html, /id="legacyDashboardFrame"/, 'Giao diện final phải giữ dashboard cũ cho quản lý.');
assert.doesNotMatch(entryHtml, /google\.script\.run|<\?=/, 'GitHub Pages không được phụ thuộc runtime template của Apps Script.');
assert.match(entryHtml, /action:'portal\.call'/, 'GitHub Pages phải gọi Apps Script dưới dạng API.');
assert.match(entryHtml, /sessionStorage\.setItem\('sungrow_id_token'/, 'Phiên đăng nhập phải được giữ trên cùng origin GitHub Pages.');
assert.match(entryHtml, /Thông tin giao trả/, 'Thông tin vận chuyển phải nằm ở bước giao trả khách hàng.');
assert.match(entryHtml, /name="returnTrackingCode"/, 'Form giao trả phải có mã vận đơn.');
const receiveForm = entryHtml.match(/<form id="receiveForm"[\s\S]*?<\/form>/i)?.[0] || '';
assert.doesNotMatch(receiveForm, /Thông tin gửi hàng|senderCompany|trackingCode/, 'Form tiếp nhận không được yêu cầu thông tin gửi hàng.');
assert.match(readDocs('config.js'), /dataEntryPage:\s*'entry\.html'/, 'Dashboard phải điều hướng tới trang nhập liệu GitHub Pages.');
const liveDataSource = readDocs('live-data.js');
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
assert.match(liveDataSource, /v=38#/, 'Iframe nhập liệu phải dùng cache key mới cho giao diện sidebar.');
assert.match(entryHtml, /html\.embedded \.content\{padding:10px 22px\}/, 'Khoảng hở trang nhập liệu phải đồng bộ với vùng nội dung dashboard.');
assert.match(liveDataSource, /sg-dashboard-parent/, 'Sidebar phải có nhóm cha Dashboard quản lý.');
assert.match(liveDataSource, /function setNavGroup\(/, 'Các nhóm sidebar phải hỗ trợ expand/collapse.');
assert.match(liveDataSource, /sg-nav-parent\[aria-expanded="true"\]/, 'Trạng thái mở của nhóm sidebar phải được thể hiện trực quan.');
assert.match(liveDataSource, /border-right:2px solid currentColor;border-bottom:2px solid currentColor/, 'Chevron sidebar phải được vẽ bằng CSS thay vì ký tự chữ bị lệch.');
assert.doesNotMatch(liveDataSource, /content:"⌄"/, 'Sidebar không được dùng ký tự glyph làm icon expand.');
assert.match(liveDataSource, /\.sg-official-logo svg\{[^}]*width:150px!important;[^}]*height:20px!important/, 'Logo sidebar phải có cùng kích thước cố định cho mọi role.');
for (const field of ['customerName','customerAddress','customerPhone','customerEmail']) {
  assert.match(html, new RegExp(`name="${field}"`), `Form thiếu trường ${field}.`);
}
for (const field of ['returnCompany','returnCustomer','returnAddress','returnPhone','returnEmail','returnCarrier','returnTrackingCode']) {
  assert.match(html, new RegExp(`name="${field}"`), `Form giao trả thiếu trường ${field}.`);
}

console.log('Validation passed: syntax, HTML script, role guard and KPI smoke tests.');
