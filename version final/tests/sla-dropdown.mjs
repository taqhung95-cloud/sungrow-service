import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const oldReasons=['Chờ khách hàng xác nhận','Khách hàng yêu cầu giữ hàng','Chờ linh kiện','Chờ phê duyệt bảo hành','Chờ vận chuyển','Yếu tố khách quan khác'];
function run(unsupported=false,manager=true){
 const c={console,Date,Session:{getScriptTimeZone:()=> 'Asia/Saigon'},Utilities:{formatDate:()=> '2026-10-27',getUuid:()=> 'abcdef-123'}};vm.createContext(c);vm.runInContext(read('Code.gs')+'\n'+read('WorkOrderRules.gs'),c);
 const names=vm.runInContext('SHEETS',c),day=s=>new Date(s+'T00:00:00+07:00');let writes=0,revision=0;const events=[];
 const db={
  [names.cases]:[{'Mã hồ sơ':'CASE','Loại thiết bị':'Inverter','Tình trạng bảo hành':'Trong bảo hành','Trạng thái hồ sơ':'Đã hoàn tất','Trung tâm đang giữ hàng':'Sungrow Service Center','Ngày nhận từ khách':day('2026-10-15'),'Ngày sẵn sàng trả khách':day('2026-10-21'),'Ngày trả khách':day('2026-10-26'),GSP:'GSP',MA:'MA'}],
  [names.workOrders]:[{'Mã hồ sơ':'CASE','Mã công việc':'WORK','Trung tâm xử lý':'Sungrow Service Center','Ngày trung tâm nhận hàng':day('2026-10-15'),'Trạng thái xử lý':'Hoàn tất kỹ thuật','Ngày hoàn tất kỹ thuật':day('2026-10-21'),'Kết quả xử lý':'Đổi thiết bị','Loại thiết bị đổi':'Inverter'}],
  [names.holds]:[{'Mã tạm dừng':'OLD','Mã công việc':'WORK','Lý do tạm dừng':'Chờ linh kiện','Ngày bắt đầu':day('2026-10-17'),'Ngày kết thúc':day('2026-10-21')},{'Mã tạm dừng':'PARTIAL','Mã công việc':'WORK'}]
 };
 const headers={...Object.fromEntries(Object.entries(db).map(([n,r])=>[n,[...new Set(r.flatMap(Object.keys))]])),[names.holds]:['Mã tạm dừng','Mã công việc','Lý do tạm dừng','Ngày bắt đầu','Ngày kết thúc','Ghi chú/Xác nhận','Người cập nhật']};
 const rules=new Map(),ruleAt=row=>rules.get(row)||oldReasons;
 const sheet={getLastRow:()=>db[names.holds].length+1,getMaxRows:()=>100,
  getRange(row,col,height=1,width=1){return {
   getDataValidation(){return {getCriteriaType:()=>unsupported?'UNSUPPORTED':'LIST',getCriteriaValues:()=>[ruleAt(row).slice(),true],copy:()=>({requireValueInList(values){return {build:()=>values};}})};},
   setDataValidation(values){events.push('validation');rules.set(row,values);},
   setValues(values){events.push('data');for(let i=0;i<height;i++){const record=Object.fromEntries(headers[names.holds].map((h,j)=>[h,values[i][j]]));if(record['Lý do tạm dừng']&&!ruleAt(row+i).includes(record['Lý do tạm dừng']))throw Error('Strict Sheets validation rejected C'+(row+i));db[names.holds].push(record);writes++;}},
  };},deleteRow(row){db[names.holds].splice(row-2,1);const previous=new Map(rules);for(const [r,v]of previous)if(r>row){rules.delete(r);rules.set(r-1,v);}writes++;}
 };
 Object.assign(c,{SpreadsheetApp:{DataValidationCriteria:{VALUE_IN_LIST:'LIST',VALUE_IN_RANGE:'RANGE'}},spreadsheet_:()=>({getSheetByName:()=>sheet}),tableHeaders_:n=>headers[n],
  authenticate_:()=>({email:'fixture@example.test',isGlobalManager:manager,centers:['Sungrow Service Center'],capabilities:{updateWorkOrder:true}}),
  readScopedTable_:(n,k,ids)=>({headers:headers[n],rows:(db[n]||[]).map((r,i)=>({...r,__rowNumber:i+2})).filter(r=>ids.includes(r[k]))}),
  updateObjectRow_:(n,h,row,changes)=>{events.push('data');Object.assign(db[n][row-2],changes);writes++;},replaceWorkOrderChildren_(){},audit_(){},syncCaseDerived_:()=>({projection:{ok:true},index:{ok:true}}),bumpPortalDatabaseRevision_:()=>++revision});
 const payload={workOrderId:'WORK',workflowStatus:'Hoàn tất kỹ thuật',diagnosisCompletedAt:'2026-10-21',technicalCompletedAt:'2026-10-21',outcome:'Đổi thiết bị',replacementType:'Inverter',gsp:'GSP',ma:'MA',issues:[],parts:[],holds:[{holdId:'OLD',reason:'Chờ linh kiện',startAt:'2026-10-17',endAt:'2026-10-21'},{reason:'Chờ khách nhận hàng',startAt:'2026-10-21',endAt:'2026-10-26'}]};
 if(unsupported||!manager){assert.throws(()=>c.updateWorkOrderUnlocked_('token',payload),unsupported?/Lý do tạm dừng/:/đã hoàn tất/);assert.equal(writes,0);assert.equal(revision,0);return;}
 c.updateWorkOrderUnlocked_('token',payload);
 assert.equal(db[names.cases][0]['Trạng thái hồ sơ'],'Đã hoàn tất');assert.equal(c.iso_(db[names.cases][0]['Ngày trả khách']),'2026-10-26');
 assert.equal(db[names.holds].length,2);assert.equal(db[names.holds][1]['Lý do tạm dừng'],'Chờ khách nhận hàng');assert.ok(!db[names.holds].some(r=>r['Mã tạm dừng']==='PARTIAL'));
 assert.equal(events[0],'validation','New dropdown value must be prepared before any business writes.');
 assert.ok(ruleAt(3).includes('Chờ linh kiện'));assert.ok(ruleAt(3).includes('Chờ khách nhận hàng'));assert.equal(revision,1);
}
run();run(true);run(false,false);
console.log('SLA dropdown passed: closed system manager saves new reason against strict legacy rule, partial row reconciled, strict choices retained, unsupported rule fails before writes, closed center staff denied.');
