import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, getDict, isLocale, Locale, LOCALE_COOKIE, makeT } from "./index";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, ...makeT(getDict(locale)) };
}
