import { esc } from '../dom.js';
import { ICONS, header, colorField, slider, segmented } from '../components.js';
import { BADGE_PRESETS } from '../badge.js';
import { kitSVG, KIT_STYLES } from '../kit.js';
import { designerHTML, applyDesignerAction, applyDesignerInput, refreshPreview, resetDesigner } from '../badgeDesigner.js';
import { newClub, makeShort } from '../../data/model.js';
import { createClub, updateClub, deleteClub } from '../../core/actions.js';
import { FORMATION_KEYS, STYLES, STYLE_KEYS } from '../../engine/tactics.js';

let draft = null, draftKey = null;
const ui = { kit: 'home', squad: true };

function init(app, id) {
  const key = id || 'new';
  if (draftKey === key && draft) return;
  draftKey = key;
  resetDesigner();
  const c = id && app.world.clubs[id];
  draft = JSON.parse(JSON.stringify(c || newClub({ name: '', short: '', badge: { ...BADGE_PRESETS[0].spec }, ratings: { overall: 70, att: 70, mid: 70, def: 70, gk: 70 }, stadium: { name: '', capacity: 30000 } })));
  if (!c) { draft.colors = { primary: draft.badge.c1, secondary: draft.badge.c3 }; draft.name = ''; draft.short = ''; draft.stadium.name = ''; }
  ui.kit = 'home'; ui.squad = true;
}

export function leave() { draft = null; draftKey = null; }

const ctx = () => ({ name: draft.name || 'Your Club', short: draft.short || makeShort(draft.name || 'Your Club'), founded: draft.founded });

