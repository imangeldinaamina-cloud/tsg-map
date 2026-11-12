/** Offline street / intersection search over public/data/taldykorgan/streets.json (built by scripts/build-streets.mjs). */

export interface StreetIndex {
  streets: { n: string; a: string[]; p: [number, number][] }[];
  x: [number, number, number, number][]; // streetA, streetB, lat, lon
}

export type GeoHit =
  | { kind: "street"; street: number; label: string; score: number }
  | { kind: "crossing"; a: number; b: number; lat: number; lon: number; label: string; score: number };

// Kazakh letters -> nearest Russian ones, so "Жансүгіров" finds "Жансугурова".
const KK: Record<string, string> = { ә: "а", і: "и", ң: "н", ғ: "г", ү: "у", ұ: "у", қ: "к", ө: "о", һ: "х", ё: "е", й: "и" };
const STOP_WORDS = new Set(["улица", "ул", "проспект", "пр", "просп", "переулок", "пер", "бульвар", "б-р", "микрорайон", "мкр", "шоссе", "тупик", "проезд", "кошеси", "коше", "дангылы", "данг", "шагын", "ауданы", "street", "st", "avenue", "ave", "prospekt", "ulitsa"]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[әіңғүұқөһёй]/g, (ch) => KK[ch] ?? ch)
    .replace(/[«»"'`.()№]/g, " ")
    .replace(/[-‐–—]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(" ");
}

/** Splits "Абая и Шевченко", "Абая / Шевченко", "Абая x Шевченко" into two parts; null when it is one street. */
export function splitCrossing(q: string): [string, string] | null {
  const m = q.split(/\s+(?:и|және|and|x|х|×)\s+|\s*[/&+×]\s*|\s*,\s*/i).map((s) => s.trim()).filter(Boolean);
  return m.length === 2 ? [m[0], m[1]] : null;
}

/** 0..1: how well a normalized query matches one street (any of its names). */
export function matchScore(qn: string, names: string[]): number {
  if (!qn) return 0;
  let best = 0;
  for (const raw of names) {
    const n = normalize(raw);
    if (!n) continue;
    let s = 0;
    if (n === qn) s = 1;
    else if (n.startsWith(qn)) s = 0.9;
    else if (n.split(" ").some((w) => w.startsWith(qn))) s = 0.8;
    else if (n.includes(qn)) s = 0.6;
    else {
      // every query word must start some name word ("кабанбай батыр" ~ "кабанбай батыра")
      const words = qn.split(" ");
      const nw = n.split(" ");
      if (words.length > 1 && words.every((w) => nw.some((x) => x.startsWith(w.slice(0, Math.max(3, w.length - 2)))))) s = 0.7;
      // tolerate a lost ending: "жансугурова" vs "жансугуров"
      else if (qn.length >= 5 && nw.some((x) => x.startsWith(qn.slice(0, qn.length - 2)))) s = 0.5;
    }
    if (s > best) best = s;
  }
  return best;
}

function streetsFor(idx: StreetIndex, q: string): { i: number; s: number }[] {
  const qn = normalize(q);
  return idx.streets
    .map((st, i) => ({ i, s: matchScore(qn, [st.n, ...st.a]) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || idx.streets[a.i].n.length - idx.streets[b.i].n.length);
}

export function search(idx: StreetIndex, q: string, limit = 8): GeoHit[] {
  if (normalize(q).length < 2) return [];
  const pair = splitCrossing(q);
  if (pair) {
    const A = streetsFor(idx, pair[0]).slice(0, 6);
    const B = streetsFor(idx, pair[1]).slice(0, 6);
    const sa = new Map(A.map((r) => [r.i, r.s]));
    const sb = new Map(B.map((r) => [r.i, r.s]));
    const hits: GeoHit[] = [];
    for (const [a, b, lat, lon] of idx.x) {
      const s1 = (sa.get(a) ?? 0) * (sb.get(b) ?? 0);
      const s2 = (sa.get(b) ?? 0) * (sb.get(a) ?? 0);
      const score = Math.max(s1, s2);
      if (score > 0) {
        const [first, second] = s1 >= s2 ? [a, b] : [b, a];
        hits.push({ kind: "crossing", a: first, b: second, lat, lon, label: `${idx.streets[first].n} × ${idx.streets[second].n}`, score });
      }
    }
    return hits.sort((x, y) => y.score - x.score).slice(0, limit);
  }
  return streetsFor(idx, q)
    .slice(0, limit)
    .map((r) => ({ kind: "street" as const, street: r.i, label: idx.streets[r.i].n, score: r.s }));
}

/** Crossings along one street, for "pick a crossing on this street". */
export function crossingsOf(idx: StreetIndex, street: number): GeoHit[] {
  return idx.x
    .filter(([a, b]) => a === street || b === street)
    .map(([a, b, lat, lon]) => {
      const other = a === street ? b : a;
      return { kind: "crossing" as const, a: street, b: other, lat, lon, label: `${idx.streets[street].n} × ${idx.streets[other].n}`, score: 1 };
    });
}
