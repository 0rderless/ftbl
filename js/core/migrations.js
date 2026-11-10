// One-time data upgrades that run on the device after the newest data has loaded
// (so they always apply to the latest copy and never race the cloud).
import { createContinentalCup, createEuropeanCups, isCup, startCupSeason } from '../league/cup.js';
import { startSeason, seasonStarted } from '../league/season.js';
import { addNewKronligaClubs, createDaffersCup, createDivision2, daffersEntries } from '../data/geko.js';
import { competitionLeaderboard } from '../league/records.js';
import { isKnockout } from '../league/cup.js';
import { realizeContinentalClubs } from '../data/continental.js';
import { seasonLabel } from '../data/model.js';

const MIGRATIONS = [
  {
    id: 'champions-league-v1',
    // Add a Champions League fed by Kronliga's top 3 (from its last completed season).
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga' && l.history.length);
      if (!kron) return null; // try again later
      if (Object.values(world.leagues).some((l) => isCup(l) && l.format !== 'knockout')) return { done: true };
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
      const cup = Object.values(world.leagues).find((l) => isCup(l) && l.format !== 'knockout');
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
    id: 'kronliga-20-daffers-v1',
    // Requested: 8 more Kronliga clubs (mid-table strength) and the Daffers Cup for all 100 Geko clubs.
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga');
      if (!kron) return null;
      const msgs = [];
      const added = addNewKronligaClubs(world);
      if (added.length) {
        kron.clubIds = [...kron.clubIds, ...added];
        if (!seasonStarted(kron)) {
          startSeason(kron, (kron.season && kron.season.number) || 1);
          msgs.push(`${added.length} new clubs joined Kronliga for ${kron.season.label}`);
        } else msgs.push(`${added.length} new clubs join Kronliga from next season`);
      }
      if (!Object.values(world.leagues).some((l) => isKnockout(l))) {
        const cup = createDaffersCup(world, kron, { seed: 'geko-' + kron.id });
        msgs.push(`Daffers Cup ${cup.season.label} drawn: ${cup.season.clubIds.length} clubs`);
      }
      return { done: true, message: msgs.join(' · ') || null };
    },
  },
  {
    id: 'division-2-v1',
    // Requested: Division 2 of 20 Geko clubs (Daffers Cup winners first, then most Daffers Cup points),
    // 3 up / 3 down with Kronliga; the Daffers Cup entry rounds follow the two leagues.
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga');
      const daf = Object.values(world.leagues).find((l) => isKnockout(l));
      if (!kron || !daf) return null;
      if (kron.config.lowerLeagueId && world.leagues[kron.config.lowerLeagueId]) return { done: true };
      const div = createDivision2(world, kron, daf, competitionLeaderboard(world, daf));
      return { done: true, message: `Division 2 ${div.season.label} created: 20 clubs, top 3 go up and Kronliga's bottom 3 go down` };
    },
  },
  {
    id: 'div2-auto-relegation-v1',
    // Division 2 plays automatically with Kronliga; its bottom 3 drop out each season and are
    // replaced by the best non-league clubs in the Daffers Cup (keeps 40 league clubs out of 100).
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga');
      const div = kron && kron.config.lowerLeagueId && world.leagues[kron.config.lowerLeagueId];
      const daf = Object.values(world.leagues).find((l) => isKnockout(l));
      if (!kron || !div || !daf) return null;
      div.config.followLeagueId = kron.id;
      div.config.relegationSpots = 3;
      div.config.feederCupId = daf.id;
      return { done: true, message: 'Division 2 now plays automatically with Kronliga, and its bottom 3 drop out of the league each season' };
    },
  },
  {
    id: 'daffers-div2-round2-v1',
    // Requested: Division 2 joins the Daffers Cup in round 2, Kronliga in round 3.
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga');
      const div = kron && kron.config.lowerLeagueId && world.leagues[kron.config.lowerLeagueId];
      const daf = Object.values(world.leagues).find((l) => isKnockout(l));
      if (!kron || !div || !daf) return null;
      daf.config.entries = daffersEntries(kron.id, div.id);
      // if the current Daffers Cup hasn't kicked off yet, redraw it with the new rounds straight away
      const started = daf.season && daf.season.fixtures.some((f) => f.result);
      if (daf.season && !daf.season.finished && !started) startCupSeason(world, daf, daf.season.number);
      return { done: true, message: `Daffers Cup: Division 2 now joins in round 2 and Kronliga in round 3${!started ? ` (${daf.season.label} redrawn)` : ' (from next season)'}` };
    },
  },
  {
    id: 'cup-season-label-v1',
    // A cup whose qualifiers came from league season X should be labelled as the season after X.
    run(world) {
      for (const cup of Object.values(world.leagues)) {
        if (!isCup(cup) || cup.format === 'knockout' || !cup.season || cup.history.length) continue;
        const labels = Object.values(cup.season.qualifiedFrom || {});
        if (labels.includes(cup.season.label)) {
          cup.config.startYear += 1;
          cup.season.label = seasonLabel(cup.config.startYear, cup.season.number);
        }
      }
      return { done: true };
    },
  },
  {
    id: 'europa-conference-v1',
    // Requested: Europa League for Kronliga 4th–5th and Conference League for 6th, filled with
    // real European clubs that aren't in the Champions League. Same season as the Champions League.
    run(world) {
      const kron = Object.values(world.leagues).find((l) => !isCup(l) && l.name.trim().toLowerCase() === 'kronliga');
      const ucl = Object.values(world.leagues).find((l) => isCup(l) && !isKnockout(l) && (l.config.qualifiers || []).some((q) => q.leagueId === (kron && kron.id) && (q.from || 1) === 1));
      if (!kron || !ucl) return null; // try again once there is a Champions League
      const made = createEuropeanCups(world, kron, ucl);
      if (!made.length) return { done: true };
      const q = (c) => (c.season.qualifiers || []).map((id) => world.clubs[id].name).join(', ');
      return { done: true, message: `${made.map((c) => `${c.name} ${c.season.label} added (${q(c)} from Kronliga)`).join(' · ')}` };
    },
  },
  {
    id: 'european-cups-follow-ucl-v1',
    // Requested: playing the Champions League also plays the Europa League and Conference League.
    run(world) {
      const cups = Object.values(world.leagues).filter((l) => isCup(l) && !isKnockout(l));
      const ucl = cups.find((l) => l.short === 'UCL');
      const others = cups.filter((l) => l.short === 'UEL' || l.short === 'UECL');
      if (!ucl || !others.length) return null; // try again once they exist
      for (const c of others) c.config.followLeagueId = ucl.id;
      return { done: true, message: `${others.map((c) => c.name).join(' and ')} now play automatically when you play the ${ucl.name}` };
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
