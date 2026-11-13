import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter_Tight, Playfair_Display, Unbounded } from "next/font/google";
import katex from "katex";
import QRCode from "qrcode";
import "katex/dist/katex.min.css";
import "./research.css";
import { ImgSlot, StepIcon, Txt } from "@/components/research/bits";
import { Gallery, LangToggle, Reveal, TsgDemo } from "@/components/research/client";
import { ClassChange, FieldExplorer, Flow, MarketShare, PeopleMap, Schedule, TsgMap } from "@/components/research/viz";
import hexmap from "../../public/research/hexmap.json";
import type { Locale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { content as c, findGaps, L, pick } from "@/lib/research/content";

const sans = Inter_Tight({ subsets: ["latin", "cyrillic", "cyrillic-ext"], weight: ["400", "500", "600"], display: "swap", variable: "--font-rs-sans" });
const serif = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["400", "500"], style: ["italic", "normal"], display: "swap", variable: "--font-rs-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500"], display: "swap", variable: "--font-rs-mono" });
const wide = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["400", "600"], display: "swap", variable: "--font-rs-wide" });

const tsgSummary = Object.fromEntries(Object.entries(hexmap.summary).map(([k, v]) => [k, v.changed]));
const HEX_TEXT: Record<Locale, { slots: Record<string, string>; cats: Record<string, string>; timeLabel: string; catLabel: string; people: string; noValue: string; cell: string }> = {
  ru: { slots: { static: "По прописке", morning: "Утро", day: "День", evening: "Вечер" }, cats: { food: "Продукты", pharmacy: "Аптеки", catering: "Общепит" }, timeLabel: "Время суток", catLabel: "Услуга", people: "чел.", noValue: "нет оценки", cell: "Ячейка" },
  en: { slots: { static: "By registration", morning: "Morning", day: "Day", evening: "Evening" }, cats: { food: "Groceries", pharmacy: "Pharmacies", catering: "Food places" }, timeLabel: "Time of day", catLabel: "Service", people: "people", noValue: "not evaluated", cell: "Cell" },
  kk: { slots: { static: "Тіркеу бойынша", morning: "Таң", day: "Күндіз", evening: "Кеш" }, cats: { food: "Азық-түлік", pharmacy: "Дәріханалар", catering: "Тамақтану" }, timeLabel: "Тәулік уақыты", catLabel: "Қызмет", people: "адам", noValue: "бағаланбаған", cell: "Ұяшық" },
};

const OG_LOCALE: Record<Locale, string> = { ru: "ru_RU", en: "en_US", kk: "kk_KZ" };

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const title = pick(c.meta.title, locale);
  const description = pick(c.meta.description, locale);
  return {
    metadataBase: new URL(c.meta.siteUrl),
    title,
    description,
    alternates: { canonical: c.meta.path },
    openGraph: { title, description, url: c.meta.path, siteName: "TSG Map", type: "website", locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image", title, description },
  };
}

function math(tex: string, display = true) {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore" });
}

function Formula({ tex, texEn, locale, inline }: { tex: string; texEn?: string; locale: Locale; inline?: boolean }) {
  const src = locale === "en" && texEn ? texEn : tex;
  return <div className={inline ? "math math-inline" : "math"} dangerouslySetInnerHTML={{ __html: math(src, !inline) }} />;
}

