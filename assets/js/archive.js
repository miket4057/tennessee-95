/* ==========================================================================
   Tenn95 — Archive page
   All filtering/search/sort/pagination runs client-side against
   data/plates.json (no API calls at browse time — see scripts/sync-airtable.js
   for how that file gets built). No sample data is baked in here; an empty
   plates.json produces the empty state, not fake rows.
   ========================================================================== */

const DESKTOP_PAGE_SIZE = 24;
const MOBILE_PAGE_SIZE = 12;

let allPlates = [];
let state = {
  q: '',
  years: new Set(),
  counties: new Set(),
  types: new Set(),
  colors: new Set(),
  fontColors: new Set(),
  lowSerialNumber: false,
  sort: 'added-desc',
  page: 1,
};

function uniqueSorted(values){
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizePlate(p){
  const out = Object.assign({}, p);
  // Normalize county name: string, array of names/records, or missing
  let county = '';
  if (typeof p.countyName === 'string') county = p.countyName;
  else if (Array.isArray(p.countyName)) {
    const names = p.countyName.map(v => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && v.name) return v.name;
      return '';
    }).filter(Boolean);
    county = names.join(', ');
  }
  if (!county && p.countyNumber) county = `County ${p.countyNumber}`;
  out._countyName = county || '';

  // Normalize colors: accept string like "Black, White" or an array
  if (Array.isArray(p.colors)) out._colors = p.colors.filter(Boolean);
  else if (typeof p.colors === 'string') out._colors = p.colors.split(',').map(s => s.trim()).filter(Boolean);
  else out._colors = [];

  out._fontColors = Array.isArray(p.fontColor)
    ? p.fontColor.filter(Boolean)
    : typeof p.fontColor === 'string'
      ? p.fontColor.split(',').map(s => s.trim()).filter(Boolean)
      : [];

  // Normalize lowSerialNumber: handle string values from Airtable
  if (typeof p.lowSerialNumber === 'string') {
    out.lowSerialNumber = p.lowSerialNumber.toUpperCase() === 'TRUE';
  } else if (typeof p.lowSerialNumber === 'boolean') {
    out.lowSerialNumber = p.lowSerialNumber;
  } else {
    out.lowSerialNumber = false;
  }

  return out;
}

function buildFilterUI(){
  const years = uniqueSorted(allPlates.map(p => p.year)).sort((a,b) => a - b);
  const counties = uniqueSorted(allPlates.map(p => p._countyName));
  const types = uniqueSorted(allPlates.map(p => p.type));
  const colors = uniqueSorted(allPlates.flatMap(p => p._colors || []));
  const fontColors = uniqueSorted(allPlates.flatMap(p => p._fontColors || []));

  // Calculate dynamic counts for each filter category
  const yearCounts = countOptionsForCategory('years', years);
  const countyCounts = countOptionsForCategory('counties', counties);
  const typeCounts = countOptionsForCategory('types', types);
  const colorCounts = countOptionsForCategory('colors', colors);
  const fontColorCounts = countOptionsForCategory('fontColors', fontColors);

  document.getElementById('filter-year').innerHTML = years.map(y => `
    <label class="filter-option">
      <input type="checkbox" data-group="years" value="${y}">
      ${y} <span class="count">${yearCounts.get(y)}</span>
    </label>`).join('') || emptyFilterNote();

  document.getElementById('filter-county').innerHTML = counties.map(c => `
    <label class="filter-option">
      <input type="checkbox" data-group="counties" value="${c}">
      ${c} <span class="count">${countyCounts.get(c)}</span>
    </label>`).join('') || emptyFilterNote();

  document.getElementById('filter-type').innerHTML = types.map(t => `
    <label class="filter-option">
      <input type="checkbox" data-group="types" value="${t}">
      ${t} <span class="count">${typeCounts.get(t)}</span>
    </label>`).join('') || emptyFilterNote();

  const hasLowSerialPlates = allPlates.some(p => p.lowSerialNumber);
  if (hasLowSerialPlates) {
    // For low serial number, count plates that have it set (when all other filters + lowSerialNumber=true are applied)
    const tempState = {
      q: state.q,
      years: new Set(state.years),
      counties: new Set(state.counties),
      types: new Set(state.types),
      colors: new Set(state.colors),
      fontColors: new Set(state.fontColors),
      lowSerialNumber: true,
      sort: state.sort,
      page: 1,
    };
    const lowSerialCount = applyFilters(tempState).length;
    document.getElementById('filter-low-serial-number').innerHTML = `
      <label class="filter-option">
        <input type="checkbox" id="low-serial-checkbox" data-group="lowSerialNumber" value="true">
        Low Serial Number <span class="count">${lowSerialCount}</span>
      </label>`;
  } else {
    document.getElementById('filter-low-serial-number').innerHTML = emptyFilterNote();
  }

  const colorSwatch = {
    Black: '#2B2620',
    Blue: '#1B2A41',
    Green: '#3f5b3f',
    Maroon: '#800000',
    Navy: '#003366',
    Orange: '#FF8C00',
    Red: '#A63A2B',
    Silver: '#b7b7b7',
    White: '#F3EAD6',
    Yellow: '#e0c341'
  };
  document.getElementById('filter-color').innerHTML = colors.map(c => `
    <div class="swatch" data-group="colors" data-value="${c}" title="${c}"
      style="background:${colorSwatch[c] || '#999'}"></div>`).join('') || emptyFilterNote();
  document.getElementById('filter-font-color').innerHTML = fontColors.map(c => `
    <div class="swatch" data-group="fontColors" data-value="${c}" title="${c}"
      style="background:${colorSwatch[c] || '#999'}"></div>`).join('') || emptyFilterNote();

  document.querySelectorAll('#filter-year input, #filter-county input, #filter-type input, #filter-low-serial-number input')
    .forEach(el => el.addEventListener('change', onCheckboxChange));
  document.querySelectorAll('#filter-color .swatch')
    .forEach(el => el.addEventListener('click', onSwatchClick));
  document.querySelectorAll('#filter-font-color .swatch')
    .forEach(el => el.addEventListener('click', onSwatchClick));
}

