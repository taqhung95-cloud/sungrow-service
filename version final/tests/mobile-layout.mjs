// Offline UI fixtures only. No production tokens, requests or database writes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const docs = path.resolve(import.meta.dirname, '../../docs');
const out = path.resolve(import.meta.dirname, '../../../analysis/mobile-preview');
fs.mkdirSync(out, {recursive:true});
const stripScripts = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const server = http.createServer((req,res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!['index.html','entry.html','visual-polish.css','mobile-ui.css','mobile-ui.js'].includes(name)) {res.writeHead(404).end();return;}
  let body = fs.readFileSync(path.join(docs,name),'utf8');
  if (name.endsWith('.html')) body = stripScripts(body).replace('</body>','<script src="mobile-ui.js"></script></body>');
  res.setHeader('Content-Type', name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html'); res.end(body);
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless:true,channel:'msedge'});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',err=>errors.push(err.message));
  await page.route('**/*',route => route.request().url().startsWith(base)?route.continue():route.abort());
  const live=fs.readFileSync(path.join(docs,'live-data.js'),'utf8');
  let runtimeStyle;
  vm.runInNewContext(live.slice(live.indexOf('  const style ='),live.indexOf('  const authPage =')),
    {document:{createElement:()=>({textContent:''}),head:{appendChild:el=>runtimeStyle=el}}});
  const entry=fs.readFileSync(path.join(docs,'entry.html'),'utf8');
  const context=vm.createContext({esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    ticketStatus:t=>t.status,ticketDuration:()=>({old:false,title:'Thời gian xử lý',text:'2 ngày'}),shortCenter:v=>v,
    statusTone:()=>'',badgeClass:()=>''});
  vm.runInContext(live.slice(live.indexOf('  function ticketTable('),live.indexOf('  function ticketLoading(')),context);
  vm.runInContext(entry.slice(entry.indexOf('    function renderCaseTableRows('),entry.indexOf('    function renderCaseDetail(')),context);
  const fixtures=Array.from({length:3},(_,i)=>({id:'fixture-'+i,caseId:'fixture-'+i,model:'SG110CX',serialNumber:'TEST-'+i,
    error:'Dữ liệu giả lập kiểm thử giao diện, không phải hồ sơ thực.',status:'Đang kiểm tra',caseStatus:'Đang xử lý',
    warrantyStatus:'Trong bảo hành',center:'DAT Center',currentCenter:'DAT Center',receivedAt:'2026-10-05',workOrders:[],canDelete:false}));
  const tickets=context.ticketTable(fixtures),cases=fixtures.map(context.renderCaseTableRows).join('');
  await page.goto(base);
  await page.addStyleTag({content:runtimeStyle.textContent});
  await page.evaluate(tickets => {
    const root=document.getElementById('sg-preview');root.hidden=false;
    document.getElementById('sg-kpis').innerHTML=`<div class="sg-kpi sg-kpi-received"><div class="sg-kpi-head"><div class="sg-kpi-label">Tiếp nhận trong kỳ</div><div class="sg-received-annual"><svg viewBox="0 0 200 80"><polyline points="0,70 100,35 200,5" fill="none" stroke="#ff7900"/></svg><div class="sg-received-legend">${['Tích lũy','2024','2025','2026'].map(x=>`<span><i>●</i><em>${x}</em><b>1.234</b></span>`).join('')}</div></div></div><div class="sg-kpi-value">15 <small>thiết bị</small></div><div class="sg-kpi-note">Tháng trước: 22 ↓ 7</div></div>${['Hoàn tất kỹ thuật','Chờ giao','Đã giao trong kỳ','Đạt SLA 7 ngày'].map(x=>`<div class="sg-kpi"><div class="sg-kpi-head"><div class="sg-kpi-label">${x}</div></div><div class="sg-kpi-value">98</div><div class="sg-kpi-note">Theo kỳ đang chọn</div></div>`).join('')}`;
    document.getElementById('sg-month-center-table').innerHTML='<div class="sg-compare-list-head">Center Tiếp nhận Đã giao Tồn</div><div class="sg-compare-list-body">'+['Sungrow','DAT','BKE'].map(x=>`<div class="sg-compare-list-row"><span><strong>${x}</strong><small>223 tồn từ kỳ trước</small></span>${['10','0','233','217','10 ngày'].map(v=>`<span><strong>${v}</strong><small>Đầu kỳ: 223</small></span>`).join('')}<span><span class="sg-trend-badge">Cần hành động</span></span></div>`).join('')+'</div>';
    document.getElementById('sg-tickets-table').innerHTML=tickets;
    document.getElementById('sg-live-title')?.remove();
  },tickets);
  await page.evaluate(() => {
    const host=document.createElement('div');host.className='sg-live-box';
    host.innerHTML='<i class="sg-live-dot ok"></i><span class="sg-live-text"><strong id="sg-live-title">Đã đồng bộ</strong><span id="sg-live-detail">09:03 08-10</span></span><button class="sg-refresh-button">↻ Đồng bộ</button><span class="sg-login-slot">fixture@example.invalid</span>';
    document.querySelector('.sg-top').append(host);
    const controls=document.querySelector('.sg-filter-panel .sg-controls');
    controls.insertAdjacentHTML('afterbegin','<label class="sg-control-label">Năm<input id="sg-period-year" class="sg-control" value="2026"></label><label class="sg-control-label">Tháng<select id="sg-period-month" class="sg-control"><option>Tháng 10</option></select></label>');
  });
  for (const width of [360,390,430,768,1440]) {
    await page.setViewportSize({width,height:900});
    const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      columns:getComputedStyle(document.querySelector('.sg-kpis')).gridTemplateColumns,
      cards:getComputedStyle(document.querySelector('.sg-device-table')).display}));
    if(width<=760){assert.ok(state.scroll<=width+1,`Dashboard overflow at ${width}: ${state.scroll}`);assert.equal(state.cards,'block');}
    else assert.notEqual(state.cards,'block','Desktop table must remain a table');
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{
    document.getElementById('sg-overview-table').innerHTML='<div class="sg-card-list-body sg-attention-list-body">'+Array.from({length:250},(_,i)=>`<div class="sg-attention-list-row"><span><b>Fixture ${i}</b><small>S/N TEST-${i}</small></span><span>DAT</span><span>Đang kiểm tra</span><span>10 ngày</span></div>`).join('')+'</div>';
  });
  const attention=page.locator('.sg-attention-list-body');
  await page.waitForFunction(()=>document.querySelectorAll('.sg-attention-list-body .mobile-preview-hidden').length===245);
  assert.equal(await attention.locator('.sg-attention-list-row:visible').count(),5,'Mobile overview previews only five of 250 rows');
  await attention.locator('..').locator('.mobile-preview-more').click();
  assert.equal(await attention.locator('.sg-attention-list-row:visible').count(),10);
  await attention.locator('..').locator('.mobile-preview-less').click();
  assert.equal(await attention.locator('.sg-attention-list-row:visible').count(),5);
  const center=page.locator('.sg-compare-list-row').first();
  assert.equal(await center.locator('> span:nth-child(2)').isVisible(),false);
  await center.locator('.mobile-center-expand').click();
  assert.equal(await center.locator('> span:nth-child(2)').isVisible(),true);
  await center.locator('.mobile-center-expand').click();
  await page.setViewportSize({width:1440,height:900});
  assert.equal(await attention.locator('.sg-attention-list-row:visible').count(),250,'Desktop keeps all original rows');
  assert.equal(await center.locator('> span:nth-child(2)').isVisible(),true,'Desktop metrics are not collapsed');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<6000),'250 attention rows must not create an enormous Overview');
  const sections=['sg-overview','sg-centers','sg-tickets','sg-parts','sg-quality'];
  for(const id of sections){
    await page.evaluate(({sections,id})=>sections.forEach(s=>document.getElementById(s)?.classList.toggle('sg-hidden',s!==id)),{sections,id});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Mobile section ${id} must not overflow`);
  }
  await page.evaluate(({sections})=>sections.forEach(s=>document.getElementById(s)?.classList.toggle('sg-hidden',s!=='sg-overview')),{sections});
  await page.locator('.mobile-menu-toggle').click();
  await assert.doesNotReject(()=>page.locator('.mobile-menu-close').waitFor({state:'visible'}));
  assert.equal(await page.locator('.mobile-menu-toggle').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.mobile-menu-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('.mobile-filter-toggle').click();assert.equal(await page.locator('.mobile-filter-toggle').getAttribute('aria-expanded'),'true');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Open mobile filters must fit phone');
  await page.locator('.mobile-filter-toggle').click();
  await page.screenshot({path:path.join(out,'dashboard-390.png'),fullPage:true});
  await page.evaluate(()=>{document.querySelector('#sg-overview').classList.add('sg-hidden');document.querySelector('#sg-tickets').classList.remove('sg-hidden')});
  assert.equal(await page.locator('.sg-device-table tbody tr').count(),3);
  assert.equal(await page.locator('.sg-device-table tbody td[data-label="Thiết bị / S/N"]').count(),3);
  await page.screenshot({path:path.join(out,'devices-390.png'),fullPage:true});
  await page.goto(base+'/entry.html');
  await page.evaluate(cases=>{document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden');document.getElementById('caseResults').innerHTML=cases;document.getElementById('caseDateSort').addEventListener('click',function(){this.textContent=this.textContent.includes('↓')?'Ngày nhận ↑':'Ngày nhận ↓'})},cases);
  for(const width of [360,390,430,768,1440]){
    await page.setViewportSize({width,height:900});
    if(width<=760){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Entry overflow at ${width}`);assert.equal(await page.locator('.case-table tr.data-row').count(),3);}
    else assert.equal(await page.locator('.case-table').evaluate(el=>getComputedStyle(el).display),'table');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.mobile-case-sort').click();assert.equal(await page.locator('.mobile-case-sort').textContent(),'Ngày nhận ↑');
  await page.screenshot({path:path.join(out,'cases-390.png'),fullPage:true});
  await page.evaluate(()=>{document.querySelector('#cases').classList.add('hidden');document.querySelector('#receive').classList.remove('hidden');document.documentElement.classList.add('embedded')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Receive form must fit phone');
  assert.equal(await page.locator('#receiveForm .grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
  assert.equal(await page.locator('#receiveForm input').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.screenshot({path:path.join(out,'receive-390.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Mobile layout passed: 360/390/430, tablet768 and desktop1440; menu/Escape, filters, reused paged cards, sort proxy, one-column forms and no page errors. Offline screenshots: '+out);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
