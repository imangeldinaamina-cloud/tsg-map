// Walking-network routines (pure functions, used by /api/location and tests).

export interface Graph {
  lat: number[];
  lon: number[];
  /** CSR adjacency: neighbours of u are targets[offsets[u] .. offsets[u+1]) */
  offsets: number[];
  targets: number[];
  weights: number[];
  cellNode: number[];
  cellSnap: number[];
  facNode: number[];
  facSnap: number[];
}

const R_EARTH = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

export function nearestNode(g: Graph, lat: number, lon: number): [number, number] {
  let best = -1, bestD = Infinity;
  // Cheap prefilter in degrees before the exact distance.
  for (let i = 0; i < g.lat.length; i++) {
    const dl = Math.abs(g.lat[i] - lat);
    if (dl > 0.02) continue;
    const d = haversine(lat, lon, g.lat[i], g.lon[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return [best, bestD];
}

/** Single-source shortest paths with a distance cutoff (binary heap Dijkstra). */
export function dijkstra(g: Graph, src: number, cutoff: number): Map<number, number> {
  const dist = new Map<number, number>([[src, 0]]);
  const keys: number[] = [0];
  const vals: number[] = [src];
  const swap = (a: number, b: number) => {
    [keys[a], keys[b]] = [keys[b], keys[a]];
    [vals[a], vals[b]] = [vals[b], vals[a]];
  };
  while (keys.length) {
    const d = keys[0], u = vals[0];
    const lk = keys.pop()!, lv = vals.pop()!;
    if (keys.length) {
      keys[0] = lk; vals[0] = lv;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < keys.length && keys[l] < keys[m]) m = l;
        if (r < keys.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        swap(m, i);
        i = m;
      }
    }
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (let e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
      const v = g.targets[e], nd = d + g.weights[e];
      if (nd <= cutoff && nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        keys.push(nd); vals.push(v);
        for (let i = keys.length - 1; i > 0; ) {
          const p = (i - 1) >> 1;
          if (keys[p] <= keys[i]) break;
          swap(p, i);
          i = p;
        }
      }
    }
  }
  return dist;
}

/** Everything reachable on foot within `cutoff` metres from a point. */
export function reachFrom(g: Graph, lat: number, lon: number, cutoff: number, radii: number[]) {
  const [node, snap] = nearestNode(g, lat, lon);
  if (node < 0) return null;
  const dist = dijkstra(g, node, Math.max(0, cutoff - snap));
  const byNode = (nodes: number[], snaps: number[]) => {
    const out: number[] = [];
    nodes.forEach((n, i) => {
      if (n < 0) return;
      const d = dist.get(n);
      if (d === undefined) return;
      const total = snap + d + snaps[i];
      if (total <= cutoff) out.push(i, Math.round(total));
    });
    return out;
  };
  const network: Record<string, { length_m: number; intersections: number }> = {};
  for (const R of radii) {
    let len = 0, inter = 0;
    for (const [u, du] of dist) {
      if (snap + du > R) continue;
      const deg = g.offsets[u + 1] - g.offsets[u];
      if (deg >= 3) inter++;
      for (let e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
        const dv = dist.get(g.targets[e]);
        if (dv !== undefined && snap + dv <= R) len += g.weights[e] / 2; // each undirected edge seen twice
      }
    }
    network[R] = { length_m: Math.round(len), intersections: inter };
  }
  return { snap_m: Math.round(snap), node, cells: byNode(g.cellNode, g.cellSnap), facilities: byNode(g.facNode, g.facSnap), network };
}
