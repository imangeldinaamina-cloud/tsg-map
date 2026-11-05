"use client";
import { useI18n } from "@/i18n/client";
import { AreaResult, computeArea } from "@/lib/compute";
import { FREE_SLOT, Mode, SLOTS } from "@/lib/domain";
import { Filters, SERVICES } from "@/lib/client/explorer";
import { usePro } from "@/lib/client/pro";
import { formatTsg } from "@/lib/tsg";
import { DatasetBadge, LevelChip, QualityBadge } from "./Badges";

function fmt(n: number | null, digits = 1) {
  return n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

export function useWhy() {
  const { t } = useI18n();
  return (r: AreaResult, mode: Mode, radius: number) => {
    if (r.tsg === null) {
      const reason =
        r.missing === "presence"
          ? t("detail.reasonPresence")
          : r.missing === "population"
            ? t("detail.reasonPopulation")
            : t("detail.reasonZero");
      return t("detail.whyNone", { reason });
    }
    const d = mode === "dynamic" ? t("detail.peopleDynamic", { n: fmt(r.D) }) : t("detail.peopleStatic", { n: fmt(r.D, 0) });
    const s = t("detail.services", { n: r.S, r: radius });
    const key =
      r.level === "strong_shortage"
        ? "whyStrongShortage"
        : r.level === "shortage"
          ? "whyShortage"
          : r.level === "balanced"
            ? "whyBalanced"
            : "whySurplus";
    return t(`detail.${key}`, { d, s });
  };
}

export function AreaDetail({ result, filters, onClose }: { result: AreaResult; filters: Filters; onClose: () => void }) {
  const { t } = useI18n();
  const pro = usePro();
  const why = useWhy();
  const p = result.point;
  const isDemo = result.quality === "demo";
  const opts = { category: filters.cat, radiusM: filters.r, isDemo };
  const slotRows = SLOTS.map((slot) => ({ slot, r: computeArea(p, SERVICES, { ...opts, slot, mode: filters.mode }) }));
  const st = computeArea(p, SERVICES, { ...opts, slot: filters.slot, mode: "static" });
  const dy = computeArea(p, SERVICES, { ...opts, slot: filters.slot, mode: "dynamic" });
  const obs = p.slots[filters.slot];

  return (
    <section aria-labelledby="detail-title" className="card space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="detail-title" className="text-lg font-bold">{t("detail.title", { id: p.point_id })}</h2>
          <p className="text-sm text-muted">
            {t("detail.type")}: {p.point_type}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-secondary min-h-[36px] px-3 py-1">
          {t("common.close")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <DatasetBadge demo={isDemo} />
        <QualityBadge q={result.quality} />
        {p.holdout && (
          <span className="rounded-md border border-slate-500 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">holdout</span>
        )}
      </div>

      <div className="rounded-lg bg-surface p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t(`slots.${filters.slot}`)}</span>
          <LevelChip level={result.level} value={result.tsg} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-muted">{t("detail.demand")}</dt>
            <dd className="text-xl font-bold">{fmt(result.D)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("detail.supply")}</dt>
            <dd className="text-xl font-bold">{result.S}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("detail.tsg")}</dt>
            <dd className="text-xl font-bold">{formatTsg(result.tsg)}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">{t("detail.whyTitle")}</h3>
        <p className="text-sm">{why(result, filters.mode, filters.r)}</p>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">{t("detail.perSlot")}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-medium" scope="col">{t("map.slot")}</th>
              <th className="py-1 font-medium" scope="col">D</th>
              <th className="py-1 font-medium" scope="col">S</th>
              <th className="py-1 font-medium" scope="col">TSG</th>
            </tr>
          </thead>
          <tbody>
            {slotRows.map(({ slot, r }) => {
              const locked = !pro.preview && slot !== FREE_SLOT;
              return (
                <tr key={slot} className="border-t border-border">
                  <th scope="row" className="py-1.5 text-left font-medium">{t(`slots.${slot}`)}</th>
                  {locked ? (
                    <td colSpan={3}>
                      <button type="button" className="text-sm font-semibold text-primary underline" onClick={() => pro.requestPro("detail_slots")}>
                        🔒 {t("pro.badge")}
                      </button>
                    </td>
                  ) : (
                    <>
                      <td>{fmt(r.D)}</td>
                      <td>{r.S}</td>
                      <td>
                        <LevelChip level={r.level} value={r.tsg} />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">{t("detail.modesCompare")}</h3>
        <ul className="space-y-1 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("modes.staticShort")} (D = {fmt(st.D, 0)})</span>
            <LevelChip level={st.level} value={st.tsg} />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("modes.dynamicShort")} (D = {fmt(dy.D)})</span>
            <LevelChip level={dy.level} value={dy.tsg} />
          </li>
        </ul>
        {st.missing === "population" && <p className="mt-1 text-xs text-muted">{t("common.placeholder")}: {t("detail.reasonPopulation")}</p>}
      </div>

      {!isDemo && obs && (
        <p className="text-xs text-muted">{t("detail.obsInfo", { n: obs.n_obs, f: obs.frames, dates: obs.dates.join(", ") })}</p>
      )}
      {p.holdout && <p className="text-xs text-muted">{t("detail.holdoutNote")}</p>}
      <p className="text-xs text-muted">⚠ {t("detail.detectorNote")}</p>
    </section>
  );
}
