// Auto play: keeps playing matchdays across the competitions you pick, until you stop it.
import { esc, sheet } from './dom.js';
import { ICONS, leagueLogo, clubBadge } from './components.js';
import { playRound, playSeason, currentRound, startNextSeason, pyramidPending, followers } from '../league/season.js';
import { roundLabel, isCup, startNextCupSeason } from '../league/cup.js';

export const SPEEDS = [['slow', 'Slow', 2500], ['normal', 'Normal', 1200], ['fast', 'Fast', 450], ['max', 'Turbo', 60]];

const run = { active: false, timer: null, app: null, sel: [], speed: 'normal', seasons: false, idx: 0, matchdays: 0, log: [] };

export function isAutoRunning() { return run.active; }

function prefs(app) {
  return (app.world.settings.ui && app.world.settings.ui.autoPlay) || {};
}

/** Competitions to offer: everything except leagues that already play along with another one. */
function choices(w) {
  return Object.values(w.leagues).sort((a, b) => (a.type === 'cup') - (b.type === 'cup') || (a.format === 'knockout') - (b.format === 'knockout') || a.createdAt - b.createdAt);
}

export async function openAutoPlay(app) {
  if (run.active) { stopAuto('Auto play stopped'); return; }
  const w = app.world;
  const p = prefs(app);
  const comps = choices(w);
  const leaderOf = (l) => l.config && l.config.followLeagueId && w.leagues[l.config.followLeagueId];
  const saved = new Set(p.sel || comps.filter((l) => !leaderOf(l)).map((l) => l.id));
  const speed = p.speed || 'normal';
  const out = await sheet(`<h3 class="sheet-title">${ICONS.ff} Auto play</h3>
    <p class="sheet-text">Plays matchdays one after another in the competitions you pick. You can keep using the app and stop any time.</p>
    <div class="ap-list">${comps.map((l) => {
      const leader = leaderOf(l);
      return `<label class="ap-item ${leader ? 'follow' : ''}"><input type="checkbox" data-ap="${l.id}" ${saved.has(l.id) && !leader ? 'checked' : ''} ${leader ? 'disabled' : ''}>
        ${leagueLogo(l, 30)}<span><b>${esc(l.name)}</b><small>${leader ? `plays automatically with ${esc(leader.name)}` : l.season ? `${esc(l.season.label)} · ${l.season.finished ? 'season complete' : esc(l.type === 'cup' ? roundLabel(currentRound(l), l) : `matchday ${currentRound(l)}`)}` : ''}</small></span></label>`;
    }).join('')}</div>
    <div class="field"><span>Speed</span><div class="seg ap-speed">${SPEEDS.map(([k, label]) => `<button type="button" class="seg-btn ${k === speed ? 'on' : ''}" data-speed="${k}">${label}</button>`).join('')}</div></div>
    <label class="toggle-inline"><input type="checkbox" data-ap-seasons ${p.seasons ? 'checked' : ''}> Keep going into new seasons</label>
    <div class="sheet-actions"><button class="btn ghost" data-sheet="cancel">Cancel</button><button class="btn primary" data-sheet="start">${ICONS.play} Start</button></div>`, {
    onMount(el) {
      el.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
        el.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b));
      }));
      // capture choices just before the sheet closes
      el.querySelector('[data-sheet="start"]').addEventListener('click', () => {
        run.pending = {
          sel: [...el.querySelectorAll('[data-ap]:checked')].map((x) => x.dataset.ap),
          speed: (el.querySelector('[data-speed].on') || {}).dataset ? el.querySelector('[data-speed].on').dataset.speed : 'normal',
          seasons: el.querySelector('[data-ap-seasons]').checked,
        };
      }, true);
    },
  });
  if (out !== 'start' || !run.pending) return;
  const { sel, speed: sp, seasons } = run.pending;
  run.pending = null;
  if (!sel.length) { app.toast('Pick at least one competition', 'error'); return; }
  app.act((world) => { world.settings.ui.autoPlay = { sel, speed: sp, seasons }; });
  startAuto(app, sel, sp, seasons);
}

export function startAuto(app, sel, speed = 'normal', seasons = false) {
  Object.assign(run, { active: true, app, sel: sel.slice(), speed, seasons, idx: 0, matchdays: 0, log: [] });
  renderBar();
  schedule(200);
}

export function stopAuto(message) {
  if (!run.active) return;
  run.active = false;
  clearTimeout(run.timer);
  const bar = document.getElementById('autoplay-bar');
  if (bar) { bar.classList.remove('show'); setTimeout(() => bar.remove(), 300); }
  document.body.classList.remove('autoplaying');
  if (message && run.app) run.app.toast(message, 'ok');
  if (run.app) run.app.render({ silent: true });
}

