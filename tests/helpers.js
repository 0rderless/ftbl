import { newClub } from '../js/data/model.js';
import { generateSquad } from '../js/data/generate.js';
import { resolveParams, PRESETS } from '../js/engine/params.js';
import { simulateMatch } from '../js/engine/match.js';

export function club(r, tag = 'x', extra = {}) {
  const ratings = typeof r === 'number' ? { overall: r, att: r, mid: r, def: r, gk: r } : r;
  return newClub({ id: `club-${tag}`, name: `Club ${tag}`, ratings, ...extra });
}

export function team(r, tag = 'x', { squad = false, extra = {}, squadRating } = {}) {
  const c = club(r, tag, extra);
  let players = [];
  if (squad) {
    const sc = squadRating != null ? club(squadRating, tag + 's') : c;
    players = generateSquad({ ...sc, id: c.id }, [], { seed: 'sq-' + tag + JSON.stringify(c.ratings) + squadRating });
  }
  return { club: c, players };
}

export function params(overrides = {}, preset = 'realistic') {
  return resolveParams({ ...PRESETS[preset].values, ...overrides });
}

/** Simulate n matches between two teams and summarise. */
export function run(home, away, p, n, opts = {}) {
  let hw = 0, d = 0, aw = 0, hg = 0, ag = 0, big = 0, injuries = 0, shots = 0, sq = 0;
  const totals = [];
  for (let i = 0; i < n; i++) {
    const r = simulateMatch({ home, away, params: p, seed: `${opts.seed || 's'}-${i}`, ...opts.ctx });
    hg += r.hg; ag += r.ag;
    totals.push(r.hg + r.ag);
    if (r.hg + r.ag >= 5) big++;
    if (r.hg > r.ag) hw++; else if (r.hg < r.ag) aw++; else d++;
    injuries += r.events.filter((e) => e.type === 'injury').length;
    shots += r.stats.shots[0] + r.stats.shots[1];
  }
  const mean = totals.reduce((a, b) => a + b, 0) / n;
  for (const t of totals) sq += (t - mean) ** 2;
  return { n, home: hw / n, draw: d / n, away: aw / n, hg: hg / n, ag: ag / n, goals: (hg + ag) / n, big: big / n, injuries: injuries / n, shots: shots / n, variance: sq / n };
}
