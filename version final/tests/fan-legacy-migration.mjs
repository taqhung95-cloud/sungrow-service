import {migrationHarness as h} from './fan-lots.mjs';
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8');
const {ctx,data,headers,R,props}=h,center='Sungrow Service Center';
Object.assign(ctx.SHEETS,{transfers:'transfers',caseIndex:'index',audit:'audit'});data.transfers=[];data.index=[];data.audit=[];headers.audit=['Thời gian','Email người dùng','Hành động','Loại đối tượng','Mã đối tượng','Trung tâm','Dữ liệu trước','Dữ liệu sau'];
headers.cases.push('Số sê-ri (S/N)','Model','Người hủy','Ngày hủy','Lý do hủy','Ghi chú chung','Nguồn dữ liệu','Mã khách hàng');headers.groups.push('Hồ sơ lô Fan');
const groups=[];
for(const [prefix,n] of [['MIGA',9],['MIGB',3]]){
 const ids=[];for(let i=0;i<n;i++){
  const id=prefix+'-'+i,serial=i===n-1?prefix+'-SN-'+(i-1):prefix+'-SN-'+i;ids.push(id);
  data.cases.push({'Mã hồ sơ':id,'Loại thiết bị':'Fan','Số sê-ri (S/N)':serial,'Model':'INVERTER-MODEL','Số lượng':1,'Trung tâm tiếp nhận khách':center,'Trung tâm đang giữ hàng':center,'Ngày nhận từ khách':'2026-10-15','Trạng thái hồ sơ':'Mới tiếp nhận','Nguồn dữ liệu':'Quy trình mới','Tên khách hàng':prefix,'Mã khách hàng':prefix,'Tình trạng bảo hành':prefix==='MIGA'&&i>=7?'Trong bảo hành':'Chờ xác nhận','Liên kết hồ sơ Drive':'https://drive.google.com/drive/folders/'+id});
  data.works.push({'Mã công việc':'W-'+id,'Mã hồ sơ':id,'Trung tâm xử lý':center,'Ngày trung tâm nhận hàng':'2026-10-15','Trạng thái xử lý':'Đã nhận hàng','Ghi chú nội bộ':'Original note'});
  data.issues.push({'Mã ghi nhận lỗi':'I-'+id,'Mã công việc':'W-'+id,'Loại ghi nhận':'Hiện tượng ban đầu','Tên lỗi':'Fan stopped'});
 }
 const gid='GROUP-'+prefix;groups.push(gid);data.groups.push({'Mã nhóm':gid,'Tên nhóm':prefix,'Danh sách hồ sơ':JSON.stringify(ids)});
}
const files=new Map();let fileCount=0,failSync=false;
ctx.spreadsheet_=()=>({getId:()=> 'fixture',getSheetByName:n=>({getSheetId:()=>n})});
Object.assign(ctx,{APP_VERSION:'1.11.3-fan-kpi',LEGACY_DASHBOARD_API:{fanLegacyKpiReady:true},FAN_MANAGER_LEGACY_KPI_READY_:true,DATABASE_SPREADSHEET_ID:'fixture',MimeType:{PLAIN_TEXT:'text/plain'},portalReadDiagnosticActor_:()=>({email:'manager'}),doiSoatFanTheoLo:()=>({ok:true,errors:[],pending:[]}),DriveApp:{getFileById:id=>({makeCopy:()=>{const id='backup-'+(++fileCount);return {getId:()=>id};},getBlob:()=>({getDataAsString:()=>files.get(id)})}),createFile:(name,text)=>{const id='receipt-'+(++fileCount);files.set(id,text);return {getId:()=>id};}},syncDashboardProjectionCase_:()=>({ok:!failSync})});
vm.runInContext(read('FanLegacyMigration.gs'),ctx);
const preview=ctx.fmgPreview_(groups);assert.throws(()=>ctx.fmgApply_(groups),/Deploy New version/);ctx.fmgMarkWebRuntime_();assert.equal(preview.writtenToDatabase,false);assert.deepEqual(Array.from(preview.groups,g=>[g.sourceCases,g.fans,g.serials,g.kpiBefore,g.kpiAfter]),[[9,9,8,9,1],[3,3,2,3,1]]);
const sourceBefore=JSON.stringify(data.cases),partsBefore=JSON.stringify(data.parts),issuesBefore=JSON.stringify(data.issues),beforeCommits=h.getCommits();
data.cases.find(r=>r['Mã hồ sơ']==='MIGA-0').Model='edited';assert.throws(()=>ctx.fmgApply_(groups),/Nguồn thay đổi/);data.cases.find(r=>r['Mã hồ sơ']==='MIGA-0').Model='INVERTER-MODEL';
h.setFailWrite(true);assert.throws(()=>ctx.fmgApply_(groups),/HTTP 400/);assert.equal(JSON.stringify(data.cases),sourceBefore);assert.equal(props.has('FAN_CONVERSION_PENDING'),false);h.setFailWrite(false);
failSync=true;assert.throws(()=>ctx.fmgApply_(groups),/chưa đồng bộ đủ/);assert.equal(h.getCommits(),beforeCommits+1);assert.ok(props.has('FAN_CONVERSION_PENDING'));failSync=false;
const result=ctx.fmgApply_(groups);assert.equal(result.ok,true);assert.equal(result.convertedLots,2);assert.equal(result.sourceCases,12);assert.equal(result.kpiBefore,12);assert.equal(result.kpiAfter,2);assert.equal(JSON.stringify(data.parts),partsBefore);assert.equal(JSON.stringify(data.issues),issuesBefore);assert.equal(props.has('FAN_CONVERSION_PENDING'),false);
assert.equal(data.audit.length,2);assert.equal(ctx.fmgApply_(groups).alreadyConverted,true);assert.equal(h.getCommits(),beforeCommits+1,'Recovery/replay must not append another migration.');
const lotA=data.cases.find(r=>r['Mã hồ sơ']==='MIGA-0'),lotB=data.cases.find(r=>r['Mã hồ sơ']==='MIGB-0');
assert.equal(R.parse(lotA['Chi tiết lô Fan']).files.length,9);assert.equal(R.parse(lotA['Chi tiết lô Fan']).lines.at(-1).quantity,2);assert.equal(R.parse(lotA['Chi tiết lô Fan']).lines.at(-1).warrantyStatus,'Trong bảo hành');
assert.equal(data.cases.filter(r=>/^MIG/.test(r['Mã hồ sơ'])&&r['Trạng thái hồ sơ']==='Đã hủy').length,10);
assert.equal(data.works.filter(w=>w['Mã hồ sơ']==='MIGA-0').length,9);assert.equal(data.works.filter(w=>w['Mã hồ sơ']==='MIGB-0').length,3);
const tables={'Hồ sơ thiết bị':data.cases.filter(r=>/^MIG/.test(r['Mã hồ sơ'])),'Công việc trung tâm':data.works.filter(w=>/^W-MIG/.test(w['Mã công việc'])),'Lỗi thiết bị':[],'Linh kiện sử dụng':[],'Nhật ký lô Fan':data.events.filter(e=>/^MIG/.test(e['Mã hồ sơ']))},cache=new Map();
const reader={console,Date,DATABASE_SPREADSHEET_ID:'fixture',Session:{getScriptTimeZone:()=> 'Asia/Saigon'},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='SOURCE_SPREADSHEET_ID'?'fixture':null})},getPortalDatabaseRevision_:()=> 'migration-r1',readTableShared_:name=>tables[name]||[],Utilities:{formatDate:d=>d.toISOString().slice(0,10),newBlob:s=>({getBytes:()=>Buffer.from(s)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),getAll:ks=>Object.fromEntries(ks.map(k=>[k,cache.get(k)])),putAll:e=>Object.entries(e).forEach(([k,v])=>cache.set(k,v))})}};
vm.createContext(reader);vm.runInContext(read('FanLotRules.gs'),reader);reader.flState_=r=>reader.SungrowFanLotRules.parse(r['Chi tiết lô Fan']);
vm.runInContext(read('LegacyDashboardApi.gs').replace('return { handlePost: doPost, readDiagnostics: diagnoseReadPaths_, slaDays: slaDays_ };','return {getDashboard_,pageTickets_};'),reader);const api=vm.runInContext('LEGACY_DASHBOARD_API',reader),actor={role:'service_manager',email:'fixture',centers:[]};
const dashboard=api.getDashboard_({period:'2026-10-15..2026-10-17',center},actor);assert.equal(dashboard.summary.received,2);assert.equal(dashboard.summary.receivedCases,2);assert.equal(dashboard.summary.processing,2);assert.equal(dashboard.summary.fan.received,12);assert.equal(dashboard.parts.length,0);assert.equal(api.pageTickets_({query:'MIGA-SN-7',page:1,pageSize:20},actor).total,1);assert.equal(api.pageTickets_({query:'MIGA-8',page:1,pageSize:20},actor).total,1);
assert.equal(R.kpiQuantity(R.parse(lotA['Chi tiết lô Fan'])),1,'Existing legacy snapshot keeps its provenance but counts as one lot.');
Object.assign(reader,{APP_VERSION:'test',SHEETS:{cases:'Hồ sơ thiết bị',workOrders:'Công việc trung tâm'},CENTERS:[center],authenticate_:()=>({isGlobalManager:true}),clean_:v=>String(v??'').trim(),asDate_:v=>v?new Date(v):null,senderFromCase_:()=>'',publicError_:m=>Error(m),groupBy_:(rows,key)=>rows.reduce((out,row)=>{(out[row[key]]||=[]).push(row);return out;},{})});
vm.runInContext(read('ManagerDashboard.gs'),reader);
assert.equal(reader.getManagerDashboard('manager',{year:2026,month:10}).kpis.received,2,'Direct manager dashboard must match canonical lot units.');
const nParts=data.parts.length;ctx.updateFanLot('manager',{caseId:'MIGA-0',requestId:'migrated-technical-00000001',expectedFingerprint:ctx.digest_(R.pack(R.parse(lotA['Chi tiết lô Fan']))),action:{kind:'technical',lineId:'F8',quantity:2,date:'2026-10-17',outcome:'Đổi thiết bị',parts:[{partNumber:'FAN-PN',name:'Fan',quantity:2,usedAt:'2026-10-17'}]}});assert.equal(data.parts.length,nParts+1);assert.equal(data.parts.at(-1)['Số lượng'],2);assert.equal(data.parts.at(-1)['Mã công việc'],'W-MIGA-8');assert.equal(R.parse(data.cases.find(r=>r['Mã hồ sơ']==='MIGA-0')['Chi tiết lô Fan']).lines.at(-1).completed,2);
const broken=R.parse(lotA['Chi tiết lô Fan']);broken.legacyImport.kpiQuantity=1;assert.throws(()=>R.parse(broken),/KPI/);
console.log('Fan legacy migration passed: 12 sources → 2 operational lots, 8+2 S/N, approved warranty/files/work IDs retained, KPI 2 lots / physical 12 Fan, no spare-part changes, stale preview, failed batch, recovery and replay.');
