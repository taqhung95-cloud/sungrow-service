import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const c={console,Date};vm.createContext(c);
vm.runInContext(read('WorkOrderRules.gs'),c);
vm.runInContext(read('LegacyDashboardApi.gs').replace('const LEGACY_DASHBOARD_API = (function () {','const LEGACY_DASHBOARD_API = (function () {\nglobalThis.metrics={slaAverages_,slaDays_};'),c);
const context={receivedAt:'2026-10-15',readyAt:'2026-10-21',returnedAt:'2026-10-26',today:'2026-10-27'};
const h=(reason,startAt,endAt)=>({reason,startAt,endAt});
const internal=h('Chờ linh kiện','2026-10-17','2026-10-21');
const customer=h('Khách hàng yêu cầu giữ hàng','2026-10-21','2026-10-24');
const carrier=h('Chờ vận chuyển','2026-10-24','2026-10-26');
const check=(holds,ctx={})=>c.SungrowWorkOrderRules.validateHolds(holds,{...context,...ctx});
assert.equal(check([internal,customer,carrier]).length,0);
for(const holds of [[h('Chờ linh kiện','2026-10-17','2026-10-24')],[h('Chờ linh kiện','2026-10-17','')],[h('Chờ vận chuyển','2026-10-20','2026-10-26')],[h('Chờ vận chuyển','2026-10-21','2026-10-27')],[h('Chờ vận chuyển','2026-10-21','')],[h('Chờ linh kiện','2026-10-14','2026-10-16')]])assert.ok(check(holds).length);
assert.ok(check([customer],{readyAt:''}).length);
assert.equal(check([h('Chờ linh kiện','2026-10-17','')],{readyAt:'',returnedAt:''}).length,0);
assert.equal(check([h('Chờ vận chuyển','2026-10-21','')],{returnedAt:''}).length,0);
const d=s=>new Date(s+'T00:00:00Z');
const record={quantity:1,receivedDate:d(context.receivedAt),readyDate:d(context.readyAt),returnDate:d(context.returnedAt)};
const metrics=holds=>c.metrics.slaAverages_([{...record,holds:holds.map(x=>({reason:x.reason,start:x.startAt,end:x.endAt}))}]);
assert.deepEqual(JSON.parse(JSON.stringify(metrics([internal]))),{actual:11,net:7,paused:4});
assert.equal(metrics([internal,customer,carrier]).net,2);
assert.equal(metrics([internal,customer,carrier,h('Chờ vận chuyển','2026-10-22','2026-10-26')]).paused,9,'Overlapping reasons are counted once.');
assert.equal(metrics([h('Chờ linh kiện','2026-10-17','2026-10-24')]).paused,4,'Legacy internal range is bounded by ready date without changing source.');
assert.equal(c.metrics.slaDays_({...record,holds:[{reason:internal.reason,start:internal.startAt,end:internal.endAt}]}),7);
assert.equal(c.metrics.slaDays_({...record,holds:[]}),11);
// Date edits and delivery must check saved holds across every work order.
const code=read('Code.gs'),a=code.indexOf('function assertSlaHoldsForCase_('),b=code.indexOf('\nfunction ',a+1);
let saved=[{'Mã công việc':'OLD','Lý do tạm dừng':'Chờ linh kiện','Ngày bắt đầu':d('2026-10-17'),'Ngày kết thúc':d('2026-10-24')}];
Object.assign(c,{prepareSlaHoldValidation_(){},SHEETS:{workOrders:'works',holds:'holds'},readScopedTable_:name=>({rows:name==='works'?[{'Mã hồ sơ':'CASE','Mã công việc':'OLD'},{'Mã hồ sơ':'CASE','Mã công việc':'NEW'}]:saved}),iso_:v=>v instanceof Date?v.toISOString().slice(0,10):v||'',Utilities:{formatDate:()=>context.today},publicError_:m=>Error(m)});
vm.runInContext(code.slice(a,b),c);
const source={'Mã hồ sơ':'CASE','Ngày nhận từ khách':d(context.receivedAt)};
assert.throws(()=>c.assertSlaHoldsForCase_(source,context.readyAt,context.returnedAt),/nội bộ/);
c.assertSlaHoldsForCase_(source,context.readyAt,context.returnedAt,'OLD',[internal,customer,carrier]);
saved=[];c.assertSlaHoldsForCase_(source,context.readyAt,context.returnedAt);
assert.match(code,/assertSlaHoldsForCase_\(record,iso_\(readyAt\),iso_\(returnedAt\)\)/);
assert.match(read('FanWorkOrders.gs'),/assertSlaHoldsForCase_\(row,payload.readyAt,date\)/);
assert.match(fs.readFileSync(new URL('../../docs/entry.html',import.meta.url),'utf8'),/Thêm khoảng tạm dừng/);
const center='Sungrow Service Center';
const tables={
 'Hồ sơ thiết bị':['PASS','FAIL','MULTI'].map(id=>({'Mã hồ sơ':id,'Loại thiết bị':'Inverter','Model':'FIXTURE','Số lượng':1,'Ngày nhận từ khách':context.receivedAt,'Ngày sẵn sàng trả khách':context.readyAt,'Ngày trả khách':context.returnedAt,'Trạng thái hồ sơ':'Đã hoàn tất','Trung tâm tiếp nhận khách':center,'Trung tâm đang giữ hàng':center})),
 'Công việc trung tâm':['PASS','FAIL','MULTI'].map(id=>({'Mã hồ sơ':id,'Mã công việc':'W-'+id,'Trung tâm xử lý':center,'Trạng thái xử lý':'Hoàn tất kỹ thuật','Ngày hoàn tất kỹ thuật':context.readyAt})),
 'Tạm dừng SLA':[['PASS',internal],['MULTI',internal],['MULTI',customer],['MULTI',carrier]].map(([id,h])=>({'Mã công việc':'W-'+id,'Lý do tạm dừng':h.reason,'Ngày bắt đầu':h.startAt,'Ngày kết thúc':h.endAt}))
};
const cache=new Map(),apiContext={console,Date,DATABASE_SPREADSHEET_ID:'fixture',Session:{getScriptTimeZone:()=> 'Asia/Saigon'},Utilities:{formatDate:d=>d.toISOString().slice(0,10),newBlob:s=>({getBytes:()=>Buffer.from(s)})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='SOURCE_SPREADSHEET_ID'?'fixture':null})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),getAll:ks=>Object.fromEntries(ks.map(k=>[k,cache.get(k)])),putAll:e=>Object.entries(e).forEach(([k,v])=>cache.set(k,v))})},getPortalDatabaseRevision_:()=> 'sla-test',readTableShared_:name=>tables[name]||[]};
vm.createContext(apiContext);vm.runInContext(read('LegacyDashboardApi.gs').replace('return { handlePost: doPost, readDiagnostics: diagnoseReadPaths_, slaDays: slaDays_ };','return {getDashboard_};'),apiContext);
const dashboard=vm.runInContext('LEGACY_DASHBOARD_API',apiContext).getDashboard_({period:'2026-10',center},{role:'service_manager',email:'fixture',centers:[]});
assert.equal(dashboard.summary.slaEligible,3);assert.equal(dashboard.summary.slaMet,2,'Actual dashboard rate must use net days.');
assert.equal(dashboard.centers.find(x=>x.name===center||x.center===center).slaMet,2,'Center and overview use the same eligibility.');
console.log('SLA holds passed: phase/date boundaries, open/closed holds, multiple reasons, union, legacy clipping, net 7-day eligibility and cross-work saved-hold guards.');
