import { esc, fmtNum } from '../dom.js';
import { ICONS, clubBadge, leagueLogo, formPills, syncBadge } from '../components.js';
import { computeTable } from '../../league/table.js';
import { currentRound, totalRounds, clubForm, startSeason } from '../../league/season.js';
import { buildDemoWorld } from '../../data/demo.js';
import { simMatchday, nextSeason } from '../simActions.js';
import { cupStageText } from './cup.js';
import { roundLabel, cupClubStatus, playLabel, cupTotalRounds, isKnockout } from '../../league/cup.js';

export function render(app) {
  const w = app.world;
  const leagues = Object.values(w.leagues).sort((a, b) => a.createdAt - b.createdAt);
  const nClubs = Object.keys(w.clubs).length, nPlayers = Object.keys(w.players).length;
  if (!leagues.length && !nClubs) return onboarding();
  return `<div class="home">
    <section class="hero">
      <div class="hero-top"><img src="icons/icon-192.png" alt="" class="hero-icon"><div><span class="brand big">ftbl</span><p>Football league simulator</p></div><a href="#/settings/data" class="hero-sync">${syncBadge(app.sync)}</a></div>
      <div class="hero-stats">
        <a href="#/leagues"><b>${leagues.length}</b><span>Leagues</span></a>
        <a href="#/clubs"><b>${nClubs}</b><span>Clubs</span></a>
        <a href="#/players"><b>${fmtNum(nPlayers)}</b><span>Players</span></a>
      </div>
    </section>
    <div class="pad">
      ${leagues.length ? leagues.map((l) => leagueCard(app, l)).join('') : `<div class="card cta"><h3>Create your first league</h3><p class="muted">You have ${nClubs} club${nClubs === 1 ? '' : 's'}. Put them into a competition.</p><a class="btn primary" href="#/leagues/new">${ICONS.plus} New league</a></div>`}
      <div class="quick-grid">
        <a class="quick" href="#/clubs/new">${ICONS.shield}<span>Create club</span></a>
        <a class="quick" href="#/players/new">${ICONS.user}<span>Create player</span></a>
        <a class="quick" href="#/leagues/new">${ICONS.trophy}<span>New league</span></a>
        <a class="quick" href="#/records">${ICONS.star}<span>Records</span></a>
      </div>
    </div>
  </div>`;
}

function cupCard(app, l) {
  const w = app.world;
  const s = l.season;
  const round = currentRound(l);
  const next = s.fixtures.filter((f) => f.round === round);
  const leagueEntry = isKnockout(l) && (l.config.entries || []).find((e) => e.leagueId && w.leagues[e.leagueId]);
  const alive = leagueEntry ? w.leagues[leagueEntry.leagueId].clubIds.filter((id) => s.clubIds.includes(id) && !/^Out/.test(cupClubStatus(l, id))) : null;
  const ours = (alive ? alive.slice(0, 6) : (s.qualifiers || [])).map((id) => {
    const c = w.clubs[id];
    return c ? `<a href="#/club/${id}" class="nf">${clubBadge(c, 18)}<span>${esc(c.short)}</span><i>${esc(cupClubStatus(l, id))}</i></a>` : '';
  }).join('');
  return `<article class="card league-card ucl-card">
    <a class="lc-head" href="#/league/${l.id}">${leagueLogo(l, 46)}
      <div class="lc-title"><h2>${esc(l.name)}</h2><p>${esc(s.label)} · ${esc(cupStageText(l))}</p></div>${ICONS.chev}</a>
    <div class="progress"><i style="width:${s.finished ? 100 : ((round - 1) / (cupTotalRounds(l) || 1)) * 100}%"></i></div>
    ${ours ? `<div class="next-fx"><small>${alive ? `${esc(w.leagues[leagueEntry.leagueId].name)} clubs still in (${alive.length})` : 'League qualifiers'}</small>${ours}</div>` : ''}
    ${!s.finished && next.length ? `<div class="next-fx"><small>Next up</small>${next.slice(0, 4).map((f) => { const h = w.clubs[f.home], a = w.clubs[f.away]; return `<a href="#/match/${l.id}/${f.id}" class="nf">${clubBadge(h, 18)}<span>${esc(h ? h.short : '?')}</span><i>v</i><span>${esc(a ? a.short : '?')}</span>${clubBadge(a, 18)}</a>`; }).join('')}</div>` : ''}
    <div class="lc-actions">
      ${s.finished ? `<button class="btn primary" data-act="next" data-id="${l.id}">${ICONS.ff} Start next season</button>`
        : `<button class="btn primary" data-act="play" data-id="${l.id}">${ICONS.play} Play ${esc(playLabel(l, round))}</button>`}
      ${isKnockout(l) ? `<a class="btn ghost" href="#/league/${l.id}/bracket">Rounds</a>` : `<a class="btn ghost" href="#/league/${l.id}/${round <= 6 && !s.finished ? 'groups' : 'bracket'}">${round <= 6 && !s.finished ? 'Groups' : 'Bracket'}</a>`}
    </div></article>`;
}

