import { getI18n } from "@/i18n/server";
import { CHANGELOG } from "@/data/changelog";
import osm from "@/data/osm/services.json";
import { POPULATION_SOURCE } from "@/data/population";

export default async function Methodology() {
  const { t, tl } = await getI18n();
  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
  return (
    <article className="prose-tsg mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("methodology.title")}</h1>
      <p className="mt-2 text-lg text-muted">{t("methodology.intro")}</p>
      <nav aria-label="TOC" className="card mt-6 p-4 text-sm">
        <ul className="!list-none !pl-0 grid gap-1 sm:grid-cols-2">
          {[
            ["formula", "formulaTitle"],
            ["counting", "countingTitle"],
            ["sources", "sourcesTitle"],
            ["validation", "validationTitle"],
            ["limits", "limitsTitle"],
            ["privacy", "privacyTitle"],
          ].map(([id, k]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-primary underline">{t(`methodology.${k}`)}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="formula" title={t("methodology.formulaTitle")}>
        <p className="my-3 rounded-lg bg-surface p-4 text-center font-mono text-xl font-bold">TSG = (D − S) / (D + S)</p>
        <p>{t("methodology.formulaText")}</p>
        <p className="mt-2">{t("methodology.formulaEdge")}</p>
        <h3 className="mt-4 font-semibold">{t("methodology.dTitle")}</h3>
        <ul>
          <li>{t("methodology.dDynamic")}</li>
          <li>{t("methodology.dStatic")}</li>
        </ul>
        <h3 className="mt-4 font-semibold">{t("methodology.sTitle")}</h3>
        <p>{t("methodology.sText")}</p>
        <h3 className="mt-4 font-semibold">{t("methodology.slotsTitle")}</h3>
        <p>{t("methodology.slotsText")}</p>
      </Section>

      <Section id="counting" title={t("methodology.countingTitle")}>
        <ol>{tl("methodology.counting").map((x) => <li key={x}>{x}</li>)}</ol>
      </Section>

      <Section id="sources" title={t("methodology.sourcesTitle")}>
        <ul>{tl("methodology.sources").map((x) => <li key={x}>{x}</li>)}</ul>
        <dl className="card mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-4 text-sm">
          <dt className="font-semibold">OSM extracted_at</dt>
          <dd>{osm.extracted_at}</dd>
          <dt className="font-semibold">OSM snapshot</dt>
          <dd>{osm.osm_base ?? "?"}</dd>
          <dt className="font-semibold">OSM objects</dt>
          <dd>{osm.count}</dd>
          <dt className="font-semibold">Population</dt>
          <dd>{POPULATION_SOURCE.name ?? `${t("common.placeholder")} — ${t("detail.reasonPopulation")}`}</dd>
        </dl>
        <h3 className="mt-4 font-semibold">{t("methodology.categoriesTitle")}</h3>
        <p className="text-sm">{t("methodology.categoriesText")}</p>
        <h3 className="mt-4 font-semibold">{t("methodology.levelsTitle")}</h3>
        <p className="text-sm">{t("methodology.levelsText")}</p>
        <h3 className="mt-4 font-semibold">{t("methodology.qualityTitle")}</h3>
        <p className="text-sm">{t("methodology.qualityText")}</p>
      </Section>

      <Section id="validation" title={t("methodology.validationTitle")}>
        <ul>{tl("methodology.validation").map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-2 rounded-md border border-demo-border bg-demo-bg p-3 text-sm font-medium text-demo-fg">{t("methodology.validationStatus")}</p>
      </Section>

      <Section id="limits" title={t("methodology.limitsTitle")}>
        <ul className="rounded-lg border-2 border-demo-border bg-demo-bg p-4 pl-8 text-demo-fg">
          {tl("methodology.limits").map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Section>

      <Section id="privacy" title={t("methodology.privacyTitle")}>
        <p>{t("methodology.privacyText")}</p>
      </Section>
      <p className="mt-8 text-xs text-muted">v{CHANGELOG[0].version}</p>
    </article>
  );
}
