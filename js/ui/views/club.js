import { esc, fmtNum } from '../dom.js';
import { ICONS, header, tabs, clubBadge, ratingChip, formPills, emptyState, flag, posTag, leagueLogo } from '../components.js';
import { kitSVG } from '../kit.js';
import { computeTable } from '../../league/table.js';
import { clubForm, playerStats } from '../../league/season.js';
import { selectLineup } from '../../engine/strength.js';
import { FORMATION_KEYS, STYLES, STYLE_KEYS, POSITIONS } from '../../engine/tactics.js';
import { clubRecords } from '../../league/records.js';
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
    const t = computeTable(l.season.clubIds, l.season.fixtures, l.config);
    const r = t.find((x) => x.clubId === c.id);
    return `<a class="card standing" href="#/league/${l.id}/table">${leagueLogo(l, 36)}<div><b>${esc(l.name)}</b><small>${esc(l.season.label)}</small></div>
      <div class="st-pos"><b>${r.pos}<sup>${ord(r.pos)}</sup></b><small>${r.pts} pts · ${r.p} played</small></div>${formPills(clubForm(l, c.id))}</a>`;
  }).join('');
  const titles = c.honours.filter((h) => h.type === 'league').length;
  return `${standings || '<p class="hint">This club is not in a league yet.</p>'}
    <div class="card"><h3 class="card-title">Ratings</h3>
      ${bar('Overall', c.ratings.overall)}${bar('Attack', c.ratings.att)}${bar('Midfield', c.ratings.mid)}${bar('Defence', c.ratings.def)}${bar('Goalkeeper', c.ratings.gk)}</div>
    <div class="card"><h3 class="card-title">Tactics</h3>
      <label class="field"><span>Formation</span><select data-field="formation">${FORMATION_KEYS.map((f) => `<option ${c.tactics.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
      <label class="field"><span>Playing style</span><select data-field="style">${STYLE_KEYS.map((s) => `<option value="${s}" ${c.tactics.style === s ? 'selected' : ''}>${STYLES[s].label}</option>`).join('')}</select></label>
      <p class="hint">Tactics change line strengths and create match-up advantages, scaled by the Tactical Influence setting.</p></div>
    <div class="card"><h3 class="card-title">Kits</h3><div class="kits">
      ${['home', 'away', 'third'].map((k) => `<div class="kit-item">${kitSVG(c.kits[k], 76)}<small>${k[0].toUpperCase() + k.slice(1)}</small></div>`).join('')}</div></div>
    <div class="card"><h3 class="card-title">Trophy cabinet</h3>${titles ? `<p class="trophies">${'🏆'.repeat(Math.min(titles, 20))} <b>${titles}</b> league title${titles > 1 ? 's' : ''}</p>` : '<p class="muted">No trophies yet.</p>'}<a href="#/club/${c.id}/honours" class="link">All honours ›</a></div>`;
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
  const lineup = selectLineup(squad, c.tactics.formation, ps, app.params().fatigueWeight);
  const groups = [['Goalkeepers', ['GK']], ['Defenders', ['RB', 'CB', 'LB']], ['Midfielders', ['DM', 'CM', 'AM', 'RM', 'LM']], ['Forwards', ['RW', 'LW', 'ST']]];
  const avg = Math.round(squad.reduce((s, p) => s + p.overall, 0) / squad.length);
  const xiIds = new Set(lineup.xi.map((s) => s.pid));
  return `<div class="row between"><p class="hint">${squad.length} players · avg OVR ${avg} · ${c.tactics.formation}${l ? ` · condition from ${esc(l.name)}` : ''}</p></div>
    <h3 class="section-title">Starting XI</h3>
    ${pitchHTML(app, lineup, c.kits.home)}
    <p class="hint">Picked automatically from fitness, availability and position fit.</p>
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
  const order = { league: 0, promotion: 1, runnerup: 2 };
  const items = Object.values(groups).sort((a, b) => order[a.type] - order[b.type] || b.seasons.length - a.seasons.length);
  if (!items.length) return emptyState('The cabinet is empty', 'Win a league title or earn promotion to fill it.');
  const icon = { league: '🏆', promotion: '⬆️', runnerup: '🥈' };
  const title = { league: 'Champions', promotion: 'Promoted', runnerup: 'Runners-up' };
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
    app.act((w) => updateClub(w, id, { tactics: { ...w.clubs[id].tactics, [f]: el.value } }), 'Tactics updated');
  }
}
