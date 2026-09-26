import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

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
assert.match(codeSource, /1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/, 'Code phải trỏ tới database production.');
assert.match(codeSource, /'JGP Center'/, 'Danh sách center phải có JGP.');
assert.match(codeSource, /claims\.sub/, 'Xác thực phải kiểm tra Google sub.');
assert.match(codeSource, /email_verified/, 'Xác thực phải kiểm tra email_verified.');
assert.match(codeSource, /'Tên khách hàng': customerName/, 'Backend phải ghi thông tin khách hàng.');
assert.match(codeSource, /'Mã vận đơn': trackingCode/, 'Backend phải ghi thông tin vận chuyển.');
assert.match(read('LegacyDashboardApi.gs'), /authenticateDashboardManager_\(request\.idToken\)/, 'Dashboard cũ phải dùng role manager của hệ thống hợp nhất.');
assert.match(read('LegacyDashboardApi.gs'), /1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI/, 'Dashboard cũ phải đọc database production.');
assert.match(html, /id="legacyDashboardFrame"/, 'Giao diện final phải giữ dashboard cũ cho quản lý.');
for (const field of ['customerName','customerAddress','customerPhone','customerEmail','senderCompany','senderCustomer','senderAddress','senderPhone','senderEmail','carrier','trackingCode']) {
  assert.match(html, new RegExp(`name="${field}"`), `Form thiếu trường ${field}.`);
}

console.log('Validation passed: syntax, HTML script, role guard and KPI smoke tests.');
