/* ==========================================================================
   Tenn95 — Events page
   Renders from data/events.json. That file starts empty — you add events
   to it directly (see data/events.json comments in the README) since
   events aren't part of the Airtable plate sync.
   ========================================================================== */

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function eventCardHTML(e){
  const d = new Date(e.date + 'T00:00:00');
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  return `
    <div class="event-card">
      <div class="event-date"><div class="mon">${mon}</div><div class="day">${day}</div></div>
      <div class="event-body">
        ${e.host ? `<div class="host">${e.host}</div>` : ''}
        <h3>${e.title}</h3>
        <div class="meta">${e.date}${e.location ? ' · ' + e.location : ''}</div>
        <p>${e.description || ''}</p>
      </div>
    </div>`;
}

async function init(){
  const el = document.getElementById('events-list');
  try {
    const res = await fetch('data/events.json');
    const events = await res.json();
    const today = new Date().toISOString().slice(0,10);
    const upcoming = events.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date));

    if (!upcoming.length) {
      el.innerHTML = `<div class="empty-state">
        <h3>No events scheduled right now</h3>
        <p>Check back soon, or watch the Facebook group for meet announcements in the meantime.</p>
      </div>`;
      return;
    }
    el.innerHTML = upcoming.map(eventCardHTML).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <h3>Couldn't load events</h3>
      <p>data/events.json is missing or invalid.</p>
    </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
