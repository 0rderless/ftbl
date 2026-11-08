// Fictional continental clubs used to fill a Champions League field.
import { RNG } from '../core/rng.js';
import { newClub } from './model.js';
import { generateSquad } from './generate.js';
import { BADGE_PRESETS } from '../ui/badge.js';
import { FORMATION_KEYS, STYLE_KEYS } from '../engine/tactics.js';

// name, short, country, rating, primary, secondary, stadium, capacity
export const CONTINENTAL_CLUBS = [
  ['Real Montaver', 'RMV', 'ESP', 90, '#f5f5f4', '#7c3aed', 'Estadio Montaver', 81000],
  ['FC Steinhafen', 'STH', 'GER', 89, '#dc2626', '#ffffff', 'Steinhafen Arena', 75000],
  ['AC Verantina', 'VER', 'ITA', 87, '#991b1b', '#111827', 'Stadio Verantino', 72000],
  ['Inter Lucavo', 'INL', 'ITA', 86, '#1e40af', '#111827', 'Stadio del Lago', 70000],
  ['Olympique Marvelle', 'OMV', 'FRA', 86, '#1e3a8a', '#dc2626', 'Parc Marvelle', 62000],
  ['Atlético Castelbruna', 'ACB', 'ESP', 85, '#dc2626', '#ffffff', 'Estadio Castelbruna', 68000],
  ['Fortuna Eisenwald', 'FEW', 'GER', 83, '#facc15', '#111827', 'Eisenwald Stadion', 81000],
  ['Sporting Alvarim', 'SAL', 'POR', 81, '#16a34a', '#ffffff', 'Estádio Alvarim', 50000],
  ['Ruyterstad', 'RUY', 'NED', 80, '#dc2626', '#ffffff', 'Ruyter Arena', 55000],
  ['Virtus Calmara', 'VCA', 'ITA', 80, '#facc15', '#1e3a8a', 'Stadio Calmara', 43000],
  ['Sporting Aldoria', 'SAD', 'ESP', 79, '#065f46', '#ffffff', 'Campo de Aldoria', 47000],
  ['Stade Rocheval', 'SRV', 'FRA', 79, '#0ea5e9', '#ffffff', 'Stade de la Roche', 41000],
  ['SV Brennholm', 'BRH', 'GER', 78, '#16a34a', '#ffffff', 'Brennholm Park', 50000],
  ['Vitória Serrador', 'VSE', 'POR', 78, '#111827', '#ffffff', 'Estádio da Serra', 38000],
  ['FC Portelinha', 'POR', 'POR', 77, '#2563eb', '#ffffff', 'Estádio do Porto Velho', 52000],
  ['SC Veenhaven', 'VEE', 'NED', 77, '#f97316', '#1e3a8a', 'Veenhaven Stadion', 35000],
  ['Anadolu Kartal SK', 'AKS', 'TUR', 77, '#111827', '#ffffff', 'Kartal Arena', 52000],
  ['KV Brugelmont', 'BRU', 'BEL', 76, '#1e40af', '#111827', 'Jan Brugel Stadion', 29000],
  ['AS Lumière', 'ASL', 'FRA', 76, '#f97316', '#111827', 'Stade Lumière', 36000],
  ['Glenmoray FC', 'GLE', 'SCO', 76, '#16a34a', '#ffffff', 'Glenmoray Park', 58000],
  ['Bosfor Yıldız SK', 'BYS', 'TUR', 75, '#facc15', '#dc2626', 'Yıldız Stadı', 47000],
  ['Alpenstadt SV', 'ALP', 'AUT', 75, '#dc2626', '#ffffff', 'Alpenstadion', 30000],
  ['Dinamo Adriavik', 'DAD', 'CRO', 75, '#2563eb', '#ffffff', 'Stadion Adriavik', 35000],
  ['Poseidon FC', 'POS', 'GRE', 75, '#ffffff', '#1e40af', 'Poseidon Stadium', 33000],
  ['FC Stepograd', 'STG', 'UKR', 75, '#f97316', '#111827', 'Stepograd Arena', 40000],
  ['FC Lacbleu', 'LAC', 'SUI', 74, '#0ea5e9', '#ffffff', 'Stade du Lac', 32000],
  ['FK Dunavgrad', 'DUN', 'SRB', 74, '#dc2626', '#ffffff', 'Stadion Dunav', 51000],
  ['Kattegat BK', 'KAT', 'DEN', 74, '#38bdf8', '#ffffff', 'Kattegat Park', 38000],
  ['Malmhavn FF', 'MAL', 'SWE', 73, '#38bdf8', '#ffffff', 'Malmhavn Arena', 24000],
  ['FK Vltavín', 'VLT', 'CZE', 73, '#dc2626', '#ffffff', 'Stadion Vltavín', 21000],
  ['Fjordheim IL', 'FJO', 'NOR', 73, '#facc15', '#111827', 'Fjordheim Stadion', 21000],
  ['Orzeł Mazowia', 'ORZ', 'POL', 72, '#ffffff', '#dc2626', 'Stadion Orła', 31000],
];

function kits(rng, p, s) {
  return {
    home: { style: rng.pick(['plain', 'plain', 'stripes', 'hoops', 'halves', 'band', 'sash']), c1: p, c2: s, c3: s, shorts: rng.chance(0.5) ? s : p, socks: p },
    away: { style: rng.pick(['plain', 'sash', 'band', 'sleeves', 'fade']), c1: s, c2: p, c3: p, shorts: s, socks: s },
    third: { style: rng.pick(['plain', 'fade', 'pinstripes']), c1: rng.pick(['#111827', '#7c3aed', '#065f46', '#f59e0b']), c2: p, c3: s, shorts: '#111827', socks: '#111827' },
  };
}

/** Create continental clubs (with squads) in the world. Returns their ids, strongest first. */
export function addContinentalClubs(world, count = 32, seed = 'continental') {
  const rng = new RNG(seed);
  const taken = new Set(Object.values(world.clubs).map((c) => c.name.toLowerCase()));
  const ids = [];
  CONTINENTAL_CLUBS.slice(0, count).forEach(([name, short, country, rating, p, s, stadium, capacity], i) => {
    let nm = name;
    if (taken.has(nm.toLowerCase())) nm += ' CF';
    const j = () => Math.round(rating + rng.normal(0, 2));
    const preset = BADGE_PRESETS[(i * 7) % BADGE_PRESETS.length].spec;
    const c = newClub({
      name: nm, short, country,
      colors: { primary: p, secondary: s },
      badge: { ...preset, c1: p, c2: s, c3: s === '#ffffff' ? '#ffffff' : '#facc15', trim: s },
      kits: kits(rng, p, s),
      stadium: { name: stadium, capacity },
      ratings: { overall: rating, att: j(), mid: j(), def: j(), gk: j() },
      founded: rng.int(1880, 1930),
      tactics: { formation: rng.pick(FORMATION_KEYS), style: rng.pick(STYLE_KEYS) },
    });
    world.clubs[c.id] = c;
    for (const pl of generateSquad(c, [], { seed: seed + short, nation: country })) world.players[pl.id] = pl;
    ids.push(c.id);
  });
  return ids;
}
