import { CHANGELOG } from "@/data/changelog";
import { getI18n } from "@/i18n/server";

export default async function Changelog() {
  const { t, locale } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("changelog.title")}</h1>
      <ol className="mt-6 space-y-6">
        {CHANGELOG.map((c) => (
          <li key={c.version} className="card p-5">
            <h2 className="text-lg font-bold">
              v{c.version} <time dateTime={c.date} className="ml-2 text-sm font-normal text-muted">{c.date}</time>
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {c.items[locale].map((x) => <li key={x}>{x}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
