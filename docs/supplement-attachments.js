window.SungrowSupplementAttachments=(()=>{
 let current=null;
 const allowed=/\.(doc|docx|pdf|xls|xlsx|zip|rar|jpg|jpeg|png|txt|csv)$/i;
 function mount(host,item){
  if(current?.busy)return;
  if(current?.host===host)return;
  current?.ui.dispose();
  const token=state.token,email=state.actor.email,caseId=item.caseId,center=item.currentCenter;
  const key='sungrow:supplement:v1:'+email+':'+caseId;
  const draft={host,items:[],sessionId:crypto.randomUUID(),busy:false,uncertainCommit:false,restoring:false,restoreFailed:false,message:'',ui:null};current=draft;
  host.innerHTML='<p class="supplement-note">File mới được lưu vào thư mục Drive hiện tại của hồ sơ sau khi bấm Lưu vào hồ sơ.</p><div class="supplement-upload"></div><div class="supplement-actions"><button type="button" class="primary" data-save>Lưu vào hồ sơ</button></div>';
  const save=host.querySelector('[data-save]');
  const valid=()=>state.token===token&&state.actor?.email===email;
  const request=(name,payload)=>{if(!valid())throw Error('Phiên tài khoản đã thay đổi. Vui lòng mở lại hồ sơ.');return call(name,[token,payload]);};
  const persist=()=>{localStorage.setItem(key,JSON.stringify({sessionId:draft.sessionId,center}));};
  function render(){
   draft.ui.update(draft.items,draft.message,draft.busy);draft.ui.setDisabled(draft.busy||draft.restoring||draft.restoreFailed||draft.uncertainCommit);
   save.disabled=draft.busy||draft.restoring||draft.restoreFailed||!draft.items.length||draft.items.some(x=>x.status!=='READY');
   if(draft.restoreFailed){const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Kiểm tra lại';retry.onclick=restore;host.querySelector('.attachment-status').append(retry);}
  }
  function merge(result){
   const locals=new Map(draft.items.map(x=>[x.id,x]));
   draft.items=result.files.map(x=>({...locals.get(x.uploadId),id:x.uploadId,name:x.name,size:x.size,status:x.status,category:x.category,fileId:x.fileId}));
  }
  async function pump(){
   if(draft.busy||draft.restoring)return;draft.busy=true;render();
   try{for(const item of draft.items.filter(x=>x.status==='QUEUED')){
    item.status='SENDING';draft.message='Đang tải file bổ sung…';render();
    try{persist();await request('beginCaseUpload',{sessionId:draft.sessionId,center,caseId});
     let result;
     for(let attempt=0;attempt<20;attempt++){
      try{result=await request('uploadCaseFile',{sessionId:draft.sessionId,center,uploadId:item.id,name:item.name,category:item.category,base64:await fileToBase64(item.file)});break;}
      catch(e){if(!/^\[UPLOAD_BUSY\]/.test(e.message)||attempt===19)throw e;await new Promise(r=>setTimeout(r,2000+Math.random()*3000));}
     }
     const locals=draft.items.filter(x=>x.id!==item.id&&x.status==='QUEUED');merge(result);draft.items.push(...locals);
    }catch(e){item.status='ERROR';item.error=e.message;draft.message=e.message;}
   }}finally{draft.busy=false;if(draft.items.every(x=>x.status==='READY'))draft.message='File đã tải xong. Bấm Lưu vào hồ sơ để hoàn tất.';render();}
  }
  draft.ui=SungrowAttachmentUI.mount(host.querySelector('.supplement-upload'),{
   onFiles(files,category){
    if(draft.busy||draft.restoring||draft.restoreFailed||draft.uncertainCommit)return;
    for(const file of files){if(!allowed.test(file.name)||!file.size){draft.message='File '+file.name+' trống hoặc không đúng định dạng.';continue;}
     const uncertain=draft.items.find(x=>!x.file&&x.name===file.name&&x.size===file.size&&x.category===category&&['ERROR','UPLOADING'].includes(x.status));
     if(uncertain){uncertain.file=file;uncertain.status='QUEUED';continue;}
     draft.items.push({id:crypto.randomUUID(),name:file.name,size:file.size,file,category,status:'QUEUED'});
    }render();pump();
   },
   async onRetry(item){
    if(draft.busy)return;
    if(item.file){item.status='QUEUED';pump();return;}
    draft.busy=true;render();try{merge(await request('getCaseUploadSession',draft.sessionId));draft.message='Đã kiểm tra file. Nếu chưa xác nhận, chọn lại đúng file để thử lại.';}catch(e){draft.message=e.message;}finally{draft.busy=false;render();}
   },
   async onRemove(item){
    if(draft.busy||draft.uncertainCommit)return;
    const old=item.status;draft.busy=true;render();
    try{if(old==='READY')await request('removeCaseUploadFile',{sessionId:draft.sessionId,center,uploadId:item.id});else if(old!=='QUEUED')throw Error('Kiểm tra file chưa xác nhận trước khi xóa.');draft.items=draft.items.filter(x=>x.id!==item.id);draft.message='';}
    catch(e){draft.message=e.message;}finally{draft.busy=false;render();}
   }
  });
  save.onclick=async()=>{
   if(save.disabled)return;draft.busy=true;draft.uncertainCommit=true;draft.message='Đang lưu file vào hồ sơ…';render();
   try{
    const result=await request('commitCaseAttachments',{caseId,sessionId:draft.sessionId,uploadIds:draft.items.map(x=>x.id)});
    if(result?.ok!==true||result.caseId!==caseId||result.sessionId!==draft.sessionId)throw Error('Chưa xác nhận được kết quả đúng hồ sơ. Vui lòng thử lưu lại.');
    localStorage.removeItem(key);draft.message='Đã bổ sung '+result.added+' file vào hồ sơ.';draft.items=[];draft.uncertainCommit=false;draft.sessionId=crypto.randomUUID();
   }catch(e){draft.message=e.message+' File được giữ nguyên; bấm Lưu vào hồ sơ để kiểm tra/thử lại.';}
   finally{draft.busy=false;render();}
  };
  async function restore(){
   const saved=localStorage.getItem(key);if(!saved){render();return;}
   draft.restoring=true;draft.restoreFailed=false;draft.message='Đang kiểm tra file bổ sung đã tải…';render();
   try{const data=JSON.parse(saved);if(data.center!==center)throw Error('Center đã thay đổi. Phiên cũ được giữ để quản lý kiểm tra.');draft.sessionId=data.sessionId;
    let result;
    try{result=await request('getCaseUploadSession',draft.sessionId);}
    catch(e){
     if(String(e.message).trim()!=='Không tìm thấy phiên upload của tài khoản này.')throw e;
     const status=await request('getCaseAttachmentReceipt',{caseId,sessionId:draft.sessionId});
     localStorage.removeItem(key);draft.sessionId=crypto.randomUUID();draft.message=status.found?'Phiên trước đã bổ sung file thành công.':'Phiên tạm chưa bắt đầu hoặc đã hết hạn. Vui lòng chọn lại file.';return;
    }
    if(result.supplementalCaseId!==caseId)throw Error('Phiên đính kèm không thuộc hồ sơ này.');
    if(result.state==='COMMITTED'){localStorage.removeItem(key);draft.sessionId=crypto.randomUUID();draft.message='Phiên trước đã bổ sung file thành công.';}
    else{merge(result);draft.uncertainCommit=result.state==='ATTACHING';draft.message=draft.uncertainCommit?'File đang/đã được gắn một phần. Bấm Lưu vào hồ sơ để kiểm tra kết quả.':'Đã khôi phục file bổ sung.';}
    draft.restoring=false;
   }catch(e){draft.restoreFailed=true;draft.message=e.message+' Phiên cũ vẫn được giữ.';}
   finally{draft.restoring=false;render();}
  }
  restore();
 }
 function canLeave(){if(current?.busy){current.message='Đang xử lý đính kèm. Vui lòng chờ kết quả trước khi đóng hoặc đổi hồ sơ.';current.ui.update(current.items,current.message,true);return false;}return true;}
 function dispose(){if(!canLeave())return false;current?.ui.dispose();current=null;return true;}
 window.addEventListener('beforeunload',e=>{if(current?.busy){e.preventDefault();e.returnValue='';}});
 return {mount,canLeave,dispose};
})();
