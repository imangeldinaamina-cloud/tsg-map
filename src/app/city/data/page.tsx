import { getI18n } from "@/i18n/server";
import { DataSources } from "./DataSources";

export default async function CityDataPage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-3 text-2xl font-bold">{t("city.data.title")}</h1>
      <DataSources />
    </div>
  );
}
