import { getI18n } from "@/i18n/server";

export default async function Privacy() {
  const { t, tl } = await getI18n();
  // PLACEHOLDER: set NEXT_PUBLIC_CONTACT_EMAIL to a real contact address before launch.
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || `[${t("common.placeholder")}: NEXT_PUBLIC_CONTACT_EMAIL]`;
  return (
    <div className="prose-tsg mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("privacy.title")}</h1>
      <ul className="mt-4 space-y-2">{tl("privacy.items").map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="mt-6 font-medium">{t("privacy.contact", { email })}</p>
    </div>
  );
}
