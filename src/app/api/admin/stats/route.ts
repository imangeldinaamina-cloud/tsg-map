import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/server/auth";
import { listEvents, listFeedback, listObservations, listWaitlist, storageMode } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [feedback, events, waitlist, obs] = await Promise.all([listFeedback(), listEvents(), listWaitlist(), listObservations()]);
  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    const k = e.type === "filter_change" && e.props?.filter ? `filter_change:${e.props.filter}` : e.type;
    eventCounts[k] = (eventCounts[k] ?? 0) + 1;
  }
  const pageViews: Record<string, number> = {};
  for (const e of events) if (e.type === "page_view" && e.path) pageViews[e.path] = (pageViews[e.path] ?? 0) + 1;
  return NextResponse.json({
    storage: storageMode(),
    feedback,
    eventCounts,
    pageViews,
    waitlist: {
      early_access: waitlist.filter((w) => w.source === "early_access").length,
      pro: waitlist.filter((w) => w.source === "pro").length,
    },
    observations: obs.length,
  });
}
