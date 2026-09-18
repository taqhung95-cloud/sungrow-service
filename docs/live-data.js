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
        const previousBody = new URLSearchParams({payload: JSON.stringify({action:'dashboard.read', idToken:token, period:previousPeriod, center:q('#sg-center').value})});
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
    const values = [s.received, s.waitingDelivery + s.returned, s.waitingDelivery, s.returned];
    const previousValues = ps ? [ps.received, ps.waitingDelivery + ps.returned, ps.waitingDelivery, ps.returned] : [null,null,null,null];
    const labels = ['Thiết bị tiếp nhận','Thiết bị đã xử lý','Thiết bị chờ giao','Thiết bị đã giao'];
    const lowerIsBetter = [false,false,true,false];
    q('#sg-kpis').innerHTML = values.map((v,i) => {
      const p = previousValues[i];
      const delta = p === null ? null : v - p;
      const better = delta === 0 ? null : (lowerIsBetter[i] ? delta < 0 : delta > 0);
      const tone = better === null ? 'neutral' : better ? 'good' : 'bad';
      const change = delta === null ? 'Chưa có tháng trước' : (delta === 0 ? 'Không đổi' : (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta));
      const note = p === null ? change : 'Tháng trước: ' + p + ' <span class="sg-kpi-change ' + tone + '">' + change + '</span>';
      return '<div class="sg-kpi"><div class="sg-kpi-label">' + labels[i] + '</div><div class="sg-kpi-value">' + v + ' <small>thiết bị</small></div><div class="sg-kpi-note">' + note + '</div></div>';
    }).join('');
    q('#sg-period-date').textContent = `${formatDate(live.period.start)}–${formatDate(live.period.asOf)}`;
    const max = Math.max(1, ...live.errors.map(x => x.count));
    q('#sg-errors').innerHTML = live.errors.map(x => `<div class="sg-error-line"><span class="sg-error-name" title="${esc(x.name)}">${esc(x.name)}</span><div class="sg-track"><i style="width:${100*x.count/max}%"></i></div><b>${x.count}</b></div>`).join('') || '<div class="sg-caption">Chưa có lỗi được ghi nhận trong kỳ.</div>';
    q('#sg-overview-table').innerHTML = attentionTable(live.tickets.filter(isOpen).sort((a,b) => b.ageDays-a.ageDays));
  }

  function isOpen(t) { return !/đã\s*giao/i.test(t.deliveryStatus || '') && !t.returnDate; }
  function attentionTable(rows) {
    return '<table><thead><tr><th>Thiết bị</th><th>Center</th><th>Trạng thái</th><th>Ngày</th></tr></thead><tbody>' + rows.map(function(t) {
      return '<tr><td><span class="sg-sn">' + esc(t.model || t.deviceType || 'Chưa xác định') + '</span><span class="sg-small">' + esc(t.serialNumber || t.id) + '</span></td><td>' + esc(t.center) + '</td><td><span class="sg-status">' + esc(t.deliveryStatus || t.warrantyStatus || 'Chưa cập nhật') + '</span></td><td class="sg-age ' + (t.ageDays>14?'old':'') + '">' + (t.ageDays>=0?t.ageDays+' ngày':'—') + '</td></tr>';
    }).join('') + (rows.length?'':'<tr><td colspan="4">Không có thiết bị cần theo dõi.</td></tr>') + '</tbody></table>';
  }

  function ticketTable(rows) {
    return '<table><thead><tr><th>Thiết bị / Thiết bị</th><th>Lỗi ghi nhận</th><th>Trung tâm</th><th>Trạng thái</th><th>Tuổi thiết bị</th></tr></thead><tbody>' + rows.map(t => `<tr><td><span class="sg-sn">${esc(t.model || t.deviceType || 'Chưa xác định')}</span><span class="sg-small">${esc(t.serialNumber || t.id)}</span></td><td>${esc(t.error)}</td><td>${esc(t.center)}</td><td><span class="sg-status">${esc(t.deliveryStatus || t.warrantyStatus || 'Chưa cập nhật')}</span></td><td class="sg-age ${t.ageDays>14?'old':''}">${t.ageDays>=0?t.ageDays+' ngày':'—'}</td></tr>`).join('') + (rows.length?'':'<tr><td colspan="5">Không có dữ liệu phù hợp.</td></tr>') + '</tbody></table>';
  }

  function renderMonthlyComparison() {
    const grid = q('#sg-month-compare-grid');
    const table = q('#sg-month-center-table');
    if (!grid || !table) return;
    if (!previousLive) {
      q('#sg-compare-period').textContent = 'Không tải được dữ liệu tháng trước';
      q('#sg-system-trend').className = 'sg-trend-badge neutral';
      q('#sg-system-trend').textContent = 'Chưa đánh giá';
      grid.innerHTML = '<div class="sg-caption">Dashboard vẫn hiển thị tháng hiện tại; cần quyền đọc tab của tháng trước để so sánh.</div>';
      table.innerHTML = '';
      return;
    }
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
    const previousByCenter = Object.fromEntries(previousLive.centers.map(function(x){ return [x.center,x]; }));
    const deltaHtml = function(current, previous, lowerIsBetter, suffix) {
      if (previous === null || previous === undefined || current === null || current === undefined) return '<span class="sg-cell-delta neutral">Chưa có kỳ trước</span>';
      const delta = current - previous;
      const tone = delta === 0 ? 'neutral' : (lowerIsBetter ? delta < 0 : delta > 0) ? 'good' : 'bad';
      const text = delta === 0 ? 'Không đổi' : (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta) + (suffix || '');
      return '<span class="sg-cell-delta ' + tone + '">' + text + '</span>';
    };
    table.innerHTML = '<table><thead><tr><th>Center</th><th>Tiếp nhận</th><th>Đã giao</th><th>Tồn cuối</th><th>Quá hạn</th><th>TAT</th><th>Xu hướng</th></tr></thead><tbody>' + live.centers.map(function(x) {
      const p = previousByCenter[x.center] || {};
      const openDelta = p.open === undefined ? null : x.open - p.open;
      const lateDelta = p.overdue === undefined ? null : x.overdue - p.overdue;
      const tone = openDelta === null ? 'neutral' : openDelta < 0 && lateDelta <= 0 ? 'good' : openDelta > 0 || lateDelta > 0 ? 'bad' : 'neutral';
      const label = openDelta === null ? 'Chưa có nền' : tone === 'good' ? 'Cải thiện' : tone === 'bad' ? 'Cần chú ý' : 'Ổn định';
      const tat = x.medianDays === null ? '—' : x.medianDays + ' ngày';
      return '<tr><td><strong>' + esc(x.center) + '</strong></td><td><strong>' + x.received + '</strong>' + deltaHtml(x.received,p.received,false,'') + '</td><td><strong>' + x.completed + '</strong>' + deltaHtml(x.completed,p.completed,false,'') + '</td><td><strong>' + x.open + '</strong>' + deltaHtml(x.open,p.open,true,'') + '</td><td><strong>' + x.overdue + '</strong>' + deltaHtml(x.overdue,p.overdue,true,'') + '</td><td><strong>' + tat + '</strong>' + deltaHtml(x.medianDays,p.medianDays,true,' ngày') + '</td><td><span class="sg-trend-badge ' + tone + '">' + label + '</span></td></tr>';
    }).join('') + '</tbody></table>';
    q('#sg-compare-note').textContent = 'Khối lượng tiếp nhận mô tả tải công việc và không dùng để xếp hạng center. Nếu tháng đang chọn chưa kết thúc, biến động chỉ là tín hiệu vận hành tạm thời.';
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
    const total = live.parts.reduce((n,x) => n+x.quantity, 0);
    q('#sg-part-metrics').innerHTML = `<div><span class="sg-caption">Theo ngày Check / Repair</span><strong>${total} <span class="sg-caption">chiếc</span></strong></div><div><span class="sg-caption">Mã linh kiện</span><strong>${live.parts.length}</strong></div>`;
    q('#sg-part-table').innerHTML = '<table><thead><tr><th>Part number</th><th>Số lượng</th><th>Cơ sở ngày</th></tr></thead><tbody>' + live.parts.map(x => `<tr><td class="sg-sn">${esc(x.pn)}</td><td>${x.quantity}</td><td>Check / Repair date</td></tr>`).join('') + '</tbody></table>';
    q('#sg-part-note').textContent = 'Giai đoạn 1 chỉ tính linh kiện ghi nhận trong thiết bị sửa chữa theo Check / Repair date; chưa đọc hoặc đối soát dữ liệu từ sheet CCVT.';
    const overviewMetrics = q('#sg-overview-part-metrics');
    const overviewTable = q('#sg-overview-part-table');
    if (overviewMetrics) overviewMetrics.innerHTML = '<strong>' + total + '</strong><span>linh kiện đã thay · ' + live.parts.length + ' mã</span>';
    if (overviewTable) overviewTable.innerHTML = '<table><thead><tr><th>Part number</th><th>SL</th></tr></thead><tbody>' + live.parts.map(x => '<tr><td class="sg-sn">' + esc(x.pn) + '</td><td>' + x.quantity + '</td></tr>').join('') + '</tbody></table>';

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
    q('#sg-center-summary').innerHTML = [['Center đang theo dõi',cs.length,'center'],['Tiếp nhận trong kỳ',live.summary.received,'thiết bị'],['Đã giao trong kỳ',live.summary.returned,'thiết bị'],['Thiết bị mở quá hạn',live.summary.overdue,'thiết bị cần can thiệp']].map(x => `<div class="sg-center-summary-item"><span>${x[0]}</span><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
    q('#sg-center-health-grid').innerHTML = cs.map(x => `<button class="sg-center-card" aria-pressed="false"><div class="sg-center-card-head"><h3>${esc(x.center)}</h3><span class="sg-health-label ${x.status}">${labels[x.status]}</span></div><div class="sg-center-card-metrics"><div><span>Tồn cuối kỳ</span><strong>${x.open}</strong></div><div><span>Thay đổi tồn</span><strong class="sg-delta ${x.delta>0?'up':'down'}">${x.delta>0?'+':''}${x.delta}</strong></div><div><span>Quá hạn</span><strong>${x.overdue}</strong></div><div><span>Chờ part</span><strong>${x.waitingParts}</strong></div></div><div class="sg-center-card-reason">${esc(x.reason)}</div></button>`).join('');
    q('#sg-center-month-table').className = 'sg-table-wrap sg-center-month-table';
    q('#sg-center-month-table').innerHTML = '<table><thead><tr><th>Center</th><th>Nhận</th><th>Đã giao</th><th>Tồn cuối</th><th>Δ tồn</th><th>Quá hạn</th><th>Trung vị</th><th>Dữ liệu đủ</th></tr></thead><tbody>' + cs.map(x => `<tr><td><strong>${esc(x.center)}</strong><span class="sg-small">${labels[x.status]}</span></td><td>${x.received}</td><td>${x.completed}</td><td>${x.open}</td><td>${x.delta>0?'+':''}${x.delta}</td><td>${x.overdue}</td><td>${x.medianDays===null?'—':x.medianDays+' ngày'}</td><td>${x.coverage}%</td></tr>`).join('') + '</tbody></table>';
    const colors = ['#ff7900','#606060','#9a9a9a','#c4c4c4'];
    q('#sg-center-trend-legend').innerHTML = cs.map((x,i) => `<span><i class="sg-dot" style="background:${colors[i%colors.length]}"></i>${esc(x.center)}</span>`).join('');
    const max = Math.max(1, ...live.trends.flatMap(m => cs.map(c => m.values[c.center] || 0)));
    q('#sg-center-trend').innerHTML = live.trends.map(m => `<div class="sg-trend-month">${cs.map(c => `<span class="sg-trend-bar" style="height:${100*(m.values[c.center]||0)/max}%"></span>`).join('')}<span class="sg-trend-month-label">${m.label}</span></div>`).join('');
    if (cs[0]) q('#sg-center-detail').innerHTML = `<div class="sg-caption">NGUỒN DỮ LIỆU</div><h3>${esc(live.source.sheetName)}</h3><div class="sg-detail-block"><strong>Tình trạng đồng bộ</strong><p>Đọc thành công ${live.source.rowCount} dòng trong phạm vi quyền.</p></div><div class="sg-detail-block"><strong>Chất lượng dữ liệu</strong><p>${cs[0].coverage}% trường chính đã đủ trong kỳ.</p></div>`;
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
