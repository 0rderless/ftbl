import { esc, download, fmtNum } from '../dom.js';
import { ICONS, header, tabs, slider, segmented, syncBadge } from '../components.js';
import { SETTING_DEFS, PRESETS, PRESET_ORDER, applyPreset, setSimValue, resolveParams } from '../../engine/params.js';
import { simulateMatch } from '../../engine/match.js';
import { newClub } from '../../data/model.js';
import { generateSquad } from '../../data/generate.js';
import { buildDemoWorld } from '../../data/demo.js';
import { startSeason } from '../../league/season.js';

const ui = { lab: null, running: false };

export function render(app, tab = 'sim') {
  return `${header({ title: tab === 'data' ? 'Data & app' : 'Simulation settings' })}
    ${tabs([['sim', 'Simulation'], ['data', 'Data & app']], tab, '#/settings')}
    <div class="pad">${tab === 'data' ? dataTab(app) : simTab(app)}</div>`;
}

function simTab(app) {
  const sim = app.world.settings.sim;
  const v = sim.values;
  const desc = sim.preset === 'custom' ? 'Your own mix. Every slider below is saved as you change it.' : PRESETS[sim.preset].description;
  return `<div class="card">
      <h3 class="card-title">Preset</h3>
      ${segmented('preset', PRESET_ORDER.map((k) => [k, k === 'custom' ? 'Custom' : PRESETS[k].label]), sim.preset, 'preset')}
      <p class="hint">${esc(desc)}</p>
    </div>
    <div class="card settings-list">
      ${SETTING_DEFS.map((d) => d.type === 'select'
        ? `<div class="field select-setting"><div class="slider-head"><span>${esc(d.label)}</span></div>${segmented(d.key, d.options.map((o) => [o.value, o.label]), v[d.key], 'setSel')}<small>${esc(d.help)}</small></div>`
        : slider({ name: d.key, label: d.label, value: v[d.key], min: d.min, max: d.max, help: d.help })).join('')}
    </div>
    <div class="card lab">
      <h3 class="card-title">${ICONS.chart} Test these settings</h3>
      <p class="hint">Runs 2,400 matches with the current settings so you can see how they behave before simulating a season.</p>
      <button class="btn primary block" data-act="lab" ${ui.running ? 'disabled' : ''}>${ui.running ? 'Simulating…' : 'Run 2,400 test matches'}</button>
      <div class="lab-progress" ${ui.running ? '' : 'hidden'}><i></i></div>
      ${ui.lab ? labResults(ui.lab) : ''}
    </div>`;
}

function labResults(lab) {
  const pc = (x) => `${(x * 100).toFixed(1)}%`;
  return `<div class="lab-results">${lab.map((r) => `<div class="lab-row"><b>${esc(r.label)}</b>
    <div class="probbar small"><i class="h" style="width:${r.h * 100}%"></i><i class="d" style="width:${r.d * 100}%"></i><i class="a" style="width:${r.a * 100}%"></i></div>
    <small>Home ${pc(r.h)} · Draw ${pc(r.d)} · Away ${pc(r.a)} · ${r.goals.toFixed(2)} goals/match · 5+ goals ${pc(r.big)}${r.upset != null ? ` · upsets ${pc(r.upset)}` : ''}</small></div>`).join('')}</div>`;
}

function testTeam(r, tag) {
  const c = newClub({ id: 'lab-' + tag, name: 'Lab ' + tag, ratings: { overall: r, att: r, mid: r, def: r, gk: r } });
  return { club: c, players: generateSquad(c, [], { seed: 'lab' + tag + r }) };
}

async function runLab(app) {
  const params = resolveParams(app.world.settings.sim.values);
  const scen = [
    { label: 'Evenly matched (75 v 75)', h: 75, a: 75 },
    { label: 'Favourite at home (82 v 70)', h: 82, a: 70, strong: 'h' },
    { label: 'Underdog at home (70 v 82)', h: 70, a: 82, strong: 'a' },
  ];
  const N = 800;
  const out = [];
  let done = 0;
  const bar = () => { const el = document.querySelector('.lab-progress i'); if (el) el.style.width = `${(done / (N * scen.length)) * 100}%`; };
  for (const s of scen) {
    const H = testTeam(s.h, 'h'), A = testTeam(s.a, 'a');
    let hw = 0, d = 0, aw = 0, g = 0, big = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch({ home: H, away: A, params, seed: `lab-${s.h}-${s.a}-${i}-${Date.now() % 1000}` });
      g += r.hg + r.ag; if (r.hg + r.ag >= 5) big++;
      if (r.hg > r.ag) hw++; else if (r.hg < r.ag) aw++; else d++;
      done++;
      if (i % 100 === 99) { bar(); await new Promise((res) => setTimeout(res, 0)); }
    }
    out.push({ label: s.label, h: hw / N, d: d / N, a: aw / N, goals: g / N, big: big / N, upset: s.strong ? (s.strong === 'h' ? aw / N : hw / N) : null });
  }
  return out;
}

