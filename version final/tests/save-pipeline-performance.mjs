import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../Code.gs',import.meta.url),'utf8');
const rules=fs.readFileSync(new URL('../WorkOrderRules.gs',import.meta.url),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
class TestDate extends Date { constructor(...args){super(...(args.length?args:['2026-10-21T03:00:00Z']));}static now(){return new TestDate().getTime();} }
export function runSavePipeline(code, mixed=false){
 const stats={readCalls:0,readCells:0,writeCalls:0,writeCells:0,deleteCalls:0};let uuid=0,revision=0,audits=0,locks=0;
 const ctx={console:{log(){},error:console.error},Date:TestDate,Session:{getScriptTimeZone:()=> 'Asia/Saigon'},Utilities:{formatDate:()=> '2026-10-21',getUuid:()=>String(++uuid).padStart(6,'0')+'-fixture'},LockService:{getScriptLock:()=>({tryLock:()=>{locks++;return true;},releaseLock:()=>locks--})}};
 vm.createContext(ctx);vm.runInContext(code+'\n'+rules,ctx);const names=vm.runInContext('SHEETS',ctx);
 const day=s=>new TestDate(s+'T00:00:00+07:00');
 const db={};
 const target={
  cases:{'Mã hồ sơ':'CASE','Loại thiết bị':'Inverter','Model':'SG110CX','Số lượng':1,'Trung tâm tiếp nhận khách':'Sungrow Service Center','Trung tâm đang giữ hàng':'Sungrow Service Center','Trạng thái hồ sơ':'Đang xử lý','Tình trạng bảo hành':'Trong bảo hành','Ngày nhận từ khách':day('2026-10-01'),'Ngày sẵn sàng trả khách':'','GSP':'GSP','MA':'MA'},
  workOrders:{'Mã công việc':'WORK','Mã hồ sơ':'CASE','Trung tâm xử lý':'Sungrow Service Center','Trạng thái xử lý':'Đang kiểm tra','Ngày trung tâm nhận hàng':day('2026-10-01'),'Ngày hoàn tất chẩn đoán':'','Ngày hoàn tất kỹ thuật':'','Kết quả xử lý':'','Loại thiết bị đổi':'','Ghi chú nội bộ':'','Người cập nhật':'manager@test','Ngày cập nhật':''},
  issues:{'Mã ghi nhận lỗi':'ISSUE','Mã công việc':'WORK','Loại ghi nhận':'Lỗi xác nhận','Mã lỗi':'E1','Tên lỗi':'Error','Ngày xác nhận lỗi':day('2026-10-02'),'Ghi chú lỗi':''},
  parts:{'Mã sử dụng linh kiện':'PART','Mã công việc':'WORK','Mã linh kiện (Part Number)':'PN','Tên linh kiện':'Board','Số lượng':2,'Ngày nhận linh kiện':day('2026-10-02'),'Ngày sử dụng':day('2026-10-03'),'Ghi chú':''},
  holds:{'Mã tạm dừng':'HOLD','Mã công việc':'WORK','Lý do tạm dừng':'Internal','Ngày bắt đầu':day('2026-10-02'),'Ngày kết thúc':day('2026-10-03'),'Ghi chú/Xác nhận':'','Người cập nhật':'manager@test'}
 };
 for(const [kind,row]of Object.entries(target)){
  const headers=[...Object.keys(row),...Array.from({length:10},(_,i)=>'Unused'+i)];
  if(kind==='cases')headers.push('Người cập nhật gần nhất','Ngày cập nhật gần nhất');
  const data=Array.from({length:3000},(_,i)=>headers.map(h=>h.startsWith('Mã ')?'OTHER-'+i:h.startsWith('Unused')?'Preserve':'Other'));
  data.splice(1500,0,headers.map(h=>row[h]??''));db[names[kind]]={headers,data};
 }
 db[names.transfers]={headers:['Mã hồ sơ','Mã luân chuyển'],data:[]};
 function sheet(name){const table=db[name];if(!table)throw Error('Missing fixture '+name);
  const result={getLastRow:()=>table.data.length+1,getLastColumn:()=>table.headers.length,getMaxRows:()=>10000,insertRowsAfter(){},
   getRange(row,col,height=1,width=1){const read=()=>{stats.readCalls++;stats.readCells+=height*width;return row===1?[table.headers.slice(col-1,col-1+width)]:Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>table.data[row-2+i]?.[col-1+j]??''));};return {
    getValues:read,getDisplayValues:()=>read().map(r=>r.map(v=>String(v??''))),
    createTextFinder(pattern){const finder={useRegularExpression:()=>finder,matchCase:()=>finder,matchEntireCell:()=>finder,matchFormulaText:()=>finder,findAll(){stats.readCalls++;const regex=new RegExp(pattern);return table.data.slice(row-2,row-2+height).flatMap((r,i)=>regex.test(String(r[col-1]??''))?[{getRow:()=>row+i}]:[]).reverse();}};return finder;},
    setValues(values){stats.writeCalls++;stats.writeCells+=height*width;for(let i=0;i<height;i++){const r=table.data[row-2+i]??(table.data[row-2+i]=Array(table.headers.length).fill(''));values[i].forEach((v,j)=>r[col-1+j]=v);}},
    setValue(v){this.setValues([[v]]);},setNumberFormat(){}};},
   getDataRange:()=>result.getRange(1,1,table.data.length+1,table.headers.length),
   appendRow:r=>{stats.writeCalls++;stats.writeCells+=r.length;table.data.push(r);},
   deleteRow:r=>{stats.deleteCalls++;table.data.splice(r-2,1);},deleteRows:(r,n)=>{stats.deleteCalls++;table.data.splice(r-2,n);}};
  // Full-table reads include the header and every data row.
  result.getDataRange=()=>({getValues:()=>{stats.readCalls++;stats.readCells+=(table.data.length+1)*table.headers.length;return [table.headers,...table.data].map(r=>r.slice());}});
  result.getRangeList=addresses=>({getRanges:()=>addresses.map(a=>{const match=a.match(/^A(\d+):([A-Z]+)(\d+)$/);assert.ok(match);const width=[...match[2]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);return result.getRange(Number(match[1]),1,Number(match[3])-Number(match[1])+1,width);})});
  return result;
 }
 Object.assign(ctx,{spreadsheet_:()=>({getSheetByName:sheet}),SpreadsheetApp:{flush(){}},authenticate_:()=>({email:'manager@test',roleCode:'service_manager',isGlobalManager:true,centers:['Sungrow Service Center'],capabilities:{updateWorkOrder:true}}),audit_:()=>audits++,bumpPortalDatabaseRevision_:()=>++revision,getPortalDatabaseRevision_:()=>String(revision),syncDashboardProjectionCase_:()=>({ok:true}),syncPortalCaseIndexCase_:()=>({ok:true}),syncCaseDerived_:()=>({projection:{ok:true},index:{ok:true}})});
 const payload={workOrderId:'WORK',workflowStatus:'Hoàn tất kỹ thuật',diagnosisCompletedAt:'2026-10-02',technicalCompletedAt:'2026-10-03',outcome:'Đã sửa chữa',replacementType:'',note:'Done',gsp:'GSP',ma:'MA',issues:[{issueId:'ISSUE',code:'E1',name:'Error',confirmedAt:'2026-10-02',note:''}],parts:[{partUsageId:'PART',partNumber:'PN',name:'Board',quantity:2,receivedAt:'2026-10-02',usedAt:'2026-10-03',note:''}],holds:[{holdId:'HOLD',reason:'Internal',startAt:'2026-10-02',endAt:'2026-10-03',note:''}]};
 if(mixed){payload.issues=[];payload.parts=Array.from({length:20},(_,i)=>({partNumber:'NEW-'+i,name:'New part '+i,quantity:1,usedAt:'2026-10-03'}));payload.holds=[];}
 assert.equal(ctx.updateWorkOrder('token',payload).ok,true);assert.equal(locks,0);assert.equal(audits,1);assert.equal(revision,1);
 const snapshot=Object.fromEntries(Object.entries(db).map(([name,t])=>[name,{headers:t.headers,rows:t.data.map(r=>Object.fromEntries(t.headers.map((h,i)=>[h,r[i]])))}]));
 const caseRow=snapshot[names.cases].rows.find(r=>r['Mã hồ sơ']==='CASE');assert.equal(caseRow['Trạng thái hồ sơ'],'Sẵn sàng trả khách');assert.equal(caseRow.Unused0,'');
 const parts=snapshot[names.parts].rows.filter(r=>r['Mã công việc']==='WORK');assert.equal(parts.length,mixed?20:1);
 assert.ok(snapshot[names.cases].rows.filter(r=>r['Mã hồ sơ']!=='CASE').every(r=>r.Unused0==='Preserve'));
 if(!mixed){assert.equal(parts[0]['Mã sử dụng linh kiện'],'PART');assert.equal(parts[0]['Số lượng'],2);}
 return {stats,snapshot:plain(snapshot)};
}
const unchanged=runSavePipeline(source),mixed=runSavePipeline(source,true);
assert.ok(unchanged.stats.readCells<40000,'Save must not hydrate all operational tables');
assert.ok(mixed.stats.writeCalls<20,'New child rows must be written as a batch');
console.log('Save pipeline passed: real update/children/holds/date/status logic, 3,001 rows per table, unchanged cells skipped, 20 new parts batched, deleted children, unrelated cells retained and lock released.');
