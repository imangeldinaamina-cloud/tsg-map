"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { toCsv } from "@/lib/compute";
import { CSV_TEMPLATE, ImportResult, Issue, parseObservationsCsv, REQUIRED_COLUMNS } from "@/lib/csv-import";

type Storage = "supabase" | "local" | "disabled";

function browserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

interface Stats {
  feedback: { created_at: string; page: string; rating: number; comment: string | null; locale: string }[];
  eventCounts: Record<string, number>;
  pageViews: Record<string, number>;
  waitlist: { early_access: number; pro: number };
  observations: number;
}

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function AdminView() {
  const { t } = useI18n();
  const sb = useMemo(browserSupabase, []);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/data").then((r) => r.json()).then((j) => setStorage(j.storage));
    sb?.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, [sb]);

  const authHeaders = useCallback((): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { headers: authHeaders() });
    if (r.status === 403) {
      setStats(null);
      if (token) setAuthErr(t("admin.notAdmin"));
      return;
    }
    setAuthErr(null);
    setStats(await r.json());
  }, [authHeaders, token, t]);

  useEffect(() => {
    if (storage === "local" || (storage === "supabase" && token)) loadStats();
  }, [storage, token, loadStats]);

  if (!storage) return <p className="p-6">{t("common.loading")}</p>;
  const authed = storage === "local" || (storage === "supabase" && !!token && !authErr);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
      {storage === "local" && <p className="rounded-md border border-demo-border bg-demo-bg p-3 text-sm text-demo-fg">{t("admin.localMode")}</p>}
      {storage === "disabled" && <p className="rounded-md border border-demo-border bg-demo-bg p-3 text-sm text-demo-fg">{t("admin.disabled")}</p>}
      {storage === "supabase" && !token && sb && <Login sb={sb} onToken={setToken} />}
      {storage === "supabase" && token && (
        <button
          className="btn btn-secondary"
          onClick={async () => {
            await sb?.auth.signOut();
            setToken(null);
            setAuthErr(null);
          }}
        >
          {t("admin.signOut")}
        </button>
      )}
      {authErr && <p role="alert" className="font-medium text-demo-fg">{authErr}</p>}
      {authed && (
        <>
          <Importer authHeaders={authHeaders} onDone={loadStats} />
          <StatsPanel stats={stats} />
        </>
      )}
    </div>
  );
}

function Login({ sb, onToken }: { sb: SupabaseClient; onToken: (t: string) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="card max-w-sm space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error || !data.session) return setErr(error?.message ?? t("common.error"));
        onToken(data.session.access_token);
      }}
    >
      <h2 className="font-bold">{t("admin.login")}</h2>
      <label className="block text-sm">
        {t("admin.email")}
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-md border border-border px-2" required />
      </label>
      <label className="block text-sm">
        {t("admin.password")}
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-md border border-border px-2" required />
      </label>
      {err && <p role="alert" className="text-sm text-demo-fg">{err}</p>}
      <button className="btn btn-primary w-full">{t("admin.signIn")}</button>
    </form>
  );
}

