// Demo world: two linked divisions of fictional clubs.
import { RNG } from '../core/rng.js';
import { newClub, newLeague } from './model.js';
import { generateSquad } from './generate.js';
import { BADGE_PRESETS, LEAGUE_LOGO_PRESETS } from '../ui/badge.js';
import { FORMATION_KEYS, STYLE_KEYS } from '../engine/tactics.js';

// name, short, primary, secondary, badge preset index, rating, stadium, capacity, kit style, nation
const TOP = [
  ['Ravenmoor FC', 'RAV', '#5b21b6', '#facc15', 0, 84, 'The Rookery', 61200, 'plain', 'ENG'],
  ['Kingsport Athletic', 'KAT', '#dc2626', '#ffffff', 1, 83, 'Harbourside Park', 58400, 'stripes', 'ENG'],
  ['Ironvale United', 'IRV', '#1f2937', '#9ca3af', 2, 81, 'Foundry Lane', 47100, 'plain', 'ENG'],
  ['Northgate Rovers', 'NGR', '#1e3a8a', '#facc15', 3, 80, 'Eagle Heights', 52600, 'band', 'ENG'],
  ['Silverbrook City', 'SBC', '#0ea5e9', '#ffffff', 4, 79, 'The Docks', 44800, 'hoops', 'ENG'],
  ['Ashcombe Wanderers', 'ASH', '#991b1b', '#f5f5f4', 5, 78, 'Castle Road', 39200, 'halves', 'ENG'],
  ['Stormhaven Town', 'STO', '#111827', '#facc15', 6, 77, 'Thunder Park', 33700, 'plain', 'ENG'],
  ['Redcliffe Harriers', 'RED', '#f97316', '#dc2626', 7, 76, 'Furnace Ground', 31800, 'chevron', 'ENG'],
  ['Oakmere Rangers', 'OAK', '#065f46', '#fde68a', 8, 76, 'Greenwood Stadium', 30200, 'plain', 'ENG'],
  ['Highfield Albion', 'HIA', '#0ea5e9', '#1e3a8a', 9, 75, 'Summit Park', 28900, 'halves', 'ENG'],
  ['Brightwater Phoenix', 'BWP', '#38bdf8', '#ffffff', 10, 74, 'Sunrise Arena', 27400, 'sleeves', 'ENG'],
  ['Valemont Corinthians', 'VAL', '#14532d', '#ffffff', 11, 74, 'Crescent Field', 26100, 'plain', 'ENG'],
  ['Thornbury Forge', 'THF', '#1f2937', '#f59e0b', 12, 73, 'The Anvil', 25300, 'pinstripes', 'ENG'],
  ['Falconridge FC', 'FAL', '#7f1d1d', '#facc15', 13, 72, 'Colosseum Way', 24000, 'sash', 'ENG'],
  ['Blackwater Dynamos', 'BWD', '#0f766e', '#ffffff', 14, 72, 'Tidewater Stadium', 22600, 'plain', 'ENG'],
  ['Eastholm Spartans', 'EHS', '#dc2626', '#ffffff', 15, 71, 'Spartan Park', 21900, 'checks', 'ENG'],
  ['Goldcrest Athletic', 'GCA', '#ffffff', '#dc2626', 16, 70, 'St Aldric\'s Ground', 20400, 'centre', 'ENG'],
  ['Duskmere Saints', 'DSK', '#111827', '#dc2626', 17, 70, 'Matador Lane', 19800, 'halves', 'ENG'],
  ['Larkspur County', 'LAR', '#1e40af', '#ffffff', 18, 69, 'Swallow Park', 18700, 'band', 'ENG'],
  ['Westmarch Villa', 'WMV', '#111827', '#7c3aed', 19, 68, 'Monarch Road', 17300, 'centre', 'ENG'],
];

