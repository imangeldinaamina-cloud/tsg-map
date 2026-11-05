import { NextResponse } from "next/server";
import { aggregatePoints } from "@/lib/compute";
import type { DataBundle } from "@/lib/domain";
import { listObservations, storageMode } from "@/lib/server/store";
import { POPULATION_BY_POINT } from "@/data/population";

export const dynamic = "force-dynamic";

/** Real measured data only. Demo data is bundled separately on the client. */
export async function GET() {
  try {
    const obs = await listObservations();
    const updated_at = obs.reduce<string | null>((a, o) => (!a || o.imported_at > a ? o.imported_at : a), null);
    const real: DataBundle = { dataset: "real", points: aggregatePoints(obs, POPULATION_BY_POINT), updated_at };
    return NextResponse.json({ real, storage: storageMode() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ real: { dataset: "real", points: [], updated_at: null }, storage: storageMode(), error: true });
  }
}
