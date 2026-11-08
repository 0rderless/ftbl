// Bootstrap: open storage, load the world, start the UI, register the service worker.
import { Store } from './core/store.js';
import { pickAdapter } from './core/storage.js';
import { createApp } from './ui/app.js';
import { CloudStore, SyncManager, firebaseDb } from './core/cloud.js';
import { firebaseConfig, CLOUD_ROOT } from './core/firebaseConfig.js';
import { toast } from './ui/dom.js';
import { runMigrations, pendingMigrations } from './core/migrations.js';

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
    if (pendingMigrations(store.world).length) {
      const msgs = app.act((w) => runMigrations(w));
      if (msgs && msgs.length) setTimeout(() => toast(msgs.join(' · '), 'ok'), 1200);
    }
  });
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

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
