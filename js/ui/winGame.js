// "Win game": pick a team by typing part of its name, then choose how many wins.
import { esc, sheet } from './dom.js';
import { clubBadge, ICONS } from './components.js';
import { searchClubs, setForcedWins, forcedWins, cupClubStatus, isCup } from '../league/cup.js';
import { computeTable } from '../league/table.js';

const ord = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

export function winLabel(n) { return n === -1 ? 'every match' : n === 1 ? 'next match' : `next ${n} matches`; }

export async function winGameFlow(app, leagueId) {
  const l = app.world.leagues[leagueId];
  if (!l || !l.season || l.season.finished) { app.toast('This season is finished — start the next one first', 'info'); return; }
  const cup = isCup(l);
  const table = cup ? null : computeTable(l.season.clubIds, l.season.fixtures, l.config);
  const statusOf = (id) => {
    if (cup) return cupClubStatus(l, id);
    const r = table.find((x) => x.clubId === id);
    return r ? `${r.pos}${ord(r.pos)} · ${r.pts} pts` : '';
  };
  const mine = new Set(l.season.qualifiers || []);
  const clubs = l.season.clubIds.map((id) => app.world.clubs[id]).filter(Boolean)
    .sort((a, b) => (mine.has(b.id) - mine.has(a.id)) || b.ratings.overall - a.ratings.overall);
  const row = (c) => {
    const st = statusOf(c.id);
    const fw = forcedWins(l)[c.id];
    return `<button class="pick-row" data-sheet="${c.id}">${clubBadge(c, 28)}<span class="pr-name"><b>${esc(c.name)}</b><small>${esc(st)}${fw ? ` · winning ${winLabel(fw)}` : ''}</small></span>${ICONS.chev}</button>`;
  };
  const clubId = await sheet(`<h3 class="sheet-title">${ICONS.trophy} Win game</h3>
    <p class="sheet-text">Type a few letters of the team that should win.</p>
    <input type="search" class="wg-input" placeholder="e.g. zorp, man city, psg" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Team name">
    <div class="pick-sheet wg-list"></div>
    <div class="sheet-actions one"><button class="btn ghost" data-sheet="__cancel">Cancel</button></div>`, {
    onMount(el) {
      const input = el.querySelector('.wg-input');
      const list = el.querySelector('.wg-list');
      const draw = () => {
        const found = searchClubs(clubs, input.value, 8);
        list.innerHTML = found.map(row).join('') || '<p class="muted pad-s">No team matches those letters.</p>';
      };
      input.addEventListener('input', draw);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const first = list.querySelector('[data-sheet]'); if (first) first.click(); }
      });
      draw();
      setTimeout(() => input.focus(), 60);
    },
  });
  if (!clubId || clubId === '__cancel') return;
  const club = app.world.clubs[clubId];
  const status = statusOf(clubId);
  const out = cup && (/^Out/.test(status) || status === 'Winners');
  const active = forcedWins(l)[clubId];
  const choice = await sheet(`<div class="wg-head">${clubBadge(club, 56)}<div><h3 class="sheet-title">${esc(club.name)}</h3><p class="sheet-text">${esc(status)}${active ? ` · currently winning ${winLabel(active)}` : ''}</p></div></div>
    ${out ? `<p class="note">${ICONS.info} ${esc(club.name)} ${status === 'Winners' ? 'already won it' : 'are knocked out'} this season, so there are no matches left to win.</p>` : `
    <p class="sheet-text">${esc(club.name)} will win — the game picks the score.${cup ? ' In a knockout tie they win the tie too.' : ''}</p>
    <div class="wg-options">
      <button class="btn primary" data-sheet="1">Win next match</button>
      <button class="btn" data-sheet="3">Win next 3</button>
      <button class="btn" data-sheet="all">Win every match</button>
    </div>`}
    <div class="sheet-actions">${active ? '<button class="btn danger" data-sheet="stop">Stop winning</button>' : '<span></span>'}<button class="btn ghost" data-sheet="__cancel">Cancel</button></div>`);
  if (!choice || choice === '__cancel') return;
  const n = choice === 'stop' ? 0 : choice === 'all' ? -1 : Number(choice);
  app.act((w) => setForcedWins(w.leagues[leagueId], clubId, n),
    n ? `${club.name} will win their ${winLabel(n)}` : `${club.name} back to normal`);
}
