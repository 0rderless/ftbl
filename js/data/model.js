// Data model factories, validation and derived values.
import { POSITIONS } from '../engine/tactics.js';

export const ATTRIBUTES = [
  { key: 'pace', label: 'Pace', short: 'PAC' },
  { key: 'shooting', label: 'Shooting', short: 'SHO' },
  { key: 'passing', label: 'Passing', short: 'PAS' },
  { key: 'dribbling', label: 'Dribbling', short: 'DRI' },
  { key: 'defending', label: 'Defending', short: 'DEF' },
  { key: 'physical', label: 'Physical', short: 'PHY' },
  { key: 'goalkeeping', label: 'Goalkeeping', short: 'GKP' },
];

// Position-specific attribute weights used to derive an overall rating.
const OVR_WEIGHTS = {
  GK: { goalkeeping: 0.8, passing: 0.08, physical: 0.07, pace: 0.05 },
  CB: { defending: 0.45, physical: 0.3, pace: 0.1, passing: 0.1, dribbling: 0.05 },
  RB: { defending: 0.35, pace: 0.25, passing: 0.15, physical: 0.15, dribbling: 0.1 },
  LB: { defending: 0.35, pace: 0.25, passing: 0.15, physical: 0.15, dribbling: 0.1 },
  DM: { defending: 0.35, passing: 0.3, physical: 0.2, dribbling: 0.1, pace: 0.05 },
  CM: { passing: 0.4, dribbling: 0.2, defending: 0.15, physical: 0.1, shooting: 0.1, pace: 0.05 },
  AM: { passing: 0.35, dribbling: 0.3, shooting: 0.25, pace: 0.1 },
  RM: { passing: 0.3, pace: 0.3, dribbling: 0.25, shooting: 0.1, physical: 0.05 },
  LM: { passing: 0.3, pace: 0.3, dribbling: 0.25, shooting: 0.1, physical: 0.05 },
  RW: { pace: 0.3, dribbling: 0.3, shooting: 0.25, passing: 0.15 },
  LW: { pace: 0.3, dribbling: 0.3, shooting: 0.25, passing: 0.15 },
  ST: { shooting: 0.5, pace: 0.2, physical: 0.15, dribbling: 0.15 },
};

export function calcOverall(position, attributes) {
  const w = OVR_WEIGHTS[position] || OVR_WEIGHTS.CM;
  let s = 0, t = 0;
  for (const k in w) { s += (Number(attributes[k]) || 50) * w[k]; t += w[k]; }
  return Math.round(s / t);
}

export const clampRating = (x) => Math.max(1, Math.min(99, Math.round(Number(x) || 1)));

export function uid(prefix = 'x') {
  let r = '';
  while (r.length < 9) r += Math.random().toString(36).slice(2);
  return prefix + r.slice(0, 9);
}

export function defaultKits(c1 = '#7c3aed', c2 = '#ffffff') {
  return {
    home: { style: 'plain', c1, c2, c3: c2, shorts: c2, socks: c1 },
    away: { style: 'plain', c1: c2, c2: c1, c3: c1, shorts: c1, socks: c2 },
    third: { style: 'sash', c1: '#111827', c2: c1, c3: c2, shorts: '#111827', socks: '#111827' },
  };
}

export function newClub(partial = {}) {
  const primary = (partial.colors && partial.colors.primary) || '#7c3aed';
  const secondary = (partial.colors && partial.colors.secondary) || '#ffffff';
  const ratings = { overall: 70, att: 70, mid: 70, def: 70, gk: 70, ...(partial.ratings || {}) };
  return {
    id: partial.id || uid('c'),
    name: partial.name || 'New Club FC',
    short: (partial.short || makeShort(partial.name || 'New Club')).toUpperCase().slice(0, 4),
    founded: partial.founded || 1900,
    country: partial.country || null,
    colors: { primary, secondary, ...(partial.colors || {}) },
    badge: partial.badge || { shape: 'shield', pattern: 'solid', emblem: 'ball', c1: primary, c2: secondary, c3: secondary, trim: secondary, text: 'short', stars: 0 },
    kits: partial.kits || defaultKits(primary, secondary),
    stadium: { name: 'Club Stadium', capacity: 25000, ...(partial.stadium || {}) },
    ratings,
    tactics: { formation: '4-4-2', style: 'balanced', ...(partial.tactics || {}) },
    honours: partial.honours || [],
    createdAt: partial.createdAt || Date.now(),
  };
}

export function makeShort(name) {
  const words = String(name).replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
    .filter((w) => !['FC', 'AFC', 'CF', 'SC', 'THE'].includes(w.toUpperCase()));
  if (!words.length) return 'CLB';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
}

export function newPlayer(partial = {}) {
  const position = POSITIONS.includes(partial.position) ? partial.position : 'CM';
  const attributes = { pace: 65, shooting: 60, passing: 65, dribbling: 62, defending: 55, physical: 65, goalkeeping: 20, ...(partial.attributes || {}) };
  return {
    id: partial.id || uid('p'),
    clubId: partial.clubId || null,
    name: partial.name || 'New Player',
    nation: partial.nation || 'ENG',
    age: partial.age || 24,
    position,
    overall: clampRating(partial.overall != null ? partial.overall : calcOverall(position, attributes)),
    attributes,
    number: partial.number || 0,
    foot: partial.foot || 'Right',
    career: { apps: 0, goals: 0, assists: 0, seasons: 0, ...(partial.career || {}) },
    createdAt: partial.createdAt || Date.now(),
  };
}

export const LEAGUE_DEFAULTS = {
  legs: 2,
  pointsWin: 3,
  pointsDraw: 1,
  tiebreak: 'gd', // 'gd' (GD, GF, H2H) or 'h2h' (H2H, GD, GF)
  daysBetweenRounds: 7,
  championsSpots: 1,
  continentalSpots: 4,
  promotionSpots: 0,
  relegationSpots: 3,
  upperLeagueId: null,
  lowerLeagueId: null,
  startYear: 2026,
  seedMode: 'random', // 'random' or 'fixed'
  fixedSeed: '',
};

export function newLeague(partial = {}) {
  return {
    id: partial.id || uid('l'),
    name: partial.name || 'New League',
    short: partial.short || makeShort(partial.name || 'New League'),
    logo: partial.logo || { shape: 'circle', pattern: 'solid', emblem: 'trophy', c1: '#7c3aed', c2: '#1e1b4b', c3: '#ffffff', trim: '#ffffff', text: 'none', stars: 0 },
    clubIds: partial.clubIds || [],
    config: { ...LEAGUE_DEFAULTS, ...(partial.config || {}) },
    season: null,
    history: [],
    createdAt: partial.createdAt || Date.now(),
  };
}

export function seasonLabel(startYear, number) {
  const y = Number(startYear) + number - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}
