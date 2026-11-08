// Every simulation setting must measurably change the simulation in the intended direction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTING_DEFS, PRESETS, applyPreset, setSimValue, defaultSimSettings, sanitizeSimSettings, resolveParams } from '../js/engine/params.js';
import { simulateMatch } from '../js/engine/match.js';
import { team, params, run } from './helpers.js';

const N = 1500;

test('there are 14 settings and each maps to engine parameters', () => {
  assert.equal(SETTING_DEFS.length, 14);
  const base = resolveParams(PRESETS.realistic.values);
  for (const d of SETTING_DEFS) {
    const alt = { ...PRESETS.realistic.values, [d.key]: d.type === 'select' ? 'high' : (PRESETS.realistic.values[d.key] > 50 ? 0 : 100) };
    const p = resolveParams(alt);
    assert.notDeepEqual(p, base, `${d.key} changes the resolved engine parameters`);
  }
});

test('presets adjust parameters; editing a value switches to Custom and remembers it', () => {
  let s = defaultSimSettings();
  s = applyPreset(s, 'unpredictable');
  assert.equal(s.values.upsetFrequency, PRESETS.unpredictable.values.upsetFrequency);
  s = setSimValue(s, 'homeAdvantage', 90);
  assert.equal(s.preset, 'custom');
  assert.equal(s.values.homeAdvantage, 90);
  s = applyPreset(s, 'realistic');
  assert.equal(s.values.homeAdvantage, PRESETS.realistic.values.homeAdvantage);
  s = applyPreset(s, 'custom');
  assert.equal(s.values.homeAdvantage, 90, 'custom values restored');
  assert.throws(() => setSimValue(s, 'nope', 1));
  const clean = sanitizeSimSettings({ preset: 'weird', values: { homeAdvantage: 500, goalFrequency: 'silly' } });
  assert.equal(clean.preset, 'realistic');
  assert.equal(clean.values.homeAdvantage, 100);
  assert.equal(clean.values.goalFrequency, 'normal');
});

test('Team Rating Influence: favourites win more when it is high', () => {
  const H = team(82, 'h'), A = team(68, 'a');
  const lo = run(H, A, params({ teamRatingInfluence: 0 }), N), hi = run(H, A, params({ teamRatingInfluence: 100 }), N);
  assert.ok(hi.home > lo.home + 0.15, `${lo.home} -> ${hi.home}`);
});

test('Upset Frequency: underdogs win more when it is high', () => {
  const H = team(84, 'h'), A = team(68, 'a');
  const lo = run(H, A, params({ upsetFrequency: 0 }), N), hi = run(H, A, params({ upsetFrequency: 100 }), N);
  assert.ok(hi.away > lo.away + 0.04, `${lo.away} -> ${hi.away}`);
});

test('Home Advantage: home sides benefit more when it is high', () => {
  const H = team(75, 'h'), A = team(75, 'a');
  const lo = run(H, A, params({ homeAdvantage: 0 }), N), hi = run(H, A, params({ homeAdvantage: 100 }), N);
  assert.ok(Math.abs(lo.home - lo.away) < 0.06, 'no home advantage at 0');
  assert.ok(hi.home - hi.away > 0.25, `${hi.home} vs ${hi.away}`);
});

test('Form Influence: in-form sides benefit more when it is high', () => {
  const H = team(75, 'h'), A = team(75, 'a');
  const ctx = { homeForm: ['W', 'W', 'W', 'W', 'W'], awayForm: ['L', 'L', 'L', 'L', 'L'] };
  const lo = run(H, A, params({ formInfluence: 0, homeAdvantage: 0 }), N, { ctx });
  const hi = run(H, A, params({ formInfluence: 100, homeAdvantage: 0 }), N, { ctx });
  assert.ok(Math.abs(lo.home - lo.away) < 0.06, 'form irrelevant at 0');
  assert.ok(hi.home - hi.away > 0.12, `${hi.home} vs ${hi.away}`);
});

test('Goal Frequency: low < normal < high', () => {
  const H = team(75, 'h'), A = team(75, 'a');
  const l = run(H, A, params({ goalFrequency: 'low' }), N), n = run(H, A, params({ goalFrequency: 'normal' }), N), h = run(H, A, params({ goalFrequency: 'high' }), N);
  assert.ok(l.goals < n.goals - 0.2 && n.goals < h.goals - 0.2, `${l.goals} ${n.goals} ${h.goals}`);
});

test('Draw Frequency: more draws when it is high', () => {
  const H = team(75, 'h'), A = team(75, 'a');
  const lo = run(H, A, params({ drawFrequency: 0 }), N), hi = run(H, A, params({ drawFrequency: 100 }), N);
  assert.ok(hi.draw > lo.draw + 0.15, `${lo.draw} -> ${hi.draw}`);
});

test('Score Unpredictability: wider spread of scorelines when it is high', () => {
  const H = team(75, 'h'), A = team(75, 'a');
  const lo = run(H, A, params({ scoreUnpredictability: 0 }), N), hi = run(H, A, params({ scoreUnpredictability: 100 }), N);
  assert.ok(hi.variance > lo.variance * 1.25, `${lo.variance} -> ${hi.variance}`);
  assert.ok(hi.big > lo.big, 'more 5+ goal games');
});

