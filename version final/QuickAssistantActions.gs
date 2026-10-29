/* Read-only capability adapter. Calls existing authorized APIs; results never go to Gemini. */
function qaActionNames_(actor){return ['guide','warranty','cases','case_detail','fan_history','notifications','suggestions'].concat(qaManagement_(actor)?['report']:[]);}
function qaActionResult_(answer,source,cases,total){return {answer:answer,cases:cases||[],total:total||0,sources:[{id:'api:'+source,title:source}],mode:'lookup'};}
function qaActionCase_(token,query,state){
  if(query==='__previous__'){
    if((state.caseIds||[]).length!==1)return {answer:'Có nhiều hồ sơ hoặc chưa có hồ sơ đang tra. Bạn gửi mã hồ sơ cụ thể.',cases:[],total:0};
    return {item:getCaseDetail(token,state.caseIds[0],{refresh:true})};
  }
  if(!query)return {answer:'Bạn gửi S/N hoặc mã hồ sơ cần kiểm tra.',cases:[],total:0};
  var found=listCases(token,{query:query,page:1,pageSize:10,refresh:true});
  if(found.total!==1)return {answer:found.total?'Có '+found.total+' hồ sơ khớp. Bạn chọn mã hồ sơ để tôi đọc đúng lần tiếp nhận.':'Không tìm thấy hồ sơ trong phạm vi tài khoản.',cases:(found.items||[]).slice(0,5).map(qaCase_),total:found.total};
  return {item:getCaseDetail(token,found.items[0].caseId,{refresh:true})};
}
function qaRunAction_(token,actor,action,message,state){
  var name=action.action,query=String(action.query||'').trim();
  if(qaActionNames_(actor).indexOf(name)<0||name==='guide')throw publicError_('Thao tác đọc chưa được cấp quyền.');
  var available={warranty:typeof lookupWarranty==='function',cases:typeof listCases==='function',case_detail:typeof getCaseDetail==='function',fan_history:typeof getFanLotHistory==='function',notifications:typeof listNotifications==='function',suggestions:typeof getEntrySuggestions==='function',report:typeof readReportPage==='function'};
  if(!available[name])throw publicError_('Chức năng tra cứu này chưa được nạp trong deployment hiện tại. Quản trị cần kiểm tra module tương ứng.');
  // Identifiers must be supplied by the user or resolve from server-side conversation state.
  if(query&&query!=='__previous__'&&String(message).toLowerCase().indexOf(query.toLowerCase())<0)throw publicError_('Bạn gửi lại mã cần tra để xác nhận đúng đối tượng.');
  state.lastAction=name;
  if(query==='__previous__'&&!state.caseIds?.length&&!state.lastSerial)return qaActionResult_('Bạn gửi mã hồ sơ hoặc S/N cần tra.','Tra cứu');
  if(name==='warranty'){
    var sn=query==='__previous__'?state.lastSerial:query;
    if(!sn&&query==='__previous__'){var previous=qaActionCase_(token,query,state);if(previous.item)sn=previous.item.serialNumber;}
    if(!sn)return qaActionResult_('Bạn gửi S/N cần tra thời hạn bảo hành.','Tra bảo hành');
    if(/^HS-/i.test(sn)){var resolved=qaActionCase_(token,sn,state);if(!resolved.item)return qaActionResult_(resolved.answer,'Hồ sơ',resolved.cases,resolved.total);sn=resolved.item.serialNumber;}
    if(!sn)return qaActionResult_('Hồ sơ chưa có S/N để tra nguồn bảo hành.','Tra bảo hành');
    var warranty=lookupWarranty(token,sn);state.lastSerial=sn;state.caseIds=[];
    var lines=['## Bảo hành của '+sn,'- Kết quả: '+(warranty.label||'Chưa có thông tin')];
    [['Model',warranty.model],['Part Number',warranty.partNumber||'Chưa có thông tin'],['Company Name',warranty.companyName||'Chưa có thông tin'],['Gói bảo hành',warranty.package],['Ngày bắt đầu',warranty.startDate],['Ngày hết hạn',warranty.expiryDate]].forEach(function(p){if(p[1])lines.push('- '+p[0]+': '+p[1]);});
    lines.push('\nKết quả tra nguồn bảo hành không thay thế bước duyệt bảo hành của hồ sơ sửa chữa.');
    return qaActionResult_(lines.join('\n'),'lookupWarranty — nguồn bảo hành của website');
  }
  if(name==='notifications'){
    var notices=listNotifications(token,{limit:10});
    return qaActionResult_('Có '+notices.unreadCount+' thông báo chưa đọc trong phạm vi tài khoản.\n\n'+(notices.items||[]).map(function(n){return '- '+n.at+' · '+n.title+' · '+n.caseId+(n.unread?' · Chưa đọc':'');}).join('\n')+'\n\nMở chuông để xem và xử lý. Đọc qua trợ lý không đánh dấu đã đọc.','listNotifications');
  }
  if(name==='suggestions'){
    var catalog=getEntrySuggestions(token),term=qaNormalize_(query),parts=(catalog.parts||[]).filter(function(p){return !term||qaNormalize_(p.partNumber+' '+p.name).indexOf(term)>=0;}),issues=(catalog.issues||[]).filter(function(i){return !term||qaNormalize_(i).indexOf(term)>=0;});
    return qaActionResult_('## Danh mục nhập liệu\n- '+parts.length+' linh kiện khớp; '+issues.length+' tên lỗi khớp.\n\n'+parts.slice(0,8).map(function(p){return '- '+p.partNumber+': '+p.name;}).concat(issues.slice(0,8).map(function(i){return '- Lỗi: '+i;})).join('\n')+'\n\nChỉ hiển thị tối đa 8 mục mỗi loại; nhập từ khóa cụ thể để thu hẹp.','getEntrySuggestions');
  }
  if(name==='cases'){
    var filters={query:query==='__previous__'?'':query,page:1,pageSize:10,refresh:true};
    if(action.center){if((actor.centers||[]).indexOf(action.center)<0)throw publicError_('Center không nằm trong phạm vi tài khoản.');filters.center=action.center;}
    if(action.status){if(['Mới tiếp nhận','Đang xử lý','Đang luân chuyển','Sẵn sàng trả khách','Đã hoàn tất'].indexOf(action.status)<0)throw publicError_('Bộ lọc trạng thái không hợp lệ.');filters.status=action.status;}
    var list=listCases(token,filters);return qaActionResult_('Tìm thấy '+list.total+' hồ sơ theo bộ lọc trong quyền tài khoản. Hiển thị tối đa 5 hồ sơ; chọn mã cụ thể để xem tiếp.','listCases',(list.items||[]).slice(0,5).map(qaCase_),list.total);
  }
  if(name==='report'){
    if(!qaManagement_(actor))throw publicError_('Chỉ quản lý toàn bộ center được xem báo cáo.');
    var period=qaActionPeriod_(action.period,message);if(!period)return qaActionResult_('Bạn muốn xem số liệu trong khoảng ngày nào? Có thể ghi ngày bắt đầu và kết thúc theo YYYY-MM-DD.','Báo cáo');
    var centers=action.center?[action.center]:[];if(centers.some(function(c){return (actor.centers||[]).indexOf(c)<0;}))throw publicError_('Center không nằm trong phạm vi tài khoản.');
    var report=readReportPage(token,{type:'centers',start:period.start,end:period.end,centers:centers,columns:['center','received','technicalCompleted','returned','open','waitingDelivery','slaRate'],offset:0,limit:50});
    return qaActionResult_('## Số liệu '+period.start+' → '+period.end+'\n'+(report.rows||[]).map(function(r){return '\n### '+r.center+'\n- Tiếp nhận: '+r.received+'\n- Hoàn tất kỹ thuật: '+r.technicalCompleted+'\n- Đã trả: '+r.returned+'\n- Tồn: '+r.open+'; chờ giao: '+r.waitingDelivery+'\n- Tỷ lệ SLA: '+(r.slaRate==null?'Chưa đủ mẫu':(r.slaRate*100).toFixed(1)+'%');}).join('\n')+'\n\nNguồn báo cáo hiện hành; các chỉ tiêu có mốc ngày khác nhau.'+(report.nextOffset!=null?' Còn dòng khác; chọn một center để thu hẹp.':''),'readReportPage');
  }
  var found=qaActionCase_(token,query,state);if(!found.item)return qaActionResult_(found.answer,'Hồ sơ',found.cases,found.total);
  var c=found.item,card=qaCase_(c);state.lastSerial=c.serialNumber||'';
  if(name==='fan_history'){
    if(!c.fanLot)return qaActionResult_('Hồ sơ này không phải lô Fan.','getCaseDetail',[card],1);
    var history=getFanLotHistory(token,{caseId:c.caseId,offset:0});
    return qaActionResult_('## Nhật ký lô '+c.caseId+'\n'+(history.events||[]).slice(0,15).map(function(e){return '- '+e.date+' · '+e.kind+' · '+e.quantity+' · '+(e.outcome||'');}).join('\n')+'\n\nHiển thị tối đa 15/'+history.total+' sự kiện. Mở hồ sơ để xem đầy đủ.','getFanLotHistory',[card],1);
  }
  var rows=['## Chi tiết '+c.caseId,'- Ngày nhận: '+(c.receivedAt||'Chưa có'),'- Sẵn sàng giao: '+(c.readyAt||'Chưa có'),'- Ngày trả: '+(c.returnedAt||'Chưa có')];
  (c.workOrders||[]).slice(-5).forEach(function(w){rows.push('\n### '+w.center,'- Trạng thái: '+w.workflowStatus,'- Hoàn tất: '+(w.technicalCompletedAt||'Chưa có')+'; kết quả: '+(w.outcome||'Chưa có'),'- Quyền cập nhật hiện tại: '+(w.canUpdate?'Có':'Không'));(w.holds||[]).forEach(function(h){rows.push('- Tạm dừng: '+h.reason+' · '+h.startAt+' → '+(h.endAt||'chưa kết thúc'));});});
  if(c.fanLot&&c.fanLot.totals){var f=c.fanLot.totals;rows.push('\n### Fan thực tế','- Nhận: '+f.received+'; đã trả: '+f.returned+'; còn: '+f.remaining);}
  return qaActionResult_(rows.join('\n'),'getCaseDetail',[card],1);
}
function qaActionPeriod_(preset,message){
  var today=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd'),year=Number(today.slice(0,4)),month=Number(today.slice(5,7));
  var q=qaNormalize_(message);
  if(preset==='today'&&/hom nay|today/.test(q))return {start:today,end:today};
  if(preset==='this_month'&&/thang nay|this month/.test(q))return {start:today.slice(0,7)+'-01',end:today};
  if(preset==='this_year'&&/nam nay|this year/.test(q))return {start:year+'-01-01',end:today};
  if(preset==='last_month'&&/thang truoc|last month/.test(q)){var end=new Date(Date.UTC(year,month-1,0));return {start:end.toISOString().slice(0,7)+'-01',end:end.toISOString().slice(0,10)};}
  var dates=String(message).match(/\b\d{4}-\d{2}-\d{2}\b/g)||[];
  if(dates.length&&dates.length<=2&&dates.every(function(d){var v=new Date(d+'T00:00:00Z');return !isNaN(v)&&v.toISOString().slice(0,10)===d;})&&dates[0]<=(dates[1]||dates[0]))return {start:dates[0],end:dates[1]||dates[0]};
  return null;
}
