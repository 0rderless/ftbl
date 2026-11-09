// Season lifecycle: fixtures, playing rounds, player condition, archiving,
// promotion & relegation. Functions mutate the passed world/league objects.
import { deriveSeed, randomSeed } from '../core/rng.js';
import { simulateMatch } from '../engine/match.js';
import { STYLES } from '../engine/tactics.js';
import { generateFixtures, roundsCount } from './fixtures.js';
import { computeTable } from './table.js';
import { seasonLabel } from '../data/model.js';
import { isCup, cupTotalRounds, resolveKnockout, advanceCup, startNextCupSeason, wouldWinTie } from './cup.js';

export function playersByClub(world) {
  const map = {};
  for (const p of Object.values(world.players)) {
    if (!p.clubId) continue;
    (map[p.clubId] || (map[p.clubId] = [])).push(p);
  }
  return map;
}

export function startSeason(league, number = 1, seed) {
  const cfg = league.config;
  const s = seed || (cfg.seedMode === 'fixed' && cfg.fixedSeed ? `${cfg.fixedSeed}-${number}` : randomSeed());
  league.season = {
    number,
    label: seasonLabel(cfg.startYear, number),
    seed: s,
    clubIds: league.clubIds.slice(),
    fixtures: generateFixtures(league.clubIds, cfg.legs, s),
    ps: {},
    finished: false,
    archived: false,
    startedAt: Date.now(),
  };
  return league.season;
}

// Regenerate the current season (e.g. after the participants changed before kick-off).
export function restartSeason(league, newSeed = false) {
  const n = league.season ? league.season.number : 1;
  const seed = newSeed || !league.season ? undefined : league.season.seed;
  return startSeason(league, n, seed);
}

export function seasonStarted(league) {
  return !!(league.season && league.season.fixtures.some((f) => f.result));
}

export function totalRounds(league) {
  if (isCup(league)) return cupTotalRounds(league);
  return league.season ? roundsCount(league.season.fixtures) : 0;
}

export function currentRound(league) {
  if (!league.season) return 0;
  let r = Infinity;
  for (const f of league.season.fixtures) if (!f.result && f.round < r) r = f.round;
  return r === Infinity ? 0 : r;
}

export function isSeasonComplete(league) {
  if (isCup(league)) return !!(league.season && league.season.finished);
  return !!league.season && league.season.fixtures.length > 0 && league.season.fixtures.every((f) => f.result);
}

// Results (W/D/L) of a club before a given round.
export function clubForm(league, clubId, beforeRound = Infinity, n = 5) {
  const out = [];
  if (!league.season) return out;
  const fx = league.season.fixtures
    .filter((f) => f.result && f.round < beforeRound && (f.home === clubId || f.away === clubId))
    .sort((a, b) => a.round - b.round);
  for (const f of fx) {
    const gf = f.home === clubId ? f.result.hg : f.result.ag;
    const ga = f.home === clubId ? f.result.ag : f.result.hg;
    out.push(gf > ga ? 'W' : gf < ga ? 'L' : 'D');
  }
  return out.slice(-n);
}

function ps(season, pid) {
  return season.ps[pid] || (season.ps[pid] = { fit: 100, inj: 0, sus: 0, yc: 0 });
}

export function simulateFixture(world, league, fixture, params, squads) {
  const clubs = world.clubs;
  const home = clubs[fixture.home], away = clubs[fixture.away];
  if (!home || !away) throw new Error('Club missing for fixture ' + fixture.id);
  const sq = squads || playersByClub(world);
  return simulateMatch(matchInput(world, league, fixture, params, sq));
}

/**
 * Simulate a fixture whose result must be a win for clubId ("Win game").
 * The match is simulated normally and only a winning outcome is kept, so the scoreline,
 * scorers and stats come from the engine. Very lopsided cases get a temporary rating boost.
 */
export function forcedWinResult(world, league, fixture, params, sq, clubId) {
  const input = matchInput(world, league, fixture, params, sq);
  const side = fixture.home === clubId ? 'home' : 'away';
  const ok = (r) => (side === 'home' ? r.hg > r.ag : r.ag > r.hg) && (!isCup(league) || wouldWinTie(league, fixture, r, clubId));
  for (let i = 0; i < 300; i++) {
    const r = simulateMatch({ ...input, seed: `${input.seed}|win${i}` });
    if (ok(r)) return r;
  }
  for (const boost of [8, 16, 25, 40, 60]) {
    const t = input[side];
    const club = { ...t.club, ratings: Object.fromEntries(Object.entries(t.club.ratings).map(([k, v]) => [k, Math.min(99, v + boost)])) };
    const players = t.players.map((p) => ({ ...p, overall: Math.min(99, p.overall + boost) }));
    const boosted = { ...input, [side]: { club, players } };
    for (let i = 0; i < 100; i++) {
      const r = simulateMatch({ ...boosted, seed: `${input.seed}|win${boost}-${i}` });
      if (ok(r)) return r;
    }
  }
  return simulateMatch(input);
}

