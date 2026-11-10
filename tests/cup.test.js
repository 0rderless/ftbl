// Champions League: field, draw rules, knockout logic, extra time/penalties, qualification, migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld } from '../js/core/store.js';
import { createClub, createLeague } from '../js/core/actions.js';
import { playSeason, playRound, currentRound, startNextSeason } from '../js/league/season.js';
import { createContinentalCup, groupTables, pendingQualifiers, cupClubStatus, isCup } from '../js/league/cup.js';
import { validateFixtures } from '../js/league/fixtures.js';
import { runMigrations, pendingMigrations } from '../js/core/migrations.js';
import { params } from './helpers.js';

const P = params();

function worldWithKronliga(fixedSeed = '') {
  const w = emptyWorld();
  // (random squad generation is skipped for the reproducibility check)
  const ids = Array.from({ length: 12 }, (_, i) => createClub(w, { name: `Club ${i}`, ratings: { overall: 70 + i, att: 70 + i, mid: 70 + i, def: 70 + i, gk: 70 + i } }, { withSquad: !fixedSeed }).id);
  const k = createLeague(w, { name: 'Kronliga', clubIds: ids, config: fixedSeed ? { seedMode: 'fixed', fixedSeed } : {} });
  playSeason(w, k, P);
  startNextSeason(w, k);
  playRound(w, k, P);
  return { w, k };
}

test('the field: continental clubs minus the 3 weakest, plus the league top 3', () => {
  const { w, k } = worldWithKronliga();
  const top3 = k.history[0].table.slice(0, 3).map((r) => r.clubId);
  const { cup, dropped } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  assert.equal(dropped.length, 3);
  assert.deepEqual(dropped.sort(), ['Young Boys', 'Malmö FF', 'Sparta Prague'].sort(), 'the three weakest continental clubs');
  assert.ok(!Object.values(w.clubs).some((c) => dropped.includes(c.name)), 'dropped clubs removed');
  assert.equal(cup.season.clubIds.length, 32);
  assert.deepEqual(cup.season.qualifiers, top3);
  for (const id of top3) assert.ok(cup.season.clubIds.includes(id));
  assert.equal(cup.season.label, '2027/28');
  assert.equal(k.config.continentalSpots, 3);
  assert.equal(k.config.continentalCupId, cup.id);
  // groups: 8 x 4, no two clubs from the same country/league in a group, valid fixtures
  assert.equal(cup.season.groups.length, 8);
  for (const g of cup.season.groups) {
    assert.equal(g.clubIds.length, 4);
    const assoc = g.clubIds.map((id) => w.clubs[id].country || 'KRL');
    assert.equal(new Set(assoc).size, 4, `group ${g.name} association clash`);
    assert.deepEqual(validateFixtures(cup.season.fixtures.filter((f) => f.group === g.name), g.clubIds, 2), []);
  }
});

