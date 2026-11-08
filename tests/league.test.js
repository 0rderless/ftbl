// Fixtures, tables, seasons, reproducibility, multiple leagues, promotion & relegation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtures, validateFixtures, roundsCount } from '../js/league/fixtures.js';
import { computeTable } from '../js/league/table.js';
import { startSeason, playSeason, playRound, playFixture, currentRound, isSeasonComplete, startNextSeason, playerStats } from '../js/league/season.js';
import { leagueRecords, clubRecords, playerLeaderboards } from '../js/league/records.js';
import { buildDemoWorld } from '../js/data/demo.js';
import { params } from './helpers.js';

const P = params();

test('round-robin fixtures are valid for 2–21 clubs and 1–4 legs (no duplicates, balanced home/away)', () => {
  for (let n = 2; n <= 21; n++) {
    const ids = Array.from({ length: n }, (_, i) => 'c' + i);
    for (let legs = 1; legs <= 4; legs++) {
      const fx = generateFixtures(ids, legs, 'seed' + n + legs);
      const errors = validateFixtures(fx, ids, legs);
      assert.deepEqual(errors, [], `n=${n} legs=${legs}`);
      assert.equal(fx.length, (n * (n - 1) / 2) * legs);
      assert.equal(roundsCount(fx), (n % 2 ? n : n - 1) * legs);
      assert.equal(new Set(fx.map((f) => f.id)).size, fx.length, 'unique fixture ids');
    }
  }
});

test('home/away runs are short (no club plays 4+ consecutive home games in a double round-robin)', () => {
  const ids = Array.from({ length: 20 }, (_, i) => 'c' + i);
  const fx = generateFixtures(ids, 2, 'runs');
  for (const id of ids) {
    const seq = fx.filter((f) => f.home === id || f.away === id).sort((a, b) => a.round - b.round).map((f) => (f.home === id ? 'H' : 'A')).join('');
    assert.ok(!/HHHH|AAAA/.test(seq), `${id}: ${seq}`);
  }
});

test('league table is calculated correctly, including tiebreakers', () => {
  const ids = ['A', 'B', 'C', 'D'];
  const R = (round, home, away, hg, ag) => ({ id: `${round}${home}${away}`, round, home, away, result: { hg, ag } });
  const fx = [R(1, 'A', 'B', 2, 0), R(1, 'C', 'D', 1, 1), R(2, 'B', 'C', 3, 1), R(2, 'D', 'A', 0, 0), R(3, 'A', 'C', 1, 2), R(3, 'B', 'D', 0, 1),
    { id: 'u', round: 4, home: 'C', away: 'B', result: null }];
  const t = computeTable(ids, fx, { pointsWin: 3, pointsDraw: 1, tiebreak: 'gd' });
  const row = (id) => t.find((r) => r.clubId === id);
  assert.deepEqual([row('A').p, row('A').w, row('A').d, row('A').l, row('A').gf, row('A').ga, row('A').pts], [3, 1, 1, 1, 3, 2, 4]);
  assert.deepEqual([row('C').pts, row('C').gf, row('C').ga], [4, 4, 5]);
  assert.deepEqual([row('D').pts, row('D').gd], [5, 1]);
  assert.equal(row('B').pts, 3);
  assert.deepEqual(t.map((r) => r.clubId), ['D', 'A', 'C', 'B']);
  // A and C both 4 pts: A has better GD (+1 vs -1)
  // head-to-head first: C beat A, so C goes above A
  const h2h = computeTable(ids, fx, { pointsWin: 3, pointsDraw: 1, tiebreak: 'h2h' });
  assert.deepEqual(h2h.map((r) => r.clubId), ['D', 'C', 'A', 'B']);
  // custom points
  const t2 = computeTable(ids, fx, { pointsWin: 2, pointsDraw: 1 });
  assert.equal(t2.find((r) => r.clubId === 'A').pts, 3);
});

function world(seed = 'test-world') { return buildDemoWorld(seed); }
function leagueByName(w, name) { return Object.values(w.leagues).find((l) => l.name === name); }

