// Puts the author's agent-based model onto the /city grid.
//   in:  data/agent-model/taldykorgan.json  (355 hex cells, presence D per time slot, georeference)
//        public/data/taldykorgan/grid.json  (250 m square cells with WorldPop residents)
//   out: public/data/taldykorgan/agent-presence.json
// Each 250 m cell belongs to the hexagon whose centre is nearest (hexagons tile the plane, so this is the hexagon
// that contains it). A hexagon's modelled presence is split among its 250 m cells in proportion to their residents
// (equally when none live there). Totals are rescaled to the grid's resident total so "presence − residents" compares
// like with like (the model is scaled to the BNS count, WorldPop has its own total).
import { readFileSync, writeFileSync } from "node:fs";

const model = JSON.parse(readFileSync(new URL("../data/agent-model/taldykorgan.json", import.meta.url), "utf8"));
const grid = JSON.parse(readFileSync(new URL("../public/data/taldykorgan/grid.json", import.meta.url), "utf8"));
const OUT = new URL("../public/data/taldykorgan/agent-presence.json", import.meta.url);

// /city periods -> model time slots
const PERIOD_SLOT = { morning: "morning", midday: "day", afternoon: "day", evening: "evening" };

// invert the affine georeference: lat = a0 x + a1 y + a2, lon = b0 x + b1 y + b2
const [a0, a1, a2] = model.georef.lat;
const [b0, b1, b2] = model.georef.lon;
const det = a0 * b1 - a1 * b0;
const toXY = (lat, lon) => {
  const u = lat - a2;
  const v = lon - b2;
  return [(u * b1 - a1 * v) / det, (a0 * v - u * b0) / det];
};

const hexes = model.cells;
const maxDist = model.hex_side_m * 1.05; // farther than this from every centre = outside the modelled city
const owner = grid.cells.map((c) => {
  const [x, y] = toXY(c.lat, c.lon);
  let best = -1;
  let bd = Infinity;
  for (let h = 0; h < hexes.length; h++) {
    const d = Math.hypot(hexes[h].x - x, hexes[h].y - y);
    if (d < bd) [bd, best] = [d, h];
  }
  return bd <= maxDist ? best : -1;
});

const members = hexes.map(() => []);
owner.forEach((h, i) => h >= 0 && members[h].push(i));

const residentsTotal = grid.cells.reduce((s, c) => s + c.pop, 0);
const outsideResidents = grid.cells.reduce((s, c, i) => s + (owner[i] < 0 ? c.pop : 0), 0);
const values = {};
for (const [period, slot] of Object.entries(PERIOD_SLOT)) {
  const v = new Float64Array(grid.cells.length);
  hexes.forEach((h, k) => {
    const ids = members[k];
    if (!ids.length) return;
    const w = ids.reduce((s, i) => s + grid.cells[i].pop, 0);
    for (const i of ids) v[i] += h.D[slot] * (w > 0 ? grid.cells[i].pop / w : 1 / ids.length);
  });
  // cells outside the modelled area keep their residents; the rest is rescaled to the remaining resident total
  const inside = v.reduce((s, x) => s + x, 0);
  const scale = inside > 0 ? (residentsTotal - outsideResidents) / inside : 1;
  values[period] = Array.from(v, (x, i) => Math.round((owner[i] < 0 ? grid.cells[i].pop : x * scale) * 10) / 10);
}

const unmatchedHexes = members.filter((m) => !m.length).length;
writeFileSync(
  OUT,
  JSON.stringify({
    source: "TSG agent-based model (author), 100 runs, ≈17 162 agents",
    model_city_pop: model.city_pop,
    runs: model.runs,
    slots: model.slots,
    period_slot: PERIOD_SLOT,
    georef_median_error_m: model.georef.median_error_m,
    cells_outside_model: owner.filter((h) => h < 0).length,
    hexes_without_grid_cells: unmatchedHexes,
    values,
  }),
);
console.log(
  `agent-presence.json: ${grid.cells.length} cells, ${owner.filter((h) => h < 0).length} outside the model, ${unmatchedHexes} hexes without grid cells`,
);
