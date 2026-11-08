// Persistence: round-trips, debouncing, migration of partial data, settings survive restarts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, normalizeWorld, emptyWorld } from '../js/core/store.js';
import { MemoryAdapter } from '../js/core/storage.js';
import { createClub, createLeague, createPlayer } from '../js/core/actions.js';
import { setSimValue } from '../js/engine/params.js';
import { playSeason } from '../js/league/season.js';
import { params } from './helpers.js';

class CountingAdapter extends MemoryAdapter {
  constructor() { super(); this.saves = 0; }
  async save(json) { this.saves++; return super.save(json); }
}

test('world round-trips through storage exactly (clubs, players, leagues, results, settings)', async () => {
  const adapter = new MemoryAdapter();
  const s1 = new Store(adapter, { debounceMs: 5 });
  await s1.init();
  s1.update((w) => {
    const a = createClub(w, { name: 'Alpha FC', ratings: { overall: 80, att: 80, mid: 80, def: 80, gk: 80 } });
    const b = createClub(w, { name: 'Beta Town', ratings: { overall: 70, att: 70, mid: 70, def: 70, gk: 70 } });
    const c = createClub(w, { name: 'Gamma City', ratings: { overall: 75, att: 75, mid: 75, def: 75, gk: 75 } });
    createPlayer(w, { name: 'Solo Striker', clubId: a.id, position: 'ST', overall: 88 });
    const l = createLeague(w, { name: 'Test League', clubIds: [a.id, b.id, c.id] });
    playSeason(w, l, params());
    w.settings.sim = setSimValue(w.settings.sim, 'upsetFrequency', 77);
  });
  await s1.flush();
  const s2 = new Store(adapter);
  await s2.init();
  assert.ok(s2.loadedExisting);
  assert.deepEqual(JSON.parse(JSON.stringify(s2.world)), JSON.parse(JSON.stringify(s1.world)));
  assert.equal(s2.world.settings.sim.values.upsetFrequency, 77);
  assert.equal(s2.world.settings.sim.preset, 'custom');
  const l = Object.values(s2.world.leagues)[0];
  assert.ok(l.season.finished && l.history.length === 1);
});

test('rapid updates are debounced into a single save, and flush() forces it', async () => {
  const adapter = new CountingAdapter();
  const s = new Store(adapter, { debounceMs: 30 });
  await s.init();
  for (let i = 0; i < 10; i++) s.update((w) => { createClub(w, { name: 'Club ' + i }, { withSquad: false }); });
  await new Promise((r) => setTimeout(r, 80));
  await s.saving;
  assert.equal(adapter.saves, 1);
  s.update((w) => { createClub(w, { name: 'Late' }, { withSquad: false }); });
  await s.flush();
  assert.equal(adapter.saves, 2);
  const s2 = new Store(adapter); await s2.init();
  assert.equal(Object.keys(s2.world.clubs).length, 11);
});

test('failed saves are reported and retried', async () => {
  let fail = true;
  const adapter = new MemoryAdapter();
  const orig = adapter.save.bind(adapter);
  adapter.save = async (j) => { if (fail) throw new Error('disk full'); return orig(j); };
  const s = new Store(adapter, { debounceMs: 5 });
  await s.init();
  let reported = null;
  s.subscribe((w, info) => { if (info.saveError) reported = info.saveError; });
  s.update((w) => { createClub(w, { name: 'X' }, { withSquad: false }); });
  await s.flush(); await s.saving;
  assert.ok(reported && /disk full/.test(reported.message));
  assert.ok(s.dirty, 'still dirty after failure');
  fail = false;
  await s.flush();
  const s2 = new Store(adapter); await s2.init();
  assert.equal(Object.keys(s2.world.clubs).length, 1);
});

test('corrupt or partial saved data is normalised safely', () => {
  assert.deepEqual(Object.keys(normalizeWorld(null)), Object.keys(emptyWorld()));
  const w = normalizeWorld({ clubs: { c1: { id: 'c1', name: 'X', ratings: { overall: 70, att: 70, mid: 70, def: 70, gk: 70 } } }, players: { p1: { id: 'p1', clubId: 'gone', name: 'P' } }, leagues: { l1: { id: 'l1', clubIds: ['c1', 'gone'] } }, settings: { sim: { preset: 'balanced', values: { homeAdvantage: 'abc' } } } });
  assert.equal(w.players.p1.clubId, null);
  assert.deepEqual(w.leagues.l1.clubIds, ['c1']);
  assert.equal(w.leagues.l1.config.legs, 2);
  assert.equal(w.settings.sim.preset, 'balanced');
  assert.equal(typeof w.settings.sim.values.homeAdvantage, 'number');
  assert.deepEqual(w.clubs.c1.honours, []);
});