test('a full season plays every fixture once and the table is internally consistent', () => {
  const w = world();
  const L = leagueByName(w, 'Kronliga');
  startSeason(L, 1, 'season-seed');
  const n = playSeason(w, L, P);
  assert.equal(n, 380);
  assert.ok(isSeasonComplete(L) && L.season.finished);
  const t = computeTable(L.season.clubIds, L.season.fixtures, L.config);
  const totals = t.reduce((a, r) => ({ p: a.p + r.p, gf: a.gf + r.gf, ga: a.ga + r.ga, pts: a.pts + r.pts, w: a.w + r.w, d: a.d + r.d, l: a.l + r.l }), { p: 0, gf: 0, ga: 0, pts: 0, w: 0, d: 0, l: 0 });
  assert.equal(totals.p, 760);
  assert.equal(totals.gf, totals.ga);
  assert.equal(totals.w, totals.l);
  assert.equal(totals.pts, 3 * totals.w + totals.d);
  for (const r of t) assert.equal(r.p, 38);
  // history archived
  assert.equal(L.history.length, 1);
  assert.equal(L.history[0].championId, t[0].clubId);
  assert.ok(w.clubs[t[0].clubId].honours.some((h) => h.type === 'league'));
  // stronger clubs do better on average over a season
  const rating = (id) => w.clubs[id].ratings.overall;
  const topHalf = t.slice(0, 10).reduce((s, r) => s + rating(r.clubId), 0) / 10;
  const bottomHalf = t.slice(10).reduce((s, r) => s + rating(r.clubId), 0) / 10;
  assert.ok(topHalf > bottomHalf + 2, `top half avg ${topHalf} vs bottom ${bottomHalf}`);
  // player stats add up to goals (minus own goals)
  const st = playerStats(L.season.fixtures);
  const own = L.season.fixtures.reduce((s, f) => s + f.result.events.filter((e) => e.type === 'goal' && e.kind === 'own').length, 0);
  const pg = Object.values(st).reduce((s, x) => s + x.g, 0);
  assert.equal(pg + own, totals.gf);
  // records
  assert.ok(leagueRecords(w, L).length >= 8);
  assert.ok(clubRecords(w, t[0].clubId).seasons.length === 1);
  assert.ok(playerLeaderboards(w).goals.length > 0);
});

test('seasons are reproducible with the same seed, settings and clubs', () => {
  const a = world('repro'), b = world('repro');
  const La = leagueByName(a, 'Kronliga'), Lb = leagueByName(b, 'Kronliga');
  startSeason(La, 1, 'fixed-seed'); startSeason(Lb, 1, 'fixed-seed');
  playSeason(a, La, P); playSeason(b, Lb, P);
  // club ids are random per world, so compare by club name
  const scores = (w, L) => L.season.fixtures.map((f) => `${f.round}:${w.clubs[f.home].name}-${w.clubs[f.away].name}:${f.result.hg}-${f.result.ag}`);
  assert.deepEqual(scores(a, La), scores(b, Lb));
  assert.deepEqual(La.history[0].table.map((r) => [a.clubs[r.clubId].name, r.pts, r.gf, r.ga]), Lb.history[0].table.map((r) => [b.clubs[r.clubId].name, r.pts, r.gf, r.ga]));
  const c = world('repro');
  const Lc = leagueByName(c, 'Kronliga');
  startSeason(Lc, 1, 'another-seed');
  playSeason(c, Lc, P);
  assert.notDeepEqual(scores(a, La), scores(c, Lc));
});

test('round-by-round and all-at-once simulation give identical results (order independence)', () => {
  const a = world('order'), b = world('order');
  const La = leagueByName(a, 'Kronliga'), Lb = leagueByName(b, 'Kronliga');
  startSeason(La, 1, 's'); startSeason(Lb, 1, 's');
  playSeason(a, La, P);
  // b: play single fixtures in reverse order within each round
  while (currentRound(Lb)) {
    const r = currentRound(Lb);
    for (const f of Lb.season.fixtures.filter((x) => x.round === r).reverse()) playFixture(b, Lb, f.id, P);
  }
  assert.deepEqual(La.season.fixtures.map((f) => [f.result.hg, f.result.ag]), Lb.season.fixtures.map((f) => [f.result.hg, f.result.ag]));
});

