"use client";
import { DemoBanner } from "@/components/DemoBanner";
import { LevelChip, QualityBadge } from "@/components/explorer/Badges";
import { Controls } from "@/components/explorer/Controls";
import { useI18n } from "@/i18n/client";
import { rank, rankPositions, toCsv } from "@/lib/compute";
import { track } from "@/lib/client/analytics";
import { computeFor, OSM_META, useExplorer } from "@/lib/client/explorer";
import { usePro } from "@/lib/client/pro";
import { formatTsg } from "@/lib/tsg";
import { FREE_SLOT } from "@/lib/domain";

export function RankingView() {
  const { t } = useI18n();
  const ex = useExplorer();
  const pro = usePro();
  const f = ex.filters;
  const ranked = rank(ex.results);
  const staticPos = rankPositions(computeFor(ex.bundle, { ...f, mode: "static" }));
  const dynamicPos = rankPositions(computeFor(ex.bundle, { ...f, mode: "dynamic" }));
  const fmt = (n: number | null) => (n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2));

  function exportCsv() {
    if (!pro.requestPro("csv_export")) return;
    const header = ["dataset", "slot", "mode", "category", "radius_m", "rank", "point_id", "point_type", "D", "S", "TSG", "level", "quality", "holdout", "osm_extracted_at"];
    const rows = ranked.map((r, i) => [
      ex.dataset === "demo" ? "DEMO (not measured)" : "real",
      f.slot,
      f.mode,
      f.cat,
      f.r,
      r.tsg === null ? null : i + 1,
      r.point.point_id,
      r.point.point_type,
      fmt(r.D),
      r.S,
      r.tsg === null ? null : r.tsg.toFixed(3),
      r.level,
      r.quality,
      r.point.holdout ? "yes" : "no",
      OSM_META.extracted_at,
    ]);
    const blob = new Blob(["﻿" + toCsv([header, ...rows])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tsg-ranking-${ex.dataset === "demo" ? "DEMO-" : ""}${f.slot}-${f.mode}-${f.cat}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    track("csv_export", { dataset: ex.dataset, slot: f.slot, mode: f.mode, cat: f.cat });
  }

  return (
    <>
      {ex.isDemo && <DemoBanner />}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold">{t("ranking.title")}</h1>
          <p className="text-muted">{t("ranking.subtitle", { cat: t(`categories.${f.cat}`) })}</p>
        </div>
        <aside className="card h-fit p-4">
          <Controls filters={f} setFilter={ex.setFilter} hasReal={ex.hasReal} />
        </aside>
        {!pro.preview ? (
          <section className="card space-y-3 p-6">
            <h2 className="text-lg font-bold">🔒 {t("pro.lockedTitle")}</h2>
            <p>{t("pro.lockedText", { slot: t(`slots.${FREE_SLOT}`) })}</p>
            <button type="button" className="btn btn-primary" onClick={() => pro.openGate("ranking")}>
              {t("pro.join")}
            </button>
          </section>
        ) : (
          <div className="min-w-0 space-y-6">
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                <p className="text-sm text-muted">
                  {t(`slots.${f.slot}`)} · {f.mode === "dynamic" ? t("modes.dynamic") : t("modes.static")} · {f.r} m
                </p>
                <button type="button" className="btn btn-secondary" onClick={exportCsv}>
                  ⬇ {t("ranking.export")}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">{t("ranking.title")}</caption>
                  <thead className="bg-surface text-left">
                    <tr>
                      <th scope="col" className="p-2">{t("ranking.rank")}</th>
                      <th scope="col" className="p-2">{t("ranking.area")}</th>
                      <th scope="col" className="p-2">{t("ranking.type")}</th>
                      <th scope="col" className="p-2">D</th>
                      <th scope="col" className="p-2">S</th>
                      <th scope="col" className="p-2">{t("ranking.level")}</th>
                      <th scope="col" className="p-2">{t("quality.label")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r, i) => (
                      <tr key={r.point.point_id} className="border-t border-border">
                        <td className="p-2 font-bold">{r.tsg === null ? "—" : i + 1}</td>
                        <th scope="row" className="p-2 text-left font-semibold">
                          {r.point.point_id}
                          {r.point.holdout && <span className="ml-1 text-xs font-normal text-muted">(holdout)</span>}
                        </th>
                        <td className="p-2">{r.point.point_type}</td>
                        <td className="p-2">{r.D === null ? t("common.notAvailable") : fmt(r.D)}</td>
                        <td className="p-2">{r.S}</td>
                        <td className="p-2"><LevelChip level={r.level} value={r.tsg} /></td>
                        <td className="p-2"><QualityBadge q={r.quality} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ranked.every((r) => r.tsg === null) && <p className="p-4 text-sm">{t("ranking.empty")}</p>}
            </section>

            <section className="card overflow-hidden">
              <div className="border-b border-border p-3">
                <h2 className="font-bold">{t("ranking.compareTitle")}</h2>
                <p className="text-sm text-muted">{t("ranking.compareHint", { slot: t(`slots.${f.slot}`) })}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-surface text-left">
                    <tr>
                      <th scope="col" className="p-2">{t("ranking.area")}</th>
                      <th scope="col" className="p-2">{t("ranking.staticRank")}</th>
                      <th scope="col" className="p-2">{t("ranking.dynamicRank")}</th>
                      <th scope="col" className="p-2">{t("ranking.shift")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(dynamicPos)
                      .sort((a, b) => (dynamicPos[a] ?? 99) - (dynamicPos[b] ?? 99))
                      .map((id) => {
                        const s = staticPos[id];
                        const d = dynamicPos[id];
                        const shift = s !== null && d !== null ? s - d : null;
                        return (
                          <tr key={id} className="border-t border-border">
                            <th scope="row" className="p-2 text-left font-semibold">{id}</th>
                            <td className="p-2">{s ?? t("common.notAvailable")}</td>
                            <td className="p-2">{d ?? t("common.notAvailable")}</td>
                            <td className="p-2 font-medium">
                              {shift === null ? "—" : shift > 0 ? t("ranking.up", { n: shift }) : shift < 0 ? t("ranking.down", { n: -shift }) : t("ranking.same")}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="text-xs text-muted">TSG {formatTsg(1)} … {formatTsg(-1)} · {t("detail.detectorNote")}</p>
          </div>
        )}
      </div>
    </>
  );
}
