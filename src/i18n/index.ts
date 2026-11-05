import en from "./en";
import kk from "./kk";
import ru, { Dict } from "./ru";

export const LOCALES = ["ru", "kk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "lang";
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", kk: "Қазақша", en: "English" };

const DICTS: Record<Locale, Dict> = { ru, kk, en };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

type Params = Record<string, string | number>;

function lookup(dict: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), dict);
}

export function interpolate(s: string, params?: Params) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function makeT(dict: Dict) {
  const t = (key: string, params?: Params): string => {
    const v = lookup(dict, key) ?? lookup(ru, key);
    return typeof v === "string" ? interpolate(v, params) : key;
  };
  const tl = (key: string): string[] => {
    const v = lookup(dict, key) ?? lookup(ru, key);
    return Array.isArray(v) ? (v as string[]) : [];
  };
  return { t, tl };
}

export type { Dict };