export function render(app, id) {
  init(app, id);
  if (id && !app.world.clubs[id]) return header({ title: 'Club not found', back: '#/clubs' });
  const k = draft.kits[ui.kit];
  const r = draft.ratings;
  return `${header({ title: id ? 'Edit club' : 'Create club', back: id ? `#/club/${id}` : '#/clubs', actions: '<button class="btn primary sm" data-act="save">Save</button>' })}
  <div class="pad form">
    <section class="card">
      <h3 class="card-title">Identity</h3>
      <label class="field"><span>Club name</span><input type="text" maxlength="60" data-field="name" value="${esc(draft.name)}" placeholder="e.g. Ravenmoor FC"></label>
      <div class="grid2">
        <label class="field"><span>Abbreviation</span><input type="text" maxlength="4" class="upper" data-field="short" value="${esc(draft.short)}" placeholder="${esc(ctx().short)}"></label>
        <label class="field"><span>Founded</span><input type="number" min="1800" max="2100" data-field="founded" value="${draft.founded}"></label>
      </div>
      ${colorField('col.primary', draft.colors.primary, 'Primary colour')}
      ${colorField('col.secondary', draft.colors.secondary, 'Secondary colour')}
      <button type="button" class="btn ghost sm" data-act="applyColours">${ICONS.refresh} Apply club colours to badge & kits</button>
    </section>

    <section class="card"><h3 class="card-title">Badge</h3>${designerHTML(draft.badge, ctx(), BADGE_PRESETS)}</section>

    <section class="card">
      <h3 class="card-title">Kits</h3>
      ${segmented('kit', [['home', 'Home'], ['away', 'Away'], ['third', 'Third']], ui.kit, 'kitTab')}
      <div class="kit-editor">
        <div class="kit-preview" data-kit-preview>${kitSVG(k, 120)}</div>
        <div class="choice-grid kits-grid">${Object.entries(KIT_STYLES).map(([key, v]) => `<button type="button" class="choice ${k.style === key ? 'on' : ''}" data-act="kitStyle" data-value="${key}">${kitSVG({ ...k, style: key }, 40, { shirtOnly: true })}<small>${esc(v.label)}</small></button>`).join('')}</div>
      </div>
      ${colorField('kit.c1', k.c1, 'Shirt')}${colorField('kit.c2', k.c2, 'Shirt pattern')}${colorField('kit.c3', k.c3, 'Collar & trim')}${colorField('kit.shorts', k.shorts, 'Shorts')}${colorField('kit.socks', k.socks, 'Socks')}
    </section>

    <section class="card">
      <h3 class="card-title">Stadium</h3>
      <label class="field"><span>Stadium name</span><input type="text" maxlength="60" data-field="stadium.name" value="${esc(draft.stadium.name)}" placeholder="e.g. The Rookery"></label>
      <label class="field"><span>Capacity</span><input type="number" min="100" max="250000" step="100" data-field="stadium.capacity" value="${draft.stadium.capacity}"></label>
    </section>

    <section class="card">
      <h3 class="card-title">Ratings</h3>
      ${slider({ name: 'r.overall', label: 'Overall', value: r.overall, min: 1, max: 99 })}
      ${slider({ name: 'r.att', label: 'Attack', value: r.att, min: 1, max: 99 })}
      ${slider({ name: 'r.mid', label: 'Midfield', value: r.mid, min: 1, max: 99 })}
      ${slider({ name: 'r.def', label: 'Defence', value: r.def, min: 1, max: 99 })}
      ${slider({ name: 'r.gk', label: 'Goalkeeper', value: r.gk, min: 1, max: 99 })}
      <button type="button" class="btn ghost sm" data-act="avg">Set overall to average of lines</button>
      <p class="hint">Club ratings blend with the actual squad according to the Squad Quality Influence setting.</p>
    </section>

    <section class="card">
      <h3 class="card-title">Tactics</h3>
      <div class="field"><span>Formation</span><div class="chips wrap">${FORMATION_KEYS.map((f) => `<button type="button" class="chip ${draft.tactics.formation === f ? 'on' : ''}" data-act="formation" data-value="${f}">${f}</button>`).join('')}</div></div>
      <div class="field"><span>Playing style</span><div class="chips wrap">${STYLE_KEYS.map((s) => `<button type="button" class="chip ${draft.tactics.style === s ? 'on' : ''}" data-act="style" data-value="${s}">${STYLES[s].label}</button>`).join('')}</div></div>
    </section>

    ${!id ? `<label class="card toggle-row"><input type="checkbox" data-field="squad" ${ui.squad ? 'checked' : ''}><span><b>Generate a 25-player squad</b><small>Players are created to match the ratings above. You can edit them later.</small></span></label>` : ''}
    ${id ? `<section class="card danger-zone"><button class="btn danger block" data-act="delete">${ICONS.trash} Delete club</button></section>` : ''}
    <button class="btn primary block" data-act="save">${id ? 'Save changes' : 'Create club'}</button>
  </div>`;
}

function refreshKit() {
  const el = document.querySelector('[data-kit-preview]');
  if (el) el.innerHTML = kitSVG(draft.kits[ui.kit], 120);
}

export const actions = {
  'bd-panel'(app, el) { applyDesignerAction(draft.badge, el, BADGE_PRESETS); app.render(); },
  'bd-seg'(app, el) { applyDesignerAction(draft.badge, el, BADGE_PRESETS); app.render(); },
  bd(app, el) { applyDesignerAction(draft.badge, el, BADGE_PRESETS); app.render(); },
  color(app, el) {
    const n = el.dataset.name;
    if (n.startsWith('bd.')) applyDesignerAction(draft.badge, el, BADGE_PRESETS);
    else if (n.startsWith('kit.')) draft.kits[ui.kit][n.slice(4)] = el.dataset.value;
    else if (n.startsWith('col.')) draft.colors[n.slice(4)] = el.dataset.value;
    app.render();
  },
  kitTab(app, el) { ui.kit = el.dataset.value; app.render(); },
  kitStyle(app, el) { draft.kits[ui.kit].style = el.dataset.value; app.render(); },
  formation(app, el) { draft.tactics.formation = el.dataset.value; app.render(); },
  style(app, el) { draft.tactics.style = el.dataset.value; app.render(); },
  avg(app) { const r = draft.ratings; r.overall = Math.round((r.att + r.mid + r.def + r.gk) / 4); app.render(); },
  applyColours(app) {
    const { primary: p, secondary: s } = draft.colors;
    Object.assign(draft.badge, { c1: p, c2: s, c3: s, trim: s });
    Object.assign(draft.kits.home, { c1: p, c2: s, c3: s, socks: p });
    Object.assign(draft.kits.away, { c1: s, c2: p, c3: p, shorts: s, socks: s });
    app.render();
  },
  save(app) {
    const id = app.route.params[0];
    if (!draft.name.trim()) { app.toast('Give the club a name', 'error'); return; }
    const data = { ...draft, short: draft.short || makeShort(draft.name) };
    if (data.lineup) data.lineup = { ...data.lineup, formation: data.tactics.formation };
    if (id) {
      if (app.act((w) => updateClub(w, id, data), 'Club saved')) { draft = null; draftKey = null; app.nav(`#/club/${id}`); }
    } else {
      delete data.id;
      const c = app.act((w) => createClub(w, data, { withSquad: ui.squad }), 'Club created');
      if (c) { draft = null; draftKey = null; app.nav(`#/club/${c.id}`); }
    }
  },
  async delete(app) {
    const id = app.route.params[0];
    if (await app.confirm('The club will be removed. Its players become free agents and league history keeps its name.', { ok: 'Delete club', danger: true })) {
      const ok = app.act((w) => { deleteClub(w, id); return true; }, 'Club deleted');
      if (ok) { draft = null; draftKey = null; app.nav('#/clubs'); }
    }
  },
};

export function onInput(app, el) {
  const f = el.dataset.field;
  if (!f) return;
  if (applyDesignerInput(draft.badge, el)) { refreshPreview(document, draft.badge, ctx()); syncSwatch(el); return; }
  if (f.startsWith('kit.')) { draft.kits[ui.kit][f.slice(4)] = el.value; refreshKit(); syncSwatch(el); return; }
  if (f.startsWith('col.')) { draft.colors[f.slice(4)] = el.value; syncSwatch(el); return; }
  if (f.startsWith('r.')) {
    draft.ratings[f.slice(2)] = Number(el.value);
    const out = document.querySelector(`[data-out="${f}"]`); if (out) out.textContent = el.value;
    el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    return;
  }
  if (f === 'name' || f === 'short') { draft[f] = el.value; refreshPreview(document, draft.badge, ctx()); return; }
  if (f === 'founded') { draft.founded = Number(el.value) || draft.founded; return; }
  if (f === 'stadium.name') { draft.stadium.name = el.value; return; }
  if (f === 'stadium.capacity') { draft.stadium.capacity = Number(el.value) || 0; }
}

function syncSwatch(el) {
  const lab = el.closest('.color-current');
  if (lab) lab.style.background = el.value;
}

export function onChange(app, el) {
  const f = el.dataset.field;
  if (f === 'squad') { ui.squad = el.checked; return; }
  if (f === 'bd.text') { applyDesignerInput(draft.badge, el); app.render(); return; }
  if (el.type === 'color') app.render();
}
