// The match engine.
//
// 1. Each side's strength profile (attack, midfield, defence, goalkeeper) comes from
//    club ratings, the available squad, fatigue and tactics (see strength.js).
// 2. Expected goals (λ) for each side are a log-linear function of the rating gaps,
//    home advantage, form and tactical match-ups.
// 3. Match-day randomness: performance shocks (upsets), gamma-distributed overdispersion
//    (score unpredictability) and red cards that change the game state.
// 4. The scoreline is sampled from a draw-inflated Poisson score matrix.
// 5. Events (goals, assists, cards, injuries, substitutions) and statistics are then
//    generated consistently with the scoreline and who was on the pitch at each minute.
import { RNG } from '../core/rng.js';
import { sampleScore, outcomeProbs } from './poisson.js';
import { teamStrength, playerCondition } from './strength.js';
import { STYLES, styleMatchup, formationMatchup, positionFit } from './tactics.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// rating-gap coefficients (per 10 rating points)
export const COEF = { attack: 0.42, defence: 0.30, keeper: 0.13 };
const TEMPO = { bus: 0.88, press: 1.05, direct: 1.03, possession: 0.98, counter: 0.99, balanced: 1 };

function attackIndex(s) { return 0.6 * s.att + 0.4 * s.mid; }
function defenceIndex(s) { return 0.7 * s.def + 0.3 * s.mid; }

// Deterministic expected goals before match-day randomness.
export function expectedGoals(H, A, params, ctx = {}) {
  const aH = attackIndex(H), aA = attackIndex(A), dH = defenceIndex(H), dA = defenceIndex(A);
  const ref = (aH + aA + dH + dA) / 4;
  const refGK = (H.gk + A.gk) / 2;
  const k = params.ratingWeight * params.gapCompression;
  const gapH = (COEF.attack * (aH - ref) - COEF.defence * params.defensiveWeight * (dA - ref)
    - COEF.keeper * params.goalkeeperWeight * (A.gk - refGK)) / 10;
  const gapA = (COEF.attack * (aA - ref) - COEF.defence * params.defensiveWeight * (dH - ref)
    - COEF.keeper * params.goalkeeperWeight * (H.gk - refGK)) / 10;
  const T = params.tacticalWeight;
  const tacH = T * (styleMatchup(H.style, A.style) + formationMatchup(H.formation, A.formation));
  const tacA = T * (styleMatchup(A.style, H.style) + formationMatchup(A.formation, H.formation));
  const tempo = (TEMPO[H.style] || 1) * (TEMPO[A.style] || 1);
  const ha = ctx.neutral ? 0 : params.homeAdvantage / 2;
  const base = Math.log(params.baseGoals * params.intensityGoals * tempo);
  const lh = Math.exp(base + ha + k * gapH + tacH + params.formWeight * (ctx.homeForm || 0));
  const la = Math.exp(base - ha + k * gapA + tacA + params.formWeight * (ctx.awayForm || 0));
  return { home: clamp(lh, 0.05, 8), away: clamp(la, 0.05, 8) };
}

// Pre-match outcome probabilities (analytic, without match-day randomness).
export function matchPreview(H, A, params, ctx) {
  const xg = expectedGoals(H, A, params, ctx);
  return { xg, probs: outcomeProbs(xg.home, xg.away, params.drawInflation) };
}

// Form score in [-1, 1] from recent results array e.g. ['W','D','L'] (most recent last).
export function formScore(results) {
  if (!results || !results.length) return 0;
  const recent = results.slice(-5);
  let pts = 0, w = 0;
  recent.forEach((r, i) => {
    const weight = 0.6 + 0.4 * (i + 1) / recent.length; // more recent counts more
    pts += weight * (r === 'W' ? 3 : r === 'D' ? 1 : 0);
    w += weight;
  });
  const ppg = pts / w;
  return clamp((ppg - 1.4) / 1.6, -1, 1);
}

