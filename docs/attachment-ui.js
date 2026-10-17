/* Shared grouped drop zones. Files and private Drive links are never injected as HTML. */
window.SungrowAttachmentUI=(()=>{
 const groups={incident:'Mẫu thu thập thông tin sự cố',sitePhotos:'Hình ảnh thiết bị tại công trình',centerPhotos:'Hình ảnh tại center',deviceLog:'Log file',waveform:'Log sóng sự cố (nếu có)'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/>',view:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',remove:'<path d="m6 6 12 12M6 18 18 6"/>',retry:'<path d="M20 8a8 8 0 1 0 0 8M20 3v6h-6"/>'};
 const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${icons[k]}</svg>`;
 function mount(host,options){
  const urls=new Map();let items=[],disabled=false;
  const labels=options.categories===false?{'':'Tài liệu đính kèm'}:groups;
  host.classList.add('attachment-widget');
  host.innerHTML=Object.entries(labels).map(([id,label])=>`<section class="attachment-group" data-attachment-group="${id}"><h4>${esc(label)}</h4><div class="attachment-drop" tabindex="0" role="group" aria-label="Tải file: ${esc(label)}"><button type="button" class="secondary" data-add>${icon('upload')} Thêm file</button><span>Kéo-thả hoặc dán file vào đây</span><input type="file" hidden multiple accept=".doc,.docx,.pdf,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png,.txt,.csv"></div><div class="attachment-files"></div></section>`).join('')+'<div class="attachment-status" role="status" aria-live="polite"></div>';
  const status=host.querySelector('.attachment-status');
  function select(files,category){if(!disabled&&files.length)options.onFiles([...files],category);}
  host.querySelectorAll('.attachment-group').forEach(group=>{
   const zone=group.querySelector('.attachment-drop'),input=group.querySelector('input');
   group.querySelector('[data-add]').onclick=()=>input.click();
   input.onchange=()=>{select(input.files,group.dataset.attachmentGroup);input.value='';};
   zone.onkeydown=e=>{if(e.target===zone&&['Enter',' '].includes(e.key)){e.preventDefault();if(!disabled)input.click();}};
   zone.ondragover=e=>{e.preventDefault();if(!disabled)zone.classList.add('dragging');};zone.ondragleave=()=>zone.classList.remove('dragging');
   zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');select(e.dataTransfer.files,group.dataset.attachmentGroup);};
   zone.onpaste=e=>{const files=[...e.clipboardData.files];if(files.length){e.preventDefault();select(files,group.dataset.attachmentGroup);}};
  });
  function resource(item){
   if(item.file){const ext=item.name.split('.').pop().toLowerCase(),type={txt:'text/plain',csv:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',pdf:'application/pdf'}[ext]||'application/octet-stream';if(!urls.has(item.id))urls.set(item.id,URL.createObjectURL(new Blob([item.file],{type})));return urls.get(item.id);}
   return /^[A-Za-z0-9_-]+$/.test(item.fileId||'')?'https://drive.google.com/file/d/'+item.fileId+'/view':'';
  }
  host.onclick=e=>{
   const button=e.target.closest('[data-file-action]');if(!button||button.disabled)return;
   const item=items.find(x=>x.id===button.dataset.fileId);if(!item)return;
   const action=button.dataset.fileAction;
   if(action==='remove')options.onRemove(item);
   if(action==='retry')options.onRetry(item);
   if(action==='view'||action==='download'){
    const url=resource(item);if(!url)return;
    const a=document.createElement('a');a.href=action==='download'&&!item.file?'https://drive.google.com/uc?export=download&id='+item.fileId:url;a.rel='noopener';a.target='_blank';if(action==='download'&&item.file)a.download=item.name;document.body.append(a);a.click();a.remove();
   }
  };
  function update(next,message='',busy=false){
   items=next;for(const [id,url] of urls)if(!items.some(x=>x.id===id)){URL.revokeObjectURL(url);urls.delete(id);}
   host.querySelectorAll('.attachment-group').forEach(group=>{
    const category=group.dataset.attachmentGroup;
    group.querySelector('.attachment-files').innerHTML=items.filter(x=>(x.category||'')===category||category===Object.keys(labels)[0]&&!Object.hasOwn(labels,x.category||'')).map(item=>{
     const ext=item.name.split('.').pop().toUpperCase().slice(0,5),ready=item.status==='READY',uncertain=['ERROR','UPLOADING'].includes(item.status),canResource=!!(item.file||item.fileId);
     const size=item.size<1024*1024?(item.size/1024).toFixed(1)+' KB':(item.size/1024/1024).toFixed(2)+' MB';
     const text=ready?'Đã tải lên':item.status==='QUEUED'?'Chờ tải':item.status==='SENDING'?'Đang tải':item.status==='REMOVING'?'Đang xóa':item.error||'Cần kiểm tra';
     const btn=(action,label,off=false)=>`<button type="button" class="attachment-icon" data-file-id="${esc(item.id)}" data-file-action="${action}" title="${esc(label)}" aria-label="${esc(label+' '+item.name)}" ${off?'disabled':''}>${icon(action)}</button>`;
     return `<div class="attachment-file"><span class="attachment-ext" aria-hidden="true">${esc(ext)}</span><div class="attachment-name"><strong>${esc(item.name)}</strong><small>${esc(size+' | '+text)}</small>${options.getScopeLabel?.(item)?`<small>${esc(options.getScopeLabel(item))}</small>`:''}${!Object.hasOwn(labels,item.category||'')&&options.onCategory?`<select data-category-id="${esc(item.id)}" aria-label="Nhóm file ${esc(item.name)}"><option value="">Chọn nhóm file</option>${Object.entries(groups).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select>`:''}</div><div class="attachment-file-actions">${btn('view','Xem file',!canResource)}${btn('download','Tải xuống',!canResource)}${uncertain?btn('retry',item.file?'Thử lại':'Kiểm tra'):''}${btn('remove','Xóa',busy||['SENDING','UPLOADING','REMOVING'].includes(item.status))}</div></div>`;
    }).join('');
   });
   status.textContent=message;status.classList.toggle('hidden',!message);
  }
  host.onchange=e=>{if(e.target.matches('[data-category-id]')&&e.target.value)options.onCategory?.(items.find(x=>x.id===e.target.dataset.categoryId),e.target.value);};
  return {update,setDisabled(value){disabled=value;host.querySelectorAll('.attachment-drop button,.attachment-drop input').forEach(el=>el.disabled=value);host.querySelectorAll('.attachment-drop').forEach(el=>{el.setAttribute('aria-disabled',String(value));el.tabIndex=value?-1:0;});},dispose(){urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();}};
 }
 return {mount,groups};
})();
