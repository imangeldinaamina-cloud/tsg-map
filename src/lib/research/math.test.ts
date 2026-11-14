import { describe, expect, it } from "vitest";
import {
  addOutletScenario,
  classify,
  huffChoiceShare,
  huffProbabilities,
  openFraction,
  quarticKernel,
  scaleToTotal,
  shares,
  transitions,
  tsgAll,
  tsgIndex,
  tvDistance,
  SLOT_HOURS,
} from "./math";

// small deterministic PRNG so property tests are reproducible
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("A · population scaling", () => {
  it("scales to the official total and keeps proportions", () => {
    const v = scaleToTotal([1, 2, 7], 171618)!;
    expect(v.reduce((s, x) => s + x, 0)).toBeCloseTo(171618, 6);
    expect(v[1] / v[0]).toBeCloseTo(2, 12);
    expect(v[2] / v[0]).toBeCloseTo(7, 12);
  });
  it("returns null for an all-zero input and rejects invalid values", () => {
    expect(scaleToTotal([0, 0], 100)).toBeNull();
    expect(() => scaleToTotal([1, NaN], 100)).toThrow();
    expect(() => scaleToTotal([1, -1], 100)).toThrow();
  });
});

describe("B · Huff model", () => {
  it("probabilities are non-negative and sum to 1", () => {
    const r = rng(1);
    for (let k = 0; k < 500; k++) {
      const n = 1 + Math.floor(r() * 8);
      const d = Array.from({ length: n }, () => r() * 2000);
      const o = Array.from({ length: n }, () => (r() < 0.2 ? 0 : r()));
      const { p, defined } = huffProbabilities(d, o, 1 + 2 * r());
      p.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
      if (defined) expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
      else p.forEach((x) => expect(x).toBe(0));
    }
  });
  it("zero distance is clamped to d_min (no infinite attraction)", () => {
    const { p } = huffProbabilities([0, 100], [1, 1], 2, 100);
    expect(p[0]).toBeCloseTo(0.5, 12);
  });
  it("larger β favours the nearer destination", () => {
    const p1 = huffProbabilities([200, 400], [1, 1], 1).p[0];
    const p3 = huffProbabilities([200, 400], [1, 1], 3).p[0];
    expect(p1).toBeCloseTo(2 / 3, 12);
    expect(p3).toBeCloseTo(8 / 9, 12);
  });
  it("attractiveness (open fraction) scales utility; closed gets zero", () => {
    expect(huffProbabilities([200, 200], [0.5, 1]).p[0]).toBeCloseTo(1 / 3, 12);
    expect(huffProbabilities([200, 200], [0, 1]).p[0]).toBe(0);
  });
  it("empty or all-closed destination sets are undefined, not NaN", () => {
    expect(huffProbabilities([], [])).toEqual({ p: [], defined: false });
    expect(huffProbabilities([100], [0])).toEqual({ p: [0], defined: false });
  });
  it("choice share: deterministic hand-checked example", () => {
    // one cell of 1000 people at the origin, the outlet at 200 m, one competitor at 400 m, β = 2
    // P = 200^-2 / (200^-2 + 400^-2) = 0.8
    const cells = [{ x: 0, y: 0, D: 1000 }];
    const r = huffChoiceShare(cells, [{ x: 400, y: 0, open: 1 }], { x: 200, y: 0, open: 1 });
    expect(r.share).toBeCloseTo(0.8, 12);
    expect(r.people).toBeCloseTo(800, 9);
    // closed for the slot → zero share
    expect(huffChoiceShare(cells, [{ x: 400, y: 0, open: 1 }], { x: 200, y: 0, open: 0 }).share).toBe(0);
    // no cells in the radius → null, not NaN
    expect(huffChoiceShare([{ x: 5000, y: 0, D: 10 }], [], { x: 0, y: 0, open: 1 }).share).toBeNull();
  });
});

describe("C · quartic kernel and opening hours", () => {
  it("is non-negative, zero at and beyond the radius, decreasing", () => {
    let prev = Infinity;
    for (let d = 0; d <= 600; d += 10) {
      const k = quarticKernel(d, 500);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(prev);
      prev = k;
    }
    expect(quarticKernel(500, 500)).toBe(0);
    expect(quarticKernel(499.999, 500)).toBeGreaterThan(0);
    expect(quarticKernel(499.999, 500)).toBeLessThan(1e-12); // smooth: → 0 at the cutoff
  });
  it("integrates to 1 over the plane", () => {
    const h = 500;
    const n = 4000;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const r = ((i + 0.5) / n) * h;
      s += quarticKernel(r, h) * 2 * Math.PI * r * (h / n);
    }
    expect(s).toBeCloseTo(1, 6);
  });
  it("opening-hours overlap with slots", () => {
    expect(openFraction(9, 21, SLOT_HOURS.morning)).toBeCloseTo(0.5, 12); // 9–11 of 7–11
    expect(openFraction(7, 19, SLOT_HOURS.evening)).toBeCloseTo(2.5 / 5.5, 12);
    expect(openFraction(8, 22, SLOT_HOURS.day)).toBe(1);
    expect(openFraction(0, 0, SLOT_HOURS.day)).toBe(1); // 24 h
    expect(openFraction(20, 8, SLOT_HOURS.morning)).toBeCloseTo(0.25, 12); // overnight: 7–8
    expect(openFraction(23, 6, SLOT_HOURS.day)).toBe(0);
    expect(openFraction(null, 20, SLOT_HOURS.day)).toBeNull(); // missing hours are not guessed here
  });
});