/** "Text *accent* text" → the starred part in the italic serif. */
function Em({ s }: { s: string }) {
  return (
    <>
      {s.split(/(\*[^*]+\*)/).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? <em key={i}>{part.slice(1, -1)}</em> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

/** Each chapter has its own tone (background), type voice and header layout, on one shared palette. */
function Section({ id, n, title, kicker, tone, children }: { id: string; n: string; title: string; kicker: string; tone: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`sec tone-${tone}`}>
      <div className="wrap">
        <header className="sec-head reveal">
          <span className="sec-num" aria-hidden>
            {n}
          </span>
          <span className="sec-kicker">{kicker}</span>
          <h2 id={`${id}-h`} className="h2">
            <Em s={title} />
          </h2>
        </header>
        {children}
      </div>
    </section>
  );
}

function Bars({ bars, locale }: { bars: { label: L; value: number }[]; locale: Locale }) {
  return (
    <ul className="bars">
      {bars.map((b) => (
        <li key={b.value + pick(b.label, "ru")}>
          <span className="bar-label">{pick(b.label, locale)}</span>
          <span className="bar-track" aria-hidden>
            <span className="bar-fill" style={{ width: `${b.value}%` }} />
          </span>
          <span className="bar-val tabnum">{b.value}%</span>
        </li>
      ))}
    </ul>
  );
}

function AppCta({ qr, locale, label }: { qr: string; locale: Locale; label: string }) {
  const host = c.app.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="cta-block">
      <a href={c.app.url} className="btn btn-light">
        {label} <span aria-hidden>→</span>
      </a>
      <figure className="qr-card">
        <div className="qr" role="img" aria-label={`QR: ${c.app.url}`} dangerouslySetInnerHTML={{ __html: qr }} />
        <figcaption>
          <strong>{host}</strong>
          <span>{pick(c.app.qrCaption, locale)}</span>
        </figcaption>
      </figure>
    </div>
  );
}

function Contact({ kind, value, href }: { kind?: string; value: string; href?: string }) {
  if (/\[[^\]]*\]/.test(value)) return <Txt s={value} />;
  if (kind === "link" && href) return <a href={href}>{value}</a>;
  if (kind === "email") return <a href={`mailto:${value}`}>{value}</a>;
  if (kind === "telegram") return <a href={`https://t.me/${value.replace(/^@/, "")}`}>{value}</a>;
  if (kind === "social") {
    const h = value.replace(/^@/, "");
    return (
      <>
        {value}
        <span className="social-links">
          <a href={`https://instagram.com/${h}`}>Instagram</a>
          <a href={`https://t.me/${h}`}>Telegram</a>
        </span>
      </>
    );
  }
  return <>{value}</>;
}

