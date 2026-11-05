import { describe, expect, it } from "vitest";
import { computeGap } from "./gap";
import { dijkstra, Graph, reachFrom } from "./graph";
import { assess, candidateMetrics } from "./location";
import { baseline, presence, UNSPECIFIED, validateAssumptions } from "./model";
import { AccessData, Cell, Facility, LocationReach } from "./types";

const cell = (pop: number, attr: number[] = [0, 0, 0, 0, 0, 0], net = true): Cell => ({ r: 0, c: 0, lat: 45, lon: 78, pop, attr, snap: 10, net });

describe("presence model", () => {
  const cells = [cell(100), cell(300), cell(0, [4, 0, 0, 0, 0, 0])];

  it("returns the residential baseline when assumptions are not specified", () => {
    const base = baseline(cells, null);
    expect(Array.from(presence(cells, base, UNSPECIFIED, "midday"))).toEqual([100, 300, 0]);
  });

  it("rescales to a census total proportionally", () => {
    expect(Array.from(baseline(cells, 800))).toEqual([200, 600, 0]);
  });

  it("redistributes the mobile share to attractors and conserves the total", () => {
    const a = { ...UNSPECIFIED, stay: { ...UNSPECIFIED.stay, midday: 0.75 } };
    const p = presence(cells, baseline(cells, null), a, "midday");
    expect(Array.from(p)).toEqual([75, 225, 100]);
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(400);
  });

  it("validates ranges", () => {
    expect(validateAssumptions({ ...UNSPECIFIED, stay: { ...UNSPECIFIED.stay, morning: 1.2 } })).toEqual(["stay.morning"]);
    expect(validateAssumptions(UNSPECIFIED)).toEqual([]);
  });
});

describe("service gap index", () => {
  const cells = [cell(100), cell(100), cell(0), cell(50, undefined, false)];
  const facilities: Facility[] = [{ id: "n/1", lat: 45, lon: 78, cat: "pharmacy", name: null, type: "pharmacy", snap: 5 }];
  const access: AccessData = { cutoff_m: 1200, method: "", pairs: [[0, 300, 1, 1000, 2, 100]] };

  it("computes SGI on shares, flags missing population and network", () => {
    const g = computeGap(cells, facilities, access, [100, 100, 0, 50], "pharmacy", 800);
    expect(g.cells[0]).toMatchObject({ S: 1, nearest: 300, sgi: 0 }); // d = 100/200, s = 1/2 (cell 2 also reaches the pharmacy)
    expect(g.cells[1]).toMatchObject({ S: 0, nearest: 1000, sgi: 1, underserved: true });
    expect(g.cells[2]).toMatchObject({ sgi: null, reason: "no_population" });
    expect(g.cells[3]).toMatchObject({ sgi: null, reason: "no_network" });
    expect(g.shareWithoutAccess).toBeCloseTo(0.5);
    expect(g.underserved).toEqual([1]);
  });

  it("uses the catchment", () => {
    const g = computeGap(cells, facilities, access, [100, 100, 0, 50], "pharmacy", 1200);
    expect(g.cells[1].S).toBe(1);
    expect(g.shareWithoutAccess).toBe(0);
  });
});

// Square 0-1-2-3 with 100 m edges and a 4th node hanging off node 2.
const graph: Graph = {
  lat: [45, 45, 45.0009, 45.0009, 45.0018],
  lon: [78, 78.00127, 78.00127, 78, 78.00127],
  offsets: [0, 2, 4, 7, 9, 10],
  targets: [1, 3, 0, 2, 1, 3, 4, 2, 0, 2],
  weights: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  cellNode: [0, 4, -1],
  cellSnap: [10, 20, 0],
  facNode: [2],
  facSnap: [5],
};

describe("walking network", () => {
  it("finds shortest paths with a cutoff", () => {
    const d = dijkstra(graph, 0, 250);
    expect(d.get(2)).toBe(200);
    expect(d.has(4)).toBe(false);
  });

  it("reaches cells and facilities from a point and measures the network", () => {
    const r = reachFrom(graph, 45, 78, 400, [400])!;
    expect(r.node).toBe(0);
    expect(r.cells).toEqual([0, 10, 1, 320]);
    expect(r.facilities).toEqual([0, 205]);
    expect(r.network["400"]).toEqual({ length_m: 500, intersections: 1 });
  });
});

describe("location assessment", () => {
  const facilities: Facility[] = [{ id: "n/1", lat: 45, lon: 78, cat: "cafe", name: null, type: "cafe", snap: 5 }];
  const reach = (cells: number[], facs: number[]): LocationReach => ({
    lat: 45, lon: 78, snap_m: 20, cutoff_m: 1200, cells, facilities: facs,
    network: { "800": { length_m: 4000, intersections: 12 } },
  });
  const base = [100, 400];
  const presenceBy = { morning: base, midday: base, afternoon: base, evening: base };
  const common = { facilities, base, presenceBy, period: "midday" as const, cat: "cafe" as const, catchmentM: 800, cellIndex: null, gap: null };

  it("computes metrics and explainable findings", () => {
    const a = candidateMetrics({ ...common, id: 1, reach: reach([0, 100], [0, 120]) });
    const b = candidateMetrics({ ...common, id: 2, reach: reach([1, 300], []) });
    expect(a).toMatchObject({ residents: 100, competitors: 1, nearestCompetitor: 120, perOutlet: 50 });
    expect(b).toMatchObject({ residents: 400, competitors: 0, perOutlet: 400 });
    const [fa, fb] = assess([a, b], { period: "midday", catchmentM: 800, temporalSpecified: false, cityMedianCompetitors: 1 });
    expect(fa.map((f) => f.key)).toEqual(expect.arrayContaining(["competitorAdjacent", "lowestPresence", "baselineOnly"]));
    expect(fb.map((f) => f.key)).toEqual(expect.arrayContaining(["noCompetitors", "highestPresence", "bestPerOutlet"]));
  });
});