const SCORE_W = { ST: 1, LW: 0.62, RW: 0.62, AM: 0.5, LM: 0.3, RM: 0.3, CM: 0.24, DM: 0.12, CB: 0.11, LB: 0.07, RB: 0.07, GK: 0.002 };
const ASSIST_W = { AM: 1, LW: 0.9, RW: 0.9, LM: 0.8, RM: 0.8, CM: 0.7, ST: 0.5, LB: 0.5, RB: 0.5, DM: 0.35, CB: 0.14, GK: 0.03 };
const CARD_W = { CB: 1.3, DM: 1.4, CM: 1.1, LB: 1.1, RB: 1.1, LM: 0.8, RM: 0.8, AM: 0.7, LW: 0.6, RW: 0.6, ST: 0.8, GK: 0.15 };

function attr(p, key, fallback) {
  return (p && p.attributes && Number.isFinite(p.attributes[key])) ? p.attributes[key] : (p ? p.overall : fallback);
}

// Build a per-team timeline: who is on the pitch, when.
function buildTeamTimeline(rng, side, strength, playersById, state, params, redMinute) {
  const lineup = strength.lineup;
  const entries = []; // {pid, slot, from, to, start}
  if (!lineup) return { entries, events: [], minutes: {} };
  lineup.xi.forEach((s) => entries.push({ pid: s.pid, slot: s.slot, from: 0, to: 90, start: true }));
  const bench = lineup.bench.slice();
  const events = [];
  let subsLeft = 5;
  const intensity = params.intensity;
  const styleFatigue = (STYLES[strength.style] || STYLES.balanced).fatigue;

  const onPitchAt = (m) => entries.filter((e) => e.from <= m && e.to > m && e.pid);
  const bestSub = (slot) => {
    let best = null, bv = -1;
    for (const pid of bench) {
      const p = playersById[pid]; if (!p) continue;
      const v = p.overall * positionFit(p.position, slot);
      if (v > bv) { bv = v; best = pid; }
    }
    return best;
  };
  const substitute = (entry, minute, reason) => {
    entry.to = minute;
    if (subsLeft <= 0) return false;
    const sub = bestSub(entry.slot);
    if (!sub) return false;
    bench.splice(bench.indexOf(sub), 1);
    subsLeft--;
    entries.push({ pid: sub, slot: entry.slot, from: minute, to: 90, start: false });
    events.push({ type: 'sub', side, minute, pid: sub, outPid: entry.pid, reason });
    return true;
  };

  // red card (decided before the score so the game state is consistent)
  if (redMinute != null) {
    const pool = onPitchAt(redMinute).filter((e) => e.slot !== 'GK' || rng.chance(0.05));
    if (pool.length) {
      const e = rng.weighted(pool, (x) => CARD_W[x.slot] || 1);
      const second = rng.chance(0.45);
      if (second) events.push({ type: 'yellow', side, minute: Math.max(1, redMinute - rng.int(5, 40)), pid: e.pid });
      events.push({ type: 'red', side, minute: redMinute, pid: e.pid, second });
      e.to = redMinute; e.sentOff = true;
    }
  }

  // injuries
  for (const e of entries.slice()) {
    if (!e.pid || e.sentOff) continue;
    const fit = playerCondition(state, e.pid).fit;
    const p = params.injuryRate * (1 + 1.2 * (1 - fit / 100)) * (0.8 + 0.4 * intensity);
    if (rng.chance(p)) {
      const minute = rng.int(1, 89);
      if (minute >= e.to) continue;
      const r = rng.next();
      const rounds = r < 0.4 ? 1 : r < 0.7 ? rng.int(2, 3) : r < 0.88 ? rng.int(4, 6) : r < 0.97 ? rng.int(7, 12) : rng.int(13, 30);
      events.push({ type: 'injury', side, minute, pid: e.pid, rounds });
      substitute(e, minute, 'injury');
    }
  }

  // tactical / fatigue substitutions
  const planned = clamp(Math.round(rng.normal(3.2 + intensity * 0.8, 0.9)), 1, 5);
  const windows = [rng.int(55, 66), rng.int(67, 77), rng.int(78, 87)];
  let made = 0;
  for (let i = 0; i < planned && subsLeft > 0; i++) {
    const minute = windows[Math.min(windows.length - 1, Math.floor(i * windows.length / planned))];
    const candidates = onPitchAt(minute).filter((e) => e.slot !== 'GK' && e.from === 0);
    if (!candidates.length) break;
    // tiredest / weakest relative to fitness first
    const drain = (20 + 12 * intensity) * styleFatigue;
    const pick = candidates.sort((a, b) => {
      const fa = playerCondition(state, a.pid).fit - drain * minute / 90;
      const fb = playerCondition(state, b.pid).fit - drain * minute / 90;
      return fa - fb + rng.float(-6, 6);
    })[0];
    if (substitute(pick, minute, 'tactical')) made++;
  }

  const minutes = {};
  for (const e of entries) if (e.pid) minutes[e.pid] = (minutes[e.pid] || 0) + Math.max(0, e.to - e.from);
  return { entries, events, minutes, made };
}

