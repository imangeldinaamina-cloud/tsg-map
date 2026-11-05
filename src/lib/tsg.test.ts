import { describe, expect, it } from "vitest";
import { formatTsg, tsg, tsgLevel } from "./tsg";

describe("tsg()", () => {
  it("returns null when D = S = 0 (undefined, not balanced)", () => {
    expect(tsg(0, 0)).toBeNull();
  });

  it("returns +1 when only demand exists (S = 0)", () => {
    expect(tsg(12, 0)).toBe(1);
    expect(tsg(0.3, 0)).toBe(1);
  });

  it("returns −1 when only supply exists (D = 0)", () => {
    expect(tsg(0, 7)).toBe(-1);
  });

  it("returns 0 when D = S", () => {
    expect(tsg(5, 5)).toBe(0);
  });

  it("computes the normalised difference", () => {
    expect(tsg(15, 5)).toBeCloseTo(0.5);
    expect(tsg(5, 15)).toBeCloseTo(-0.5);
    expect(tsg(3.4, 2)).toBeCloseTo(1.4 / 5.4);
  });

  it("stays within [−1, 1]", () => {
    for (const [d, s] of [[1e9, 1], [1, 1e9], [0.0001, 0.0002]]) {
      const v = tsg(d, s)!;
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("is antisymmetric: tsg(a,b) = −tsg(b,a)", () => {
    expect(tsg(3, 8)).toBeCloseTo(-tsg(8, 3)!);
  });

  it("rejects negative and non-finite inputs", () => {
    expect(() => tsg(-1, 2)).toThrow(RangeError);
    expect(() => tsg(1, -2)).toThrow(RangeError);
    expect(() => tsg(NaN, 2)).toThrow(RangeError);
    expect(() => tsg(1, Infinity)).toThrow(RangeError);
  });
});

describe("tsgLevel()", () => {
  it("buckets values", () => {
    expect(tsgLevel(null)).toBe("none");
    expect(tsgLevel(1)).toBe("strong_shortage");
    expect(tsgLevel(0.2)).toBe("shortage");
    expect(tsgLevel(0)).toBe("balanced");
    expect(tsgLevel(-0.2)).toBe("surplus");
    expect(tsgLevel(-1)).toBe("strong_surplus");
  });
});

describe("formatTsg()", () => {
  it("formats with sign", () => {
    expect(formatTsg(0.5)).toBe("+0.50");
    expect(formatTsg(-0.25)).toBe("-0.25");
    expect(formatTsg(0)).toBe("0.00");
    expect(formatTsg(null)).toBe("—");
  });
});
