import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8');
const cache=new Map();let revision='parts-r1',reads=0;
const center='Sungrow Service Center',other='DAT Center';
const source=(id,extra={})=>({'Mã hồ sơ':id,'Loại thiết bị':'Inverter','Số lượng':1,'Ngày nhận từ khách':'2026-09-01','Trung tâm đang giữ hàng':other,'Trung tâm tiếp nhận khách':center,'Model':'SG125CX','Trạng thái hồ sơ':'Đang xử lý',...extra});
const work=(id,c)=>({'Mã hồ sơ':id,'Mã công việc':'W-'+id,'Trung tâm xử lý':c});
const part=(id,pn,qty,date,name='Fan')=>({'Mã công việc':'W-'+id,'Mã sử dụng linh kiện':id+'-'+pn+'-'+date,'Mã linh kiện (Part Number)':pn,'Tên linh kiện':name,'Số lượng':qty,'Ngày sử dụng':date});
const tables={'Hồ sơ thiết bị':[source('moved'),source('lot'),source('cancelled',{'Trạng thái hồ sơ':'Đã hủy'})],'Công việc trung tâm':[work('moved',center),work('lot',other),work('cancelled',center)],'Linh kiện sử dụng':[part('moved','PN-A',4,'2026-10-21'),part('moved','PN-A',2,'2026-10-22'),part('moved','PN-B',1,'2026-09-10','Relay'),part('moved','PN-NODATE',7,''),part('moved','PN-ZERO',0,'2026-10-21'),part('lot','PN-A',3,'2026-10-23'),part('cancelled','PN-A',99,'2026-10-23')]};
const ctx={console,Date,APP_VERSION:'test',DATABASE_SPREADSHEET_ID:'fixture',Session:{getScriptTimeZone:()=> 'Asia/Saigon'},Utilities:{formatDate:d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),newBlob:s=>({getBytes:()=>Buffer.from(s)}),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,s)=>crypto.createHash(a).update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='SOURCE_SPREADSHEET_ID'?'fixture':null})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),getAll:ks=>Object.fromEntries(ks.map(k=>[k,cache.get(k)])),putAll:e=>Object.entries(e).forEach(([k,v])=>cache.set(k,v))})},getPortalDatabaseRevision_:()=>revision,readTableShared_:(name)=>{assert.ok(!/^202[456]$/.test(name));reads++;return tables[name]||[];}};
vm.createContext(ctx);vm.runInContext(read('FanLotRules.gs'),ctx);const rules=ctx.SungrowFanLotRules;tables['Hồ sơ thiết bị'][1]=source('lot',{'Loại thiết bị':'Fan','Kiểu hồ sơ':'Fan theo lô','Chi tiết lô Fan':rules.pack(rules.create([{serialNumber:'SN-A',quantity:2},{serialNumber:'SN-B',quantity:1}]))});ctx.flState_=r=>rules.parse(r['Chi tiết lô Fan']);
vm.runInContext(read('ReportExport.gs'),ctx);
tables['Lỗi thiết bị']=[
  {'Mã công việc':'W-moved','Loại ghi nhận':'Lỗi xác nhận','Tên lỗi':'Mất lưới','Ngày xác nhận lỗi':'2026-10-21'},
  {'Mã công việc':'W-moved','Loại ghi nhận':'Lỗi xác nhận','Tên lỗi':'Mất lưới','Ngày xác nhận lỗi':'2026-10-22'},
  {'Mã công việc':'W-moved','Loại ghi nhận':'Lỗi xác nhận','Tên lỗi':'Lỗi tháng trước','Ngày xác nhận lỗi':'2026-09-21'},
  {'Mã công việc':'W-moved','Loại ghi nhận':'Lỗi xác nhận','Tên lỗi':'Thiếu ngày'},
  {'Mã công việc':'W-moved','Loại ghi nhận':'Hiện tượng ban đầu','Tên lỗi':'Không tính hiện tượng','Ngày xác nhận lỗi':'2026-10-21'},
  ...rules.parse(tables['Hồ sơ thiết bị'][1]['Chi tiết lô Fan']).lines.map(l=>({'Mã công việc':'W-lot','Loại ghi nhận':'Lỗi xác nhận','Tên lỗi':'Fan failure','Ngày xác nhận lỗi':'2026-10-21','Mã dòng Fan':l.lineId,'Số Fan xác nhận':l.quantity})),
  {'Mã công việc':'W-cancelled','Loại ghi nhận':'Lỗi xác nhận','Tên lỗi':'Đã hủy','Ngày xác nhận lỗi':'2026-10-21'}
];
vm.runInContext(read('LegacyDashboardApi.gs').replace('return { handlePost: doPost,','return {getDashboard_,readReportData_,readCanonicalSnapshot_, handlePost: doPost,'),ctx);
const api=vm.runInContext('LEGACY_DASHBOARD_API',ctx),actor={isGlobalManager:true,email:'fixture'},spec={type:'parts',start:'2026-10-01',end:'2026-10-31',centers:[],columns:['usedAt','partNumber','partName','quantity','center','caseId','workOrderId','model'],offset:0,limit:1};
let result=api.readReportData_(spec,actor);assert.equal(result.total,3);assert.equal(result.rows[0].caseId,'lot');assert.equal(result.rows[0].quantity,3,'Fan links/quantity do not multiply usage ledger rows');
const all=api.readReportData_({...spec,limit:200},actor);assert.equal(all.rows.reduce((n,r)=>n+r.quantity,0),9);assert.equal(all.rows.filter(r=>r.partNumber==='PN-A').length,3,'Separate usage entries for same PN remain separate');
const scoped=api.readReportData_({...spec,centers:[center],limit:200},actor);assert.equal(scoped.total,2,'Transferred case still exports originating work center usage');assert.equal(scoped.rows[0].center,center);
const summarySpec={...spec,type:'partsSummary',columns:['partNumber','partName','quantity'],limit:200};
const summary=api.readReportData_(summarySpec,actor);assert.equal(summary.total,1);assert.equal(summary.rows[0].quantity,9);assert.equal(summary.totalQuantity,9);assert.equal(all.totalQuantity,summary.totalQuantity,'Summary and ledger export must reconcile');
assert.equal(api.readReportData_({...summarySpec,centers:[center]},actor).rows[0].quantity,6,'Filter work center before grouping PN');
assert.equal(api.readReportData_({...summarySpec,columns:['quantity']},actor).rows[0].quantity,9,'Selecting columns must not change group grain');
assert.throws(()=>api.readReportData_({...summarySpec,columns:['caseId']},actor),{code:'INVALID_REPORT'});
assert.equal(api.readReportData_({...spec,query:'fan'},actor).total,3);assert.equal(api.readReportData_({...spec,query:'pn-b'},actor).total,0);
const next=api.readReportData_({...spec,offset:1,revision:result.revision,asOf:result.asOf},actor);assert.equal(next.fingerprint,result.fingerprint);assert.equal(next.total,3);
const cold=reads;api.readReportData_(spec,actor);assert.equal(reads,cold,'Repeated export pages reuse canonical revision cache');
const dash=api.getDashboard_({period:'2026-10-01..2026-10-31',center:'all',annual:'none'}, {role:'service_manager',email:'fixture',centers:[]});
assert.equal(dash.summary.received,0,'Model/intake remain based on received date, not fault/parts dates');
assert.equal(dash.modelTypes.length,0);
assert.equal(dash.errors.find(e=>e.name==='Mất lưới').count,1,'Repeat confirmation counts a device once per category in the selected period');
assert.equal(dash.errors.find(e=>e.name==='Lỗi quạt').count,3,'Dated Fan errors include all three affected Fan without multiplying links');
assert.equal(dash.errors.length,2,'Out-of-period, undated, initial symptoms and cancelled faults excluded');
assert.equal(dash.parts.reduce((n,p)=>n+p.quantity,0),9,'Parts still use usage dates');
const september=api.getDashboard_({period:'2026-09-01..2026-09-30',center:'all',annual:'none'},{role:'service_manager',email:'fixture',centers:[]});
assert.ok(september.modelTypes.length>0,'Received-month models remain populated');assert.equal(september.errors.length,1);assert.equal(september.errors[0].name,'Lỗi tháng trước');
assert.throws(()=>api.readReportData_(spec,{isGlobalManager:false}),{code:'FORBIDDEN'});
assert.throws(()=>api.readReportData_({...spec,columns:['customerEmail']},actor),{code:'INVALID_REPORT'});
assert.throws(()=>api.readReportData_({...spec,dateBasis:'returned'},actor),{code:'INVALID_REPORT'});
revision='parts-r2';assert.throws(()=>api.readReportData_({...spec,revision:result.revision},actor),{code:'REPORT_CHANGED'});
tables['Linh kiện sử dụng'].push(part('moved','pn-a',1,'2026-10-24','Alternate name'),...Array.from({length:205},(_,i)=>({...part('moved','PN-BULK',1,'2026-10-24'),'Mã sử dụng linh kiện':'BULK-'+i})),part('moved','',1,'2026-10-24','Unnamed A'),part('moved','',2,'2026-10-24','Unnamed B'));
revision='parts-r3';const bulk=api.readReportData_({...summarySpec,limit:1},actor);assert.equal(bulk.total,4);assert.equal(bulk.rows[0].quantity,205,'Combine every usage entry before server pagination');assert.equal(bulk.totalQuantity,218);const bulkNext=api.readReportData_({...summarySpec,offset:1,limit:1,revision:bulk.revision,asOf:bulk.asOf},actor);assert.equal(bulkNext.rows[0].partNumber,'PN-A');assert.equal(bulkNext.rows[0].quantity,10,'Normalize PN case when aggregating');assert.equal(bulkNext.fingerprint,bulk.fingerprint);
assert.equal(api.readReportData_({...summarySpec,query:'alternate'},actor).rows[0].quantity,10,'Name search keeps complete totals of a matching PN');assert.equal(api.readReportData_({...summarySpec,query:'unnamed'},actor).total,2,'Do not collapse different names without PN');
console.log('Parts report passed: ledger grain, Fan links, transfer center, date/query, cancelled/invalid rows, stable pages/cache, role and revision guards.');
console.log('PN summary passed: cross-center/entry totals, detail reconciliation, grouping before paging, selected columns, PN case and unknown-code separation.');
console.log('Dashboard date bases passed: prior-month receipt/current-month confirmed faults, distinct dates, Fan quantities, missing dates and unchanged model/part periods.');
