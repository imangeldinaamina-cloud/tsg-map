import { describe, expect, it } from "vitest";
import { aggregatePoints, computeArea, countServices, rank, rankPositions, toCsv } from "./compute";
import { Observation, Service } from "./domain";

const base: Observation = {
  point_id: "P01",
  point_type: "residential",
  lat: 45.0,
  lon: 78.38,
  date: "2026-10-12",
  time_start: "08:15",
  slot: "morning",
  frames: 20,
  mean_people_per_frame: 4,
  holdout: false,
};

describe("aggregatePoints", () => {
  it("averages presence across days per slot", () => {
    const pts = aggregatePoints([base, { ...base, date: "2026-10-13", mean_people_per_frame: 6 }], { P01: 1200 });
    expect(pts).toHaveLength(1);
    expect(pts[0].slots.morning).toMatchObject({ mean_people: 5, n_obs: 2, frames: 40 });
    expect(pts[0].slots.midday).toBeUndefined();
    expect(pts[0].population).toBe(1200);
  });
});

describe("computeArea", () => {
  const services: Service[] = [
    { id: "a", lat: 45.0, lon: 78.381, category: "pharmacy", name: null }, // ~80 m
    { id: "b", lat: 45.0, lon: 78.39, category: "food", name: null }, // ~790 m
  ];
  const [p] = aggregatePoints([base]);

  it("counts services within radius and by category", () => {
    expect(countServices(p, services, "all", 500)).toBe(1);
    expect(countServices(p, services, "all", 1000)).toBe(2);
    expect(countServices(p, services, "food", 500)).toBe(0);
  });

  it("computes dynamic TSG from presence", () => {
    const r = computeArea(p, services, { slot: "morning", mode: "dynamic", category: "all", radiusM: 500, isDemo: false });
    expect(r.D).toBe(4);
    expect(r.S).toBe(1);
    expect(r.tsg).toBeCloseTo(0.6);
    expect(r.quality).toBe("low");
  });

  it("reports missing presence and missing population instead of guessing", () => {
    const dyn = computeArea(p, services, { slot: "evening", mode: "dynamic", category: "all", radiusM: 500, isDemo: false });
    expect(dyn).toMatchObject({ D: null, tsg: null, missing: "presence", quality: "none" });
    const st = computeArea(p, services, { slot: "morning", mode: "static", category: "all", radiusM: 500, isDemo: false });
    expect(st).toMatchObject({ D: null, tsg: null, missing: "population" });
  });
});

describe("rank", () => {
  it("orders by shortage and puts undefined last", () => {
    const mk = (id: string, t: number | null) => ({ point: { point_id: id }, tsg: t }) as never;
    const r = rank([mk("a", 0.1), mk("b", null), mk("c", 0.9)]);
    expect(r.map((x: { point: { point_id: string } }) => x.point.point_id)).toEqual(["c", "a", "b"]);
    expect(rankPositions([mk("a", 0.1), mk("b", null), mk("c", 0.9)])).toEqual({ c: 1, a: 2, b: null });
  });
});

describe("toCsv", () => {
  it("escapes", () => {
    expect(toCsv([["a", 1, null], ['x,"y"', 2, 3]])).toBe('a,1,\n"x,""y""",2,3\n');
  });
});
