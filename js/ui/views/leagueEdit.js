import { esc } from '../dom.js';
import { ICONS, header, clubBadge, segmented, slider } from '../components.js';
import { LEAGUE_LOGO_PRESETS, BADGE_PRESETS } from '../badge.js';
import { designerHTML, applyDesignerAction, applyDesignerInput, refreshPreview, resetDesigner } from '../badgeDesigner.js';
import { LEAGUE_DEFAULTS, makeShort } from '../../data/model.js';
import { createLeague, updateLeague, setLeagueClubs, restartLeagueSeason, deleteLeague, updateCup } from '../../core/actions.js';
import { seasonStarted } from '../../league/season.js';
import { entryGroups } from '../../league/knockout.js';

let draft = null, draftKey = null, search = '';

function init(app, id) {
  const key = id || 'new';
  if (draftKey === key && draft) return;
  draftKey = key; search = '';
  resetDesigner();
  const l = id && app.world.leagues[id];
  if (l && l.type === 'cup' && l.format === 'knockout') {
    draft = { type: 'knockout', name: l.name, short: l.short, logo: { ...l.logo }, clubIds: [], config: { ...l.config } };
    return;
  }
  if (l && l.type === 'cup') {
    const q = (l.config.qualifiers || [])[0] || { leagueId: '', spots: 3 };
    draft = { type: 'cup', name: l.name, short: l.short, logo: { ...l.logo }, clubIds: (l.regulars || []).slice(), config: { ...l.config }, qualifier: { ...q } };
    return;
  }
  draft = l
    ? { name: l.name, short: l.short, logo: { ...l.logo }, clubIds: l.clubIds.slice(), config: { ...l.config } }
    : { name: '', short: '', logo: { ...LEAGUE_LOGO_PRESETS[0].spec }, clubIds: [], config: { ...LEAGUE_DEFAULTS } };
}

export function leave() { draft = null; draftKey = null; }