function emptyFilterNote(){
  return `<div style="font-size:13px; color:#9c937a;">No plates yet</div>`;
}

function countOptionsForCategory(categoryName, options) {
  const counts = new Map();
  options.forEach(option => {
    // Create a temporary state with all active filters EXCEPT this category
    const tempState = {
      q: state.q,
      years: new Set(state.years),
      counties: new Set(state.counties),
      types: new Set(state.types),
      colors: new Set(state.colors),
      fontColors: new Set(state.fontColors),
      lowSerialNumber: state.lowSerialNumber,
      sort: state.sort,
      page: 1,
    };
    // Clear the current category so we can test this one option
    tempState[categoryName].clear();
    // Add the option we're counting (convert to string for years since applyFilters uses String(p.year))
    const optionValue = categoryName === 'years' ? String(option) : option;
    tempState[categoryName].add(optionValue);
    // Count how many plates match with this option + all other active filters
    const matchingPlates = applyFilters(tempState);
    counts.set(option, matchingPlates.length);
  });
  return counts;
}

function onCheckboxChange(e){
  const group = e.target.dataset.group;
  if (group === 'lowSerialNumber') {
    state.lowSerialNumber = e.target.checked;
  } else {
    const val = e.target.value;
    const setRef = state[group];
    e.target.checked ? setRef.add(val) : setRef.delete(val);
  }
  state.page = 1;
  render();
}

function onSwatchClick(e){
  const val = e.currentTarget.dataset.value;
  const group = e.currentTarget.dataset.group;
  const setRef = state[group];
  e.currentTarget.classList.toggle('on');
  setRef.has(val) ? setRef.delete(val) : setRef.add(val);
  state.page = 1;
  render();
}

