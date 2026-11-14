// Calculation core of the research model (hexagonal 0.25 km² grid, section 04 of the research page and /demo).
// Pure functions only — no React, no fetch — so the same code is used by the UI and by the unit tests.
//
// Definitions (identical to the author's prototype app_v2.html and research/agent_model/code/*.py):
//   a_i(t) = D_i(t) / Σ_k D_k(t)          share of modelled population presence in cell i
//   b_i(t) = S_i(t) / Σ_k S_k(t)          share of distance-weighted, open service supply in cell i
//   TSG_i(t) = (a_i − b_i) / (a_i + b_i)  relative mismatch between the two distributions, ∈ [−1, 1]
//   S_i(t) = Σ_n o_n(t) · K(d_in)          quartic kernel K, radius h = 500 m, o_n(t) = open fraction of slot t
// The sums run over ALL cells of the grid (355), not only over evaluated cells.
// TSG is a relative indicator: it does not measure absolute shortage, demand or profitability.

export const SLOTS = ["morning", "day", "evening"] as const;
export type Slot = (typeof SLOTS)[number];
export type View = Slot | "static";
export const CATS = ["food", "pharmacy", "catering"] as const;
export type Cat = (typeof CATS)[number];

/** Slot windows in hours (summary_v2.json → config.slots). */
export const SLOT_HOURS: Record<Slot, [number, number]> = { morning: [7, 11], day: [11, 16.5], evening: [16.5, 22] };

/** Model parameters of the published run (summary_v2.json → config). */
export const PARAMS = {
  tau: 0.2, // class threshold
  dMin: 50, // minimum people (max of residents and presence) for a cell to be evaluated
  kernelRadiusM: 500,
  huffRadiusM: 1000,
  huffMinDistM: 100,
  beta: 2,
  cellAreaKm2: 0.25,
} as const;

export type TsgClass = "deficit" | "balance" | "surplus";
/** Why a cell has no TSG value. Never silently shown as "balance". */
export type NoValueReason = "no_service" | "few_people" | "no_service_few_people" | "undefined";

export function isNonNegFinite(x: number) {
  return Number.isFinite(x) && x >= 0;
}

/** Normalized difference. Returns null for a = b = 0 (indeterminate) and throws on invalid input. */
export function tsgIndex(a: number, b: number): number | null {
  if (!isNonNegFinite(a) || !isNonNegFinite(b)) throw new RangeError("TSG shares must be finite and ≥ 0");
  const den = a + b;
  if (den === 0) return null;
  return (a - b) / den;
}

/** Shares x_i / Σx. Returns null when the total is 0 (all-zero city supply/population: shares undefined). */
export function shares(values: ArrayLike<number>): Float64Array | null {
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isNonNegFinite(v)) throw new RangeError(`value ${i} must be finite and ≥ 0`);
    s += v;
  }
  if (!(s > 0)) return null;
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i] / s;
  return out;
}

/** Three classes with threshold τ: TSG ≥ τ relative deficit, TSG ≤ −τ relative surplus, otherwise balance. */
export function classify(t: number, tau: number = PARAMS.tau): TsgClass {
  if (!Number.isFinite(t)) throw new RangeError("TSG must be finite");
  if (t >= tau) return "deficit";
  if (t <= -tau) return "surplus";
  return "balance";
}

export interface CellInput {
  /** residents (WorldPop scaled to the BNS total) */
  R: number;
  /** modelled presence for the view (R for "static") */
  D: number;
  /** kernel supply for the view (open fraction applied for slots) */
  S: number;
  /** kernel supply without opening hours — defines "service in radius" */
  S0: number;
}

export interface CellResult {
  a: number;
  b: number;
  tsg: number | null;
  cls: TsgClass | null;
  reason: NoValueReason | null;
}

/**
 * TSG for every cell. Shares are normalized over all cells. A cell is evaluated only when a category object lies
 * within the kernel radius (S0 > 0) and max(R, D) ≥ dMin; otherwise it gets an explicit reason.
 */
export function tsgAll(cells: CellInput[], opts: { tau?: number; dMin?: number } = {}): CellResult[] {
  const tau = opts.tau ?? PARAMS.tau;
  const dMin = opts.dMin ?? PARAMS.dMin;
  const A = shares(cells.map((c) => c.D));
  const B = shares(cells.map((c) => c.S));
  return cells.map((c, i) => {
    const a = A ? A[i] : 0;
    const b = B ? B[i] : 0;
    const noService = !(c.S0 > 0);
    const fewPeople = !(Math.max(c.R, c.D) >= dMin);
    if (noService || fewPeople) {
      return { a, b, tsg: null, cls: null, reason: noService && fewPeople ? "no_service_few_people" : noService ? "no_service" : "few_people" };
    }
    if (!A || !B) return { a, b, tsg: null, cls: null, reason: "undefined" };
    const t = tsgIndex(a, b);
    return { a, b, tsg: t, cls: t === null ? null : classify(t, tau), reason: t === null ? "undefined" : null };
  });
}

/** Total variation distance ½ Σ|p_i − q_i| between two distributions (inputs are normalized here). */
export function tvDistance(p: ArrayLike<number>, q: ArrayLike<number>): number | null {
  if (p.length !== q.length) throw new RangeError("length mismatch");
  const P = shares(p);
  const Q = shares(q);
  if (!P || !Q) return null;
  let s = 0;
  for (let i = 0; i < P.length; i++) s += Math.abs(P[i] - Q[i]);
  return s / 2;
}

