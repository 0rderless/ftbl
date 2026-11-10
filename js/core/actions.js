// World operations with validation. Pure functions over the world object
// (mutating it in place), used by the UI through store.update() and by tests.
import { newClub, newPlayer, newLeague, clampRating, makeShort } from '../data/model.js';
import { generateSquad } from '../data/generate.js';
import { startSeason, seasonStarted, restartSeason } from '../league/season.js';
import { POSITIONS } from '../engine/tactics.js';
import { isCup, startCupSeason } from '../league/cup.js';

export class ActionError extends Error {}

const str = (v, max = 60) => String(v ?? '').trim().slice(0, max);

export function activeLeaguesForClub(world, clubId) {
  return Object.values(world.leagues).filter((l) => l.clubIds.includes(clubId) || (l.season && l.season.clubIds.includes(clubId) && !l.season.finished));
}

// ---------- clubs ----------
export function cleanClubInput(data) {
  const r = data.ratings || {};
  const out = { ...data };
  if (data.name != null) out.name = str(data.name) || 'Unnamed FC';
  if (data.short != null) out.short = str(data.short, 4).toUpperCase() || makeShort(out.name || 'Club');
  if (data.ratings) out.ratings = {
    overall: clampRating(r.overall), att: clampRating(r.att), mid: clampRating(r.mid), def: clampRating(r.def), gk: clampRating(r.gk),
  };
  if (data.stadium) out.stadium = { name: str(data.stadium.name, 60) || 'Stadium', capacity: Math.max(100, Math.min(250000, Math.round(Number(data.stadium.capacity) || 0))) };
  if (data.founded != null) out.founded = Math.max(1800, Math.min(2100, Math.round(Number(data.founded) || 1900)));
  return out;
}

export function createClub(world, data = {}, { withSquad = true } = {}) {
  const club = newClub(cleanClubInput(data));
  if (Object.values(world.clubs).some((c) => c.name.toLowerCase() === club.name.toLowerCase())) {
    throw new ActionError(`A club called "${club.name}" already exists`);
  }
  world.clubs[club.id] = club;
  if (withSquad) for (const p of generateSquad(club, [])) world.players[p.id] = p;
  return club;
}

export function updateClub(world, id, data) {
  const club = world.clubs[id];
  if (!club) throw new ActionError('Club not found');
  const clean = cleanClubInput(data);
  if (clean.name && Object.values(world.clubs).some((c) => c.id !== id && c.name.toLowerCase() === clean.name.toLowerCase())) {
    throw new ActionError(`A club called "${clean.name}" already exists`);
  }
  Object.assign(club, clean, { id });
  return club;
}

export function deleteClub(world, id) {
  const club = world.clubs[id];
  if (!club) return;
  const blocking = Object.values(world.leagues).filter((l) => l.season && !l.season.finished && l.season.clubIds.includes(id) && seasonStarted(l));
  if (blocking.length) throw new ActionError(`${club.name} is playing in ${blocking.map((l) => l.name).join(', ')}. Finish or restart that season first.`);
  for (const l of Object.values(world.leagues)) {
    if (l.clubIds.includes(id)) {
      l.clubIds = l.clubIds.filter((c) => c !== id);
      if (l.season && !seasonStarted(l)) restartSeason(l);
    }
  }
  for (const p of Object.values(world.players)) if (p.clubId === id) p.clubId = null;
  delete world.clubs[id];
}

export function squadOf(world, clubId) {
  return Object.values(world.players).filter((p) => p.clubId === clubId);
}

export function fillSquad(world, clubId, size = 25) {
  const club = world.clubs[clubId];
  if (!club) throw new ActionError('Club not found');
  const created = generateSquad(club, squadOf(world, clubId), { size });
  for (const p of created) world.players[p.id] = p;
  return created;
}

export function releaseSquad(world, clubId) {
  for (const p of squadOf(world, clubId)) delete world.players[p.id];
}

// ---------- players ----------
export function cleanPlayerInput(data) {
  const out = { ...data };
  if (data.name != null) out.name = str(data.name, 40) || 'Unnamed Player';
  if (data.age != null) out.age = Math.max(15, Math.min(45, Math.round(Number(data.age) || 20)));
  if (data.position != null && !POSITIONS.includes(data.position)) out.position = 'CM';
  if (data.overall != null) out.overall = clampRating(data.overall);
  if (data.number != null) out.number = Math.max(1, Math.min(99, Math.round(Number(data.number) || 1)));
  if (data.foot != null && !['Left', 'Right', 'Both'].includes(data.foot)) out.foot = 'Right';
  if (data.attributes) {
    out.attributes = {};
    for (const k of Object.keys(data.attributes)) out.attributes[k] = clampRating(data.attributes[k]);
  }
  return out;
}

