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

// Pick the best XI for a formation from available players, then the bench.
// Greedy assignment, filling the most specialised slots first (GK, then by scarcity).
export function selectLineup(players, formationKey, state, fatigueWeight, benchSize = 9) {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-4-2'];
  const pool = players.filter((p) => isAvailable(state, p.id));
  const used = new Set();
  const slots = formation.slots.map((slot, i) => ({ slot, i }));
  // order: GK first, then slots with the fewest natural candidates
  const natural = (slot) => pool.filter((p) => p.position === slot).length;
  const order = slots.slice().sort((a, b) => {
    if (a.slot === 'GK') return -1;
    if (b.slot === 'GK') return 1;
    return natural(a.slot) - natural(b.slot);
  });
  const xi = new Array(formation.slots.length).fill(null);
  for (const { slot, i } of order) {
    let best = null, bestVal = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const fit = playerCondition(state, p.id).fit;
      // a fully rested player is preferred slightly when fatigue matters (rotation)
      const val = effectiveRating(p, slot, fit, fatigueWeight) + (fatigueWeight > 0 ? (fit - 100) * 0.02 : 0);
      if (val > bestVal) { bestVal = val; best = p; }
    }
    if (best) {
      used.add(best.id);
      xi[i] = { pid: best.id, slot, eff: effectiveRating(best, slot, playerCondition(state, best.id).fit, fatigueWeight) };
    } else {
      xi[i] = { pid: null, slot, eff: null }; // empty slot -> youth/placeholder
    }
  }
  // bench: best remaining, ensure a back-up keeper if possible
  const rest = pool.filter((p) => !used.has(p.id));
  const bench = [];
  const gk = rest.filter((p) => p.position === 'GK').sort((a, b) => b.overall - a.overall)[0];
  if (gk) bench.push(gk.id);
  rest.filter((p) => p.id !== (gk && gk.id))
    .sort((a, b) => (b.overall * (0.6 + 0.4 * playerCondition(state, b.id).fit / 100)) - (a.overall * (0.6 + 0.4 * playerCondition(state, a.id).fit / 100)))
    .slice(0, benchSize - bench.length)
    .forEach((p) => bench.push(p.id));
  return { formation: formationKey, xi, bench };
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
    lineup = lineupOverride || selectLineup(players, formation, state, params.fatigueWeight);
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
