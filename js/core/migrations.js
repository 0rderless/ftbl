// One-time data upgrades that run on the device after the newest data has loaded
// (so they always apply to the latest copy and never race the cloud).
import { createContinentalCup, isCup, startCupSeason } from '../league/cup.js';
import { startSeason } from '../league/season.js';
import { realizeContinentalClubs } from '../data/continental.js';
import { seasonLabel } from '../data/model.js';

const MIGRATIONS = [
  {
    id: 'champions-league-v1',
    // Add a Champions League fed by Kronliga's top 3 (from its last completed season).
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga' && l.history.length);
      if (!kron) return null; // try again later
      if (Object.values(world.leagues).some((l) => isCup(l))) return { done: true };
      // the cup runs alongside the league season after the one its qualifiers came from
      const startYear = kron.config.startYear + ((kron.season && kron.season.number) || 1) - 1 + (kron.season && kron.season.finished ? 1 : 0);
      const { cup, dropped } = createContinentalCup(world, { name: 'Champions League', short: 'UCL', qualifiers: [{ leagueId: kron.id, spots: 3 }], startYear, seed: 'ucl-' + kron.id });
      const top3 = cup.season.qualifiers.map((id) => world.clubs[id].name);
      return { done: true, message: `Champions League ${cup.season.label} added: ${top3.join(', ')} qualify from Kronliga (${dropped.length} weakest continental clubs left out)` };
    },
  },
  {
    id: 'real-clubs-v1',
    // Rename the first version's fictional continental clubs to real clubs (results kept).
    run(world) {
      const changes = realizeContinentalClubs(world);
      return { done: true, message: changes.length ? `${changes.length} Champions League clubs are now real clubs (Real Madrid, Man City, Bayern, PSG, Arsenal…)` : null };
    },
  },
  {
    id: 'fresh-start-2026-v1',
    backup: true,
    // Requested restart: Kronliga and the Champions League both go back to 2026/27 with no history.
    // Clubs, players, line-ups and settings are kept. Only applies to a world that already had the
    // Champions League before this update (new worlds are already fresh).
    run(world, ctx) {
      const cup = Object.values(world.leagues).find((l) => isCup(l));
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga');
      if (!cup || !kron || !ctx.previouslyDone['champions-league-v1']) return { done: true };
      // qualifiers for the new first Champions League: the most recent final Kronliga top 3
      const lastTable = kron.history.length ? kron.history[kron.history.length - 1].table : null;
      const rated = kron.clubIds.slice().sort((a, b) => world.clubs[b].ratings.overall - world.clubs[a].ratings.overall);
      const spots = (cup.config.qualifiers && cup.config.qualifiers[0] && cup.config.qualifiers[0].spots) || 3;
      const qualifiers = (lastTable ? lastTable.map((r) => r.clubId) : rated).filter((id) => world.clubs[id]).slice(0, spots);
      const compIds = new Set([kron.id, cup.id]);
      // wipe competition history, honours and stats
      for (const c of Object.values(world.clubs)) c.honours = (c.honours || []).filter((h) => !compIds.has(h.leagueId));
      const names = new Set([kron.name, cup.name]);
      const onlyThese = Object.values(world.leagues).every((l) => compIds.has(l.id));
      for (const p of Object.values(world.players)) {
        p.awards = (p.awards || []).filter((a) => !names.has(a.leagueName));
        if (onlyThese) p.career = { apps: 0, goals: 0, assists: 0, seasons: 0 };
      }
      kron.history = [];
      kron.config.startYear = 2026;
      kron.clubIds = kron.clubIds.filter((id) => world.clubs[id]);
      startSeason(kron, 1);
      cup.history = [];
      cup.config.startYear = 2026;
      startCupSeason(world, cup, 1, undefined, { qualifiers, qualifiedFrom: { [kron.id]: 'before-restart' } });
      const qn = qualifiers.map((id) => world.clubs[id].name).join(', ');
      return { done: true, message: `Fresh start: Kronliga and Champions League are back to 2026/27 (${qn} in the Champions League). A backup of everything before was saved.` };
    },
  },
  {
    id: 'cup-season-label-v1',
    // A cup whose qualifiers came from league season X should be labelled as the season after X.
    run(world) {
      for (const cup of Object.values(world.leagues)) {
        if (!isCup(cup) || !cup.season || cup.history.length) continue;
        const labels = Object.values(cup.season.qualifiedFrom || {});
        if (labels.includes(cup.season.label)) {
          cup.config.startYear += 1;
          cup.season.label = seasonLabel(cup.config.startYear, cup.season.number);
        }
      }
      return { done: true };
    },
  },
];

/** Returns messages for migrations that changed the world (caller saves). */
export function pendingMigrations(world) {
  const doneIds = (world.settings.ui && world.settings.ui.migrations) || {};
  return MIGRATIONS.filter((m) => !doneIds[m.id]);
}

export function needsBackup(world) {
  const done = (world.settings.ui && world.settings.ui.migrations) || {};
  return pendingMigrations(world).some((m) => m.backup && (m.id !== 'fresh-start-2026-v1' || done['champions-league-v1']));
}

export function runMigrations(world) {
  const messages = [];
  world.settings.ui.migrations = world.settings.ui.migrations || {};
  const ctx = { previouslyDone: { ...world.settings.ui.migrations } };
  for (const m of pendingMigrations(world)) {
    const r = m.run(world, ctx);
    if (r && r.done) world.settings.ui.migrations[m.id] = Date.now();
    if (r && r.message) messages.push(r.message);
  }
  return messages;
}
