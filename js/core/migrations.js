// One-time data upgrades that run on the device after the newest data has loaded
// (so they always apply to the latest copy and never race the cloud).
import { createContinentalCup, isCup } from '../league/cup.js';

const MIGRATIONS = [
  {
    id: 'champions-league-v1',
    // Add a Champions League fed by Kronliga's top 3 (from its last completed season).
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga' && l.history.length);
      if (!kron) return null; // try again later
      if (Object.values(world.leagues).some((l) => isCup(l))) return { done: true };
      const startYear = kron.config.startYear + ((kron.season && kron.season.number) || 1) - 1;
      const { cup, dropped } = createContinentalCup(world, { name: 'Champions League', short: 'UCL', qualifiers: [{ leagueId: kron.id, spots: 3 }], startYear, seed: 'ucl-' + kron.id });
      const top3 = cup.season.qualifiers.map((id) => world.clubs[id].name);
      return { done: true, message: `Champions League ${cup.season.label} added: ${top3.join(', ')} qualify from Kronliga (${dropped.length} weakest continental clubs left out)` };
    },
  },
];

/** Returns messages for migrations that changed the world (caller saves). */
export function pendingMigrations(world) {
  const doneIds = (world.settings.ui && world.settings.ui.migrations) || {};
  return MIGRATIONS.filter((m) => !doneIds[m.id]);
}

export function runMigrations(world) {
  const messages = [];
  world.settings.ui.migrations = world.settings.ui.migrations || {};
  for (const m of pendingMigrations(world)) {
    const r = m.run(world);
    if (r && r.done) world.settings.ui.migrations[m.id] = Date.now();
    if (r && r.message) messages.push(r.message);
  }
  return messages;
}
