// The made-up country of Geko: extra Kronliga clubs, 80 lower-league clubs and the Daffers Cup.
import { RNG } from '../core/rng.js';
import { newClub, newLeague } from './model.js';
import { generateSquad, SMALL_SQUAD } from './generate.js';
import { BADGE_PRESETS, LEAGUE_LOGO_PRESETS } from '../ui/badge.js';
import { FORMATION_KEYS, STYLE_KEYS } from '../engine/tactics.js';
import { startCupSeason } from '../league/cup.js';
import { startSeason } from '../league/season.js';

const COLOURS = ['#dc2626', '#1e40af', '#16a34a', '#facc15', '#111827', '#ffffff', '#7c3aed', '#f97316', '#0ea5e9', '#991b1b', '#065f46', '#be123c', '#78350f', '#14b8a6', '#1e3a8a', '#f59e0b'];

// name, short, rating, primary, secondary, stadium, capacity
export const NEW_KRONLIGA_CLUBS = [
  ['Greenwich', 'GRE', 81, '#1e3a8a', '#facc15', 'Meridian Park', 24500],
  ['Welling United', 'WEL', 80, '#dc2626', '#ffffff', 'Park View Road', 19800],
  ['Deptford City', 'DEP', 82, '#0ea5e9', '#ffffff', 'Dockyard Stadium', 26100],
  ['BZE', 'BZE', 79, '#111827', '#84cc16', 'BZE Arena', 18200],
  ['Kidbrooke Athletic', 'KID', 80, '#16a34a', '#ffffff', 'Kidbrooke Lane', 17400],
  ['Woolwich Wanderers', 'WOO', 81, '#7f1d1d', '#7dd3fc', 'Arsenal Way', 22300],
  ['Sidcup Phoenix', 'SID', 79, '#f97316', '#111827', 'Phoenix Ground', 16900],
  ['Rivermead Athletic', 'RIV', 82, '#14b8a6', '#ffffff', 'Rivermead Stadium', 23700],
];

function clubSpec(rng, name, short, rating, primary, secondary, stadium, capacity, country) {
  const preset = rng.pick(BADGE_PRESETS).spec;
  const light = ['#ffffff', '#facc15', '#f59e0b', '#84cc16', '#7dd3fc'].includes(secondary);
  const j = () => Math.round(rating + rng.normal(0, 2));
  return {
    name, short, country,
    colors: { primary, secondary },
    badge: { ...preset, c1: primary, c2: secondary, c3: light ? secondary : '#ffffff', trim: light ? secondary : '#ffffff', text: rng.pick(['bottom', 'top', 'none']), stars: 0 },
    kits: {
      home: { style: rng.pick(['plain', 'plain', 'stripes', 'hoops', 'halves', 'band', 'sash']), c1: primary, c2: secondary, c3: secondary, shorts: rng.chance(0.5) ? secondary : primary, socks: primary },
      away: { style: rng.pick(['plain', 'sash', 'band', 'sleeves']), c1: secondary, c2: primary, c3: primary, shorts: secondary, socks: secondary },
      third: { style: 'plain', c1: '#111827', c2: primary, c3: secondary, shorts: '#111827', socks: '#111827' },
    },
    stadium: { name: stadium, capacity },
    ratings: { overall: rating, att: j(), mid: j(), def: j(), gk: j() },
    founded: rng.int(1875, 1960),
    tactics: { formation: rng.pick(FORMATION_KEYS), style: rng.pick(STYLE_KEYS) },
  };
}

function addClub(world, spec, squadSeed, template) {
  const c = newClub(spec);
  world.clubs[c.id] = c;
  for (const p of generateSquad(c, [], { seed: squadSeed, nation: 'GEK', template })) world.players[p.id] = p;
  return c;
}

