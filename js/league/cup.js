// Champions League-style cup: 32 clubs, 8 groups of 4 (home & away), then two-legged
// Round of 16, quarter-finals and semi-finals, and a one-off final at a neutral venue.
// Level ties go to extra time and penalties. League clubs qualify from their league's
// final table (e.g. Kronliga top 3); the rest of the field are continental "regulars".
import { RNG, randomSeed } from '../core/rng.js';
import { generateFixtures } from './fixtures.js';
import { computeTable } from './table.js';
import { playerStats, topList } from './season.js';
import { newLeague, seasonLabel } from '../data/model.js';
import { addContinentalClubs, CONTINENTAL_CLUBS, EUROPA_CLUBS, CONFERENCE_CLUBS } from '../data/continental.js';
import { LEAGUE_LOGO_PRESETS } from '../ui/badge.js';
import { playExtraTime, playPenalties } from '../engine/match.js';
import { startKnockoutSeason, advanceKnockout, knockoutStatus, koRoundName, koShortName } from './knockout.js';

export const STAGES = [
  { key: 'groups', label: 'Group stage', short: 'Groups', rounds: [1, 2, 3, 4, 5, 6] },
  { key: 'r16', label: 'Round of 16', short: 'R16', rounds: [7, 8] },
  { key: 'qf', label: 'Quarter-finals', short: 'QF', rounds: [9, 10] },
  { key: 'sf', label: 'Semi-finals', short: 'SF', rounds: [11, 12] },
  { key: 'final', label: 'Final', short: 'Final', rounds: [13] },
];
export const CUP_ROUNDS = 13;
const GROUP_NAMES = 'ABCDEFGH';

export const isCup = (l) => !!l && l.type === 'cup';
export const isKnockout = (l) => isCup(l) && l.format === 'knockout';
export function stageOfRound(r, league) {
  if (isKnockout(league)) {
    const label = koRoundName(league, r);
    return { key: label === 'Final' ? 'final' : `r${r}`, label, short: koShortName(league, r), rounds: [r] };
  }
  return STAGES.find((s) => s.rounds.includes(r)) || STAGES[0];
}
export function cupTotalRounds(league) {
  return isKnockout(league) ? (league.season ? league.season.totalRounds : 0) : CUP_ROUNDS;
}
/** Short text for "Play …" buttons. */
export function playLabel(league, r) {
  if (!isCup(league)) return `matchday ${r}`;
  if (isKnockout(league)) return koShortName(league, r) === 'Final' ? 'Final' : koRoundName(league, r);
  const st = stageOfRound(r);
  if (st.key === 'groups') return `MD ${r}`;
  return st.short + (st.key === 'final' ? '' : st.rounds[0] === r ? ' leg 1' : ' leg 2');
}
export function roundLabel(r, league) {
  if (isKnockout(league)) return koRoundName(league, r);
  const st = stageOfRound(r);
  if (st.key === 'groups') return `Group stage · Matchday ${r}`;
  if (st.key === 'final') return 'Final';
  return `${st.label} · ${st.rounds[0] === r ? '1st' : '2nd'} leg`;
}

const rating = (world, id) => (world.clubs[id] ? world.clubs[id].ratings.overall : 0);

function association(world, clubId) {
  const c = world.clubs[clubId];
  if (c && c.country) return c.country;
  const l = Object.values(world.leagues).find((x) => !isCup(x) && x.clubIds.includes(clubId));
  return l ? 'L:' + l.id : 'X:' + clubId;
}

/** Who plays in the next season: league qualifiers + continental regulars. */
/** "2040/41" -> "2039/40" */
export function previousLabel(label) {
  const y = parseInt(String(label).slice(0, 4), 10);
  if (!Number.isFinite(y)) return null;
  return `${y - 1}/${String(y % 100).padStart(2, '0')}`;
}

