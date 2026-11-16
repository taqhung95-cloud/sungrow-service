(() => {
  const dashboard = document.getElementById('sg-preview');
  const landing = document.getElementById('sc-landing');
  const title = document.getElementById('sc-landing-title');
  const breadcrumb = document.getElementById('sg-crumb');
  const information=document.createElement('div');
  information.className='sc-information';information.setAttribute('aria-label','Thông tin vận hành');
  information.append(landing.querySelector('.sc-metrics'));
  const operations = landing.querySelector('.sc-operations');
  operations.append(information);
  const metrics = information.querySelector('.sc-metrics');
  new ResizeObserver(() => {
    const height = metrics.getBoundingClientRect().height;
    if (height > 0) operations.style.setProperty('--sc-panel-height', height + 'px');
  }).observe(metrics);
  const expand=document.createElement('button');expand.type='button';expand.className='sc-analytics-toggle';expand.textContent='Chi tiết vận hành';expand.setAttribute('aria-expanded','false');
  expand.addEventListener('click',()=>{const open=information.classList.toggle('is-expanded');expand.setAttribute('aria-expanded',String(open));expand.textContent=open?'Thu gọn':'Chi tiết vận hành';});
  information.querySelector('.sc-metrics').append(expand);

  function showLanding(focusTitle) {
    landing.hidden = false;
    dashboard.classList.add('sc-landing-open');
    dashboard.querySelectorAll('.sg-nav [aria-current]').forEach(item => {
      item.removeAttribute('aria-current');
    });
    dashboard.querySelector('[data-sc-home]')?.setAttribute('aria-current', 'page');
    if (focusTitle) {
      if (dashboard.classList.contains('mobile-menu-open')) {
        dashboard.querySelector('.mobile-menu-close')?.click();
      }
      title.focus();
      window.scrollTo(0, 0);
    }
  }

  dashboard.addEventListener('click', event => {
    if (event.target.closest('[data-sc-home]')) {
      showLanding(true);
    } else if (!landing.hidden && event.target.closest('button[data-page], button[data-go]')) {
      landing.hidden = true;
      dashboard.classList.remove('sc-landing-open');
      dashboard.querySelector('[data-sc-home]')?.removeAttribute('aria-current');
      breadcrumb.tabIndex = -1;
      breadcrumb.focus();
      window.scrollTo(0, 0);
    }
  });

  document.addEventListener('DOMContentLoaded', () => showLanding(false), { once: true });
})();
