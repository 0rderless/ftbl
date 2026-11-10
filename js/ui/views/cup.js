// Champions League (cup) screens, rendered inside the league route.
import { esc } from '../dom.js';
import { ICONS, header, tabs, leagueLogo, clubBadge, emptyState } from '../components.js';
import { currentRound, totalRounds, seasonStarted } from '../../league/season.js';
import { STAGES, roundLabel, stageOfRound, groupTables, pendingQualifiers, forcedWins, isKnockout, playLabel, cupTotalRounds } from '../../league/cup.js';
import { winLabel } from '../winGame.js';
import { seasonStepper, pastEntry, pastName } from '../pastSeasons.js';

export const CUP_TABS = [['fixtures', 'Fixtures'], ['groups', 'Groups'], ['bracket', 'Knockouts'], ['stats', 'Stats'], ['history', 'History']];
export const KO_TABS = [['fixtures', 'Fixtures'], ['bracket', 'Rounds'], ['stats', 'Stats'], ['history', 'History']];

export function cupStageText(l) {
  const s = l.season;
  if (!s) return '';
  if (s.finished) return 'Season complete';
  const r = currentRound(l);
  return roundLabel(r, l);
}

function followHint(app, l) {
  const w = app.world;
  const leader = l.config.followLeagueId && w.leagues[l.config.followLeagueId];
  if (leader) return `<p class="hint">${ICONS.info} Plays automatically when you play the ${esc(leader.name)}. You can still play it yourself here.</p>`;
  const fl = Object.values(w.leagues).filter((x) => x.type === 'cup' && x.config.followLeagueId === l.id);
  return fl.length ? `<p class="hint">${ICONS.info} Playing the ${esc(l.name)} also plays the ${fl.map((x) => esc(x.name)).join(' and ')}.</p>` : '';
}

