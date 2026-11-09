// "Restart game" button flow: backup, then wipe achievements/stats and start again this season.
import { restartWorld, currentSeasonYear } from '../league/restart.js';
import { seasonLabel } from '../data/model.js';
import { isAutoRunning, stopAuto } from './autoPlay.js';

export async function restartGameFlow(app) {
  const label = seasonLabel(currentSeasonYear(), 1);
  const ok = await app.confirm(`Every competition goes back to ${label}. All tables, past seasons, trophies, records, awards and player stats are wiped. Your clubs, players, line-ups, badges and settings stay exactly as they are. A backup is kept first, so you can undo it from Backups.`, { ok: `Restart from ${label}`, danger: true, title: 'Restart game?' });
  if (!ok) return;
  if (isAutoRunning()) stopAuto();
  await app.store.backupLocal('before-restart').catch(() => {});
  app.act((w) => { restartWorld(w); }, `New game: everything starts again in ${label}`);
  app.nav('#/');
}
