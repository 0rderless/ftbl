// "Biggest clubs": all-time leaderboard per competition.
import { esc } from '../dom.js';
import { header, clubBadge, leagueLogo, segmented, emptyState } from '../components.js';
import { competitionLeaderboard, countryLeaderboard } from '../../league/records.js';
import { compareCompetitions } from '../../league/cup.js';

const ui = { comp: null, sort: 'titles' };

export function competitions(w) {
  return Object.values(w.leagues).sort(compareCompetitions);
}

export function render(app, compId) {
  const w = app.world;
  const comps = competitions(w);
  if (!comps.length) return `${header({ title: 'Biggest clubs', back: '#/' })}<div class="pad">${emptyState('No competitions yet')}</div>`;
  if (compId && (w.leagues[compId] || compId === 'geko')) ui.comp = compId;
  if (!ui.comp || (ui.comp !== 'geko' && !w.leagues[ui.comp])) ui.comp = 'geko';
  const chips = `<div class="comp-chips"><button class="comp-chip ${ui.comp === 'geko' ? 'on' : ''}" data-act="comp" data-value="geko"><span class="geko-flag">🦎</span><span>Geko</span></button>${comps.map((x) => `<button class="comp-chip ${x.id === ui.comp ? 'on' : ''}" data-act="comp" data-value="${x.id}">${leagueLogo(x, 22)}<span>${esc(x.name.length > 14 ? x.short : x.name)}</span></button>`).join('')}</div>`;
  if (ui.comp === 'geko') return gekoView(app, comps, chips);
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
  ${chips}
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

function gekoView(app, comps, chips) {
  const w = app.world;
  const rows = countryLeaderboard(w);
  const top = rows[0];
  const podium = rows.slice(0, 3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  // only competitions a Geko club has won (new cups get a column once someone wins them)
  const cols = comps.filter((l) => rows.some((r) => r.by[l.id]));
  const tight = cols.length > 4;
  const grid = tight ? `grid-template-columns: 22px 1fr ${cols.map(() => '24px').join(' ')} 34px; gap: 3px; padding: 9px 10px` : `grid-template-columns: 28px 1fr ${cols.map(() => '34px').join(' ')} 40px`;
  const breakdown = (r) => cols.filter((l) => r.by[l.id]).map((l) => `${r.by[l.id]} ${l.short}`).join(' · ');
  return `${header({ title: 'Biggest clubs', sub: 'Geko · all trophies, all competitions', back: '#/' })}
  ${chips}
  <div class="pad">
    ${!rows.length ? emptyState('No trophies yet', 'Win Kronliga, the Daffers Cup or a European cup.') : `
    ${top && top.total > 0 ? `<a class="card biggest-hero" href="#/club/${top.clubId}/honours" style="--c1:${w.clubs[top.clubId].colors.primary}">
      <small>🦎 Biggest club in Geko</small>
      <div class="bh-badge">${clubBadge(w.clubs[top.clubId], 92)}<span class="bh-crown">👑</span></div>
      <h2>${esc(top.name)}</h2>
      <p><b>${top.total}</b> trophies</p>
      <div class="bh-split">${cols.filter((l) => top.by[l.id]).map((l) => `<span>${leagueLogo(l, 22)}<b>${top.by[l.id]}</b></span>`).join('')}</div>
    </a>` : ''}
    ${podium.length === 3 && podium[2].total > 0 ? `<div class="podium">${order.map((r) => { const place = rows.indexOf(r) + 1; return `<a class="pod pod-${place}" href="#/club/${r.clubId}/honours">${clubBadge(w.clubs[r.clubId], place === 1 ? 54 : 44)}<b>${esc(r.name)}</b><span>${r.total}</span><small class="pod-split">${esc(breakdown(r))}</small><i>${place}</i></a>`; }).join('')}</div>` : ''}
    <div class="card flush">
      <div class="lb-head" style="${grid}"><span>#</span><span>Club</span>${cols.map((l) => `<span class="lb-logo" title="${esc(l.name)}">${leagueLogo(l, tight ? 18 : 20)}</span>`).join('')}<span>${tight ? 'All' : 'Total'}</span></div>
      ${rows.map((r, i) => `<a class="lb-row ${i < 3 ? 'top' : ''}" style="${grid}" href="#/club/${r.clubId}/honours"><span class="lb-rank">${i + 1}</span>
        <span class="lb-club">${clubBadge(w.clubs[r.clubId], 24)}<span>${esc(r.name)}</span></span>
        ${cols.map((l) => `<span class="${r.by[l.id] ? '' : 'zero'}">${r.by[l.id] || 0}</span>`).join('')}<b class="hl">${r.total}</b></a>`).join('')}
    </div>
    <p class="hint">Every trophy won by Geko clubs in every competition (${comps.map((l) => esc(l.short || l.name)).join(', ')}). Foreign clubs from the European cups aren't included.</p>`}
  </div>`;
}

export const actions = {
  comp(app, el) { ui.comp = el.dataset.value; app.nav(`#/biggest/${el.dataset.value}`, { replace: true }); },
  seg(app, el) { ui.sort = el.dataset.value; app.render(); },
};