const SECOND = [
  ['Cloverdale Celtic', 'CLO', 20, 70, 'Shamrock Park'], ['Cogsworth Town', 'COG', 21, 69, 'The Works'],
  ['Gemfield United', 'GEM', 22, 68, 'Jewel Stadium'], ['Meridian FC', 'MER', 23, 67, 'Globe Park'],
  ['Starling Borough', 'STB', 24, 66, 'Starlight Ground'], ['Bowmen Athletic', 'BOW', 25, 66, 'Longbow Lane'],
  ['Keyhaven Rovers', 'KEY', 26, 65, 'Lockside'], ['Heartwell Hearts', 'HWH', 27, 64, 'Valentine Park'],
  ['Pinecrest Town', 'PIN', 8, 64, 'Timber Yard'], ['Saltmarsh City', 'SAL', 14, 63, 'Estuary Road'],
  ['Copperhill FC', 'COP', 12, 63, 'Smelter Park'], ['Wolfden Rangers', 'WOL', 2, 62, 'The Den'],
  ['Brackenford United', 'BRF', 9, 61, 'Fellside'], ['Emberton Athletic', 'EMB', 7, 61, 'Cinder Lane'],
  ['Gullhaven Town', 'GUL', 18, 60, 'Cliff Top'], ['Northwick Albion', 'NWA', 16, 59, 'Abbey Fields'],
];

function ratingsAround(rng, r) {
  const j = () => Math.round(r + rng.normal(0, 2.2));
  return { overall: r, att: j(), mid: j(), def: j(), gk: j() };
}

function kitsFor(rng, primary, secondary, style) {
  return {
    home: { style, c1: primary, c2: secondary, c3: secondary, shorts: rng.chance(0.6) ? '#ffffff' : primary, socks: primary },
    away: { style: rng.pick(['plain', 'sash', 'band', 'sleeves', 'fade']), c1: secondary, c2: primary, c3: primary, shorts: secondary, socks: secondary },
    third: { style: rng.pick(['plain', 'fade', 'pinstripes', 'hoops']), c1: rng.pick(['#111827', '#f5f5f4', '#7c3aed', '#065f46', '#f59e0b']), c2: primary, c3: secondary, shorts: '#111827', socks: '#111827' },
  };
}

export function buildDemoWorld(seed = 'ftbl-demo') {
  const rng = new RNG(seed);
  const clubs = {}, players = {}, leagues = {};
  const make = (name, short, primary, secondary, presetIdx, rating, stadium, capacity, style) => {
    const preset = BADGE_PRESETS[presetIdx % BADGE_PRESETS.length].spec;
    const c = newClub({
      name, short, colors: { primary, secondary },
      badge: { ...preset },
      kits: kitsFor(rng, primary, secondary, style),
      stadium: { name: stadium, capacity },
      ratings: ratingsAround(rng, rating),
      founded: rng.int(1872, 1935),
      tactics: { formation: rng.pick(FORMATION_KEYS), style: rng.pick(STYLE_KEYS) },
    });
    clubs[c.id] = c;
    for (const p of generateSquad(c, [], { seed: seed + c.short, nation: 'ENG' })) players[p.id] = p;
    return c.id;
  };
  const topIds = TOP.map((t) => make(t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8]));
  const secIds = SECOND.map((t) => {
    const p = BADGE_PRESETS[t[2] % BADGE_PRESETS.length].spec;
    return make(t[0], t[1], p.c1, p.c2 === p.c1 ? p.c3 : p.c2, t[2], t[3], t[4], rng.int(8000, 19000), rng.pick(['plain', 'stripes', 'hoops', 'halves', 'band']));
  });
  const top = newLeague({ name: 'Kronliga', short: 'KRL', clubIds: topIds, logo: { ...LEAGUE_LOGO_PRESETS[0].spec },
    config: { relegationSpots: 3, continentalSpots: 4 } });
  const second = newLeague({ name: 'Kronliga 2', short: 'KR2', clubIds: secIds, logo: { ...LEAGUE_LOGO_PRESETS[1].spec },
    config: { promotionSpots: 3, relegationSpots: 0, continentalSpots: 0 } });
  top.config.lowerLeagueId = second.id;
  second.config.upperLeagueId = top.id;
  leagues[top.id] = top; leagues[second.id] = second;
  return { clubs, players, leagues };
}