/** The engine input for a fixture (also reused for extra time and penalties). */
export function matchInput(world, league, fixture, params, sq) {
  const season = league.season;
  const home = world.clubs[fixture.home], away = world.clubs[fixture.away];
  return {
    neutral: !!fixture.neutral,
    home: { club: home, players: sq[home.id] || [] },
    away: { club: away, players: sq[away.id] || [] },
    params,
    homeState: season.ps, awayState: season.ps,
    homeForm: clubForm(league, home.id, fixture.round),
    awayForm: clubForm(league, away.id, fixture.round),
    // seed depends on the season seed and the clubs' positions in the season, not on internal ids,
    // so the same seed + same clubs + same settings always reproduce the same season
    seed: deriveSeed(season.seed, fixture.round, season.clubIds.indexOf(fixture.home), season.clubIds.indexOf(fixture.away)),
  };
}

// Apply post-match effects on player condition.
function applyMatchEffects(league, fixture, result, params, squads, world) {
  const season = league.season;
  for (const side of ['home', 'away']) {
    const clubId = fixture[side];
    const club = world.clubs[clubId];
    const styleFatigue = (STYLES[club && club.tactics && club.tactics.style] || STYLES.balanced).fatigue;
    const drain = (18 + 14 * params.intensity) * styleFatigue;
    for (const p of squads[clubId] || []) {
      const s = ps(season, p.id);
      if (s.sus > 0) { s.sus--; continue; } // served a match ban
      const min = result.pl[p.id] ? result.pl[p.id][0] : 0;
      if (min > 0) s.fit = Math.max(30, s.fit - drain * min / 90);
    }
  }
  for (const ev of result.events) {
    if (!ev.pid) continue;
    const s = ps(season, ev.pid);
    if (ev.type === 'injury') s.inj = Math.max(s.inj, ev.rounds + 1);
    if (ev.type === 'red') s.sus += ev.second ? 1 : 2;
    if (ev.type === 'yellow') { s.yc++; if (s.yc % 5 === 0) s.sus += 1; }
  }
}

function endRound(league, squads) {
  const season = league.season;
  const rec = 3.4 * (league.config.daysBetweenRounds || 7);
  for (const cid of season.clubIds) {
    for (const p of squads[cid] || []) {
      const s = ps(season, p.id);
      s.fit = Math.min(100, s.fit + rec);
      if (s.inj > 0) s.inj--;
    }
  }
}

/** Play one fixture. It must belong to the current round (keeps the season reproducible). */
export function playFixture(world, league, fixtureId, params, squads) {
  const season = league.season;
  const f = season.fixtures.find((x) => x.id === fixtureId);
  if (!f) throw new Error('Fixture not found');
  if (f.result) return f;
  const cr = currentRound(league);
  if (f.round !== cr) throw new Error(`Only matchday ${cr} fixtures can be played now`);
  const sq = squads || playersByClub(world);
  const fw = season.forceWins || {};
  const forced = [f.home, f.away].filter((id) => fw[id]);
  const result = forced.length === 1 ? forcedWinResult(world, league, f, params, sq, forced[0]) : simulateFixture(world, league, f, params, sq);
  if (forced.length === 1) {
    result.forced = forced[0];
    if (fw[forced[0]] > 0 && --fw[forced[0]] === 0) delete fw[forced[0]];
  }
  if (isCup(league)) resolveKnockout(league, f, result, matchInput(world, league, f, params, sq));
  f.result = result;
  f.playedAt = Date.now();
  applyMatchEffects(league, f, result, params, sq, world);
  if (season.fixtures.filter((x) => x.round === cr).every((x) => x.result)) {
    endRound(league, sq);
    if (isCup(league)) advanceCup(world, league);
    else playFollowers(world, league, cr, params, isSeasonComplete(league));
  }
  if (!isCup(league) && isSeasonComplete(league) && !season.finished) finishSeason(world, league);
  return f;
}

/** Leagues set to play automatically alongside this one (e.g. Division 2 with Kronliga). */
export function followers(world, league) {
  return Object.values(world.leagues).filter((l) => !isCup(l) && l.id !== league.id && l.config.followLeagueId === league.id && l.season);
}

