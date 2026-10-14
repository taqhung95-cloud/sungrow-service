/* Exact lookup for update/transfer; fetch detail only for the selected case. */
window.SungrowExactSearch = (() => {
  const requests = {};
  const keyOf = value => String(value || '').trim().toLowerCase();
  const current = (target, request) => requests[target] === request && state.token === request.token;
  async function detail(caseId, target, mode, request) {
    if (request.detailBusy || !current(target, request)) return;
    request.detailBusy = true;
    const box = document.getElementById(target);
    const buttons = [...box.querySelectorAll('[data-case-id]')];
    buttons.forEach(button => busy(button, true));
    const loading = document.createElement('p');
    loading.textContent = 'Đang tải chi tiết hồ sơ…';
    loading.setAttribute('role', 'status');
    box.prepend(loading);
    try {
      const item = await call('getCaseDetail', [request.token, caseId]);
      if (current(target, request)) box.innerHTML = renderCase(item, mode, 1);
    } catch (error) {
      if (current(target, request)) {
        loading.textContent = error.message;
        loading.className = 'notice error';
        if (!buttons.length) {
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'secondary';
          retry.textContent = 'Thử lại';
          retry.onclick = () => { loading.remove(); retry.remove(); detail(caseId, target, mode, request); };
          box.append(retry);
        }
      }
    } finally {
      request.detailBusy = false;
      buttons.forEach(button => busy(button, false));
    }
  }
  async function search(query, target, mode) {
    const box = document.getElementById(target);
    const button = document.getElementById(mode === 'update' ? 'updateSearch' : 'transferSearch');
    const key = keyOf(query);
    if (key.length < 2) {
      // Invalidate any previous response even for invalid new input.
      requests[target] = null;
      busy(button, false);
      box.innerHTML = '<div class="notice error">Nhập đầy đủ S/N hoặc mã hồ sơ (ít nhất 2 ký tự).</div>';
      return;
    }
    if ((requests[target]?.busy || requests[target]?.detailBusy) && requests[target].key === key) return;
    const request = { key, token: state.token, busy: true };
    requests[target] = request;
    busy(button, true);
    box.innerHTML = '<div class="empty">Đang tìm hồ sơ…</div>';
    try {
      const rows = [];
      let page = 1, totalPages = 1;
      do {
        let data = await call('searchCases', [request.token, key, { exactKey: true, page, pageSize: 200 }]);
        if (!current(target, request)) return;
        if (Array.isArray(data)) {
          // Compatibility until Apps Script is upgraded; old API caps results at 20.
          // Use all index pages so an exact match cannot disappear beyond that cap.
          const oldDetails = new Map(data.map(item => [item.caseId, item]));
          data = await call('listCases', [request.token, { query: key, exactKey: true, page, pageSize: 200 }]);
          if (!current(target, request)) return;
          data.items = data.items.map(item => oldDetails.has(item.caseId) ? { ...oldDetails.get(item.caseId), searchDetailLoaded: true } : item);
        } else if (data.detailed) {
          data.items = data.items.map(item => ({ ...item, searchDetailLoaded: true }));
        }
        rows.push(...data.items.filter(item => keyOf(item.caseId) === key || keyOf(item.serialNumber) === key));
        totalPages = data.totalPages || 1;
        page++;
      } while (page <= totalPages);
      if (!rows.length) {
        box.innerHTML = '<div class="empty">Không tìm thấy hồ sơ có S/N hoặc mã hồ sơ này.</div>';
      } else if (rows.length === 1) {
        if (rows[0].searchDetailLoaded) box.innerHTML = renderCase(rows[0], mode, 1);
        else await detail(rows[0].caseId, target, mode, request);
      } else {
        box.innerHTML = '<p>Có nhiều lần tiếp nhận cùng S/N. Chọn hồ sơ cần thao tác:</p>' + rows.map(item =>
          '<article class="result"><strong>' + esc(item.model || '--') + '</strong><p>S/N: ' + esc(item.serialNumber || '--') + '</p><p>Ngày nhận: ' + esc(item.receivedAt || '--') +
          ' | Center: ' + esc(shortCenter(item.currentCenter)) + ' | ' + esc(item.caseStatus || '--') +
          '</p><button type="button" class="secondary" data-case-id="' + esc(item.caseId) + '">Chọn hồ sơ</button></article>'
        ).join('');
        box.querySelectorAll('[data-case-id]').forEach(btn => { btn.onclick = () => detail(btn.dataset.caseId, target, mode, request); });
      }
    } catch (error) {
      if (current(target, request)) box.innerHTML = '<div class="notice error">' + esc(error.message) + '</div>';
    } finally {
      request.busy = false;
      if (current(target, request)) busy(button, false);
    }
  }
  return { search };
})();
