// SVG badge / logo renderer. Pure string output so it also works outside the browser.
// A badge spec: { shape, pattern, emblem, c1, c2, c3, trim, text, stars, border }

let counter = 0;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- shapes (100 x 120 box) ----------
export const SHAPES = {
  shield: { label: 'Classic Shield', d: 'M10,8 H90 V56 C90,86 70,102 50,113 C30,102 10,86 10,56 Z' },
  heater: { label: 'Heater', d: 'M8,10 Q50,1 92,10 V50 Q92,92 50,114 Q8,92 8,50 Z' },
  crest: { label: 'Round Crest', d: 'M12,8 H88 V72 A38,38 0 0 1 12,72 Z' },
  french: { label: 'French Shield', d: 'M10,8 H90 V72 Q90,98 62,100 Q53,102 50,113 Q47,102 38,100 Q10,98 10,72 Z' },
  pointed: { label: 'Pointed', d: 'M10,8 H90 V78 L50,113 L10,78 Z' },
  scalloped: { label: 'Scalloped', d: 'M10,14 Q30,2 50,14 Q70,2 90,14 V58 C90,86 70,102 50,113 C30,102 10,86 10,58 Z' },
  tower: { label: 'Fortress', d: 'M10,22 H22 V10 H35 V22 H44 V10 H56 V22 H65 V10 H78 V22 H90 V60 C90,88 70,102 50,113 C30,102 10,88 10,60 Z' },
  circle: { label: 'Circle', d: 'M50,14 A46,46 0 1 1 49.99,14 Z', round: true },
  oval: { label: 'Oval', d: 'M50,6 A42,54 0 1 1 49.99,6 Z', round: true },
  hexagon: { label: 'Hexagon', d: 'M50,6 L94,32 V88 L50,114 L6,88 V32 Z' },
  octagon: { label: 'Octagon', d: 'M32,8 H68 L92,32 V88 L68,112 H32 L8,88 V32 Z' },
  diamond: { label: 'Diamond', d: 'M50,4 L96,60 L50,116 L4,60 Z' },
  square: { label: 'Rounded Square', d: 'M22,12 H78 Q90,12 90,24 V96 Q90,108 78,108 H22 Q10,108 10,96 V24 Q10,12 22,12 Z' },
  pennant: { label: 'Pennant', d: 'M8,8 H92 V70 L50,114 L8,70 Z' },
};

// ---------- patterns (drawn in c2 over a c1 base) ----------
export const PATTERNS = {
  solid: { label: 'Solid', svg: () => '' },
  stripes: { label: 'Stripes', svg: (c) => [10, 30, 50, 70].map((x) => `<rect x="${x}" y="0" width="10" height="120" fill="${c}"/>`).join('') },
  pinstripes: { label: 'Pinstripes', svg: (c) => Array.from({ length: 10 }, (_, i) => `<rect x="${i * 10 + 4}" y="0" width="2.2" height="120" fill="${c}"/>`).join('') },
  hoops: { label: 'Hoops', svg: (c) => [12, 36, 60, 84, 108].map((y) => `<rect x="0" y="${y}" width="100" height="12" fill="${c}"/>`).join('') },
  halves: { label: 'Halves', svg: (c) => `<rect x="50" y="0" width="50" height="120" fill="${c}"/>` },
  split: { label: 'Top / Bottom', svg: (c) => `<rect x="0" y="60" width="100" height="60" fill="${c}"/>` },
  quarters: { label: 'Quarters', svg: (c) => `<rect x="50" y="0" width="50" height="60" fill="${c}"/><rect x="0" y="60" width="50" height="60" fill="${c}"/>` },
  sash: { label: 'Sash', svg: (c) => `<polygon points="0,0 22,0 100,98 100,120 78,120 0,22" fill="${c}"/>` },
  bend: { label: 'Diagonal Split', svg: (c) => `<polygon points="100,0 100,120 0,120" fill="${c}"/>` },
  chevron: { label: 'Chevron', svg: (c) => `<polygon points="0,52 50,82 100,52 100,74 50,104 0,74" fill="${c}"/>` },
  cross: { label: 'Cross', svg: (c) => `<rect x="40" y="0" width="20" height="120" fill="${c}"/><rect x="0" y="46" width="100" height="20" fill="${c}"/>` },
  saltire: { label: 'Saltire', svg: (c) => `<polygon points="0,0 14,0 100,106 100,120 86,120 0,14" fill="${c}"/><polygon points="100,0 86,0 0,106 0,120 14,120 100,14" fill="${c}"/>` },
  checks: { label: 'Checks', svg: (c) => { let s = ''; for (let y = 0; y < 6; y++) for (let x = 0; x < 5; x++) if ((x + y) % 2) s += `<rect x="${x * 20}" y="${y * 20}" width="20" height="20" fill="${c}"/>`; return s; } },
  centre: { label: 'Centre Stripe', svg: (c) => `<rect x="35" y="0" width="30" height="120" fill="${c}"/>` },
  band: { label: 'Band', svg: (c) => `<rect x="0" y="44" width="100" height="26" fill="${c}"/>` },
  frame: { label: 'Inner Frame', svg: (c, shape) => `<path d="${shape.d}" fill="none" stroke="${c}" stroke-width="18"/>` },
  rays: { label: 'Sunburst', svg: (c) => { let s = ''; for (let i = 0; i < 12; i += 2) { const a1 = (i * 30) * Math.PI / 180, a2 = ((i + 1) * 30) * Math.PI / 180; s += `<polygon points="50,60 ${50 + 120 * Math.cos(a1)},${60 + 120 * Math.sin(a1)} ${50 + 120 * Math.cos(a2)},${60 + 120 * Math.sin(a2)}" fill="${c}"/>`; } return s; } },
};

