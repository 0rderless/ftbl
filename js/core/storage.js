// Persistence adapters. The app stores the whole world as one JSON document.
// IndexedDB is primary (large quota, survives app restarts); localStorage is a fallback.

const DB_NAME = 'ftbl';
const STORE = 'kv';
const KEY = 'world';

const KEEP_LOCAL_BACKUPS = 6;

export class MemoryAdapter {
  constructor() { this.data = null; this.name = 'memory'; this.kv = new Map(); }
  async load() { return this.data == null ? null : JSON.parse(this.data); }
  async save(json) { this.data = json; }
  async clear() { this.data = null; }
  async getRaw(k) { return this.kv.has(k) ? this.kv.get(k) : null; }
  async putRaw(k, v) { if (v == null) this.kv.delete(k); else this.kv.set(k, v); }
}

// Shared backup helpers for adapters that implement getRaw/putRaw.
async function saveBackup(adapter, json, info) {
  const at = Date.now();
  const key = 'backup:' + at;
  await adapter.putRaw(key, json);
  const index = JSON.parse((await adapter.getRaw('backups')) || '[]');
  index.unshift({ key, at, size: json.length, ...info });
  for (const old of index.slice(KEEP_LOCAL_BACKUPS)) await adapter.putRaw(old.key, null);
  await adapter.putRaw('backups', JSON.stringify(index.slice(0, KEEP_LOCAL_BACKUPS)));
  return key;
}
async function listBackups(adapter) { return JSON.parse((await adapter.getRaw('backups')) || '[]'); }
async function loadBackup(adapter, key) {
  const s = await adapter.getRaw(key);
  if (!s) throw new Error('Backup not found');
  return JSON.parse(s);
}
for (const fn of [saveBackup, listBackups, loadBackup]) {
  MemoryAdapter.prototype[fn.name] = function (...a) { return fn(this, ...a); };
}

export class LocalStorageAdapter {
  constructor(key = 'ftbl:world') { this.key = key; this.name = 'localStorage'; }
  async load() {
    const s = globalThis.localStorage.getItem(this.key);
    return s ? JSON.parse(s) : null;
  }
  async save(json) { globalThis.localStorage.setItem(this.key, json); }
  async clear() { globalThis.localStorage.removeItem(this.key); }
}

export class IndexedDBAdapter {
  constructor() { this.name = 'IndexedDB'; this.dbp = null; }
  open() {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        db.onclose = () => { this.dbp = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return this.dbp;
  }
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const st = t.objectStore(STORE);
      let out;
      const r = fn(st);
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    });
  }
  async load() {
    const s = await this.tx('readonly', (st) => st.get(KEY));
    return s ? JSON.parse(s) : null;
  }
  async save(json) { await this.tx('readwrite', (st) => st.put(json, KEY)); }
  async clear() { await this.tx('readwrite', (st) => st.delete(KEY)); }
  async getRaw(k) { const v = await this.tx('readonly', (st) => st.get(k)); return v == null ? null : v; }
  async putRaw(k, v) { await this.tx('readwrite', (st) => (v == null ? st.delete(k) : st.put(v, k))); }
  saveBackup(json, info) { return saveBackup(this, json, info); }
  listBackups() { return listBackups(this); }
  loadBackup(key) { return loadBackup(this, key); }
}

export async function pickAdapter() {
  if (typeof indexedDB !== 'undefined') {
    try {
      const a = new IndexedDBAdapter();
      await a.open();
      return a;
    } catch (e) { /* fall through */ }
  }
  if (typeof localStorage !== 'undefined') return new LocalStorageAdapter();
  return new MemoryAdapter();
}
