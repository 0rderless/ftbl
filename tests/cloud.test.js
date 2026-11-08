// Cloud sync: exact round-trips, chunking, and the "never lose data" reconciliation rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../js/core/cloud.js';
import { CloudStore, SyncManager, encode, decode, isEmptyWorld } from '../js/core/cloud.js';
import { Store } from '../js/core/store.js';
import { MemoryAdapter } from '../js/core/storage.js';
import { createClub, createLeague } from '../js/core/actions.js';
import { playRound } from '../js/league/season.js';
import { params } from './helpers.js';

// In-memory stand-in for Firebase RTDB with the same path semantics (update with null deletes).
export class FakeDB {
  constructor() { this.root = {}; this.writes = 0; }
  walk(path, create) {
    const parts = path.split('/').filter(Boolean);
    let node = this.root;
    for (const p of parts.slice(0, -1)) { if (node[p] == null) { if (!create) return [null]; node[p] = {}; } node = node[p]; }
    return [node, parts[parts.length - 1]];
  }
  async get(path) {
    const parts = path.split('/').filter(Boolean);
    let node = this.root;
    for (const p of parts) { if (node == null) return null; node = node[p]; }
    return node == null ? null : JSON.parse(JSON.stringify(node));
  }
  async update(path, obj) {
    this.writes++;
    for (const [k, v] of Object.entries(obj)) {
      const [parent, key] = this.walk(`${path}/${k}`, true);
      if (v === null) delete parent[key]; else parent[key] = JSON.parse(JSON.stringify(v));
    }
  }
  async remove(path) { const [parent, key] = this.walk(path, false); if (parent) delete parent[key]; }
}

const mem = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };

async function makeStore(withData) {
  const s = new Store(new MemoryAdapter(), { debounceMs: 1 });
  await s.init();
  if (withData) {
    s.update((w) => {
      const ids = ['North', 'South', 'East', 'West'].map((n) => createClub(w, { name: n + ' ' + withData }).id);
      const l = createLeague(w, { name: 'League ' + withData, clubIds: ids });
      playRound(w, l, params());
    });
    await s.flush();
  }
  return s;
}
const strip = (w) => { const c = JSON.parse(JSON.stringify(w)); delete c.savedAt; return c; };

test('gzip encoding round-trips exactly and compresses', async () => {
  const json = JSON.stringify({ a: 'x'.repeat(50000), b: [1, null, { c: [] }], d: '£€🏴' });
  const enc = await encode(json);
  assert.equal(enc.encoding, 'gzip-b64');
  assert.ok(enc.data.length < json.length / 5);
  assert.equal(await decode(enc.encoding, enc.data), json);
});

test('large worlds are chunked and restored exactly', async () => {
  const db = new FakeDB();
  const cs = new CloudStore(db);
  const s = await makeStore('Big');
  const json = JSON.stringify(s.world);
  // force many chunks by writing an incompressible-ish payload
  const noisy = JSON.stringify({ ...s.world, noise: Array.from({ length: 300000 }, (_, i) => ((i * 2654435761) % 4294967296).toString(36)).join('') });
  const meta = await cs.writeWorld(noisy, 123);
  assert.ok(meta.chunks > 1, 'split into chunks');
  assert.equal(JSON.stringify(await cs.readWorld()), noisy);
  await cs.writeWorld(json, 456);
  assert.equal(JSON.stringify(await cs.readWorld()), json);
});

test('first sync uploads existing device data (migration) and never downloads nothing over it', async () => {
  const db = new FakeDB();
  const s = await makeStore('Mine');
  const before = strip(s.world);
  const sync = new SyncManager(s, new CloudStore(db), { debounceMs: 1, memory: mem() });
  assert.equal(await sync.start(), 'pushed');
  assert.deepEqual(strip(s.world), before, 'local data untouched');
  assert.deepEqual(strip(await new CloudStore(db).readWorld()), before, 'cloud has the same data');
  assert.equal(sync.status, 'synced');
});

