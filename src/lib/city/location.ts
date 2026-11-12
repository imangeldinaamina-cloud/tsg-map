// Candidate-location metrics and a rule-based, explainable assessment.
// No revenue prediction: every statement is a comparison of measured or modelled inputs,
// with the numbers attached so the user can check it.
import { CellGap, UNDERSERVED_SGI } from "./gap";
import { Facility, LocationReach, Period, PERIODS, SERVICE_CATS, ServiceCat } from "./types";

export interface CandidateMetrics {
  id: number;
  lat: number;
  lon: number;
  snap_m: number;
  residents: number;
  presence: Record<Period, number>;
  competitors: number;
  competitorIdx: number[];
  nearestCompetitor: number | null;
  /** present people (selected period) per outlet if the new business opened: P / (competitors + 1) */
  perOutlet: number;
  services: Record<ServiceCat, number>;
  network: { length_m: number; intersections: number };
  cellIndex: number | null;
  sgi: number | null;
}

export type FindingKind = "opportunity" | "limitation" | "info";
export interface Finding {
  kind: FindingKind;
  key: string;
  params: Record<string, string | number>;
}

export function candidateMetrics(args: {
  id: number;
  reach: LocationReach;
  facilities: Facility[];
  base: ArrayLike<number>;
  presenceBy: Record<Period, ArrayLike<number>>;
  period: Period;
  cat: ServiceCat;
  catchmentM: number;
  cellIndex: number | null;
  gap: CellGap[] | null;
}): CandidateMetrics {
  const { reach, facilities, base, presenceBy, period, cat, catchmentM } = args;
  let residents = 0;
  const presence = Object.fromEntries(PERIODS.map((p) => [p, 0])) as Record<Period, number>;
  for (let k = 0; k < reach.cells.length; k += 2) {
    if (reach.cells[k + 1] > catchmentM) continue;
    const ci = reach.cells[k];
    residents += base[ci];
    for (const p of PERIODS) presence[p] += presenceBy[p][ci];
  }
  const services = Object.fromEntries(SERVICE_CATS.map((c) => [c, 0])) as Record<ServiceCat, number>;
  const competitorIdx: number[] = [];
  let nearest: number | null = null;
  for (let k = 0; k < reach.facilities.length; k += 2) {
    const fi = reach.facilities[k], d = reach.facilities[k + 1];
    const f = facilities[fi];
    if (!f) continue;
    if (f.cat === cat && (nearest === null || d < nearest)) nearest = d;
    if (d > catchmentM) continue;
    services[f.cat]++;
    if (f.cat === cat) competitorIdx.push(fi);
  }
  const gapCell = args.cellIndex !== null && args.gap ? args.gap[args.cellIndex] : null;
  return {
    id: args.id,
    lat: reach.lat,
    lon: reach.lon,
    snap_m: reach.snap_m,
    residents,
    presence,
    competitors: competitorIdx.length,
    competitorIdx,
    nearestCompetitor: nearest,
    perOutlet: presence[period] / (competitorIdx.length + 1),
    services,
    network: reach.network[String(catchmentM)] ?? { length_m: 0, intersections: 0 },
    cellIndex: args.cellIndex,
    sgi: gapCell?.sgi ?? null,
  };
}

const r0 = (x: number) => Math.round(x);