/**
 * The league table a cup season's qualifiers come from: the league season before
 * the cup season (cup 2040/41 <- league 2039/40). If that table doesn't exist yet,
 * the most recent finished table is used, so a new cup season is never blocked.
 */
export function qualifyingTable(league, cupLabel) {
  if (!league || !league.history.length) return null;
  const want = cupLabel && previousLabel(cupLabel);
  return (want && league.history.find((h) => h.label === want)) || league.history[league.history.length - 1];
}

export function cupEntrants(world, cup, override = null, forLabel = null) {
  const size = cup.config.size || 32;
  const qualifiers = override ? override.qualifiers.filter((id) => world.clubs[id]) : [];
  const qualifiedFrom = override ? { ...override.qualifiedFrom } : {};
  const reserves = [];
  for (const { leagueId, spots, from = 1 } of override ? [] : cup.config.qualifiers || []) {
    const l = world.leagues[leagueId];
    if (!l) continue;
    const h = qualifyingTable(l, forLabel);
    // clubs already in another European cup this season (a club never plays in two)
    const taken = new Set(Object.values(world.leagues).filter((x) => x.id !== cup.id && isCup(x) && !isKnockout(x) && x.season && x.season.label === forLabel).flatMap((x) => x.season.clubIds));
    let order, start = from - 1;
    if (h) {
      qualifiedFrom[leagueId] = h.label;
      // the clubs from this place down; if one is already in a bigger cup, the next club takes its place
      order = h.table.map((r) => r.clubId).filter((id) => world.clubs[id]).filter((id, i) => i >= start && !taken.has(id));
      start = 0;
    } else {
      // no finished season yet: strongest clubs first, after those already in another cup
      // (e.g. the Europa League takes the next best after the Champions League)
      const all = l.clubIds.filter((id) => world.clubs[id]).sort((a, b) => rating(world, b) - rating(world, a));
      order = all.filter((id) => !taken.has(id));
      start = Math.max(0, start - all.filter((id) => taken.has(id)).length);
    }
    qualifiers.push(...order.slice(start, start + spots).filter((id) => !qualifiers.includes(id)));
    reserves.push(...order.slice(start + spots));
  }
  const regulars = (cup.regulars || []).filter((id) => world.clubs[id] && !qualifiers.includes(id))
    .sort((a, b) => rating(world, b) - rating(world, a));
  let field = [...qualifiers, ...regulars].slice(0, size);
  for (const id of reserves) { if (field.length >= size) break; if (!field.includes(id)) field.push(id); }
  return { field, qualifiers, qualifiedFrom };
}

function drawGroups(world, field, rng) {
  const sorted = field.slice().sort((a, b) => rating(world, b) - rating(world, a));
  const nGroups = Math.max(1, Math.floor(field.length / 4));
  for (let attempt = 0; attempt < 400; attempt++) {
    const groups = Array.from({ length: nGroups }, () => []);
    let ok = true;
    for (let pot = 0; pot < 4 && ok; pot++) {
      const potClubs = rng.shuffle(sorted.slice(pot * nGroups, (pot + 1) * nGroups));
      for (const id of potClubs) {
        const assoc = association(world, id);
        const free = groups.map((g, i) => i).filter((i) => groups[i].length === pot && (attempt > 300 || !groups[i].some((x) => association(world, x) === assoc)));
        if (!free.length) { ok = false; break; }
        groups[rng.pick(free)].push(id);
      }
    }
    if (ok) return groups.map((clubIds, i) => ({ name: GROUP_NAMES[i], clubIds }));
  }
  return Array.from({ length: nGroups }, (_, i) => ({ name: GROUP_NAMES[i], clubIds: sorted.filter((_, k) => k % nGroups === i) }));
}

