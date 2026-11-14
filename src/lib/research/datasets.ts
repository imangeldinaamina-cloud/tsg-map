// Data-version manifest: one record per model run / spatial model shown on the site.
// Every value here is copied from a file in the project (path in `evidence`). Fields that no file documents are
// `null` and are shown on the site as "требует подтверждения" — do not fill them in from memory.

export type DatasetId = "v1-osm" | "v2-osm-2gis" | "city-grid-250";

export interface DatasetVersion {
  id: DatasetId;
  /** where the numbers are shown */
  usedIn: string[];
  status: "historical" | "current" | "operational-tool";
  validated: false; // no version has passed an independent validation yet (see H2)
  services: { source: string; extracted: string | null; counts: Record<string, number> | null; hoursKnown: [number, number] | null };
  population: { dataset: string; residentsInGrid: number | null; officialTotal: number | null; officialSource: string | null; officialDate: string | null };
  grid: { type: "hexagon" | "square"; cellArea: string; cells: number; evaluatedCells: Record<string, number> | null };
  agents: { count: string | null; scale: number | null; runs: number | null; workerShare: number | null };
  distance: string;
  hours: string;
  tau: number | null;
  eligibility: string;
  code: string;
  commit: string | null;
  evidence: string[];
}

export const DATASETS: DatasetVersion[] = [
  {
    id: "v1-osm",
    usedIn: ["Научная работа (первая версия)", "Плакат"],
    status: "historical",
    validated: false,
    services: { source: "OpenStreetMap", extracted: null, counts: { food: 91, pharmacy: 44, catering: 241 }, hoursKnown: [28, 376] },
    population: { dataset: "WorldPop", residentsInGrid: null, officialTotal: 171618, officialSource: "БНС РК", officialDate: null },
    grid: { type: "hexagon", cellArea: "0,25 км²", cells: 355, evaluatedCells: null },
    agents: { count: "≈17 тыс.", scale: 10, runs: 100, workerShare: null },
    distance: "Евклидово расстояние (прямая)",
    hours: "Часы OSM, где указаны; иначе стандартные часы категории",
    tau: 0.2,
    eligibility: "Объект категории в радиусе 500 м и max(R, D) ≥ 50 человек",
    code: "research/agent_model/code/tsg_model.py",
    commit: null,
    evidence: ["website_data_v2/compare_versions.csv (v1_первый_расчёт)", "content/research.json → results.recalc"],
  },
  {
    id: "v2-osm-2gis",
    usedIn: ["Страница исследования (разделы 01–05)", "/demo"],
    status: "current",
    validated: false,
    services: { source: "OpenStreetMap + 2ГИС (API)", extracted: "ноябрь 2026", counts: { food: 286, pharmacy: 80, catering: 359 }, hoursKnown: [508, 725] },
    population: { dataset: "WorldPop 2024", residentsInGrid: 137502, officialTotal: 171618, officialSource: "БНС РК", officialDate: null },
    grid: { type: "hexagon", cellArea: "0,25 км²", cells: 355, evaluatedCells: { food: 141, pharmacy: 61, catering: 116 } },
    agents: { count: "≈17 тыс.", scale: 10, runs: 100, workerShare: 0.425 },
    distance: "Евклидово расстояние; квартическое ядро, радиус 500 м; Хафф — зона 1 км, d ≥ 100 м, β = 2",
    hours: "Часы 2ГИС/OSM для 508 из 725 объектов; для остальных — стандартные часы категории (продукты 8–22, аптеки 8–21, общепит 10–23)",
    tau: 0.2,
    eligibility: "Объект категории в радиусе 500 м (S⁰ > 0) и max(R, D) ≥ 50 человек; доли a и b нормируются по всем 355 ячейкам",
    code: "website_data_v2/export_app_2gis.py → research/agent_model/code/export_site_map_v3.py",
    commit: null,
    evidence: ["website_data_v2/summary_v2.json (config, n_objects, n_oh_parsed, coverage)", "public/research/hexmap.json"],
  },
  {
    id: "city-grid-250",
    usedIn: ["Карта /city"],
    status: "operational-tool",
    validated: false,
    services: { source: "OpenStreetMap (Overpass)", extracted: "05.11.2026", counts: { grocery: 85, pharmacy: 44, restaurant: 74, cafe: 170 }, hoursKnown: null },
    population: { dataset: "WorldPop 2021 (constrained, 100 м)", residentsInGrid: 176584, officialTotal: null, officialSource: null, officialDate: null },
    grid: { type: "square", cellArea: "250 × 250 м (0,0625 км²)", cells: 2475, evaluatedCells: null },
    agents: { count: null, scale: null, runs: null, workerShare: null },
    distance: "Пешеходное расстояние по сети улиц OSM (400 / 800 / 1200 м)",
    hours: "Не учитываются",
    tau: null,
    eligibility: "Ячейка связана с пешеходной сетью и в ней есть население",
    code: "scripts/build-city.mjs, src/lib/city/gap.ts",
    commit: null,
    evidence: ["public/data/taldykorgan/meta.json"],
  },
];

export const CURRENT: DatasetId = "v2-osm-2gis";
export const dataset = (id: DatasetId) => DATASETS.find((d) => d.id === id)!;
