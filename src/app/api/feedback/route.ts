import { NextResponse } from "next/server";
import { insertFeedback } from "@/lib/server/store";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { rating?: number; comment?: string; page?: string; locale?: string } | null;
  const rating = Number(b?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "bad_rating" }, { status: 400 });
  const comment = typeof b?.comment === "string" ? b.comment.trim().slice(0, 1000) || null : null;
  try {
    await insertFeedback({
      created_at: new Date().toISOString(),
      rating,
      comment,
      page: String(b?.page ?? "").slice(0, 100),
      locale: String(b?.locale ?? "").slice(0, 5),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
