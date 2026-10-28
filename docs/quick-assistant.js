/* Authenticated, memory-only chat UI. All data access stays behind portal RPC. */
(() => {
  'use strict';
  let config = null, root = null, controller = null, generation = 0, conversation = '', pendingId = '', busy = false;
  let uiEvents=null, panelAnimation=null, isOpen=false, anchor=null;
  const positionKey='sungrow-assistant-position-v1';
  const assets = new URL('.', document.currentScript.src);
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2,'0')).join('');
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=String(text); return n; };
  const robot = () => { const wrap=el('span','sgqa-robot'),img=el('img');img.src=new URL('assistant-robot.png',assets).href;img.alt='';img.draggable=false;wrap.append(img);return wrap; };
  function viewport(){const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||document.documentElement.clientWidth,height:v?.height||innerHeight};}
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(Math.max(lo,hi),n));
  function move(left,top,remember=false){
    if(!root)return;const v=viewport(),w=52,h=60;
    left=clamp(left,v.left+8,v.left+v.width-w-8);top=clamp(top,v.top+8,v.top+v.height-h-8);
    root.style.left=left+'px';root.style.top=top+'px';root.style.right='auto';root.style.bottom='auto';
    anchor={x:(left-v.left-8)/Math.max(1,v.width-w-16),y:(top-v.top-8)/Math.max(1,v.height-h-16)};
    if(remember)try{localStorage.setItem(positionKey,JSON.stringify(anchor));}catch(_){}
    if(isOpen)placePanel();
  }
  function placePanel(){
    if(!root)return;const panel=root.querySelector('.sgqa-panel'),launch=root.querySelector('.sgqa-launch');if(panel.hidden)return;
    const v=viewport(),r=launch.getBoundingClientRect(),gap=12,w=Math.min(395,v.width-16),desired=Math.min(560,v.height-24);
    const above=r.top-v.top-gap-8,below=v.top+v.height-r.bottom-gap-8;
    let h=desired,left,top;
    if(Math.max(above,below)>=280){h=Math.min(h,Math.max(above,below));top=above>=below?r.top-gap-h:r.bottom+gap;left=r.left+w<v.left+v.width-8?r.left:r.right-w;}
    else if(v.left+v.width-r.right-gap-8>=w||r.left-v.left-gap-8>=w){left=v.left+v.width-r.right-gap-8>=w?r.right+gap:r.left-gap-w;top=r.top+(r.height-h)/2;}
    else{const room=Math.max(above,below);h=room>=200?Math.min(h,room):desired;top=room>=200?(above>=below?r.top-gap-h:r.bottom+gap):v.top+8;left=r.right-w;}
    h=Math.min(h,v.height-16);left=clamp(left,v.left+8,v.left+v.width-w-8);top=clamp(top,v.top+8,v.top+v.height-h-8);
    Object.assign(panel.style,{width:w+'px',height:h+'px',left:left+'px',top:top+'px',right:'auto',bottom:'auto',transformOrigin:(r.left+r.width/2-left)+'px '+(r.top+r.height/2-top)+'px'});
  }
  function wirePosition(launch){
    const signal=uiEvents.signal;let drag=null,suppressClick=false;
    const restore=()=>{const v=viewport();if(anchor)move(v.left+8+anchor.x*Math.max(1,v.width-68),v.top+8+anchor.y*Math.max(1,v.height-76));else{const r=launch.getBoundingClientRect();move(r.left,r.top);}};
    try{const p=JSON.parse(localStorage.getItem(positionKey)||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))anchor={x:clamp(p.x,0,1),y:clamp(p.y,0,1)};}catch(_){}
    restore();
    launch.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=launch.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};suppressClick=false;launch.setPointerCapture(e.pointerId);},{signal});
    launch.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;root.classList.add('sgqa-dragging');move(drag.left+dx,drag.top+dy);},{signal});
    const finish=e=>{if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved;if(drag.moved){const r=launch.getBoundingClientRect();move(r.left,r.top,true);}root.classList.remove('sgqa-dragging');if(launch.hasPointerCapture(e.pointerId))launch.releasePointerCapture(e.pointerId);drag=null;};
    launch.addEventListener('pointerup',finish,{signal});launch.addEventListener('pointercancel',finish,{signal});
    launch.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();return;}show(!isOpen);},{signal});
    launch.addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();const r=launch.getBoundingClientRect(),step=e.shiftKey?48:16;move(r.left+delta[0]*step,r.top+delta[1]*step,true);},{signal});
    window.addEventListener('resize',restore,{signal});window.visualViewport?.addEventListener('resize',restore,{signal});window.visualViewport?.addEventListener('scroll',restore,{signal});
  }
  function show(open) {
    if(!root)return;
    const panel=root.querySelector('.sgqa-panel');isOpen=open;panelAnimation?.cancel();panelAnimation=null;
    if(open){panel.hidden=false;placePanel();}
    root.querySelector('.sgqa-launch').setAttribute('aria-expanded',String(open));
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reduced&&panel.animate){
      const frames=open?[{opacity:0,transform:'scale(.04,.02) skewX(-7deg)',filter:'blur(4px)'},{opacity:1,transform:'scale(1.025,.98)',filter:'blur(0px)',offset:.78},{opacity:1,transform:'scale(1,1)',filter:'blur(0px)'}]:[{opacity:1,transform:'scale(1,1)'},{opacity:0,transform:'scale(.04,.02) skewX(7deg)'}];
      const animation=panel.animate(frames,{duration:open?340:190,easing:open?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.4,0,1,1)'});panelAnimation=animation;
      animation.finished.then(()=>{if(panelAnimation!==animation)return;panelAnimation=null;if(!isOpen)panel.hidden=true;}).catch(()=>{});
    }else panel.hidden=!open;
    if(open)root.querySelector('input').focus();else root.querySelector('.sgqa-launch').focus();
  }
  function welcome() {
    conversation=uuid();pendingId='';
    const log=root.querySelector('.sgqa-log');log.replaceChildren();
    const management=config?.actor?.isGlobalManager&&config?.actor?.capabilities?.viewDashboard;
    const box=el('div','sgqa-message');box.append(el('p','', 'Chào bạn, tôi có thể giúp gì?'),el('p','','Gửi S/N hoặc mã hồ sơ để xem thông tin và mở đúng hồ sơ. '+(management?'Bạn có thể hỏi về chức năng, nhập liệu, KPI, dashboard và báo cáo.':'Bạn có thể hỏi cách nhập liệu, điều kiện khóa và thao tác với hồ sơ trong phạm vi center.')));log.append(box);
  }
  function textMessage(text,cls) {
    const box=el('div','sgqa-message'+(cls?' '+cls:''));
    if(cls)box.append(el('p','',text));else{
      let list=null,listType='';
      const inline=(node,value)=>{String(value).split(/(\*\*[^*]+\*\*)/g).forEach(part=>node.append(part.startsWith('**')&&part.endsWith('**')?el('strong','',part.slice(2,-2)):document.createTextNode(part)));};
      String(text).split(/\r?\n/).forEach(line=>{line=line.trim();if(!line){list=null;listType='';return;}
        const numbered=line.match(/^\d+[.)]\s+(.+)/),bullet=line.match(/^(?:[-•])\s+(.+)/);
        if(numbered||bullet){const type=numbered?'ol':'ul';if(!list||listType!==type){list=el(type);box.append(list);listType=type;}const item=el('li');inline(item,(numbered||bullet)[1]);list.append(item);}
        else{list=null;listType='';const heading=/^#{1,3}\s/.test(line)||/^\*\*[^*]+\*\*:?$/.test(line);const n=el(heading?'h3':'p');inline(n,line.replace(/^#{1,3}\s+/,''));box.append(n);}
      });
    }
    root.querySelector('.sgqa-log').append(box);return box;
  }
  function date(value) { return /^\d{4}-\d{2}-\d{2}/.test(value||'') ? value.slice(0,10).split('-').reverse().join('/') : value || '—'; }
  function record(c) {
    const wrap=el('section','sgqa-record'),title=el('h3','',c.model || c.deviceType || c.caseId);
    title.append(el('span','sgqa-badge',c.status||c.caseStatus||'Chưa cập nhật'));wrap.append(title);
    const facts=el('dl','sgqa-facts');
    [['Mã hồ sơ',c.caseId],['S/N',c.serialNumber],['GSP',c.gsp],['MA',c.ma],['Trung tâm',c.center],['Bảo hành',c.warrantyStatus],['Ngày nhận',date(c.receivedAt)],['Lỗi ghi nhận',c.issues],['Kết quả',c.outcome]].forEach(([k,v])=>{
      if(!v&&['GSP','MA','Lỗi ghi nhận','Kết quả'].includes(k))return;
      const value=el('dd',['Mã hồ sơ','S/N','GSP','MA'].includes(k)?'sgqa-key':'',v||'—');value.title=String(v||'—');facts.append(el('dt','',k),value);
    });wrap.append(facts);
    const links=el('div','sgqa-links');
    [['Mở hồ sơ ↗',false],['Lịch sử xử lý ↗',true]].forEach(([label,history])=>{
      const a=el('a','',label);a.href=new URL('entry.html#update',assets).href;
      a.addEventListener('click',async e=>{e.preventDefault();if(!config)return;try{await config.openCase(c.caseId,{history});show(false);}catch(_){textMessage('Chưa mở được hồ sơ. Vui lòng thử lại từ danh sách hồ sơ.','sgqa-error');}});links.append(a);
    });wrap.append(links);return wrap;
  }
  function setBusy(value) {
    busy=value;if(!root)return;
    root.querySelector('.sgqa-form button').disabled=value;root.querySelector('[data-new]').disabled=value;
    root.querySelector('.sgqa-form').setAttribute('aria-busy',String(value));
  }
  async function send(event) {
    event.preventDefault();if(!config||busy)return;
    const input=root.querySelector('input'),message=input.value.trim();if(!message)return;
    const seq=generation,localRoot=root;pendingId=pendingId||uuid();
    textMessage(message,'sgqa-user');input.value='';setBusy(true);
    const pending=textMessage('Đang tìm thông tin…','sgqa-pending');pending.setAttribute('role','status');
    const log=root.querySelector('.sgqa-log');log.scrollTop=log.scrollHeight;
    controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),120000);
    try {
      const result=await config.request({message,conversationId:conversation,requestId:pendingId},controller.signal);
      if(seq!==generation||root!==localRoot)return;
      pending.remove();const box=textMessage(result.answer||'Chưa có câu trả lời. Vui lòng thử diễn đạt lại.');
      const mode=el('div','sgqa-read-time',({ai:'Trả lời bằng Gemini',guide:'Hướng dẫn nội bộ',lookup:'Tra cứu hệ thống'})[result.mode]||'Phản hồi hệ thống');if(result.fallbackReason)mode.title=result.fallbackReason;box.append(mode);
      (Array.isArray(result.cases)?result.cases:[]).slice(0,5).forEach(c=>{if(c.caseId)box.append(record(c));});
      if(result.sources?.length)box.append(el('div','sgqa-sources','Tham chiếu: '+result.sources.map(s=>s.title).join(' · ')));
      if(result.generatedAt){const at=new Date(result.generatedAt);if(!isNaN(at)){const stamp=el('div','sgqa-read-time','Đọc lúc '+at.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));if(result.rulesVersion)stamp.title='Phiên bản backend: '+result.rulesVersion;box.append(stamp);}}
      pendingId='';log.scrollTop=Math.max(0,box.offsetTop-log.offsetTop-12);
    } catch(error) {
      if(seq!==generation||root!==localRoot)return;pending.remove();
      const outdated=/Thao tác không được phép|ACTION_NOT_ALLOWED/.test(error.message||'');
      textMessage(outdated?'Trợ lý chưa được kích hoạt trên máy chủ. Quản trị cần cập nhật QuickAssistant.gs và bộ điều phối Apps Script.':error.name==='AbortError'?'Chưa nhận được câu trả lời. Bạn có thể gửi lại câu hỏi để kiểm tra.':error.message||'Chưa kết nối được trợ lý. Vui lòng thử lại.','sgqa-error');
      input.value=message;
      // Retain the request ID only for the same question, so a lost response can be deduplicated server-side.
      input.dataset.retryMessage=message;
      log.scrollTop=log.scrollHeight;
    } finally {clearTimeout(timeout);if(seq===generation){controller=null;setBusy(false);}}
  }
  function mount() {
    uiEvents=new AbortController();isOpen=false;anchor=null;
    root=el('aside','sgqa');root.setAttribute('aria-label','Trợ lý Sungrow');
    const panel=el('section','sgqa-panel');panel.id='sgqa-panel';panel.hidden=true;panel.setAttribute('aria-label','Hỏi trợ lý Sungrow');
    const head=el('header','sgqa-head'),copy=el('div');copy.append(el('h2','sgqa-title','Trợ lý Sungrow'),el('div','sgqa-subtitle','Tra cứu & hướng dẫn hệ thống'));
    const tools=el('div','sgqa-tools');
    [['↺','Hội thoại mới','new'],['−','Thu gọn trợ lý','close']].forEach(([label,name,action])=>{const b=el('button','',label);b.type='button';b.setAttribute('aria-label',name);b.dataset[action]='';b.onclick=()=>action==='new'?welcome():show(false);tools.append(b);});
    head.append(robot(),copy,tools);
    const log=el('div','sgqa-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-label','Cuộc trò chuyện');
    const form=el('form','sgqa-form'),input=el('input');input.placeholder='Nhập S/N, mã hồ sơ hoặc câu hỏi…';input.maxLength=1200;input.autocomplete='off';input.setAttribute('aria-label','Nhập S/N, mã hồ sơ hoặc câu hỏi');
    input.addEventListener('input',()=>{if(input.value.trim()!==input.dataset.retryMessage)pendingId='';});
    const submit=el('button','','Gửi ↑');submit.type='submit';form.append(input,submit);form.onsubmit=send;
    panel.append(head,log,form);
    const launch=el('button','sgqa-launch');launch.type='button';launch.setAttribute('aria-label','Mở trợ lý Sungrow; kéo để di chuyển hoặc dùng phím mũi tên');launch.setAttribute('aria-controls',panel.id);launch.setAttribute('aria-expanded','false');launch.append(robot());
    root.append(panel,launch);root.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen){e.preventDefault();show(false);}});document.body.append(root);wirePosition(launch);welcome();
  }
  function configure(next) {
    const previous=config?.actor;const same=previous&&next?.actor&&JSON.stringify([previous.email,previous.role,previous.centers,previous.isGlobalManager,previous.capabilities])===JSON.stringify([next.actor.email,next.actor.role,next.actor.centers,next.actor.isGlobalManager,next.actor.capabilities]);
    if(!same){generation++;controller?.abort();uiEvents?.abort();panelAnimation?.cancel();panelAnimation=null;controller=null;busy=false;isOpen=false;root?.remove();root=null;pendingId='';conversation='';}
    config=next?.actor&&typeof next.request==='function'&&typeof next.openCase==='function'?next:null;
    if(config&&!root)mount();else if(!config){root?.remove();root=null;}
  }
  window.SungrowQuickAssistant={configure};
})();
