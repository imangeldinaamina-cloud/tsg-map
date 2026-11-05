// Builds the Taldykorgan analytical datasets from real sources.
//
//   node scripts/build-city.mjs            # uses cached raw downloads in ./data-raw when present
//   node scripts/build-city.mjs --refresh  # re-downloads OpenStreetMap data
//
// Inputs (all real, nothing synthetic):
//   - OpenStreetMap via Overpass API: administrative boundary, walkable ways, landuse, POIs.
//   - WorldPop R2025A constrained 100 m population, Kazakhstan, 2021
//     (download URL below; saved to ./data-raw, which is gitignored).
//
// Outputs:
//   public/data/taldykorgan/{meta,boundary,roads,landuse,facilities,grid,access}.json — served to the browser.
//   src/data/city/graph.json — walking network used by the /api/location route.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fromFile } from "geotiff";

const REFRESH = process.argv.includes("--refresh");
const RAW = new URL("../data-raw/", import.meta.url);
const OUT = new URL("../public/data/taldykorgan/", import.meta.url);
const GRAPH_OUT = new URL("../src/data/city/graph.json", import.meta.url);
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(new URL("../src/data/city/", import.meta.url), { recursive: true });

const BOUNDARY_REL = 3392135; // "Талдықорған қалалық әкімдігі" (city akimat), admin_level 6
const WORLDPOP_URL =
  "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2021/KAZ/v1/100m/constrained/kaz_pop_2021_CN_100m_R2025A_v1.tif";
const WORLDPOP_FILE = new URL("kaz_pop_2021_CN_100m_R2025A_v1.tif", RAW);
const CELL_M = 250; // analytical grid cell size
const CUTOFF_M = 1200; // longest walking catchment the app offers
const MAX_SNAP_M = 400; // a cell/facility farther than this from the walk network is "not connected"

