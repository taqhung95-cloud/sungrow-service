/* Reusable HTML-service RPC. Tokens travel only in authenticated request bodies.
 * Older deployments can use the old transport only if connection setup fails
 * before dispatch. Mutations are dispatched once, never replayed here.
 */
(() => {
  'use strict';
  try {
    if (parent !== window && parent.location.origin === location.origin && parent.SungrowTransport) {
      window.SungrowTransport = parent.SungrowTransport;
      return;
    }
  } catch (_) {}
  const nativeFetch = window.fetch.bind(window), connections = new Map();
  const error = (message, code) => Object.assign(new Error(message), {code});
  const aborted = () => Object.assign(new Error('Đã hủy yêu cầu.'), {name:'AbortError'});
  const googleOrigin = origin => {
    try { const u = new URL(origin); return u.protocol === 'https:' && (u.hostname === 'script.googleusercontent.com' || u.hostname.endsWith('-script.googleusercontent.com')); }
    catch (_) { return false; }
  };
  function descendant(source, frame) {
    try { for (let i=0; source && i<8; i++) { if (source === frame.contentWindow) return true; const p=source.parent; if(p===source)break;source=p; } } catch (_) {}
    return false;
  }
  function connection(url) {
    const previous=connections.get(url);
    if(previous && !(previous.state==='unavailable' && Date.now()-previous.unavailableAt>=5000))return previous;
    const c={state:'connecting',queue:[],pending:new Map(),active:0,frame:null,remote:null,origin:null,lastError:null,startedAt:Date.now()};
    connections.set(url,c);
    const bytes=crypto.getRandomValues(new Uint8Array(24));
    c.channel=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    let resolveReady,rejectReady;
    c.ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    c.ready.catch(()=>{});
    const frame=document.createElement('iframe');c.frame=frame;
    frame.hidden=true;frame.title='Kết nối dữ liệu Service Center';frame.setAttribute('aria-hidden','true');
    frame.referrerPolicy='origin';
    const src=new URL(url);src.searchParams.set('portal_bridge','1');src.searchParams.set('bridge_origin',location.origin);src.searchParams.set('bridge_channel',c.channel);
    frame.src=src.href;
    function stop(reason) {
      if(c.state!=='connecting')return;
      c.state='unavailable';c.unavailableAt=Date.now();c.lastError=reason.code;clearTimeout(c.timer);
      window.removeEventListener('message',onMessage);frame.remove();rejectReady(reason);
    }
    function onMessage(e) {
      const m=e.data;
      if(!m||m.channel!==c.channel||!googleOrigin(e.origin)||!descendant(e.source,frame))return;
      if(m.type==='sungrow-bridge-ready'&&m.protocol===1&&c.state==='connecting') {
        c.remote=e.source;c.origin=e.origin;c.state='ready';c.readyMs=Date.now()-c.startedAt;c.version=String(m.version||'');clearTimeout(c.timer);resolveReady(c);return;
      }
      if(m.type!=='sungrow-bridge-result'||e.source!==c.remote||e.origin!==c.origin)return;
      const item=c.pending.get(m.id);if(!item)return;c.lastRpcMs=Date.now()-item.sentAt;item.release();
      if(typeof m.json!=='string'){item.finish(error('Phản hồi kết nối không hợp lệ.','BRIDGE_RESPONSE'));return;}
      try { JSON.parse(m.json);item.finish(null,new Response(m.json,{status:200,headers:{'Content-Type':'application/json'}})); }
      catch (_) {item.finish(error('Phản hồi kết nối không hợp lệ.','BRIDGE_RESPONSE'));}
    }
    window.addEventListener('message',onMessage);
    c.timer=setTimeout(()=>stop(error('Chưa kết nối được Web App. Kiểm tra deployment Apps Script mới.','BRIDGE_UNAVAILABLE')),20000);
    (document.body||document.documentElement).append(frame);
    c.pump=()=>{
      while(c.active<4&&c.queue.length) {
        const item=c.queue.shift();if(item.done)continue;
        if(item.signal?.aborted){item.finish(aborted());continue;}
        item.sent=true;item.sentAt=Date.now();c.active++;
        c.remote.postMessage({type:'sungrow-bridge-request',channel:c.channel,id:item.id,payload:item.payload},c.origin);
      }
    };
    return c;
  }
  function bridge(c,payload,signal) {
    return new Promise((resolve,reject)=>{
      const item={id:crypto.randomUUID(),payload,signal,sent:false,done:false};
      item.release=()=>{
        if(item.released)return;item.released=true;clearTimeout(item.timer);c.pending.delete(item.id);
        if(item.sent)c.active--;c.pump?.();
      };
      item.finish=(err,value)=>{
        if(item.done)return;item.done=true;signal?.removeEventListener('abort',item.cancel);
        const index=c.queue.indexOf(item);if(index>=0)c.queue.splice(index,1);
        // google.script.run cannot cancel a dispatched server call. Keep its
        // slot until the response arrives, even if its caller stops waiting.
        if(!item.sent)item.release();err?reject(err):resolve(value);
      };
      item.cancel=()=>item.finish(aborted());
      if(signal?.aborted){item.finish(aborted());return;}
      signal?.addEventListener('abort',item.cancel,{once:true});
      item.timer=setTimeout(()=>{item.release();item.finish(error('Chưa nhận được xác nhận từ hệ thống. Kiểm tra kết quả trước khi gửi lại thao tác lưu.','READ_TIMEOUT'));},120000);
      c.ready.then(()=>{
        if(item.done)return;c.pending.set(item.id,item);c.queue.push(item);c.pump();
      },e=>item.finish(e));
    });
  }
  async function fetchViaBridge(url,options={}) {
    const endpoint=new URL(url,location.href);
    // Local fixtures and unrelated URLs retain the browser's normal transport.
    if(endpoint.protocol!=='https:'||endpoint.hostname!=='script.google.com')return nativeFetch(url,options);
    let payload;try{payload=JSON.parse(options.body.get('payload'));}catch(_){throw error('Yêu cầu kết nối không hợp lệ.','BRIDGE_REQUEST');}
    if(options.signal?.aborted)throw aborted();
    const c=connection(endpoint.href);
    if(c.state==='ready')return bridge(c,payload,options.signal);
    try {await c.ready;}catch(e){
      if(options.signal?.aborted)throw aborted();
      if(window.SUNGROW_CONFIG?.appsScriptTransport==='bridge')throw e;
      return nativeFetch(url,options);
    }
    if(options.signal?.aborted)throw aborted();return bridge(c,payload,options.signal);
  }
  window.SungrowTransport={fetch:fetchViaBridge,info:()=>Array.from(connections.values(),c=>({state:c.state,version:c.version||null,readyMs:c.readyMs??null,lastRpcMs:c.lastRpcMs??null,active:c.active,queued:c.queue.length,lastError:c.lastError}))};
})();
