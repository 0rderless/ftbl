// "Restart game": wipe every achievement and stat but keep the clubs, players and line-ups,
// and start every competition again from the current real-world season (e.g. 2026/27).
import { startSeason } from './season.js';
import { isCup, isKnockout, startCupSeason } from './cup.js';
import { seasonLabel } from '../data/model.js';

/** The football season running on this date: from July a new season (e.g. Nov 2026 → 2026). */
export function currentSeasonYear(now = new Date()) {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function rating(world, id) {
  const c = world.clubs[id];
  return c && c.ratings ? c.ratings.overall : 0;
}

/**
 * Reset history, honours, awards and career totals, then start season 1 of every competition
 * in `year`. League memberships stay as they are now (the clubs currently in each division).
 * Returns a short summary.
 */
export function restartWorld(world, year = currentSeasonYear()) {
  const leagues = Object.values(world.leagues);
  // Champions League-style cups need qualifiers; work them out before the history is wiped:
  // the latest final table of each feeder league, limited to clubs still in that league.
  const cupQualifiers = {};
  for (const cup of leagues.filter((l) => isCup(l) && !isKnockout(l))) {
    const qualifiers = [];
    for (const { leagueId, spots } of cup.config.qualifiers || []) {
      const l = world.leagues[leagueId];
      if (!l) continue;
      const members = l.clubIds.filter((id) => world.clubs[id]);
      const last = l.history.length ? l.history[l.history.length - 1].table.map((r) => r.clubId) : [];
      const order = [...last.filter((id) => members.includes(id)), ...members.slice().sort((a, b) => rating(world, b) - rating(world, a))];
      for (const id of order) {
        if (qualifiers.filter((q) => members.includes(q)).length >= spots) break;
        if (!qualifiers.includes(id)) qualifiers.push(id);
      }
    }
    cupQualifiers[cup.id] = qualifiers;
  }

  // achievements and stats
  for (const c of Object.values(world.clubs)) c.honours = [];
  for (const p of Object.values(world.players)) {
    p.awards = [];
    p.career = { apps: 0, goals: 0, assists: 0, seasons: 0 };
  }

  // leagues first (cups draw from them), then group cups, then knockouts
  const order = leagues.slice().sort((a, b) => isCup(a) - isCup(b) || isKnockout(a) - isKnockout(b));
  for (const l of order) {
    l.history = [];
    l.config.startYear = year;
    l.clubIds = (l.clubIds || []).filter((id) => world.clubs[id]);
    if (!isCup(l)) startSeason(l, 1);
    else if (isKnockout(l)) startCupSeason(world, l, 1);
    else startCupSeason(world, l, 1, undefined, { qualifiers: cupQualifiers[l.id] || [], qualifiedFrom: {} });
  }
  return { label: seasonLabel(year, 1), competitions: order.length };
}
