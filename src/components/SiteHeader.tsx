import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { LanguageSwitcher } from "./LanguageSwitcher";

const LINKS = [
  ["/city", "nav.city"],
  ["/research", "nav.research"],
  ["/map", "nav.map"],
  ["/ranking", "nav.ranking"],
  ["/methodology", "nav.methodology"],
  ["/roadmap", "nav.roadmap"],
  ["/changelog", "nav.changelog"],
] as const;

export async function SiteHeader() {
  const { t } = await getI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-primary px-3 py-2 text-primary-fg">
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex min-h-[44px] items-center gap-2 font-bold">
          <span aria-hidden className="inline-block h-6 w-6 rounded bg-gradient-to-br from-[#2b5c8a] to-[#b35806]" />
          TSG Map
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([href, key]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-surface">
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <details className="relative lg:hidden">
            <summary className="btn btn-secondary list-none cursor-pointer">{t("nav.menu")}</summary>
            <nav aria-label="Mobile" className="absolute right-0 mt-2 w-56 card p-2 shadow-lg">
              {LINKS.map(([href, key]) => (
                <Link key={href} href={href} className="block rounded-md px-3 py-3 hover:bg-surface">
                  {t(key)}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