/** Add the 8 new Kronliga clubs (skipping any name that already exists). Returns their ids. */
export function addNewKronligaClubs(world) {
  const rng = new RNG('kronliga-8');
  const taken = new Set(Object.values(world.clubs).map((c) => c.name.toLowerCase()));
  const ids = [];
  for (const [name, short, rating, p, s, stadium, cap] of NEW_KRONLIGA_CLUBS) {
    if (taken.has(name.toLowerCase())) continue;
    ids.push(addClub(world, clubSpec(rng, name, short, rating, p, s, stadium, cap, null), 'kron8-' + short).id);
  }
  return ids;
}

// made-up Geko town names
const START = ['Ka', 'Ze', 'Mo', 'Ta', 'Ri', 'Vo', 'Lu', 'Be', 'Do', 'Ga', 'Ne', 'Sa', 'Ko', 'Fi', 'Ha', 'Ja', 'Pe', 'Ro', 'Wi', 'Bra', 'Cle', 'Dra', 'Fro', 'Gre', 'Kro', 'Pla', 'Sto', 'Tre', 'Vel', 'Zan'];
const MID = ['l', 'r', 'n', 'v', 'd', 's', 'm', 'k', 'z', 'nd', 'rt', 'st', 'lb', 'rk'];
const END = ['ara', 'ova', 'ent', 'ino', 'oro', 'ane', 'ika', 'enz', 'olt', 'heim', 'ira', 'on', 'ex', 'ey', 'wick', 'ford', 'mere', 'holt', 'stad', 'bury'];
const SUFFIX = ['United', 'Town', 'City', 'Rovers', 'Athletic', 'FC', 'Wanderers', 'Albion', 'Borough', 'County', 'Rangers', 'Dynamo', 'Sporting', 'Harriers', 'Villa', 'Swifts'];
const GROUND = ['Park', 'Road', 'Lane', 'Ground', 'Arena', 'Stadium', 'Meadow', 'Fields'];

export function gekoTownNames(n, seed = 'geko') {
  const rng = new RNG(seed);
  const out = new Set();
  while (out.size < n) out.add(rng.pick(START) + rng.pick(MID) + rng.pick(END));
  return [...out];
}

/** 80 made-up Geko clubs: 32 stronger (tier 2) and 48 smaller (tier 3). */
export function addGekoClubs(world, seed = 'geko') {
  const rng = new RNG(seed + '-clubs');
  const taken = new Set(Object.values(world.clubs).map((c) => c.name.toLowerCase()));
  const towns = gekoTownNames(120, seed);
  const tier2 = [], tier3 = [];
  let t = 0;
  for (let i = 0; i < 80; i++) {
    let name;
    do { name = `${towns[t++]} ${rng.pick(SUFFIX)}`; } while (taken.has(name.toLowerCase()) && t < towns.length);
    taken.add(name.toLowerCase());
    const top = i < 32;
    const rating = Math.round(top ? rng.float(64, 74) : rng.float(52, 65));
    const p = rng.pick(COLOURS);
    let s = rng.pick(COLOURS); while (s === p) s = rng.pick(COLOURS);
    const town = name.split(' ')[0];
    const short = (town.slice(0, 3)).toUpperCase();
    const cap = top ? rng.int(6000, 16000) : rng.int(1200, 7000);
    const c = addClub(world, clubSpec(rng, name, short, rating, p, s, `${town} ${rng.pick(GROUND)}`, cap, 'GEK'), `${seed}-${i}`, SMALL_SQUAD);
    (top ? tier2 : tier3).push(c.id);
  }
  return { tier2, tier3 };
}