export function createPlayer(world, data = {}) {
  const clean = cleanPlayerInput(data);
  if (clean.clubId && !world.clubs[clean.clubId]) throw new ActionError('Club not found');
  const p = newPlayer(clean);
  if (!data.number && p.clubId) p.number = freeNumber(world, p.clubId);
  world.players[p.id] = p;
  return p;
}

export function freeNumber(world, clubId) {
  const used = new Set(squadOf(world, clubId).map((p) => p.number));
  for (let n = 1; n < 100; n++) if (!used.has(n)) return n;
  return 99;
}

export function updatePlayer(world, id, data) {
  const p = world.players[id];
  if (!p) throw new ActionError('Player not found');
  const clean = cleanPlayerInput(data);
  if (clean.clubId && !world.clubs[clean.clubId]) throw new ActionError('Club not found');
  Object.assign(p, clean, { id });
  if (clean.attributes) p.attributes = { ...p.attributes, ...clean.attributes };
  return p;
}

export function deletePlayer(world, id) {
  delete world.players[id];
}

// ---------- leagues ----------
export function cleanLeagueConfig(cfg = {}) {
  const out = { ...cfg };
  const int = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
  if ('legs' in cfg) out.legs = int(cfg.legs, 1, 4, 2);
  if ('pointsWin' in cfg) out.pointsWin = int(cfg.pointsWin, 1, 5, 3);
  if ('pointsDraw' in cfg) out.pointsDraw = int(cfg.pointsDraw, 0, 3, 1);
  if ('daysBetweenRounds' in cfg) out.daysBetweenRounds = int(cfg.daysBetweenRounds, 2, 14, 7);
  for (const k of ['championsSpots', 'continentalSpots', 'promotionSpots', 'relegationSpots']) if (k in cfg) out[k] = int(cfg[k], 0, 10, 0);
  if ('startYear' in cfg) out.startYear = int(cfg.startYear, 1850, 2200, 2026);
  if ('tiebreak' in cfg) out.tiebreak = cfg.tiebreak === 'h2h' ? 'h2h' : 'gd';
  if ('seedMode' in cfg) out.seedMode = cfg.seedMode === 'fixed' ? 'fixed' : 'random';
  if ('fixedSeed' in cfg) out.fixedSeed = str(cfg.fixedSeed, 24);
  return out;
}

export function createLeague(world, data = {}) {
  const clubIds = [...new Set((data.clubIds || []).filter((id) => world.clubs[id]))];
  if (clubIds.length < 2) throw new ActionError('A league needs at least 2 clubs');
  const league = newLeague({ ...data, name: str(data.name) || 'New League', clubIds, config: cleanLeagueConfig(data.config || {}) });
  league.config.upperLeagueId = null; league.config.lowerLeagueId = null;
  world.leagues[league.id] = league;
  if (data.config) linkLeagues(world, league, data.config.upperLeagueId || null, data.config.lowerLeagueId || null);
  startSeason(league, 1);
  return league;
}

function linkLeagues(world, league, upperId, lowerId) {
  const c = league.config;
  // unlink old
  if (c.upperLeagueId && world.leagues[c.upperLeagueId]) world.leagues[c.upperLeagueId].config.lowerLeagueId = null;
  if (c.lowerLeagueId && world.leagues[c.lowerLeagueId]) world.leagues[c.lowerLeagueId].config.upperLeagueId = null;
  c.upperLeagueId = null; c.lowerLeagueId = null;
  if (upperId && upperId !== league.id && world.leagues[upperId]) {
    const u = world.leagues[upperId];
    if (u.config.lowerLeagueId && world.leagues[u.config.lowerLeagueId]) world.leagues[u.config.lowerLeagueId].config.upperLeagueId = null;
    u.config.lowerLeagueId = league.id; c.upperLeagueId = upperId;
  }
  if (lowerId && lowerId !== league.id && lowerId !== upperId && world.leagues[lowerId]) {
    const d = world.leagues[lowerId];
    if (d.config.upperLeagueId && world.leagues[d.config.upperLeagueId]) world.leagues[d.config.upperLeagueId].config.lowerLeagueId = null;
    d.config.upperLeagueId = league.id; c.lowerLeagueId = lowerId;
  }
}

