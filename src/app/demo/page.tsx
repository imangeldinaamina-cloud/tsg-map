import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { content as c, pick, type L } from "@/lib/research/content";
import { DemoPlayer, type DemoText } from "./DemoPlayer";
import "../research.css";
import "./demo.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: pick(c.demo.title, locale), robots: { index: false } };
}

type Deep<T> = T extends { ru: string } ? string : T extends (infer U)[] ? Deep<U>[] : T extends object ? { [K in keyof T]: Deep<T[K]> } : T;
function deep<T>(o: T, p: (v: L) => string): Deep<T> {
  if (Array.isArray(o)) return o.map((x) => deep(x, p)) as Deep<T>;
  if (o && typeof o === "object") {
    if ("ru" in (o as object)) return p(o as unknown as L) as Deep<T>;
    return Object.fromEntries(Object.entries(o as object).map(([k, v]) => [k, deep(v, p)])) as Deep<T>;
  }
  return o as Deep<T>;
}

/** Seven-minute defence: a five-step, full-screen walk through the published research data. No login, no popups. */
export default async function DemoPage() {
  const { locale } = await getI18n();
  const p = (v: L) => pick(v, locale);
  const t: DemoText = {
    ...deep(c.demo, p),
    legend: { def: p(c.results.map.legendDef), bal: p(c.results.map.legendBal), sur: p(c.results.map.legendSur), noServ: p(c.results.map.x.legendNoService), few: p(c.results.map.x.legendFew) },
    classes: { deficit: p(c.results.map.x.classes.deficit), balance: p(c.results.map.x.classes.balance), surplus: p(c.results.map.x.classes.surplus) },
    share: c.results.example.share.options.map((o) => ({ hours: o.hours, morning: o.v[0] })),
  };
  return <DemoPlayer t={t} decimal={locale === "en" ? "." : ","} />;
}
