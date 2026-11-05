import { distanceM } from "./csv-import";
import { Category, EXPECTED_FRAMES, Mode, Observation, Point, Service, Slot, SLOTS } from "./domain";
import { tsg, tsgLevel, TsgLevel } from "./tsg";

/** Aggregate raw observation sessions into points with per-slot mean presence. */
export function aggregatePoints(obs: Observation[], population: Record<string, number | null> = {}): Point[] {
  const byPoint = new Map<string, Observation[]>();
  for (const o of obs) {
    const list = byPoint.get(o.point_id) ?? [];
    list.push(o);
    byPoint.set(o.point_id, list);
  }
  const points: Point[] = [];
  for (const [point_id, list] of byPoint) {
    const first = list[0];
    const slots: Point["slots"] = {};
    for (const slot of SLOTS) {
      const s = list.filter((o) => o.slot === slot);
      if (!s.length) continue;
      slots[slot] = {
        mean_people: s.reduce((a, o) => a + o.mean_people_per_frame, 0) / s.length,
        n_obs: s.length,
        frames: s.reduce((a, o) => a + o.frames, 0),
        dates: [...new Set(s.map((o) => o.date))].sort(),
      };
    }
    points.push({
      point_id,
      point_type: first.point_type,
      lat: list.reduce((a, o) => a + o.lat, 0) / list.length,
      lon: list.reduce((a, o) => a + o.lon, 0) / list.length,
      holdout: list.some((o) => o.holdout),
      population: population[point_id] ?? null,
      slots,
    });
  }
  return points.sort((a, b) => a.point_id.localeCompare(b.point_id));
}

export function countServices(p: { lat: number; lon: number }, services: Service[], category: Category, radiusM: number) {
  let n = 0;
  for (const s of services) {
    if (category !== "all" && s.category !== category) continue;
    if (distanceM(p.lat, p.lon, s.lat, s.lon) <= radiusM) n++;
  }
  return n;
}

export type Quality = "demo" | "none" | "low" | "medium" | "good";

/**
 * Data-quality badge for one point/slot. Based on number of observation days and
 * frame completeness. Detector verification is a global limitation shown elsewhere.
 */
export function quality(point: Point, slot: Slot, isDemo: boolean): Quality {
  if (isDemo) return "demo";
  const s = point.slots[slot];
  if (!s) return "none";
  const completeFrames = s.frames >= s.n_obs * EXPECTED_FRAMES;
  if (s.n_obs >= 3 && completeFrames) return "good";
  if (s.n_obs >= 2) return "medium";
  return "low";
}

export interface AreaResult {
  point: Point;
  D: number | null; // null = no measurement / placeholder
  S: number;
  tsg: number | null;
  level: TsgLevel;
  quality: Quality;
  missing: "presence" | "population" | null;
}

export function demandFor(point: Point, slot: Slot, mode: Mode): number | null {
  if (mode === "static") return point.population;
  return point.slots[slot]?.mean_people ?? null;
}

export function computeArea(
  point: Point,
  services: Service[],
  opts: { slot: Slot; mode: Mode; category: Category; radiusM: number; isDemo: boolean },
): AreaResult {
  const S = countServices(point, services, opts.category, opts.radiusM);
  const D = demandFor(point, opts.slot, opts.mode);
  const value = D === null ? null : tsg(D, S);
  return {
    point,
    D,
    S,
    tsg: value,
    level: tsgLevel(value),
    quality: quality(point, opts.slot, opts.isDemo),
    missing: D !== null ? null : opts.mode === "static" ? "population" : "presence",
  };
}

/** Sort by TSG descending (largest shortage first); undefined values go last. */
export function rank(results: AreaResult[]): AreaResult[] {
  return [...results].sort((a, b) => {
    if (a.tsg === null && b.tsg === null) return a.point.point_id.localeCompare(b.point.point_id);
    if (a.tsg === null) return 1;
    if (b.tsg === null) return -1;
    return b.tsg - a.tsg;
  });
}

/** Rank positions (1-based) by point_id; null when TSG undefined. */
export function rankPositions(results: AreaResult[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  rank(results).forEach((r, i) => (out[r.point.point_id] = r.tsg === null ? null : i + 1));
  return out;
}

/** GeoJSON polygon approximating a circle (for map rendering). */
export function circlePolygon(lon: number, lat: number, radiusM: number, steps = 48): number[][] {
  const coords: number[][] = [];
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return coords;
}

export function toCsv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
