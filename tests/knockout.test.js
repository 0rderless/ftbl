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
  w.settings.ui.migrations = { 'champions-league-v1': 1, 'real-clubs-v1': 1, 'fresh-start-2026-v1': 1, 'cup-season-label-v1': 1, 'division-2-v1': 1 };
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

test('Division 2: Daffers winners first then most Daffers points; 3 up / 3 down; Daffers Cup follows the leagues', async () => {
  const { createDivision2, pickDivision2 } = await import('../js/data/geko.js');
  const { competitionLeaderboard } = await import('../js/league/records.js');
  const { entryGroups } = await import('../js/league/knockout.js');
  const { w, k } = kronliga(20);
  const daf = createDaffersCup(w, k);
  setForcedWins(daf, daf.config.pool[0], -1); // a non-Kronliga club wins the Daffers Cup
  playSeason(w, daf, P);
  playSeason(w, k, P); // Kronliga season finished, next not started
  const lb = competitionLeaderboard(w, daf);
  const picked = pickDivision2(w, k, daf, 20, lb);
  assert.equal(picked[0], daf.config.pool[0], 'Daffers Cup winner is in automatically');
  assert.ok(picked.every((id) => !k.clubIds.includes(id)));
  const pts = (id) => { const r = lb.find((x) => x.clubId === id); return r ? r.w * 3 + r.d : 0; };
  for (let i = 2; i < picked.length; i++) assert.ok(pts(picked[i - 1]) >= pts(picked[i]), 'ordered by points');
  const div = createDivision2(w, k, daf, lb);
  assert.equal(div.clubIds.length, 20);
  assert.equal(div.season.label, '2027/28', 'starts alongside the next Kronliga season');
  assert.equal(k.config.relegationSpots, 3);
  assert.equal(div.config.promotionSpots, 3);
  // Kronliga can start its next season without waiting for Division 2
  startNextSeason(w, k);
  assert.equal(k.season.label, '2027/28');
  assert.equal(div.season.label, '2027/28');
  // one season later: bottom 3 down, top 3 up
  playSeason(w, k, P); playSeason(w, div, P);
  const down = k.history[k.history.length - 1].table.slice(-3).map((r) => r.clubId);
  const up = div.history[div.history.length - 1].table.slice(0, 3).map((r) => r.clubId);
  startNextSeason(w, k);
  for (const id of down) assert.ok(div.clubIds.includes(id) && !k.clubIds.includes(id));
  for (const id of up) assert.ok(k.clubIds.includes(id) && !div.clubIds.includes(id));
  assert.equal(k.clubIds.length, 20); assert.equal(div.clubIds.length, 20);
  assert.equal(k.season.label, div.season.label);
  // Daffers Cup: 100 clubs, leagues enter in round 3 (relegated clubs included), 99 matches
  startNextSeason(w, daf);
  const groups = entryGroups(w, daf);
  assert.equal(daf.season.clubIds.length, 100);
  assert.deepEqual(groups.map((g) => [g.label, g.round, g.ids.length]), [['Kronliga', 3, 20], ['Division 2', 2, 20], ['Geko non-league (smallest)', 1, 12], ['Geko non-league (strongest)', 3, 14], ['Geko non-league', 2, 34]]);
  for (const id of down) assert.ok(groups[1].ids.includes(id), 'relegated clubs enter with Division 2 in round 2');
  playSeason(w, daf, P);
  const per = {}; for (const t of daf.season.ties) per[t.round] = (per[t.round] || 0) + 1;
  assert.deepEqual(per, { 1: 6, 2: 30, 3: 32, 4: 16, 5: 8, 6: 4, 7: 2, 8: 1 }, 'full bracket, no byes');
  assert.ok(!daf.season.ties.some((t) => t.bye));
  for (const id of div.clubIds) assert.ok(!daf.season.ties.some((t) => t.round < 2 && (t.a === id || t.b === id)) && daf.season.ties.some((t) => t.round === 2 && (t.a === id || t.b === id)), 'Division 2 plays from round 2');
  for (const id of k.clubIds) assert.ok(!daf.season.ties.some((t) => t.round < 3 && (t.a === id || t.b === id)), 'Kronliga from round 3');
});