// ---------- emblems (100 x 100 box). f = main colour, k = detail colour ----------
const star = (cx, cy, R, r, f) => {
  let pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * Math.PI / 180, rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${f}"/>`;
};
const pol = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
const sword = (f, k) => `<path d="M50,4 L56,14 V64 H44 V14 Z" fill="${f}"/><rect x="30" y="63" width="40" height="7" rx="3" fill="${f}"/><rect x="46.5" y="70" width="7" height="18" fill="${k}"/><circle cx="50" cy="92" r="5" fill="${f}"/>`;
const hammer = (f) => `<rect x="46" y="28" width="8" height="66" rx="2" fill="${f}" opacity=".85"/><path d="M24,10 H70 Q80,10 80,20 V32 H24 Z" fill="${f}"/>`;

export const EMBLEMS = {
  none: { label: 'None', svg: () => '' },
  ball: { label: 'Football', svg: (f, k) => {
    const pent = [0, 1, 2, 3, 4].map((i) => pol(50, 50, 13, -90 + i * 72).map((v) => v.toFixed(1)).join(',')).join(' ');
    let s = `<circle cx="50" cy="50" r="42" fill="${f}" stroke="${k}" stroke-width="3"/><polygon points="${pent}" fill="${k}"/>`;
    for (let i = 0; i < 5; i++) {
      const a = -90 + i * 72;
      const [x1, y1] = pol(50, 50, 13, a), [x2, y2] = pol(50, 50, 30, a);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${k}" stroke-width="2.5"/>`;
      const p = [pol(50, 50, 37, a - 22), pol(50, 50, 29, a), pol(50, 50, 37, a + 22), pol(50, 50, 41.5, a + 12), pol(50, 50, 41.5, a - 12)];
      s += `<polygon points="${p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${k}"/>`;
    }
    return s;
  } },
  crown: { label: 'Crown', svg: (f, k) => `<path d="M16,74 L12,30 L33,50 L50,20 L67,50 L88,30 L84,74 Z" fill="${f}"/><rect x="16" y="78" width="68" height="10" rx="2" fill="${f}"/><circle cx="12" cy="28" r="5" fill="${f}"/><circle cx="50" cy="17" r="5" fill="${f}"/><circle cx="88" cy="28" r="5" fill="${f}"/><circle cx="50" cy="60" r="5" fill="${k}"/><circle cx="32" cy="64" r="3.5" fill="${k}"/><circle cx="68" cy="64" r="3.5" fill="${k}"/>` },
  star: { label: 'Star', svg: (f) => star(50, 53, 46, 19, f) },
  stars3: { label: 'Three Stars', svg: (f) => star(50, 30, 22, 9, f) + star(24, 70, 20, 8, f) + star(76, 70, 20, 8, f) },
  bolt: { label: 'Lightning', svg: (f, k) => `<polygon points="60,2 18,56 46,56 36,98 84,38 56,38 68,2" fill="${f}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>` },
  flame: { label: 'Flame', svg: (f, k) => `<path d="M50,4 C62,24 82,36 80,62 C78,86 63,96 50,96 C37,96 20,86 20,62 C20,46 32,38 35,22 C43,34 44,42 48,46 C53,32 48,18 50,4 Z" fill="${f}"/><path d="M50,46 C56,58 66,64 64,76 C62,88 56,92 50,92 C44,92 36,88 36,76 C36,66 44,62 50,46 Z" fill="${k}"/>` },
  anchor: { label: 'Anchor', svg: (f) => `<g fill="none" stroke="${f}" stroke-width="8" stroke-linecap="round"><circle cx="50" cy="14" r="8"/><line x1="50" y1="22" x2="50" y2="90"/><line x1="30" y1="34" x2="70" y2="34"/><path d="M16,60 Q20,90 50,90 Q80,90 84,60"/></g><polygon points="8,64 24,56 18,72" fill="${f}"/><polygon points="92,64 76,56 82,72" fill="${f}"/>` },
  castle: { label: 'Castle', svg: (f, k) => `<path d="M14,94 V44 H10 V24 H22 V32 H32 V24 H44 V32 H56 V24 H68 V32 H78 V24 H90 V44 H86 V94 Z" fill="${f}"/><path d="M40,94 V74 A10,10 0 0 1 60,74 V94 Z" fill="${k}"/><rect x="24" y="52" width="9" height="13" rx="4" fill="${k}"/><rect x="67" y="52" width="9" height="13" rx="4" fill="${k}"/>` },
  eagle: { label: 'Eagle', svg: (f, k) => `<path d="M50,32 C40,20 20,18 4,26 C16,30 22,36 26,42 C16,42 10,47 6,54 C20,51 31,53 37,59 L43,82 L50,96 L57,82 L63,59 C69,53 80,51 94,54 C90,47 84,42 74,42 C78,36 84,30 96,26 C80,18 60,20 50,32 Z" fill="${f}"/><circle cx="50" cy="26" r="9" fill="${f}"/><polygon points="50,24 62,28 50,33" fill="${k}"/><circle cx="47" cy="24" r="1.8" fill="${k}"/><path d="M38,62 L50,70 L62,62" fill="none" stroke="${k}" stroke-width="2"/>` },
  wings: { label: 'Wings', svg: (f) => `<path d="M46,40 C34,22 14,18 2,24 C12,28 16,32 18,36 C10,36 6,40 4,46 C14,44 20,46 24,50 C16,52 12,56 10,62 C24,58 36,60 46,70 Z" fill="${f}"/><path d="M54,40 C66,22 86,18 98,24 C88,28 84,32 82,36 C90,36 94,40 96,46 C86,44 80,46 76,50 C84,52 88,56 90,62 C76,58 64,60 54,70 Z" fill="${f}"/><circle cx="50" cy="52" r="7" fill="${f}"/>` },
  wolf: { label: 'Wolf', svg: (f, k) => `<polygon points="50,94 30,66 16,12 38,34 50,30 62,34 84,12 70,66" fill="${f}"/><polygon points="34,50 44,52 40,58" fill="${k}"/><polygon points="66,50 56,52 60,58" fill="${k}"/><polygon points="44,78 56,78 50,88" fill="${k}"/><polygon points="24,24 34,38 28,40" fill="${k}" opacity=".5"/><polygon points="76,24 66,38 72,40" fill="${k}" opacity=".5"/>` },
  bull: { label: 'Bull', svg: (f, k) => `<path d="M6,18 Q10,44 36,42 L38,36 Q20,36 6,18 Z" fill="${f}"/><path d="M94,18 Q90,44 64,42 L62,36 Q80,36 94,18 Z" fill="${f}"/><path d="M34,36 H66 L68,62 Q62,90 50,94 Q38,90 32,62 Z" fill="${f}"/><circle cx="44" cy="80" r="3" fill="${k}"/><circle cx="56" cy="80" r="3" fill="${k}"/><circle cx="41" cy="52" r="3" fill="${k}"/><circle cx="59" cy="52" r="3" fill="${k}"/>` },
  bird: { label: 'Swallow', svg: (f, k) => `<path d="M4,36 Q36,28 50,46 Q64,28 96,36 Q72,42 62,56 L76,90 L52,66 L50,74 L48,66 L24,90 L38,56 Q28,42 4,36 Z" fill="${f}"/><circle cx="50" cy="48" r="4" fill="${k}"/>` },
  sword: { label: 'Sword', svg: sword },
  swords: { label: 'Crossed Swords', svg: (f, k) => `<g transform="rotate(-38 50 50)">${sword(f, k)}</g><g transform="rotate(38 50 50)">${sword(f, k)}</g>` },
  hammers: { label: 'Crossed Hammers', svg: (f, k) => `<g transform="rotate(-35 50 56)">${hammer(f, k)}</g><g transform="rotate(35 50 56)">${hammer(f, k)}</g>` },
  tree: { label: 'Oak Tree', svg: (f, k) => `<rect x="44" y="58" width="12" height="38" rx="2" fill="${f}"/><circle cx="50" cy="34" r="25" fill="${f}"/><circle cx="28" cy="50" r="17" fill="${f}"/><circle cx="72" cy="50" r="17" fill="${f}"/><path d="M50,96 L50,62 M50,74 L40,64 M50,70 L60,60" stroke="${k}" stroke-width="2" fill="none" opacity=".5"/>` },
  mountain: { label: 'Mountains', svg: (f, k) => `<polygon points="2,88 36,26 52,52 66,36 98,88" fill="${f}"/><polygon points="36,26 44,40 38,38 32,44 29,39" fill="${k}"/><polygon points="66,36 72,46 66,44 62,48 60,45" fill="${k}"/>` },
  wave: { label: 'Waves', svg: (f) => `<g fill="none" stroke="${f}" stroke-width="9" stroke-linecap="round"><path d="M6,32 Q20,18 34,32 T62,32 T94,32"/><path d="M6,54 Q20,40 34,54 T62,54 T94,54"/><path d="M6,76 Q20,62 34,76 T62,76 T94,76"/></g>` },
  sun: { label: 'Sun', svg: (f) => { let s = `<circle cx="50" cy="50" r="22" fill="${f}"/>`; for (let i = 0; i < 12; i++) { const a = i * 30; const p = [pol(50, 50, 28, a - 7), pol(50, 50, 47, a), pol(50, 50, 28, a + 7)]; s += `<polygon points="${p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${f}"/>`; } return s; } },
  moon: { label: 'Crescent', svg: (f) => `<path d="M62,6 A44,44 0 1 0 62,94 A52,52 0 0 1 62,6 Z" fill="${f}"/>${star(70, 50, 14, 6, f)}` },
  key: { label: 'Key', svg: (f, k) => `<circle cx="50" cy="22" r="17" fill="${f}"/><circle cx="50" cy="22" r="7" fill="${k}"/><rect x="45" y="36" width="10" height="58" fill="${f}"/><rect x="55" y="72" width="14" height="7" fill="${f}"/><rect x="55" y="84" width="10" height="7" fill="${f}"/>` },
  trident: { label: 'Trident', svg: (f) => `<g fill="none" stroke="${f}" stroke-width="7" stroke-linecap="round"><line x1="50" y1="18" x2="50" y2="96"/><path d="M22,16 V40 Q22,52 34,52 H66 Q78,52 78,40 V16"/></g><polygon points="50,2 58,20 42,20" fill="${f}"/><polygon points="22,4 28,18 16,18" fill="${f}"/><polygon points="78,4 84,18 72,18" fill="${f}"/>` },
  arrow: { label: 'Arrow', svg: (f) => `<g transform="rotate(45 50 50)"><rect x="46" y="20" width="8" height="70" fill="${f}"/><polygon points="50,0 64,24 36,24" fill="${f}"/><polygon points="46,76 32,96 32,82 46,64" fill="${f}"/><polygon points="54,76 68,96 68,82 54,64" fill="${f}"/></g>` },
  heart: { label: 'Heart', svg: (f) => `<path d="M50,90 C20,68 6,50 6,34 C6,19 18,9 31,9 C41,9 47,15 50,22 C53,15 59,9 69,9 C82,9 94,19 94,34 C94,50 80,68 50,90 Z" fill="${f}"/>` },
  gem: { label: 'Diamond Gem', svg: (f, k) => `<polygon points="22,34 36,14 64,14 78,34 50,90" fill="${f}"/><path d="M22,34 H78 M36,14 L44,34 L50,90 L56,34 L64,14" fill="none" stroke="${k}" stroke-width="2" opacity=".6"/>` },
  clover: { label: 'Clover', svg: (f) => `<circle cx="50" cy="28" r="18" fill="${f}"/><circle cx="30" cy="52" r="18" fill="${f}"/><circle cx="70" cy="52" r="18" fill="${f}"/><path d="M50,52 Q54,76 66,94" stroke="${f}" stroke-width="7" fill="none" stroke-linecap="round"/>` },
  gear: { label: 'Cog', svg: (f, k) => { let s = ''; for (let i = 0; i < 10; i++) s += `<rect x="44" y="4" width="12" height="18" rx="2" fill="${f}" transform="rotate(${i * 36} 50 50)"/>`; return s + `<circle cx="50" cy="50" r="34" fill="${f}"/><circle cx="50" cy="50" r="14" fill="${k}"/>`; } },
  globe: { label: 'Globe', svg: (f) => `<g fill="none" stroke="${f}" stroke-width="5"><circle cx="50" cy="50" r="42"/><ellipse cx="50" cy="50" rx="18" ry="42"/><line x1="8" y1="50" x2="92" y2="50"/><path d="M14,30 H86 M14,70 H86"/></g>` },
  trophy: { label: 'Trophy', svg: (f, k) => `<path d="M28,8 H72 V34 C72,52 62,60 50,62 C38,60 28,52 28,34 Z" fill="${f}"/><path d="M28,16 H14 Q12,38 32,46 M72,16 H86 Q88,38 68,46" fill="none" stroke="${f}" stroke-width="6"/><rect x="45" y="60" width="10" height="14" fill="${f}"/><rect x="32" y="74" width="36" height="8" rx="2" fill="${f}"/><rect x="26" y="84" width="48" height="10" rx="2" fill="${f}"/>${star(50, 32, 11, 5, k)}` },
  monogram: { label: 'Initial Letter', svg: (f, k, ctx) => `<text x="50" y="80" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="84" fill="${f}" stroke="${k}" stroke-width="2" paint-order="stroke">${esc((ctx.short || ctx.name || 'F')[0])}</text>` },
};

