/* Reviewed Issue 1-4 labels from 2024/2025/2026, 18 Oct 2026.
 * Normalizes labels for suggestions and aggregation; never rewrites history. */
var SungrowIssueCatalog=(function(){
  var aliases={'hỏng ac realy':'Hỏng AC Relay','hỏng relay ac':'Hỏng AC Relay','hỏng ac relay':'Hỏng AC Relay','board ac relay':'Hỏng AC Relay','hỏng capacitor':'Hỏng Capacitor','hỏng capacitors':'Hỏng Capacitor','hỏng capacirtor':'Hỏng Capacitor','hỏng tụ':'Hỏng Capacitor','board capacitor':'Hỏng Capacitor','hỏng arm':'Hỏng ARM','hỏng external fan':'Hỏng External Fan','hỏng heatsink':'Hỏng Heatsink','emc':'Hỏng EMC'};
  var seed=['Lose SN','Hỏng IGBT','Hỏng AC Relay','Hỏng Communication','Hỏng Battery','Hỏng MC4','Hỏng External Fan','Hỏng Capacitor','Cháy Inverter','Hỏng DSP','Hỏng SPD DC','Tự Reset','Lỏng Communication','Hỏng Internal Fan','Hỏng ARM','Hỏng EMC','Nổ Inverter','Lỗi cell','Cannot Update FW','Hỏng nguồn','Đọc sai SOC','Hỏng SPD AC','Hỏng Heatsink','Hỏng Fuse','Oxidation','Hỏng Terminal AC','Hỏng DC Switch','Hỏng IGBT nhỏ','Terminal bị lỏng ốc','Thay cầu chì trong inverter','Lệch cell, cân lại điện áp, không giao tiếp được với inverter','Không giao tiếp được với inverter','Hỏng Fan'];
  function normalize(value){var text=String(value||'').normalize('NFC').trim().replace(/\s+/g,' ');return aliases[text.toLocaleLowerCase('vi')]||seed.find(function(s){return s.toLocaleLowerCase('vi')===text.toLocaleLowerCase('vi');})||text;}
  function names(values){var seen={};return seed.concat(values||[]).map(normalize).filter(function(s){var key=s.toLocaleLowerCase('vi');if(!s||s==='\\'||s.length>500||seen[key])return false;seen[key]=true;return true;}).sort(function(a,b){return a.localeCompare(b,'vi');});}
  return {normalize:normalize,names:names};
})();
