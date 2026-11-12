# TSG Map

A web app for Taldykorgan (Kazakhstan) that shows **where and when services are missing**, using the
Temporal Service Gap index:

```
TSG = (D − S) / (D + S)        range −1 … +1, positive = shortage
```

- **D** (demand): people present in a time slot (dynamic mode), or registered residents (static mode)
- **S** (supply): OpenStreetMap services within walking distance (default 500 m, configurable)
- Slots: morning 08–10, midday 12–14, evening 17–19

The app has two parts:

- **City analysis (`/city`)** — the spatial-intelligence workspace: WorldPop population on a 250 m grid,
  OSM facilities and walk network, a configurable temporal presence model, the Service Gap Index and a
  candidate-location comparison. Data sources and limitations: `/city/data`.
- **Field TSG map (`/map`)** — observation points measured in the field (camera counts), ranking and admin import.

Stack: Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · MapLibre GL + OSM raster tiles · Supabase (Postgres + admin auth) · Vitest.

---

## What is real vs demo

| Part | Status | Where | Notes |
|---|---|---|---|
| TSG formula | ✅ Real | `src/lib/tsg.ts` | Tested: D=S=0 → undefined (`null`), only D → +1, only S → −1 |
| Services (S) | ✅ Real, OSM | `src/data/osm/services.json` | 575 places, extracted 2026-11-05 via an Overpass mirror; **OSM snapshot date 2026-06-01** (the mirror lags). OSM coverage is incomplete. Re-run `npm run osm:fetch`. |
| People present (D, dynamic) | ⏳ **No real data yet** | admin import → `observations` table | Imported via `/admin` CSV. Until then the map shows demo data. |
| Demo points + counts | ⚠️ **DEMO, synthetic** | `src/data/demo/demo-data.ts` | 10 arbitrary locations, invented numbers. Always shown with a "DEMO DATA" banner and badges. Never mixed with real data. |
| Residents (D, static) | ⚠️ **PLACEHOLDER** | `src/data/population.ts` | All `null` for real points → static mode shows "population not provided". Demo points have demo population. |
| Detector accuracy | ⚠️ Not verified | methodology page | YOLOv8n counts not yet manually checked. |
| Validation (holdout, block CV, survey) | 📝 Plan only | methodology page | No results yet. |
| Feedback, analytics, waitlist | ✅ Real (stored) | Supabase or `.data/` locally | No personal data except waitlist email with consent. |
| **City analysis** | | | |
| City boundary | ✅ Real, OSM | `public/data/taldykorgan/boundary.json` | OSM relation 3392135 (city akimat, admin_level 6) — includes surrounding settlements. |
| Walk network | ✅ Real, OSM | `roads.json`, `src/data/city/graph.json` | 5 867 walkable ways, ~2 055 km, largest connected component (OSM snapshot 2026-11-05). Street centrelines, sidewalks rarely mapped. |
| Facilities (6 categories) | ✅ Real, OSM | `facilities.json` | 585 objects; tag rules in `scripts/build-city.mjs` and `src/lib/city/types.ts`. OSM is incomplete (e.g. only 44 pharmacies) → gaps are overstated. |
| Residents | ✅ Real, WorldPop | `grid.json` | WorldPop Global2 R2025A constrained 100 m, 2021 (CC BY 4.0): 176 584 people in the boundary, summed into 2 475 cells of 250 m. A model, not a count. |
| Census 2021 total | ⏳ Not loaded | model settings | Optional proportional rescaling once you enter the verified figure. |
| Presence by time of day | ✅ Agent model (default) | `data/agent-model/`, `agent-presence.json` | The author's agent-based model (≈17 k agents, 100 runs) laid onto the 250 m grid (`npm run city:agent`). Users can switch to their own assumptions (`src/lib/city/model.ts`). Video check (H2) not confirmed yet — see `research/H2_REPORT.md`. |
| Walking access | ✅ Computed | `access.json` | Dijkstra on the walk network, ≤1 200 m, from cell centres. |
| Service Gap Index | ✅ Computed | `src/lib/city/gap.ts` | TSG formula on city-wide shares; tested. |
| Location assessment | ✅ Rule-based | `src/lib/city/location.ts`, `/api/location` | Explainable comparisons with numbers; no revenue prediction. |
| Kazakh translation | ⚠️ Draft | `src/i18n/kk.ts` | Needs review by a native speaker. |
| Payments | ❌ Not built (by design) | — | Freemium is a test: "Pro" gate + waitlist + click counting + free preview. |

