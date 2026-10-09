(() => {
  const day = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const date = value => new Date(value+'T00:00:00Z');
  const iso = value => value.toISOString().slice(0,10);
  function shift(value, months) { const d=date(value),n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);d.setUTCDate(Math.min(n,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return iso(d); }
  let start=day(new Date()).slice(0,8)+'01',end=day(new Date()),mode='month',root,enabled=false;
  window.SungrowPeriod={
    selected:()=>enabled?start+'..'+end:mode==='year'?start.slice(0,4):start.slice(0,7),
    activate(value){enabled=value===true;if(!root)return;root.querySelectorAll('[data-range-mode]').forEach(b=>{b.disabled=!enabled&&!['month','year'].includes(b.dataset.rangeMode);b.title=b.disabled?'Bật sau khi cập nhật backend':'';});root.querySelector('.sg-range-button').disabled=!enabled;},
    compare:()=>root?.querySelector('#sg-compare-mode')?.value==='year',
    previous(){const months=this.compare()?-12:-1;let a=shift(start,months),b=shift(end,months);if(!enabled)return mode==='year'?String(Number(start.slice(0,4))-1):a.slice(0,7);const d=date(end);if(start.slice(8)==='01'&&d.getUTCDate()===new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()){const x=date(b);x.setUTCMonth(x.getUTCMonth()+1,0);b=iso(x);}return a+'..'+b;},
    install(element,onChange){
      root=element;const old=root.querySelector('.sg-filter-panel'),controls=root.querySelector('.sg-controls');
      const toolbar=document.createElement('div');toolbar.className='sg-period-toolbar';
      toolbar.innerHTML='<div class="sg-period-segments" role="group" aria-label="Kỳ báo cáo">'+['Day','Week','Month','Year','Custom'].map(name=>'<button type="button" data-range-mode="'+name.toLowerCase()+'" aria-pressed="false">'+name+'</button>').join('')+'</div><button type="button" class="sg-range-button" aria-haspopup="dialog"></button>';
      ['#sg-center','#sg-compare-mode'].forEach(selector=>{const input=root.querySelector(selector);toolbar.append(input.closest('label'));});
      controls.prepend(toolbar);
      ['#sg-period','#sg-period-year','#sg-period-month'].forEach(selector=>root.querySelector(selector)?.closest('label')?.classList.add('sg-range-legacy'));
      const compare=root.querySelector('#sg-compare-mode');compare.innerHTML='<option value="month">Tháng trước</option><option value="year">Năm trước</option>';compare.title='So sánh cùng khoảng ngày của tháng trước hoặc năm trước';
      root.querySelector('#sg-center option[value=all]').textContent='Tất cả center';
      const dialog=document.createElement('dialog');dialog.className='sg-range-dialog';dialog.innerHTML='<form method="dialog"><h3>Chọn khoảng ngày</h3><div class="sg-range-fields"><label>Từ ngày<input type="date" name="start" required></label><label>Đến ngày<input type="date" name="end" required></label></div><p role="alert"></p><div class="sg-range-actions"><button type="button" data-cancel>Hủy</button><button type="submit">Áp dụng</button></div></form>';root.append(dialog);
      const from=dialog.querySelector('[name=start]'),to=dialog.querySelector('[name=end]');from.min=to.min='2024-01-01';from.max=to.max=day(new Date());
      const display=value=>{const [y,m,d]=value.split('-');return d+'/'+m+'/'+y;};
      function render(){toolbar.querySelector('.sg-range-button').textContent=display(start)+' 00:00 – '+display(end)+' 23:59';toolbar.querySelectorAll('[data-range-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rangeMode===mode)));}
      function open(){from.value=start;to.value=end;dialog.querySelector('[role=alert]').textContent='';dialog.showModal();}
      toolbar.querySelector('.sg-range-button').addEventListener('click',open);
      toolbar.querySelectorAll('[data-range-mode]').forEach(button=>button.addEventListener('click',()=>{const choice=button.dataset.rangeMode;if(choice==='custom'){open();return;}mode=choice;end=day(new Date());start=end;if(mode==='week'){const d=date(end);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));start=iso(d);}if(mode==='month')start=end.slice(0,8)+'01';if(mode==='year')start=end.slice(0,4)+'-01-01';render();onChange();}));
      dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.close());
      dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();if(from.value>to.value){dialog.querySelector('[role=alert]').textContent='Ngày bắt đầu phải ≤ ngày kết thúc.';return;}start=from.value;end=to.value;mode='custom';render();dialog.close();onChange();});
      compare.addEventListener('change',onChange);render();
    }
  };
})();
