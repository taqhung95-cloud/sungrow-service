/* Layout-only enhancements. No API calls, authentication, or business-data changes. */
(() => {
  const root = document.getElementById('sg-preview');
  const entry = document.getElementById('appView');
  const scope = root || entry;
  if (!scope) return;
  const media = window.matchMedia('(max-width: 760px)');
  const side = scope.querySelector(root ? '.sg-side' : '.sidebar');
  let trigger, backdrop, menuOpen = false;
  const button = (label, cls) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = cls; el.textContent = label;
    return el;
  };
  const isEmbedded = !root && document.documentElement.classList.contains('embedded');
  if (side && !isEmbedded) {
    const top = root ? root.querySelector('.sg-top') : document.createElement('div');
    if (!root) {
      top.className = 'mobile-entry-header';
      scope.querySelector('.workspace').prepend(top);
      const title = document.createElement('span'); title.textContent = 'SUNGROW · Nhập liệu'; top.append(title);
    }
    side.id = root ? 'sg-mobile-navigation' : 'entry-mobile-navigation';
    side.setAttribute('aria-label', 'Điều hướng hệ thống');
    trigger = button('☰', 'mobile-menu-toggle');
    trigger.setAttribute('aria-label', 'Mở menu điều hướng');
    trigger.setAttribute('aria-controls', side.id);
    trigger.setAttribute('aria-expanded', 'false'); top.prepend(trigger);
    const close = button('× Đóng menu', 'mobile-menu-close'); side.prepend(close);
    backdrop = button('', 'mobile-menu-backdrop'); backdrop.hidden = true;
    backdrop.tabIndex = -1; backdrop.setAttribute('aria-label', 'Đóng menu'); scope.append(backdrop);
    const setMenu = (open, restore = true) => {
      menuOpen = open && media.matches;
      scope.classList.toggle('mobile-menu-open', menuOpen);
      document.body.classList.toggle('mobile-menu-lock', menuOpen);
      backdrop.hidden = !menuOpen;
      trigger.setAttribute('aria-expanded', String(menuOpen));
      side.inert = media.matches && !menuOpen;
      if (menuOpen) close.focus(); else if (restore) trigger.focus();
    };
    trigger.addEventListener('click', () => setMenu(!menuOpen));
    close.addEventListener('click', () => setMenu(false));
    backdrop.addEventListener('click', () => setMenu(false));
    side.addEventListener('click', event => {
      if (media.matches && event.target.closest('[data-page],[data-portal-view],[data-view],.sg-signout')) setMenu(false);
    });
    document.addEventListener('keydown', event => {
      if (!menuOpen) return;
      if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
      if (event.key === 'Tab') {
        const items = [...side.querySelectorAll('button,a,input,select,[tabindex]')]
          .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    media.addEventListener('change', () => setMenu(false, false));
    setMenu(false, false);
  }
  if (root) {
    const panel = root.querySelector('.sg-filter-panel');
    const toggle = button('Bộ lọc', 'mobile-filter-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    panel.id = 'sg-mobile-filters'; toggle.setAttribute('aria-controls', panel.id);
    panel.before(toggle);
    const summary = document.createElement('div'); summary.className = 'mobile-filter-summary';
    root.querySelector('.sg-top').append(summary);
    const updateSummary = () => {
      const year = root.querySelector('#sg-period-year');
      const month = root.querySelector('#sg-period-month');
      const center = root.querySelector('#sg-center');
      const selected = el => el?.selectedOptions?.[0]?.textContent || '';
      const value = [year?.value, selected(month), selected(center)].filter(Boolean).join(' · ');
      if (summary.textContent !== value) summary.textContent = value;
    };
    toggle.addEventListener('click', () => {
      const open = root.classList.toggle('mobile-filters-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    root.addEventListener('change', updateSummary); updateSummary();
    new MutationObserver(updateSummary).observe(panel, {childList:true,subtree:true});
  } else {
    // The desktop header sort stays authoritative. Mobile proxy uses its existing handler.
    const sort = scope.querySelector('#caseDateSort');
    if (sort) {
      const proxy = button(sort.textContent, 'secondary mobile-case-sort');
      proxy.title = sort.title;
      scope.querySelector('.filters').after(proxy);
      proxy.addEventListener('click', () => sort.click());
      const syncSortFocus = () => { sort.tabIndex = media.matches ? -1 : 0; };
      syncSortFocus(); media.addEventListener('change', syncSortFocus);
      new MutationObserver(() => { proxy.textContent = sort.textContent; proxy.title = sort.title; })
        .observe(sort, {childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['title']});
    }
  }
  // Keep Overview short on phones without dropping data or requesting another snapshot.
  const previewLimits = new WeakMap();
  let centerSequence = 0;
  const compactOverview = () => {
    if (!root) return;
    root.querySelectorAll('#sg-overview .sg-compare-list-row').forEach(row => {
      const cells = [...row.children];
      if (cells.length < 6) return;
      let toggle = cells[0].querySelector('.mobile-center-expand');
      if (!toggle) {
        row.id = 'mobile-center-' + (++centerSequence);
        toggle = button('', 'mobile-center-expand');
        toggle.setAttribute('aria-controls', row.id);
        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', () => {
          const open = row.classList.toggle('mobile-center-open');
          toggle.setAttribute('aria-expanded', String(open));
        });
        cells[0].append(toggle);
      }
      const text = 'Tồn cuối: ' + (cells[3].querySelector('strong')?.textContent || '—') +
        ' · Quá hạn: ' + (cells[4].querySelector('strong')?.textContent || '—') + ' ▾';
      if (toggle.textContent !== text) toggle.textContent = text;
      toggle.title = 'Mở/thu gọn chi tiết KPI của ' + (cells[0].querySelector('strong')?.textContent || 'center');
    });
    root.querySelectorAll('#sg-overview .sg-attention-list-body,#sg-overview .sg-model-list-body,#sg-overview .sg-error-list-body,#sg-overview .sg-part-list-body').forEach(body => {
      const rows = [...body.children];
      let controls = body.nextElementSibling;
      if (!controls?.classList.contains('mobile-preview-controls')) {
        controls = document.createElement('div'); controls.className = 'mobile-preview-controls';
        const count = document.createElement('span'); count.className = 'mobile-preview-count';
        const more = button('Xem thêm', 'mobile-preview-more');
        const less = button('Thu gọn', 'mobile-preview-less');
        more.addEventListener('click', () => {previewLimits.set(body, (previewLimits.get(body)||5)+5);compactOverview();});
        less.addEventListener('click', () => {previewLimits.set(body,5);compactOverview();body.parentElement.scrollIntoView({block:'start'});});
        controls.append(count,more,less); body.after(controls);
      }
      const limit = previewLimits.get(body)||5;
      rows.forEach((row,index) => row.classList.toggle('mobile-preview-hidden', index>=limit));
      const text = Math.min(limit,rows.length) + '/' + rows.length + ' mục trong danh sách hiện có';
      const count = controls.querySelector('.mobile-preview-count');
      if (count.textContent !== text) count.textContent = text;
      controls.querySelector('.mobile-preview-more').hidden = limit>=rows.length;
      controls.querySelector('.mobile-preview-less').hidden = limit<=5;
      controls.hidden = rows.length<=5;
    });
  };
  // Reuse the same paged rows and actions; labels follow their actual column headers.
  const labelRows = () => {
    compactOverview();
    scope.querySelectorAll(root ? '.sg-device-table' : '.case-table').forEach(table => {
      table.setAttribute('role', 'table');
      const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim().replace(/[↑↓]\s*$/, '').trim() || 'Chi tiết');
      table.querySelectorAll('tbody tr').forEach(row => {
        row.setAttribute('role', 'row');
        [...row.children].forEach((cell, index) => {
          if (cell.colSpan > 1) return;
          cell.setAttribute('role', 'cell'); cell.dataset.label = headers[index] || '';
        });
      });
    });
  };
  labelRows();
  new MutationObserver(labelRows).observe(scope, {childList:true,subtree:true});
})();
