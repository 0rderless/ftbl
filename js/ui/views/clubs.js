import { esc } from '../dom.js';
import { ICONS, header, clubBadge, ratingChip, emptyState, segmented, leagueLogo } from '../components.js';
import { entryGroups } from '../../league/knockout.js';
import { compareCompetitions } from '../../league/cup.js';

const ui = { q: '', sort: 'name', group: null };

function groupsOf(w) {
  const leagues = Object.values(w.leagues).sort(compareCompetitions);
  const groups = leagues.map((l) => ({ id: l.id, name: l.name, short: l.short, league: l, ids: (l.season ? l.season.clubIds : l.clubIds).filter((id) => w.clubs[id]) }));
  const inAny = new Set(groups.flatMap((g) => g.ids));
  const other = Object.keys(w.clubs).filter((id) => !inAny.has(id));
  if (other.length) groups.push({ id: 'other', name: 'Other clubs', short: 'Other', ids: other });
  return groups;
}

function card(w, c, counts, note = '') {
  return `<a class="club-card" href="#/club/${c.id}" style="--c1:${c.colors.primary};--c2:${c.colors.secondary}">
    <div class="cc-badge">${clubBadge(c, 56)}</div>
    <b>${esc(c.name)}</b>
    <small>${note || `${counts[c.id] || 0} players`}</small>
    ${ratingChip(c.ratings.overall)}
  </a>`;
}

export function render(app) {
  const w = app.world;
  const all = Object.values(w.clubs);
  if (!all.length) return `${header({ title: 'Clubs', actions: `<a class="icon-btn accent" href="#/clubs/new" aria-label="New club">${ICONS.plus}</a>` })}
    <div class="pad">${emptyState('No clubs yet', 'Create a club with its own badge, kits, stadium and ratings.', '<a class="btn primary" href="#/clubs/new">Create club</a>')}</div>`;
  const counts = {};
  for (const p of Object.values(w.players)) if (p.clubId) counts[p.clubId] = (counts[p.clubId] || 0) + 1;
  const groups = groupsOf(w);
  if (!ui.group || (ui.group !== 'all' && !groups.some((g) => g.id === ui.group))) ui.group = groups.length ? groups[0].id : 'all';
  const g = groups.find((x) => x.id === ui.group);
  const q = ui.q.toLowerCase();
  const match = (c) => !q || c.name.toLowerCase().includes(q) || c.short.toLowerCase().includes(q);
  const sorter = (a, b) => (ui.sort === 'rating' ? b.ratings.overall - a.ratings.overall : a.name.localeCompare(b.name));
  const ids = g ? g.ids : Object.keys(w.clubs);
  let body;
  if (g && g.league && g.league.format === 'knockout' && !q) {
    // Daffers Cup: show clubs by the round they enter
    const l = g.league;
    body = entryGroups(w, l).filter((g) => g.ids.length).sort((a, b) => b.round - a.round).map((g) => {
      const list = g.ids.map((id) => w.clubs[id]).filter(Boolean).sort(sorter);
      return `<h3 class="section-title">${esc(g.label || 'Clubs')} <span class="count">${list.length} · enter round ${g.round}</span></h3>
        <div class="club-grid">${list.map((c) => card(w, c, counts)).join('')}</div>`;
    }).join('');
  } else {
    const list = ids.map((id) => w.clubs[id]).filter(Boolean).filter(match).sort(sorter);
    body = `<div class="club-grid">${list.map((c) => card(w, c, counts, c.country && g && g.league && g.league.type === 'cup' ? `${c.country} · ${counts[c.id] || 0} players` : '')).join('') || '<p class="muted">No clubs match.</p>'}</div>`;
  }
  return `${header({ title: 'Clubs', sub: `${ids.length} in ${esc(g ? g.name : 'all competitions')}`, actions: `<a class="icon-btn accent" href="#/clubs/new" aria-label="New club">${ICONS.plus}</a>` })}
  <div class="comp-chips">${groups.map((x) => `<button class="comp-chip ${x.id === ui.group ? 'on' : ''}" data-act="group" data-value="${x.id}">${x.league ? leagueLogo(x.league, 22) : ICONS.shield}<span>${esc(x.short && x.name.length > 14 ? x.short : x.name)}</span><small>${x.ids.length}</small></button>`).join('')}
    <button class="comp-chip ${ui.group === 'all' ? 'on' : ''}" data-act="group" data-value="all">${ICONS.shield}<span>All</span><small>${all.length}</small></button></div>
  <div class="pad">
    <div class="row gap"><input type="search" placeholder="Search ${esc(g ? g.name : 'all')} clubs" data-field="q" value="${esc(ui.q)}">${segmented('sort', [['name', 'A–Z'], ['rating', 'OVR']], ui.sort)}</div>
    ${body}
  </div>`;
}

export const actions = {
  seg(app, el) { ui.sort = el.dataset.value; app.render(); },
  group(app, el) { ui.group = el.dataset.value; ui.q = ''; app.render(); window.scrollTo(0, 0); },
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
