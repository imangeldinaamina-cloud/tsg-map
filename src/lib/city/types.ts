// Types and constants for the city analysis workspace (/city).
// Data files are produced by scripts/build-city.mjs from real sources (OSM + WorldPop).

/** Time periods for the temporal model. Windows are labels; the model itself is assumption-driven. */
export const PERIODS = ["morning", "midday", "afternoon", "evening"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_WINDOWS: Record<Period, string> = {
  morning: "08–10",
  midday: "12–14",
  afternoon: "15–17",
  evening: "17–19",
};

/** Service categories for the Service Gap Index. Keep in sync with FACILITY_RULES in scripts/build-city.mjs. */
export const SERVICE_CATS = ["pharmacy", "grocery", "restaurant", "cafe", "education", "healthcare"] as const;
export type ServiceCat = (typeof SERVICE_CATS)[number];

/** OSM tags behind each category (shown in the UI so the definition is transparent). */
export const SERVICE_TAGS: Record<ServiceCat, string> = {
  pharmacy: "amenity=pharmacy, healthcare=pharmacy",
  grocery: "shop=supermarket|convenience|grocery|greengrocer|butcher|dairy|deli|frozen_food",
  restaurant: "amenity=restaurant|fast_food",
  cafe: "amenity=cafe",
  education: "amenity=school|kindergarten|college|university",
  healthcare: "amenity=hospital|clinic|doctors|dentist, healthcare=hospital|clinic|doctor|dentist|centre",
};

/** Attractor types counted per grid cell (order matches GridData.attractors). */
export const ATTRACTORS = ["retail", "food", "office", "education", "health", "market"] as const;
export type Attractor = (typeof ATTRACTORS)[number];

export const CATCHMENTS_M = [400, 800, 1200] as const;
export const DEFAULT_CATCHMENT_M = 800;
export const MAX_CANDIDATES = 4;

export interface Cell {
  r: number;
  c: number;
  lat: number;
  lon: number;
  /** WorldPop 2021 residents summed over the cell (people). */
  pop: number;
  /** Attractor counts, same order as ATTRACTORS. */
  attr: number[];
  /** Straight-line distance from the cell centre to the nearest walk-network node (m). */
  snap: number;
  /** false = no walk-network node within the snap limit, accessibility not computed. */
  net: boolean;
}

export interface GridData {
  cell_m: number;
  origin: [number, number];
  dLat: number;
  dLon: number;
  attractors: string[];
  cells: Cell[];
}

export interface Facility {
  id: string;
  lat: number;
  lon: number;
  cat: ServiceCat;
  name: string | null;
  type: string | null;
  snap: number;
}

export interface AccessData {
  cutoff_m: number;
  method: string;
  /** pairs[facilityIndex] = flat [cellIndex, walkDistanceM, cellIndex, walkDistanceM, ...] */
  pairs: number[][];
}

export interface CityMeta {
  city: string;
  built_at: string;
  boundary: { name: string; osm_id: string; admin_level: string; bbox: [number, number, number, number] };
  grid: { cell_m: number; cells: number };
  datasets: {
    osm: { source: string; endpoint: string | null; osm_base: string | null; extracted_at: string; snapshots?: Record<string, string | null> };
    worldpop: { source: string; url: string; license: string; resolution_m: number; year: number; pixels_in_boundary: number; population_sum: number };
    roads: { ways: number; nodes: number; length_km: number };
    landuse: { polygons: number };
    facilities: Partial<Record<ServiceCat, number>>;
    pois_in_boundary: number;
    access: { cutoff_m: number; max_snap_m: number; pairs: number };
  };
}

/** Response of /api/location: what is reachable on foot from a point. */
export interface LocationReach {
  lat: number;
  lon: number;
  snap_m: number;
  cutoff_m: number;
  /** flat [cellIndex, walkDistanceM, ...] */
  cells: number[];
  /** flat [facilityIndex, walkDistanceM, ...] */
  facilities: number[];
  /** walkable network length (m) and intersections (nodes with ≥3 links) within each catchment */
  network: Record<string, { length_m: number; intersections: number }>;
}
