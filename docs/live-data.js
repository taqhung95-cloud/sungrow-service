(() => {
  const cfg = window.SUNGROW_CONFIG || {};
  const root = document.getElementById('sg-preview');
  if (!root) return;
  const q = s => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const shortCenter = value => String(value || 'Chưa xác định').replace(/\s+Service\s+Center$/i,'').replace(/\s+Center$/i,'').trim();
  const statusTone = value => { const s=String(value||'').toLowerCase(); return /đã\s*(sửa|giao|trả)|chờ\s*giao/.test(s)?'done':/chờ\s*(linh kiện|part)|không\s*sửa/.test(s)?'wait':/(kiểm tra|test|đổi)/.test(s)?'test':'neutral'; };
  let token = '';
  let live = null;
  let previousLive = null;
  let loadSequence = 0;
  let activeController = null;
  let lastSuccessfulSync = 0;
  const failureRateCache = new Map();
  let ticketSearchTimer = null;
  let ticketSearchController = null;
  let ticketSearchSequence = 0;
  let ticketSearchState = {term:'',rows:null,total:0,truncated:false,loading:false,error:'',fromYear:null,toYear:null};
  const AUTO_SYNC_MS = 120000;

  const style = document.createElement('style');
  style.textContent = '#sg-preview .sg-live-box{display:flex;align-items:center;gap:8px}.sg-live-dot{width:8px;height:8px;border-radius:50%;background:#c56b0b}.sg-live-dot.ok{background:#2f7a52}.sg-live-dot.error{background:#b63d35}.sg-live-text{font-size:10px;color:#606060}.sg-live-text strong{display:block;color:#333}.sg-login-slot{display:flex;align-items:center;min-height:32px}.sg-account-name{display:block;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;font-size:11px;font-weight:600}.sg-account-role{margin-top:10px;color:#606060}.sg-side-foot>div:first-child{display:flex;align-items:center;min-width:0}.sg-side-foot>div:first-child span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sg-refresh-button{border:1px solid #d9dee2;background:#fff;color:#4c5c66;border-radius:5px;padding:5px 8px;font-size:10px;line-height:1;white-space:nowrap}.sg-refresh-button:hover{border-color:#ff7900;color:#a74b00}.sg-refresh-button:disabled{opacity:.5;cursor:default}';
  style.textContent += '#sg-preview .sg-brand{padding:0 4px 26px!important;border-bottom:1px solid #f0f1f2}#sg-preview .sg-side{gap:0}#sg-preview .sg-nav{margin-top:32px}#sg-preview .sg-subnav{display:grid;gap:4px;padding:5px 0 6px 13px}#sg-preview .sg-subnav button{min-height:40px;padding:9px 10px;font-size:12px}#sg-preview .sg-platform-parent[aria-expanded="true"]{color:#a44800;font-weight:600}#sg-preview .sg-portal-user{margin-top:auto;border-top:1px solid #e5e7eb;padding:15px 4px 11px;color:#4d5761;font-size:11px;line-height:1.5;min-width:0}#sg-preview .sg-portal-user>div:first-child{display:flex;align-items:center;min-width:0}#sg-preview .sg-portal-user>div:first-child span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:#20252b}#sg-preview .sg-side-foot.sg-portal-meta{margin-top:0;padding:10px 4px 0;border-top:1px solid #f0f1f2;color:#667085;font-size:11px;line-height:1.5}#sg-preview .sg-portal-frame{display:block;width:100%;height:100%;min-height:100vh;border:0;background:#f5f6f7}';
  document.head.appendChild(style);
  const host = document.createElement('div');
  host.className = 'sg-live-box';
  host.innerHTML = '<i class="sg-live-dot"></i><span class="sg-live-text"><strong id="sg-live-title">Chưa kết nối</strong><span id="sg-live-detail">Đang kiểm tra cấu hình</span></span><button class="sg-refresh-button" id="sg-refresh" type="button" disabled>↻ Đồng bộ</button><span class="sg-login-slot" id="sg-login-slot"></span>';
  q('.sg-top').appendChild(host);

  installPortalSidebar();

  function installPortalSidebar() {
    const nav = q('.sg-nav');
    nav.replaceChildren();
    const dashboardButton = document.createElement('button');
    dashboardButton.type = 'button';
    dashboardButton.className = 'sg-dashboard-nav';
    dashboardButton.textContent = 'Dashboard quản lý';
    dashboardButton.setAttribute('aria-current','page');
    dashboardButton.addEventListener('click',showDashboardView);
    nav.appendChild(dashboardButton);
    const platformButton = document.createElement('button');
    platformButton.type = 'button';
    platformButton.className = 'sg-platform-parent';
    platformButton.textContent = 'Platform nhập liệu';
    platformButton.setAttribute('aria-expanded','true');
    nav.appendChild(platformButton);
    const subnav = document.createElement('div');
    subnav.className = 'sg-subnav';
    [['cases','Danh sách hồ sơ'],['receive','Tiếp nhận mới'],['update','Cập nhật hồ sơ'],['transfer','Luân chuyển center']].forEach(([view,label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.portalView = view;
      button.textContent = label;
      button.addEventListener('click',() => openEntryView(view));
      subnav.appendChild(button);
    });
    nav.appendChild(subnav);
    platformButton.addEventListener('click',() => {
      const expanded = platformButton.getAttribute('aria-expanded') === 'true';
      platformButton.setAttribute('aria-expanded',String(!expanded));
      subnav.hidden = expanded;
    });
    const footer = q('.sg-side-foot');
    const userBox = document.createElement('div');
    userBox.className = 'sg-portal-user';
    footer.before(userBox);
    footer.classList.add('sg-portal-meta');
    footer.replaceChildren();
    const version = document.createElement('div');
    version.textContent = 'Ứng dụng nhập liệu · v1.1.3-final';
    const source = document.createElement('div');
    source.textContent = 'Dữ liệu được lưu trên Google Sheets';
    footer.append(version, source);
  }

  function openEntryView(view) {
    if (token) sessionStorage.setItem('sungrow_id_token', token);
    const main = q('.sg-main');
    q('.sg-top').style.display = 'none';
    q('.sg-content').style.display = 'none';
    let frame = q('.sg-portal-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'sg-portal-frame';
      frame.title = 'Sungrow Service Center - Platform nhập liệu';
      main.appendChild(frame);
    }
    frame.hidden = false;
    frame.dataset.portalView = view;
    if (!frame.getAttribute('src')) frame.src = (cfg.dataEntryPage || 'entry.html') + '#' + view;
    else if (frame.dataset.ready === 'true') frame.contentWindow.postMessage({type:'sungrow-portal-view',view:view},window.location.origin);
    q('.sg-dashboard-nav').removeAttribute('aria-current');
    q('.sg-platform-parent').setAttribute('aria-expanded','true');
    q('.sg-subnav').hidden = false;
    root.querySelectorAll('[data-portal-view]').forEach(button => {
      if (button.dataset.portalView === view) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }

  function showDashboardView() {
    const frame = q('.sg-portal-frame');
    if (frame) frame.hidden = true;
    q('.sg-top').style.display = '';
    q('.sg-content').style.display = '';
    q('.sg-dashboard-nav').setAttribute('aria-current','page');
    root.querySelectorAll('[data-portal-view]').forEach(button => button.removeAttribute('aria-current'));
  }

  function status(title, detail, type = '') {
    q('#sg-live-title').textContent = title;
    q('#sg-live-detail').textContent = detail;
    q('.sg-live-dot').className = 'sg-live-dot ' + type;
  }

  function selectedPeriod() {
    return q('#sg-period').selectedOptions[0]?.dataset.livePeriod || cfg.defaultPeriod || new Date().toISOString().slice(0, 7);
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchDashboard(payload, signal, attempts = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const body = new URLSearchParams({payload: JSON.stringify(payload)});
        const response = await fetch(cfg.appsScriptUrl, {method:'POST', body, redirect:'follow', signal, cache:'no-store'});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (!result.ok) throw new Error([result.error?.code, result.error?.message].filter(Boolean).join(': ') || 'API error');
        return result.data;
      } catch (error) {
        if (signal.aborted) throw error;
        lastError = error;
        if (attempt < attempts - 1) await delay([350,900][attempt] || 900);
      }
    }
    throw lastError || new Error('Không nhận được phản hồi từ Apps Script');
  }

  async function loadLive(options = {}) {
    if (!token) return;
    const forceRefresh = options.force === true;
    if (forceRefresh) failureRateCache.clear();
    const sequence = ++loadSequence;
    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;
    const refreshButton = q('#sg-refresh');
    if (refreshButton) refreshButton.disabled = true;
    const periodKey = selectedPeriod();
    const center = q('#sg-center').value;
    status('Đang đồng bộ', 'Đọc Google Sheet…');
    try {
      const currentData = await fetchDashboard({action:'dashboard.read', idToken:token, period:periodKey, center:center, refresh:forceRefresh}, controller.signal);
      if (sequence !== loadSequence) return;
      live = currentData;
      root.dataset.liveData = 'true';
      renderIdentity(live.actor);
      const refreshComparison = options.comparison !== false || !previousLive;
      if (refreshComparison) previousLive = null;
      const previousPeriod = /^\d{4}$/.test(periodKey)
        ? String(Number(periodKey) - 1)
        : (function(){ const selected=periodKey.split('-').map(Number), previousDate=new Date(selected[0],selected[1]-2,1); return previousDate.getFullYear()+'-'+String(previousDate.getMonth()+1).padStart(2,'0'); })();
      try {
        if (refreshComparison) previousLive = await fetchDashboard({action:'dashboard.read', idToken:token, period:previousPeriod, center:center, includeAnnual:false, includeTickets:false}, controller.signal, 3);
      } catch (comparisonError) {
        if (controller.signal.aborted) return;
        previousLive = null;
      }
      if (sequence !== loadSequence) return;
      renderAll();
      lastSuccessfulSync = Date.now();
      const updated = new Date(live.source.sourceUpdatedAt).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      status('Đã đồng bộ', `${live.source.sheetName} · ${updated}${previousLive ? '' : ' · chưa tải kỳ so sánh'}`, previousLive ? 'ok' : '');
    } catch (error) {
      if (controller.signal.aborted || sequence !== loadSequence) return;
      if (live) {
        status('Kết nối gián đoạn', 'Đang giữ dữ liệu lần đồng bộ gần nhất', '');
      } else {
        status('Lỗi đồng bộ', 'Không kết nối được Apps Script sau 3 lần thử', 'error');
      }
    } finally {
      if (activeController === controller) activeController = null;
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  function renderAll() {
    renderOverview();
    renderMonthlyComparison();
    renderTickets();
    renderModels();
    renderParts();
    renderQuality();
    renderCenters();
    q('.sg-demo').textContent = 'Dữ liệu Google Sheets';
    q('.sg-footer span:last-child').textContent = `API v${live.schemaVersion} · ${live.period.label}`;
  }

  function renderOverview() {
    const s = live.summary;
    const ps = previousLive?.summary;
    const comparisonNoun = live.period?.isYear ? 'Năm trước' : 'Tháng trước';
    const base = [
      {key:'received',label:'Thiết bị tiếp nhận',value:s.received,previous:ps?.received,lower:false,unit:'thiết bị'},
      {key:'processed',label:'Thiết bị đã xử lý',value:s.waitingDelivery+s.returned,previous:ps ? ps.waitingDelivery+ps.returned : null,lower:false,unit:'thiết bị'},
      {key:'waiting',label:'Thiết bị chờ giao',value:s.waitingDelivery,previous:ps?.waitingDelivery,lower:true,unit:'thiết bị'},
      {key:'returned',label:'Thiết bị đã giao',value:s.returned,previous:ps?.returned,lower:false,unit:'thiết bị'}
    ];
    const slaRate = s.slaRate === null || s.slaRate === undefined ? null : Math.round(s.slaRate*100);
    base.push({key:'sla',label:'Đạt SLA 7 ngày',value:slaRate,previous:null,lower:false,unit:'%',sla:true});
    const trendViz = function(previous,current,tone) {
      if (previous === null || previous === undefined) return '<span class="sg-mini-empty">Kỳ trước → Kỳ này</span>';
      const max=Math.max(1,previous,current), min=Math.min(0,previous,current), y=function(v){return 25-(v-min)/(max-min||1)*18;};
      const y1=y(previous).toFixed(1), y2=y(current).toFixed(1);
      return '<svg class="sg-mini-trend '+tone+'" viewBox="0 0 72 30" aria-label="Kỳ trước '+previous+', kỳ này '+current+'"><path d="M4 26 L4 '+y1+' L68 '+y2+' L68 26 Z"></path><polyline points="4,'+y1+' 68,'+y2+'"></polyline><circle cx="4" cy="'+y1+'" r="2.4"></circle><circle cx="68" cy="'+y2+'" r="2.8"></circle></svg>';
    };
    const annualTotals=(Array.isArray(live.yearlyTotals)&&live.yearlyTotals.length?live.yearlyTotals:[live.annual||{}]).filter(x=>x.year).slice().sort((a,b)=>a.year-b.year);
    const cumulative=live.cumulative?.received??annualTotals.reduce((sum,x)=>sum+(x.received||0),0);
    const receivedAnnualViz=function(){
      const width=184,height=56,left=5,right=5,top=4,bottom=8,plotW=width-left-right,plotH=height-top-bottom;
      const palette=['#ff7900','#365f78','#7d8b95','#d6a066','#6b7f3e','#8d68a6','#3b8c88','#b34b43'];
      const yearSeries=annualTotals.map(function(item,index){
        const through=Math.max(1,Math.min(12,Number(item.throughMonth||12)));
        let values=[];
        if(Array.isArray(item.monthlyCumulative)&&item.monthlyCumulative.length){
          values=item.monthlyCumulative.slice(0,through).map(Number);
        }else if(Array.isArray(item.monthlyReceived)&&item.monthlyReceived.length){
          let sum=0; values=item.monthlyReceived.slice(0,through).map(function(value){sum+=Number(value||0);return sum;});
        }else{
          values=Array(Math.max(0,through-1)).fill(null).concat([Number(item.received||0)]);
        }
        return {name:String(item.year),color:palette[index%palette.length],values:[0].concat(values),total:Number(item.received||0),through:through};
      });
      const cumulativeValues=[0];
      for(let month=1;month<=12;month++) cumulativeValues.push(yearSeries.reduce(function(sum,series){
        const index=Math.min(month,series.values.length-1),value=series.values[index];
        return sum+(value===null||value===undefined?0:Number(value));
      },0));
      const allSeries=[{name:'Tích lũy',color:'#172b3a',values:cumulativeValues,total:Number(cumulative||0),through:12}].concat(yearSeries);
      const max=Math.max(1,...allSeries.flatMap(function(series){return series.values.filter(function(value){return value!==null&&value!==undefined;});}));
      const x=function(index){return left+index/12*plotW;},y=function(value){return top+plotH-Number(value||0)/max*plotH;};
      const lines=allSeries.map(function(series){
        const points=series.values.map(function(value,index){return value===null||value===undefined?null:[x(index),y(value),index,value];}).filter(Boolean);
        if(points.length<2)return '';
        const pointText=points.map(function(point){return point[0].toFixed(1)+','+point[1].toFixed(1);}).join(' ');
        return '<g class="sg-annual-series" style="--series:'+series.color+'"><polyline points="'+pointText+'"></polyline>'+'</g>';
      }).join('');
      const legend=allSeries.map(function(series){return '<span title="'+esc(series.name)+': '+Number(series.total).toLocaleString('vi-VN')+' thiết bị"><i style="background:'+series.color+'"></i><em>'+esc(series.name)+'</em><b>'+Number(series.total).toLocaleString('vi-VN')+'</b></span>';}).join('');
      return '<div class="sg-received-annual"><svg viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tiếp nhận lũy kế theo tháng và từng năm"><line class="sg-annual-baseline" x1="'+left+'" y1="'+(top+plotH)+'" x2="'+(width-right)+'" y2="'+(top+plotH)+'"></line>'+lines+'</svg><div class="sg-received-legend">'+legend+'</div></div>';
    };
    q('#sg-kpis').innerHTML = base.map(function(item,index) {
      if (item.sla) {
        const value = item.value === null ? '—' : item.value;
        const note = item.value === null ? 'Chưa có thiết bị trả đủ ngày nhận/trả' : s.slaMet + '/' + s.slaEligible + ' đã trả đúng hạn · ' + s.slaBreachedOpen + ' đang mở > 7 ngày';
        const tone = item.value === null ? 'neutral' : item.value === 100 && !s.slaBreachedOpen ? 'good' : 'bad';
        const ringValue = item.value === null ? 0 : Math.max(0,Math.min(100,item.value));
        return '<div class="sg-kpi sg-kpi-sla sg-kpi-sla-' + tone + '"><div class="sg-kpi-head"><div class="sg-kpi-label">' + item.label + '</div><span class="sg-mini-ring '+tone+'" style="--p:'+ringValue+'"><i>7d</i></span></div><div class="sg-kpi-value">' + value + ' <small>' + item.unit + '</small></div><div class="sg-kpi-note">' + note + '</div></div>';
      }
      const p = item.previous === undefined ? null : item.previous;
      const delta = p === null ? null : item.value-p;
      const better = delta === 0 ? null : (item.lower ? delta<0 : delta>0);
      const tone = better === null ? 'neutral' : better ? 'good' : 'bad';
      const change = delta === null ? 'Chưa có tháng trước' : delta === 0 ? 'Không đổi' : (delta>0?'↑ ':'↓ ')+Math.abs(delta);
      const note = p === null ? change.replace('tháng trước','kỳ trước') : comparisonNoun+': '+p+' <span class="sg-kpi-change '+tone+'">'+change+'</span>';
      return '<div class="sg-kpi sg-kpi-' + item.key + '"><div class="sg-kpi-head"><div class="sg-kpi-label">'+item.label+'</div>'+(index===0?receivedAnnualViz():trendViz(p,item.value,tone))+'</div><div class="sg-kpi-value">'+item.value+' <small>'+item.unit+'</small></div><div class="sg-kpi-note">'+note+'</div></div>';
    }).join('');
    q('#sg-period-date').textContent = `${formatDate(live.period.start)}–${formatDate(live.period.asOf)}`;
    const max = Math.max(1, ...live.errors.map(x => x.count));
    const errorTotal = live.errors.reduce((sum,x) => sum + Number(x.count||0),0);
    const errorRows = live.errors.map(x => { const share=errorTotal ? 100*x.count/errorTotal : 0; return `<div class="sg-error-line"><span class="sg-error-name" title="${esc(x.name)}">${esc(x.name)}</span><div class="sg-track"><i style="width:${100*x.count/max}%"></i></div><b class="sg-error-count">${x.count}</b><small class="sg-error-share">${share.toLocaleString('vi-VN',{maximumFractionDigits:1})}%</small></div>`; }).join('') || '<div class="sg-caption">Chưa có lỗi được ghi nhận trong kỳ.</div>';
    q('#sg-errors').innerHTML = '<div class="sg-mini-table-head sg-error-list-head"><span>Lỗi ghi nhận</span><span>Mức độ</span><span>SL</span><span>Tỷ trọng</span></div><div class="sg-card-list-body sg-error-list-body">' + errorRows + '</div>';
    q('#sg-overview-table').innerHTML = attentionTable(live.tickets.filter(needsAttention).sort((a,b) => b.ageDays-a.ageDays));
  }


  function needsAttention(t) {
    if (t.returnDate) return false;
    const status = ticketStatus(t);
    return !/(?:đã\s*giao|đã\s*trả|đã\s*sửa\s*chữa|không\s*sửa\s*chữa|hoàn\s*(?:tất|thành))/i.test(status);
  }
  function attentionTable(rows) {
    const body = rows.map(function(t) {
      const status = ticketStatus(t);
      const duration = ticketDuration(t);
      const serial = t.serialNumber ? 'S/N ' + t.serialNumber : 'Chưa có S/N';
      return '<div class="sg-attention-list-row"><span><b class="sg-sn">' + esc(t.model || t.deviceType || 'Chưa xác định') + '</b><small>' + esc(serial) + '</small></span><span class="sg-attention-center" title="' + esc(t.center) + '">' + esc(shortCenter(t.center)) + '</span><span><span class="sg-status ' + statusTone(status) + '">' + esc(status) + '</span></span><span class="sg-age ' + (duration.old?'old':'') + '" title="' + esc(duration.title) + '">' + esc(duration.text) + '</span></div>';
    }).join('') || '<div class="sg-caption sg-attention-empty">Không có thiết bị cần theo dõi.</div>';
    return '<div class="sg-mini-table-head sg-attention-list-head"><span>Thiết bị</span><span>Center</span><span>Trạng thái</span><span title="Thời gian xử lý">Xử lý</span></div><div class="sg-card-list-body sg-attention-list-body">' + body + '</div>';
  }
  function ticketStatus(t) {
    return t.deliveryStatus || t.warrantyStatus || 'Chưa cập nhật';
  }

  function ticketDuration(t) {
    const deliveredWithoutReturn = (t.processingState === 'missing_return_date') || (/đã\s*giao/i.test(t.deliveryStatus || '') && !t.returnDate);
    if (deliveredWithoutReturn) return {text:'Thiếu ngày trả',old:false,title:'Trạng thái đã giao nhưng nguồn chưa có Return date'};
    if (!Number.isFinite(Number(t.ageDays)) || Number(t.ageDays) < 0) return {text:'—',old:false,title:'Chưa đủ dữ liệu để tính'};
    return {
      text:Number(t.ageDays) + ' ngày',
      old:Number(t.ageDays) > 7,
      title:t.returnDate ? 'Từ ngày tiếp nhận đến ngày trả' : 'Từ ngày tiếp nhận đến hiện tại'
    };
  }

  function ticketTable(rows, emptyMessage) {
    const columns = '<colgroup><col style="width:22%"><col style="width:32%"><col style="width:16%"><col style="width:16%"><col style="width:10%"><col style="width:52px"></colgroup>';
    const body = rows.map(function(t) {
      const serial = t.serialNumber ? 'S/N ' + t.serialNumber : 'Chưa có S/N';
      const status = ticketStatus(t);
      const duration = ticketDuration(t);
      const identity = [t.model || t.deviceType || 'Chưa xác định',t.serialNumber || ''].filter(Boolean).join(' ');
      return `<tr><td><span class="sg-sn">${esc(t.model || t.deviceType || 'Chưa xác định')}</span><span class="sg-small">${esc(serial)}</span></td><td title="${esc(t.error)}">${esc(t.error)}</td><td title="${esc(t.center)}">${esc(shortCenter(t.center))}</td><td><span class="sg-status ${statusTone(status)}">${esc(status)}</span></td><td class="sg-age ${duration.old?'old':''}" title="${esc(duration.title)}">${esc(duration.text)}</td><td class="sg-action-cell"><button class="sg-detail-btn" type="button" data-live-ticket="${esc(t.id)}" aria-label="Xem thông tin ${esc(identity)}">↗</button></td></tr>`;
    }).join('');
    return '<table class="sg-device-table">' + columns + '<thead><tr><th>Thiết bị / S/N</th><th>Lỗi ghi nhận</th><th>Trung tâm</th><th>Trạng thái</th><th>Thời gian xử lý</th><th aria-label="Xem chi tiết"></th></tr></thead><tbody>' + body + (rows.length?'':'<tr><td colspan="6">'+esc(emptyMessage || 'Không có dữ liệu phù hợp.')+'</td></tr>') + '</tbody></table>';
  }
  function renderMonthlyComparison() {
    const grid = q('#sg-month-compare-grid');
    const table = q('#sg-month-center-table');
    if (!grid || !table) return;
    const annualComparison = !!live.period?.isYear;
    const compareTitle = q('#sg-compare-title');
    if (compareTitle) compareTitle.textContent = annualComparison ? 'Biến động vận hành so với năm trước' : 'Biến động vận hành so với tháng trước';
    const pct = function(value) { return value === null || value === undefined ? '—' : Math.round(value * 100) + '%'; };
    const deltaHtml = function(current, previous, lowerIsBetter, suffix) {
      if (previous === null || previous === undefined || current === null || current === undefined) return '<span class="sg-cell-delta neutral">Chưa có kỳ trước</span>';
      const delta = current - previous;
      const tone = delta === 0 ? 'neutral' : (lowerIsBetter ? delta < 0 : delta > 0) ? 'good' : 'bad';
      const text = delta === 0 ? 'Không đổi' : (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta) + (suffix || '');
      return '<span class="sg-cell-delta ' + tone + '">' + text + '</span>';
    };
    const previousByCenter = previousLive ? Object.fromEntries(previousLive.centers.map(function(x){ return [x.center,x]; })) : {};
    if (!previousLive) {
      q('#sg-compare-period').textContent = 'Đánh giá kỳ hiện tại · chưa tải được ' + (annualComparison ? 'năm trước' : 'tháng trước');
      q('#sg-system-trend').className = 'sg-trend-badge neutral';
      q('#sg-system-trend').textContent = 'Chưa có nền';
      grid.innerHTML = '<div class="sg-caption">Vẫn đánh giá tải và rủi ro hiện tại; cần dữ liệu ' + (annualComparison ? 'năm trước' : 'tháng trước') + ' để kết luận xu hướng.</div>';
    } else {
      q('#sg-compare-period').textContent = live.period.label + ' so với ' + previousLive.period.label;
      const currentOpen = live.summary.processing + live.summary.waitingDelivery;
      const priorOpen = previousLive.summary.processing + previousLive.summary.waitingDelivery;
      const metrics = [
        ['Tiếp nhận',live.summary.received,previousLive.summary.received,false],
        ['Đã giao',live.summary.returned,previousLive.summary.returned,false],
        ['Tồn cuối kỳ',currentOpen,priorOpen,true],
        ['Quá 14 ngày',live.summary.overdue,previousLive.summary.overdue,true]
      ];
      grid.innerHTML = metrics.map(function(m) {
        const delta = m[1] - m[2];
        const better = delta === 0 ? null : (m[3] ? delta < 0 : delta > 0);
        const tone = better === null ? 'neutral' : better ? 'good' : 'bad';
        const change = delta === 0 ? 'Không đổi' : (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta);
        return '<div class="sg-month-compare-item"><span>' + m[0] + '</span><strong>' + m[1] + '</strong><small>Trước: ' + m[2] + ' · <span class="sg-kpi-change ' + tone + '">' + change + '</span></small></div>';
      }).join('');
      const backlogDelta = currentOpen - priorOpen;
      const overdueDelta = live.summary.overdue - previousLive.summary.overdue;
      const systemTone = backlogDelta < 0 && overdueDelta <= 0 ? 'good' : backlogDelta > 0 || overdueDelta > 0 ? 'bad' : 'neutral';
      q('#sg-system-trend').className = 'sg-trend-badge ' + systemTone;
      q('#sg-system-trend').textContent = systemTone === 'good' ? 'Đang cải thiện' : systemTone === 'bad' ? 'Cần chú ý' : 'Ổn định';
    }
    const comparisonRows = live.centers.map(function(x) {
      const p = previousByCenter[x.center] || {};
      const tone = x.lowVolume && x.status !== 'action' ? 'neutral' : x.status === 'action' ? 'bad' : x.status === 'good' ? 'good' : 'neutral';
      const label = x.lowVolume && x.status !== 'action' ? 'Mẫu nhỏ' : x.status === 'action' ? 'Cần hành động' : x.status === 'good' ? 'Ổn định' : 'Cần theo dõi';
      const tat = x.medianDays === null ? '—' : x.medianDays + ' ngày';
      const flow = x.outflowInflowRatio === null || x.outflowInflowRatio === undefined ? '—' : pct(x.outflowInflowRatio);
      return '<div class="sg-compare-list-row" title="' + esc(x.reason || '') + '"><span><strong title="' + esc(x.center) + '">' + esc(shortCenter(x.center)) + '</strong><small>' + esc(x.reason || '') + '</small></span><span><strong>' + x.received + '</strong><small>' + pct(x.volumeShare) + ' tổng tiếp nhận</small></span><span><strong>' + x.completed + '</strong><small>Ra/vào ' + flow + '</small></span><span><strong>' + x.open + '</strong>' + deltaHtml(x.open,p.open,true,'') + '</span><span><strong>' + x.overdue + '</strong><small>' + pct(x.overdueRate) + ' thiết bị mở</small></span><span><strong>' + tat + '</strong>' + deltaHtml(x.medianDays,p.medianDays,true,' ngày') + '</span><span><span class="sg-trend-badge ' + tone + '">' + label + '</span></span></div>';
    }).join('');
    table.innerHTML = '<div class="sg-mini-table-head sg-compare-list-head"><span>Center</span><span>Tiếp nhận</span><span>Đã giao</span><span>Tồn cuối</span><span>Quá hạn</span><span>TAT</span><span>Nhận định</span></div><div class="sg-card-list-body sg-compare-list-body">' + comparisonRows + '</div>';
    q('#sg-compare-note').textContent = 'Khối lượng cho biết tải service. Ra/vào, tồn, quá hạn và TAT dùng để đánh giá vận hành. Tỷ trọng tiếp nhận chưa phải tỷ lệ hỏng vì chưa có số máy đang vận hành.';
  }

  function renderTickets() {
    const term = (q('#sg-search').value || '').trim().toLowerCase();
    const center = q('#sg-center').value;
    const statusFilter = q('#sg-status').value;
    const searchLoading = !!(term && ticketSearchState.term === term && ticketSearchState.loading);
    const searchedAllYears = term && ticketSearchState.term === term && Array.isArray(ticketSearchState.rows);
    let rows = searchedAllYears ? ticketSearchState.rows.slice() : live.tickets.slice();
    rows = rows.filter(t => center === 'all' || t.center === center);
    if (term && !searchedAllYears) rows = rows.filter(t => [t.serialNumber,t.model].join(' ').toLowerCase().includes(term));
    if (statusFilter !== 'all') rows = rows.filter(t => ticketStatus(t) === statusFilter);
    q('#sg-tickets-table').innerHTML = searchLoading ? ticketTable([], 'Đang tìm trong năm đang chọn…') : ticketTable(rows);
    if (searchLoading) {
      q('#sg-result-count').textContent = 'Đang tra cứu dữ liệu năm đang chọn…';
    } else if (term && ticketSearchState.term === term && ticketSearchState.error) {
      q('#sg-result-count').textContent = ticketSearchState.error;
    } else if (searchedAllYears) {
      const shown = rows.length;
      const total = ticketSearchState.total;
      const searchPeriod = ticketSearchState.fromYear === ticketSearchState.toYear ? String(ticketSearchState.toYear) : ticketSearchState.fromYear + '–' + ticketSearchState.toYear;
      q('#sg-result-count').textContent = `${shown} dòng hiển thị · ${total} kết quả trong dữ liệu ${searchPeriod}${ticketSearchState.truncated ? ' · giới hạn 200 dòng' : ''}`;
    } else {
      q('#sg-result-count').textContent = `${rows.length} thiết bị gần nhất · dữ liệu từ tab ${live.source.sheetName}`;
    }
  }

  function scheduleTicketSearch() {
    q('#sg-detail').classList.add('sg-hidden');
    const term = (q('#sg-search').value || '').trim().toLowerCase();
    clearTimeout(ticketSearchTimer);
    if (ticketSearchController) ticketSearchController.abort();
    const sequence = ++ticketSearchSequence;
    ticketSearchState = {term:term,rows:null,total:0,truncated:false,loading:!!term,error:'',fromYear:null,toYear:null};
    if (!term) { renderTickets(); return; }
    if (term.length < 2) {
      ticketSearchState.loading = false;
      ticketSearchState.error = 'Nhập ít nhất 2 ký tự để tìm trong năm đang chọn.';
      renderTickets();
      return;
    }
    renderTickets();
    ticketSearchTimer = setTimeout(async function() {
      const controller = new AbortController();
      ticketSearchController = controller;
      try {
        const data = await fetchDashboard({action:'tickets.search',idToken:token,query:term,center:q('#sg-center').value,year:Number(live.period?.year)||Number(String(live.period?.key||'').slice(0,4))},controller.signal,2);
        if (sequence !== ticketSearchSequence) return;
        ticketSearchState = {term:term,rows:Array.isArray(data.tickets)?data.tickets:[],total:Number(data.total)||0,truncated:!!data.truncated,loading:false,error:'',fromYear:data.fromYear,toYear:data.toYear};
      } catch (error) {
        if (controller.signal.aborted || sequence !== ticketSearchSequence) return;
        ticketSearchState = {term:term,rows:null,total:0,truncated:false,loading:false,error:'Không tra cứu được dữ liệu năm đang chọn. Vui lòng thử lại.',fromYear:null,toYear:null};
      } finally {
        if (ticketSearchController === controller) ticketSearchController = null;
        if (sequence === ticketSearchSequence) renderTickets();
      }
    },300);
  }

  function showTicketDetail(ticketId) {
    const candidates = (Array.isArray(ticketSearchState.rows) ? ticketSearchState.rows : []).concat(live.tickets || []);
    const ticket = candidates.find(function(item) { return String(item.id) === String(ticketId); });
    if (!ticket) return;
    const status = ticketStatus(ticket);
    const duration = ticketDuration(ticket);
    const model = ticket.model || ticket.deviceType || 'Chưa xác định';
    const serial = ticket.serialNumber || 'Chưa có S/N';
    const fields = [
      ['Số serial',serial],
      ['Ngày tiếp nhận',formatDate(ticket.receivedDate)],
      ['Ngày trả',formatDate(ticket.returnDate)],
      ['Trung tâm',ticket.center || '—'],
      ['Bảo hành',ticket.warranty || ticket.warrantyStatus || '—'],
      ['Lỗi ghi nhận',ticket.error || '—'],
      ['Trạng thái',status],
      ['Thời gian xử lý',duration.text]
    ];
    const detail = q('#sg-detail');
    detail.classList.remove('sg-hidden');
    detail.innerHTML = '<div class="sg-panel-head"><div><h2>' + esc(model) + '</h2><span class="sg-caption">S/N ' + esc(serial) + ' · Chi tiết lượt sửa chữa</span></div><button class="sg-button" type="button" data-live-close="true">Đóng</button></div><div class="sg-detail-grid">' + fields.map(function(field) { return '<div class="sg-field"><span>' + esc(field[0]) + '</span>' + esc(field[1]) + '</div>'; }).join('') + '</div>';
    detail.scrollIntoView({block:'nearest',behavior:'auto'});
  }
  function fallbackModelTypes() {
    const start = live.period?.start || '';
    const end = live.period?.end || '';
    const groups = {};
    (live.tickets || []).filter(function(t) { return t.receivedDate && t.receivedDate >= start && t.receivedDate <= end; }).forEach(function(t) {
      const type = t.deviceType || 'Chưa xác định';
      const model = t.model || (t.deviceType ? t.deviceType + ' · chưa có model' : 'Chưa xác định');
      if (!groups[type]) groups[type] = {name:type,count:0,models:{}};
      groups[type].count++;
      groups[type].models[model] = (groups[type].models[model] || 0) + 1;
    });
    return Object.values(groups).map(function(group) {
      return {name:group.name,count:group.count,models:Object.keys(group.models).map(function(name){return {name:name,count:group.models[name]};}).sort(function(a,b){return b.count-a.count;})};
    }).sort(function(a,b){return b.count-a.count || a.name.localeCompare(b.name);});
  }

  function availableModelTypes() {
    return Array.isArray(live.modelTypes) && live.modelTypes.length ? live.modelTypes : fallbackModelTypes();
  }

  function syncModelTypeOptions() {
    const select = q('#sg-model-type');
    const current = select.value || 'all';
    const groups = availableModelTypes();
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'Tất cả thiết bị';
    select.appendChild(all);
    groups.forEach(function(group) {
      const option = document.createElement('option');
      option.value = group.name;
      option.textContent = group.name + ' (' + group.count + ')';
      select.appendChild(option);
    });
    select.value = groups.some(function(group){ return group.name === current; }) ? current : 'all';
    return groups;
  }

  function renderModels() {
    const groups = syncModelTypeOptions();
    const selectedType = q('#sg-model-type').value;
    const selectedGroup = groups.find(function(group){ return group.name === selectedType; });
    const rows = selectedType === 'all' ? live.models : (selectedGroup ? selectedGroup.models : []);
    const total = rows.reduce((n,x) => n+x.count, 0);
    const palette=['#ff7900','#ff9d4d','#3f5f73','#f3b37b','#7f8d97','#c5cdd2'];
    let cursor=0;
    const segments=rows.map(function(x,i){const start=cursor,end=cursor+(total?100*x.count/total:0);cursor=end;return palette[i%palette.length]+' '+start+'% '+end+'%';}).join(',') || '#e8ecef 0 100%';
    const legend=rows.map(function(x,i){const share=total?(100*x.count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0;return '<button class="sg-donut-item '+(/chưa/i.test(x.name)?'unknown':'')+'" aria-pressed="false"><i style="background:'+palette[i%palette.length]+'"></i><span title="'+esc(x.name)+'">'+esc(x.name)+'</span><strong>'+x.count+'</strong><em>'+share+'%</em></button>';}).join('') || '<div class="sg-caption sg-model-empty">Không có dữ liệu model cho loại thiết bị đã chọn.</div>';
    q('#sg-model-bars').innerHTML = '<div class="sg-model-donut-layout"><div class="sg-model-donut" style="--donut:conic-gradient('+segments+')"><div><strong>'+total+'</strong><span>thiết bị</span></div></div><div class="sg-model-donut-legend"><div class="sg-mini-table-head sg-model-list-head"><span>Model</span><span>SL</span><span>Tỷ trọng</span></div><div class="sg-card-list-body sg-model-list-body">'+legend+'</div></div></div>';
    q('#sg-model-denominator').textContent = 'Mẫu số: ' + total + ' thiết bị tiếp nhận · ' + (selectedType === 'all' ? 'tất cả loại thiết bị' : selectedType) + ' · ' + live.period.label + '.';
    if (rows[0]) q('#sg-model-insight').innerHTML = '<div class="sg-caption">MODEL NHIỀU NHẤT</div><h3>'+esc(rows[0].name)+'</h3><div class="sg-model-selected-number">'+(total?(100*rows[0].count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0)+'% <small>tỷ trọng tiếp nhận</small></div><div class="sg-caption">'+rows[0].count+' thiết bị trong kỳ đang chọn.</div>';
    else q('#sg-model-insight').innerHTML = '<div class="sg-caption">Chưa có model trong nhóm đã chọn.</div>';
  }

  function renderParts() {
    const total = live.parts.reduce(function(n,x) { return n + x.quantity; }, 0);
    const rows = live.parts.map(function(x) {
      return { pn:x.pn, quantity:x.quantity, share:total ? x.quantity / total : 0 };
    });
    const top = rows[0] || null;
    const annual = live.annual || {};
    const annualParts = Array.isArray(annual.parts) ? annual.parts : [];
    const annualByPn = Object.fromEntries(annualParts.map(function(x) { return [x.pn,x.quantity]; }));
    const annualTop = annualParts[0] || null;
    const topShare = top ? Math.round(top.share * 100) : 0;
    const concentration = topShare >= 40 ? 'Mức tập trung cao' : topShare >= 25 ? 'Mức tập trung trung bình' : 'Nhu cầu phân tán';
    const recommendation = top ? concentration + ': ưu tiên rà soát tồn kho và lead time của ' + top.pn + '.' + (annualTop ? ' PN dùng nhiều nhất năm là ' + annualTop.pn + ' (' + annualTop.quantity + ' chiếc).' : '') : 'Chưa có linh kiện thay trong kỳ.';
    const periodLabel = live.period && live.period.label ? live.period.label : 'kỳ đã chọn';
    const yearLabel = annual.year || new Date().getFullYear();
    const isYear = !!(live.period && live.period.isYear);
    const overviewTitle = q('#sg-overview-parts-title');
    if (overviewTitle) overviewTitle.textContent = isYear ? 'Sử dụng trong năm' : 'Sử dụng trong tháng';
    q('#sg-part-sub').textContent = 'Linh kiện đã xác nhận thay cho thiết bị sửa chữa · kỳ ghi nhận theo ngày sửa chữa';
    q('#sg-part-metrics').innerHTML = '<div><span class="sg-caption">Số lượng dùng · ' + esc(periodLabel) + '</span><strong>' + total + ' <span class="sg-caption">chiếc</span></strong></div><div><span class="sg-caption">PN chiếm tỷ trọng cao nhất trong kỳ</span><strong>' + (top ? esc(top.pn) : '—') + ' <span class="sg-caption">' + topShare + '%</span></strong></div><div><span class="sg-caption">Lũy kế từ 01/01/' + yearLabel + '</span><strong>' + (annual.partsQuantity === undefined ? '—' : annual.partsQuantity) + ' <span class="sg-caption">chiếc</span></strong></div>';
    q('#sg-part-table').innerHTML = '<table><thead><tr><th>Mã linh kiện</th><th>SL dùng · ' + esc(periodLabel) + '</th><th>Tỷ trọng trong kỳ</th><th>SL lũy kế năm ' + yearLabel + '</th><th>Cách xác định kỳ</th></tr></thead><tbody>' + rows.map(function(x) { return '<tr><td class="sg-sn">' + esc(x.pn) + '</td><td>' + x.quantity + ' chiếc</td><td><div class="sg-part-share"><span><i style="width:' + Math.round(x.share * 100) + '%"></i></span><b>' + Math.round(x.share * 100) + '%</b></div></td><td>' + (annualByPn[x.pn] === undefined ? '—' : annualByPn[x.pn] + ' chiếc') + '</td><td>Theo ngày sửa chữa thiết bị</td></tr>'; }).join('') + '</tbody></table>';
    q('#sg-part-note').textContent = 'Định nghĩa: số lượng linh kiện được tính theo thiết bị có ngày sửa chữa thuộc kỳ đã chọn. ' + recommendation + ' Kế hoạch order cần đối chiếu thêm tồn kho, lead time và kế hoạch bảo trì.';
    const overviewMetrics = q('#sg-overview-part-metrics');
    const overviewTable = q('#sg-overview-part-table');
    if (overviewMetrics) overviewMetrics.innerHTML = '<strong>' + total + '</strong><span>' + rows.length + ' mã · PN cao nhất ' + topShare + '%</span>';
    if (overviewTable) overviewTable.innerHTML = '<div class="sg-mini-table-head sg-part-list-head"><span>Part number</span><span>SL</span><span>Tỷ trọng</span></div><div class="sg-card-list-body sg-part-list-body">' + rows.map(function(x) { return '<div class="sg-part-list-row"><span class="sg-sn">' + esc(x.pn) + '</span><span>' + x.quantity + '</span><span>' + Math.round(x.share * 100) + '%</span></div>'; }).join('') + '</div>';
  }

  function failureModels() {
    const catalog = Array.isArray(live.modelCatalog) ? live.modelCatalog.filter(Boolean) : [];
    const periodModels = (live.models || []).map(function (x) { return x.name; }).filter(function (name) { return name && !/chưa (có model|xác định)/i.test(name); });
    const ticketModels = (live.tickets || []).map(function (x) { return x.model; }).filter(function (name) { return name && !/chưa (có model|xác định)/i.test(name); });
    return Array.from(new Set(catalog.concat(periodModels,ticketModels))).sort(function (a,b) { return a.localeCompare(b,'vi',{sensitivity:'base',numeric:true}); });
  }

  function syncFailureModelOptions() {
    const select = q('#sg-fail-model');
    if (!select) return;
    const current = select.value;
    const models = failureModels();
    select.replaceChildren();
    models.forEach(function (name) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    if (models.includes(current)) select.value = current;
    if (!models.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Chưa có model trong database';
      select.appendChild(option);
    }
  }

  function normalizeModelName(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  }

  function failureStatsForPeriod(data, model) {
    const key = normalizeModelName(model);
    const deviceStats = data && data.modelDeviceStats;
    const deviceStat = (Array.isArray(deviceStats) ? deviceStats : []).find(function (x) { return (x.key || normalizeModelName(x.name)) === key; });
    if (deviceStat) return { visits:Number(deviceStat.rowCount)||0, serialKeys:Array.isArray(deviceStat.uniqueSerialKeys)?deviceStat.uniqueSerialKeys:[], missingSerialRows:Number(deviceStat.missingSerialRows)||0, deduplicated:true };
    // A current API response can legitimately have no row for the selected model
    // in a month/year. Treat that period as an empty, deduplicated result instead
    // of downgrading the whole cumulative calculation to the legacy visit count.
    if (Array.isArray(deviceStats)) return { visits:0, serialKeys:[], missingSerialRows:0, deduplicated:true };
    const row = ((data && data.models) || []).find(function (x) { return normalizeModelName(x.name) === key; });
    return { visits:row?Number(row.count)||0:0, serialKeys:[], missingSerialRows:0, deduplicated:false };
  }

  function cumulativeFailurePeriods() {
    const fromYear = Number(live.cumulative && live.cumulative.fromYear) || 2024;
    const cutoffYear = Number(live.period.year) || Number(String(live.period.key || '').slice(0,4)) || Number(live.annual && live.annual.year);
    const periods = [];
    for (let year = fromYear; year < cutoffYear; year += 1) periods.push(String(year));
    if (live.period.isYear) periods.push(String(cutoffYear));
    else {
      const cutoffMonth = Number(String(live.period.key).slice(5,7));
      for (let month = 1; month <= cutoffMonth; month += 1) periods.push(cutoffYear + '-' + String(month).padStart(2,'0'));
    }
    return periods;
  }

  async function cumulativeReceivedForFailureModel(model) {
    const center = 'all';
    const periods = cumulativeFailurePeriods();
    const datasets = await Promise.all(periods.map(function (period) {
      if (period === live.period.key && q('#sg-center').value === 'all') return Promise.resolve(live);
      const cacheKey = center + '|' + period;
      if (failureRateCache.has(cacheKey)) return Promise.resolve(failureRateCache.get(cacheKey));
      const controller = new AbortController();
      return fetchDashboard({action:'dashboard.read',idToken:token,period:period,center:center,includeAnnual:false,includeTickets:false},controller.signal,2).then(function (data) { failureRateCache.set(cacheKey,data); return data; });
    }));
    const serialKeys = new Set();
    let visits = 0, missingSerialRows = 0, deduplicated = true;
    datasets.forEach(function (data) {
      const stats = failureStatsForPeriod(data,model);
      visits += stats.visits;
      missingSerialRows += stats.missingSerialRows;
      deduplicated = deduplicated && stats.deduplicated;
      stats.serialKeys.forEach(function (key) { serialKeys.add(key); });
    });
    return { received:deduplicated?serialKeys.size:visits, visits:visits, uniqueSerials:deduplicated?serialKeys.size:null, missingSerialRows:missingSerialRows, deduplicated:deduplicated };
  }

  async function calculateFailureRate() {
    const result = q('#sg-fail-result');
    const button = q('#sg-calc-fail');
    const model = q('#sg-fail-model').value;
    const sold = Number(q('#sg-sold-quantity').value);
    if (!model || !Number.isFinite(sold) || sold <= 0 || Math.floor(sold) !== sold) {
      result.className = 'sg-fail-result is-error';
      result.innerHTML = '<p>Nhập lũy kế số lượng đã bán là số nguyên lớn hơn 0.</p>';
      return;
    }
    button.disabled = true;
    button.textContent = 'Đang tính…';
    result.className = 'sg-fail-result';
    result.innerHTML = '<p>Đang cộng dữ liệu tiếp nhận từ các kỳ…</p>';
    try {
      const stats = await cumulativeReceivedForFailureModel(model);
      const received = stats.received;
      const rate = received / sold * 100;
      const perThousand = received / sold * 1000;
      const mismatch = received > sold;
      const fromYear = Number(live.cumulative && live.cumulative.fromYear) || 2024;
      const asOf = String(live.period.asOf || '').slice(0,7).split('-');
      const range = '01/' + fromYear + '–' + (asOf[1] || '12') + '/' + (asOf[0] || live.period.year);
      const duplicateRows = stats.deduplicated ? Math.max(0,stats.visits-stats.uniqueSerials-stats.missingSerialRows) : null;
      const numeratorLabel = stats.deduplicated ? 'S/N duy nhất gửi về' : 'Lũy kế lượt tiếp nhận';
      const methodNote = stats.deduplicated
        ? ' Từ ' + stats.visits.toLocaleString('vi-VN') + ' lượt tiếp nhận: loại ' + duplicateRows.toLocaleString('vi-VN') + ' lượt trùng S/N' + (stats.missingSerialRows ? '; ' + stats.missingSerialRows.toLocaleString('vi-VN') + ' dòng thiếu S/N không đưa vào tử số.' : '.')
        : ' API hiện tại chưa trả khóa S/N đầy đủ nên kết quả đang tính theo lượt và chưa loại S/N trùng.';
      result.className = 'sg-fail-result has-result' + (mismatch || !stats.deduplicated ? ' is-warning' : '');
      result.innerHTML = '<div><span>' + numeratorLabel + '</span><strong>' + received.toLocaleString('vi-VN') + '</strong></div><div><span>Tỷ lệ ước tính</span><strong>' + rate.toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%</strong></div><p><b>' + esc(model) + '</b> tương đương ' + perThousand.toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' thiết bị trên 1.000 thiết bị bán, phạm vi ' + range + '.' + methodNote + (mismatch ? ' Tử số lớn hơn lũy kế bán; cần kiểm tra số bán.' : ' Chưa phải cohort fail rate do không có ngày bán.') + '</p>';
    } catch (_) {
      result.className = 'sg-fail-result is-error';
      result.innerHTML = '<p>Chưa cộng được dữ liệu các kỳ. Kiểm tra kết nối rồi thử lại.</p>';
    } finally {
      button.disabled = false;
      button.textContent = 'Tính toán';
    }
  }

  function renderQuality() {
    const x = live.dataQuality;
    q('.sg-quality').innerHTML = [
      ['Đã giao thiếu ngày trả',x.deliveredMissingReturnDate,'Chưa xác định chính xác kỳ hoàn tất'],
      ['Số No. bị trùng',x.duplicateSourceNo,'Cần TicketID ổn định'],
      ['Cột AD chưa có tên',x.unnamedColumnADRows,'API chưa sử dụng trường này'],
      ['Cột AE chưa có tên',x.unnamedColumnAERows,'Cần đặt tên trước khi tích hợp']
    ].map(i => `<div class="sg-quality-item"><div>${i[0]}<span class="sg-small">${i[2]}</span></div><strong>${i[1]}</strong></div>`).join('');
    syncFailureModelOptions();
    const fromYear = Number(live.cumulative && live.cumulative.fromYear) || 2024;
    const asOf = String(live.period.asOf || '').slice(0,7).split('-');
    q('#sg-fail-period').textContent = 'Lũy kế 01/' + fromYear + '–' + (asOf[1] || '12') + '/' + (asOf[0] || live.period.year);
    q('#sg-fail-result').className = 'sg-fail-result';
    q('#sg-fail-result').innerHTML = '<div><span>S/N duy nhất gửi về</span><strong>—</strong></div><div><span>Tỷ lệ ước tính</span><strong>—</strong></div><p>Chọn model, nhập lũy kế số lượng đã bán rồi bấm Tính toán.</p>';
  }

  const chartColors=['#ff7900','#365f78','#7d8b95','#d6a066','#a9b2b8','#c35a42'];
  function curvePath(points){if(!points.length)return '';let d='M'+points[0][0].toFixed(1)+','+points[0][1].toFixed(1);for(let i=1;i<points.length;i++){const p=points[i-1],n=points[i],mx=(p[0]+n[0])/2;d+=' C'+mx.toFixed(1)+','+p[1].toFixed(1)+' '+mx.toFixed(1)+','+n[1].toFixed(1)+' '+n[0].toFixed(1)+','+n[1].toFixed(1)}return d}
  function centerColor(name){if(/sungrow/i.test(name))return '#ff7900';if(/dat/i.test(name))return '#365f78';if(/xbsolar/i.test(name))return '#7d8b95';if(/bke/i.test(name))return '#d6a066';let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;return chartColors[h%chartColors.length]}
  function curveChart(series,axisLabels,maxValue,unit,options) {
    options=options||{};
    const W=760,H=210,L=43,R=45,T=14,B=34,pw=W-L-R,ph=H-T-B,max=Math.max(1,maxValue),x=i=>L+(axisLabels.length===1?pw/2:i*pw/(axisLabels.length-1)),y=v=>T+ph-Math.max(0,Math.min(max,v))/max*ph;
    const ticks=options.grid===false?[0,1]:[0,.5,1];
    const grid=ticks.map(t=>{const yy=y(t*max),line=options.grid===false?(t===0?'<line class="sg-curve-baseline" x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'"></line>':''):'<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'"></line>';return line+'<text x="'+(L-7)+'" y="'+(yy+4)+'" text-anchor="end">'+Math.round(t*max)+'</text>';}).join('');
    const axes=axisLabels.map((label,i)=>'<text class="sg-curve-axis" x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+label+'</text>').join('');
    const curves=series.map(s=>{const pts=s.values.map((v,i)=>[x(i),y(v)]),color=centerColor(s.name),dots=pts.map((p,i)=>{const safe=String(s.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),tip=safe+'|'+axisLabels[i]+': '+Math.round(s.values[i])+unit;return '<g class="sg-curve-point" data-chart-tip="'+tip+'"><circle class="sg-curve-dot" cx="'+p[0]+'" cy="'+p[1]+'" r="3" style="fill:'+color+'"></circle><circle class="sg-curve-hit" cx="'+p[0]+'" cy="'+p[1]+'" r="12"></circle></g>'}).join('');return '<path class="sg-curve-line" d="'+curvePath(pts)+'" style="stroke:'+color+'"></path>'+dots}).join('');
    const legend=series.map(s=>'<span><i style="background:'+centerColor(s.name)+'"></i>'+esc(shortCenter(s.name))+'</span>').join('');
    return '<div class="sg-curve-chart '+(options.grid===false?'sg-curve-chart-clean':'')+'"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img"><g class="sg-curve-grid">'+grid+'</g>'+axes+curves+'</svg><div class="sg-curve-legend">'+legend+'</div></div>';
  }
  function installChartTooltip(){if(root.dataset.chartTooltipReady)return;root.dataset.chartTooltipReady='true';let tip=document.querySelector('.sg-chart-tooltip');if(!tip){tip=document.createElement('div');tip.className='sg-chart-tooltip';document.body.appendChild(tip)}root.addEventListener('pointermove',e=>{const point=e.target.closest&&e.target.closest('.sg-curve-point');if(!point){tip.classList.remove('show');return}const parts=(point.dataset.chartTip||'').split('|');tip.replaceChildren();const strong=document.createElement('strong');strong.textContent=parts.shift()||'';tip.appendChild(strong);parts.forEach(x=>{const span=document.createElement('span');span.textContent=x;tip.appendChild(span)});tip.style.left=Math.min(window.innerWidth-230,e.clientX+14)+'px';tip.style.top=Math.min(window.innerHeight-80,e.clientY+14)+'px';tip.classList.add('show')});root.addEventListener('pointerleave',()=>tip.classList.remove('show'))}
  installChartTooltip();
  function renderCenters() {
    const labels = {good:'Ổn định',watch:'Cần theo dõi',action:'Cần hành động'};
    const cs = live.centers;
    const pct = function(value) { return value === null || value === undefined ? '—' : Math.round(value * 100) + '%'; };
    q('#sg-center-summary').innerHTML = [['Center đang theo dõi',cs.length,'center'],['Tiếp nhận trong kỳ',live.summary.received,'thiết bị'],['Đã giao trong kỳ',live.summary.returned,'thiết bị'],['Đạt SLA 7 ngày',live.summary.slaRate===null||live.summary.slaRate===undefined?'—':Math.round(live.summary.slaRate*100)+'%','thiết bị đã trả'],['Đang mở > 7 ngày',live.summary.slaBreachedOpen||0,'thiết bị cần can thiệp']].map(function(x) { return '<div class="sg-center-summary-item"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><span>' + x[2] + '</span></div>'; }).join('');
    q('#sg-center-health-grid').innerHTML = cs.map(function(x) {
      const label = x.lowVolume && x.status !== 'action' ? 'Mẫu nhỏ' : labels[x.status];
      return '<article class="sg-center-card"><div class="sg-center-card-head"><h3 title="' + esc(x.center) + '">' + esc(shortCenter(x.center)) + '</h3><span class="sg-health-label ' + x.status + '">' + label + '</span></div><div class="sg-center-card-metrics"><div><span>Tiếp nhận</span><strong>' + x.received + '</strong></div><div><span>Ra/vào</span><strong>' + pct(x.outflowInflowRatio) + '</strong></div><div><span>Tồn cuối</span><strong>' + x.open + '</strong></div><div><span>SLA 7 ngày</span><strong>' + pct(x.slaRate) + '</strong></div></div><div class="sg-center-card-reason">' + esc(x.reason) + '</div></article>';
    }).join('');
    q('#sg-center-month-table').className = 'sg-center-curve';
    const comparable=cs.filter(function(x){return x.received>=5;}),profiles=comparable.map(function(x){const flow=Math.min(100,(x.outflowInflowRatio||0)*100),control=Math.max(0,100-(x.overdueRate||0)*100),sla=x.slaRate===null||x.slaRate===undefined?(x.medianDays===null?0:Math.max(0,100-Math.max(0,x.medianDays-7)*12.5)):x.slaRate*100;return {name:x.center,values:[flow,control,sla,x.coverage||0]};}),excluded=cs.length-comparable.length;
    q('#sg-center-month-table').innerHTML = curveChart(profiles,['Ra/vào','Không quá hạn','SLA 7 ngày','Dữ liệu đủ'],100,'%')+'<div class="sg-chart-definition">'+(excluded?excluded+' center chưa đủ mẫu (&lt;5 thiết bị) · ':'')+'Số tuyệt đối nằm trên thẻ center.</div>';
    const colors = ['#ff7900','#606060','#9a9a9a','#c4c4c4'];
    q('#sg-center-trend-legend').innerHTML = '';
    const trendLabels=live.trends.map(function(m){return m.label;}),trendSeries=cs.map(function(c){return {name:c.center,values:live.trends.map(function(m){return m.values[c.center]||0;})};}),max=Math.max(1,...trendSeries.flatMap(function(s){return s.values;}));
    q('#sg-center-trend').innerHTML = curveChart(trendSeries,trendLabels,Math.ceil(max/5)*5,' thiết bị',{grid:true});
    if (cs[0]) q('#sg-center-detail').innerHTML = '<div class="sg-caption">CÁCH ĐỌC KẾT QUẢ</div><h3>' + esc(live.period.label) + '</h3><div class="sg-detail-block"><strong>Khối lượng</strong><p>Tiếp nhận mô tả tải service và tỷ trọng sự cố ghi nhận, không phải tỷ lệ hỏng sản phẩm.</p></div><div class="sg-detail-block"><strong>Hiệu quả</strong><p>Đọc đồng thời tỷ lệ ra/vào, tồn cuối kỳ, SLA trả thiết bị trong 7 ngày, quá hạn và TAT. Mẫu dưới 5 thiết bị chưa dùng để xếp hạng.</p></div><div class="sg-detail-block"><strong>Dữ liệu cần bổ sung</strong><p>Muốn tính tỷ lệ hư hỏng cần số máy bán hoặc đang vận hành theo model và khu vực.</p></div>';
  }

  function setPeriodLabels() {
    const current = cfg.defaultPeriod || new Date().toISOString().slice(0,7);
    const maxYear = Number(current.slice(0,4));
    const maxMonth = Number(current.slice(5,7));
    const select = q('#sg-period');
    select.innerHTML = '';
    for (let year = maxYear; year >= 2024; year -= 1) {
      const group = document.createElement('optgroup');
      group.label = String(year);
      const yearOption = document.createElement('option');
      yearOption.value = String(year);
      yearOption.dataset.livePeriod = String(year);
      yearOption.textContent = 'Cả năm ' + year;
      yearOption.selected = String(year) === current;
      group.appendChild(yearOption);
      const lastMonth = year === maxYear ? maxMonth : 12;
      for (let month = lastMonth; month >= 1; month -= 1) {
        const key = String(year) + '-' + String(month).padStart(2,'0');
        const option = document.createElement('option');
        option.value = key;
        option.dataset.livePeriod = key;
        option.textContent = 'Tháng ' + String(month).padStart(2,'0') + '/' + year;
        option.selected = key === current;
        group.appendChild(option);
      }
      select.appendChild(group);
    }
  }

  function initGoogle() {
    if (!cfg.appsScriptUrl || /PASTE_/.test(cfg.appsScriptUrl) || !cfg.googleClientId || /PASTE_/.test(cfg.googleClientId)) {
      status('Chưa cấu hình API','Cần Apps Script URL và Google Client ID','error');
      return;
    }
    if (!window.google?.accounts?.id) { setTimeout(initGoogle,250); return; }
    google.accounts.id.initialize({client_id:cfg.googleClientId,callback:handleCredential});
    google.accounts.id.renderButton(q('#sg-login-slot'),{theme:'outline',size:'small',text:'signin_with',locale:'vi'});
    status('Yêu cầu đăng nhập','Dữ liệu hiển thị sau khi xác thực');
  }

  async function handleCredential(response) {
    token = response?.credential || '';
    if (!token) return;
    sessionStorage.setItem('sungrow_id_token', token);
    try {
      const bootstrap = await fetchDashboard({action:'portal.call', functionName:'getBootstrap', args:[token]}, new AbortController().signal, 1);
      sessionStorage.setItem('sungrow_portal_actor', JSON.stringify(bootstrap.actor || {}));
      if (!bootstrap.actor?.isGlobalManager) {
        renderIdentity(bootstrap.actor);
        q('.sg-dashboard-nav').hidden = true;
        openEntryView('cases');
        return;
      }
      renderIdentity(bootstrap.actor);
      loadLive();
    } catch (error) {
      sessionStorage.removeItem('sungrow_id_token');
      status('Không thể đăng nhập', error.message || 'Tài khoản không được cấp quyền', 'error');
      initGoogle();
    }
  }

  function renderIdentity(actor) {
    if (!actor) return;
    const email = actor.email || '';
    const initials = email ? email.slice(0,2).toUpperCase() : 'SC';
    const loginSlot = q('#sg-login-slot');
    loginSlot.replaceChildren();
    const identity = document.createElement('span');
    identity.className = 'sg-account-name';
    identity.title = email;
    identity.textContent = email;
    loginSlot.appendChild(identity);
    const footer = q('.sg-portal-user');
    if (footer) {
      footer.replaceChildren();
      const line = document.createElement('div');
      const avatar = document.createElement('span');
      avatar.className = 'sg-avatar';
      avatar.textContent = initials;
      const name = document.createElement('span');
      name.textContent = email;
      line.append(avatar, name);
      const role = document.createElement('div');
      role.className = 'sg-account-role';
      role.textContent = actor.role || 'Quản lý hệ thống';
      footer.append(line, role);
    }
  }

  const formatDate = value => value ? value.split('-').reverse().join('/') : '—';
  setPeriodLabels();
  ['#sg-center','#sg-period'].forEach(s => q(s).addEventListener('change',() => {
    if (s === '#sg-period') {
      const compare = q('#sg-compare-mode option');
      if (compare) compare.textContent = /^\d{4}$/.test(selectedPeriod()) ? 'Năm trước' : 'Tháng trước';
    }
    setTimeout(loadLive,0);
    if (s === '#sg-center' && (q('#sg-search').value || '').trim()) setTimeout(scheduleTicketSearch,0);
  }));
  q('#sg-model-type').addEventListener('change',() => {if(live)setTimeout(renderModels,0);});
  q('#sg-search').addEventListener('input',() => {if(live)scheduleTicketSearch();});
  q('#sg-status').addEventListener('change',() => {if(live){q('#sg-detail').classList.add('sg-hidden');renderTickets();}});
  root.addEventListener('click',e => {
    if (!live) return;
    const detailButton = e.target.closest('[data-live-ticket]');
    if (detailButton) { showTicketDetail(detailButton.dataset.liveTicket); return; }
    if (e.target.closest('[data-live-close]')) { q('#sg-detail').classList.add('sg-hidden'); return; }
    if (e.target.closest('[data-part],[data-page]')) setTimeout(renderAll,0);
  });
  q('#sg-refresh').addEventListener('click',() => {if(token)loadLive({force:true});});
  q('#sg-calc-fail').addEventListener('click',() => {if(live)calculateFailureRate();});
  q('#sg-fail-model').addEventListener('change',() => {if(live)renderQuality();});
  q('#sg-sold-quantity').addEventListener('keydown',e => {if(e.key === 'Enter' && live)calculateFailureRate();});
  setInterval(() => {if(token && !document.hidden && !activeController)loadLive({force:true,comparison:false});},AUTO_SYNC_MS);
  document.addEventListener('visibilitychange',() => {if(!document.hidden && token && Date.now()-lastSuccessfulSync>=AUTO_SYNC_MS && !activeController)loadLive({force:true,comparison:false});});
  window.addEventListener('online',() => {if(token && !activeController)loadLive({force:true,comparison:false});});
  const savedToken = sessionStorage.getItem('sungrow_id_token');
  if (savedToken) handleCredential({credential:savedToken});
  else initGoogle();
  window.addEventListener('message',event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'sungrow-portal-dashboard') showDashboardView();
    if (event.data?.type === 'sungrow-portal-ready') {
      const frame = q('.sg-portal-frame');
      if (!frame || event.source !== frame.contentWindow) return;
      frame.dataset.ready = 'true';
      frame.contentWindow.postMessage({type:'sungrow-portal-view',view:frame.dataset.portalView || 'cases'},window.location.origin);
    }
  });
})();
