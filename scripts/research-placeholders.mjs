// Lists every unfilled slot in content/research.json: [BRACKETED] text, images with src null, links with href null.
// Usage: npm run research:check   (exit code 1 while anything is left, so it can gate a release)
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../content/research.json", import.meta.url), "utf8"));
const SKIP = new Set(["_readme", "tex", "texEn", "en", "kk"]);
const out = [];

function walk(node, path) {
  if (typeof node === "string") {
    if (/\[[^\]]*\]/.test(node)) out.push([path, node]);
    return;
  }
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (node && typeof node === "object") {
    if ("src" in node && node.src === null) out.push([`${path}.src`, "(image not supplied → put a file in public/research/ and set its path)"]);
    if ("href" in node && node.href === null) out.push([`${path}.href`, "(link not supplied)"]);
    for (const [k, v] of Object.entries(node)) if (!SKIP.has(k)) walk(v, path ? `${path}.${k}` : k);
  }
}
walk(data, "");

const bySection = new Map();
for (const [p, t] of out) {
  const s = p.split(/[.[]/)[0];
  if (!bySection.has(s)) bySection.set(s, []);
  bySection.get(s).push([p, t]);
}
for (const [s, rows] of bySection) {
  console.log(`\n■ ${s} (${rows.length})`);
  for (const [p, t] of rows) console.log(`  ${p}\n      ${t}`);
}
console.log(`\n${out.length} placeholder(s) left in content/research.json`);
process.exit(out.length ? 1 : 0);