test('a full Champions League season: knockouts, extra time, penalties, a champion', () => {
  const { w, k } = worldWithKronliga();
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  const kronBefore = JSON.stringify(k.season);
  const n = playSeason(w, cup, P);
  assert.equal(n, 96 + 16 + 8 + 4 + 1);
  assert.equal(JSON.stringify(k.season), kronBefore, 'Kronliga untouched');
  const s = cup.season;
  assert.ok(s.finished && cup.history.length === 1);
  const byStage = (st) => s.ties.filter((t) => t.stage === st);
  assert.deepEqual(['r16', 'qf', 'sf', 'final'].map((x) => byStage(x).length), [8, 4, 2, 1]);
  // R16: winners vs runners-up from different groups; winners host the 2nd leg
  const tables = groupTables(cup);
  const winners = new Set(tables.map((t) => t.rows[0].clubId)), runners = new Set(tables.map((t) => t.rows[1].clubId));
  const groupOf = (id) => s.groups.find((g) => g.clubIds.includes(id)).name;
  for (const t of byStage('r16')) {
    assert.ok(runners.has(t.a) && winners.has(t.b));
    assert.notEqual(groupOf(t.a), groupOf(t.b));
    const leg2 = s.fixtures.find((f) => f.id === t.fixtures[1]);
    assert.equal(leg2.home, t.b);
  }
  // every tie has a correct winner; pens only when aggregate level after extra time
  for (const t of s.ties) {
    assert.ok(t.winner === t.a || t.winner === t.b);
    const fx = t.fixtures.map((id) => s.fixtures.find((f) => f.id === id));
    let a = 0, b = 0;
    for (const f of fx) { if (f.home === t.a) { a += f.result.hg; b += f.result.ag; } else { a += f.result.ag; b += f.result.hg; } }
    assert.deepEqual(t.agg, [a, b]);
    const last = fx[fx.length - 1].result;
    if (a !== b) { assert.equal(t.winner, a > b ? t.a : t.b); assert.ok(!last.pens); }
    else { assert.ok(last.et && last.pens && last.pens.home !== last.pens.away); }
    for (const f of fx.slice(0, -1)) assert.ok(!f.result.et && !f.result.pens, 'no extra time in first legs');
  }
  const final = s.fixtures.find((f) => f.stage === 'final');
  assert.ok(final.neutral && final.venue);
  const champ = cup.history[0].championId;
  assert.equal(champ, byStage('final')[0].winner);
  assert.ok(w.clubs[champ].honours.some((h) => h.type === 'cup'));
  assert.equal(cupClubStatus(cup, champ), 'Winners');
});

test('extra time and penalties happen at believable rates over many ties', () => {
  let ties = 0, et = 0, pens = 0;
  for (let i = 0; i < 6; i++) {
    const { w, k } = worldWithKronliga();
    const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], seed: 'ucl' + i });
    playSeason(w, cup, P);
    for (const t of cup.season.ties) {
      ties++;
      const last = cup.season.fixtures.find((f) => f.id === t.fixtures[t.fixtures.length - 1]).result;
      if (last.et) et++;
      if (last.pens) pens++;
    }
  }
  assert.ok(et / ties > 0.05 && et / ties < 0.35, `extra time in ${et}/${ties}`);
  assert.ok(pens > 0 && pens <= et);
});

test('next season: qualifiers come from the league season before; offers (never forces) finishing it', () => {
  const { w, k } = worldWithKronliga(); // Kronliga 2026/27 finished, 2027/28 in progress
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  assert.equal(cup.season.label, '2027/28');
  assert.deepEqual(cup.season.qualifiers, k.history[0].table.slice(0, 3).map((r) => r.clubId), 'UCL 2027/28 <- Kronliga 2026/27');
  playSeason(w, cup, P);
  assert.deepEqual(pendingQualifiers(w, cup).map((l) => l.id), [k.id], 'next UCL needs Kronliga 2027/28, still in progress');
  playSeason(w, k, P);
  assert.deepEqual(pendingQualifiers(w, cup), []);
  const newTop3 = k.history[1].table.slice(0, 3).map((r) => r.clubId);
  startNextSeason(w, cup);
  assert.equal(cup.season.label, '2028/29');
  assert.deepEqual(cup.season.qualifiers, newTop3, 'UCL 2028/29 <- Kronliga 2027/28');
  assert.equal(cup.season.clubIds.length, 32);
});

test('never stuck: league played ahead of the cup (the reported bug)', () => {
  const { w, k } = worldWithKronliga();
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }], startYear: 2027 });
  // play Kronliga 2027/28 to the end BEFORE finishing UCL 2027/28 (Kronliga is now ahead)
  playSeason(w, k, P);
  playSeason(w, cup, P);
  assert.deepEqual(pendingQualifiers(w, cup), [], 'nothing to wait for');
  startNextSeason(w, cup);
  assert.equal(cup.season.label, '2028/29');
  assert.deepEqual(cup.season.qualifiers, k.history.find((h) => h.label === '2027/28').table.slice(0, 3).map((r) => r.clubId));
  // and even when the needed table is mid-season, starting anyway uses the latest finished table
  startNextSeason(w, k); playRound(w, k, P); // Kronliga 2028/29 in progress
  playSeason(w, cup, P);
  assert.deepEqual(pendingQualifiers(w, cup).map((l) => l.id), [k.id]);
  startNextSeason(w, cup); // user chose "use the latest finished table"
  assert.equal(cup.season.label, '2029/30');
  assert.deepEqual(cup.season.qualifiers, k.history[k.history.length - 1].table.slice(0, 3).map((r) => r.clubId));
});

