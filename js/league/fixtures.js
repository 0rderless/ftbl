// Round-robin fixture generation (circle method) with 1–4 legs.
import { RNG } from '../core/rng.js';

/**
 * @param {string[]} clubIds
 * @param {number} legs 1..4 — how many times each pair meets
 * @param {string} seed shuffles team order so each season's calendar differs
 * @returns {{id:string, round:number, home:string, away:string, result:null}[]}
 */
export function generateFixtures(clubIds, legs = 2, seed = 'fixtures') {
  const ids = [...new Set(clubIds)];
  if (ids.length < 2) return [];
  const rng = new RNG('fx|' + seed);
  const teams = rng.shuffle(ids);
  if (teams.length % 2 === 1) teams.push(null); // bye
  const n = teams.length;
  const roundsPerLeg = n - 1;
  const half = n / 2;
  // Berger-style circle method: rotating positions 0..m-1 plus one fixed team.
  // Venues follow the classic alternating rule, which gives each club at most one
  // "break" (two home or two away games in a row) per round-robin.
  const m = n - 1;
  const single = [];
  for (let r = 0; r < roundsPerLeg; r++) {
    const pairs = [];
    const a = teams[r], fixed = teams[m];
    if (a !== null && fixed !== null) pairs.push(r % 2 === 0 ? [a, fixed] : [fixed, a]);
    for (let i = 1; i < half; i++) {
      const x = teams[(r + i) % m], y = teams[(r - i + m) % m];
      if (x === null || y === null) continue;
      pairs.push(i % 2 === 1 ? [x, y] : [y, x]);
    }
    single.push(pairs);
  }
  const fixtures = [];
  let round = 0;
  const L = Math.max(1, Math.min(4, Math.round(legs)));
  for (let leg = 0; leg < L; leg++) {
    const reverse = leg % 2 === 1;
    // legs 3 & 4 reuse the pattern in a different round order
    const order = leg >= 2 ? rng.shuffle(single.map((_, i) => i)) : single.map((_, i) => i);
    for (const ri of order) {
      round++;
      for (const [h, a] of single[ri]) {
        const home = reverse ? a : h, away = reverse ? h : a;
        fixtures.push({ id: `r${round}-${home}-${away}`, round, home, away, result: null });
      }
    }
  }
  return fixtures;
}

export function roundsCount(fixtures) {
  return fixtures.reduce((m, f) => Math.max(m, f.round), 0);
}

// Validate a fixture list: no duplicates, each club at most once per round,
// each pair meets exactly `legs` times with balanced home/away.
export function validateFixtures(fixtures, clubIds, legs) {
  const errors = [];
  const seen = new Set();
  const perRound = {};
  const pairCount = {};
  const homeCount = {};
  for (const f of fixtures) {
    if (f.home === f.away) errors.push(`Self fixture ${f.id}`);
    if (seen.has(f.id)) errors.push(`Duplicate id ${f.id}`);
    seen.add(f.id);
    const r = perRound[f.round] || (perRound[f.round] = new Set());
    for (const c of [f.home, f.away]) {
      if (r.has(c)) errors.push(`Club ${c} twice in round ${f.round}`);
      r.add(c);
    }
    const key = [f.home, f.away].sort().join('|');
    pairCount[key] = (pairCount[key] || 0) + 1;
    const hk = f.home + '>' + f.away;
    homeCount[hk] = (homeCount[hk] || 0) + 1;
  }
  const ids = [...new Set(clubIds)];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = [ids[i], ids[j]].sort().join('|');
      if ((pairCount[key] || 0) !== legs) errors.push(`Pair ${key} meets ${pairCount[key] || 0} times`);
      const h1 = homeCount[ids[i] + '>' + ids[j]] || 0, h2 = homeCount[ids[j] + '>' + ids[i]] || 0;
      if (Math.abs(h1 - h2) > 1) errors.push(`Pair ${key} home imbalance ${h1}/${h2}`);
    }
  }
  return errors;
}
