import { NextResponse } from "next/server";
import graphJson from "@/data/city/graph.json";
import { Graph, reachFrom } from "@/lib/city/graph";
import { CATCHMENTS_M, LocationReach } from "@/lib/city/types";

// Walking reach from an arbitrary point, on the OSM walk network built by scripts/build-city.mjs.
const graph = graphJson as unknown as Graph;
const CUTOFF = Math.max(...CATCHMENTS_M);
const MAX_SNAP_M = 400;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "bad_coordinates" }, { status: 400 });
  }
  const r = reachFrom(graph, lat, lon, CUTOFF, [...CATCHMENTS_M]);
  if (!r || r.snap_m > MAX_SNAP_M) {
    return NextResponse.json({ error: "off_network", snap_m: r?.snap_m ?? null }, { status: 422 });
  }
  const body: LocationReach = { lat, lon, snap_m: r.snap_m, cutoff_m: CUTOFF, cells: r.cells, facilities: r.facilities, network: r.network };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