---

## Engineering at a glance

- **Reproducible data:** `npm run data:all` rebuilds everything the app serves from raw open data
  (OSM → grid, walk graph, facilities; WorldPop → residents; street index; agent model → grid).
  The agent model itself: `research/agent_model/` (Python, see its README).
- **Tests:** `npm test` (Vitest) — TSG formula properties, gap index, street search, agent-model totals,
  weighted median; Python property test `research/agent_model/code/test_tsg_properties.py`.
- **Research scripts (open, re-runnable):**
  - `research/h2_calibrate.py` — model vs video (H2) with bootstrap CIs and the video→schedule calibration loop
    with leave-one-point-out validation → `research/H2_REPORT.md`.
  - `research/yolo_error.py` + `research/manual-count/index.html` — YOLOv8 accuracy against a manual count.
  - `research/entrepreneur_check.py` — precision/recall of TSG classes against entrepreneurs' "good/bad" places.
- **Privacy by design:**
  - street / intersection search runs in the browser on a bundled index — typed addresses are never sent;
  - the walking-distance API receives only coordinates and stores nothing;
  - analytics events carry no identifiers;
  - bystanders' heads are blurred in every published video frame; raw videos are not published;
  - 2GIS data is used only locally for the model (licence) and is gitignored.

### 60-second demo

1. Open https://tsg-map.vercel.app → «Открыть карту».
2. Type «Абая и Жансугурова» → Enter. The point appears with a one-line verdict
   («Аптеки здесь (день): …») and «Лучше рядом: ячейка … в … м» → «Проверить её».
3. Switch «Утро / День / Вечер»: presence comes from the agent model, numbers change.
4. Tab «Население» → «Изменение»: by day the centre fills, residential districts empty.
5. Share the analysis: the URL `/city?tab=location&at=…` reopens the same point.

## Home page — research project (/)

The home page is the school research project page (`src/app/page.tsx`; the old `/research` URL redirects to `/`). All its text, numbers, quotes and image paths live in `content/research.json`; see [docs/RESEARCH_PAGE.md](docs/RESEARCH_PAGE.md) for how to edit it, add photos and deploy, and run `npm run research:check` to list unfilled placeholders.

## City data pipeline

```bash
npm run city:build              # builds public/data/taldykorgan/* and src/data/city/graph.json
npm run city:build -- --refresh # re-download OpenStreetMap (raw files are cached in ./data-raw, gitignored)
```

Downloads the WorldPop raster (~50 MB) on first run. Pure Node (`geotiff`), no GDAL/Python needed.

### City analysis methods

- **Baseline**: WorldPop residents per 250 m cell; optional census rescaling `R' = R · census / ΣR`.
- **Temporal model** (only when you set it): `P(i,t) = s(t)·R(i) + (1 − s(t))·ΣR·w(i)/Σw`, `w(i) = Σ β_k · count_k(i)`
  over OSM attractor counts (shops, food, offices/public services, education, health, markets). Total population is conserved.
- **Walking access**: shortest path on OSM walkable ways (`foot!=no`, `access!=private`), plus straight-line snap to the network.
- **Service Gap Index**: `SGI = (d − s)/(d + s)`, `d = P(i)/ΣP`, `s = S(i)/ΣS`, `S(i)` = facilities within the catchment
  (400/800/1 200 m). Each facility counts 1; no distance decay. "Potentially underserved" = SGI ≥ 0.5 and presence ≥ median populated cell.
- **Location assessment**: residents/presence within the walk catchment, competitors, nearest competitor, people per outlet
  `P/(competitors+1)`, walk-network length and intersections, cell SGI → rule-based findings (see `assess()`).

