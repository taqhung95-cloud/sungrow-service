/* Staged uploads: one file at a time, progress counts Drive-confirmed files, no fake byte %. */
globalThis.portalUploads = (() => {
  const allowed=/\.(doc|docx|pdf|xls|xlsx|zip|rar|jpg|jpeg|png)$/i;
  const groups={incident:'Mẫu thu thập thông tin sự cố',sitePhotos:'Hình ảnh thiết bị tại công trình',deviceLog:'Log file',waveform:'Log sóng sự cố (nếu có)'};
  let pickers=[],categoryPending=0;
  const disable=value=>pickers.forEach(p=>{p.disabled=value});
  let form,panel,input,items=[],sessionId='',requestId='',key='',center='',epoch=0,working=false,restoreFailed=false;
  const enabled=()=>typeof state!=='undefined'&&!!state.temporaryUploads;
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=()=>{try{localStorage.setItem(key,JSON.stringify({sessionId,requestId}));}catch(_){}};
  function draw(){
    if(!panel)return;
    const ready=items.filter(x=>x.status==='READY').length;
    panel.innerHTML=`<div class="upload-summary" role="status" aria-live="polite">${ready}/${items.length} file đã tải lên</div>${restoreFailed?'<button type="button" class="secondary" data-upload-check-session>Kiểm tra lại phiên upload</button>':''}<progress max="${items.length||1}" value="${ready}" aria-label="Số file đã upload thành công"></progress><div class="upload-list">${items.map(x=>`<div class="upload-item"><div><strong>${escape(x.name)}</strong>${state.uploadCategories?`<label class="upload-category-label">Nhóm file <select data-upload-category="${escape(x.id)}" ${x.status!=='READY'||restoreFailed?'disabled':''}><option value="">Chưa phân nhóm</option>${Object.entries(groups).map(([id,label])=>`<option value="${id}" ${x.category===id?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<small>${(x.size/1024/1024).toFixed(2)} MB · ${x.status==='READY'?'Đã tải lên':x.status==='SENDING'?'Đang gửi / chờ Drive lưu':x.status==='QUEUED'?'Chờ tải':escape(x.error||'Chưa xác nhận kết quả')}</small></div><div class="upload-actions">${['ERROR','UPLOADING'].includes(x.status)?`<button type="button" class="secondary" data-upload-retry="${escape(x.id)}">${x.file?'Thử lại':'Kiểm tra'}</button>`:''}<button type="button" class="secondary" data-upload-remove="${escape(x.id)}" ${['SENDING','UPLOADING'].includes(x.status)?'disabled':''}>Bỏ</button></div></div>`).join('')}</div>`;
  }
  function merge(result){
    const locals=new Map(items.map(x=>[x.id,x]));
    const remote=result.files.map(x=>({...locals.get(x.uploadId),id:x.uploadId,name:x.name,size:x.size,status:x.status,category:x.category||''}));
    const ids=new Set(remote.map(x=>x.id));
    items=[...remote,...items.filter(x=>!ids.has(x.id))];draw();
  }
  async function scope(){
    if(!form||!enabled())return;
    const next=form.elements.intakeCenter.value;
    const nextKey='sungrow:temp-uploads:v1:'+state.actor.email+':'+next;
    if(nextKey===key)return;
    epoch++;center=next;key=nextKey;items=[];sessionId='';requestId='';restoreFailed=false;disable(false);pickers.forEach(p=>{p.value=''});draw();
    const generation=epoch;
    if(!center)return;
    try{
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      if(saved){sessionId=saved.sessionId;requestId=saved.requestId;disable(true);
        const created=await call('getCreationStatus',[state.token,requestId]);
        if(generation!==epoch)return;
        if(created.found){localStorage.removeItem(key);sessionId=crypto.randomUUID();requestId=crypto.randomUUID();store();disable(false);showMessage('Phiên upload trước đã tạo hồ sơ '+created.caseId+'. Không cần gửi lại các file cũ.');return;}
        const result=await call('getCaseUploadSession',[state.token,sessionId]);
        if(generation!==epoch)return;
        if(result.state==='CLAIMED'){merge(result);disable(true);showMessage('Phiên file đang gắn vào yêu cầu tạo hồ sơ. Bấm Tạo hồ sơ để kiểm tra kết quả cũ.');return;}
        if(result.state!=='OPEN'||result.expiresAt<=Date.now()){try{localStorage.removeItem(key);}catch(_){}sessionId=crypto.randomUUID();requestId=crypto.randomUUID();store();disable(false);showMessage('Phiên file tạm trước đã hết hạn. Vui lòng chọn lại file.',true);return;}
        disable(false);merge(result);return;
      }
    }catch(error){if(generation!==epoch)return;restoreFailed=true;disable(true);draw();showMessage('Không đọc được phiên upload. Mã phiên vẫn được giữ; bấm Kiểm tra lại, không tạo phiên mới. '+error.message,true);return;}
    sessionId=crypto.randomUUID();requestId=crypto.randomUUID();store();
  }
  async function pump(){
    if(working)return;working=true;
    try{
      while(items.some(x=>x.status==='QUEUED')){
        const item=items.find(x=>x.status==='QUEUED'),generation=epoch,session=sessionId,target=center;
        item.status='SENDING';draw();
        try{
          await call('beginCaseUpload',[state.token,{sessionId:session,center:target}]);
          if(generation!==epoch)continue;
          const base64=await fileToBase64(item.file);
          let result;
          for(let wait=0;wait<20;wait++){
            try{result=await call('uploadCaseFile',[state.token,{sessionId:session,center:target,uploadId:item.id,name:item.name,category:item.category||'',base64}]);break;}
            catch(error){if(!/^\[UPLOAD_BUSY\]/.test(error.message)||wait===19)throw error;item.error='Đang chờ lượt upload';await new Promise(resolve=>setTimeout(resolve,2000+Math.random()*3000));if(generation!==epoch)break;}
          }
          if(generation!==epoch)continue;
          merge(result);
        }catch(error){if(generation===epoch){item.status='ERROR';item.error=error.message;draw();}}
      }
    }finally{working=false;}
  }
  function attach(){
    if(!enabled()||!state.actor)return;
    if(form){scope();return;}
    form=document.getElementById('receiveForm');if(!form)return;
    input=form.elements.evidenceFile;
    input.accept='.doc,.docx,.pdf,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png';input.multiple=true;input.required=false;
    const field=input.closest('.span3'),label=field.querySelector('label');label.classList.add('upload-label');
    label.innerHTML='Hồ sơ đính kèm * <small id="uploadLabelNote" class="upload-label-note">Tự tải lên · 10 file · 8 MB/file · Lưu tạm 24 giờ</small>';
    label.title='DOC/DOCX, PDF, XLS/XLSX, ZIP/RAR, JPG/JPEG, PNG. File tạm chưa gắn vào case sẽ được đưa vào thùng rác sau khi hết hạn, trong đợt dọn định kỳ.';
    input.setAttribute('aria-describedby','uploadLabelNote');field.querySelector('.muted').hidden=true;
    panel=document.createElement('div');panel.className='case-upload-panel';input.after(panel);
    form.elements.intakeCenter.addEventListener('change',scope);
    pickers=[input];
    if(state.uploadCategories){
      input.hidden=true;
      const groupBox=document.createElement('div');groupBox.className='upload-groups';
      groupBox.innerHTML=Object.entries(groups).map(([id,title])=>`<div class="upload-group"><label for="upload-${id}">${title} <small>${id==='incident'?'Tối đa 1 file':'Dùng chung giới hạn 10 file'}</small></label><input id="upload-${id}" type="file" data-category="${id}" accept="${input.accept}" ${id==='incident'?'':'multiple'}></div>`).join('');
      input.after(groupBox);pickers=[...groupBox.querySelectorAll('input')];
    }
    for(const picker of pickers)picker.addEventListener('change',async()=>{
      await scope();
      if(!center){showMessage('Chọn trung tâm tiếp nhận trước khi tải file.',true);picker.value='';return;}
      for(const file of [...picker.files]){
        const category=picker.dataset.category||'';
        if(!allowed.test(file.name)||!file.size||file.size>8*1024*1024){showMessage('File '+file.name+' không đúng định dạng hoặc vượt quá 8 MB.',true);continue;}
        const pending=items.find(x=>x.name===file.name&&x.size===file.size&&(x.category||'')===category&&['ERROR','UPLOADING'].includes(x.status)&&!x.file);
        if(pending){pending.file=file;pending.status='QUEUED';continue;}
        if(category==='incident'&&items.some(x=>x.category==='incident')){showMessage('Mẫu thu thập thông tin sự cố tối đa 1 file. Bỏ file cũ trước khi chọn file mới.',true);break;}
        if(items.length>=10){showMessage('Mỗi hồ sơ tối đa 10 file.',true);break;}
        items.push({id:crypto.randomUUID(),file,category,name:file.name,size:file.size,status:'QUEUED'});
      }
      picker.value='';draw();pump();
    });
    panel.addEventListener('change',async event=>{
      const select=event.target.closest('[data-upload-category]');if(!select)return;
      const item=items.find(x=>x.id===select.dataset.uploadCategory),generation=epoch;
      if(!item)return;
      categoryPending++;
      select.disabled=true;
      try{const result=await call('setCaseUploadCategory',[state.token,{sessionId,center,uploadId:item.id,category:select.value}]);if(generation===epoch)merge(result);}
      catch(error){if(generation===epoch){draw();showMessage(error.message,true)}}
      finally{categoryPending--;}
    });
    panel.addEventListener('click',async event=>{
      if(event.target.closest('[data-upload-check-session]')){key='';await scope();return;}
      const retry=event.target.closest('[data-upload-retry]'),remove=event.target.closest('[data-upload-remove]');
      const item=items.find(x=>x.id===(retry?.dataset.uploadRetry||remove?.dataset.uploadRemove));if(!item)return;
      if(retry){if(item.file){item.status='QUEUED';draw();pump();}else{try{merge(await call('getCaseUploadSession',[state.token,sessionId]));if(items.find(x=>x.id===item.id)?.status!=='READY')showMessage('Chưa xác nhận được file. Chọn lại đúng file này để thử lại; mã upload cũ sẽ được giữ.',true);}catch(e){showMessage(e.message,true)}}return;}
      const old=item.status,generation=epoch;
      try{if(['READY','REMOVING'].includes(old)){item.status='REMOVING';draw();await call('removeCaseUploadFile',[state.token,{sessionId,center,uploadId:item.id}]);}else if(old!=='QUEUED')throw new Error('Kiểm tra/thử lại file chưa xác định trước khi bỏ.');if(generation===epoch){items=items.filter(x=>x!==item);draw();}}
      catch(e){item.status=old;draw();showMessage(e.message,true);}
    });
    scope();
  }
  function prepare(){
    if(restoreFailed)throw new Error('Cần kiểm tra lại phiên upload trước khi tạo hồ sơ.');
    if(!items.length)throw new Error('Vui lòng đính kèm ít nhất một file.');
    if(working||categoryPending||items.some(x=>x.status!=='READY'))throw new Error('Các file chưa tải xong. Chờ xác nhận hoặc xử lý file lỗi trước khi tạo hồ sơ.');
    if(state.uploadCategories&&items.some(x=>!x.category))throw new Error('Vui lòng chọn nhóm cho các file cũ chưa phân nhóm.');
    return {uploadSessionId:sessionId,uploadIds:items.map(x=>x.id)};
  }
  function reset(){try{localStorage.removeItem(key);}catch(_){}epoch++;items=[];sessionId='';requestId='';key='';draw();scope();}
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach();
  return {enabled,prepare,reset,requestId:()=>requestId};
})();