const ENDPOINTS = [
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter(Boolean);

// ---------------------------------------------------------------- helpers
const R_EARTH = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function hav(lat1, lon1, lat2, lon2) {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const r6 = (x) => Math.round(x * 1e6) / 1e6;

// Uses curl: Node's fetch fails against some Overpass mirrors from this network.
function curlPost(url, body, timeoutS) {
  const out = execFileSync(
    "curl",
    ["-sS", "--fail", "-m", String(timeoutS), "-A", "tsg-map-pipeline/0.2 (research prototype)", "--data-urlencode", `data@-`, url],
    { input: body, maxBuffer: 1 << 30 },
  );
  return JSON.parse(out.toString("utf8"));
}

async function overpass(name, query) {
  const file = new URL(`osm-${name}.json`, RAW);
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  for (const ep of ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const json = curlPost(ep, query, 300);
        json._endpoint = ep;
        writeFileSync(file, JSON.stringify(json));
        console.log(`  ${name}: ${json.elements.length} elements from ${ep}`);
        return json;
      } catch (e) {
        console.warn(`  ${name}: ${ep} failed (${String(e.message).split("\n")[0].slice(0, 120)}), retrying…`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  throw new Error(`Overpass failed for ${name}`);
}

/** Joins way geometries into closed rings ([lon,lat][]). */
function assembleRings(segments) {
  const key = (p) => `${p[0]},${p[1]}`;
  const pool = segments.filter((s) => s.length > 1).map((s) => s.slice());
  const rings = [];
  while (pool.length) {
    let ring = pool.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 10000) {
      const end = key(ring[ring.length - 1]);
      const i = pool.findIndex((s) => key(s[0]) === end || key(s[s.length - 1]) === end);
      if (i < 0) break;
      const s = pool.splice(i, 1)[0];
      ring = ring.concat((key(s[0]) === end ? s : s.slice().reverse()).slice(1));
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

/** Even-odd point-in-polygon over all rings (handles holes). */
function inRings(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

class MinHeap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.k.length;
  }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v;
    const top = [k[0], v[0]];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------- 1. boundary
console.log("1/6 boundary");
const bRaw = await overpass("boundary", `[out:json][timeout:120];rel(${BOUNDARY_REL});out geom;`);
const bRel = bRaw.elements.find((e) => e.type === "relation");
const outer = assembleRings(bRel.members.filter((m) => m.type === "way" && m.role !== "inner").map((m) => m.geometry.map((g) => [g.lon, g.lat])));
const inner = assembleRings(bRel.members.filter((m) => m.type === "way" && m.role === "inner").map((m) => m.geometry.map((g) => [g.lon, g.lat])));
const boundaryRings = [...outer, ...inner];
let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
for (const ring of outer) for (const [lon, lat] of ring) {
  minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
}
const bbox = [minLon, minLat, maxLon, maxLat];
console.log(`  outer rings ${outer.length}, inner ${inner.length}, bbox ${bbox.map((x) => x.toFixed(3)).join(",")}`);
writeFileSync(
  new URL("boundary.json", OUT),
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: bRel.tags.name, name_ru: bRel.tags["name:ru"] ?? null, admin_level: bRel.tags.admin_level, osm_id: `relation/${BOUNDARY_REL}` },
        geometry: { type: "MultiPolygon", coordinates: outer.map((o) => [o.map(([x, y]) => [r5(x), r5(y)]), ...(outer.length === 1 ? inner.map((h) => h.map(([x, y]) => [r5(x), r5(y)])) : [])]) },
      },
    ],
  }),
);

const AREA = `rel(${BOUNDARY_REL});map_to_area->.a;`;
// Lighter bbox filter for landuse/POIs (area queries time out on public mirrors); POIs are clipped to the boundary below.
const BB = `${minLat},${minLon},${maxLat},${maxLon}`;

// ---------------------------------------------------------------- 2. walkable ways -> roads layer + graph
console.log("2/6 walking network");
const WALK_HW = "primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|pedestrian|footway|path|steps|track|cycleway|trunk|trunk_link|road|corridor";
const roadsRaw = await overpass(
  "roads",
  `[out:json][timeout:180];${AREA}way["highway"~"^(${WALK_HW})$"]["area"!="yes"]["foot"!="no"]["access"!="private"](area.a);out geom;`,
);
const ROAD_CLASS = (hw) =>
  /^(trunk|primary|secondary)/.test(hw) ? "major" : /^(tertiary|unclassified|residential|living_street|road)/.test(hw) ? "street" : /^(footway|path|steps|pedestrian|cycleway|corridor)/.test(hw) ? "path" : "service";

const nodeIndex = new Map();
const nodeLat = [], nodeLon = [];
const edges = []; // [a, b, length]
const roadFeatures = [];
for (const w of roadsRaw.elements) {
  if (w.type !== "way" || !w.nodes || !w.geometry) continue;
  const coords = w.geometry.map((g) => [r5(g.lon), r5(g.lat)]);
  roadFeatures.push({ type: "Feature", properties: { c: ROAD_CLASS(w.tags.highway) }, geometry: { type: "LineString", coordinates: coords } });
  let prev = -1;
  for (let i = 0; i < w.nodes.length; i++) {
    const id = w.nodes[i];
    let idx = nodeIndex.get(id);
    if (idx === undefined) {
      idx = nodeLat.length;
      nodeIndex.set(id, idx);
      nodeLat.push(w.geometry[i].lat);
      nodeLon.push(w.geometry[i].lon);
    }
    if (prev >= 0 && prev !== idx) edges.push([prev, idx, hav(nodeLat[prev], nodeLon[prev], nodeLat[idx], nodeLon[idx])]);
    prev = idx;
  }
}
writeFileSync(new URL("roads.json", OUT), JSON.stringify({ type: "FeatureCollection", features: roadFeatures }));

// adjacency + largest connected component
let N = nodeLat.length;
let adj = Array.from({ length: N }, () => []);
for (const [a, b, l] of edges) {
  adj[a].push([b, l]);
  adj[b].push([a, l]);
}
const comp = new Int32Array(N).fill(-1);
let best = -1, bestSize = 0;
for (let s = 0, c = 0; s < N; s++) {
  if (comp[s] >= 0) continue;
  const stack = [s];
  comp[s] = c;
  let size = 0;
  while (stack.length) {
    const u = stack.pop();
    size++;
    for (const [v] of adj[u]) if (comp[v] < 0) { comp[v] = c; stack.push(v); }
  }
  if (size > bestSize) { bestSize = size; best = c; }
  c++;
}
const remap = new Int32Array(N).fill(-1);
const gLat = [], gLon = [];
for (let i = 0; i < N; i++) if (comp[i] === best) { remap[i] = gLat.length; gLat.push(nodeLat[i]); gLon.push(nodeLon[i]); }
const G = gLat.length;
const offsets = new Int32Array(G + 1);
const tmpAdj = Array.from({ length: G }, () => []);
let totalLenM = 0;
for (const [a, b, l] of edges) {
  const A = remap[a], B = remap[b];
  if (A < 0 || B < 0) continue;
  tmpAdj[A].push([B, l]);
  tmpAdj[B].push([A, l]);
  totalLenM += l;
}
const targets = [], weights = [];
for (let i = 0; i < G; i++) {
  offsets[i] = targets.length;
  for (const [b, l] of tmpAdj[i]) { targets.push(b); weights.push(Math.round(l * 10) / 10); }
}
offsets[G] = targets.length;
adj = null;
console.log(`  ${roadFeatures.length} ways, ${N} nodes, largest component ${G} nodes, ${(totalLenM / 1000).toFixed(0)} km`);

// spatial bucket index on graph nodes
const BUCKET = 0.002;
const buckets = new Map();
const bkey = (la, lo) => `${Math.floor(la / BUCKET)}:${Math.floor(lo / BUCKET)}`;
for (let i = 0; i < G; i++) {
  const k = bkey(gLat[i], gLon[i]);
  (buckets.get(k) ?? buckets.set(k, []).get(k)).push(i);
}
function nearestNode(lat, lon) {
  const bi = Math.floor(lat / BUCKET), bj = Math.floor(lon / BUCKET);
  let bestI = -1, bestD = Infinity;
  for (let ring = 0; ring <= 4; ring++) {
    for (let di = -ring; di <= ring; di++)
      for (let dj = -ring; dj <= ring; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        for (const i of buckets.get(`${bi + di}:${bj + dj}`) ?? []) {
          const d = hav(lat, lon, gLat[i], gLon[i]);
          if (d < bestD) { bestD = d; bestI = i; }
        }
      }
    if (bestI >= 0 && bestD < ring * BUCKET * 78000) break; // ~ring width in metres at 45°N (lon side)
  }
  return [bestI, bestD];
}

function dijkstra(src, cutoff) {
  const dist = new Map([[src, 0]]);
  const h = new MinHeap();
  h.push(0, src);
  while (h.size) {
    const [d, u] = h.pop();
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (let e = offsets[u]; e < offsets[u + 1]; e++) {
      const v = targets[e], nd = d + weights[e];
      if (nd <= cutoff && nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); h.push(nd, v); }
    }
  }
  return dist;
}

