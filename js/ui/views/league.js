import { esc } from '../dom.js';
import { ICONS, header, tabs, leagueLogo, clubBadge, formPills, segmented, emptyState } from '../components.js';
import { computeTable, zoneFor, emptyRow } from '../../league/table.js';
import { currentRound, totalRounds, clubForm, playerStats, topList, clubStreaks, matchHighlights, seasonStarted } from '../../league/season.js';
import { leagueRecords } from '../../league/records.js';
import { simMatchday, simSeason, nextSeason, afterPlay } from '../simActions.js';
import { liveSimMatch } from '../liveMatch.js';
import { renderCup, activeWins } from './cup.js';
import { winGameFlow } from '../winGame.js';
import { setForcedWins } from '../../league/cup.js';

const ui = { round: {}, tableMode: 'all', statMode: 'g', teamMode: 'attack' };

const TABS = [['fixtures', 'Fixtures'], ['table', 'Table'], ['stats', 'Stats'], ['form', 'Form'], ['history', 'History'], ['records', 'Records']];

export function render(app, id, tab = 'fixtures') {
  const w = app.world;
  const l = w.leagues[id];
  if (!l) return `${header({ title: 'League not found', back: '#/leagues' })}<div class="pad">${emptyState('This league no longer exists')}</div>`;
  if (l.type === 'cup') return renderCup(app, l, tab, ui, statsTab);
  const s = l.season;
  const done = s ? s.fixtures.filter((f) => f.result).length : 0;
  const pct = s && s.fixtures.length ? (done / s.fixtures.length) * 100 : 0;
  const sub = s ? `${esc(s.label)} · ${s.finished ? 'Season complete' : `Matchday ${currentRound(l)} / ${totalRounds(l)}`}` : '';
  let body = '';
  if (tab === 'table') body = tableTab(app, l);
  else if (tab === 'stats') body = statsTab(app, l);
  else if (tab === 'form') body = formTab(app, l);
  else if (tab === 'history') body = historyTab(app, l);
  else if (tab === 'records') body = recordsTab(app, l);
  else body = fixturesTab(app, l);
  return `${header({ title: l.name, sub, back: '#/leagues', logo: leagueLogo(l, 34), actions: `<a class="icon-btn" href="#/league/${l.id}/edit" aria-label="Edit league">${ICONS.edit}</a>` })}
    <div class="progress slim"><i style="width:${pct}%"></i></div>
    ${tabs(TABS, tab, `#/league/${l.id}`)}
    <div class="pad">${seasonBanner(app, l)}${body}</div>`;
}

function seasonBanner(app, l) {
  const s = l.season;
  if (!s || !s.finished) return '';
  const h = l.history[l.history.length - 1];
  const c = h && app.world.clubs[h.championId];
  return `<div class="card champion-banner">
    <div class="cb-badge">${clubBadge(c, 64)}</div>
    <div><small>${esc(s.label)} champions</small><h3>${esc(c ? c.name : (h && h.clubNames[h.championId]) || '')}</h3>
    <button class="btn primary sm" data-act="next" data-id="${l.id}">${ICONS.ff} Start next season</button></div>
  </div>`;
}

// ---------- fixtures ----------
function fixturesTab(app, l) {
  const w = app.world, s = l.season;
  if (!s || !s.fixtures.length) return emptyState('No fixtures', 'Add at least two clubs to generate fixtures.', `<a class="btn" href="#/league/${l.id}/edit">Edit league</a>`);
  const total = totalRounds(l);
  const cr = currentRound(l);
  let r = ui.round[l.id] || cr || total;
  r = Math.max(1, Math.min(total, r));
  const list = s.fixtures.filter((f) => f.round === r);
  const isCurrent = r === cr;
  const byes = s.clubIds.filter((id) => !list.some((f) => f.home === id || f.away === id));
  const rows = list.map((f) => {
    const h = w.clubs[f.home], a = w.clubs[f.away];
    const res = f.result;
    const hw = res && res.hg > res.ag, aw = res && res.ag > res.hg;
    return `<div class="fx-row ${res ? 'played' : ''}">
      <a class="fx-main" href="#/match/${l.id}/${f.id}">
        <span class="fx-team home ${hw ? 'win' : ''}"><span class="nm">${esc(h ? h.name : '?')}</span>${clubBadge(h, 26)}</span>
        <span class="fx-score">${res ? `<b>${res.hg}</b><b>${res.ag}</b>` : '<em>vs</em>'}</span>
        <span class="fx-team away ${aw ? 'win' : ''}">${clubBadge(a, 26)}<span class="nm">${esc(a ? a.name : '?')}</span></span>
      </a>
      ${!res && isCurrent ? `<button class="mini-btn" data-act="simOne" data-id="${f.id}" aria-label="Simulate this match">${ICONS.play}</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="round-nav">
      <button class="icon-btn" data-act="round" data-v="${r - 1}" ${r <= 1 ? 'disabled' : ''} aria-label="Previous matchday">${ICONS.chevL}</button>
      <label class="round-select"><span>Matchday ${r}<small>${isCurrent ? 'Current' : r < cr || !cr ? 'Played' : 'Upcoming'}</small></span>
        <select data-field="round" aria-label="Choose matchday">${Array.from({ length: total }, (_, i) => `<option value="${i + 1}" ${i + 1 === r ? 'selected' : ''}>Matchday ${i + 1}</option>`).join('')}</select></label>
      <button class="icon-btn" data-act="round" data-v="${r + 1}" ${r >= total ? 'disabled' : ''} aria-label="Next matchday">${ICONS.chev}</button>
    </div>
    <div class="card fx-list">${rows}${byes.length ? `<p class="bye">Rest: ${byes.map((id) => esc(w.clubs[id] ? w.clubs[id].name : '?')).join(', ')}</p>` : ''}</div>
    ${!s.finished ? `${activeWins(app, l)}<div class="sim-bar">
      <button class="btn primary" data-act="play" data-id="${l.id}">${ICONS.play} Play MD ${cr}</button>
      <button class="btn win-btn" data-act="winGame" data-id="${l.id}">${ICONS.trophy} Win game</button>
      <button class="btn" data-act="season" data-id="${l.id}" aria-label="Simulate season">${ICONS.ff}</button>
    </div>` : ''}
    ${!seasonStarted(l) ? `<p class="hint">${ICONS.info} Fixtures were generated with seed <code>${esc(s.seed)}</code>. Same seed + same clubs + same settings = the same season.</p>` : `<p class="hint">Season seed <code>${esc(s.seed)}</code></p>`}`;
}

// ---------- table ----------
function splitTable(l, mode) {
  const s = l.season;
  if (mode === 'all') return computeTable(s.clubIds, s.fixtures, l.config);
  const rows = {};
  for (const id of s.clubIds) rows[id] = emptyRow(id);
  const pw = l.config.pointsWin, pd = l.config.pointsDraw;
  for (const f of s.fixtures.filter((x) => x.result).sort((a, b) => a.round - b.round)) {
    const side = mode === 'home' ? f.home : f.away;
    const r = rows[side]; if (!r) continue;
    const gf = mode === 'home' ? f.result.hg : f.result.ag, ga = mode === 'home' ? f.result.ag : f.result.hg;
    r.p++; r.gf += gf; r.ga += ga;
    if (gf > ga) { r.w++; r.pts += pw; r.form.push('W'); } else if (gf < ga) { r.l++; r.form.push('L'); } else { r.d++; r.pts += pd; r.form.push('D'); }
  }
  const list = Object.values(rows);
  list.forEach((r) => { r.gd = r.gf - r.ga; });
  list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  list.forEach((r, i) => { r.pos = i + 1; });
  return list;
}

export function tableHTML(app, l, rows, { compact = false, highlight = null } = {}) {
  const w = app.world;
  const n = rows.length;
  return `<div class="table-wrap"><table class="ltable ${compact ? 'compact' : ''}">
    <thead><tr><th class="c-pos">#</th><th class="c-club">Club</th><th>P</th>${compact ? '' : '<th>W</th><th>D</th><th>L</th><th class="hide-xs">GF</th><th class="hide-xs">GA</th>'}<th>GD</th><th class="c-pts">Pts</th>${compact ? '' : '<th class="c-form hide-sm">Form</th>'}</tr></thead>
    <tbody>${rows.map((r) => {
      const c = w.clubs[r.clubId];
      const z = zoneFor(r.pos, n, l.config);
      return `<tr class="z-${z} ${highlight === r.clubId ? 'hl' : ''}"><td class="c-pos"><span>${r.pos}</span></td>
        <td class="c-club"><a href="#/club/${r.clubId}">${clubBadge(c, 22)}<span class="full">${esc(c ? c.name : '?')}</span><span class="abbr">${esc(c ? c.short : '?')}</span></a></td>
        <td>${r.p}</td>${compact ? '' : `<td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="hide-xs">${r.gf}</td><td class="hide-xs">${r.ga}</td>`}
        <td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="c-pts"><b>${r.pts}</b></td>${compact ? '' : `<td class="c-form hide-sm">${formPills(r.form, 5)}</td>`}</tr>`;
    }).join('')}</tbody></table></div>`;
}

function legend(l, legendCup = null) {
  const c = l.config;
  const items = [];
  if (c.championsSpots) items.push(['champion', 'Champions']);
  if (c.upperLeagueId && c.promotionSpots) items.push(['promotion', 'Promotion']);
  if (!c.upperLeagueId && c.continentalSpots) items.push(['continental', c.continentalCupId && legendCup ? `${legendCup.name} (top ${c.continentalSpots})` : 'Continental places']);
  if (c.relegationSpots) items.push(['relegation', c.lowerLeagueId ? 'Relegation' : 'Bottom places']);
  return `<div class="legend">${items.map(([z, t]) => `<span><i class="z-dot z-${z}"></i>${t}</span>`).join('')}</div>`;
}

function tableTab(app, l) {
  if (!l.season) return '';
  const rows = splitTable(l, ui.tableMode);
  return `${segmented('tableMode', [['all', 'Overall'], ['home', 'Home'], ['away', 'Away']], ui.tableMode)}
    <div class="card flush">${tableHTML(app, l, rows)}</div>${legend(l, app.world.leagues[l.config.continentalCupId])}
    <p class="hint">Tiebreak: ${l.config.tiebreak === 'h2h' ? 'head-to-head, then goal difference, goals scored' : 'goal difference, goals scored, then head-to-head'}. ${l.config.pointsWin} pts win · ${l.config.pointsDraw} draw.</p>`;
}

// ---------- stats ----------
function statsTab(app, l) {
  const w = app.world, s = l.season;
  if (!s) return '';
  const st = playerStats(s.fixtures);
  const played = s.fixtures.some((f) => f.result);
  if (!played) return emptyState('No matches played yet', 'Statistics appear once the season kicks off.');
  const mode = ui.statMode;
  const rounds = Math.max(...s.fixtures.filter((f) => f.result).map((f) => f.round));
  let list, valueOf, label;
  if (mode === 'a') { list = topList(st, 'a', 25); valueOf = (x) => x.a; label = 'Assists'; }
  else if (mode === 'cs') { list = topList(st, 'cs', 25); valueOf = (x) => x.cs; label = 'Clean sheets'; }
  else if (mode === 'r') {
    const minApps = Math.max(1, Math.floor(rounds / 3));
    list = Object.values(st).filter((x) => x.apps >= minApps).sort((a, b) => b.avg - a.avg).slice(0, 25);
    valueOf = (x) => x.avg.toFixed(2); label = `Avg rating (min ${minApps} apps)`;
  } else if (mode === 'c') {
    list = Object.values(st).filter((x) => x.yc || x.rc).sort((a, b) => (b.rc * 3 + b.yc) - (a.rc * 3 + a.yc)).slice(0, 25);
    valueOf = (x) => `<span class="card-y">${x.yc}</span>${x.rc ? `<span class="card-r">${x.rc}</span>` : ''}`; label = 'Cards';
  } else if (mode === 'ga') { list = Object.values(st).filter((x) => x.g + x.a > 0).sort((a, b) => (b.g + b.a) - (a.g + a.a)).slice(0, 25); valueOf = (x) => x.g + x.a; label = 'Goals + assists'; }
  else { list = topList(st, 'g', 25); valueOf = (x) => x.g; label = 'Goals'; }
  const rows = list.map((x, i) => {
    const p = w.players[x.pid]; const c = w.clubs[x.clubId];
    return `<a class="rank-row" href="${p ? `#/player/${x.pid}` : '#'}"><span class="rk">${i + 1}</span>${clubBadge(c, 22)}
      <span class="rk-name"><b>${esc(p ? p.name : 'Former player')}</b><small>${esc(c ? c.name : '')} · ${x.apps} app${x.apps === 1 ? "" : "s"}</small></span><span class="rk-val">${valueOf(x)}</span></a>`;
  }).join('') || '<p class="muted pad-s">Nothing yet.</p>';
  return `${segmented('statMode', [['g', 'Goals'], ['a', 'Assists'], ['ga', 'G+A'], ['r', 'Rating'], ['cs', 'Clean sh.'], ['c', 'Cards']], mode)}
    <div class="card flush"><div class="rank-head">${label}</div>${rows}</div>
    <h3 class="section-title">Team statistics</h3>${teamStats(app, l)}`;
}

function teamStats(app, l) {
  const w = app.world, s = l.season;
  const agg = {};
  for (const id of s.clubIds) agg[id] = { id, p: 0, gf: 0, ga: 0, sh: 0, sot: 0, poss: 0, cs: 0, xg: 0 };
  for (const f of s.fixtures) {
    if (!f.result) continue;
    const r = f.result;
    for (const [side, i, opp] of [['home', 0, 'ag'], ['away', 1, 'hg']]) {
      const a = agg[f[side]]; if (!a) continue;
      a.p++; a.gf += side === 'home' ? r.hg : r.ag; a.ga += r[opp];
      a.sh += r.stats.shots[i]; a.sot += r.stats.shotsOnTarget[i]; a.poss += r.stats.possession[i]; a.xg += r.stats.xg[i];
      if (r[opp] === 0) a.cs++;
    }
  }
  const rows = Object.values(agg).filter((a) => a.p).sort((a, b) => (b.gf / b.p) - (a.gf / a.p));
  return `<div class="card flush"><div class="table-wrap"><table class="ltable stats-table"><thead><tr><th class="c-club">Club</th><th>GF/g</th><th>GA/g</th><th>xG/g</th><th>Shots</th><th>Poss</th><th>CS</th></tr></thead>
    <tbody>${rows.map((a) => { const c = w.clubs[a.id]; return `<tr><td class="c-club"><a href="#/club/${a.id}">${clubBadge(c, 20)}<span class="abbr show">${esc(c ? c.short : '?')}</span></a></td>
    <td>${(a.gf / a.p).toFixed(2)}</td><td>${(a.ga / a.p).toFixed(2)}</td><td>${(a.xg / a.p).toFixed(2)}</td><td>${(a.sh / a.p).toFixed(1)}</td><td>${Math.round(a.poss / a.p)}%</td><td>${a.cs}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}

// ---------- form ----------
function formTab(app, l) {
  const w = app.world, s = l.season;
  if (!s) return '';
  const streaks = clubStreaks(s.clubIds, s.fixtures);
  const rows = s.clubIds.map((id) => {
    const fx = s.fixtures.filter((f) => f.result && (f.home === id || f.away === id)).sort((a, b) => a.round - b.round).slice(-6);
    const pts = clubForm(l, id, Infinity, 6).reduce((t, r) => t + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
    return { id, fx, pts };
  }).sort((a, b) => b.pts - a.pts);
  if (!rows.some((r) => r.fx.length)) return emptyState('No form yet', 'Play some matches to see each club\'s form guide.');
  return `<div class="card flush">${rows.map(({ id, fx, pts }) => {
    const c = w.clubs[id];
    const cells = fx.map((f) => {
      const home = f.home === id;
      const gf = home ? f.result.hg : f.result.ag, ga = home ? f.result.ag : f.result.hg;
      const r = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
      const opp = w.clubs[home ? f.away : f.home];
      return `<a class="fg-cell f-${r}" href="#/match/${l.id}/${f.id}" title="${esc(opp ? opp.name : '')}">${clubBadge(opp, 16)}<b>${gf}-${ga}</b><small>${home ? 'H' : 'A'}</small></a>`;
    }).join('');
    const st = streaks[id];
    return `<div class="fg-row"><a class="fg-club" href="#/club/${id}">${clubBadge(c, 24)}<span>${esc(c ? c.short : '?')}</span></a><div class="fg-cells">${cells}</div><div class="fg-pts"><b>${pts}</b><small>${st.unbeaten >= 3 ? `${st.unbeaten} unb.` : ''}</small></div></div>`;
  }).join('')}</div><p class="hint">Points from the last six matches. Most recent on the right.</p>`;
}

// ---------- history ----------
function historyTab(app, l) {
  const w = app.world;
  if (!l.history.length) return emptyState('No completed seasons', 'Champions, final tables and award winners appear here after each season.');
  const titles = {};
  for (const h of l.history) titles[h.championId] = (titles[h.championId] || 0) + 1;
  const roll = Object.entries(titles).sort((a, b) => b[1] - a[1]);
  const name = (h, id) => (w.clubs[id] ? w.clubs[id].name : h.clubNames[id] || 'Former club');
  return `<h3 class="section-title">Roll of honour</h3>
    <div class="card honour-roll">${roll.map(([id, n]) => `<a href="#/club/${id}" class="hr-item">${clubBadge(w.clubs[id], 36)}<b>${n}</b><span>${esc(w.clubs[id] ? w.clubs[id].short : '—')}</span></a>`).join('')}</div>
    <h3 class="section-title">Previous champions</h3>
    ${l.history.slice().reverse().map((h) => {
      const champ = w.clubs[h.championId];
      const ts = h.topScorers[0];
      return `<details class="card hist">
        <summary><span class="hist-season">${esc(h.label)}</span>${clubBadge(champ, 30)}<span class="hist-champ"><b>${esc(name(h, h.championId))}</b><small>${h.table[0].pts} pts · runner-up ${esc(name(h, h.runnerUpId))}</small></span></summary>
        <div class="hist-body">
          ${ts ? `<p>${ICONS.boot} Top scorer: <b>${esc(ts.name)}</b> (${ts.goals}) · ${h.topAssists[0] ? `Assists: <b>${esc(h.topAssists[0].name)}</b> (${h.topAssists[0].assists})` : ''}</p>` : ''}
          ${l.config.continentalCupId && app.world.leagues[l.config.continentalCupId] ? `<p class="up">${ICONS.star} ${esc(app.world.leagues[l.config.continentalCupId].name)}: ${h.table.slice(0, l.config.continentalSpots).map((r) => esc(name(h, r.clubId))).join(', ')}</p>` : ''}
          ${h.promoted.length ? `<p class="up">↑ Promoted: ${h.promoted.map((id) => esc(name(h, id))).join(', ')}</p>` : ''}
          ${h.relegated.length ? `<p class="down">↓ Relegated: ${h.relegated.map((id) => esc(name(h, id))).join(', ')}</p>` : ''}
          <table class="ltable compact"><thead><tr><th>#</th><th class="c-club">Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
          ${h.table.map((r, i) => `<tr class="z-${zoneFor(i + 1, h.table.length, l.config)}"><td>${i + 1}</td><td class="c-club">${clubBadge(w.clubs[r.clubId], 18)}<span class="full show">${esc(name(h, r.clubId))}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}
          </tbody></table>
          <p class="hint">Seed <code>${esc(h.seed)}</code></p>
        </div></details>`;
    }).join('')}`;
}

// ---------- records ----------
function recordsTab(app, l) {
  const w = app.world;
  const rec = leagueRecords(w, l);
  if (!rec.length) return emptyState('No records yet', 'Records are set as matches are played.');
  return `<div class="card flush">${rec.map((r) => `<div class="rec-row"><div class="rec-label">${esc(r.label)}</div><div class="rec-val"><b>${esc(r.value)}</b><span>${r.html}</span></div></div>`).join('')}</div>`;
}

export const actions = {
  winGame(app, el) { winGameFlow(app, el.dataset.id); },
  stopWin(app, el) {
    const id = app.route.params[0];
    app.act((w) => setForcedWins(w.leagues[id], el.dataset.id, 0), 'Back to normal');
  },
  round(app, el) { const l = app.world.leagues[app.route.params[0]]; ui.round[l.id] = Number(el.dataset.v); app.render(); },
  simOne(app, el) {
    const id = app.route.params[0];
    liveSimMatch(app, id, el.dataset.id, { onDone: () => afterPlay(app, id) });
  },
  play(app, el) { ui.round[el.dataset.id] = null; simMatchday(app, el.dataset.id); },
  season(app, el) { ui.round[el.dataset.id] = null; simSeason(app, el.dataset.id); },
  next(app, el) { ui.round[el.dataset.id] = null; nextSeason(app, el.dataset.id); },
  seg(app, el) {
    if (el.dataset.name === 'tableMode') ui.tableMode = el.dataset.value;
    if (el.dataset.name === 'statMode') ui.statMode = el.dataset.value;
    app.render();
  },
};

export function onChange(app, el) {
  if (el.dataset.field === 'round') { ui.round[app.route.params[0]] = Number(el.value); app.render(); }
}

export { matchHighlights };
