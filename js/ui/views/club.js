import { esc, fmtNum, sheet } from '../dom.js';
import { ICONS, header, tabs, clubBadge, ratingChip, formPills, emptyState, flag, posTag, leagueLogo, segmented } from '../components.js';
import { kitSVG } from '../kit.js';
import { computeTable } from '../../league/table.js';
import { clubForm, playerStats } from '../../league/season.js';
import { selectLineup } from '../../engine/strength.js';
import { FORMATION_KEYS, FORMATIONS, STYLES, STYLE_KEYS, POSITIONS, positionFit } from '../../engine/tactics.js';
import { clubRecords } from '../../league/records.js';
import { cupClubStatus } from '../../league/cup.js';
import { fillSquad, releaseSquad, squadOf, updateClub } from '../../core/actions.js';
import { pitchHTML } from './match.js';

const TABS = [['overview', 'Overview'], ['squad', 'Squad'], ['honours', 'Honours'], ['records', 'Records']];

function activeLeague(w, clubId) {
  return Object.values(w.leagues).find((l) => l.season && l.season.clubIds.includes(clubId));
}

export function render(app, id, tab = 'overview') {
  const w = app.world;
  const c = w.clubs[id];
  if (!c) return `${header({ title: 'Club not found', back: '#/clubs' })}<div class="pad">${emptyState('This club no longer exists')}</div>`;
  let body;
  if (tab === 'squad') body = squadTab(app, c);
  else if (tab === 'honours') body = honoursTab(app, c);
  else if (tab === 'records') body = recordsTab(app, c);
  else body = overviewTab(app, c);
  return `${header({ title: c.name, back: '#/clubs', actions: `<a class="icon-btn" href="#/club/${c.id}/edit" aria-label="Edit club">${ICONS.edit}</a>` })}
    <section class="club-hero" style="--c1:${c.colors.primary};--c2:${c.colors.secondary}">
      <div class="ch-badge">${clubBadge(c, 104)}</div>
      <div class="ch-info"><h2>${esc(c.name)}</h2><p>${esc(c.short)} · Est. ${c.founded}</p><p>${esc(c.stadium.name)} · ${fmtNum(c.stadium.capacity)}</p></div>
      <div class="ch-ovr">${ratingChip(c.ratings.overall)}<small>OVR</small></div>
    </section>
    ${tabs(TABS, tab, `#/club/${c.id}`)}<div class="pad">${body}</div>`;
}

function bar(label, v) {
  return `<div class="rbar"><span>${label}</span><div class="rbar-track"><i style="width:${v}%"></i></div><b>${v}</b></div>`;
}