// ---------------------------------------------------------------- 3. landuse
console.log("3/6 landuse");
const luRaw = await overpass("landuse", `[out:json][timeout:180];(way["landuse"~"^(residential|commercial|retail|industrial)$"](${BB});rel["landuse"~"^(residential|commercial|retail|industrial)$"](${BB}););out geom;`);
const luFeatures = [];
for (const el of luRaw.elements) {
  const cls = el.tags?.landuse;
  if (el.type === "way" && el.geometry) {
    const ring = el.geometry.map((g) => [r5(g.lon), r5(g.lat)]);
    if (ring.length >= 4) luFeatures.push({ type: "Feature", properties: { c: cls }, geometry: { type: "Polygon", coordinates: [ring] } });
  } else if (el.type === "relation") {
    const outs = assembleRings(el.members.filter((m) => m.type === "way" && m.role !== "inner" && m.geometry).map((m) => m.geometry.map((g) => [r5(g.lon), r5(g.lat)])));
    for (const o of outs) luFeatures.push({ type: "Feature", properties: { c: cls }, geometry: { type: "Polygon", coordinates: [o] } });
  }
}
writeFileSync(new URL("landuse.json", OUT), JSON.stringify({ type: "FeatureCollection", features: luFeatures }));
console.log(`  ${luFeatures.length} polygons`);

// ---------------------------------------------------------------- 4. POIs -> facilities + attractors
console.log("4/6 points of interest");
const poiRaw = await overpass("pois", `[out:json][timeout:180];(nwr["shop"](${BB});nwr["amenity"](${BB});nwr["office"](${BB});nwr["healthcare"](${BB}););out center tags;`);

