// Fictional continental clubs used to fill a Champions League field.
import { RNG } from '../core/rng.js';
import { newClub } from './model.js';
import { generateSquad } from './generate.js';
import { FORMATION_KEYS, STYLE_KEYS } from '../engine/tactics.js';

// Real European clubs for the Champions League field (names, colours, countries, stadiums).
// Badges are original designs in club colours, not the official crests. Ratings are approximate.
// name, short, country, rating, primary, secondary, stadium, capacity, founded, badge shape, pattern, emblem
export const CONTINENTAL_CLUBS = [
  ['Real Madrid', 'RMA', 'ESP', 91, '#ffffff', '#facc15', 'Santiago Bernabéu', 83186, 1902, 'circle', 'solid', 'crown'],
  ['Manchester City', 'MCI', 'ENG', 90, '#7dd3fc', '#ffffff', 'Etihad Stadium', 53400, 1880, 'circle', 'solid', 'eagle'],
  ['Bayern Munich', 'FCB', 'GER', 89, '#dc2626', '#ffffff', 'Allianz Arena', 75024, 1900, 'circle', 'checks', 'monogram'],
  ['Liverpool', 'LIV', 'ENG', 89, '#c8102e', '#f5f5f4', 'Anfield', 61276, 1892, 'shield', 'solid', 'bird'],
  ['Barcelona', 'BAR', 'ESP', 89, '#1e3a8a', '#a50044', 'Spotify Camp Nou', 99354, 1899, 'french', 'stripes', 'ball'],
  ['Paris Saint-Germain', 'PSG', 'FRA', 88, '#0b1f4d', '#dc2626', 'Parc des Princes', 47929, 1970, 'circle', 'centre', 'monogram'],
  ['Arsenal', 'ARS', 'ENG', 88, '#dc2626', '#ffffff', 'Emirates Stadium', 60704, 1886, 'shield', 'solid', 'monogram'],
  ['Inter', 'INT', 'ITA', 87, '#1e40af', '#111827', 'San Siro', 75817, 1908, 'circle', 'stripes', 'monogram'],
  ['Atlético Madrid', 'ATM', 'ESP', 85, '#dc2626', '#ffffff', 'Metropolitano', 70460, 1903, 'heater', 'stripes', 'tree'],
  ['Chelsea', 'CHE', 'ENG', 84, '#1e40af', '#ffffff', 'Stamford Bridge', 40343, 1905, 'circle', 'solid', 'star'],
  ['Bayer Leverkusen', 'B04', 'GER', 84, '#dc2626', '#111827', 'BayArena', 30210, 1904, 'hexagon', 'solid', 'bolt'],
  ['Borussia Dortmund', 'BVB', 'GER', 83, '#facc15', '#111827', 'Signal Iduna Park', 81365, 1909, 'circle', 'solid', 'monogram'],
  ['Juventus', 'JUV', 'ITA', 83, '#111827', '#ffffff', 'Allianz Stadium', 41507, 1897, 'pointed', 'stripes', 'monogram'],
  ['AC Milan', 'ACM', 'ITA', 83, '#dc2626', '#111827', 'San Siro', 75817, 1899, 'oval', 'stripes', 'monogram'],
  ['Benfica', 'SLB', 'POR', 81, '#dc2626', '#ffffff', 'Estádio da Luz', 64642, 1904, 'circle', 'solid', 'eagle'],
  ['Sporting CP', 'SCP', 'POR', 81, '#16a34a', '#ffffff', 'Estádio José Alvalade', 50095, 1906, 'heater', 'hoops', 'wolf'],
  ['FC Porto', 'FCP', 'POR', 80, '#1e40af', '#ffffff', 'Estádio do Dragão', 50033, 1893, 'shield', 'stripes', 'flame'],
  ['PSV Eindhoven', 'PSV', 'NED', 80, '#dc2626', '#ffffff', 'Philips Stadion', 35000, 1913, 'shield', 'stripes', 'bolt'],
  ['AS Monaco', 'ASM', 'FRA', 79, '#dc2626', '#ffffff', 'Stade Louis II', 18523, 1924, 'diamond', 'bend', 'crown'],
  ['Feyenoord', 'FEY', 'NED', 79, '#dc2626', '#ffffff', 'De Kuip', 47500, 1908, 'shield', 'halves', 'monogram'],
  ['Galatasaray', 'GAL', 'TUR', 79, '#f59e0b', '#991b1b', 'Rams Park', 52280, 1905, 'circle', 'halves', 'monogram'],
  ['Club Brugge', 'CLU', 'BEL', 77, '#1e40af', '#111827', 'Jan Breydel Stadium', 29062, 1891, 'shield', 'stripes', 'star'],
  ['Celtic', 'CEL', 'SCO', 77, '#16a34a', '#ffffff', 'Celtic Park', 60411, 1887, 'circle', 'hoops', 'clover'],
  ['Olympiacos', 'OLY', 'GRE', 76, '#dc2626', '#ffffff', 'Karaiskakis Stadium', 32115, 1925, 'circle', 'stripes', 'star'],
  ['FC Salzburg', 'SAL', 'AUT', 75, '#dc2626', '#ffffff', 'Stadion Salzburg', 30188, 1933, 'hexagon', 'solid', 'bull'],
  ['Dinamo Zagreb', 'DZG', 'CRO', 75, '#1e40af', '#ffffff', 'Stadion Maksimir', 24851, 1945, 'circle', 'solid', 'monogram'],
  ['Red Star Belgrade', 'CZV', 'SRB', 75, '#dc2626', '#ffffff', 'Rajko Mitić Stadium', 51755, 1945, 'circle', 'stripes', 'star'],
  ['Shakhtar Donetsk', 'SHA', 'UKR', 75, '#f97316', '#111827', 'Donbas Arena', 52187, 1936, 'circle', 'stripes', 'hammers'],
  ['FC Copenhagen', 'FCK', 'DEN', 74, '#ffffff', '#1e40af', 'Parken', 38065, 1992, 'shield', 'solid', 'crown'],
  ['Young Boys', 'YB', 'SUI', 73, '#facc15', '#111827', 'Stadion Wankdorf', 31783, 1898, 'circle', 'solid', 'monogram'],
  ['Malmö FF', 'MFF', 'SWE', 73, '#7dd3fc', '#ffffff', 'Eleda Stadion', 22500, 1910, 'circle', 'solid', 'monogram'],
  ['Sparta Prague', 'SPA', 'CZE', 72, '#991b1b', '#ffffff', 'Letná Stadium', 18944, 1893, 'shield', 'solid', 'star'],
];

