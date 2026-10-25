/** Editor-only maintenance. No portal route; requires the active global manager. */
function auditReplacementDeliveries() {
  rdrManager_();
  var plan = rdrReadPlan_();
  var result = rdrSummary_(plan);
  console.log(JSON.stringify(result));
  return result;
}

function repairReplacementDeliveries() {
  var actor = rdrManager_(), before = rdrReadPlan_();
  if (!before.ready.length) return rdrSummary_(before);
  // Backup outside the write lock. Re-read the full plan under the lock before writing.
  var db = DriveApp.getFileById(DATABASE_SPREADSHEET_ID), parents = db.getParents();
  var backup = parents.hasNext() ? db.makeCopy('Backup replacement deliveries ' + new Date().toISOString(), parents.next()) : db.makeCopy('Backup replacement deliveries ' + new Date().toISOString());
  return withSerializedWrite_('đối soát máy đổi', function () {
    rdrManager_();
    var plan = rdrReadPlan_();
    if (digest_(JSON.stringify(before)) !== digest_(JSON.stringify(plan))) throw Error('Nguồn hoặc hồ sơ đã thay đổi trong lúc backup. Chạy audit lại; chưa sửa dữ liệu.');
    var headers = tableHeaders_(SHEETS.cases), touched = false, repaired = [];
    try {
      plan.ready.slice(0,3).forEach(function (g) {
        var marker = '[REPLACEMENT-DELIVERY:' + g.duplicate['Mã hồ sơ'] + ']';
        var original = g.original, duplicate = g.duplicate;
        var note = clean_(original['Ghi chú chung']);
        var addition = marker + ' Máy gốc ' + g.originalSerial + ' → máy đổi ' + g.replacementSerial + '. Nguồn ' + g.testKey + '; giao theo ' + g.deliveryKey + '. Hồ sơ giao nhầm được hủy mềm; giữ nguyên mốc ngày để đối soát riêng. Thông tin giao: ' + JSON.stringify(g.deliveryRow);
        var now = new Date();
        if (note.indexOf(marker) === -1) {
          var originalChanges = {'Ghi chú chung':note + '\n' + addition,'Người cập nhật gần nhất':actor.email,'Ngày cập nhật gần nhất':now};
          // Write-ahead audit retains both source and target plus the recovery backup.
          audit_(actor, 'Chuẩn bị sửa máy đổi', 'Hồ sơ', duplicate['Mã hồ sơ'], duplicate['Trung tâm tiếp nhận khách'], {original:original,duplicate:duplicate}, {marker:marker,backupId:backup.getId(),originalChanges:originalChanges});
          touched = true;
          updateObjectRow_(SHEETS.cases, headers, original.__rowNumber, originalChanges);
        }
        if (clean_(duplicate['Trạng thái hồ sơ']) !== 'Đã hủy') {
          var changes = {'Trạng thái hồ sơ':'Đã hủy','Người hủy':actor.email,'Ngày hủy':now,'Lý do hủy':marker + ' Dòng giao máy đổi cho ' + g.originalSerial + '; hồ sơ gốc ' + original['Mã hồ sơ'],'Người cập nhật gần nhất':actor.email,'Ngày cập nhật gần nhất':now};
          allowCancelledCaseStatus_(headers, duplicate.__rowNumber);
          touched = true;
          updateObjectRow_(SHEETS.cases, headers, duplicate.__rowNumber, changes);
        }
        SpreadsheetApp.flush();
        var a = syncDashboardProjectionCase_(original['Mã hồ sơ']), b = syncPortalCaseIndexCase_(original['Mã hồ sơ']);
        var c = removeDashboardProjectionCase_(duplicate['Mã hồ sơ'], null), d = syncPortalCaseIndexCase_(duplicate['Mã hồ sơ']);
        if (!a || !a.ok || !b || !b.ok || !c || !c.ok || !d || !d.ok) throw Error('Đã ghi nguồn; cần chạy lại để hoàn tất projection/index: ' + duplicate['Mã hồ sơ']);
        var saved = readTable_(SHEETS.cases).filter(function(r){return r['Mã hồ sơ']===duplicate['Mã hồ sơ'];});
        if(saved.length!==1 || saved[0]['Trạng thái hồ sơ']!=='Đã hủy') throw Error('Readback hủy không khớp: '+duplicate['Mã hồ sơ']);
        audit_(actor, 'Hoàn tất sửa máy đổi', 'Hồ sơ', duplicate['Mã hồ sơ'], duplicate['Trung tâm tiếp nhận khách'], duplicate, {originalCaseId:original['Mã hồ sơ'],backupId:backup.getId(),marker:marker});
        bumpPortalDatabaseRevision_();
        PropertiesService.getScriptProperties().setProperty('RDR_DONE_'+duplicate['Mã hồ sơ'],marker);
        repaired.push(duplicate['Mã hồ sơ']);
      });
    } finally {
      if(touched || plan.ready.length) { SpreadsheetApp.flush(); bumpPortalDatabaseRevision_(); }
    }
    var result = {ok:true,repaired:repaired,remaining:plan.ready.length-repaired.length,held:plan.held,backupId:backup.getId(),note:'Mỗi lượt tối đa 3 hồ sơ để tránh timeout. Chạy lại khi remaining > 0. Không thay ngày trả, ngày kỹ thuật, linh kiện hoặc hồ sơ nguồn độc lập.'};
    console.log(JSON.stringify(result)); return result;
  });
}