describe("D · TSG index", () => {
  it("range, antisymmetry, zero for equal shares, scale invariance", () => {
    const r = rng(7);
    for (let k = 0; k < 2000; k++) {
      const a = r();
      const b = r();
      const t = tsgIndex(a, b)!;
      expect(t).toBeGreaterThanOrEqual(-1);
      expect(t).toBeLessThanOrEqual(1);
      expect(tsgIndex(b, a)!).toBeCloseTo(-t, 12);
      const c = 0.001 + 100 * r();
      expect(tsgIndex(c * a, c * b)!).toBeCloseTo(t, 12);
      expect(tsgIndex(a, a)).toBe(0);
    }
  });
  it("edge cases: only a or only b is zero, and the indeterminate 0/0", () => {
    expect(tsgIndex(0.3, 0)).toBe(1);
    expect(tsgIndex(0, 0.3)).toBe(-1);
    expect(tsgIndex(0, 0)).toBeNull();
    expect(() => tsgIndex(NaN, 1)).toThrow();
    expect(() => tsgIndex(-0.1, 1)).toThrow();
  });
  it("local monotonicity with the other share fixed", () => {
    expect(tsgIndex(0.3, 0.2)!).toBeGreaterThan(tsgIndex(0.2, 0.2)!);
    expect(tsgIndex(0.2, 0.3)!).toBeLessThan(tsgIndex(0.2, 0.2)!);
  });
  it("counterexample: a new outlet can RAISE TSG elsewhere because b is renormalized citywide", () => {
    // two cells 2 km apart, equal people and equal supply → TSG = 0 in both
    const k = quarticKernel(0);
    const cells = [
      { x: 0, y: 0, R: 100, D: 100, S: k, S0: k },
      { x: 2000, y: 0, R: 100, D: 100, S: k, S0: k },
    ];
    const { before, after } = addOutletScenario(cells, { x: 0, y: 0, open: 1 });
    expect(before[1].tsg).toBeCloseTo(0, 12);
    // cell 1 is outside the 500 m radius: its S is unchanged, but b_1 = 1/3 instead of 1/2
    expect(after[1].b).toBeCloseTo(1 / 3, 12);
    expect(after[1].tsg!).toBeCloseTo(0.2, 12); // (1/2 − 1/3)/(1/2 + 1/3) = 0.2 > 0
    expect(after[0].tsg!).toBeLessThan(before[0].tsg!);
    // the scenario never mutates the published inputs
    expect(cells[0].S).toBe(k);
  });
  it("total variation distance", () => {
    expect(tvDistance([1, 0], [0, 1])).toBe(1);
    expect(tvDistance([2, 2], [1, 1])).toBe(0);
    expect(tvDistance([3, 1], [1, 1])).toBeCloseTo(0.25, 12);
    expect(tvDistance([0, 0], [1, 1])).toBeNull();
  });
});

describe("E · classification and cell eligibility", () => {
  it("exact boundaries τ = 0.2", () => {
    expect(classify(0.2)).toBe("deficit");
    expect(classify(0.1999999)).toBe("balance");
    expect(classify(-0.2)).toBe("surplus");
    expect(classify(-0.1999999)).toBe("balance");
    expect(classify(0)).toBe("balance");
    expect(() => classify(NaN)).toThrow();
  });
  it("missing data is never classified as balance", () => {
    const r = tsgAll([
      { R: 500, D: 800, S: 0, S0: 0 }, // people, no service in radius
      { R: 10, D: 20, S: 1e-6, S0: 1e-6 }, // service, too few people
      { R: 0, D: 0, S: 0, S0: 0 },
      { R: 400, D: 400, S: 2e-6, S0: 2e-6 },
    ]);
    expect(r.map((x) => x.reason)).toEqual(["no_service", "few_people", "no_service_few_people", null]);
    expect(r.slice(0, 3).every((x) => x.cls === null && x.tsg === null)).toBe(true);
    expect(r[3].cls).not.toBeNull();
  });
  it("all-zero city supply gives 'undefined', not NaN", () => {
    const r = tsgAll([{ R: 100, D: 100, S: 0, S0: 1e-6 }]);
    expect(r[0].reason).toBe("undefined");
    expect(Number.isNaN(r[0].a) || Number.isNaN(r[0].b)).toBe(false);
  });
  it("shares are normalized over ALL cells", () => {
    const r = tsgAll([
      { R: 100, D: 100, S: 1, S0: 1 },
      { R: 0, D: 100, S: 1, S0: 0 }, // not evaluated, but counts in Σ
    ]);
    expect(r[0].a).toBeCloseTo(0.5, 12);
    expect(r[0].b).toBeCloseTo(0.5, 12);
  });
  it("transition counts use cells evaluated in both views as the denominator", () => {
    const stat = tsgAll([
      { R: 100, D: 100, S: 1, S0: 1 },
      { R: 100, D: 100, S: 3, S0: 3 },
      { R: 100, D: 100, S: 0, S0: 0 },
    ]);
    const day = tsgAll([
      { R: 100, D: 300, S: 1, S0: 1 },
      { R: 100, D: 50, S: 3, S0: 3 },
      { R: 100, D: 100, S: 0, S0: 0 },
    ]);
    const tr = transitions(stat, day);
    expect(tr.n).toBe(2);
    expect(tr.changed + tr.matrix.deficit.deficit + tr.matrix.balance.balance + tr.matrix.surplus.surplus).toBe(2);
  });
});

describe("shares", () => {
  it("normalizes and rejects bad input", () => {
    expect(Array.from(shares([1, 3])!)).toEqual([0.25, 0.75]);
    expect(shares([0, 0])).toBeNull();
    expect(() => shares([Infinity])).toThrow();
  });
});
