/* Reviewed Issue 1-4 labels from 2024/2025/2026, 18 Oct 2026.
 * Normalizes labels for suggestions and aggregation; never rewrites history. */
var SungrowIssueCatalog=(function(){
  var aliases={'hỏng ac realy':'Hỏng AC Relay','hỏng relay ac':'Hỏng AC Relay','hỏng ac relay':'Hỏng AC Relay','board ac relay':'Hỏng AC Relay','hỏng capacitor':'Hỏng Capacitor','hỏng capacitors':'Hỏng Capacitor','hỏng capacirtor':'Hỏng Capacitor','hỏng tụ':'Hỏng Capacitor','board capacitor':'Hỏng Capacitor','hỏng arm':'Hỏng ARM','hỏng external fan':'Hỏng External Fan','hỏng heatsink':'Hỏng Heatsink','emc':'Hỏng EMC'};
  var seed=['Lose SN','Hỏng IGBT','Hỏng AC Relay','Hỏng Communication','Hỏng Battery','Hỏng MC4','Hỏng External Fan','Hỏng Capacitor','Cháy Inverter','Hỏng DSP','Hỏng SPD DC','Tự Reset','Lỏng Communication','Hỏng Internal Fan','Hỏng ARM','Hỏng EMC','Nổ Inverter','Lỗi cell','Cannot Update FW','Hỏng nguồn','Đọc sai SOC','Hỏng SPD AC','Hỏng Heatsink','Hỏng Fuse','Oxidation','Hỏng Terminal AC','Hỏng DC Switch','Hỏng IGBT nhỏ','Terminal bị lỏng ốc','Thay cầu chì trong inverter','Lệch cell, cân lại điện áp, không giao tiếp được với inverter','Không giao tiếp được với inverter','Hỏng Fan'];
  function normalize(value){var text=String(value||'').normalize('NFC').trim().replace(/\s+/g,' ');return aliases[text.toLocaleLowerCase('vi')]||seed.find(function(s){return s.toLocaleLowerCase('vi')===text.toLocaleLowerCase('vi');})||text;}
  function names(values){var seen={};return seed.concat(values||[]).map(normalize).filter(function(s){var key=s.toLocaleLowerCase('vi');if(!s||s==='\\'||s.length>500||seen[key])return false;seen[key]=true;return true;}).sort(function(a,b){return a.localeCompare(b,'vi');});}
  return {normalize:normalize,names:names};
})();

// Authenticated read-only catalog. History was reviewed once for the seed above;
// normal form loads never rescan historical tabs or write business data.
function getEntrySuggestions(idToken) {
  var actor=authenticate_(idToken);assertCapability_(actor,'updateWorkOrder');
  return entrySuggestionsRead_();
}
function entrySuggestionsRead_() {
  var revision=getPortalDatabaseRevision_(),cache=CacheService.getScriptCache(),key='entry-suggestions-v1-'+revision;
  var cached=cache.get(key);if(cached){try{return JSON.parse(cached);}catch(ignore){}}
  var issues=readTableShared_(SHEETS.issues,revision,false).filter(function(i){return clean_(i['Loại ghi nhận'])!=='Hiện tượng ban đầu';}).map(function(i){return i['Tên lỗi'];});
  var parts={};readTableShared_(SHEETS.parts,revision,false).forEach(function(p){var pn=clean_(p['Mã linh kiện (Part Number)']);if(!pn||pn.length>100)return;var k=pn.toUpperCase(),name=clean_(p['Tên linh kiện']);parts[k]={partNumber:pn,name:name||(parts[k]&&parts[k].name)||''};});
  var result={revision:revision,issues:SungrowIssueCatalog.names(issues),parts:Object.keys(parts).sort().map(function(k){return parts[k];})};
  if(getPortalDatabaseRevision_()!==revision)throw publicError_('Danh mục vừa được cập nhật. Vui lòng mở lại biểu mẫu.');
  var json=JSON.stringify(result);if(json.length<90000){try{cache.put(key,json,1800);}catch(ignore){}}
  return result;
}
function kiemTraGoiYNhapLieu() {
  portalReadDiagnosticActor_();
  var data=entrySuggestionsRead_(),result={version:APP_VERSION,issueNames:data.issues.length,partNumbers:data.parts.length,writtenToDatabase:false};
  console.log('ENTRY_SUGGESTIONS_CHECK '+JSON.stringify(result));return result;
}
