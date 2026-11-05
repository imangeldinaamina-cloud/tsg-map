import { NextResponse } from "next/server";
import { parseObservationsCsv } from "@/lib/csv-import";
import { isAdmin } from "@/lib/server/auth";
import { saveObservations } from "@/lib/server/store";

const MAX_BYTES = 2_000_000;

/** Server re-validates the raw CSV with the same pure parser used in the browser preview. */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { csv?: string; replace?: boolean } | null;
  if (!body?.csv || typeof body.csv !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (body.csv.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const result = parseObservationsCsv(body.csv);
  if (!result.rows.length) return NextResponse.json({ error: "no_valid_rows", ...result }, { status: 422 });
  try {
    const n = await saveObservations(result.rows, !!body.replace);
    return NextResponse.json({ saved: n, errors: result.errors, warnings: result.warnings });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