/** The Daffers Cup: knockout for every club in Geko. Lower clubs start in round 1, Kronliga joins in round 3. */
export function createDaffersCup(world, kron, { seed = 'geko' } = {}) {
  const { tier2, tier3 } = addGekoClubs(world, seed);
  const cup = newLeague({
    name: 'Daffers Cup', short: 'DAF',
    logo: { shape: 'shield', pattern: 'rays', emblem: 'trophy', c1: '#14532d', c2: '#166534', c3: '#facc15', trim: '#facc15', text: 'none', border: 'double', stars: 0 },
    config: { startYear: kron.config.startYear + ((kron.season && kron.season.number) || 1) - 1, championsSpots: 1, continentalSpots: 0, relegationSpots: 0 },
  });
  cup.type = 'cup';
  cup.format = 'knockout';
  cup.config.finalVenue = 'Geko National Stadium';
  cup.config.entries = [
    { round: 1, clubIds: tier3, label: 'Geko lower leagues' },
    { round: 3, clubIds: tier2, label: 'Geko regional clubs' },
    { round: 3, leagueId: kron.id, label: kron.name },
  ];
  cup.config.pool = [...tier3, ...tier2];
  world.leagues[cup.id] = cup;
  startCupSeason(world, cup, 1);
  return cup;
}

/**
 * Pick Division 2: Geko clubs outside Kronliga. Daffers Cup winners are in automatically,
 * then the clubs with the most all-time Daffers Cup points (3 a win, 1 a draw), until there are `size`.
 */
export function pickDivision2(world, kron, daffers, size = 20, leaderboard = null) {
  const inKron = new Set(kron.clubIds);
  const pool = ((daffers && daffers.config.pool) || Object.keys(world.clubs).filter((id) => world.clubs[id].country === 'GEK'))
    .filter((id) => world.clubs[id] && !inKron.has(id));
  const rows = {};
  for (const r of leaderboard || []) rows[r.clubId] = r;
  const winners = new Set((daffers ? daffers.history : []).map((h) => h.championId));
  const pts = (id) => (rows[id] ? rows[id].w * 3 + rows[id].d : 0);
  const sorted = pool.slice().sort((a, b) =>
    (winners.has(b) - winners.has(a)) || pts(b) - pts(a) || world.clubs[b].ratings.overall - world.clubs[a].ratings.overall);
  return sorted.slice(0, size);
}

/** Create Division 2 below Kronliga (3 up / 3 down) and make the Daffers Cup follow the leagues. */
export function createDivision2(world, kron, daffers, leaderboard) {
  const ids = pickDivision2(world, kron, daffers, 20, leaderboard);
  const div = newLeague({
    name: 'Division 2', short: 'DIV2', clubIds: ids,
    logo: { shape: 'shield', pattern: 'split', emblem: 'stars3', c1: '#334155', c2: '#1e293b', c3: '#e2e8f0', trim: '#94a3b8', text: 'none', border: 'double', stars: 0 },
    config: { legs: 2, startYear: kron.config.startYear, championsSpots: 1, continentalSpots: 0, promotionSpots: 3, relegationSpots: 0, tiebreak: kron.config.tiebreak, daysBetweenRounds: kron.config.daysBetweenRounds },
  });
  div.config.upperLeagueId = kron.id;
  kron.config.lowerLeagueId = div.id;
  kron.config.relegationSpots = 3;
  world.leagues[div.id] = div;
  // Division 2 plays alongside Kronliga's current season, or its next one if Kronliga has just finished
  const n = kron.season ? kron.season.number + (kron.season.finished ? 1 : 0) : 1;
  startSeason(div, n);
  if (daffers && daffers.format === 'knockout') {
    // pool = every club in Geko; entry rounds follow the leagues so promoted/relegated clubs enter in the right round
    daffers.config.pool = [...new Set([...(daffers.config.pool || []), ...(daffers.season ? daffers.season.clubIds : []), ...kron.clubIds, ...ids])];
    daffers.config.entries = [
      { round: 1, rest: true, weakest: 24, label: 'Geko non-league (smallest)' },
      { round: 2, rest: true, label: 'Geko non-league' },
      { round: 3, leagueId: div.id, label: 'Division 2' },
      { round: 3, leagueId: kron.id, label: 'Kronliga' },
    ];
    // the leagues are placed first so they never land in the non-league rounds
    daffers.config.entries = [daffers.config.entries[2], daffers.config.entries[3], daffers.config.entries[0], daffers.config.entries[1]];
  }
  return div;
}