/** Service categories used by the Service Gap Index. Keep in sync with src/lib/city/types.ts */
const FACILITY_RULES = {
  pharmacy: (t) => t.amenity === "pharmacy" || t.healthcare === "pharmacy",
  grocery: (t) => ["supermarket", "convenience", "grocery", "greengrocer", "butcher", "dairy", "deli", "frozen_food"].includes(t.shop),
  restaurant: (t) => ["restaurant", "fast_food"].includes(t.amenity),
  cafe: (t) => t.amenity === "cafe",
  education: (t) => ["school", "kindergarten", "college", "university"].includes(t.amenity),
  healthcare: (t) =>
    ["hospital", "clinic", "doctors", "dentist"].includes(t.amenity) || ["hospital", "clinic", "doctor", "dentist", "centre"].includes(t.healthcare),
};
/** Attractor types counted per cell (inputs to the optional temporal redistribution). */
const ATTRACTOR_RULES = {
  retail: (t) => !!t.shop,
  food: (t) => ["restaurant", "fast_food", "cafe", "bar", "pub"].includes(t.amenity),
  office: (t) => !!t.office || ["townhall", "courthouse", "bank", "post_office", "police"].includes(t.amenity),
  education: (t) => ["school", "college", "university", "kindergarten"].includes(t.amenity),
  health: (t) => ["hospital", "clinic", "doctors", "dentist"].includes(t.amenity),
  market: (t) => t.amenity === "marketplace" || t.shop === "mall",
};
const ATTR_KEYS = Object.keys(ATTRACTOR_RULES);

const pois = [];
const seen = new Set();
for (const el of poiRaw.elements) {
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  const id = `${el.type}/${el.id}`;
  if (lat == null || lon == null || seen.has(id)) continue;
  if (!inRings(lon, lat, boundaryRings)) continue;
  seen.add(id);
  pois.push({ id, lat, lon, tags: el.tags ?? {} });
}
const facilities = [];
for (const p of pois) {
  for (const [cat, rule] of Object.entries(FACILITY_RULES)) {
    if (!rule(p.tags)) continue;
    const [node, snap] = nearestNode(p.lat, p.lon);
    facilities.push({
      id: p.id,
      lat: r6(p.lat),
      lon: r6(p.lon),
      cat,
      name: p.tags.name ?? p.tags["name:ru"] ?? p.tags["name:kk"] ?? null,
      type: p.tags.amenity ?? p.tags.shop ?? p.tags.healthcare ?? null,
      node: snap <= MAX_SNAP_M ? node : -1,
      snap: Math.round(snap),
    });
    break; // one category per POI
  }
}
const facCounts = facilities.reduce((a, f) => ((a[f.cat] = (a[f.cat] || 0) + 1), a), {});
console.log(`  ${pois.length} POIs in boundary, facilities`, facCounts);

// ---------------------------------------------------------------- 5. WorldPop -> grid
console.log("5/6 WorldPop grid");
if (!existsSync(WORLDPOP_FILE)) {
  console.log("  downloading", WORLDPOP_URL);
  const res = await fetch(WORLDPOP_URL);
  if (!res.ok) throw new Error("WorldPop download failed " + res.status);
  writeFileSync(WORLDPOP_FILE, Buffer.from(await res.arrayBuffer()));
}
const tiff = await fromFile(WORLDPOP_FILE.pathname);
const img = await tiff.getImage();
const [ox, oy] = img.getOrigin();
const [rx, ry] = img.getResolution(); // ry < 0
const nodata = img.getGDALNoData();
const x0 = Math.floor((minLon - ox) / rx), x1 = Math.ceil((maxLon - ox) / rx);
const y0 = Math.floor((maxLat - oy) / ry), y1 = Math.ceil((minLat - oy) / ry);
const [band] = await img.readRasters({ window: [x0, y0, x1, y1] });
const W = x1 - x0;

const lat0 = (minLat + maxLat) / 2;
const dLat = CELL_M / 111320;
const dLon = CELL_M / (111320 * Math.cos(rad(lat0)));
const nCols = Math.ceil((maxLon - minLon) / dLon);
const cells = new Map(); // key = row*nCols+col
const cellOf = (lat, lon) => {
  const r = Math.floor((lat - minLat) / dLat), c = Math.floor((lon - minLon) / dLon);
  const k = r * nCols + c;
  if (!cells.has(k)) cells.set(k, { r, c, pop: 0, px: 0, attr: Object.fromEntries(ATTR_KEYS.map((a) => [a, 0])) });
  return cells.get(k);
};
let popTotal = 0, pxCount = 0;
for (let j = 0; j < y1 - y0; j++) {
  const lat = oy + (y0 + j + 0.5) * ry;
  for (let i = 0; i < W; i++) {
    const v = band[j * W + i];
    if (!(v > 0) || v === nodata) continue;
    const lon = ox + (x0 + i + 0.5) * rx;
    if (!inRings(lon, lat, boundaryRings)) continue;
    const cell = cellOf(lat, lon);
    cell.pop += v;
    cell.px++;
    popTotal += v;
    pxCount++;
  }
}
for (const p of pois) for (const [a, rule] of Object.entries(ATTRACTOR_RULES)) if (rule(p.tags)) cellOf(p.lat, p.lon).attr[a]++;
for (const f of facilities) cellOf(f.lat, f.lon); // make sure every facility sits in a cell

