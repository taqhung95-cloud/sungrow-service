(() => {
  const cfg = window.SUNGROW_CONFIG || {};
  const root = document.getElementById('sg-preview');
  if (!root) return;
  const q = s => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let token = '';
  let live = null;
  let previousLive = null;

  const style = document.createElement('style');
  style.textContent = '#sg-preview .sg-live-box{display:flex;align-items:center;gap:8px}.sg-live-dot{width:8px;height:8px;border-radius:50%;background:#c56b0b}.sg-live-dot.ok{background:#2f7a52}.sg-live-dot.error{background:#b63d35}.sg-live-text{font-size:10px;color:#606060}.sg-live-text strong{display:block;color:#333}.sg-login-slot{min-height:32px}';
  document.head.appendChild(style);
  const host = document.createElement('div');
  host.className = 'sg-live-box';
  host.innerHTML = '<i class="sg-live-dot"></i><span class="sg-live-text"><strong id="sg-live-title">Chưa kết nối</strong><span id="sg-live-detail">Đang kiểm tra cấu hình</span></span><span class="sg-login-slot" id="sg-login-slot"></span>';
  q('.sg-top').appendChild(host);

  function status(title, detail, type = '') {
    q('#sg-live-title').textContent = title;
    q('#sg-live-detail').textContent = detail;
    q('.sg-live-dot').className = 'sg-live-dot ' + type;
  }

  function selectedPeriod() {
    return q('#sg-period').selectedOptions[0]?.dataset.livePeriod || cfg.defaultPeriod || new Date().toISOString().slice(0, 7);
  }

  async function loadLive() {
    if (!token) return;
    status('Đang đồng bộ', 'Đọc Google Sheet…');
    try {
      const body = new URLSearchParams({payload: JSON.stringify({action:'dashboard.read', idToken:token, period:selectedPeriod(), center:q('#sg-center').value})});
      const response = await fetch(cfg.appsScriptUrl, {method:'POST', body, redirect:'follow'});
      const result = await response.json();
      if (!result.ok) throw new Error([result.error?.code, result.error?.message].filter(Boolean).join(': ') || 'API error');
      live = result.data;
      previousLive = null;
      try {
        const selected = selectedPeriod().split('-').map(Number);
        const previousDate = new Date(selected[0], selected[1] - 2, 1);
        const previousPeriod = previousDate.getFullYear() + '-' + String(previousDate.getMonth() + 1).padStart(2, '0');
        const previousBody = new URLSearchParams({payload: JSON.stringify({action:'dashboard.read', idToken:token, period:previousPeriod, center:q('#sg-center').value, includeAnnual:false})});
        const previousResponse = await fetch(cfg.appsScriptUrl, {method:'POST', body:previousBody, redirect:'follow'});
        const previousResult = await previousResponse.json();
        if (previousResult.ok) previousLive = previousResult.data;
      } catch (_) {
        previousLive = null;
      }
      renderAll();
      const updated = new Date(live.source.sourceUpdatedAt).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      status('Đã đồng bộ', `${live.source.sheetName} · ${updated}`, 'ok');
    } catch (error) {
      status('Lỗi đồng bộ', error.message || 'Không đọc được dữ liệu', 'error');
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
    const base = [
      {label:'Thiết bị tiếp nhận',value:s.received,previous:ps?.received,lower:false,unit:'thiết bị'},
      {label:'Thiết bị đã xử lý',value:s.waitingDelivery+s.returned,previous:ps ? ps.waitingDelivery+ps.returned : null,lower:false,unit:'thiết bị'},
      {label:'Thiết bị chờ giao',value:s.waitingDelivery,previous:ps?.waitingDelivery,lower:true,unit:'thiết bị'},
      {label:'Thiết bị đã giao',value:s.returned,previous:ps?.returned,lower:false,unit:'thiết bị'}
    ];
    const slaRate = s.slaRate === null || s.slaRate === undefined ? null : Math.round(s.slaRate*100);
    base.push({label:'Đạt SLA 7 ngày',value:slaRate,previous:null,lower:false,unit:'%',sla:true});
    const trendViz = function(previous,current,tone) {
      if (previous === null || previous === undefined) return '<span class="sg-mini-empty">T-1 → T</span>';
      const max=Math.max(1,previous,current), min=Math.min(0,previous,current), y=function(v){return 25-(v-min)/(max-min||1)*18;};
      const y1=y(previous).toFixed(1), y2=y(current).toFixed(1);
      return '<svg class="sg-mini-trend '+tone+'" viewBox="0 0 72 30" aria-label="Tháng trước '+previous+', tháng này '+current+'"><path d="M4 26 L4 '+y1+' L68 '+y2+' L68 26 Z"></path><polyline points="4,'+y1+' 68,'+y2+'"></polyline><circle cx="4" cy="'+y1+'" r="2.4"></circle><circle cx="68" cy="'+y2+'" r="2.8"></circle></svg>';
    };
    const annualTotals=(Array.isArray(live.yearlyTotals)&&live.yearlyTotals.length?live.yearlyTotals:[live.annual||{}]).filter(x=>x.year).slice().sort((a,b)=>a.year-b.year);
    const cumulative=live.cumulative?.received??annualTotals.reduce((sum,x)=>sum+(x.received||0),0);
    const receivedAnnualViz=function(){
      const values=annualTotals.map(x=>Number(x.received||0)),width=86,height=26,pad=3,max=Math.max(1,...values);
      const points=values.map((v,i)=>[(values.length===1?width/2:pad+i*(width-2*pad)/(values.length-1)),height-pad-v/max*(height-2*pad)]);
      const pointText=points.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' '),last=annualTotals[annualTotals.length-1]||{};
      const line=values.length?'<svg viewBox="0 0 86 26" preserveAspectRatio="none"><path d="M '+points[0][0].toFixed(1)+' 23 L '+pointText.replace(/ /g,' L ')+' L '+points[points.length-1][0].toFixed(1)+' 23 Z"></path><polyline points="'+pointText+'"></polyline></svg>':'';
      const title=annualTotals.map(x=>x.year+': '+x.received).join(' · ')+' · Tích lũy: '+cumulative;
      const years=annualTotals.map(x=>'<span><i>'+esc(x.year)+'</i><b>'+Number(x.received||0).toLocaleString('vi-VN')+'</b></span>').join('');
      return '<div class="sg-received-annual" title="'+esc(title)+'">'+line+'<div class="sg-annual-values">'+years+'<span class="sg-annual-total"><i>Tích lũy</i><b>'+Number(cumulative||0).toLocaleString('vi-VN')+'</b></span></div></div>';
    };
    q('#sg-kpis').innerHTML = base.map(function(item,index) {
      if (item.sla) {
        const value = item.value === null ? '—' : item.value;
        const note = item.value === null ? 'Chưa có thiết bị trả đủ ngày nhận/trả' : s.slaMet + '/' + s.slaEligible + ' đúng hạn · ' + s.slaBreachedOpen + ' đang mở quá SLA';
        const tone = item.value === null ? 'neutral' : item.value === 100 && !s.slaBreachedOpen ? 'good' : 'bad';
        const ringValue = item.value === null ? 0 : Math.max(0,Math.min(100,item.value));
        return '<div class="sg-kpi sg-kpi-sla ' + tone + '"><div class="sg-kpi-head"><div class="sg-kpi-label">' + item.label + '</div><span class="sg-mini-ring '+tone+'" style="--p:'+ringValue+'"><i>7d</i></span></div><div class="sg-kpi-value">' + value + ' <small>' + item.unit + '</small></div><div class="sg-kpi-note">' + note + '</div></div>';
      }
      const p = item.previous === undefined ? null : item.previous;
      const delta = p === null ? null : item.value-p;
      const better = delta === 0 ? null : (item.lower ? delta<0 : delta>0);
      const tone = better === null ? 'neutral' : better ? 'good' : 'bad';
      const change = delta === null ? 'Chưa có tháng trước' : delta === 0 ? 'Không đổi' : (delta>0?'↑ ':'↓ ')+Math.abs(delta);
      const note = p === null ? change : 'Tháng trước: '+p+' <span class="sg-kpi-change '+tone+'">'+change+'</span>';
      return '<div class="sg-kpi '+(index===0?'sg-kpi-received':'')+'"><div class="sg-kpi-head"><div class="sg-kpi-label">'+item.label+'</div>'+(index===0?receivedAnnualViz():trendViz(p,item.value,tone))+'</div><div class="sg-kpi-value">'+item.value+' <small>'+item.unit+'</small></div><div class="sg-kpi-note">'+note+'</div></div>';
    }).join('');
    q('#sg-period-date').textContent = `${formatDate(live.period.start)}–${formatDate(live.period.asOf)}`;
    const max = Math.max(1, ...live.errors.map(x => x.count));
    q('#sg-errors').innerHTML = live.errors.map(x => `<div class="sg-error-line"><span class="sg-error-name" title="${esc(x.name)}">${esc(x.name)}</span><div class="sg-track"><i style="width:${100*x.count/max}%"></i></div><b>${x.count}</b></div>`).join('') || '<div class="sg-caption">Chưa có lỗi được ghi nhận trong kỳ.</div>';
    q('#sg-overview-table').innerHTML = attentionTable(live.tickets.filter(isOpen).sort((a,b) => b.ageDays-a.ageDays));
  }


  function isOpen(t) { return !/đã\s*giao/i.test(t.deliveryStatus || '') && !t.returnDate; }
  function attentionTable(rows) {
    return '<table><thead><tr><th>Thiết bị</th><th>Center</th><th>Trạng thái</th><th>Ngày</th></tr></thead><tbody>' + rows.map(function(t) {
      return '<tr><td><span class="sg-sn">' + esc(t.model || t.deviceType || 'Chưa xác định') + '</span><span class="sg-small">' + esc(t.serialNumber || t.id) + '</span></td><td>' + esc(t.center) + '</td><td><span class="sg-status">' + esc(t.deliveryStatus || t.warrantyStatus || 'Chưa cập nhật') + '</span></td><td class="sg-age ' + (t.ageDays>7?'old':'') + '">' + (t.ageDays>=0?t.ageDays+' ngày':'—') + '</td></tr>';
    }).join('') + (rows.length?'':'<tr><td colspan="4">Không có thiết bị cần theo dõi.</td></tr>') + '</tbody></table>';
  }

  function ticketTable(rows) {
    return '<table><thead><tr><th>Thiết bị / Thiết bị</th><th>Lỗi ghi nhận</th><th>Trung tâm</th><th>Trạng thái</th><th>Tuổi thiết bị</th></tr></thead><tbody>' + rows.map(t => `<tr><td><span class="sg-sn">${esc(t.model || t.deviceType || 'Chưa xác định')}</span><span class="sg-small">${esc(t.serialNumber || t.id)}</span></td><td>${esc(t.error)}</td><td>${esc(t.center)}</td><td><span class="sg-status">${esc(t.deliveryStatus || t.warrantyStatus || 'Chưa cập nhật')}</span></td><td class="sg-age ${t.ageDays>7?'old':''}">${t.ageDays>=0?t.ageDays+' ngày':'—'}</td></tr>`).join('') + (rows.length?'':'<tr><td colspan="5">Không có dữ liệu phù hợp.</td></tr>') + '</tbody></table>';
  }

  function renderMonthlyComparison() {
    const grid = q('#sg-month-compare-grid');
    const table = q('#sg-month-center-table');
    if (!grid || !table) return;
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
      q('#sg-compare-period').textContent = 'Đánh giá kỳ hiện tại · chưa tải được tháng trước';
      q('#sg-system-trend').className = 'sg-trend-badge neutral';
      q('#sg-system-trend').textContent = 'Chưa có nền';
      grid.innerHTML = '<div class="sg-caption">Vẫn đánh giá tải và rủi ro hiện tại; cần dữ liệu tháng trước để kết luận xu hướng.</div>';
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
    table.innerHTML = '<table><thead><tr><th>Center</th><th>Tiếp nhận</th><th>Đã giao</th><th>Tồn cuối</th><th>Quá hạn</th><th>TAT</th><th>Nhận định</th></tr></thead><tbody>' + live.centers.map(function(x) {
      const p = previousByCenter[x.center] || {};
      const tone = x.lowVolume && x.status !== 'action' ? 'neutral' : x.status === 'action' ? 'bad' : x.status === 'good' ? 'good' : 'neutral';
      const label = x.lowVolume && x.status !== 'action' ? 'Mẫu nhỏ' : x.status === 'action' ? 'Cần hành động' : x.status === 'good' ? 'Ổn định' : 'Cần theo dõi';
      const tat = x.medianDays === null ? '—' : x.medianDays + ' ngày';
      const flow = x.outflowInflowRatio === null || x.outflowInflowRatio === undefined ? '—' : pct(x.outflowInflowRatio);
      return '<tr title="' + esc(x.reason || '') + '"><td><strong>' + esc(x.center) + '</strong><span class="sg-small">' + esc(x.reason || '') + '</span></td><td><strong>' + x.received + '</strong><span class="sg-small">' + pct(x.volumeShare) + ' tổng tiếp nhận</span></td><td><strong>' + x.completed + '</strong><span class="sg-small">Ra/vào ' + flow + '</span></td><td><strong>' + x.open + '</strong>' + deltaHtml(x.open,p.open,true,'') + '</td><td><strong>' + x.overdue + '</strong><span class="sg-small">' + pct(x.overdueRate) + ' thiết bị mở</span></td><td><strong>' + tat + '</strong>' + deltaHtml(x.medianDays,p.medianDays,true,' ngày') + '</td><td><span class="sg-trend-badge ' + tone + '">' + label + '</span></td></tr>';
    }).join('') + '</tbody></table>';
    q('#sg-compare-note').textContent = 'Khối lượng cho biết tải service. Ra/vào, tồn, quá hạn và TAT dùng để đánh giá vận hành. Tỷ trọng tiếp nhận chưa phải tỷ lệ hỏng vì chưa có số máy đang vận hành.';
  }

  function renderTickets() {
    const term = (q('#sg-search').value || '').trim().toLowerCase();
    const center = q('#sg-center').value;
    let rows = live.tickets.filter(t => center === 'all' || t.center === center);
    if (term) rows = rows.filter(t => [t.id,t.sourceNo,t.serialNumber,t.model].join(' ').toLowerCase().includes(term));
    q('#sg-tickets-table').innerHTML = ticketTable(rows);
    q('#sg-result-count').textContent = `${rows.length} thiết bị · dữ liệu từ tab ${live.source.sheetName}`;
  }

  function renderModels() {
    const rows = live.models;
    const total = rows.reduce((n,x) => n+x.count, 0);
    q('#sg-model-total').textContent = `${total} thiết bị · ${rows.length} nhóm model`;
    const palette=['#ff7900','#ff9d4d','#3f5f73','#f3b37b','#7f8d97','#c5cdd2'];
    let cursor=0;
    const segments=rows.map(function(x,i){const start=cursor,end=cursor+(total?100*x.count/total:0);cursor=end;return palette[i%palette.length]+' '+start+'% '+end+'%';}).join(',');
    const legend=rows.map(function(x,i){const share=total?(100*x.count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0;return '<button class="sg-donut-item '+(/chưa/i.test(x.name)?'unknown':'')+'" aria-pressed="'+(i===0)+'"><i style="background:'+palette[i%palette.length]+'"></i><span title="'+esc(x.name)+'">'+esc(x.name)+'</span><strong>'+x.count+'</strong><em>'+share+'%</em></button>';}).join('');
    q('#sg-model-bars').innerHTML = '<div class="sg-model-donut-layout"><div class="sg-model-donut" style="--donut:conic-gradient('+segments+')"><div><strong>'+total+'</strong><span>thiết bị</span></div></div><div class="sg-model-donut-legend">'+legend+'</div></div>';
    q('#sg-model-denominator').textContent = `Mẫu số: ${total} thiết bị tiếp nhận · ${live.period.label}.`;
    if (rows[0]) q('#sg-model-insight').innerHTML = `<div class="sg-caption">MODEL NHIỀU NHẤT</div><h3>${esc(rows[0].name)}</h3><div class="sg-model-selected-number">${total?(100*rows[0].count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0}% <small>tỷ trọng tiếp nhận</small></div><div class="sg-caption">${rows[0].count} thiết bị trong kỳ đang chọn.</div>`;
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
    q('#sg-part-sub').textContent = 'Linh kiện đã xác nhận thay cho thiết bị sửa chữa · kỳ ghi nhận theo ngày sửa chữa';
    q('#sg-part-metrics').innerHTML = '<div><span class="sg-caption">Số lượng dùng · ' + esc(periodLabel) + '</span><strong>' + total + ' <span class="sg-caption">chiếc</span></strong></div><div><span class="sg-caption">PN chiếm tỷ trọng cao nhất trong kỳ</span><strong>' + (top ? esc(top.pn) : '—') + ' <span class="sg-caption">' + topShare + '%</span></strong></div><div><span class="sg-caption">Lũy kế từ 01/01/' + yearLabel + '</span><strong>' + (annual.partsQuantity === undefined ? '—' : annual.partsQuantity) + ' <span class="sg-caption">chiếc</span></strong></div>';
    q('#sg-part-table').innerHTML = '<table><thead><tr><th>Mã linh kiện</th><th>SL dùng · ' + esc(periodLabel) + '</th><th>Tỷ trọng trong kỳ</th><th>SL lũy kế năm ' + yearLabel + '</th><th>Cách xác định kỳ</th></tr></thead><tbody>' + rows.map(function(x) { return '<tr><td class="sg-sn">' + esc(x.pn) + '</td><td>' + x.quantity + ' chiếc</td><td><div class="sg-part-share"><span><i style="width:' + Math.round(x.share * 100) + '%"></i></span><b>' + Math.round(x.share * 100) + '%</b></div></td><td>' + (annualByPn[x.pn] === undefined ? '—' : annualByPn[x.pn] + ' chiếc') + '</td><td>Theo ngày sửa chữa thiết bị</td></tr>'; }).join('') + '</tbody></table>';
    q('#sg-part-note').textContent = 'Định nghĩa: số lượng linh kiện được tính theo thiết bị có ngày sửa chữa thuộc kỳ đã chọn. ' + recommendation + ' Kế hoạch order cần đối chiếu thêm tồn kho, lead time và kế hoạch bảo trì.';
    const overviewMetrics = q('#sg-overview-part-metrics');
    const overviewTable = q('#sg-overview-part-table');
    if (overviewMetrics) overviewMetrics.innerHTML = '<strong>' + total + '</strong><span>' + rows.length + ' mã · PN cao nhất ' + topShare + '%</span>';
    if (overviewTable) overviewTable.innerHTML = '<table><thead><tr><th>Part number</th><th>SL</th><th>Tỷ trọng</th></tr></thead><tbody>' + rows.map(function(x) { return '<tr><td class="sg-sn">' + esc(x.pn) + '</td><td>' + x.quantity + '</td><td>' + Math.round(x.share * 100) + '%</td></tr>'; }).join('') + '</tbody></table>';
  }

  function renderQuality() {
    const x = live.dataQuality;
    q('.sg-quality').innerHTML = [
      ['Đã giao nhưng thiếu ngày trả',x.deliveredMissingReturnDate,'Không xác định chính xác kỳ hoàn tất'],
      ['Số No. bị trùng',x.duplicateSourceNo,'Cần TicketID ổn định'],
      ['Cột AD chưa có tiêu đề',x.unnamedColumnADRows,'API chưa sử dụng trường này'],
      ['Cột AE chưa có tiêu đề',x.unnamedColumnAERows,'Cần đặt tên trước khi tích hợp']
    ].map(i => `<div class="sg-quality-item"><div>${i[0]}<span class="sg-small">${i[2]}</span></div><strong>${i[1]}</strong></div>`).join('');
  }

  const chartColors=['#ff7900','#365f78','#7d8b95','#d6a066','#a9b2b8','#c35a42'];
  function curvePath(points){if(!points.length)return '';let d='M'+points[0][0].toFixed(1)+','+points[0][1].toFixed(1);for(let i=1;i<points.length;i++){const p=points[i-1],n=points[i],mx=(p[0]+n[0])/2;d+=' C'+mx.toFixed(1)+','+p[1].toFixed(1)+' '+mx.toFixed(1)+','+n[1].toFixed(1)+' '+n[0].toFixed(1)+','+n[1].toFixed(1)}return d}
  function centerColor(name){if(/sungrow/i.test(name))return '#ff7900';if(/dat/i.test(name))return '#365f78';if(/xbsolar/i.test(name))return '#7d8b95';if(/bke/i.test(name))return '#d6a066';let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;return chartColors[h%chartColors.length]}
  function curveChart(series,axisLabels,maxValue,unit){const W=760,H=210,L=43,R=45,T=14,B=34,pw=W-L-R,ph=H-T-B,max=Math.max(1,maxValue),x=i=>L+(axisLabels.length===1?pw/2:i*pw/(axisLabels.length-1)),y=v=>T+ph-Math.max(0,Math.min(max,v))/max*ph;const grid=[0,.5,1].map(t=>{const yy=y(t*max);return '<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'"></line><text x="'+(L-7)+'" y="'+(yy+4)+'" text-anchor="end">'+Math.round(t*max)+'</text>'}).join(''),axes=axisLabels.map((label,i)=>'<text class="sg-curve-axis" x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+label+'</text>').join(''),curves=series.map(s=>{const pts=s.values.map((v,i)=>[x(i),y(v)]),color=centerColor(s.name),dots=pts.map((p,i)=>{const safe=String(s.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),tip=safe+'|'+axisLabels[i]+': '+Math.round(s.values[i])+unit;return '<g class="sg-curve-point" data-chart-tip="'+tip+'"><circle class="sg-curve-dot" cx="'+p[0]+'" cy="'+p[1]+'" r="3" style="fill:'+color+'"></circle><circle class="sg-curve-hit" cx="'+p[0]+'" cy="'+p[1]+'" r="12"></circle></g>'}).join('');return '<path class="sg-curve-line" d="'+curvePath(pts)+'" style="stroke:'+color+'"></path>'+dots}).join(''),legend=series.map(s=>'<span><i style="background:'+centerColor(s.name)+'"></i>'+s.name.replace(' Service Center',' SC').replace(' Center','')+'</span>').join('');return '<div class="sg-curve-chart"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img"><g class="sg-curve-grid">'+grid+'</g>'+axes+curves+'</svg><div class="sg-curve-legend">'+legend+'</div></div>'}
  function installChartTooltip(){if(root.dataset.chartTooltipReady)return;root.dataset.chartTooltipReady='true';let tip=document.querySelector('.sg-chart-tooltip');if(!tip){tip=document.createElement('div');tip.className='sg-chart-tooltip';document.body.appendChild(tip)}root.addEventListener('pointermove',e=>{const point=e.target.closest&&e.target.closest('.sg-curve-point');if(!point){tip.classList.remove('show');return}const parts=(point.dataset.chartTip||'').split('|');tip.replaceChildren();const strong=document.createElement('strong');strong.textContent=parts.shift()||'';tip.appendChild(strong);parts.forEach(x=>{const span=document.createElement('span');span.textContent=x;tip.appendChild(span)});tip.style.left=Math.min(window.innerWidth-230,e.clientX+14)+'px';tip.style.top=Math.min(window.innerHeight-80,e.clientY+14)+'px';tip.classList.add('show')});root.addEventListener('pointerleave',()=>tip.classList.remove('show'))}
  installChartTooltip();
  function renderCenters() {
    const labels = {good:'Ổn định',watch:'Cần theo dõi',action:'Cần hành động'};
    const cs = live.centers;
    const pct = function(value) { return value === null || value === undefined ? '—' : Math.round(value * 100) + '%'; };
    q('#sg-center-summary').innerHTML = [['Center đang theo dõi',cs.length,'center'],['Tiếp nhận trong kỳ',live.summary.received,'thiết bị'],['Đã giao trong kỳ',live.summary.returned,'thiết bị'],['Đạt SLA 7 ngày',live.summary.slaRate===null||live.summary.slaRate===undefined?'—':Math.round(live.summary.slaRate*100)+'%','thiết bị đã trả'],['Đang mở quá SLA',live.summary.slaBreachedOpen||0,'thiết bị cần can thiệp']].map(function(x) { return '<div class="sg-center-summary-item"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><span>' + x[2] + '</span></div>'; }).join('');
    q('#sg-center-health-grid').innerHTML = cs.map(function(x) {
      const label = x.lowVolume && x.status !== 'action' ? 'Mẫu nhỏ' : labels[x.status];
      return '<article class="sg-center-card"><div class="sg-center-card-head"><h3>' + esc(x.center) + '</h3><span class="sg-health-label ' + x.status + '">' + label + '</span></div><div class="sg-center-card-metrics"><div><span>Tiếp nhận</span><strong>' + x.received + '</strong></div><div><span>Ra/vào</span><strong>' + pct(x.outflowInflowRatio) + '</strong></div><div><span>Tồn cuối</span><strong>' + x.open + '</strong></div><div><span>SLA 7 ngày</span><strong>' + pct(x.slaRate) + '</strong></div></div><div class="sg-center-card-reason">' + esc(x.reason) + '</div></article>';
    }).join('');
    q('#sg-center-month-table').className = 'sg-center-curve';
    const comparable=cs.filter(function(x){return x.received>=5;}),profiles=comparable.map(function(x){const flow=Math.min(100,(x.outflowInflowRatio||0)*100),control=Math.max(0,100-(x.overdueRate||0)*100),sla=x.slaRate===null||x.slaRate===undefined?(x.medianDays===null?0:Math.max(0,100-Math.max(0,x.medianDays-7)*12.5)):x.slaRate*100;return {name:x.center,values:[flow,control,sla,x.coverage||0]};}),excluded=cs.length-comparable.length;
    q('#sg-center-month-table').innerHTML = curveChart(profiles,['Ra/vào','Không quá hạn','SLA 7 ngày','Dữ liệu đủ'],100,'%')+'<div class="sg-chart-definition">'+(excluded?excluded+' center chưa đủ mẫu (&lt;5 thiết bị) · ':'')+'Số tuyệt đối nằm trên thẻ center.</div>';
    const colors = ['#ff7900','#606060','#9a9a9a','#c4c4c4'];
    q('#sg-center-trend-legend').innerHTML = '';
    const trendLabels=live.trends.map(function(m){return m.label;}),trendSeries=cs.map(function(c){return {name:c.center,values:live.trends.map(function(m){return m.values[c.center]||0;})};}),max=Math.max(1,...trendSeries.flatMap(function(s){return s.values;}));
    q('#sg-center-trend').innerHTML = curveChart(trendSeries,trendLabels,Math.ceil(max/5)*5,' thiết bị');
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
    google.accounts.id.initialize({client_id:cfg.googleClientId,callback:r => {token=r.credential;loadLive();}});
    google.accounts.id.renderButton(q('#sg-login-slot'),{theme:'outline',size:'small',text:'signin_with',locale:'vi'});
    status('Yêu cầu đăng nhập','Dữ liệu hiển thị sau khi xác thực');
  }

  const formatDate = value => value ? value.split('-').reverse().join('/') : '—';
  setPeriodLabels();
  ['#sg-center','#sg-period'].forEach(s => q(s).addEventListener('change',() => setTimeout(loadLive,0)));
  q('#sg-search').addEventListener('input',() => {if(live)setTimeout(renderTickets,0);});
  root.addEventListener('click',e => {if(live && e.target.closest('[data-part],[data-page]'))setTimeout(renderAll,0);});
  initGoogle();
})();
