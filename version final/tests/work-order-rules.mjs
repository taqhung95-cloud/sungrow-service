import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
assert.equal(read('../../docs/work-order-rules.js').replace(/\r/g,''),read('../WorkOrderRules.gs').replace(/\r/g,''),'Frontend/backend must use identical validation contract');
const ctx={console,Date,Set};vm.createContext(ctx);vm.runInContext(read('../WorkOrderRules.gs'),ctx);
const context={currentStatus:'Đã nhận hàng',receivedAt:'2026-10-01',today:'2026-10-13',warrantyPending:false};
const valid={workflowStatus:'Hoàn tất kỹ thuật',outcome:'Đã sửa chữa',technicalCompletedAt:'2026-10-13',diagnosisCompletedAt:'2026-10-02',replacementType:''};
const errors=(p,c={})=>ctx.SungrowWorkOrderRules.validate(p,{...context,...c});
for(const status of ctx.SungrowWorkOrderRules.active){assert.equal(errors({workflowStatus:status}).length,0);assert.match(errors({...valid,workflowStatus:status}).join(' '),/đang xử lý/);}
assert.equal(errors(valid).length,0);assert.match(errors({...valid,technicalCompletedAt:'2026-10-16'}).join(' '),/tương lai/);
assert.match(errors({...valid,outcome:''}).join(' '),/phải có/);assert.match(errors({...valid,replacementType:'Khác'}).join(' '),/Chỉ nhập/);
assert.match(errors({...valid,outcome:'Đổi thiết bị'}).join(' '),/Chọn loại/);assert.equal(errors({...valid,outcome:'Đổi thiết bị',replacementType:'Battery'}).length,0);
assert.match(errors(valid,{warrantyPending:true}).join(' '),/xác nhận bảo hành/);
assert.match(errors({...valid,technicalCompletedAt:'2026-02-30'}).join(' '),/không hợp lệ/);
assert.match(errors({...valid,diagnosisCompletedAt:'2026-10-12',technicalCompletedAt:'2026-10-11'}).join(' '),/không được trước/);
assert.match(errors({...valid,workflowStatus:'Đã chuyển hàng đi'}).join(' '),/Luân chuyển/);
assert.match(errors(valid,{caseClosed:true}).join(' '),/không đổi/);
assert.match(errors({...valid,parts:[{partNumber:'P',name:'Board',quantity:0}]}).join(' '),/Số lượng/);
assert.match(errors({...valid,holds:[{reason:'Chờ linh kiện',startAt:'2026-10-05',endAt:'2026-10-04'}]}).join(' '),/không được trước/);
assert.match(errors({...valid,holds:[{reason:'Chờ linh kiện'}]}).join(' '),/lý do và ngày/);
const code=read('../Code.gs'),extract=name=>{const a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);return code.slice(a,b<0?undefined:b);};
let writes=0;
const work={'Mã công việc':'W1','Mã hồ sơ':'C1','Trung tâm xử lý':'DAT','Ngày trung tâm nhận hàng':'2026-10-01','Trạng thái xử lý':'Đã nhận hàng',__rowNumber:2};
const record={'Mã hồ sơ':'C1','Tình trạng bảo hành':'Trong bảo hành','Trạng thái hồ sơ':'Sẵn sàng trả khách','Trung tâm đang giữ hàng':'DAT','Trung tâm tiếp nhận khách':'DAT','Ngày sẵn sàng trả khách':'2026-10-10',__rowNumber:2};
Object.assign(ctx,{SHEETS:{workOrders:'work',cases:'case'},PRE_WARRANTY_WORKFLOW_STATUSES:['Đã nhận hàng','Đang kiểm tra'],
 authenticate_:()=>({email:'staff',isGlobalManager:true}),assertCapability_(){},assertCenterAllowed_(){},assertCaseEditable_(){},
 clean_:v=>String(v??'').trim(),iso_:v=>v?String(v).slice(0,10):'',required_:(v,m)=>{if(!v)throw Error(m);return v;},parseDateOptional_:v=>v?new Date(v+'T00:00:00+07:00'):null,asDate_:v=>v?new Date(v):null,publicError_:m=>Error(m),
 Utilities:{formatDate:()=>context.today},readTableWithRows_:name=>({headers:[],rows:[name==='work'?work:record]}),
 ensureSheetColumns_:()=>writes++,tableHeaders_:()=>[],updateObjectRow_:(name,headers,row,changes)=>{writes++;Object.assign(name==='work'?work:record,changes);},
 replaceWorkOrderChildren_:()=>writes++,appendWorkOrderHolds_:()=>writes++,fillMissingPartUsageDates_(){},audit_(){},syncDashboardProjectionCase_(){},syncPortalCaseIndexCase_(){},bumpPortalDatabaseRevision_(){},getCaseDetailForActor_:()=>({})});
for(const name of ['updateWorkOrderUnlocked_','updateCaseAfterWork_','validateTechnicalDates_'])vm.runInContext(extract(name),ctx);
for(const payload of [{...valid,workflowStatus:'Chờ linh kiện'},{...valid,parts:[{name:'Board',quantity:0}]},{...valid,holds:[{reason:'Chờ linh kiện',startAt:'2026-10-10',endAt:'2026-10-05'}]}]){writes=0;assert.throws(()=>ctx.updateWorkOrderUnlocked_('staff',{...payload,workOrderId:'W1'}));assert.equal(writes,0,'Reject contradictory fields before any writes');}
ctx.updateWorkOrderUnlocked_('staff',{...valid,workOrderId:'W1'});assert.equal(record['Trạng thái hồ sơ'],'Sẵn sàng trả khách');
ctx.updateWorkOrderUnlocked_('staff',{workOrderId:'W1',workflowStatus:'Chờ linh kiện'});assert.equal(record['Trạng thái hồ sơ'],'Đang xử lý');assert.equal(record['Ngày sẵn sàng trả khách'],'');
record['Trạng thái hồ sơ']='Đã hoàn tất';ctx.updateCaseAfterWork_('C1',{}, {'Trạng thái xử lý':'Hoàn tất kỹ thuật','Kết quả xử lý':'Đã sửa chữa','Ngày hoàn tất kỹ thuật':new Date()});assert.equal(record['Trạng thái hồ sơ'],'Đã hoàn tất','Technical corrections must not reopen delivered cases');
console.log('Work order rules passed: status/outcome/date/replacement/warranty, chronology, children preflight, zero-write rejection and case-state derivation.');