test('only the current matchday can be played', () => {
  const w = world();
  const L = leagueByName(w, 'Kronliga');
  startSeason(L, 1, 'x');
  const future = L.season.fixtures.find((f) => f.round === 3);
  assert.throws(() => playFixture(w, L, future.id, P), /Only matchday 1/);
  playRound(w, L, P);
  assert.equal(currentRound(L), 2);
});

test('multiple leagues are independent', () => {
  const w = world();
  const A = leagueByName(w, 'Kronliga'), B = leagueByName(w, 'Kronliga 2');
  startSeason(A, 1, 'a'); startSeason(B, 1, 'b');
  const bBefore = JSON.stringify(B.season);
  playSeason(w, A, P);
  assert.equal(JSON.stringify(B.season), bBefore, 'league B untouched');
  assert.ok(A.season.fixtures.every((f) => f.result));
  assert.ok(B.season.fixtures.every((f) => !f.result));
  // the same club in two leagues keeps separate fitness/injury state
  const shared = A.clubIds[0];
  B.clubIds.push(shared);
  startSeason(B, 1, 'b2');
  assert.deepEqual(B.season.ps, {});
});

test('injured and suspended players are never selected; fitness drains and recovers', () => {
  const w = world('inj');
  const L = leagueByName(w, 'Kronliga');
  startSeason(L, 1, 'inj');
  const hi = params({ injuryFrequency: 100 });
  for (let r = 0; r < 12; r++) {
    const round = currentRound(L);
    const unavailable = new Set(Object.entries(L.season.ps).filter(([, s]) => s.inj > 0 || s.sus > 0).map(([pid]) => pid));
    const played = playRound(w, L, hi);
    for (const f of played) for (const side of ['home', 'away']) for (const s of f.result.lineups[side].xi) {
      assert.ok(!unavailable.has(s.pid), `round ${round}: unavailable player ${s.pid} selected`);
    }
  }
  const states = Object.values(L.season.ps);
  assert.ok(states.some((s) => s.inj > 0) || L.season.fixtures.some((f) => f.result && f.result.events.some((e) => e.type === 'injury')));
  assert.ok(states.some((s) => s.fit < 100), 'some fatigue present');
});

test('promotion and relegation move the right clubs between linked leagues', () => {
  const w = world('promo');
  const top = leagueByName(w, 'Kronliga'), second = leagueByName(w, 'Kronliga 2');
  startSeason(top, 1, 't'); startSeason(second, 1, 's');
  playSeason(w, top, P);
  assert.throws(() => startNextSeason(w, top), /still in progress/);
  playSeason(w, second, P);
  const relegated = top.history[0].table.slice(-3).map((r) => r.clubId);
  const promoted = second.history[0].table.slice(0, 3).map((r) => r.clubId);
  startNextSeason(w, top);
  for (const id of relegated) { assert.ok(second.clubIds.includes(id)); assert.ok(!top.clubIds.includes(id)); }
  for (const id of promoted) { assert.ok(top.clubIds.includes(id)); assert.ok(!second.clubIds.includes(id)); }
  assert.equal(top.clubIds.length, 20);
  assert.equal(second.clubIds.length, 16);
  assert.equal(top.season.number, 2);
  assert.equal(second.season.number, 2);
  assert.deepEqual(top.history[0].relegated.sort(), relegated.sort());
  assert.deepEqual(second.history[0].promoted.sort(), promoted.sort());
  assert.deepEqual(validateFixtures(top.season.fixtures, top.clubIds, 2), []);
  assert.ok(promoted.every((id) => w.clubs[id].honours.some((h) => h.type === 'promotion')));
});
