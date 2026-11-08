// Cloud sync with Firebase Realtime Database.
//
// The whole world is stored under `ftbl/` as gzip-compressed, base64 text split into
// chunks (RTDB drops nulls/empty arrays and limits key characters, so storing an
// encoded string keeps the data exactly as the app saved it).
//
//   ftbl/meta         { savedAt, encoding, chunks, size, version }
//   ftbl/chunks/0..n  encoded data
//   ftbl/backups/<t>  { meta, chunks }   previous cloud versions (last few kept)
//   ftbl/backupIndex/<t> { savedAt, size, reason }
//
// Safety rules — data is never thrown away:
//   * an empty device never overwrites cloud data (it downloads instead)
//   * whichever copy was saved most recently wins
//   * the losing copy is kept as a backup (on the device or in the cloud) and can be restored
//
// The DB is accessed through a tiny interface so it can be tested without Firebase:
//   { get(path) -> Promise<value|null>, update(path, object) -> Promise, remove(path) -> Promise }

export const CHUNK = 1_500_000;
const KEEP_CLOUD_BACKUPS = 4;

export function firebaseDb(db) {
  return {
    get: (p) => db.ref(p).get().then((s) => (s.exists() ? s.val() : null)),
    update: (p, v) => db.ref(p).update(v),
    remove: (p) => db.ref(p).remove(),
  };
}

