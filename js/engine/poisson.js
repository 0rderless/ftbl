// Poisson score model with diagonal (draw) inflation.
// P(x,y) ∝ Pois(x; λh) · Pois(y; λa) · (x === y ? δ : 1)
// (a diagonal-inflated bivariate Poisson in the spirit of Karlis & Ntzoufras / Dixon-Coles)

export const MAX_GOALS = 12;

export function poissonPmf(lambda, max = MAX_GOALS) {
  const out = new Array(max + 1);
  let p = Math.exp(-lambda);
  out[0] = p;
  for (let k = 1; k <= max; k++) { p = (p * lambda) / k; out[k] = p; }
  return out;
}

export function scoreMatrix(lh, la, drawInflation = 1, max = MAX_GOALS) {
  const ph = poissonPmf(lh, max), pa = poissonPmf(la, max);
  const m = [];
  let total = 0;
  for (let x = 0; x <= max; x++) {
    m[x] = [];
    for (let y = 0; y <= max; y++) {
      const v = ph[x] * pa[y] * (x === y ? drawInflation : 1);
      m[x][y] = v; total += v;
    }
  }
  for (let x = 0; x <= max; x++) for (let y = 0; y <= max; y++) m[x][y] /= total;
  return m;
}

export function outcomeProbs(lh, la, drawInflation = 1) {
  const m = scoreMatrix(lh, la, drawInflation);
  let home = 0, draw = 0, away = 0;
  for (let x = 0; x < m.length; x++) for (let y = 0; y < m.length; y++) {
    if (x > y) home += m[x][y]; else if (x === y) draw += m[x][y]; else away += m[x][y];
  }
  return { home, draw, away };
}

export function sampleScore(rng, lh, la, drawInflation = 1) {
  const m = scoreMatrix(lh, la, drawInflation);
  let r = rng.next();
  for (let x = 0; x < m.length; x++) for (let y = 0; y < m.length; y++) {
    r -= m[x][y];
    if (r <= 0) return [x, y];
  }
  return [0, 0];
}
