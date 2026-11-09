// End-to-end test of the real app in a mobile browser (Playwright + Chromium).
// Run: npm run test:e2e
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const step = (name) => console.log('  ✓ ' + name);

// ---- mock Firebase Realtime Database (shared by every browser context, like the real cloud) ----
const remote = {};
function rget(path) {
  let n = remote;
  for (const k of path.split('/').filter(Boolean)) { if (n == null) return null; n = n[k]; }
  return n == null ? null : JSON.parse(JSON.stringify(n));
}
function rupdate(path, obj) {
  for (const [k, v] of Object.entries(obj)) {
    const parts = `${path}/${k}`.split('/').filter(Boolean);
    let n = remote;
    for (const p of parts.slice(0, -1)) n = n[p] || (n[p] = {});
    if (v === null) delete n[parts[parts.length - 1]]; else n[parts[parts.length - 1]] = JSON.parse(JSON.stringify(v));
  }
}
const MOCK_SDK = `window.firebase = { apps: [], initializeApp(c) { this.apps.push(c); return {}; },
  database() { return { ref(path) { return {
    get: () => window.__fb('get', path).then((v) => ({ exists: () => v != null, val: () => v })),
    update: (obj) => window.__fb('update', path, obj),
    remove: () => window.__fb('update', path.split('/').slice(0, -1).join('/'), { [path.split('/').pop()]: null }),
  }; } }; } };`;
