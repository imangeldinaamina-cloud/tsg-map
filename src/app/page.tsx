import Link from "next/link";
import { ProInterestButton } from "@/components/ProInterestButton";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getI18n } from "@/i18n/server";
import { TSG_COLORS, TSG_SYMBOL, TSG_TEXT } from "@/lib/tsg";

export default async function Landing() {
  const { t } = await getI18n();
  const steps = [1, 2, 3] as const;
  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-[#eef4fb] to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8a4304]">{t("landing.eyebrow")}</p>
            <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">{t("landing.h1")}</h1>
            <p className="mt-4 text-lg text-muted">{t("landing.lead")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/onboarding" className="btn btn-primary">{t("landing.ctaMap")} →</Link>
              <a href="#access" className="btn btn-secondary">{t("landing.ctaAccess")}</a>
            </div>
            <p className="mt-4 text-xs text-muted">{t("landing.honesty")}</p>
          </div>
          {/* Illustrative formula card — not data */}
          <div aria-hidden className="card p-6 shadow-sm">
            <p className="whitespace-nowrap text-center font-mono text-lg font-bold sm:text-2xl">TSG = (D − S) / (D + S)</p>
            <div className="mt-6 grid grid-cols-5 gap-1 text-center text-xs font-bold">
              {(["strong_surplus", "surplus", "balanced", "shortage", "strong_shortage"] as const).map((l) => (
                <div key={l} className="rounded py-3" style={{ background: TSG_COLORS[l], color: TSG_TEXT[l] }}>
                  {TSG_SYMBOL[l]}
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>−1</span>
              <span>0</span>
              <span>+1</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t("landing.problemTitle")}</h2>
        <p className="mt-3 max-w-3xl text-lg">{t("landing.problem")}</p>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold">{t("landing.howTitle")}</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((n) => (
              <li key={n} className="card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-fg">{n}</span>
                <h3 className="mt-3 font-bold">{t(`landing.step${n}Title`)}</h3>
                <p className="mt-1 text-sm">{t(`landing.step${n}`)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">
            <Link href="/methodology" className="font-semibold text-primary underline">{t("nav.methodology")} →</Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t("landing.whoTitle")}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-bold">🏪 {t("landing.whoBiz")}</h3>
            <p className="mt-1">{t("landing.whoBizText")}</p>
          </div>
          <div className="card p-5">
            <h3 className="font-bold">🏠 {t("landing.whoRes")}</h3>
            <p className="mt-1">{t("landing.whoResText")}</p>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold">{t("landing.pricingTitle")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <h3 className="text-lg font-bold">{t("landing.free")}</h3>
              <p className="mt-1">{t("landing.freeItems")}</p>
              <Link href="/onboarding" className="btn btn-secondary mt-4 w-full">{t("landing.ctaMap")}</Link>
            </div>
            <div className="card border-2 border-primary p-5">
              <h3 className="text-lg font-bold">{t("landing.pro")}</h3>
              <p className="mt-1">{t("landing.proItems")}</p>
              <p className="mt-2 text-xs text-muted">{t("landing.proNote")}</p>
              <div className="mt-4">
                <ProInterestButton source="landing" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="access" className="mx-auto max-w-2xl scroll-mt-20 px-4 py-14">
        <h2 className="text-2xl font-bold">{t("landing.accessTitle")}</h2>
        <p className="mb-4 mt-2">{t("landing.accessText")}</p>
        <WaitlistForm source="early_access" />
      </section>
    </div>
  );
}
