import { esc } from '../dom.js';
import { ICONS, header, clubBadge, statBar, segmented, formPills, emptyState } from '../components.js';
import { currentRound, clubForm, playersByClub } from '../../league/season.js';
import { teamStrength } from '../../engine/strength.js';
import { matchPreview, formScore } from '../../engine/match.js';
import { FORMATIONS, STYLES } from '../../engine/tactics.js';
import { simFixture } from '../simActions.js';
import { textColorOn } from '../badge.js';

const ui = { tab: 'summary', side: 'home' };

export function render(app, leagueId, fixtureId) {
  const w = app.world;
  const l = w.leagues[leagueId];
  const f = l && l.season && l.season.fixtures.find((x) => x.id === fixtureId);
  if (!f) return `${header({ title: 'Match', back: '#/leagues' })}<div class="pad">${emptyState('Match not found', 'It may belong to a previous season.')}</div>`;
  const h = w.clubs[f.home], a = w.clubs[f.away];
  const r = f.result;
  const goals = (side) => r ? r.events.filter((e) => e.type === 'goal' && e.side === side) : [];
  const scorerLine = (side) => goals(side).map((e) => `<span>${esc(pname(w, e.pid))} ${e.minute}'${e.added ? '+' + e.added : ''}${e.kind === 'pen' ? ' (P)' : e.kind === 'own' ? ' (OG)' : ''}</span>`).join('');
  const board = `<section class="scoreboard" style="--hc:${h.colors.primary};--ac:${a.colors.primary}">
    <small class="sb-meta">${esc(l.name)} · Matchday ${f.round} · ${esc(h.stadium.name)}</small>
    <div class="sb-main">
      <a class="sb-team" href="#/club/${h.id}">${clubBadge(h, 64)}<b>${esc(h.name)}</b></a>
      <div class="sb-score">${r ? `<span>${r.hg}</span><i>-</i><span>${r.ag}</span>` : '<em>vs</em>'}<small>${r ? 'Full time' : 'Not played'}</small></div>
      <a class="sb-team" href="#/club/${a.id}">${clubBadge(a, 64)}<b>${esc(a.name)}</b></a>
    </div>
    ${r ? `<div class="sb-scorers"><div>${scorerLine('home')}</div><div>${scorerLine('away')}</div></div>` : ''}
  </section>`;
  const back = `#/league/${l.id}/fixtures`;
  if (!r) return `${header({ title: 'Match preview', back })}${board}<div class="pad">${preview(app, l, f)}</div>`;
  const tab = ui.tab;
  let body;
  if (tab === 'stats') body = statsView(r);
  else if (tab === 'lineups') body = lineupsView(app, f, r);
  else body = timeline(app, f, r);
  return `${header({ title: 'Match report', back })}${board}
    <div class="pad">${segmented('tab', [['summary', 'Summary'], ['stats', 'Stats'], ['lineups', 'Line-ups']], tab)}${body}</div>`;
}

function pname(w, pid) {
  const p = pid && w.players[pid];
  return p ? p.name.split(' ').slice(-1)[0] : 'Unknown';
}
function fullName(w, pid) { const p = pid && w.players[pid]; return p ? p.name : 'Unknown player'; }

