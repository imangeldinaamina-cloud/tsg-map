"use client";
import { useI18n } from "@/i18n/client";
import { OSM_META } from "@/lib/client/explorer";
import { TSG_COLORS, TSG_SYMBOL, TSG_TEXT, TsgLevel } from "@/lib/tsg";

const ORDER: TsgLevel[] = ["strong_shortage", "shortage", "balanced", "surplus", "strong_surplus", "none"];
const RANGES: Record<TsgLevel, string> = {
  strong_shortage: "≥ +0.50",
  shortage: "+0.15…+0.50",
  balanced: "±0.15",
  surplus: "−0.50…−0.15",
  strong_surplus: "≤ −0.50",
  none: "—",
};

export function Legend() {
  const { t, locale } = useI18n();
  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "kk" ? "kk-KZ" : locale) : "?");
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{t("map.legend")}</h2>
      <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
        {ORDER.map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-slate-500 px-1 text-[10px] font-bold"
              style={{ background: TSG_COLORS[l], color: TSG_TEXT[l] }}
            >
              {TSG_SYMBOL[l]}
            </span>
            <span>
              {t(`levels.${l}`)} <span className="text-muted">{RANGES[l]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("map.legendHint")}</p>
      <p className="text-xs text-muted">{t("common.osmNote", { extracted: d(OSM_META.extracted_at), base: d(OSM_META.osm_base) })}</p>
    </div>
  );
}
