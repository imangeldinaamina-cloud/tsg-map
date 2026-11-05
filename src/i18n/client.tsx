"use client";
import { createContext, useContext, useMemo } from "react";
import { Dict, getDict, Locale, makeT } from "./index";

const Ctx = createContext<{ locale: Locale; dict: Dict } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict: getDict(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n outside provider");
  return useMemo(() => ({ locale: ctx.locale, ...makeT(ctx.dict) }), [ctx]);
}