function goalMinute(rng) {
  // goals are a little more frequent later in matches
  for (;;) {
    const m = rng.int(1, 90);
    if (rng.next() < (0.75 + m / 360)) {
      if (m === 45 && rng.chance(0.4)) return { minute: 45, added: rng.int(1, 4) };
      if (m === 90 && rng.chance(0.6)) return { minute: 90, added: rng.int(1, 6) };
      return { minute: m, added: 0 };
    }
  }
}

/**
 * Simulate a match.
 * @param {object} o
 *   home/away: { club, players: Player[] }
 *   params: resolved engine params (resolveParams)
 *   homeState/awayState: playerState maps { [pid]: { fit, inj, sus } }
 *   homeForm/awayForm: recent results arrays
 *   seed: reproducible seed string
 */
export function simulateMatch(o) {
  const { params } = o;
  const rng = new RNG(o.seed);
  const homePlayers = o.home.players || [], awayPlayers = o.away.players || [];
  const playersById = {};
  for (const p of homePlayers) playersById[p.id] = p;
  for (const p of awayPlayers) playersById[p.id] = p;

  const H = teamStrength(o.home.club, homePlayers, o.homeState || {}, params);
  const A = teamStrength(o.away.club, awayPlayers, o.awayState || {}, params);
  const ctx = { homeForm: formScore(o.homeForm), awayForm: formScore(o.awayForm), neutral: !!o.neutral };
  const xg = expectedGoals(H, A, params, ctx);

  // match-day performance shocks (upset potential)
  const eH = rng.normal(0, params.performanceSD), eA = rng.normal(0, params.performanceSD);
  let lh = xg.home * Math.exp(eH - 0.4 * eA);
  let la = xg.away * Math.exp(eA - 0.4 * eH);

  // overdispersion: gamma multiplier with mean 1 and variance = dispersion
  const k = 1 / params.dispersion;
  lh *= rng.gamma(k, 1 / k);
  la *= rng.gamma(k, 1 / k);

  // red cards — they alter the remaining balance of the match
  const redRate = 0.05 * (0.8 + 0.4 * params.intensity);
  const redH = rng.chance(redRate * (STYLES[H.style] || STYLES.balanced).fouls) ? rng.int(12, 88) : null;
  const redA = rng.chance(redRate * (STYLES[A.style] || STYLES.balanced).fouls) ? rng.int(12, 88) : null;
  if (redH != null) { const f = (90 - redH) / 90; lh *= 1 - 0.35 * f; la *= 1 + 0.25 * f; }
  if (redA != null) { const f = (90 - redA) / 90; la *= 1 - 0.35 * f; lh *= 1 + 0.25 * f; }
  lh = clamp(lh, 0.02, 9); la = clamp(la, 0.02, 9);

  const [hg, ag] = sampleScore(rng, lh, la, params.drawInflation);

  const tlH = buildTeamTimeline(rng, 'home', H, playersById, o.homeState || {}, params, redH);
  const tlA = buildTeamTimeline(rng, 'away', A, playersById, o.awayState || {}, params, redA);
  const events = [...tlH.events, ...tlA.events];

  const onPitch = (tl, m) => tl.entries.filter((e) => e.pid && e.from <= m && e.to > m);
  const makeGoals = (n, side, tl, oppTl) => {
    for (let i = 0; i < n; i++) {
      const { minute, added } = goalMinute(rng);
      const m = Math.min(minute, 89);
      const own = rng.chance(0.03);
      const pen = !own && rng.chance(0.09);
      let scorer = null, assist = null;
      if (own) {
        const opp = onPitch(oppTl, m).filter((e) => e.slot !== 'GK');
        if (opp.length) scorer = rng.weighted(opp, (e) => (['CB', 'LB', 'RB', 'DM'].includes(e.slot) ? 3 : 1)).pid;
      } else {
        const pool = onPitch(tl, m);
        if (pool.length) {
          if (pen) {
            scorer = pool.slice().sort((a, b) => attr(playersById[b.pid], 'shooting', 60) - attr(playersById[a.pid], 'shooting', 60))[0].pid;
          } else {
            scorer = rng.weighted(pool, (e) => (SCORE_W[e.slot] || 0.1) * Math.pow(attr(playersById[e.pid], 'shooting', 60) / 65, 2.2)).pid;
          }
          if (!pen && rng.chance(0.74)) {
            const ap = pool.filter((e) => e.pid !== scorer);
            if (ap.length) assist = rng.weighted(ap, (e) => (ASSIST_W[e.slot] || 0.3) * Math.pow(attr(playersById[e.pid], 'passing', 60) / 65, 2)).pid;
          }
        }
      }
      const kind = own ? 'own' : pen ? 'pen' : (rng.chance(0.18) ? 'header' : rng.chance(0.15) ? 'long' : 'open');
      events.push({ type: 'goal', side, minute, added, pid: scorer, assist, kind });
    }
  };
  makeGoals(hg, 'home', tlH, tlA);
  makeGoals(ag, 'away', tlA, tlH);

  // yellow cards (distinct players, on the pitch at the time)
  const yellowsFor = (side, tl, style) => {
    const n = rng.poisson(1.55 * (0.75 + 0.5 * params.intensity) * (STYLES[style] || STYLES.balanced).fouls);
    const booked = new Set(events.filter((e) => e.side === side && (e.type === 'yellow' || e.type === 'red')).map((e) => e.pid));
    for (let i = 0; i < n; i++) {
      const minute = rng.int(5, 90);
      const pool = onPitch(tl, Math.min(minute, 89)).filter((e) => !booked.has(e.pid));
      if (!pool.length) continue;
      const e = rng.weighted(pool, (x) => CARD_W[x.slot] || 1);
      booked.add(e.pid);
      events.push({ type: 'yellow', side, minute, pid: e.pid });
    }
  };
  yellowsFor('home', tlH, H.style);
  yellowsFor('away', tlA, A.style);

  events.sort((a, b) => (a.minute + (a.added || 0) / 100) - (b.minute + (b.added || 0) / 100));

  // statistics
  const stats = buildStats(rng, H, A, hg, ag, lh, la, params, events);

  // player ratings & man of the match
  const ratings = {};
  const rate = (tl, side, gf, ga) => {
    for (const e of tl.entries) {
      if (!e.pid || e.to - e.from <= 0) continue;
      const p = playersById[e.pid];
      let r = 6.3 + rng.normal(0, 0.45) + (gf > ga ? 0.35 : gf < ga ? -0.35 : 0);
      if (p) r += (p.overall - 70) / 40;
      if (e.slot === 'GK' || ['CB', 'LB', 'RB'].includes(e.slot)) r += ga === 0 ? 0.6 : -0.18 * ga;
      if (e.slot === 'GK') r += 0.08 * (side === 'home' ? stats.saves[0] : stats.saves[1]);
      ratings[e.pid] = r;
    }
  };
  rate(tlH, 'home', hg, ag); rate(tlA, 'away', ag, hg);
  for (const ev of events) {
    if (ev.type === 'goal' && ev.kind !== 'own' && ev.pid && ratings[ev.pid] != null) ratings[ev.pid] += 1.05;
    if (ev.type === 'goal' && ev.kind === 'own' && ev.pid && ratings[ev.pid] != null) ratings[ev.pid] -= 0.8;
    if (ev.type === 'goal' && ev.assist && ratings[ev.assist] != null) ratings[ev.assist] += 0.6;
    if (ev.type === 'red' && ratings[ev.pid] != null) ratings[ev.pid] -= 1.4;
    if (ev.type === 'yellow' && ratings[ev.pid] != null) ratings[ev.pid] -= 0.2;
  }
  let motm = null, best = -1;
  for (const pid in ratings) {
    ratings[pid] = Math.round(clamp(ratings[pid], 3, 10) * 10) / 10;
    if (ratings[pid] > best) { best = ratings[pid]; motm = pid; }
  }

  return {
    hg, ag,
    xgPre: { home: round2(xg.home), away: round2(xg.away) },
    stats,
    events,
    lineups: {
      home: lineupSummary(H, tlH), away: lineupSummary(A, tlA),
    },
    // per-player [minutes played, match rating]
    pl: Object.fromEntries(Object.entries({ ...tlH.minutes, ...tlA.minutes }).map(([pid, m]) => [pid, [m, ratings[pid] ?? null]])),
    motm,
    strength: {
      home: pickLines(H), away: pickLines(A),
    },
  };
}

