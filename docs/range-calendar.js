(() => {
  window.SungrowRangeCalendar = function(root,today) {
    const parse=s=>new Date(s+'T00:00:00Z'),iso=d=>d.toISOString().slice(0,10),display=s=>s.split('-').reverse().join('/');
    const dialog=document.createElement('dialog');dialog.className='sg-range-dialog sg-calendar-dialog';dialog.setAttribute('aria-label','Chọn khoảng ngày');
    dialog.innerHTML='<form method="dialog"><div class="sg-calendar-layout"><aside class="sg-calendar-quick"><button type="button" data-last="2">2 ngày gần nhất</button><button type="button" data-last="7">7 ngày gần nhất</button><button type="button" data-last="30">30 ngày gần nhất</button></aside><div class="sg-calendar-main"><div class="sg-range-fields"><label>Từ ngày<input type="date" name="start" hidden required><span data-endpoint="start"></span><span>00:00</span></label><span aria-hidden="true">→</span><label>Đến ngày<input type="date" name="end" hidden required><span data-endpoint="end"></span><span>23:59</span></label></div><div class="sg-calendar-months"></div></div></div><p role="alert"></p><div class="sg-range-actions"><button type="button" data-cancel>Hủy</button><button type="submit">Áp dụng</button></div></form>';
    root.append(dialog);const from=dialog.querySelector('[name=start]'),to=dialog.querySelector('[name=end]');let month=parse(today),choosing='start',anchor;
    const pad=n=>String(n).padStart(2,'0');
    function draw(){
      dialog.querySelector('[data-endpoint=start]').textContent=display(from.value);dialog.querySelector('[data-endpoint=end]').textContent=display(to.value);
      dialog.querySelectorAll('.sg-range-fields label').forEach((label,i)=>label.classList.toggle('is-active',choosing===(i?'end':'start')));
      dialog.querySelector('.sg-calendar-months').innerHTML=[0,1].map(offset=>{
        const first=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+offset,1)),grid=new Date(first);grid.setUTCDate(1-first.getUTCDay());
        const navigation=offset===0?'<button type="button" data-nav="-12" aria-label="Năm trước">«</button><button type="button" data-nav="-1" aria-label="Tháng trước">‹</button>':'<button type="button" data-nav="1" aria-label="Tháng sau">›</button><button type="button" data-nav="12" aria-label="Năm sau">»</button>';
        const days=Array.from({length:42},(_,i)=>{const d=new Date(grid);d.setUTCDate(d.getUTCDate()+i);const key=iso(d),outside=d.getUTCMonth()!==first.getUTCMonth(),disabled=outside||key>today||key<'2024-01-01',selected=key===from.value||key===to.value,between=key>=from.value&&key<=to.value;return '<button type="button" data-day="'+key+'" aria-label="'+display(key)+'" aria-pressed="'+selected+'" class="'+(between?'in-range ':'')+(selected?'selected ':'')+(outside?'outside':'')+'" '+(disabled?'disabled':'')+'>'+d.getUTCDate()+'</button>';}).join('');
        return '<section class="sg-calendar-month"><header>'+(!offset?navigation:'')+'<strong>Tháng '+pad(first.getUTCMonth()+1)+' / '+first.getUTCFullYear()+'</strong>'+(offset?navigation:'')+'</header><div class="sg-calendar-weekdays">'+['CN','T2','T3','T4','T5','T6','T7'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="sg-calendar-days">'+days+'</div></section>';
      }).join('');
    }
    function place(){if(!dialog.open||!anchor)return;const r=anchor.getBoundingClientRect(),width=Math.min(650,innerWidth-24);dialog.style.width=width+'px';dialog.style.left=Math.max(12,Math.min(r.left+r.width/2-width/2,innerWidth-width-12))+'px';dialog.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-dialog.offsetHeight-12))+'px';}
    dialog.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]'),quick=e.target.closest('[data-last]'),button=e.target.closest('[data-day]');
      if(nav){month.setUTCMonth(month.getUTCMonth()+Number(nav.dataset.nav));draw();}
      if(quick){const d=parse(today);d.setUTCDate(d.getUTCDate()-Number(quick.dataset.last)+1);from.value=iso(d)<'2024-01-01'?'2024-01-01':iso(d);to.value=today;month=parse(today);month.setUTCDate(1);choosing='start';draw();}
      if(button&&!button.disabled){const value=button.dataset.day;if(choosing==='start'){from.value=to.value=value;choosing='end';}else{to.value=value;if(to.value<from.value){const old=from.value;from.value=to.value;to.value=old;}choosing='start';}draw();}
      if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}
    });
    from.closest('label').addEventListener('click',()=>{choosing='start';draw();});to.closest('label').addEventListener('click',()=>{choosing='end';draw();});
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return {dialog,from,to,open(a,b,element){from.value=a;to.value=b;month=parse(b);month.setUTCDate(1);choosing='start';anchor=element;dialog.querySelector('[role=alert]').textContent='';draw();dialog.showModal();place();}};
  };
})();