test('Division 2 plays automatically with Kronliga; bottom 3 drop out for the best non-league Daffers clubs (100 stays 100)', async () => {
  const { createDivision2 } = await import('../js/data/geko.js');
  const { competitionLeaderboard } = await import('../js/league/records.js');
  const { w, k } = kronliga(20);
  const daf = createDaffersCup(w, k);
  playSeason(w, daf, P);
  playSeason(w, k, P);
  const div = createDivision2(w, k, daf, competitionLeaderboard(w, daf));
  w.settings.ui.migrations = { 'champions-league-v1': 1, 'real-clubs-v1': 1, 'fresh-start-2026-v1': 1, 'cup-season-label-v1': 1, 'kronliga-20-daffers-v1': 1, 'division-2-v1': 1 };
  runMigrations(w);
  assert.equal(div.config.followLeagueId, k.id);
  startNextSeason(w, k);
  // playing Kronliga matchdays plays Division 2 too
  playRound(w, k, P); playRound(w, k, P);
  assert.equal(currentRound(k), 3);
  assert.equal(currentRound(div), 3, 'Division 2 kept pace');
  // finishing Kronliga finishes Division 2 as well
  playSeason(w, k, P);
  assert.ok(k.season.finished && div.season.finished, 'both seasons complete');
  // next season: 3 up, 3 down, and Division 2's bottom 3 replaced from the Daffers Cup
  const dTable = div.history[div.history.length - 1].table;
  const kTable = k.history[k.history.length - 1].table;
  const relegatedFromKron = kTable.slice(-3).map((r) => r.clubId);
  const promoted = dTable.slice(0, 3).map((r) => r.clubId);
  const dropped = dTable.slice(-3).map((r) => r.clubId);
  startNextSeason(w, k);
  const h = div.history[div.history.length - 1];
  assert.deepEqual(h.relegated, dropped);
  assert.equal(h.newcomers.length, 3);
  for (const id of dropped) assert.ok(!div.clubIds.includes(id) && !k.clubIds.includes(id), 'dropped clubs leave the leagues');
  for (const id of h.newcomers) assert.ok(div.clubIds.includes(id) && daf.config.pool.includes(id), 'newcomers come from the Daffers Cup pool');
  for (const id of relegatedFromKron) assert.ok(div.clubIds.includes(id));
  for (const id of promoted) assert.ok(k.clubIds.includes(id));
  assert.equal(k.clubIds.length, 20); assert.equal(div.clubIds.length, 20);
  assert.equal(new Set([...k.clubIds, ...div.clubIds]).size, 40, '40 league clubs, no duplicates');
  // newcomers are the non-league clubs that went furthest in the last Daffers Cup
  const last = daf.history[daf.history.length - 1];
  const roundOf = (id) => Math.max(0, ...last.ties.filter((t) => t.a === id || t.b === id).map((t) => (t.stage === 'final' ? 99 : parseInt(t.stage.slice(1), 10))));
  const nonLeague = daf.config.pool.filter((id) => !k.clubIds.includes(id) && !div.clubIds.includes(id) && !dropped.includes(id));
  const best = Math.max(...nonLeague.map(roundOf));
  assert.ok(h.newcomers.every((id) => roundOf(id) >= best - 1), 'newcomers did at least as well as the rest');
  // Daffers Cup still 100 clubs, dropped clubs now enter in the early rounds
  startNextSeason(w, daf);
  assert.equal(daf.season.clubIds.length, 100);
  for (const id of dropped) assert.ok(!k.clubIds.includes(id) && !div.clubIds.includes(id) && daf.season.clubIds.includes(id), 'dropped clubs still in the cup as non-league');
});

test('past seasons switcher: steps back through the last 3 earlier seasons, never repeating the current one', async () => {
  const { pastEntry, stepPast, pastIndex } = await import('../js/ui/pastSeasons.js');
  const { w, k } = kronliga(12);
  for (let i = 0; i < 5; i++) { playSeason(w, k, P); if (i < 4) startNextSeason(w, k); }
  // current season (5th) finished and already archived
  assert.equal(pastEntry(k), null);
  stepPast(k, 1);
  assert.equal(pastEntry(k).label, '2029/30', 'one back = the season before the current one');
  stepPast(k, 1); stepPast(k, 1); stepPast(k, 1);
  assert.equal(pastIndex(k), 3, 'limited to 3 seasons back');
  assert.equal(pastEntry(k).label, '2027/28');
  stepPast(k, -3);
  assert.equal(pastEntry(k), null);
  // while a season is in progress, one back = last finished season
  startNextSeason(w, k);
  stepPast(k, 1);
  assert.equal(pastEntry(k).label, '2030/31');
});

