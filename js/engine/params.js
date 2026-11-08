// Simulation settings: definitions, presets and conversion to engine parameters.
// This module is UI-independent. The UI renders controls from SETTING_DEFS and the
// engine only ever consumes the numeric output of resolveParams().

export const SETTING_DEFS = [
  { key: 'teamRatingInfluence', label: 'Team Rating Influence', type: 'slider', min: 0, max: 100,
    help: 'How strongly overall club ratings decide matches. Higher = favourites win more often.' },
  { key: 'upsetFrequency', label: 'Upset Frequency', type: 'slider', min: 0, max: 100,
    help: 'How often weaker sides beat stronger ones. Adds match-day performance swings and narrows quality gaps.' },
  { key: 'homeAdvantage', label: 'Home Advantage', type: 'slider', min: 0, max: 100,
    help: 'Boost for the home side and penalty for the visitors.' },
  { key: 'formInfluence', label: 'Form Influence', type: 'slider', min: 0, max: 100,
    help: 'How much results from the last five matches lift or drag performance.' },
  { key: 'goalFrequency', label: 'Goal Frequency', type: 'select', options: [
    { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }],
    help: 'Baseline scoring rate across all matches.' },
  { key: 'drawFrequency', label: 'Draw Frequency', type: 'slider', min: 0, max: 100,
    help: 'How likely evenly-poised matches are to finish level.' },
  { key: 'scoreUnpredictability', label: 'Score Unpredictability', type: 'slider', min: 0, max: 100,
    help: 'Spread of possible scorelines. Higher = more thrashings and freak results.' },
  { key: 'fatigueImpact', label: 'Fatigue Impact', type: 'slider', min: 0, max: 100,
    help: 'How much tired players underperform. Also drives squad rotation.' },
  { key: 'injuryFrequency', label: 'Injury Frequency', type: 'slider', min: 0, max: 100,
    help: 'How often players pick up injuries during matches.' },
  { key: 'squadQualityInfluence', label: 'Squad Quality Influence', type: 'slider', min: 0, max: 100,
    help: 'Weight of individual player ratings and squad depth versus the club\'s set ratings.' },
  { key: 'tacticalInfluence', label: 'Tactical Influence', type: 'slider', min: 0, max: 100,
    help: 'How much formations, playing styles and tactical match-ups matter.' },
  { key: 'goalkeeperInfluence', label: 'Goalkeeper Influence', type: 'slider', min: 0, max: 100,
    help: 'How strongly goalkeeper quality reduces goals conceded.' },
  { key: 'defensiveInfluence', label: 'Defensive Influence', type: 'slider', min: 0, max: 100,
    help: 'How strongly defensive ratings suppress the opposition\'s scoring.' },
  { key: 'matchIntensity', label: 'Match Intensity', type: 'slider', min: 0, max: 100,
    help: 'Overall pace: more shots, goals, fouls and fatigue at higher intensity.' },
];

export const PRESETS = {
  realistic: {
    label: 'Realistic', description: 'Modelled on top-flight football: favourites usually win, but not always.',
    values: { teamRatingInfluence: 55, upsetFrequency: 30, homeAdvantage: 50, formInfluence: 35,
      goalFrequency: 'normal', drawFrequency: 50, scoreUnpredictability: 30, fatigueImpact: 50,
      injuryFrequency: 40, squadQualityInfluence: 55, tacticalInfluence: 45, goalkeeperInfluence: 50,
      defensiveInfluence: 50, matchIntensity: 50 },
  },
  balanced: {
    label: 'Balanced', description: 'A closer league: quality matters, but the gaps are smaller.',
    values: { teamRatingInfluence: 42, upsetFrequency: 45, homeAdvantage: 40, formInfluence: 30,
      goalFrequency: 'normal', drawFrequency: 45, scoreUnpredictability: 40, fatigueImpact: 40,
      injuryFrequency: 30, squadQualityInfluence: 50, tacticalInfluence: 50, goalkeeperInfluence: 45,
      defensiveInfluence: 45, matchIntensity: 55 },
  },
  unpredictable: {
    label: 'Unpredictable', description: 'Chaos football: shocks, goals and wild momentum swings.',
    values: { teamRatingInfluence: 25, upsetFrequency: 80, homeAdvantage: 35, formInfluence: 60,
      goalFrequency: 'high', drawFrequency: 35, scoreUnpredictability: 80, fatigueImpact: 60,
      injuryFrequency: 60, squadQualityInfluence: 40, tacticalInfluence: 60, goalkeeperInfluence: 40,
      defensiveInfluence: 35, matchIntensity: 75 },
  },
};

