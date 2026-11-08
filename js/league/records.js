// Records for leagues, clubs and players, derived from league history and the live season.
import { computeTable } from './table.js';
import { playerStats, clubStreaks, topList } from './season.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Normalised seasons: completed history + current season if it has results.
export function seasonsOf(world, league) {
  const out = league.history.map((h) => ({
    label: h.label, complete: true, table: h.table.map((r) => ({ ...r, gd: r.gf - r.ga })), results: h.results,
    streaks: h.streaks || {}, scorers: h.topScorers || [], names: h.clubNames || {},
  }));
  const s = league.season;
  if (s && !s.finished && s.fixtures.some((f) => f.result)) {
    const st = playerStats(s.fixtures);
    out.push({
      label: s.label, complete: false,
      table: computeTable(s.clubIds, s.fixtures, league.config),
      results: s.fixtures.filter((f) => f.result).map((f) => [f.round, f.home, f.away, f.result.hg, f.result.ag]),
      streaks: clubStreaks(s.clubIds, s.fixtures),
      scorers: topList(st, 'g', 10).map((x) => ({ pid: x.pid, name: world.players[x.pid] ? world.players[x.pid].name : 'Unknown', clubId: x.clubId, goals: x.g })),
      names: {},
    });
  }
  return out;
}

export function leagueRecords(world, league) {
  const seasons = seasonsOf(world, league);
  if (!seasons.length) return [];
  const cname = (s, id) => (world.clubs[id] ? world.clubs[id].name : s.names[id] || 'Former club');
  const tag = (s) => `${s.label}${s.complete ? '' : ' (live)'}`;
  const recs = [];
  const best = (label, pick, cmp, fmt, onlyComplete = false) => {
    let top = null;
    for (const s of seasons) {
      if (onlyComplete && !s.complete) continue;
      for (const r of s.table) {
        if (!r.p) continue;
        const v = pick(r);
        if (!top || cmp(v, top.v)) top = { v, r, s };
      }
    }
    if (top) recs.push({ label, value: fmt(top.v), html: `${esc(cname(top.s, top.r.clubId))} · ${esc(tag(top.s))}` });
  };
  best('Most points in a season', (r) => r.pts, (a, b) => a > b, (v) => `${v} pts`);
  best('Fewest points in a season', (r) => r.pts, (a, b) => a < b, (v) => `${v} pts`, true);
  best('Most wins in a season', (r) => r.w, (a, b) => a > b, (v) => `${v} wins`);
  best('Most goals scored', (r) => r.gf, (a, b) => a > b, (v) => `${v} goals`);
  best('Best defence', (r) => r.ga, (a, b) => a < b, (v) => `${v} conceded`, true);
  best('Best goal difference', (r) => r.gd, (a, b) => a > b, (v) => `${v > 0 ? '+' : ''}${v}`);

  let big = null, high = null;
  for (const s of seasons) for (const [, h, a, hg, ag] of s.results) {
    const m = Math.abs(hg - ag), t = hg + ag;
    if (!big || m > big.m || (m === big.m && Math.max(hg, ag) > Math.max(big.hg, big.ag))) big = { m, h, a, hg, ag, s };
    if (!high || t > high.t) high = { t, h, a, hg, ag, s };
  }
  if (big) recs.push({ label: 'Biggest win', value: `${big.hg}–${big.ag}`, html: `${esc(cname(big.s, big.h))} v ${esc(cname(big.s, big.a))} · ${esc(tag(big.s))}` });
  if (high) recs.push({ label: 'Highest-scoring match', value: `${high.hg}–${high.ag}`, html: `${esc(cname(high.s, high.h))} v ${esc(cname(high.s, high.a))} · ${esc(tag(high.s))}` });

  const streak = (label, key, unit) => {
    let top = null;
    for (const s of seasons) for (const id in s.streaks) {
      const v = s.streaks[id][key];
      if (!top || v > top.v) top = { v, id, s };
    }
    if (top && top.v > 0) recs.push({ label, value: `${top.v} ${unit}`, html: `${esc(cname(top.s, top.id))} · ${esc(tag(top.s))}` });
  };
  streak('Longest winning run', 'win', 'matches');
  streak('Longest unbeaten run', 'unbeaten', 'matches');
  streak('Longest losing run', 'losing', 'matches');

  let ts = null;
  for (const s of seasons) { const x = s.scorers[0]; if (x && (!ts || x.goals > ts.x.goals)) ts = { x, s }; }
  if (ts) recs.push({ label: 'Most goals in a season (player)', value: `${ts.x.goals} goals`, html: `${esc(ts.x.name)} · ${esc(cname(ts.s, ts.x.clubId))} · ${esc(tag(ts.s))}` });

  const titles = {};
  for (const h of league.history) titles[h.championId] = (titles[h.championId] || 0) + 1;
  const most = Object.entries(titles).sort((a, b) => b[1] - a[1])[0];
  if (most) recs.push({ label: 'Most titles', value: `${most[1]}`, html: esc(world.clubs[most[0]] ? world.clubs[most[0]].name : 'Former club') });
  return recs;
}

