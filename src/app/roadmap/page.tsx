import { getI18n } from "@/i18n/server";

export default async function Roadmap() {
  const { t, tl } = await getI18n();
  const cols = [
    ["now", "nowItems", "border-primary"],
    ["next", "nextItems", "border-slate-400"],
    ["later", "laterItems", "border-slate-300"],
  ] as const;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("roadmap.title")}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cols.map(([k, items, border]) => (
          <section key={k} className={`card border-t-4 ${border} p-5`} aria-labelledby={`rm-${k}`}>
            <h2 id={`rm-${k}`} className="text-lg font-bold">{t(`roadmap.${k}`)}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {tl(`roadmap.${items}`).map((x) => <li key={x}>{x}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
