// Service Gap Index (SGI) — the TSG formula applied to city-wide shares, so demand and supply
// are on the same scale:
//   d_i = P_i / Σ P            share of the city's (present) population in cell i
//   s_i = S_i / Σ S            share of the city's walk-accessible supply in cell i
//   S_i = number of facilities of the category within the walking catchment of cell i
//   SGI_i = (d_i − s_i) / (d_i + s_i)  ∈ [−1, +1]
// +1: people but no reachable facility; 0: balanced; −1: facilities but almost no people.
// No weights are applied (each facility counts 1, no distance decay inside the catchment).
import { tsg } from "@/lib/tsg";
import { median } from "./model";
import { AccessData, Cell, Facility, ServiceCat } from "./types";

export const UNDERSERVED_SGI = 0.5; // same threshold as "strong" in the TSG scale

export interface CellGap {
  /** facilities of the category within the catchment */
  S: number;
  /** walking distance to the nearest facility (m), null if none within the access cutoff */
  nearest: number | null;
  d: number;
  s: number;
  sgi: number | null;
  /** why sgi is null */
  reason: "no_population" | "no_network" | null;
  underserved: boolean;
}

export interface GapResult {
  cells: CellGap[];
  facilityCount: number;
  totalPresence: number;
  /** share of present population (in network-connected cells) with no facility within the catchment */
  shareWithoutAccess: number;
  /** present population by walking distance to nearest facility */
  bands: { label: string; people: number }[];
  medianPopulated: number;
  underserved: number[];
}

export const DISTANCE_BANDS = [200, 400, 800, 1200] as const;

/** Per-cell facility counts and nearest distance for one category. */
export function cellAccess(cells: Cell[], facilities: Facility[], access: AccessData, cat: ServiceCat | null, catchmentM: number) {
  const S = new Int32Array(cells.length);
  const nearest = new Float64Array(cells.length).fill(Infinity);
  facilities.forEach((f, fi) => {
    if (cat && f.cat !== cat) return;
    const p = access.pairs[fi] ?? [];
    for (let k = 0; k < p.length; k += 2) {
      const ci = p[k], d = p[k + 1];
      if (d <= catchmentM) S[ci]++;
      if (d < nearest[ci]) nearest[ci] = d;
    }
  });
  return { S, nearest };
}

export function computeGap(
  cells: Cell[],
  facilities: Facility[],
  access: AccessData,
  P: ArrayLike<number>,
  cat: ServiceCat,
  catchmentM: number,
): GapResult {
  const { S, nearest } = cellAccess(cells, facilities, access, cat, catchmentM);
  let sumP = 0, sumS = 0;
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i].net) continue;
    sumP += P[i];
    sumS += S[i];
  }
  const populated = cells.map((c, i) => (c.net && P[i] > 0 ? P[i] : -1)).filter((v) => v > 0);
  const med = median(populated);
  const bands = [...DISTANCE_BANDS.map((b) => ({ label: `≤${b}`, people: 0 })), { label: `>${DISTANCE_BANDS[DISTANCE_BANDS.length - 1]}`, people: 0 }];
  let without = 0;
  const underserved: number[] = [];
  const out: CellGap[] = cells.map((c, i) => {
    const near = Number.isFinite(nearest[i]) ? nearest[i] : null;
    if (!c.net) return { S: S[i], nearest: near, d: 0, s: 0, sgi: null, reason: "no_network", underserved: false };
    if (!(P[i] > 0)) return { S: S[i], nearest: near, d: 0, s: 0, sgi: null, reason: "no_population", underserved: false };
    const d = sumP > 0 ? P[i] / sumP : 0;
    const s = sumS > 0 ? S[i] / sumS : 0;
    const sgi = tsg(d, s);
    if (S[i] === 0) without += P[i];
    const bi = near === null ? DISTANCE_BANDS.length : DISTANCE_BANDS.findIndex((b) => near <= b);
    bands[bi < 0 ? DISTANCE_BANDS.length : bi].people += P[i];
    const u = sgi !== null && sgi >= UNDERSERVED_SGI && P[i] >= med;
    if (u) underserved.push(i);
    return { S: S[i], nearest: near, d, s, sgi, reason: null, underserved: u };
  });
  underserved.sort((a, b) => P[b] - P[a]);
  return {
    cells: out,
    facilityCount: facilities.filter((f) => f.cat === cat).length,
    totalPresence: sumP,
    shareWithoutAccess: sumP > 0 ? without / sumP : 0,
    bands,
    medianPopulated: med,
    underserved,
  };
}