export const TEXT_MODES = { none: 'No text', top: 'Abbreviation (top)', bottom: 'Ribbon with abbreviation', ring: 'Name around ring (round badges)', year: 'Founded year ribbon' };
export const BORDERS = { single: 'Single trim', double: 'Double trim', none: 'No trim' };

export const PALETTE = [
  '#ffffff', '#f5f5f4', '#111827', '#000000', '#7c3aed', '#5b21b6', '#a78bfa', '#c026d3',
  '#dc2626', '#991b1b', '#f43f5e', '#f97316', '#f59e0b', '#facc15', '#eab308', '#84cc16',
  '#16a34a', '#065f46', '#14b8a6', '#06b6d4', '#0ea5e9', '#2563eb', '#1e3a8a', '#1e40af',
  '#6b7280', '#9ca3af', '#78350f', '#b45309', '#fde68a', '#be123c',
];

function textColorOn(hex) {
  const h = String(hex || '#000').replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, '0');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b0b14' : '#ffffff';
}
export { textColorOn };

/**
 * @param {object} spec badge spec
 * @param {object} ctx { name, short, founded }
 * @param {number|string} size CSS size
 */
export function badgeSVG(spec, ctx = {}, size = 40) {
  const s = { shape: 'shield', pattern: 'solid', emblem: 'ball', c1: '#7c3aed', c2: '#ffffff', c3: '#ffffff', trim: '#ffffff', text: 'none', stars: 0, border: 'single', ...(spec || {}) };
  const shape = SHAPES[s.shape] || SHAPES.shield;
  const pattern = PATTERNS[s.pattern] || PATTERNS.solid;
  const emblem = EMBLEMS[s.emblem] || EMBLEMS.ball;
  const id = 'b' + (++counter).toString(36);
  let text = s.text;
  if (text === 'ring' && !shape.round) text = 'bottom';
  const stars = Math.max(0, Math.min(5, Number(s.stars) || 0));
  const top = stars ? -16 : 0;
  const detail = textColorOn(s.c3) === '#ffffff' ? 'rgba(0,0,0,.55)' : s.c1;
  // emblem placement
  let ex = 50, ey = 58, es = 56;
  if (text === 'top') { ey = 66; es = 46; }
  if (text === 'bottom' || text === 'year') { ey = 48; es = 46; }
  if (text === 'ring') { ey = 60; es = 40; }
  if (shape.round && text !== 'ring') es = Math.min(es, 52);
  if (s.shape === 'diamond') es = Math.min(es, 44);
  const emb = emblem.svg(s.c3, detail, ctx);
  const sc = es / 100;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top} 100 ${120 - top}" width="${size}" height="${size}" class="badge" role="img" aria-label="${esc(ctx.name || 'badge')}">`;
  out += `<defs><clipPath id="${id}"><path d="${shape.d}"/></clipPath></defs>`;
  out += `<g clip-path="url(#${id})"><rect x="0" y="0" width="100" height="120" fill="${s.c1}"/>${pattern.svg(s.c2, shape)}`;
  out += '<rect x="0" y="0" width="100" height="58" fill="#fff" opacity=".07"/></g>'; // subtle sheen
  if (s.border !== 'none') {
    out += `<path d="${shape.d}" fill="none" stroke="${s.trim}" stroke-width="${s.border === 'double' ? 7 : 4}" stroke-linejoin="round"/>`;
    if (s.border === 'double') out += `<path d="${shape.d}" fill="none" stroke="${s.c1}" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
  if (text === 'ring') {
    const cy = 60;
    out += `<circle cx="50" cy="${cy}" r="40" fill="none" stroke="${s.c1}" stroke-width="12" opacity=".92"/>`;
    out += `<circle cx="50" cy="${cy}" r="33.5" fill="none" stroke="${s.trim}" stroke-width="1.6"/>`;
    out += `<defs><path id="${id}r" d="M${50 - 36.5},${cy} A36.5,36.5 0 1 1 ${50 + 36.5},${cy}"/></defs>`;
    const nm = String(ctx.name || '').toUpperCase();
    const fs = nm.length > 18 ? 8 : nm.length > 13 ? 9.5 : 10.5;
    out += `<text font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="${fs}" letter-spacing="1" fill="${s.trim}"><textPath href="#${id}r" startOffset="50%" text-anchor="middle">${esc(nm)}</textPath></text>`;
  }
  out += `<g transform="translate(${ex - es / 2},${ey - es / 2}) scale(${sc})">${emb}</g>`;
  if (text === 'top') {
    out += `<text x="50" y="${shape.round ? 34 : 33}" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="17" letter-spacing="1" fill="${s.c3}" stroke="${s.c1}" stroke-width="3" paint-order="stroke">${esc(String(ctx.short || '').toUpperCase())}</text>`;
  }
  if (text === 'bottom' || text === 'year') {
    const label = text === 'year' ? (ctx.founded ? `EST. ${ctx.founded}` : '') : String(ctx.short || '').toUpperCase();
    const y = 78;
    out += `<path d="M2,${y} H98 L92,${y + 9} L98,${y + 18} H2 L8,${y + 9} Z" fill="${s.trim}" stroke="${s.c1}" stroke-width="1.5"/>`;
    out += `<text x="50" y="${y + 14}" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="${text === 'year' ? 12 : 14}" letter-spacing="1.5" fill="${textColorOn(s.trim)}">${esc(label)}</text>`;
  }
  if (stars) {
    const gap = 13, x0 = 50 - (stars - 1) * gap / 2;
    for (let i = 0; i < stars; i++) out += star(x0 + i * gap, -7, 6, 2.6, s.trim);
  }
  out += '</svg>';
  return out;
}

// ---------- presets: 24 ready-made badge designs ----------
export const BADGE_PRESETS = [
  { name: 'Royal Crown', spec: { shape: 'shield', pattern: 'solid', emblem: 'crown', c1: '#5b21b6', c2: '#7c3aed', c3: '#facc15', trim: '#facc15', text: 'bottom', border: 'double' } },
  { name: 'Classic Stripes', spec: { shape: 'heater', pattern: 'stripes', emblem: 'ball', c1: '#dc2626', c2: '#ffffff', c3: '#ffffff', trim: '#111827', text: 'top', border: 'single' } },
  { name: 'Night Wolf', spec: { shape: 'pointed', pattern: 'bend', emblem: 'wolf', c1: '#111827', c2: '#374151', c3: '#e5e7eb', trim: '#9ca3af', text: 'none', border: 'single' } },
  { name: 'Golden Eagle', spec: { shape: 'circle', pattern: 'solid', emblem: 'eagle', c1: '#1e3a8a', c2: '#2563eb', c3: '#facc15', trim: '#facc15', text: 'ring', border: 'double' } },
  { name: 'Harbour', spec: { shape: 'crest', pattern: 'hoops', emblem: 'anchor', c1: '#1e40af', c2: '#0ea5e9', c3: '#ffffff', trim: '#ffffff', text: 'bottom', border: 'single' } },
  { name: 'Fortress', spec: { shape: 'tower', pattern: 'halves', emblem: 'castle', c1: '#991b1b', c2: '#f5f5f4', c3: '#111827', trim: '#111827', text: 'none', border: 'single' } },
  { name: 'Thunder', spec: { shape: 'hexagon', pattern: 'solid', emblem: 'bolt', c1: '#111827', c2: '#facc15', c3: '#facc15', trim: '#facc15', text: 'top', border: 'single' } },
  { name: 'Inferno', spec: { shape: 'french', pattern: 'chevron', emblem: 'flame', c1: '#f97316', c2: '#dc2626', c3: '#fde68a', trim: '#7c2d12', text: 'none', border: 'double' } },
  { name: 'Evergreen', spec: { shape: 'scalloped', pattern: 'solid', emblem: 'tree', c1: '#065f46', c2: '#16a34a', c3: '#fde68a', trim: '#fde68a', text: 'bottom', border: 'single' } },
  { name: 'Highlands', spec: { shape: 'shield', pattern: 'split', emblem: 'mountain', c1: '#0ea5e9', c2: '#1e3a8a', c3: '#ffffff', trim: '#ffffff', text: 'year', border: 'single' } },
  { name: 'Sky Blues', spec: { shape: 'circle', pattern: 'rays', emblem: 'sun', c1: '#38bdf8', c2: '#0ea5e9', c3: '#ffffff', trim: '#1e3a8a', text: 'ring', border: 'single' } },
  { name: 'Crescent', spec: { shape: 'oval', pattern: 'solid', emblem: 'moon', c1: '#14532d', c2: '#16a34a', c3: '#ffffff', trim: '#ffffff', text: 'none', border: 'double' } },
  { name: 'Ironworks', spec: { shape: 'octagon', pattern: 'pinstripes', emblem: 'hammers', c1: '#1f2937', c2: '#374151', c3: '#f59e0b', trim: '#f59e0b', text: 'bottom', border: 'single' } },
  { name: 'Gladiators', spec: { shape: 'heater', pattern: 'saltire', emblem: 'swords', c1: '#7f1d1d', c2: '#b91c1c', c3: '#f5f5f4', trim: '#facc15', text: 'none', border: 'double' } },
  { name: 'Mariners', spec: { shape: 'diamond', pattern: 'solid', emblem: 'trident', c1: '#0f766e', c2: '#14b8a6', c3: '#ffffff', trim: '#ffffff', text: 'none', border: 'single' } },
  { name: 'Chequered', spec: { shape: 'square', pattern: 'checks', emblem: 'none', c1: '#dc2626', c2: '#ffffff', c3: '#111827', trim: '#111827', text: 'bottom', border: 'single' } },
  { name: 'Saints', spec: { shape: 'shield', pattern: 'cross', emblem: 'none', c1: '#ffffff', c2: '#dc2626', c3: '#111827', trim: '#111827', text: 'none', border: 'single' } },
  { name: 'Bullring', spec: { shape: 'circle', pattern: 'halves', emblem: 'bull', c1: '#111827', c2: '#dc2626', c3: '#f5f5f4', trim: '#f5f5f4', text: 'ring', border: 'single' } },
  { name: 'Swallows', spec: { shape: 'pennant', pattern: 'band', emblem: 'bird', c1: '#1e40af', c2: '#ffffff', c3: '#1e40af', trim: '#ffffff', text: 'none', border: 'single' } },
  { name: 'Monogram', spec: { shape: 'crest', pattern: 'centre', emblem: 'monogram', c1: '#111827', c2: '#7c3aed', c3: '#ffffff', trim: '#a78bfa', text: 'none', border: 'double' } },
  { name: 'Lucky Clover', spec: { shape: 'circle', pattern: 'hoops', emblem: 'clover', c1: '#16a34a', c2: '#ffffff', c3: '#065f46', trim: '#065f46', text: 'ring', border: 'single' } },
  { name: 'Industrial', spec: { shape: 'hexagon', pattern: 'quarters', emblem: 'gear', c1: '#f59e0b', c2: '#111827', c3: '#ffffff', trim: '#111827', text: 'none', border: 'single' } },
  { name: 'Diamonds', spec: { shape: 'pointed', pattern: 'sash', emblem: 'gem', c1: '#be123c', c2: '#fde68a', c3: '#ffffff', trim: '#fde68a', text: 'bottom', border: 'single' } },
  { name: 'Global', spec: { shape: 'circle', pattern: 'solid', emblem: 'globe', c1: '#0ea5e9', c2: '#2563eb', c3: '#ffffff', trim: '#ffffff', text: 'ring', border: 'double' } },
  { name: 'Champions Star', spec: { shape: 'french', pattern: 'frame', emblem: 'star', c1: '#111827', c2: '#facc15', c3: '#facc15', trim: '#facc15', text: 'none', border: 'none', stars: 3 } },
  { name: 'Archers', spec: { shape: 'shield', pattern: 'band', emblem: 'arrow', c1: '#166534', c2: '#fde68a', c3: '#111827', trim: '#fde68a', text: 'none', border: 'single' } },
  { name: 'Keyholders', spec: { shape: 'heater', pattern: 'solid', emblem: 'key', c1: '#78350f', c2: '#b45309', c3: '#fde68a', trim: '#fde68a', text: 'year', border: 'double' } },
  { name: 'Hearts', spec: { shape: 'scalloped', pattern: 'halves', emblem: 'heart', c1: '#7f1d1d', c2: '#be123c', c3: '#ffffff', trim: '#ffffff', text: 'none', border: 'single' } },
];

export const LEAGUE_LOGO_PRESETS = [
  { name: 'Crown Trophy', spec: { shape: 'circle', pattern: 'solid', emblem: 'trophy', c1: '#1e1b4b', c2: '#7c3aed', c3: '#e9d5ff', trim: '#a78bfa', text: 'none', border: 'double' } },
  { name: 'Royal', spec: { shape: 'hexagon', pattern: 'rays', emblem: 'crown', c1: '#4c1d95', c2: '#5b21b6', c3: '#ffffff', trim: '#ffffff', text: 'none', border: 'single' } },
  { name: 'Star League', spec: { shape: 'diamond', pattern: 'solid', emblem: 'star', c1: '#0f172a', c2: '#1e293b', c3: '#facc15', trim: '#facc15', text: 'none', border: 'single' } },
  { name: 'Ball Crest', spec: { shape: 'shield', pattern: 'split', emblem: 'ball', c1: '#1e3a8a', c2: '#2563eb', c3: '#ffffff', trim: '#ffffff', text: 'none', border: 'single' } },
  { name: 'Globe Cup', spec: { shape: 'circle', pattern: 'rays', emblem: 'globe', c1: '#065f46', c2: '#047857', c3: '#ffffff', trim: '#ffffff', text: 'none', border: 'single' } },
  { name: 'Lightning Cup', spec: { shape: 'octagon', pattern: 'solid', emblem: 'bolt', c1: '#111827', c2: '#111827', c3: '#f97316', trim: '#f97316', text: 'none', border: 'double' } },
];
