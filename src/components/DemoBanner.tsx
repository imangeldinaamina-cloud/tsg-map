"use client";
import { useI18n } from "@/i18n/client";

/** Always visible whenever demo data is on screen. */
export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div role="status" className="border-y-2 border-demo-border bg-demo-bg px-4 py-2 text-center text-sm font-semibold text-demo-fg">
      <span className="mr-2 rounded bg-demo-fg px-2 py-0.5 text-xs font-bold tracking-wide text-demo-bg">{t("common.demoBadge")}</span>
      {t("common.demoBanner")}
    </div>
  );
}