test('cup seasons are reproducible from the seed', async () => {
  const { startCupSeason } = await import('../js/league/cup.js');
  const once = () => {
    const { w, k } = worldWithKronliga('kron');
    const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }] });
    startCupSeason(w, cup, 1, 'fixed-seed');
    playSeason(w, cup, P);
    const name = (id) => w.clubs[id].name;
    return cup.season.fixtures.map((f) => `${f.round}:${name(f.home)}-${name(f.away)}:${f.result.hg}-${f.result.ag}${f.result.pens ? 'p' + f.result.pens.home + f.result.pens.away : ''}`);
  };
  assert.deepEqual(once(), once());
});

test('migration adds the Champions League once, keeps every existing record, and is idempotent', () => {
  const { w, k } = worldWithKronliga();
  const before = JSON.parse(JSON.stringify(w));
  assert.equal(pendingMigrations(w).length, 9);
  const msgs = runMigrations(w);
  assert.equal(msgs.length, 6, 'Champions League + Daffers Cup + Division 2 + auto-play + Daffers rounds + Europa/Conference messages (continental clubs are already real)');
  const cups = Object.values(w.leagues).filter((l) => isCup(l) && l.format !== 'knockout');
  assert.deepEqual(cups.map((c) => c.name), ['Champions League', 'Europa League', 'Conference League']);
  assert.equal(cups[0].season.label, k.season.label, 'cup season matches the current league season');
  // nothing existing was removed or changed (apart from the Kronliga UCL link)
  for (const id of Object.keys(before.clubs)) assert.deepEqual(w.clubs[id], before.clubs[id]);
  for (const id of Object.keys(before.players)) assert.deepEqual(w.players[id], before.players[id]);
  const kb = before.leagues[k.id], ka = w.leagues[k.id];
  assert.deepEqual(ka.season, kb.season);
  assert.deepEqual(ka.history, kb.history);
  // only the new links change: Champions League places and the Division 2 relegation link
  const strip = (c) => ({ ...c, continentalCupId: undefined, continentalSpots: undefined, lowerLeagueId: undefined, relegationSpots: undefined });
  assert.deepEqual(strip(ka.config), strip(kb.config));
  assert.equal(ka.config.relegationSpots, 3);
  assert.equal(pendingMigrations(w).length, 0);
  assert.deepEqual(runMigrations(w), []);
  assert.equal(Object.values(w.leagues).filter((l) => isCup(l) && l.format !== 'knockout').length, 3);
  // a world without Kronliga history is left alone (and retried later)
  const empty = emptyWorld();
  assert.deepEqual(runMigrations(empty), []);
  assert.equal(pendingMigrations(empty).length, 6, 'Champions League, Kronliga/Daffers and Division 2 upgrades wait for a Kronliga');
});

test('league table marks exactly the top 3 as Champions League places', async () => {
  const { zoneFor } = await import('../js/league/table.js');
  const cfg = { championsSpots: 1, continentalSpots: 3, continentalCupId: 'ucl', relegationSpots: 0 };
  assert.deepEqual([1, 2, 3, 4].map((p) => zoneFor(p, 12, cfg)), ['champion', 'continental', 'continental', '']);
});

