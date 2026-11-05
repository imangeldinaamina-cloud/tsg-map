"use client";
import { useI18n } from "@/i18n/client";
import { CellGap } from "@/lib/city/gap";
import { ATTRACTORS, Cell, Period, PERIODS, ServiceCat } from "@/lib/city/types";
import { formatTsg, TSG_SYMBOL, TSG_TEXT, tsgLevel } from "@/lib/tsg";
import { sgiColor } from "./palette";
import { Badge, Bars, Section } from "./ui";

export function CellDetail(props: {
  index: number;
  cell: Cell;
  gap: CellGap;
  base: number;
  presenceBy: Record<Period, number>;
  period: Period;
  cat: ServiceCat;
  R: number;
  modelled: boolean;
  fmt: (v: number) => string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { cell, gap, fmt } = props;
  const level = tsgLevel(gap.sgi);
  const catName = t(`city.cats.${props.cat}`);
  return (
    <Section
      title={t("city.cell.title", { id: `${cell.r}-${cell.c}` })}
      aside={
        <button type="button" onClick={props.onClose} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface hover:text-fg">
          {t("city.cell.close")} ✕
        </button>
      }
    >
      <div className="rounded-lg border border-border">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-sm">
          <dt className="text-muted">{t("city.cell.residents")}</dt>
          <dd className="text-right font-semibold tabular-nums">{fmt(props.base)}</dd>
          <dt className="text-muted">{t("city.cell.facilities", { cat: catName, R: props.R })}</dt>
          <dd className="text-right font-semibold tabular-nums">{cell.net ? gap.S : "—"}</dd>
          <dt className="text-muted">{t("city.cell.nearest", { cat: catName.toLowerCase() })}</dt>
          <dd className="text-right font-semibold tabular-nums">{gap.nearest !== null ? t("city.meters", { n: fmt(gap.nearest) }) : t("city.gap.beyond")}</dd>
          <dt className="text-muted">{t("city.cell.sgi")}</dt>
          <dd className="text-right">
            <span className="inline-block rounded px-1.5 py-0.5 text-sm font-semibold tabular-nums" style={{ background: sgiColor(gap.sgi), color: TSG_TEXT[level] }}>
              {TSG_SYMBOL[level]} {formatTsg(gap.sgi)}
            </span>
          </dd>
        </dl>
        {gap.underserved && (
          <p className="border-t border-border bg-[#fff7ed] px-3 py-2 text-xs font-semibold text-[#7c2d12]">▲▲ {t("city.cell.underserved")}</p>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("city.cell.why")}</h3>
        <p className="text-sm leading-relaxed">
          {gap.reason === "no_network"
            ? t("city.cell.noNet")
            : gap.reason === "no_population"
              ? t("city.cell.noPop")
              : t("city.cell.whyText", { d: (gap.d * 100).toFixed(2), s: (gap.s * 100).toFixed(2), cat: catName.toLowerCase() })}
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("city.loc.byPeriod")}</h3>
          {props.modelled ? <Badge kind="modelled">{t("city.badges.modelled")}</Badge> : <Badge kind="baseline">{t("city.badges.baseline")}</Badge>}
        </div>
        <Bars rows={PERIODS.map((p) => ({ label: t(`city.periods.${p}`), value: props.presenceBy[p] }))} format={fmt} highlight={t(`city.periods.${props.period}`)} />
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("city.cell.attractors")}</h3>
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {ATTRACTORS.map((a, j) => (
            <li key={a} className="rounded border border-border px-1.5 py-0.5">
              {t(`city.pop.attractors.${a}`)}: <span className="font-semibold tabular-nums">{cell.attr[j]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