const grid = [...cells.values()]
  .map((c) => {
    const lat = minLat + (c.r + 0.5) * dLat, lon = minLon + (c.c + 0.5) * dLon;
    const [node, snap] = nearestNode(lat, lon);
    return { r: c.r, c: c.c, lat: r6(lat), lon: r6(lon), pop: Math.round(c.pop * 10) / 10, attr: ATTR_KEYS.map((a) => c.attr[a]), node: snap <= MAX_SNAP_M ? node : -1, snap: Math.round(snap) };
  })
  .sort((a, b) => a.r - b.r || a.c - b.c);
console.log(`  ${pxCount} populated pixels, population sum ${Math.round(popTotal)}, ${grid.length} cells`);

// ---------------------------------------------------------------- 6. walking access: facility -> cells within CUTOFF_M
console.log("6/6 walking access");
const cellsByNode = new Map();
grid.forEach((g, i) => { if (g.node >= 0) (cellsByNode.get(g.node) ?? cellsByNode.set(g.node, []).get(g.node)).push(i); });
const access = facilities.map((f) => {
  if (f.node < 0) return [];
  const dist = dijkstra(f.node, CUTOFF_M - f.snap);
  const out = [];
  for (const [n, d] of dist) for (const ci of cellsByNode.get(n) ?? []) {
    const total = f.snap + d + grid[ci].snap;
    if (total <= CUTOFF_M) out.push(ci, Math.round(total));
  }
  return out;
});
const pairs = access.reduce((s, a) => s + a.length / 2, 0);
console.log(`  ${pairs} facility-cell pairs within ${CUTOFF_M} m`);

// ---------------------------------------------------------------- write
const now = new Date().toISOString();
const osmBase = bRaw.osm3s?.timestamp_osm_base ?? null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
writeFileSync(new URL("facilities.json", OUT), JSON.stringify(facilities.map(({ node, ...f }) => f)));
writeFileSync(
  new URL("grid.json", OUT),
  JSON.stringify({ cell_m: CELL_M, origin: [r6(minLon), r6(minLat)], dLat, dLon, attractors: ATTR_KEYS, cells: grid.map(({ node, ...c }) => ({ ...c, net: node >= 0 })) }),
);
writeFileSync(new URL("access.json", OUT), JSON.stringify({ cutoff_m: CUTOFF_M, method: "network shortest path (Dijkstra) on OSM walkable ways + straight-line snap to the nearest network node", pairs: access }));
writeFileSync(
  GRAPH_OUT,
  JSON.stringify({
    lat: gLat.map(r6),
    lon: gLon.map(r6),
    offsets: Array.from(offsets),
    targets,
    weights,
    cellNode: grid.map((g) => g.node),
    cellSnap: grid.map((g) => g.snap),
    facNode: facilities.map((f) => f.node),
    facSnap: facilities.map((f) => f.snap),
  }),
);
const meta = {
  city: "Taldykorgan",
  built_at: now,
  boundary: { name: bRel.tags.name, osm_id: `relation/${BOUNDARY_REL}`, admin_level: bRel.tags.admin_level, bbox },
  grid: { cell_m: CELL_M, cells: grid.length },
  datasets: {
    osm: {
      source: "OpenStreetMap contributors (ODbL)",
      endpoint: bRaw._endpoint ?? null,
      osm_base: osmBase,
      extracted_at: now,
      snapshots: { boundary: osmBase, roads: roadsRaw.osm3s?.timestamp_osm_base ?? null, landuse: luRaw.osm3s?.timestamp_osm_base ?? null, pois: poiRaw.osm3s?.timestamp_osm_base ?? null },
    },
    worldpop: {
      source: "WorldPop Global2 R2025A, constrained, 100 m, Kazakhstan, 2021",
      url: WORLDPOP_URL,
      license: "CC BY 4.0",
      resolution_m: 100,
      year: 2021,
      pixels_in_boundary: pxCount,
      population_sum: Math.round(popTotal),
    },
    roads: { ways: roadFeatures.length, nodes: G, length_km: Math.round(totalLenM / 1000) },
    landuse: { polygons: luFeatures.length },
    facilities: facCounts,
    pois_in_boundary: pois.length,
    access: { cutoff_m: CUTOFF_M, max_snap_m: MAX_SNAP_M, pairs },
  },
};
writeFileSync(new URL("meta.json", OUT), JSON.stringify(meta, null, 1));
console.log("done");
