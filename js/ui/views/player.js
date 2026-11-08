import { esc } from '../dom.js';
import { ICONS, header, clubBadge, ratingChip, emptyState, flag, posTag } from '../components.js';
import { ATTRIBUTES } from '../../data/model.js';
import { nationName } from '../../data/nations.js';
import { POSITION_NAMES } from '../../engine/tactics.js';
import { playerStats } from '../../league/season.js';
import { kitSVG } from '../kit.js';

export function render(app, id) {
  const w = app.world;
  const p = w.players[id];
  if (!p) return `${header({ title: 'Player', back: '#/players' })}<div class="pad">${emptyState('Player not found')}</div>`;
  const c = w.clubs[p.clubId];
  const seasons = [];
  for (const l of Object.values(w.leagues)) {
    if (!l.season) continue;
    const s = playerStats(l.season.fixtures)[p.id];
    if (s) seasons.push({ l, s, cond: l.season.ps[p.id] });
  }
  const live = seasons.filter((x) => !x.l.season.finished).reduce((t, x) => ({ apps: t.apps + x.s.apps, g: t.g + x.s.g, a: t.a + x.s.a }), { apps: 0, g: 0, a: 0 });
  const car = p.career || {};
  const awards = p.awards || [];
  const awardLabel = { 'golden-boot': '👟 Golden Boot', playmaker: '🎯 Playmaker award', title: '🏆 League title' };
  const attrs = ATTRIBUTES.filter((a) => p.position === 'GK' || a.key !== 'goalkeeping');
  return `${header({ title: p.name, back: c ? `#/club/${c.id}/squad` : '#/players', actions: `<a class="icon-btn" href="#/player/${p.id}/edit" aria-label="Edit player">${ICONS.edit}</a>` })}
  <section class="player-hero" style="--c1:${c ? c.colors.primary : '#312e81'};--c2:${c ? c.colors.secondary : '#7c3aed'}">
    <div class="ph-kit">${c ? kitSVG(c.kits.home, 84, { shirtOnly: true, number: p.number }) : `<span class="ph-num">${p.number || '–'}</span>`}</div>
    <div class="ph-info"><h2>${esc(p.name)}</h2><p>${posTag(p.position)} ${esc(POSITION_NAMES[p.position])}</p>
      <p>${flag(p.nation)} ${esc(nationName(p.nation))} · ${p.age} yrs · ${esc(p.foot)} foot</p>
      ${c ? `<a class="club-link" href="#/club/${c.id}">${clubBadge(c, 20)}<span>${esc(c.name)}</span></a>` : '<span class="muted">Free agent</span>'}</div>
    <div class="ph-ovr">${ratingChip(p.overall)}<small>OVR</small></div>
  </section>
  <div class="pad">
    <div class="card"><h3 class="card-title">Attributes</h3><div class="attr-grid">${attrs.map((a) => {
      const v = p.attributes[a.key] || 0;
      return `<div class="attr"><span>${a.label}</span><div class="rbar-track"><i style="width:${v}%" class="${v >= 80 ? 'hi' : v >= 65 ? 'mid' : 'lo'}"></i></div><b>${v}</b></div>`;
    }).join('')}</div></div>
    <div class="card"><h3 class="card-title">Career</h3>
      <div class="kpis"><div><b>${(car.apps || 0) + live.apps}</b><small>Apps</small></div><div><b>${(car.goals || 0) + live.g}</b><small>Goals</small></div><div><b>${(car.assists || 0) + live.a}</b><small>Assists</small></div><div><b>${car.seasons || 0}</b><small>Seasons</small></div></div>
      ${car.best ? `<p class="hint">Best season: ${car.best} goals</p>` : ''}
    </div>
    ${seasons.length ? `<h3 class="section-title">This season</h3>${seasons.map(({ l, s, cond }) => `<div class="card">
      <h3 class="card-title">${esc(l.name)} <span class="count">${esc(l.season.label)}</span></h3>
      <div class="kpis"><div><b>${s.apps}</b><small>Apps</small></div><div><b>${s.g}</b><small>Goals</small></div><div><b>${s.a}</b><small>Assists</small></div><div><b>${s.avg ? s.avg.toFixed(2) : '–'}</b><small>Avg rating</small></div></div>
      <p class="hint">${s.starts} starts · ${s.min} minutes · ${s.motm} player of the match · ${s.yc} yellow · ${s.rc} red${p.position === 'GK' ? ` · ${s.cs} clean sheets` : ''}</p>
      ${cond ? `<p class="hint">Fitness ${Math.round(cond.fit)}%${cond.inj > 0 ? ` · injured (${cond.inj} matchday${cond.inj > 1 ? 's' : ''})` : ''}${cond.sus > 0 ? ` · suspended (${cond.sus})` : ''}</p>` : ''}
    </div>`).join('')}` : ''}
    <div class="card"><h3 class="card-title">Awards</h3>${awards.length ? awards.slice().reverse().map((a) => `<p class="award">${awardLabel[a.type] || a.type} <small>${esc(a.leagueName)} · ${esc(a.season)}${a.goals ? ` · ${a.goals} goals` : ''}${a.assists ? ` · ${a.assists} assists` : ''}</small></p>`).join('') : '<p class="muted">No awards yet.</p>'}</div>
  </div>`;
}
