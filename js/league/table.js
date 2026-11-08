// League table calculation.

export function emptyRow(clubId) {
  return { clubId, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [], hw: 0, hd: 0, hl: 0, aw: 0, ad: 0, al: 0 };
}

/**
 * Build standings from fixtures with results.
 * @param {string[]} clubIds
 * @param {Array} fixtures
 * @param {{pointsWin:number, pointsDraw:number, tiebreak:'gd'|'h2h'}} config
 * @param {number} [uptoRound] only count fixtures in rounds <= uptoRound
 */
export function computeTable(clubIds, fixtures, config = {}, uptoRound = Infinity) {
  const pw = config.pointsWin ?? 3, pd = config.pointsDraw ?? 1;
  const rows = {};
  for (const id of clubIds) rows[id] = emptyRow(id);
  const played = fixtures.filter((f) => f.result && f.round <= uptoRound).sort((a, b) => a.round - b.round);
  for (const f of played) {
    const h = rows[f.home], a = rows[f.away];
    if (!h || !a) continue;
    const { hg, ag } = f.result;
    h.p++; a.p++;
    h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; a.l++; h.pts += pw; h.hw++; a.al++; h.form.push('W'); a.form.push('L'); }
    else if (hg < ag) { a.w++; h.l++; a.pts += pw; a.aw++; h.hl++; h.form.push('L'); a.form.push('W'); }
    else { h.d++; a.d++; h.pts += pd; a.pts += pd; h.hd++; a.ad++; h.form.push('D'); a.form.push('D'); }
  }
  const list = Object.values(rows);
  for (const r of list) r.gd = r.gf - r.ga;
  return sortTable(list, played, config, pw, pd);
}

function h2hPoints(ids, played, pw, pd) {
  const set = new Set(ids);
  const pts = {}, gd = {};
  for (const id of ids) { pts[id] = 0; gd[id] = 0; }
  for (const f of played) {
    if (!set.has(f.home) || !set.has(f.away)) continue;
    const { hg, ag } = f.result;
    gd[f.home] += hg - ag; gd[f.away] += ag - hg;
    if (hg > ag) pts[f.home] += pw; else if (hg < ag) pts[f.away] += pw; else { pts[f.home] += pd; pts[f.away] += pd; }
  }
  return { pts, gd };
}

function sortTable(list, played, config, pw, pd) {
  const h2hFirst = config.tiebreak === 'h2h';
  const base = (a, b) => b.pts - a.pts;
  const gdcmp = (a, b) => (b.gd - a.gd) || (b.gf - a.gf);
  // group by points then resolve ties
  list.sort((a, b) => base(a, b) || gdcmp(a, b) || (b.w - a.w));
  const out = [];
  let i = 0;
  while (i < list.length) {
    let j = i;
    while (j < list.length && list[j].pts === list[i].pts) j++;
    const group = list.slice(i, j);
    if (group.length > 1) {
      const h = h2hPoints(group.map((r) => r.clubId), played, pw, pd);
      const h2h = (a, b) => (h.pts[b.clubId] - h.pts[a.clubId]) || (h.gd[b.clubId] - h.gd[a.clubId]);
      group.sort((a, b) => (h2hFirst ? (h2h(a, b) || gdcmp(a, b)) : (gdcmp(a, b) || h2h(a, b)))
        || (b.w - a.w) || String(a.clubId).localeCompare(String(b.clubId)));
    }
    out.push(...group);
    i = j;
  }
  out.forEach((r, idx) => { r.pos = idx + 1; });
  return out;
}

// Zone for a position (1-based) given league config.
export function zoneFor(pos, total, config) {
  if (pos === 1 && (config.championsSpots || 0) >= 1) return 'champion';
  if (config.upperLeagueId) {
    if (pos <= (config.promotionSpots || 0)) return 'promotion';
  } else if (pos <= (config.championsSpots || 0) + (config.continentalSpots || 0)) return 'continental';
  if (pos > total - (config.relegationSpots || 0)) return 'relegation';
  return '';
}