function applyFilters(overrideState = null){
  const filterState = overrideState || state;
  const q = filterState.q.trim().toLowerCase();
  return allPlates.filter(p => {
    if (filterState.years.size && !filterState.years.has(String(p.year))) return false;
    if (filterState.counties.size && !filterState.counties.has(p._countyName)) return false;
    if (filterState.types.size && !filterState.types.has(p.type)) return false;
    if (filterState.colors.size && !(p._colors || []).some(c => filterState.colors.has(c))) return false;
    if (filterState.fontColors.size && !(p._fontColors || []).some(c => filterState.fontColors.has(c))) return false;
    if (filterState.lowSerialNumber && !p.lowSerialNumber) return false;
    if (q) {
      const hay = `${p._countyName || ''} ${p.serial || ''} ${p.year || ''} ${p.type || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortPlates(list){
  const copy = [...list];
  switch (state.sort) {
    case 'year-desc': return copy.sort((a,b) => (b.year||0) - (a.year||0));
    case 'year-asc': return copy.sort((a,b) => (a.year||0) - (b.year||0));
    case 'county-number-asc': return copy.sort((a,b) => {
      const aNumber = Number(a.countyNumber);
      const bNumber = Number(b.countyNumber);
      if (!Number.isFinite(aNumber)) return Number.isFinite(bNumber) ? 1 : 0;
      if (!Number.isFinite(bNumber)) return -1;
      return aNumber - bNumber;
    });
    case 'county-asc': return copy.sort((a,b) => (a._countyName||'').localeCompare(b._countyName||''));
    default: return copy.sort((a,b) => (b.dateAdded||'').localeCompare(a.dateAdded||''));
  }
}

function renderActiveChips(){
  const chips = [];
  state.years.forEach(v => chips.push(['years', v, `Year: ${v}`]));
  state.counties.forEach(v => chips.push(['counties', v, `County: ${v}`]));
  state.types.forEach(v => chips.push(['types', v, `Type: ${v}`]));
  state.colors.forEach(v => chips.push(['colors', v, `Color: ${v}`]));
  state.fontColors.forEach(v => chips.push(['fontColors', v, `Font Color: ${v}`]));
  if (state.lowSerialNumber) chips.push(['lowSerialNumber', 'true', 'Low Serial Number']);

  const el = document.getElementById('active-filters');
  el.innerHTML = chips.map(([group, val, label]) =>
    `<div class="chip" data-group="${group}" data-value="${val}">${label} ✕</div>`
  ).join('');

  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.dataset.group;
      const val = chip.dataset.value;
      if (group === 'lowSerialNumber') {
        state.lowSerialNumber = false;
      } else {
        state[group].delete(val);
      }
      syncCheckboxUI();
      state.page = 1;
      render();
    });
  });
}

function syncCheckboxUI(){
  document.querySelectorAll('#filter-year input, #filter-county input, #filter-type input')
    .forEach(el => { el.checked = state[el.dataset.group].has(el.value); });
  const lowSerialCheckbox = document.getElementById('low-serial-checkbox');
  if (lowSerialCheckbox) { lowSerialCheckbox.checked = state.lowSerialNumber; }
  document.querySelectorAll('#filter-color .swatch')
    .forEach(el => { el.classList.toggle('on', state.colors.has(el.dataset.value)); });
  document.querySelectorAll('#filter-font-color .swatch')
    .forEach(el => { el.classList.toggle('on', state.fontColors.has(el.dataset.value)); });
}

function getPageSize(){
  return window.matchMedia('(max-width: 860px)').matches
    ? MOBILE_PAGE_SIZE
    : DESKTOP_PAGE_SIZE;
}

function renderPagination(totalItems){
  const totalPages = Math.max(1, Math.ceil(totalItems / getPageSize()));
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const pages = new Set([1, totalPages, state.page - 1, state.page, state.page + 1]);
  const visiblePages = [...pages].filter(page => page > 0 && page <= totalPages).sort((a, b) => a - b);
  let html = `<button aria-label="Previous page" ${state.page===1?'disabled':''} data-page="${state.page-1}">←</button>`;
  let previousPage = 0;
  visiblePages.forEach(page => {
    if (page - previousPage > 1) html += '<span class="pagination-gap" aria-hidden="true">…</span>';
    html += `<button aria-label="Page ${page}" class="${page===state.page?'active':''}" data-page="${page}">${page}</button>`;
    previousPage = page;
  });
  html += `<button aria-label="Next page" ${state.page===totalPages?'disabled':''} data-page="${state.page+1}">→</button>`;
  el.innerHTML = html;

  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = Number(btn.dataset.page);
      render();
      window.scrollTo({top: document.querySelector('.archive-body').offsetTop - 90, behavior:'smooth'});
    });
  });
}

function render(){
  buildFilterUI();  // Recalculate filter counts based on current selections
  const filtered = applyFilters();
  const sorted = sortPlates(filtered);
  const pageSize = getPageSize();
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const pageItems = sorted.slice((state.page-1)*pageSize, state.page*pageSize);

  const grid = document.getElementById('plate-grid');
  if (!allPlates.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <h3>The archive is empty right now</h3>
      <p>Plates get added by syncing from Airtable. Once the first batch is synced, they'll show up here — searchable and filterable.</p>
    </div>`;
  } else if (!sorted.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <h3>No plates match those filters</h3>
      <p>Try clearing a filter or broadening your search.</p>
    </div>`;
  } else {
    grid.innerHTML = pageItems.map(plateCardHTML).join('');
  }

  document.getElementById('results-count').innerHTML =
    allPlates.length ? `<b>${sorted.length}</b> plate${sorted.length===1?'':'s'} match your filters` : '';

  renderActiveChips();
  renderPagination(sorted.length);
}

function initFilterToggle(){
  const btn = document.getElementById('filter-toggle');
  const panel = document.querySelector('.filter-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.querySelector('.filter-toggle-icon').textContent = isOpen ? '▴' : '▾';
  });
}

async function init(){
  try {
    const res = await fetch('data/plates.json');
    allPlates = await res.json();
  } catch (err) {
    allPlates = [];
  }

  // Normalize incoming plate objects to handle a few Airtable shape variations
  allPlates = allPlates.map(normalizePlate);

  buildFilterUI();

  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q');
  if (qParam) {
    state.q = qParam;
    document.getElementById('search-input').value = qParam;
  }

  render();

  const pageSizeQuery = window.matchMedia('(max-width: 860px)');
  pageSizeQuery.addEventListener('change', () => {
    state.page = 1;
    render();
  });

  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      render();
      if (state.q.trim()) trackEvent(`search:${state.q.trim().toLowerCase()}`, 'Archive search');
    }, 500);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    state.years.clear(); state.counties.clear(); state.types.clear(); state.colors.clear(); state.fontColors.clear(); state.lowSerialNumber = false;
    state.q = ''; document.getElementById('search-input').value = '';
    state.page = 1;
    syncCheckboxUI();
    render();
  });
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', initFilterToggle);
