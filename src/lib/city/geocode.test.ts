import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalize, search, splitCrossing, StreetIndex } from "./geocode";

const idx: StreetIndex = JSON.parse(readFileSync(new URL("../../../public/data/taldykorgan/streets.json", import.meta.url), "utf8"));

describe("street search", () => {
  it("normalizes street words and Kazakh letters", () => {
    expect(normalize("ул. Жансүгірова")).toBe("жансугирова");
    expect(normalize("проспект Абая")).toBe("абая");
  });
  it("splits crossings", () => {
    expect(splitCrossing("Абая и Шевченко")).toEqual(["Абая", "Шевченко"]);
    expect(splitCrossing("Абая / Шевченко")).toEqual(["Абая", "Шевченко"]);
    expect(splitCrossing("Кабанбай-батыра")).toBeNull();
  });
  it("finds a street", () => {
    const h = search(idx, "Шевченко");
    expect(h[0]?.kind).toBe("street");
    expect(h[0]?.label).toMatch(/Шевченко/);
  });
  it("finds a crossing in either order", () => {
    const h1 = search(idx, "Назарбаева и Шевченко");
    const h2 = search(idx, "Шевченко / Назарбаева");
    expect(h1.length).toBeGreaterThan(0);
    expect(h1[0].kind).toBe("crossing");
    expect(h2.length).toBeGreaterThan(0);
  });
});