function dataTab(app) {
  const w = app.world;
  const st = app.store;
  const size = new Blob([JSON.stringify(w)]).size;
  const saved = w.savedAt ? new Date(w.savedAt).toLocaleString() : 'Not yet';
  const standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const sync = app.sync;
  const cloudOn = sync && sync.status !== 'off';
  return `<div class="card">
      <h3 class="card-title">Cloud save</h3>
      <div class="kv"><span>Status</span>${syncBadge(sync)}</div>
      <div class="kv"><span>Last synced</span><b>${sync && sync.lastSyncAt ? esc(new Date(sync.lastSyncAt).toLocaleString()) : '—'}</b></div>
      ${sync && sync.error ? `<p class="hint">${ICONS.info} ${esc(sync.error.message)}</p>` : ''}
      <p class="hint">${cloudOn ? 'Every change is saved on this device straight away and uploaded to your Firebase database a couple of seconds later. Opening ftbl on another device loads the newest copy.' : 'Cloud sync is unavailable right now (offline or blocked). Everything is still saved on this device and will upload when the connection is back.'}</p>
      <button class="btn" data-act="syncNow">${ICONS.refresh} Sync now</button>
    </div>
    <div class="card">
      <h3 class="card-title">Backups</h3>
      <p class="hint">Older copies are kept automatically whenever data is replaced (cloud download, import, restore or reset), so nothing is ever lost.</p>
      <div data-backups><p class="muted">Loading backups…</p></div>
      <button class="btn ghost sm" data-act="backupNow">${ICONS.copy} Back up now</button>
    </div>
    <div class="card">
      <h3 class="card-title">Storage</h3>
      <div class="kv"><span>Saved in</span><b>${esc(st.adapter.name)}</b></div>
      <div class="kv"><span>Last saved</span><b>${esc(saved)}</b></div>
      <div class="kv"><span>Data size</span><b>${fmtNum(Math.round(size / 1024))} KB</b></div>
      <div class="kv"><span>Clubs · players · leagues</span><b>${Object.keys(w.clubs).length} · ${fmtNum(Object.keys(w.players).length)} · ${Object.keys(w.leagues).length}</b></div>
      <p class="hint">Everything saves automatically on this device. Export a backup to keep a copy or move your world to another device.</p>
      <div class="row gap wrap"><button class="btn" data-act="export">${ICONS.download} Export backup</button>
      <label class="btn">${ICONS.upload} Import backup<input type="file" accept="application/json,.json" data-field="import" hidden></label></div>
    </div>
    <div class="card">
      <h3 class="card-title">Install on iPhone</h3>
      ${standalone ? '<p>✅ ftbl is running as an installed app.</p>' : '<p>In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. ftbl then opens full screen like an app and keeps working offline.</p>'}
    </div>
    <div class="card">
      <h3 class="card-title">Demo content</h3>
      <p class="hint">Adds 36 fictional clubs with squads and two linked divisions. Your existing data is kept.</p>
      <button class="btn" data-act="demo">${ICONS.trophy} Add demo world</button>
    </div>
    <div class="card danger-zone">
      <h3 class="card-title">Reset</h3>
      <p class="hint">Deletes every club, player, league and setting (a backup is kept first).</p>
      <button class="btn danger block" data-act="reset">${ICONS.trash} Delete all data</button>
    </div>
    <p class="hint center">ftbl v1.0</p>`;
}

function backupRow(b, where) {
  const when = new Date(Number(b.at || b.key)).toLocaleString();
  const reasons = { 'before-cloud-download': 'Before cloud download', 'before-reset': 'Before reset', 'before-import': 'Before import', 'before-restore': 'Before restore', 'replaced-by-newer-device': 'Replaced by newer device', replaced: 'Replaced by another device', manual: 'Manual backup' };
  return `<div class="backup-row"><div><b>${esc(when)}</b><small>${esc(reasons[b.reason] || b.reason || '')}${b.clubs != null ? ` · ${b.clubs} clubs · ${b.leagues} leagues` : ''} · ${Math.round((b.size || 0) / 1024)} KB · ${where}</small></div>
    <button class="btn sm" data-act="restore" data-where="${where}" data-key="${esc(b.key)}">Restore</button></div>`;
}

export async function mount(app, el, tab) {
  if (tab !== 'data') return;
  const box = el.querySelector('[data-backups]');
  if (!box) return;
  const rows = [];
  try { if (app.store.adapter.listBackups) for (const b of await app.store.adapter.listBackups()) rows.push(backupRow(b, 'device')); } catch { /* ignore */ }
  try {
    const cloud = app.sync && app.sync.cloud;
    if (cloud) for (const b of await Promise.race([cloud.listBackups(), new Promise((r) => setTimeout(() => r([]), 8000))])) rows.push(backupRow(b, 'cloud'));
  } catch { /* offline */ }
  if (box.isConnected) box.innerHTML = rows.join('') || '<p class="muted">No backups yet.</p>';
}

