// Consistency of the published research dataset (public/research/hexmap.json) with the calculation core.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATS, SLOTS, transitions, tsgAll, tvDistance, type View } from "./math";
import { cellInputs, withOutlet, type HexCells } from "./hex";

const hex = JSON.parse(readFileSync(join(process.cwd(), "public/research/hexmap.json"), "utf8")) as HexCells & {
  summary: Record<string, { n: number; changed: number; hidden: number }>;
};

describe("published hex dataset", () => {
  it("has 355 cells and the population total of the BNS baseline", () => {
    expect(hex.cells).toHaveLength(355);
    const R = hex.cells.reduce((s, c) => s + c.R, 0);
    expect(Math.abs(R - 171618)).toBeLessThan(200); // per-cell rounding
    for (const s of SLOTS) expect(Math.abs(hex.cells.reduce((t, c) => t + c.D[s], 0) - R)).toBeLessThan(200);
  });

  it("recomputes every stored TSG value and the eligibility of every cell", () => {
    for (const cat of CATS)
      for (const view of ["static", ...SLOTS] as View[]) {
        const r = tsgAll(cellInputs(hex, cat, view));
        r.forEach((x, i) => {
          const stored = hex.cells[i].T[cat][view];
          expect(x.tsg === null, `${cat}/${view}/${i}`).toBe(stored === null);
          if (stored !== null) expect(Math.abs(x.tsg! - stored), `${cat}/${view}/${i}`).toBeLessThanOrEqual(0.0051);
        });
      }
  });

  it("class-change shares of the map match the stored summary", () => {
    for (const cat of CATS)
      for (const s of SLOTS) {
        const tr = transitions(tsgAll(cellInputs(hex, cat, "static")), tsgAll(cellInputs(hex, cat, s)));
        const sum = hex.summary[`${cat}|${s}`];
        expect(tr.n).toBe(sum.n);
        expect(Math.abs(tr.changed / tr.n - sum.changed)).toBeLessThanOrEqual(0.0075);
        expect(Math.abs(tr.hidden / tr.n - sum.hidden)).toBeLessThanOrEqual(0.0075);
      }
  });

  it("redistribution share M(t) of the mean presence map (≈34% by day)", () => {
    const R = hex.cells.map((c) => c.R);
    const m = tvDistance(R, hex.cells.map((c) => c.D.day))!;
    expect(m).toBeGreaterThan(0.33);
    expect(m).toBeLessThan(0.35);
  });

  it("peak: the busiest daytime cell is compared with its own residents", () => {
    const iDay = hex.cells.reduce((b, c, i, a) => (c.D.day > a[b].D.day ? i : b), 0);
    expect(iDay).toBe(173);
    expect(hex.cells[173].R).toBeGreaterThan(800);
    expect(hex.cells[173].D.day / hex.cells[173].R).toBeGreaterThan(6.5);
  });
});

describe("hypothetical outlet on the published data", () => {
  it("leaves the published inputs untouched, uses the same units, and renormalizes the whole city", () => {
    const before = cellInputs(hex, "food", "morning");
    const c = hex.cells[206];
    const after = withOutlet(hex, "food", "morning", { x: c.x, y: c.y, open: 0.5 });
    expect(cellInputs(hex, "food", "morning")).toEqual(before);
    // kernel at distance 0: 3/(π·500²) per m² = 3.8197 per km², times the open fraction
    expect(after[206].S - before[206].S).toBeCloseTo((3 / (Math.PI * 250000)) * 1e6 * 0.5, 9);
    const r0 = tsgAll(before);
    const r1 = tsgAll(after);
    expect(r1[206].tsg!).toBeLessThan(r0[206].tsg!);
    // a far evaluated cell with unchanged S gets a higher TSG (b falls after renormalization)
    const far = r0.findIndex((x, i) => x.tsg !== null && Math.hypot(hex.cells[i].x - c.x, hex.cells[i].y - c.y) > 3000);
    expect(after[far].S).toBe(before[far].S);
    expect(r1[far].tsg!).toBeGreaterThan(r0[far].tsg!);
  });
  it("an outlet closed for the whole slot adds no supply in that slot", () => {
    const c = hex.cells[206];
    const a = withOutlet(hex, "food", "morning", { x: c.x, y: c.y, open: 0 });
    expect(a.map((x) => x.S)).toEqual(cellInputs(hex, "food", "morning").map((x) => x.S));
  });
});