## Setup

```bash
npm install
cp .env.example .env.local   # optional for local dev, see below
npm run dev                  # http://localhost:3000
npm test                     # unit tests (TSG, CSV importer, aggregation, i18n parity)
```

**Without Supabase** (no `.env.local`), the app runs in **local dev mode**: imported observations,
feedback, analytics and waitlist entries go to `./.data/*.json` (git-ignored), and `/admin` needs no login.
This mode is disabled in production builds.

### Supabase (needed for production)

1. Create a project at supabase.com (your account).
2. SQL editor → run `supabase/migrations/0001_init.sql`.
3. Authentication → Users → **Add user** with email + password for each admin.
4. Fill `.env.local` (and Vercel env vars):

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (**server only, never commit**) |
| `ADMIN_EMAILS` | Comma-separated admin emails (must match users from step 3) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Public contact for privacy/deletion requests (shown on `/privacy`) |

### Deploy (Vercel)

1. Push this folder to a GitHub repository.
2. vercel.com → New Project → import the repo (framework auto-detected).
3. Add the environment variables above → Deploy.

### Map tiles

The map uses the public `tile.openstreetmap.org` server, which is fine for an MVP/demo but has a
[usage policy](https://operations.osmfoundation.org/policies/tiles/). For real traffic switch to a tile
provider (e.g. MapTiler, Stadia, or self-hosted) in `src/components/explorer/MapView.tsx`.

---

## Data format (observations CSV)

One row = one 10-minute observation session at one point.

| Column | Type | Rules |
|---|---|---|
| `point_id` | text | required, ≤ 64 chars |
| `point_type` | text | required, e.g. `residential`, `commercial`, `transit` |
| `lat`, `lon` | number | WGS84; warning if outside Taldykorgan bbox; decimal comma accepted |
| `date` | `YYYY-MM-DD` | valid date; warning on weekends (methodology = weekdays) |
| `time_start` | `HH:MM` | warning if outside the slot window |
| `slot` | `morning` \| `midday` \| `evening` | case-insensitive |
| `frames` | integer > 0 | warning if ≠ 20 (10 min × 30 s) |
| `mean_people_per_frame` | number ≥ 0 | presence = this value |
| `holdout` | `yes` \| `no` | validation points |

Comma, semicolon or tab separators and an Excel BOM are accepted. `(point_id, date, slot)` must be unique.
Rows with errors are skipped; warnings do not block import. The server re-validates with the same parser.
Re-importing the same `(point_id, date, slot)` overwrites it; "Replace all" wipes previous observations.

Aggregation: for each point and slot, D = mean of `mean_people_per_frame` across days.
Data-quality badge: 1 day = low, 2 = medium, ≥ 3 with full frames = good.

Template: `/admin` → "Download CSV template".

---

## Project layout

```
src/lib/tsg.ts             TSG formula, levels, colours (blue↔orange + symbols + text)
src/lib/csv-import.ts      CSV parser/validator (pure, tested)
src/lib/compute.ts         aggregation, service counting, ranking
src/lib/server/store.ts    Supabase / local JSON storage adapter
src/data/osm/              OSM extract (real) — scripts/fetch-osm.mjs
src/data/demo/             DEMO data (synthetic)
src/data/population.ts     population PLACEHOLDER
src/i18n/{ru,kk,en}.ts     all UI text; parity enforced by tests
src/app/                   pages: / (landing) /onboarding /map /ranking /methodology /roadmap /changelog /privacy /admin
supabase/migrations/       database schema + RLS
```

## Privacy

- Only aggregated counts are stored — no images, faces or video.
- Analytics: whitelisted event types with short scalar props; no cookies, no IP, no user agent, no user ID.
- Waitlist: email only, explicit consent checkbox, consent version stored.

## Freemium test

Free = map + one slot (midday, `FREE_SLOT` in `src/lib/domain.ts`). Pro = all slots, ranking, CSV export.
Locked features open a "Join Pro waitlist" modal (`pro_click` events counted) with an option to continue
in free preview mode during testing (`pro_preview`). Results are on `/admin`.
