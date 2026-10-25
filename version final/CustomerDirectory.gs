/** Reusable contacts. Cases retain their own immutable-at-selection snapshots. */
const CUSTOMER_DIRECTORY_SHEET = 'Khách hàng';
const CUSTOMER_DIRECTORY_HEADERS = Object.freeze(['Mã khách hàng','Tên khách hàng','Số điện thoại','Email','Địa chỉ','Trung tâm','Đang hoạt động','Người tạo','Ngày tạo','Người cập nhật','Ngày cập nhật','Phiên bản','Tìm kiếm']);
function cdNormalize_(v){return clean_(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/\s+/g,' ').trim();}
function cdPhone_(v){return clean_(v).replace(/[^0-9]/g,'').replace(/^84(?=\d{9,10}$)/,'0');}
function cdRevision_(){return PropertiesService.getScriptProperties().getProperty('CUSTOMER_DIRECTORY_REVISION')||'0';}
function cdBump_(){var props=PropertiesService.getScriptProperties(),next=Math.max(Date.now(),Number(props.getProperty('CUSTOMER_DIRECTORY_REVISION')||0)+1);props.setProperty('CUSTOMER_DIRECTORY_REVISION',String(next));bumpPortalDatabaseRevision_();return String(next);}
function cdCenter_(actor,value){var center=required_(value,'Trung tâm');if(CENTERS.indexOf(center)<0)throw publicError_('Trung tâm không hợp lệ.');assertCenterAllowed_(actor,center);return center;}
function cdObject_(headers,row,rowNumber){var o={__rowNumber:rowNumber};headers.forEach(function(h,i){o[h]=row[i];});return o;}
function cdPublic_(r){return{customerId:r['Mã khách hàng'],name:r['Tên khách hàng'],phone:r['Số điện thoại'],email:r.Email||'',address:r['Địa chỉ'],center:r['Trung tâm'],revision:String(r['Phiên bản'])};}
function cdTable_(create){
  var ss=spreadsheet_(),sheet=ss.getSheetByName(CUSTOMER_DIRECTORY_SHEET);
  if(!sheet&&create){sheet=ss.insertSheet(CUSTOMER_DIRECTORY_SHEET);sheet.getRange(1,1,1,CUSTOMER_DIRECTORY_HEADERS.length).setValues([CUSTOMER_DIRECTORY_HEADERS.slice()]);sheet.setFrozenRows(1);}
  if(!sheet)return null;
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  if(CUSTOMER_DIRECTORY_HEADERS.some(function(h){return headers.indexOf(h)<0;}))throw publicError_('Tab Khách hàng thiếu cột; cần quản lý kiểm tra cấu trúc.');
  return{sheet:sheet,headers:headers};
}
function cdById_(table,id){
  if(!table||!id||table.sheet.getLastRow()<2)return null;
  var hit=table.sheet.getRange(2,table.headers.indexOf('Mã khách hàng')+1,table.sheet.getLastRow()-1,1).createTextFinder(String(id)).matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext();
  return hit?cdObject_(table.headers,table.sheet.getRange(hit.getRow(),1,1,table.headers.length).getValues()[0],hit.getRow()):null;
}
function searchCustomers(idToken,filters){
  var actor=authenticate_(idToken);assertCapability_(actor,'createCase');filters=filters||{};
  var center=cdCenter_(actor,filters.center),query=/^[+()0-9\s.-]+$/.test(clean_(filters.query))?cdPhone_(filters.query):cdNormalize_(filters.query);
  if(query.length<2)return{rows:[]};if(query.length>100)throw publicError_('Từ khóa khách hàng quá dài.');
  var cache=null,key='';try{cache=CacheService.getScriptCache();key='customer-search:'+digest_([APP_VERSION,cdRevision_(),actor.email,center,query].join('|'));var cached=cache.get(key);if(cached)return JSON.parse(cached);}catch(_){}
  var table=cdTable_(false);if(!table||table.sheet.getLastRow()<2)return{rows:[],initialized:!!table};
  var escape=function(v){return v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');};
  var pattern='^'+escape(cdNormalize_(center))+'\\|.*'+escape(query);
  var finder=table.sheet.getRange(2,table.headers.indexOf('Tìm kiếm')+1,table.sheet.getLastRow()-1,1).createTextFinder(pattern).useRegularExpression(true).matchCase(false),rows=[],seen={};
  for(var n=0;n<50&&rows.length<10;n++){
    var hit=finder.findNext();if(!hit||seen[hit.getRow()])break;seen[hit.getRow()]=true;
    var r=cdObject_(table.headers,table.sheet.getRange(hit.getRow(),1,1,table.headers.length).getValues()[0],hit.getRow());
    if(r['Trung tâm']===center&&bool_(r['Đang hoạt động']))rows.push(cdPublic_(r));
  }
  var result={rows:rows};try{if(cache&&key)cache.put(key,JSON.stringify(result),60);}catch(_){}return result;
}
function cdValues_(payload){
  var fields={name:required_(payload.customerName,'Tên khách hàng'),phone:cdPhone_(payload.customerPhone),email:emailOptional_(payload.customerEmail,'Email khách hàng'),address:required_(payload.customerAddress,'Địa chỉ khách hàng')};
  if(!/^\d{8,15}$/.test(fields.phone))throw publicError_('Điện thoại lưu danh bạ phải có 8–15 chữ số.');
  Object.keys(fields).forEach(function(k){if(fields[k].length>2000||/^[=+@]/.test(fields[k]))throw publicError_('Thông tin danh bạ không hợp lệ.');});return fields;
}
function cdSame_(row,v){return cdNormalize_(row['Tên khách hàng'])===cdNormalize_(v.name)&&cdPhone_(row['Số điện thoại'])===v.phone&&clean_(row.Email).toLowerCase()===v.email.toLowerCase()&&cdNormalize_(row['Địa chỉ'])===cdNormalize_(v.address);}
function cdSearchKey_(center,v){return cdNormalize_(center)+'|'+cdNormalize_(v.name+' '+v.phone+' '+v.email);}
function cdSaveUnlocked_(actor,payload,center){
  var table=cdTable_(true),v=cdValues_(payload),record=cdById_(table,clean_(payload.customerId));
  if(payload.customerId&&(!record||record['Trung tâm']!==center||!bool_(record['Đang hoạt động'])))throw publicError_('Khách hàng không thuộc phạm vi được chọn.');
  if(record&&cdSame_(record,v))return cdPublic_(record); // lost-response replay
  if(record&&String(record['Phiên bản'])!==String(payload.customerRevision))throw publicError_('Danh bạ đã được người khác cập nhật. Chọn lại khách trước khi lưu.');
  if(table.sheet.getLastRow()>1){
    var key=cdNormalize_(center)+'|'+cdNormalize_(v.name)+' '+v.phone;
    var finder=table.sheet.getRange(2,table.headers.indexOf('Tìm kiếm')+1,table.sheet.getLastRow()-1,1).createTextFinder(key).matchCase(false).useRegularExpression(false),seen={},hit;
    while((hit=finder.findNext())&&!seen[hit.getRow()]){
      seen[hit.getRow()]=true;var existing=cdObject_(table.headers,table.sheet.getRange(hit.getRow(),1,1,table.headers.length).getValues()[0],hit.getRow());
      if(existing['Mã khách hàng']!==(record?record['Mã khách hàng']:'')&&existing['Trung tâm']===center&&bool_(existing['Đang hoạt động'])&&cdNormalize_(existing['Tên khách hàng'])===cdNormalize_(v.name)&&cdPhone_(existing['Số điện thoại'])===v.phone){
        if(record)throw publicError_('Thông tin mới trùng một khách khác trong danh bạ. Cần đối soát trước khi gộp.');
        if(cdSame_(existing,v))return cdPublic_(existing);
        throw publicError_('Tên và điện thoại đã có trong danh bạ nhưng thông tin khác. Chọn khách đã lưu hoặc bỏ chọn lưu danh bạ.');
      }
    }
  }
  var now=new Date(),saved=Object.assign({},record||{}, {'Mã khách hàng':record?record['Mã khách hàng']:makeId_('KH'),'Tên khách hàng':v.name,'Số điện thoại':v.phone,Email:v.email,'Địa chỉ':v.address,'Trung tâm':center,'Đang hoạt động':true,'Người tạo':record?record['Người tạo']:actor.email,'Ngày tạo':record?record['Ngày tạo']:now,'Người cập nhật':actor.email,'Ngày cập nhật':now,'Phiên bản':makeId_('REV'),'Tìm kiếm':cdSearchKey_(center,v)});
  audit_(actor,'Chuẩn bị lưu khách hàng','Khách hàng',saved['Mã khách hàng'],center,record,saved);
  var row=record?record.__rowNumber:table.sheet.getLastRow()+1;
  table.sheet.getRange(row,1,1,table.headers.length).setNumberFormat('@').setValues([table.headers.map(function(h){return /^Ngày /.test(h)&&saved[h] instanceof Date?saved[h].toISOString():(saved[h]==null?'':saved[h]);})]);
  SpreadsheetApp.flush();cdBump_();
  audit_(actor,'Lưu khách hàng','Khách hàng',saved['Mã khách hàng'],center,record,saved);return cdPublic_(saved);
}
function cdPrepareCase_(actor,payload,center){
  if(bool_(payload.saveCustomer))return cdSaveUnlocked_(actor,payload,center).customerId;
  if(!payload.customerId)return '';
  var row=cdById_(cdTable_(false),clean_(payload.customerId));
  if(!row||row['Trung tâm']!==center||!bool_(row['Đang hoạt động']))throw publicError_('Khách hàng không thuộc center tiếp nhận.');
  return row['Mã khách hàng'];
}
function saveCustomer(idToken,payload){return withSerializedWrite_('lưu khách hàng',function(){var actor=authenticate_(idToken);assertCapability_(actor,'createCase');payload=payload||{};return cdSaveUnlocked_(actor,payload,cdCenter_(actor,payload.center));});}
function cdEditorManager_(){
  var email=clean_(Session.getActiveUser().getEmail()).toLowerCase(),rows=readTable_(SHEETS.users).filter(function(r){return clean_(r['Email Google']).toLowerCase()===email&&bool_(r['Đang hoạt động']);});
  if(!email||rows.length!==1||!resolveRole_(rows[0]['Vai trò'],rows[0]['Trung tâm']).isGlobalManager)throw Error('Chạy bằng quản lý toàn hệ thống trong Apps Script Editor.');return{email:email,isGlobalManager:true};
}
function initializeCustomerDirectory(){return withSerializedWrite_('khởi tạo danh bạ',function(){cdEditorManager_();cdTable_(true);ensureSheetColumns_(SHEETS.cases,['Mã khách hàng']);cdBump_();return{ok:true};});}
function cdSeedPlan_(){
  var groups={},skipped=0,rows=readTable_(SHEETS.cases);
  rows.forEach(function(c){if(c['Trạng thái hồ sơ']==='Đã hủy')return;if(CENTERS.indexOf(c['Trung tâm tiếp nhận khách'])<0){skipped++;return;}var p={customerName:c['Tên khách hàng'],customerPhone:c['Số điện thoại khách hàng'],customerEmail:c['Email khách hàng'],customerAddress:c['Địa chỉ khách hàng'],center:c['Trung tâm tiếp nhận khách']};try{var v=cdValues_(p),key=p.center+'|'+cdNormalize_(v.name)+'|'+v.phone;(groups[key]||(groups[key]=[])).push({payload:p,values:v,caseId:c['Mã hồ sơ']});}catch(_){skipped++;}});
  var ready=[],conflicts=[];Object.keys(groups).forEach(function(k){var g=groups[k],first=g[0],variants=g.filter(function(x){return x.values.email.toLowerCase()!==first.values.email.toLowerCase()||cdNormalize_(x.values.address)!==cdNormalize_(first.values.address);});if(variants.length)conflicts.push({caseIds:g.map(function(x){return x.caseId;})});else ready.push(first.payload);});return{ready:ready,conflicts:conflicts,skipped:skipped};
}
function auditCustomerDirectorySeed(){cdEditorManager_();var plan=cdSeedPlan_();console.log(JSON.stringify({written:false,eligible:plan.ready.length,conflictingGroups:plan.conflicts.length,skipped:plan.skipped,conflicts:plan.conflicts}));return{written:false,eligible:plan.ready.length,conflictingGroups:plan.conflicts.length,skipped:plan.skipped};}
function seedCustomerDirectory(){return withSerializedWrite_('tạo danh bạ từ hồ sơ cũ',function(){var actor=cdEditorManager_(),plan=cdSeedPlan_(),table=cdTable_(true),existing=readTable_(CUSTOMER_DIRECTORY_SHEET),held=0,pending=plan.ready.filter(function(p){var v=cdValues_(p),sameIdentity=existing.filter(function(r){return r['Trung tâm']===p.center&&bool_(r['Đang hoạt động'])&&cdNormalize_(r['Tên khách hàng'])===cdNormalize_(v.name)&&cdPhone_(r['Số điện thoại'])===v.phone;});if(sameIdentity.length){if(!sameIdentity.some(function(r){return cdSame_(r,v);}))held++;return false;}return true;}),saved=0,started=Date.now();
  var batch=pending.slice(0,250),now=new Date().toISOString(),objects=batch.map(function(p){var v=cdValues_(p);return{'Mã khách hàng':makeId_('KH'),'Tên khách hàng':v.name,'Số điện thoại':v.phone,Email:v.email,'Địa chỉ':v.address,'Trung tâm':p.center,'Đang hoạt động':true,'Người tạo':actor.email,'Ngày tạo':now,'Người cập nhật':actor.email,'Ngày cập nhật':now,'Phiên bản':makeId_('REV'),'Tìm kiếm':cdSearchKey_(p.center,v)};});
  if(objects.length){
    var ids=objects.map(function(r){return r['Mã khách hàng'];}),start=table.sheet.getLastRow()+1;
    audit_(actor,'Chuẩn bị tạo danh bạ từ hồ sơ cũ','Khách hàng','CUSTOMER-SEED','',null,{customerIds:ids,count:ids.length});
    try{table.sheet.getRange(start,1,objects.length,table.headers.length).setNumberFormat('@').setValues(objects.map(function(r){return table.headers.map(function(h){return r[h]==null?'':r[h];});}));SpreadsheetApp.flush();}finally{cdBump_();}
    var readback=table.sheet.getRange(start,1,objects.length,table.headers.length).getValues();
    if(readback.some(function(r,i){return r[table.headers.indexOf('Mã khách hàng')]!==ids[i]||r[table.headers.indexOf('Tìm kiếm')]!==objects[i]['Tìm kiếm'];}))throw publicError_('Danh bạ đã ghi nhưng readback chưa khớp; kiểm tra trước khi chạy tiếp.');
    audit_(actor,'Tạo danh bạ từ hồ sơ cũ','Khách hàng','CUSTOMER-SEED','',null,{customerIds:ids,count:ids.length});saved=ids.length;
  }
  var result={saved:saved,remaining:pending.length-saved,held:held,conflictingGroups:plan.conflicts.length,skipped:plan.skipped};console.log(JSON.stringify(result));return result;
});}
