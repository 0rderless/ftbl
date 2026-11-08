// Team strength: combines club ratings with the available squad, player fatigue,
// injuries/suspensions and the chosen formation & playing style.
import { FORMATIONS, SLOT_LINES, STYLES, positionFit } from './tactics.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function playerCondition(state, pid) {
  const s = state && state[pid];
  return { fit: s ? s.fit : 100, inj: s ? s.inj || 0 : 0, sus: s ? s.sus || 0 : 0 };
}

export function isAvailable(state, pid) {
  const c = playerCondition(state, pid);
  return c.inj <= 0 && c.sus <= 0;
}

// Effective rating of a player in a slot given fatigue.
export function effectiveRating(player, slot, fit, fatigueWeight) {
  const fatigueMult = 1 - fatigueWeight * (1 - clamp(fit, 0, 100) / 100);
  return player.overall * positionFit(player.position, slot) * fatigueMult;
}

// Pick the XI for a formation from available players, then the bench.
// With a manual line-up the chosen players are used wherever they are available;
// any gaps (injury, suspension, transfer) are filled automatically.
// Greedy auto assignment fills the most specialised slots first (GK, then by scarcity).
export function selectLineup(players, formationKey, state, fatigueWeight, benchSize = 9, manual = null) {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-4-2'];
  const pool = players.filter((p) => isAvailable(state, p.id));
  const byId = Object.fromEntries(pool.map((p) => [p.id, p]));
  const used = new Set();
  const xi = new Array(formation.slots.length).fill(null);
  const place = (p, slot, i) => {
    used.add(p.id);
    xi[i] = { pid: p.id, slot, eff: effectiveRating(p, slot, playerCondition(state, p.id).fit, fatigueWeight) };
  };
  if (manual && Array.isArray(manual.xi)) {
    if (manual.formation === formationKey) {
      formation.slots.forEach((slot, i) => {
        const p = byId[manual.xi[i]];
        if (p && !used.has(p.id)) place(p, slot, i);
      });
    } else {
      // formation changed since the line-up was saved: keep the chosen players, best slot each
      for (const pid of manual.xi) {
        const p = byId[pid];
        if (!p || used.has(p.id)) continue;
        let bi = -1, bv = -1;
        formation.slots.forEach((slot, i) => { if (!xi[i]) { const v = positionFit(p.position, slot); if (v > bv) { bv = v; bi = i; } } });
        if (bi >= 0) place(p, formation.slots[bi], bi);
      }
    }
  }
  const slots = formation.slots.map((slot, i) => ({ slot, i })).filter((s) => !xi[s.i]);
  // order: GK first, then slots with the fewest natural candidates
  const natural = (slot) => pool.filter((p) => p.position === slot).length;
  const order = slots.sort((a, b) => {
    if (a.slot === 'GK') return -1;
    if (b.slot === 'GK') return 1;
    return natural(a.slot) - natural(b.slot);
  });
  const preferBench = new Set(manual && Array.isArray(manual.bench) ? manual.bench : []);
  for (const { slot, i } of order) {
    let best = null, bestVal = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const fit = playerCondition(state, p.id).fit;
      // a fully rested player is preferred slightly when fatigue matters (rotation);
      // with a manual line-up, the chosen substitutes are first in line to fill gaps
      const val = effectiveRating(p, slot, fit, fatigueWeight) + (fatigueWeight > 0 ? (fit - 100) * 0.02 : 0) + (preferBench.has(p.id) ? 15 : 0);
      if (val > bestVal) { bestVal = val; best = p; }
    }
    if (best) place(best, slot, i);
    else xi[i] = { pid: null, slot, eff: null }; // empty slot -> youth/placeholder
  }
  const bench = [];
  if (manual && Array.isArray(manual.bench)) {
    for (const pid of manual.bench) {
      if (bench.length >= benchSize) break;
      if (byId[pid] && !used.has(pid) && !bench.includes(pid)) bench.push(pid);
    }
  }
  // auto bench: best remaining, ensure a back-up keeper if possible
  const rest = pool.filter((p) => !used.has(p.id) && !bench.includes(p.id));
  if (!bench.some((pid) => byId[pid].position === 'GK')) {
    const gk = rest.filter((p) => p.position === 'GK').sort((a, b) => b.overall - a.overall)[0];
    if (gk && bench.length < benchSize) bench.push(gk.id);
  }
  rest.filter((p) => !bench.includes(p.id))
    .sort((a, b) => (b.overall * (0.6 + 0.4 * playerCondition(state, b.id).fit / 100)) - (a.overall * (0.6 + 0.4 * playerCondition(state, a.id).fit / 100)))
    .slice(0, Math.max(0, benchSize - bench.length))
    .forEach((p) => bench.push(p.id));
  return { formation: formationKey, xi, bench };
}

