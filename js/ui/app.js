// Application shell: routing, rendering, delegated events and the bottom tab bar.
import { resolveParams } from '../engine/params.js';
import { ActionError } from '../core/actions.js';
import { toast, confirmDialog, esc } from './dom.js';
import { ICONS, syncBadge } from './components.js';

import * as home from './views/home.js';
import * as leagues from './views/leagues.js';
import * as league from './views/league.js';
import * as leagueEdit from './views/leagueEdit.js';
import * as match from './views/match.js';
import * as clubs from './views/clubs.js';
import * as club from './views/club.js';
import * as clubEdit from './views/clubEdit.js';
import * as players from './views/players.js';
import * as player from './views/player.js';
import * as playerEdit from './views/playerEdit.js';
import * as settings from './views/settings.js';
import * as records from './views/records.js';

const ROUTES = [
  [/^$/, home, 'home'],
  [/^leagues$/, leagues, 'leagues'],
  [/^leagues\/new$/, leagueEdit, 'leagues'],
  [/^league\/([^/]+)\/edit$/, leagueEdit, 'leagues'],
  [/^league\/([^/]+)(?:\/([a-z]+))?$/, league, 'leagues'],
  [/^match\/([^/]+)\/([^/]+)$/, match, 'leagues'],
  [/^clubs$/, clubs, 'clubs'],
  [/^clubs\/new$/, clubEdit, 'clubs'],
  [/^club\/([^/]+)\/edit$/, clubEdit, 'clubs'],
  [/^club\/([^/]+)(?:\/([a-z]+))?$/, club, 'clubs'],
  [/^players$/, players, 'players'],
  [/^players\/new$/, playerEdit, 'players'],
  [/^player\/([^/]+)\/edit$/, playerEdit, 'players'],
  [/^player\/([^/]+)$/, player, 'players'],
  [/^settings(?:\/([a-z]+))?$/, settings, 'settings'],
  [/^records$/, records, 'home'],
];

const TABS = [
  ['home', '#/', 'Home', ICONS.home],
  ['leagues', '#/leagues', 'Leagues', ICONS.trophy],
  ['clubs', '#/clubs', 'Clubs', ICONS.shield],
  ['players', '#/players', 'Players', ICONS.user],
  ['settings', '#/settings', 'Sim', ICONS.sliders],
];

export function createApp(store, root, sync = null) {
  const app = {
    store,
    sync,
    get world() { return store.world; },
    params() { return resolveParams(store.world.settings.sim.values); },
    route: null,
    view: null,
    toast,
    confirm: confirmDialog,
    /** Navigate. replace: swap the current history entry (used for tabs and after saving forms). */
    nav(hash, { replace = false } = {}) {
      if (location.hash === hash) { app.render(); return; }
      if (replace) { app.replacing = true; location.replace(location.pathname + location.search + hash); } else location.hash = hash;
    },
    // our own record of where the user has been, so Back returns to the previous screen
    stack: [location.hash || '#/'],
    back(fallback = '#/') {
      if (app.stack.length > 1) history.back();
      else { app.stack = [fallback]; app.replacing = true; location.replace(location.pathname + location.search + fallback); }
    },
    /** run a world mutation; ActionErrors become toasts. Returns result or undefined. */
    act(fn, msg) {
      try {
        const out = store.update(fn);
        if (msg) toast(msg, 'ok');
        return out;
      } catch (e) {
        if (e instanceof ActionError || (e && e.message)) toast(e.message, 'error');
        if (!(e instanceof ActionError)) console.error(e);
        return undefined;
      }
    },
    holdRender: 0,
  };

  root.innerHTML = `<main id="view" class="view"></main>
    <nav class="tabbar" id="tabbar">${TABS.map(([k, href, label, icon]) => `<a href="${href}" data-tab="${k}" class="tabbar-item">${icon}<span>${label}</span></a>`).join('')}</nav>`;
  const viewEl = root.querySelector('#view');

  function match(hash) {
    const [rawPath, qs = ''] = hash.replace(/^#\/?/, '').split('?');
    const path = rawPath.replace(/\/$/, '');
    const query = Object.fromEntries(new URLSearchParams(qs));
    for (const [re, mod, tab] of ROUTES) {
      const m = path.match(re);
      if (m) return { mod, tab, params: m.slice(1), path: path + (qs ? '?' + qs : ''), query };
    }
    return { mod: home, tab: 'home', params: [], path, query };
  }

  app.render = (opts = {}) => {
    const r = match(location.hash);
    const changed = !app.route || app.route.path !== r.path;
    if (changed && app.view && app.view.leave) app.view.leave(app);
    app.route = r; app.view = r.mod;
    const scroll = changed ? 0 : window.scrollY;
    let html;
    try {
      html = r.mod.render(app, ...r.params);
    } catch (e) {
      console.error(e);
      html = `<div class="pad"><div class="card"><h3>Something went wrong</h3><p class="muted">${esc(e.message)}</p><a class="btn" href="#/">Go home</a></div></div>`;
    }
    viewEl.innerHTML = html;
    if (changed && !opts.silent) {
      viewEl.classList.remove('view-enter');
      void viewEl.offsetWidth; // restart animation
      viewEl.classList.add('view-enter');
    }
    if (r.mod.mount) r.mod.mount(app, viewEl, ...r.params);
    root.querySelectorAll('.tabbar-item').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
    window.scrollTo(0, scroll);
  };

  // delegated events
  viewEl.addEventListener('click', (e) => {
    const backEl = e.target.closest('[data-back]');
    if (backEl) { e.preventDefault(); app.back(backEl.dataset.back); return; }
    const tabEl = e.target.closest('a.tab');
    if (tabEl) { e.preventDefault(); app.nav(tabEl.getAttribute('href'), { replace: true }); return; }
    const el = e.target.closest('[data-act]');
    if (!el || !viewEl.contains(el)) return;
    const fn = app.view && app.view.actions && app.view.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(app, el, e); }
  });
  viewEl.addEventListener('input', (e) => {
    if (app.view && app.view.onInput) app.view.onInput(app, e.target, e);
  });
  viewEl.addEventListener('change', (e) => {
    if (app.view && app.view.onChange) app.view.onChange(app, e.target, e);
  });

  store.subscribe((world, info) => {
    if (info && info.saveError) toast('Could not save: ' + info.saveError.message, 'error');
    if (app.holdRender) return;
    app.render({ silent: true });
  });

  window.addEventListener('hashchange', () => {
    const h = location.hash || '#/';
    const st = app.stack;
    if (app.replacing) st[st.length - 1] = h;
    else if (st.length > 1 && st[st.length - 2] === h) st.pop();
    else st.push(h);
    if (st.length > 60) st.splice(0, st.length - 60);
    app.replacing = false;
    app.render();
  });
  if (sync) sync.onChange(() => {
    document.querySelectorAll('[data-sync-status]').forEach((el) => { el.outerHTML = syncBadge(sync); });
  });
  return app;
}
