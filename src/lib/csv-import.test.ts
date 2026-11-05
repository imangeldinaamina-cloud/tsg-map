import { describe, expect, it } from "vitest";
import { parseObservationsCsv, REQUIRED_COLUMNS } from "./csv-import";

const H = REQUIRED_COLUMNS.join(",");
const ok = "P01,residential,45.0177,78.3804,2026-10-12,08:15,morning,20,4.35,no"; // Monday

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe("parseObservationsCsv", () => {
  it("parses a valid file", () => {
    const r = parseObservationsCsv(`${H}\n${ok}\nP01,residential,45.0177,78.3804,2026-10-12,12:30,midday,20,7,no\n`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({
      point_id: "P01",
      point_type: "residential",
      lat: 45.0177,
      lon: 78.3804,
      date: "2026-10-12",
      time_start: "08:15",
      slot: "morning",
      frames: 20,
      mean_people_per_frame: 4.35,
      holdout: false,
    });
  });

  it("reports an empty file", () => {
    expect(codes(parseObservationsCsv("  \n").errors)).toEqual(["empty_file"]);
  });

  it("reports missing columns and stops", () => {
    const r = parseObservationsCsv("point_id,lat,lon\nP01,45,78\n");
    expect(r.rows).toEqual([]);
    expect(r.errors.filter((e) => e.code === "missing_column").map((e) => e.column)).toContain("slot");
  });

  it("warns about unknown columns but imports", () => {
    const r = parseObservationsCsv(`${H},notes\n${ok},hello\n`);
    expect(r.rows).toHaveLength(1);
    expect(codes(r.warnings)).toContain("unknown_column");
  });

  it("accepts BOM, semicolons, header case and decimal commas", () => {
    const hdr = REQUIRED_COLUMNS.map((c) => c.toUpperCase()).join(";");
    const r = parseObservationsCsv(`﻿${hdr}\nP01;residential;45,0177;78,3804;2026-10-12;8:15;Morning;20;4,35;YES\n`);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].lat).toBeCloseTo(45.0177);
    expect(r.rows[0].time_start).toBe("08:15");
    expect(r.rows[0].slot).toBe("morning");
    expect(r.rows[0].holdout).toBe(true);
  });

  it("flags invalid values with line and column", () => {
    const bad = "P02,commercial,abc,200,2026-02-30,25:00,night,0,-1,maybe";
    const r = parseObservationsCsv(`${H}\n${bad}\n`);
    expect(r.rows).toEqual([]);
    const byCol = Object.fromEntries(r.errors.map((e) => [e.column, e.code]));
    expect(byCol).toMatchObject({
      lat: "not_number",
      lon: "lon_range",
      date: "bad_date",
      time_start: "bad_time",
      slot: "bad_slot",
      frames: "bad_frames",
      mean_people_per_frame: "negative_people",
      holdout: "bad_holdout",
    });
    expect(r.errors.every((e) => e.line === 2)).toBe(true);
  });

  it("flags required empty cells", () => {
    const r = parseObservationsCsv(`${H}\n,residential,45.0,78.38,2026-10-12,08:15,morning,20,,no\n`);
    expect(r.errors.filter((e) => e.code === "required").map((e) => e.column).sort()).toEqual(["mean_people_per_frame", "point_id"]);
  });

  it("keeps valid rows when other rows fail", () => {
    const r = parseObservationsCsv(`${H}\n${ok}\nP03,x,45,78.38,2026-10-12,08:15,morning,20,abc,no\n`);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 3, column: "mean_people_per_frame", code: "not_number" });
  });

  it("detects duplicate point/date/slot", () => {
    const r = parseObservationsCsv(`${H}\n${ok}\n${ok}\n`);
    expect(r.rows).toHaveLength(1);
    expect(codes(r.errors)).toEqual(["duplicate"]);
  });

  it("warns (not errors) on weekend, unusual frames, time outside slot, outside city", () => {
    // 2026-10-10 is a Saturday
    const r = parseObservationsCsv(`${H}\nP04,park,43.25,76.95,2026-10-10,11:00,morning,18,2,no\n`);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(codes(r.warnings).sort()).toEqual(["frames_unexpected", "outside_city", "time_outside_slot", "weekend"]);
  });

  it("warns when a point moves or changes holdout flag", () => {
    const r = parseObservationsCsv(
      `${H}\n${ok}\nP01,residential,45.0277,78.3804,2026-10-13,08:15,morning,20,3,yes\n`,
    );
    expect(codes(r.warnings).sort()).toEqual(["inconsistent_holdout", "inconsistent_location"]);
  });
});