export function manualLineup(club) {
  return club && club.lineup && club.lineup.manual ? club.lineup : null;
}

function lineRatings(xi, placeholder) {
  const sum = { att: 0, mid: 0, def: 0, gk: 0 }, w = { att: 0, mid: 0, def: 0, gk: 0 };
  for (const s of xi) {
    const eff = s.eff == null ? placeholder : s.eff;
    const lines = SLOT_LINES[s.slot];
    for (const k in lines) { sum[k] += eff * lines[k]; w[k] += lines[k]; }
  }
  const out = {};
  for (const k in sum) out[k] = w[k] ? sum[k] / w[k] : placeholder;
  return out;
}

// Club line ratings blended with the overall rating.
export function clubLines(club) {
  const r = club.ratings;
  const o = r.overall;
  return {
    att: 0.75 * r.att + 0.25 * o,
    mid: 0.75 * r.mid + 0.25 * o,
    def: 0.75 * r.def + 0.25 * o,
    gk: 0.75 * r.gk + 0.25 * o,
  };
}

// Compute the strength profile a team brings into a match.
export function teamStrength(club, players, state, params, lineupOverride) {
  const formation = (club.tactics && FORMATIONS[club.tactics.formation]) ? club.tactics.formation : '4-4-2';
  const style = (club.tactics && STYLES[club.tactics.style]) ? club.tactics.style : 'balanced';
  const cl = clubLines(club);
  const placeholder = club.ratings.overall - 14;
  let lines = { ...cl };
  let lineup = null;
  let availability = 1;
  if (players && players.length) {
    lineup = lineupOverride || selectLineup(players, formation, state, params.fatigueWeight, 9, manualLineup(club));
    const current = lineRatings(lineup.xi, placeholder);
    // the same squad fully fit and available — used to measure the availability/fatigue gap
    const ideal = lineRatings(selectLineup(players, formation, {}, 0).xi, placeholder);
    const q = params.squadWeight;
    for (const k of ['att', 'mid', 'def', 'gk']) {
      const gap = current[k] - ideal[k]; // <= 0 when players are missing or tired
      lines[k] = (1 - q) * (cl[k] + 0.6 * gap) + q * current[k];
    }
    const idealAvg = (ideal.att + ideal.mid + ideal.def + ideal.gk) / 4;
    const curAvg = (current.att + current.mid + current.def + current.gk) / 4;
    availability = idealAvg ? curAvg / idealAvg : 1;
  }
  // tactics: formation & style shape the lines (scaled by tactical influence)
  const T = params.tacticalWeight;
  const fm = FORMATIONS[formation].mod, sm = STYLES[style].mod;
  const tactical = {
    att: lines.att + T * (fm.att + sm.att),
    mid: lines.mid + T * (fm.mid + sm.mid),
    def: lines.def + T * (fm.def + sm.def),
    gk: lines.gk,
  };
  return { ...tactical, base: lines, formation, style, lineup, availability };
}
