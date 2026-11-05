import { NextResponse } from "next/server";
import { insertWaitlist } from "@/lib/server/store";

const CONSENT_VERSION = "2026-11-05";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { email?: string; consent?: boolean; source?: string; locale?: string } | null;
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (b?.consent !== true) return NextResponse.json({ error: "consent" }, { status: 400 });
  const source = b?.source === "pro" ? "pro" : "early_access";
  try {
    const added = await insertWaitlist({
      created_at: new Date().toISOString(),
      email,
      consent: true,
      consent_version: CONSENT_VERSION,
      source,
      locale: String(b?.locale ?? "").slice(0, 5),
    });
    return NextResponse.json({ ok: true, duplicate: !added });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
