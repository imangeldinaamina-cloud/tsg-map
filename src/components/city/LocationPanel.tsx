"use client";
import { Dispatch, SetStateAction, useEffect, useMemo } from "react";
import { useI18n } from "@/i18n/client";
import { CityData } from "@/lib/city/client";
import { GapResult } from "@/lib/city/gap";
import { assess, candidateMetrics, CandidateMetrics, Finding } from "@/lib/city/location";
import { LocationReach, MAX_CANDIDATES, Period, PERIODS, SERVICE_CATS, ServiceCat } from "@/lib/city/types";
import { formatTsg } from "@/lib/tsg";
import { Bars, Section } from "./ui";

export interface Candidate {
  id: number;
  lat: number;
  lon: number;
  reach: LocationReach | null;
  status: "loading" | "ok" | "off_network" | "error";
  snap?: number | null;
  competitorIdx?: number[];
}

const KIND_STYLE: Record<Finding["kind"], { icon: string; cls: string }> = {
  opportunity: { icon: "＋", cls: "border-[#93c5fd] bg-[#eff6ff] text-[#1e3a8a]" },
  limitation: { icon: "−", cls: "border-[#fdba74] bg-[#fff7ed] text-[#7c2d12]" },
  info: { icon: "i", cls: "border-border bg-surface text-fg" },
};

