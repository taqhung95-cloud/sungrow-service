import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../Code.gs',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const stats={cells:0,reads:0,ranges:[]};
const rows=Array.from({length:10000},(_,i)=>[i<30||i===5000?'TARGET':'OTHER',i,'value-'+i]);
const headers=['Key','Order','Value'];
const sheet={getLastRow:()=>rows.length+1,getLastColumn:()=>3,getRange(row,column,height=1,width=1){
  const values=()=>{stats.cells+=height*width;stats.reads++;stats.ranges.push([row,column,height,width]);return row===1?[headers.slice(column-1,column-1+width)]:rows.slice(row-2,row-2+height).map(r=>r.slice(column-1,column-1+width));};
  return {getValues:values,getDisplayValues:()=>values().map(r=>r.map(String)),createTextFinder(pattern){const finder={useRegularExpression:v=>{assert.equal(v,true);return finder;},matchCase:v=>{assert.equal(v,true);return finder;},matchEntireCell:v=>{assert.equal(v,true);return finder;},matchFormulaText:v=>{assert.equal(v,false);return finder;},findAll(){stats.reads++;const regex=new RegExp(pattern);return rows.slice(row-2,row-2+height).flatMap((r,i)=>regex.test(String(r[column-1]))?[{getRow:()=>row+i}]:[]).reverse();}};return finder;}};
}};
const ctx={console,Date};vm.createContext(ctx);vm.runInContext(source,ctx);
ctx.spreadsheet_=()=>({getSheetByName:name=>name==='fixture'?sheet:null});
const matched=ctx.findTableRowsByField_('fixture','Key',['TARGET','TARGET']);
assert.equal(matched.length,31);assert.deepEqual(plain(matched.map(r=>r.__rowNumber)),[...Array.from({length:30},(_,i)=>i+2),5002]);
assert.equal(stats.reads,4,'Header, key column and two contiguous runs only');
assert.equal(stats.cells,3+31*3,'Only headers and matched rows are transferred');
assert.deepEqual(plain(matched.map(r=>r.Value)),rows.filter(r=>r[0]==='TARGET').map(r=>r[2]));
assert.equal(stats.ranges.filter(r=>r[1]===1&&r[3]===3&&r[0]>1).length,2);
assert.equal(ctx.findTableRowsByField_('missing','Key',['TARGET']).length,0);
assert.equal(ctx.findTableRowsByField_('fixture','Unknown',['TARGET']).length,0);
assert.equal(ctx.findTableRowsByField_('fixture','Key',[]).length,0);
assert.equal(ctx.findTableRowsByField_('fixture','Key',['ABSENT']).length,0);
rows[100][0]='  SN.(A)+$[1]\\X  ';
assert.equal(ctx.findTableRowsByField_('fixture','Key',['SN.(A)+$[1]\\X'])[0].Order,100);
assert.equal(ctx.findTableRowsByField_('fixture','Key',['sn.(A)+$[1]\\X']).length,0);
rows[101][0]='';assert.equal(ctx.findTableRowsByField_('fixture','Key',['']).length,1);
assert.equal(ctx.findTableRowsByField_('fixture','Key',Array.from({length:21},(_,i)=>i?'missing-'+i:'TARGET')).length,31);

