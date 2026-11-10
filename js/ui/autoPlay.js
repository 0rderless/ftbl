// Auto play / Auto sim.
//  - Auto play: keeps playing matchdays one at a time across the competitions you pick, until you stop it.
//  - Auto sim: simulates whole seasons of the competitions you pick (1, 2, 5 or 10), with a progress bar.
// Both keep the phone responsive: the screen is only refreshed about once a second, saving to the
// phone/cloud is batched, and there is always a gap between matchdays so taps (Stop) get through.
import { esc, sheet } from './dom.js';
import { ICONS, leagueLogo, clubBadge } from './components.js';
import { playRound, playSeason, currentRound, startNextSeason, pyramidPending, followers } from '../league/season.js';
import { roundLabel, isCup, startNextCupSeason, searchClubs, compareCompetitions } from '../league/cup.js';

export const SPEEDS = [['slow', 'Slow', 2500], ['normal', 'Normal', 1200], ['fast', 'Fast', 450], ['max', 'Turbo', 120]];
const SIM_SEASONS = [[1, '1'], [2, '2'], [5, '5'], [10, '10']];

const run = { active: false, mode: 'play', timer: null, app: null, sel: [], speed: 'normal', seasons: false, idx: 0, matchdays: 0, log: [], lastRender: 0, lastSave: 0 };

export function isAutoRunning() { return run.active; }

/** Match settings for auto runs: the normal settings plus the Always win / Blacklist rules. */
function params(app) {
  const p = app.params();
  return run.rig ? { ...p, rig: run.rig } : p;
}
function rigFrom(win, lose) {
  return (win && win.length) || (lose && lose.length) ? { win: (win || []).slice(), lose: (lose || []).slice() } : null;
}
function rigSummary(w) {
  if (!run.rig) return '';
  const names = (ids) => ids.map((id) => w.clubs[id]).filter(Boolean).map((c) => c.short).join(', ');
  return [run.rig.win.length ? `🎯 ${names(run.rig.win)}` : '', run.rig.lose.length ? `⛔ ${names(run.rig.lose)}` : ''].filter(Boolean).join('  ');
}
export function autoMode() { return run.active ? run.mode : null; }

function prefs(app) {
  return (app.world.settings.ui && app.world.settings.ui.autoPlay) || {};
}

function choices(w) {
  return Object.values(w.leagues).sort(compareCompetitions);
}

