/* Pure rules shared verbatim with docs/fan-lot-rules.js. No services or UI. */
var SungrowFanLotRules = (function () {
  'use strict';
  var MAX_LINES = 120, MAX_STATE = 42000;
  function text(v) { return String(v == null ? '' : v).trim(); }
  function integer(v) { var n=Number(v); if(!Number.isSafeInteger(n)||n<1||n>100000)throw Error('Số Fan phải là số nguyên dương, tối đa 100.000.');return n; }
  function day(v) { var s=text(v),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)throw Error('Ngày không hợp lệ.');var d=new Date(s+'T00:00:00Z');if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Ngày không hợp lệ.');return s; }
  function pack(state) { var s=JSON.stringify(state);if(s.length>MAX_STATE)throw Error('Lô vượt giới hạn dữ liệu; chia thành các lô nhỏ hơn.');return s; }
  function normalize(rows) {
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_LINES)throw Error('Nhập từ 1 đến '+MAX_LINES+' dòng Fan.');
    var result=[],bySerial={};
    rows.forEach(function(r){var serial=text(r.serialNumber).toUpperCase(),note=text(r.note);if(serial.length>100||/[\r\n|]/.test(serial))throw Error('S/N inverter không hợp lệ.');if(note.length>500)throw Error('Ghi chú tối đa 500 ký tự.');if(!serial&&!note)throw Error('Fan chưa rõ S/N cần ghi chú nhận diện.');var qty=integer(r.quantity);var key=serial?'sn:'+serial:'unknown:'+result.length;
      if(bySerial[key]){bySerial[key].quantity=integer(bySerial[key].quantity+qty);if(note)bySerial[key].note=[bySerial[key].note,note].filter(Boolean).join('; ').slice(0,500);}
      else{var line={lineId:'F'+(result.length+1),serialNumber:serial,quantity:qty,note:note,completed:0,returned:0};result.push(line);bySerial[key]=line;}
    });return result;
  }
  function create(rows) { var state={schema:1,revision:1,lines:normalize(rows)};pack(state);return state; }
  function parse(raw) {
    var state=typeof raw==='string'?JSON.parse(raw):JSON.parse(JSON.stringify(raw));
    if(!state||state.schema!==1||!Number.isSafeInteger(state.revision)||state.revision<1||!Array.isArray(state.lines)||!state.lines.length||state.lines.length>MAX_LINES)throw Error('Cấu trúc lô Fan không hợp lệ.');
    var ids={},serials={};state.lines.forEach(function(r){if(!/^F\d+$/.test(r.lineId)||ids[r.lineId])throw Error('Mã dòng Fan không hợp lệ.');ids[r.lineId]=true;integer(r.quantity);if(!Number.isSafeInteger(r.completed)||!Number.isSafeInteger(r.returned)||r.returned<0||r.returned>r.completed||r.completed>r.quantity)throw Error('Tiến độ Fan không cân bằng.');var sn=text(r.serialNumber).toUpperCase();if(sn&&serials[sn])throw Error('S/N trong lô chưa được cộng số lượng.');serials[sn]=true;});pack(state);return state;
  }
  function totals(state) { return state.lines.reduce(function(o,r){o.received+=r.quantity;o.completed+=r.completed;o.returned+=r.returned;o.remaining+=r.quantity-r.returned;o.waiting+=r.completed-r.returned;if(r.serialNumber)o.serials++;return o;},{received:0,completed:0,returned:0,remaining:0,waiting:0,serials:0}); }
  function apply(raw, action, context) {
    var state=parse(raw),qty=integer(action.quantity),date=day(action.date),today=day(context.today),received=day(context.receivedAt);
    if(date>today||date<received)throw Error('Ngày thực tế phải từ ngày nhận đến hôm nay.');
    var line=state.lines.find(function(r){return r.lineId===action.lineId;});if(!line)throw Error('Không tìm thấy dòng S/N trong lô.');
    if(action.kind==='technical'){
      if(!context.warrantyApproved)throw Error('Cần xác nhận bảo hành trước khi hoàn tất Fan.');
      if(['Đã sửa chữa','Không thể sửa chữa','Đổi thiết bị','Không phát hiện lỗi'].indexOf(action.outcome)<0)throw Error('Chọn kết quả xử lý hợp lệ.');
      if(action.outcome==='Đổi thiết bị'&&!text(action.replacementType))throw Error('Thiếu loại thiết bị đổi.');
      if(line.completed+qty>line.quantity)throw Error('Số hoàn tất vượt số Fan chưa xử lý.');line.completed+=qty;
    }else if(action.kind==='return'){
      if(!context.warrantyApproved)throw Error('Cần xác nhận bảo hành trước khi giao trả.');
      if(line.returned+qty>line.completed)throw Error('Số trả vượt số Fan đã hoàn tất còn chờ giao.');line.returned+=qty;
    }else throw Error('Thao tác Fan không hợp lệ.');
    state.revision++;pack(state);return state;
  }
  function group(rows) {
    var by={},lines=[];rows.forEach(function(r){integer(r.quantity);var sn=text(r.serialNumber).toUpperCase(),key=sn||('unknown:'+r.caseId);if(!by[key]){by[key]={serialNumber:sn,quantity:0,caseIds:[]};lines.push(by[key]);}by[key].quantity+=Number(r.quantity);by[key].caseIds.push(r.caseId);});return lines;
  }
  return {create:create,parse:parse,pack:pack,normalize:normalize,totals:totals,apply:apply,group:group,day:day,maxLines:MAX_LINES};
})();
