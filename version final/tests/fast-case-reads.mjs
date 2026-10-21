import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'),cache=new Map(),requests=[];
let revision='r1',forceFailure=false;
const ctx={console,Date,Session:{getScriptTimeZone:()=> 'Asia/Saigon'}};vm.createContext(ctx);vm.runInContext(read('Code.gs')+'\n'+read('FastCaseReads.gs'),ctx);
const names=vm.runInContext('SHEETS',ctx),serial=Date.parse('2026-10-20T00:00:00Z')/86400000+25569;
const dateCell={effectiveValue:{numberValue:serial},effectiveFormat:{numberFormat:{type:'DATE'}},formattedValue:'20/10/2026'};
const record={'Mã hồ sơ':'CASE','Loại thiết bị':'Inverter','Model':'SG110CX','Số sê-ri (S/N)':'00123','Số lượng':2,'Trung tâm tiếp nhận khách':'DAT Center','Trung tâm đang giữ hàng':'DAT Center','Trạng thái hồ sơ':'Đang xử lý','Tình trạng bảo hành':'Chờ xác nhận','Ngày nhận từ khách':dateCell};
const data={
 [names.cases]:[record,{'Mã hồ sơ':'OTHER','Model':'PRIVATE'}],
 [names.workOrders]:[{'Mã hồ sơ':'CASE','Mã công việc':'WORK','Trung tâm xử lý':'DAT Center','Trạng thái xử lý':'Đang kiểm tra','Ngày trung tâm nhận hàng':dateCell},{'Mã hồ sơ':'OTHER','Mã công việc':'PRIVATE','Trung tâm xử lý':'BKE Center'}],
 [names.transfers]:[{'Mã hồ sơ':'OTHER','Mã luân chuyển':'PRIVATE'}],
 [names.issues]:[{'Mã công việc':'PRIVATE','Tên lỗi':'Private'},{'Mã công việc':'WORK','Tên lỗi':'AC Relay','Mã lỗi':'E1'}],
 [names.parts]:[{'Mã công việc':'WORK','Mã sử dụng linh kiện':'PART','Mã linh kiện (Part Number)':'PN','Tên linh kiện':'Board','Số lượng':2,'Ngày sử dụng':dateCell}],
 [names.holds]:[{'Mã công việc':'WORK','Lý do tạm dừng':'Internal','Ngày bắt đầu':dateCell}],
 [names.audit]:[{'Mã đối tượng':'CASE','Hành động':'Yêu cầu duyệt bảo hành','Email người dùng':'staff@test','Thời gian':dateCell,'Dữ liệu sau':'{"note":"Private review note"}'}]
};
const tables=Object.entries(data).map(([title,rows],sheetId)=>({title,sheetId,rows,headers:[...new Set(rows.flatMap(r=>Object.keys(r)))]}));
const cell=v=>v&&v.effectiveValue?v:{effectiveValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v??''},formattedValue:String(v??'')};
const response=object=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(object)});
Object.assign(ctx,{getPortalDatabaseRevision_:()=>revision,digest_:v=>createHash('sha256').update(v).digest('hex'),CacheService:{getScriptCache:()=>({})},readPortalChunkedCache_:(_,k)=>cache.get(k)||null,writePortalChunkedCache_:(_,k,v)=>{cache.set(k,JSON.parse(JSON.stringify(v)));return true;},ScriptApp:{getOAuthToken:()=> 'fixture'},notificationRequestState_:()=>{throw Error('Must not read the audit again');},readPortalCaseIndex_:()=>{throw Error('LEGACY_FALLBACK');},UrlFetchApp:{fetch(url,options){assert.equal(options.headers.Authorization,'Bearer fixture');requests.push({url,method:options.method});if(forceFailure)return{getResponseCode:()=>503};const u=new URL(url);
 if(u.pathname.endsWith('/values:batchGet'))return response({valueRanges:u.searchParams.getAll('ranges').map(range=>{const match=range.match(/^'(.+)'!([A-Z]+)2:/),table=tables.find(t=>t.title===match[1]),col=[...match[2]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;return{values:table.rows.map(r=>[String(r[table.headers[col]]??'')])};})});
 if(u.pathname.endsWith(':getByDataFilter')){const body=JSON.parse(options.payload);assert.equal(body.includeGridData,true);const sheets=tables.flatMap(table=>{const ranges=body.dataFilters.map(f=>f.gridRange).filter(r=>r.sheetId===table.sheetId);if(!ranges.length)return[];return[{properties:{sheetId:table.sheetId},data:ranges.map(r=>({startRow:r.startRowIndex,startColumn:0,rowData:table.rows.slice(r.startRowIndex-1,r.endRowIndex-1).map(row=>({values:table.headers.map(h=>cell(row[h]))}))}))}];});return response({sheets});}
 assert.equal(options.method,'get');assert.equal(u.searchParams.getAll('ranges').length,7);return response({properties:{timeZone:'Asia/Saigon'},sheets:tables.map(t=>({properties:{sheetId:t.sheetId,title:t.title},data:[{rowData:[{values:t.headers.map(h=>({formattedValue:h}))}]}]}))});
 }}});
const a=ctx.readFastCaseBundle_('CASE',revision);assert.equal(a.cacheHit,false);assert.equal(requests.length,3,'One schema + one locator batch + one source batch');assert.equal(a.bundle.record['Số sê-ri (S/N)'],'00123');assert.equal(a.bundle.record['Ngày nhận từ khách'].toISOString(),'2026-10-19T17:00:00.000Z');assert.equal(a.bundle.issues.length,1);assert.equal(a.bundle.issues[0]['Tên lỗi'],'AC Relay');assert.equal(a.bundle.transfers.length,0);
const warm=ctx.readFastCaseBundle_('CASE',revision);assert.equal(warm.cacheHit,true);assert.equal(requests.length,3);assert.ok(warm.bundle.parts[0]['Ngày sử dụng'] instanceof Date);
revision='r2';ctx.readFastCaseBundle_('CASE',revision);assert.equal(requests.length,5,'Revision change reads locators/source again, schema remains valid');ctx.readFastCaseBundle_('CASE',revision,0,true);assert.equal(requests.length,8,'Explicit refresh bypasses all source caches');
const actor={email:'staff@test',roleCode:'center_staff',homeCenter:'DAT Center',isGlobalManager:false,centers:['DAT Center'],capabilities:{viewCases:true,updateWorkOrder:true}};
const own=ctx.getCaseDetailForActor_(actor,'CASE');assert.equal(own.workOrders.length,1);assert.equal(own.warrantyRequest.requestedBy,'staff@test');assert.equal(own.warrantyRequest.note,undefined);assert.equal(own.readTiming.path,'batch');assert.throws(()=>ctx.getCaseDetailForActor_({...actor,centers:['JGP Center']},'CASE'),/không có quyền/);
const manager={...actor,roleCode:'service_manager',isGlobalManager:true,canDeleteAnyCase:true,capabilities:{...actor.capabilities,approveWarranty:true}};assert.equal(ctx.getCaseDetailForActor_(manager,'CASE').warrantyRequest.note,'Private review note');
assert.equal(ctx.fastReadCellValue_({effectiveValue:{boolValue:false}},'Asia/Saigon'),false);assert.equal(ctx.fastReadCellValue_({effectiveValue:{numberValue:0}},'Asia/Saigon'),0);assert.equal(ctx.fastReadCellValue_({effectiveValue:{errorValue:{}},formattedValue:'#N/A'},'UTC'),'#N/A');assert.equal(ctx.fastReadCellValue_(dateCell,'UTC').toISOString(),'2026-10-20T00:00:00.000Z');
// A moved row cannot leak a different work order's child records.
const locators=ctx.fastReadLocators_(ctx.fastReadSchema_(),'r2');cache.delete(ctx.fastReadCacheKey_('bundle','CASE|r2'));data[names.parts][0]['Mã công việc']='PRIVATE';assert.throws(()=>ctx.readFastCaseBundle_('CASE','r2'),/FAST_READ_ROW_MOVED/);data[names.parts][0]['Mã công việc']='WORK';
cache.clear();forceFailure=true;assert.throws(()=>ctx.getCaseDetailForActor_(actor,'CASE'),/LEGACY_FALLBACK/);
let detailCalls=0;ctx.updateWorkOrder=()=>({ok:true});ctx.getCaseDetail=()=>{detailCalls++;return{caseId:'CASE',dataRevision:'r2'};};
let saved=ctx.handlePortalApi_({functionName:'updateWorkOrder',args:['token',{}],returnCaseDetail:'CASE'});assert.equal(saved.caseDetail.caseId,'CASE');assert.equal(detailCalls,1);
ctx.getCaseDetail=()=>{throw Error('Read unavailable after commit');};saved=ctx.handlePortalApi_({functionName:'updateWorkOrder',args:['token',{}],returnCaseDetail:'CASE'});assert.equal(saved.ok,true);assert.equal(saved.caseDetailUnavailable,true,'A failed post-save read must not report the save as failed');
console.log('Fast case reads passed: 3 cold REST reads / 0 warm reads, revision/explicit refresh, Date/number/bool/error preservation, leading-zero SN, source order, cache authorization, private notes, row-move guard and legacy fallback.');
