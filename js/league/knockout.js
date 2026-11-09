// FA Cup-style knockout ("Daffers Cup"): one match per tie, extra time and penalties
// if level, clubs entering in different rounds by tier, random draw each round,
// a bye if a round has an odd number of clubs, final at a neutral national stadium.
import { RNG, randomSeed } from '../core/rng.js';
import { seasonLabel } from '../data/model.js';

// cup.config.entries = [{ round, clubIds?: [], leagueId?: id }]
/**
 * Entry list → clubs per entry, in the order they are listed.
 * Entry kinds: { leagueId } every club in that league, { clubIds } fixed clubs,
 * { rest: true, weakest: n } the n lowest-rated pool clubs not already placed,
 * { rest: true, strongest: n } the n highest-rated pool clubs not already placed,
 * { rest: true } all remaining pool clubs (pool = cup.config.pool).
 */
export function entryGroups(world, cup) {
  const entries = cup.config.entries || [];
  const seen = new Set();
  const out = entries.map((e) => ({ entry: e, round: e.round, label: e.label || '', ids: [] }));
  const take = (g, ids) => { for (const id of ids) { if (!world.clubs[id] || seen.has(id)) continue; seen.add(id); g.ids.push(id); } };
  out.forEach((g) => {
    const e = g.entry;
    if (e.rest) return;
    take(g, e.leagueId ? ((world.leagues[e.leagueId] && world.leagues[e.leagueId].clubIds) || []) : (e.clubIds || []));
    if (!g.label && e.leagueId && world.leagues[e.leagueId]) g.label = world.leagues[e.leagueId].name;
  });
  const rating = (id) => world.clubs[id].ratings.overall;
  const rest = () => (cup.config.pool || []).filter((id) => world.clubs[id] && !seen.has(id));
  out.forEach((g) => {
    const e = g.entry;
    if (!e.rest) return;
    const pool = rest().sort((a, b) => rating(a) - rating(b));
    take(g, e.weakest ? pool.slice(0, e.weakest) : e.strongest ? pool.slice(-e.strongest).reverse() : pool);
  });
  return out;
}

export function entrantsByRound(world, cup) {
  const by = {};
  for (const g of entryGroups(world, cup)) for (const id of g.ids) (by[g.round] || (by[g.round] = [])).push(id);
  return by;
}

/** Number of rounds a season will have (given who enters where). */
export function expectedRounds(world, cup) {
  const by = entrantsByRound(world, cup);
  let alive = 0, r = 0;
  const last = Math.max(1, ...Object.keys(by).map(Number));
  while (r < 30) {
    r++;
    alive += (by[r] || []).length;
    if (r >= last && alive <= 1) return r - 1;
    alive = Math.ceil(alive / 2);
  }
  return r;
}

export function koRoundName(cup, r) {
  const total = (cup.season && cup.season.totalRounds) || 8;
  const left = total - r;
  if (left === 0) return 'Final';
  if (left === 1) return 'Semi-finals';
  if (left === 2) return 'Quarter-finals';
  return `Round ${r}`;
}

export function koShortName(cup, r) {
  const n = koRoundName(cup, r);
  return n === 'Final' ? 'Final' : n === 'Semi-finals' ? 'SF' : n === 'Quarter-finals' ? 'QF' : `R${r}`;
}

function drawRound(world, cup, r, clubs, rng) {
  const s = cup.season;
  const pool = rng.shuffle(clubs);
  const total = s.totalRounds;
  const isFinal = r === total;
  if (pool.length % 2 === 1) {
    // odd number: one club goes through without playing
    const bye = pool.pop();
    s.ties.push({ id: `r${r}-bye-${bye}`, stage: `r${r}`, round: r, a: bye, b: null, fixtures: [], winner: bye, bye: true });
  }
  for (let i = 0; i < pool.length; i += 2) {
    const a = pool[i], b = pool[i + 1];
    const f = { id: `ko-r${r}-${a}-${b}`, round: r, stage: isFinal ? 'final' : `r${r}`, home: a, away: b, result: null };
    if (isFinal) { f.neutral = true; f.venue = cup.config.finalVenue || 'National Stadium'; }
    s.fixtures.push(f);
    s.ties.push({ id: `r${r}-${a}-${b}`, stage: isFinal ? 'final' : `r${r}`, round: r, a, b, fixtures: [f.id], winner: null, agg: null });
  }
}

export function startKnockoutSeason(world, cup, number = 1, seed) {
  const s = seed || randomSeed();
  const by = entrantsByRound(world, cup);
  const clubIds = Object.values(by).flat();
  cup.clubIds = clubIds.slice();
  cup.season = {
    number, label: seasonLabel(cup.config.startYear, number), seed: s, clubIds,
    fixtures: [], ties: [], ps: {}, finished: false, archived: false, startedAt: Date.now(),
    entries: by, totalRounds: 0,
  };
  cup.season.totalRounds = expectedRounds(world, cup);
  drawRound(world, cup, 1, by[1] || [], new RNG(`ko1|${s}`));
  // if round 1 is empty (everyone enters later), move on
  advanceKnockout(world, cup);
  return cup.season;
}

/** After each round: draw the next round from the winners plus the clubs entering now. */
export function advanceKnockout(world, cup, onFinish) {
  const s = cup.season;
  if (!s || s.finished) return;
  for (let guard = 0; guard < 30; guard++) {
    const drawn = Math.max(0, ...s.ties.map((t) => t.round));
    const ties = s.ties.filter((t) => t.round === drawn);
    if (drawn > 0 && ties.some((t) => !t.winner)) return; // round still being played
    if (drawn >= s.totalRounds && drawn > 0) { if (onFinish) onFinish(world, cup); return; }
    const next = drawn + 1;
    const clubs = [...ties.map((t) => t.winner), ...((s.entries && s.entries[next]) || [])];
    if (clubs.length <= 1 && next > s.totalRounds) { if (onFinish) onFinish(world, cup); return; }
    drawRound(world, cup, next, clubs, new RNG(`ko${next}|${s.seed}`));
    if (s.ties.some((t) => t.round === next && !t.winner)) return;
  }
}

export function knockoutStatus(cup, clubId) {
  const s = cup.season;
  if (!s || !s.clubIds.includes(clubId)) return 'Not entered';
  const ties = s.ties.filter((t) => t.a === clubId || t.b === clubId);
  const last = ties[ties.length - 1];
  if (!last) {
    const enters = Object.entries(s.entries || {}).find(([, ids]) => ids.includes(clubId));
    return enters ? `Enters in ${koRoundName(cup, Number(enters[0]))}` : 'Waiting';
  }
  const name = koShortName(cup, last.round);
  if (last.winner && last.winner !== clubId) return `Out (${name})`;
  if (last.round === s.totalRounds && last.winner === clubId) return 'Winners';
  if (last.winner === clubId) return `Through (${name})`;
  return `In ${koRoundName(cup, last.round)}`;
}
