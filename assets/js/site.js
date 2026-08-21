/* ==========================================================================
   Tenn95 — shared header/footer injection + analytics helper
   Loaded on every page. Keeps the header/footer/logo/tristar in one place
   so a design change only has to happen here.
   ========================================================================== */

const TRISTAR_SVG = `<svg class="tristar-icon" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="56" fill="#1B2A41"/>
  <polygon points="56.82,56.82 40.79,48.88 28.01,61.38 30.6,43.69 14.76,35.39 32.39,32.39 35.39,14.76 43.69,30.6 61.38,28.01 48.88,40.79" fill="#fff"/>
  <polygon points="64.35,58.83 79.23,48.93 74.8,31.6 88.83,42.69 103.93,33.13 97.72,49.89 111.48,61.3 93.62,60.57 87.02,77.19 82.19,59.98" fill="#fff"/>
  <polygon points="58.83,64.35 59.98,82.19 77.19,87.02 60.57,93.62 61.3,111.48 49.89,97.72 33.13,103.93 42.69,88.83 31.6,74.8 48.93,79.23" fill="#fff"/>
</svg>`;

function renderHeader(activePage){
  const pages = [
    {id:'home', label:'Home', href:'index.html'},
    {id:'archives', label:'Archives', href:'archives.html'},
    {id:'events', label:'Events', href:'events.html'},
    {id:'community', label:'Community', href:'community.html'},
  ];
  const nav = pages.map(p =>
    `<a href="${p.href}" class="${p.id===activePage ? 'current' : ''}">${p.label}</a>`
  ).join('');

  document.querySelectorAll('[data-site-header]').forEach(el => {
    el.innerHTML = `
      <div class="wordmark">
        <a href="index.html"><img src="assets/img/tenn95-logo.png" alt="Tenn95 logo"></a>
      </div>
      <nav class="main-nav">${nav}</nav>
    `;
  });
}

function renderFooter(){
  document.querySelectorAll('[data-site-footer]').forEach(el => {
    el.innerHTML = `
      <div class="fname">${TRISTAR_SVG}TENN95</div>
      <div>A community archive for Tennessee license plate collectors.</div>
      <div class="flinks">
        <a href="archives.html">Archives</a>
        <a href="events.html">Events</a>
        <a href="community.html">Community</a>
      </div>
    `;
  });
}

function plateCardHTML(p){
  const photo = p.photoUrl ? `style="background-image:url('${p.photoUrl}')"` : '';
  const noPhoto = p.photoUrl ? '' : '<span class="no-photo">No photo yet</span>';
  const countyName = p._countyName || p.countyName;
  const meta = [
    countyName ? `${countyName} County` : '',
    p.year || '',
    p.type ? `<span class="type">${p.type}</span>` : '',
  ].filter(Boolean).join(' <span class="sep">·</span> ');

  return `
    <div class="plate-card">
      <div class="plate-photo" ${photo}>${noPhoto}</div>
      <div class="plate-meta"><div class="plate-meta-line">${meta}</div></div>
    </div>`;
}

function initBackToTop(){
  const btn = document.createElement('button');
  btn.textContent = '↑';
  btn.setAttribute('aria-label', 'Back to top');
  btn.className = 'back-to-top';
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  });
  btn.addEventListener('click', () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
}

/* ---------- Analytics helper ----------
   TODO: sign up at https://www.goatcounter.com (free) and replace CODE
   below with your site code before launch. The <script> tag itself lives
   in each page's <head> — see index.html for the exact tag to add.
   trackEvent() is a thin wrapper so archive.js can log searches/filters
   without caring which analytics tool is behind it. Confirm this call
   shape against GoatCounter's current docs before relying on it — their
   custom-event API has changed before.
------------------------------------------------------------------ */
function trackEvent(path, title){
  if (window.goatcounter && typeof window.goatcounter.count === 'function') {
    window.goatcounter.count({ path, title, event: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const active = document.body.dataset.page || '';
  renderHeader(active);
  renderFooter();
  initBackToTop();
});
