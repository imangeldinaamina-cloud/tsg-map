"use client";
import { useI18n } from "@/i18n/client";
import type { Quality } from "@/lib/compute";
import { TSG_COLORS, TSG_SYMBOL, TSG_TEXT, TsgLevel, formatTsg } from "@/lib/tsg";

export function LevelChip({ level, value }: { level: TsgLevel; value: number | null }) {
  const { t } = useI18n();
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-slate-400 px-2 py-0.5 text-sm font-semibold whitespace-nowrap"
      style={{ background: TSG_COLORS[level], color: TSG_TEXT[level] }}
    >
      <span aria-hidden>{TSG_SYMBOL[level]}</span>
      {formatTsg(value)} · {t(`levels.${level}`)}
    </span>
  );
}

const Q_STYLE: Record<Quality, string> = {
  demo: "bg-demo-bg text-demo-fg border-demo-border",
  none: "bg-slate-100 text-slate-700 border-slate-400",
  low: "bg-orange-50 text-orange-900 border-orange-700",
  medium: "bg-sky-50 text-sky-900 border-sky-700",
  good: "bg-blue-100 text-blue-900 border-blue-800",
};

export function QualityBadge({ q }: { q: Quality }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${Q_STYLE[q]}`}>
      {t("quality.label")}: {t(`quality.${q}`)}
    </span>
  );
}

export function DatasetBadge({ demo }: { demo: boolean }) {
  const { t } = useI18n();
  return demo ? (
    <span className="rounded-md border border-demo-border bg-demo-bg px-2 py-0.5 text-xs font-bold text-demo-fg">{t("common.demoBadge")}</span>
  ) : (
    <span className="rounded-md border border-blue-800 bg-real-bg px-2 py-0.5 text-xs font-bold text-real-fg">{t("common.realBadge")}</span>
  );
}
