// Types of public/research/hexmap.json and adapters to the calculation core.
import { quarticKernel, type Cat, type CellInput, type View } from "./math";

export interface HexCell {
  x: number;
  y: number;
  R: number;
  D: Record<"morning" | "day" | "evening", number>;
  /** kernel supply, objects per km²; "static" = without opening hours */
  S: Record<Cat, Record<View, number>>;
  /** objects within 500 m and how many of them have known opening hours */
  N: Record<Cat, number>;
  Nh: Record<Cat, number>;
  /** TSG rounded to 0.01 by the export script (cross-check only) */
  T: Record<Cat, Record<View, number | null>>;
}

export interface HexCells {
  version?: string;
  side: number;
  cells: HexCell[];
}

export function cellInputs(hex: HexCells, cat: Cat, view: View): CellInput[] {
  return hex.cells.map((c) => ({
    R: c.R,
    D: view === "static" ? c.R : c.D[view],
    S: c.S[cat][view],
    S0: c.S[cat].static,
  }));
}

/** Hypothetical outlet added to a COPY of the published supply (units: objects per km², like hexmap.json). */
export function withOutlet(hex: HexCells, cat: Cat, view: View, outlet: { x: number; y: number; open: number }, h = 500): CellInput[] {
  if (!(outlet.open >= 0 && outlet.open <= 1)) throw new RangeError("open fraction must be in [0, 1]");
  return cellInputs(hex, cat, view).map((c, i) => {
    const k = quarticKernel(Math.hypot(hex.cells[i].x - outlet.x, hex.cells[i].y - outlet.y), h) * 1e6;
    return { ...c, S: c.S + k * (view === "static" ? 1 : outlet.open), S0: c.S0 + k };
  });
}