test('Auto rules: "always win" wins everything; a blacklisted team loses but is never relegated, letting others catch up', async () => {
  const { riggedWinner } = await import('../js/league/season.js');
  const { computeTable } = await import('../js/league/table.js');
  const { w, k } = kronliga(20);
  k.config.relegationSpots = 3;
  const { startSeason } = await import('../js/league/season.js');
  startSeason(k, 1, 'auto-rules-test'); // fixed seed: the same season every run
  const byRating = k.clubIds.slice().sort((a, b) => w.clubs[b].ratings.overall - w.clubs[a].ratings.overall);
  const best = byRating[0], worst = byRating[byRating.length - 1];
  const rig = { win: [worst], lose: [best] };
  const params = { ...P, rig };
  playSeason(w, k, params);
  const table = k.history[0].table;
  const pos = (id) => table.findIndex((r) => r.clubId === id) + 1;
  const games = (id) => k.season.fixtures.filter((f) => f.home === id || f.away === id);
  const won = (id, f) => (f.home === id ? f.result.hg > f.result.ag : f.result.ag > f.result.hg);
  // always win: every single match, champions
  assert.ok(games(worst).every((f) => won(worst, f)));
  assert.equal(pos(worst), 1);
  // blacklisted: loses a lot, but never finishes in the relegation zone
  const bestWins = games(best).filter((f) => won(best, f)).length;
  assert.ok(bestWins < 20, `blacklisted best club won only ${bestWins}`);
  assert.ok(pos(best) <= 20 - 3, `not relegated (finished ${pos(best)})`);
  assert.ok(pos(best) >= 12, `played badly (finished ${pos(best)})`);
  // at no point after round 5 was it ever inside the relegation zone for long: check final safety margin rule
  const t = computeTable(k.season.clubIds, k.season.fixtures, k.config);
  assert.ok(t.findIndex((r) => r.clubId === best) < 17);
  // both rules on the same match: always-win beats blacklist; two always-win clubs play normally
  const f = { home: worst, away: best };
  assert.equal(riggedWinner(k, f, { rig }).id, worst);
  assert.equal(riggedWinner(k, f, { rig: { win: [worst, best], lose: [] } }), null);
});

test('Restart game: wipes trophies, tables, records and stats; keeps clubs, players and line-ups; every competition back to this season', async () => {
  const { createDivision2 } = await import('../js/data/geko.js');
  const { createContinentalCup, isCup } = await import('../js/league/cup.js');
  const { competitionLeaderboard } = await import('../js/league/records.js');
  const { restartWorld, currentSeasonYear } = await import('../js/league/restart.js');
  assert.equal(currentSeasonYear(new Date(2026, 10, 9)), 2026, 'November 2026 → 2026/27');
  assert.equal(currentSeasonYear(new Date(2027, 2, 1)), 2026, 'March 2027 → still 2026/27');
  assert.equal(currentSeasonYear(new Date(2027, 7, 1)), 2027, 'August 2027 → 2027/28');
  const { w, k } = kronliga(20);
  const daf = createDaffersCup(w, k);
  playSeason(w, daf, P); playSeason(w, k, P);
  const div = createDivision2(w, k, daf, competitionLeaderboard(w, daf));
  w.settings.ui.migrations = { 'champions-league-v1': 1, 'real-clubs-v1': 1, 'fresh-start-2026-v1': 1, 'cup-season-label-v1': 1, 'kronliga-20-daffers-v1': 1, 'division-2-v1': 1 };
  runMigrations(w);
  startNextSeason(w, k); startNextSeason(w, daf);
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  for (let i = 0; i < 2; i++) {
    playSeason(w, k, P); playSeason(w, daf, P); playSeason(w, cup, P);
    startNextSeason(w, k); startNextSeason(w, daf);
    const { startNextCupSeason } = await import('../js/league/cup.js');
    startNextCupSeason(w, cup);
  }
  playRound(w, k, P);
  assert.ok(Object.values(w.clubs).some((c) => c.honours.length) && Object.values(w.players).some((p) => p.career.apps));
  const clubsBefore = JSON.stringify(Object.keys(w.clubs).sort());
  const playersBefore = JSON.stringify(Object.values(w.players).map((p) => [p.id, p.clubId, p.overall, p.number]).sort());
  const kMembers = k.clubIds.slice(), dMembers = div.clubIds.slice();
  const lastTop = k.history[k.history.length - 1].table.map((r) => r.clubId).filter((id) => k.clubIds.includes(id)).slice(0, 3);

  const out = restartWorld(w, 2026);
  assert.equal(out.label, '2026/27');
  assert.equal(JSON.stringify(Object.keys(w.clubs).sort()), clubsBefore, 'no club removed or added');
  assert.equal(JSON.stringify(Object.values(w.players).map((p) => [p.id, p.clubId, p.overall, p.number]).sort()), playersBefore, 'players untouched');
  for (const c of Object.values(w.clubs)) assert.deepEqual(c.honours, []);
  for (const p of Object.values(w.players)) { assert.deepEqual(p.awards, []); assert.equal(p.career.apps + p.career.goals + p.career.seasons, 0); }
  for (const l of Object.values(w.leagues)) {
    assert.deepEqual(l.history, [], `${l.name} history wiped`);
    assert.equal(l.season.number, 1);
    assert.equal(l.season.label, '2026/27', `${l.name} back to 2026/27`);
    assert.ok(!l.season.fixtures.some((f) => f.result), `${l.name} nothing played`);
  }
  assert.deepEqual(k.clubIds, kMembers, 'Kronliga keeps its current clubs');
  assert.deepEqual(div.clubIds, dMembers, 'Division 2 keeps its current clubs');
  assert.equal(cup.season.clubIds.length, 32);
  assert.deepEqual(cup.season.qualifiers, lastTop, 'Kronliga top 3 from the last table are in the Champions League');
  assert.equal(daf.season.clubIds.length, 100);
  // it all plays on normally afterwards
  playSeason(w, k, P); playSeason(w, daf, P); playSeason(w, cup, P);
  assert.ok(k.season.finished && div.season.finished && daf.season.finished && cup.season.finished);
  startNextSeason(w, k);
  assert.equal(k.season.label, '2027/28'); assert.equal(div.season.label, '2027/28');
  assert.ok(Object.values(w.leagues).filter((l) => !isCup(l)).every((l) => l.clubIds.length === 20));
});