// The fictional clubs used by the first version (renamed to real clubs by a one-time upgrade).
export const OLD_FICTIONAL = ['Real Montaver', 'FC Steinhafen', 'AC Verantina', 'Inter Lucavo', 'Olympique Marvelle', 'Atlético Castelbruna',
  'Fortuna Eisenwald', 'Sporting Alvarim', 'Ruyterstad', 'Virtus Calmara', 'Sporting Aldoria', 'Stade Rocheval', 'SV Brennholm',
  'Vitória Serrador', 'FC Portelinha', 'SC Veenhaven', 'Anadolu Kartal SK', 'KV Brugelmont', 'AS Lumière', 'Glenmoray FC',
  'Bosfor Yıldız SK', 'Alpenstadt SV', 'Dinamo Adriavik', 'Poseidon FC', 'FC Stepograd', 'FC Lacbleu', 'FK Dunavgrad',
  'Kattegat BK', 'Malmhavn FF', 'FK Vltavín', 'Fjordheim IL', 'Orzeł Mazowia'];

function isLight(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
}

export function badgeFor(entry) {
  const [, , , , p, s, , , , shape, pattern, emblem] = entry;
  const accent = isLight(p) ? (isLight(s) ? '#111827' : s) : (isLight(s) ? s : '#ffffff');
  return { shape, pattern, emblem, c1: p, c2: s, c3: accent, trim: accent, text: shape === 'circle' ? 'ring' : 'bottom', border: 'double', stars: 0 };
}

