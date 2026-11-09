// "Biggest clubs": all-time leaderboard per competition.
import { esc } from '../dom.js';
import { header, clubBadge, leagueLogo, segmented, emptyState } from '../components.js';
import { competitionLeaderboard } from '../../league/records.js';

const ui = { comp: null, sort: 'titles' };

export function competitions(w) {
  return Object.values(w.leagues).sort((a, b) => (a.type === 'cup') - (b.type === 'cup') || (a.format === 'knockout') - (b.format === 'knockout') || a.createdAt - b.createdAt);
}

export function render(app, compId) {
  const w = app.world;
  const comps = competitions(w);
  if (!comps.length) return `${header({ title: 'Biggest clubs', back: '#/' })}<div class="pad">${emptyState('No competitions yet')}</div>`;
  if (compId && w.leagues[compId]) ui.comp = compId;
  if (!ui.comp || !w.leagues[ui.comp]) ui.comp = comps[0].id;
  const l = w.leagues[ui.comp];
  let rows = competitionLeaderboard(w, l);
  if (ui.sort === 'wins') rows = rows.slice().sort((a, b) => b.w - a.w || b.titles - a.titles || (b.gf - b.ga) - (a.gf - a.ga));
  const isCup = l.type === 'cup';
  const top = rows[0];
  const seasons = l.history.length;
  const podium = rows.slice(0, 3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  const val = (r) => (ui.sort === 'wins' ? r.w : r.titles);
  const unit = ui.sort === 'wins' ? 'wins' : isCup ? 'trophies' : 'titles';
  return `${header({ title: 'Biggest clubs', sub: `${esc(l.name)} · ${seasons} completed season${seasons === 1 ? '' : 's'}`, back: '#/' })}
  <div class="comp-chips">${comps.map((x) => `<button class="comp-chip ${x.id === ui.comp ? 'on' : ''}" data-act="comp" data-value="${x.id}">${leagueLogo(x, 22)}<span>${esc(x.name.length > 14 ? x.short : x.name)}</span></button>`).join('')}</div>
  <div class="pad">
    ${segmented('sort', [['titles', isCup ? 'Most trophies' : 'Most titles'], ['wins', 'Most match wins']], ui.sort)}
    ${!rows.length ? emptyState('No matches played yet', `Play some ${l.name} to start the leaderboard.`) : `
    ${top && val(top) > 0 ? `<a class="card biggest-hero" href="#/club/${top.clubId}" style="--c1:${w.clubs[top.clubId] ? w.clubs[top.clubId].colors.primary : '#7c3aed'}">
      <small>${ui.sort === 'wins' ? 'Most wins in' : 'Biggest club in'} ${esc(l.name)}</small>
      <div class="bh-badge">${clubBadge(w.clubs[top.clubId], 92)}<span class="bh-crown">👑</span></div>
      <h2>${esc(top.name)}</h2>
      <p><b>${val(top)}</b> ${unit}${top.lastTitle && ui.sort !== 'wins' ? ` · last in ${esc(top.lastTitle)}` : ''}</p>
    </a>` : ''}
    ${podium.length === 3 && val(podium[2]) > 0 ? `<div class="podium">${order.map((r) => { const place = rows.indexOf(r) + 1; return `<a class="pod pod-${place}" href="#/club/${r.clubId}">${clubBadge(w.clubs[r.clubId], place === 1 ? 54 : 44)}<b>${esc(r.name)}</b><span>${val(r)}</span><i>${place}</i></a>`; }).join('')}</div>` : ''}
    <div class="card flush">
      <div class="lb-head"><span>#</span><span>Club</span><span title="${isCup ? 'Trophies' : 'Titles'}">🏆</span><span title="${isCup ? 'Final defeats' : 'Runner-up'}">🥈</span><span>W</span><span>P</span></div>
      ${rows.map((r, i) => `<a class="lb-row ${i < 3 ? 'top' : ''}" href="#/club/${r.clubId}"><span class="lb-rank">${i + 1}</span>
        <span class="lb-club">${clubBadge(w.clubs[r.clubId], 24)}<span>${esc(r.name)}</span></span>
        <b class="${ui.sort === 'titles' ? 'hl' : ''}">${r.titles}</b><span>${r.seconds}</span><b class="${ui.sort === 'wins' ? 'hl' : ''}">${r.w}</b><span>${r.p}</span></a>`).join('')}
    </div>
    <p class="hint">${isCup ? '🏆 trophies won · 🥈 lost finals' : '🏆 league titles · 🥈 runner-up finishes'} · W/P = all-time ${esc(l.name)} match wins / games played${l.season && !l.season.finished ? ' (including the season in progress)' : ''}.</p>`}
  </div>`;
}

export const actions = {
  comp(app, el) { ui.comp = el.dataset.value; app.nav(`#/biggest/${el.dataset.value}`, { replace: true }); },
  seg(app, el) { ui.sort = el.dataset.value; app.render(); },
};