function overviewTab(app, c) {
  const w = app.world;
  const leagues = Object.values(w.leagues).filter((l) => l.season && l.season.clubIds.includes(c.id));
  const standings = leagues.map((l) => {
    if (l.type === 'cup') {
      return `<a class="card standing" href="#/league/${l.id}/${l.season.ties.length ? 'bracket' : 'groups'}">${leagueLogo(l, 36)}<div><b>${esc(l.name)}</b><small>${esc(l.season.label)}</small></div>
      <div class="st-pos"><b class="cup-status">${esc(cupClubStatus(l, c.id))}</b></div></a>`;
    }
    const t = computeTable(l.season.clubIds, l.season.fixtures, l.config);
    const r = t.find((x) => x.clubId === c.id);
    return `<a class="card standing" href="#/league/${l.id}/table">${leagueLogo(l, 36)}<div><b>${esc(l.name)}</b><small>${esc(l.season.label)}</small></div>
      <div class="st-pos"><b>${r.pos}<sup>${ord(r.pos)}</sup></b><small>${r.pts} pts · ${r.p} played</small></div>${formPills(clubForm(l, c.id))}</a>`;
  }).join('');
  const titles = c.honours.filter((h) => h.type === 'league' || h.type === 'cup').length;
  return `${standings || '<p class="hint">This club is not in a league yet.</p>'}
    <div class="card"><h3 class="card-title">Ratings</h3>
      ${bar('Overall', c.ratings.overall)}${bar('Attack', c.ratings.att)}${bar('Midfield', c.ratings.mid)}${bar('Defence', c.ratings.def)}${bar('Goalkeeper', c.ratings.gk)}</div>
    <div class="card"><h3 class="card-title">Tactics</h3>
      <label class="field"><span>Formation</span><select data-field="formation">${FORMATION_KEYS.map((f) => `<option ${c.tactics.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
      <label class="field"><span>Playing style</span><select data-field="style">${STYLE_KEYS.map((s) => `<option value="${s}" ${c.tactics.style === s ? 'selected' : ''}>${STYLES[s].label}</option>`).join('')}</select></label>
      <p class="hint">Tactics change line strengths and create match-up advantages, scaled by the Tactical Influence setting.</p></div>
    <div class="card"><h3 class="card-title">Kits</h3><div class="kits">
      ${['home', 'away', 'third'].map((k) => `<div class="kit-item">${kitSVG(c.kits[k], 76)}<small>${k[0].toUpperCase() + k.slice(1)}</small></div>`).join('')}</div></div>
    <div class="card"><h3 class="card-title">Trophy cabinet</h3>${titles ? `<p class="trophies">${'🏆'.repeat(Math.min(titles, 20))} <b>${titles}</b> major troph${titles > 1 ? 'ies' : 'y'}</p>` : '<p class="muted">No trophies yet.</p>'}<a href="#/club/${c.id}/honours" class="link">All honours ›</a></div>`;
}

function statusOf(ps, pid) {
  const s = ps[pid];
  if (!s) return null;
  if (s.inj > 0) return `Injured (${s.inj})`;
  if (s.sus > 0) return 'Suspended';
  return null;
}

function manualEditor(app, c, squad, ps, resolved) {
  const w = app.world;
  const m = c.lineup;
  const slots = FORMATIONS[m.formation] ? FORMATIONS[m.formation].slots : FORMATIONS[c.tactics.formation].slots;
  const display = { xi: slots.map((slot, i) => ({ slot, pid: m.xi[i] && w.players[m.xi[i]] && w.players[m.xi[i]].clubId === c.id ? m.xi[i] : null })) };
  const warn = (pid) => (pid && statusOf(ps, pid) ? '<span class="marks"><i class="mk-r"></i></span>' : '');
  const issues = display.xi.filter((s) => s.pid && statusOf(ps, s.pid)).map((s) => {
    const p = w.players[s.pid];
    const repl = resolved.xi[display.xi.indexOf(s)];
    const rp = repl && repl.pid && w.players[repl.pid];
    return `<li><b>${esc(p.name)}</b> — ${statusOf(ps, s.pid)}${rp ? `, <span class="in">${esc(rp.name)}</span> plays instead` : ''}</li>`;
  });
  const empty = display.xi.filter((s) => !s.pid).length;
  const bench = Array.from({ length: 9 }, (_, i) => m.bench[i] || null);
  return `<div class="field"><span>Formation</span><div class="chips wrap">${FORMATION_KEYS.map((f) => `<button type="button" class="chip ${m.formation === f ? 'on' : ''}" data-act="lineupFormation" data-value="${f}">${f}</button>`).join('')}</div></div>
    ${pitchHTML(app, display, c.kits.home, { edit: true, warn })}
    <p class="hint">${ICONS.info} Tap a position to pick a player. ${empty ? `${empty} empty position${empty > 1 ? 's' : ''} will be filled automatically.` : ''}</p>
    ${issues.length ? `<div class="note"><div><b>Unavailable for the next match</b><ul class="issues">${issues.join('')}</ul></div></div>` : ''}
    <div class="card flush"><div class="rank-head">Substitutes (${bench.filter(Boolean).length}/9)</div>
      ${bench.map((pid, i) => { const p = pid && w.players[pid]; const st = p && statusOf(ps, pid); return `<button type="button" class="sub-row editable" data-act="benchSlot" data-i="${i}"><span class="num">${p ? p.number : i + 1}</span>${p ? posTag(p.position) : ''}<span>${p ? esc(p.name) : '<em class="muted">Empty — auto pick</em>'}</span>${st ? `<span class="tag red">${st}</span>` : ''}${p ? ratingChip(p.overall) : ICONS.plus}</button>`; }).join('')}
    </div>
    <div class="row gap wrap"><button class="btn sm" data-act="lineupCopyAuto">${ICONS.refresh} Reset to auto pick</button><button class="btn sm ghost" data-act="lineupClear">${ICONS.trash} Clear</button></div>`;
}

async function pickPlayer(app, c, slot, { allowEmpty = true, exclude = new Set(), title }) {
  const w = app.world;
  const l = activeLeague(w, c.id);
  const ps = l ? l.season.ps : {};
  const squad = squadOf(w, c.id).filter((p) => !exclude.has(p.id))
    .map((p) => ({ p, v: slot ? Math.round(p.overall * positionFit(p.position, slot)) : p.overall }))
    .sort((a, b) => b.v - a.v);
  const rows = squad.map(({ p, v }) => {
    const st = statusOf(ps, p.id);
    const fit = ps[p.id] ? Math.round(ps[p.id].fit) : 100;
    return `<button class="pick-row" data-sheet="${p.id}"><span class="num">${p.number}</span>${posTag(p.position)}<span class="pr-name"><b>${esc(p.name)}</b><small>${slot ? `${v} as ${slot} · ` : ''}fitness ${fit}%${st ? ` · <span class="danger-text">${st}</span>` : ''}</small></span>${ratingChip(p.overall)}</button>`;
  }).join('');
  const out = await sheet(`<h3 class="sheet-title">${esc(title)}</h3><div class="pick-sheet">${rows || '<p class="muted">No players available.</p>'}</div>
    <div class="sheet-actions">${allowEmpty ? '<button class="btn ghost" data-sheet="__empty">Leave empty</button>' : ''}<button class="btn" data-sheet="__cancel">Cancel</button></div>`);
  if (out == null || out === '__cancel') return undefined;
  return out === '__empty' ? null : out;
}

function autoLineup(app, c) {
  const w = app.world;
  const l = activeLeague(w, c.id);
  const lu = selectLineup(squadOf(w, c.id), c.tactics.formation, l ? l.season.ps : {}, app.params().fatigueWeight);
  return { manual: true, formation: c.tactics.formation, xi: lu.xi.map((s) => s.pid), bench: lu.bench.slice() };
}

const ord = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

function squadTab(app, c) {
  const w = app.world;
  const squad = squadOf(w, c.id).sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || b.overall - a.overall);
  const l = activeLeague(w, c.id);
  const ps = l ? l.season.ps : {};
  const st = l ? playerStats(l.season.fixtures) : {};
  if (!squad.length) {
    return emptyState('No players', 'Generate a full squad that matches the club\'s ratings, or create players one by one.',
      `<button class="btn primary" data-act="fill">${ICONS.dice} Generate squad</button> <a class="btn" href="#/players/new?club=${c.id}">Add player</a>`);
  }
  const manual = c.lineup && c.lineup.manual ? c.lineup : null;
  const lineup = selectLineup(squad, c.tactics.formation, ps, app.params().fatigueWeight, 9, manual);
  const groups = [['Goalkeepers', ['GK']], ['Defenders', ['RB', 'CB', 'LB']], ['Midfielders', ['DM', 'CM', 'AM', 'RM', 'LM']], ['Forwards', ['RW', 'LW', 'ST']]];
  const avg = Math.round(squad.reduce((s, p) => s + p.overall, 0) / squad.length);
  const xiIds = new Set(lineup.xi.map((s) => s.pid));
  return `<div class="row between"><p class="hint">${squad.length} players · avg OVR ${avg} · ${c.tactics.formation}${l ? ` · condition from ${esc(l.name)}` : ''}</p></div>
    <h3 class="section-title">Starting XI</h3>
    ${segmented('lineupMode', [['auto', 'Auto pick'], ['manual', 'My line-up']], manual ? 'manual' : 'auto', 'lineupMode')}
    ${manual ? manualEditor(app, c, squad, ps, lineup) : `${pitchHTML(app, lineup, c.kits.home)}
    <p class="hint">Picked automatically from fitness, availability and position fit. Switch to <b>My line-up</b> to choose your own XI and substitutes.</p>`}
    <div class="row gap wrap">
      <a class="btn sm" href="#/players/new?club=${c.id}">${ICONS.plus} Add player</a>
      <button class="btn sm" data-act="fill" ${squad.length >= 25 ? 'disabled' : ''}>${ICONS.dice} Fill to 25</button>
      <button class="btn sm ghost danger-text" data-act="release">${ICONS.trash} Release all</button>
    </div>
    ${groups.map(([title, pos]) => {
      const list = squad.filter((p) => pos.includes(p.position));
      if (!list.length) return '';
      return `<h3 class="section-title">${title}</h3><div class="card flush">${list.map((p) => {
        const s = ps[p.id];
        const fit = s ? Math.round(s.fit) : 100;
        const status = s && s.inj > 0 ? `<span class="tag red">${ICONS.medkit} ${s.inj}</span>` : s && s.sus > 0 ? '<span class="tag red">SUS</span>' : '';
        const ps2 = st[p.id];
        return `<a class="player-row" href="#/player/${p.id}"><span class="num">${p.number}</span>${posTag(p.position)}
          <span class="pr-name"><b>${esc(p.name)} ${xiIds.has(p.id) ? '<i class="xi-dot" title="Starting XI"></i>' : ''}</b><small>${flag(p.nation)} ${p.age} yrs${ps2 ? ` · ${ps2.apps} apps · ${ps2.g} G · ${ps2.a} A` : ''}</small></span>
          ${status}<span class="fit" title="Fitness ${fit}%"><i style="width:${fit}%;background:${fit > 80 ? 'var(--ok)' : fit > 60 ? 'var(--warn)' : 'var(--bad)'}"></i></span>${ratingChip(p.overall)}</a>`;
      }).join('')}</div>`;
    }).join('')}`;
}

function honoursTab(app, c) {
  const groups = {};
  for (const h of c.honours) {
    const key = h.type + '|' + h.leagueName;
    (groups[key] || (groups[key] = { ...h, seasons: [] })).seasons.push(h.season);
  }
  const order = { cup: 0, league: 1, cupfinal: 2, promotion: 3, runnerup: 4 };
  const items = Object.values(groups).sort((a, b) => order[a.type] - order[b.type] || b.seasons.length - a.seasons.length);
  if (!items.length) return emptyState('The cabinet is empty', 'Win a league title or earn promotion to fill it.');
  const icon = { league: '🏆', promotion: '⬆️', runnerup: '🥈', cup: '⭐', cupfinal: '🥈' };
  const title = { league: 'Champions', promotion: 'Promoted', runnerup: 'Runners-up', cup: 'Winners', cupfinal: 'Finalists' };
  return `<div class="cabinet">${items.map((g) => `<div class="card trophy-card ${g.type}"><div class="tc-icon">${icon[g.type]}</div>
    <div><small>${title[g.type]}</small><h3>${esc(g.leagueName)}</h3><p>${g.seasons.map(esc).join(' · ')}</p></div><b class="tc-count">${g.seasons.length}</b></div>`).join('')}</div>`;
}

function recordsTab(app, c) {
  const w = app.world;
  const r = clubRecords(w, c.id);
  const scorers = squadOf(w, c.id).map((p) => {
    let g = (p.career && p.career.goals) || 0, a = (p.career && p.career.assists) || 0, apps = (p.career && p.career.apps) || 0;
    for (const l of Object.values(w.leagues)) {
      if (!l.season || l.season.finished) continue;
      const s = playerStats(l.season.fixtures)[p.id];
      if (s) { g += s.g; a += s.a; apps += s.apps; }
    }
    return { p, g, a, apps };
  }).filter((x) => x.apps > 0).sort((x, y) => y.g - x.g || y.a - x.a).slice(0, 10);
  if (!r.seasons.length) return emptyState('No records yet', 'Play matches in a league to start building club history.');
  const row = (label, val, sub) => `<div class="rec-row"><div class="rec-label">${label}</div><div class="rec-val"><b>${val}</b><span>${sub}</span></div></div>`;
  return `<div class="card flush">
      ${r.bestFinish ? row('Best finish', `${r.bestFinish.pos}${ord(r.bestFinish.pos)}`, `${esc(r.bestFinish.league)} · ${esc(r.bestFinish.label)}`) : ''}
      ${r.mostPts ? row('Most points in a season', r.mostPts.pts, `${esc(r.mostPts.league)} · ${esc(r.mostPts.label)}`) : ''}
      ${r.mostGoals ? row('Most goals in a season', r.mostGoals.gf, `${esc(r.mostGoals.league)} · ${esc(r.mostGoals.label)}`) : ''}
      ${r.bigWin ? row('Biggest win', `${r.bigWin.gf}–${r.bigWin.ga}`, `v ${esc(r.bigWin.oppName)} · ${esc(r.bigWin.label)}`) : ''}
      ${r.bigLoss ? row('Heaviest defeat', `${r.bigLoss.gf}–${r.bigLoss.ga}`, `v ${esc(r.bigLoss.oppName)} · ${esc(r.bigLoss.label)}`) : ''}
      ${row('Longest unbeaten run', r.unbeaten, 'matches')}
      ${row('All-time league record', `${r.wins}W / ${r.games}P`, `${r.gf} scored · ${r.ga} conceded`)}
    </div>
    <h3 class="section-title">Season by season</h3>
    <div class="card flush"><table class="ltable compact"><thead><tr><th>Season</th><th class="c-club">League</th><th>Pos</th><th>W-D-L</th><th>Pts</th></tr></thead><tbody>
      ${r.seasons.slice().reverse().map((s) => `<tr><td>${esc(s.label)}${s.complete ? '' : '*'}</td><td class="c-club"><span class="full show">${esc(s.league)}</span></td><td><b>${s.pos}</b>/${s.of}</td><td>${s.w}-${s.d}-${s.l}</td><td>${s.pts}</td></tr>`).join('')}
    </tbody></table></div><p class="hint">* season in progress</p>
    ${scorers.length ? `<h3 class="section-title">Top scorers (current squad, all competitions)</h3><div class="card flush">${scorers.map((x, i) => `<a class="rank-row" href="#/player/${x.p.id}"><span class="rk">${i + 1}</span>${posTag(x.p.position)}<span class="rk-name"><b>${esc(x.p.name)}</b><small>${x.apps} apps · ${x.a} assists</small></span><span class="rk-val">${x.g}</span></a>`).join('')}</div>` : ''}`;
}

export const actions = {
  lineupMode(app, el) {
    const id = app.route.params[0];
    const manual = el.dataset.value === 'manual';
    app.act((w) => {
      const c = w.clubs[id];
      if (manual) c.lineup = c.lineup && c.lineup.xi ? { ...c.lineup, manual: true } : autoLineup(app, c);
      else if (c.lineup) c.lineup.manual = false;
    }, manual ? 'Your line-up will be used in matches' : 'Line-up picked automatically');
  },
  lineupFormation(app, el) {
    const id = app.route.params[0];
    app.act((w) => { const c = w.clubs[id]; c.tactics.formation = el.dataset.value; c.lineup.formation = el.dataset.value; });
  },
  lineupCopyAuto(app) {
    const id = app.route.params[0];
    app.act((w) => { w.clubs[id].lineup = autoLineup(app, w.clubs[id]); }, 'Line-up reset to the auto pick');
  },
  lineupClear(app) {
    const id = app.route.params[0];
    app.act((w) => { const c = w.clubs[id]; c.lineup = { manual: true, formation: c.tactics.formation, xi: Array(11).fill(null), bench: [] }; });
  },
  async slot(app, el) {
    const id = app.route.params[0];
    const c = app.world.clubs[id];
    const i = Number(el.dataset.i);
    const slot = FORMATIONS[c.lineup.formation].slots[i];
    const pid = await pickPlayer(app, c, slot, { title: `Choose ${slot}` });
    if (pid === undefined) return;
    app.act((w) => {
      const m = w.clubs[id].lineup;
      const xi = Array.from({ length: 11 }, (_, k) => m.xi[k] || null);
      const old = xi[i];
      if (pid) {
        const j = xi.indexOf(pid);
        if (j >= 0) xi[j] = old; // swap positions
        const b = m.bench.indexOf(pid);
        if (b >= 0) { if (old) m.bench[b] = old; else m.bench.splice(b, 1); }
      }
      xi[i] = pid;
      m.xi = xi;
      m.bench = m.bench.filter((x) => x && !xi.includes(x));
    });
  },
  async benchSlot(app, el) {
    const id = app.route.params[0];
    const c = app.world.clubs[id];
    const i = Number(el.dataset.i);
    const pid = await pickPlayer(app, c, null, { title: `Substitute ${i + 1}`, exclude: new Set(c.lineup.xi.filter(Boolean)) });
    if (pid === undefined) return;
    app.act((w) => {
      const m = w.clubs[id].lineup;
      const bench = Array.from({ length: 9 }, (_, k) => m.bench[k] || null);
      const old = bench[i];
      if (pid) { const j = bench.indexOf(pid); if (j >= 0) bench[j] = old; }
      bench[i] = pid;
      m.bench = bench.filter(Boolean);
    });
  },
  fill(app) {
    const id = app.route.params[0];
    const created = app.act((w) => fillSquad(w, id, 25));
    if (created) app.toast(`${created.length} players generated`, 'ok');
  },
  async release(app) {
    const id = app.route.params[0];
    if (await app.confirm('Every player at this club will be deleted. Club ratings will be used on their own.', { ok: 'Release all', danger: true })) {
      app.act((w) => releaseSquad(w, id), 'Squad released');
    }
  },
};

export function onChange(app, el) {
  const id = app.route.params[0];
  const f = el.dataset.field;
  if (f === 'formation' || f === 'style') {
    app.act((w) => {
      updateClub(w, id, { tactics: { ...w.clubs[id].tactics, [f]: el.value } });
      if (f === 'formation' && w.clubs[id].lineup) w.clubs[id].lineup.formation = el.value;
    }, 'Tactics updated');
  }
}
