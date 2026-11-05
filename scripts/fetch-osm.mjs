// Extracts service POIs for Taldykorgan from OpenStreetMap via the Overpass API.
// Usage: node scripts/fetch-osm.mjs
// Output: src/data/osm/services.json (real OSM data, with extraction timestamp).
import { writeFileSync } from "node:fs";

// south, west, north, east — covers Taldykorgan city with a margin.
const BBOX = [44.95, 78.28, 45.08, 78.48];
const ENDPOINT = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Category mapping: OSM tag -> TSG Map category. Keep in sync with src/lib/categories.ts
const RULES = [
  ["grocery", "shop", ["supermarket", "convenience", "grocery", "greengrocer", "bakery", "butcher", "deli"]],
  ["food", "amenity", ["cafe", "restaurant", "fast_food"]],
  ["pharmacy", "amenity", ["pharmacy"]],
  ["health", "amenity", ["clinic", "doctors", "hospital", "dentist"]],
  ["finance", "amenity", ["bank", "atm"]],
  ["personal", "shop", ["hairdresser", "beauty", "laundry", "dry_cleaning"]],
];

const b = BBOX.join(",");
const parts = RULES.map(([, key, vals]) => `nwr["${key}"~"^(${vals.join("|")})$"](${b});`).join("\n");
const query = `[out:json][timeout:90];\n(\n${parts}\n);\nout center tags;`;

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "tsg-map-osm-extract/0.1" },
  body: "data=" + encodeURIComponent(query),
});
if (!res.ok) {
  console.error("Overpass error", res.status, await res.text());
  process.exit(1);
}
const json = await res.json();

function categorize(tags) {
  for (const [cat, key, vals] of RULES) if (tags[key] && vals.includes(tags[key])) return cat;
  return null;
}

const services = [];
for (const el of json.elements) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const category = categorize(el.tags || {});
  if (lat == null || lon == null || !category) continue;
  services.push({
    id: `${el.type}/${el.id}`,
    lat: +lat.toFixed(6),
    lon: +lon.toFixed(6),
    category,
    name: el.tags?.name ?? null,
  });
}

const out = {
  source: "OpenStreetMap contributors (ODbL), via Overpass API",
  endpoint: ENDPOINT,
  extracted_at: new Date().toISOString(),
  osm_base: json.osm3s?.timestamp_osm_base ?? null,
  bbox: BBOX,
  count: services.length,
  services,
};
writeFileSync(new URL("../src/data/osm/services.json", import.meta.url), JSON.stringify(out, null, 1));
const byCat = services.reduce((a, s) => ((a[s.category] = (a[s.category] || 0) + 1), a), {});
console.log("Saved", services.length, "services", byCat);
