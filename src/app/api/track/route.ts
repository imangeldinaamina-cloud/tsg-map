import { NextResponse } from "next/server";
import { insertEvent } from "@/lib/server/store";

// Privacy-friendly analytics: only whitelisted event types and short scalar props.
// No cookies, no IP, no user agent, no user identifiers are stored.
const TYPES = new Set([
  "page_view",
  "filter_change",
  "area_open",
  "csv_export",
  "pro_click",
  "pro_waitlist",
  "pro_preview",
  "onboarding_complete",
  "onboarding_skip",
  "waitlist_signup",
  "feedback_submit",
  "language_change",
]);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { type?: string; path?: string; props?: Record<string, unknown> } | null;
  if (!b?.type || !TYPES.has(b.type)) return NextResponse.json({ error: "bad_event" }, { status: 400 });
  const props: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(b.props ?? {}).slice(0, 8)) {
    if (typeof v === "number" || typeof v === "boolean") props[k.slice(0, 32)] = v;
    else if (typeof v === "string") props[k.slice(0, 32)] = v.slice(0, 64);
  }
  // strip query strings from paths
  const path = typeof b.path === "string" ? b.path.split("?")[0].slice(0, 100) : null;
  try {
    await insertEvent({ created_at: new Date().toISOString(), type: b.type, path, props });
  } catch (e) {
    console.error(e);
  }
  return new NextResponse(null, { status: 204 });
}
