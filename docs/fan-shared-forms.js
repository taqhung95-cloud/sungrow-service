/* Scope extension only. The standard entry forms, save APIs and parts rows remain
 * the UI and data contract for every device type. No parallel Fan editor. */
window.SungrowFanSharedForms=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const requests=new Map(),approved=status=>['Trong bảo hành','Ngoài bảo hành','Sửa làm hàng good'].includes(status);
  function scope(form,item,operation){
    const box=document.createElement('section');box.className='fan-work-scope';
    const counts=operation!=='warranty';box.innerHTML='<div class="fan-scope-head"><strong>Inverter áp dụng</strong><label><input type="checkbox" data-fan-all> Chọn tất cả</label><span data-fan-selected>Chưa chọn inverter</span></div><div class="fan-scope-table"><table class="case-table"><thead><tr><th>Chọn</th><th>S/N inverter</th><th>Fan đã nhận</th><th>Đã hoàn tất / Đã trả</th>'+(counts?'<th data-fan-count-label>Số Fan áp dụng lần này</th>':'<th>Bảo hành</th>')+'</tr></thead><tbody>'+item.fanLot.state.lines.map(l=>{
      const remaining=operation==='return'?l.completed-l.returned:l.quantity-l.completed;
      return '<tr data-fan-line="'+esc(l.lineId)+'"><td><input type="checkbox" name="fanScope-'+esc(l.lineId)+'" data-fan-check '+(operation==='return'&&!remaining?'disabled':'')+' aria-label="Chọn '+esc(l.serialNumber||l.note||l.lineId)+'"></td><td>'+esc(l.serialNumber||l.note||'Chưa rõ S/N')+'</td><td>'+l.quantity+'</td><td>'+l.completed+' / '+l.returned+'</td><td>'+(counts?'<input name="fanQuantity-'+esc(l.lineId)+'" data-fan-qty type="number" min="'+(operation==='return'?1:0)+'" step="1" max="'+(operation==='return'?remaining:l.quantity)+'" value="'+Math.max(0,remaining)+'" aria-label="Số Fan '+esc(l.serialNumber||l.lineId)+'">':esc(l.warrantyStatus||item.warrantyStatus))+'</td></tr>';
    }).join('')+'</tbody></table></div><p class="parts-date-help">'+(operation==='work'?'Trạng thái, kết quả và lỗi áp dụng cho inverter đã chọn. GSP, MA, ngày chẩn đoán, ghi chú và SLA dùng chung cho công việc. Linh kiện nhập tổng thực dùng, không nhân theo số inverter hoặc số Fan.':operation==='return'?'Chọn inverter và số Fan giao trong lần này. Hồ sơ chỉ đóng khi đã trả hết Fan.':'Chọn inverter áp dụng kết luận bảo hành bên dưới.')+'</p>';
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
      const completing=form.elements.workflowStatus.value==='Hoàn tất kỹ thuật';box.querySelector('[data-fan-count-label]').textContent=completing?'Số Fan hoàn tất lần này':'Số Fan áp dụng lần này';
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
    const help=document.createElement('p');help.className='parts-date-help';help.textContent='Linh kiện/lỗi đã lưu được giữ để đối soát. Thêm dòng mới cho lần cập nhật này; chọn Liên kết nếu dùng linh kiện đã ghi nhận, không nhập lại số lượng cũ.';form.querySelector('.parts').before(help);
  }
  function prepare(form,data){
    if(!form._fanSelections)return data;const selections=form._fanSelections();if(!selections.length)throw Error('Chọn ít nhất một inverter.');
    for(const key of Object.keys(data))if(/^fanScope-|^fanQuantity-|^fanExistingPart-/.test(key))delete data[key];
    delete data.requestId;data.fanSelections=selections;data.fanFingerprint=form._fanItem.fanLot.fingerprint;
    if(form._fanOperation==='work')data.fanExistingPartIds=[...form.querySelectorAll('[data-fan-part-link]:checked')].map(c=>c.value);
    const signature=form._fanItem.caseId+'|'+form._fanOperation+'|'+JSON.stringify(data);data.requestId=requests.get(signature)||crypto.randomUUID();requests.set(signature,data.requestId);return data;
  }
  function attachScope(form,item,operation){enhanceActionForm(form);return scope(form,item,operation);}
  function correction(form,item){if(!item.fanLot)return;for(const name of ['deviceType','serialNumber','quantity','receivedAt','readyAt','returnedAt'])form.elements[name].disabled=true;}
  return {attachWork,attachScope,prepare,correction};
})();
