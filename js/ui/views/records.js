import { esc } from '../dom.js';
import { header, clubBadge, leagueLogo, segmented, emptyState } from '../components.js';
import { playerLeaderboards } from '../../league/records.js';

const ui = { mode: 'goals' };

export function render(app) {
  const w = app.world;
  const lb = playerLeaderboards(w);
  const labels = { goals: 'Goals', assists: 'Assists', apps: 'Appearances', titles: 'League titles won' };
  const list = lb[ui.mode];
  const clubTitles = Object.values(w.clubs).map((c) => ({ c, n: c.honours.filter((h) => h.type === 'league').length, p: c.honours.filter((h) => h.type === 'promotion').length }))
    .filter((x) => x.n || x.p).sort((a, b) => b.n - a.n || b.p - a.p).slice(0, 15);
  const champs = [];
  for (const l of Object.values(w.leagues)) for (const h of l.history) champs.push({ l, h });
  champs.sort((a, b) => b.h.finishedAt - a.h.finishedAt);
  return `${header({ title: 'Records & history', back: '#/' })}
  <div class="pad">
    <h3 class="section-title">All-time player records</h3>
    ${segmented('mode', Object.entries(labels).map(([k, v]) => [k, k === 'titles' ? 'Titles' : v]), ui.mode)}
    <div class="card flush"><div class="rank-head">${labels[ui.mode]} · all leagues, all seasons</div>
      ${list.length ? list.map((r, i) => { const c = w.clubs[r.clubId]; return `<a class="rank-row" href="#/player/${r.pid}"><span class="rk">${i + 1}</span>${clubBadge(c, 22)}<span class="rk-name"><b>${esc(r.name)}</b><small>${c ? esc(c.name) : 'Free agent'} · ${r.apps} app${r.apps === 1 ? "" : "s"}</small></span><span class="rk-val">${r[ui.mode]}</span></a>`; }).join('') : '<p class="muted pad-s">Play some matches to set records.</p>'}
    </div>
    <h3 class="section-title">Most successful clubs</h3>
    ${clubTitles.length ? `<div class="card flush">${clubTitles.map((x, i) => `<a class="rank-row" href="#/club/${x.c.id}/honours"><span class="rk">${i + 1}</span>${clubBadge(x.c, 24)}<span class="rk-name"><b>${esc(x.c.name)}</b><small>${x.p ? `${x.p} promotion${x.p > 1 ? 's' : ''}` : ''}</small></span><span class="rk-val">${x.n} 🏆</span></a>`).join('')}</div>` : '<p class="hint">No titles won yet.</p>'}
    <h3 class="section-title">Recent champions</h3>
    ${champs.length ? `<div class="card flush">${champs.slice(0, 20).map(({ l, h }) => { const c = w.clubs[h.championId]; return `<a class="rank-row" href="#/league/${l.id}/history">${leagueLogo(l, 24)}<span class="rk-name"><b>${esc(c ? c.name : h.clubNames[h.championId] || 'Former club')}</b><small>${esc(l.name)} · ${esc(h.label)} · ${h.table[0].pts} pts</small></span>${clubBadge(c, 26)}</a>`; }).join('')}</div>` : emptyState('No completed seasons yet', 'Finish a season to crown your first champion.')}
    <h3 class="section-title">League records</h3>
    <div class="card flush">${Object.values(w.leagues).map((l) => `<a class="rank-row" href="#/league/${l.id}/records">${leagueLogo(l, 24)}<span class="rk-name"><b>${esc(l.name)}</b><small>${l.history.length} completed season${l.history.length === 1 ? '' : 's'}</small></span></a>`).join('') || '<p class="muted pad-s">No leagues.</p>'}</div>
  </div>`;
}

export const actions = { seg(app, el) { ui.mode = el.dataset.value; app.render(); } };
