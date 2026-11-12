# Home page (research project) — `/`

Live: https://tsg-map.vercel.app/ — this is the site's home page. The old address `/research` redirects here.

## Files

| What | Where |
|---|---|
| **All text, numbers, quotes, image paths** | `content/research.json` ← the only file you normally edit |
| Photos, maps, screenshots, PDFs | `public/research/` (create the folder) |
| Page layout | `src/app/page.tsx` |
| Styles (colours, fonts, cards) | `src/app/research.css` |
| Interactive parts (TSG demo, gallery, language switch, scroll reveal) | `src/components/research/client.tsx` |
| Logo, icons, placeholder rendering | `src/components/research/bits.tsx` |
| Favicon / social preview image | `src/app/icon.svg`, `src/app/opengraph-image.tsx` |
| Placeholder checker | `scripts/research-placeholders.mjs` |

## Page structure

1. **Hero** — full-screen city photo (`hero.photo`), headline (`hero.headline`; words between `*stars*` are set in the italic serif), «Открыть карту» → `app.url`.
2. **Explore the map** (`explore`) — list of links with arrows: Taldykorgan → `/city`, model data → `/city/data`, methodology → `/methodology`, «Другие средние города» marked *soon* (`"href": null, "soon": true` — not clickable, not counted as a placeholder). Add a city by adding an item with a real `href`.
3. **Research** (dark) — sections 01–09 from the content below, with a sticky index.
4. **Guide** (`guide`) — 5 steps describing the real `/city` app (tabs «Население / Дефицит услуг / Локация», time of day, category, cell click, data link). Update if the app changes.
5. **Contacts** (`contacts.items`) — email (`kind: "email"` → mailto link), Telegram (`kind: "telegram"`, e.g. `@name` → t.me link), author, school, supervisor. Delete an item to hide it.

The site-wide header and footer are hidden on this page; it has its own top bar and footer.

### Street search on /city

The search box on `/city` finds a street or an intersection («Абая и Жансугурова», «Абая / Жансугурова») offline, from `public/data/taldykorgan/streets.json`. Rebuild it after a new OSM snapshot with `npm run city:streets`. An intersection opens the full Location analysis; a street lists the cells along it with the largest gap. A link like `/city?tab=location&at=45.01724,78.37552&label=...` opens the analysis of that point directly.

### Agent model on /city

`/city` shows time-of-day presence from the author's agent-based model by default (switch «Агентная модель TSG / Свои допущения» in the panel, URL `src=assume` for the latter). Source: `data/agent-model/taldykorgan.json` — the 355-hex model output exported from the prototype, with a georeference fitted on 162 facilities matched by name with OSM (median error ≈ 0.2 m). `npm run city:agent` lays it onto the 250 m grid (`public/data/taldykorgan/agent-presence.json`): each square cell takes the share of its hexagon in proportion to WorldPop residents, totals are matched to the WorldPop resident count, and the outskirts outside the model keep residents. Model slots → app periods: morning 07–11 → «Утро», day 11–16:30 → «День» and «После обеда», evening 16:30–22 → «Вечер». After re-running the model, replace the JSON and run `npm run city:agent`.

### Photos used

Both are from Pexels (free licence, attribution not required but given on the page) and show **Almaty, not Taldykorgan** — the credit says so. To use your own photo of Taldykorgan, replace `public/research/city-hero.jpg` (landscape, ≥ 2000 px wide) and update `hero.photo.alt` / `credit`.

- `city-hero.jpg` — https://www.pexels.com/photo/aerial-view-of-almaty-city-with-mountain-backdrop-31189131/ (Nursultan’s Photos)
- `city-aerial.jpg` — https://www.pexels.com/photo/aerial-view-of-almaty-city-suburban-landscape-37754575/ (Konevi)

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

`sources.downloads` is empty, so no download buttons are shown. To offer a PDF, put it into `public/research/` and add `{ "label": {"ru": "…"}, "href": "/research/file.pdf" }` (the page code for buttons was removed while the list is empty — re-add it in `src/app/page.tsx` if needed).

### App link and QR

`app.url` drives both the big button and both QR codes (generated automatically at build time). It currently points to `https://tsg-map.vercel.app/city` (the analysis workspace); change it to `https://tsg-map.vercel.app/` if you prefer the landing page.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/.

## Deploy (Vercel)

The site is already a Vercel project (`tsg-map`). After editing:

```bash
npm run research:check
npm run build
npx vercel deploy --prod
```

`npm run build` must pass before deploying. If the repo is later connected to GitHub in the Vercel dashboard, every push to `main` deploys automatically and the last command is not needed.

## Placeholder checklist

Status now: **0 slots**. Interviews show the real method and «testing in progress» until there are real results; gallery shows the author's own YOLO frames with heads blurred (run `npm run research:check` for the live list with exact JSON paths).

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
- [ ] **Contacts** — email, Telegram, author, school, supervisor (`contacts.items`; delete any you don't want shown)

### Also check before publishing widely

- [ ] **App section text vs. the live app.** `appSection.how` and `appSection.arch` describe the app as in your brief (hex map of 355 cells, opening hours, expected market share, recommended hours; Python → ~150 KB file → JavaScript, no server). The app currently deployed at `/city` is different: a 250 m square grid built from OSM + WorldPop, a server endpoint for walking distances, and no opening‑hours / market‑share inputs. Either update the app or reword these lines so the jury doesn't find a mismatch.
- [ ] **References** — full titles in `sources.refs` were written from the standard citations; compare with your paper's bibliography.
- [ ] **Kazakh text** — headings and key sentences in `kk` need a native‑speaker check.
- [ ] **Site footer** on other pages says the site has no images or video (`common.footerNote` in `src/i18n/*.ts`). It is hidden on /research, but now that the site has photos, consider updating that sentence.
