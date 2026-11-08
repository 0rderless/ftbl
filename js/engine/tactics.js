// Positions, formations, playing styles and tactical match-ups.

export const POSITIONS = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST'];
export const POSITION_NAMES = {
  GK: 'Goalkeeper', RB: 'Right Back', CB: 'Centre Back', LB: 'Left Back', DM: 'Defensive Midfielder',
  CM: 'Central Midfielder', AM: 'Attacking Midfielder', RM: 'Right Midfielder', LM: 'Left Midfielder',
  RW: 'Right Winger', LW: 'Left Winger', ST: 'Striker',
};
export const POSITION_GROUP = {
  GK: 'GK', RB: 'DEF', CB: 'DEF', LB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', RM: 'MID', LM: 'MID',
  RW: 'ATT', LW: 'ATT', ST: 'ATT',
};

const COORD = {
  GK: [0, 0], CB: [0, 1], RB: [1, 1.1], LB: [-1, 1.1], DM: [0, 2], CM: [0, 2.6], AM: [0, 3.4],
  RM: [1, 2.8], LM: [-1, 2.8], RW: [1, 3.8], LW: [-1, 3.8], ST: [0, 4.3],
};

// How well a player of position `pos` performs in a `slot` (1 = natural position).
export function positionFit(pos, slot) {
  if (pos === slot) return 1;
  if (pos === 'GK' || slot === 'GK') return pos === slot ? 1 : (slot === 'GK' ? 0.3 : 0.35);
  const [x1, y1] = COORD[pos] || [0, 2];
  const [x2, y2] = COORD[slot] || [0, 2];
  const dx = Math.abs(x1 - x2) * 0.45, dy = Math.abs(y1 - y2);
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0.55, 1 - 0.12 * Math.pow(d, 1.2));
}

// Contribution of each slot to the team's attack / midfield / defence / goalkeeping.
export const SLOT_LINES = {
  GK: { gk: 1 }, CB: { def: 1 }, RB: { def: 0.8, mid: 0.2 }, LB: { def: 0.8, mid: 0.2 },
  DM: { def: 0.4, mid: 0.6 }, CM: { mid: 0.8, att: 0.1, def: 0.1 }, AM: { mid: 0.5, att: 0.5 },
  RM: { mid: 0.7, att: 0.3 }, LM: { mid: 0.7, att: 0.3 }, RW: { att: 0.8, mid: 0.2 },
  LW: { att: 0.8, mid: 0.2 }, ST: { att: 1 },
};

// Slots are listed GK -> attack. x: -1 (left) .. 1 (right); y: 0 (own goal) .. 1 (opp goal)
export const FORMATIONS = {
  '4-4-2': { slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'], mod: { att: 0, mid: 0, def: 0 } },
  '4-3-3': { slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'DM', 'CM', 'RW', 'ST', 'LW'], mod: { att: 2, mid: 0, def: -1.5 } },
  '4-2-3-1': { slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'DM', 'RW', 'AM', 'LW', 'ST'], mod: { att: 1, mid: 1.5, def: -0.5 } },
  '3-5-2': { slots: ['GK', 'CB', 'CB', 'CB', 'RM', 'CM', 'DM', 'CM', 'LM', 'ST', 'ST'], mod: { att: 1, mid: 2, def: -2.5 } },
  '5-3-2': { slots: ['GK', 'RB', 'CB', 'CB', 'CB', 'LB', 'CM', 'CM', 'CM', 'ST', 'ST'], mod: { att: -2, mid: -1, def: 3 } },
  '4-1-4-1': { slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'RM', 'CM', 'CM', 'LM', 'ST'], mod: { att: -1, mid: 1.5, def: 0.5 } },
  '3-4-3': { slots: ['GK', 'CB', 'CB', 'CB', 'RM', 'CM', 'CM', 'LM', 'RW', 'ST', 'LW'], mod: { att: 3, mid: -0.5, def: -2.5 } },
  '4-3-1-2': { slots: ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'DM', 'CM', 'AM', 'ST', 'ST'], mod: { att: 1.5, mid: 1, def: -1.5 } },
};
export const FORMATION_KEYS = Object.keys(FORMATIONS);

export const STYLES = {
  balanced: { label: 'Balanced', mod: { att: 0, mid: 0, def: 0 }, possession: 0, fatigue: 1, fouls: 1 },
  possession: { label: 'Possession', mod: { att: 0.5, mid: 2, def: -0.5 }, possession: 7, fatigue: 0.95, fouls: 0.85 },
  counter: { label: 'Counter-Attack', mod: { att: 1, mid: -1.5, def: 1 }, possession: -7, fatigue: 1, fouls: 1 },
  press: { label: 'High Press', mod: { att: 1, mid: 1.5, def: -1.5 }, possession: 3, fatigue: 1.25, fouls: 1.25 },
  direct: { label: 'Direct', mod: { att: 1.5, mid: -2, def: 0 }, possession: -4, fatigue: 1.05, fouls: 1.1 },
  bus: { label: 'Park the Bus', mod: { att: -4, mid: -1, def: 4.5 }, possession: -11, fatigue: 0.9, fouls: 1.15 },
};
export const STYLE_KEYS = Object.keys(STYLES);

// Attacking log-bonus for style A when facing style B. Rock-paper-scissors style
// relationships so no single approach dominates.
const MATCHUP = {
  counter: { possession: 0.09, press: 0.05, direct: -0.03, bus: -0.06 },
  possession: { bus: 0.07, direct: 0.03, counter: -0.06, press: -0.05 },
  press: { possession: 0.06, balanced: 0.02, direct: -0.07, counter: -0.03 },
  direct: { press: 0.08, possession: 0.02, bus: -0.05 },
  bus: { direct: 0.05, counter: 0.03, possession: -0.04 },
  balanced: { bus: 0.02, press: -0.02 },
};

export function styleMatchup(a, b) {
  return (MATCHUP[a] && MATCHUP[a][b]) || 0;
}

// Formation-vs-formation shape effects: e.g. a 3-at-the-back side vs two strikers.
export function formationMatchup(fa, fb) {
  const a = FORMATIONS[fa], b = FORMATIONS[fb];
  if (!a || !b) return 0;
  const count = (f, pos) => f.slots.filter((s) => s === pos).length;
  const midA = a.slots.filter((s) => SLOT_LINES[s].mid >= 0.5).length;
  const midB = b.slots.filter((s) => SLOT_LINES[s].mid >= 0.5).length;
  const strikersA = count(a, 'ST') + count(a, 'RW') + count(a, 'LW');
  const cbB = count(b, 'CB');
  // overloading the opponent's centre-backs and winning the midfield count
  return 0.02 * (midA - midB) + 0.025 * (strikersA - cbB);
}