test('Europa League (Kronliga 4th–5th) and Conference League (6th): real European clubs not in the Champions League', async () => {
  const { createContinentalCup, createEuropeanCups, cupPlaces, startNextCupSeason, isCup, isKnockout } = await import('../js/league/cup.js');
  const { zoneFor } = await import('../js/league/table.js');
  const { restartWorld } = await import('../js/league/restart.js');
  const { w, k } = kronliga(20);
  playSeason(w, k, P);
  const { cup: ucl } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  const uclNames = new Set(ucl.season.clubIds.map((id) => w.clubs[id].name));
  const [uel, uecl] = createEuropeanCups(w, k, ucl);
  assert.deepEqual([uel.name, uel.short, uecl.name, uecl.short], ['Europa League', 'UEL', 'Conference League', 'UECL']);
  assert.deepEqual(createEuropeanCups(w, k, ucl), [], 'only created once');
  const table = k.history[0].table.map((r) => r.clubId);
  assert.deepEqual(ucl.season.qualifiers, table.slice(0, 3));
  assert.deepEqual(uel.season.qualifiers, table.slice(3, 5), 'Kronliga 4th and 5th');
  assert.deepEqual(uecl.season.qualifiers, table.slice(5, 6), 'Kronliga 6th');
  for (const c of [uel, uecl]) {
    assert.equal(c.season.clubIds.length, 32);
    assert.equal(c.season.label, ucl.season.label, 'same season as the Champions League');
    assert.equal(c.season.groups.length, 8);
    for (const id of c.regulars) assert.ok(!uclNames.has(w.clubs[id].name) && w.clubs[id].country !== 'GEK' && !k.clubIds.includes(id), 'real clubs not in the Champions League');
  }
  const all = [ucl, uel, uecl].flatMap((c) => c.season.clubIds);
  assert.equal(new Set(all).size, 96, 'no club in two European cups');
  assert.ok(uel.regulars.some((id) => w.clubs[id].name === 'Tottenham Hotspur'));
  assert.ok(uecl.regulars.some((id) => w.clubs[id].name === 'Malmö FF'), 'clubs left out of the Champions League play in Europe too');
  assert.equal(k.config.continentalCupId, ucl.id, 'Kronliga main link stays the Champions League');
  assert.equal(k.config.continentalSpots, 3);
  // table zones
  const places = cupPlaces(w, k);
  assert.deepEqual(places.map((p) => [p.cup.short, p.from, p.to, p.zone]), [['UCL', 1, 3, 'continental'], ['UEL', 4, 5, 'europa'], ['UECL', 6, 6, 'conference']]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 18].map((pos) => zoneFor(pos, 20, k.config, places)), ['champion', 'continental', 'continental', 'europa', 'europa', 'conference', '', 'relegation']);
  // they play through and take the next Kronliga table's places
  startNextSeason(w, k); playSeason(w, k, P);
  playSeason(w, ucl, P); // the Europa League and Conference League play along
  for (const c of [ucl, uel, uecl]) assert.ok(c.season.finished && c.history.length === 1);
  startNextCupSeason(w, ucl); // and are drawn with it
  const t2 = k.history[1].table.map((r) => r.clubId);
  assert.deepEqual([ucl.season.qualifiers, uel.season.qualifiers, uecl.season.qualifiers], [t2.slice(0, 3), t2.slice(3, 5), t2.slice(5, 6)]);
  // Restart game keeps the places apart too
  restartWorld(w, 2026);
  const t3 = t2.filter((id) => k.clubIds.includes(id));
  assert.deepEqual([ucl.season.qualifiers, uel.season.qualifiers, uecl.season.qualifiers], [t3.slice(0, 3), t3.slice(3, 5), t3.slice(5, 6)]);
  assert.ok([ucl, uel, uecl].every((c) => c.season.label === '2026/27' && c.season.clubIds.length === 32));
  // no finished Kronliga season yet: strongest clubs, never the same club in two cups
  const fresh = kronliga(20);
  const { cup: u2 } = createContinentalCup(fresh.w, { qualifiers: [{ leagueId: fresh.k.id, spots: 3 }] });
  const [e2, c2] = createEuropeanCups(fresh.w, fresh.k, u2);
  const ids = [u2, e2, c2].flatMap((c) => c.season.qualifiers);
  assert.equal(ids.length, 6); assert.equal(new Set(ids).size, 6);
  assert.ok(Object.values(fresh.w.leagues).filter((l) => isCup(l) && !isKnockout(l)).every((c) => c.season.clubIds.length === 32));
});