export function renderCup(app, l, tab, ui, statsTab) {
  const s = l.season;
  const done = s ? s.fixtures.filter((f) => f.result).length : 0;
  const total = cupTotalRounds(l) || 1;
  const pct = s ? (Math.max(0, currentRound(l) - 1) / total) * 100 : 0;
  let body;
  if (tab === 'groups' && !isKnockout(l)) body = groupsTab(app, l);
  else if (tab === 'bracket') body = bracketTab(app, l);
  else if (tab === 'stats') body = statsTab(app, l);
  else if (tab === 'history') body = historyTab(app, l);
  else body = fixturesTab(app, l, ui);
  return `${header({ title: l.name, sub: `${esc(s ? s.label : '')} · ${esc(cupStageText(l))}`, back: '#/leagues', logo: leagueLogo(l, 34), actions: `<a class="icon-btn" href="#/league/${l.id}/edit" aria-label="Edit competition">${ICONS.edit}</a>` })}
    <div class="progress slim"><i style="width:${s && s.finished ? 100 : pct}%"></i></div>
    ${tabs(isKnockout(l) ? KO_TABS : CUP_TABS, tab, `#/league/${l.id}`)}
    <div class="pad">${winnerBanner(app, l)}${followHint(app, l)}${body}</div>${done ? '' : ''}`;
}

function winnerBanner(app, l) {
  const s = l.season;
  if (!s || !s.finished) return '';
  const h = l.history[l.history.length - 1];
  const c = h && app.world.clubs[h.championId];
  const pending = pendingQualifiers(app.world, l);
  return `<div class="card champion-banner ucl">
    <div class="cb-badge">${clubBadge(c, 64)}</div>
    <div><small>${esc(s.label)} winners</small><h3>${esc(c ? c.name : '')}</h3>
    <button class="btn primary sm" data-act="next" data-id="${l.id}">${ICONS.ff} Start next season</button>
    ${pending.length ? `<p class="hint">${ICONS.info} Next season's qualifiers come from the end of ${pending.map((x) => esc(x.name)).join(', ')} ${esc(pending[0].season ? pending[0].season.label : '')}.</p>` : ''}</div>
  </div>`;
}

function tieFor(l, f) { return l.season.ties.find((t) => t.fixtures.includes(f.id)); }

function fixtureRow(app, l, f, isCurrent) {
  const w = app.world;
  const h = w.clubs[f.home], a = w.clubs[f.away];
  const r = f.result;
  const tie = tieFor(l, f);
  let hw = r && r.hg > r.ag, aw = r && r.ag > r.hg;
  let note = f.stage === 'groups' ? `Group ${f.group}` : f.stage === 'final' ? `Final · ${esc(f.venue || 'Neutral venue')}` : f.leg ? `${f.leg === 1 ? '1st' : '2nd'} leg` : 'One match · extra time & penalties if level';
  if (tie && tie.winner && tie.fixtures[tie.fixtures.length - 1] === f.id) {
    hw = tie.winner === f.home; aw = tie.winner === f.away;
    const [ga, gb] = tie.agg;
    const aggH = f.home === tie.a ? ga : gb, aggA = f.home === tie.a ? gb : ga;
    if (tie.fixtures.length > 1) note += ` · agg ${aggH}-${aggA}`;
    if (r.et && !r.pens) note += ' · AET';
    if (r.pens) note += ` · ${r.pens.home}-${r.pens.away} pens`;
  } else if (tie && f.leg === 2 && !r) {
    const first = l.season.fixtures.find((x) => x.id === tie.fixtures[0]);
    if (first && first.result) note += ` · 1st leg ${first.result.ag}-${first.result.hg}`;
  }
  return `<div class="fx-row ${r ? 'played' : ''}">
    <a class="fx-main" href="#/match/${l.id}/${f.id}">
      <span class="fx-team home ${hw ? 'win' : ''}"><span class="nm">${esc(h ? h.name : '?')}</span>${clubBadge(h, 26)}</span>
      <span class="fx-score">${r ? `<b>${r.hg}</b><b>${r.ag}</b>` : '<em>vs</em>'}</span>
      <span class="fx-team away ${aw ? 'win' : ''}">${clubBadge(a, 26)}<span class="nm">${esc(a ? a.name : '?')}</span></span>
    </a>
    ${!r && isCurrent ? `<button class="mini-btn" data-act="simOne" data-id="${f.id}" aria-label="Simulate this match">${ICONS.play}</button>` : ''}
  </div><div class="fx-note">${note}</div>`;
}

function fixturesTab(app, l, ui) {
  const s = l.season;
  const cr = currentRound(l);
  const maxDrawn = Math.max(...s.fixtures.map((f) => f.round));
  let r = ui.round[l.id] || cr || maxDrawn;
  r = Math.max(1, Math.min(maxDrawn, r));
  const list = s.fixtures.filter((f) => f.round === r).sort((a, b) => String(a.group || '').localeCompare(String(b.group || '')));
  const isCurrent = r === cr;
  const rounds = Array.from({ length: maxDrawn }, (_, i) => i + 1);
  return `<div class="round-nav">
      <button class="icon-btn" data-act="round" data-v="${r - 1}" ${r <= 1 ? 'disabled' : ''} aria-label="Previous round">${ICONS.chevL}</button>
      <label class="round-select"><span>${esc(stageOfRound(r, l).label)}<small>${esc(isKnockout(l) ? (isCurrent ? 'Current' : r < cr || !cr ? 'Played' : '') : (roundLabel(r).split(' · ')[1] || (isCurrent ? 'Current' : '')))}${!isKnockout(l) && isCurrent && stageOfRound(r).key !== 'groups' ? ' · current' : ''}</small></span>
        <select data-field="round" aria-label="Choose round">${rounds.map((i) => `<option value="${i}" ${i === r ? 'selected' : ''}>${esc(roundLabel(i, l))}</option>`).join('')}</select></label>
      <button class="icon-btn" data-act="round" data-v="${r + 1}" ${r >= maxDrawn ? 'disabled' : ''} aria-label="Next round">${ICONS.chev}</button>
    </div>
    <div class="card fx-list cup">${list.map((f) => fixtureRow(app, l, f, isCurrent)).join('')}</div>
    ${!s.finished ? `${activeWins(app, l)}<div class="sim-bar">
      <button class="btn primary" data-act="play" data-id="${l.id}">${ICONS.play} Play ${esc(isKnockout(l) ? stageOfRound(cr, l).short : playLabel(l, cr))}</button>
      <button class="btn win-btn" data-act="winGame" data-id="${l.id}">${ICONS.trophy} Win game</button>
      <button class="btn" data-act="season" data-id="${l.id}" aria-label="Simulate all">${ICONS.ff}</button>
    </div>` : ''}
    ${s.qualifiers && s.qualifiers.length ? `<p class="hint">${ICONS.trophy} Qualified from the league: ${s.qualifiers.map((id) => esc(app.world.clubs[id] ? app.world.clubs[id].name : '?')).join(', ')}</p>` : ''}
    <p class="hint">${seasonStarted(l) ? '' : 'The group draw keeps clubs from the same country or league apart. '}Season seed <code>${esc(s.seed)}</code></p>`;
}

export function activeWins(app, l) {
  const fw = forcedWins(l);
  const ids = Object.keys(fw);
  if (!ids.length) return '';
  return `<div class="card win-active">${ICONS.trophy}<div>${ids.map((id) => { const c = app.world.clubs[id]; return `<span>${clubBadge(c, 18)} <b>${esc(c ? c.name : '?')}</b> wins ${esc(winLabel(fw[id]))} <button class="link-btn" data-act="stopWin" data-id="${id}">Stop</button></span>`; }).join('')}</div></div>`;
}

function pastGroups(app, l, h) {
  const w = app.world;
  const qual = new Set(h.qualifiers || []);
  if (!h.groups || !h.groups.length) return emptyState('No group tables saved for this season');
  return `<div class="groups-grid">${h.groups.map((g) => `<div class="card flush group-card">
    <div class="rank-head">Group ${g.name} · final</div>
    <table class="ltable compact"><thead><tr><th>#</th><th class="c-club">Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>
    ${g.table.map((r, i) => `<tr class="${i < 2 ? 'z-promotion' : 'z-'} ${qual.has(r.clubId) ? 'hl' : ''}"><td class="c-pos"><span>${i + 1}</span></td>
      <td class="c-club"><a href="#/club/${r.clubId}">${clubBadge(w.clubs[r.clubId], 20)}<span class="full show">${esc(pastName(w, h, r.clubId))}</span></a></td><td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="c-pts"><b>${r.pts}</b></td></tr>`).join('')}
    </tbody></table></div>`).join('')}</div>
    <div class="legend"><span><i class="z-dot z-promotion"></i>Reached the Round of 16</span><span><i class="z-dot hl-dot"></i>League qualifiers</span></div>`;
}

/** Past knockout results from a history entry, grouped by round, latest round first. */
function pastTies(app, l, h) {
  const w = app.world;
  const ties = h.ties || [];
  if (!ties.length) return emptyState('No knockout results saved for this season');
  const num = (st) => (st === 'final' ? 999 : st === 'qf' ? 997 : st === 'sf' ? 998 : st === 'r16' ? 996 : parseInt(String(st).replace(/\D/g, ''), 10) || 0);
  const stages = [...new Set(ties.map((t) => t.stage))].sort((a, b) => num(b) - num(a));
  const koMax = Math.max(...ties.filter((t) => t.stage !== 'final').map((t) => num(t.stage)));
  const nameOf = (st) => {
    if (st === 'final') return 'Final';
    const fixed = { r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals' }[st];
    if (fixed) return fixed;
    const n = num(st);
    return n === koMax ? 'Semi-finals' : n === koMax - 1 ? 'Quarter-finals' : `Round ${n}`;
  };
  const champ = h.championId;
  return `<div class="card past-notes"><p>🏆 <b>Winners:</b> ${esc(pastName(w, h, champ))}${h.final ? ` · final ${h.final.hg}–${h.final.ag}${h.final.pens ? ` (${h.final.pens[0]}–${h.final.pens[1]} pens)` : h.final.et ? ' aet' : ''}` : ''}</p>
    ${h.topScorers && h.topScorers[0] ? `<p>${ICONS.boot} <b>Top scorer:</b> ${esc(h.topScorers[0].name)} (${h.topScorers[0].goals})</p>` : ''}</div>
    ${stages.map((st, idx) => `<details class="ko-round" ${idx < 2 ? 'open' : ''}><summary><span>${esc(nameOf(st))}</span><small>${ties.filter((t) => t.stage === st).length} ties</small></summary><div class="card flush">
      ${ties.filter((t) => t.stage === st).map((t) => {
        if (!t.b) return `<div class="tie done"><span class="tie-team win">${clubBadge(w.clubs[t.a], 22)}<span>${esc(pastName(w, h, t.a))}</span><b>–</b></span><small>Bye</small></div>`;
        const [ga, gb] = t.agg || ['–', '–'];
        return `<div class="tie done"><span class="tie-team ${t.winner === t.a ? 'win' : 'out'}">${clubBadge(w.clubs[t.a], 22)}<span>${esc(pastName(w, h, t.a))}</span><b>${ga}</b></span>
          <span class="tie-team ${t.winner === t.b ? 'win' : 'out'}">${clubBadge(w.clubs[t.b], 22)}<span>${esc(pastName(w, h, t.b))}</span><b>${gb}</b></span>
          ${t.pens ? `<small>${esc(pastName(w, h, t.winner))} won ${Math.max(...t.pens)}–${Math.min(...t.pens)} on penalties</small>` : ''}</div>`;
      }).join('')}</div></details>`).join('')}`;
}

function groupsTab(app, l) {
  const h = pastEntry(l);
  if (h) return seasonStepper(l) + pastGroups(app, l, h);
  return seasonStepper(l) + groupsTabNow(app, l);
}

function groupsTabNow(app, l) {
  const w = app.world;
  const qual = new Set(l.season.qualifiers || []);
  return `<div class="groups-grid">${groupTables(l).map((g) => `<div class="card flush group-card">
    <div class="rank-head">Group ${g.name}</div>
    <table class="ltable compact"><thead><tr><th>#</th><th class="c-club">Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>
    ${g.rows.map((r, i) => { const c = w.clubs[r.clubId]; return `<tr class="${i < 2 ? 'z-promotion' : 'z-'} ${qual.has(r.clubId) ? 'hl' : ''}"><td class="c-pos"><span>${i + 1}</span></td>
      <td class="c-club"><a href="#/club/${r.clubId}">${clubBadge(c, 20)}<span class="full show">${esc(c ? c.name : '?')}</span></a></td><td>${r.p}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="c-pts"><b>${r.pts}</b></td></tr>`; }).join('')}
    </tbody></table></div>`).join('')}</div>
    <div class="legend"><span><i class="z-dot z-promotion"></i>Round of 16</span><span><i class="z-dot hl-dot"></i>League qualifiers</span></div>`;
}

function knockoutRounds(app, l) {
  const w = app.world;
  const s = l.season;
  const rounds = [...new Set(s.ties.map((t) => t.round))].sort((a, b) => b - a);
  const upcoming = [];
  for (let r = (rounds[0] || 0) + 1; r <= s.totalRounds; r++) upcoming.push(r);
  return `${upcoming.reverse().map((r) => `<h3 class="section-title">${esc(roundLabel(r, l))}</h3><p class="hint">To be drawn${(s.entries && s.entries[r]) ? ` · ${s.entries[r].length} clubs enter here` : ''}.</p>`).join('')}
  ${rounds.map((r, idx) => {
    const ties = s.ties.filter((t) => t.round === r);
    const entering = (s.entries && s.entries[r]) || [];
    const body = ties.map((t) => {
      const A = w.clubs[t.a], B = t.b && w.clubs[t.b];
      if (t.bye) return `<div class="tie done"><span class="tie-team win">${clubBadge(A, 22)}<span>${esc(A ? A.name : '?')}</span><b>–</b></span><small>Bye to the next round</small></div>`;
      const f = s.fixtures.find((x) => x.id === t.fixtures[0]);
      const r2 = f && f.result;
      const ga = r2 ? (f.home === t.a ? r2.hg : r2.ag) : null, gb = r2 ? (f.home === t.a ? r2.ag : r2.hg) : null;
      return `<a class="tie ${t.winner ? 'done' : ''}" href="#/match/${l.id}/${f.id}">
        <span class="tie-team ${t.winner === t.a ? 'win' : t.winner ? 'out' : ''}">${clubBadge(A, 22)}<span>${esc(A ? A.name : '?')}</span><b>${r2 ? ga : '–'}</b></span>
        <span class="tie-team ${t.winner === t.b ? 'win' : t.winner ? 'out' : ''}">${clubBadge(B, 22)}<span>${esc(B ? B.name : '?')}</span><b>${r2 ? gb : '–'}</b></span>
        ${r2 && (r2.et || r2.pens) ? `<small>${r2.pens ? `${t.winner === t.a ? Math.max(r2.pens.home, r2.pens.away) : Math.min(r2.pens.home, r2.pens.away)}-${t.winner === t.a ? Math.min(r2.pens.home, r2.pens.away) : Math.max(r2.pens.home, r2.pens.away)} on penalties` : 'After extra time'}</small>` : ''}
      </a>`;
    }).join('');
    const open = idx < 2 ? 'open' : '';
    return `<details class="ko-round" ${open}><summary><span>${esc(roundLabel(r, l))}</span><small>${ties.length} tie${ties.length === 1 ? '' : 's'}${entering.length ? ` · ${entering.length} clubs entered` : ''}</small></summary><div class="card flush">${body}</div></details>`;
  }).join('')}`;
}

function bracketTab(app, l) {
  const h = pastEntry(l);
  if (h) return seasonStepper(l) + pastTies(app, l, h);
  if (isKnockout(l)) return seasonStepper(l) + knockoutRounds(app, l);
  return seasonStepper(l) + bracketTabNow(app, l);
}

function bracketTabNow(app, l) {
  const w = app.world;
  const s = l.season;
  if (!s.ties.length) return emptyState('Knockouts not drawn yet', 'The Round of 16 is drawn when the group stage ends: group winners face runners-up from other groups.');
  return STAGES.filter((st) => st.key !== 'groups').map((st) => {
    const ties = s.ties.filter((t) => t.stage === st.key);
    if (!ties.length) return `<h3 class="section-title">${st.label}</h3><p class="hint">To be drawn.</p>`;
    return `<h3 class="section-title">${st.label}</h3><div class="card flush">${ties.map((t) => {
      const A = w.clubs[t.a], B = w.clubs[t.b];
      const played = t.fixtures.map((fid) => s.fixtures.find((f) => f.id === fid)).filter((f) => f && f.result);
      let ga = 0, gb = 0;
      for (const f of played) { if (f.home === t.a) { ga += f.result.hg; gb += f.result.ag; } else { ga += f.result.ag; gb += f.result.hg; } }
      const first = s.fixtures.find((f) => f.id === t.fixtures[0]);
      return `<a class="tie ${t.winner ? 'done' : ''}" href="#/match/${l.id}/${t.fixtures[t.fixtures.length - 1]}">
        <span class="tie-team ${t.winner === t.a ? 'win' : t.winner ? 'out' : ''}">${clubBadge(A, 22)}<span>${esc(A ? A.name : '?')}</span><b>${played.length ? ga : '–'}</b></span>
        <span class="tie-team ${t.winner === t.b ? 'win' : t.winner ? 'out' : ''}">${clubBadge(B, 22)}<span>${esc(B ? B.name : '?')}</span><b>${played.length ? gb : '–'}</b></span>
        <small>${st.key === 'final' ? esc(first.venue || '') : played.length ? `${played.length === 1 ? 'After 1st leg' : 'Aggregate'}` : 'Not played'}${t.pens ? ` · won ${Math.max(...t.pens)}-${Math.min(...t.pens)} on penalties` : ''}</small>
      </a>`;
    }).join('')}</div>`;
  }).join('');
}

function historyTab(app, l) {
  const w = app.world;
  if (!l.history.length) return emptyState('No winners yet', 'The winner of each season\'s final appears here.');
  const titles = {};
  for (const h of l.history) titles[h.championId] = (titles[h.championId] || 0) + 1;
  const name = (h, id) => (w.clubs[id] ? w.clubs[id].name : h.clubNames[id] || 'Former club');
  return `<h3 class="section-title">Roll of honour</h3>
    <div class="card honour-roll">${Object.entries(titles).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<a href="#/club/${id}" class="hr-item">${clubBadge(w.clubs[id], 36)}<b>${n}</b><span>${esc(w.clubs[id] ? w.clubs[id].short : '—')}</span></a>`).join('')}</div>
    <h3 class="section-title">Finals</h3>
    ${l.history.slice().reverse().map((h) => `<div class="card hist-final">
      <span class="hist-season">${esc(h.label)}</span>
      <div class="hf-main"><b>${esc(name(h, h.final.home))} ${h.final.hg}–${h.final.ag} ${esc(name(h, h.final.away))}</b>
      <small>${h.final.et ? 'After extra time' : ''}${h.final.pens ? ` · ${h.final.pens[0]}-${h.final.pens[1]} on penalties` : ''}${h.final.venue ? ` · ${esc(h.final.venue)}` : ''}</small>
      <small>🏆 ${esc(name(h, h.championId))}${h.topScorers[0] ? ` · ${ICONS.boot.replace('width="22" height="22"', 'width="12" height="12"')} ${esc(h.topScorers[0].name)} (${h.topScorers[0].goals})` : ''}</small></div>
      ${clubBadge(w.clubs[h.championId], 36)}</div>`).join('')}`;
}

export { totalRounds };
