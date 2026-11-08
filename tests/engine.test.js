// Match engine: probability distributions over large samples, determinism and consistency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, expectedGoals, formScore } from '../js/engine/match.js';
import { teamStrength } from '../js/engine/strength.js';
import { outcomeProbs, scoreMatrix } from '../js/engine/poisson.js';
import { team, params, run } from './helpers.js';

const P = params();

test('10,000+ matches across strength combinations: stronger sides outperform, draws and upsets are believable', () => {
  // ratings gaps from -16 to +16 (home rating - away rating); 1,500 matches each = 13,500 matches
  const gaps = [-16, -10, -5, 0, 5, 10, 16];
  const results = {};
  let total = 0;
  for (const g of gaps) {
    const H = team(74 + g / 2, 'h' + g), A = team(74 - g / 2, 'a' + g);
    const r = run(H, A, P, 1500, { seed: 'gap' + g });
    total += r.n;
    results[g] = { ...r, ppg: (3 * r.home + r.draw) };
  }
  // additional mixed sample across many random pairings
  let wins = 0, upsets = 0, draws = 0, n = 0, goals = 0;
  for (let i = 0; i < 1500; i++) {
    const a = 60 + (i * 7) % 30, b = 60 + (i * 13) % 30;
    const r = simulateMatch({ home: team(a, 'ma' + a), away: team(b, 'mb' + b), params: P, seed: 'mix' + i });
    n++; goals += r.hg + r.ag;
    if (r.hg === r.ag) draws++;
    else if (a !== b) { const strongerWon = (a > b) === (r.hg > r.ag); if (strongerWon) wins++; else upsets++; }
  }
  total += n;
  console.log('gap table', Object.fromEntries(gaps.map((g) => [g, { H: results[g].home.toFixed(3), D: results[g].draw.toFixed(3), A: results[g].away.toFixed(3), G: results[g].goals.toFixed(2) }])));
  console.log('mixed', { n, strongerWinShare: (wins / (wins + upsets)).toFixed(3), draws: (draws / n).toFixed(3), goals: (goals / n).toFixed(2) });
  assert.ok(total >= 10000, 'at least 10,000 simulated matches');
  // monotonic: bigger home advantage in rating -> more points per game
  for (let i = 1; i < gaps.length; i++) assert.ok(results[gaps[i]].ppg > results[gaps[i - 1]].ppg, `ppg should rise with gap (${gaps[i - 1]} -> ${gaps[i]})`);
  // evenly matched: believable split with home advantage
  const even = results[0];
  assert.ok(even.draw > 0.2 && even.draw < 0.33, `draw rate ${even.draw}`);
  assert.ok(even.home > even.away, 'home advantage exists');
  assert.ok(even.goals > 2.2 && even.goals < 3.2, `goals/game ${even.goals}`);
  // big favourites win most, but upsets still happen
  assert.ok(results[16].home > 0.6, 'strong home favourite usually wins');
  assert.ok(results[16].away > 0.02, 'underdog away wins still possible');
  assert.ok(results[-16].home > 0.04, 'underdog home wins still possible');
  assert.ok(wins / (wins + upsets) > 0.6 && upsets > 0, 'stronger team wins most decisive games, upsets exist');
  assert.ok(draws / n > 0.18 && draws / n < 0.32, 'overall draw rate believable');
});

test('score model probabilities sum to 1 and draw inflation increases draws', () => {
  const m = scoreMatrix(1.4, 1.1, 1.2);
  const sum = m.flat().reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  const a = outcomeProbs(1.4, 1.1, 1), b = outcomeProbs(1.4, 1.1, 2);
  assert.ok(b.draw > a.draw);
});

test('matches are reproducible from a seed and differ across seeds', () => {
  const H = team(78, 'h', { squad: true }), A = team(72, 'a', { squad: true });
  const r1 = simulateMatch({ home: H, away: A, params: P, seed: 'same' });
  const r2 = simulateMatch({ home: H, away: A, params: P, seed: 'same' });
  assert.deepEqual(r1, r2);
  const scores = new Set();
  for (let i = 0; i < 40; i++) { const r = simulateMatch({ home: H, away: A, params: P, seed: 'd' + i }); scores.add(`${r.hg}-${r.ag}`); }
  assert.ok(scores.size > 4, 'different seeds produce varied scorelines');
});

test('match events are consistent with the scoreline and who was on the pitch', () => {
  const H = team(76, 'h', { squad: true }), A = team(74, 'a', { squad: true });
  const ids = new Set([...H.players, ...A.players].map((p) => p.id));
  for (let i = 0; i < 300; i++) {
    const r = simulateMatch({ home: H, away: A, params: P, seed: 'ev' + i });
    const goals = r.events.filter((e) => e.type === 'goal');
    assert.equal(goals.filter((e) => e.side === 'home').length, r.hg);
    assert.equal(goals.filter((e) => e.side === 'away').length, r.ag);
    for (const g of goals) {
      assert.ok(ids.has(g.pid), 'scorer is a real player');
      const scorerPlayed = r.pl[g.pid] && r.pl[g.pid][0] > 0;
      assert.ok(scorerPlayed, 'scorer was on the pitch');
      if (g.assist) assert.notEqual(g.assist, g.pid);
    }
    assert.ok(r.stats.shots[0] >= r.stats.shotsOnTarget[0] && r.stats.shotsOnTarget[0] >= r.hg);
    assert.ok(r.stats.shots[1] >= r.stats.shotsOnTarget[1] && r.stats.shotsOnTarget[1] >= r.ag);
    assert.equal(r.stats.possession[0] + r.stats.possession[1], 100);
    assert.equal(r.lineups.home.xi.length, 11);
    const subs = r.events.filter((e) => e.type === 'sub' && e.side === 'home').length;
    assert.ok(subs <= 5);
    for (const [pid, [min]] of Object.entries(r.pl)) assert.ok(min >= 0 && min <= 90, `minutes for ${pid}`);
  }
});

