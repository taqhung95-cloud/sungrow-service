/* Owner-only HTMLService setup for projects with >50 read-only editor properties. */
function qaSetupOwner_(){
  if(typeof asOwner_!=='function')throw Error('Chưa có kiểm tra chủ backend. Kiểm tra module AttachmentStorage.gs trong project chính.');
  try{return asOwner_();}
  catch(_){throw Error('Chỉ chủ backend hiện tại được cấu hình trợ lý. Đăng nhập đúng tài khoản chủ backend.');}
}

function qaSetupPage_(){
  var owner=qaSetupOwner_(),props=PropertiesService.getScriptProperties();
  var nonce=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('QA_SETUP:'+nonce,owner,600);
  var cfg={nonce:nonce,configured:!!props.getProperty('ASSISTANT_GEMINI_KEY'),enabled:props.getProperty('ASSISTANT_AI_ENABLED')==='true',
    free:props.getProperty('ASSISTANT_FREE_TIER_CONFIRMED')==='true',model:props.getProperty('ASSISTANT_GEMINI_MODEL')||'gemini-3.5-flash-lite',
    daily:props.getProperty('ASSISTANT_AI_DAILY_LIMIT')||'100',hourly:props.getProperty('ASSISTANT_AI_USER_HOURLY_LIMIT')||'30'};
  var json=JSON.stringify(cfg).replace(/</g,'\\u003c');
  var html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cấu hình trợ lý Sungrow</title>
<style>body{font:14px/1.55 Arial,sans-serif;color:#263843;background:#f5f7f9;margin:0;padding:24px}main{max-width:620px;margin:auto;background:#fff;padding:24px;border:1px solid #e2e7eb;border-radius:12px}h1{font-size:22px;margin-top:0}label{display:block;margin:17px 0 0}input[type=password],input[type=number],select{display:block;width:100%;padding:11px;box-sizing:border-box;margin-top:6px;border:1px solid #cfd9df;border-radius:6px;font:inherit}input[type=checkbox]{margin-right:8px}button{margin-top:22px;padding:11px 20px;border:0;border-radius:6px;background:#ff7900;color:white;font:inherit;cursor:pointer}small{display:block;color:#657681}.checks label{display:flex;align-items:flex-start;gap:4px}#status{white-space:pre-wrap;margin-top:18px}#status.error{color:#a13028}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:450px){body{padding:10px}main{padding:16px}.row{grid-template-columns:1fr}}</style></head>
<body><main><h1>Cấu hình trợ lý Sungrow</h1><p>Trang dành cho chủ backend. Chỉ lưu các property của trợ lý; giữ nguyên các property hiện có.</p><form id="setup">
<label>Gemini API key<input id="key" type="password" autocomplete="new-password" spellcheck="false"><small id="keyHelp"></small></label>
<label>Model<select id="model"><option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite</option><option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option></select></label>
<div class="row"><label>Lượt gọi AI/ngày toàn hệ thống<input id="daily" type="number" min="0" max="10000" step="1" required></label><label>Lượt gọi AI/giờ/tài khoản<input id="hourly" type="number" min="0" max="200" step="1" required></label></div>
<div class="checks"><label><input id="free" type="checkbox"><span>Tôi đã kiểm tra API key thuộc project Gemini Free Tier, không liên kết Cloud Billing.</span></label>
<label><input id="enabled" type="checkbox"><span>Bật Gemini để hiểu câu hỏi tự nhiên. Khi tắt, vẫn dùng tra cứu và hướng dẫn nội bộ.</span></label></div>
<button id="save" type="submit">Lưu cấu hình trợ lý</button></form><p id="status" role="status" aria-live="polite"></p></main>
<script>
var cfg=${json};
var key=document.getElementById('key'),save=document.getElementById('save'),status=document.getElementById('status');
document.getElementById('model').value=cfg.model;
document.getElementById('daily').value=cfg.daily;document.getElementById('hourly').value=cfg.hourly;
document.getElementById('enabled').checked=cfg.enabled;document.getElementById('free').checked=cfg.free;
document.getElementById('keyHelp').textContent=cfg.configured?'Đã có key. Để trống để giữ key hiện tại; nhập key mới nếu muốn thay.':'Chưa có key. Nhập key từ Google AI Studio để bật Gemini.';
document.getElementById('setup').onsubmit=function(e){e.preventDefault();save.disabled=true;status.className='';status.textContent='Đang lưu cấu hình…';
var values={key:key.value.trim(),model:document.getElementById('model').value,daily:Number(document.getElementById('daily').value),hourly:Number(document.getElementById('hourly').value),enabled:document.getElementById('enabled').checked,freeConfirmed:document.getElementById('free').checked};
google.script.run.withSuccessHandler(function(result){key.value='';status.textContent=result.aiEnabled?'Đã lưu và bật Gemini. Quay lại website và thử câu hỏi.':'Đã lưu. Trợ lý đang dùng tra cứu/hướng dẫn nội bộ.';save.textContent='Đã lưu';})
.withFailureHandler(function(){key.value='';save.disabled=false;status.className='error';status.textContent='Chưa lưu được. Kiểm tra key, hạn mức, xác nhận Free Tier và tài khoản chủ backend. Nếu trang đã mở hơn 10 phút, tải lại rồi thử lại.';})
.configureQuickAssistantForOwner(cfg.nonce,values);};
</script></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Cấu hình trợ lý Sungrow');
}

function configureQuickAssistantForOwner(nonce,values){
  var owner=qaSetupOwner_();
  if(!/^[a-zA-Z0-9-]{72}$/.test(String(nonce||'')))throw Error('Phiên cấu hình không hợp lệ.');
  values=values||{};
  var key=String(values.key||'').trim(),model=String(values.model||'');
  var daily=Number(values.daily),hourly=Number(values.hourly);
  if(key&&!/^[A-Za-z0-9_-]{20,200}$/.test(key))throw Error('API key không hợp lệ.');
  if(['gemini-3.5-flash-lite','gemini-3.1-flash-lite'].indexOf(model)<0||!Number.isInteger(daily)||daily<0||daily>10000||!Number.isInteger(hourly)||hourly<0||hourly>200||typeof values.enabled!=='boolean'||typeof values.freeConfirmed!=='boolean')throw Error('Cấu hình trợ lý không hợp lệ.');
  var lock=LockService.getScriptLock();if(!lock.tryLock(2000))throw Error('Hệ thống đang cập nhật. Vui lòng thử lại.');
  try{
    var cache=CacheService.getScriptCache();if(cache.get('QA_SETUP:'+nonce)!==owner)throw Error('Phiên cấu hình đã hết hạn. Tải lại trang.');
    var props=PropertiesService.getScriptProperties();
    if(values.enabled&&(!values.freeConfirmed||!(key||props.getProperty('ASSISTANT_GEMINI_KEY'))))throw Error('Cần API key và xác nhận Free Tier trước khi bật Gemini.');
    var updates={ASSISTANT_GEMINI_MODEL:model,ASSISTANT_AI_DAILY_LIMIT:String(daily),ASSISTANT_AI_USER_HOURLY_LIMIT:String(hourly),ASSISTANT_AI_ENABLED:String(values.enabled),ASSISTANT_FREE_TIER_CONFIRMED:String(values.freeConfirmed)};
    if(key)updates.ASSISTANT_GEMINI_KEY=key;
    props.setProperties(updates,false);
    cache.remove('QA_SETUP:'+nonce);
    return{ok:true,aiEnabled:values.enabled,keyConfigured:!!(key||props.getProperty('ASSISTANT_GEMINI_KEY'))};
  }finally{lock.releaseLock();}
}
