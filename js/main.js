// Bootstrap: open storage, load the world, start the UI, register the service worker.
import { Store } from './core/store.js';
import { pickAdapter } from './core/storage.js';
import { createApp } from './ui/app.js';
import { CloudStore, SyncManager, firebaseDb, withTimeout } from './core/cloud.js';
import { firebaseConfig, CLOUD_ROOT } from './core/firebaseConfig.js';
import { toast } from './ui/dom.js';
import { APP_VERSION } from './version.js';
import { runMigrations, pendingMigrations, needsBackup } from './core/migrations.js';

const memory = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function connectCloud() {
  try {
    const fb = window.firebase;
    if (!fb || !fb.initializeApp) return null;
    if (!fb.apps.length) fb.initializeApp(firebaseConfig);
    return new CloudStore(firebaseDb(fb.database()), CLOUD_ROOT);
  } catch (e) {
    console.warn('Cloud unavailable', e);
    return null;
  }
}

async function boot() {
  const adapter = await pickAdapter();
  const store = new Store(adapter);
  await store.init();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const sync = new SyncManager(store, connectCloud(), { memory });
  const app = createApp(store, document.getElementById('app'), sync);
  app.render();
  document.documentElement.classList.add('ready');
  // cloud: upload this device's data the first time, or download a newer copy
  sync.start().then((r) => {
    if (r === 'pulled') toast('Loaded your latest data from the cloud', 'ok');
    if (r === 'pushed') toast('Your data is now saved to the cloud', 'ok');
    // one-time upgrades run on the newest copy of the data
    if (pendingMigrations(store.world).length) runUpgrades();
  });
  async function runUpgrades() {
    if (needsBackup(store.world)) {
      // keep a full copy (on the device and in the cloud) before any reset
      await store.backupLocal('before-upgrade');
      if (sync.cloud && sync.ready) {
        try { await withTimeout(sync.cloud.backupCurrent('before-upgrade'), 20000, 'Cloud backup'); } catch (e) { console.warn(e); }
      }
    }
    const msgs = app.act((w) => runMigrations(w));
    if (msgs && msgs.length) setTimeout(() => toast(msgs.join(' · '), 'ok'), 1200);
  }
  // never lose data: save locally and to the cloud whenever the app is hidden or closed
  const flush = () => { store.flush().then(() => { if (sync.ready) sync.push().catch(() => {}); }); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else sync.refresh().then((r) => { if (r === 'pulled') toast('Updated with changes from your other device', 'ok'); });
  });
  window.addEventListener('online', () => sync.refresh());
  window.addEventListener('pagehide', flush);
  window.ftbl = { store, app, sync };
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('app').innerHTML = `<div class="pad"><div class="card"><h3>ftbl could not start</h3><p>${String(e && e.message)}</p></div></div>`;
});

// ---- behave like a native app: no long-press menus, text selection or zooming ----
const isTextBox = (el) => el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]');
document.addEventListener('contextmenu', (e) => { if (!isTextBox(e.target)) e.preventDefault(); });
document.addEventListener('selectstart', (e) => { if (!isTextBox(e.target)) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (!isTextBox(e.target)) e.preventDefault(); });
// iOS ignores user-scalable=no, so block pinch-zoom gestures directly
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// double-tap zoom is off via CSS touch-action: manipulation (quick repeated taps still work)

// ---- updates: tell the user when a newer version has been published ----
async function publishedVersion() {
  try {
    const t = await (await fetch(`./sw.js?check=${Date.now()}`, { cache: 'no-store' })).text();
    const m = t.match(/const VERSION = '([^']+)'/);
    return m ? m[1] : null;
  } catch { return null; }
}
let updateShown = false;
async function checkForUpdate() {
  if (updateShown || !navigator.onLine) return;
  const v = await publishedVersion();
  if (!v || v === APP_VERSION) return;
  updateShown = true;
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.innerHTML = '<span>New version of ftbl ready</span><button class="btn primary sm">Update</button>';
  bar.querySelector('button').addEventListener('click', async () => {
    bar.querySelector('button').textContent = 'Updating…';
    try {
      const { store, sync } = window.ftbl || {};
      if (store) await store.flush();
      if (sync && sync.ready) await Promise.race([sync.push(), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update().catch(() => {});
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    } finally { location.reload(); }
  });
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('show'));
}
setTimeout(checkForUpdate, 4000);
setInterval(checkForUpdate, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