export function LocationPanel(props: {
  candidates: Candidate[];
  setCandidates: Dispatch<SetStateAction<Candidate[]>>;
  onAddCenter: () => void;
  data: CityData;
  base: Float64Array;
  presenceBy: Record<Period, Float64Array>;
  period: Period;
  cat: ServiceCat;
  R: number;
  gap: GapResult;
  cellIndex: (lat: number, lon: number) => number | null;
  temporalSpecified: boolean;
  cityMedianCompetitors: number;
  fmt: (v: number) => string;
  onFocus: (lat: number, lon: number) => void;
}) {
  const { t } = useI18n();
  const { candidates, fmt, R, period, cat, setCandidates } = props;

  const metrics: CandidateMetrics[] = useMemo(
    () =>
      candidates
        .filter((c) => c.status === "ok" && c.reach)
        .map((c) =>
          candidateMetrics({
            id: c.id,
            reach: c.reach!,
            facilities: props.data.facilities,
            base: props.base,
            presenceBy: props.presenceBy,
            period,
            cat,
            catchmentM: R,
            cellIndex: props.cellIndex(c.lat, c.lon),
            gap: props.gap.cells,
          }),
        ),
    [candidates, props.data, props.base, props.presenceBy, period, cat, R, props.gap, props.cellIndex], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const findings = useMemo(
    () => assess(metrics, { period, catchmentM: R, temporalSpecified: props.temporalSpecified, cityMedianCompetitors: props.cityMedianCompetitors }),
    [metrics, period, R, props.temporalSpecified, props.cityMedianCompetitors],
  );

  // keep competitor indices on the candidates so the map can highlight them
  const key = metrics.map((m) => `${m.id}:${m.competitorIdx.join(",")}`).join("|");
  useEffect(() => {
    setCandidates((cs) => {
      let changed = false;
      const next = cs.map((c) => {
        const m = metrics.find((x) => x.id === c.id);
        const idx = m?.competitorIdx ?? [];
        if ((c.competitorIdx ?? []).join(",") === idx.join(",")) return c;
        changed = true;
        return { ...c, competitorIdx: idx };
      });
      return changed ? next : cs;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const catName = t(`city.cats.${cat}`);
  const rows: { label: string; get: (m: CandidateMetrics) => string; best?: (m: CandidateMetrics) => number }[] = [
    { label: t("city.loc.presence", { period: t(`city.periods.${period}`) }), get: (m) => fmt(m.presence[period]), best: (m) => m.presence[period] },
    { label: t("city.loc.residents", { R }), get: (m) => fmt(m.residents) },
    { label: t("city.loc.competitors", { R }), get: (m) => String(m.competitors), best: (m) => -m.competitors },
    { label: t("city.loc.nearest"), get: (m) => (m.nearestCompetitor === null ? t("city.gap.beyond") : t("city.meters", { n: fmt(m.nearestCompetitor) })) },
    { label: t("city.loc.perOutlet"), get: (m) => fmt(m.perOutlet), best: (m) => m.perOutlet },
    { label: t("city.loc.walkLen", { R }), get: (m) => t("city.km", { n: (m.network.length_m / 1000).toFixed(1) }), best: (m) => m.network.length_m },
    { label: t("city.loc.intersections", { R }), get: (m) => String(m.network.intersections), best: (m) => m.network.intersections },
    { label: t("city.loc.sgi"), get: (m) => formatTsg(m.sgi) },
  ];

  return (
    <>
      <Section>
        <p className="text-sm leading-relaxed">{t("city.loc.hint", { n: MAX_CANDIDATES })}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary text-sm" onClick={props.onAddCenter} disabled={candidates.length >= MAX_CANDIDATES}>
            ＋ {t("city.loc.addCenter")}
          </button>
          {candidates.length > 0 && (
            <button type="button" className="btn btn-secondary text-sm" onClick={() => setCandidates([])}>
              {t("city.loc.clear")}
            </button>
          )}
        </div>
        {candidates.length >= MAX_CANDIDATES && <p className="text-xs text-muted">{t("city.loc.max", { n: MAX_CANDIDATES })}</p>}
        <p className="text-xs text-muted">{t("city.loc.disclaimer")}</p>
      </Section>

      {candidates.map((c) => {
        const m = metrics.find((x) => x.id === c.id);
        const f = m ? findings[metrics.indexOf(m)] : [];
        return (
          <Section
            key={c.id}
            title={
              <button type="button" className="flex items-center gap-2 hover:underline" onClick={() => props.onFocus(c.lat, c.lon)}>
                <span className="city-candidate-badge">{c.id}</span>
                {t("city.loc.candidate", { n: c.id })}
              </button>
            }
            aside={
              <button type="button" className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface hover:text-fg" onClick={() => setCandidates((cs) => cs.filter((x) => x.id !== c.id))}>
                {t("city.loc.remove")}
              </button>
            }
          >
            <p className="text-[11px] tabular-nums text-muted">
              {c.lat.toFixed(5)}, {c.lon.toFixed(5)}
            </p>
            {c.status === "loading" && <p role="status" className="text-sm">{t("city.loc.loading")}</p>}
            {c.status === "off_network" && <p role="alert" className="text-sm text-[#7c2d12]">{t("city.loc.offNetwork", { d: c.snap ?? "?" })}</p>}
            {c.status === "error" && <p role="alert" className="text-sm text-[#7c2d12]">{t("city.loc.failed")}</p>}
            {m && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("city.loc.assessment")}</h3>
                <ul className="space-y-1.5">
                  {f.map((x, k) => (
                    <li key={k} className={`flex gap-2 rounded-md border px-2 py-1.5 text-sm ${KIND_STYLE[x.kind].cls}`}>
                      <span aria-hidden className="w-3 shrink-0 text-center font-bold">{KIND_STYLE[x.kind].icon}</span>
                      <span>
                        <span className="sr-only">{t(`city.loc.kinds.${x.kind}`)}: </span>
                        {t(`city.loc.findings.${x.key}`, {
                          ...x.params,
                          ...(x.params.period ? { period: t(`city.periods.${x.params.period}`) } : {}),
                          ...(typeof x.params.P === "number" ? { P: fmt(x.params.P) } : {}),
                          ...(typeof x.params.v === "number" ? { v: fmt(x.params.v) } : {}),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("city.loc.services", { R })}</h3>
                <ul className="flex flex-wrap gap-1.5 text-xs">
                  {SERVICE_CATS.map((s) => (
                    <li key={s} className={`rounded border px-1.5 py-0.5 ${s === cat ? "border-fg font-semibold" : "border-border"}`}>
                      {t(`city.cats.${s}`)}: <span className="tabular-nums">{m.services[s]}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        );
      })}

      {metrics.length > 0 && (
        <Section title={`${t("city.loc.compare")} — ${catName}, ${t("city.meters", { n: R })}`}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("city.loc.compare")}</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="px-1 py-1 font-medium" />
                  {metrics.map((m) => (
                    <th key={m.id} scope="col" className="px-1 py-1 text-right font-semibold">
                      #{m.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const bestVal = r.best && metrics.length > 1 ? Math.max(...metrics.map(r.best)) : null;
                  return (
                    <tr key={r.label} className="border-t border-border">
                      <th scope="row" className="px-1 py-1.5 text-left text-xs font-normal text-muted">
                        {r.label}
                      </th>
                      {metrics.map((m) => {
                        const isBest = bestVal !== null && r.best!(m) === bestVal;
                        return (
                          <td key={m.id} className={`px-1 py-1.5 text-right tabular-nums ${isBest ? "font-semibold" : ""}`}>
                            {r.get(m)}
                            {isBest && <span aria-label="best"> ★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("city.loc.byPeriod")}</h3>
            {metrics.map((m) => (
              <div key={m.id}>
                <div className="mb-1 text-xs font-semibold">#{m.id}</div>
                <Bars rows={PERIODS.map((p) => ({ label: t(`city.periods.${p}`), value: m.presence[p] }))} format={fmt} highlight={t(`city.periods.${period}`)} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
