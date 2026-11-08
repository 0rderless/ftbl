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

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  // block external font requests so the test is hermetic
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
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

    // ---- simulate single match ----
    await page.click('[data-act=simOne]');
    await page.waitForTimeout(200);
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
