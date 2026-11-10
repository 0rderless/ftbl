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

// Real European clubs outside the Champions League field, for the Europa League and Conference League.
// Same columns as above. Ratings are approximate; badges are original designs in club colours.
export const EUROPA_CLUBS = [
  ['Napoli', 'NAP', 'ITA', 83, '#38bdf8', '#ffffff', 'Stadio Diego Armando Maradona', 54726, 1926, 'circle', 'solid', 'monogram'],
  ['Atalanta', 'ATA', 'ITA', 82, '#1e3a8a', '#111827', 'Gewiss Stadium', 24950, 1907, 'shield', 'stripes', 'monogram'],
  ['Tottenham Hotspur', 'TOT', 'ENG', 82, '#ffffff', '#0f172a', 'Tottenham Hotspur Stadium', 62850, 1882, 'shield', 'solid', 'bird'],
  ['Manchester United', 'MUN', 'ENG', 81, '#dc2626', '#facc15', 'Old Trafford', 74310, 1878, 'circle', 'solid', 'trident'],
  ['Aston Villa', 'AVL', 'ENG', 81, '#7f1d1d', '#7dd3fc', 'Villa Park', 42640, 1874, 'shield', 'solid', 'crown'],
  ['Newcastle United', 'NEW', 'ENG', 81, '#111827', '#ffffff', 'St James\' Park', 52305, 1892, 'circle', 'stripes', 'castle'],
  ['RB Leipzig', 'RBL', 'GER', 81, '#ffffff', '#dc2626', 'Red Bull Arena', 47069, 2009, 'circle', 'solid', 'bull'],
  ['Roma', 'ROM', 'ITA', 80, '#991b1b', '#f59e0b', 'Stadio Olimpico', 70634, 1927, 'heater', 'solid', 'wolf'],
  ['Athletic Club', 'ATH', 'ESP', 80, '#dc2626', '#ffffff', 'San Mamés', 53289, 1898, 'shield', 'stripes', 'tree'],
  ['Lazio', 'LAZ', 'ITA', 79, '#7dd3fc', '#ffffff', 'Stadio Olimpico', 70634, 1900, 'shield', 'solid', 'eagle'],
  ['Real Sociedad', 'RSO', 'ESP', 79, '#1d4ed8', '#ffffff', 'Anoeta', 39500, 1909, 'circle', 'stripes', 'crown'],
  ['Villarreal', 'VIL', 'ESP', 79, '#facc15', '#1e3a8a', 'Estadio de la Cerámica', 23500, 1923, 'oval', 'solid', 'sun'],
  ['Marseille', 'OM', 'FRA', 79, '#ffffff', '#0ea5e9', 'Stade Vélodrome', 67394, 1899, 'shield', 'solid', 'star'],
  ['Lille', 'LIL', 'FRA', 79, '#dc2626', '#1e3a8a', 'Stade Pierre-Mauroy', 50186, 1944, 'circle', 'solid', 'bird'],
  ['Eintracht Frankfurt', 'SGE', 'GER', 79, '#111827', '#dc2626', 'Deutsche Bank Park', 58000, 1899, 'circle', 'solid', 'eagle'],
  ['Ajax', 'AJA', 'NED', 79, '#ffffff', '#dc2626', 'Johan Cruijff ArenA', 55865, 1900, 'oval', 'centre', 'monogram'],
  ['Real Betis', 'BET', 'ESP', 78, '#16a34a', '#ffffff', 'Estadio Benito Villamarín', 60721, 1907, 'shield', 'stripes', 'monogram'],
  ['Lyon', 'OL', 'FRA', 78, '#ffffff', '#1e3a8a', 'Groupama Stadium', 59186, 1950, 'circle', 'bend', 'wolf'],
  ['Fenerbahçe', 'FB', 'TUR', 78, '#facc15', '#1e3a8a', 'Şükrü Saracoğlu Stadium', 47834, 1907, 'circle', 'stripes', 'monogram'],
  ['VfB Stuttgart', 'VFB', 'GER', 78, '#ffffff', '#dc2626', 'MHPArena', 60449, 1893, 'shield', 'band', 'gem'],
  ['West Ham United', 'WHU', 'ENG', 78, '#7f1d1d', '#7dd3fc', 'London Stadium', 62500, 1895, 'shield', 'solid', 'hammers'],
  ['Sevilla', 'SEV', 'ESP', 77, '#ffffff', '#dc2626', 'Ramón Sánchez-Pizjuán', 43883, 1890, 'heater', 'halves', 'monogram'],
  ['Fiorentina', 'FIO', 'ITA', 77, '#7c3aed', '#ffffff', 'Stadio Artemio Franchi', 43147, 1926, 'pointed', 'solid', 'clover'],
  ['Beşiktaş', 'BJK', 'TUR', 76, '#111827', '#ffffff', 'Tüpraş Stadium', 42590, 1903, 'circle', 'halves', 'star'],
  ['SC Braga', 'SCB', 'POR', 76, '#dc2626', '#ffffff', 'Estádio Municipal de Braga', 30286, 1921, 'shield', 'solid', 'castle'],
  ['Rangers', 'RAN', 'SCO', 75, '#1d4ed8', '#ffffff', 'Ibrox Stadium', 50817, 1872, 'circle', 'solid', 'monogram'],
  ['AZ Alkmaar', 'AZ', 'NED', 75, '#dc2626', '#ffffff', 'AFAS Stadion', 19478, 1967, 'square', 'solid', 'monogram'],
  ['Anderlecht', 'AND', 'BEL', 74, '#7c3aed', '#ffffff', 'Lotto Park', 21500, 1908, 'oval', 'solid', 'crown'],
  ['PAOK', 'PAOK', 'GRE', 74, '#111827', '#ffffff', 'Toumba Stadium', 28703, 1926, 'circle', 'stripes', 'eagle'],
  ['Young Boys', 'YB', 'SUI', 73, '#facc15', '#111827', 'Stadion Wankdorf', 31783, 1898, 'circle', 'solid', 'monogram'],
];

