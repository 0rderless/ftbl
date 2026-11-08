// Club, player and league creation/editing rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld } from '../js/core/store.js';
import { createClub, updateClub, deleteClub, createPlayer, updatePlayer, deletePlayer, createLeague, updateLeague, setLeagueClubs, restartLeagueSeason, deleteLeague, fillSquad, squadOf, ActionError } from '../js/core/actions.js';
import { playRound } from '../js/league/season.js';
import { calcOverall } from '../js/data/model.js';
import { badgeSVG, BADGE_PRESETS, SHAPES, PATTERNS, EMBLEMS } from '../js/ui/badge.js';
import { kitSVG, KIT_STYLES } from '../js/ui/kit.js';
import { params } from './helpers.js';

test('club creation: validated fields, unique names, generated squad matches ratings', () => {
  const w = emptyWorld();
  const c = createClub(w, { name: '  Ravenmoor FC ', short: 'ravx', ratings: { overall: 150, att: 82, mid: 80, def: 78, gk: -4 }, stadium: { name: 'The Rookery', capacity: 61000 } });
  assert.equal(c.name, 'Ravenmoor FC');
  assert.equal(c.short, 'RAVX');
  assert.equal(c.ratings.overall, 99);
  assert.equal(c.ratings.gk, 1);
  assert.equal(c.stadium.capacity, 61000);
  assert.ok(c.badge && c.kits.home && c.kits.away && c.kits.third);
  const squad = squadOf(w, c.id);
  assert.equal(squad.length, 25);
  assert.ok(squad.filter((p) => p.position === 'GK').length >= 2);
  assert.equal(new Set(squad.map((p) => p.number)).size, 25, 'unique shirt numbers');
  for (const p of squad) assert.equal(p.overall, calcOverall(p.position, p.attributes));
  assert.throws(() => createClub(w, { name: 'ravenmoor fc' }), ActionError);
  updateClub(w, c.id, { name: 'Ravenmoor City', badge: { ...BADGE_PRESETS[5].spec } });
  assert.equal(w.clubs[c.id].name, 'Ravenmoor City');
  assert.equal(w.clubs[c.id].badge.shape, BADGE_PRESETS[5].spec.shape);
});

test('player creation, assignment, editing and deletion', () => {
  const w = emptyWorld();
  const c = createClub(w, { name: 'A' }, { withSquad: false });
  const p = createPlayer(w, { name: 'Test Player', nation: 'BRA', age: 19, position: 'AM', clubId: c.id, foot: 'Left', attributes: { passing: 90, dribbling: 88, shooting: 80, pace: 70 } });
  assert.equal(p.clubId, c.id);
  assert.equal(p.number, 1);
  assert.equal(p.foot, 'Left');
  assert.throws(() => createPlayer(w, { name: 'X', clubId: 'nope' }), ActionError);
  updatePlayer(w, p.id, { overall: 120, position: 'ZZ', age: 70 });
  assert.equal(w.players[p.id].overall, 99);
  assert.equal(w.players[p.id].position, 'CM');
  assert.equal(w.players[p.id].age, 45);
  const filled = fillSquad(w, c.id, 25);
  assert.equal(squadOf(w, c.id).length, 25);
  assert.ok(filled.length === 24);
  deletePlayer(w, p.id);
  assert.ok(!w.players[p.id]);
});

test('league creation, participant locking, restarts, linking and deletion', () => {
  const w = emptyWorld();
  const ids = ['A', 'B', 'C', 'D', 'E'].map((n) => createClub(w, { name: n }, { withSquad: n !== 'E' }).id);
  assert.throws(() => createLeague(w, { name: 'Tiny', clubIds: [ids[0]] }), ActionError);
  const l = createLeague(w, { name: 'Five', clubIds: ids, config: { legs: 1 } });
  assert.equal(l.season.fixtures.length, 10);
  setLeagueClubs(w, l.id, ids.slice(0, 4));
  assert.equal(l.season.fixtures.length, 6);
  updateLeague(w, l.id, { config: { legs: 3 } });
  assert.equal(l.season.fixtures.length, 18);
  playRound(w, l, params());
  assert.throws(() => setLeagueClubs(w, l.id, ids), /before the first match/);
  assert.throws(() => updateLeague(w, l.id, { config: { legs: 2 } }), /Season length/);
  assert.throws(() => deleteClub(w, ids[0]), /Finish or restart/);
  restartLeagueSeason(w, l.id);
  assert.ok(l.season.fixtures.every((f) => !f.result));
  setLeagueClubs(w, l.id, ids);
  // clubs without squads still play using club ratings
  playRound(w, l, params());
  const l2 = createLeague(w, { name: 'Lower', clubIds: ids.slice(0, 3), config: { upperLeagueId: l.id, promotionSpots: 1 } });
  assert.equal(l.config.lowerLeagueId, l2.id);
  assert.equal(l2.config.upperLeagueId, l.id);
  deleteLeague(w, l2.id);
  assert.equal(l.config.lowerLeagueId, null);
  // deleting a club that isn't mid-season is allowed and frees its players
  const lone = createClub(w, { name: 'Lone' });
  deleteClub(w, lone.id);
  assert.ok(Object.values(w.players).every((p) => p.clubId !== lone.id));
});

test('badge and kit renderers produce valid SVG for every option (more than 20 presets)', () => {
  assert.ok(BADGE_PRESETS.length >= 20);
  assert.ok(Object.keys(SHAPES).length >= 12 && Object.keys(PATTERNS).length >= 12 && Object.keys(EMBLEMS).length >= 25);
  for (const shape of Object.keys(SHAPES)) for (const text of ['none', 'top', 'bottom', 'ring', 'year']) {
    const svg = badgeSVG({ shape, text, stars: 2 }, { name: 'Club <&> "Name"', short: 'CLB', founded: 1900 }, 40);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    assert.ok(!svg.includes('<&>'), 'text escaped');
  }
  for (const pattern of Object.keys(PATTERNS)) assert.ok(badgeSVG({ pattern }, {}, 20).includes('</svg>'));
  for (const emblem of Object.keys(EMBLEMS)) assert.ok(badgeSVG({ emblem }, { short: 'A' }, 20).includes('</svg>'));
  for (const style of Object.keys(KIT_STYLES)) assert.ok(kitSVG({ style }, 40).includes('</svg>'));
});
