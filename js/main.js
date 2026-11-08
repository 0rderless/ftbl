// Bootstrap: open storage, load the world, start the UI, register the service worker.
import { Store } from './core/store.js';
import { pickAdapter } from './core/storage.js';
import { createApp } from './ui/app.js';

async function boot() {
  const adapter = await pickAdapter();
  const store = new Store(adapter);
  await store.init();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const app = createApp(store, document.getElementById('app'));
  app.render();
  document.documentElement.classList.add('ready');
  // never lose data: flush pending saves whenever the app is hidden or closed
  const flush = () => { store.flush(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  window.ftbl = { store, app };
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('app').innerHTML = `<div class="pad"><div class="card"><h3>ftbl could not start</h3><p>${String(e && e.message)}</p></div></div>`;
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
