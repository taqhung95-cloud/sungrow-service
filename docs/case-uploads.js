/* Staged uploads: one file at a time, progress counts Drive-confirmed files, no fake byte %. */
globalThis.portalUploads = (() => {
  const allowed=/\.(doc|docx|pdf|xls|xlsx|zip|rar|jpg|jpeg|png)$/i;
  let form,panel,input,items=[],sessionId='',requestId='',key='',center='',epoch=0,working=false,restoreFailed=false;
  const enabled=()=>typeof state!=='undefined'&&!!state.temporaryUploads;
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=()=>{try{localStorage.setItem(key,JSON.stringify({sessionId,requestId}));}catch(_){}};
  function draw(){
    if(!panel)return;
    const ready=items.filter(x=>x.status==='READY').length;
    panel.innerHTML=`<div class="upload-summary" role="status" aria-live="polite">${ready}/${items.length} file đã được Drive xác nhận · Tối đa 10 file, 8 MB/file</div>${restoreFailed?'<button type="button" class="secondary" data-upload-check-session>Kiểm tra lại phiên upload</button>':''}<progress max="${items.length||1}" value="${ready}" aria-label="Số file đã upload thành công"></progress><div class="upload-list">${items.map(x=>`<div class="upload-item"><div><strong>${escape(x.name)}</strong><small>${(x.size/1024/1024).toFixed(2)} MB · ${x.status==='READY'?'Đã tải lên':x.status==='SENDING'?'Đang gửi / chờ Drive lưu':x.status==='QUEUED'?'Chờ tải':escape(x.error||'Chưa xác nhận kết quả')}</small></div><div class="upload-actions">${['ERROR','UPLOADING'].includes(x.status)?`<button type="button" class="secondary" data-upload-retry="${escape(x.id)}">${x.file?'Thử lại':'Kiểm tra'}</button>`:''}<button type="button" class="secondary" data-upload-remove="${escape(x.id)}" ${['SENDING','UPLOADING'].includes(x.status)?'disabled':''}>Bỏ</button></div></div>`).join('')}</div><p class="muted">File lưu tạm 24 giờ, chưa tạo hồ sơ. Chỉ bấm Tạo hồ sơ sau khi mọi file đã được xác nhận. Nếu không tạo, đợt dọn định kỳ sẽ đưa file tạm hết hạn vào thùng rác.</p>`;
  }
  function merge(result){
    const locals=new Map(items.map(x=>[x.id,x]));
    const remote=result.files.map(x=>({...locals.get(x.uploadId),id:x.uploadId,name:x.name,size:x.size,status:x.status}));
    const ids=new Set(remote.map(x=>x.id));
    items=[...remote,...items.filter(x=>!ids.has(x.id))];draw();
  }
  async function scope(){
    if(!form||!enabled())return;
    const next=form.elements.intakeCenter.value;
    const nextKey='sungrow:temp-uploads:v1:'+state.actor.email+':'+next;
    if(nextKey===key)return;
    epoch++;center=next;key=nextKey;items=[];sessionId='';requestId='';restoreFailed=false;input.disabled=false;input.value='';draw();
    const generation=epoch;
    if(!center)return;
    try{
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      if(saved){sessionId=saved.sessionId;requestId=saved.requestId;input.disabled=true;
        const created=await call('getCreationStatus',[state.token,requestId]);
        if(generation!==epoch)return;
        if(created.found){localStorage.removeItem(key);sessionId=crypto.randomUUID();requestId=crypto.randomUUID();store();input.disabled=false;showMessage('Phiên upload trước đã tạo hồ sơ '+created.caseId+'. Không cần gửi lại các file cũ.');return;}
        const result=await call('getCaseUploadSession',[state.token,sessionId]);
        if(generation!==epoch)return;
        if(result.state==='CLAIMED'){merge(result);input.disabled=true;showMessage('Phiên file đang gắn vào yêu cầu tạo hồ sơ. Bấm Tạo hồ sơ để kiểm tra kết quả cũ.');return;}
        if(result.state!=='OPEN'||result.expiresAt<=Date.now()){try{localStorage.removeItem(key);}catch(_){}sessionId=crypto.randomUUID();requestId=crypto.randomUUID();store();input.disabled=false;showMessage('Phiên file tạm trước đã hết hạn. Vui lòng chọn lại file.',true);return;}
        input.disabled=false;merge(result);return;
      }
    }catch(error){if(generation!==epoch)return;restoreFailed=true;input.disabled=true;draw();showMessage('Không đọc được phiên upload. Mã phiên vẫn được giữ; bấm Kiểm tra lại, không tạo phiên mới. '+error.message,true);return;}
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
            try{result=await call('uploadCaseFile',[state.token,{sessionId:session,center:target,uploadId:item.id,name:item.name,base64}]);break;}
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
    const field=input.closest('.span3');field.querySelector('label').textContent='Hồ sơ đính kèm *';
    field.querySelector('.muted').textContent='Chọn file để bắt đầu upload. DOC/DOCX, PDF, XLS/XLSX, ZIP/RAR, JPG/JPEG, PNG.';
    panel=document.createElement('div');panel.className='case-upload-panel';input.after(panel);
    form.elements.intakeCenter.addEventListener('change',scope);
    input.addEventListener('change',async()=>{
      await scope();
      if(!center){showMessage('Chọn trung tâm tiếp nhận trước khi tải file.',true);input.value='';return;}
      for(const file of [...input.files]){
        if(!allowed.test(file.name)||!file.size||file.size>8*1024*1024){showMessage('File '+file.name+' không đúng định dạng hoặc vượt quá 8 MB.',true);continue;}
        const pending=items.find(x=>x.name===file.name&&x.size===file.size&&['ERROR','UPLOADING'].includes(x.status)&&!x.file);
        if(pending){pending.file=file;pending.status='QUEUED';continue;}
        if(items.length>=10){showMessage('Mỗi hồ sơ tối đa 10 file.',true);break;}
        items.push({id:crypto.randomUUID(),file,name:file.name,size:file.size,status:'QUEUED'});
      }
      input.value='';draw();pump();
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
    if(working||items.some(x=>x.status!=='READY'))throw new Error('Các file chưa tải xong. Chờ xác nhận hoặc xử lý file lỗi trước khi tạo hồ sơ.');
    return {uploadSessionId:sessionId,uploadIds:items.map(x=>x.id)};
  }
  function reset(){try{localStorage.removeItem(key);}catch(_){}epoch++;items=[];sessionId='';requestId='';key='';draw();scope();}
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach();
  return {enabled,prepare,reset,requestId:()=>requestId};
})();
