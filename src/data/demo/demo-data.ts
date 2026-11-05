/**
 * ⚠️ DEMO DATA — NOT MEASURED. ⚠️
 *
 * Every number in this file is synthetic and exists only to demonstrate the interface
 * before real observations are imported. Point locations are arbitrary positions in
 * Taldykorgan, NOT the real observation points. Never mix this file with real data:
 * it is only loaded when the user selects the "Demo" dataset, and the UI then shows
 * a "DEMO DATA" banner.
 */
import type { DataBundle, Point } from "@/lib/domain";

type DemoRow = [id: string, type: string, lat: number, lon: number, pop: number, m: number, d: number, e: number];

// prettier-ignore
const ROWS: DemoRow[] = [
  ["DEMO-01", "residential", 45.0105, 78.3605, 4200, 6.1, 3.2, 9.4],
  ["DEMO-02", "commercial",  45.0182, 78.3812, 1500, 9.5, 18.3, 14.0],
  ["DEMO-03", "transit",     45.0021, 78.3955, 900, 21.0, 11.2, 24.5],
  ["DEMO-04", "residential", 44.9962, 78.3489, 5100, 4.0, 2.1, 7.8],
  ["DEMO-05", "education",   45.0254, 78.3701, 2600, 15.2, 12.8, 5.1],
  ["DEMO-06", "residential", 45.0301, 78.3920, 3800, 5.3, 2.7, 8.9],
  ["DEMO-07", "commercial",  45.0088, 78.4085, 1200, 7.8, 13.6, 11.2],
  ["DEMO-08", "park",        45.0150, 78.3550, 300, 2.2, 4.8, 12.6],
  ["DEMO-09", "residential", 44.9905, 78.3780, 4700, 3.5, 2.4, 6.9],
  ["DEMO-10", "transit",     45.0205, 78.4010, 700, 17.4, 9.9, 19.8],
];

const points: Point[] = ROWS.map(([point_id, point_type, lat, lon, population, m, d, e], i) => ({
  point_id,
  point_type,
  lat,
  lon,
  holdout: i === 2 || i === 5 || i === 8, // 3 holdout points, mirroring the validation plan
  population,
  slots: {
    morning: { mean_people: m, n_obs: 0, frames: 0, dates: [] },
    midday: { mean_people: d, n_obs: 0, frames: 0, dates: [] },
    evening: { mean_people: e, n_obs: 0, frames: 0, dates: [] },
  },
}));

export const DEMO_BUNDLE: DataBundle = { dataset: "demo", points, updated_at: null };
