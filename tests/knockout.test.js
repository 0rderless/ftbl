// Daffers Cup (knockout), new Kronliga clubs, and Win game in a league.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld } from '../js/core/store.js';
import { createClub, createLeague } from '../js/core/actions.js';
import { playSeason, playRound, startNextSeason, currentRound, totalRounds } from '../js/league/season.js';
import { createDaffersCup, addNewKronligaClubs, NEW_KRONLIGA_CLUBS } from '../js/data/geko.js';
import { cupClubStatus, setForcedWins, roundLabel } from '../js/league/cup.js';
import { runMigrations } from '../js/core/migrations.js';
import { params } from './helpers.js';

const P = params();

function kronliga(n = 20) {
  const w = emptyWorld();
  const ids = Array.from({ length: n }, (_, i) => createClub(w, { name: `K${i}`, ratings: { overall: 76 + (i % 8), att: 78, mid: 78, def: 78, gk: 78 } }, { withSquad: i < 4 }).id);
  const k = createLeague(w, { name: 'Kronliga', clubIds: ids });
  return { w, k };
}

test('Daffers Cup: 100 clubs, lower clubs in round 1, Kronliga joins in round 3, one match per tie', () => {
  const { w, k } = kronliga(20);
  const cup = createDaffersCup(w, k);
  const s = cup.season;
  assert.equal(s.clubIds.length, 100);
  assert.equal(s.totalRounds, 8);
  assert.equal(Object.values(w.clubs).filter((c) => c.country === 'GEK').length, 80);
  playSeason(w, cup, P);
  const per = {};
  for (const t of s.ties) per[t.round] = (per[t.round] || 0) + 1;
  assert.deepEqual(per, { 1: 24, 2: 12, 3: 32, 4: 16, 5: 8, 6: 4, 7: 2, 8: 1 });
  assert.equal(s.fixtures.length, 99);
  for (const id of k.clubIds) assert.ok(!s.ties.some((t) => t.round < 3 && (t.a === id || t.b === id)), 'Kronliga clubs start in round 3');
  for (const t of s.ties) {
    assert.equal(t.fixtures.length, 1, 'one match');
    const f = s.fixtures.find((x) => x.id === t.fixtures[0]);
    const r = f.result;
    if (r.hg !== r.ag && !r.pens) assert.equal(t.winner, r.hg > r.ag ? f.home : f.away);
    if (r.pens) assert.ok(r.et && r.hg === r.ag);
  }
  const final = s.fixtures.find((f) => f.stage === 'final');
  assert.ok(final.neutral);
  assert.equal(final.venue, 'Geko National Stadium');
  assert.equal(roundLabel(8, cup), 'Final');
  assert.equal(roundLabel(3, cup), 'Round 3');
  assert.equal(cupClubStatus(cup, cup.history[0].championId), 'Winners');
  assert.ok(s.finished && cup.history.length === 1);
});

test('Daffers Cup copes with an odd number of clubs (byes) and starts a new season with the current Kronliga', () => {
  const { w, k } = kronliga(19);
  const cup = createDaffersCup(w, k);
  assert.equal(cup.season.clubIds.length, 99);
  playSeason(w, cup, P);
  assert.ok(cup.season.finished);
  assert.ok(cup.season.ties.some((t) => t.bye));
  k.clubIds.push(createClub(w, { name: 'Late Joiners FC' }, { withSquad: false }).id);
  startNextSeason(w, cup);
  assert.equal(cup.season.number, 2);
  assert.equal(cup.season.clubIds.length, 100, 'new Kronliga club included');
});

test('new Kronliga clubs: 8 given/made-up names at mid-table strength, added once', () => {
  const w = emptyWorld();
  const ids = addNewKronligaClubs(w);
  assert.equal(ids.length, 8);
  const names = ids.map((id) => w.clubs[id].name);
  for (const n of ['Greenwich', 'Welling United', 'Deptford City', 'BZE']) assert.ok(names.includes(n));
  assert.equal(w.clubs[ids[names.indexOf('Welling United')]].colors.primary, '#dc2626', 'Welling in red');
  for (const id of ids) assert.ok(w.clubs[id].ratings.overall >= 79 && w.clubs[id].ratings.overall <= 82);
  assert.equal(addNewKronligaClubs(w).length, 0, 'not duplicated');
  assert.equal(NEW_KRONLIGA_CLUBS.length, 8);
});