export function assess(
  all: CandidateMetrics[],
  ctx: { period: Period; catchmentM: number; temporalSpecified: boolean; cityMedianCompetitors: number },
): Finding[][] {
  const many = all.length > 1;
  const max = (f: (m: CandidateMetrics) => number) => Math.max(...all.map(f));
  const min = (f: (m: CandidateMetrics) => number) => Math.min(...all.map(f));
  return all.map((m) => {
    const out: Finding[] = [];
    const P = m.presence[ctx.period];
    const R = ctx.catchmentM;
    // competition
    if (m.competitors === 0) out.push({ kind: "opportunity", key: "noCompetitors", params: { R } });
    else if (m.competitors >= Math.max(3, 2 * ctx.cityMedianCompetitors))
      out.push({ kind: "limitation", key: "denseCompetition", params: { n: m.competitors, R, median: ctx.cityMedianCompetitors } });
    else if (m.competitors < ctx.cityMedianCompetitors)
      out.push({ kind: "opportunity", key: "lessCompetition", params: { n: m.competitors, median: ctx.cityMedianCompetitors } });
    else out.push({ kind: "info", key: "competitors", params: { n: m.competitors, R, median: ctx.cityMedianCompetitors } });
    if (m.nearestCompetitor !== null && m.nearestCompetitor < 150)
      out.push({ kind: "limitation", key: "competitorAdjacent", params: { d: m.nearestCompetitor } });
    // demand
    if (P <= 0) out.push({ kind: "limitation", key: "noPopulation", params: { R } });
    if (many && P > 0 && P === max((x) => x.presence[ctx.period]))
      out.push({ kind: "opportunity", key: "highestPresence", params: { P: r0(P) } });
    if (many && P === min((x) => x.presence[ctx.period]) && P < max((x) => x.presence[ctx.period]))
      out.push({ kind: "limitation", key: "lowestPresence", params: { P: r0(P) } });
    if (many && m.perOutlet > 0 && m.perOutlet === max((x) => x.perOutlet))
      out.push({ kind: "opportunity", key: "bestPerOutlet", params: { v: r0(m.perOutlet) } });
    // gap index of the cell
    if (m.sgi !== null && m.sgi >= UNDERSERVED_SGI) out.push({ kind: "opportunity", key: "underservedCell", params: { sgi: m.sgi.toFixed(2) } });
    if (m.sgi !== null && m.sgi <= -UNDERSERVED_SGI) out.push({ kind: "limitation", key: "saturatedCell", params: { sgi: m.sgi.toFixed(2) } });
    // walkability
    if (many && m.network.intersections > 0 && m.network.intersections === max((x) => x.network.intersections))
      out.push({ kind: "opportunity", key: "bestWalkability", params: { n: m.network.intersections } });
    if (many && m.network.length_m < 0.5 * max((x) => x.network.length_m))
      out.push({ kind: "limitation", key: "weakWalkability", params: { km: (m.network.length_m / 1000).toFixed(1) } });
    if (m.snap_m > 150) out.push({ kind: "limitation", key: "farFromNetwork", params: { d: m.snap_m } });
    // model status
    if (ctx.temporalSpecified) {
      const peak = PERIODS.reduce((a, b) => (m.presence[b] > m.presence[a] ? b : a));
      out.push({ kind: "info", key: "peakPeriod", params: { period: peak } });
    } else out.push({ kind: "info", key: "baselineOnly", params: {} });
    return out;
  });
}

export type VerdictLevel = "promising" | "mixed" | "risky";
/** One-line answer built from the same findings the panel lists (no hidden scoring). */
export function verdict(findings: Finding[]): { level: VerdictLevel; reasons: Finding[] } {
  const pros = findings.filter((f) => f.kind === "opportunity");
  const cons = findings.filter((f) => f.kind === "limitation");
  const level: VerdictLevel = cons.length >= 2 && cons.length > pros.length ? "risky" : pros.length > cons.length ? "promising" : "mixed";
  const reasons = (level === "promising" ? pros : level === "risky" ? cons : [...cons, ...pros]).slice(0, 2);
  return { level, reasons };
}

/** Best cell within walking distance: highest gap index with people present, reached on the street network. */
export function bestNearby(args: {
  reach: LocationReach;
  gap: CellGap[];
  presence: ArrayLike<number>;
  maxWalkM: number;
  minPresence: number;
  fromCell: number | null;
}): { cell: number; walk_m: number; sgi: number; presence: number } | null {
  let best: { cell: number; walk_m: number; sgi: number; presence: number } | null = null;
  for (let k = 0; k < args.reach.cells.length; k += 2) {
    const ci = args.reach.cells[k], d = args.reach.cells[k + 1];
    if (d > args.maxWalkM || ci === args.fromCell) continue;
    const g = args.gap[ci];
    const p = args.presence[ci];
    if (!g || g.sgi === null || g.sgi <= 0 || p < args.minPresence) continue;
    if (!best || g.sgi > best.sgi || (g.sgi === best.sgi && p > best.presence)) best = { cell: ci, walk_m: d, sgi: g.sgi, presence: p };
  }
  return best;
}
