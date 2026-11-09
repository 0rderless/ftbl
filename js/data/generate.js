// Squad and player generation.
import { RNG } from '../core/rng.js';
import { NATIONS, randomName } from './nations.js';
import { newPlayer, calcOverall, clampRating } from './model.js';

// smaller 18-man squad for lower-league clubs
export const SMALL_SQUAD = ['GK', 'GK', 'RB', 'CB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST', 'ST', 'CM'];

// 25-man squad template
export const SQUAD_TEMPLATE = ['GK', 'GK', 'GK', 'RB', 'RB', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST', 'ST', 'ST', 'CM'];

const FIRST_CHOICE = { GK: 1, RB: 1, CB: 2, LB: 1, DM: 1, CM: 2, AM: 1, RM: 1, LM: 1, RW: 1, LW: 1, ST: 2 };
const LINE_OF = { GK: 'gk', RB: 'def', CB: 'def', LB: 'def', DM: 'mid', CM: 'mid', AM: 'mid', RM: 'mid', LM: 'mid', RW: 'att', LW: 'att', ST: 'att' };

const PROFILE = {
  GK: { goalkeeping: 1, pace: -18, shooting: -40, passing: -15, dribbling: -30, defending: -30, physical: -5 },
  CB: { defending: 4, physical: 3, pace: -8, passing: -8, dribbling: -15, shooting: -25, goalkeeping: -60 },
  RB: { defending: 0, pace: 3, passing: -4, dribbling: -6, physical: -3, shooting: -20, goalkeeping: -60 },
  LB: { defending: 0, pace: 3, passing: -4, dribbling: -6, physical: -3, shooting: -20, goalkeeping: -60 },
  DM: { defending: 2, passing: 1, physical: 1, dribbling: -6, pace: -8, shooting: -12, goalkeeping: -60 },
  CM: { passing: 3, dribbling: -1, defending: -6, physical: -4, shooting: -5, pace: -5, goalkeeping: -60 },
  AM: { passing: 3, dribbling: 3, shooting: 0, defending: -25, physical: -10, pace: -2, goalkeeping: -60 },
  RM: { pace: 3, passing: 1, dribbling: 1, shooting: -6, defending: -20, physical: -8, goalkeeping: -60 },
  LM: { pace: 3, passing: 1, dribbling: 1, shooting: -6, defending: -20, physical: -8, goalkeeping: -60 },
  RW: { pace: 4, dribbling: 3, shooting: 0, passing: -4, defending: -30, physical: -10, goalkeeping: -60 },
  LW: { pace: 4, dribbling: 3, shooting: 0, passing: -4, defending: -30, physical: -10, goalkeeping: -60 },
  ST: { shooting: 4, pace: 0, physical: 0, dribbling: -2, passing: -10, defending: -35, goalkeeping: -60 },
};

export function generateAttributes(rng, position, target) {
  const prof = PROFILE[position] || PROFILE.CM;
  const attrs = {};
  for (const k of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'goalkeeping']) {
    attrs[k] = clampRating(target + (prof[k] || 0) + rng.normal(0, 4));
  }
  // nudge so the derived overall lands on target
  for (let i = 0; i < 6; i++) {
    const diff = target - calcOverall(position, attrs);
    if (Math.abs(diff) < 1) break;
    for (const k in attrs) attrs[k] = clampRating(attrs[k] + diff);
  }
  return attrs;
}

export function pickNation(rng, home = 'ENG') {
  return rng.chance(0.55) ? home : rng.pick(NATIONS).code;
}

function usedNumbers(players) { return new Set(players.map((p) => p.number)); }

function shirtNumber(rng, position, used) {
  const pref = { GK: [1, 13, 31], RB: [2, 22], LB: [3, 23], CB: [4, 5, 6, 15], DM: [6, 16], CM: [8, 14, 18], AM: [10, 20], RM: [7, 17], LM: [11, 21], RW: [7, 17], LW: [11, 19], ST: [9, 19, 29] }[position] || [];
  for (const n of pref) if (!used.has(n)) return n;
  for (let n = 2; n < 99; n++) if (!used.has(n)) return n;
  return rng.int(40, 99);
}

/**
 * Generate players for a club so the squad has `size` players, matching the
 * club's line ratings. Existing players are kept.
 */
export function generateSquad(club, existing = [], options = {}) {
  const rng = new RNG(options.seed || `${club.id}|squad|${existing.length}|${Date.now()}`);
  const home = options.nation || 'ENG';
  const template = options.template || SQUAD_TEMPLATE;
  const size = options.size || template.length;
  const have = {};
  for (const p of existing) have[p.position] = (have[p.position] || 0) + 1;
  const needed = [];
  const tmplCount = {};
  for (const pos of template) {
    tmplCount[pos] = (tmplCount[pos] || 0) + 1;
    if ((have[pos] || 0) < tmplCount[pos]) needed.push(pos);
  }
  const out = [];
  const used = usedNumbers(existing);
  const room = Math.max(0, size - existing.length);
  needed.slice(0, room).forEach((pos) => {
    const line = LINE_OF[pos];
    const base = club.ratings[line] * 0.75 + club.ratings.overall * 0.25;
    // first-choice players are near the line rating, depth players a bit lower
    const already = (have[pos] || 0) + out.filter((p) => p.position === pos).length;
    const isBackup = already >= (FIRST_CHOICE[pos] || 1);
    const target = clampRating(base + 1.5 + rng.normal(0, 2.8) - (isBackup ? rng.float(3, 8) + 2 * (already - (FIRST_CHOICE[pos] || 1)) : 0));
    const nation = pickNation(rng, home);
    const p = newPlayer({
      clubId: club.id,
      name: randomName(rng, nation),
      nation,
      age: Math.round(Math.max(17, Math.min(37, rng.normal(26, 4)))),
      position: pos,
      attributes: generateAttributes(rng, pos, target),
      foot: rng.chance(0.24) ? 'Left' : rng.chance(0.05) ? 'Both' : 'Right',
    });
    if (['LB', 'LM', 'LW'].includes(pos) && rng.chance(0.6)) p.foot = 'Left';
    p.overall = calcOverall(pos, p.attributes);
    p.number = shirtNumber(rng, pos, used);
    used.add(p.number);
    out.push(p);
  });
  return out;
}