/** Normalized quartic (biweight) kernel in 2D: K(d) = 3/(πh²)·(1 − d²/h²)² for d < h, 0 otherwise. ∫K dA = 1. */
export function quarticKernel(d: number, h: number = PARAMS.kernelRadiusM): number {
  if (!(h > 0)) throw new RangeError("radius must be > 0");
  if (!Number.isFinite(d) || d < 0) throw new RangeError("distance must be finite and ≥ 0");
  if (d >= h) return 0;
  const u = 1 - (d * d) / (h * h);
  return (3 / (Math.PI * h * h)) * u * u;
}

/**
 * Share of a slot [s0, s1] covered by opening hours [open, close) in hours. Overnight hours (close ≤ open) wrap past
 * midnight; open === close is treated as 24 h. Missing hours (null) return null — the caller decides the default.
 */
export function openFraction(open: number | null, close: number | null, slot: [number, number]): number | null {
  if (open == null || close == null || !Number.isFinite(open) || !Number.isFinite(close)) return null;
  const [s0, s1] = slot;
  if (!(s1 > s0)) throw new RangeError("empty slot");
  if (open === close) return 1;
  const c = close <= open ? close + 24 : close;
  // check the interval and its copy shifted by −24 h (for slots after midnight of an overnight shop)
  const cover = (o: number, e: number) => Math.max(0, Math.min(e, s1) - Math.max(o, s0));
  return Math.min(1, (cover(open, c) + cover(open - 24, c - 24)) / (s1 - s0));
}

export interface Pt {
  x: number;
  y: number;
}
const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * Huff choice probabilities from one origin to destinations: P_j = o_j·d_j^−β / Σ_k o_k·d_k^−β, with d clamped to
 * dMin (no infinite attraction at zero distance). Closed destinations (o = 0) get 0. Empty or all-closed → all 0
 * and `defined: false`.
 */
export function huffProbabilities(distances: number[], open: number[], beta: number = PARAMS.beta, dMin: number = PARAMS.huffMinDistM) {
  if (distances.length !== open.length) throw new RangeError("length mismatch");
  if (!(beta >= 0) || !(dMin > 0)) throw new RangeError("invalid beta / dMin");
  const u = distances.map((d, j) => {
    if (!Number.isFinite(d) || d < 0) throw new RangeError("distance must be finite and ≥ 0");
    const o = open[j];
    if (!(o >= 0 && o <= 1)) throw new RangeError("open fraction must be in [0, 1]");
    return o * Math.pow(Math.max(d, dMin), -beta);
  });
  const total = u.reduce((s, v) => s + v, 0);
  return { p: total > 0 ? u.map((v) => v / total) : u.map(() => 0), defined: total > 0 };
}

/**
 * Modelled choice share of a hypothetical new outlet among the considered alternatives (Huff), weighted by presence D
 * of cells within the Huff radius. This is NOT a forecast of sales or revenue.
 */
export function huffChoiceShare(
  cells: (Pt & { D: number })[],
  competitors: (Pt & { open: number })[],
  outlet: Pt & { open: number },
  opts: { beta?: number; radiusM?: number; dMin?: number } = {},
): { share: number | null; people: number; catchment: number } {
  const beta = opts.beta ?? PARAMS.beta;
  const R = opts.radiusM ?? PARAMS.huffRadiusM;
  const dMin = opts.dMin ?? PARAMS.huffMinDistM;
  let cap = 0;
  let tot = 0;
  for (const c of cells) {
    if (dist(c, outlet) > R) continue;
    const ds = [dist(c, outlet), ...competitors.map((o) => dist(c, o))];
    const os = [outlet.open, ...competitors.map((o) => o.open)];
    const { p } = huffProbabilities(ds, os, beta, dMin);
    cap += c.D * p[0];
    tot += c.D;
  }
  return { share: tot > 0 ? cap / tot : null, people: cap, catchment: tot };
}

/**
 * Scenario: add the kernel supply of a hypothetical outlet to a COPY of S and recompute TSG for all cells.
 * Because b is renormalized over the whole city, adding an outlet lowers b (and raises TSG) in cells outside its
 * kernel radius — see the monotonicity note on the research page. The input arrays are never modified.
 */
export function addOutletScenario(cells: (CellInput & Pt)[], outlet: Pt & { open: number }, opts: { tau?: number; dMin?: number; h?: number } = {}) {
  const h = opts.h ?? PARAMS.kernelRadiusM;
  const next = cells.map((c) => {
    const k = quarticKernel(dist(c, outlet), h);
    return { ...c, S: c.S + k * outlet.open, S0: c.S0 + k };
  });
  return { before: tsgAll(cells, opts), after: tsgAll(next, opts), cells: next };
}

/** Proportional scaling so the total equals `total` (WorldPop → BNS). Zero sum → null. */
export function scaleToTotal(values: ArrayLike<number>, total: number): Float64Array | null {
  if (!isNonNegFinite(total)) throw new RangeError("total must be finite and ≥ 0");
  const s = shares(values);
  if (!s) return null;
  return s.map((v) => v * total);
}

export interface TransitionCounts {
  n: number;
  changed: number;
  /** not a deficit in the static view, a deficit in the slot */
  hidden: number;
  matrix: Record<TsgClass, Record<TsgClass, number>>;
}

/** Class transitions static → slot over cells evaluated in BOTH views (the denominator n). */
export function transitions(stat: CellResult[], dyn: CellResult[]): TransitionCounts {
  const z = () => ({ deficit: 0, balance: 0, surplus: 0 });
  const m: TransitionCounts["matrix"] = { deficit: z(), balance: z(), surplus: z() };
  let n = 0;
  let changed = 0;
  let hidden = 0;
  stat.forEach((s, i) => {
    const d = dyn[i];
    if (!s.cls || !d.cls) return;
    n++;
    m[s.cls][d.cls]++;
    if (s.cls !== d.cls) changed++;
    if (s.cls !== "deficit" && d.cls === "deficit") hidden++;
  });
  return { n, changed, hidden, matrix: m };
}
