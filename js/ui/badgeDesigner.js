// Interactive badge/logo designer used by the club and league editors.
import { esc } from './dom.js';
import { badgeSVG, SHAPES, PATTERNS, EMBLEMS, TEXT_MODES, BORDERS, PALETTE } from './badge.js';
import { colorField, segmented, ICONS } from './components.js';

const PANELS = [['presets', 'Presets'], ['shape', 'Shape'], ['pattern', 'Pattern'], ['emblem', 'Emblem'], ['colours', 'Colours'], ['extras', 'Text & trim']];
const state = { panel: 'presets' };

export function resetDesigner() { state.panel = 'presets'; }

export function designerHTML(spec, ctx, presets) {
  const p = state.panel;
  let panel = '';
  if (p === 'presets') {
    panel = `<div class="choice-grid big">${presets.map((pr, i) => `<button type="button" class="choice" data-act="bd" data-key="preset" data-value="${i}" aria-label="${esc(pr.name)}">${badgeSVG(pr.spec, ctx, 54)}<small>${esc(pr.name)}</small></button>`).join('')}</div>`;
  } else if (p === 'shape') {
    panel = `<div class="choice-grid">${Object.entries(SHAPES).map(([k, v]) => `<button type="button" class="choice ${spec.shape === k ? 'on' : ''}" data-act="bd" data-key="shape" data-value="${k}">${badgeSVG({ ...spec, shape: k, text: 'none', stars: 0 }, ctx, 44)}<small>${esc(v.label)}</small></button>`).join('')}</div>`;
  } else if (p === 'pattern') {
    panel = `<div class="choice-grid">${Object.entries(PATTERNS).map(([k, v]) => `<button type="button" class="choice ${spec.pattern === k ? 'on' : ''}" data-act="bd" data-key="pattern" data-value="${k}">${badgeSVG({ ...spec, pattern: k, emblem: 'none', text: 'none', stars: 0 }, ctx, 44)}<small>${esc(v.label)}</small></button>`).join('')}</div>`;
  } else if (p === 'emblem') {
    panel = `<div class="choice-grid">${Object.entries(EMBLEMS).map(([k, v]) => `<button type="button" class="choice ${spec.emblem === k ? 'on' : ''}" data-act="bd" data-key="emblem" data-value="${k}">${badgeSVG({ ...spec, emblem: k, text: 'none', stars: 0, pattern: 'solid' }, ctx, 44)}<small>${esc(v.label)}</small></button>`).join('')}</div>`;
  } else if (p === 'colours') {
    panel = `${colorField('bd.c1', spec.c1, 'Base colour')}${colorField('bd.c2', spec.c2, 'Pattern colour')}${colorField('bd.c3', spec.c3, 'Emblem & text colour')}${colorField('bd.trim', spec.trim, 'Trim, ribbon & stars')}
      <button type="button" class="btn ghost sm" data-act="bd" data-key="swap" data-value="1">${ICONS.swap} Swap base & pattern</button>`;
  } else {
    panel = `<label class="field"><span>Text</span><select data-field="bd.text">${Object.entries(TEXT_MODES).map(([k, v]) => `<option value="${k}" ${spec.text === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <div class="field"><span>Trim</span>${segmented('bd.border', Object.entries(BORDERS), spec.border || 'single', 'bd-seg')}</div>
      <div class="field"><span>Stars above badge</span>${segmented('bd.stars', [0, 1, 2, 3, 4, 5].map((n) => [n, String(n)]), spec.stars || 0, 'bd-seg')}</div>`;
  }
  return `<div class="designer">
    <div class="designer-preview" data-preview>${badgeSVG(spec, ctx, 132)}</div>
    <div class="designer-tools">
      <div class="chips">${PANELS.map(([k, l]) => `<button type="button" class="chip ${k === p ? 'on' : ''}" data-act="bd-panel" data-value="${k}">${l}</button>`).join('')}
      <button type="button" class="chip" data-act="bd" data-key="random" data-value="1">${ICONS.dice} Random</button></div>
      <div class="designer-panel">${panel}</div>
    </div>
  </div>`;
}

export function randomSpec(rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const cols = PALETTE.filter((c) => !['#f5f5f4', '#9ca3af', '#6b7280'].includes(c));
  const c1 = pick(cols);
  let c2 = pick(cols); while (c2 === c1) c2 = pick(cols);
  const light = ['#ffffff', '#facc15', '#fde68a'];
  return {
    shape: pick(Object.keys(SHAPES)), pattern: rng() < 0.35 ? 'solid' : pick(Object.keys(PATTERNS)),
    emblem: pick(Object.keys(EMBLEMS).filter((k) => k !== 'none')), c1, c2, c3: pick(light), trim: pick(light),
    text: pick(Object.keys(TEXT_MODES)), border: pick(['single', 'single', 'double', 'none']), stars: rng() < 0.8 ? 0 : Math.ceil(rng() * 3),
  };
}

/** Apply a designer click to the spec. Returns true if handled. */
export function applyDesignerAction(spec, el, presets) {
  const act = el.dataset.act;
  if (act === 'bd-panel') { state.panel = el.dataset.value; return true; }
  if (act === 'bd-seg') {
    const key = el.dataset.name.replace('bd.', '');
    spec[key] = key === 'stars' ? Number(el.dataset.value) : el.dataset.value;
    return true;
  }
  if (act === 'color' && el.dataset.name && el.dataset.name.startsWith('bd.')) {
    spec[el.dataset.name.slice(3)] = el.dataset.value; return true;
  }
  if (act !== 'bd') return false;
  const { key, value } = el.dataset;
  if (key === 'preset') Object.assign(spec, presets[Number(value)].spec, { stars: presets[Number(value)].spec.stars || 0 });
  else if (key === 'random') Object.assign(spec, randomSpec());
  else if (key === 'swap') { const t = spec.c1; spec.c1 = spec.c2; spec.c2 = t; }
  else spec[key] = value;
  return true;
}

/** Live input from the designer (colour pickers / text select). Returns true if handled. */
export function applyDesignerInput(spec, el) {
  const f = el.dataset.field;
  if (!f || !f.startsWith('bd.')) return false;
  spec[f.slice(3)] = el.value;
  return true;
}

export function refreshPreview(root, spec, ctx) {
  const pv = root.querySelector('[data-preview]');
  if (pv) pv.innerHTML = badgeSVG(spec, ctx, 132);
}