export default async function HomePage() {
  const { locale } = await getI18n();
  const p = (v: L | null | undefined) => pick(v, locale);
  const dec = locale === "en" ? "." : ",";
  const qr = await QRCode.toString(c.app.url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#141215FF", light: "#FFFFFFFF" } });
  const gaps = findGaps().length;
  const r = c.results;
  const iv = c.interviews;
  const f = c.formulas;
  const openMap = p(c.site.openMap);
  const hexText = HEX_TEXT[locale];

  return (
    <div className={`rs ${sans.variable} ${serif.variable} ${mono.variable} ${wide.variable}`} lang={locale}>
      <Reveal />

      {gaps > 0 && (
        <p className="gaps-strip">
          <span className="ph">[{gaps}]</span>{" "}
          {locale === "en" ? "placeholders on this page still need real content." : locale === "kk" ? "толтырылмаған орын бар." : "заглушек на странице ещё ждут реального контента."}
        </p>
      )}

      {/* ───────────── Hero: full-bleed photo ───────────── */}
      <section className="hero" aria-labelledby="hero-h" id="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-img" src={c.hero.photo.src} alt={p(c.hero.photo.alt)} fetchPriority="high" decoding="async" />
        <div className="hero-shade" aria-hidden />

        <nav className="topnav" aria-label={p(c.ui.onThisPage)}>
          <a href="#top" className="brand">
            {c.site.brand}
            <span className="brand-dot" aria-hidden>
              .
            </span>
          </a>
          <ul className="topnav-links">
            {c.site.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{p(l.label)}</a>
              </li>
            ))}
          </ul>
          <div className="topnav-right">
            <LangToggle locale={locale} label={p(c.ui.language)} />
            <a href={c.app.url} className="btn btn-light btn-sm topnav-cta">
              {openMap}
            </a>
          </div>
          <details className="topnav-menu">
            <summary>{p(c.site.menu)}</summary>
            <ul>
              {c.site.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{p(l.label)}</a>
                </li>
              ))}
              <li>
                <a href={c.app.url}>{openMap} →</a>
              </li>
            </ul>
          </details>
        </nav>

        <div className="hero-body">
          <div className="hero-text">
            <p className="hero-eyebrow">{p(c.hero.eyebrow)}</p>
            <h1 id="hero-h" className="display">
              <Em s={p(c.hero.headline)} />
            </h1>
            <p className="hero-sub">{p(c.hero.sub)}</p>
            <div className="hero-actions">
              <a href={c.app.url} className="btn btn-light">
                {openMap} <span aria-hidden>→</span>
              </a>
              <a href="#research" className="btn btn-ghost-light">
                {p(c.hero.secondaryCta)}
              </a>
            </div>
          </div>
          <aside className="hero-card">
            <span className="hero-card-k">{p(c.ui.preliminary)}</span>
            <ul>
              {c.hero.chips.map((ch) => (
                <li key={ch.value + pick(ch.label, "ru")}>
                  <span className="tabnum">{ch.value}</span> {p(ch.label)}
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <p className="credit hero-credit">
          <a href={c.hero.photo.creditHref}>{p(c.hero.photo.credit)}</a>
        </p>
      </section>

      {/* ───────────── Explore the map ───────────── */}
      <section className="explore light" aria-labelledby="explore-h">
        <div className="wrap explore-grid">
          <div className="explore-main">
            <h2 id="explore-h" className="display-2 reveal">
              <Em s={p(c.explore.title)} />
            </h2>
            <ul className="explore-list reveal">
              {c.explore.items.map((it) => (
                <li key={pick(it.label, "ru")}>
                  {it.href ? (
                    <a href={it.href}>
                      <span className="ex-label">{p(it.label)}</span>
                      <span className="ex-sub">{p(it.sub)}</span>
                      <span className="ex-arrow" aria-hidden>
                        →
                      </span>
                    </a>
                  ) : (
                    <span className="ex-soon" aria-disabled="true">
                      <span className="ex-label">{p(it.label)}</span>
                      <span className="ex-sub">{p(it.sub)}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="explore-lead reveal">{p(c.explore.lead)}</p>
          </div>
          <figure className="explore-photo reveal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.explore.photo.src} alt={p(c.explore.photo.alt)} loading="lazy" decoding="async" />
            <figcaption className="credit">
              <a href={c.explore.photo.creditHref}>{p(c.explore.photo.credit)}</a>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ───────────── Research: editorial ───────────── */}
      <div className="research-body" id="research">
        <header className="r-intro">
          <div className="wrap">
            <p className="eyebrow">{p(c.research.eyebrow)}</p>
            <h2 className="display-2 reveal">{p(c.research.title)}</h2>
            <p className="r-title reveal" lang="ru">
              {c.hero.titleRu}
            </p>
            <p className="r-title-en reveal" lang="en">
              {c.hero.titleEn}
            </p>
            <p className="lead reveal">{p(c.hero.pitch)}</p>
          </div>
        </header>

        <nav className="subnav" aria-label={p(c.ui.onThisPage)}>
          <div className="wrap">
            <ul>
              {c.nav.map((n, i) => (
                <li key={n.id}>
                  <a href={`#${n.id}`}>
                    <span className="tabnum">{String(i + 1).padStart(2, "0")}</span> {p(n.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* 01 · Problem — serif, white, coral accent */}
        <Section id="problem" n="01" kicker={p(c.nav[0].label)} tone="problem" title={p(c.problem.title)}>
          <p className="lead reveal">{p(c.problem.lead)}</p>
          <ul className="stat-row reveal">
            {c.problem.stats.map((st, i) => (
              <li key={i}>
                <span className="stat-v tabnum">{p(st.value)}</span>
                <span className="stat-l">{p(st.label)}</span>
              </li>
            ))}
          </ul>
          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(c.problem.map.title)}</h3>
              <p className="muted small">{p(c.problem.map.hint)}</p>
            </figcaption>
            <PeopleMap t={hexText} decimal={dec} legend={p(c.problem.map.legend)} source={p(c.problem.map.source)} />
          </figure>
          <blockquote className="question reveal">
            <span className="q-label">{p(c.problem.questionLabel)}</span>
            <p className="q-text">{p(c.problem.question)}</p>
          </blockquote>
        </Section>

        {/* 02 · Method — warm paper, mono labels, flow diagram */}
        <Section id="method" n="02" kicker={p(c.nav[1].label)} tone="method" title={p(c.method.title)}>
          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(c.method.flowTitle)}</h3>
            </figcaption>
            <Flow
              formulaLabel={locale === "en" ? "formula" : locale === "kk" ? "формула" : "формулы"}
              nodes={c.method.flow.map((n) => {
                const st = c.method.steps[n.step];
                return { id: n.id, kind: n.kind, title: p(n.title), text: p(n.text), formula: "formula" in n ? n.formula : undefined, detailTitle: p(st.title), detail: p(st.details) };
              })}
            />
          </figure>

          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(c.method.schedule.title)}</h3>
            </figcaption>
            <Schedule
              hint={p(c.method.schedule.hint)}
              typeLabel={locale === "en" ? "Agent type" : locale === "kk" ? "Агент түрі" : "Тип агента"}
              shareLabel={p(c.method.schedule.shareLabel)}
              slots={c.method.schedule.slots.map((sl) => ({ id: sl.id, label: p(sl.label), time: sl.time }))}
              rows={c.method.schedule.rows.map((r) => ({ type: p(r.type), share: r.share, shareText: locale === "en" ? String(r.share) : String(r.share).replace(".", ","), cells: r.cells.map(p) }))}
            />
            <p className="note">{p(c.method.schedule.note)}</p>
          </figure>

          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(c.method.compare.title)}</h3>
            </figcaption>
            <div className="table-wrap">
              <table className="t t-compare">
                <thead>
                  <tr>
                    {c.method.compare.cols.map((col, i) => (
                      <th key={i} scope="col">
                        {p(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.method.compare.rows.map((r, i) => (
                    <tr key={i} className={"me" in r && r.me ? "me" : ""}>
                      <th scope="row">{p(r.name)}</th>
                      {r.cells.map((v, j) => {
                        const txt = p(v);
                        const yn = /^(да|yes|иә)$/i.test(txt) ? "yes" : /^(нет|no|жоқ)$/i.test(txt) ? "no" : "";
                        return (
                          <td key={j} className={yn ? `yn ${yn}` : ""}>
                            {txt}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </figure>
        </Section>

        {/* 03 · Formulas — grid paper, mono, purple */}
        <Section id="formulas" n="03" kicker={p(c.nav[2].label)} tone="formulas" title={p(f.title)}>
          <p className="lead reveal">{p(f.lead)}</p>
          <div className="f-grid">
            {f.items.map((it, i) => (
              <article key={it.id} className={`panel f-card reveal${it.id === "tsg" ? " f-key" : ""}${it.id === "huff" ? " f-wide" : ""}`}>
                <span className="f-no tabnum">({i + 1})</span>
                <h3 className="h3">{p(it.name)}</h3>
                <Formula tex={it.tex} texEn={"texEn" in it ? it.texEn : undefined} locale={locale} />
                <p className="f-plain">
                  <span className="tag">{p(c.ui.plain)}</span> {p(it.plain)}
                </p>
                <details className="f-why">
                  <summary>{p(c.ui.why)}</summary>
                  <p>{p(it.why)}</p>
                </details>
              </article>
            ))}
          </div>

          <div className="reveal">
            <TsgDemo
              decimal={dec}
              t={{
                title: p(f.demo.title),
                hint: p(f.demo.hint),
                a: p(f.demo.a),
                b: p(f.demo.b),
                presets: p(f.demo.presets),
                deficit: p(f.demo.deficit),
                balance: p(f.demo.balance),
                surplus: p(f.demo.surplus),
                undefined: p(f.demo.undefined),
              }}
            />
          </div>

          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(f.classes.title)}</h3>
            </figcaption>
            <div className="scale" aria-hidden>
              <span className="sc-sur" />
              <span className="sc-bal" />
              <span className="sc-def" />
            </div>
            <div className="scale-ticks tabnum" aria-hidden>
              <span>−1</span>
              <span>{locale === "en" ? "−0.2" : "−0,2"}</span>
              <span>{locale === "en" ? "0.2" : "0,2"}</span>
              <span>+1</span>
            </div>
            <div className="table-wrap">
              <table className="t">
                <tbody>
                  {f.classes.rows.map((r) => (
                    <tr key={r.cls}>
                      <th scope="row">
                        <span className={`dot dot-${r.cls}`} aria-hidden /> {p(r.name)}
                      </th>
                      <td className="tabnum nowrap">{locale === "en" ? r.condEn : r.cond}</td>
                      <td>{p(r.meaning)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">{p(f.classes.note)}</p>
          </figure>

          <h3 className="h2-sub reveal">{p(f.propsTitle)}</h3>
          <ol className="props">
            {f.props.map((pr, i) => (
              <li key={i} className="prop reveal">
                <span className="prop-n tabnum">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h4 className="h3">{p(pr.name)}</h4>
                  <Formula tex={pr.tex} texEn={"texEn" in pr ? pr.texEn : undefined} locale={locale} inline />
                  <p>{p(pr.plain)}</p>
                  <details>
                    <summary>{p(c.ui.proof)}</summary>
                    <p>{p(pr.proof)}</p>
                  </details>
                </div>
              </li>
            ))}
          </ol>
          <p className="note reveal">{p(f.limitation)}</p>
        </Section>

        {/* 04 · Results — pale blue, wide display numerals */}
        <Section id="results" n="04" kicker={p(c.nav[3].label)} tone="results" title={p(r.title)}>
          <p className="badge-pre reveal">{p(r.badge)}</p>

          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(r.map.title)}</h3>
              <p className="muted small">{p(r.map.hint)}</p>
            </figcaption>
            <TsgMap
              t={{ ...hexText, changed: p(r.map.changed) }}
              decimal={dec}
              legend={{ def: p(r.map.legendDef), bal: p(r.map.legendBal), sur: p(r.map.legendSur), none: p(r.map.legendNone) }}
              source={p(r.map.source)}
              summary={tsgSummary}
              highlight={{ cell: 206, label: p(r.map.cell206) }}
            />
          </figure>

          <div className="kpis reveal">
            <div className="kpi">
              <span className="kpi-v tabnum">{r.peak.big}</span>
              <span className="kpi-t">{p(r.peak.title)}</span>
              <span className="kpi-x">{p(r.peak.text)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-v tabnum">{r.hidden.big}</span>
              <span className="kpi-t">{p(r.hidden.title)}</span>
              <span className="kpi-x">{p(r.hidden.text)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-v tabnum">{locale === "en" ? "0.88 / 0.95" : "0,88 / 0,95"}</span>
              <span className="kpi-t">{p(r.correlation.title)}</span>
              <span className="kpi-x">{p(r.correlation.note)}</span>
            </div>
          </div>

          <div className="two-figs">
            <figure className="fig reveal">
              <figcaption className="fig-h">
                <h3 className="h3">{p(r.changeTable.title)}</h3>
              </figcaption>
              <ClassChange
                cols={r.changeTable.cols.map(p)}
                slots={r.example.share.slots.map(p)}
                views={[p(r.changeTable.viewChart), p(r.changeTable.viewTable)]}
                rows={r.changeTable.rows.map((x) => ({ name: p(x.name), v: x.v, ci: x.ci, rho: locale === "en" ? x.rho.replace(/,/g, ".") : x.rho }))}
              />
              <p className="note">{p(r.classChange.caption)}</p>
            </figure>
            <figure className="fig reveal">
              <figcaption className="fig-h">
                <h3 className="h3">{p(r.moved.title)}</h3>
              </figcaption>
              <Bars bars={r.moved.bars} locale={locale} />
              <p className="note">{p(r.moved.caption)}</p>
            </figure>
          </div>

          <article className="case reveal">
            <h3 className="h3">{p(r.example.title)}</h3>
            <div className="case-cards">
              {r.example.cards.map((cd, i) => (
                <div key={i} className={`case-card cls-${cd.cls}`}>
                  <span className="cc-l">{p(cd.label)}</span>
                  <span className="cc-v tabnum">{locale === "en" ? cd.tsgEn : cd.tsg}</span>
                  <span className="cc-s">{p(cd.sub)}</span>
                </div>
              ))}
            </div>
            <h4 className="h4">{p(r.example.share.title)}</h4>
            <MarketShare
              options={r.example.share.options}
              slots={r.example.share.slots.map(p)}
              stat={r.example.share.static}
              statLabel={p(r.example.share.staticLabel)}
              hoursLabel={p(r.example.share.hoursLabel)}
            />
          </article>

          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(r.recalc.title)}</h3>
              <p className="muted small">{p(r.recalc.lead)}</p>
            </figcaption>
            <div className="table-wrap">
              <table className="t t-recalc">
                <thead>
                  <tr>
                    {r.recalc.cols.map((col, i) => (
                      <th key={i} scope="col" className={i ? "num" : ""}>
                        {p(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.recalc.rows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{p(row.name)}</th>
                      <td className="num tabnum muted">{row.osm}</td>
                      <td className="num tabnum gis">{row.gis}</td>
                      <td className="num tabnum muted">{row.ci || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">{p(r.recalc.note)}</p>
          </figure>

          <div className="table-wrap reveal">
            <table className="t t-hyp">
              <caption className="h3">{p(r.hypotheses.title)}</caption>
              <tbody>
                {r.hypotheses.items.map((h) => (
                  <tr key={h.code}>
                    <th scope="row" className="hyp-code">
                      {h.code}
                    </th>
                    <td>{p(h.text)}</td>
                    <td className="num">
                      <span className={`pill pill-${h.status}`}>{p(h.statusLabel)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 05 · App — white, product screenshots, stepper */}
        <Section id="app" n="05" kicker={p(c.nav[4].label)} tone="app" title={p(c.appSection.title)}>
          <p className="lead reveal">{p(c.appSection.lead)}</p>
          <div className="shots reveal">
            {c.appSection.screenshots.map((s, i) => (
              <figure key={i} className="shot">
                <ImgSlot src={s.src} alt={p(s.alt)} label={p(c.ui.imagePlaceholder)} ratio={"ratio" in s ? s.ratio : "16 / 10"} />
                <figcaption>
                  <Txt s={p(s.caption)} />
                </figcaption>
              </figure>
            ))}
          </div>

          <h3 className="h2-sub reveal">{p(c.appSection.howTitle)}</h3>
          <ol className="stepper reveal">
            {c.appSection.how.map((h, i) => (
              <li key={i}>
                <span className="st-n tabnum">{i + 1}</span>
                <h4 className="h4">{p(h.title)}</h4>
                <p>{p(h.text)}</p>
              </li>
            ))}
          </ol>

          <div className="two-figs">
            <figure className="fig reveal">
              <figcaption className="fig-h">
                <h3 className="h3">{p(c.appSection.archTitle)}</h3>
              </figcaption>
              <ol className="pipe">
                {c.appSection.arch.map((a, i) => (
                  <li key={i}>
                    <span className="pipe-t">{p(a.title)}</span>
                    <span className="pipe-x">{p(a.text)}</span>
                  </li>
                ))}
              </ol>
            </figure>
            <figure className="fig reveal">
              <figcaption className="fig-h">
                <h3 className="h3">{p(c.appSection.forTitle)}</h3>
              </figcaption>
              <table className="t">
                <tbody>
                  {c.appSection.for.map((a, i) => (
                    <tr key={i}>
                      <th scope="row">{p(a.title)}</th>
                      <td>{p(a.text)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          </div>

          <div className="cta-panel reveal">
            <AppCta qr={qr} locale={locale} label={openMap} />
          </div>
        </Section>

        {/* 06 · Interviews — warm, serif voice; reserved slots */}
        <Section id="interviews" n="06" kicker={p(c.nav[5].label)} tone="interviews" title={p(iv.title)}>
          <p className="lead reveal">
            <Txt s={p(iv.intro)} />
          </p>

          <div className="iv-videos reveal">
            {iv.videos.items.map((v, i) => (
              <figure key={i} className="iv-video">
                {typeof v.src === "string" ? (
                  <div className="iv-frame">
                    <video controls playsInline preload="none" poster={v.poster ?? undefined} src={v.src} />
                  </div>
                ) : (
                  <div className="soon-box">
                    <span className="soon-play" aria-hidden>
                      ▶
                    </span>
                    <span className="soon-l">{p(iv.videos.soonLabel)}</span>
                  </div>
                )}
                <figcaption>
                  {p(v.title)}
                  {v.note ? <span className="iv-note">{p(v.note)}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>

          <figure className="fig form-res reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(iv.form.title)}</h3>
              <p className="muted small">{p(iv.form.lead)}</p>
            </figcaption>
            <div className="form-kpis">
              {iv.form.kpis.map((k, i) => (
                <div key={i} className="form-kpi">
                  <span className="soon-num" aria-hidden>
                    —
                  </span>
                  <span>{p(k.label)}</span>
                </div>
              ))}
            </div>
            <div className="form-charts">
              {iv.form.charts.map((q, i) => (
                <div key={i} className="form-chart">
                  <span className="fc-q">{p(q)}</span>
                  <div className="fc-bars" aria-hidden>
                    <span style={{ width: "70%" }} />
                    <span style={{ width: "45%" }} />
                    <span style={{ width: "25%" }} />
                  </div>
                  <span className="soon-tag">{p(iv.form.soonLabel)}</span>
                </div>
              ))}
            </div>
          </figure>

          <div className="table-wrap reveal">
            <table className="t t-method">
              <thead>
                <tr>
                  <th scope="col">{p(iv.method.tasksLabel)}</th>
                  <th scope="col">{p(iv.method.measuresLabel)}</th>
                </tr>
              </thead>
              <tbody>
                {iv.method.tasks.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <Txt s={p(t)} />
                    </td>
                    <td>{p(iv.method.measures[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note reveal">
            <strong>{p(iv.method.ethicsLabel)}.</strong> {p(iv.method.ethics)}
          </p>
          <p className="note reveal">{p(iv.plan)}</p>
        </Section>

        {/* 07 · Field — map of filming points, video, YOLO stills */}
        <Section id="gallery" n="07" kicker={p(c.nav[6].label)} tone="field" title={p(c.gallery.title)}>
          <p className="lead reveal">{p(c.gallery.lead)}</p>
          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(c.field.title)}</h3>
              <p className="muted small">{p(c.field.hint)}</p>
            </figcaption>
            <FieldExplorer
              decimal={dec}
              points={c.field.points.map((pt) => ({ ...pt, name: p(pt.name), type: p(pt.type) }))}
              t={{
                hint: p(c.field.hint),
                rawHidden: p(c.field.rawHidden),
                raw: p(c.field.raw),
                yolo: p(c.field.yolo),
                slow: p(c.field.slow),
                meanTitle: p(c.field.meanTitle),
                slots: c.field.slots.map(p),
                roleCalib: p(c.field.roleCalib),
                roleControl: p(c.field.roleControl),
                cols: c.field.cols.map(p),
                slotNames: { morning: p(c.field.slots[0]), day: p(c.field.slots[1]), evening: p(c.field.slots[2]) },
              }}
            />
          </figure>

          <div className="table-wrap reveal">
            <table className="t t-points">
              <thead>
                <tr>
                  {c.field.cols.map((col, i) => (
                    <th key={i} scope="col" className={i === 4 ? "num" : ""}>
                      {p(col)}
                    </th>
                  ))}
                  {c.field.slots.map((sl, i) => (
                    <th key={`s${i}`} scope="col" className="num">
                      {p(sl)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.field.points.map((pt) => (
                  <tr key={pt.id}>
                    <th scope="row" className="tabnum">
                      {pt.id}
                    </th>
                    <td>{p(pt.name)}</td>
                    <td>{p(pt.type)}</td>
                    <td>{pt.role === "calib" ? p(c.field.roleCalib) : p(c.field.roleControl)}</td>
                    <td className="num tabnum">{pt.clips}</td>
                    {pt.mean.map((m, i) => (
                      <td key={i} className="num tabnum heat" style={{ ["--h" as string]: m == null ? 0 : Math.min(1, m / 15) }}>
                        {m == null ? "—" : locale === "en" ? m.toFixed(1) : m.toFixed(1).replace(".", ",")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="reveal">
            <Gallery
              tabs={c.gallery.tabs.map((t) => ({ id: t.id, label: p(t.label), items: t.items.map((it) => ({ src: it.src, caption: p(it.caption), date: p(it.date), alt: p(it.alt) })) }))}
              ui={{ close: p(c.ui.close), prev: p(c.ui.prev), next: p(c.ui.next), placeholder: p(c.ui.imagePlaceholder) }}
            />
          </div>
          <h3 className="h2-sub reveal">{p(c.gallery.timelineTitle)}</h3>
          <ol className="htl reveal">
            {c.gallery.timeline.map((t, i) => (
              <li key={i}>
                <span className="htl-date">{p(t.date)}</span>
                <span className="htl-label">{p(t.label)}</span>
              </li>
            ))}
          </ol>
        </Section>

        {/* 08 · Limits — grey, mono, status table */}
        <Section id="limits" n="08" kicker={p(c.nav[7].label)} tone="limits" title={p(c.limits.title)}>
          <figure className="fig reveal">
            <figcaption className="fig-h">
              <h3 className="h3">{p(c.limits.infra.title)}</h3>
              <p className="muted small">{p(c.limits.infra.lead)}</p>
            </figcaption>
            <p className="infra-key" aria-hidden>
              <span className="ik ik-gis">{c.limits.infra.gisLabel}</span>
              <span className="ik ik-osm">{p(c.limits.infra.osmLabel)}</span>
            </p>
            <div className="infra">
              {c.limits.infra.groups.map((g) => {
                const max = Math.max(...g.rows.map((x) => Math.max(x.gis, x.osm ?? 0)));
                return (
                  <div key={g.id} className="infra-g">
                    <h4 className="infra-h">{p(g.name)}</h4>
                    <ul>
                      {g.rows.map((x) => (
                        <li key={x.cat}>
                          <span className="infra-n">{p(x.name)}</span>
                          <span className="infra-bars">
                            <span className="ib ib-gis" style={{ width: `${(x.gis / max) * 100}%` }} />
                            {x.osm != null && <span className="ib ib-osm" style={{ width: `${(x.osm / max) * 100}%` }} />}
                          </span>
                          <span className="infra-v tabnum">
                            {x.gis}
                            {x.capped ? "*" : ""}
                            {x.osm != null && <span className="muted"> / {x.osm}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="viz-src">{p(c.limits.infra.capNote)}</p>
            <p className="viz-src">{p(c.limits.infra.source)}</p>
          </figure>
          <div className="table-wrap reveal">
            <table className="t t-limits">
              <thead>
                <tr>
                  {c.limits.table.cols.map((col, i) => (
                    <th key={i} scope="col">
                      {p(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.limits.table.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{p(row.lim)}</td>
                    <td>{p(row.fix)}</td>
                    <td>
                      <span className={`st st-${row.status}`}>{p(c.limits.table.statusLabels[row.status as "done" | "progress" | "planned"])}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 09 · Sources — bibliography */}
        <Section id="sources" n="09" kicker={p(c.nav[8].label)} tone="sources" title={p(c.sources.title)}>
          <div className="table-wrap reveal">
            <table className="t t-refs">
              <caption className="h3">{p(c.sources.refsTitle)}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {c.sources.refCols.map((col, i) => (
                    <th key={i} scope="col">
                      {p(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.sources.refs.map((rf, i) => (
                  <tr key={rf.short}>
                    <td className="tabnum muted">{i + 1}</td>
                    <td className="ref-t">{rf.text}</td>
                    <td>{p((c.sources.refUse as Record<string, L>)[rf.short])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap reveal">
            <table className="t">
              <caption className="h3">{p(c.sources.dataTitle)}</caption>
              <thead>
                <tr>
                  {c.sources.dataTable.cols.map((col, i) => (
                    <th key={i} scope="col">
                      {p(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.sources.dataTable.rows.map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{p(row.src)}</th>
                    <td>{p(row.what)}</td>
                    <td className="muted">{p(row.lic)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* ───────────── Guide ───────────── */}
      <section id="guide" className="guide light" aria-labelledby="guide-h">
        <div className="wrap">
          <div className="guide-head">
            <h2 id="guide-h" className="display-2 reveal">
              <Em s={p(c.guide.title)} />
            </h2>
            <p className="guide-lead reveal">{p(c.guide.lead)}</p>
          </div>
          <ol className="guide-steps">
            {c.guide.steps.map((s, i) => (
              <li key={i} className="reveal">
                <span className="g-n tabnum">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="h3">{p(s.title)}</h3>
                <p>{p(s.text)}</p>
              </li>
            ))}
          </ol>
          <p className="guide-note reveal">{p(c.guide.note)}</p>
          <div className="guide-cta reveal">
            <a href={c.app.url} className="btn btn-dark">
              {openMap} <span aria-hidden>→</span>
            </a>
            <figure className="qr-mini">
              <div className="qr" role="img" aria-label={`QR: ${c.app.url}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <figcaption>{p(c.app.qrCaption)}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ───────────── Contacts ───────────── */}
      <section id="contacts" className="contacts light" aria-labelledby="contacts-h">
        <div className="wrap contacts-grid">
          <div>
            <h2 id="contacts-h" className="display-2 reveal">
              {p(c.contacts.title)}
            </h2>
            <p className="guide-lead reveal">{p(c.contacts.lead)}</p>
          </div>
          <dl className="contact-list reveal">
            {c.contacts.items.map((it) => (
              <div key={pick(it.label, "ru")}>
                <dt>{p(it.label)}</dt>
                <dd>
                  <Contact kind={"kind" in it ? it.kind : undefined} value={it.value} href={"href" in it ? it.href : undefined} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="rs-foot">
        <div className="wrap rs-foot-in">
          <span className="brand">
            {c.site.brand}
            <span className="brand-dot" aria-hidden>
              .
            </span>
          </span>
          <span className="muted small">
            {c.footer.copyright} · {p(c.footer.credits)} · <a href={c.footer.code.href}>{p(c.footer.code.label)}</a>
          </span>
          <a href="#top" className="small">
            {p(c.ui.toTop)} ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