async function restoreWorld(app, world, label) {
  await app.store.backupLocal('before-restore');
  await app.store.replace(world);
  app.toast(`Restored ${label}`, 'ok');
  app.nav('#/');
}

export const actions = {
  async syncNow(app) {
    if (!app.sync || !app.sync.cloud) { app.toast('Cloud is not available right now', 'error'); return; }
    await app.store.flush();
    const r = await app.sync.refresh();
    if (r === 'same' && app.sync.status === 'synced') { try { await app.sync.push(); } catch { /* status shows it */ } }
    app.toast(app.sync.status === 'synced' ? 'Synced' : 'Could not reach the cloud — saved on this device', app.sync.status === 'synced' ? 'ok' : 'error');
    app.render();
  },
  async backupNow(app) {
    const k = await app.store.backupLocal('manual');
    app.toast(k ? 'Backup saved on this device' : 'Nothing to back up yet', k ? 'ok' : 'info');
    app.render();
  },
  async restore(app, el) {
    const { where, key } = el.dataset;
    if (!(await app.confirm('Your current data will be replaced by this backup. A copy of the current data is kept as a backup first.', { ok: 'Restore backup', title: 'Restore backup' }))) return;
    try {
      const world = where === 'cloud' ? await app.sync.cloud.readBackup(key) : await app.store.adapter.loadBackup(key);
      await restoreWorld(app, world, 'backup');
    } catch (e) { app.toast('Restore failed: ' + e.message, 'error'); }
  },
  preset(app, el) {
    app.act((w) => { w.settings.sim = applyPreset(w.settings.sim, el.dataset.value); });
    ui.lab = null;
  },
  setSel(app, el) {
    app.act((w) => { w.settings.sim = setSimValue(w.settings.sim, el.dataset.name, el.dataset.value); });
    ui.lab = null;
  },
  async lab(app) {
    if (ui.running) return;
    ui.running = true; ui.lab = null; app.render();
    try { ui.lab = await runLab(app); } finally { ui.running = false; }
    if (app.route.mod.render === render) app.render();
  },
  export(app) {
    const stamp = new Date().toISOString().slice(0, 10);
    download(`ftbl-backup-${stamp}.json`, JSON.stringify({ app: 'ftbl', exportedAt: Date.now(), world: app.world }));
    app.toast('Backup downloaded', 'ok');
  },
  demo(app) {
    const demo = buildDemoWorld('demo-' + Date.now());
    const names = new Set(Object.values(app.world.clubs).map((c) => c.name.toLowerCase()));
    let added = 0;
    app.act((w) => {
      for (const c of Object.values(demo.clubs)) {
        if (names.has(c.name.toLowerCase())) c.name += ' II';
        w.clubs[c.id] = c; added++;
      }
      Object.assign(w.players, demo.players);
      for (const l of Object.values(demo.leagues)) {
        if (Object.values(w.leagues).some((x) => x.name === l.name)) l.name += ' (Demo)';
        startSeason(l, 1); w.leagues[l.id] = l;
      }
    });
    app.toast(`Added ${added} demo clubs`, 'ok');
  },
  async reset(app) {
    if (!(await app.confirm('This deletes every club, player and league on this device and in the cloud. A backup copy is kept and can be restored from Backups.', { ok: 'Delete everything', danger: true }))) return;
    await app.store.reset();
    app.toast('All data deleted', 'ok');
    app.nav('#/');
  },
};

export function onInput(app, el) {
  const key = el.dataset.field;
  if (!key || el.type !== 'range') return;
  // live label update without re-render (keeps the slider under the finger)
  const out = document.querySelector(`[data-out="${key}"]`); if (out) out.textContent = el.value;
  el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
}

export function onChange(app, el) {
  const key = el.dataset.field;
  if (key === 'import') { importFile(app, el); return; }
  if (SETTING_DEFS.some((d) => d.key === key)) {
    app.act((w) => { w.settings.sim = setSimValue(w.settings.sim, key, Number(el.value)); });
    ui.lab = null;
  }
}

async function importFile(app, el) {
  const file = el.files && el.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const world = data && data.world ? data.world : data;
    if (!world || typeof world !== 'object' || !world.clubs || !world.leagues) throw new Error('This file is not an ftbl backup');
    if (!(await app.confirm(`Replace everything on this device with the backup (${Object.keys(world.clubs).length} clubs, ${Object.keys(world.leagues).length} leagues)?`, { ok: 'Import', danger: true }))) return;
    await app.store.backupLocal('before-import');
    await app.store.replace(world);
    app.toast('Backup imported', 'ok');
    app.nav('#/');
  } catch (e) {
    app.toast('Import failed: ' + e.message, 'error');
  }
}
