import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { weightedMedian } from "./model";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../../public/data/taldykorgan/${p}`, import.meta.url), "utf8"));

describe("weightedMedian", () => {
  it("follows the weights, not the count", () => {
    expect(weightedMedian([0, 0, 0, 10], [1, 1, 1, 100])).toBe(10);
    expect(weightedMedian([1, 2, 3], [1, 1, 1])).toBe(2);
    expect(weightedMedian([5], [0])).toBe(0);
  });
});

describe("agent model on the city grid", () => {
  const grid = read("grid.json");
  const agent = read("agent-presence.json");
  const residents = grid.cells.reduce((s: number, c: { pop: number }) => s + c.pop, 0);
  it("has one value per grid cell for every period", () => {
    for (const v of Object.values(agent.values) as number[][]) expect(v.length).toBe(grid.cells.length);
  });
  it("keeps the resident total in every period", () => {
    for (const v of Object.values(agent.values) as number[][]) {
      const total = v.reduce((s, x) => s + x, 0);
      expect(Math.abs(total - residents) / residents).toBeLessThan(0.001);
    }
  });
  it("moves people by day more than in the evening (as in the paper: 35% vs 13%)", () => {
    const moved = (v: number[]) => v.reduce((s, x, i) => s + Math.abs(x - grid.cells[i].pop), 0) / 2 / residents;
    expect(moved(agent.values.midday)).toBeGreaterThan(0.25);
    expect(moved(agent.values.evening)).toBeLessThan(moved(agent.values.midday));
  });
});
