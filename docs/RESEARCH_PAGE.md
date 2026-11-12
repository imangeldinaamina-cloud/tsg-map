# Research page — `/research`

Live: https://tsg-map.vercel.app/research (part of the TSG Map site, linked from the header as «Исследование»).

## Files

| What | Where |
|---|---|
| **All text, numbers, quotes, image paths** | `content/research.json` ← the only file you normally edit |
| Photos, maps, screenshots, PDFs | `public/research/` (create the folder) |
| Page layout | `src/app/research/page.tsx` |
| Styles (colours, fonts, cards) | `src/app/research/research.css` |
| Interactive parts (TSG demo, gallery, language switch, scroll reveal) | `src/components/research/client.tsx` |
| Logo, icons, placeholder rendering | `src/components/research/bits.tsx` |
| Favicon / social preview image | `src/app/research/icon.svg`, `src/app/research/opengraph-image.tsx` |
| Placeholder checker | `scripts/research-placeholders.mjs` |

## Editing content

Text fields are either a plain string (Russian) or an object per language:

```json
"title": { "ru": "Результаты", "en": "Results", "kk": "Нәтижелер" }
```

A missing language falls back to Russian. The page language follows the site‑wide switch (RU / EN / KZ buttons in the page menu, or the selector in the header).

### Placeholders

Anything in square brackets — `[ЦИТАТА 1]`, `[ДАТА]`, `[..]` — is drawn on the page with a striped yellow highlight, and a strip at the top of the page shows how many are left. Nothing in brackets can be mistaken for real content. Replace the bracketed text with the real value (remove the brackets).

List every slot that is still empty:

```bash
npm run research:check
```

It exits with code 1 while anything is left, so you can run it before each deploy.

### Photos, maps, screenshots

1. Put the file in `public/research/`, e.g. `public/research/map-day.png`. Prefer `.webp` or `.jpg` under ~400 KB; SVG works for maps.
2. In `content/research.json` set `"src": "/research/map-day.png"` (it is `null` now) and write a real `alt` (what the image shows, for screen readers).
3. Gallery items also take `caption` and `date`. **Blur faces of bystanders before uploading.** Only your own photos.

Image slots: `problem.maps` (2), `results.maps` (3), `appSection.screenshots` (3), `gallery.tabs[*].items` (10). Add or remove gallery items freely — the masonry layout adapts.

### Quotes and interviews

`interviews.cards` has 10 cards: `type`, `years`, `quote`, `rating` (number out of 5), `liked`, `confused`. No names, no shop names, no faces unless you have written permission. Fill `interviews.summary` (SUS, task success, comments, changes) and `interviews.match.rows` (place → experience → TSG class → match).

### Formulas

Formulas are LaTeX in the `tex` field (rendered on the server with KaTeX, so there is no extra JavaScript). In JSON every backslash is doubled: `\\frac{a}{b}`. `texEn` is an optional English version (used only where the formula contains words).

### Downloads

`sources.downloads[*].href` is `null` now. Put the PDFs into `public/research/` and set e.g. `"href": "/research/stand.pdf"`; then delete the `note` placeholder.

### App link and QR

`app.url` drives both the big button and both QR codes (generated automatically at build time). It currently points to `https://tsg-map.vercel.app/city` (the analysis workspace); change it to `https://tsg-map.vercel.app/` if you prefer the landing page.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/research.

## Deploy (Vercel)

The site is already a Vercel project (`tsg-map`). After editing:

```bash
npm run research:check
npm run build
npx vercel deploy --prod
```

`npm run build` must pass before deploying. If the repo is later connected to GitHub in the Vercel dashboard, every push to `main` deploys automatically and the last command is not needed.

## Placeholder checklist

Status on the first build: **153 slots** (run `npm run research:check` for the live list with exact JSON paths).

- [ ] **Problem** — 2 map images (`problem.maps[0..1].src`): registry map, daytime map
- [ ] **Results** — 3 map images (`results.maps[0..2].src`): residents, daytime presence, TSG by day
- [ ] **App** — 3 screenshots with captions and alt text (`appSection.screenshots`)
- [ ] **Interviews** — dates, format, session length (`interviews.intro`)
- [ ] **Interviews** — 3 tasks (`interviews.method.tasks`)
- [ ] **Interviews** — 10 cards × business type, years, quote, rating, liked, confused
- [ ] **Interviews** — average SUS, task success %, 3 comments, 3 changes
- [ ] **Interviews** — "did the model match" table (3 rows) and the total
- [ ] **Gallery** — 10 photos with caption, date, alt (4 tabs)
- [ ] **Gallery** — 6 dates in the project timeline
- [ ] **Sources** — stand PDF and research paper PDF links
- [ ] **Footer** — author, school, supervisor (all optional — delete the field values you don't want shown), contact email

### Also check before publishing widely

- [ ] **App section text vs. the live app.** `appSection.how` and `appSection.arch` describe the app as in your brief (hex map of 355 cells, opening hours, expected market share, recommended hours; Python → ~150 KB file → JavaScript, no server). The app currently deployed at `/city` is different: a 250 m square grid built from OSM + WorldPop, a server endpoint for walking distances, and no opening‑hours / market‑share inputs. Either update the app or reword these lines so the jury doesn't find a mismatch.
- [ ] **References** — full titles in `sources.refs` were written from the standard citations; compare with your paper's bibliography.
- [ ] **Kazakh text** — headings and key sentences in `kk` need a native‑speaker check.
- [ ] **Site footer** says the site has no images or video (`common.footerNote` in `src/i18n/*.ts`). Once you add photos to the gallery, update that sentence.
