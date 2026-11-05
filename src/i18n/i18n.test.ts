import { describe, expect, it } from "vitest";
import en from "./en";
import kk from "./kk";
import ru from "./ru";

function keys(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null || Array.isArray(o)) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
function placeholders(o: unknown, prefix = ""): Record<string, string> {
  if (typeof o === "string") return { [prefix]: (o.match(/\{\w+\}/g) ?? []).sort().join(",") };
  if (Array.isArray(o) || typeof o !== "object" || o === null) return {};
  return Object.assign({}, ...Object.entries(o).map(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k)));
}

describe("i18n dictionaries", () => {
  it.each([["kk", kk], ["en", en]])("%s has the same keys as ru", (_, d) => {
    expect(keys(d).sort()).toEqual(keys(ru).sort());
  });
  it.each([["kk", kk], ["en", en]])("%s uses the same {placeholders} as ru", (_, d) => {
    expect(placeholders(d)).toEqual(placeholders(ru));
  });
});
