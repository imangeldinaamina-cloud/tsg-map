import Papa from "papaparse";
import { CITY_BBOX, EXPECTED_FRAMES, Observation, SLOTS, SLOT_WINDOWS, Slot } from "./domain";

export const REQUIRED_COLUMNS = [
  "point_id",
  "point_type",
  "lat",
  "lon",
  "date",
  "time_start",
  "slot",
  "frames",
  "mean_people_per_frame",
  "holdout",
] as const;

/** Issue codes are translated in the UI (i18n key `import.issue.<code>`). */
export type IssueCode =
  | "empty_file"
  | "missing_column"
  | "unknown_column"
  | "parse_error"
  | "required"
  | "not_number"
  | "lat_range"
  | "lon_range"
  | "outside_city"
  | "bad_date"
  | "weekend"
  | "bad_time"
  | "time_outside_slot"
  | "bad_slot"
  | "bad_frames"
  | "frames_unexpected"
  | "negative_people"
  | "bad_holdout"
  | "duplicate"
  | "inconsistent_location"
  | "inconsistent_holdout"
  | "too_long";

export interface Issue {
  /** 1-based line number in the file (header = line 1). 0 = whole file. */
  line: number;
  column?: string;
  code: IssueCode;
  value?: string;
}

export interface ImportResult {
  rows: Observation[];
  errors: Issue[];
  warnings: Issue[];
  totalLines: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", "."); // tolerate decimal comma (common in RU locales)
  if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function isValidDate(s: string) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Approx. distance in metres between two lat/lon points (equirectangular, fine at city scale). */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const x = ((lon2 - lon1) * Math.PI) / 180 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}

/**
 * Parse and validate an observations CSV. Pure function — no I/O.
 * Rows with any error are excluded from `rows`; warnings do not block import.
 */
export function parseObservationsCsv(text: string): ImportResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const rows: Observation[] = [];

  const clean = text.replace(/^\uFEFF/, ""); // strip BOM (Excel)
  if (clean.trim() === "") {
    return { rows, errors: [{ line: 0, code: "empty_file" }], warnings, totalLines: 0 };
  }

  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = (parsed.meta.fields ?? []).filter((h) => h !== "");
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) errors.push({ line: 1, column: col, code: "missing_column" });
  }
  for (const h of headers) {
    if (!(REQUIRED_COLUMNS as readonly string[]).includes(h)) warnings.push({ line: 1, column: h, code: "unknown_column" });
  }
  if (errors.length) return { rows, errors, warnings, totalLines: parsed.data.length + 1 };

  for (const e of parsed.errors) {
    if (e.code === "UndetectableDelimiter") continue;
    errors.push({ line: (e.row ?? 0) + 2, code: "parse_error", value: e.message });
  }

  const seen = new Map<string, number>();
  const pointMeta = new Map<string, { lat: number; lon: number; holdout: boolean; line: number }>();
  const [south, west, north, east] = CITY_BBOX;

  parsed.data.forEach((raw, idx) => {
    const line = idx + 2;
    const rowErrors: Issue[] = [];
    const get = (c: string) => (raw[c] ?? "").trim();
    const err = (column: string, code: IssueCode, value?: string) => rowErrors.push({ line, column, code, value });
    const warn = (column: string, code: IssueCode, value?: string) => warnings.push({ line, column, code, value });

    for (const col of REQUIRED_COLUMNS) if (get(col) === "") err(col, "required");

    const point_id = get("point_id");
    const point_type = get("point_type");
    if (point_id.length > 64) err("point_id", "too_long", point_id);
    if (point_type.length > 64) err("point_type", "too_long", point_type);

    const lat = parseNumber(get("lat"));
    const lon = parseNumber(get("lon"));
    if (get("lat") !== "" && lat === null) err("lat", "not_number", get("lat"));
    if (get("lon") !== "" && lon === null) err("lon", "not_number", get("lon"));
    if (lat !== null && (lat < -90 || lat > 90)) err("lat", "lat_range", get("lat"));
    if (lon !== null && (lon < -180 || lon > 180)) err("lon", "lon_range", get("lon"));
    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      if (lat < south || lat > north || lon < west || lon > east) warn("lat", "outside_city", `${lat}, ${lon}`);
    }

    const date = get("date");
    if (date !== "" && !isValidDate(date)) err("date", "bad_date", date);
    else if (date !== "") {
      const dow = new Date(date + "T00:00:00Z").getUTCDay();
      if (dow === 0 || dow === 6) warn("date", "weekend", date);
    }

    const slotRaw = get("slot").toLowerCase();
    const slot = (SLOTS as readonly string[]).includes(slotRaw) ? (slotRaw as Slot) : null;
    if (slotRaw !== "" && !slot) err("slot", "bad_slot", get("slot"));

    let time_start = get("time_start");
    if (/^\d:\d{2}$/.test(time_start)) time_start = "0" + time_start; // 8:30 -> 08:30
    if (/^\d{2}:\d{2}:\d{2}$/.test(time_start)) time_start = time_start.slice(0, 5); // 08:30:00 -> 08:30
    if (time_start !== "" && !TIME_RE.test(time_start)) err("time_start", "bad_time", get("time_start"));
    else if (time_start !== "" && slot) {
      const w = SLOT_WINDOWS[slot];
      const t = toMinutes(time_start);
      if (t < toMinutes(w.start) || t > toMinutes(w.end)) warn("time_start", "time_outside_slot", `${time_start} / ${slot}`);
    }

    const frames = parseNumber(get("frames"));
    if (get("frames") !== "" && (frames === null || !Number.isInteger(frames) || frames <= 0)) {
      err("frames", "bad_frames", get("frames"));
    } else if (frames !== null && frames !== EXPECTED_FRAMES) {
      warn("frames", "frames_unexpected", String(frames));
    }

    const people = parseNumber(get("mean_people_per_frame"));
    if (get("mean_people_per_frame") !== "" && people === null) err("mean_people_per_frame", "not_number", get("mean_people_per_frame"));
    if (people !== null && people < 0) err("mean_people_per_frame", "negative_people", get("mean_people_per_frame"));

    const holdoutRaw = get("holdout").toLowerCase();
    const holdout = holdoutRaw === "yes" ? true : holdoutRaw === "no" ? false : null;
    if (holdoutRaw !== "" && holdout === null) err("holdout", "bad_holdout", get("holdout"));

    if (point_id && date && slot) {
      const key = `${point_id}|${date}|${slot}`;
      if (seen.has(key)) err("point_id", "duplicate", `${point_id} ${date} ${slot} (line ${seen.get(key)})`);
      else seen.set(key, line);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    const prev = pointMeta.get(point_id);
    if (prev) {
      if (distanceM(prev.lat, prev.lon, lat!, lon!) > 50) warn("lat", "inconsistent_location", `${point_id} (line ${prev.line})`);
      if (prev.holdout !== holdout) warn("holdout", "inconsistent_holdout", `${point_id} (line ${prev.line})`);
    } else {
      pointMeta.set(point_id, { lat: lat!, lon: lon!, holdout: holdout!, line });
    }

    rows.push({
      point_id,
      point_type,
      lat: lat!,
      lon: lon!,
      date,
      time_start,
      slot: slot!,
      frames: frames!,
      mean_people_per_frame: people!,
      holdout: holdout!,
    });
  });

  return { rows, errors, warnings, totalLines: parsed.data.length + 1 };
}

export const CSV_TEMPLATE =
  REQUIRED_COLUMNS.join(",") +
  "\n" +
  "P01,residential,45.0177,78.3804,2026-10-12,08:15,morning,20,4.35,no\n";