function timeline(app, f, r) {
  const w = app.world;
  const motm = r.motm && w.players[r.motm];
  const ev = r.events;
  const icon = (e) => e.type === 'goal' ? `<i class="ev-ico goal">${ICONS.ball}</i>` : e.type === 'yellow' ? '<i class="ev-ico yc"></i>' : e.type === 'red' ? '<i class="ev-ico rc"></i>' : e.type === 'injury' ? `<i class="ev-ico inj">${ICONS.medkit}</i>` : `<i class="ev-ico sub">${ICONS.swap}</i>`;
  const text = (e) => {
    if (e.type === 'goal') return `<b>${esc(fullName(w, e.pid))}</b>${e.kind === 'pen' ? ' <em>penalty</em>' : e.kind === 'own' ? ' <em>own goal</em>' : e.kind === 'header' ? ' <em>header</em>' : e.kind === 'long' ? ' <em>long range</em>' : ''}${e.assist ? `<small>Assist: ${esc(fullName(w, e.assist))}</small>` : ''}`;
    if (e.type === 'yellow') return `${esc(fullName(w, e.pid))}<small>Yellow card</small>`;
    if (e.type === 'red') return `<b>${esc(fullName(w, e.pid))}</b><small>${e.second ? 'Second yellow — sent off' : 'Straight red card'}</small>`;
    if (e.type === 'injury') return `${esc(fullName(w, e.pid))}<small>Injured · out ${e.rounds} match${e.rounds > 1 ? 'es' : ''}</small>`;
    return `<span class="in">▲ ${esc(fullName(w, e.pid))}</span><small>▼ ${esc(fullName(w, e.outPid))}${e.reason === 'injury' ? ' (injury)' : ''}</small>`;
  };
  let hg = 0, ag = 0;
  const rows = ev.map((e) => {
    let score = '';
    if (e.type === 'goal') { if (e.side === 'home') hg++; else ag++; score = `<span class="ev-score">${hg}-${ag}</span>`; }
    return `<li class="ev ${e.side} ${e.type}"><span class="ev-min">${e.minute}'${e.added ? `<sup>+${e.added}</sup>` : ''}</span><div class="ev-body">${icon(e)}<div>${text(e)}</div>${score}</div></li>`;
  });
  const ht = r.events.filter((e) => e.type === 'goal' && (e.minute < 45 || (e.minute === 45)));
  const htH = ht.filter((e) => e.side === 'home').length, htA = ht.filter((e) => e.side === 'away').length;
  const idx = ev.findIndex((e) => e.minute > 45);
  if (idx >= 0) rows.splice(idx, 0, `<li class="ev-divider">Half time ${htH}-${htA}</li>`); else rows.push(`<li class="ev-divider">Half time ${htH}-${htA}</li>`);
  return `${motm ? `<a class="card motm" href="#/player/${motm.id}"><small>Player of the match</small><b>${esc(motm.name)}</b>${r.pl[motm.id] && r.pl[motm.id][1] != null ? `<span class="rchip r-elite">${r.pl[motm.id][1].toFixed(1)}</span>` : ''}</a>` : ''}
    <div class="card"><ul class="timeline">${rows.join('') || '<li class="muted">A quiet game.</li>'}<li class="ev-divider">Full time ${r.hg}-${r.ag}</li></ul></div>
    <div class="card xg-card"><small>Pre-match expected goals</small><div><b>${r.xgPre.home.toFixed(2)}</b><span>xG model</span><b>${r.xgPre.away.toFixed(2)}</b></div></div>`;
}

function statsView(r) {
  const s = r.stats;
  return `<div class="card stats-card">
    ${statBar('Possession', s.possession[0], s.possession[1], { pct: true })}
    ${statBar('Expected goals', s.xg[0], s.xg[1], { fmt: (x) => Number(x).toFixed(2) })}
    ${statBar('Shots', s.shots[0], s.shots[1])}
    ${statBar('Shots on target', s.shotsOnTarget[0], s.shotsOnTarget[1])}
    ${statBar('Corners', s.corners[0], s.corners[1])}
    ${statBar('Passes', s.passes[0], s.passes[1])}
    ${statBar('Pass accuracy', s.passAccuracy[0], s.passAccuracy[1], { pct: true })}
    ${statBar('Saves', s.saves[0], s.saves[1])}
    ${statBar('Fouls', s.fouls[0], s.fouls[1])}
    ${statBar('Offsides', s.offsides[0], s.offsides[1])}
    ${statBar('Yellow cards', s.yellow[0], s.yellow[1])}
    ${statBar('Red cards', s.red[0], s.red[1])}
  </div>`;
}

const ROW_OF = { GK: 0, RB: 1, CB: 1, LB: 1, DM: 2, CM: 3, RM: 3, LM: 3, AM: 4, RW: 4, LW: 4, ST: 5 };
const LAT = { LB: -1, LM: -1, LW: -1, RB: 1, RM: 1, RW: 1 };
export function pitchPositions(slots) {
  const hasAM = slots.includes('AM');
  const rows = {};
  slots.forEach((s, i) => {
    let row = ROW_OF[s];
    if ((s === 'RW' || s === 'LW') && !hasAM) row = 5;
    (rows[row] || (rows[row] = [])).push({ s, i });
  });
  const Y = { 0: 87, 1: 71, 2: 58.5, 3: 46, 4: 31, 5: 14 };
  const pos = new Array(slots.length);
  for (const row in rows) {
    const items = rows[row].slice().sort((a, b) => (LAT[a.s] || 0) - (LAT[b.s] || 0));
    const n = items.length;
    items.forEach((it, k) => {
      const x = n === 1 ? 50 : 12 + (76 * k) / (n - 1);
      pos[it.i] = { x: n === 2 && row !== '1' ? 30 + 40 * k : x, y: Y[row] };
    });
  }
  return pos;
}

