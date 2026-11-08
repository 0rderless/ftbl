// SVG kit renderer: shirt + shorts + socks.
let counter = 0;

export const KIT_STYLES = {
  plain: { label: 'Plain', svg: () => '' },
  stripes: { label: 'Stripes', svg: (c) => [14, 34, 54, 74].map((x) => `<rect x="${x}" y="0" width="10" height="100" fill="${c}"/>`).join('') },
  pinstripes: { label: 'Pinstripes', svg: (c) => Array.from({ length: 12 }, (_, i) => `<rect x="${i * 8 + 3}" y="0" width="1.8" height="100" fill="${c}"/>`).join('') },
  hoops: { label: 'Hoops', svg: (c) => [20, 40, 60, 80].map((y) => `<rect x="0" y="${y}" width="100" height="10" fill="${c}"/>`).join('') },
  halves: { label: 'Halves', svg: (c) => `<rect x="50" y="0" width="50" height="100" fill="${c}"/>` },
  quarters: { label: 'Quarters', svg: (c) => `<rect x="50" y="0" width="50" height="52" fill="${c}"/><rect x="0" y="52" width="50" height="48" fill="${c}"/>` },
  sash: { label: 'Sash', svg: (c) => `<polygon points="18,8 34,8 84,92 68,92" fill="${c}"/>` },
  chevron: { label: 'Chevron', svg: (c) => `<polygon points="0,26 50,52 100,26 100,40 50,66 0,40" fill="${c}"/>` },
  band: { label: 'Chest Band', svg: (c) => `<rect x="0" y="36" width="100" height="16" fill="${c}"/>` },
  centre: { label: 'Centre Stripe', svg: (c) => `<rect x="40" y="0" width="20" height="100" fill="${c}"/>` },
  checks: { label: 'Checks', svg: (c) => { let s = ''; for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2) s += `<rect x="${x * 10}" y="${y * 10}" width="10" height="10" fill="${c}"/>`; return s; } },
  sleeves: { label: 'Contrast Sleeves', svg: (c) => `<polygon points="0,0 28,0 24,40 0,40" fill="${c}"/><polygon points="100,0 72,0 76,40 100,40" fill="${c}"/>` },
  fade: { label: 'Gradient Fade', svg: (c, id) => `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#${id}f)"/>` },
};

const SHIRT = 'M31,8 L18,12 L4,30 L16,43 L24,37 V92 H76 V37 L84,43 L96,30 L82,12 L69,8 Q60,17 50,17 Q40,17 31,8 Z';

export function kitSVG(kit, size = 60, opts = {}) {
  const k = { style: 'plain', c1: '#7c3aed', c2: '#ffffff', c3: '#ffffff', shorts: '#ffffff', socks: '#7c3aed', ...(kit || {}) };
  const id = 'k' + (++counter).toString(36);
  const style = KIT_STYLES[k.style] || KIT_STYLES.plain;
  const showLower = opts.shirtOnly !== true;
  const h = showLower ? 150 : 96;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${h}" width="${size}" height="${size * h / 100}" class="kit">`;
  s += `<defs><clipPath id="${id}"><path d="${SHIRT}"/></clipPath></defs>`;
  s += `<g clip-path="url(#${id})"><rect width="100" height="100" fill="${k.c1}"/>${style.svg(k.c2, id)}`;
  s += '<rect x="0" y="0" width="50" height="100" fill="#fff" opacity=".05"/></g>';
  s += `<path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>`;
  // collar & cuffs
  s += `<path d="M31,8 Q40,17 50,17 Q60,17 69,8 L65,6 Q58,12 50,12 Q42,12 35,6 Z" fill="${k.c3}"/>`;
  s += `<line x1="4.8" y1="31" x2="16.6" y2="43.6" stroke="${k.c3}" stroke-width="3"/><line x1="95.2" y1="31" x2="83.4" y2="43.6" stroke="${k.c3}" stroke-width="3"/>`;
  if (opts.number != null) s += `<text x="50" y="66" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="32" fill="${k.c3}" stroke="rgba(0,0,0,.35)" stroke-width="1" paint-order="stroke">${opts.number}</text>`;
  if (showLower) {
    s += `<path d="M26,96 H74 L78,124 H54 L50,112 L46,124 H22 Z" fill="${k.shorts}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    s += `<path d="M28,128 H44 V144 Q44,148 40,148 H28 Z" fill="${k.socks}" stroke="rgba(0,0,0,.35)" stroke-width="1"/><path d="M56,128 H72 V148 H60 Q56,148 56,144 Z" fill="${k.socks}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    s += `<rect x="28" y="128" width="16" height="3" fill="${k.c3}" opacity=".8"/><rect x="56" y="128" width="16" height="3" fill="${k.c3}" opacity=".8"/>`;
  }
  return s + '</svg>';
}