function rdrManager_() {
  var email = clean_(Session.getActiveUser().getEmail()).toLowerCase();
  var users = readTable_(SHEETS.users).filter(function(u){return clean_(u['Email Google']).toLowerCase()===email && bool_(u['Đang hoạt động']);});
  if(!email || users.length!==1 || !resolveRole_(users[0]['Vai trò'],users[0]['Trung tâm']).isGlobalManager) throw Error('Chạy từ Apps Script Editor bằng tài khoản quản lý toàn hệ thống.');
  return {email:email,isGlobalManager:true};
}
function rdrSummary_(p) { return {written:false,relations:p.relations,ready:p.ready.map(function(g){return {caseId:g.duplicate['Mã hồ sơ'],originalCaseId:g.original['Mã hồ sơ'],original:g.originalSerial,replacement:g.replacementSerial,source:g.deliveryKey};}),held:p.held}; }
function rdrReadPlan_() {
  var configs = [
    ['XB','XBSolar Center','1vy-1_cbC0HF8PnGGpcL128A30sNAqvbdXN4GCvCxRHA',''],
    ['BKE','BKE Center','1xKhxWw_IU0bI9M7xtCPgtjNfZgbxXn2oNAUsJK0trUk','Copy of '],
    ['DAT','DAT Center','1J99TepQSp5GA-Ct7QEqkUtDV6APS6XzwrQJIuLEJ2WI','Copy of ']
  ];
  var sources = configs.map(function(c){var ss=SpreadsheetApp.openById(c[2]),s={center:c[1],prefix:c[0],id:c[2],tabs:{}};['Receive','Repair','Test','Delivery'].forEach(function(t){var sh=ss.getSheetByName(c[3]+t);if(!sh)throw Error('Thiếu sheet '+c[3]+t);s.tabs[t]={name:sh.getName(),values:sh.getDataRange().getValues()};});return s;});
  var cases = readTableWithRows_(SHEETS.cases).rows, works=readTable_(SHEETS.workOrders), transfers=readTable_(SHEETS.transfers);
  var children = [SHEETS.parts,SHEETS.issues,SHEETS.holds].map(function(t){return readTable_(t);});
  var plan=rdrPlan_(sources,cases,works,transfers,children), props=PropertiesService.getScriptProperties();
  plan.ready=plan.ready.filter(function(g){return g.duplicate['Trạng thái hồ sơ']!=='Đã hủy'||props.getProperty('RDR_DONE_'+g.duplicate['Mã hồ sơ'])!=='[REPLACEMENT-DELIVERY:'+g.duplicate['Mã hồ sơ']+']';});
  return plan;
}
function rdrPlan_(sources,cases,works,transfers,children) {
  var out={relations:0,ready:[],held:[]}, seen={};
  var norm=function(v){return String(v||'').trim().toUpperCase();};
  sources.forEach(function(s){
    s.tabs.Test.values.forEach(function(row,i){
      var note=String(row[4]||''), originalSN=norm(row[1]);
      if(!/đổi|thay.*(?:inverter|máy|biến tần)|replacement|swap/i.test(note))return;
      var sns=(note.toUpperCase().match(/\b(?:[AB]\d[A-Z0-9]{7,}|EM[A-Z0-9]{10,})\b/g)||[]).filter(function(v,j,a){return v!==originalSN&&a.indexOf(v)===j;});
      if(!sns.length)return;
      out.relations++;
      sns.forEach(function(sn){
        var deliveries=s.tabs.Delivery.values.map(function(r,j){return {row:r,index:j+1};}).filter(function(d){return norm(d.row[1])===sn;});
        deliveries.forEach(function(delivery){
          var key=s.prefix+'|'+s.id+'|'+s.tabs.Delivery.name+'|'+delivery.index;
          var duplicates=cases.filter(function(c){return norm(c['Số sê-ri (S/N)'])===sn && c['Mã dòng dữ liệu cũ']===key;});
          duplicates.forEach(function(dup){
            if(seen[dup['Mã hồ sơ']])return;seen[dup['Mã hồ sơ']]=true;
            var marker='[REPLACEMENT-DELIVERY:'+dup['Mã hồ sơ']+']';
            var originals=cases.filter(function(c){return norm(c['Số sê-ri (S/N)'])===originalSN && c['Trung tâm tiếp nhận khách']===s.center && c['Trạng thái hồ sơ']!=='Đã hủy';});
            if(originals.length>1){var exact=originals.filter(function(c){return c['Mã dòng dữ liệu cũ']===s.prefix+'|'+s.id+'|'+s.tabs.Test.name+'|'+(i+1);});if(exact.length===1)originals=exact;}
            var reason='';
            if(s.tabs.Test.values.filter(function(r){return /đổi|thay.*(?:inverter|máy|biến tần)|replacement|swap/i.test(String(r[4]||''))&&String(r[4]||'').toUpperCase().indexOf(sn)>=0;}).length!==1)reason='Nhiều ghi nhận máy đổi cùng SN; cần đối soát riêng';
            if(sns.length!==1 || deliveries.length!==1 || duplicates.length!==1 || originals.length!==1)reason='Nhiều SN/lượt giao/hồ sơ gốc; cần đối soát riêng';
            if(['Receive','Repair','Test'].some(function(t){return s.tabs[t].values.some(function(r){return norm(r[t==='Receive'?8:1])===sn;});}))reason='Máy đổi có sự kiện tiếp nhận/sửa/test độc lập';
            var dw=works.filter(function(w){return w['Mã hồ sơ']===dup['Mã hồ sơ'];});
            var ids=dw.map(function(w){return w['Mã công việc'];});
            if(dw.length!==1 || dw.some(function(w){return w['Trạng thái xử lý']!=='Đã nhận hàng' || clean_(w['Kết quả xử lý']) || w['Ngày hoàn tất kỹ thuật'];}) || children.some(function(rows){return rows.some(function(r){return ids.indexOf(r['Mã công việc'])>=0;});}) || transfers.some(function(t){return t['Mã hồ sơ']===dup['Mã hồ sơ'];}))reason='Hồ sơ có nghiệp vụ riêng; không tự hủy';
            var resumed=String(dup['Lý do hủy']||'').indexOf(marker)===0;
            if(!resumed && (dup['Trạng thái hồ sơ']!=='Mới tiếp nhận'||dup['Tình trạng bảo hành']!=='Chờ xác nhận'||dup['Trung tâm đang giữ hàng']!==s.center||!/^Đồng bộ /.test(dup['Người cập nhật gần nhất']||'')))reason='Hồ sơ đã được cập nhật hoặc không còn nguyên trạng migration';
            if(reason){out.held.push({caseId:dup['Mã hồ sơ'],original:originalSN,replacement:sn,reason:reason});return;}
            out.ready.push({original:originals[0],duplicate:dup,originalSerial:originalSN,replacementSerial:sn,testKey:s.id+'|'+s.tabs.Test.name+'|'+(i+1),testRow:row,deliveryKey:key,deliveryRow:delivery.row,work:dw[0]});
          });
        });
      });
    });
  });return out;
}
