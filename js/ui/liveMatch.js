// FIFA-style "Sim match": the result is simulated by the engine first, then played back
// live — running clock, score, ball/momentum on a pitch, event feed, live stats,
// with pause, speed and skip controls.
import { esc } from './dom.js';
import { clubBadge, ICONS } from './components.js';
import { playFixture } from '../league/season.js';
import { roundLabel } from '../league/cup.js';
import { textColorOn } from './badge.js';

const MIN_MS = 300; // real milliseconds per match minute at 1x (≈ 27 s for 90 minutes)

function pname(w, pid) { const p = pid && w.players[pid]; return p ? p.name : 'Unknown'; }
function surname(w, pid) { const p = pid && w.players[pid]; return p ? p.name.split(' ').slice(-1)[0] : '?'; }

export async function liveSimMatch(app, leagueId, fixtureId, { onDone } = {}) {
  const f = app.act((w) => playFixture(w, w.leagues[leagueId], fixtureId, app.params()));
  if (!f || !f.result) return null;
  const w = app.world;
  const l = w.leagues[leagueId];
  const r = f.result;
  const H = w.clubs[f.home], A = w.clubs[f.away];
  const end = r.et ? 120 : 90;
  const events = r.events.map((e) => ({ ...e, t: Math.min(end, e.minute + (e.added ? e.added / 10 : 0)) })).sort((a, b) => a.t - b.t);
  const stats = r.stats;
  const roundTxt = l.type === 'cup' ? roundLabel(f.round, l) : `Matchday ${f.round}`;
  const hc = H.kits.home.c1, ac = A.kits.home.c1;

  const el = document.createElement('div');
  el.className = 'live-wrap';
  el.innerHTML = `<div class="live">
    <div class="live-top"><small>${esc(l.name)} · ${esc(roundTxt)}</small><small>${esc(f.neutral ? (f.venue || 'Neutral venue') : H.stadium.name)}</small></div>
    <div class="live-board">
      <div class="lb-team">${clubBadge(H, 44)}<b>${esc(H.short)}</b></div>
      <div class="lb-mid"><div class="lb-score"><span data-hs>0</span><i>-</i><span data-as>0</span></div><div class="lb-clock" data-clock>0'</div><div class="lb-phase" data-phase>Kick-off</div></div>
      <div class="lb-team">${clubBadge(A, 44)}<b>${esc(A.short)}</b></div>
    </div>
    <div class="live-pitch">
      <div class="lp-lines"><i class="half"></i><i class="circle"></i><i class="box l"></i><i class="box r"></i></div>
      <div class="lp-ball" data-ball></div>
      <div class="lp-goal" data-goal hidden></div>
    </div>
    <div class="live-momentum"><i class="h" data-mh style="background:${hc}"></i><i class="a" data-ma style="background:${ac}"></i></div>
    <div class="live-stats">
      ${[['Possession', 'poss'], ['Shots', 'shots'], ['On target', 'sot'], ['Corners', 'corners'], ['Fouls', 'fouls']].map(([lab, k]) => `<div class="ls-row"><b data-s="${k}h">0</b><span>${lab}</span><b data-s="${k}a">0</b></div>`).join('')}
    </div>
    <ul class="live-feed" data-feed><li class="lf-ko">Kick-off</li></ul>
    <div class="live-controls">
      <button class="btn" data-live="pause" aria-label="Pause">${ICONS.play}</button>
      <button class="btn" data-live="speed">1x</button>
      <button class="btn" data-live="skip">Skip to result</button>
    </div>
    <div class="live-end" data-end hidden>
      <a class="btn primary" href="#/match/${l.id}/${f.id}" data-live="report">Match report</a>
      <button class="btn" data-live="close">Continue</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const $ = (s) => el.querySelector(s);
  const pauseBtn = $('[data-live="pause"]');
  pauseBtn.innerHTML = '❚❚';

  let minute = 0, speed = 1, paused = false, done = false, idx = 0, hs = 0, as = 0, lastTs = null, htShown = false, ftShown = false;
  const feed = $('[data-feed]');
  const push = (html, cls = '') => { const li = document.createElement('li'); li.className = cls; li.innerHTML = html; feed.prepend(li); };
  const setStat = (k, h, a) => { $(`[data-s="${k}h"]`).textContent = h; $(`[data-s="${k}a"]`).textContent = a; };
  const goalBanner = (e) => {
    const g = $('[data-goal]');
    const club = e.side === 'home' ? H : A;
    g.innerHTML = `<b>GOAL!</b><span>${clubBadge(club, 26)} ${esc(pname(w, e.pid))}${e.kind === 'pen' ? ' (pen)' : e.kind === 'own' ? ' (og)' : ''}</span>`;
    g.style.setProperty('--gc', club.kits.home.c1);
    g.style.color = textColorOn(club.kits.home.c1);
    g.hidden = false; g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop');
    clearTimeout(goalBanner.t); goalBanner.t = setTimeout(() => { g.hidden = true; }, 1600 / Math.min(speed, 2));
  };
  const renderAt = (m) => {
    const frac = Math.min(1, m / end);
    $('[data-clock]').textContent = `${Math.min(end, Math.floor(m))}'`;
    // stats build up over the match (goals counted exactly as they happen)
    const gH = events.filter((e) => e.type === 'goal' && e.side === 'home' && e.t <= m).length;
    const gA = events.filter((e) => e.type === 'goal' && e.side === 'away' && e.t <= m).length;
    const grow = (total, goals) => Math.max(goals, Math.round((total - (goals || 0)) * frac) + goals);
    const possH = Math.round(stats.possession[0] + (50 - stats.possession[0]) * (1 - frac) * 0.4);
    setStat('poss', possH + '%', (100 - possH) + '%');
    setStat('shots', grow(stats.shots[0], gH), grow(stats.shots[1], gA));
    setStat('sot', grow(stats.shotsOnTarget[0], gH), grow(stats.shotsOnTarget[1], gA));
    setStat('corners', Math.round(stats.corners[0] * frac), Math.round(stats.corners[1] * frac));
    setStat('fouls', Math.round(stats.fouls[0] * frac), Math.round(stats.fouls[1] * frac));
    // momentum: possession plus pressure from the next goal coming up
    const next = events.find((e) => e.type === 'goal' && e.t > m && e.t - m < 4);
    let mom = (possH - 50) / 50 + Math.sin(m / 3.1) * 0.25 + Math.sin(m / 1.7) * 0.15;
    if (next) mom = next.side === 'home' ? 0.9 : -0.9;
    mom = Math.max(-1, Math.min(1, mom));
    $('[data-mh]').style.width = `${50 + mom * 45}%`;
    $('[data-ma]').style.width = `${50 - mom * 45}%`;
    const ball = $('[data-ball]');
    ball.style.left = `${50 + mom * 38}%`;
    ball.style.top = `${50 + Math.sin(m * 1.3) * 28}%`;
  };
  const fire = (e) => {
    const club = e.side === 'home' ? H : A;
    const min = `${e.minute}'${e.added ? '+' + e.added : ''}`;
    if (e.type === 'goal') {
      if (e.side === 'home') hs++; else as++;
      $('[data-hs]').textContent = hs; $('[data-as]').textContent = as;
      el.querySelector('.lb-score').classList.remove('flash'); void el.offsetWidth; el.querySelector('.lb-score').classList.add('flash');
      goalBanner(e);
      push(`<span class="lf-min">${min}</span>${clubBadge(club, 18)}<b>⚽ ${esc(pname(w, e.pid))}</b>${e.assist ? `<small>assist ${esc(surname(w, e.assist))}</small>` : ''}<em>${hs}-${as}</em>`, 'lf-goal');
    } else if (e.type === 'yellow') push(`<span class="lf-min">${min}</span>${clubBadge(club, 18)}<i class="lf-card y"></i>${esc(pname(w, e.pid))}`);
    else if (e.type === 'red') push(`<span class="lf-min">${min}</span>${clubBadge(club, 18)}<i class="lf-card r"></i><b>${esc(pname(w, e.pid))}</b><small>sent off</small>`);
    else if (e.type === 'injury') push(`<span class="lf-min">${min}</span>${clubBadge(club, 18)}🩹 ${esc(pname(w, e.pid))} injured`);
    else if (e.type === 'sub') push(`<span class="lf-min">${min}</span>${clubBadge(club, 18)}<span class="lf-sub">▲ ${esc(surname(w, e.pid))} ▼ ${esc(surname(w, e.outPid))}</span>`);
  };
  const finish = async () => {
    if (ftShown) return;
    ftShown = true; done = true;
    renderAt(end);
    while (idx < events.length) fire(events[idx++]);
    $('[data-phase]').textContent = r.et ? 'After extra time' : 'Full time';
    push(`<b>${r.et ? 'After extra time' : 'Full time'} · ${r.hg}-${r.ag}</b>`, 'lf-ko');
    if (r.pens) {
      $('[data-phase]').textContent = 'Penalties';
      let ph = 0, pa = 0;
      for (const k of r.pens.kicks) {
        if (!el.isConnected) break;
        await new Promise((res) => setTimeout(res, skipAll ? 0 : 650 / speed));
        if (k.scored) { if (k.side === 'home') ph++; else pa++; }
        push(`${clubBadge(k.side === 'home' ? H : A, 18)}${k.scored ? '✅' : '❌'} ${esc(pname(w, k.pid))}<em>${ph}-${pa}</em>`, k.scored ? '' : 'lf-miss');
        $('[data-phase]').textContent = `Penalties ${ph}-${pa}`;
      }
      push(`<b>${esc((r.pens.home > r.pens.away ? H : A).name)} win ${Math.max(r.pens.home, r.pens.away)}-${Math.min(r.pens.home, r.pens.away)} on penalties</b>`, 'lf-ko');
    }
    $('.live-controls').hidden = true;
    $('[data-end]').hidden = false;
  };
  let skipAll = false;
  const tick = (ts) => {
    if (!el.isConnected || done) return;
    if (lastTs == null) lastTs = ts;
    const dt = ts - lastTs; lastTs = ts;
    if (!paused) {
      minute += (dt / MIN_MS) * speed;
      if (!htShown && minute >= 45) {
        htShown = true; minute = 45; paused = true;
        const htH = events.filter((e) => e.type === 'goal' && e.side === 'home' && e.t <= 45.9).length;
        const htA = events.filter((e) => e.type === 'goal' && e.side === 'away' && e.t <= 45.9).length;
        while (idx < events.length && events[idx].t <= 45.9) fire(events[idx++]);
        $('[data-phase]').textContent = 'Half time';
        push(`<b>Half time · ${htH}-${htA}</b>`, 'lf-ko');
        setTimeout(() => { if (!done) { paused = false; $('[data-phase]').textContent = 'Second half'; } }, 1200 / speed);
      }
      if (r.et && minute >= 90 && minute < 90.5 && !tick.etShown) {
        tick.etShown = true;
        push('<b>90 minutes · extra time</b>', 'lf-ko');
        $('[data-phase]').textContent = 'Extra time';
      }
      while (idx < events.length && events[idx].t <= minute) fire(events[idx++]);
      renderAt(minute);
      if (minute >= end) { finish(); return; }
      if (minute < 45 && $('[data-phase]').textContent === 'Kick-off' && minute > 1) $('[data-phase]').textContent = 'First half';
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const close = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
    if (onDone) onDone(f);
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-live]');
    if (!b) return;
    const k = b.dataset.live;
    if (k === 'pause') { paused = !paused; b.innerHTML = paused ? ICONS.play : '❚❚'; }
    if (k === 'speed') { speed = speed === 1 ? 2 : speed === 2 ? 4 : speed === 4 ? 8 : 1; b.textContent = speed + 'x'; }
    if (k === 'skip') { skipAll = true; minute = end; finish(); }
    if (k === 'close') close();
    if (k === 'report') close();
  });
  return f;
}
