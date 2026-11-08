// Central state container with debounced, crash-safe persistence.
import { defaultSimSettings, sanitizeSimSettings } from '../engine/params.js';
import { LEAGUE_DEFAULTS } from '../data/model.js';

export const SCHEMA_VERSION = 1;

export function emptyWorld() {
  return {
    version: SCHEMA_VERSION,
    settings: { sim: defaultSimSettings(), ui: { onboarded: false } },
    clubs: {},
    players: {},
    leagues: {},
    createdAt: Date.now(),
    savedAt: null,
  };
}

// Validate & migrate loaded data so older or partial saves never crash the app.
export function normalizeWorld(raw) {
  const w = emptyWorld();
  if (!raw || typeof raw !== 'object') return w;
  w.createdAt = raw.createdAt || w.createdAt;
  w.savedAt = raw.savedAt || null;
  w.settings.sim = sanitizeSimSettings(raw.settings && raw.settings.sim);
  w.settings.ui = { ...w.settings.ui, ...((raw.settings && raw.settings.ui) || {}) };
  w.clubs = raw.clubs && typeof raw.clubs === 'object' ? raw.clubs : {};
  w.players = raw.players && typeof raw.players === 'object' ? raw.players : {};
  w.leagues = raw.leagues && typeof raw.leagues === 'object' ? raw.leagues : {};
  for (const c of Object.values(w.clubs)) {
    c.honours = c.honours || [];
    c.tactics = c.tactics || { formation: '4-4-2', style: 'balanced' };
  }
  for (const p of Object.values(w.players)) {
    if (p.clubId && !w.clubs[p.clubId]) p.clubId = null;
    p.career = p.career || { apps: 0, goals: 0, assists: 0, seasons: 0 };
  }
  for (const l of Object.values(w.leagues)) {
    l.config = { ...LEAGUE_DEFAULTS, ...(l.config || {}) };
    l.history = l.history || [];
    l.clubIds = (l.clubIds || []).filter((id) => w.clubs[id]);
  }
  w.version = SCHEMA_VERSION;
  return w;
}

export class Store {
  constructor(adapter, { debounceMs = 350 } = {}) {
    this.adapter = adapter;
    this.debounceMs = debounceMs;
    this.world = emptyWorld();
    this.listeners = new Set();
    this.timer = null;
    this.saving = null;
    this.dirty = false;
    this.lastError = null;
  }
  async init() {
    let raw = null;
    try { raw = await this.adapter.load(); } catch (e) { this.lastError = e; }
    this.world = normalizeWorld(raw);
    this.loadedExisting = !!raw;
    return this.world;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(info) { for (const fn of this.listeners) fn(this.world, info); }

  /** Mutate the world. fn receives the world and may return a value. */
  update(fn, info = {}) {
    const out = fn(this.world);
    this.dirty = true;
    this.scheduleSave();
    this.emit(info);
    return out;
  }
  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush(); }, this.debounceMs);
  }
  async flush({ keepSavedAt = false, silent = false } = {}) {
    clearTimeout(this.timer);
    if (!this.dirty) return this.saving;
    this.dirty = false;
    if (!keepSavedAt || !this.world.savedAt) this.world.savedAt = Date.now();
    const json = JSON.stringify(this.world);
    const prev = this.saving || Promise.resolve();
    this.saving = prev.then(() => this.adapter.save(json)).then(() => {
      this.lastError = null;
      if (!silent && this.onSaved) this.onSaved();
    }).catch((e) => { this.lastError = e; this.dirty = true; this.emit({ saveError: e }); });
    return this.saving;
  }
  /**
   * Replace the whole world (import, restore, cloud download).
   * keepSavedAt: keep the incoming save time; silentSync: don't upload the change to the cloud.
   */
  async replace(world, { keepSavedAt = false, silentSync = false } = {}) {
    this.world = normalizeWorld(world);
    this.dirty = true;
    await this.flush({ keepSavedAt, silent: silentSync });
    this.emit({ replaced: true });
  }
  async reset() {
    await this.backupLocal('before-reset');
    this.world = emptyWorld();
    this.allowEmptyPush = true;
    this.dirty = true;
    await this.flush();
    this.emit({ replaced: true });
  }
  /** Keep a copy of the current world on this device (restorable from Data & app). */
  async backupLocal(reason = 'manual') {
    if (!this.adapter.saveBackup) return null;
    const w = this.world;
    if (!Object.keys(w.clubs).length && !Object.keys(w.leagues).length && !Object.keys(w.players).length) return null;
    try {
      return await this.adapter.saveBackup(JSON.stringify(w), {
        reason, savedAt: w.savedAt || null, clubs: Object.keys(w.clubs).length, leagues: Object.keys(w.leagues).length,
      });
    } catch (e) { this.lastError = e; return null; }
  }
}