function schedule(ms) {
  clearTimeout(run.timer);
  run.timer = setTimeout(tick, ms);
}

function delay() { return (SPEEDS.find((s) => s[0] === run.speed) || SPEEDS[1])[2]; }

/** Start the next season of a finished competition without any prompts. */
function autoNextSeason(app, l) {
  const w = app.world;
  if (isCup(l)) { app.act((world) => startNextCupSeason(world, world.leagues[l.id])); return; }
  app.act((world) => {
    for (const p of pyramidPending(world, world.leagues[l.id])) playSeason(world, world.leagues[p.id], app.params());
    startNextSeason(world, world.leagues[l.id]);
  });
}

function tick() {
  if (!run.active) return;
  const app = run.app;
  const w = app.world;
  const comps = run.sel.map((id) => w.leagues[id]).filter(Boolean);
  if (!comps.length) { stopAuto('Auto play stopped'); return; }
  // round-robin over the selected competitions that still have a matchday to play
  let chosen = null;
  for (let i = 0; i < comps.length; i++) {
    const l = comps[(run.idx + i) % comps.length];
    if (l.season && !l.season.finished && currentRound(l)) { chosen = l; run.idx = (run.idx + i + 1) % comps.length; break; }
  }
  if (!chosen) {
    if (!run.seasons) { stopAuto('Auto play finished: the selected competitions are complete'); return; }
    // all done: start new seasons (leagues first so cups can take their qualifiers)
    const finished = comps.filter((l) => l.season && l.season.finished).sort((a, b) => isCup(a) - isCup(b));
    let started = 0;
    for (const l of finished) {
      if (!w.leagues[l.id].season.finished) continue; // already rolled over with a linked league
      try { autoNextSeason(app, l); started++; } catch (e) { console.warn(e); }
    }
    if (!started) { stopAuto('Auto play stopped: nothing left to play'); return; }
    run.log.unshift({ text: 'New seasons started' });
    renderBar();
    schedule(delay());
    return;
  }
  const round = currentRound(chosen);
  const played = app.act((world) => playRound(world, world.leagues[chosen.id], app.params()));
  if (!played) { stopAuto('Auto play stopped'); return; }
  run.matchdays++;
  const l = w.leagues[chosen.id];
  const label = l.type === 'cup' ? roundLabel(round, l) : `Matchday ${round}`;
  const extra = l.type === 'cup' ? 0 : followers(w, l).length;
  run.log.unshift({ league: l.id, text: `${l.name} · ${label}${extra ? ' (+ ' + followers(w, l).map((f) => f.name).join(', ') + ')' : ''}`, results: played.slice(0, 3).map((f) => [f.home, f.result.hg, f.result.ag, f.away]) });
  if (l.season.finished) {
    const h = l.history[l.history.length - 1];
    const c = h && w.clubs[h.championId];
    run.log.unshift({ league: l.id, text: `🏆 ${c ? c.name : 'Champions'} win the ${l.name} ${h ? h.label : ''}`, big: true });
  }
  run.log = run.log.slice(0, 6);
  renderBar();
  schedule(delay());
}

function renderBar() {
  if (!run.active) return;
  const w = run.app.world;
  let bar = document.getElementById('autoplay-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'autoplay-bar';
    bar.className = 'autoplay-bar';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ap-act]');
      if (!b) return;
      if (b.dataset.apAct === 'stop') stopAuto('Auto play stopped');
      if (b.dataset.apAct === 'speed') {
        const i = SPEEDS.findIndex((s) => s[0] === run.speed);
        run.speed = SPEEDS[(i + 1) % SPEEDS.length][0];
        renderBar();
      }
    });
    requestAnimationFrame(() => bar.classList.add('show'));
    document.body.classList.add('autoplaying');
  }
  if (!bar.querySelector('.ap-live')) {
    // build once; later updates only touch the text so the buttons stay tappable
    bar.innerHTML = `<div class="ap-live"><i class="ap-dot"></i><div class="ap-text"><b>Auto playing</b><small data-ap-last>Starting…</small><div class="ap-res" data-ap-res></div></div></div>
      <button class="btn sm" data-ap-act="speed"></button>
      <button class="btn sm danger" data-ap-act="stop">Stop</button>`;
  }
  const last = run.log[0];
  bar.querySelector('[data-ap-last]').textContent = last ? last.text : 'Starting…';
  bar.querySelector('[data-ap-res]').innerHTML = last && last.results ? last.results.map(([h, hg, ag, a]) => `<span>${clubBadge(w.clubs[h], 14)}<b>${hg}-${ag}</b>${clubBadge(w.clubs[a], 14)}</span>`).join('') : '';
  bar.querySelector('[data-ap-act="speed"]').textContent = (SPEEDS.find((s) => s[0] === run.speed) || SPEEDS[1])[1];
}
