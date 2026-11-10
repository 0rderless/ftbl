// UI-level simulation commands with matchday transitions.
import { playRound, playFixture, playSeason, currentRound, totalRounds, startNextSeason, pyramidPending, followers } from '../league/season.js';
import { roundLabel, pendingQualifiers, startNextCupSeason } from '../league/cup.js';
import { clubBadge, leagueLogo } from './components.js';
import { esc, sheet } from './dom.js';

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
  const row = (lg, f, i) => {
    const h = w.clubs[f.home], a = w.clubs[f.away];
    // all rows are in within about half a second, however many matches there are
    return `<a class="md-row" style="--d:${Math.min(i, 12) * 35}ms" href="#/match/${lg.id}/${f.id}" data-close>
      <span class="md-team"><span class="nm">${esc(h ? h.name : '?')}</span>${clubBadge(h, 26)}</span>
      <span class="md-score"><b>${f.result.hg}</b><i>-</i><b>${f.result.ag}</b>${f.result.pens ? `<small>${f.result.pens.home}-${f.result.pens.away}p</small>` : f.result.et ? '<small>aet</small>' : ''}</span>
      <span class="md-team away">${clubBadge(a, 26)}<span class="nm">${esc(a ? a.name : '?')}</span></span></a>`;
  };
  let rows = fixtures.map((f, i) => row(league, f, i)).join('');
  // leagues that play along automatically (e.g. Division 2 with Kronliga)
  // (Division 2 with Kronliga, the Europa League and Conference League with the Champions League)
  let n = fixtures.length;
  for (const fl of followers(w, league)) {
    if (fl.season.label !== league.season.label) continue;
    const list = fl.season.fixtures.filter((f) => f.round === round && f.result);
    if (list.length) rows += `<div class="md-sub">${leagueLogo(fl, 22)}<span>${esc(fl.name)} · ${esc(fl.type === 'cup' ? roundLabel(round, fl) : `Matchday ${round}`)}</span></div>` + list.map((f, i) => row(fl, f, n + i)).join('');
    n += list.length;
  }
  const o = overlay(`<div class="md-panel">
      <div class="md-head">${leagueLogo(league, 40)}<div><small>${esc(league.name)} · ${esc(league.season.label)}</small><h2>${esc(league.type === 'cup' ? roundLabel(round, league) : `Matchday ${round}`)}</h2></div></div>
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
  // a short "Matchday N" cover so the scores aren't visible before the results screen.
  // It shows straight away (before the matches are played) and a tap skips it.
  let intro = null;
  let skip = () => {};
  const tapped = new Promise((r) => { skip = r; });
  if (!reduceMotion()) {
    intro = overlay(`<div class="md-intro"><small>${esc(league.name)}</small><h1>${esc(league.type === 'cup' ? roundLabel(round, league).replace('Group stage · ', '') : `Matchday ${round}`)}</h1><div class="md-bar"><i></i></div></div>`, 'intro');
    intro.el.addEventListener('pointerdown', () => skip());
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // let it appear first
  }
  const t0 = performance.now();
  const played = app.act((w) => playRound(w, w.leagues[leagueId], app.params()));
  if (!played) { if (intro) intro.close(); return; }
  if (intro) await Promise.race([new Promise((r) => setTimeout(r, Math.max(0, 450 - (performance.now() - t0)))), tapped]);
  // open the results on top of the cover, then remove it: the scores never show behind
  if (played.length) resultsOverlay(app, app.world.leagues[leagueId], round, played);
  if (intro) setTimeout(() => intro.close(), 150);
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

export function afterPlay(app, leagueId) {
  const league = app.world.leagues[leagueId];
  if (league && league.season && league.season.finished) {
    championCelebration(app, league);
    // competitions that finished with it (e.g. Europa League with the Champions League)
    const others = followers(app.world, league).filter((f) => f.season.finished && f.season.label === league.season.label && f.history.length);
    if (others.length) {
      app.toast(others.map((f) => { const h = f.history[f.history.length - 1]; const c = app.world.clubs[h.championId]; return `🏆 ${c ? c.name : 'Champions'} win the ${f.name}`; }).join(' · '), 'ok');
    }
  }
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
      const names = pending.map((l) => `${l.name} ${l.season.label}`).join(', ');
      const choice = await sheet(`<h3 class="sheet-title">Qualifiers still playing</h3>
        <p class="sheet-text">The next ${esc(league.name)} takes its qualifiers from the final table of ${esc(names)}, which isn't finished yet.</p>
        <div class="wg-options"><button class="btn primary" data-sheet="sim">Finish ${esc(pending.map((l) => l.name).join(', '))} first</button>
        <button class="btn" data-sheet="latest">Use the latest finished table instead</button></div>
        <div class="sheet-actions one"><button class="btn ghost" data-sheet="cancel">Cancel</button></div>`);
      if (!choice || choice === 'cancel') return;
      if (choice === 'sim') app.act((w) => { for (const l of pending) playSeason(w, w.leagues[l.id], app.params()); });
    }
    const ok2 = app.act((w) => { startNextCupSeason(w, w.leagues[leagueId]); return true; });
    if (ok2) {
      const s = app.world.leagues[leagueId].season;
      app.toast(league.format === 'knockout' ? `${league.name} ${s.label} drawn · ${s.clubIds.length} clubs` : `${league.name} ${s.label} drawn · qualified: ${(s.qualifiers || []).map((id) => app.world.clubs[id] && app.world.clubs[id].name).join(', ')}`, 'ok');
      app.nav(`#/league/${leagueId}/${league.format === 'knockout' ? 'fixtures' : 'groups'}`);
    }
    return;
  }
  const pending = pyramidPending(app.world, league);
  if (pending.length) {
    const ok = await app.confirm(`Promotion and relegation link this league with ${pending.map((l) => l.name).join(', ')}, which ${pending.length > 1 ? 'are' : 'is'} still in progress. Simulate the rest of ${pending.length > 1 ? 'those seasons' : 'that season'} now?`, { ok: 'Simulate & continue', title: 'Linked leagues' });
    if (!ok) return;
    app.act((w) => { for (const l of pending) playSeason(w, w.leagues[l.id], app.params()); });
  }
  const moves = app.act((w) => startNextSeason(w, w.leagues[leagueId]));
  if (!moves) return;
  const w = app.world;
  const lines = moves.map((m) => `${m.up.map((id) => w.clubs[id] && w.clubs[id].name).join(', ') || 'Nobody'} promoted to ${m.upper.name}; ${m.down.map((id) => w.clubs[id] && w.clubs[id].name).join(', ') || 'nobody'} relegated.`);
  for (const l of Object.values(w.leagues)) {
    const h = l.history[l.history.length - 1];
    if (h && h.newcomers && h.newcomers.length && l.season && l.season.number > h.number && !l.season.fixtures.some((f) => f.result)) {
      lines.push(`${h.relegated.map((id) => w.clubs[id] && w.clubs[id].name).join(', ')} dropped out of ${l.name}; ${h.newcomers.map((id) => w.clubs[id] && w.clubs[id].name).join(', ')} came in from the Daffers Cup.`);
    }
  }
  app.toast(lines.length ? lines.join(' ') : `Season ${w.leagues[leagueId].season.label} has begun`, 'ok');
  app.nav(`#/league/${leagueId}/fixtures`);
}