export function startCupSeason(world, cup, number = 1, seed, override = null) {
  if (isKnockout(cup)) return startKnockoutSeason(world, cup, number, seed);
  const s = seed || randomSeed();
  const rng = new RNG('draw|' + s);
  const { field, qualifiers, qualifiedFrom } = cupEntrants(world, cup, override, seasonLabel(cup.config.startYear, number));
  if (field.length < 8) throw new Error('Not enough clubs for the cup');
  const groups = drawGroups(world, field, rng);
  const fixtures = [];
  for (const g of groups) {
    for (const f of generateFixtures(g.clubIds, 2, `${s}-${g.name}`)) fixtures.push({ ...f, id: `g${g.name}-${f.id}`, stage: 'groups', group: g.name });
  }
  cup.clubIds = field.slice();
  cup.season = {
    number, label: seasonLabel(cup.config.startYear, number), seed: s, clubIds: field.slice(),
    groups, fixtures, ties: [], ps: {}, finished: false, archived: false, qualifiers, qualifiedFrom, startedAt: Date.now(),
  };
  return cup.season;
}

export function groupTables(cup) {
  const s = cup.season;
  if (!s.groups) return [];
  return s.groups.map((g) => ({
    name: g.name,
    rows: computeTable(g.clubIds, s.fixtures.filter((f) => f.group === g.name), { pointsWin: 3, pointsDraw: 1, tiebreak: 'h2h' }),
  }));
}

function tieGoals(cup, tie) {
  let a = 0, b = 0;
  for (const fid of tie.fixtures) {
    const f = cup.season.fixtures.find((x) => x.id === fid);
    if (!f || !f.result) continue;
    if (f.home === tie.a) { a += f.result.hg; b += f.result.ag; } else { a += f.result.ag; b += f.result.hg; }
  }
  return [a, b];
}

function addTie(world, cup, stage, a, b, rng) {
  const st = STAGES.find((x) => x.key === stage);
  const s = cup.season;
  const tie = { id: `${stage}-${a}-${b}`, stage, a, b, fixtures: [], winner: null, agg: null };
  if (stage === 'final') {
    const venueClub = Object.values(world.clubs).filter((c) => c.id !== a && c.id !== b && s.clubIds.includes(c.id))
      .sort((x, y) => y.stadium.capacity - x.stadium.capacity)[rng.int(0, 2)];
    const f = { id: `ko-final-${a}-${b}`, round: st.rounds[0], stage, home: a, away: b, result: null, neutral: true, venue: venueClub ? venueClub.stadium.name : 'National Stadium' };
    s.fixtures.push(f); tie.fixtures.push(f.id);
  } else {
    const f1 = { id: `ko-${stage}-1-${a}-${b}`, round: st.rounds[0], stage, leg: 1, home: a, away: b, result: null };
    const f2 = { id: `ko-${stage}-2-${b}-${a}`, round: st.rounds[1], stage, leg: 2, home: b, away: a, result: null };
    s.fixtures.push(f1, f2); tie.fixtures.push(f1.id, f2.id);
  }
  s.ties.push(tie);
}

function drawRound16(world, cup, rng) {
  const tables = groupTables(cup);
  const winners = tables.map((t) => ({ id: t.rows[0].clubId, g: t.name }));
  const runners = tables.map((t) => ({ id: t.rows[1].clubId, g: t.name }));
  const order = rng.shuffle(winners);
  const pairs = [];
  const used = new Set();
  const solve = (i, strict) => {
    if (i === order.length) return true;
    const w = order[i];
    for (const r of rng.shuffle(runners)) {
      if (used.has(r.id) || r.g === w.g) continue;
      if (strict && association(world, r.id) === association(world, w.id)) continue;
      used.add(r.id); pairs.push([r.id, w.id]);
      if (solve(i + 1, strict)) return true;
      used.delete(r.id); pairs.pop();
    }
    return false;
  };
  if (!solve(0, true)) { used.clear(); pairs.length = 0; solve(0, false); }
  // group winners play the second leg at home
  for (const [runner, winner] of pairs) addTie(world, cup, 'r16', runner, winner, rng);
}

function winnersOf(cup, stage) {
  return cup.season.ties.filter((t) => t.stage === stage).map((t) => t.winner);
}

