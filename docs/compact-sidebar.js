/* Presentation only. Retain the existing route/capability handlers and nodes. */
(() => {
 const root=document.getElementById('sg-preview');if(!root)return;
 const nav=root.querySelector('.sg-nav'),main=root.querySelector('.sg-main'),desktop=matchMedia('(min-width:761px)');
 const groups=[
  {button:root.querySelector('.sg-dashboard-parent'),panel:root.querySelector('.sg-dashboard-subnav'),short:'Quản lý',full:'Dashboard quản lý',path:'M4 20V4m0 16h17M9 16v-5m5 5V7m5 9V3'},
  {button:root.querySelector('.sg-platform-parent'),panel:root.querySelector('.sg-subnav'),short:'Nhập liệu',full:'Platform nhập liệu',path:'M5 3h14v18H5zM9 8h6m-6 4h6m-6 4h4'}
 ];if(groups.some(g=>!g.button||!g.panel))return;
 const campusLink = document.createElement('a');
 campusLink.className = 'sg-campus-link';
 campusLink.href = './service-campus/';
 campusLink.setAttribute('aria-label', 'Mở sa bàn Service Center 3D');
 campusLink.title = 'Mở sa bàn Service Center 3D';
 const icon = document.createElement('img');
 icon.className = 'sg-rail-brand';
 icon.src = './favicon-tight.svg?v=1';
 icon.alt = '';
 campusLink.append(icon);
 const brand = root.querySelector('.sg-side .sg-brand');
 if (brand) brand.append(campusLink);

 const campusDialog = document.createElement('dialog');
 campusDialog.className = 'sg-campus-dialog';
 campusDialog.setAttribute('aria-label', 'Sa bàn Service Center 3D');
 campusLink.setAttribute('aria-haspopup', 'dialog');
 root.append(campusDialog);
 const closeCampus = () => { if (campusDialog.open) campusDialog.close(); };
 campusDialog.addEventListener('close', () => {
   campusDialog.replaceChildren();
   if (!root.hidden) campusLink.focus();
 });
 campusLink.addEventListener('click', event => {
   if (event.button !== 0) return;
   event.preventDefault();
   if (root.hidden || campusDialog.open) return;
   const frame = document.createElement('iframe');
   frame.title = 'Service Center 3D';
   frame.src = campusLink.href;
   frame.addEventListener('load', () => {
     frame.contentWindow?.SungrowServiceScene?.connect({
       read: () => root.readCampusCases?.() || [],
       label: 'Tối đa 250 hồ sơ gần nhất trong phạm vi dashboard',
       onReturn: closeCampus,
       onOpenCase: id => {
         closeCampus();
         root.openCampusCase?.(id);
       }
     });
   });
   campusDialog.replaceChildren(frame);
   campusDialog.showModal();
 });
 new MutationObserver(() => { if (root.hidden) closeCampus(); })
   .observe(root, {attributes:true, attributeFilter:['hidden']});
 let leaveTimer;
 function close(focus=false){clearTimeout(leaveTimer);const owner=groups.find(g=>g.button.getAttribute('aria-expanded')==='true');groups.forEach(g=>{g.button.setAttribute('aria-expanded','false');g.panel.hidden=true;});if(focus)owner?.button.focus();}
 function place(g){if(g.panel.hidden)return;const rect=g.button.getBoundingClientRect();g.panel.style.top=Math.max(12,Math.min(rect.top,innerHeight-g.panel.offsetHeight-12))+'px';}
 function active(){const portal=main.classList.contains('sg-portal-mode'),report=main.classList.contains('sg-reports-mode');groups[0].button.dataset.active=String(!portal&&!report);groups[1].button.dataset.active=String(portal&&!report);}
 groups.forEach((g,i)=>{
  g.button.innerHTML='<svg class="sg-rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+g.path+'"/></svg><span class="sg-rail-name">'+g.short+'</span><span class="sg-rail-full">'+g.full+'</span>';
  g.button.title=g.full;g.button.setAttribute('aria-label',g.full);g.panel.id='sg-rail-subnav-'+i;g.button.setAttribute('aria-controls',g.panel.id);g.panel.setAttribute('aria-label',g.full);
  g.button.addEventListener('click',event=>{if(desktop.matches){place(g);if(!g.panel.hidden&&event.detail===0)g.panel.querySelector('button:not(.sg-role-hidden)')?.focus();}});
  g.button.addEventListener('keydown',event=>{if(desktop.matches&&event.key==='ArrowDown'){event.preventDefault();close();g.button.setAttribute('aria-expanded','true');g.panel.hidden=false;place(g);g.panel.querySelector('button:not(.sg-role-hidden)')?.focus();}});
  g.panel.addEventListener('click',event=>{if(desktop.matches&&event.target.closest('button')){close();active();}});
  const enter=()=>{clearTimeout(leaveTimer);if(!desktop.matches)return;groups.filter(x=>x!==g).forEach(x=>{x.panel.hidden=true;x.button.setAttribute('aria-expanded','false');});g.panel.hidden=false;g.button.setAttribute('aria-expanded','true');place(g);};
  const leave=()=>{clearTimeout(leaveTimer);if(desktop.matches)leaveTimer=setTimeout(()=>{if(!g.button.matches(':hover')&&!g.panel.matches(':hover')&&!g.panel.querySelector(':focus-visible'))close();},180);};
  g.button.addEventListener('pointerenter',enter);g.panel.addEventListener('pointerenter',()=>clearTimeout(leaveTimer));g.button.addEventListener('pointerleave',leave);g.panel.addEventListener('pointerleave',leave);
  g.panel.addEventListener('focusout',()=>setTimeout(()=>{if(desktop.matches&&!g.panel.contains(document.activeElement)&&document.activeElement!==g.button)leave();},0));
 });
 function layout(){close();root.classList.toggle('compact-sidebar',desktop.matches);groups.forEach(g=>{if(desktop.matches)root.append(g.panel);else g.button.after(g.panel);});active();}
 desktop.addEventListener('change',layout);layout();
 document.addEventListener('pointerdown',event=>{if(desktop.matches&&!groups.some(g=>g.button.contains(event.target)||g.panel.contains(event.target)))close();});
 document.addEventListener('keydown',event=>{if(desktop.matches&&event.key==='Escape')close(true);});
 window.addEventListener('resize',()=>{if(desktop.matches)groups.forEach(place);});
 const foot=root.querySelector('.sg-side-foot');
 function identity(){if(foot){foot.title=foot.textContent.trim();foot.setAttribute('aria-label',foot.title);foot.setAttribute('tabindex','0');}}
 identity();if(foot)new MutationObserver(identity).observe(foot,{childList:true,subtree:true});
 new MutationObserver(active).observe(main,{attributes:true,attributeFilter:['class']});
})();