export const CONFERENCE_CLUBS = [
  ['Brighton & Hove Albion', 'BHA', 'ENG', 77, '#1d4ed8', '#ffffff', 'Amex Stadium', 31876, 1901, 'circle', 'stripes', 'bird'],
  ['Crystal Palace', 'CRY', 'ENG', 76, '#1d4ed8', '#dc2626', 'Selhurst Park', 25486, 1905, 'shield', 'halves', 'eagle'],
  ['Nottingham Forest', 'NFO', 'ENG', 76, '#dc2626', '#ffffff', 'City Ground', 30404, 1865, 'shield', 'solid', 'tree'],
  ['Bologna', 'BOL', 'ITA', 76, '#991b1b', '#1e3a8a', 'Stadio Renato Dall\'Ara', 36462, 1909, 'shield', 'halves', 'monogram'],
  ['SC Freiburg', 'SCF', 'GER', 76, '#dc2626', '#111827', 'Europa-Park Stadion', 34700, 1904, 'octagon', 'solid', 'mountain'],
  ['Nice', 'NIC', 'FRA', 76, '#dc2626', '#111827', 'Allianz Riviera', 36178, 1904, 'shield', 'stripes', 'eagle'],
  ['Borussia Mönchengladbach', 'BMG', 'GER', 75, '#ffffff', '#16a34a', 'Borussia-Park', 54042, 1900, 'diamond', 'solid', 'monogram'],
  ['Rennes', 'REN', 'FRA', 75, '#dc2626', '#111827', 'Roazhon Park', 29778, 1901, 'heater', 'halves', 'monogram'],
  ['Lens', 'RCL', 'FRA', 75, '#facc15', '#dc2626', 'Stade Bollaert-Delelis', 38223, 1906, 'shield', 'halves', 'flame'],
  ['Celta Vigo', 'CEV', 'ESP', 74, '#7dd3fc', '#ffffff', 'Balaídos', 24870, 1923, 'pointed', 'cross', 'monogram'],
  ['Torino', 'TOR', 'ITA', 74, '#7f1d1d', '#ffffff', 'Stadio Olimpico Grande Torino', 27958, 1906, 'oval', 'solid', 'bull'],
  ['Union Saint-Gilloise', 'USG', 'BEL', 74, '#facc15', '#1e3a8a', 'Stade Joseph Marien', 9400, 1897, 'shield', 'solid', 'monogram'],
  ['Slavia Prague', 'SLA', 'CZE', 74, '#dc2626', '#ffffff', 'Fortuna Arena', 19370, 1892, 'circle', 'halves', 'star'],
  ['FC Twente', 'TWE', 'NED', 73, '#dc2626', '#ffffff', 'De Grolsch Veste', 30205, 1965, 'shield', 'solid', 'monogram'],
  ['Trabzonspor', 'TS', 'TUR', 73, '#7f1d1d', '#7dd3fc', 'Papara Park', 40782, 1967, 'circle', 'stripes', 'wave'],
  ['AEK Athens', 'AEK', 'GRE', 73, '#facc15', '#111827', 'OPAP Arena', 32500, 1924, 'shield', 'solid', 'eagle'],
  ['Panathinaikos', 'PAO', 'GRE', 73, '#16a34a', '#ffffff', 'Apostolos Nikolaidis Stadium', 16003, 1908, 'circle', 'solid', 'clover'],
  ['Bodø/Glimt', 'BOD', 'NOR', 73, '#facc15', '#111827', 'Aspmyra Stadion', 8270, 1916, 'shield', 'solid', 'sun'],
  ['Malmö FF', 'MFF', 'SWE', 73, '#7dd3fc', '#ffffff', 'Eleda Stadion', 22500, 1910, 'circle', 'solid', 'monogram'],
  ['Sparta Prague', 'SPA', 'CZE', 72, '#991b1b', '#ffffff', 'Letná Stadium', 18944, 1893, 'shield', 'solid', 'star'],
  ['FC Basel', 'BAS', 'SUI', 72, '#dc2626', '#1e3a8a', 'St. Jakob-Park', 38512, 1893, 'shield', 'halves', 'monogram'],
  ['Ferencváros', 'FTC', 'HUN', 72, '#16a34a', '#ffffff', 'Groupama Aréna', 22000, 1899, 'circle', 'stripes', 'eagle'],
  ['Vitória de Guimarães', 'VSC', 'POR', 72, '#ffffff', '#111827', 'Estádio D. Afonso Henriques', 30000, 1922, 'heater', 'solid', 'castle'],
  ['Legia Warsaw', 'LEG', 'POL', 71, '#16a34a', '#dc2626', 'Stadion Legii', 31103, 1916, 'shield', 'band', 'monogram'],
  ['Rapid Wien', 'RAP', 'AUT', 71, '#16a34a', '#ffffff', 'Allianz Stadion', 28345, 1899, 'circle', 'halves', 'monogram'],
  ['Partizan', 'PAR', 'SRB', 71, '#111827', '#ffffff', 'Partizan Stadium', 29775, 1945, 'shield', 'stripes', 'star'],
  ['Brøndby', 'BIF', 'DEN', 70, '#facc15', '#1e3a8a', 'Brøndby Stadium', 28100, 1964, 'circle', 'solid', 'monogram'],
  ['Hajduk Split', 'HAJ', 'CRO', 70, '#ffffff', '#1e3a8a', 'Poljud', 33987, 1911, 'circle', 'checks', 'monogram'],
  ['Lech Poznań', 'LPO', 'POL', 70, '#1e40af', '#ffffff', 'Stadion Poznań', 42837, 1922, 'shield', 'solid', 'monogram'],
  ['Maccabi Tel Aviv', 'MTA', 'ISR', 70, '#facc15', '#1e3a8a', 'Bloomfield Stadium', 29400, 1906, 'circle', 'solid', 'star'],
  ['Aberdeen', 'ABE', 'SCO', 69, '#dc2626', '#ffffff', 'Pittodrie Stadium', 20866, 1903, 'shield', 'solid', 'castle'],
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
export function addContinentalClubs(world, count = 32, seed = 'continental', list = CONTINENTAL_CLUBS, { skipExisting = false } = {}) {
  const rng = new RNG(seed);
  const taken = new Set(Object.values(world.clubs).map((c) => c.name.toLowerCase()));
  const ids = [];
  list.slice(0, count).forEach((entry) => {
    const [name, short, country, rating, p, s2, stadium, capacity, founded, , pattern] = entry;
    let nm = name;
    if (taken.has(nm.toLowerCase())) {
      if (skipExisting) return; // already in the world (e.g. added by hand)
      nm += ' (UCL)';
    }
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