/** Generate the next stage once the current one is complete. Called after every round. */
export function advanceCup(world, cup) {
  const s = cup.season;
  if (!s || s.finished) return;
  if (isKnockout(cup)) { advanceKnockout(world, cup, finishCupSeason); return; }
  const rng = new RNG(`ko|${s.seed}|${s.fixtures.length}`);
  const has = (k) => s.fixtures.some((f) => f.stage === k);
  const done = (k) => has(k) && s.fixtures.filter((f) => f.stage === k).every((f) => f.result);
  if (done('groups') && !has('r16')) drawRound16(world, cup, rng);
  else if (done('r16') && !has('qf')) { const w = rng.shuffle(winnersOf(cup, 'r16')); for (let i = 0; i < w.length; i += 2) addTie(world, cup, 'qf', w[i], w[i + 1], rng); }
  else if (done('qf') && !has('sf')) { const w = rng.shuffle(winnersOf(cup, 'qf')); for (let i = 0; i < w.length; i += 2) addTie(world, cup, 'sf', w[i], w[i + 1], rng); }
  else if (done('sf') && !has('final')) { const w = rng.shuffle(winnersOf(cup, 'sf')); addTie(world, cup, 'final', w[0], w[1], rng); }
  else if (done('final')) finishCupSeason(world, cup);
}

/**
 * After a knockout match: if it decides a tie that is level, play extra time and
 * then penalties. `input` is the simulateMatch input used for the 90 minutes.
 */
export function resolveKnockout(cup, fixture, result, input) {
  if (fixture.stage === 'groups') return;
  const tie = cup.season.ties.find((t) => t.fixtures.includes(fixture.id));
  if (!tie || tie.fixtures[tie.fixtures.length - 1] !== fixture.id) return;
  const prev = { ...fixture, result };
  const agg = () => {
    let a = 0, b = 0;
    for (const fid of tie.fixtures) {
      const f = fid === fixture.id ? prev : cup.season.fixtures.find((x) => x.id === fid);
      if (!f || !f.result) continue;
      if (f.home === tie.a) { a += f.result.hg; b += f.result.ag; } else { a += f.result.ag; b += f.result.hg; }
    }
    return [a, b];
  };
  let [a, b] = agg();
  if (a === b) { playExtraTime(input, result); [a, b] = agg(); }
  if (a === b) playPenalties(input, result);
  tie.agg = [a, b];
  if (a !== b) tie.winner = a > b ? tie.a : tie.b;
  else {
    const homeWon = result.pens.home > result.pens.away;
    tie.winner = homeWon ? fixture.home : fixture.away;
    tie.pens = fixture.home === tie.a ? [result.pens.home, result.pens.away] : [result.pens.away, result.pens.home];
  }
}