export const PRESET_ORDER = ['realistic', 'balanced', 'unpredictable', 'custom'];

export function defaultSimSettings() {
  return {
    preset: 'realistic',
    values: { ...PRESETS.realistic.values },
    custom: { ...PRESETS.realistic.values },
  };
}

// Apply a preset: values change to the preset's values. Choosing 'custom' restores
// the user's last custom values.
export function applyPreset(sim, preset) {
  if (preset === 'custom') return { ...sim, preset, values: { ...sim.custom } };
  if (!PRESETS[preset]) throw new Error('Unknown preset ' + preset);
  return { ...sim, preset, values: { ...PRESETS[preset].values } };
}

// Changing any individual setting switches to Custom mode.
export function setSimValue(sim, key, value) {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def) throw new Error('Unknown setting ' + key);
  let v = value;
  if (def.type === 'slider') v = Math.max(def.min, Math.min(def.max, Number(value)));
  if (def.type === 'select' && !def.options.some((o) => o.value === v)) throw new Error('Bad value');
  const values = { ...sim.values, [key]: v };
  return { preset: 'custom', values, custom: { ...values } };
}

export function sanitizeSimSettings(sim) {
  const base = defaultSimSettings();
  if (!sim || typeof sim !== 'object') return base;
  const clean = (vals) => {
    const out = { ...base.values };
    for (const d of SETTING_DEFS) {
      const v = vals && vals[d.key];
      if (d.type === 'slider' && Number.isFinite(Number(v))) out[d.key] = Math.max(d.min, Math.min(d.max, Number(v)));
      if (d.type === 'select' && d.options.some((o) => o.value === v)) out[d.key] = v;
    }
    return out;
  };
  return {
    preset: PRESET_ORDER.includes(sim.preset) ? sim.preset : 'realistic',
    values: clean(sim.values),
    custom: clean(sim.custom || sim.values),
  };
}

const GOAL_BASE = { low: 1.05, normal: 1.31, high: 1.65 };

// Convert 0-100 user values into the engine's numeric coefficients.
// Every setting maps to at least one coefficient used by the match engine.
export function resolveParams(values) {
  const v = { ...PRESETS.realistic.values, ...(values || {}) };
  const s = (x) => x / 50; // 0..2 multiplier, 1 at the midpoint
  const u = v.upsetFrequency / 100;
  return {
    // strength model
    ratingWeight: s(v.teamRatingInfluence),         // R multiplier on rating gaps
    gapCompression: 1 - 0.45 * u,                    // upsets narrow effective gaps
    performanceSD: 0.03 + 0.32 * u,                  // per-match performance shock (log scale)
    homeAdvantage: 0.30 * s(v.homeAdvantage),        // total log goal advantage (split home/away)
    formWeight: 0.16 * s(v.formInfluence),           // log multiplier for form score in [-1,1]
    baseGoals: GOAL_BASE[v.goalFrequency] || GOAL_BASE.normal,
    drawInflation: 1.2 * Math.exp(((v.drawFrequency - 50) / 50) * Math.log(2.2)),
    dispersion: 0.004 + 0.42 * Math.pow(v.scoreUnpredictability / 100, 1.5), // gamma CV^2
    fatigueWeight: 0.32 * s(v.fatigueImpact),        // effectiveness lost at 0% fitness = fatigueWeight
    injuryRate: 0.0115 * s(v.injuryFrequency) * 1.25, // per starter per 90 minutes at midpoint ~0.0144
    squadWeight: v.squadQualityInfluence / 100,      // blend of player ratings vs club ratings
    tacticalWeight: s(v.tacticalInfluence),
    goalkeeperWeight: s(v.goalkeeperInfluence),
    defensiveWeight: s(v.defensiveInfluence),
    intensity: v.matchIntensity / 100,
    intensityGoals: 0.86 + 0.28 * (v.matchIntensity / 100),
  };
}