export async function openAutoPlay(app, startMode) {
  if (run.active) { stopAuto('Stopped'); return; }
  const w = app.world;
  const p = prefs(app);
  const comps = choices(w);
  const leaderOf = (l) => l.config && l.config.followLeagueId && w.leagues[l.config.followLeagueId];
  const saved = new Set(p.sel || comps.filter((l) => !leaderOf(l)).map((l) => l.id));
  const speed = p.speed || 'normal';
  const mode = startMode || p.mode || 'play';
  const simN = p.simSeasons || 1;
  const rig = { win: (p.win || []).filter((id) => w.clubs[id]), lose: (p.lose || []).filter((id) => w.clubs[id] && !(p.win || []).includes(id)) };
  const allClubs = Object.values(w.clubs).sort((a, b) => b.ratings.overall - a.ratings.overall);
  const rigBox = (kind, title, help) => `<div class="rig-box rig-${kind}" data-rig="${kind}">
      <div class="rig-head"><b>${title}</b><small>${help}</small></div>
      <div class="rig-chips" data-rig-chips></div>
      <input type="search" class="rig-input" data-rig-input placeholder="Type a team to add…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${title}: add team">
      <div class="rig-found" data-rig-found></div>
    </div>`;
  const out = await sheet(`<h3 class="sheet-title">${ICONS.ff} Auto</h3>
    <div class="ap-scroll">
    <div class="seg ap-mode"><button type="button" class="seg-btn ${mode === 'play' ? 'on' : ''}" data-mode="play">Auto play</button><button type="button" class="seg-btn ${mode === 'sim' ? 'on' : ''}" data-mode="sim">Auto sim</button></div>
    <p class="sheet-text" data-mode-help></p>
    <div class="ap-list">${comps.map((l) => {
      const leader = leaderOf(l);
      return `<label class="ap-item ${leader ? 'follow' : ''}"><input type="checkbox" data-ap="${l.id}" ${saved.has(l.id) && !leader ? 'checked' : ''} ${leader ? 'disabled' : ''}>
        ${leagueLogo(l, 30)}<span><b>${esc(l.name)}</b><small>${leader ? `plays automatically with ${esc(leader.name)}` : l.season ? `${esc(l.season.label)} · ${l.season.finished ? 'season complete' : esc(l.type === 'cup' ? roundLabel(currentRound(l), l) : `matchday ${currentRound(l)}`)}` : ''}</small></span></label>`;
    }).join('')}</div>
    <div data-play-opts>
      <div class="field"><span>Speed</span><div class="seg ap-speed">${SPEEDS.map(([k, label]) => `<button type="button" class="seg-btn ${k === speed ? 'on' : ''}" data-speed="${k}">${label}</button>`).join('')}</div></div>
      <label class="toggle-inline"><input type="checkbox" data-ap-seasons ${p.seasons ? 'checked' : ''}> Keep going into new seasons</label>
    </div>
    <div data-sim-opts>
      <div class="field"><span>How many seasons (1 = just finish this one)</span><div class="seg">${SIM_SEASONS.map(([n, label]) => `<button type="button" class="seg-btn ${n === simN ? 'on' : ''}" data-simn="${n}">${label}</button>`).join('')}</div></div>
    </div>
    <details class="rig" ${rig.win.length || rig.lose.length ? 'open' : ''}><summary>Team rules${rig.win.length || rig.lose.length ? ` <span class="tag gold">${rig.win.length + rig.lose.length} on</span>` : ''}</summary>
      ${rigBox('win', '🎯 Always win', 'wins every match')}
      ${rigBox('lose', '⛔ Blacklist', 'loses on purpose, but never gets relegated')}
      <p class="sheet-text rig-note">Only used during Auto play and Auto sim. If two Always win teams meet, it's a normal match.</p>
    </details>
    </div>
    <div class="sheet-actions"><button class="btn ghost" data-sheet="cancel">Cancel</button><button class="btn primary" data-sheet="start">${ICONS.play} Start</button></div>`, {
    onMount(el) {
      const setMode = (m) => {
        el.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x.dataset.mode === m));
        el.querySelector('[data-play-opts]').hidden = m !== 'play';
        el.querySelector('[data-sim-opts]').hidden = m !== 'sim';
        el.querySelector('[data-mode-help]').textContent = m === 'play'
          ? 'Plays matchdays one after another in the competitions you pick. Keep using the app and stop any time.'
          : 'Simulates the rest of the season straight away for every competition you pick — or several seasons in a row.';
      };
      setMode(mode);
      el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
      const pick = (attr) => el.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
        el.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle('on', x === b));
      }));
      pick('data-speed'); pick('data-simn');
      // Always win / Blacklist pickers
      const drawRig = () => el.querySelectorAll('[data-rig]').forEach((box) => {
        const ids = rig[box.dataset.rig];
        box.querySelector('[data-rig-chips]').innerHTML = ids.length
          ? ids.map((id) => w.clubs[id]).filter(Boolean).map((c) => `<button type="button" class="chip on rig-chip" data-rig-del="${c.id}">${clubBadge(c, 16)} ${esc(c.short)} ✕</button>`).join('')
          : '<small class="muted">No teams</small>';
      });
      el.querySelectorAll('[data-rig]').forEach((box) => {
        const kind = box.dataset.rig;
        const other = kind === 'win' ? 'lose' : 'win';
        const input = box.querySelector('[data-rig-input]');
        const found = box.querySelector('[data-rig-found]');
        const drawFound = () => {
          if (!input.value.trim()) { found.innerHTML = ''; return; }
          const hits = searchClubs(allClubs, input.value, 5);
          found.innerHTML = hits.map((c) => `<button type="button" class="pick-row" data-rig-add="${c.id}">${clubBadge(c, 24)}<span class="pr-name"><b>${esc(c.name)}</b><small>${rig[kind].includes(c.id) ? 'already added' : rig[other].includes(c.id) ? `move from ${other === 'win' ? 'Always win' : 'Blacklist'}` : `${c.ratings.overall} overall`}</small></span>${ICONS.plus}</button>`).join('') || '<p class="muted pad-s">No team matches those letters.</p>';
        };
        input.addEventListener('input', drawFound);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const first = found.querySelector('[data-rig-add]'); if (first) first.click(); }
        });
        found.addEventListener('click', (e) => {
          const b = e.target.closest('[data-rig-add]');
          if (!b) return;
          const id = b.dataset.rigAdd;
          rig[other] = rig[other].filter((x) => x !== id);
          if (!rig[kind].includes(id)) rig[kind].push(id);
          input.value = ''; found.innerHTML = '';
          drawRig();
        });
        box.querySelector('[data-rig-chips]').addEventListener('click', (e) => {
          const b = e.target.closest('[data-rig-del]');
          if (!b) return;
          rig[kind] = rig[kind].filter((x) => x !== b.dataset.rigDel);
          drawRig();
        });
      });
      drawRig();
      el.querySelector('[data-sheet="start"]').addEventListener('click', () => {
        run.pending = {
          mode: el.querySelector('[data-mode].on').dataset.mode,
          sel: [...el.querySelectorAll('[data-ap]:checked')].map((x) => x.dataset.ap),
          speed: el.querySelector('[data-speed].on').dataset.speed,
          seasons: el.querySelector('[data-ap-seasons]').checked,
          simSeasons: Number(el.querySelector('[data-simn].on').dataset.simn),
          win: rig.win.slice(),
          lose: rig.lose.slice(),
        };
      }, true);
    },
  });
  if (out !== 'start' || !run.pending) return;
  const choice = run.pending;
  run.pending = null;
  if (!choice.sel.length) { app.toast('Pick at least one competition', 'error'); return; }
  app.act((world) => { world.settings.ui.autoPlay = { ...choice }; });
  const rules = rigFrom(choice.win, choice.lose);
  if (choice.mode === 'sim') startAutoSim(app, choice.sel, choice.simSeasons, rules);
  else startAuto(app, choice.sel, choice.speed, choice.seasons, rules);
}