export function finishCupSeason(world, cup) {
  const s = cup.season;
  if (!s || s.finished) return null;
  const finalTie = s.ties.find((t) => t.stage === 'final');
  if (!finalTie || !finalTie.winner) return null;
  const finalFx = s.fixtures.find((f) => f.stage === 'final');
  const champion = finalTie.winner;
  const runnerUp = finalTie.winner === finalTie.a ? finalTie.b : finalTie.a;
  const stats = playerStats(s.fixtures);
  const pname = (pid) => (world.players[pid] ? world.players[pid].name : 'Unknown');
  const clubNames = {};
  for (const id of s.clubIds) clubNames[id] = world.clubs[id] ? world.clubs[id].name : 'Unknown';
  const scorers = topList(stats, 'g', 10).map((x) => ({ pid: x.pid, name: pname(x.pid), clubId: x.clubId, goals: x.g, apps: x.apps }));
  const assists = topList(stats, 'a', 10).map((x) => ({ pid: x.pid, name: pname(x.pid), clubId: x.clubId, assists: x.a, apps: x.apps }));
  const entry = {
    type: 'cup', number: s.number, label: s.label, seed: s.seed,
    championId: champion, runnerUpId: runnerUp,
    final: { home: finalFx.home, away: finalFx.away, hg: finalFx.result.hg, ag: finalFx.result.ag, et: !!finalFx.result.et, pens: finalFx.result.pens ? [finalFx.result.pens.home, finalFx.result.pens.away] : null, venue: finalFx.venue },
    clubNames, topScorers: scorers, topAssists: assists,
    ties: s.ties.map((t) => ({ stage: t.stage, a: t.a, b: t.b, agg: t.agg, pens: t.pens || null, winner: t.winner })),
    groups: groupTables(cup).map((g) => ({ name: g.name, table: g.rows.map((r) => ({ clubId: r.clubId, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts })) })),
    results: s.fixtures.filter((f) => f.result).map((f) => [f.round, f.home, f.away, f.result.hg, f.result.ag]),
    qualifiers: s.qualifiers || [], promoted: [], relegated: [],
    finishedAt: Date.now(),
  };
  cup.history.push(entry);
  s.finished = true;
  if (world.clubs[champion]) world.clubs[champion].honours.push({ type: 'cup', leagueId: cup.id, leagueName: cup.name, season: s.label });
  if (world.clubs[runnerUp]) world.clubs[runnerUp].honours.push({ type: 'cupfinal', leagueId: cup.id, leagueName: cup.name, season: s.label });
  for (const x of Object.values(stats)) {
    const p = world.players[x.pid];
    if (!p) continue;
    p.career = p.career || { apps: 0, goals: 0, assists: 0, seasons: 0 };
    p.career.apps += x.apps; p.career.goals += x.g; p.career.assists += x.a;
  }
  if (scorers[0] && world.players[scorers[0].pid]) (world.players[scorers[0].pid].awards ||= []).push({ type: 'golden-boot', leagueName: cup.name, season: s.label, goals: scorers[0].goals });
  for (const p of Object.values(world.players)) {
    if (p.clubId === champion && stats[p.id] && stats[p.id].apps > 0) (p.awards ||= []).push({ type: 'title', leagueName: cup.name, season: s.label });
  }
  return entry;
}

/** Leagues whose qualifying season hasn't finished since the current cup season was drawn. */
/**
 * Leagues whose qualifying table for the NEXT cup season is still being played
 * (e.g. the next Champions League needs Kronliga 2040/41 and that season is in progress).
 * Only used to offer finishing it first — never to block.
 */
export function pendingQualifiers(world, cup) {
  if (isKnockout(cup) || !cup.season) return [];
  const want = previousLabel(seasonLabel(cup.config.startYear, cup.season.number + 1));
  return (cup.config.qualifiers || []).map((q) => world.leagues[q.leagueId]).filter((l) =>
    l && !l.history.some((h) => h.label === want) && l.season && l.season.label === want && !l.season.finished);
}

export function startNextCupSeason(world, cup) {
  if (!cup.season || !cup.season.finished) throw new Error('Finish the current cup season first');
  return startCupSeason(world, cup, cup.season.number + 1);
}

/**
 * Create a Champions League-style cup fed by league qualifiers. A full continental
 * field is generated and its weakest clubs are dropped to make room for the qualifiers.
 */
export const CUP_LOGOS = {
  ucl: { shape: 'circle', pattern: 'rays', emblem: 'stars3', c1: '#0b1a4a', c2: '#13245e', c3: '#ffffff', trim: '#e2e8f0' },
  uel: { shape: 'circle', pattern: 'rays', emblem: 'trophy', c1: '#1c1917', c2: '#c2410c', c3: '#ffffff', trim: '#fb923c' },
  uecl: { shape: 'circle', pattern: 'rays', emblem: 'star', c1: '#052e16', c2: '#15803d', c3: '#ffffff', trim: '#4ade80' },
};

