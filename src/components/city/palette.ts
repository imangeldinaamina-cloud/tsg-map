import { TSG_COLORS, tsgLevel } from "@/lib/tsg";
import type { ServiceCat } from "@/lib/city/types";

/** Okabe–Ito palette: distinguishable with common colour-vision deficiencies. */
export const CAT_COLORS: Record<ServiceCat, string> = {
  pharmacy: "#009E73",
  grocery: "#E69F00",
  restaurant: "#D55E00",
  cafe: "#CC79A7",
  education: "#0072B2",
  healthcare: "#56B4E9",
};

export const LANDUSE_COLORS = { residential: "#cbd5e1", commercial: "#fcd34d", industrial: "#a8a29e" };

/** Sequential (ColorBrewer PuBu, 6 classes) for population. */
export const SEQ = ["#f1eef6", "#d0d1e6", "#a6bddb", "#74a9cf", "#2b8cbe", "#045a8d"];
/** Diverging for change: fewer (brown) ↔ more (purple), neutral middle. */
export const DIV = ["#b35806", "#f1a340", "#fee0b6", "#f7f7f7", "#d8daeb", "#998ec3", "#542788"];

/** Class breaks from quantiles of positive values, rounded to readable numbers. */
export function quantileBreaks(values: number[], classes = SEQ.length): number[] {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return [];
  const nice = (x: number) => {
    if (x < 10) return Math.max(1, Math.round(x));
    const p = 10 ** Math.floor(Math.log10(x));
    return Math.round(x / (p / 2)) * (p / 2);
  };
  const out: number[] = [];
  for (let k = 1; k < classes; k++) {
    const b = nice(v[Math.floor((k / classes) * (v.length - 1))]);
    if (!out.length || b > out[out.length - 1]) out.push(b);
  }
  return out;
}

export function seqColor(v: number, breaks: number[]) {
  let k = 0;
  while (k < breaks.length && v >= breaks[k]) k++;
  return SEQ[Math.min(k + (SEQ.length - 1 - breaks.length), SEQ.length - 1)];
}

/** Symmetric diverging breaks for change values. */
export function divColor(v: number, maxAbs: number) {
  if (maxAbs <= 0 || Math.abs(v) < maxAbs * 0.05) return DIV[3];
  const t = Math.min(1, Math.abs(v) / maxAbs);
  const step = t > 0.6 ? 3 : t > 0.25 ? 2 : 1;
  return v > 0 ? DIV[3 + step] : DIV[3 - step];
}

export function sgiColor(v: number | null) {
  return TSG_COLORS[tsgLevel(v)];
}

/** Walking distance to the nearest facility: near = blue, far = orange (same semantics as the gap scale). */
export const DIST_STEPS: { max: number | null; color: string }[] = [
  { max: 200, color: "#2b5c8a" },
  { max: 400, color: "#7fa8d1" },
  { max: 800, color: "#f7f7f7" },
  { max: 1200, color: "#f1a340" },
  { max: null, color: "#b35806" },
];
export function distColor(d: number | null) {
  if (d === null) return DIST_STEPS[DIST_STEPS.length - 1].color;
  return (DIST_STEPS.find((s) => s.max !== null && d <= s.max) ?? DIST_STEPS[DIST_STEPS.length - 1]).color;
}