test('Europa League and Conference League play automatically with the Champions League, round by round', async () => {
  const { createContinentalCup, createEuropeanCups, startNextCupSeason } = await import('../js/league/cup.js');
  const { w, k } = kronliga(20);
  playSeason(w, k, P);
  const { cup: ucl } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  const [uel, uecl] = createEuropeanCups(w, k, ucl);
  assert.equal(uel.config.followLeagueId, ucl.id);
  assert.equal(uecl.config.followLeagueId, ucl.id);
  // one Champions League matchday plays the same matchday of both
  playRound(w, ucl, P);
  for (const c of [uel, uecl]) {
    assert.equal(currentRound(c), 2, `${c.name} played matchday 1 too`);
    assert.ok(c.season.fixtures.filter((f) => f.round === 1).every((f) => f.result));
  }
  // the whole season: all three finish together, each with a champion
  playSeason(w, ucl, P);
  for (const c of [ucl, uel, uecl]) assert.ok(c.season.finished && c.history.length === 1, `${c.name} finished`);
  // starting the next Champions League draws the other two as well, with no club in two cups
  startNextSeason(w, k); playSeason(w, k, P);
  startNextCupSeason(w, ucl);
  for (const c of [uel, uecl]) { assert.equal(c.season.label, ucl.season.label); assert.ok(!c.season.finished); }
  assert.equal(new Set([ucl, uel, uecl].flatMap((c) => c.season.clubIds)).size, 96);
  const t = k.history[1].table.map((r) => r.clubId);
  assert.deepEqual([uel.season.qualifiers, uecl.season.qualifiers], [t.slice(3, 5), t.slice(5, 6)]);
  // the cups never play ahead of the Champions League on their own
  assert.equal(currentRound(uel), 1);
  // catch-up: a following cup left a season behind (e.g. added after the UCL had finished)
  playSeason(w, ucl, P);
  for (const c of [uel, uecl]) assert.ok(c.season.finished);
  startNextSeason(w, k); playSeason(w, k, P);
  const { startCupSeason } = await import('../js/league/cup.js');
  startCupSeason(w, ucl, ucl.season.number + 1); // the UCL alone moves on (as on a device before this update)
  startCupSeason(w, uel, uel.season.number); // and the Europa League is redrawn unplayed for the old season
  const oldLabel = uel.season.label;
  assert.ok(oldLabel < ucl.season.label);
  playRound(w, ucl, P);
  assert.equal(uel.history.at(-1).label, oldLabel, 'the old Europa League season was completed');
  assert.equal(uel.season.label, ucl.season.label, 'and the Europa League caught up');
  assert.equal(currentRound(uel), 2, 'then played the same matchday');
  // Division 2-style league following is unchanged: a cup never follows a league or vice versa
  const { followers } = await import('../js/league/season.js');
  assert.deepEqual(followers(w, ucl).map((c) => c.short).sort(), ['UECL', 'UEL']);
  assert.deepEqual(followers(w, k).filter((x) => x.type === 'cup'), []);
});