// ---------- shared: keep the app responsive while running ----------
function beginBatch(app) {
  run.saveDebounce = app.store.debounceMs;
  app.store.debounceMs = 15000; // save in batches, not after every matchday
  if (app.sync) { run.pushDebounce = app.sync.debounceMs; app.sync.debounceMs = 60000; }
  run.lastRender = performance.now();
  run.lastSave = performance.now();
}
function endBatch(app) {
  if (run.saveDebounce != null) app.store.debounceMs = run.saveDebounce;
  if (app.sync && run.pushDebounce != null) app.sync.debounceMs = run.pushDebounce;
  app.store.flush().then(() => { if (app.sync && app.sync.ready) app.sync.push().catch(() => {}); });
}
/** Run a world change without redrawing the screen; redraw at most every `every` ms. */
function quietly(app, fn, every = 1000) {
  app.holdRender = (app.holdRender || 0) + 1;
  let out;
  try { out = app.act(fn); } finally { app.holdRender--; }
  const now = performance.now();
  if (now - run.lastRender > every) { run.lastRender = now; app.render({ silent: true }); }
  if (run.mode === 'play' && now - run.lastSave > 20000) { run.lastSave = now; app.store.flush(); }
  return out;
}

/** Start the next season of a finished competition without any prompts. */
function autoNextSeason(app, l) {
  if (isCup(l)) { quietly(app, (world) => startNextCupSeason(world, world.leagues[l.id])); return; }
  quietly(app, (world) => {
    for (const p of pyramidPending(world, world.leagues[l.id])) playSeason(world, world.leagues[p.id], params(app));
    startNextSeason(world, world.leagues[l.id]);
  });
}

/** When every selected competition is finished: roll them all into the next season. Returns how many started. */
function rollOver(app, comps) {
  const w = app.world;
  let started = 0;
  for (const l of comps.slice().sort((a, b) => isCup(a) - isCup(b))) {
    const cur = w.leagues[l.id];
    if (!cur || !cur.season || !cur.season.finished) continue; // already rolled over with a linked league
    try { autoNextSeason(app, cur); started++; } catch (e) { console.warn(e); }
  }
  return started;
}

// ---------- Auto play ----------
export function startAuto(app, sel, speed = 'normal', seasons = false, rig = null) {
  Object.assign(run, { active: true, mode: 'play', app, sel: sel.slice(), speed, seasons, rig, idx: 0, matchdays: 0, log: [] });
  beginBatch(app);
  renderBar();
  schedule(200);
}

export function stopAuto(message) {
  if (!run.active) return;
  run.active = false;
  clearTimeout(run.timer);
  const bar = document.getElementById('autoplay-bar');
  if (bar) { bar.classList.remove('show'); setTimeout(() => bar.remove(), 300); }
  const ov = document.getElementById('autosim-overlay');
  if (ov) { ov.classList.remove('show'); setTimeout(() => ov.remove(), 300); }
  document.body.classList.remove('autoplaying');
  if (run.app) {
    endBatch(run.app);
    if (message) run.app.toast(message, 'ok');
    run.app.render({ silent: true });
  }
}