function round2(x) { return Math.round(x * 100) / 100; }
function pickLines(s) {
  return { att: round2(s.att), mid: round2(s.mid), def: round2(s.def), gk: round2(s.gk), formation: s.formation, style: s.style, availability: round2(s.availability) };
}
function lineupSummary(S, tl) {
  if (!S.lineup) return null;
  return {
    formation: S.formation,
    xi: S.lineup.xi.map((s) => ({ pid: s.pid, slot: s.slot })),
    bench: S.lineup.bench.slice(),
  };
}

function buildStats(rng, H, A, hg, ag, lh, la, params, events) {
  const sh = STYLES[H.style] || STYLES.balanced, sa = STYLES[A.style] || STYLES.balanced;
  let possH = 50 + (H.mid - A.mid) * 0.9 + (sh.possession - sa.possession) / 2 + 1.5 + rng.normal(0, 3.5);
  // a team chasing the game tends to have more of the ball
  possH += (ag - hg) * 1.5;
  possH = Math.round(clamp(possH, 24, 76));
  const shotsFor = (lambda, goals) => {
    const intensityMult = 0.85 + 0.3 * params.intensity;
    const s = rng.poisson(Math.max(2, lambda / 0.105) * intensityMult * rng.float(0.85, 1.15));
    return Math.max(goals + rng.int(0, 2), s);
  };
  const shH = shotsFor(lh, hg), shA = shotsFor(la, ag);
  const onT = (shots, goals) => {
    let x = goals;
    for (let i = 0; i < shots - goals; i++) if (rng.chance(0.27)) x++;
    return Math.min(shots, x);
  };
  const otH = onT(shH, hg), otA = onT(shA, ag);
  const pens = (side) => events.filter((e) => e.type === 'goal' && e.side === side && e.kind === 'pen').length;
  const xgFor = (shots, goals, side) => round2(Math.max(0.05, shots * rng.float(0.08, 0.13) + pens(side) * 0.68 + goals * 0.08));
  const cards = (side, type) => events.filter((e) => e.side === side && e.type === type).length;
  const foulsH = rng.poisson(10.5 * sh.fouls * (0.8 + 0.4 * params.intensity));
  const foulsA = rng.poisson(10.5 * sa.fouls * (0.8 + 0.4 * params.intensity));
  const passes = (poss) => Math.round(poss * rng.float(9, 11.5));
  const pH = passes(possH), pA = passes(100 - possH);
  return {
    possession: [possH, 100 - possH],
    shots: [shH, shA],
    shotsOnTarget: [otH, otA],
    xg: [xgFor(shH, hg, 'home'), xgFor(shA, ag, 'away')],
    corners: [rng.poisson(shH * 0.36 + 0.5), rng.poisson(shA * 0.36 + 0.5)],
    fouls: [foulsH, foulsA],
    offsides: [rng.poisson(1.8), rng.poisson(1.8)],
    yellow: [cards('home', 'yellow'), cards('away', 'yellow')],
    red: [cards('home', 'red'), cards('away', 'red')],
    saves: [Math.max(0, otA - ag), Math.max(0, otH - hg)],
    passes: [pH, pA],
    passAccuracy: [Math.round(clamp(78 + (possH - 50) * 0.35 + rng.normal(0, 3), 60, 94)),
      Math.round(clamp(78 + (50 - possH) * 0.35 + rng.normal(0, 3), 60, 94))],
  };
}