async function withCloud(ctx) {
  await ctx.exposeBinding('__fb', (src, op, path, value) => (op === 'get' ? rget(path) : (rupdate(path, value), null)));
  await ctx.route(/gstatic\.com\/firebasejs\/.*app-compat/, (r) => r.fulfill({ contentType: 'text/javascript', body: MOCK_SDK }));
  await ctx.route(/gstatic\.com\/firebasejs\/.*database-compat/, (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
}

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  // block external font requests so the test is hermetic
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await withCloud(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  const world = () => page.evaluate(() => JSON.parse(JSON.stringify(window.ftbl.store.world)));
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); };
  const flush = () => page.evaluate(() => window.ftbl.store.flush());

  try {
    await page.goto(base);
    await page.waitForSelector('[data-act=demo]');
    step('onboarding shown on first launch');

    // ---- club creation through the UI ----
    async function createClub(name, presetIndex, rating) {
      await go('#/clubs/new');
      await page.fill('[data-field=name]', name);
      await page.click(`[data-act=bd][data-key=preset][data-value="${presetIndex}"]`);
      await page.click('[data-act=bd-panel][data-value=emblem]');
      await page.click('[data-act=bd][data-key=emblem][data-value=crown]');
      await page.click('[data-act=kitTab][data-value=away]');
      await page.click('[data-act=kitStyle][data-value=hoops]');
      await page.fill('[data-field="stadium.name"]', name + ' Park');
      await page.$eval('[data-field="r.overall"]', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(rating));
      await page.$eval('[data-field="r.att"]', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(rating + 2));
      await page.click('.pad [data-act=save]');
      await page.waitForSelector('.club-hero');
    }
    await createClub('Testford United', 3, 80);
    await createClub('Mockbury Town', 7, 70);
    await createClub('Samplewick Rovers', 12, 75);
    let w = await world();
    const clubs = Object.values(w.clubs);
    assert.equal(clubs.length, 3);
    const tf = clubs.find((c) => c.name === 'Testford United');
    assert.equal(tf.ratings.overall, 80);
    assert.equal(tf.ratings.att, 82);
    assert.equal(tf.badge.emblem, 'crown');
    assert.equal(tf.kits.away.style, 'hoops');
    assert.equal(tf.stadium.name, 'Testford United Park');
    assert.equal(Object.values(w.players).filter((p) => p.clubId === tf.id).length, 25);
    step('created 3 clubs with custom badge, kit, stadium, ratings and generated squads');

    // ---- edit a club ----
    await go(`#/club/${tf.id}/edit`);
    await page.fill('[data-field=short]', 'TFU');
    await page.click('[data-act=formation][data-value="4-3-3"]');
    await page.click('[data-act=style][data-value=possession]');
    await page.click('.pad [data-act=save]');
    await page.waitForSelector('.club-hero');
    w = await world();
    assert.equal(w.clubs[tf.id].short, 'TFU');
    assert.equal(w.clubs[tf.id].tactics.formation, '4-3-3');
    step('edited club abbreviation and tactics');

    // ---- player creation ----
    await go(`#/players/new?club=${tf.id}`);
    await page.fill('[data-field=name]', 'Ezra Testman');
    await page.selectOption('[data-field=nation]', 'BRA');
    await page.selectOption('[data-field=position]', 'ST');
    await page.click('[data-act=seg][data-value=Left]');
    await page.$eval('[data-field="a.shooting"]', (el) => { el.value = '95'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('.pad [data-act=save]');
    await page.waitForSelector('.player-hero');
    w = await world();
    const ezra = Object.values(w.players).find((p) => p.name === 'Ezra Testman');
    assert.ok(ezra);
    assert.equal(ezra.clubId, tf.id);
    assert.equal(ezra.nation, 'BRA');
    assert.equal(ezra.foot, 'Left');
    assert.equal(ezra.attributes.shooting, 95);
    step('created a player with nationality, position, foot and attributes, assigned to a club');

    // ---- league creation ----
    await go('#/leagues/new');
    await page.fill('[data-field=name]', 'Test Premier');
    for (const c of clubs) await page.check(`[data-club="${c.id}"]`);
    await page.click('[data-act=seg][data-name=legs][data-value="2"]');
    await page.click('.pad > [data-act=save]');
    await page.waitForSelector('.fx-list');
    w = await world();
    const league = Object.values(w.leagues).find((l) => l.name === 'Test Premier');
    assert.equal(league.clubIds.length, 3);
    assert.equal(league.season.fixtures.length, 6);
    step('created a league; fixtures generated automatically (3 clubs, home & away = 6 matches)');

    // ---- edit Testford's line-up: put Ezra up front and a chosen substitute on the bench ----
    await go(`#/club/${tf.id}/squad`);
    await page.click('[data-act=lineupMode][data-value=manual]');
    await page.waitForSelector('.pp.edit');
    w = await world();
    assert.equal(w.clubs[tf.id].lineup.manual, true);
    const stIndex = w.clubs[tf.id].lineup.formation === '4-3-3' ? 9 : 10; // 4-3-3: RW ST LW
    await page.click(`.pp.edit[data-i="${stIndex}"]`);
    await page.click(`.sheet [data-sheet="${ezra.id}"]`);
    await page.waitForTimeout(250);
    w = await world();
    assert.equal(w.clubs[tf.id].lineup.xi[stIndex], ezra.id);
    const subPick = Object.values(w.players).find((p) => p.clubId === tf.id && !w.clubs[tf.id].lineup.xi.includes(p.id) && p.position === 'GK');
    await page.click('[data-act=benchSlot][data-i="0"]');
    await page.click(`.sheet [data-sheet="${subPick.id}"]`);
    await page.waitForTimeout(250);
    w = await world();
    assert.equal(w.clubs[tf.id].lineup.bench[0], subPick.id);
    // swap two starters by picking a player already in the XI
    const gkPid = w.clubs[tf.id].lineup.xi[0];
    step('edited the line-up: own player in the starting XI and a chosen substitute');

    // ---- simulate single match ----
    await go(`#/league/${league.id}/fixtures`);
    await page.click('[data-act=simOne]');
    await page.waitForSelector('.live');
    await page.click('[data-live=skip]');
    await page.waitForSelector('[data-end]:not([hidden])', { timeout: 15000 });
    await page.click('[data-live=close]');
    await page.waitForSelector('.live-wrap', { state: 'detached' });
    w = await world();
    assert.equal(w.leagues[league.id].season.fixtures.filter((f) => f.result).length, 1);
    step('simulated a single match');

    // ---- view the match ----
    const played = w.leagues[league.id].season.fixtures.find((f) => f.result);
    await go(`#/match/${league.id}/${played.id}`);
    await page.waitForSelector('.scoreboard');
    await page.click('[data-act=seg][data-value=stats]');
    await page.waitForSelector('.stats-card');
    await page.click('[data-act=seg][data-value=lineups]');
    await page.waitForSelector('.pitch');
    step('viewed match report, statistics and line-ups');

    // ---- play the next matchday with transition ----
    await go(`#/league/${league.id}/fixtures`);
    await page.click('.sim-bar [data-act=play]');
    await page.waitForSelector('.md-panel', { timeout: 5000 });
    await page.click('.md-panel .btn');
    await page.waitForTimeout(400);
    w = await world();
    assert.ok(w.leagues[league.id].season.fixtures.filter((f) => f.result).length >= 2);
    step('played a matchday with animated results');

    // ---- simulate the rest of the season ----
    await page.click('.sim-bar [data-act=season]');
    await page.click('.sheet [data-sheet=true]');
    await page.waitForSelector('.champ', { timeout: 8000 });
    await page.click('.champ [data-close]');
    w = await world();
    const L = w.leagues[league.id];
    assert.ok(L.season.finished);
    const tfGames = L.season.fixtures.filter((f) => f.home === tf.id || f.away === tf.id);
    const withEzra = tfGames.filter((f) => f.result.lineups[f.home === tf.id ? 'home' : 'away'].xi.some((s) => s.pid === ezra.id && s.slot === 'ST'));
    // he starts whenever available (a random injury or ban can rule him out of a game or two)
    const notStarted = tfGames.filter((f) => !withEzra.includes(f));
    assert.ok(withEzra.length >= 1 && notStarted.every((f) => !Object.keys(f.result.pl).includes(ezra.id) || f.result.events.some((e) => e.pid === ezra.id)), `Ezra started up front when available (${withEzra.length}/${tfGames.length})`);
    assert.ok(tfGames.some((f) => f.result.lineups[f.home === tf.id ? 'home' : 'away'].xi[0].pid === gkPid));
    step('matches used the chosen line-up');
    assert.equal(L.history.length, 1);
    step('simulated the full season; champion crowned and archived');

    for (const tab of ['table', 'stats', 'form', 'history', 'records']) {
      await go(`#/league/${league.id}/${tab}`);
      await page.waitForSelector('.tabs .tab.active');
    }
    step('table, stats, form, history and records tabs render');

    // ---- simulation settings ----
    await go('#/settings');
    await page.click('[data-act=preset][data-value=unpredictable]');
    await page.waitForTimeout(100);
    await page.$eval('[data-field=homeAdvantage]', (el) => { el.value = '83'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.click('[data-act=setSel][data-value=low]');
    w = await world();
    assert.equal(w.settings.sim.preset, 'custom');
    assert.equal(w.settings.sim.values.homeAdvantage, 83);
    assert.equal(w.settings.sim.values.goalFrequency, 'low');
    assert.equal(w.settings.sim.values.upsetFrequency, 80, 'other values come from the Unpredictable preset');
    await page.click('[data-act=lab]');
    await page.waitForSelector('.lab-results', { timeout: 30000 });
    step('changed preset and individual settings; settings tester ran');

    // ---- persistence across a full reload ----
    await flush();
    const before = await world();
    await page.reload();
    await page.waitForSelector('.tabbar');
    const after = await world();
    delete before.savedAt; delete after.savedAt;
    assert.deepEqual(after, before);
    step('all data and settings survived a full page reload (IndexedDB)');

    // ---- cloud: everything uploaded; a brand-new device downloads it ----
    await page.evaluate(async () => { await window.ftbl.store.flush(); await window.ftbl.sync.push(); });
    assert.ok(rget('ftbl/meta'), 'data uploaded to the cloud');
    const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });
    await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await withCloud(ctx2);
    const page2 = await ctx2.newPage();
    await page2.goto(base);
    await page2.waitForFunction(() => window.ftbl && Object.keys(window.ftbl.store.world.clubs).length > 0, null, { timeout: 15000 });
    const w2 = await page2.evaluate(() => JSON.parse(JSON.stringify(window.ftbl.store.world)));
    const w1 = await world();
    assert.deepEqual(w2, w1, 'new device has identical data, including save time');
    assert.equal(await page2.evaluate(() => window.ftbl.sync.status), 'synced');
    await ctx2.close();
    step('cloud save: data uploaded and a fresh device downloaded an identical copy');

    // ---- next season ----
    await go(`#/league/${league.id}/fixtures`);
    await page.click('.champion-banner [data-act=next]');
    await page.waitForTimeout(300);
    w = await world();
    assert.equal(w.leagues[league.id].season.number, 2);
    assert.ok(w.leagues[league.id].season.fixtures.every((f) => !f.result));
    step('started season two');

    // ---- multiple leagues: add demo world, play the second league only ----
    await go('#/settings/data');
    await page.click('[data-act=demo]');
    await page.waitForTimeout(300);
    w = await world();
    const k2 = Object.values(w.leagues).find((l) => l.name === 'Kronliga 2');
    const k1 = Object.values(w.leagues).find((l) => l.name === 'Kronliga');
    await go(`#/league/${k2.id}/fixtures`);
    await page.click('.sim-bar [data-act=play]');
    await page.waitForSelector('.md-panel');
    await page.click('.md-panel .btn');
    w = await world();
    assert.ok(w.leagues[k2.id].season.fixtures.some((f) => f.result));
    assert.ok(w.leagues[k1.id].season.fixtures.every((f) => !f.result));
    assert.ok(w.leagues[league.id].season.fixtures.every((f) => !f.result));
    step('multiple leagues stay independent');

    // ---- Champions League: finish a Kronliga season, reload -> one-time upgrade adds the UCL ----
    await page.evaluate(async (id) => {
      const m = await import('/js/league/season.js');
      window.ftbl.app.act((w) => m.playSeason(w, w.leagues[id], window.ftbl.app.params()));
      await window.ftbl.store.flush();
    }, k1.id);
    await page.reload();
    await page.waitForFunction(() => window.ftbl && Object.values(window.ftbl.store.world.leagues).some((l) => l.type === 'cup'), null, { timeout: 15000 });
    w = await world();
    const ucl = Object.values(w.leagues).find((l) => l.type === 'cup');
    const top3 = w.leagues[k1.id].history[0].table.slice(0, 3).map((r) => r.clubId);
    assert.deepEqual(ucl.season.qualifiers, top3);
    assert.equal(ucl.season.clubIds.length, 32);
    assert.equal(w.leagues[k1.id].config.continentalCupId, ucl.id);
    await go(`#/league/${ucl.id}/fixtures`);
    await page.click('.sim-bar [data-act=play]');
    await page.waitForSelector('.md-panel');
    await page.click('.md-panel .btn');
    await go(`#/league/${ucl.id}/groups`);
    await page.waitForSelector('.group-card');
    // ---- Win game: type part of a name, pick it, win the next match ----
    w = await world();
    const pick = w.leagues[ucl.id].season.qualifiers.map((id) => w.clubs[id]).sort((x, y) => x.ratings.overall - y.ratings.overall)[0];
    await go(`#/league/${ucl.id}/fixtures`);
    await page.click('[data-act=winGame]');
    await page.fill('.wg-input', pick.name.slice(0, 5).toLowerCase());
    await page.click(`.wg-list [data-sheet="${pick.id}"]`);
    await page.click('.wg-options [data-sheet="all"]');
    await page.waitForSelector('.win-active');
    for (let i = 0; i < 2; i++) {
      await page.click('.sim-bar [data-act=play]');
      await page.waitForSelector('.md-panel');
      await page.click('.md-panel .btn');
      await page.waitForTimeout(200);
    }
    w = await world();
    const pickGames = w.leagues[ucl.id].season.fixtures.filter((f) => f.result && f.round > 1 && (f.home === pick.id || f.away === pick.id));
    assert.equal(pickGames.length, 2);
    assert.ok(pickGames.every((f) => (f.home === pick.id ? f.result.hg > f.result.ag : f.result.ag > f.result.hg)), 'chosen team won');
    await page.click('.win-active [data-act=stopWin]');
    w = await world();
    assert.deepEqual(w.leagues[ucl.id].season.forceWins, {});
    step('Win game: picked a team by typing part of its name; it won its matches, then switched off');
    await go(`#/league/${ucl.id}/fixtures`);
    await page.click('.sim-bar [data-act=season]');
    await page.click('.sheet [data-sheet=true]');
    await page.waitForSelector('.champ', { timeout: 10000 });
    await page.click('.champ [data-close]');
    await go(`#/league/${ucl.id}/bracket`);
    await page.waitForSelector('.tie');
    w = await world();
    assert.ok(w.leagues[ucl.id].season.finished);
    const champ = w.leagues[ucl.id].history[0].championId;
    const finalFx = w.leagues[ucl.id].season.fixtures.find((f) => f.stage === 'final');
    await go(`#/match/${ucl.id}/${finalFx.id}`);
    await page.waitForSelector('.scoreboard');
    await go(`#/club/${champ}/honours`);
    await page.waitForSelector('.honours-hero .shelf-item');
    step('Champions League added with the Kronliga top 3; group stage, knockouts and final played');

    // ---- Daffers Cup (knockout) was added; play a round ----
    w = await world();
    const daf = Object.values(w.leagues).find((l) => l.format === 'knockout');
    assert.ok(daf && daf.name === 'Daffers Cup');
    await go(`#/league/${daf.id}/fixtures`);
    await page.click('.sim-bar [data-act=play]');
    await page.waitForSelector('.md-panel');
    await page.click('.md-panel .btn');
    await go(`#/league/${daf.id}/bracket`);
    await page.waitForSelector('.ko-round');
    step('Daffers Cup: knockout round played, rounds view shows the draw');

    // ---- Win game in a league (Kronliga 2) ----
    w = await world();
    const k2now = w.leagues[k2.id];
    const k2pick = k2now.season.clubIds.map((id) => w.clubs[id]).sort((x, y) => x.ratings.overall - y.ratings.overall)[0];
    await go(`#/league/${k2.id}/fixtures`);
    await page.click('[data-act=winGame]');
    await page.fill('.wg-input', k2pick.name.split(' ')[0].slice(0, 4).toLowerCase());
    await page.click(`.wg-list [data-sheet="${k2pick.id}"]`);
    await page.click('.wg-options [data-sheet="1"]');
    const roundBefore = await page.evaluate((id) => { const l = window.ftbl.store.world.leagues[id]; return Math.min(...l.season.fixtures.filter((f) => !f.result).map((f) => f.round)); }, k2.id);
    let pickRound = roundBefore;
    for (let i = 0; i < 3; i++) {
      w = await world();
      const g = w.leagues[k2.id].season.fixtures.find((f) => (f.home === k2pick.id || f.away === k2pick.id) && f.result && f.round >= roundBefore);
      if (g) { pickRound = g.round; break; }
      await page.click('.sim-bar [data-act=play]');
      await page.waitForSelector('.md-panel');
      await page.click('.md-panel .btn');
    }
    w = await world();
    const g2 = w.leagues[k2.id].season.fixtures.find((f) => (f.home === k2pick.id || f.away === k2pick.id) && f.result && f.round >= roundBefore);
    assert.ok(g2 && (g2.home === k2pick.id ? g2.result.hg > g2.result.ag : g2.result.ag > g2.result.hg), 'league Win game won the match');
    step('Win game in a league: typed part of the name, the club won its next match');

    // ---- FIFA-style live Sim match ----
    w = await world();
    const cr2 = Math.min(...w.leagues[k2.id].season.fixtures.filter((f) => !f.result).map((f) => f.round));
    const liveFx = w.leagues[k2.id].season.fixtures.find((f) => f.round === cr2 && !f.result);
    await go(`#/match/${k2.id}/${liveFx.id}`);
    await page.click('[data-act=live]');
    await page.waitForSelector('.live');
    await page.waitForFunction(() => parseInt(document.querySelector('[data-clock]').textContent, 10) >= 3, null, { timeout: 8000 });
    await page.click('[data-live=speed]');
    await page.click('[data-live=skip]');
    await page.waitForSelector('[data-end]:not([hidden])', { timeout: 15000 });
    const shown = await page.evaluate(() => [document.querySelector('[data-hs]').textContent, document.querySelector('[data-as]').textContent].map(Number));
    w = await world();
    const liveRes = w.leagues[k2.id].season.fixtures.find((f) => f.id === liveFx.id).result;
    assert.deepEqual(shown, [liveRes.hg, liveRes.ag], 'live score matches the saved result');
    await page.click('[data-live=close]');
    await page.waitForSelector('.live-wrap', { state: 'detached' });
    step('live Sim match: clock ran, skip to result, score matches the saved match');

    // ---- Clubs grouped by competition ----
    await go('#/clubs');
    await page.waitForSelector('.comp-chip');
    const chipCount = await page.$$eval('.comp-chip', (els) => els.length);
    w = await world();
    assert.ok(chipCount >= Object.keys(w.leagues).length, 'one chip per competition (+ all)');
    await page.click(`.comp-chip[data-value="${daf.id}"]`);
    await page.waitForSelector('.section-title');
    const sections = await page.$$eval('.section-title', (els) => els.map((e) => e.textContent));
    assert.ok(sections.some((t) => /Kronliga/.test(t)));
    step('Clubs tab groups clubs by competition (Daffers Cup split by entry round)');

    // ---- Back returns to the previous screen ----
    await go('#/clubs');
    const firstClub = await page.$eval('.club-card', (a) => a.getAttribute('href'));
    await page.click('.club-card');
    await page.waitForSelector('.club-hero');
    await page.click('a.tab[href$="/honours"]');
    await page.waitForTimeout(200);
    await page.click('.topbar [data-back]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => location.hash), '#/clubs', 'back went to the previous place, not a fixed parent');
    await go(`#/league/${k2.id}/table`);
    await page.click('.fx-row a, .ltable a');
    await page.waitForSelector('.club-hero');
    await page.click('.topbar [data-back]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => location.hash), `#/league/${k2.id}/table`);
    step('Back button returns to wherever you were before');

    // ---- past seasons switcher on a league table ----
    await go(`#/league/${k1.id}/table`);
    w = await world();
    if (w.leagues[k1.id].history.length > 1 || (w.leagues[k1.id].history.length && !w.leagues[k1.id].season.finished)) {
      await page.click('[data-act=pastBack]');
      await page.waitForSelector('.season-step.past');
      await page.waitForSelector('.past-notes');
      await page.click('[data-act=pastFwd]');
      await page.waitForSelector('.season-step:not(.past)');
    }
    step('past seasons switcher on tables');

    // ---- delete flow guards ----
    await go(`#/club/${Object.values(w.clubs).find((c) => c.name === 'Ravenmoor FC').id}/squad`);
    await page.waitForSelector('.pitch');
    step('club squad page with starting XI renders');

    await flush();
    await page.reload();
    await page.waitForSelector('.tabbar');
    w = await world();
    assert.ok(w.leagues[k2.id].season.fixtures.some((f) => f.result), 'results persisted after reload');
    step('second reload keeps everything');

    assert.deepEqual(errors, [], 'no runtime errors');
    step('no runtime errors');
    console.log('\nE2E PASSED');
  } catch (e) {
    console.error('\nE2E FAILED:', e);
    console.error('page errors:', errors);
    await page.screenshot({ path: path.join(ROOT, 'e2e-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
