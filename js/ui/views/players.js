import { esc } from '../dom.js';
import { ICONS, header, clubBadge, ratingChip, emptyState, flag, posTag } from '../components.js';
import { POSITIONS } from '../../engine/tactics.js';

const ui = { q: '', club: '', pos: '', sort: 'overall', limit: 60 };

export function render(app) {
  const w = app.world;
  const all = Object.values(w.players);
  if (!all.length) return `${header({ title: 'Players', actions: `<a class="icon-btn accent" href="#/players/new" aria-label="New player">${ICONS.plus}</a>` })}
    <div class="pad">${emptyState('No players yet', 'Create players yourself or generate full squads from a club page.', '<a class="btn primary" href="#/players/new">Create player</a>')}</div>`;
  const q = ui.q.toLowerCase();
  let list = all.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!ui.club || (ui.club === 'free' ? !p.clubId : p.clubId === ui.club)) && (!ui.pos || p.position === ui.pos));
  const sorters = {
    overall: (a, b) => b.overall - a.overall,
    name: (a, b) => a.name.localeCompare(b.name),
    age: (a, b) => a.age - b.age,
    goals: (a, b) => (b.career.goals || 0) - (a.career.goals || 0),
  };
  list.sort(sorters[ui.sort] || sorters.overall);
  const total = list.length;
  list = list.slice(0, ui.limit);
  const clubs = Object.values(w.clubs).sort((a, b) => a.name.localeCompare(b.name));
  return `${header({ title: 'Players', sub: `${total} shown`, actions: `<a class="icon-btn accent" href="#/players/new" aria-label="New player">${ICONS.plus}</a>` })}
  <div class="pad">
    <input type="search" placeholder="Search players" data-field="q" value="${esc(ui.q)}">
    <div class="filters">
      <select data-field="club" aria-label="Club"><option value="">All clubs</option><option value="free" ${ui.club === 'free' ? 'selected' : ''}>Free agents</option>${clubs.map((c) => `<option value="${c.id}" ${ui.club === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select data-field="pos" aria-label="Position"><option value="">All positions</option>${POSITIONS.map((p) => `<option ${ui.pos === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <select data-field="sort" aria-label="Sort"><option value="overall" ${ui.sort === 'overall' ? 'selected' : ''}>Best rated</option><option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Name</option><option value="age" ${ui.sort === 'age' ? 'selected' : ''}>Youngest</option><option value="goals" ${ui.sort === 'goals' ? 'selected' : ''}>Career goals</option></select>
    </div>
    <div class="card flush">${list.map((p) => { const c = w.clubs[p.clubId]; return `<a class="player-row" href="#/player/${p.id}">${posTag(p.position)}
      <span class="pr-name"><b>${esc(p.name)}</b><small>${flag(p.nation)} ${p.age} · ${c ? esc(c.name) : 'Free agent'}</small></span>${clubBadge(c, 24)}${ratingChip(p.overall)}</a>`; }).join('') || '<p class="muted pad-s">No players match these filters.</p>'}</div>
    ${total > list.length ? `<button class="btn block ghost" data-act="more">Show more (${total - list.length} left)</button>` : ''}
  </div>`;
}

export const actions = { more(app) { ui.limit += 100; app.render(); } };

export function onInput(app, el) {
  if (el.dataset.field === 'q') {
    ui.q = el.value; ui.limit = 60;
    const pos = el.selectionStart;
    app.render();
    const s = document.querySelector('[data-field="q"]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); }
  }
}
export function onChange(app, el) {
  const f = el.dataset.field;
  if (['club', 'pos', 'sort'].includes(f)) { ui[f] = el.value; ui.limit = 60; app.render(); }
}