test('Fatigue Impact: tired squads suffer more when it is high', () => {
  const H = team(75, 'h', { squad: true }), A = team(75, 'a', { squad: true });
  const tired = Object.fromEntries(H.players.map((p) => [p.id, { fit: 45, inj: 0, sus: 0 }]));
  const ctx = { homeState: tired, awayState: {} };
  const lo = run(H, A, params({ fatigueImpact: 0, homeAdvantage: 0 }), N, { ctx });
  const hi = run(H, A, params({ fatigueImpact: 100, homeAdvantage: 0 }), N, { ctx });
  assert.ok(hi.home < lo.home - 0.1, `${lo.home} -> ${hi.home}`);
});

test('Injury Frequency: injuries scale with the setting (none at 0)', () => {
  const H = team(75, 'h', { squad: true }), A = team(75, 'a', { squad: true });
  const zero = run(H, A, params({ injuryFrequency: 0 }), 400), mid = run(H, A, params({ injuryFrequency: 50 }), 800), hi = run(H, A, params({ injuryFrequency: 100 }), 800);
  assert.equal(zero.injuries, 0);
  assert.ok(mid.injuries > 0.1 && hi.injuries > mid.injuries * 1.5, `${mid.injuries} -> ${hi.injuries}`);
});

test('Squad Quality Influence: player ratings matter more than club ratings when it is high', () => {
  // identical club ratings, very different players
  const H = team(72, 'h', { squad: true, squadRating: 84 }), A = team(72, 'a', { squad: true, squadRating: 62 });
  const lo = run(H, A, params({ squadQualityInfluence: 0, homeAdvantage: 0 }), N);
  const hi = run(H, A, params({ squadQualityInfluence: 100, homeAdvantage: 0 }), N);
  assert.ok(Math.abs(lo.home - lo.away) < 0.08, `club ratings only: ${lo.home} vs ${lo.away}`);
  assert.ok(hi.home > lo.home + 0.2, `${lo.home} -> ${hi.home}`);
});

test('Tactical Influence: tactical match-ups matter more when it is high', () => {
  const H = team(75, 'h', { extra: { tactics: { formation: '4-3-3', style: 'counter' } } });
  const A = team(75, 'a', { extra: { tactics: { formation: '4-4-2', style: 'possession' } } });
  const lo = run(H, A, params({ tacticalInfluence: 0, homeAdvantage: 0 }), N);
  const hi = run(H, A, params({ tacticalInfluence: 100, homeAdvantage: 0 }), N);
  assert.ok(Math.abs(lo.home - lo.away) < 0.06, 'tactics irrelevant at 0');
  assert.ok(hi.home - hi.away > lo.home - lo.away + 0.08, `${lo.home - lo.away} -> ${hi.home - hi.away}`);
});

test('Goalkeeper Influence: a great keeper concedes fewer when it is high', () => {
  const H = team({ overall: 75, att: 75, mid: 75, def: 75, gk: 92 }, 'h'), A = team({ overall: 75, att: 75, mid: 75, def: 75, gk: 55 }, 'a');
  const lo = run(H, A, params({ goalkeeperInfluence: 0, homeAdvantage: 0 }), N);
  const hi = run(H, A, params({ goalkeeperInfluence: 100, homeAdvantage: 0 }), N);
  assert.ok((hi.hg - hi.ag) > (lo.hg - lo.ag) + 0.25, `${lo.hg - lo.ag} -> ${hi.hg - hi.ag}`);
});

test('Defensive Influence: strong defences suppress scoring more when it is high', () => {
  const H = team({ overall: 75, att: 75, mid: 75, def: 90, gk: 75 }, 'h'), A = team({ overall: 75, att: 75, mid: 75, def: 60, gk: 75 }, 'a');
  const lo = run(H, A, params({ defensiveInfluence: 0, homeAdvantage: 0 }), N);
  const hi = run(H, A, params({ defensiveInfluence: 100, homeAdvantage: 0 }), N);
  assert.ok(hi.ag < lo.ag - 0.15 && hi.hg > lo.hg + 0.15, `conceded ${lo.ag} -> ${hi.ag}; scored ${lo.hg} -> ${hi.hg}`);
});

test('Match Intensity: more shots, goals, cards and fatigue when it is high', () => {
  const H = team(75, 'h', { squad: true }), A = team(75, 'a', { squad: true });
  const lo = run(H, A, params({ matchIntensity: 0 }), N), hi = run(H, A, params({ matchIntensity: 100 }), N);
  assert.ok(hi.shots > lo.shots * 1.2 && hi.goals > lo.goals + 0.3, `shots ${lo.shots}->${hi.shots}, goals ${lo.goals}->${hi.goals}`);
  let yl = 0, yh = 0;
  for (let i = 0; i < 400; i++) {
    yl += simulateMatch({ home: H, away: A, params: params({ matchIntensity: 0 }), seed: 'c' + i }).stats.yellow.reduce((a, b) => a + b, 0);
    yh += simulateMatch({ home: H, away: A, params: params({ matchIntensity: 100 }), seed: 'c' + i }).stats.yellow.reduce((a, b) => a + b, 0);
  }
  assert.ok(yh > yl * 1.2);
});

test('presets produce distinct, sensible behaviour', () => {
  const H = team(80, 'h'), A = team(70, 'a');
  const real = run(H, A, params({}, 'realistic'), N), chaos = run(H, A, params({}, 'unpredictable'), N), bal = run(H, A, params({}, 'balanced'), N);
  assert.ok(real.home > bal.home && bal.home > chaos.home, `${real.home} ${bal.home} ${chaos.home}`);
  assert.ok(chaos.goals > real.goals);
});
