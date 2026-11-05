// Shared domain types and constants.

export const SLOTS = ["morning", "midday", "evening"] as const;
export type Slot = (typeof SLOTS)[number];

/** Slot windows (local time, Asia/Almaty). Fixed by the methodology. */
export const SLOT_WINDOWS: Record<Slot, { start: string; end: string }> = {
  morning: { start: "08:00", end: "10:00" },
  midday: { start: "12:00", end: "14:00" },
  evening: { start: "17:00", end: "19:00" },
};

export type Mode = "static" | "dynamic";
export type Dataset = "real" | "demo";

export const CATEGORIES = ["all", "grocery", "food", "pharmacy", "health", "finance", "personal"] as const;
export type Category = (typeof CATEGORIES)[number];
export type ServiceCategory = Exclude<Category, "all">;

export const DEFAULT_RADIUS_M = 500;
export const RADIUS_OPTIONS_M = [300, 400, 500, 750, 1000];

/** Freemium test: the slot that is available without Pro. */
export const FREE_SLOT: Slot = "midday";

/** Expected frames per observation: 10 min timelapse at 30 s interval. */
export const EXPECTED_FRAMES = 20;

/** Taldykorgan, approximate city bbox [south, west, north, east]. */
export const CITY_BBOX: [number, number, number, number] = [44.95, 78.28, 45.08, 78.48];
export const CITY_CENTER: [number, number] = [78.3804, 45.0177]; // lon, lat

/** One validated CSV row (one observation session). Aggregated counts only. */
export interface Observation {
  point_id: string;
  point_type: string;
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD
  time_start: string; // HH:MM
  slot: Slot;
  frames: number;
  mean_people_per_frame: number;
  holdout: boolean;
}

export interface Service {
  id: string;
  lat: number;
  lon: number;
  category: ServiceCategory;
  name: string | null;
}

/** An observation point with per-slot aggregated presence. */
export interface Point {
  point_id: string;
  point_type: string;
  lat: number;
  lon: number;
  holdout: boolean;
  /** Registered residents near the point. null = not yet supplied (placeholder). */
  population: number | null;
  slots: Partial<Record<Slot, { mean_people: number; n_obs: number; frames: number; dates: string[] }>>;
}

export interface DataBundle {
  dataset: Dataset;
  points: Point[];
  updated_at: string | null;
}