function leagueCard(app, l) {
  const w = app.world;
  const s = l.season;
  if (!s) return '';
  if (l.type === 'cup') return cupCard(app, l);
  const table = computeTable(s.clubIds, s.fixtures, l.config);
  const round = currentRound(l), total = totalRounds(l);
  const done = s.fixtures.filter((f) => f.result).length;
  const pct = s.fixtures.length ? Math.round((done / s.fixtures.length) * 100) : 0;
  const top = table.slice(0, 4);
  const next = s.fixtures.filter((f) => f.round === round).slice(0, 3);
  return `<article class="card league-card">
    <a class="lc-head" href="#/league/${l.id}">
      ${leagueLogo(l, 46)}
      <div class="lc-title"><h2>${esc(l.name)}</h2><p>${esc(s.label)} · ${s.finished ? 'Season complete' : `Matchday ${round} of ${total}`}</p></div>
      ${ICONS.chev}
    </a>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="mini-table">
      ${top.map((r) => { const c = w.clubs[r.clubId]; return `<a href="#/club/${r.clubId}" class="mt-row"><span class="mt-pos">${r.pos}</span>${clubBadge(c, 22)}<span class="mt-name">${esc(c ? c.name : '?')}</span>${formPills(clubForm(l, r.clubId), 5)}<b>${r.pts}</b></a>`; }).join('')}
    </div>
    ${!s.finished && next.length ? `<div class="next-fx"><small>Next up</small>${next.map((f) => { const h = w.clubs[f.home], a = w.clubs[f.away]; return `<a href="#/match/${l.id}/${f.id}" class="nf">${clubBadge(h, 18)}<span>${esc(h ? h.short : '?')}</span><i>v</i><span>${esc(a ? a.short : '?')}</span>${clubBadge(a, 18)}</a>`; }).join('')}</div>` : ''}
    <div class="lc-actions">
      ${s.finished
        ? `<button class="btn primary" data-act="next" data-id="${l.id}">${ICONS.ff} Start next season</button>`
        : `<button class="btn primary" data-act="play" data-id="${l.id}">${ICONS.play} Play matchday ${round}</button>`}
      <a class="btn ghost" href="#/league/${l.id}/table">Table</a>
    </div>
  </article>`;
}

function onboarding() {
  return `<div class="onboard">
    <img src="icons/icon-512.png" alt="ftbl" class="onboard-icon">
    <h1 class="brand big">ftbl</h1>
    <p>Build fictional clubs, design their badges and kits, create players and run full league seasons with a statistical match engine.</p>
    <button class="btn primary block" data-act="demo">${ICONS.trophy} Load demo world</button>
    <small class="muted">36 fictional clubs · 2 linked divisions · 900 players</small>
    <a class="btn ghost block" href="#/clubs/new">${ICONS.plus} Start from scratch</a>
  </div>`;
}

export const actions = {
  demo(app) {
    const demo = buildDemoWorld('demo-' + Date.now());
    app.act((w) => {
      Object.assign(w.clubs, demo.clubs);
      Object.assign(w.players, demo.players);
      for (const l of Object.values(demo.leagues)) { startSeason(l, 1); w.leagues[l.id] = l; }
    }, 'Demo world loaded');
  },
  play(app, el) { simMatchday(app, el.dataset.id); },
  next(app, el) { nextSeason(app, el.dataset.id); },
};
