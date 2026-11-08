import { esc } from '../dom.js';
import { ICONS, header, slider, segmented } from '../components.js';
import { ATTRIBUTES, newPlayer, calcOverall } from '../../data/model.js';
import { NATIONS, randomName } from '../../data/nations.js';
import { POSITIONS, POSITION_NAMES } from '../../engine/tactics.js';
import { generateAttributes } from '../../data/generate.js';
import { createPlayer, updatePlayer, deletePlayer, freeNumber } from '../../core/actions.js';
import { RNG } from '../../core/rng.js';

let draft = null, draftKey = null;
const ui = { autoOverall: true };

function init(app, id) {
  const key = id || 'new:' + (app.route.query.club || '');
  if (draftKey === key && draft) return;
  draftKey = key;
  const p = id && app.world.players[id];
  if (p) { draft = JSON.parse(JSON.stringify(p)); ui.autoOverall = calcOverall(p.position, p.attributes) === p.overall; return; }
  const clubId = app.route.query.club && app.world.clubs[app.route.query.club] ? app.route.query.club : '';
  draft = newPlayer({ clubId: clubId || null, position: 'ST' });
  draft.name = '';
  draft.attributes = generateAttributes(new RNG(Date.now()), 'ST', 70);
  draft.overall = calcOverall('ST', draft.attributes);
  draft.number = clubId ? freeNumber(app.world, clubId) : 9;
  ui.autoOverall = true;
}

export function leave() { draft = null; draftKey = null; }

export function render(app, id) {
  init(app, id);
  const w = app.world;
  if (id && !w.players[id]) return header({ title: 'Player not found', back: '#/players' });
  const clubs = Object.values(w.clubs).sort((a, b) => a.name.localeCompare(b.name));
  const attrs = ATTRIBUTES;
  return `${header({ title: id ? 'Edit player' : 'Create player', back: id ? `#/player/${id}` : '#/players', actions: '<button class="btn primary sm" data-act="save">Save</button>' })}
  <div class="pad form">
    <section class="card">
      <h3 class="card-title">Profile</h3>
      <div class="row gap"><label class="field grow"><span>Name</span><input type="text" maxlength="40" data-field="name" value="${esc(draft.name)}" placeholder="Full name"></label>
        <button type="button" class="icon-btn" data-act="randName" aria-label="Random name">${ICONS.dice}</button></div>
      <label class="field"><span>Nationality</span><select data-field="nation">${NATIONS.map((n) => `<option value="${n.code}" ${draft.nation === n.code ? 'selected' : ''}>${n.flag} ${esc(n.name)}</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="field"><span>Age</span><input type="number" min="15" max="45" data-field="age" value="${draft.age}"></label>
        <label class="field"><span>Shirt number</span><input type="number" min="1" max="99" data-field="number" value="${draft.number}"></label>
      </div>
      <label class="field"><span>Position</span><select data-field="position">${POSITIONS.map((p) => `<option value="${p}" ${draft.position === p ? 'selected' : ''}>${p} — ${POSITION_NAMES[p]}</option>`).join('')}</select></label>
      <div class="field"><span>Preferred foot</span>${segmented('foot', [['Right', 'Right'], ['Left', 'Left'], ['Both', 'Both']], draft.foot)}</div>
      <label class="field"><span>Club</span><select data-field="clubId"><option value="">Free agent</option>${clubs.map((c) => `<option value="${c.id}" ${draft.clubId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    </section>
    <section class="card">
      <h3 class="card-title">Rating <span class="count">OVR <b data-ovr>${draft.overall}</b></span></h3>
      <label class="toggle-inline"><input type="checkbox" data-field="auto" ${ui.autoOverall ? 'checked' : ''}> Calculate overall from attributes</label>
      <div data-ovr-slider ${ui.autoOverall ? 'hidden' : ''}>${slider({ name: 'overall', label: 'Overall', value: draft.overall, min: 1, max: 99 })}</div>
      ${attrs.map((a) => slider({ name: 'a.' + a.key, label: a.label, value: draft.attributes[a.key] || 50, min: 1, max: 99 })).join('')}
      <div class="row gap wrap"><button type="button" class="btn sm ghost" data-act="randAttrs" data-q="62">${ICONS.dice} Random (squad player)</button><button type="button" class="btn sm ghost" data-act="randAttrs" data-q="78">${ICONS.dice} Random (star)</button></div>
    </section>
    ${id ? `<section class="card danger-zone"><button class="btn danger block" data-act="delete">${ICONS.trash} Delete player</button></section>` : ''}
    <button class="btn primary block" data-act="save">${id ? 'Save changes' : 'Create player'}</button>
  </div>`;
}

function syncOverall() {
  if (ui.autoOverall) draft.overall = calcOverall(draft.position, draft.attributes);
  const o = document.querySelector('[data-ovr]'); if (o) o.textContent = draft.overall;
}

export const actions = {
  seg(app, el) { draft.foot = el.dataset.value; app.render(); },
  randName(app) { draft.name = randomName(new RNG(Date.now() + Math.random()), draft.nation); app.render(); },
  randAttrs(app, el) {
    const rng = new RNG(Date.now() + Math.random());
    draft.attributes = generateAttributes(rng, draft.position, Number(el.dataset.q) + rng.int(-6, 6));
    ui.autoOverall = true; syncOverall(); app.render();
  },
  save(app) {
    const id = app.route.params[0];
    if (!draft.name.trim()) { app.toast('Give the player a name', 'error'); return; }
    const data = { ...draft, clubId: draft.clubId || null };
    if (id) {
      if (app.act((w) => updatePlayer(w, id, data), 'Player saved')) { draft = null; draftKey = null; app.nav(`#/player/${id}`); }
    } else {
      delete data.id;
      const p = app.act((w) => createPlayer(w, data), 'Player created');
      if (p) { draft = null; draftKey = null; app.nav(`#/player/${p.id}`); }
    }
  },
  async delete(app) {
    const id = app.route.params[0];
    if (await app.confirm('This player will be deleted. Past match reports will show them as "Unknown".', { ok: 'Delete player', danger: true })) {
      app.act((w) => deletePlayer(w, id), 'Player deleted');
      draft = null; draftKey = null; app.nav('#/players');
    }
  },
};

export function onInput(app, el) {
  const f = el.dataset.field;
  if (!f) return;
  if (f.startsWith('a.') || f === 'overall') {
    const v = Number(el.value);
    if (f === 'overall') draft.overall = v; else draft.attributes[f.slice(2)] = v;
    const out = document.querySelector(`[data-out="${f}"]`); if (out) out.textContent = v;
    el.style.setProperty('--p', `${((v - el.min) / (el.max - el.min)) * 100}%`);
    syncOverall();
    return;
  }
  if (f === 'name') draft.name = el.value;
  if (f === 'age') draft.age = Number(el.value) || draft.age;
  if (f === 'number') draft.number = Number(el.value) || draft.number;
}

export function onChange(app, el) {
  const f = el.dataset.field;
  if (f === 'auto') { ui.autoOverall = el.checked; syncOverall(); app.render(); return; }
  if (f === 'position') { draft.position = el.value; syncOverall(); app.render(); return; }
  if (f === 'nation') draft.nation = el.value;
  if (f === 'clubId') { draft.clubId = el.value || null; if (draft.clubId && !app.route.params[0]) draft.number = freeNumber(app.world, draft.clubId); app.render(); }
}