export function pitchHTML(app, lineup, kit, opts = {}) {
  const w = app.world;
  const slots = lineup.xi.map((s) => s.slot);
  const pos = pitchPositions(slots);
  const fg = textColorOn(kit.c1);
  return `<div class="pitch"><div class="pitch-lines"><i class="box top"></i><i class="box bottom"></i><i class="circle"></i><i class="half"></i></div>
    ${lineup.xi.map((s, i) => {
      const p = s.pid && w.players[s.pid];
      const rating = opts.ratings && opts.ratings[s.pid] != null ? `<em>${Number(opts.ratings[s.pid]).toFixed(1)}</em>` : '';
      const extra = opts.marks ? opts.marks(s.pid) : '';
      if (opts.edit) {
        const warn = opts.warn ? opts.warn(s.pid) : '';
        return `<button type="button" class="pp edit ${p ? '' : 'empty'} ${warn ? 'warn' : ''}" data-act="slot" data-i="${i}" style="left:${pos[i].x}%;top:${pos[i].y}%"><span class="shirt" style="${p ? `background:${kit.c1};color:${fg};border-color:${kit.c3}` : ''}">${p ? p.number : '+'}</span>${warn}<b>${esc(p ? p.name.split(' ').slice(-1)[0] : 'Choose')}</b><small>${s.slot}${p && p.position !== s.slot ? ` · ${p.position}` : ''}</small></button>`;
      }
      return `<a class="pp" href="${p ? `#/player/${p.id}` : '#'}" style="left:${pos[i].x}%;top:${pos[i].y}%"><span class="shirt" style="background:${kit.c1};color:${fg};border-color:${kit.c3}">${p ? p.number : '?'}</span>${rating}${extra}<b>${esc(p ? p.name.split(' ').slice(-1)[0] : 'Youth')}</b><small>${s.slot}</small></a>`;
    }).join('')}</div>`;
}

function lineupsView(app, f, r) {
  const w = app.world;
  const side = ui.side;
  const lu = r.lineups[side];
  const club = w.clubs[f[side]];
  if (!lu) return emptyState('No line-up recorded', 'This club has no players. Add a squad to see line-ups.');
  const kit = side === 'home' ? club.kits.home : (clashes(w.clubs[f.home].kits.home, club.kits.home) ? club.kits.away : club.kits.home);
  const subsOn = r.events.filter((e) => e.type === 'sub' && e.side === side);
  const ratings = Object.fromEntries(Object.entries(r.pl).map(([k, v]) => [k, v[1]]));
  const marks = (pid) => {
    const g = r.events.filter((e) => e.type === 'goal' && e.pid === pid && e.kind !== 'own').length;
    const y = r.events.some((e) => e.type === 'yellow' && e.pid === pid), red = r.events.some((e) => e.type === 'red' && e.pid === pid);
    const off = subsOn.some((e) => e.outPid === pid);
    return `<span class="marks">${'⚽'.repeat(g)}${y && !red ? '<i class="mk-y"></i>' : ''}${red ? '<i class="mk-r"></i>' : ''}${off ? '<i class="mk-off">▼</i>' : ''}</span>`;
  };
  return `${segmented('side', [['home', w.clubs[f.home].short], ['away', w.clubs[f.away].short]], side)}
    <p class="hint center">${esc(club.name)} · ${lu.formation} · ${esc((STYLES[club.tactics.style] || STYLES.balanced).label)}</p>
    ${pitchHTML(app, lu, kit, { ratings, marks })}
    <div class="card"><h3 class="card-title">Substitutes</h3>
    ${lu.bench.map((pid) => { const p = w.players[pid]; const on = subsOn.find((e) => e.pid === pid); return `<a class="sub-row ${on ? 'used' : ''}" href="#/player/${pid}"><span class="num">${p ? p.number : ''}</span><span>${esc(p ? p.name : 'Unknown')}</span><small>${p ? p.position : ''}</small>${on ? `<em>▲ ${on.minute}'</em>${ratings[pid] != null ? `<b>${ratings[pid].toFixed(1)}</b>` : ''}` : ''}</a>`; }).join('')}</div>`;
}

function hexDist(a, b) {
  const p = (h) => { const n = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };
  const x = p(a), y = p(b);
  return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0));
}
export function clashes(k1, k2) { try { return hexDist(k1.c1, k2.c1) < 120; } catch { return false; } }