test('no artificial alternation or streak forcing: consecutive results are independent', () => {
  const H = team(75, 'h'), A = team(75, 'a');
  let same = 0, n = 0, prev = null;
  for (let i = 0; i < 3000; i++) {
    const r = simulateMatch({ home: H, away: A, params: P, seed: 'ind' + i });
    const o = r.hg > r.ag ? 'H' : r.hg < r.ag ? 'A' : 'D';
    if (prev) { n++; if (o === prev) same++; }
    prev = o;
  }
  const s = run(H, A, P, 3000, { seed: 'ind' });
  const expected = s.home ** 2 + s.draw ** 2 + s.away ** 2;
  assert.ok(Math.abs(same / n - expected) < 0.04, `repeat rate ${same / n} vs independent ${expected}`);
});

test('expected goals respond to strength, availability and form', () => {
  const strong = teamStrength(team(85, 's').club, [], {}, P);
  const weak = teamStrength(team(65, 'w').club, [], {}, P);
  const xg = expectedGoals(strong, weak, P);
  assert.ok(xg.home > xg.away * 2);
  const even = teamStrength(team(75, 'e').club, [], {}, P);
  const good = expectedGoals(even, even, P, { homeForm: 1, awayForm: -1 });
  const neutral = expectedGoals(even, even, P, {});
  assert.ok(good.home > neutral.home && good.away < neutral.away);
  assert.equal(formScore(['W', 'W', 'W', 'W', 'W']), 1);
  assert.ok(Math.abs(formScore(['L', 'L', 'L', 'L', 'L']) + 0.875) < 1e-9);
  // missing players reduce strength
  const T = team(78, 'av', { squad: true });
  const full = teamStrength(T.club, T.players, {}, P);
  const best = [...T.players].sort((a, b) => b.overall - a.overall).slice(0, 6);
  const state = Object.fromEntries(best.map((p) => [p.id, { fit: 100, inj: 3, sus: 0 }]));
  const depleted = teamStrength(T.club, T.players, state, P);
  assert.ok(depleted.att + depleted.mid + depleted.def < full.att + full.mid + full.def);
  assert.ok(depleted.availability < 1);
  for (const s of depleted.lineup.xi) assert.ok(!state[s.pid], 'injured player not selected');
});

test('manual line-ups: chosen XI and bench are used; unavailable picks are covered by the chosen subs', async () => {
  const { selectLineup } = await import('../js/engine/strength.js');
  const { simulateMatch } = await import('../js/engine/match.js');
  const T = team(76, 'man', { squad: true });
  const A = team(76, 'opp', { squad: true });
  const auto = selectLineup(T.players, '4-4-2', {}, 0.3);
  // pick the 11 *worst* players instead (by overall), and a specific bench
  const worst = [...T.players].sort((a, b) => a.overall - b.overall);
  const xiPids = worst.slice(0, 11).map((p) => p.id);
  const benchPids = worst.slice(11, 16).map((p) => p.id);
  const manual = { manual: true, formation: '4-4-2', xi: xiPids, bench: benchPids };
  const lu = selectLineup(T.players, '4-4-2', {}, 0.3, 9, manual);
  assert.deepEqual(lu.xi.map((s) => s.pid), xiPids, 'exact XI in the chosen slots');
  assert.deepEqual(lu.bench.slice(0, 5), benchPids, 'chosen subs first on the bench');
  assert.notDeepEqual(auto.xi.map((s) => s.pid), xiPids);
  // injured pick is replaced, preferring the user's substitutes
  const state = { [xiPids[3]]: { fit: 100, inj: 2, sus: 0 } };
  const lu2 = selectLineup(T.players, '4-4-2', state, 0.3, 9, manual);
  assert.ok(!lu2.xi.some((s) => s.pid === xiPids[3]));
  assert.ok(benchPids.includes(lu2.xi[3].pid), 'gap filled from the chosen bench');
  // formation changed after saving: chosen players still start
  const lu3 = selectLineup(T.players, '4-3-3', {}, 0.3, 9, manual);
  assert.deepEqual(new Set(lu3.xi.map((s) => s.pid)), new Set(xiPids));
  // used by the match engine via club.lineup, and a weaker chosen XI is genuinely weaker
  const club = { ...T.club, lineup: manual, tactics: { formation: '4-4-2', style: 'balanced' } };
  const r = simulateMatch({ home: { club, players: T.players }, away: A, params: params(), seed: 'm1' });
  assert.deepEqual(r.lineups.home.xi.map((s) => s.pid), xiPids);
  const best = run({ club: { ...T.club, tactics: club.tactics }, players: T.players }, A, params({ squadQualityInfluence: 100 }), 800, { seed: 'b' });
  const weak = run({ club, players: T.players }, A, params({ squadQualityInfluence: 100 }), 800, { seed: 'b' });
  assert.ok(weak.home < best.home, `weak XI wins less (${weak.home} vs ${best.home})`);
});
