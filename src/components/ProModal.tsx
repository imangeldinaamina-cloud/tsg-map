"use client";
import { useI18n } from "@/i18n/client";
import { FREE_SLOT } from "@/lib/domain";
import { usePro } from "@/lib/client/pro";
import { Modal } from "./Modal";
import { WaitlistForm } from "./WaitlistForm";

export function ProModal() {
  const { t } = useI18n();
  const pro = usePro();
  return (
    <Modal open={!!pro.gateOpen} onClose={pro.closeGate} title={t("pro.lockedTitle")}>
      <p className="mb-4 text-sm">{t("pro.lockedText", { slot: t(`slots.${FREE_SLOT}`) })}</p>
      <p className="mb-2 text-sm font-medium">{t("pro.emailPrompt")}</p>
      <WaitlistForm source="pro" compact />
      <hr className="my-4 border-border" />
      <button type="button" className="btn btn-secondary w-full" onClick={pro.enablePreview}>
        {t("pro.preview")}
      </button>
    </Modal>
  );
}
