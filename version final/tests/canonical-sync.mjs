import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
let revision = 'r1', reads = 0;
const cache = new Map();
const tables = {
  'Hồ sơ thiết bị': Array.from({length:10001}, (_,i) => ({
    'Mã hồ sơ':'case-'+i, 'Số sê-ri (S/N)':'SN-'+i, Model:i===1?'unique-old-case':'MODEL',
    'Nguồn dữ liệu': ['Đồng bộ lịch sử BKE','Đồng bộ lịch sử DAT','XBSolar lịch sử','Quy trình mới'][i%4],
    'Ngày nhận từ khách': i === 0 ? '' : i === 1 ? '2020-01-02' : '2025-07-09',
    'Trung tâm đang giữ hàng': i%2 ? 'DAT Center' : 'BKE Center',
    'Trạng thái hồ sơ': i === 10000 ? 'Đã hủy' : 'Mới tiếp nhận',
    'Tình trạng bảo hành':'Trong bảo hành', 'Người xác nhận bảo hành':'manager'
  })),
  'Công việc trung tâm': [{'Mã hồ sơ':'case-1','Mã công việc':'work-1','Trung tâm xử lý':'DAT Center'}],
  'Lỗi thiết bị': [],
  'Linh kiện sử dụng': [{'Mã công việc':'work-1','Tên linh kiện':'Board chưa có PN','Số lượng':2}]
};
const ctx = {
  console, Date, DATABASE_SPREADSHEET_ID:'fixture',
  Session:{getScriptTimeZone:()=> 'Asia/Saigon'},
  Utilities:{formatDate:d=>d.toISOString().slice(0,10),newBlob:s=>({getBytes:()=>Buffer.from(s)})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='SOURCE_SPREADSHEET_ID'?'fixture':null})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),getAll:ks=>Object.fromEntries(ks.map(k=>[k,cache.get(k)])),putAll:entries=>Object.entries(entries).forEach(([k,v])=>cache.set(k,v))})},
  getPortalDatabaseRevision_:()=>revision,
  readTableShared_:(name,rev,allowStale)=>{assert.equal(rev,revision);assert.equal(allowStale,false);reads++;return tables[name]||[]},
  LockService:{getScriptLock:()=>{throw Error('Nested reader lock is forbidden')}},
  SpreadsheetApp:{openById:()=>{throw Error('Historical sheet scan is forbidden')}}
};
const source = fs.readFileSync(new URL('LegacyDashboardApi.gs',root),'utf8').replace('return { handlePost: doPost };','return { handlePost: doPost, readCanonicalSnapshot_, pageTickets_, buildYearlyTotalsFromRecords_, assertCanonicalRevision_, DEFAULT_CENTERS };');
vm.createContext(ctx);vm.runInContext(source,ctx);
const api = vm.runInContext('LEGACY_DASHBOARD_API',ctx);
const manager = {email:'global',role:'service_manager',centers:[]};
const all = api.pageTickets_({page:1,pageSize:100},manager);
assert.equal(all.total,10000);assert.equal(all.totalPages,100);assert.equal(reads,4);
assert.equal(all.fromYear,2020);assert.equal(all.toYear,2025);
for(let i=0;i<10;i++)assert.equal(api.pageTickets_({page:i+1,pageSize:100},manager).total,10000);
assert.equal(reads,4,'Warm pages must not read Sheets again');
const found = api.pageTickets_({query:'unique-old-case',center:'DAT Center'},manager);
const ticket = found.tickets.find(t=>t.id==='case-1');
assert.equal(ticket.warrantyStatus,'Trong bảo hành');assert.equal(ticket.parts[0].pn,'Board chưa có PN');
const restricted = api.pageTickets_({}, {role:'center_manager',centers:['bke']});
assert.equal(restricted.total,5000);
assert.throws(()=>api.pageTickets_({center:'DAT Center'},{role:'center_manager',centers:['bke']}),{code:'FORBIDDEN'});
const cached = api.readCanonicalSnapshot_('fixture',api.DEFAULT_CENTERS,revision);
assert.equal(cached.records.length,10000);assert.ok(cached.records[1].receivedDate instanceof Date);
const totals = api.buildYearlyTotalsFromRecords_(cached.records,2026);
assert.equal(totals[0].year,2020);assert.equal(totals.reduce((s,y)=>s+y.received,0),9999);
tables['Hồ sơ thiết bị'][1]['Trạng thái hồ sơ']='Đã hủy';revision='r2';
assert.equal(api.pageTickets_({},manager).total,9999,'Deletion must invalidate both snapshot and ticket index');
assert.equal(api.pageTickets_({query:'SN-1'},manager).tickets.some(t=>t.id==='case-1'),false);
assert.throws(()=>api.assertCanonicalRevision_('r1'),{code:'DATA_CHANGED'});
assert.equal(reads,8);
assert.doesNotMatch(fs.readFileSync(new URL('../../../docs/live-data.js',import.meta.url),'utf8'),/fallbackRows=\(live\.tickets/);
console.log('Canonical sync passed: 10,000 cases, migrations, old/missing dates, paged cache, role isolation, parts, cancellation and revision guards.');
