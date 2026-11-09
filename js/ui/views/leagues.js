import { esc } from '../dom.js';
import { ICONS, header, leagueLogo, clubBadge, emptyState } from '../components.js';
import { currentRound, totalRounds } from '../../league/season.js';
import { computeTable } from '../../league/table.js';
import { roundLabel } from '../../league/cup.js';

export function render(app) {
  const w = app.world;
  const leagues = Object.values(w.leagues).sort((a, b) => a.createdAt - b.createdAt);
  const body = leagues.length ? leagues.map((l) => {
    const s = l.season;
    const t = s && l.type !== 'cup' ? computeTable(s.clubIds, s.fixtures, l.config) : [];
    const leader = t[0] && w.clubs[t[0].clubId];
    const up = l.config.upperLeagueId && w.leagues[l.config.upperLeagueId];
    const down = l.config.lowerLeagueId && w.leagues[l.config.lowerLeagueId];
    const lastChamp = l.history.length ? w.clubs[l.history[l.history.length - 1].championId] : null;
    return `<a class="card list-card" href="#/league/${l.id}">
      ${leagueLogo(l, 52)}
      <div class="lc-body">
        <h3>${esc(l.name)}</h3>
        <p>${s ? `${esc(s.label)} · ${s.finished ? 'Complete' : l.type === 'cup' ? esc(roundLabel(currentRound(l), l)) : `MD ${currentRound(l)}/${totalRounds(l)}`}` : ''} · ${l.clubIds.length} clubs</p>
        <p class="tags">${leader && s && s.fixtures.some((f) => f.result) ? `<span class="tag">${clubBadge(leader, 14)} ${esc(leader.short)} lead</span>` : ''}
          ${lastChamp ? `<span class="tag gold">${ICONS.trophy} ${esc(lastChamp.short)}</span>` : ''}
          ${up ? `<span class="tag">↑ ${esc(up.name)}</span>` : ''}${down ? `<span class="tag">↓ ${esc(down.name)}</span>` : ''}</p>
      </div>${ICONS.chev}</a>`;
  }).join('') : emptyState('No leagues yet', 'Create a competition, pick its clubs and generate fixtures automatically.', '<a class="btn primary" href="#/leagues/new">New league</a>');
  return `${header({ title: 'Leagues', actions: `<a class="icon-btn accent" href="#/leagues/new" aria-label="New league">${ICONS.plus}</a>` })}
    <div class="pad">${body}</div>`;
}
