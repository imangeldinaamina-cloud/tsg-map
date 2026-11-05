"use client";
import { useI18n } from "@/i18n/client";
import { usePro } from "@/lib/client/pro";

/** "Join waitlist for Pro" — opens the Pro modal; clicks are counted (pro_click). */
export function ProInterestButton({ source }: { source: string }) {
  const { t } = useI18n();
  const pro = usePro();
  return (
    <button
      type="button"
      className="btn btn-primary w-full"
      onClick={() => pro.openGate(source)}
    >
      {t("pro.join")}
    </button>
  );
}