export function withTimeout(promise, ms, what = 'request') {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out`)), ms); })])
    .finally(() => clearTimeout(t));
}

// ---------- encoding ----------
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export async function encode(json) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return { encoding: 'gzip-b64', data: toB64(buf) };
    } catch { /* fall back */ }
  }
  return { encoding: 'json', data: json };
}
export async function decode(encoding, data) {
  if (encoding === 'json') return data;
  if (encoding === 'gzip-b64') {
    const stream = new Blob([fromB64(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  throw new Error('Unknown cloud encoding ' + encoding);
}
function split(str) {
  const out = [];
  for (let i = 0; i < str.length; i += CHUNK) out.push(str.slice(i, i + CHUNK));
  return out.length ? out : [''];
}

export function isEmptyWorld(w) {
  return !w || (!Object.keys(w.clubs || {}).length && !Object.keys(w.leagues || {}).length && !Object.keys(w.players || {}).length);
}

export class CloudStore {
  constructor(db, root = 'ftbl') { this.db = db; this.root = root; }
  p(sub) { return `${this.root}/${sub}`; }
  readMeta() { return this.db.get(this.p('meta')); }
  async readWorld(meta) {
    const m = meta || await this.readMeta();
    if (!m) return null;
    const chunks = await this.db.get(this.p('chunks'));
    const list = Array.isArray(chunks) ? chunks : Object.keys(chunks || {}).sort((a, b) => a - b).map((k) => chunks[k]);
    if (list.length !== m.chunks) throw new Error('Cloud data incomplete');
    return JSON.parse(await decode(m.encoding, list.join('')));
  }
  async writeWorld(json, savedAt) {
    const { encoding, data } = await encode(json);
    const chunks = split(data);
    const meta = { savedAt, encoding, chunks: chunks.length, size: json.length, version: 1, writtenAt: Date.now() };
    // one atomic multi-path update: chunks and meta change together
    await this.db.update(this.root, { chunks, meta });
    return meta;
  }
  /** Copy the current cloud version into backups before it is overwritten. */
  async backupCurrent(reason = 'replaced') {
    const meta = await this.readMeta();
    if (!meta) return null;
    const chunks = await this.db.get(this.p('chunks'));
    const key = String(meta.savedAt || Date.now());
    await this.db.update(this.root, {
      [`backups/${key}`]: { meta, chunks },
      [`backupIndex/${key}`]: { savedAt: meta.savedAt || null, size: meta.size || 0, reason, at: Date.now() },
    });
    const index = (await this.db.get(this.p('backupIndex'))) || {};
    const keys = Object.keys(index).sort((a, b) => Number(b) - Number(a));
    for (const k of keys.slice(KEEP_CLOUD_BACKUPS)) {
      await this.db.update(this.root, { [`backups/${k}`]: null, [`backupIndex/${k}`]: null });
    }
    return key;
  }
  async listBackups() {
    const index = (await this.db.get(this.p('backupIndex'))) || {};
    return Object.entries(index).map(([key, v]) => ({ key, ...v })).sort((a, b) => Number(b.key) - Number(a.key));
  }
  async readBackup(key) {
    const b = await this.db.get(this.p(`backups/${key}`));
    if (!b) throw new Error('Backup not found');
    const list = Array.isArray(b.chunks) ? b.chunks : Object.keys(b.chunks || {}).sort((x, y) => x - y).map((k) => b.chunks[k]);
    return JSON.parse(await decode(b.meta.encoding, list.join('')));
  }
}

/**
 * Keeps the local store and the cloud copy in step.
 * status: 'off' | 'connecting' | 'synced' | 'saving' | 'offline' | 'error'
 */
export class SyncManager {
  constructor(store, cloud, { debounceMs = 2500, timeoutMs = 15000, memory = null } = {}) {
    this.store = store;
    this.cloud = cloud;
    this.debounceMs = debounceMs;
    this.timeoutMs = timeoutMs;
    this.status = cloud ? 'connecting' : 'off';
    this.error = null;
    this.lastSyncAt = null;
    // remembers which cloud version this device last saw (to detect other devices' writes)
    this.memory = memory || { get: () => null, set: () => {} };
    this.listeners = new Set();
    this.timer = null;
    this.pushing = null;
    this.ready = false;
    store.onSaved = () => this.schedulePush();
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  set(status, error = null) { this.status = status; this.error = error; for (const fn of this.listeners) fn(this); }
  get knownRemote() { return Number(this.memory.get('ftbl:lastRemoteSavedAt')) || 0; }
  set knownRemote(v) { this.memory.set('ftbl:lastRemoteSavedAt', String(v || 0)); }

  /** Reconcile local and cloud copies. Returns 'pulled' | 'pushed' | 'same' | 'empty' | 'offline'. */
  async start() {
    if (!this.cloud) return 'off';
    this.set('connecting');
    let meta;
    try { meta = await withTimeout(this.cloud.readMeta(), this.timeoutMs, 'Cloud'); } catch (e) { this.set('offline', e); return 'offline'; }
    const local = this.store.world;
    const localAt = local.savedAt || 0;
    try {
      if (!meta) {
        if (isEmptyWorld(local)) { this.ready = true; this.set('synced'); return 'empty'; }
        await this.push(true);
        return 'pushed';
      }
      if (isEmptyWorld(local) || meta.savedAt > localAt) {
        const remote = await withTimeout(this.cloud.readWorld(meta), this.timeoutMs * 4, 'Cloud download');
        if (!isEmptyWorld(local)) await this.store.backupLocal('before-cloud-download');
        await this.store.replace(remote, { keepSavedAt: true, silentSync: true });
        this.knownRemote = meta.savedAt;
        this.ready = true;
        this.lastSyncAt = Date.now();
        this.set('synced');
        return 'pulled';
      }
      if (meta.savedAt < localAt) { await this.push(true); return 'pushed'; }
      this.knownRemote = meta.savedAt;
      this.ready = true; this.lastSyncAt = Date.now(); this.set('synced');
      return 'same';
    } catch (e) {
      this.set('error', e);
      return 'offline';
    }
  }

  schedulePush() {
    if (!this.cloud || !this.ready) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.push().catch(() => {}); }, this.debounceMs);
  }

  async push(initial = false) {
    if (!this.cloud) return;
    clearTimeout(this.timer);
    const run = async () => {
      const world = this.store.world;
      if (isEmptyWorld(world) && !this.store.allowEmptyPush) {
        // never let an empty device wipe the cloud copy
        const meta = await withTimeout(this.cloud.readMeta(), this.timeoutMs, 'Cloud');
        if (meta) { this.ready = true; this.set('synced'); return; }
      }
      this.set('saving');
      const meta = await withTimeout(this.cloud.readMeta(), this.timeoutMs, 'Cloud');
      // keep the cloud copy as a backup if it changed on another device since we last saw it,
      // or if this upload deliberately empties the world (reset)
      const wiping = isEmptyWorld(world);
      if (meta && (wiping || (meta.savedAt !== this.knownRemote && meta.savedAt !== world.savedAt))) {
        await withTimeout(this.cloud.backupCurrent(wiping ? 'before-reset' : initial ? 'replaced-by-newer-device' : 'replaced'), this.timeoutMs * 4, 'Cloud backup');
      }
      const savedAt = world.savedAt || Date.now();
      const written = await withTimeout(this.cloud.writeWorld(JSON.stringify(world), savedAt), this.timeoutMs * 4, 'Cloud upload');
      this.knownRemote = written.savedAt;
      this.store.allowEmptyPush = false;
      this.ready = true;
      this.lastSyncAt = Date.now();
      this.set('synced');
    };
    const prev = this.pushing || Promise.resolve();
    this.pushing = prev.catch(() => {}).then(run).catch((e) => {
      this.set(/timed out|offline|network/i.test(e.message) ? 'offline' : 'error', e);
      this.ready = true;
      throw e;
    });
    return this.pushing;
  }

  /** Pull if another device saved something newer (e.g. when the app comes back to the foreground). */
  async refresh() {
    if (!this.cloud) return 'off';
    if (!this.ready) return this.start();
    try {
      const meta = await withTimeout(this.cloud.readMeta(), this.timeoutMs, 'Cloud');
      if (meta && meta.savedAt > (this.store.world.savedAt || 0) && meta.savedAt !== this.knownRemote) {
        if (this.store.dirty) await this.store.flush();
        const remote = await withTimeout(this.cloud.readWorld(meta), this.timeoutMs * 4, 'Cloud download');
        await this.store.backupLocal('before-cloud-download');
        await this.store.replace(remote, { keepSavedAt: true, silentSync: true });
        this.knownRemote = meta.savedAt;
        this.lastSyncAt = Date.now();
        this.set('synced');
        return 'pulled';
      }
      if (this.status === 'offline' || this.status === 'error') {
        if ((this.store.world.savedAt || 0) > (meta ? meta.savedAt : 0)) { await this.push(); return 'pushed'; }
        this.set('synced');
      }
      return 'same';
    } catch (e) {
      this.set('offline', e);
      return 'offline';
    }
  }
}
