// Reusable UI fragments (HTML string builders).
import { esc } from './dom.js';
import { badgeSVG, PALETTE } from './badge.js';
import { nationFlag } from '../data/nations.js';

const I = (p, extra = '') => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
export const ICONS = {
  home: I('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>'),
  shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  sliders: I('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  play: I('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  ff: I('<path d="M4 5l8 7-8 7zM12 5l8 7-8 7z" fill="currentColor"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  chev: I('<path d="M9 6l6 6-6 6"/>'),
  chevL: I('<path d="M15 6l-6 6 6 6"/>'),
  dice: I('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  ball: I('<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/>'),
  star: I('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  download: I('<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>'),
  upload: I('<path d="M12 20V8M6 14l6-6 6 6M4 4h16"/>'),
  refresh: I('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>'),
  boot: I('<path d="M4 14l2-9h5l1 5 7 2c1.5.5 2 1.5 2 3v2H4z"/>'),
  card: I('<rect x="7" y="3" width="10" height="16" rx="2"/>'),
  medkit: I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 11v5M9.5 13.5h5"/>'),
  swap: I('<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
};

export function clubBadge(club, size = 28) {
  if (!club) return `<span class="badge-missing" style="width:${size}px;height:${size}px"></span>`;
  return badgeSVG(club.badge, { name: club.name, short: club.short, founded: club.founded }, size);
}

export function leagueLogo(league, size = 32) {
  if (!league) return '';
  return badgeSVG(league.logo, { name: league.name, short: league.short }, size);
}

export function clubLink(club, { short = false, badge = 22 } = {}) {
  if (!club) return '<span class="muted">Unknown club</span>';
  return `<a class="club-link" href="#/club/${club.id}">${badge ? clubBadge(club, badge) : ''}<span>${esc(short ? club.short : club.name)}</span></a>`;
}

export function formPills(arr, n = 5) {
  const a = (arr || []).slice(-n);
  const pad = Array(Math.max(0, n - a.length)).fill('-');
  return `<span class="formp">${[...pad, ...a].map((r) => `<i class="f-${r === '-' ? 'n' : r}">${r === '-' ? '' : r}</i>`).join('')}</span>`;
}

export function ratingClass(v) {
  return v >= 85 ? 'r-elite' : v >= 78 ? 'r-great' : v >= 70 ? 'r-good' : v >= 60 ? 'r-ok' : 'r-low';
}
export function ratingChip(v) {
  return `<span class="rchip ${ratingClass(v)}">${Math.round(v)}</span>`;
}

export function header({ title, sub = '', back = null, actions = '', logo = '' }) {
  return `<header class="topbar">
    ${back ? `<a class="icon-btn" href="${back}" data-back="${back}" aria-label="Back">${ICONS.back}</a>` : '<span class="brand">ftbl</span>'}
    <div class="topbar-title">${logo}<div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>
    <div class="topbar-actions">${actions}</div>
  </header>`;
}

export function tabs(items, active, base) {
  return `<nav class="tabs" role="tablist">${items.map(([key, label]) =>
    `<a role="tab" class="tab ${key === active ? 'active' : ''}" href="${base}/${key}" aria-selected="${key === active}">${esc(label)}</a>`).join('')}</nav>`;
}

export function segmented(name, options, value, act = 'seg') {
  return `<div class="seg" role="radiogroup">${options.map(([v, label]) =>
    `<button type="button" class="seg-btn ${String(v) === String(value) ? 'on' : ''}" data-act="${act}" data-name="${esc(name)}" data-value="${esc(v)}" role="radio" aria-checked="${String(v) === String(value)}">${esc(label)}</button>`).join('')}</div>`;
}

export function slider({ name, label, value, min = 0, max = 100, step = 1, help = '', suffix = '', act = '' }) {
  return `<label class="slider-row">
    <div class="slider-head"><span>${esc(label)}</span><output data-out="${esc(name)}">${esc(value)}${suffix}</output></div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${esc(value)}" data-field="${esc(name)}" ${act ? `data-act-input="${act}"` : ''} style="--p:${((value - min) / (max - min)) * 100}%">
    ${help ? `<small>${esc(help)}</small>` : ''}
  </label>`;
}

export function colorField(name, value, label) {
  return `<div class="color-field">
    <div class="color-head"><span>${esc(label)}</span>
      <label class="color-current" style="background:${esc(value)}"><input type="color" value="${esc(value)}" data-field="${esc(name)}" data-act-input="color" aria-label="${esc(label)} custom colour"></label></div>
    <div class="swatches">${PALETTE.map((c) => `<button type="button" class="sw ${c.toLowerCase() === String(value).toLowerCase() ? 'on' : ''}" style="background:${c}" data-act="color" data-name="${esc(name)}" data-value="${c}" aria-label="${c}"></button>`).join('')}</div>
  </div>`;
}

export function statBar(label, h, a, { fmt = (x) => x, pct = false } = {}) {
  const total = (Number(h) || 0) + (Number(a) || 0);
  const hp = total ? (h / total) * 100 : 50;
  return `<div class="statbar"><div class="statbar-vals"><b>${fmt(h)}${pct ? '%' : ''}</b><span>${esc(label)}</span><b>${fmt(a)}${pct ? '%' : ''}</b></div>
    <div class="statbar-track"><i class="h" style="width:${hp}%"></i><i class="a" style="width:${100 - hp}%"></i></div></div>`;
}

export function emptyState(title, text = '', action = '') {
  return `<div class="empty"><div class="empty-ico">${ICONS.ball}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

export function flag(code) { return `<span class="flag">${nationFlag(code)}</span>`; }

export function posTag(pos) { return `<span class="pos pos-${pos}">${pos}</span>`; }

export function syncBadge(sync) {
  if (!sync || sync.status === 'off') return '<span class="sync-badge off" data-sync-status>Device only</span>';
  const label = { connecting: 'Connecting…', synced: 'Cloud saved', saving: 'Saving…', offline: 'Offline · saved on device', error: 'Cloud error · saved on device' }[sync.status] || sync.status;
  return `<span class="sync-badge ${sync.status}" data-sync-status title="${esc(sync.error ? sync.error.message : '')}"><i></i>${label}</span>`;
}