export function updateLeague(world, id, data = {}) {
  const l = world.leagues[id];
  if (!l) throw new ActionError('League not found');
  if (data.name != null) l.name = str(data.name) || l.name;
  if (data.short != null) l.short = str(data.short, 4).toUpperCase() || l.short;
  if (data.logo) l.logo = data.logo;
  if (data.config) {
    const cfg = cleanLeagueConfig(data.config);
    const started = seasonStarted(l);
    if (started && cfg.legs != null && cfg.legs !== l.config.legs) {
      throw new ActionError('Season length can only change before the first match or between seasons.');
    }
    const upper = 'upperLeagueId' in data.config ? data.config.upperLeagueId || null : l.config.upperLeagueId;
    const lower = 'lowerLeagueId' in data.config ? data.config.lowerLeagueId || null : l.config.lowerLeagueId;
    delete cfg.upperLeagueId; delete cfg.lowerLeagueId;
    const legsChanged = cfg.legs != null && cfg.legs !== l.config.legs;
    const yearChanged = cfg.startYear != null && cfg.startYear !== l.config.startYear;
    Object.assign(l.config, cfg);
    linkLeagues(world, l, upper, lower);
    if (!started && l.season && (legsChanged || cfg.seedMode || cfg.fixedSeed != null)) restartSeason(l, true);
    if (yearChanged && l.season) l.season.label = `${l.config.startYear + l.season.number - 1}/${String((l.config.startYear + l.season.number) % 100).padStart(2, '0')}`;
  }
  return l;
}

export function setLeagueClubs(world, id, clubIds) {
  const l = world.leagues[id];
  if (!l) throw new ActionError('League not found');
  const ids = [...new Set(clubIds.filter((c) => world.clubs[c]))];
  if (ids.length < 2) throw new ActionError('A league needs at least 2 clubs');
  if (seasonStarted(l) && !(l.season && l.season.finished)) {
    throw new ActionError('Clubs can only be changed before the first match. Restart the season to change participants.');
  }
  l.clubIds = ids;
  if (l.season && !l.season.finished) restartSeason(l, true);
  return l;
}

export function restartLeagueSeason(world, id) {
  const l = world.leagues[id];
  if (!l) throw new ActionError('League not found');
  if (l.season && l.season.finished) throw new ActionError('This season is complete. Start the next season instead.');
  if (isCup(l)) return startCupSeason(world, l, l.season ? l.season.number : 1);
  l.clubIds = l.clubIds.filter((c) => world.clubs[c]);
  restartSeason(l, true);
  return l;
}

export function deleteLeague(world, id) {
  const l = world.leagues[id];
  if (!l) return;
  linkLeagues(world, l, null, null);
  for (const x of Object.values(world.leagues)) if (x.config.continentalCupId === id) x.config.continentalCupId = null;
  delete world.leagues[id];
}

/** Edit a cup: identity, logo, qualifying leagues and the continental clubs (used from the next draw). */
export function updateCup(world, id, data = {}) {
  const cup = world.leagues[id];
  if (!cup || !isCup(cup)) throw new ActionError('Competition not found');
  if (data.name != null) cup.name = str(data.name) || cup.name;
  if (data.short != null) cup.short = str(data.short, 4).toUpperCase() || cup.short;
  if (data.logo) cup.logo = data.logo;
  if (Array.isArray(data.regulars)) cup.regulars = [...new Set(data.regulars.filter((c) => world.clubs[c]))];
  if ('follow' in data) {
    const leader = data.follow && world.leagues[data.follow];
    cup.config.followLeagueId = leader && leader.id !== id && isCup(leader) && leader.format !== 'knockout' && leader.config.followLeagueId !== id ? leader.id : null;
  }
  if (Array.isArray(data.qualifiers)) {
    for (const x of Object.values(world.leagues)) if (x.config.continentalCupId === id) x.config.continentalCupId = null;
    cup.config.qualifiers = data.qualifiers.filter((q) => world.leagues[q.leagueId] && !isCup(world.leagues[q.leagueId]))
      .map((q) => ({ leagueId: q.leagueId, spots: Math.max(1, Math.min(8, Math.round(Number(q.spots) || 1))), ...(q.from > 1 ? { from: Math.min(30, Math.round(Number(q.from))) } : {}) }));
    for (const q of cup.config.qualifiers) {
      if (q.from > 1) continue; // lower places (e.g. Europa League) don't change the league's main link
      world.leagues[q.leagueId].config.continentalCupId = id;
      world.leagues[q.leagueId].config.continentalSpots = q.spots;
    }
  }
  return cup;
}
