// Content of the /research page lives in content/research.json (editable without touching code).
import raw from "../../../content/research.json";
import type { Locale } from "@/i18n";

/** A text field: plain Russian string, or per-language strings (missing language → Russian). */
export type L = string | { ru: string; en?: string; kk?: string };

export const content = raw;
export type ResearchContent = typeof raw;

export function pick(v: L | null | undefined, locale: Locale): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return v[locale] ?? v.ru;
}

/** A placeholder is any text in square brackets, e.g. [QUOTE 1] or [..]. */
export const PLACEHOLDER = /\[[^\]]*\]/;
const SKIP_KEYS = new Set(["_readme", "tex", "texEn"]);

export interface Gap {
  path: string;
  text: string;
}

/** Every unfilled slot: bracketed text, an image with src null, a download with href null. */
export function findGaps(node: unknown = raw, path = ""): Gap[] {
  if (typeof node === "string") return PLACEHOLDER.test(node) ? [{ path, text: node }] : [];
  if (Array.isArray(node)) return node.flatMap((v, i) => findGaps(v, `${path}[${i}]`));
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: Gap[] = [];
    if ("src" in obj && obj.src === null) out.push({ path: `${path}.src`, text: "image not supplied" });
    if ("href" in obj && obj.href === null && !obj.soon) out.push({ path: `${path}.href`, text: "link not supplied" });
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      // Count each localized field once (by its Russian text).
      if (k === "en" || k === "kk") continue;
      out.push(...findGaps(v, path ? `${path}.${k}` : k));
    }
    return out;
  }
  return [];
}
