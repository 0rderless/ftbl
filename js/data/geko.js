// The made-up country of Geko: extra Kronliga clubs, 80 lower-league clubs and the Daffers Cup.
import { RNG } from '../core/rng.js';
import { newClub, newLeague } from './model.js';
import { generateSquad, SMALL_SQUAD } from './generate.js';
import { BADGE_PRESETS, LEAGUE_LOGO_PRESETS } from '../ui/badge.js';
import { FORMATION_KEYS, STYLE_KEYS } from '../engine/tactics.js';
import { startCupSeason } from '../league/cup.js';

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
  world.leagues[cup.id] = cup;
  startCupSeason(world, cup, 1);
  return cup;
}
