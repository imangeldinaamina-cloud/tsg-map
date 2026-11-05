"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { track } from "@/lib/client/analytics";

export function WaitlistForm({ source, compact = false }: { source: "early_access" | "pro"; compact?: boolean }) {
  const { t, locale } = useI18n();
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setMsg({ kind: "err", text: t("waitlist.invalid") });
    if (!consent) return setMsg({ kind: "err", text: t("waitlist.needConsent") });
    setBusy(true);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent, source, locale }),
    }).catch(() => null);
    setBusy(false);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      track(source === "pro" ? "pro_waitlist" : "waitlist_signup", { duplicate: !!j.duplicate });
      setMsg({ kind: "ok", text: j.duplicate ? t("waitlist.duplicate") : t("waitlist.ok") });
      setEmail("");
    } else setMsg({ kind: "err", text: j.error === "invalid" ? t("waitlist.invalid") : t("common.error") });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <label htmlFor={`${id}-email`} className="sr-only">{t("waitlist.email")}</label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          required
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-[44px] flex-1 rounded-md border border-border px-3"
        />
        <button className="btn btn-primary" disabled={busy}>{source === "pro" ? t("pro.join") : t("waitlist.submit")}</button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
        <span>{t("waitlist.consent")}</span>
      </label>
      <p className="text-xs text-muted">
        {t("waitlist.privacy")} <Link href="/privacy" className="underline">{t("nav.privacy")}</Link>
      </p>
      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-sm font-medium text-demo-fg" : "text-sm font-medium text-real-fg"}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
