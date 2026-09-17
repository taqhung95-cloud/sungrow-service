(() => {
  const cfg = window.SUNGROW_CONFIG || {};
  const root = document.getElementById('sg-preview');
  if (!root) return;
  const q = s => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let token = '';
  let live = null;

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
      if (!result.ok) throw new Error(result.error?.message || 'API error');
      live = result.data;
      renderAll();
      const updated = new Date(live.source.sourceUpdatedAt).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      status('Đã đồng bộ', `${live.source.sheetName} · ${updated}`, 'ok');
    } catch (error) {
      status('Lỗi đồng bộ', error.message || 'Không đọc được dữ liệu', 'error');
    }
  }

  function renderAll() {
    renderOverview();
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
    const values = [s.received, s.processing, s.waitingDelivery, s.returned];
    const labels = ['Tiếp nhận trong kỳ','Đang xử lý','Chờ giao','Đã trả trong kỳ'];
    const notes = [`Đến ${formatDate(live.period.asOf)}`,'Gồm phiếu kỳ trước','Trạng thái hiện tại','Theo ngày trả máy'];
    q('#sg-kpis').innerHTML = values.map((v,i) => `<div class="sg-kpi"><div class="sg-kpi-label">${labels[i]}</div><div class="sg-kpi-value">${v} <small>phiếu</small></div><div class="sg-kpi-note">${notes[i]}</div></div>`).join('');
    q('#sg-period-date').textContent = `${formatDate(live.period.start)}–${formatDate(live.period.asOf)}`;
    const max = Math.max(1, ...live.errors.map(x => x.count));
    q('#sg-errors').innerHTML = live.errors.slice(0,5).map(x => `<div class="sg-error-line"><span>${esc(x.name)}</span><div class="sg-track"><i style="width:${100*x.count/max}%"></i></div><b>${x.count}</b></div>`).join('') || '<div class="sg-caption">Chưa có lỗi được ghi nhận trong kỳ.</div>';
    q('#sg-overview-table').innerHTML = ticketTable(live.tickets.filter(isOpen).slice(0,5));
  }

  function isOpen(t) { return !/đã\s*giao/i.test(t.deliveryStatus || '') && !t.returnDate; }
  function ticketTable(rows) {
    return '<table><thead><tr><th>Thiết bị / Phiếu</th><th>Lỗi ghi nhận</th><th>Trung tâm</th><th>Trạng thái</th><th>Tuổi phiếu</th></tr></thead><tbody>' + rows.map(t => `<tr><td><span class="sg-sn">${esc(t.model || t.deviceType || 'Chưa xác định')}</span><span class="sg-small">${esc(t.serialNumber || t.id)}</span></td><td>${esc(t.error)}</td><td>${esc(t.center)}</td><td><span class="sg-status">${esc(t.deliveryStatus || t.warrantyStatus || 'Chưa cập nhật')}</span></td><td class="sg-age ${t.ageDays>14?'old':''}">${t.ageDays>=0?t.ageDays+' ngày':'—'}</td></tr>`).join('') + (rows.length?'':'<tr><td colspan="5">Không có dữ liệu phù hợp.</td></tr>') + '</tbody></table>';
  }

  function renderTickets() {
    const term = (q('#sg-search').value || '').trim().toLowerCase();
    const center = q('#sg-center').value;
    let rows = live.tickets.filter(t => center === 'all' || t.center === center);
    if (term) rows = rows.filter(t => [t.id,t.sourceNo,t.serialNumber,t.model].join(' ').toLowerCase().includes(term));
    q('#sg-tickets-table').innerHTML = ticketTable(rows);
    q('#sg-result-count').textContent = `${rows.length} phiếu · dữ liệu từ tab ${live.source.sheetName}`;
  }

  function renderModels() {
    const rows = live.models;
    const total = rows.reduce((n,x) => n+x.count, 0);
    q('#sg-model-total').textContent = `${total} lượt · ${rows.length} nhóm model`;
    q('#sg-model-bars').innerHTML = rows.map((x,i) => `<button class="sg-model-row ${/chưa/i.test(x.name)?'unknown':''}" aria-pressed="${i===0}"><span class="sg-model-name">${esc(x.name)}</span><span class="sg-model-track"><i style="width:${total?100*x.count/total:0}%"></i></span><span class="sg-model-value"><strong>${x.count}</strong>${total?(100*x.count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0}%</span></button>`).join('');
    q('#sg-model-denominator').textContent = `Mẫu số: ${total} lượt tiếp nhận · ${live.period.label}.`;
    if (rows[0]) q('#sg-model-insight').innerHTML = `<div class="sg-caption">MODEL NHIỀU NHẤT</div><h3>${esc(rows[0].name)}</h3><div class="sg-model-selected-number">${total?(100*rows[0].count/total).toLocaleString('vi-VN',{maximumFractionDigits:1}):0}% <small>tỷ trọng tiếp nhận</small></div><div class="sg-caption">${rows[0].count} lượt trong kỳ đang chọn.</div>`;
  }

  function renderParts() {
    const total = live.parts.reduce((n,x) => n+x.quantity, 0);
    q('#sg-part-metrics').innerHTML = `<div><span class="sg-caption">Theo ngày Check / Repair</span><strong>${total} <span class="sg-caption">chiếc</span></strong></div><div><span class="sg-caption">Mã linh kiện</span><strong>${live.parts.length}</strong></div>`;
    q('#sg-part-table').innerHTML = '<table><thead><tr><th>Part number</th><th>Số lượng</th><th>Cơ sở ngày</th></tr></thead><tbody>' + live.parts.map(x => `<tr><td class="sg-sn">${esc(x.pn)}</td><td>${x.quantity}</td><td>Check / Repair date</td></tr>`).join('') + '</tbody></table>';
    q('#sg-part-note').textContent = 'Sheet chưa có UsedDate riêng; số liệu tạm dùng Check / Repair date và được gắn nhãn rõ.';
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
    q('#sg-center-summary').innerHTML = [['Center đang theo dõi',cs.length,'center'],['Tiếp nhận trong kỳ',live.summary.received,'phiếu'],['Hoàn tất trong kỳ',live.summary.returned,'phiếu'],['Phiếu mở quá hạn',live.summary.overdue,'phiếu cần can thiệp']].map(x => `<div class="sg-center-summary-item"><span>${x[0]}</span><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
    q('#sg-center-health-grid').innerHTML = cs.map(x => `<button class="sg-center-card" aria-pressed="false"><div class="sg-center-card-head"><h3>${esc(x.center)}</h3><span class="sg-health-label ${x.status}">${labels[x.status]}</span></div><div class="sg-center-card-metrics"><div><span>Tồn cuối kỳ</span><strong>${x.open}</strong></div><div><span>Thay đổi tồn</span><strong class="sg-delta ${x.delta>0?'up':'down'}">${x.delta>0?'+':''}${x.delta}</strong></div><div><span>Quá hạn</span><strong>${x.overdue}</strong></div><div><span>Chờ part</span><strong>${x.waitingParts}</strong></div></div><div class="sg-center-card-reason">${esc(x.reason)}</div></button>`).join('');
    q('#sg-center-month-table').className = 'sg-table-wrap sg-center-month-table';
    q('#sg-center-month-table').innerHTML = '<table><thead><tr><th>Center</th><th>Nhận</th><th>Hoàn tất</th><th>Tồn cuối</th><th>Δ tồn</th><th>Quá hạn</th><th>Trung vị</th><th>Dữ liệu đủ</th></tr></thead><tbody>' + cs.map(x => `<tr><td><strong>${esc(x.center)}</strong><span class="sg-small">${labels[x.status]}</span></td><td>${x.received}</td><td>${x.completed}</td><td>${x.open}</td><td>${x.delta>0?'+':''}${x.delta}</td><td>${x.overdue}</td><td>${x.medianDays===null?'—':x.medianDays+' ngày'}</td><td>${x.coverage}%</td></tr>`).join('') + '</tbody></table>';
    const colors = ['#ff7900','#606060','#9a9a9a','#c4c4c4'];
    q('#sg-center-trend-legend').innerHTML = cs.map((x,i) => `<span><i class="sg-dot" style="background:${colors[i%colors.length]}"></i>${esc(x.center)}</span>`).join('');
    const max = Math.max(1, ...live.trends.flatMap(m => cs.map(c => m.values[c.center] || 0)));
    q('#sg-center-trend').innerHTML = live.trends.map(m => `<div class="sg-trend-month">${cs.map(c => `<span class="sg-trend-bar" style="height:${100*(m.values[c.center]||0)/max}%"></span>`).join('')}<span class="sg-trend-month-label">${m.label}</span></div>`).join('');
    if (cs[0]) q('#sg-center-detail').innerHTML = `<div class="sg-caption">NGUỒN DỮ LIỆU</div><h3>${esc(live.source.sheetName)}</h3><div class="sg-detail-block"><strong>Tình trạng đồng bộ</strong><p>Đọc thành công ${live.source.rowCount} dòng trong phạm vi quyền.</p></div><div class="sg-detail-block"><strong>Chất lượng dữ liệu</strong><p>${cs[0].coverage}% trường chính đã đủ trong kỳ.</p></div>`;
  }

  function setPeriodLabels() {
    const current = cfg.defaultPeriod || new Date().toISOString().slice(0,7);
    const d = new Date(current+'-01T00:00:00');
    const prev = new Date(d.getFullYear(),d.getMonth()-1,1);
    const keys = [current,`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`];
    [...q('#sg-period').options].forEach((o,i) => {o.dataset.livePeriod=keys[i];o.textContent=`Tháng ${keys[i].slice(5)}/${keys[i].slice(0,4)}`;});
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
