/**
 * Temporal Service Gap index.
 *
 *   TSG = (D − S) / (D + S),  range −1 … +1
 *
 * D = demand (people present in a time slot, or registered residents in static mode)
 * S = supply (number of services within walking distance)
 *
 * Positive values mean demand exceeds supply (shortage).
 * The formula is fixed by the research methodology — do not change it.
 */
export function tsg(demand: number, supply: number): number | null {
  if (!Number.isFinite(demand) || !Number.isFinite(supply)) {
    throw new RangeError("TSG inputs must be finite numbers");
  }
  if (demand < 0 || supply < 0) {
    throw new RangeError("TSG inputs must be non-negative");
  }
  // D = S = 0: no people and no services — the index is undefined, not "balanced".
  if (demand + supply === 0) return null;
  return (demand - supply) / (demand + supply);
}

export type TsgLevel = "strong_shortage" | "shortage" | "balanced" | "surplus" | "strong_surplus" | "none";

/**
 * Presentation buckets. These thresholds are a UI assumption (documented on the
 * methodology page), not part of the index itself.
 */
export const TSG_THRESHOLDS = { strong: 0.5, mild: 0.15 } as const;

export function tsgLevel(value: number | null): TsgLevel {
  if (value === null) return "none";
  if (value >= TSG_THRESHOLDS.strong) return "strong_shortage";
  if (value >= TSG_THRESHOLDS.mild) return "shortage";
  if (value > -TSG_THRESHOLDS.mild) return "balanced";
  if (value > -TSG_THRESHOLDS.strong) return "surplus";
  return "strong_surplus";
}

/**
 * Colour-blind-safe diverging scale (blue ↔ orange, from ColorBrewer PuOr/RdYlBu family),
 * never red/green. Always shown together with a text label.
 */
export const TSG_COLORS: Record<TsgLevel, string> = {
  strong_shortage: "#b35806",
  shortage: "#f1a340",
  balanced: "#f7f7f7",
  surplus: "#7fa8d1",
  strong_surplus: "#2b5c8a",
  none: "#9ca3af",
};

export function formatTsg(value: number | null): string {
  if (value === null) return "—";
  const s = value.toFixed(2);
  return value > 0 ? `+${s}` : s;
}

/** Text colour on top of each level colour (all pairs ≥ 4.5:1). */
export const TSG_TEXT: Record<TsgLevel, string> = {
  strong_shortage: "#ffffff",
  shortage: "#0f172a",
  balanced: "#0f172a",
  surplus: "#0f172a",
  strong_surplus: "#ffffff",
  none: "#0f172a",
};

/** Shape cue so colour is never the only signal. */
export const TSG_SYMBOL: Record<TsgLevel, string> = {
  strong_shortage: "▲▲",
  shortage: "▲",
  balanced: "●",
  surplus: "▼",
  strong_surplus: "▼▼",
  none: "?",
};