function schedule(ms) {
  clearTimeout(run.timer);
  run.timer = setTimeout(tick, ms);
}

function delay() { return (SPEEDS.find((s) => s[0] === run.speed) || SPEEDS[1])[2]; }

function tick() {
  if (!run.active || run.mode !== 'play') return;
  const t0 = performance.now();
  const app = run.app;
  const w = app.world;
  const comps = run.sel.map((id) => w.leagues[id]).filter(Boolean);
  if (!comps.length) { stopAuto('Auto play stopped'); return; }
  let chosen = null;
  for (let i = 0; i < comps.length; i++) {
    const l = comps[(run.idx + i) % comps.length];
    if (l.season && !l.season.finished && currentRound(l)) { chosen = l; run.idx = (run.idx + i + 1) % comps.length; break; }
  }
  if (!chosen) {
    if (!run.seasons) { stopAuto('Auto play finished: the selected competitions are complete'); return; }
    if (!rollOver(app, comps)) { stopAuto('Auto play stopped: nothing left to play'); return; }
    run.log.unshift({ text: 'New seasons started' });
    renderBar();
    schedule(Math.max(delay(), (performance.now() - t0) * 2));
    return;
  }
  const round = currentRound(chosen);
  const played = quietly(app, (world) => playRound(world, world.leagues[chosen.id], params(app)));
  if (!played) { stopAuto('Auto play stopped'); return; }
  run.matchdays++;
  const l = w.leagues[chosen.id];
  const label = l.type === 'cup' ? roundLabel(round, l) : `Matchday ${round}`;
  const fl = followers(w, l).filter((f) => f.season.label === l.season.label);
  run.log.unshift({ text: `${l.name} · ${label}${fl.length ? ` (+ ${fl.map((f) => f.name).join(', ')})` : ''}`, results: played.slice(0, 3).map((f) => [f.home, f.result.hg, f.result.ag, f.away]) });
  if (l.season.finished) {
    for (const x of [...fl.filter((f) => f.season.finished && f.history.length), l]) {
      const h = x.history[x.history.length - 1];
      const c = h && w.clubs[h.championId];
      run.log.unshift({ text: `🏆 ${c ? c.name : 'Champions'} win the ${x.name} ${h ? h.label : ''}` });
    }
  }
  run.log = run.log.slice(0, 6);
  renderBar();
  // always leave the phone at least as much free time as the matchday took, so taps get through
  schedule(Math.max(delay(), (performance.now() - t0) * 2, 80));
}

