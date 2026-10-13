window.SungrowWorkOrderLocks=(()=>{
 function attach(form,c,w){
  if(form._workLock)return;
  const fields=form.elements,today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const context={currentStatus:w.workflowStatus,previousReplacementType:w.replacementType,receivedAt:w.receivedAt,warrantyPending:c.warrantyStatus==='Chờ xác nhận',caseClosed:c.isClosed===true,today:today()};
  const notice=document.createElement('div');notice.className='notice work-rule-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');form.querySelector('.grid').after(notice);
  const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='Xóa dữ liệu hoàn tất trong biểu mẫu';notice.after(reset);
  let priorStatus=fields.workflowStatus.value,priorOutcome=fields.outcome.value;
  function values(){
   const p={};for(const name of ['workflowStatus','outcome','technicalCompletedAt','diagnosisCompletedAt','replacementType'])p[name]=fields[name].value;
   p.issues=[...form.querySelectorAll('.issues .repeat-row')].map(r=>({code:r.children[0].value,name:r.children[1].value,confirmedAt:r.children[2].value}));
   p.parts=[...form.querySelectorAll('.parts .repeat-row')].map(r=>({partNumber:r.children[0].value,name:r.children[1].value,quantity:r.children[2].value,receivedAt:r.dataset.receivedAt||'',usedAt:r.dataset.usedAt||p.technicalCompletedAt}));
   p.holds=[...form.querySelectorAll('.holds .repeat-row')].map(r=>({reason:r.children[0].value,startAt:r.children[1].value,endAt:r.children[2].value}));return p;
  }
  function sync(){
   context.today=today();const working=SungrowWorkOrderRules.active.includes(fields.workflowStatus.value),pending=context.warrantyPending;
   fields.workflowStatus.disabled=context.caseClosed;
   fields.outcome.disabled=working||pending;fields.technicalCompletedAt.disabled=working||pending;
   fields.outcome.required=fields.workflowStatus.value==='Hoàn tất kỹ thuật';fields.technicalCompletedAt.required=fields.outcome.required;
   fields.replacementType.disabled=working||pending||fields.outcome.value!=='Đổi thiết bị';fields.replacementType.required=!fields.replacementType.disabled;
   for(const name of ['diagnosisCompletedAt','technicalCompletedAt']){fields[name].max=context.today;if(context.receivedAt)fields[name].min=context.receivedAt;}
   if(fields.diagnosisCompletedAt.value)fields.technicalCompletedAt.min=fields.diagnosisCompletedAt.value;
   form.querySelectorAll('.issues input[type=date],.holds input[type=date]').forEach(x=>{x.max=context.today;if(context.receivedAt)x.min=context.receivedAt;});
   form.querySelectorAll('.parts input,.parts .inline-add').forEach(x=>x.disabled=pending);
   form.querySelectorAll('.holds .repeat-row').forEach(r=>{r.children[2].min=r.children[1].value||context.receivedAt||'';});
   const errors=SungrowWorkOrderRules.validate(values(),context),text=errors.length?errors.join(' '):working?'Kết quả cuối và ngày hoàn tất chỉ mở khi chọn Hoàn tất kỹ thuật.':'';
   if(notice.textContent!==text)notice.textContent=text;notice.hidden=!text;notice.classList.toggle('error',errors.length>0);
   reset.hidden=!(working||pending)&&!(fields.outcome.value!=='Đổi thiết bị'&&fields.replacementType.value)||!Boolean(fields.outcome.value||fields.technicalCompletedAt.value||fields.replacementType.value);
   const resetLabel=working||pending?'Xóa dữ liệu hoàn tất trong biểu mẫu':'Xóa loại thiết bị đổi không phù hợp';if(reset.textContent!==resetLabel)reset.textContent=resetLabel;
  }
  function clearFinal(){fields.outcome.value='';fields.technicalCompletedAt.value='';fields.replacementType.value='';form.dispatchEvent(new Event('input',{bubbles:true}));}
  reset.onclick=()=>{if(confirm('Chỉ xóa thông tin không phù hợp trong biểu mẫu. Hồ sơ chỉ thay đổi khi bấm Lưu cập nhật. Tiếp tục?')){if(SungrowWorkOrderRules.active.includes(fields.workflowStatus.value)||context.warrantyPending){clearFinal();priorOutcome='';}else{fields.replacementType.value='';form.dispatchEvent(new Event('input',{bubbles:true}));}sync();}};
  form.addEventListener('change',e=>{
   if(e.target===fields.workflowStatus&&SungrowWorkOrderRules.active.includes(fields.workflowStatus.value)&&(fields.outcome.value||fields.technicalCompletedAt.value||fields.replacementType.value)){
    if(confirm('Chuyển về trạng thái đang xử lý sẽ xóa kết quả cuối, ngày hoàn tất và loại thiết bị đổi trong biểu mẫu. Tiếp tục?'))clearFinal();else fields.workflowStatus.value=priorStatus;
   }
   if(e.target===fields.outcome&&fields.outcome.value!=='Đổi thiết bị'&&fields.replacementType.value){if(confirm('Kết quả mới không dùng thiết bị đổi. Xóa loại thiết bị đổi trong biểu mẫu?'))fields.replacementType.value='';else fields.outcome.value=priorOutcome;}
   priorStatus=fields.workflowStatus.value;priorOutcome=fields.outcome.value;sync();
  },true);
  form.addEventListener('input',sync);new MutationObserver(sync).observe(form,{childList:true,subtree:true});
  form._workLock={validate(){sync();const errors=SungrowWorkOrderRules.validate(values(),context);if(errors.length){notice.scrollIntoView({block:'nearest'});return false;}return true;}};
  sync();setTimeout(()=>{priorStatus=fields.workflowStatus.value;priorOutcome=fields.outcome.value;sync();},0);
 }
 return {attach,validate:form=>form._workLock?.validate()!==false};
})();