/** Bring followers up to the leader's matchday (or to the end of their season when the leader finishes). */
function playFollowers(world, league, round, params, leaderDone) {
  for (const f of followers(world, league)) {
    if (f.season.finished || f.season.label !== league.season.label) continue;
    for (let guard = 0; guard < 200; guard++) {
      const r = currentRound(f);
      if (!r || (!leaderDone && r > round)) break;
      playRound(world, f, params);
    }
  }
}

export function playRound(world, league, params) {
  const cr = currentRound(league);
  if (!cr) return [];
  const sq = playersByClub(world);
  const played = [];
  for (const f of league.season.fixtures.filter((x) => x.round === cr && !x.result)) {
    played.push(playFixture(world, league, f.id, params, sq));
  }
  return played;
}

export function playSeason(world, league, params) {
  let n = 0;
  while (currentRound(league)) { n += playRound(world, league, params).length; }
  return n;
}

// Aggregate player statistics for a set of fixtures.
export function playerStats(fixtures) {
  const st = {};
  const get = (pid, clubId) => st[pid] || (st[pid] = { pid, clubId, apps: 0, starts: 0, min: 0, g: 0, a: 0, yc: 0, rc: 0, motm: 0, rsum: 0, rn: 0, cs: 0 });
  for (const f of fixtures) {
    const r = f.result;
    if (!r) continue;
    for (const side of ['home', 'away']) {
      const lu = r.lineups && r.lineups[side];
      if (!lu) continue;
      const clubId = f[side];
      const conceded = side === 'home' ? r.ag : r.hg;
      const starters = new Set(lu.xi.map((s) => s.pid));
      const gk = lu.xi.find((s) => s.slot === 'GK');
      for (const pid of Object.keys(r.pl || {})) {
        if (!starters.has(pid) && !lu.bench.includes(pid)) continue;
        const [m, rating] = r.pl[pid];
        if (m <= 0) continue;
        const s = get(pid, clubId);
        s.clubId = clubId;
        s.apps++; s.min += m;
        if (starters.has(pid)) s.starts++;
        if (rating != null) { s.rsum += rating; s.rn++; }
        if (r.motm === pid) s.motm++;
        if (gk && gk.pid === pid && conceded === 0 && m >= 60) s.cs++;
      }
    }
    for (const ev of r.events) {
      const clubId = f[ev.side];
      if (ev.type === 'goal' && ev.pid && ev.kind !== 'own') get(ev.pid, clubId).g++;
      if (ev.type === 'goal' && ev.assist) get(ev.assist, clubId).a++;
      if (ev.type === 'yellow' && ev.pid) get(ev.pid, clubId).yc++;
      if (ev.type === 'red' && ev.pid) get(ev.pid, clubId).rc++;
    }
  }
  for (const s of Object.values(st)) s.avg = s.rn ? Math.round((s.rsum / s.rn) * 100) / 100 : 0;
  return st;
}

export function topList(stats, key, n = 20) {
  return Object.values(stats).filter((s) => s[key] > 0)
    .sort((a, b) => (b[key] - a[key]) || (a.min - b.min)).slice(0, n);
}

// Streaks for each club within a season.
export function clubStreaks(clubIds, fixtures) {
  const out = {};
  for (const id of clubIds) {
    const res = fixtures.filter((f) => f.result && (f.home === id || f.away === id)).sort((a, b) => a.round - b.round)
      .map((f) => { const gf = f.home === id ? f.result.hg : f.result.ag; const ga = f.home === id ? f.result.ag : f.result.hg; return gf > ga ? 'W' : gf < ga ? 'L' : 'D'; });
    let win = 0, unb = 0, cw = 0, cu = 0, loss = 0, cl = 0;
    for (const r of res) {
      cw = r === 'W' ? cw + 1 : 0; cu = r !== 'L' ? cu + 1 : 0; cl = r === 'L' ? cl + 1 : 0;
      win = Math.max(win, cw); unb = Math.max(unb, cu); loss = Math.max(loss, cl);
    }
    out[id] = { win, unbeaten: unb, losing: loss };
  }
  return out;
}

export function matchHighlights(fixtures) {
  let biggest = null, highest = null;
  for (const f of fixtures) {
    if (!f.result) continue;
    const { hg, ag } = f.result;
    const m = Math.abs(hg - ag), t = hg + ag;
    if (!biggest || m > biggest.margin || (m === biggest.margin && Math.max(hg, ag) > Math.max(biggest.hg, biggest.ag))) biggest = { home: f.home, away: f.away, hg, ag, margin: m, round: f.round };
    if (!highest || t > highest.total) highest = { home: f.home, away: f.away, hg, ag, total: t, round: f.round };
  }
  return { biggest, highest };
}

