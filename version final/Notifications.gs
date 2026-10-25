// Existing audit ledger is the durable source. No new tab/header or customer payload.
const NOTIFICATION_ACTIONS_ = Object.freeze({'Yêu cầu duyệt bảo hành':'warranty_request','Xác nhận bảo hành':'warranty_confirmed','Xóa hồ sơ trước xác nhận bảo hành':'case_deleted','Tạo hồ sơ':'case_created','Sửa thông tin hồ sơ':'case_updated','Cập nhật xử lý':'case_updated','Tạo luân chuyển':'case_transferred','Xác nhận nhận luân chuyển':'case_transferred','Trả khách hàng':'case_returned'});
function notificationMetadata_(actor,action,type,id,center,before,after) {
  const kind=NOTIFICATION_ACTIONS_[action];if(!kind)return null;
  before=before||{};after=after||{};
  const caseId=clean_(type==='Hồ sơ'?id:after.caseId||before['Mã hồ sơ']);if(!caseId)return null;
  const indexed=readPortalCaseIndex_(getPortalDatabaseRevision_()).find(function(r){return clean_(r['Mã hồ sơ'])===caseId;})||{};
  const scope=[center,before['Trung tâm tiếp nhận khách'],before['Trung tâm đang giữ hàng'],indexed['Trung tâm tiếp nhận khách'],indexed['Trung tâm đang giữ hàng'],after.toCenter,before['Trung tâm gửi'],before['Trung tâm nhận']].concat(clean_(indexed['Các trung tâm xử lý']).split('|'));
  const request=kind==='warranty_confirmed'?notificationRequestState_(caseId):null;
  return {v:1,kind:kind,caseId:caseId,centers:Array.from(new Set(scope.map(clean_).filter(function(c){return CENTERS.indexOf(c)>=0;}))),model:clean_(before.Model||indexed.Model).slice(0,120),serialNumber:clean_(before['Số sê-ri (S/N)']||indexed['Số sê-ri (S/N)']).slice(0,160),warrantyStatus:kind==='warranty_confirmed'?clean_(after['Tình trạng bảo hành']):'',actor:clean_(actor.email),requestedBy:request?request.requestedBy:''};
}
function notificationRequestState_(caseId,includeNote) {
  const cache=CacheService.getScriptCache(),key='warranty-request-'+digest_(caseId+'|'+getPortalDatabaseRevision_());
  const publicValue=function(value){if(!value)return null;const result={requestedBy:value.requestedBy,requestedAt:value.requestedAt};if(includeNote)result.note=value.note||'';return result;};
  const cached=cache.get(key);if(cached){try{return publicValue(JSON.parse(cached).request);}catch(e){}}
  const rows=findTableRowsByField_(SHEETS.audit,'Mã đối tượng',[caseId]);
  let request=null;
  for(let i=rows.length-1;i>=0;i--){const row=rows[i],action=clean_(row['Hành động']);
    if(action==='Xác nhận bảo hành'||action==='Xóa hồ sơ trước xác nhận bảo hành')break;
    if(action==='Yêu cầu duyệt bảo hành'){request={requestedBy:clean_(row['Email người dùng']),requestedAt:new Date(row['Thời gian']).toISOString()};try{request.note=clean_(JSON.parse(row['Dữ liệu sau']||'{}').note).slice(0,2000);}catch(e){request.note='';}break;}
  }cache.put(key,JSON.stringify({request:request}),60);return publicValue(request);
}
function requestWarrantyReview(idToken,payload) {
  const actor=authenticate_(idToken);assertCapability_(actor,'viewCases');payload=payload||{};
  if(canApproveWarranty_(actor))throw publicError_('Tài khoản có quyền duyệt: hãy dùng Xác nhận bảo hành.');
  const caseId=required_(payload.caseId,'Mã hồ sơ');const note=clean_(payload.note);if(note.length>2000)throw publicError_('Ghi chú tối đa 2.000 ký tự.');
  if(caseId.length>200)throw publicError_('Mã hồ sơ không hợp lệ.');
  return withSerializedWrite_('requestWarrantyReview',function(){
    const records=findTableRowsByField_(SHEETS.cases,'Mã hồ sơ',[caseId]);const record=records[0];
    if(!record||clean_(record['Trạng thái hồ sơ'])==='Đã hủy')throw publicError_('Hồ sơ không tồn tại hoặc đã bị hủy.');
    const works=findTableRowsByField_(SHEETS.workOrders,'Mã hồ sơ',[caseId]);
    if(!canSeeCase_(actor,record,works))throw publicError_('Bạn không có quyền gửi yêu cầu cho hồ sơ này.');
    if(clean_(record['Tình trạng bảo hành'])!=='Chờ xác nhận')throw publicError_('Hồ sơ đã được xác nhận bảo hành.');
    const existing=notificationRequestState_(caseId);if(existing)return {ok:true,alreadyPending:true,request:existing};
    audit_(actor,'Yêu cầu duyệt bảo hành','Hồ sơ',caseId,record['Trung tâm đang giữ hàng'],record,{caseId:caseId,note:note});
    syncDashboardProjectionCase_(caseId);syncPortalCaseIndexCase_(caseId);bumpPortalDatabaseRevision_();SpreadsheetApp.flush();
    return {ok:true,alreadyPending:false,request:{requestedBy:actor.email,requestedAt:new Date().toISOString()}};
  });
}
function notificationWindow_() {
  const sheet=spreadsheet_().getSheetByName(SHEETS.audit);if(!sheet)throw publicError_('Thiếu nhật ký thay đổi.');
  const last=sheet.getLastRow(),key='notifications-recipients-v2-'+APP_VERSION+'-'+getPortalDatabaseRevision_()+'-'+last,cache=CacheService.getScriptCache();
  const cached=readPortalChunkedCache_(cache,key);if(cached)return cached;
  if(last<2)return {events:[],latestId:0,truncated:false};
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(clean_),start=Math.max(2,last-999);
  const required=['Thời gian','Hành động','Dữ liệu sau'];if(required.some(function(h){return headers.indexOf(h)<0;}))throw publicError_('Nhật ký thay đổi thiếu header chuẩn.');
  const values=sheet.getRange(start,1,last-start+1,headers.length).getValues(),events=[];
  values.forEach(function(values,i){const row={};headers.forEach(function(h,n){row[h]=values[n];});let data;try{data=JSON.parse(row['Dữ liệu sau']||'{}');}catch(e){return;}
    const info=data.__notification;if(!info||info.v!==1||!info.caseId||!Array.isArray(info.centers)||!Object.values(NOTIFICATION_ACTIONS_).includes(info.kind))return;
    const at=new Date(row['Thời gian']);if(isNaN(at))return;events.push(Object.assign({},info,{id:start+i,at:at.toISOString(),action:clean_(row['Hành động'])}));
  });
  const requesters=Object.create(null);events.forEach(function(e){if(e.kind==='warranty_request')requesters[e.caseId]=e.actor;if(e.kind==='warranty_confirmed'){e.requestedBy=e.requestedBy||requesters[e.caseId]||'';delete requesters[e.caseId];}if(e.kind==='case_deleted')delete requesters[e.caseId];});
  const result={events:events,latestId:last,truncated:start>2};writePortalChunkedCache_(cache,key,result,60);
  return result;
}
function notificationReadKey_(actor) {return 'notification-read-'+digest_(JSON.stringify([actor.googleSub||actor.email,actor.isGlobalManager===true,actor.centers.slice().sort(),canApproveWarranty_(actor)]));}
function notificationReadState_(actor) {try{const value=JSON.parse(PropertiesService.getScriptProperties().getProperty(notificationReadKey_(actor))||'{}');const ids=typeof value.bits==='string'&&/^[01]{0,1000}$/.test(value.bits)&&Number.isInteger(value.base)?Array.from(value.bits).map(function(bit,i){return bit==='1'?value.base+i:null;}).filter(function(id){return id!==null;}):Array.isArray(value.ids)?value.ids.slice(-1000):[];return {through:Number(value.through)||0,ids:ids};}catch(e){return {through:0,ids:[]};}}
function notificationVisible_(actor,event) {
  const email=clean_(actor.email).toLowerCase(),by=clean_(event.actor).toLowerCase();
  const scoped=actor.isGlobalManager===true||event.centers.some(function(c){return actor.centers.indexOf(c)>=0;});if(!scoped)return false;
  if(event.kind==='warranty_request')return email!==by&&canApproveWarranty_(actor);
  if(event.kind==='warranty_confirmed'&&event.requestedBy)return actor.isGlobalManager===true||email===by||email===clean_(event.requestedBy).toLowerCase();
  return actor.isGlobalManager===true||email===by||actor.roleCode===ROLE_CODES.centerManager;
}
function listNotifications(idToken,options) {
  const actor=authenticate_(idToken);assertCapability_(actor,'viewCases');options=options||{};
  const before=options.before===undefined?Infinity:Number(options.before),limit=options.limit===undefined?20:Number(options.limit);if((before!==Infinity&&(!Number.isInteger(before)||before<2))||!Number.isInteger(limit)||limit<1||limit>50)throw publicError_('Phân trang thông báo không hợp lệ.');
  const window=notificationWindow_(),read=notificationReadState_(actor),index=readPortalCaseIndex_(getPortalDatabaseRevision_()),byCase=Object.create(null),latestReview=Object.create(null);index.forEach(function(r){byCase[clean_(r['Mã hồ sơ'])]=r;});
  window.events.forEach(function(e){if(['warranty_request','warranty_confirmed','case_deleted'].indexOf(e.kind)>=0)latestReview[e.caseId]=e.id;});
  const visible=window.events.filter(function(e){return notificationVisible_(actor,e);}).sort(function(a,b){return b.id-a.id;});
  const unread=function(e){return e.id>read.through&&read.ids.indexOf(e.id)<0;};
  const selected=visible.filter(function(e){return e.id<before;}).slice(0,limit);
  const items=selected.map(function(e){const current=byCase[e.caseId],deleted=!current||clean_(current['Trạng thái hồ sơ'])==='Đã hủy',pending=e.kind==='warranty_request'&&latestReview[e.caseId]===e.id&&!deleted&&clean_(current['Tình trạng bảo hành'])==='Chờ xác nhận';
    const accessible=!!current&&(actor.isGlobalManager===true||canSeeIndexedCase_(actor,current));
    return {id:e.id,at:e.at,kind:e.kind,title:e.action,caseId:e.caseId,model:e.model,serialNumber:e.serialNumber,by:e.actor,warrantyStatus:e.warrantyStatus,unread:unread(e),pending:pending,canOpen:accessible&&!deleted,canReview:pending&&accessible&&canApproveWarranty_(actor)};
  });
  const last=items.length?items[items.length-1].id:null;
  return {items:items,unreadCount:visible.filter(unread).length,total:visible.length,nextBefore:last!==null&&visible.some(function(e){return e.id<last;})?last:null,through:visible.length?visible[0].id:0,windowSize:1000,truncated:window.truncated};
}
function markNotificationsRead(idToken,payload) {
  const actor=authenticate_(idToken);assertCapability_(actor,'viewCases');payload=payload||{};
  return withSerializedWrite_('markNotificationsRead',function(){const window=notificationWindow_(),visible=window.events.filter(function(e){return notificationVisible_(actor,e);}),allowed=visible.map(function(e){return e.id;}),state=notificationReadState_(actor);
    if(payload.through!==undefined){const through=Number(payload.through);if(!Number.isInteger(through)||through<0||(through!==0&&allowed.indexOf(through)<0))throw publicError_('Mốc thông báo không hợp lệ.');state.through=Math.max(state.through,through);}
    else{const ids=payload.ids;if(!Array.isArray(ids)||ids.length>50||ids.some(function(id){return !Number.isInteger(id)||allowed.indexOf(id)<0;}))throw publicError_('Bạn không có quyền với thông báo được chọn.');state.ids=Array.from(new Set(state.ids.concat(ids))).filter(function(id){return id>state.through;});}
    const base=Math.max(2,window.latestId-999),bits=Array(1000).fill('0');state.ids.forEach(function(id){if(id>=base&&id<base+1000&&id>state.through)bits[id-base]='1';});
    PropertiesService.getScriptProperties().setProperty(notificationReadKey_(actor),JSON.stringify({through:state.through,base:base,bits:bits.join('').replace(/0+$/,'')}));return {ok:true};
  });
}
