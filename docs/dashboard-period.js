(() => {
  const day = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const date = value => new Date(value+'T00:00:00Z');
  const iso = value => value.toISOString().slice(0,10);
  function shift(value, months) { const d=date(value),n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);d.setUTCDate(Math.min(n,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return iso(d); }
  let start=day(new Date()).slice(0,8)+'01',end=day(new Date()),mode='month',root,enabled=false;
  window.SungrowPeriod={
    selected:()=>enabled?start+'..'+end:mode==='year'?start.slice(0,4):start.slice(0,7),
    activate(value){enabled=value===true;if(!root)return;root.querySelectorAll('[data-range-mode]').forEach(b=>{b.disabled=!enabled&&!['month','year'].includes(b.dataset.rangeMode);b.title=b.disabled?'Bật sau khi cập nhật backend':'';});root.querySelector('.sg-range-button').disabled=!enabled;root.querySelector('.sg-range-prev').disabled=!enabled;root.querySelector('.sg-range-next').disabled=true;},
    compare:()=>root?.querySelector('#sg-compare-mode')?.value==='year',
    previous(){const months=this.compare()?-12:-1;let a=shift(start,months),b=shift(end,months);if(!enabled)return mode==='year'?String(Number(start.slice(0,4))-1):a.slice(0,7);const d=date(end);if(start.slice(8)==='01'&&d.getUTCDate()===new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()){const x=date(b);x.setUTCMonth(x.getUTCMonth()+1,0);b=iso(x);}return a+'..'+b;},
    install(element,onChange){
      root=element;const old=root.querySelector('.sg-filter-panel'),controls=root.querySelector('.sg-controls');
      const toolbar=document.createElement('div');toolbar.className='sg-period-toolbar';
      toolbar.innerHTML='<div class="sg-period-segments" role="group" aria-label="Kỳ báo cáo">'+['Day','Week','Month','Year','Custom'].map(name=>'<button type="button" data-range-mode="'+name.toLowerCase()+'" aria-pressed="false">'+name+'</button>').join('')+'</div><div class="sg-period-picker"><button type="button" class="sg-range-prev" aria-label="Kỳ trước">‹</button><button type="button" class="sg-range-button" aria-haspopup="dialog"></button><button type="button" class="sg-range-next" aria-label="Kỳ sau">›</button></div>';
      ['#sg-center','#sg-compare-mode'].forEach(selector=>{const input=root.querySelector(selector);toolbar.append(input.closest('label'));});
      controls.prepend(toolbar);
      ['#sg-period','#sg-period-year','#sg-period-month'].forEach(selector=>root.querySelector(selector)?.closest('label')?.classList.add('sg-range-legacy'));
      const compare=root.querySelector('#sg-compare-mode');compare.innerHTML='<option value="month">Tháng trước</option><option value="year">Năm trước</option>';compare.title='So sánh cùng khoảng ngày của tháng trước hoặc năm trước';
      root.querySelector('#sg-center option[value=all]').textContent='Tất cả center';
      const calendar=window.SungrowRangeCalendar(root,day(new Date()));
      const {dialog,from,to}=calendar;
      const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const display=value=>{const [y,m,d]=value.split('-');return d+'/'+months[Number(m)-1]+'/'+y;};
      function render(){
        const label=mode==='day'?display(start):mode==='week'?display(start)+' - '+display(end):mode==='month'?months[Number(start.slice(5,7))-1]+'/'+start.slice(0,4):mode==='year'?start.slice(0,4):display(start)+' 00:00 - '+display(end)+' 23:59';
        const picker=toolbar.querySelector('.sg-period-picker');picker.classList.toggle('is-custom',mode==='custom');
        toolbar.querySelector('.sg-range-button').textContent=label;
        toolbar.querySelector('.sg-range-button').title=display(start)+' 00:00 - '+display(end)+' 23:59';
        toolbar.querySelector('.sg-range-prev').disabled=!enabled||start<='2024-01-01';
        toolbar.querySelector('.sg-range-next').disabled=!enabled||end>=day(new Date());
        toolbar.querySelectorAll('[data-range-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rangeMode===mode)));
      }
      function setPeriod(choice,anchor){
        mode=choice;const today=day(new Date());end=anchor;start=anchor;
        if(mode==='week'){const d=date(anchor);d.setUTCDate(d.getUTCDate()-6);start=iso(d);}
        if(mode==='month'){start=anchor.slice(0,8)+'01';const d=date(start);d.setUTCMonth(d.getUTCMonth()+1,0);end=iso(d);}
        if(mode==='year'){start=anchor.slice(0,4)+'-01-01';end=anchor.slice(0,4)+'-12-31';}
        if(start<'2024-01-01')start='2024-01-01';if(end>today)end=today;
        render();onChange();
      }
      function navigate(direction){
        let anchor=end;
        if(mode==='month')anchor=shift(start,direction);
        else if(mode==='year')anchor=shift(start,direction*12);
        else{const d=date(end);d.setUTCDate(d.getUTCDate()+direction*(mode==='week'?7:1));anchor=iso(d);}
        if(anchor>day(new Date()))anchor=day(new Date());
        setPeriod(mode,anchor);
      }
      toolbar.querySelector('.sg-range-prev').addEventListener('click',()=>navigate(-1));
      toolbar.querySelector('.sg-range-next').addEventListener('click',()=>navigate(1));
      function open(){calendar.open(start,end,toolbar.querySelector('.sg-range-button'));}
      toolbar.querySelector('.sg-range-button').addEventListener('click',open);
      toolbar.querySelectorAll('[data-range-mode]').forEach(button=>button.addEventListener('click',()=>{const choice=button.dataset.rangeMode;if(choice==='custom'){open();return;}setPeriod(choice,day(new Date()));}));
      dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.close());
      dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();if(from.value>to.value){dialog.querySelector('[role=alert]').textContent='Ngày bắt đầu phải ≤ ngày kết thúc.';return;}start=from.value;end=to.value;mode='custom';render();dialog.close();onChange();});
      compare.addEventListener('change',onChange);render();
    }
  };
})();
