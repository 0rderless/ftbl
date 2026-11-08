// UI-level simulation commands with matchday transitions.
import { playRound, playFixture, playSeason, currentRound, totalRounds, startNextSeason, pyramid } from '../league/season.js';
import { roundLabel, pendingQualifiers, startNextCupSeason } from '../league/cup.js';
import { clubBadge, leagueLogo } from './components.js';
import { esc } from './dom.js';

function overlay(html, cls = '') {
  const el = document.createElement('div');
  el.className = 'md-overlay ' + cls;
  el.innerHTML = html;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 320); };
  return { el, close };
}

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resultsOverlay(app, league, round, fixtures) {
  const w = app.world;
  const rows = fixtures.map((f, i) => {
    const h = w.clubs[f.home], a = w.clubs[f.away];
    return `<a class="md-row" style="--d:${i * 70}ms" href="#/match/${league.id}/${f.id}" data-close>
      <span class="md-team"><span class="nm">${esc(h ? h.name : '?')}</span>${clubBadge(h, 26)}</span>
      <span class="md-score"><b>${f.result.hg}</b><i>-</i><b>${f.result.ag}</b>${f.result.pens ? `<small>${f.result.pens.home}-${f.result.pens.away}p</small>` : f.result.et ? '<small>aet</small>' : ''}</span>
      <span class="md-team away">${clubBadge(a, 26)}<span class="nm">${esc(a ? a.name : '?')}</span></span></a>`;
  }).join('');
  const o = overlay(`<div class="md-panel">
      <div class="md-head">${leagueLogo(league, 40)}<div><small>${esc(league.name)} · ${esc(league.season.label)}</small><h2>${esc(league.type === 'cup' ? roundLabel(round) : `Matchday ${round}`)}</h2></div></div>
      <div class="md-list">${rows}</div>
      <button class="btn primary block" data-close>Continue</button>
    </div>`);
  o.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === o.el) o.close(); });
}

export async function simMatchday(app, leagueId) {
  const league = app.world.leagues[leagueId];
  if (!league || !league.season) return;
  const round = currentRound(league);
  if (!round) { app.toast('Season complete', 'info'); return; }
  let intro = null;
  if (!reduceMotion()) {
    intro = overlay(`<div class="md-intro"><small>${esc(league.name)}</small><h1>${esc(league.type === 'cup' ? roundLabel(round).replace('Group stage · ', '') : `Matchday ${round}`)}</h1><div class="md-bar"><i></i></div></div>`, 'intro');
  }
  const played = app.act((w) => playRound(w, w.leagues[leagueId], app.params()));
  if (!played) { if (intro) intro.close(); return; }
  if (intro) await new Promise((r) => setTimeout(r, 900));
  if (intro) intro.close();
  if (played.length) resultsOverlay(app, app.world.leagues[leagueId], round, played);
  afterPlay(app, leagueId);
}

export function simFixture(app, leagueId, fixtureId) {
  const f = app.act((w) => playFixture(w, w.leagues[leagueId], fixtureId, app.params()));
  if (f) afterPlay(app, leagueId);
  return f;
}

export async function simSeason(app, leagueId) {
  const league = app.world.leagues[leagueId];
  if (!league || !league.season) return;
  const left = totalRounds(league) - currentRound(league) + 1;
  if (!(await app.confirm(`Simulate the remaining ${left} matchday${left === 1 ? '' : 's'} of ${league.name}?`, { ok: 'Simulate season', title: 'Simulate season' }))) return;
  const o = overlay(`<div class="md-intro"><small>${esc(league.name)}</small><h1>Simulating season…</h1><div class="md-bar"><i></i></div></div>`, 'intro');
  await new Promise((r) => setTimeout(r, 60));
  const t0 = performance.now();
  app.act((w) => playSeason(w, w.leagues[leagueId], app.params()));
  const wait = Math.max(0, 700 - (performance.now() - t0));
  await new Promise((r) => setTimeout(r, wait));
  o.close();
  afterPlay(app, leagueId);
}

function afterPlay(app, leagueId) {
  const league = app.world.leagues[leagueId];
  if (league && league.season && league.season.finished) championCelebration(app, league);
}

export function championCelebration(app, league) {
  const h = league.history[league.history.length - 1];
  if (!h) return;
  const c = app.world.clubs[h.championId];
  const o = overlay(`<div class="champ">
      <div class="confetti">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.18}s;--h:${(i * 47) % 360}"></i>`).join('')}</div>
      <small>${esc(league.name)} · ${esc(h.label)}</small>
      <div class="champ-badge">${clubBadge(c, 140)}</div>
      <h1>${esc(c ? c.name : h.clubNames[h.championId] || 'Champions')}</h1>
      <p>${league.type === 'cup' ? `win the ${esc(league.name)}!${h.final ? ` ${h.final.hg}–${h.final.ag}${h.final.pens ? ` (${h.final.pens[0]}–${h.final.pens[1]} pens)` : h.final.et ? ' after extra time' : ''}` : ''}` : 'are the champions!'}</p>
      <button class="btn primary" data-close>Celebrate</button>
    </div>`, 'champ-wrap');
  o.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) o.close(); });
}

export async function nextSeason(app, leagueId) {
  const league = app.world.leagues[leagueId];
  if (league.type === 'cup') {
    const pending = pendingQualifiers(app.world, league);
    if (pending.length) {
      const names = pending.map((l) => l.name).join(', ');
      const ok = await app.confirm(`The top clubs of ${names} qualify for the next ${league.name}, but ${names} hasn't finished its season yet. Simulate the rest of it now?`, { ok: 'Simulate & continue', title: 'Qualifiers not decided' });
      if (!ok) return;
      app.act((w) => { for (const l of pending) if (l.season && !l.season.finished) playSeason(w, w.leagues[l.id], app.params()); });
      if (pendingQualifiers(app.world, league).length) { app.toast(`Finish the ${names} season first, then try again`, 'info'); return; }
    }
    const ok2 = app.act((w) => { startNextCupSeason(w, w.leagues[leagueId]); return true; });
    if (ok2) {
      const s = app.world.leagues[leagueId].season;
      app.toast(`${league.name} ${s.label} drawn · qualified: ${(s.qualifiers || []).map((id) => app.world.clubs[id] && app.world.clubs[id].name).join(', ')}`, 'ok');
      app.nav(`#/league/${leagueId}/groups`);
    }
    return;
  }
  const group = pyramid(app.world, league);
  const pending = group.filter((l) => !l.season || !l.season.finished);
  if (pending.length) {
    const ok = await app.confirm(`Promotion and relegation link this league with ${pending.map((l) => l.name).join(', ')}, which ${pending.length > 1 ? 'are' : 'is'} still in progress. Simulate the rest of ${pending.length > 1 ? 'those seasons' : 'that season'} now?`, { ok: 'Simulate & continue', title: 'Linked leagues' });
    if (!ok) return;
    app.act((w) => { for (const l of pending) playSeason(w, w.leagues[l.id], app.params()); });
  }
  const moves = app.act((w) => startNextSeason(w, w.leagues[leagueId]));
  if (!moves) return;
  const w = app.world;
  const lines = moves.map((m) => `${m.up.map((id) => w.clubs[id] && w.clubs[id].name).join(', ') || 'Nobody'} promoted to ${m.upper.name}; ${m.down.map((id) => w.clubs[id] && w.clubs[id].name).join(', ') || 'nobody'} relegated.`);
  app.toast(lines.length ? lines.join(' ') : `Season ${w.leagues[leagueId].season.label} has begun`, 'ok');
  app.nav(`#/league/${leagueId}/fixtures`);
}