test('upgrade renames old fictional continental clubs to real clubs, keeping results and user edits', async () => {
  const { realizeContinentalClubs, OLD_FICTIONAL, CONTINENTAL_CLUBS } = await import('../js/data/continental.js');
  const { w, k } = worldWithKronliga();
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }] });
  // turn the generated real clubs back into the old fictional names to mimic version 1 data
  const regs = cup.regulars.map((id) => w.clubs[id]);
  const oldByCountry = {};
  regs.forEach((c, i) => { c.name = OLD_FICTIONAL[i]; });
  regs[0].name = 'My Renamed Club'; // a club the user renamed must be left alone
  playRound(w, cup, P);
  const before = JSON.stringify(cup.season.fixtures.map((f) => [f.id, f.result && f.result.hg, f.result && f.result.ag]));
  const keep = regs.map((c) => c.id);
  const changes = realizeContinentalClubs(w);
  assert.equal(changes.length, 28);
  assert.equal(w.clubs[keep[0]].name, 'My Renamed Club');
  const names = regs.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, 'no duplicate names');
  for (const n of names.slice(1)) assert.ok(CONTINENTAL_CLUBS.some((e) => e[0] === n), n);
  assert.equal(JSON.stringify(cup.season.fixtures.map((f) => [f.id, f.result && f.result.hg, f.result && f.result.ag])), before, 'results untouched');
  assert.deepEqual(regs.map((c) => c.id), keep, 'same club records (ids) kept');
  const city = regs.find((c) => c.name === 'Manchester City');
  if (city) {
    const sq = Object.values(w.players).filter((p) => p.clubId === city.id);
    const avg = sq.reduce((t, p) => t + p.overall, 0) / sq.length;
    assert.ok(avg > 82, `squad rescaled to the new club strength (${avg})`);
  }
  assert.deepEqual(realizeContinentalClubs(w), [], 'idempotent');
});

test('cup season is labelled as the season after the one its qualifiers came from', () => {
  const { w, k } = worldWithKronliga();
  playSeason(w, k, P); // league season 2 finished before the upgrade runs
  runMigrations(w);
  const cup = Object.values(w.leagues).find((l) => isCup(l) && l.format !== 'knockout');
  const from = Object.values(cup.season.qualifiedFrom)[0];
  assert.equal(from, k.history[k.history.length - 1].label);
  assert.notEqual(cup.season.label, from);
  assert.equal(Number(cup.season.label.slice(0, 4)), Number(from.slice(0, 4)) + 1);
  // and an older cup with the wrong label gets fixed without touching results
  cup.config.startYear -= 1; cup.season.label = from;
  w.settings.ui.migrations['cup-season-label-v1'] = 0; delete w.settings.ui.migrations['cup-season-label-v1'];
  const fx = JSON.stringify(cup.season.fixtures);
  runMigrations(w);
  assert.equal(Number(cup.season.label.slice(0, 4)), Number(from.slice(0, 4)) + 1);
  assert.equal(JSON.stringify(cup.season.fixtures), fx);
});