export function createContinentalCup(world, { name = 'Champions League', short = 'UCL', qualifiers = [], size = 32, startYear, seed = 'ucl', clubs = CONTINENTAL_CLUBS, logo = CUP_LOGOS.ucl, override = null } = {}) {
  const nQ = qualifiers.reduce((t, q) => t + q.spots, 0);
  const own = clubs !== CONTINENTAL_CLUBS;
  const ids = addContinentalClubs(world, own ? clubs.length : 32, seed, clubs, { skipExisting: own });
  const sorted = ids.slice().sort((a, b) => rating(world, b) - rating(world, a));
  const regulars = sorted.slice(0, Math.max(0, size - nQ));
  const dropped = sorted.slice(regulars.length).map((id) => world.clubs[id].name);
  for (const id of sorted.slice(regulars.length)) {
    for (const p of Object.values(world.players)) if (p.clubId === id) delete world.players[p.id];
    delete world.clubs[id];
  }
  const cup = newLeague({
    name, short,
    logo: { ...LEAGUE_LOGO_PRESETS[2].spec, ...logo },
    config: { tiebreak: 'h2h', championsSpots: 1, continentalSpots: 0, relegationSpots: 0, legs: 2, startYear: startYear || 2026 },
  });
  cup.type = 'cup';
  cup.regulars = regulars;
  cup.config.qualifiers = qualifiers;
  cup.config.size = size;
  world.leagues[cup.id] = cup;
  for (const q of qualifiers) {
    const l = world.leagues[q.leagueId];
    // the league's main continental link is the cup its top places go to
    if (l && (q.from || 1) === 1) { l.config.continentalSpots = q.spots; l.config.continentalCupId = cup.id; }
  }
  startCupSeason(world, cup, 1, undefined, override);
  return { cup, dropped };
}

/**
 * Europa League (places 4–5) and Conference League (place 6) for a league that already feeds a
 * Champions League. Their fields are real European clubs outside the Champions League. They run
 * the same season as the Champions League. Returns the cups created (none if they already exist).
 */
export function createEuropeanCups(world, league, ucl) {
  const made = [];
  // same season label as the Champions League (cups are labelled one season after the table they qualify from)
  const startYear = ucl ? ucl.config.startYear + ((ucl.season && ucl.season.number) || 1) - 1 : league.config.startYear;
  const has = (short) => Object.values(world.leagues).some((l) => isCup(l) && !isKnockout(l) && l.short === short);
  if (!has('UEL')) {
    made.push(createContinentalCup(world, { name: 'Europa League', short: 'UEL', qualifiers: [{ leagueId: league.id, spots: 2, from: 4 }], startYear, seed: 'uel-' + league.id, clubs: EUROPA_CLUBS, logo: CUP_LOGOS.uel }).cup);
  }
  if (!has('UECL')) {
    made.push(createContinentalCup(world, { name: 'Conference League', short: 'UECL', qualifiers: [{ leagueId: league.id, spots: 1, from: 6 }], startYear, seed: 'uecl-' + league.id, clubs: CONFERENCE_CLUBS, logo: CUP_LOGOS.uecl }).cup);
  }
  return made;
}

/** Sort order for lists of competitions: leagues, then European cups, then knockout cups. */
export function compareCompetitions(a, b) {
  const rank = (l) => (!isCup(l) ? 0 : isKnockout(l) ? 2 : 1);
  return rank(a) - rank(b) || a.createdAt - b.createdAt;
}

const PLACE_ZONES = ['continental', 'europa', 'conference'];

/**
 * The European places a league's final table gives, best cup first:
 * e.g. [{ cup: UCL, from: 1, to: 3, zone: 'continental' }, { cup: UEL, from: 4, to: 5, zone: 'europa' }, …].
 */
