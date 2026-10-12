/* One bell per page. Embedded portal uses the parent's bell and authenticated routing. */
(() => {
 let config=null,button=null,panel=null,data=null,epoch=0,controller=null,busy=false,timer=null,readQueue=Promise.resolve(),readPending=0;
 const readControllers=new Set();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function close(){if(!panel)return;panel.hidden=true;button.setAttribute('aria-expanded','false');}
 function install(anchor){if(button)return;button=document.createElement('button');button.type='button';button.className='sg-notification-bell';button.title='Thông báo';button.setAttribute('aria-label','Thông báo');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','sg-notifications');button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></svg><span class="sg-notification-count" hidden></span>';anchor.after(button);
  panel=document.createElement('section');panel.id='sg-notifications';panel.className='sg-notifications';panel.hidden=true;panel.setAttribute('aria-label','Thông báo');panel.innerHTML='<header><strong>Thông báo</strong><button type="button" data-notification-close aria-label="Đóng thông báo">×</button></header><div class="sg-notification-tools"><button type="button" data-read-all>Đánh dấu đã đọc</button><button type="button" data-notification-refresh>Tải lại</button></div><p data-notification-status role="status" aria-live="polite"></p><div data-notification-items></div><button type="button" data-notification-more hidden>Xem thêm</button><small>Hiển thị sự kiện mới thuộc quyền của bạn trong 1.000 dòng nhật ký gần nhất.</small>';document.body.append(panel);
  button.addEventListener('click',()=>{if(!panel.hidden){close();return;}panel.hidden=false;button.setAttribute('aria-expanded','true');position();load(false);});panel.querySelector('[data-notification-close]').addEventListener('click',()=>{close();button.focus();});panel.querySelector('[data-notification-refresh]').addEventListener('click',()=>load(false));panel.querySelector('[data-notification-more]').addEventListener('click',()=>load(true));panel.querySelector('[data-read-all]').addEventListener('click',()=>mark({through:data?.through||0}).catch(()=>{}));
  panel.addEventListener('click',event=>{const itemButton=event.target.closest('[data-notification-id]');if(!itemButton)return;const item=data?.items.find(i=>i.id===Number(itemButton.dataset.notificationId));if(!item)return;if(item.canOpen){close();config.openCase(item.caseId);}if(item.unread)mark({ids:[item.id]}).catch(()=>{});});
  anchor.addEventListener('click',()=>load(false));document.addEventListener('pointerdown',event=>{if(panel&&!panel.hidden&&!panel.contains(event.target)&&!button.contains(event.target))close();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel&&!panel.hidden){close();button.focus();}});window.addEventListener('resize',position);
 }
 function position(){if(!panel||panel.hidden)return;const r=button.getBoundingClientRect();panel.style.top=Math.min(r.bottom+8,Math.max(8,innerHeight-200))+'px';panel.style.maxHeight=Math.max(160,innerHeight-r.bottom-20)+'px';}
 function message(text,error=false){const node=panel.querySelector('[data-notification-status]');node.textContent=text;node.classList.toggle('error',error);node.dataset.busy=String(busy);}
 function badge(count){const node=button.querySelector('.sg-notification-count');node.hidden=!count;node.textContent=count>99?'99+':String(count);button.setAttribute('aria-label',count?'Thông báo, '+count+' chưa đọc':'Thông báo');}
 function render(){
  const dates=v=>new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  panel.querySelector('[data-notification-items]').innerHTML=data.items.map(item=>{
   const change=item.kind==='warranty_confirmed'&&item.warrantyStatus?item.warrantyStatus:(item.pending?'Yêu cầu duyệt bảo hành':item.kind==='warranty_request'?'Yêu cầu đã xử lý':item.title)+(item.warrantyStatus?': '+item.warrantyStatus:'');
   const first=(item.model||item.caseId)+' | SN: '+(item.serialNumber||'Chưa có')+' | '+change,second=(item.by||'—')+' | '+dates(item.at);
   return '<button type="button" class="sg-notification-item '+(item.pending?'priority ':'')+(item.unread?'unread':'')+'" data-notification-id="'+item.id+'" title="'+esc(first+'\n'+second+(!item.canOpen?'\nHồ sơ không còn mở được':''))+'" aria-label="'+esc(first+' | '+second)+'"><span class="sg-notification-line"><strong>'+esc(item.model||item.caseId)+'</strong> | SN: '+esc(item.serialNumber||'Chưa có')+' | <span class="sg-notification-type">'+esc(change)+'</span></span><small class="sg-notification-line">'+esc(second)+'</small></button>';
  }).join('');panel.querySelector('[data-notification-more]').hidden=data.nextBefore===null;badge(data.unreadCount);message(data.items.length?'':'Chưa có thông báo liên quan.');
 }
 async function load(more=false){if(!config?.available||busy||readPending||document.hidden)return;const generation=epoch,operation=new AbortController();controller=operation;busy=true;message('Đang tải thông báo…');try{const value=await config.request('listNotifications',{limit:20,...(more?{before:data.nextBefore}:{})},operation.signal);if(generation!==epoch||operation.signal.aborted)return;data=more?{...value,items:data.items.concat(value.items)}:value;render();}catch(error){if(generation===epoch&&error.name!=='AbortError')message(error.message,true);}finally{if(generation===epoch&&controller===operation){busy=false;panel.querySelector('[data-notification-status]').dataset.busy='false';controller=null;}}}
 // Read receipts are serialized in the background, never on the case-opening path.
 function mark(payload){
  if(!config?.available||!data)return Promise.resolve();
  const generation=epoch,request=config.request;readPending++;controller?.abort();controller=null;busy=false;
  const task=readQueue.then(async()=>{
   if(generation!==epoch)return;
   const operation=new AbortController();readControllers.add(operation);message('Đang lưu trạng thái đã đọc…');
   try{
    await request('markNotificationsRead',payload,operation.signal);
    if(generation!==epoch||operation.signal.aborted||!data)return;
    let changed=0;data.items.forEach(item=>{if(item.unread&&(payload.through!==undefined?item.id<=payload.through:payload.ids.includes(item.id))){item.unread=false;changed++;}});
    data.unreadCount=payload.through!==undefined&&payload.through>=data.through?0:Math.max(0,data.unreadCount-changed);render();
   }catch(error){if(generation===epoch&&error.name!=='AbortError')message('Chưa lưu được trạng thái đã đọc. Thông báo vẫn chưa đọc; hãy thử lại.',true);throw error;}
   finally{readControllers.delete(operation);}
  }).finally(()=>{if(generation===epoch){readPending--;panel.querySelector('[data-notification-status]').dataset.busy='false';}});
  readQueue=task.catch(()=>{});return task;
 }
 function configure(value){controller?.abort();controller=null;readControllers.forEach(operation=>operation.abort());readControllers.clear();epoch++;readQueue=Promise.resolve();readPending=0;busy=false;config=value;data=null;clearInterval(timer);timer=null;if(!value){if(button){button.hidden=true;panel.querySelector('[data-notification-items]').innerHTML='';badge(0);close();}return;}install(value.anchor);close();button.hidden=false;button.disabled=!value.available;button.title=value.available?'Thông báo':'Cần cập nhật Apps Script 1.10.20 / Notifications.gs';badge(0);panel.querySelector('[data-notification-items]').innerHTML='';if(value.available){load();timer=setInterval(()=>load(false),60000+Math.floor(Math.random()*15000));}}
 window.addEventListener('focus',()=>load());document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 window.SungrowNotifications={configure,refresh:()=>load(false)};
})();