test('2026/27 fresh start: both competitions restart with no history; clubs, players and line-ups kept', () => {
  const { w, k } = worldWithKronliga();
  w.settings.ui.migrations = { 'division-2-v1': 1, 'kronliga-20-daffers-v1': 1, 'europa-conference-v1': 1 }; // isolate the Champions League upgrades
  runMigrations(w); // adds the Champions League (fresh start is a no-op for a brand-new cup)
  const cup = Object.values(w.leagues).find((l) => isCup(l) && l.format !== 'knockout');
  // (the fresh start happened before the Daffers Cup existed on the user's device)
  for (const l of Object.values(w.leagues)) if (l.format === 'knockout') delete w.leagues[l.id];
  assert.equal(cup.season.number, 1);
  playSeason(w, cup, P);
  playSeason(w, k, P);
  startNextSeason(w, k);
  const someClub = Object.values(w.clubs).find((c) => !c.country);
  someClub.lineup = { manual: true, formation: '4-4-2', xi: [], bench: [] };
  const lastTop3 = k.history[k.history.length - 1].table.slice(0, 3).map((r) => r.clubId);
  const clubIds = Object.keys(w.clubs).sort(), playerIds = Object.keys(w.players).sort();
  const names = Object.values(w.clubs).map((c) => c.name).sort();
  // simulate an older device whose Champions League already existed when this update arrived
  delete w.settings.ui.migrations['fresh-start-2026-v1'];
  const msgs = runMigrations(w);
  assert.ok(msgs.some((m) => /Fresh start/.test(m)));
  assert.equal(k.season.label, '2026/27');
  assert.equal(k.history.length, 0);
  assert.ok(k.season.fixtures.every((f) => !f.result));
  assert.equal(cup.season.label, '2026/27');
  assert.equal(cup.history.length, 0);
  assert.ok(cup.season.fixtures.every((f) => !f.result));
  assert.deepEqual(cup.season.qualifiers, lastTop3);
  assert.equal(cup.season.clubIds.length, 32);
  assert.deepEqual(Object.keys(w.clubs).sort(), clubIds, 'no clubs removed');
  assert.deepEqual(Object.keys(w.players).sort(), playerIds, 'no players removed');
  assert.deepEqual(Object.values(w.clubs).map((c) => c.name).sort(), names);
  assert.ok(Object.values(w.clubs).every((c) => c.honours.length === 0), 'old honours cleared');
  assert.ok(Object.values(w.players).every((p) => p.career.apps === 0 && !(p.awards || []).length), 'old stats cleared');
  assert.equal(someClub.lineup.manual, true, 'line-ups kept');
  // runs once only
  playRound(w, k, P);
  assert.deepEqual(runMigrations(w), []);
  assert.ok(k.season.fixtures.some((f) => f.result));
  // next Champions League takes the top 3 of the restarted Kronliga 2026/27
  playSeason(w, k, P); playSeason(w, cup, P);
  assert.deepEqual(pendingQualifiers(w, cup), []);
  startNextSeason(w, cup);
  assert.equal(cup.season.label, '2027/28');
  assert.deepEqual(cup.season.qualifiers, k.history[0].table.slice(0, 3).map((r) => r.clubId));
});

test('Win game: chosen team wins (and wins knockout ties), counts down, then plays normally', async () => {
  const { setForcedWins, forcedWins, searchClubs } = await import('../js/league/cup.js');
  const { w, k } = worldWithKronliga();
  const { cup } = createContinentalCup(w, { qualifiers: [{ leagueId: k.id, spots: 3 }] });
  const weakest = cup.season.qualifiers.slice().sort((a, b) => w.clubs[a].ratings.overall - w.clubs[b].ratings.overall)[0];
  // search by partial names
  const clubs = cup.season.clubIds.map((id) => w.clubs[id]);
  assert.equal(searchClubs(clubs, 'man ci')[0].name, 'Manchester City');
  assert.equal(searchClubs(clubs, 'psg')[0].name, 'Paris Saint-Germain');
  assert.equal(searchClubs(clubs, 'real m')[0].name, 'Real Madrid');
  assert.equal(searchClubs(clubs, w.clubs[weakest].name.toLowerCase())[0].id, weakest);
  assert.equal(searchClubs(clubs, 'bay')[0].name, 'Bayern Munich');
  assert.ok(searchClubs(clubs, 'xyzq').length === 0);
  // win the next 2, then normal
  setForcedWins(cup, weakest, 2);
  const won = () => cup.season.fixtures.filter((f) => f.result && (f.home === weakest || f.away === weakest))
    .map((f) => (f.home === weakest ? f.result.hg > f.result.ag : f.result.ag > f.result.hg));
  playRound(w, cup, P); playRound(w, cup, P);
  assert.deepEqual(won(), [true, true]);
  assert.equal(forcedWins(cup)[weakest], undefined, 'used up');
  // win every match: goes through the whole competition and lifts the trophy
  setForcedWins(cup, weakest, -1);
  playSeason(w, cup, P);
  assert.ok(won().every(Boolean), 'won every match');
  assert.equal(cup.history[0].championId, weakest);
  const results = cup.season.fixtures.filter((f) => f.result && (f.home === weakest || f.away === weakest)).map((f) => f.result);
  assert.ok(new Set(results.map((r) => `${r.hg}-${r.ag}`)).size > 1, 'varied scorelines chosen by the game');
  for (const r of results) assert.equal(r.events.filter((e) => e.type === 'goal').length, r.hg + r.ag, 'events match the score');
});