// Run the actual projection builder with both old full-table selection and the
// scoped selector. Include initial issues, multiple works and unrelated rows.
const tables={cases:[{'Mã hồ sơ':'OTHER'},{'Mã hồ sơ':'TARGET','Loại thiết bị':'Fan','Model':'FAN-X','Số sê-ri (S/N)':'SN','Trạng thái hồ sơ':'Đang xử lý'}],works:[{'Mã hồ sơ':'TARGET','Mã công việc':'W1'},{'Mã hồ sơ':'OTHER','Mã công việc':'W3'},{'Mã hồ sơ':'TARGET','Mã công việc':'W2','Kết quả xử lý':'Đã sửa chữa','Trung tâm xử lý':'Center','Ngày hoàn tất kỹ thuật':'2026-10-21'}],issues:[{'Mã công việc':'W1','Tên lỗi':'Initial','Loại ghi nhận':'Hiện tượng ban đầu'},{'Mã công việc':'W1','Tên lỗi':'Confirmed','Mã lỗi':'E1'},{'Mã công việc':'W3','Tên lỗi':'Private'}],parts:[{'Mã công việc':'W2','Mã linh kiện (Part Number)':'PN1','Số lượng':2},{'Mã công việc':'W3','Mã linh kiện (Part Number)':'PRIVATE'}]};
function projection(legacy){
 const writes=[];const c={console,Date};vm.createContext(c);
 let code=source;
 if(legacy)code=code.replace("findTableRowsByField_(SHEETS.cases, 'Mã hồ sơ', [caseId])[0]","readTable_(SHEETS.cases).find(item=>clean_(item['Mã hồ sơ'])===caseId)")
 .replace("const works = findTableRowsByField_(SHEETS.workOrders, 'Mã hồ sơ', [caseId]);\n    const latest", "const works = readTable_(SHEETS.workOrders).filter(item=>clean_(item['Mã hồ sơ'])===caseId);\n    const latest")
 .replace("findTableRowsByField_(SHEETS.issues, 'Mã công việc', workIds)","readTable_(SHEETS.issues).filter(item=>workIds.includes(clean_(item['Mã công việc'])))")
 .replace("findTableRowsByField_(SHEETS.parts, 'Mã công việc', workIds)","readTable_(SHEETS.parts).filter(item=>workIds.includes(clean_(item['Mã công việc'])))");
 vm.runInContext(code,c);const names=vm.runInContext('SHEETS',c),data=Object.fromEntries(Object.keys(tables).map(key=>[names[key==='works'?'workOrders':key],tables[key]]));
 const output={getMaxColumns:()=>31,getLastColumn:()=>31,getLastRow:()=>2,getMaxRows:()=>20,getRange(row,col,height=1,width=1){return {getDisplayValues:()=>row===1?[Array.from({length:31},(_,i)=>i===30?'Mã hồ sơ':i===29?'Drive Link':'')]:[['TARGET']],getValue:()=>col===30?'Drive Link':1,setValues:v=>writes.push([row,col,plain(v)]),setValue:v=>writes.push([row,col,v]),setNumberFormat:()=>{}};}};
 Object.assign(c,{SpreadsheetApp:{flush(){}},spreadsheet_:()=>({getSheetByName:()=>output}),readTable_:name=>{assert.ok(legacy,'Scoped projection must not read entire source tables');return data[name];},findTableRowsByField_:(name,key,ids)=>data[name].filter(r=>ids.includes(r[key])),senderFromCase_:()=>'',projectFromCase_:()=>'',safeDriveLink_:()=>''});
 assert.equal(c.syncDashboardProjectionCase_('TARGET').ok,true);return writes;
}
assert.deepEqual(projection(false),projection(true));
const timings=[];let released=0;
Object.assign(ctx,{console:{log:s=>timings.push(JSON.parse(s))},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})}});
assert.equal(ctx.withSerializedWrite_('test save',()=>7),7);
assert.throws(()=>ctx.withSerializedWrite_('test failure',()=>{throw Error('fixture failure');}),/fixture failure/);
assert.equal(released,2);assert.deepEqual(timings.map(t=>t.ok),[true,false]);
assert.equal(vm.runInContext('PORTAL_WRITE_TIMING_',ctx),null);
assert.equal(vm.runInContext('PORTAL_WRITE_HEADERS_',ctx),null);
assert.ok(timings.every(t=>t.serverMs>=0&&t.projectionMs===0&&t.indexMs===0));
assert.ok(timings.every(t=>Object.keys(t).sort().join(',')==='event,indexMs,ok,operation,projectionMs,serverMs,version'));
const synced=[];let flushes=0;const caseSource={id:'saved'};
Object.assign(ctx,{SpreadsheetApp:{flush:()=>flushes++},findTableRowsByField_:(name)=>name===vm.runInContext('SHEETS.cases',ctx)?[caseSource]:[],syncDashboardProjectionCase_:(id,bundle)=>{synced.push(bundle);return {ok:true};},syncPortalCaseIndexCase_:(id,bundle)=>{synced.push(bundle);return {ok:true};}});
assert.equal(ctx.syncCaseDerived_('CASE').projection.ok,true);assert.equal(flushes,1);assert.equal(synced[0],synced[1]);assert.equal(synced[0].record,caseSource);
const removed=[],stored=Array.from({length:12},(_,i)=>i+1);
ctx.spreadsheet_=()=>({getSheetByName:()=>({getLastRow:()=>stored.length,deleteRow:r=>{removed.push([r,1]);stored.splice(r-1,1);},deleteRows:(r,n)=>{removed.push([r,n]);stored.splice(r-1,n);}})});
ctx.deleteRowsDescending_('fixture',[9,8,3,4,4,1,999]);assert.deepEqual(removed,[[8,2],[3,2]]);assert.deepEqual(stored,[1,2,5,6,7,10,11,12]);
console.log('Scoped save reads passed: 10,000 keys, 31 matches in two blocks (4 reads), exact order/row identity, missing keys, no unrelated rows, projection output matches previous selection.');
