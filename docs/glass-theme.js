/* Browser-local appearance preference only; no API, tokens or account data. */
(() => {
  'use strict';
  const key='sungrow-glass-enabled-v1';
  const theme=document.getElementById('sg-glass-theme');
  if(!theme)return;
  const read=()=>{try{return localStorage.getItem(key)!=='off'}catch{return true}};
  let enabled=read();
  function apply(){
    theme.media=enabled?'all':'not all';
    document.documentElement.dataset.glassTheme=enabled?'on':'off';
    document.querySelectorAll('[data-glass-switch]').forEach(input=>{input.checked=enabled;input.setAttribute('aria-checked',String(enabled));});
    document.querySelectorAll('[data-glass-state]').forEach(el=>el.textContent=enabled?'Bật':'Tắt');
  }
  function mount(){
    const anchor=document.querySelector('#sg-preview .sg-side-foot')||document.querySelector('#appView .sidebar-user');
    if(!anchor||anchor.parentElement.querySelector('.sg-glass-toggle-slot'))return;
    const slot=document.createElement('div');slot.className='sg-glass-toggle-slot';
    slot.innerHTML='<label class="sg-glass-toggle" title="Bật/tắt nền ảnh và bề mặt bóng mờ"><span class="sg-glass-toggle-copy">Bóng mờ <span class="sg-glass-toggle-state" data-glass-state></span></span><input type="checkbox" role="switch" aria-label="Bóng mờ" data-glass-switch></label>';
    slot.querySelector('input').addEventListener('change',event=>{
      enabled=event.target.checked;
      try{localStorage.setItem(key,enabled?'on':'off')}catch{}
      apply();
    });
    anchor.before(slot);apply();
  }
  apply();
  function start(){mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){enabled=read();apply();}});
})();
