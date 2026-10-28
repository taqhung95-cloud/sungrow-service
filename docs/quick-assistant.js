/* Authenticated, memory-only chat UI. All data access stays behind portal RPC. */
(() => {
  'use strict';
  let config = null, root = null, controller = null, generation = 0, conversation = '', pendingId = '', busy = false;
  const assets = new URL('.', document.currentScript.src);
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2,'0')).join('');
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=String(text); return n; };
  const robot = () => { const wrap=el('span','sgqa-robot'),img=el('img');img.src=new URL('assistant-robot.png',assets).href;img.alt='';wrap.append(img);return wrap; };
  function show(open) {
    if(!root)return;
    root.querySelector('.sgqa-panel').hidden=!open;
    root.querySelector('.sgqa-launch').setAttribute('aria-expanded',String(open));
    if(open)root.querySelector('input').focus();else root.querySelector('.sgqa-launch').focus();
  }
  function welcome() {
    conversation=uuid();pendingId='';
    const log=root.querySelector('.sgqa-log');log.replaceChildren();
    const box=el('div','sgqa-message');box.append(el('p','', 'Chào bạn, tôi có thể giúp gì?'),el('p','','Gửi S/N hoặc mã hồ sơ để xem thông tin và mở đúng hồ sơ. Bạn cũng có thể hỏi tự nhiên về KPI, nhập liệu và cách xem dashboard.'));log.append(box);
  }
  function textMessage(text,cls) {
    const box=el('div','sgqa-message'+(cls?' '+cls:''));box.append(el('p','',text));root.querySelector('.sgqa-log').append(box);return box;
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
      (Array.isArray(result.cases)?result.cases:[]).slice(0,5).forEach(c=>{if(c.caseId)box.append(record(c));});
      if(result.sources?.length)box.append(el('div','sgqa-sources','Tham chiếu: '+result.sources.map(s=>s.title).join(' · ')));
      pendingId='';log.scrollTop=log.scrollHeight;
    } catch(error) {
      if(seq!==generation||root!==localRoot)return;pending.remove();
      const outdated=/Thao tác không được phép|ACTION_NOT_ALLOWED/.test(error.message||'');
      textMessage(outdated?'Trợ lý chưa được kích hoạt trên máy chủ. Quản trị cần cập nhật QuickAssistant.gs và bộ điều phối Apps Script.':error.name==='AbortError'?'Chưa nhận được câu trả lời. Bạn có thể gửi lại câu hỏi để kiểm tra.':error.message||'Chưa kết nối được trợ lý. Vui lòng thử lại.','sgqa-error');
      input.value=message;
      // Retain the request ID only for the same question, so a lost response can be deduplicated server-side.
      input.dataset.retryMessage=message;
    } finally {clearTimeout(timeout);if(seq===generation){controller=null;setBusy(false);}}
  }
  function mount() {
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
    const launch=el('button','sgqa-launch');launch.type='button';launch.setAttribute('aria-label','Mở trợ lý Sungrow');launch.setAttribute('aria-controls',panel.id);launch.setAttribute('aria-expanded','false');launch.append(robot());launch.onclick=()=>show(panel.hidden);
    root.append(panel,launch);root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();show(false);}});document.body.append(root);welcome();
  }
  function configure(next) {
    const previous=config?.actor;const same=previous&&next?.actor&&JSON.stringify([previous.email,previous.role,previous.centers,previous.isGlobalManager,previous.capabilities])===JSON.stringify([next.actor.email,next.actor.role,next.actor.centers,next.actor.isGlobalManager,next.actor.capabilities]);
    if(!same){generation++;controller?.abort();controller=null;busy=false;root?.remove();root=null;pendingId='';conversation='';}
    config=next?.actor&&typeof next.request==='function'&&typeof next.openCase==='function'?next:null;
    if(config&&!root)mount();else if(!config){root?.remove();root=null;}
  }
  window.SungrowQuickAssistant={configure};
})();
