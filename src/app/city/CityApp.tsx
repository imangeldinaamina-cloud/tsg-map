"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CityMapHandle, LayerState } from "@/components/city/CityMap";
import { CellDetail } from "@/components/city/CellDetail";
import { CityLegend } from "@/components/city/CityLegend";
import { AssumptionsForm } from "@/components/city/AssumptionsForm";
import { LocationPanel, Candidate } from "@/components/city/LocationPanel";
import { distColor, divColor, quantileBreaks, seqColor, sgiColor } from "@/components/city/palette";
import { Badge, Bars, Section, Segmented, Select, Stat } from "@/components/city/ui";
import { useI18n } from "@/i18n/client";
import { track } from "@/lib/client/analytics";
import { cellIndexAt, loadAssumptions, loadUpload, PopulationUpload, saveAssumptions, useCityData } from "@/lib/city/client";
import { computeGap } from "@/lib/city/gap";
import { anySpecified, baseline, isSpecified, median, presence, sum, TemporalAssumptions, UNSPECIFIED } from "@/lib/city/model";
import { CATCHMENTS_M, DEFAULT_CATCHMENT_M, MAX_CANDIDATES, Period, PERIOD_WINDOWS, PERIODS, SERVICE_CATS, ServiceCat } from "@/lib/city/types";

const CityMap = dynamic(() => import("@/components/city/CityMap"), { ssr: false });

type Tab = "population" | "gaps" | "location";
type View = "residents" | "presence" | "diff";
type GapView = "sgi" | "dist";
const TABS: Tab[] = ["population", "gaps", "location"];