test('an empty device downloads the cloud copy instead of overwriting it', async () => {
  const db = new FakeDB();
  const a = await makeStore('Mine');
  await new SyncManager(a, new CloudStore(db), { memory: mem() }).start();
  const b = await makeStore(null);
  assert.ok(isEmptyWorld(b.world));
  const sync = new SyncManager(b, new CloudStore(db), { memory: mem() });
  assert.equal(await sync.start(), 'pulled');
  assert.deepEqual(strip(b.world), strip(a.world));
  assert.equal(b.world.savedAt, a.world.savedAt, 'keeps the original save time');
  // and an empty push attempt can't wipe the cloud
  const c = await makeStore(null);
  const syncC = new SyncManager(c, new CloudStore(db), { memory: mem() });
  syncC.ready = true;
  await syncC.push();
  assert.deepEqual(strip(await new CloudStore(db).readWorld()), strip(a.world));
});

test('newest copy wins; the older copy is kept as a backup on the device or in the cloud', async () => {
  const db = new FakeDB();
  const older = await makeStore('Old');
  await new Promise((r) => setTimeout(r, 5));
  const newer = await makeStore('New');
  // newer device syncs first, then an older device opens the app
  await new SyncManager(newer, new CloudStore(db), { memory: mem() }).start();
  const s = new SyncManager(older, new CloudStore(db), { memory: mem() });
  assert.equal(await s.start(), 'pulled');
  assert.deepEqual(strip(older.world), strip(newer.world));
  const local = await older.adapter.listBackups();
  assert.equal(local.length, 1, 'older device data was backed up locally');
  const restored = await older.adapter.loadBackup(local[0].key);
  assert.ok(Object.values(restored.clubs).some((c) => c.name.includes('Old')));

  // reverse: cloud holds an older copy from another device -> newer local uploads, cloud copy backed up
  const db2 = new FakeDB();
  const o2 = await makeStore('Old2');
  await new SyncManager(o2, new CloudStore(db2), { memory: mem() }).start();
  await new Promise((r) => setTimeout(r, 5));
  const n2 = await makeStore('New2');
  const s2 = new SyncManager(n2, new CloudStore(db2), { memory: mem() });
  assert.equal(await s2.start(), 'pushed');
  const cs2 = new CloudStore(db2);
  assert.deepEqual(strip(await cs2.readWorld()), strip(n2.world));
  const backups = await cs2.listBackups();
  assert.equal(backups.length, 1);
  const b = await cs2.readBackup(backups[0].key);
  assert.ok(Object.values(b.clubs).some((c) => c.name.includes('Old2')), 'replaced cloud copy kept as a cloud backup');
});

test('local changes are pushed automatically after saving; refresh pulls changes from another device', async () => {
  const db = new FakeDB();
  const a = await makeStore('A');
  const syncA = new SyncManager(a, new CloudStore(db), { debounceMs: 5, memory: mem() });
  await syncA.start();
  a.update((w) => { createClub(w, { name: 'Brand New FC' }, { withSquad: false }); });
  await a.flush();
  await new Promise((r) => setTimeout(r, 30));
  await syncA.pushing;
  assert.ok(Object.values((await new CloudStore(db).readWorld()).clubs).some((c) => c.name === 'Brand New FC'));
  // a second device gets it, edits, and the first device picks that up on refresh
  const b = await makeStore(null);
  const syncB = new SyncManager(b, new CloudStore(db), { debounceMs: 5, memory: mem() });
  await syncB.start();
  await new Promise((r) => setTimeout(r, 5));
  b.update((w) => { createClub(w, { name: 'From Device B' }, { withSquad: false }); });
  await b.flush();
  await new Promise((r) => setTimeout(r, 30));
  await syncB.pushing;
  assert.equal(await syncA.refresh(), 'pulled');
  assert.ok(Object.values(a.world.clubs).some((c) => c.name === 'From Device B'));
});

test('offline cloud keeps working locally', async () => {
  const s = await makeStore('Off');
  const dead = { get: () => new Promise(() => {}), update: () => new Promise(() => {}), remove: () => new Promise(() => {}) };
  const sync = new SyncManager(s, new CloudStore(dead), { timeoutMs: 20, memory: mem() });
  assert.equal(await sync.start(), 'offline');
  assert.equal(sync.status, 'offline');
  assert.ok(!isEmptyWorld(s.world));
  assert.ok(cloud.CHUNK > 100000);
});