// Crown the champion and archive the season into league history.
export function finishSeason(world, league) {
  const season = league.season;
  if (!season || season.finished) return null;
  const table = computeTable(season.clubIds, season.fixtures, league.config);
  const stats = playerStats(season.fixtures);
  const name = (id) => (world.clubs[id] ? world.clubs[id].name : 'Unknown');
  const pname = (pid) => (world.players[pid] ? world.players[pid].name : 'Unknown');
  const clubNames = {};
  for (const id of season.clubIds) clubNames[id] = name(id);
  const scorers = topList(stats, 'g', 10).map((s) => ({ pid: s.pid, name: pname(s.pid), clubId: s.clubId, goals: s.g, apps: s.apps }));
  const assists = topList(stats, 'a', 10).map((s) => ({ pid: s.pid, name: pname(s.pid), clubId: s.clubId, assists: s.a, apps: s.apps }));
  const streaks = clubStreaks(season.clubIds, season.fixtures);
  const hl = matchHighlights(season.fixtures);
  const champion = table[0] && table[0].clubId;
  const entry = {
    number: season.number,
    label: season.label,
    seed: season.seed,
    championId: champion,
    runnerUpId: table[1] && table[1].clubId,
    table: table.map((r) => ({ clubId: r.clubId, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts })),
    clubNames,
    topScorers: scorers,
    topAssists: assists,
    streaks,
    highlights: hl,
    results: season.fixtures.filter((f) => f.result).map((f) => [f.round, f.home, f.away, f.result.hg, f.result.ag]),
    promoted: [], relegated: [],
    finishedAt: Date.now(),
  };
  league.history.push(entry);
  season.finished = true;
  // honours
  const champ = world.clubs[champion];
  if (champ) champ.honours.push({ type: 'league', leagueId: league.id, leagueName: league.name, season: season.label });
  if (table[1] && world.clubs[table[1].clubId]) world.clubs[table[1].clubId].honours.push({ type: 'runnerup', leagueId: league.id, leagueName: league.name, season: season.label });
  // career totals and awards
  for (const s of Object.values(stats)) {
    const p = world.players[s.pid];
    if (!p) continue;
    p.career = p.career || { apps: 0, goals: 0, assists: 0, seasons: 0 };
    p.career.apps += s.apps; p.career.goals += s.g; p.career.assists += s.a; p.career.seasons += 1;
    p.career.best = Math.max(p.career.best || 0, s.g);
  }
  if (scorers[0] && world.players[scorers[0].pid]) {
    const p = world.players[scorers[0].pid];
    (p.awards || (p.awards = [])).push({ type: 'golden-boot', leagueName: league.name, season: season.label, goals: scorers[0].goals });
  }
  if (assists[0] && world.players[assists[0].pid]) {
    const p = world.players[assists[0].pid];
    (p.awards || (p.awards = [])).push({ type: 'playmaker', leagueName: league.name, season: season.label, assists: assists[0].assists });
  }
  if (champion) {
    for (const p of Object.values(world.players)) {
      if (p.clubId === champion && stats[p.id] && stats[p.id].apps > 0) (p.awards || (p.awards = [])).push({ type: 'title', leagueName: league.name, season: season.label });
    }
  }
  return entry;
}

/**
 * Best non-league clubs from the feeder cup (the Daffers Cup) to fill places in the lowest division:
 * furthest round reached in the latest finished cup season, then all-time cup points, then rating.
 */
export function feederReplacements(world, league, n, exclude = []) {
  const cup = world.leagues[league.config.feederCupId];
  if (!cup || n <= 0) return [];
  const inLeagues = new Set(Object.values(world.leagues).filter((l) => !isCup(l)).flatMap((l) => l.clubIds));
  const pool = (cup.config.pool || cup.clubIds || []).filter((id) => world.clubs[id] && !inLeagues.has(id) && !exclude.includes(id));
  const reached = {};
  const last = cup.history[cup.history.length - 1];
  if (last) {
    const rounds = Math.max(1, ...last.ties.map((t) => (t.stage === 'final' ? 0 : parseInt(String(t.stage).replace(/\D/g, ''), 10) || 0))) + 1;
    for (const t of last.ties) {
      const r = t.stage === 'final' ? rounds : parseInt(String(t.stage).replace(/\D/g, ''), 10) || 0;
      for (const id of [t.a, t.b]) if (id) reached[id] = Math.max(reached[id] || 0, r + (t.winner === id ? 0.5 : 0));
    }
  }
  const pts = {};
  for (const h of cup.history) for (const [, a, b, ga, gb] of h.results || []) {
    pts[a] = (pts[a] || 0) + (ga > gb ? 3 : ga === gb ? 1 : 0);
    pts[b] = (pts[b] || 0) + (gb > ga ? 3 : ga === gb ? 1 : 0);
  }
  return pool.sort((a, b) => (reached[b] || 0) - (reached[a] || 0) || (pts[b] || 0) - (pts[a] || 0) || world.clubs[b].ratings.overall - world.clubs[a].ratings.overall).slice(0, n);
}

