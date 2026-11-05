"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { safeStorage, track } from "@/lib/client/analytics";

const KEY = "tsg_onboarded";

export default function Onboarding() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (safeStorage().get(KEY) === "1") router.replace("/map");
  }, [router]);
  useEffect(() => heading.current?.focus(), [step]);

  const finish = (skipped: boolean) => {
    safeStorage().set(KEY, "1");
    track(skipped ? "onboarding_skip" : "onboarding_complete", { step });
    router.push("/map");
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted" aria-live="polite">{t("onboarding.step", { n: step })}</p>
        <button type="button" className="text-sm font-semibold text-primary underline" onClick={() => finish(true)}>
          {t("onboarding.skip")}
        </button>
      </div>
      <div className="mb-6 flex gap-2" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-2 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-slate-200"}`} />
        ))}
      </div>
      <div className="card min-h-[260px] p-6">
        <div aria-hidden className="mb-4 text-5xl">{["🕗", "🎨", "🗺️"][step - 1]}</div>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          {t(`onboarding.s${step}Title`)}
        </h1>
        <p className="mt-3 text-lg">{t(`onboarding.s${step}`)}</p>
      </div>
      <div className="mt-6">
        {step < 3 ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => setStep(step + 1)}>
            {t("onboarding.next")} →
          </button>
        ) : (
          <button type="button" className="btn btn-primary w-full" onClick={() => finish(false)}>
            {t("onboarding.start")} →
          </button>
        )}
      </div>
    </div>
  );
}