function renderBar() {
  if (!run.active || run.mode !== 'play') return;
  const w = run.app.world;
  let bar = document.getElementById('autoplay-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'autoplay-bar';
    bar.className = 'autoplay-bar';
    document.body.appendChild(bar);
    const onTap = (e) => {
      const b = e.target.closest('[data-ap-act]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.apAct === 'stop') stopAuto('Auto play stopped');
      if (b.dataset.apAct === 'speed') {
        const i = SPEEDS.findIndex((s) => s[0] === run.speed);
        run.speed = SPEEDS[(i + 1) % SPEEDS.length][0];
        renderBar();
      }
    };
    // pointerdown reacts instantly, even while a matchday is being simulated
    bar.addEventListener('pointerdown', onTap);
    bar.innerHTML = `<div class="ap-live"><i class="ap-dot"></i><div class="ap-text"><b>Auto playing<span class="ap-rig" data-ap-rig></span></b><small data-ap-last>Starting…</small><div class="ap-res" data-ap-res></div></div></div>
      <button class="btn sm" data-ap-act="speed"></button>
      <button class="btn sm danger" data-ap-act="stop">Stop</button>`;
    requestAnimationFrame(() => bar.classList.add('show'));
    document.body.classList.add('autoplaying');
  }
  bar.querySelector('[data-ap-rig]').textContent = run.rig ? ` · ${rigSummary(w)}` : '';
  const last = run.log[0];
  bar.querySelector('[data-ap-last]').textContent = last ? last.text : 'Starting…';
  bar.querySelector('[data-ap-res]').innerHTML = last && last.results ? last.results.map(([h, hg, ag, a]) => `<span>${clubBadge(w.clubs[h], 14)}<b>${hg}-${ag}</b>${clubBadge(w.clubs[a], 14)}</span>`).join('') : '';
  bar.querySelector('[data-ap-act="speed"]').textContent = (SPEEDS.find((s) => s[0] === run.speed) || SPEEDS[1])[1];
}

// ---------- Auto sim ----------
const frame = () => new Promise((r) => setTimeout(r, 0));

export async function startAutoSim(app, sel, seasons = 1, rig = null) {
  Object.assign(run, { active: true, mode: 'sim', app, sel: sel.slice(), rig, matchdays: 0, log: [] });
  beginBatch(app);
  const ov = document.createElement('div');
  ov.id = 'autosim-overlay';
  ov.className = 'md-overlay autosim';
  ov.innerHTML = `<div class="md-panel as-panel">
    <div class="md-head">${ICONS.ff}<div><small>Auto sim</small><h2 data-as-title>Simulating…</h2></div></div>
    <p class="as-now" data-as-now>Starting</p>
    ${run.rig ? `<p class="as-rig" data-as-rig>${esc(rigSummary(app.world))}</p>` : ''}
    <div class="lab-progress"><i data-as-bar></i></div>
    <ul class="as-log" data-as-log></ul>
    <button class="btn danger block" data-as-stop>Stop</button>
    <button class="btn primary block" data-as-done hidden>Done</button>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  ov.querySelector('[data-as-stop]').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    run.active = false;
    const b = e.currentTarget; b.textContent = 'Stopping…'; b.disabled = true;
  });
  ov.querySelector('[data-as-done]').addEventListener('click', () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 300); });
  const $ = (s) => ov.querySelector(s);
  const champions = [];
  const w = () => app.world;
  const comps = () => run.sel.map((id) => w().leagues[id]).filter(Boolean);
  let totalRounds = 0, doneRounds = 0;
  const remaining = () => comps().reduce((t, l) => t + (l.season && !l.season.finished ? Math.max(0, (l.season.fixtures.length ? Math.max(...l.season.fixtures.map((f) => f.round)) : 0) - currentRound(l) + 1) : 0), 0);
  let season = 0;
  try {
    for (season = 1; season <= seasons && run.active; season++) {
      if (season > 1 || comps().every((l) => l.season && l.season.finished)) {
        // move on to the next season if this one is already done
        if (comps().every((l) => l.season && l.season.finished)) {
          if (!rollOver(app, comps())) break;
        }
      }
      totalRounds = remaining() || 1; doneRounds = 0;
      $('[data-as-title]').textContent = seasons > 1 ? `Season ${season} of ${seasons}` : 'This season';
      // leagues first (cups may need their final tables), one matchday at a time with a breather
      for (const l of comps().sort((a, b) => isCup(a) - isCup(b))) {
        while (run.active) {
          const cur = w().leagues[l.id];
          if (!cur.season || cur.season.finished || !currentRound(cur)) break;
          const r = currentRound(cur);
          $('[data-as-now]').textContent = `${cur.name} ${cur.season.label} · ${cur.type === 'cup' ? roundLabel(r, cur) : `matchday ${r}`}`;
          // the panel covers the screen, so don't redraw underneath until the end
          quietly(app, (world) => playRound(world, world.leagues[l.id], params(app)), Infinity);
          doneRounds++;
          $('[data-as-bar]').style.width = `${Math.min(100, (doneRounds / totalRounds) * 100)}%`;
          const now = w().leagues[l.id];
          if (now.season.finished) {
            // the competition and any that play along with it (Division 2, Europa League, Conference League)
            const done = [now, ...followers(w(), now).filter((f) => f.season.finished && f.season.label === now.season.label && f.history.length)];
            for (const x of done) {
              const h = x.history.slice(-1)[0];
              const c = h && w().clubs[h.championId];
              const line = `🏆 ${x.name} ${h ? h.label : ''}: ${c ? c.name : '—'}`;
              champions.push(line);
              const li = document.createElement('li'); li.textContent = line; $('[data-as-log]').prepend(li);
            }
          }
          await frame();
        }
      }
    }
  } finally {
    const stopped = !run.active;
    run.active = false;
    $('[data-as-title]').textContent = stopped ? 'Stopped' : 'Finished';
    $('[data-as-now]').textContent = champions.length ? `${champions.length} competition${champions.length === 1 ? '' : 's'} completed` : 'Nothing was left to play';
    $('[data-as-bar]').style.width = '100%';
    $('[data-as-stop]').hidden = true;
    $('[data-as-done]').hidden = false;
    // save and refresh the screen after the result is showing
    setTimeout(() => { endBatch(app); app.render({ silent: true }); }, 50);
  }
}
