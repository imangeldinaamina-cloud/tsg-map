// Street + intersection index for the address search on /city. Runs offline from the OSM roads snapshot.
//   in:  data-raw/osm-roads.json  (Overpass "out geom" with node ids, fetched by scripts/fetch-osm.mjs / build-city.mjs)
//   out: public/data/taldykorgan/streets.json
// Format (compact, ~ small enough to load on demand):
//   { streets: [{ n: display name, a: [other names], p: [[lat, lon], ...] }],
//     x: [[streetA, streetB, lat, lon], ...] }   — every distinct crossing of two differently named streets
import { readFileSync, writeFileSync } from "node:fs";

const raw = JSON.parse(readFileSync(new URL("../data-raw/osm-roads.json", import.meta.url), "utf8"));
const OUT = new URL("../public/data/taldykorgan/streets.json", import.meta.url);
const NAME_KEYS = ["name:ru", "name", "name:kk", "name:en", "old_name", "old_name:ru", "old_name:kk", "old_name:en", "name_old"];
const r5 = (v) => Math.round(v * 1e5) / 1e5;

const byName = new Map(); // display name -> { alts:Set, ways: [[lat,lon][]] }
const nodeStreets = new Map(); // node id -> Map(display name -> [lat, lon])

for (const w of raw.elements) {
  if (w.type !== "way" || !w.geometry || !w.tags) continue;
  const names = NAME_KEYS.map((k) => w.tags[k]).filter(Boolean);
  if (!names.length) continue;
  const display = w.tags["name:ru"] || w.tags.name;
  let s = byName.get(display);
  if (!s) byName.set(display, (s = { alts: new Set(), ways: [] }));
  for (const n of names) if (n !== display) s.alts.add(n);
  const pts = w.geometry.map((g) => [r5(g.lat), r5(g.lon)]);
  s.ways.push(pts);
  w.nodes.forEach((id, i) => {
    let m = nodeStreets.get(id);
    if (!m) nodeStreets.set(id, (m = new Map()));
    m.set(display, pts[i]);
  });
}

// Thin each way to points ~60 m apart so a whole street stays a few dozen points.
function thin(pts) {
  const out = [pts[0]];
  let last = pts[0];
  for (const p of pts.slice(1)) {
    const dy = (p[0] - last[0]) * 111320;
    const dx = (p[1] - last[1]) * 111320 * Math.cos((p[0] * Math.PI) / 180);
    if (Math.hypot(dx, dy) >= 60) {
      out.push(p);
      last = p;
    }
  }
  const end = pts[pts.length - 1];
  if (out[out.length - 1] !== end) out.push(end);
  return out;
}

const names = [...byName.keys()].sort((a, b) => a.localeCompare(b, "ru"));
const index = new Map(names.map((n, i) => [n, i]));
const streets = names.map((n) => {
  const s = byName.get(n);
  return { n, a: [...s.alts], p: s.ways.flatMap(thin) };
});

// Crossings: a node shared by ways with different names. Keep one point per street pair per ~80 m.
const seen = new Map();
const x = [];
for (const m of nodeStreets.values()) {
  if (m.size < 2) continue;
  const list = [...m.entries()];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      let a = index.get(list[i][0]);
      let b = index.get(list[j][0]);
      if (a > b) [a, b] = [b, a];
      const [lat, lon] = list[i][1];
      const key = `${a}:${b}`;
      const prev = seen.get(key) ?? [];
      if (prev.some(([la, lo]) => Math.hypot((la - lat) * 111320, (lo - lon) * 78000) < 80)) continue;
      prev.push([lat, lon]);
      seen.set(key, prev);
      x.push([a, b, lat, lon]);
    }
}

writeFileSync(OUT, JSON.stringify({ source: "OpenStreetMap (ODbL)", snapshot: raw.osm3s?.timestamp_osm_base ?? null, streets, x }));
console.log(`streets.json: ${streets.length} streets, ${x.length} crossings`);
