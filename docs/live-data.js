(() => {
  const cfg = window.SUNGROW_CONFIG || {};
  const root = document.getElementById('sg-preview');
  if (!root) return;
  root.hidden = true;
  document.documentElement.classList.add('sg-auth-pending');
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
  let ticketSearchState = {term:'',rows:null,total:0,loading:false,error:'',page:1,pageSize:20,totalPages:1,statuses:[],fromYear:null,toYear:null};
  let ticketSortOrder = 'newest';
  const AUTO_SYNC_MS = 300000;
  const REVISION_SYNC_MS = 60000 + Math.floor(Math.random()*15000);
  let portalRevision = '';
  let revisionCheckBusy = false;

  const style = document.createElement('style');
  style.textContent = '#sg-preview .sg-live-box{display:flex;align-items:center;gap:8px}.sg-live-dot{width:8px;height:8px;border-radius:50%;background:#c56b0b}.sg-live-dot.ok{background:#2f7a52}.sg-live-dot.error{background:#b63d35}.sg-live-text{font-size:10px;color:#606060}.sg-login-slot{display:flex;align-items:center;min-height:32px}.sg-account-name{display:block;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;font-size:11px;font-weight:600}.sg-account-role{margin-top:10px;color:#606060}.sg-side-foot>div:first-child{display:flex;align-items:center;min-width:0}.sg-side-foot>div:first-child span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sg-refresh-button{border:1px solid #d9dee2;background:#fff;color:#4c5c66;border-radius:5px;padding:5px 8px;font-size:10px;line-height:1;white-space:nowrap}.sg-refresh-button:hover{border-color:#ff7900;color:#a74b00}.sg-refresh-button:disabled{opacity:.5;cursor:default}#sg-preview #sg-period-year{width:76px!important;min-width:76px!important}#sg-preview #sg-period-month{width:98px!important;min-width:98px!important}#sg-preview .sg-filter-panel #sg-center{width:154px!important;min-width:154px!important}#sg-preview .sg-filter-panel #sg-compare-mode{width:138px!important;min-width:138px!important;text-overflow:clip!important}';
  style.textContent += '#sg-preview .sg-role-hidden{display:none!important}#sg-preview .sg-nav-parent{position:relative;padding-left:6px!important;padding-right:30px!important;color:#9a4708;font-size:13.5px!important;font-weight:700;letter-spacing:-.1px;white-space:nowrap}#sg-preview .sg-nav-parent::after{content:"";position:absolute;right:12px;top:50%;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-65%) rotate(-45deg);transform-origin:50% 50%;transition:transform .16s ease}#sg-preview .sg-nav-parent[aria-expanded="true"]::after{transform:translateY(-75%) rotate(45deg)}#sg-preview .sg-nav-children{display:grid;gap:3px;margin:0 0 5px 9px;padding:2px 0 3px 10px;border-left:1px solid #e7e8ea}#sg-preview .sg-nav-children[hidden]{display:none!important}#sg-preview .sg-nav-children button{min-height:38px;padding:8px 10px;font-size:12px;font-weight:400}#sg-preview .sg-platform-parent{margin-top:5px;border-top:1px solid #f0f1f2;padding-top:15px!important;border-radius:0}#sg-preview .sg-signout{margin-top:11px;padding:7px 0;border:0;background:transparent;color:#a44800;font-size:11px;font-weight:600;text-align:left}#sg-preview .sg-signout:hover{text-decoration:underline}#sg-preview .sg-portal-frame{display:none;width:100%;height:calc(100vh - 64px);min-height:0;border:0;background:#f5f6f7;flex:1}#sg-preview .sg-main.sg-portal-mode>.sg-content{display:none!important}#sg-preview .sg-main.sg-portal-mode>.sg-portal-frame{display:block!important}#sg-preview .sg-main.sg-portal-mode .sg-filter-panel,#sg-preview .sg-main.sg-portal-mode .sg-demo,#sg-preview .sg-main.sg-portal-mode .sg-live-box{display:none!important}#sg-preview .sg-main.sg-portal-mode>.sg-top{display:flex!important;min-height:64px;justify-content:flex-start}@media(min-width:581px){#sg-preview .sg-side{padding-left:14px!important;padding-right:14px!important}#sg-preview .sg-brand{display:block!important;width:100%;min-height:72px;padding:0 4px 24px!important}#sg-preview .sg-official-logo{width:150px;height:32px;padding:2px 0 10px!important}#sg-preview .sg-official-logo svg{display:block;width:150px!important;height:20px!important;max-width:none!important}#sg-preview .sg-brand small{display:block;margin:0;padding:0!important;font-size:12px;line-height:18px;letter-spacing:1.25px}}';
  style.textContent += '#sg-preview .sg-live-text{display:flex;align-items:center;gap:6px;white-space:nowrap}#sg-preview .sg-kpi-note{overflow:visible!important;text-overflow:clip!important;white-space:normal!important}';
  style.textContent += '#sg-auth-page{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#f8f9fa 0%,#f1f3f5 55%,#fff4e8 100%);font-family:"Sungrow Montserrat",Montserrat,Arial,sans-serif;color:#262626}#sg-auth-page[hidden]{display:none!important}#sg-auth-page .sg-auth-card{width:min(100%,430px);padding:44px 42px 38px;background:#fff;border:1px solid #e5e5e5;border-radius:14px;box-shadow:0 22px 65px rgba(25,35,45,.12);text-align:center}#sg-auth-page .sg-auth-brand{display:flex;justify-content:center;padding-bottom:28px;border-bottom:1px solid #ededed}#sg-auth-page .sg-auth-brand .sg-brand{padding:0!important}#sg-auth-page .sg-auth-brand .sg-official-logo svg{width:210px;height:auto}#sg-auth-page .sg-auth-brand small{display:block;margin-top:9px;color:#606060;font-size:13px;letter-spacing:2px}#sg-auth-page h1{margin:28px 0 10px;font-size:24px;font-weight:600;line-height:1.35}#sg-auth-page .sg-auth-copy{margin:0 auto 26px;max-width:315px;color:#667085;font-size:13px;line-height:1.65}#sg-auth-login-slot{display:flex;justify-content:center;min-height:44px}#sg-auth-message{min-height:20px;margin:18px 0 0;color:#667085;font-size:12px;line-height:1.5}#sg-auth-message.sg-auth-error{color:#b42318}#sg-auth-page .sg-auth-note{margin:25px 0 0;padding-top:20px;border-top:1px solid #ededed;color:#8a8f98;font-size:11px;line-height:1.6}@media(max-width:520px){#sg-auth-page{padding:16px}#sg-auth-page .sg-auth-card{padding:34px 24px 30px}#sg-auth-page .sg-auth-brand .sg-official-logo svg{width:180px}}';
  document.head.appendChild(style);
  style.textContent += '#sg-preview .sg-main.sg-portal-mode .sg-live-box{display:flex!important;margin-left:auto}#sg-preview .sg-main.sg-portal-mode .sg-live-detail{display:none}';
  const authPage = document.createElement('main');
  authPage.id = 'sg-auth-page';
  authPage.setAttribute('aria-label','Đăng nhập Sungrow Service Center');
  authPage.innerHTML = '<section class="sg-auth-card"><div class="sg-auth-brand" id="sg-auth-brand"></div><h1>Đăng nhập hệ thống</h1><p class="sg-auth-copy">Sử dụng tài khoản Google đã được cấp quyền để truy cập Service Center.</p><div id="sg-auth-login-slot"></div><p id="sg-auth-message" role="status">Đang kiểm tra phiên đăng nhập…</p><p class="sg-auth-note">Giao diện và chức năng sẽ được hiển thị theo quyền của từng tài khoản.</p></section>';
  document.body.appendChild(authPage);
  const authBrand = q('.sg-brand')?.cloneNode(true);
  if (authBrand) document.getElementById('sg-auth-brand').appendChild(authBrand);
  const host = document.createElement('div');
  host.className = 'sg-live-box';
  host.innerHTML = '<i class="sg-live-dot"></i><span class="sg-live-text"><strong id="sg-live-title">Chưa kết nối</strong><span id="sg-live-detail">Đang kiểm tra cấu hình</span></span><button class="sg-refresh-button" id="sg-refresh" type="button" disabled>↻ Đồng bộ</button><span class="sg-login-slot" id="sg-login-slot"></span>';
  q('.sg-top').appendChild(host);

  installPortalSidebar();

  function installPortalSidebar() {
    const nav = q('.sg-nav');
    const dashboardButtons = Array.from(nav.querySelectorAll('button[data-page]'));
    const dashboardButton = document.createElement('button');
    dashboardButton.type = 'button';
    dashboardButton.className = 'sg-nav-parent sg-dashboard-parent';
    dashboardButton.textContent = 'Dashboard quản lý';
    dashboardButton.setAttribute('aria-expanded','true');
    const dashboardSubnav = document.createElement('div');
    dashboardSubnav.className = 'sg-nav-children sg-dashboard-subnav';
    nav.insertBefore(dashboardButton, dashboardButtons[0] || null);
    nav.insertBefore(dashboardSubnav, dashboardButtons[0] || null);
    dashboardButtons.forEach(button => {
      dashboardSubnav.appendChild(button);
      button.addEventListener('click',() => {
        closePortalView();
        setNavGroup(dashboardButton,dashboardSubnav,true);
        setNavGroup(platformButton,subnav,false);
      });
    });
    const platformButton = document.createElement('button');
    platformButton.type = 'button';
    platformButton.className = 'sg-nav-parent sg-platform-parent';
    platformButton.textContent = 'Platform nhập liệu';
    platformButton.setAttribute('aria-expanded','false');
    nav.appendChild(platformButton);
    const subnav = document.createElement('div');
    subnav.className = 'sg-nav-children sg-subnav';
    subnav.hidden = true;
    [['cases','Danh sách hồ sơ'],['receive','Tiếp nhận mới'],['update','Cập nhật hồ sơ'],['transfer','Luân chuyển center']].forEach(([view,label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.portalView = view;
      button.textContent = label;
      button.addEventListener('click',() => openEntryView(view));
      subnav.appendChild(button);
    });
    nav.appendChild(subnav);
    dashboardButton.addEventListener('click',() => {
      const expanded = dashboardButton.getAttribute('aria-expanded') === 'true';
      setNavGroup(dashboardButton,dashboardSubnav,!expanded);
      if (!expanded) setNavGroup(platformButton,subnav,false);
    });
    platformButton.addEventListener('click',() => {
      const expanded = platformButton.getAttribute('aria-expanded') === 'true';
      setNavGroup(platformButton,subnav,!expanded);
      if (!expanded) setNavGroup(dashboardButton,dashboardSubnav,false);
    });
  }

  function setNavGroup(button, group, expanded) {
    if (!button || !group) return;
    button.setAttribute('aria-expanded',String(expanded));
    group.hidden = !expanded;
  }

  function applyPortalCapabilities(actor) {
    const capabilities = actor?.capabilities || {};
    const allowed = {
      cases: capabilities.viewCases !== false,
      receive: !!capabilities.createCase,
      update: !!capabilities.updateWorkOrder,
      transfer: !!capabilities.createTransfer
    };
    root.querySelectorAll('[data-portal-view]').forEach(button => {
      const visible = !!allowed[button.dataset.portalView];
      button.hidden = !visible;
      button.classList.toggle('sg-role-hidden',!visible);
      button.setAttribute('aria-hidden',String(!visible));
      button.tabIndex = visible ? 0 : -1;
    });
  }

  function openEntryView(view) {
    if(activeController){activeController.abort();activeController=null;loadSequence++;}
    if(ticketSearchController){ticketSearchController.abort();ticketSearchController=null;ticketSearchSequence++;}
    q('#sg-refresh').disabled=!token;
    if (token) sessionStorage.setItem('sungrow_id_token', token);
    const main = q('.sg-main');
    main.classList.add('sg-portal-mode');
    let frame = q('.sg-portal-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'sg-portal-frame';
      frame.title = 'Sungrow Service Center - Platform nhập liệu';
      main.appendChild(frame);
    }
    frame.dataset.portalView = view;
    if (!frame.getAttribute('src')) {
      const entryPage = cfg.dataEntryPage || 'entry.html';
      frame.src = entryPage + (entryPage.includes('?') ? '&' : '?') + 'v=73#' + view;
    }
    else if (frame.dataset.ready === 'true') frame.contentWindow.postMessage({type:'sungrow-portal-view',view:view,refresh:true},window.location.origin);
    root.querySelectorAll('.sg-nav button[data-page]').forEach(button => button.removeAttribute('aria-current'));
    setNavGroup(q('.sg-dashboard-parent'),q('.sg-dashboard-subnav'),false);
    setNavGroup(q('.sg-platform-parent'),q('.sg-subnav'),true);
    root.querySelectorAll('[data-portal-view]').forEach(button => {
      if (button.dataset.portalView === view) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    q('#sg-crumb').textContent = ({cases:'Danh sách hồ sơ',receive:'Tiếp nhận mới',update:'Cập nhật hồ sơ',transfer:'Luân chuyển center'})[view] || 'Platform nhập liệu';
  }

  function closePortalView() {
    q('.sg-main').classList.remove('sg-portal-mode');
    root.querySelectorAll('[data-portal-view]').forEach(button => button.removeAttribute('aria-current'));
  }

  function showDashboardView() {
    closePortalView();
    const overview = q('.sg-nav button[data-page="overview"]');
    if (overview) overview.click();
  }

  function status(title, detail, type = '') {
    q('#sg-live-title').textContent = title;
    q('#sg-live-detail').textContent = detail;
    q('.sg-live-dot').className = 'sg-live-dot ' + type;
  }

  function selectedPeriod() {
    const year = q('#sg-period-year')?.value;
    const month = q('#sg-period-month')?.value;
    if (year) return month && month !== 'all' ? year + '-' + month : year;
    return q('#sg-period').selectedOptions[0]?.dataset.livePeriod || cfg.defaultPeriod || new Date().toISOString().slice(0, 7);
  }

  function syncCenterOptions(data) {
    const select = q('#sg-center');
    if (!select || !data) return;
    const names = [];
    (data.centers || []).forEach(function (item) {
      const name = String(item && item.center || '').trim();
      if (name && !names.includes(name)) names.push(name);
    });
    if (!names.length) return;
    const selected = select.value;
    const existing = Array.from(select.options).map(function (option) { return option.value; }).filter(function (value) { return value !== 'all'; });
    const complete = Array.from(new Set(existing.concat(names)));
    select.innerHTML = '<option value="all">Tất cả trung tâm</option>' + complete.map(function (name) { return '<option value="' + esc(name) + '">' + esc(name) + '</option>'; }).join('');
    select.value = complete.includes(selected) ? selected : 'all';
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchDashboard(payload, signal, attempts = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const requestController = new AbortController();
      let timeout, forwardAbort;
      const stopped = new Promise((_, reject) => {
        forwardAbort = () => { requestController.abort(); const error = new Error('Đã hủy yêu cầu đọc cũ.'); error.name = 'AbortError'; reject(error); };
        if (signal?.aborted) forwardAbort(); else signal?.addEventListener('abort', forwardAbort, {once:true});
        timeout = setTimeout(() => { requestController.abort(); const error = new Error('Hết thời gian kết nối dữ liệu. Bấm Đồng bộ để thử lại.'); error.code = 'READ_TIMEOUT'; reject(error); }, 45000);
      });
      try {
        const result = await Promise.race([(async () => {
          const body = new URLSearchParams({payload:JSON.stringify(payload)});
          const response = await fetch(cfg.appsScriptUrl, {method:'POST',body,redirect:'follow',signal:requestController.signal,cache:'no-store'});
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const result = await response.json();
          if (!result.ok) { const error = new Error([result.error?.code,result.error?.message].filter(Boolean).join(': ') || 'API error'); error.code = result.error?.code || ''; throw error; }
          return result.data;
        })(), stopped]);
        return result;
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
        if (/AUTH|TOKEN|FORBIDDEN|INVALID|ACTION_NOT_ALLOWED|UNAUTHORIZED|READ_TIMEOUT/.test(String(error.code || ''))) throw error;
        if (attempt < attempts - 1) await delay([700,1800,3500][attempt] || 3500);
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort',forwardAbort);
      }
    }
    throw lastError || new Error('Không nhận được phản hồi từ Apps Script');
  }

  async function checkDashboardRevision() {
    if (!token || document.hidden || revisionCheckBusy || activeController) return;
    const main = q('.sg-main');
    if (main && main.classList.contains('sg-portal-mode')) return;
    revisionCheckBusy = true;
    const controller = new AbortController();
    try {
      const sync = await fetchDashboard({
        action:'portal.call',
        functionName:'getPortalSyncState',
        args:[token]
      }, controller.signal, 1);
      if (!sync || !sync.revision) return;
      const nextRevision = String(sync.revision);
      if (!portalRevision) {
        portalRevision = nextRevision;
        return;
      }
      if (nextRevision !== portalRevision) {
        portalRevision = nextRevision;
        await loadLive({comparison:false});
      }
    } catch (_) {
      // The regular dashboard refresh remains the fallback after a transient check failure.
    } finally {
      revisionCheckBusy = false;
    }
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
    status('Chưa đồng bộ', lastSuccessfulSync ? new Date(lastSuccessfulSync).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : new Date().toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}));
    try {
      const currentData = await fetchDashboard({action:'dashboard.read', idToken:token, period:periodKey, center:center, refresh:forceRefresh}, controller.signal);
      if (sequence !== loadSequence) return;
      live = currentData;
      root.dataset.liveData = 'true';
      renderIdentity(live.actor);
      syncCenterOptions(live);
      const refreshComparison = options.comparison !== false || !previousLive;
      if (refreshComparison) previousLive = null;
      renderAll();
      lastSuccessfulSync = Date.now();
      const currentUpdated = new Date(live.source.sourceUpdatedAt).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      status('Đã đồng bộ', currentUpdated, 'ok');
      if (!q('#sg-tickets').classList.contains('sg-hidden')) loadTicketPage(true);
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
      const updated = new Date(live.source.sourceUpdatedAt).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      status('Đã đồng bộ', updated, 'ok');
    } catch (error) {
      if (controller.signal.aborted || sequence !== loadSequence) return;
      if (live) {
        status('Chưa đồng bộ', new Date(lastSuccessfulSync || Date.now()).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}), '');
      } else {
        const detail = String(error && error.message || 'Không nhận được phản hồi từ Apps Script').replace(/^INTERNAL_ERROR:\s*/,'');
        status('Chưa đồng bộ', new Date().toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}), 'error');
        if (options.recovery !== false) setTimeout(function(){ if(token && !live && !activeController && navigator.onLine) loadLive({force:true,recovery:false}); },5000);
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
      {key:'received',label:'Tiếp nhận trong kỳ',value:s.received,previous:ps?.received,lower:false,unit:'thiết bị'},
      {key:'processed',label:'Hoàn tất kỹ thuật',value:s.technicalCompleted??null,previous:ps?.technicalCompleted??null,lower:false,unit:'thiết bị'},
      {key:'waiting',label:'Chờ giao',value:s.waitingDelivery,previous:ps?.waitingDelivery,lower:true,unit:'thiết bị'},
      {key:'returned',label:'Đã giao trong kỳ',value:s.returned,previous:ps?.returned,lower:false,unit:'thiết bị'}
    ];
    const slaRate = s.slaRate === null || s.slaRate === undefined ? null : Math.round(s.slaRate*100);
    base.push({key:'sla',label:'Đạt SLA 7 ngày',value:slaRate,previous:null,lower:false,unit:'%',sla:true});
    const trendViz = function(previous,current,tone) {
      if (previous === null || previous === undefined || current === null || current === undefined) return '<span class="sg-mini-empty">Kỳ trước → Kỳ này</span>';
      const max=Math.max(1,previous,current), min=Math.min(0,previous,current), y=function(v){return 25-(v-min)/(max-min||1)*18;};
      const y1=y(previous).toFixed(1), y2=y(current).toFixed(1);
      return '<svg class="sg-mini-trend '+tone+'" viewBox="0 0 72 30" aria-label="Kỳ trước '+previous+', kỳ này '+current+'"><path d="M4 26 L4 '+y1+' L68 '+y2+' L68 26 Z"></path><polyline points="4,'+y1+' 68,'+y2+'"></polyline><circle cx="4" cy="'+y1+'" r="2.4"></circle><circle cx="68" cy="'+y2+'" r="2.8"></circle></svg>';
    };
    const annualTotals=(Array.isArray(live.yearlyTotals)&&live.yearlyTotals.length?live.yearlyTotals:[live.annual||{}]).filter(x=>x.year).slice().sort((a,b)=>a.year-b.year);
    const cumulative=live.cumulative?.received??annualTotals.reduce((sum,x)=>sum+(x.received||0),0);
    const unallocatedReceived=Number(live.cumulative?.unallocatedReceived||0);
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
      const legend=allSeries.map(function(series){
        const coverage=series.name==='Tích lũy'&&unallocatedReceived?' · '+unallocatedReceived.toLocaleString('vi-VN')+' hồ sơ chưa tính do thiếu, sai hoặc lệch năm ngày nhận':'';
        return '<span title="'+esc(series.name)+': '+Number(series.total).toLocaleString('vi-VN')+' thiết bị'+esc(coverage)+'"><i style="background:'+series.color+'"></i><em>'+esc(series.name)+'</em><b>'+Number(series.total).toLocaleString('vi-VN')+'</b></span>';
      }).join('');
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
      const delta = p === null || item.value === null ? null : item.value-p;
      const better = delta === 0 ? null : (item.lower ? delta<0 : delta>0);
      const tone = better === null ? 'neutral' : better ? 'good' : 'bad';
      const change = delta === null ? 'Chưa có tháng trước' : delta === 0 ? '--' : (delta>0?'↑ ':'↓ ')+Math.abs(delta);
      const note = p === null ? change.replace('tháng trước','kỳ trước') : comparisonNoun+': '+p+' <span class="sg-kpi-change '+tone+'">'+change+'</span>';
      const scopeNote=item.key==='waiting'?'Bao gồm tồn từ các kỳ trước; chốt '+formatDate(live.period.asOf):item.key==='received'?(s.receivedCases??'—')+' hồ sơ trong kỳ; KPI cộng số lượng thiết bị đã biết':'Theo kỳ đang chọn';
      return '<div class="sg-kpi sg-kpi-' + item.key + '" title="'+esc(scopeNote)+'"><div class="sg-kpi-head"><div class="sg-kpi-label">'+item.label+'</div>'+(index===0?receivedAnnualViz():trendViz(p,item.value,tone))+'</div><div class="sg-kpi-value">'+(item.value??'—')+' <small>'+item.unit+'</small></div><div class="sg-kpi-note">'+note+'</div></div>';
    }).join('');
    q('#sg-period-date').textContent = `${formatDate(live.period.start)}–${formatDate(live.period.asOf)}`;
    const max = Math.max(1, ...live.errors.map(x => x.count));
    const errorTotal = live.errors.reduce((sum,x) => sum + Number(x.count||0),0);
    const errorRows = live.errors.map(x => { const share=errorTotal ? 100*x.count/errorTotal : 0; return `<div class="sg-error-line"><span class="sg-error-name" title="${esc(x.name)}">${esc(x.name)}</span><div class="sg-track"><i style="width:${100*x.count/max}%"></i></div><b class="sg-error-count">${x.count}</b><small class="sg-error-share">${share.toLocaleString('vi-VN',{maximumFractionDigits:1})}%</small></div>`; }).join('') || '<div class="sg-caption">Chưa có lỗi xác nhận trong kỳ.</div>';
    q('#sg-errors').innerHTML = '<div class="sg-mini-table-head sg-error-list-head"><span title="Chỉ tính lỗi xác nhận; mỗi thiết bị tính một lần trong mỗi nhóm lỗi">Lỗi xác nhận</span><span>Mức độ</span><span title="Số thiết bị có lỗi thuộc nhóm này">SL</span><span title="Tỷ trọng trên tổng lượt thiết bị theo nhóm lỗi">Tỷ trọng</span></div><div class="sg-card-list-body sg-error-list-body">' + errorRows + '</div>';
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
    return t.status || t.deliveryStatus || 'Chưa cập nhật';
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
    const columns = '<colgroup><col style="width:8%"><col style="width:8%"><col style="width:19%"><col style="width:25%"><col style="width:12%"><col style="width:14%"><col style="width:12%"><col style="width:52px"></colgroup>';
    const body = rows.map(function(t) {
      const serial = t.serialNumber ? 'S/N ' + t.serialNumber : 'Chưa có S/N';
      const status = ticketStatus(t);
      const duration = ticketDuration(t);
      const identity = [t.model || t.deviceType || 'Chưa xác định',t.serialNumber || ''].filter(Boolean).join(' ');
      return `<tr><td>${esc(t.gsp || '—')}</td><td>${esc(t.ma || '—')}</td><td><span class="sg-sn">${esc(t.model || t.deviceType || 'Chưa xác định')}</span><span class="sg-small">${esc(serial)}</span></td><td title="${esc(t.error)}">${esc(t.error)}</td><td title="${esc(t.center)}">${esc(shortCenter(t.center))}</td><td><span class="sg-status ${statusTone(status)}">${esc(status)}</span></td><td class="sg-age ${duration.old?'old':''}" title="${esc(duration.title)}">${esc(duration.text)}</td><td class="sg-action-cell"><button class="sg-detail-btn" type="button" data-live-ticket="${esc(t.id)}" aria-label="Xem thông tin ${esc(identity)}">↗</button></td></tr>`;
    }).join('');
    return '<table class="sg-device-table">' + columns + '<thead><tr><th>GSP</th><th>MA</th><th>Thiết bị / S/N</th><th>Lỗi ghi nhận</th><th>Trung tâm</th><th>Trạng thái xử lý</th><th>Thời gian xử lý</th><th aria-label="Xem chi tiết"></th></tr></thead><tbody>' + body + (rows.length?'':'<tr><td colspan="8">'+esc(emptyMessage || 'Không có dữ liệu phù hợp.')+'</td></tr>') + '</tbody></table>';
  }
  function ticketLoading() {
    return '<div class="sg-ticket-loading" role="status" aria-live="polite"><span class="sg-ticket-spinner" aria-hidden="true"></span><span>Đang tải danh sách thiết bị…</span></div>';
  }
  function syncTicketStatusOptions(source) {
    const select = q('#sg-status');
    const selected = select.value;
    const values = Array.from(new Set((source || []).map(value => typeof value === 'string' ? value : ticketStatus(value)).filter(Boolean))).sort((a,b) => a.localeCompare(b,'vi'));
    select.innerHTML = '<option value="all">Tất cả trạng thái</option>' + values.map(value => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join('');
    select.value = values.includes(selected) ? selected : 'all';
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
      if (previous === null || previous === undefined || current === null || current === undefined) return '<span class="sg-cell-delta neutral" title="Chưa đủ dữ liệu so sánh kỳ trước">—</span>';
      const delta = current - previous;
      const tone = delta === 0 ? 'neutral' : (lowerIsBetter ? delta < 0 : delta > 0) ? 'good' : 'bad';
      const text = delta === 0 ? '--' : (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta) + (suffix || '');
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
      const stockNote=x.carriedOpen===undefined?'Bao gồm hồ sơ kỳ trước':x.carriedOpen+' tồn từ kỳ trước';
      return '<div class="sg-compare-list-row" title="' + esc(x.reason || '') + '"><span><strong title="' + esc(x.center) + '">' + esc(shortCenter(x.center)) + '</strong><small title="'+esc(stockNote)+'">'+esc(stockNote)+'</small></span><span title="Tỷ trọng trong tổng tiếp nhận của kỳ"><strong>' + x.received + '</strong><small>' + pct(x.volumeShare) + ' tiếp nhận</small></span><span><strong>' + x.completed + '</strong><small>Ra/vào ' + flow + '</small></span><span title="Tồn đầu kỳ: '+(x.opening??'—')+'. Tồn tại ngày chốt gồm các kỳ trước; chỉ cân bằng khi đủ dữ liệu ngày."><strong>' + x.open + '</strong><small>Đầu kỳ: '+(x.opening??'—')+'</small>' + deltaHtml(x.open,p.open,true,'') + '</span><span title="Tỷ lệ quá hạn trên tổng tồn tại ngày chốt"><strong>' + x.overdue + '</strong><small>' + pct(x.overdueRate) + ' tồn</small></span><span title="TAT: trung vị thời gian xử lý trên hồ sơ"><strong>' + tat + '</strong>' + deltaHtml(x.medianDays,p.medianDays,true,' ngày') + '</span><span><span class="sg-trend-badge ' + tone + '">' + label + '</span></span></div>';
    }).join('');
    table.innerHTML = '<div class="sg-mini-table-head sg-compare-list-head"><span>Center</span><span title="Tiếp nhận trong kỳ đang chọn">Tiếp nhận</span><span title="Đã giao trong kỳ đang chọn">Đã giao</span><span title="Tồn tại ngày chốt, gồm hồ sơ từ kỳ trước">Tồn cuối</span><span title="Quá hạn trên tổng tồn tại ngày chốt">Quá hạn</span><span title="Trung vị thời gian xử lý trên hồ sơ">TAT</span><span>Nhận định</span></div><div class="sg-card-list-body sg-compare-list-body">' + comparisonRows + '</div>';
    const unknown=live.dataQuality?.kpi?.unknownQuantityCases||0;
    const missingReceived=live.cumulative?.unallocatedReceived||0,missingReturned=live.dataQuality?.kpi?.missingReturnDateCases||0;
    q('#sg-compare-note').textContent = 'Kỳ: '+formatDate(live.period.start)+'–'+formatDate(live.period.asOf)+'. Tiếp nhận/đã giao tính phát sinh trong kỳ; tồn và quá hạn bao gồm hồ sơ từ các kỳ trước, không phải tập con của số tiếp nhận. Center theo chặng xử lý gần nhất. Hoàn tất kỹ thuật và giao khách là hai sự kiện riêng.'+(unknown?' '+unknown+' hồ sơ thiếu số lượng chưa cộng vào KPI thiết bị.':'')+(missingReceived||missingReturned?' '+missingReceived+' hồ sơ thiếu ngày nhận; '+missingReturned+' hồ sơ đã giao thiếu ngày trả hợp lệ, chưa xác định được tồn lịch sử.':'');
  }

  function renderTickets() {
    const rows = Array.isArray(ticketSearchState.rows) ? ticketSearchState.rows : [];
    syncTicketStatusOptions(ticketSearchState.statuses.length ? ticketSearchState.statuses : (live.tickets || []));
    q('#sg-ticket-page-size').value = String(ticketSearchState.pageSize || 20);
    q('#sg-tickets-table').setAttribute('aria-busy',ticketSearchState.loading?'true':'false');
    q('#sg-tickets-table').innerHTML = ticketSearchState.loading ? ticketLoading() : ticketTable(rows);
    if (ticketSearchState.loading) q('#sg-result-count').textContent = 'Đang tải danh sách thiết bị…';
    else if (ticketSearchState.error) q('#sg-result-count').textContent = ticketSearchState.error;
    else {
      const first = ticketSearchState.total ? (ticketSearchState.page - 1) * ticketSearchState.pageSize + 1 : 0;
      const last = Math.min(ticketSearchState.page * ticketSearchState.pageSize, ticketSearchState.total);
      const range = ticketSearchState.fromYear && ticketSearchState.toYear
        ? (ticketSearchState.fromYear === ticketSearchState.toYear ? String(ticketSearchState.fromYear) : ticketSearchState.fromYear + '–' + ticketSearchState.toYear)
        : 'toàn bộ năm';
      q('#sg-result-count').textContent = `Hiển thị ${first}–${last} / ${ticketSearchState.total} thiết bị · dữ liệu ${range}${ticketSearchState.fallback?' · chế độ dự phòng theo kỳ đang chọn':''}`;
    }
    renderTicketPager();
  }

  function renderTicketPager() {
    if (ticketSearchState.loading) { q('#sg-ticket-pages').innerHTML = ''; return; }
    const total = ticketSearchState.totalPages || 1;
    const current = ticketSearchState.page || 1;
    const pages = [];
    for (let page = 1; page <= total; page++) if (page === 1 || page === total || Math.abs(page - current) <= 2) pages.push(page);
    let html = `<button class="sg-ticket-page" type="button" data-live-ticket-page="${current-1}" ${current<=1?'disabled':''}>‹</button>`;
    let previous = 0;
    pages.forEach(function(page) {
      if (previous && page - previous > 1) html += '<span class="sg-ticket-ellipsis">…</span>';
      html += `<button class="sg-ticket-page ${page===current?'active':''}" type="button" data-live-ticket-page="${page}" ${page===current?'aria-current="page"':''}>${page}</button>`;
      previous = page;
    });
    html += `<button class="sg-ticket-page" type="button" data-live-ticket-page="${current+1}" ${current>=total?'disabled':''}>›</button>`;
    q('#sg-ticket-pages').innerHTML = html;
  }

  async function loadTicketPage(resetPage) {
    if (!live || !token) return;
    const term = (q('#sg-search').value || '').trim().toLowerCase();
    if (term.length === 1) {
      ticketSearchState = Object.assign({}, ticketSearchState, {term:term,rows:[],total:0,totalPages:1,page:1,loading:false,error:'Nhập ít nhất 2 ký tự để tìm trong toàn bộ dữ liệu.'});
      renderTickets();
      return;
    }
    clearTimeout(ticketSearchTimer);
    if (ticketSearchController) ticketSearchController.abort();
    const sequence = ++ticketSearchSequence;
    const page = resetPage ? 1 : Math.max(1, Number(ticketSearchState.page) || 1);
    const pageSize = Number(q('#sg-ticket-page-size').value) || ticketSearchState.pageSize || 20;
    ticketSearchState = Object.assign({}, ticketSearchState, {term:term,page:page,pageSize:pageSize,loading:true,error:''});
    renderTickets();
    const controller = new AbortController();
    ticketSearchController = controller;
    try {
      const data = await fetchDashboard({action:'tickets.page',idToken:token,query:term,center:q('#sg-center').value,status:q('#sg-status').value,sortOrder:ticketSortOrder,page:page,pageSize:pageSize},controller.signal,2);
      if (sequence !== ticketSearchSequence) return;
      ticketSearchState = {term:term,rows:Array.isArray(data.tickets)?data.tickets:[],total:Number(data.total)||0,loading:false,error:'',page:Number(data.page)||1,pageSize:Number(data.pageSize)||pageSize,totalPages:Number(data.totalPages)||1,statuses:Array.isArray(data.statuses)?data.statuses:[],fromYear:Number(data.fromYear)||null,toYear:Number(data.toYear)||null,fallback:false};
    } catch (error) {
      if (controller.signal.aborted || sequence !== ticketSearchSequence) return;
      // The dashboard preview is capped at 250; it is not a full-list fallback.
      ticketSearchState=Object.assign({},ticketSearchState,{rows:[],total:0,totalPages:1,loading:false,error:error.message||'Không thể tải danh sách. Vui lòng thử lại.',fallback:false});
    } finally {
      if (ticketSearchController === controller) ticketSearchController = null;
      if (sequence === ticketSearchSequence) renderTickets();
    }
  }

  function goTicketPage(page) {
    if (page < 1 || page > ticketSearchState.totalPages || page === ticketSearchState.page) return;
    ticketSearchState.page = page;
    loadTicketPage(false);
  }

  function scheduleTicketSearch() {
    q('#sg-detail').classList.add('sg-hidden');
    clearTimeout(ticketSearchTimer);
    ticketSearchTimer = setTimeout(function(){ loadTicketPage(true); },300);
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
      ['Tình trạng bảo hành',ticket.warrantyStatus || 'Chưa có thông tin'],
      ['GSP',ticket.gsp || '—'],
      ['MA',ticket.ma || '—'],
      ['Lỗi ghi nhận',ticket.error || '—'],
      ['Trạng thái',status],
      ['Thời gian xử lý',duration.text]
    ];
    const detail = q('#sg-detail');
    detail.classList.remove('sg-hidden');
    const warrantyConfirmed = ['Trong bảo hành','Ngoài bảo hành','Sửa làm hàng good'].includes(ticket.warrantyStatus);
    const parts = Array.isArray(ticket.parts) ? ticket.parts.filter(part => part.pn && Number(part.qty) > 0) : [];
    const partsHtml = (warrantyConfirmed || parts.length) ? '<div class="sg-detail-parts"><h3>Linh kiện sử dụng</h3>' + (parts.length ? '<div class="sg-parts-inline">' + parts.map(part => '<div class="sg-part-chip"><strong>' + esc(part.pn) + '</strong><span>Số lượng: ' + esc(part.qty) + '</span></div>').join('') + '</div>' : '<p class="sg-caption">Chưa ghi nhận linh kiện sử dụng.</p>') + '</div>' : '';
    detail.innerHTML = '<div class="sg-panel-head"><div><h2>' + esc(model) + '</h2><span class="sg-caption">S/N ' + esc(serial) + ' · Chi tiết lượt sửa chữa</span></div><button class="sg-button" type="button" data-live-close="true">Đóng</button></div><div class="sg-detail-grid">' + fields.map(function(field) { return '<div class="sg-field"><span>' + esc(field[0]) + '</span>' + esc(field[1]) + '</div>'; }).join('') + '</div>' + partsHtml;
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
    const cs = live.centers.filter(x=>!x.unassigned);
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
    const now = new Date();
    const current = String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2,'0');
    const legacySelect = q('#sg-period');
    const legacyLabel = legacySelect.closest('label');
    const controls = legacyLabel.parentElement;
    const yearLabel = document.createElement('label');
    yearLabel.className = 'sg-control-label';
    yearLabel.textContent = 'Năm';
    const yearSelect = document.createElement('input');
    yearSelect.type = 'number';
    yearSelect.id = 'sg-period-year';
    yearSelect.className = 'sg-control sg-period-year';
    yearSelect.min = '2024';
    yearSelect.max = '2100';
    yearSelect.step = '1';
    yearSelect.inputMode = 'numeric';
    yearSelect.setAttribute('aria-label','Năm báo cáo');
    yearSelect.title = 'Nhập năm báo cáo, ví dụ 2027';
    const maxYear = Math.max(now.getFullYear(), Number((cfg.defaultPeriod || '').slice(0,4)) || 0);
    yearSelect.value = String(maxYear);
    yearLabel.appendChild(yearSelect);
    const monthLabel = document.createElement('label');
    monthLabel.className = 'sg-control-label';
    monthLabel.textContent = 'Tháng';
    const monthSelect = document.createElement('select');
    monthSelect.id = 'sg-period-month';
    monthSelect.className = 'sg-control sg-period-month';
    monthSelect.setAttribute('aria-label','Tháng báo cáo');
    const annual = document.createElement('option');
    annual.value = 'all';
    annual.textContent = 'Cả năm';
    monthSelect.appendChild(annual);
    for (let month = 1; month <= 12; month++) {
      const value = String(month).padStart(2,'0');
      const option = document.createElement('option');
      option.value = value;
      option.textContent = 'Tháng ' + value;
      option.selected = month === now.getMonth() + 1;
      monthSelect.appendChild(option);
    }
    monthLabel.appendChild(monthSelect);
    controls.insertBefore(yearLabel,legacyLabel);
    controls.insertBefore(monthLabel,legacyLabel);
    legacyLabel.hidden = true;
    legacyLabel.style.display = 'none';
    legacyLabel.setAttribute('aria-hidden','true');
    legacySelect.innerHTML = '<option data-live-period="' + current + '">' + current + '</option>';
  }

  function syncLegacyPeriodControl() {
    const period = selectedPeriod();
    const select = q('#sg-period');
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = period;
    option.dataset.livePeriod = period;
    option.textContent = period;
    select.appendChild(option);
    const compare = q('#sg-compare-mode option');
    if (compare) compare.textContent = /^\d{4}$/.test(period) ? 'Năm trước' : 'Tháng trước';
    select.dispatchEvent(new Event('change'));
  }

  function initGoogle() {
    if (!cfg.appsScriptUrl || /PASTE_/.test(cfg.appsScriptUrl) || !cfg.googleClientId || /PASTE_/.test(cfg.googleClientId)) {
      status('Chưa cấu hình API','Cần Apps Script URL và Google Client ID','error');
      setAuthMessage('Hệ thống đăng nhập chưa được cấu hình. Vui lòng liên hệ quản trị viên.', true);
      return;
    }
    if (!window.google?.accounts?.id) {
      setAuthMessage('Đang tải dịch vụ đăng nhập Google…');
      setTimeout(initGoogle,250);
      return;
    }
    google.accounts.id.initialize({client_id:cfg.googleClientId,callback:handleCredential});
    const loginSlot = document.getElementById('sg-auth-login-slot');
    loginSlot.replaceChildren();
    google.accounts.id.renderButton(loginSlot,{theme:'outline',size:'large',text:'signin_with',shape:'rectangular',locale:'vi',width:300});
    setAuthMessage('Vui lòng đăng nhập để tiếp tục.');
    status('Yêu cầu đăng nhập','Dữ liệu hiển thị sau khi xác thực');
  }

  function setAuthMessage(message, isError = false) {
    const messageNode = document.getElementById('sg-auth-message');
    if (!messageNode) return;
    messageNode.textContent = message;
    messageNode.classList.toggle('sg-auth-error', isError);
  }

  function revealApplication() {
    root.hidden = false;
    authPage.hidden = true;
    document.documentElement.classList.remove('sg-auth-pending');
    document.documentElement.classList.add('sg-authenticated');
  }

  async function handleCredential(response) {
    token = response?.credential || '';
    if (!token) return;
    setAuthMessage('Đang xác thực tài khoản và phân quyền…');
    sessionStorage.setItem('sungrow_id_token', token);
    try {
      const bootstrap = await fetchDashboard({action:'portal.call', functionName:'getBootstrap', args:[token]}, new AbortController().signal, 3);
      sessionStorage.setItem('sungrow_portal_actor', JSON.stringify(bootstrap.actor || {}));
      applyPortalCapabilities(bootstrap.actor);
      if (!bootstrap.actor?.isGlobalManager) {
        renderIdentity(bootstrap.actor);
        [q('.sg-dashboard-parent'),q('.sg-dashboard-subnav')].forEach(element => {
          if (!element) return;
          element.hidden = true;
          element.classList.add('sg-role-hidden');
          element.setAttribute('aria-hidden','true');
        });
        root.querySelectorAll('.sg-nav button[data-page]').forEach(button => {
          button.hidden = true;
          button.classList.add('sg-role-hidden');
          button.setAttribute('aria-hidden','true');
          button.tabIndex = -1;
        });
        openEntryView('cases');
        revealApplication();
        return;
      }
      renderIdentity(bootstrap.actor);
      showDashboardView();
      revealApplication();
      loadLive();
    } catch (error) {
      token = '';
      sessionStorage.removeItem('sungrow_id_token');
      sessionStorage.removeItem('sungrow_portal_actor');
      status('Không thể đăng nhập', error.message || 'Tài khoản không được cấp quyền', 'error');
      initGoogle();
      setAuthMessage(error.message || 'Tài khoản không được cấp quyền truy cập.', true);
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
    const footer = q('.sg-side-foot');
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
      const signOutButton = document.createElement('button');
      signOutButton.type = 'button';
      signOutButton.className = 'sg-signout';
      signOutButton.textContent = 'Đăng xuất';
      signOutButton.addEventListener('click', signOut);

      footer.append(line, role, signOutButton);
    }
  }

  function signOut() {
    token = '';
    sessionStorage.removeItem('sungrow_id_token');
    sessionStorage.removeItem('sungrow_portal_actor');
    try {
      window.google?.accounts?.id?.disableAutoSelect();
    } catch (_) {
      // Google Identity Services may not be loaded yet.
    }
    window.location.reload();
  }

  const formatDate = value => value ? value.split('-').reverse().join('/') : '—';
  setPeriodLabels();
  q('#sg-period-year').addEventListener('blur',function(){const year=Math.round(Number(this.value));if(!Number.isFinite(year)||year<2024||year>2100)this.value=String(new Date().getFullYear());else this.value=String(year)});
  q('#sg-period-year').addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();this.blur();syncLegacyPeriodControl();setTimeout(loadLive,0)}});
  ['#sg-center','#sg-period-year','#sg-period-month'].forEach(s => q(s).addEventListener('change',() => {
    if (s !== '#sg-center') syncLegacyPeriodControl();
    setTimeout(loadLive,0);
    if (s === '#sg-center' && (q('#sg-search').value || '').trim()) setTimeout(scheduleTicketSearch,0);
  }));
  q('#sg-model-type').addEventListener('change',() => {if(live)setTimeout(renderModels,0);});
  q('#sg-search').addEventListener('input',() => {if(live)scheduleTicketSearch();});
  q('#sg-status').addEventListener('change',() => {if(live){q('#sg-detail').classList.add('sg-hidden');loadTicketPage(true);}});
  q('#sg-status').insertAdjacentHTML('afterend','<button id="sg-ticket-date-sort" type="button" title="Theo ngày nhận: Mới nhất → Cũ nhất. Bấm để đổi chiều." style="border:1px solid #d5dbe3;border-radius:8px;padding:10px 12px;background:white;color:#526173;font:inherit;white-space:nowrap">Ngày nhận ↓</button>');
  q('#sg-ticket-date-sort').addEventListener('click',function(){ticketSortOrder=ticketSortOrder==='oldest'?'newest':'oldest';this.textContent='Ngày nhận '+(ticketSortOrder==='oldest'?'↑':'↓');this.title='Theo ngày nhận: '+(ticketSortOrder==='oldest'?'Cũ nhất → Mới nhất':'Mới nhất → Cũ nhất')+'. Bấm để đổi chiều.';if(live){q('#sg-detail').classList.add('sg-hidden');loadTicketPage(true);}});
  q('#sg-ticket-page-size').addEventListener('change',() => {if(live){q('#sg-detail').classList.add('sg-hidden');loadTicketPage(true);}});
  root.addEventListener('click',e => {
    if (!live) return;
    const detailButton = e.target.closest('[data-live-ticket]');
    if (detailButton) { showTicketDetail(detailButton.dataset.liveTicket); return; }
    const ticketPageButton = e.target.closest('[data-live-ticket-page]');
    if (ticketPageButton && !ticketPageButton.disabled) { goTicketPage(Number(ticketPageButton.dataset.liveTicketPage)); return; }
    if (e.target.closest('[data-live-close]')) { q('#sg-detail').classList.add('sg-hidden'); return; }
    const pageButton = e.target.closest('[data-page]');
    if (pageButton && pageButton.dataset.page === 'tickets') setTimeout(function(){ loadTicketPage(true); },0);
    if (e.target.closest('[data-part],[data-page]')) setTimeout(renderAll,0);
  });
  q('#sg-refresh').addEventListener('click',() => {if(!token)return;if(q('.sg-main').classList.contains('sg-portal-mode')){const frame=q('.sg-portal-frame');frame?.contentWindow.postMessage({type:'sungrow-portal-sync'},window.location.origin);}else loadLive({force:true});});
  q('#sg-calc-fail').addEventListener('click',() => {if(live)calculateFailureRate();});
  q('#sg-fail-model').addEventListener('change',() => {if(live)renderQuality();});
  q('#sg-sold-quantity').addEventListener('keydown',e => {if(e.key === 'Enter' && live)calculateFailureRate();});
  setInterval(() => {if(token && !document.hidden && !activeController && !q('.sg-main').classList.contains('sg-portal-mode'))loadLive({comparison:false});},AUTO_SYNC_MS);
  setInterval(checkDashboardRevision,REVISION_SYNC_MS);
  document.addEventListener('visibilitychange',() => {if(!document.hidden && token && !q('.sg-main').classList.contains('sg-portal-mode') && Date.now()-lastSuccessfulSync>=AUTO_SYNC_MS && !activeController)loadLive({comparison:false});});
  document.addEventListener('visibilitychange',() => {if(!document.hidden)checkDashboardRevision();});
  window.addEventListener('online',() => {if(token && !activeController)loadLive({comparison:false});});
  window.addEventListener('focus',checkDashboardRevision);
  const savedToken = sessionStorage.getItem('sungrow_id_token');
  if (savedToken) {
    setAuthMessage('Đang khôi phục phiên đăng nhập…');
    handleCredential({credential:savedToken});
  }
  else initGoogle();
  window.addEventListener('message',event => {
    if (event.origin !== window.location.origin) return;
    const syncFrame=q('.sg-portal-frame');
    if(event.data?.type==='sungrow-portal-sync-status'&&syncFrame&&event.source===syncFrame.contentWindow&&q('.sg-main').classList.contains('sg-portal-mode')){
      const text=String(event.data.text||'').slice(0,220);
      status(text.startsWith('Đã đồng bộ')?text:text.startsWith('Đang')?'Đang đồng bộ…':'Chưa đồng bộ','',text.startsWith('Chưa')?'error':'');
      q('.sg-live-box').title=String(event.data.detail||text).slice(0,250);q('#sg-refresh').disabled=false;return;
    }
    if (event.data?.type === 'sungrow-portal-dashboard') showDashboardView();
    if (event.data?.type === 'sungrow-portal-ready') {
      const frame = q('.sg-portal-frame');
      if (!frame || event.source !== frame.contentWindow) return;
      frame.dataset.ready = 'true';
      frame.contentWindow.postMessage({type:'sungrow-portal-view',view:frame.dataset.portalView || 'cases'},window.location.origin);
    }
  });
})();