export function render(app, id) {
  init(app, id);
  const w = app.world;
  const l = id && w.leagues[id];
  if (id && !l) return `${header({ title: 'League not found', back: '#/leagues' })}`;
  if (draft.type === 'cup') return cupEditor(app, l);
  if (draft.type === 'knockout') return knockoutEditor(app, l);
  const locked = l && seasonStarted(l) && !l.season.finished;
  const c = draft.config;
  const clubs = Object.values(w.clubs).sort((a, b) => a.name.localeCompare(b.name));
  const q = search.toLowerCase();
  const shown = clubs.filter((cl) => !q || cl.name.toLowerCase().includes(q) || cl.short.toLowerCase().includes(q));
  const others = Object.values(w.leagues).filter((x) => !l || x.id !== l.id);
  const n = draft.clubIds.length;
  const rounds = n < 2 ? 0 : (n % 2 ? n : n - 1) * c.legs;
  const ctx = { name: draft.name || 'League', short: draft.short || makeShort(draft.name || 'League') };
  return `${header({ title: l ? 'Edit league' : 'New league', back: l ? `#/league/${l.id}` : '#/leagues', actions: `<button class="btn primary sm" data-act="save">Save</button>` })}
  <div class="pad form">
    <section class="card">
      <h3 class="card-title">Competition</h3>
      <label class="field"><span>Name</span><input type="text" maxlength="60" data-field="name" value="${esc(draft.name)}" placeholder="e.g. Kronliga"></label>
      <label class="field"><span>Abbreviation</span><input type="text" maxlength="4" data-field="short" value="${esc(draft.short)}" placeholder="${esc(ctx.short)}" class="upper"></label>
    </section>
    <section class="card"><h3 class="card-title">Logo</h3>${designerHTML(draft.logo, ctx, LEAGUE_LOGO_PRESETS.concat(BADGE_LIKE))}</section>
    <section class="card">
      <h3 class="card-title">Clubs <span class="count">${n} selected</span></h3>
      ${locked ? `<p class="note">${ICONS.info} The season is under way, so participants are locked. Restart the season below to change clubs, or change them once the season is complete (they apply to the next season).</p>` : ''}
      ${!clubs.length ? `<p class="muted">No clubs yet. <a href="#/clubs/new">Create a club</a> first.</p>` : `
      <div class="row gap"><input type="search" placeholder="Search clubs" data-field="search" value="${esc(search)}" ${locked ? 'disabled' : ''}>
        <button class="btn sm ghost" data-act="all" ${locked ? 'disabled' : ''}>All</button><button class="btn sm ghost" data-act="none" ${locked ? 'disabled' : ''}>None</button></div>
      <div class="pick-list">${shown.map((cl) => {
        const on = draft.clubIds.includes(cl.id);
        const elsewhere = Object.values(w.leagues).filter((x) => x.id !== (l && l.id) && x.clubIds.includes(cl.id)).map((x) => x.short);
        return `<label class="pick ${on ? 'on' : ''}"><input type="checkbox" data-club="${cl.id}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''}>${clubBadge(cl, 26)}<span><b>${esc(cl.name)}</b><small>OVR ${cl.ratings.overall}${elsewhere.length ? ` · also in ${esc(elsewhere.join(', '))}` : ''}</small></span></label>`;
      }).join('')}</div>`}
    </section>
    <section class="card">
      <h3 class="card-title">Format</h3>
      <div class="field"><span>Season length — times each pair meets</span>${segmented('legs', [[1, 'Once'], [2, 'Home & away'], [3, 'Three'], [4, 'Four']], c.legs)}</div>
      <p class="hint">${n >= 2 ? `${rounds} matchdays · ${(n * (n - 1) / 2) * c.legs} matches per season` : 'Select at least 2 clubs'}</p>
      ${slider({ name: 'cfg.daysBetweenRounds', label: 'Days between matchdays (recovery time)', value: c.daysBetweenRounds, min: 2, max: 14, suffix: ' days' })}
      <div class="grid2">
        <label class="field"><span>Points for a win</span><input type="number" min="1" max="5" data-field="cfg.pointsWin" value="${c.pointsWin}"></label>
        <label class="field"><span>Points for a draw</span><input type="number" min="0" max="3" data-field="cfg.pointsDraw" value="${c.pointsDraw}"></label>
      </div>
      <div class="field"><span>Tiebreaker</span>${segmented('tiebreak', [['gd', 'Goal difference'], ['h2h', 'Head-to-head']], c.tiebreak)}</div>
      <label class="field"><span>First season starts</span><input type="number" min="1850" max="2200" data-field="cfg.startYear" value="${c.startYear}"></label>
    </section>
    <section class="card">
      <h3 class="card-title">Places, promotion & relegation</h3>
      <div class="grid2">
        <label class="field"><span>Champions</span><select data-field="cfg.championsSpots"><option value="1" ${c.championsSpots ? 'selected' : ''}>Highlight champion</option><option value="0" ${!c.championsSpots ? 'selected' : ''}>No highlight</option></select></label>
        <label class="field"><span>Continental places</span><input type="number" min="0" max="10" data-field="cfg.continentalSpots" value="${c.continentalSpots}"></label>
      </div>
      <label class="field"><span>League above (promotion goes here)</span><select data-field="cfg.upperLeagueId"><option value="">None — top division</option>${others.map((x) => `<option value="${x.id}" ${c.upperLeagueId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Promoted clubs</span><input type="number" min="0" max="10" data-field="cfg.promotionSpots" value="${c.promotionSpots}"></label>
      <label class="field"><span>League below (relegation goes here)</span><select data-field="cfg.lowerLeagueId"><option value="">None — bottom division</option>${others.map((x) => `<option value="${x.id}" ${c.lowerLeagueId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Relegated clubs</span><input type="number" min="0" max="10" data-field="cfg.relegationSpots" value="${c.relegationSpots}"></label>
      <label class="field"><span>Play automatically with</span><select data-field="cfg.followLeagueId"><option value="">No — I play it myself</option>${others.filter((x) => x.type !== 'cup').map((x) => `<option value="${x.id}" ${c.followLeagueId === x.id ? 'selected' : ''}>${esc(x.name)} (matchday by matchday)</option>`).join('')}</select></label>
      <p class="hint">Linked leagues swap clubs automatically when you start the next season. Each league keeps its own fixtures, results and player fitness.</p>
    </section>
    <section class="card">
      <h3 class="card-title">Random seed</h3>
      <div class="field">${segmented('seedMode', [['random', 'New seed each season'], ['fixed', 'Fixed seed']], c.seedMode)}</div>
      ${c.seedMode === 'fixed' ? `<label class="field"><span>Seed</span><input type="text" maxlength="24" data-field="cfg.fixedSeed" value="${esc(c.fixedSeed)}" placeholder="e.g. derby-2026"></label>` : ''}
      <p class="hint">With a fixed seed, re-running a season with the same clubs and simulation settings reproduces every result exactly.</p>
    </section>
    ${l ? `<section class="card danger-zone"><h3 class="card-title">Manage</h3>
      ${!l.season.finished ? `<button class="btn ghost block" data-act="restart">${ICONS.refresh} Restart current season</button>` : ''}
      <button class="btn danger block" data-act="delete">${ICONS.trash} Delete league</button></section>` : ''}
    <button class="btn primary block" data-act="save">${l ? 'Save changes' : 'Create league & generate fixtures'}</button>
  </div>`;
}

// League logos can also use club badge presets for variety
const BADGE_LIKE = BADGE_PRESETS.slice(0, 12);

function knockoutEditor(app, l) {
  const w = app.world;
  const ctx = { name: draft.name || 'Cup', short: draft.short || 'CUP' };
  const entries = entryGroups(w, l).map((g) => `<div class="kv"><span>${esc(g.label || 'Clubs')}</span><b>${g.ids.length} clubs · round ${g.round}</b></div>`).join('');
  return `${header({ title: 'Edit competition', back: `#/league/${l.id}`, actions: '<button class="btn primary sm" data-act="save">Save</button>' })}
  <div class="pad form">
    <section class="card"><h3 class="card-title">Competition</h3>
      <label class="field"><span>Name</span><input type="text" maxlength="60" data-field="name" value="${esc(draft.name)}"></label>
      <label class="field"><span>Abbreviation</span><input type="text" maxlength="4" class="upper" data-field="short" value="${esc(draft.short)}"></label>
      <p class="hint">Knockout · one match per tie · extra time and penalties if level · final at ${esc(l.config.finalVenue || 'a neutral ground')}.</p>
    </section>
    <section class="card"><h3 class="card-title">Who enters when</h3>${entries}<p class="hint">League clubs are taken from the league at each new season's draw, so new Kronliga clubs are included automatically.</p></section>
    <section class="card"><h3 class="card-title">Logo</h3>${designerHTML(draft.logo, ctx, LEAGUE_LOGO_PRESETS.concat(BADGE_LIKE))}</section>
    <section class="card danger-zone"><h3 class="card-title">Manage</h3>
      ${!l.season.finished ? `<button class="btn ghost block" data-act="restart">${ICONS.refresh} Redraw this season (wipes its results)</button>` : ''}
      <button class="btn danger block" data-act="delete">${ICONS.trash} Delete competition</button></section>
    <button class="btn primary block" data-act="save">Save changes</button>
  </div>`;
}

function cupEditor(app, l) {
  const w = app.world;
  const q = draft.qualifier;
  const leagues = Object.values(w.leagues).filter((x) => x.type !== 'cup');
  const qualifierIds = new Set(l.season && l.season.qualifiers ? l.season.qualifiers : []);
  const clubs = Object.values(w.clubs).filter((c) => !(q.leagueId && w.leagues[q.leagueId] && w.leagues[q.leagueId].clubIds.includes(c.id)))
    .sort((a, b) => b.ratings.overall - a.ratings.overall);
  const ctx = { name: draft.name || 'Cup', short: draft.short || 'CUP' };
  const size = l.config.size || 32;
  const need = size - (q.leagueId ? Number(q.spots) || 0 : 0);
  return `${header({ title: 'Edit competition', back: `#/league/${l.id}`, actions: '<button class="btn primary sm" data-act="save">Save</button>' })}
  <div class="pad form">
    <section class="card"><h3 class="card-title">Competition</h3>
      <label class="field"><span>Name</span><input type="text" maxlength="60" data-field="name" value="${esc(draft.name)}"></label>
      <label class="field"><span>Abbreviation</span><input type="text" maxlength="4" class="upper" data-field="short" value="${esc(draft.short)}"></label>
      <p class="hint">Format: ${size} clubs · 8 groups of 4 (home & away) · two-legged Round of 16, quarter-finals and semi-finals · one-off final at a neutral ground. Level ties go to extra time and penalties.</p>
    </section>
    <section class="card"><h3 class="card-title">Logo</h3>${designerHTML(draft.logo, ctx, LEAGUE_LOGO_PRESETS.concat(BADGE_LIKE))}</section>
    <section class="card"><h3 class="card-title">Qualification</h3>
      <label class="field"><span>Qualifying league</span><select data-field="q.leagueId"><option value="">None</option>${leagues.map((x) => `<option value="${x.id}" ${q.leagueId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Places (top of the final table)</span><input type="number" min="1" max="8" data-field="q.spots" value="${esc(q.spots)}"></label>
      <p class="hint">At the end of each league season, its top ${esc(q.spots)} go into the next ${esc(draft.name)}. Changes apply from the next draw.</p>
    </section>
    <section class="card"><h3 class="card-title">Continental clubs <span class="count">${draft.clubIds.length} selected · ${need} needed</span></h3>
      <p class="hint">The strongest ${need} selected clubs fill the rest of the field each season.${qualifierIds.size ? ' League qualifiers are added automatically.' : ''}</p>
      <div class="pick-list">${clubs.map((c) => { const on = draft.clubIds.includes(c.id); return `<label class="pick ${on ? 'on' : ''}"><input type="checkbox" data-club="${c.id}" ${on ? 'checked' : ''}>${clubBadge(c, 26)}<span><b>${esc(c.name)}</b><small>OVR ${c.ratings.overall}${c.country ? ` · ${esc(c.country)}` : ''}</small></span></label>`; }).join('')}</div>
    </section>
    <section class="card danger-zone"><h3 class="card-title">Manage</h3>
      ${!l.season.finished ? `<button class="btn ghost block" data-act="restart">${ICONS.refresh} Redraw this season (wipes its results)</button>` : ''}
      <button class="btn danger block" data-act="delete">${ICONS.trash} Delete competition</button></section>
    <button class="btn primary block" data-act="save">Save changes</button>
  </div>`;
}

export const actions = {
  'bd-panel'(app, el) { applyDesignerAction(draft.logo, el, LEAGUE_LOGO_PRESETS.concat(BADGE_LIKE)); app.render(); },
  'bd-seg'(app, el) { applyDesignerAction(draft.logo, el, []); app.render(); },
  bd(app, el) { applyDesignerAction(draft.logo, el, LEAGUE_LOGO_PRESETS.concat(BADGE_LIKE)); app.render(); },
  color(app, el) { applyDesignerAction(draft.logo, el, []); app.render(); },
  seg(app, el) {
    const { name, value } = el.dataset;
    if (name === 'legs') draft.config.legs = Number(value);
    else draft.config[name] = value;
    app.render();
  },
  all(app) { draft.clubIds = Object.keys(app.world.clubs); app.render(); },
  none(app) { draft.clubIds = []; app.render(); },
  async save(app) {
    const id = app.route.params[0];
    const data = { name: draft.name, short: draft.short || makeShort(draft.name || 'League'), logo: draft.logo, config: draft.config };
    if (!draft.name.trim()) { app.toast('Give the league a name', 'error'); return; }
    if (draft.type === 'knockout') {
      const ok = app.act((w) => { updateCup(w, id, { name: draft.name, short: draft.short, logo: draft.logo }); return true; }, 'Competition saved');
      if (ok) { draft = null; draftKey = null; app.nav(`#/league/${id}`, { replace: true }); }
      return;
    }
    if (draft.type === 'cup') {
      const q = draft.qualifier;
      const ok = app.act((w) => { updateCup(w, id, { name: draft.name, short: draft.short, logo: draft.logo, regulars: draft.clubIds, qualifiers: q.leagueId ? [{ leagueId: q.leagueId, spots: q.spots }] : [] }); return true; }, 'Competition saved');
      if (ok) { draft = null; draftKey = null; app.nav(`#/league/${id}`, { replace: true }); }
      return;
    }
    if (!id) {
      const l = app.act((w) => createLeague(w, { ...data, clubIds: draft.clubIds }), 'League created');
      if (l) { draft = null; draftKey = null; app.nav(`#/league/${l.id}/fixtures`, { replace: true }); }
      return;
    }
    const ok = app.act((w) => {
      const l = w.leagues[id];
      const sameClubs = l.clubIds.length === draft.clubIds.length && l.clubIds.every((x) => draft.clubIds.includes(x));
      updateLeague(w, id, data);
      if (!sameClubs) setLeagueClubs(w, id, draft.clubIds);
      return true;
    }, 'League saved');
    if (ok) { draft = null; draftKey = null; app.nav(`#/league/${id}`, { replace: true }); }
  },
  async restart(app) {
    const id = app.route.params[0];
    if (await app.confirm('All results this season will be wiped and new fixtures generated.', { ok: 'Restart season', danger: true })) {
      if (app.act((w) => restartLeagueSeason(w, id), 'Season restarted')) { draft = null; draftKey = null; app.nav(`#/league/${id}/fixtures`, { replace: true }); }
    }
  },
  async delete(app) {
    const id = app.route.params[0];
    if (await app.confirm('The league, its fixtures and its history will be deleted. Clubs and players are kept.', { ok: 'Delete league', danger: true })) {
      app.act((w) => deleteLeague(w, id), 'League deleted');
      draft = null; draftKey = null; app.nav('#/leagues', { replace: true });
    }
  },
};

export function onInput(app, el) {
  if (applyDesignerInput(draft.logo, el)) { refreshPreview(document, draft.logo, { name: draft.name, short: draft.short }); return; }
  const f = el.dataset.field;
  if (f === 'name' || f === 'short') { draft[f] = el.value; refreshPreview(document, draft.logo, { name: draft.name, short: draft.short }); }
  if (f === 'search') { search = el.value; const pos = el.selectionStart; app.render(); const s = document.querySelector('[data-field="search"]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } }
  if (f && f.startsWith('cfg.') && el.type === 'range') {
    draft.config[f.slice(4)] = Number(el.value);
    const out = document.querySelector(`[data-out="${f}"]`); if (out) out.textContent = el.value + ' days';
    el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  }
}

export function onChange(app, el) {
  if (el.dataset.club) {
    const id = el.dataset.club;
    draft.clubIds = el.checked ? [...new Set([...draft.clubIds, id])] : draft.clubIds.filter((x) => x !== id);
    app.render(); return;
  }
  if (applyDesignerInput(draft.logo, el)) { app.render(); return; }
  const f = el.dataset.field;
  if (f === 'q.leagueId' || f === 'q.spots') {
    draft.qualifier[f.slice(2)] = f === 'q.spots' ? Number(el.value) : el.value;
    app.render(); return;
  }
  if (f && f.startsWith('cfg.')) {
    const k = f.slice(4);
    draft.config[k] = ['upperLeagueId', 'lowerLeagueId', 'fixedSeed', 'followLeagueId'].includes(k) ? (el.value || null) : Number(el.value);
    if (k === 'fixedSeed') draft.config.fixedSeed = el.value;
    app.render();
  }
}