function IssueTable({ issues, caption }: { issues: Issue[]; caption: string }) {
  const { t } = useI18n();
  if (!issues.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-1 text-left font-semibold">{caption} ({issues.length})</caption>
        <thead className="bg-surface text-left">
          <tr>
            <th scope="col" className="p-2">{t("admin.line")}</th>
            <th scope="col" className="p-2">{t("admin.column")}</th>
            <th scope="col" className="p-2">{t("admin.problem")}</th>
            <th scope="col" className="p-2">{t("admin.value")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.slice(0, 200).map((i, k) => (
            <tr key={k} className="border-t border-border">
              <td className="p-2">{i.line || "—"}</td>
              <td className="p-2 font-mono">{i.column ?? "—"}</td>
              <td className="p-2">{t(`import.issue.${i.code}`)}</td>
              <td className="p-2 font-mono">{i.value ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Importer({ authHeaders, onDone }: { authHeaders: () => HeadersInit; onDone: () => void }) {
  const { t } = useI18n();
  const [csv, setCsv] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | undefined) {
    setStatus(null);
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    setResult(parseObservationsCsv(text));
  }

  async function upload() {
    if (!csv) return;
    setBusy(true);
    const r = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ csv, replace }),
    }).catch(() => null);
    setBusy(false);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setStatus({ kind: "ok", text: t("admin.uploaded", { n: j.saved }) });
      onDone();
    } else setStatus({ kind: "err", text: `${t("common.error")} (${j.error ?? r?.status ?? "network"})` });
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="imp-title">
      <h2 id="imp-title" className="text-lg font-bold">{t("admin.importTitle")}</h2>
      <p className="text-sm">{t("admin.importHelp", { cols: REQUIRED_COLUMNS.join(", ") })}</p>
      <button type="button" className="btn btn-secondary" onClick={() => download("tsg-observations-template.csv", CSV_TEMPLATE)}>
        ⬇ {t("admin.template")}
      </button>
      <label className="block text-sm font-semibold">
        {t("admin.file")}
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="mt-1 block w-full text-sm" />
      </label>
      {result && (
        <div className="space-y-4">
          <p role="status" className="font-medium">
            {t("admin.summary", {
              total: Math.max(result.totalLines - 1, 0),
              ok: result.rows.length,
              err: result.errors.length,
              warn: result.warnings.length,
            })}
          </p>
          <IssueTable issues={result.errors} caption={t("admin.errors")} />
          <IssueTable issues={result.warnings} caption={t("admin.warnings")} />
          {result.rows.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold">{t("admin.preview")}</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface text-left">
                    <tr>{REQUIRED_COLUMNS.map((c) => <th key={c} scope="col" className="p-1 font-mono">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {REQUIRED_COLUMNS.map((c) => (
                          <td key={c} className="p-1 font-mono">{c === "holdout" ? (r.holdout ? "yes" : "no") : String(r[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            {t("admin.replace")}
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !result.rows.length} onClick={upload}>
            {t("admin.upload", { n: result.rows.length })}
          </button>
        </div>
      )}
      {status && (
        <p role={status.kind === "err" ? "alert" : "status"} className={status.kind === "err" ? "font-medium text-demo-fg" : "font-medium text-real-fg"}>
          {status.text}
        </p>
      )}
    </section>
  );
}

function StatsPanel({ stats }: { stats: Stats | null }) {
  const { t } = useI18n();
  if (!stats) return null;
  const avg = stats.feedback.length ? (stats.feedback.reduce((a, f) => a + f.rating, 0) / stats.feedback.length).toFixed(2) : "—";
  const proClicks = Object.entries(stats.eventCounts).filter(([k]) => k === "pro_click").reduce((a, [, v]) => a + v, 0);
  return (
    <section className="card space-y-4 p-5" aria-labelledby="stats-title">
      <h2 id="stats-title" className="text-lg font-bold">{t("admin.statsTitle")}</h2>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li className="rounded-md bg-surface p-3 font-medium">{t("admin.feedbackCount", { n: stats.feedback.length, avg })}</li>
        <li className="rounded-md bg-surface p-3 font-medium">{t("admin.waitlistCount", { a: stats.waitlist.early_access, p: stats.waitlist.pro })}</li>
        <li className="rounded-md bg-surface p-3 font-medium">{t("admin.proClicks", { n: proClicks })}</li>
        <li className="rounded-md bg-surface p-3 font-medium">observations: {stats.observations}</li>
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 font-semibold">{t("admin.eventsTitle")}</h3>
          {Object.keys(stats.eventCounts).length === 0 ? (
            <p className="text-sm text-muted">{t("admin.noData")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(stats.eventCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <tr key={k} className="border-t border-border">
                      <th scope="row" className="p-1 text-left font-mono font-normal">{k}</th>
                      <td className="p-1 text-right">{v}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className="mb-1 font-semibold">page_view</h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(stats.pageViews)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <tr key={k} className="border-t border-border">
                    <th scope="row" className="p-1 text-left font-mono font-normal">{k}</th>
                    <td className="p-1 text-right">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Feedback</h3>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!stats.feedback.length}
            onClick={() =>
              download(
                "tsg-feedback.csv",
                toCsv([["created_at", "page", "rating", "comment", "locale"], ...stats.feedback.map((f) => [f.created_at, f.page, f.rating, f.comment, f.locale])]),
              )
            }
          >
            ⬇ {t("admin.exportFeedback")}
          </button>
        </div>
        {stats.feedback.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.noData")}</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {stats.feedback.slice(0, 100).map((f, i) => (
              <li key={i} className="rounded-md border border-border p-2">
                <span className="font-bold">{f.rating}/5</span> · <span className="font-mono">{f.page}</span> · <span className="text-muted">{f.created_at.slice(0, 16)}</span>
                {f.comment && <p className="mt-1">{f.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
