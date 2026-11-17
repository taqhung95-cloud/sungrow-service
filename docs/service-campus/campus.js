(() => {
  const landing = document.getElementById('sc-landing');
  const worldElement = landing.querySelector('.sc-world');
  const canvas = document.getElementById('sc-map');
  const markerLayer = landing.querySelector('.sc-markers');
  const timeButton = landing.querySelector('[data-sc-time]');
  const playbackButton = landing.querySelector('[data-sc-play]');
  const queue = landing.querySelector('.sc-queue');
  const dashboard = document.getElementById('sg-preview');
  const destination = landing.querySelector('[data-sc-open]');
  const title = landing.querySelector('[data-sc-detail-title]');
  const kicker = landing.querySelector('[data-sc-detail-kicker]');
  const copy = landing.querySelector('[data-sc-detail-copy]');

  const stations = {
    fpv: {number:'07',label:'FPV · Hồ năng lượng',text:'Điện mặt trời nổi, hệ phao và lối bảo trì. Chuyển động mặt nước mang tính minh họa.'},
    energy: {number:'06',label:'PV & Wind',text:'Khu điện mặt trời và turbine gió. Chuyển động môi trường mang tính minh họa.'},
    storage: {number:'05',label:'PowerStack · PowerTitan',text:'Mô hình 3D dựng theo ngoại hình sản phẩm Sungrow trong ảnh tham khảo.'},
    receive: {number:'01', label:'Tiếp nhận', text:'Nhân viên nhận thiết bị, quét thông tin và đưa máy vào khu chờ xử lý.'},
    repair: {number:'02', label:'Sửa chữa', text:'Kỹ thuật viên kiểm tra lỗi, tháo kiểm tra cụm linh kiện và xử lý trên bàn sửa chữa.'},
    test: {number:'03', label:'Kiểm thử', text:'Đội kỹ thuật đưa thiết bị lên bàn test để kiểm tra chức năng sau sửa chữa.'},
    handover: {number:'04', label:'Bàn giao', text:'Nhân viên đóng gói, đối chiếu hồ sơ và chuẩn bị thiết bị để trả khách.'}
  };
  const statusToStage = new Map([
    ['Đã nhận hàng','receive'],['Đang test','test'],['Hoàn tất kỹ thuật','handover'],['Đã sửa chữa','handover'],
    ['Mới tiếp nhận','receive'],['Đang xử lý','repair'],['Đang sửa chữa','repair'],
    ['Đang kiểm tra','repair'],['Chờ linh kiện','repair'],['Chờ test','test'],
    ['Đang kiểm thử','test'],['Chờ giao','handover'],['Đã trả','handover'],
    ['Sẵn sàng trả khách','handover'],['Đã giao máy','handover']
  ]);
  let current = 'all';
  let night = false;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cases = [];
  let caseIndex = 0;
  let caseButtons = [];
  let map;
  let signature = '';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let queueFrame = 0;
  let queueTime = 0;
  let queuePosition = 0;
  let lastQueueScroll = 0;
  let cycleLength = 0;
  let rowOffsets = [];
  let manualUntil = 0;

  function stopQueueScroll() {
    cancelAnimationFrame(queueFrame);
    queueFrame = 0;
    queueTime = 0;
  }

  function measureQueue() {
    const first = caseButtons[0];
    const last = caseButtons.at(-1);
    const copy = queue.querySelector('[data-sc-repeat]');
    const canLoop = !!(first && last && copy && queue.clientHeight &&
      last.offsetTop + last.offsetHeight - first.offsetTop > queue.clientHeight);
    queue.toggleAttribute('data-loop', canLoop);
    rowOffsets = canLoop ? caseButtons.map(row => row.offsetTop - first.offsetTop) : [];
    cycleLength = canLoop ? copy.offsetTop - first.offsetTop : 0;
    wakeQueue();
  }

  function wakeQueue() {
    if (!queueFrame && playing && cycleLength && !landing.hidden && !document.hidden && !reducedMotion.matches) {
      queueFrame = requestAnimationFrame(advanceQueue);
    }
  }

  function advanceQueue(now) {
    queueFrame = 0;
    if (!playing || !cycleLength || landing.hidden || document.hidden || reducedMotion.matches) {
      queueTime = 0;
      return;
    }
    const elapsed = queueTime ? Math.min(now - queueTime, 64) : 0;
    queueTime = now;
    const currentScroll = queue.scrollTop;
    if (currentScroll !== lastQueueScroll) queuePosition = currentScroll;
    if (now >= manualUntil && !queue.matches(':hover') && !queue.querySelector(':focus-visible')) {
      // Both copies are visually identical, so crossing this boundary does not move the rows on screen.
      queuePosition = (queuePosition + elapsed * .022) % cycleLength;
      queue.scrollTop = queuePosition;
      const index = rowOffsets.findLastIndex(offset => offset <= queuePosition + .5);
      if (index >= 0 && index !== caseIndex) showCase(index);
    }
    lastQueueScroll = queue.scrollTop;
    wakeQueue();
  }

  function delayAutoScroll() {
    manualUntil = performance.now() + 1800;
  }

  queue.addEventListener('wheel', delayAutoScroll, {passive:true});
  queue.addEventListener('pointerdown', delayAutoScroll);
  queue.addEventListener('keydown', delayAutoScroll);
  document.addEventListener('visibilitychange', () => {
    stopQueueScroll();
    wakeQueue();
  });
  reducedMotion.addEventListener('change', () => {
    stopQueueScroll();
    wakeQueue();
  });
  new ResizeObserver(measureQueue).observe(queue);
  let readCases = () => null;
  let caseDataReady = false;
  let readSummary = () => null;
  let summarySignature;
  let onOpenCase = null;
  let onReturn = null;
  const completed = new Set(['Đã trả','Đã giao máy','Hoàn thành','Không sửa chữa']);
  const waiting = new Set(['Chờ linh kiện','Chờ test','Chờ giao','Sẵn sàng trả khách','Hoàn tất kỹ thuật','Đã sửa chữa']);
  const feed = landing.querySelector('.sc-feed');
  const sourceLabel = landing.querySelector('.sc-feed-source');
  // Connect only to an authenticated, already scoped dashboard snapshot.
  globalThis.SungrowServiceScene = Object.freeze({
    connect({read, readSummary: getSummary, label = 'Đồng bộ từ dashboard', onOpenCase: openCase, onReturn: returnToDashboard}) {
      if (typeof read !== 'function') throw new TypeError('read phải trả về danh sách case đã phân quyền');
      globalThis.ServiceSessionChart?.reset();
      readCases = read;
      readSummary = typeof getSummary === 'function' ? getSummary : () => null;
      summarySignature = undefined;
      onOpenCase = openCase;
      onReturn = returnToDashboard;
      sourceLabel.textContent = label;
      signature = '';
      refreshCases();
    },
    refresh: () => refreshCases(),
    clear() { globalThis.ServiceSessionChart?.reset(); readCases = () => null; readSummary = () => null; summarySignature = undefined; signature = ''; sourceLabel.textContent = 'Chưa kết nối dữ liệu'; refreshCases(); }
  });

  function select(id) {
    const station = stations[id];
    current = id;
    landing.querySelectorAll('[data-sc-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.scView === id));
    });
    kicker.textContent = station ? 'CÔNG ĐOẠN ' + station.number : 'CHU TRÌNH DỊCH VỤ';
    title.textContent = station?.label ?? 'Từ tiếp nhận đến bàn giao';
    copy.textContent = station?.text ?? 'Chọn một công đoạn để quan sát thao tác của nhân viên.';
    map?.focus(id);
  }

  function showCase(index, inspect = false) {
    const item = cases[index];
    caseIndex = index;
    const stage = item ? statusToStage.get(item.status) : undefined;
    landing.querySelector('[data-sc-count]').textContent = item ? (index + 1) + ' / ' + cases.length : '0';
    landing.querySelector('[data-sc-case-title]').textContent = item?.id ?? 'Chưa có hồ sơ';
    landing.querySelector('[data-sc-case-meta]').textContent = item ? [item.model,item.center].filter(Boolean).join(' · ') : 'Không có hồ sơ trong phạm vi đang xem.';
    const status = landing.querySelector('[data-sc-case-status]');
    status.textContent = item?.status || '—';
    status.dataset.stage = stage || '';
    destination.hidden = !item;
    destination.dataset.ticket = item?.id ?? '';
    for (const button of queue.children) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.scCase) === index));
    }
    if (inspect && stage) select(stage);
    else if (current === 'all') map?.highlight(stage);
  }

  function refreshSummary() {
    const summary = readSummary();
    const next = JSON.stringify(summary);
    if (summarySignature === next) return;
    const previousScope = summarySignature && JSON.parse(summarySignature)?.scope;
    summarySignature = next;
    landing.querySelector('[data-sc-summary-scope]').textContent = summary?.scope || 'Trong phạm vi dashboard';
    const format = new Intl.NumberFormat('vi-VN');
    const available = value => Number.isFinite(value);
    const active = available(summary?.processing) && available(summary?.waitingDelivery)
      ? summary.processing + summary.waitingDelivery : null;
    const totals = {total:summary?.received, active, waiting:summary?.waitingDelivery};
    landing.querySelectorAll('[data-sc-metric]').forEach(element => {
      const value = totals[element.dataset.scMetric];
      element.textContent = available(value) ? format.format(value) : '—';
    });
    const percent = available(summary?.slaRate) ? Math.round(summary.slaRate * 100) : null;
    landing.querySelector('[data-sc-percent]').textContent = percent === null ? '—' : percent + '%';
    const donut = landing.querySelector('.sc-donut');
    donut.style.setProperty('--progress',(percent ?? 0)+'%');
    donut.setAttribute('aria-label',percent === null ? 'Chưa có tỷ lệ SLA' : percent+'% đạt SLA 7 ngày');
    landing.querySelector('[data-sc-ratio]').textContent = available(summary?.slaMet) && available(summary?.slaEligible)
      ? format.format(summary.slaMet)+' / '+format.format(summary.slaEligible)+' đạt' : '—';
    const waitingShare = active > 0 && available(summary?.waitingDelivery)
      ? Math.round(summary.waitingDelivery / active * 100) : null;
    landing.querySelector('[data-sc-wait-bar]').style.width = (waitingShare ?? 0)+'%';
    landing.querySelector('[data-sc-wait-ratio]').textContent = waitingShare === null ? '—' : waitingShare+'% tồn cuối kỳ';
    if (!summary || previousScope !== summary.scope) globalThis.ServiceSessionChart?.reset();
    if (available(active) && available(summary?.returned)) {
      globalThis.ServiceSessionChart?.update({active,finished:summary.returned});
    }
  }

  const auditDialog = landing.querySelector('.sc-audit');
  let auditStage = '';
  let stageCases = new Map();
  function showStageAudit(stage) {
    auditStage = stage;
    const rows = stageCases.get(stage) || [];
    auditDialog.querySelector('#sc-audit-title').textContent = stations[stage].label+' · '+(caseDataReady ? rows.length+' hồ sơ' : 'Chưa có dữ liệu');
    const statuses = [...statusToStage].filter(([status,id]) => id === stage && !completed.has(status)).map(([status])=>status);
    auditDialog.querySelector('[data-sc-audit-statuses]').textContent = 'Trạng thái được tính: '+statuses.join(', ')+'.';
    const list = auditDialog.querySelector('[data-sc-audit-list]');
    list.replaceChildren();
    for (const item of rows) {
      const li = document.createElement('li');
      const id = document.createElement('strong');
      id.textContent = item.id;
      const details = document.createElement('span');
      details.textContent = [item.model,item.center,item.status,item.receivedDate?.split('-').reverse().join('/')].filter(Boolean).join(' · ');
      li.append(id,details);
      if (onOpenCase) {
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = 'Mở hồ sơ';
        open.setAttribute('aria-label','Mở hồ sơ '+item.id);
        open.addEventListener('click',()=>onOpenCase(item.id));
        li.append(open);
      }
      list.append(li);
    }
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.textContent = caseDataReady ? 'Không có hồ sơ phù hợp trong kỳ.' : sourceLabel.textContent;
      list.append(empty);
    }
    if (!auditDialog.open) auditDialog.showModal();
  }
  auditDialog.addEventListener('close',()=>{auditStage='';});

  function refreshCases() {
    refreshSummary();
    const data = readCases();
    const rows = Array.isArray(data) ? data : data?.rows;
    const next = rows || [];
    caseDataReady = Array.isArray(rows);
    if (data?.label && sourceLabel.textContent !== data.label) sourceLabel.textContent = data.label;
    const nextSignature = JSON.stringify([caseDataReady, data?.label, next]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    const previous = cases[caseIndex]?.id;
    cases = next.map(item => ({...item}));
    const counts = {}, working = {};
    stageCases = new Map();
    for (const item of cases) {
      if (completed.has(item.status)) continue;
      const stage = statusToStage.get(item.status);
      if (!stage) continue;
      const members = stageCases.get(stage) || [];
      members.push(item);
      stageCases.set(stage,members);
      counts[stage] = members.length;
      if (!waiting.has(item.status)) working[stage] = (working[stage] || 0) + 1;
    }
    const slots = new Map();
    const sceneRows = cases.flatMap(item => {
      const stage = statusToStage.get(item.status);
      const closed = completed.has(item.status);
      if (closed) return [{id:item.id,stage,closed,status:item.status}];
      if (!stage || (slots.get(stage) || 0) >= 6) return [];
      slots.set(stage,(slots.get(stage) || 0)+1);
      return [{id:item.id,stage,closed,status:item.status}];
    });
    map?.syncCases(counts,working,sceneRows,caseDataReady);
    const recentOpen = cases.filter(item => !completed.has(item.status)).length;
    const bars=landing.querySelector('[data-sc-bars]');
    bars.replaceChildren();
    for(const stage of ['receive','repair','test','handover']) {
      const row=document.createElement('button');row.type='button';row.className='sc-bar-row';row.dataset.scAudit=stage;row.setAttribute('aria-haspopup','dialog');
      const label=document.createElement('span');label.textContent=stations[stage].label;
      const value=document.createElement('b');value.textContent=caseDataReady ? String(counts[stage]||0) : '—';
      const track=document.createElement('div');track.className='sc-progress';
      const fill=document.createElement('i');fill.style.width=(recentOpen?(counts[stage]||0)/recentOpen*100:0)+'%';
      track.append(fill);row.append(label,value,track);bars.append(row);
    }
    for (const stage of ['receive','repair','test','handover']) {
      const button=landing.querySelector('.sc-stations [data-sc-view="'+stage+'"]');
      let count=button.querySelector('.sc-flow-count');
      if (!count) { count=document.createElement('b'); count.className='sc-flow-count'; button.append(count); }
      count.textContent=caseDataReady ? String(counts[stage] || 0) : '—';
      button.title=caseDataReady ? (counts[stage] || 0)+' hồ sơ tại công đoạn' : 'Chưa có dữ liệu';
    }
    if (auditDialog.open && auditStage) showStageAudit(auditStage);
    caseButtons = cases.map((item,index) => {
      const button = document.createElement('button');
      button.className = 'sc-case-row';
      button.type = 'button';
      button.dataset.scCase = String(index);
      const label = document.createElement('span');
      const code = document.createElement('strong');
      code.textContent = item.id;
      const info = document.createElement('small');
      info.textContent = [item.model,item.center].filter(Boolean).join(' · ');
      label.append(code,info);
      const status = document.createElement('span');
      status.className = 'sc-case-status';
      status.textContent = item.status || '—';
      status.dataset.stage = statusToStage.get(item.status) || '';
      button.append(label,status);
      return button;
    });
    const copies = caseButtons.map(button => {
      const copy = button.cloneNode(true);
      copy.dataset.scRepeat = '';
      copy.setAttribute('aria-hidden','true');
      copy.tabIndex = -1;
      return copy;
    });
    queue.replaceChildren(...caseButtons, ...copies);
    queuePosition = lastQueueScroll = queue.scrollTop = 0;
    measureQueue();
    showCase(Math.max(0,cases.findIndex(item => item.id === previous)));
  }

  function syncPlayback() {
    if (playing) wakeQueue();
    else stopQueueScroll();
    landing.dataset.playback = playing ? 'playing' : 'paused';
    playbackButton.textContent = playing ? 'Tạm dừng' : 'Tiếp tục';
    playbackButton.setAttribute('aria-pressed',String(!playing));
    map?.wake();
  }

  landing.addEventListener('click', event => {
    if (event.target.closest('a.sc-exit') && onReturn) {
      event.preventDefault();
      onReturn();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button === destination && onOpenCase && button.dataset.ticket) {
      event.preventDefault();
      onOpenCase(button.dataset.ticket);
      return;
    }
    const stage = button.dataset.scAudit || (button.classList.contains('sc-marker') ? button.dataset.scView : '');
    if (stage && ['receive','repair','test','handover'].includes(stage)) {
      showStageAudit(stage);
      return;
    }
    if (button.dataset.scView) select(button.dataset.scView);
    if (button.hasAttribute('data-sc-case')) showCase(Number(button.dataset.scCase),true);
    if (button === playbackButton) {
      playing = !playing;
      syncPlayback();
    }
    if (button.dataset.scCamera === 'reset') select('all');
    if (button.dataset.scCamera === 'in') map?.zoom(.82);
    if (button.dataset.scCamera === 'out') map?.zoom(1.22);
    if (button === timeButton) {
      night = !night;
      landing.dataset.time = night ? 'night' : 'day';
      button.setAttribute('aria-pressed', String(!night));
      button.setAttribute('aria-label', night ? 'Bật cảnh ban ngày' : 'Bật cảnh ban đêm');
      button.innerHTML = night ? "<svg class=\"sc-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0\"/></svg><span>Ban ngày</span>" : "<svg class=\"sc-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z\"/></svg><span>Ban đêm</span>";
      map?.light(night);
    }
  });
  syncPlayback();
  setInterval(() => { if (!document.hidden) refreshCases(); }, 1000);
  dashboard.addEventListener('change',refreshCases);
  window.addEventListener('sungrow:cases-updated',refreshCases);
  new MutationObserver(() => { if (!landing.hidden) { refreshCases(); measureQueue(); } })
    .observe(landing,{attributes:true,attributeFilter:['hidden']});

  function createMap(T, buildWorld) {
    const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new T.Scene();
    const skyCanvas=document.createElement('canvas');skyCanvas.width=1024;skyCanvas.height=512;
    const skyContext=skyCanvas.getContext('2d'),skyGradient=skyContext.createLinearGradient(0,0,0,512);
    skyGradient.addColorStop(0,'#6e9db5');skyGradient.addColorStop(.43,'#d7e4e5');skyGradient.addColorStop(.52,'#f3eee0');skyGradient.addColorStop(.65,'#aab49d');skyGradient.addColorStop(1,'#596b60');
    skyContext.fillStyle=skyGradient;skyContext.fillRect(0,0,1024,512);
    const environment=new T.CanvasTexture(skyCanvas);environment.mapping=T.EquirectangularReflectionMapping;environment.colorSpace=T.SRGBColorSpace;scene.environment=environment;scene.environmentIntensity=.75;
    scene.fog = new T.FogExp2('#bac9c8', .0025);
    const camera = new T.OrthographicCamera(-10, 10, 10, -10, .1, 140);
    const sky = new T.HemisphereLight('#c9dfff', '#515b77', 1.66);
    scene.add(sky);
    const key = new T.DirectionalLight('#c9d6ff', 2.0);
    key.position.set(-17, 28, 12);
    key.castShadow = true;
    Object.assign(key.shadow.camera, {left:-52, right:52, top:52, bottom:-52, near:1, far:130});
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.normalBias = .035;
    scene.add(key);
    const rim = new T.DirectionalLight('#9dbbf0', .60);
    rim.position.set(18, 13, -20);
    scene.add(rim);
    const {hitGroups, markers, rings, animate, setWorkload, setCases} = buildWorld(scene);

    const bulbs = [];
    for (const id of ['receive','repair','test','handover']) {
      const position = markers.get(id);
      const bulb = new T.PointLight('#ffb36f', 6.5, 5.6, 2);
      const loc = hitGroups.find(group => group.userData.station === id).position;
      bulb.position.set(position.x, loc.y + 2.48, loc.z - 1.45);
      bulbs.push(bulb);
      scene.add(bulb);
    }
    const markerButtons = new Map();
    for (const [id, station] of Object.entries(stations)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sc-marker';
      button.dataset.scView = id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '<span aria-hidden="true">' + station.number + '</span>' + station.label;
      markerLayer.append(button);
      markerButtons.set(id, button);
    }

    const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = matchMedia('(max-width: 760px)');
    const raycaster = new T.Raycaster();
    const point = new T.Vector3();
    const cameraOffset = new T.Vector3();
    const target = new T.Vector3();
    const pointers = new Map();
    let width = 1;
    let height = 1;
    let span = 17;
    let azimuth = .22;
    let elevation = .65;
    let animation;
    let frame = 0;
    let gestureTravel = 0;
    let lastFrame = 0;
    let motionTime = 0;
    let shadowFrame = 0;

    function homeSpan() {
      return Math.max(narrow.matches ? 24 : 29, 19 * height / width);
    }

    function homeTarget() {
      return new T.Vector3(5, 2.8, -3);
    }

    function placeCamera() {
      const aspect = width / height;
      camera.left = -span * aspect;
      camera.right = span * aspect;
      camera.top = span;
      camera.bottom = -span;
      cameraOffset.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation),
        Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(50);
      camera.position.copy(target).add(cameraOffset);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }

    const metricsPanel = landing.querySelector('.sc-metrics');
    const informationPanel = landing.querySelector('.sc-information');
    let cameraState = '';
    let markerLayoutDirty = true;

    function invalidateMarkerLayout() {
      markerLayoutDirty = true;
      invalidate();
    }

    function placeMarkers() {
      const screen = canvas.getBoundingClientRect();
      const feedBounds = feed.getBoundingClientRect();
      const metrics = metricsPanel.getBoundingClientRect();
      const serviceStages = ['receive','repair','test','handover'];
      const priority = current === 'all' ? serviceStages : [current, ...serviceStages];
      const order = [...new Set([...priority, ...Object.keys(stations)])];
      markerLayer.classList.add('sc-measuring');
      const sizes = new Map(order.map(id => {
        const button = markerButtons.get(id);
        return [id, {width:button.offsetWidth, height:button.offsetHeight}];
      }));
      markerLayer.classList.remove('sc-measuring');

      const reserved = [feedBounds, metrics].map(rect => ({
        left:rect.left-screen.left, right:rect.right-screen.left,
        top:rect.top-screen.top, bottom:rect.bottom-screen.top
      }));
      function overlapsBounds(a,b) { return a.left < b.right+5 && a.right > b.left-5 &&
        a.top < b.bottom+5 && a.bottom > b.top-5; }

      const topLimit = narrow.matches ? 96 : 70;
      for (const id of order) {
        const button = markerButtons.get(id);
        const size = sizes.get(id);
        point.copy(markers.get(id)).project(camera);
        const anchorX = (point.x+1)*width/2;
        const anchorY = (1-point.y)*height/2;
        const overviewStage = current === 'all' && serviceStages.includes(id);
        let placement;
        if (Math.abs(point.z)<=1 && (overviewStage || (anchorX>=0 && anchorX<=width && anchorY>=0 && anchorY<=height))) {
          const x = T.MathUtils.clamp(anchorX,size.width/2+5,width-size.width/2-5);
          const baseY = overviewStage
            ? T.MathUtils.clamp(anchorY,topLimit+size.height,height-100)
            : anchorY;
          const step = size.height+12;
          const offsets = overviewStage ? [0, -step, step, -2*step, 2*step, -3*step, 3*step] : [0];
          for (const offset of offsets) {
            const y = baseY+offset;
            const bounds = {left:x-size.width/2,right:x+size.width/2,top:y-size.height,bottom:y};
            if (bounds.top<topLimit || y>height-100 || reserved.some(rect=>overlapsBounds(bounds,rect))) continue;
            placement = {x,y};
            reserved.push(bounds);
            break;
          }
        }
        button.hidden = !placement;
        if (placement) button.style.transform = `translate(${placement.x.toFixed(1)}px,${placement.y.toFixed(1)}px)`;
      }
    }

    function render(now) {
      frame = 0;
      if (landing.hidden || document.hidden) {
        lastFrame = 0;
        return;
      }
      const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000,.08) : 0;
      if (playing && !animation && lastFrame && now - lastFrame < 31) {
        invalidate();
        return;
      }
      lastFrame = now;
      if (animation) {
        const progress = T.MathUtils.clamp((now - animation.start) / 540, 0, 1);
        const ease = progress * progress * (3 - 2 * progress);
        target.lerpVectors(animation.from, animation.to, ease);
        span = T.MathUtils.lerp(animation.fromSpan, animation.toSpan, ease);
        azimuth = T.MathUtils.lerp(animation.fromAzimuth, animation.toAzimuth, ease);
        elevation = T.MathUtils.lerp(animation.fromElevation, animation.toElevation, ease);
        if (progress === 1) animation = null;
      }
      if (playing) {
        motionTime += elapsed;
        animate(motionTime);
        if(++shadowFrame%4===0)renderer.shadowMap.needsUpdate=true;
      }
      const nextCameraState = [width, height, span, azimuth, elevation, target.x, target.y, target.z, current].join(',');
      if (nextCameraState !== cameraState) {
        cameraState = nextCameraState;
        placeCamera();
        markerLayoutDirty = true;
      }
      if (markerLayoutDirty) {
        markerLayoutDirty = false;
        placeMarkers();
      }
      renderer.render(scene, camera);
      if (playing || animation) invalidate();
    }

    function invalidate() {
      if (!frame && !landing.hidden && !document.hidden) frame = requestAnimationFrame(render);
    }

    function highlight(id) {
      for (const [key, ring] of rings) ring.visible = id === key;
      invalidate();
    }

    function focus(id, animate = true) {
      const station = hitGroups.find(group => group.userData.station === id);
      const offset = station ? station.position.clone() : homeTarget();
      if (station) offset.y += narrow.matches ? 1.15 : 1.22;
      if(id==='energy')offset.set(36,6,-23);
      if(id==='storage')offset.set(39,2,3);
      if(id==='receive'||id==='handover')offset.z=-.5;
      const toSpan = id === 'storage' ? 10 : id === 'fpv' ? 19 : id === 'energy' ? 27 : id==='receive'||id==='handover' ? (narrow.matches?15:11.5) : station ? (narrow.matches ? Math.max(8.5, 6 * height / width) : 8.5) : homeSpan();
      const toAzimuth = station ? azimuth : .22;
      const toElevation = station ? elevation : .65;
      highlight(station ? id : statusToStage.get(cases[caseIndex]?.status));
      if (!animate || prefersReducedMotion.matches) {
        animation = null;
        target.copy(offset);
        span = toSpan;
        azimuth = toAzimuth;
        elevation = toElevation;
      } else {
        animation = {start:performance.now(), from:target.clone(), to:offset, fromSpan:span, toSpan,
          fromAzimuth:azimuth, toAzimuth, fromElevation:elevation, toElevation};
      }
      invalidate();
    }

    function zoom(factor) {
      animation = null;
      span = T.MathUtils.clamp(span * factor, narrow.matches ? 6.3 : 4.8, homeSpan() * 1.37);
      invalidate();
    }

    function light(isNight) {
      scene.fog.color.set(isNight ? '#253949' : '#c8d5cf');
      scene.environmentIntensity=isNight?.16:.75;
      sky.color.set(isNight ? '#c9dfff' : '#deefff');
      sky.groundColor.set(isNight ? '#515b77' : '#8b9ba4');
      sky.intensity = isNight ? .9 : 1.35;
      key.color.set(isNight ? '#c9d6ff' : '#f5f8ff');
      key.intensity = isNight ? 1.4 : 3.4;
      key.position.set(isNight ? -35 : -30, isNight ? 48 : 58, isNight ? 25 : 28);
      rim.intensity = isNight ? .60 : .39;
      bulbs.forEach(bulb => { bulb.visible = isNight; });
      renderer.shadowMap.needsUpdate = true;
      invalidate();
    }

    function resize() {
      const nextWidth = worldElement.clientWidth;
      const nextHeight = worldElement.clientHeight;
      if (!nextWidth || !nextHeight) return;
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        renderer.setSize(width, height, false);
        focus(current, false);
      }
      invalidate();
    }

    function pick(event) {
      const rect = canvas.getBoundingClientRect();
      const ndc = new T.Vector2((event.clientX - rect.left) / width * 2 - 1, 1 - (event.clientY - rect.top) / height * 2);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(hitGroups, true);
      const hit = hits.find(item => item.object.visible);
      if (!hit) return;
      let object = hit.object;
      while (object && !object.userData.station) object = object.parent;
      if (object) select(object.userData.station);
    }

    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      animation = null;
      if (!pointers.size) gestureTravel = 0;
      pointers.set(event.pointerId, new T.Vector2(event.clientX, event.clientY));
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const next = new T.Vector2(event.clientX, event.clientY);
      const distance = previous.distanceTo(next);
      gestureTravel += distance;
      if (pointers.size === 2) {
        const other = [...pointers].find(([id]) => id !== event.pointerId)[1];
        zoom(previous.distanceTo(other) / Math.max(8, next.distanceTo(other)));
      } else if (gestureTravel > 5) {
        if(event.shiftKey) {
          const dx=(next.x-previous.x)*span*2/height;
          const dz=(next.y-previous.y)*span*2/height;
          target.x -= Math.cos(azimuth)*dx+Math.sin(azimuth)*dz;
          target.z += Math.sin(azimuth)*dx-Math.cos(azimuth)*dz;
          target.x=T.MathUtils.clamp(target.x,-38,38);
          target.z=T.MathUtils.clamp(target.z,-38,38);
        } else {
          azimuth -= (next.x - previous.x) * .006;
          elevation = T.MathUtils.clamp(elevation + (next.y - previous.y) * .004, .34, 1.20);
        }
        invalidate();
      }
      previous.copy(next);
    });
    canvas.addEventListener('pointerup', event => {
      if (pointers.size === 1 && pointers.has(event.pointerId) && gestureTravel < 6) pick(event);
      pointers.delete(event.pointerId);
    });
    canvas.addEventListener('pointercancel', event => pointers.delete(event.pointerId));
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom(Math.exp(T.MathUtils.clamp(event.deltaY * .001, -.30, .30)));
    }, {passive:false});
    new ResizeObserver(resize).observe(worldElement);
    new MutationObserver(() => {
      if (!landing.hidden) resize();
    }).observe(landing, {attributes:true, attributeFilter:['hidden']});
    const overlayObserver = new ResizeObserver(invalidateMarkerLayout);
    [informationPanel, metricsPanel, feed].filter(Boolean).forEach(panel => overlayObserver.observe(panel));
    informationPanel?.addEventListener('scroll', invalidateMarkerLayout, {passive:true});
    document.addEventListener('visibilitychange', () => {
      lastFrame = 0;
      invalidateMarkerLayout();
    });
    resize();
    light(night);
    function syncCases(counts,working,rows,ready) {
      setWorkload(working);
      setCases(rows);
      renderer.shadowMap.needsUpdate=true;
      for (const [id,button] of markerButtons) {
        if (id === 'storage' || id === 'energy' || id === 'fpv') continue;
        let badge = button.querySelector('.sc-work-count');
        if (!badge) { badge = document.createElement('small'); badge.className='sc-work-count'; button.append(badge); }
        badge.textContent = ready ? String(counts[id] || 0) : '—';
        button.toggleAttribute('data-working', Boolean(working[id]));
        button.title = ready ? (counts[id] || 0) + ' hồ sơ · ' + (working[id] || 0) + ' đang xử lý' : 'Chưa có dữ liệu';
      }
      invalidateMarkerLayout();
    }
    return {focus, zoom, light, highlight, syncCases, wake:()=>{renderer.shadowMap.needsUpdate=true;invalidate();}};
  }

  try {
    map = createMap(globalThis.THREE, globalThis.ServiceCampusWorld.buildWorld);
  } catch (error) {
    console.warn('Không thể mở bản đồ 3D:', error.message);
    landing.querySelector('.sc-fallback').hidden = false;
    landing.querySelector('.sc-camera').hidden = true;
    landing.querySelector('.sc-gesture').hidden = true;
    timeButton.hidden = true;
  }
  refreshCases();
})();