// All leagues connected to this one through promotion/relegation links.
export function pyramid(world, league) {
  const seen = new Set();
  const stack = [league.id];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id) || !world.leagues[id]) continue;
    seen.add(id);
    const c = world.leagues[id].config;
    if (c.upperLeagueId) stack.push(c.upperLeagueId);
    if (c.lowerLeagueId) stack.push(c.lowerLeagueId);
  }
  return [...seen].map((id) => world.leagues[id]);
}

/**
 * Start the next season for a league and every league linked to it,
 * moving promoted/relegated clubs between divisions.
 */
/**
 * Linked leagues that still have to finish the same season before the next one can start.
 * A linked league that is already on a later season (e.g. a new Division 2 that starts
 * next season) doesn't hold anything up.
 */
export function pyramidPending(world, league) {
  const label = league.season && league.season.label;
  return pyramid(world, league).filter((l) => !l.season || (l.season.label <= label && !l.season.finished));
}

export function startNextSeason(world, league) {
  if (isCup(league)) { startNextCupSeason(world, league); return []; }
  const group = pyramid(world, league);
  const curLabel = league.season.label;
  const pending = pyramidPending(world, league);
  if (pending.length) {
    const err = new Error('Linked leagues still in progress: ' + pending.map((l) => l.name).join(', '));
    err.pending = pending.map((l) => l.id);
    throw err;
  }
  const moves = [];
  for (const upper of group) {
    const lowerId = upper.config.lowerLeagueId;
    const lower = lowerId && world.leagues[lowerId];
    if (!lower || !group.includes(lower)) continue;
    const uh = upper.history[upper.history.length - 1];
    const lh = lower.history[lower.history.length - 1];
    if (!uh || !lh || uh.label !== lh.label || uh.label !== curLabel) continue; // only swap after the same season
    const down = uh.table.slice(uh.table.length - (upper.config.relegationSpots || 0)).map((r) => r.clubId);
    const up = lh.table.slice(0, lower.config.promotionSpots || 0).map((r) => r.clubId)
      .filter((id) => !upper.clubIds.includes(id));
    moves.push({ upper, lower, down: upper.config.relegationSpots ? down : [], up });
  }
  for (const m of moves) {
    m.upper.clubIds = m.upper.clubIds.filter((id) => !m.down.includes(id)).concat(m.up);
    m.lower.clubIds = m.lower.clubIds.filter((id) => !m.up.includes(id)).concat(m.down);
    const uh = m.upper.history[m.upper.history.length - 1];
    const lh = m.lower.history[m.lower.history.length - 1];
    uh.relegated = m.down.slice();
    lh.promoted = m.up.slice();
    for (const id of m.up) {
      const c = world.clubs[id];
      if (c) c.honours.push({ type: 'promotion', leagueId: m.lower.id, leagueName: m.lower.name, season: lh.label });
    }
  }
  for (const l of group) {
    if (l.config.lowerLeagueId || !l.config.relegationSpots || !l.config.feederCupId) continue;
    const h = l.history[l.history.length - 1];
    if (!h || h.label !== curLabel) continue;
    const out = h.table.slice(h.table.length - l.config.relegationSpots).map((r) => r.clubId).filter((id) => l.clubIds.includes(id));
    const inn = feederReplacements(world, l, out.length, out);
    l.clubIds = l.clubIds.filter((id) => !out.includes(id)).concat(inn);
    h.relegated = out.slice();
    h.newcomers = inn.slice();
    for (const id of inn) {
      const c = world.clubs[id];
      if (c) c.honours.push({ type: 'promotion', leagueId: l.id, leagueName: l.name, season: h.label, into: true });
    }
  }
  for (const l of group) {
    if (l.season.finished && l.season.label <= curLabel) startSeason(l, l.season.number + 1);
    else if (!seasonStarted(l)) {
      // already on the next season and not kicked off: redraw if promotion/relegation changed its clubs
      const same = l.season.clubIds.length === l.clubIds.length && l.clubIds.every((id) => l.season.clubIds.includes(id));
      if (!same) startSeason(l, l.season.number, l.season.seed);
    }
  }
  return moves;
}