// Records for a single club across every league it has played in.
export function clubRecords(world, clubId) {
  const out = { seasons: [], bigWin: null, bigLoss: null, bestFinish: null, mostPts: null, mostGoals: null, unbeaten: 0, wins: 0, games: 0, gf: 0, ga: 0 };
  for (const l of Object.values(world.leagues)) {
    for (const s of seasonsOf(world, l)) {
      const row = s.table.find((r) => r.clubId === clubId);
      if (!row || !row.p) continue;
      const pos = s.table.indexOf(row) + 1;
      out.seasons.push({ league: l.name, leagueId: l.id, label: s.label, pos, of: s.table.length, pts: row.pts, complete: s.complete, w: row.w, d: row.d, l: row.l, gf: row.gf, ga: row.ga });
      if (s.complete && (!out.bestFinish || pos < out.bestFinish.pos)) out.bestFinish = { pos, league: l.name, label: s.label };
      if (!out.mostPts || row.pts > out.mostPts.pts) out.mostPts = { pts: row.pts, league: l.name, label: s.label };
      if (!out.mostGoals || row.gf > out.mostGoals.gf) out.mostGoals = { gf: row.gf, league: l.name, label: s.label };
      out.games += row.p; out.wins += row.w; out.gf += row.gf; out.ga += row.ga;
      if (s.streaks[clubId]) out.unbeaten = Math.max(out.unbeaten, s.streaks[clubId].unbeaten);
      for (const [, h, a, hg, ag] of s.results) {
        if (h !== clubId && a !== clubId) continue;
        const gf = h === clubId ? hg : ag, ga = h === clubId ? ag : hg;
        const opp = h === clubId ? a : h;
        const rec = { gf, ga, opp, oppName: world.clubs[opp] ? world.clubs[opp].name : s.names[opp] || 'Former club', label: s.label, league: l.name };
        if (gf > ga && (!out.bigWin || gf - ga > out.bigWin.gf - out.bigWin.ga || (gf - ga === out.bigWin.gf - out.bigWin.ga && gf > out.bigWin.gf))) out.bigWin = rec;
        if (ga > gf && (!out.bigLoss || ga - gf > out.bigLoss.ga - out.bigLoss.gf || (ga - gf === out.bigLoss.ga - out.bigLoss.gf && ga > out.bigLoss.ga))) out.bigLoss = rec;
      }
    }
  }
  return out;
}

// All-time player leaderboards: career totals plus live seasons.
export function playerLeaderboards(world) {
  const live = {};
  for (const l of Object.values(world.leagues)) {
    if (!l.season || l.season.finished) continue;
    const st = playerStats(l.season.fixtures);
    for (const x of Object.values(st)) {
      const t = live[x.pid] || (live[x.pid] = { apps: 0, g: 0, a: 0 });
      t.apps += x.apps; t.g += x.g; t.a += x.a;
    }
  }
  const rows = Object.values(world.players).map((p) => {
    const c = p.career || {}; const lv = live[p.id] || { apps: 0, g: 0, a: 0 };
    return { pid: p.id, name: p.name, clubId: p.clubId, apps: (c.apps || 0) + lv.apps, goals: (c.goals || 0) + lv.g, assists: (c.assists || 0) + lv.a, awards: (p.awards || []).length, titles: (p.awards || []).filter((a) => a.type === 'title').length };
  });
  const top = (k) => rows.filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 15);
  return { goals: top('goals'), assists: top('assists'), apps: top('apps'), titles: top('titles') };
}
