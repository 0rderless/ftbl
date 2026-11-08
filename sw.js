// Offline support: network-first for app files (so updates arrive), cache fallback when offline.
const VERSION = 'ftbl-1b6e7299ee';
const ASSETS = [
  './',
  './css/app.css',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './js/core/actions.js',
  './js/core/cloud.js',
  './js/core/firebaseConfig.js',
  './js/core/migrations.js',
  './js/core/rng.js',
  './js/core/storage.js',
  './js/core/store.js',
  './js/data/continental.js',
  './js/data/demo.js',
  './js/data/generate.js',
  './js/data/model.js',
  './js/data/nations.js',
  './js/engine/match.js',
  './js/engine/params.js',
  './js/engine/poisson.js',
  './js/engine/strength.js',
  './js/engine/tactics.js',
  './js/league/cup.js',
  './js/league/fixtures.js',
  './js/league/records.js',
  './js/league/season.js',
  './js/league/table.js',
  './js/main.js',
  './js/ui/app.js',
  './js/ui/badge.js',
  './js/ui/badgeDesigner.js',
  './js/ui/components.js',
  './js/ui/dom.js',
  './js/ui/kit.js',
  './js/ui/simActions.js',
  './js/ui/views/club.js',
  './js/ui/views/clubEdit.js',
  './js/ui/views/clubs.js',
  './js/ui/views/cup.js',
  './js/ui/views/home.js',
  './js/ui/views/league.js',
  './js/ui/views/leagueEdit.js',
  './js/ui/views/leagues.js',
  './js/ui/views/match.js',
  './js/ui/views/player.js',
  './js/ui/views/playerEdit.js',
  './js/ui/views/players.js',
  './js/ui/views/records.js',
  './js/ui/views/settings.js',
  './js/ui/winGame.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== VERSION + '-fonts').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      Promise.race([fetch(req), timeout(4000)]).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./')))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(url.host) || url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(VERSION + '-fonts').then((c) => c.put(req, copy)); return res;
    })));
  }
});
