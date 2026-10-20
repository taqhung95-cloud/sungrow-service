/* Scope extension only. The standard entry forms, save APIs and parts rows remain
 * the UI and data contract for every device type. No parallel Fan editor. */
window.SungrowFanSharedForms=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const requests=new Map(),approved=status=>['Trong bảo hành','Ngoài bảo hành','Sửa làm hàng good'].includes(status);
  function scope(form,item,operation){
    const box=document.createElement('section');box.className='fan-work-scope';
    const counts=operation!=='warranty';box.innerHTML='<div class="fan-scope-head"><strong>Chọn inverter cần '+(operation==='warranty'?'xác nhận bảo hành':operation==='return'?'giao trả':'cập nhật')+'</strong><label><input type="checkbox" data-fan-all> Chọn tất cả</label><span data-fan-selected>Chưa chọn inverter</span></div><div class="fan-scope-table"><table class="case-table fan-compact-table"><colgroup><col class="fan-col-check"><col class="fan-col-serial"><col class="fan-col-model"><col class="fan-col-number"><col class="fan-col-warranty"><col class="fan-col-status"><col class="fan-col-number"><col class="fan-col-number">'+(counts?'<col class="fan-col-entry">':'')+'</colgroup><thead><tr><th>Chọn</th><th>S/N inverter</th><th>Model / Mã Fan</th><th>Số quạt lỗi</th><th>Bảo hành</th><th>Trạng thái</th><th>Đã trả</th><th>Còn lại</th>'+(counts?'<th data-fan-count-label>'+(operation==='return'?'Giao lần này':'Số Fan xử lý')+'</th>':'')+'</tr></thead><tbody>'+item.fanLot.state.lines.map(l=>{
      const remaining=operation==='return'?l.completed-l.returned:l.quantity-l.completed;
      return '<tr data-fan-line="'+esc(l.lineId)+'"><td><input type="checkbox" name="fanScope-'+esc(l.lineId)+'" data-fan-check '+(operation==='return'&&!remaining?'disabled':'')+' aria-label="Chọn '+esc(l.serialNumber||l.note||l.lineId)+'"></td><td>'+esc(l.serialNumber||l.note||'Chưa rõ S/N')+'</td><td>'+esc(l.fanModel||item.model||'Chưa xác định')+'</td><td>'+l.quantity+'</td><td>'+esc(l.warrantyStatus||item.warrantyStatus||'Chờ xác nhận')+'</td><td>'+esc(SungrowFanLots.lineStatus(item,l))+'</td><td>'+l.returned+'</td><td>'+(l.quantity-l.returned)+'</td>'+(counts?'<td><input name="fanQuantity-'+esc(l.lineId)+'" data-fan-qty type="number" min="'+(operation==='return'?1:0)+'" step="1" max="'+(operation==='return'?remaining:l.quantity)+'" value="'+Math.max(0,remaining)+'" aria-label="Số Fan '+esc(l.serialNumber||l.lineId)+'"></td>':'')+'</tr>';
    }).join('')+'</tbody></table></div>';
    form.querySelector('.grid').before(box);
    const selected=()=>[...box.querySelectorAll('[data-fan-line]')].filter(r=>r.querySelector('[data-fan-check]').checked).map(r=>({lineId:r.dataset.fanLine,quantity:counts?Number(r.querySelector('[data-fan-qty]').value):item.fanLot.state.lines.find(l=>l.lineId===r.dataset.fanLine).quantity}));
    function sync(){const values=selected(),checks=[...box.querySelectorAll('[data-fan-check]:not(:disabled)')];box.querySelector('[data-fan-selected]').textContent=values.length?values.length+' inverter đã chọn':'Chưa chọn inverter';const all=box.querySelector('[data-fan-all]');all.checked=checks.length>0&&checks.every(c=>c.checked);all.indeterminate=values.length>0&&!all.checked;
      box.querySelectorAll('[data-fan-line]').forEach(r=>{const qty=r.querySelector('[data-fan-qty]');if(qty)qty.disabled=!r.querySelector('[data-fan-check]').checked;});
      const save=form.querySelector('button[type=submit]');if(save)save.disabled=!values.length||item.fanLot.pendingSync===true;
    }
    box.querySelector('[data-fan-all]').onchange=e=>{box.querySelectorAll('[data-fan-check]:not(:disabled)').forEach(c=>c.checked=e.target.checked);box.dispatchEvent(new Event('change',{bubbles:true}));};
    box.addEventListener('change',sync);box.addEventListener('input',e=>{if(!e.target.matches('[data-fan-all]'))sync();});sync();setTimeout(sync,0);
    form._fanSelections=selected;form._fanScope=box;form._fanItem=item;form._fanOperation=operation;
    const fingerprint=form.querySelector('[name=fanFingerprint]')||document.createElement('input');fingerprint.type='hidden';fingerprint.name='fanFingerprint';fingerprint.value=item.fanLot.fingerprint;if(!fingerprint.isConnected)form.append(fingerprint);
    if(item.fanLot.pendingSync){const notice=document.createElement('p');notice.className='notice error';notice.textContent='Hồ sơ cần đối soát đồng bộ trước khi cập nhật tiếp.';box.after(notice);}
    return box;
  }
  function attachWork(form,item,work){
    enhanceActionForm(form);const box=scope(form,item,'work');
    form._fanWarrantyPending=()=>{const ids=form._fanSelections().map(s=>s.lineId);return !ids.length||item.fanLot.state.lines.some(l=>ids.includes(l.lineId)&&!approved(l.warrantyStatus||item.warrantyStatus));};
    let edited=false;form.addEventListener('input',e=>{if(e.target!==form&&!e.target.closest('.fan-work-scope'))edited=true;});
    const sync=fromScope=>{
      const selections=form._fanSelections(),lines=item.fanLot.state.lines.filter(l=>selections.some(s=>s.lineId===l.lineId)),current=form.elements.workflowStatus.value;
      const choices=workStatuses({...item,warrantyStatus:form._fanWarrantyPending()?'Chờ xác nhận':'Trong bảo hành'},work);
      form.elements.workflowStatus.innerHTML=choices.map(v=>'<option>'+esc(v)+'</option>').join('');
      if(choices.includes(current))form.elements.workflowStatus.value=current;
      if(fromScope&&!edited&&lines.length){const statuses=lines.map(l=>l.completed===l.quantity?'Hoàn tất kỹ thuật':item.fanLot.state.workflowWorkId===work.workOrderId?(l.workflowStatus||item.fanLot.state.workflowDefault):work.workflowStatus==='Hoàn tất kỹ thuật'?'Đang sửa chữa':work.workflowStatus);
        if(statuses.every(v=>v===statuses[0])&&choices.includes(statuses[0]))form.elements.workflowStatus.value=statuses[0];
        if(lines.length===1&&lines[0].completed===lines[0].quantity){form.elements.outcome.value=lines[0].outcome||work.outcome||'';form.elements.technicalCompletedAt.value=lines[0].technicalCompletedAt||work.technicalCompletedAt||'';}
      }
      const completing=form.elements.workflowStatus.value==='Hoàn tất kỹ thuật';box.querySelector('[data-fan-count-label]').textContent=completing?'Hoàn tất thêm':'Số Fan xử lý';box.querySelector('[data-fan-count-label]').title=completing?'Chỉ nhập số Fan hoàn tất thêm trong lần lưu này.':'Số Fan thuộc các inverter được chọn để cập nhật trạng thái hoặc ghi nhận lỗi.';
      box.querySelectorAll('[data-fan-line]').forEach(r=>{const l=item.fanLot.state.lines.find(l=>l.lineId===r.dataset.fanLine),qty=r.querySelector('[data-fan-qty]');qty.max=String(completing?l.quantity-l.completed:l.quantity);});
      const warning=form.querySelector('.work-warranty-message');if(warning)warning.hidden=!form._fanWarrantyPending();form.dispatchEvent(new Event('input',{bubbles:true}));
    };
    box.addEventListener('change',()=>sync(true));form.elements.workflowStatus.addEventListener('change',()=>sync(false));setTimeout(()=>sync(false),0);
    // Old journaled rows remain visible in the same table. Re-linking one does
    // not consume it twice. New rows use the ordinary partRow/addPartRow controls.
    form.querySelectorAll('.parts .repeat-row[data-part-usage-id]').forEach(row=>{
      if(!row.dataset.partUsageId)return;row.querySelectorAll('input').forEach(e=>e.readOnly=true);const remove=row.querySelector('.danger');const label=document.createElement('label');label.className='fan-part-link';label.innerHTML='<input type="checkbox" name="fanExistingPart-'+esc(row.dataset.partUsageId)+'" data-fan-part-link value="'+esc(row.dataset.partUsageId)+'"> Liên kết';label.title='Dùng bản ghi đã lưu cho lần xử lý này; không cộng lại số lượng.';remove.replaceWith(label);
    });
    form.querySelectorAll('.issues .repeat-row[data-issue-id]').forEach(row=>{if(!row.dataset.issueId)return;row.querySelectorAll('input').forEach(e=>e.readOnly=true);const b=row.querySelector('.danger');if(b){b.disabled=true;b.title='Lỗi đã ghi nhận được giữ lại để đối soát.';}});
  }
  function prepare(form,data){
    if(!form._fanSelections)return data;const selections=form._fanSelections();if(!selections.length)throw Error('Chọn ít nhất một inverter.');
    for(const key of Object.keys(data))if(/^fanScope-|^fanQuantity-|^fanExistingPart-/.test(key))delete data[key];
    delete data.requestId;data.fanSelections=selections;data.fanFingerprint=form._fanItem.fanLot.fingerprint;
    if(form._fanOperation==='work')data.fanExistingPartIds=[...form.querySelectorAll('[data-fan-part-link]:checked')].map(c=>c.value);
    const signature=form._fanItem.caseId+'|'+form._fanOperation+'|'+JSON.stringify(data);data.requestId=requests.get(signature)||crypto.randomUUID();requests.set(signature,data.requestId);return data;
  }
  function attachScope(form,item,operation){enhanceActionForm(form);return scope(form,item,operation);}
  function correction(form,item){
    if(!item.fanLot)return;for(const name of ['deviceType','serialNumber','quantity','receivedAt','readyAt','returnedAt'])form.elements[name].disabled=true;
    if(!state.fanLotModels){if(item.fanLot.state.lines.some(l=>l.fanModel))form.elements.model.disabled=true;return;}
    form.elements.model.disabled=true;const supported=item.fanLot.inverterModelCorrection===true;form.dataset.inverterModelCorrection=String(supported);
    const box=document.createElement('div');box.className='fl-model-correction';
    box.innerHTML='<div class="fl-correction-heading"><h4>Model theo S/N inverter</h4><button type="button" class="secondary" data-lookup-models>Tra lại Model inverter</button></div><p class="parts-date-help" data-model-status></p><div class="fan-scope-table"><table class="case-table fan-compact-table"><thead><tr><th>S/N inverter</th><th>Model inverter — tự tra</th><th>Model / Mã Fan</th></tr></thead><tbody>'+item.fanLot.state.lines.map(l=>'<tr><td>'+esc(l.serialNumber||l.note||'Chưa rõ S/N')+'</td><td><input data-inverter-line="'+esc(l.lineId)+'" aria-label="Model inverter '+esc(l.serialNumber||l.lineId)+'" readonly class="fl-derived-field" value="'+esc(l.inverterModel||'')+'"></td><td><input name="fanModel-'+esc(l.lineId)+'" data-model-line="'+esc(l.lineId)+'" aria-label="Model Fan '+esc(l.serialNumber||l.lineId)+'" maxlength="100" required value="'+esc(l.fanModel||item.model||'')+'"></td></tr>').join('')+'</tbody></table></div>';
    form.querySelector('.grid').before(box);const status=box.querySelector('[data-model-status]'),button=box.querySelector('[data-lookup-models]');
    const note=supported?'Model inverter tra theo S/N; Model Fan nhập riêng. Bấm Lưu chỉnh sửa để ghi vào hồ sơ.':'Cần cập nhật FanLots.gs để lưu Model inverter cho hồ sơ cũ. Model Fan vẫn sửa được.';
    async function lookup(force=false){
      if(form.dataset.modelLookupBusy==='true')return;const token=state.token;form.dataset.modelLookupBusy='true';button.disabled=true;
      const submit=form.querySelector('button[type=submit]'),wasDisabled=submit.disabled;submit.disabled=true;status.textContent='Đang tra Model inverter…';let found=0,missing=0;
      try{await Promise.all(item.fanLot.state.lines.map(async line=>{
        const input=box.querySelector('[data-inverter-line="'+CSS.escape(line.lineId)+'"]');if(!line.serialNumber||(!force&&input.value))return;
        try{const result=await SungrowWarranty.lookup(line.serialNumber);if(!form.isConnected||token!==state.token)return;if(result.model){input.value=result.model;found++;input.title=result.model;}else{missing++;input.placeholder='Chưa tìm thấy Model';input.title=result.label||'Nguồn tra chưa có Model';}}
        catch(error){missing++;if(form.isConnected){input.placeholder='Chưa tra được — thử lại';input.title=error.message;}}
      }));if(form.isConnected&&token===state.token)status.textContent=note+(found?' Đã tra được '+found+' inverter.':'')+(missing?' Có '+missing+' S/N chưa tra được; giữ nguyên Model đã lưu.':'');}
      finally{delete form.dataset.modelLookupBusy;button.disabled=false;submit.disabled=wasDisabled;}
    }
    button.onclick=()=>lookup(true);status.textContent=note;lookup();
  }

  return {attachWork,attachScope,prepare,correction};
})();
