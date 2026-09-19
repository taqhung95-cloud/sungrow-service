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
    q('#sg-kpis').innerHTML = base.map(function(item) {
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
      return '<div class="sg-kpi"><div class="sg-kpi-head"><div class="sg-kpi-label">'+item.label+'</div>'+trendViz(p,item.value,tone)+'</div><div class="sg-kpi-value">'+item.value+' <small>'+item.unit+'</small></div><div class="sg-kpi-note">'+note+'</div></div>';
    }).join('');
    q('#sg-period-date').textContent = `${formatDate(live.period.start)}–${formatDate(live.period.asOf)}`;
    renderYearTrend();
    const max = Math.max(1, ...live.errors.map(x => x.count));
    q('#sg-errors').innerHTML = live.errors.map(x => `<div class="sg-error-line"><span class="sg-error-name" title="${esc(x.name)}">${esc(x.name)}</span><div class="sg-track"><i style="width:${100*x.count/max}%"></i></div><b>${x.count}</b></div>`).join('') || '<div class="sg-caption">Chưa có lỗi được ghi nhận trong kỳ.</div>';
    q('#sg-overview-table').innerHTML = attentionTable(live.tickets.filter(isOpen).sort((a,b) => b.ageDays-a.ageDays));
  }

  function renderYearTrend() {
    const totals = (Array.isArray(live.yearlyTotals) && live.yearlyTotals.length ? live.yearlyTotals : [live.annual || {}]).filter(x=>x.year).slice().sort((a,b)=>a.year-b.year);
    const cumulative = live.cumulative?.received ?? totals.reduce((sum,x)=>sum+(x.received||0),0);
    q('#sg-cumulative-received').textContent = cumulative.toLocaleString('vi-VN');
    q('#sg-year-trend-card').title = totals.map(x=>'Năm '+x.year+': '+x.received+' thiết bị').join(' · ') + ' · Tích lũy: ' + cumulative;
    q('#sg-year-values').textContent = totals.map((x,i)=>(String(x.year).slice(2)+(i===totals.length-1?' YTD ':' ')+Number(x.received||0).toLocaleString('vi-VN'))).join(' · ');
    const values = totals.map(x=>Number(x.received||0));
    const svg = q('#sg-year-sparkline');
    if (!values.length) { svg.querySelector('.sg-spark-line').setAttribute('points',''); return; }
    const width=112,height=30,padX=3,padY=4,max=Math.max(1,...values),min=Math.min(0,...values);
    const points = values.map((v,i)=>{const x=values.length===1?width/2:padX+i*(width-2*padX)/(values.length-1);const y=height-padY-(v-min)/(max-min||1)*(height-2*padY);return [x,y];});
    const pointText=points.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ');
    svg.querySelector('.sg-spark-line').setAttribute('points',pointText);
    svg.querySelector('.sg-spark-area').setAttribute('d','M '+points[0][0].toFixed(1)+' '+(height-padY)+' L '+pointText.replace(/ /g,' L ')+' L '+points[points.length-1][0].toFixed(1)+' '+(height-padY)+' Z');
    const last=points[points.length-1];svg.querySelector('.sg-spark-dot').setAttribute('cx',last[0]);svg.querySelector('.sg-spark-dot').setAttribute('cy',last[1]);
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
    q('#sg-model-bars').innerHTML = rows.map((x,i) => `<button class="sg-model-row ${/chưa/i.test(x.name)?'unknown':''}" aria-pressed="${i===0}"><span class="sg-model-name" title="${esc(x.name)}">${esc(x.name)}</span><span class="sg-model-track"><i style="width:${total?100*x.count/total:0}%"></i></span><span class="sg-model-value"><strong>${x.count}</strong>${total?(100*x.count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0}%</span></button>`).join('');
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
    q('#sg-part-metrics').innerHTML = '<div><span class="sg-caption">Đã dùng trong tháng</span><strong>' + total + ' <span class="sg-caption">chiếc</span></strong></div><div><span class="sg-caption">PN dùng nhiều nhất</span><strong>' + (top ? esc(top.pn) : '—') + ' <span class="sg-caption">' + topShare + '%</span></strong></div><div><span class="sg-caption">Tổng dùng năm ' + (annual.year || '') + '</span><strong>' + (annual.partsQuantity === undefined ? '—' : annual.partsQuantity) + ' <span class="sg-caption">chiếc</span></strong></div>';
    q('#sg-part-table').innerHTML = '<table><thead><tr><th>Part number</th><th>Tháng</th><th>Tỷ trọng tháng</th><th>Tổng năm</th><th>Cơ sở ngày</th></tr></thead><tbody>' + rows.map(function(x) { return '<tr><td class="sg-sn">' + esc(x.pn) + '</td><td>' + x.quantity + '</td><td><div class="sg-part-share"><span><i style="width:' + Math.round(x.share * 100) + '%"></i></span><b>' + Math.round(x.share * 100) + '%</b></div></td><td>' + (annualByPn[x.pn] === undefined ? '—' : annualByPn[x.pn]) + '</td><td>Check / Repair date</td></tr>'; }).join('') + '</tbody></table>';
    q('#sg-part-note').textContent = recommendation + ' Số lượng order cần đối chiếu thêm tồn kho, lead time và kế hoạch bảo trì.';
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

  function renderCenters() {
    const labels = {good:'Ổn định',watch:'Cần theo dõi',action:'Cần hành động'};
    const cs = live.centers;
    const pct = function(value) { return value === null || value === undefined ? '—' : Math.round(value * 100) + '%'; };
    q('#sg-center-summary').innerHTML = [['Center đang theo dõi',cs.length,'center'],['Tiếp nhận trong kỳ',live.summary.received,'thiết bị'],['Đã giao trong kỳ',live.summary.returned,'thiết bị'],['Đạt SLA 7 ngày',live.summary.slaRate===null||live.summary.slaRate===undefined?'—':Math.round(live.summary.slaRate*100)+'%','thiết bị đã trả'],['Đang mở quá SLA',live.summary.slaBreachedOpen||0,'thiết bị cần can thiệp']].map(function(x) { return '<div class="sg-center-summary-item"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><span>' + x[2] + '</span></div>'; }).join('');
    q('#sg-center-health-grid').innerHTML = cs.map(function(x) {
      const label = x.lowVolume && x.status !== 'action' ? 'Mẫu nhỏ' : labels[x.status];
      return '<button class="sg-center-card" aria-pressed="false"><div class="sg-center-card-head"><h3>' + esc(x.center) + '</h3><span class="sg-health-label ' + x.status + '">' + label + '</span></div><div class="sg-center-card-metrics"><div><span>Tiếp nhận</span><strong>' + x.received + '</strong></div><div><span>Ra/vào</span><strong>' + pct(x.outflowInflowRatio) + '</strong></div><div><span>Tồn cuối</span><strong>' + x.open + '</strong></div><div><span>SLA 7 ngày</span><strong>' + pct(x.slaRate) + '</strong></div></div><div class="sg-center-card-reason">' + esc(x.reason) + '</div></button>';
    }).join('');
    q('#sg-center-month-table').className = 'sg-table-wrap sg-center-month-table';
    q('#sg-center-month-table').innerHTML = '<table><thead><tr><th>Center</th><th>Nhận</th><th>Tỷ trọng</th><th>Ra/vào</th><th>Tồn cuối</th><th>Quá hạn</th><th>TAT / SLA 7 ngày</th><th>Dữ liệu đủ</th></tr></thead><tbody>' + cs.map(function(x) { return '<tr><td><strong>' + esc(x.center) + '</strong><span class="sg-small">' + esc(x.reason) + '</span></td><td>' + x.received + '</td><td>' + pct(x.volumeShare) + '</td><td>' + pct(x.outflowInflowRatio) + '</td><td>' + x.open + '</td><td>' + x.overdue + ' · ' + pct(x.overdueRate) + '</td><td>' + (x.medianDays===null?'—':x.medianDays+' ngày') + '<span class="sg-small">' + (x.slaRate===null?'Chưa đủ dữ liệu':pct(x.slaRate)+' đạt SLA · '+x.slaBreachedOpen+' đang quá SLA') + '</span></td><td>' + x.coverage + '%</td></tr>'; }).join('') + '</tbody></table>';
    const colors = ['#ff7900','#606060','#9a9a9a','#c4c4c4'];
    q('#sg-center-trend-legend').innerHTML = cs.map(function(x,i) { return '<span><i class="sg-dot" style="background:' + colors[i%colors.length] + '"></i>' + esc(x.center) + '</span>'; }).join('');
    const max = Math.max(1, ...live.trends.flatMap(function(m) { return cs.map(function(c) { return m.values[c.center] || 0; }); }));
    q('#sg-center-trend').innerHTML = live.trends.map(function(m) { return '<div class="sg-trend-month">' + cs.map(function(c) { return '<span class="sg-trend-bar" style="height:' + (100*(m.values[c.center]||0)/max) + '%"></span>'; }).join('') + '<span class="sg-trend-month-label">' + m.label + '</span></div>'; }).join('');
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
