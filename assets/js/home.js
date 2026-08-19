/* ==========================================================================
   Tenn95 — homepage data rendering
   Pulls from data/plates.json and data/events.json (populated by
   scripts/sync-airtable.js). No sample data — if those files are empty
   arrays, the empty states below are what visitors see.
   ========================================================================== */

function plateCardHTML(p){
  const photo = p.photoUrl
    ? `style="background-image:url('${p.photoUrl}')"`
    : '';
  const noPhoto = p.photoUrl ? '' : '<span class="no-photo">No photo yet</span>';
  const colors = (p.colors || []).map(c => `<span class="tag">${c}</span>`).join('');
  const typeTag = p.type ? `<span class="tag">${p.type}</span>` : '';
  return `
    <div class="plate-card">
      <div class="plate-photo" ${photo}>${noPhoto}</div>
      <div class="plate-meta">
        <div class="county">${p.countyName || 'Unknown County'} · ${p.year || '—'}</div>
        <div class="tags">${typeTag}${colors}</div>
      </div>
    </div>`;
}

async function loadRecentPlates(){
  const el = document.getElementById('recent-plates');
  try {
    const res = await fetch('data/plates.json');
    const plates = await res.json();
    if (!plates.length) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <h3>The archive is just getting started</h3>
        <p>Plates will show up here as they're added. Check back soon, or browse the full archive once it's live.</p>
      </div>`;
      return;
    }
    const recent = [...plates]
      .sort((a,b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''))
      .slice(0, 8);
    el.innerHTML = recent.map(plateCardHTML).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <h3>Couldn't load the archive</h3>
      <p>data/plates.json is missing or invalid. Run the sync script to generate it.</p>
    </div>`;
  }
}

async function loadEventTeaser(){
  const el = document.getElementById('event-teaser');
  try {
    const res = await fetch('data/events.json');
    const events = await res.json();
    const today = new Date().toISOString().slice(0,10);
    const upcoming = events
      .filter(e => e.date >= today)
      .sort((a,b) => a.date.localeCompare(b.date))[0];

    if (!upcoming) {
      el.closest('.strip-inner').style.gridTemplateColumns = '1fr';
      el.style.display = 'none';
      return;
    }
    el.innerHTML = `
      <div>
        <div class="label">Upcoming Event</div>
        <h4>${upcoming.title}</h4>
        <p>${upcoming.date} · ${upcoming.location || ''}</p>
      </div>
      <a href="events.html" class="strip-btn">Details</a>
    `;
  } catch (err) {
    el.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadRecentPlates();
  loadEventTeaser();
});