const KIT_OF = { stripes: 'stripes', hoops: 'hoops', halves: 'halves', centre: 'centre', checks: 'plain', bend: 'sash' };

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
  CONTINENTAL_CLUBS.slice(0, count).forEach((entry) => {
    const [name, short, country, rating, p, s2, stadium, capacity, founded, , pattern] = entry;
    let nm = name;
    if (taken.has(nm.toLowerCase())) nm += ' (UCL)';
    const j = () => Math.round(rating + rng.normal(0, 2));
    const k = kits(rng, p, s2);
    k.home.style = KIT_OF[pattern] || 'plain';
    const c = newClub({
      name: nm, short, country,
      colors: { primary: p, secondary: s2 },
      badge: badgeFor(entry),
      kits: k,
      stadium: { name: stadium, capacity },
      ratings: { overall: rating, att: j(), mid: j(), def: j(), gk: j() },
      founded,
      tactics: { formation: rng.pick(FORMATION_KEYS), style: rng.pick(STYLE_KEYS) },
    });
    world.clubs[c.id] = c;
    for (const pl of generateSquad(c, [], { seed: seed + short, nation: country })) world.players[pl.id] = pl;
    ids.push(c.id);
  });
  return ids;
}

/**
 * Turn the old fictional continental clubs into real clubs, in place (results, stats
 * and the current draw are kept). Same-country clubs are matched first. Players keep
 * their names but their ratings are shifted to fit the new club's strength.
 * Clubs the user has already renamed are left alone.
 */
export function realizeContinentalClubs(world) {
  const olds = Object.values(world.clubs).filter((c) => OLD_FICTIONAL.includes(c.name));
  if (!olds.length) return [];
  const existing = new Set(Object.values(world.clubs).map((c) => c.name.toLowerCase()));
  const pool = CONTINENTAL_CLUBS.slice(0, 29).filter((e) => !existing.has(e[0].toLowerCase()));
  const pairs = [];
  const remaining = olds.slice().sort((a, b) => b.ratings.overall - a.ratings.overall);
  for (const c of remaining.slice()) {
    const i = pool.findIndex((e) => e[2] === c.country);
    if (i >= 0) { pairs.push([c, pool[i]]); pool.splice(i, 1); remaining.splice(remaining.indexOf(c), 1); }
  }
  remaining.forEach((c, i) => { if (pool[i]) pairs.push([c, pool[i]]); });
  const changes = [];
  for (const [c, entry] of pairs) {
    const [name, short, country, rating, p, s2, stadium, capacity, founded, , pattern] = entry;
    const delta = rating - c.ratings.overall;
    const shift = (v) => Math.max(1, Math.min(99, Math.round(v + delta)));
    changes.push({ from: c.name, to: name });
    c.name = name; c.short = short; c.country = country; c.founded = founded;
    c.colors = { primary: p, secondary: s2 };
    c.badge = badgeFor(entry);
    c.kits.home = { ...c.kits.home, style: KIT_OF[pattern] || 'plain', c1: p, c2: s2, c3: s2, socks: p };
    c.kits.away = { ...c.kits.away, c1: s2, c2: p, c3: p, shorts: s2, socks: s2 };
    c.stadium = { name: stadium, capacity };
    c.ratings = { overall: rating, att: shift(c.ratings.att), mid: shift(c.ratings.mid), def: shift(c.ratings.def), gk: shift(c.ratings.gk) };
    for (const pl of Object.values(world.players)) {
      if (pl.clubId !== c.id) continue;
      for (const k of Object.keys(pl.attributes)) pl.attributes[k] = shift(pl.attributes[k]);
      pl.overall = shift(pl.overall);
    }
  }
  return changes;
}
