import Link from "next/link";
import { getI18n } from "@/i18n/server";

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>{t("common.footerNote")}</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link href="/methodology" className="underline">{t("nav.methodology")}</Link>
          <Link href="/privacy" className="underline">{t("nav.privacy")}</Link>
          <Link href="/roadmap" className="underline">{t("nav.roadmap")}</Link>
          <Link href="/changelog" className="underline">{t("nav.changelog")}</Link>
          <Link href="/admin" className="underline">{t("nav.admin")}</Link>
        </nav>
      </div>
    </footer>
  );
}