export function cupPlaces(world, league) {
  if (!league || isCup(league)) return [];
  const out = [];
  for (const cup of Object.values(world.leagues)) {
    if (!isCup(cup) || isKnockout(cup)) continue;
    for (const q of cup.config.qualifiers || []) {
      if (q.leagueId !== league.id) continue;
      const from = q.from || 1;
      out.push({ cup, from, to: from + q.spots - 1 });
    }
  }
  out.sort((a, b) => a.from - b.from);
  out.forEach((p, i) => { p.zone = PLACE_ZONES[Math.min(i, PLACE_ZONES.length - 1)]; });
  return out;
}

/** Short status of a club in the current cup season, e.g. "Group B · 2nd", "In QF", "Out (R16)", "Winners". */
export function cupClubStatus(cup, clubId) {
  if (isKnockout(cup)) return knockoutStatus(cup, clubId);
  const s = cup.season;
  if (!s || !s.clubIds.includes(clubId)) return 'Not qualified';
  const ties = s.ties.filter((t) => t.a === clubId || t.b === clubId);
  const last = ties[ties.length - 1];
  const label = (k) => STAGES.find((x) => x.key === k).short;
  if (last) {
    if (last.winner && last.winner !== clubId) return `Out (${label(last.stage)})`;
    if (last.stage === 'final' && last.winner === clubId) return 'Winners';
    if (last.winner === clubId) return `Through (${label(last.stage)})`;
    return `In ${label(last.stage)}`;
  }
  const g = s.groups.find((x) => x.clubIds.includes(clubId));
  if (s.ties.length) return `Out (groups)`;
  const t = groupTables(cup).find((x) => x.name === g.name);
  const pos = t.rows.findIndex((r) => r.clubId === clubId) + 1;
  return `Group ${g.name} · ${pos}${['th', 'st', 'nd', 'rd'][pos] || 'th'}`;
}

// ---------- "Win game": guaranteed wins chosen by the user ----------
// season.forceWins = { [clubId]: n }  (n > 0: win the next n matches, -1: win every match)
export function setForcedWins(cup, clubId, n) {
  const s = cup.season;
  s.forceWins = s.forceWins || {};
  if (!n) delete s.forceWins[clubId]; else s.forceWins[clubId] = n;
}
export function forcedWins(league) {
  return (league.season && league.season.forceWins) || {};
}
/** For a tie-deciding match: would this result give clubId the tie without extra time? */
export function wouldWinTie(cup, fixture, result, clubId) {
  if (fixture.stage === 'groups') return true;
  const tie = cup.season.ties.find((t) => t.fixtures.includes(fixture.id));
  if (!tie || tie.fixtures[tie.fixtures.length - 1] !== fixture.id) return true;
  let mine = 0, theirs = 0;
  for (const fid of tie.fixtures) {
    const f = fid === fixture.id ? { ...fixture, result } : cup.season.fixtures.find((x) => x.id === fid);
    if (!f || !f.result) continue;
    const homeIsMe = f.home === clubId;
    mine += homeIsMe ? f.result.hg : f.result.ag;
    theirs += homeIsMe ? f.result.ag : f.result.hg;
  }
  return mine > theirs;
}

/** Search clubs by partial name: "man ci" -> Manchester City, "zor" -> Zorp FC, "psg" -> PSG. */
export function searchClubs(clubs, query, limit = 8) {
  const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query).trim();
  if (!q) return clubs.slice(0, limit);
  const tokens = q.split(/\s+/);
  const scored = [];
  for (const c of clubs) {
    const name = norm(c.name), words = name.split(/[\s-]+/), short = norm(c.short);
    let score = 0;
    if (name.startsWith(q)) score = 5;
    else if (short === q) score = 5;
    else if (short.startsWith(q)) score = 4;
    else if (tokens.every((t) => words.some((w) => w.startsWith(t)))) score = 3;
    else if (name.includes(q)) score = 2;
    else if (tokens.every((t) => name.includes(t))) score = 1;
    if (score) scored.push({ c, score });
  }
  return scored.sort((a, b) => b.score - a.score || b.c.ratings.overall - a.c.ratings.overall).slice(0, limit).map((x) => x.c);
}

export { tieGoals };