function preview(app, l, f) {
  const w = app.world;
  const params = app.params();
  const h = w.clubs[f.home], a = w.clubs[f.away];
  const sq = playersByClub(w);
  const ps = l.season.ps;
  const H = teamStrength(h, sq[h.id] || [], ps, params);
  const A = teamStrength(a, sq[a.id] || [], ps, params);
  const hf = clubForm(l, h.id, f.round), af = clubForm(l, a.id, f.round);
  const pv = matchPreview(H, A, params, { homeForm: formScore(hf), awayForm: formScore(af) });
  const pr = pv.probs;
  const pct = (x) => Math.round(x * 100);
  const canPlay = f.round === currentRound(l);
  const unavailable = (club) => (sq[club.id] || []).filter((p) => ps[p.id] && (ps[p.id].inj > 0 || ps[p.id].sus > 0))
    .map((p) => `<span class="tag">${ps[p.id].inj > 0 ? ICONS.medkit : '🟥'} ${esc(p.name.split(' ').slice(-1)[0])}</span>`).join('') || '<span class="muted">None</span>';
  return `<div class="card">
      <h3 class="card-title">Win probability</h3>
      <div class="probbar"><i class="h" style="width:${pct(pr.home)}%">${pct(pr.home)}%</i><i class="d" style="width:${pct(pr.draw)}%">${pct(pr.draw)}%</i><i class="a" style="width:${pct(pr.away)}%">${pct(pr.away)}%</i></div>
      <div class="problabels"><span>${esc(h.short)} win</span><span>Draw</span><span>${esc(a.short)} win</span></div>
      <p class="hint">Expected goals ${pv.xg.home.toFixed(2)} – ${pv.xg.away.toFixed(2)} under your current simulation settings (before match-day randomness).</p>
    </div>
    <div class="card stats-card">
      <h3 class="card-title">Strength comparison</h3>
      ${statBar('Attack', H.att.toFixed(1), A.att.toFixed(1))}
      ${statBar('Midfield', H.mid.toFixed(1), A.mid.toFixed(1))}
      ${statBar('Defence', H.def.toFixed(1), A.def.toFixed(1))}
      ${statBar('Goalkeeper', H.gk.toFixed(1), A.gk.toFixed(1))}
      ${statBar('Squad availability', Math.round(H.availability * 100), Math.round(A.availability * 100), { pct: true })}
      <div class="vs-row"><span>${formPills(hf)}</span><small>Form</small><span>${formPills(af)}</span></div>
      <div class="vs-row"><span>${H.formation} · ${esc(STYLES[H.style].label)}</span><small>Tactics</small><span>${A.formation} · ${esc(STYLES[A.style].label)}</span></div>
    </div>
    <div class="card"><h3 class="card-title">Unavailable</h3><p>${esc(h.short)}: ${unavailable(h)}</p><p>${esc(a.short)}: ${unavailable(a)}</p></div>
    ${H.lineup ? `<h3 class="section-title row between"><span>${h.lineup && h.lineup.manual ? 'Your' : 'Predicted'} ${esc(h.short)} XI</span><a class="link" href="#/club/${h.id}/squad">Edit line-up ›</a></h3>${pitchHTML(app, H.lineup, h.kits.home)}` : ''}
    ${A.lineup ? `<h3 class="section-title row between"><span>${a.lineup && a.lineup.manual ? 'Your' : 'Predicted'} ${esc(a.short)} XI</span><a class="link" href="#/club/${a.id}/squad">Edit line-up ›</a></h3>${pitchHTML(app, A.lineup, clashes(h.kits.home, a.kits.home) ? a.kits.away : a.kits.home)}` : ''}
    ${canPlay ? `<div class="sim-bar"><button class="btn primary block" data-act="sim">${ICONS.play} Simulate this match</button></div>` : `<p class="hint center">${ICONS.info} This match can be played once matchday ${f.round} is the current matchday.</p>`}`;
}

export const actions = {
  seg(app, el) { ui[el.dataset.name] = el.dataset.value; app.render(); },
  sim(app) {
    const [lid, fid] = app.route.params;
    ui.tab = 'summary';
    const f = simFixture(app, lid, fid);
    if (f && f.result) {
      const sb = document.querySelector('.scoreboard');
      if (sb) sb.classList.add('flash');
    }
  },
};

export { FORMATIONS };
