import { esc } from '../dom.js';
import { ICONS, header, clubBadge, ratingChip, emptyState, segmented } from '../components.js';

const ui = { q: '', sort: 'name' };

export function render(app) {
  const w = app.world;
  const all = Object.values(w.clubs);
  const counts = {};
  for (const p of Object.values(w.players)) if (p.clubId) counts[p.clubId] = (counts[p.clubId] || 0) + 1;
  const leagueOf = {};
  for (const l of Object.values(w.leagues)) for (const id of l.clubIds) (leagueOf[id] || (leagueOf[id] = [])).push(l.short);
  const q = ui.q.toLowerCase();
  const list = all.filter((c) => !q || c.name.toLowerCase().includes(q) || c.short.toLowerCase().includes(q))
    .sort((a, b) => ui.sort === 'rating' ? b.ratings.overall - a.ratings.overall : a.name.localeCompare(b.name));
  const body = !all.length
    ? emptyState('No clubs yet', 'Create a club with its own badge, kits, stadium and ratings.', '<a class="btn primary" href="#/clubs/new">Create club</a>')
    : `<div class="row gap"><input type="search" placeholder="Search ${all.length} clubs" data-field="q" value="${esc(ui.q)}">${segmented('sort', [['name', 'A–Z'], ['rating', 'OVR']], ui.sort)}</div>
      <div class="club-grid">${list.map((c) => `<a class="club-card" href="#/club/${c.id}" style="--c1:${c.colors.primary};--c2:${c.colors.secondary}">
        <div class="cc-badge">${clubBadge(c, 60)}</div>
        <b>${esc(c.name)}</b>
        <small>${(leagueOf[c.id] || []).map(esc).join(' · ') || 'No league'} · ${counts[c.id] || 0} players</small>
        ${ratingChip(c.ratings.overall)}
      </a>`).join('') || '<p class="muted">No clubs match.</p>'}</div>`;
  return `${header({ title: 'Clubs', actions: `<a class="icon-btn accent" href="#/clubs/new" aria-label="New club">${ICONS.plus}</a>` })}<div class="pad">${body}</div>`;
}

export const actions = {
  seg(app, el) { ui.sort = el.dataset.value; app.render(); },
};

export function onInput(app, el) {
  if (el.dataset.field === 'q') {
    ui.q = el.value;
    const pos = el.selectionStart;
    app.render();
    const s = document.querySelector('[data-field="q"]');
    if (s) { s.focus(); s.setSelectionRange(pos, pos); }
  }
}
