// Season switcher: step back through the last 3 completed seasons of any competition.
import { esc } from './dom.js';
import { ICONS } from './components.js';

export const MAX_BACK = 3;
const state = {}; // leagueId -> how many seasons back (0 = current)

// if the current season is finished it is already in history; don't show it twice
function offset(l) {
  const last = l.history[l.history.length - 1];
  return l.season && l.season.finished && last && last.label === l.season.label ? 1 : 0;
}
function maxBack(l) { return Math.max(0, Math.min(MAX_BACK, l.history.length - offset(l))); }

export function pastIndex(l) {
  return Math.max(0, Math.min(state[l.id] || 0, maxBack(l)));
}
/** The history entry being viewed, or null for the current season. */
export function pastEntry(l) {
  const i = pastIndex(l);
  return i ? l.history[l.history.length - offset(l) - i] : null;
}
export function stepPast(l, delta) {
  state[l.id] = Math.max(0, Math.min(maxBack(l), pastIndex(l) + delta));
}

export function seasonStepper(l) {
  const i = pastIndex(l);
  const max = maxBack(l);
  if (!max) return '';
  const h = pastEntry(l);
  const label = h ? h.label : (l.season ? l.season.label : '');
  const sub = h ? `Final standings · ${i} season${i > 1 ? 's' : ''} ago` : l.season && l.season.finished ? 'Final standings · this season' : 'This season (live)';
  return `<div class="season-step ${h ? 'past' : ''}">
    <button class="icon-btn" data-act="pastBack" data-id="${l.id}" ${i >= max ? 'disabled' : ''} aria-label="Previous season">${ICONS.chevL}</button>
    <div class="ss-mid"><b>${esc(label)}</b><small>${esc(sub)}</small></div>
    <button class="icon-btn" data-act="pastFwd" data-id="${l.id}" ${i === 0 ? 'disabled' : ''} aria-label="Next season">${ICONS.chev}</button>
  </div>`;
}

/** Name for a club in a past season (handles clubs that were deleted since). */
export function pastName(w, h, id) {
  return (w.clubs[id] && w.clubs[id].name) || (h && h.clubNames && h.clubNames[id]) || 'Former club';
}