test('upgrade: unstarted Kronliga season gets the 8 clubs now; Daffers Cup created; nothing lost', () => {
  const { w, k } = kronliga(12);
  playSeason(w, k, P);
  startNextSeason(w, k);
  w.settings.ui.migrations = { 'champions-league-v1': 1, 'real-clubs-v1': 1, 'fresh-start-2026-v1': 1, 'cup-season-label-v1': 1 };
  const history = JSON.stringify(k.history);
  const before = Object.keys(w.clubs).length;
  const msgs = runMigrations(w);
  assert.ok(msgs[0].includes('8 new clubs joined Kronliga'));
  assert.equal(k.clubIds.length, 20);
  assert.equal(k.season.clubIds.length, 20);
  assert.equal(k.season.fixtures.length, 380);
  assert.equal(k.season.number, 2);
  assert.equal(JSON.stringify(k.history), history, 'history kept');
  assert.equal(Object.keys(w.clubs).length, before + 8 + 80);
  const daf = Object.values(w.leagues).find((l) => l.format === 'knockout');
  assert.equal(daf.name, 'Daffers Cup');
  assert.equal(daf.season.clubIds.length, 100);
  assert.equal(daf.season.label, k.season.label);
  assert.deepEqual(runMigrations(w), [], 'runs once');
});

test('upgrade with a Kronliga season already under way: new clubs join from next season', () => {
  const { w, k } = kronliga(12);
  playRound(w, k, P);
  w.settings.ui.migrations = { 'champions-league-v1': 1, 'real-clubs-v1': 1, 'fresh-start-2026-v1': 1, 'cup-season-label-v1': 1 };
  const msgs = runMigrations(w);
  assert.ok(msgs[0].includes('from next season'));
  assert.equal(k.season.clubIds.length, 12, 'current season untouched');
  assert.ok(k.season.fixtures.some((f) => f.result));
  playSeason(w, k, P);
  startNextSeason(w, k);
  assert.equal(k.season.clubIds.length, 20);
});

test('Win game works in a league too', () => {
  const { w, k } = kronliga(12);
  const weakest = k.clubIds.slice().sort((a, b) => w.clubs[a].ratings.overall - w.clubs[b].ratings.overall)[0];
  setForcedWins(k, weakest, -1);
  playSeason(w, k, P);
  const games = k.season.fixtures.filter((f) => f.home === weakest || f.away === weakest);
  assert.equal(games.length, 22);
  assert.ok(games.every((f) => (f.home === weakest ? f.result.hg > f.result.ag : f.result.ag > f.result.hg)));
  assert.equal(k.history[0].championId, weakest);
  assert.equal(k.history[0].table[0].pts, 66);
});

test('Biggest clubs leaderboard: titles, runner-ups and all-time match wins per competition', async () => {
  const { competitionLeaderboard } = await import('../js/league/records.js');
  const { w, k } = kronliga(12);
  for (let i = 0; i < 3; i++) { playSeason(w, k, P); startNextSeason(w, k); }
  playRound(w, k, P);
  const rows = competitionLeaderboard(w, k);
  const titles = {};
  for (const h of k.history) titles[h.championId] = (titles[h.championId] || 0) + 1;
  assert.equal(rows[0].titles, Math.max(...Object.values(titles)));
  assert.equal(rows.reduce((t, r) => t + r.titles, 0), 3);
  assert.equal(rows.reduce((t, r) => t + r.seconds, 0), 3);
  const games = 3 * 132 + k.season.fixtures.filter((f) => f.result).length;
  assert.equal(rows.reduce((t, r) => t + r.p, 0), games * 2, 'every match counted for both clubs');
  assert.equal(rows.reduce((t, r) => t + r.w, 0), rows.reduce((t, r) => t + r.l, 0));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].titles >= rows[i].titles);
  const cup = createDaffersCup(w, k);
  playSeason(w, cup, P);
  const cupRows = competitionLeaderboard(w, cup);
  assert.equal(cupRows[0].titles, 1);
  assert.equal(cupRows[0].clubId, cup.history[0].championId);
  assert.equal(cupRows.reduce((t, r) => t + r.p, 0), (cup.season.clubIds.length - 1) * 2, 'a knockout has one match per eliminated club');
});

test('Geko biggest club: all trophies from Kronliga, Daffers Cup and Champions League; foreign clubs excluded', async () => {
  const { countryLeaderboard, isGekoClub } = await import('../js/league/records.js');
  const { createContinentalCup } = await import('../js/league/cup.js');
  const { w, k } = kronliga(12);
  playSeason(w, k, P); startNextSeason(w, k);
  const daf = createDaffersCup(w, k);
  playSeason(w, daf, P);
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  setForcedWins(cup, cup.season.qualifiers[0], -1); // make sure a Geko club wins the UCL
  playSeason(w, cup, P);
  const rows = countryLeaderboard(w);
  assert.ok(rows.every((r) => isGekoClub(w.clubs[r.clubId])), 'no foreign clubs');
  assert.ok(!rows.some((r) => w.clubs[r.clubId].name === 'Real Madrid'));
  assert.equal(rows.reduce((t, r) => t + r.total, 0), 3, 'Kronliga + Daffers + UCL titles all counted');
  const ucl = rows.find((r) => r.by[cup.id]);
  assert.equal(ucl.clubId, cup.season.qualifiers[0]);
  assert.equal(rows[0].total, Math.max(...rows.map((r) => r.total)));
  for (const r of rows) assert.equal(r.total, Object.values(r.by).reduce((t, n) => t + n, 0));
});
