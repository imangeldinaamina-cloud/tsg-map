"use client";
import { useEffect, useState } from "react";
import { safeStorage } from "@/lib/client/analytics";
import { TemporalAssumptions, UNSPECIFIED } from "./model";
import { AccessData, CityMeta, Facility, GridData } from "./types";

const BASE = "/data/taldykorgan/";
export type GeoJSON = { type: "FeatureCollection"; features: unknown[] };

export interface CityData {
  meta: CityMeta;
  grid: GridData;
  facilities: Facility[];
  access: AccessData;
  boundary: GeoJSON;
}

let cache: Promise<CityData> | null = null;
export function loadCity(): Promise<CityData> {
  if (!cache) {
    const get = (f: string) =>
      fetch(BASE + f).then((r) => {
        if (!r.ok) throw new Error(`${f}: ${r.status}`);
        return r.json();
      });
    cache = Promise.all(["meta.json", "grid.json", "facilities.json", "access.json", "boundary.json"].map(get))
      .then(([meta, grid, facilities, access, boundary]) => ({ meta, grid, facilities, access, boundary }))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

export function useCityData() {
  const [data, setData] = useState<CityData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadCity().then(setData).catch(() => setError(true));
  }, []);
  return { data, error };
}

/** Large optional layers, fetched only when switched on. */
export function fetchLayer(name: "roads" | "landuse"): Promise<GeoJSON> {
  return fetch(`${BASE}${name}.json`).then((r) => r.json());
}

// ---------- user assumptions & uploaded population (this browser only) ----------
const A_KEY = "tsg_city_assumptions";
const U_KEY = "tsg_city_population_upload";

export function loadAssumptions(): TemporalAssumptions {
  try {
    const raw = safeStorage().get(A_KEY);
    if (!raw) return UNSPECIFIED;
    const a = JSON.parse(raw);
    return { ...UNSPECIFIED, ...a, stay: { ...UNSPECIFIED.stay, ...a.stay }, weights: { ...UNSPECIFIED.weights, ...a.weights } };
  } catch {
    return UNSPECIFIED;
  }
}
export function saveAssumptions(a: TemporalAssumptions) {
  safeStorage().set(A_KEY, JSON.stringify(a));
}

export interface PopulationUpload {
  name: string;
  uploaded_at: string;
  /** population per grid cell index (same order as grid.cells) */
  values: number[];
}
export function loadUpload(): PopulationUpload | null {
  try {
    const raw = safeStorage().get(U_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveUpload(u: PopulationUpload | null) {
  if (u) safeStorage().set(U_KEY, JSON.stringify(u));
  else safeStorage().remove(U_KEY);
}

/** Grid cell index containing a point, or null. */
export function cellIndexAt(grid: GridData, lookup: Map<string, number>, lat: number, lon: number): number | null {
  const r = Math.floor((lat - grid.origin[1]) / grid.dLat);
  const c = Math.floor((lon - grid.origin[0]) / grid.dLon);
  return lookup.get(`${r}:${c}`) ?? null;
}