export function CityApp() {
  const { t, locale } = useI18n();
  const { data, error } = useCityData();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef<CityMapHandle>(null);

  // ---- URL-backed filters (shareable links) ----
  const tab: Tab = (TABS as string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as Tab) : "population";
  const period: Period = (PERIODS as readonly string[]).includes(sp.get("t") ?? "") ? (sp.get("t") as Period) : "midday";
  const cat: ServiceCat = (SERVICE_CATS as readonly string[]).includes(sp.get("cat") ?? "") ? (sp.get("cat") as ServiceCat) : "pharmacy";
  const R = (CATCHMENTS_M as readonly number[]).includes(Number(sp.get("r"))) ? Number(sp.get("r")) : DEFAULT_CATCHMENT_M;
  const view: View = (["residents", "presence", "diff"] as const).includes(sp.get("view") as View) ? (sp.get("view") as View) : "presence";
  const gapView: GapView = sp.get("gv") === "dist" ? "dist" : "sgi";
  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      track(key === "tab" ? "city_tab" : "city_filter", { key, value });
    },
    [sp, router, pathname],
  );

  const [layers, setLayers] = useState<LayerState>({ boundary: true, landuse: false, roads: false, facilities: true, analysis: true });
  const [selected, setSelected] = useState<number | null>(null);
  const [assumptions, setAssumptions] = useState<TemporalAssumptions>(UNSPECIFIED);
  const [upload, setUpload] = useState<PopulationUpload | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  useEffect(() => {
    setAssumptions(loadAssumptions());
    setUpload(loadUpload());
  }, []);

  const nf = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "kk" ? "kk-KZ" : "ru-RU", { maximumFractionDigits: 0 }), [locale]);
  const fmt = useCallback((v: number) => nf.format(Math.round(v)), [nf]);
  const pLabel = (p: Period) => `${t(`city.periods.${p}`)} ${PERIOD_WINDOWS[p]}`;

  // ---- model ----
  const cells = data?.grid.cells;
  const override = useMemo(() => (upload && cells && upload.values.length === cells.length ? Float64Array.from(upload.values) : null), [upload, cells]);
  const base = useMemo(() => (cells ? baseline(cells, assumptions.censusTotal, override) : new Float64Array()), [cells, assumptions.censusTotal, override]);
  const presenceBy = useMemo(() => {
    const out = {} as Record<Period, Float64Array>;
    for (const p of PERIODS) out[p] = cells ? presence(cells, base, assumptions, p) : new Float64Array();
    return out;
  }, [cells, base, assumptions]);
  const P = presenceBy[period];
  const modelled = isSpecified(assumptions, period);
  const gap = useMemo(() => (data ? computeGap(data.grid.cells, data.facilities, data.access, P, cat, R) : null), [data, P, cat, R]);
  const cityMedianCompetitors = useMemo(() => {
    if (!gap || !cells) return 0;
    return median(gap.cells.filter((g, i) => cells[i].net && P[i] > 0).map((g) => g.S));
  }, [gap, cells, P]);
  const lookup = useMemo(() => new Map((cells ?? []).map((c, i) => [`${c.r}:${c.c}`, i])), [cells]);

  // ---- colours for the map ----
  const breaks = useMemo(() => quantileBreaks(Array.from(base)), [base]);
  // Symmetric range for the change map: 95th percentile of |change|, so a few hotspots don't wash out the rest.
  const maxAbsDiff = useMemo(() => {
    const v: number[] = [];
    for (const p of PERIODS) for (let i = 0; i < base.length; i++) {
      const d = Math.abs(presenceBy[p][i] - base[i]);
      if (d > 0.5) v.push(d);
    }
    if (!v.length) return 0;
    v.sort((a, b) => a - b);
    return v[Math.floor(0.95 * (v.length - 1))];
  }, [presenceBy, base]);
  const { colors, flags } = useMemo(() => {
    if (!cells || !gap) return { colors: [] as (string | null)[], flags: [] as boolean[] };
    if (tab === "population") {
      return {
        colors: cells.map((_, i) => {
          if (view === "diff") return base[i] > 0 || P[i] > 0 ? divColor(P[i] - base[i], maxAbsDiff) : null;
          const v = view === "residents" ? base[i] : P[i];
          return v > 0 ? seqColor(v, breaks) : null;
        }),
        flags: cells.map(() => false),
      };
    }
    if (gapView === "dist")
      return { colors: gap.cells.map((g, i) => (cells[i].net && P[i] > 0 ? distColor(g.nearest) : null)), flags: gap.cells.map((g) => g.underserved) };
    return { colors: gap.cells.map((g) => (g.sgi === null ? null : sgiColor(g.sgi))), flags: gap.cells.map((g) => g.underserved) };
  }, [cells, gap, tab, view, gapView, base, P, breaks, maxAbsDiff]);

  const highlight = useMemo(() => new Set(tab === "location" ? candidates.flatMap((c) => c.competitorIdx ?? []) : []), [tab, candidates]);

  // ---- candidates ----
  const addCandidate = useCallback(
    async (lat: number, lon: number) => {
      const used = new Set(candidates.map((c) => c.id));
      if (used.size >= MAX_CANDIDATES) return;
      let id = 1;
      while (used.has(id)) id++;
      setCandidates((cs) => [...cs, { id, lat, lon, reach: null, status: "loading" }]);
      track("city_candidate", { cat });
      try {
        const res = await fetch(`/api/location?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
        const body = await res.json();
        setCandidates((cs) =>
          cs.map((c) => (c.id !== id ? c : res.ok ? { ...c, reach: body, status: "ok" } : { ...c, status: body.error === "off_network" ? "off_network" : "error", snap: body.snap_m })),
        );
      } catch {
        setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, status: "error" } : c)));
      }
    },
    [candidates, cat],
  );

  if (error) return <p className="m-6 card p-4 text-sm" role="alert">{t("city.loadError")}</p>;

  const facilityCats = tab === "population" ? [...SERVICE_CATS] : [cat];
  const selectCell = (i: number) => {
    setSelected(i);
    const c = cells?.[i];
    if (c) mapRef.current?.flyTo(c.lat, c.lon);
  };

  const periodControl = (
    <Segmented
      name="period"
      label={t("city.period")}
      value={period}
      onChange={(v) => setParam("t", v)}
      options={PERIODS.map((p) => ({ value: p, label: t(`city.periods.${p}`), hint: PERIOD_WINDOWS[p] }))}
    />
  );
  const catControls = (
    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
      <Select id="cat" label={t("city.category")} value={cat} onChange={(v) => setParam("cat", v)} options={SERVICE_CATS.map((c) => ({ value: c, label: t(`city.cats.${c}`) }))} />
      <Select id="r" label={t("city.catchment")} value={R} onChange={(v) => setParam("r", String(v))} options={CATCHMENTS_M.map((m) => ({ value: m, label: t("city.meters", { n: m }) }))} />
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] md:h-[calc(100dvh-61px)] md:grid-cols-[400px_minmax(0,1fr)]">
      {/* ------------------------------------------------ panel */}
      <aside className="order-2 min-w-0 border-r border-border bg-white md:order-1 md:overflow-y-auto" aria-label={t("city.title")}>
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight">{t("city.title")}</h1>
            <Link href="/city/data" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
              {t("city.dataLink")}
            </Link>
          </div>
          <p className="text-sm text-muted">{t("city.subtitle")}</p>
        </div>
        <div className="sticky top-0 z-10 border-y border-border bg-white/95 px-4 py-2 backdrop-blur">
          <div role="tablist" aria-label={t("city.title")} className="flex gap-1">
            {TABS.map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => setParam("tab", k)}
                className={`min-h-[40px] flex-1 rounded-md px-2 text-sm font-medium transition-colors ${tab === k ? "bg-fg text-white" : "text-muted hover:bg-surface hover:text-fg"}`}
              >
                {t(`city.tabs.${k}`)}
              </button>
            ))}
          </div>
        </div>

        {!data || !gap || !cells ? (
          <p className="p-4 text-sm" role="status">{t("city.loading")}</p>
        ) : (
          <div role="tabpanel">
            <Section>
              {periodControl}
              {tab !== "population" && catControls}
              {tab === "gaps" && (
                <Segmented
                  name="gv"
                  label={t("city.pop.view")}
                  value={gapView}
                  onChange={(v) => setParam("gv", v)}
                  options={[
                    { value: "sgi", label: t("city.gap.views.sgi") },
                    { value: "dist", label: t("city.gap.views.dist") },
                  ]}
                />
              )}
              {tab === "population" && (
                <Segmented
                  name="view"
                  label={t("city.pop.view")}
                  value={view}
                  onChange={(v) => setParam("view", v)}
                  options={(["residents", "presence", "diff"] as const).map((v) => ({ value: v, label: t(`city.pop.views.${v}`) }))}
                />
              )}
              <div className="flex flex-wrap gap-1.5">
                {upload ? <Badge kind="uploaded">{t("city.badges.uploaded")}</Badge> : <Badge kind="source">WorldPop 2021</Badge>}
                {modelled ? <Badge kind="modelled">{t("city.badges.modelled")}</Badge> : <Badge kind="baseline">{t("city.badges.baseline")}</Badge>}
                {tab !== "population" && <Badge kind="source">OSM</Badge>}
              </div>
              {!modelled && <p className="rounded-md border border-border bg-surface p-2.5 text-xs leading-relaxed text-muted">{t("city.pop.notSpecified")}</p>}
              {modelled && <p className="rounded-md border border-[#c4b5fd] bg-[#f5f3ff] p-2.5 text-xs leading-relaxed text-[#4c1d95]">{t("city.pop.specified")}</p>}
            </Section>

            {selected !== null && tab !== "location" && (
              <CellDetail
                index={selected}
                cell={cells[selected]}
                gap={gap.cells[selected]}
                base={base[selected]}
                presenceBy={Object.fromEntries(PERIODS.map((p) => [p, presenceBy[p][selected]])) as Record<Period, number>}
                period={period}
                cat={cat}
                R={R}
                modelled={anySpecified(assumptions)}
                fmt={fmt}
                onClose={() => setSelected(null)}
              />
            )}

            {tab === "population" && (
              <>
                <Section>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label={t("city.pop.residentsTotal")} value={fmt(sum(base))} note={assumptions.censusTotal ? t("city.pop.calibrated", { n: fmt(assumptions.censusTotal) }) : t("city.pop.residentsNote")} />
                    <Stat label={t("city.cell.presence", { period: t(`city.periods.${period}`) })} value={fmt(sum(P))} note={modelled ? t("city.badges.modelled") : t("city.badges.baseline")} />
                  </div>
                </Section>
                {anySpecified(assumptions) && (
                  <Section title={t("city.pop.byPeriod")}>
                    <p className="text-xs text-muted">{t("city.pop.inflow")}</p>
                    <Bars
                      rows={PERIODS.map((p) => {
                        // net number of people modelled as present outside their home cell
                        let s = 0;
                        for (let i = 0; i < cells.length; i++) if (presenceBy[p][i] > base[i]) s += presenceBy[p][i] - base[i];
                        return { label: t(`city.periods.${p}`), value: s };
                      })}
                      format={fmt}
                      highlight={t(`city.periods.${period}`)}
                    />
                  </Section>
                )}
                <Section title={t("city.pop.topCells", { period: t(`city.periods.${period}`) })}>
                  <ol className="space-y-1">
                    {Array.from(P.keys())
                      .sort((a, b) => P[b] - P[a])
                      .slice(0, 6)
                      .map((i, k) => (
                        <li key={i}>
                          <button type="button" onClick={() => selectCell(i)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface">
                            <span>
                              <span className="mr-2 text-muted tabular-nums">{k + 1}.</span>
                              {t("city.cell.title", { id: `${cells[i].r}-${cells[i].c}` })}
                            </span>
                            <span className="tabular-nums">{t("city.people", { n: fmt(P[i]) })}</span>
                          </button>
                        </li>
                      ))}
                  </ol>
                </Section>
                <AssumptionsForm
                  value={assumptions}
                  onApply={(a) => {
                    setAssumptions(a);
                    saveAssumptions(a);
                    track("city_assumptions", { specified: anySpecified(a) });
                  }}
                />
              </>
            )}

            {tab === "gaps" && (
              <>
                <Section>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label={t("city.gap.facilities")} value={fmt(gap.facilityCount)} note={t(`city.cats.${cat}`)} />
                    <Stat label={t("city.gap.withoutAccess")} value={`${Math.round(gap.shareWithoutAccess * 100)}%`} note={t("city.gap.noAccess", { cat: t(`city.cats.${cat}`).toLowerCase(), R })} />
                  </div>
                  <p className="rounded-md border border-demo-border bg-demo-bg p-2.5 text-xs leading-relaxed text-demo-fg">⚠ {t("city.gap.coverage")}</p>
                </Section>
                <Section title={t("city.gap.bands")}>
                  <Bars
                    rows={gap.bands.map((b, k) => ({ label: k === gap.bands.length - 1 ? t("city.gap.beyond") : `${b.label} ${locale === "en" ? "m" : "м"}`, value: b.people }))}
                    format={(v) => `${Math.round((v / Math.max(1, gap.totalPresence)) * 100)}%`}
                  />
                </Section>
                <Section title={t("city.gap.underserved")} aside={<span className="text-xs tabular-nums text-muted">{gap.underserved.length}</span>}>
                  <p className="text-xs text-muted">{t("city.gap.underservedHint", { median: fmt(gap.medianPopulated) })}</p>
                  {gap.underserved.length === 0 ? (
                    <p className="text-sm">{t("city.gap.empty")}</p>
                  ) : (
                    <ol className="max-h-72 space-y-1 overflow-y-auto">
                      {gap.underserved.slice(0, 25).map((i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => selectCell(i)}
                            aria-pressed={selected === i}
                            className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface ${selected === i ? "bg-surface ring-1 ring-border" : ""}`}
                          >
                            <span className="truncate">{t("city.cell.title", { id: `${cells[i].r}-${cells[i].c}` })}</span>
                            <span className="text-xs tabular-nums text-muted">{t("city.people", { n: fmt(P[i]) })}</span>
                            <span className="rounded px-1.5 text-xs font-semibold tabular-nums" style={{ background: sgiColor(gap.cells[i].sgi), color: "#fff" }}>
                              {gap.cells[i].sgi?.toFixed(2)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>
                <Section>
                  <p className="text-xs leading-relaxed text-muted">{t("city.gap.formula")}</p>
                </Section>
              </>
            )}

            {tab === "location" && (
              <LocationPanel
                candidates={candidates}
                setCandidates={setCandidates}
                onAddCenter={() => {
                  const c = mapRef.current?.center();
                  if (c) addCandidate(c.lat, c.lon);
                }}
                data={data}
                base={base}
                presenceBy={presenceBy}
                period={period}
                cat={cat}
                R={R}
                gap={gap}
                cellIndex={(lat, lon) => cellIndexAt(data.grid, lookup, lat, lon)}
                temporalSpecified={anySpecified(assumptions)}
                cityMedianCompetitors={cityMedianCompetitors}
                fmt={fmt}
                onFocus={(lat, lon) => mapRef.current?.flyTo(lat, lon, 15)}
              />
            )}
          </div>
        )}
      </aside>

      {/* ------------------------------------------------ map */}
      <div className="relative order-1 h-[60vh] min-h-[360px] min-w-0 md:order-2 md:h-full">
        {data && (
          <CityMap
            ref={mapRef}
            data={data}
            colors={colors}
            flags={flags}
            layers={layers}
            facilityCats={facilityCats}
            highlight={highlight}
            selectedCell={tab === "location" ? null : selected}
            candidates={tab === "location" ? candidates : []}
            placing={tab === "location" && candidates.length < MAX_CANDIDATES}
            onCellClick={(i) => setSelected(i)}
            onPlace={addCandidate}
          />
        )}
        {data && (
          <CityLegend
            tab={tab}
            view={view}
            gapView={gapView}
            period={pLabel(period)}
            cat={t(`city.cats.${cat}`)}
            breaks={breaks}
            cellM={data.grid.cell_m}
            layers={layers}
            setLayers={setLayers}
            fmt={fmt}
          />
        )}
      </div>
    </div>
  );
}
