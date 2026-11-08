// Persistence adapters. The app stores the whole world as one JSON document.
// IndexedDB is primary (large quota, survives app restarts); localStorage is a fallback.

const DB_NAME = 'ftbl';
const STORE = 'kv';
const KEY = 'world';

export class MemoryAdapter {
  constructor() { this.data = null; this.name = 'memory'; }
  async load() { return this.data == null ? null : JSON.parse(this.data); }
  async save(json) { this.data = json; }
  async clear() { this.data = null; }
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
