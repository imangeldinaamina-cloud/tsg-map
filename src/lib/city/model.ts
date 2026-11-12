// Population presence model.
//
// Baseline: WorldPop 2021 residents per cell, optionally rescaled so the city total equals a
// census total supplied by the user (proportional calibration).
//
// Temporal estimate (only when the user has specified the assumptions):
//   P_t(i) = s_t · R(i) + (1 − s_t) · R_total · w(i) / Σ_j w(j)
//   w(i)   = Σ_k β_k · count_k(i)        (OSM attractor counts in cell i)
// s_t = share of residents assumed to stay in their home cell during period t,
// β_k = relative weight of attractor type k. Total population is conserved (closed-city assumption).
// When s_t is not specified, P_t = R (the residential baseline) and the UI says so.
import { ATTRACTORS, Attractor, Cell, Period, PERIODS } from "./types";

export interface TemporalAssumptions {
  stay: Record<Period, number | null>;
  weights: Record<Attractor, number>;
  censusTotal: number | null;
  note: string;
}

export const UNSPECIFIED: TemporalAssumptions = {
  stay: { morning: null, midday: null, afternoon: null, evening: null },
  weights: { retail: 1, food: 1, office: 1, education: 1, health: 1, market: 1 },
  censusTotal: null,
  note: "",
};

export function isSpecified(a: TemporalAssumptions, p: Period) {
  return a.stay[p] !== null && Number.isFinite(a.stay[p]);
}
export function anySpecified(a: TemporalAssumptions) {
  return PERIODS.some((p) => isSpecified(a, p));
}

export function validateAssumptions(a: TemporalAssumptions): string[] {
  const errors: string[] = [];
  for (const p of PERIODS) {
    const s = a.stay[p];
    if (s !== null && !(s >= 0 && s <= 1)) errors.push(`stay.${p}`);
  }
  for (const k of ATTRACTORS) if (!(a.weights[k] >= 0)) errors.push(`weights.${k}`);
  if (a.censusTotal !== null && !(a.censusTotal > 0)) errors.push("censusTotal");
  return errors;
}

/** Residents per cell after optional census calibration. */
export function baseline(cells: Cell[], censusTotal: number | null, popOverride?: Float64Array | null): Float64Array {
  const out = new Float64Array(cells.length);
  let sum = 0;
  for (let i = 0; i < cells.length; i++) {
    out[i] = popOverride ? popOverride[i] : cells[i].pop;
    sum += out[i];
  }
  if (censusTotal && sum > 0) {
    const k = censusTotal / sum;
    for (let i = 0; i < out.length; i++) out[i] *= k;
  }
  return out;
}

export function attractorWeight(cell: Cell, weights: Record<Attractor, number>) {
  let w = 0;
  ATTRACTORS.forEach((k, j) => (w += (weights[k] ?? 0) * (cell.attr[j] ?? 0)));
  return w;
}

/** Estimated presence for a period. Returns the baseline itself when the period is unspecified. */
export function presence(cells: Cell[], base: Float64Array, a: TemporalAssumptions, p: Period): Float64Array {
  if (!isSpecified(a, p)) return base;
  const s = a.stay[p] as number;
  let total = 0;
  let W = 0;
  const w = new Float64Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    total += base[i];
    w[i] = attractorWeight(cells[i], a.weights);
    W += w[i];
  }
  if (W <= 0) return base;
  const out = new Float64Array(cells.length);
  for (let i = 0; i < cells.length; i++) out[i] = s * base[i] + (1 - s) * total * (w[i] / W);
  return out;
}

export function sum(a: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const v = [...values].sort((x, y) => x - y);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Median of values weighted by w (e.g. competitors seen by the typical person, not the typical cell). */
export function weightedMedian(values: number[], w: number[]): number {
  const idx = values.map((_, i) => i).filter((i) => w[i] > 0).sort((a, b) => values[a] - values[b]);
  const total = idx.reduce((s, i) => s + w[i], 0);
  if (!total) return 0;
  let acc = 0;
  for (const i of idx) {
    acc += w[i];
    if (acc >= total / 2) return values[i];
  }
  return values[idx[idx.length - 1]];
}
