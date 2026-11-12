import type { Metadata } from "next";
import { Inter_Tight, Playfair_Display } from "next/font/google";
import katex from "katex";
import QRCode from "qrcode";
import "katex/dist/katex.min.css";
import "./research.css";
import { ImgSlot, StepIcon, Txt } from "@/components/research/bits";
import { Gallery, LangToggle, Reveal, TsgDemo } from "@/components/research/client";
import type { Locale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { content as c, findGaps, L, pick } from "@/lib/research/content";

const sans = Inter_Tight({ subsets: ["latin", "cyrillic", "cyrillic-ext"], weight: ["400", "500", "600"], display: "swap", variable: "--font-rs-sans" });
const serif = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["400", "500"], style: ["italic"], display: "swap", variable: "--font-rs-serif" });

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

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="sec">
      <div className="wrap">
        <header className="sec-head reveal">
          <span className="sec-num" aria-hidden>
            {n}
          </span>
          <h2 id={`${id}-h`} className="h2">
            {title}
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

function Contact({ kind, value }: { kind?: string; value: string }) {
  if (/\[[^\]]*\]/.test(value)) return <Txt s={value} />;
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

  return (
    <div className={`rs ${sans.variable} ${serif.variable}`} lang={locale}>
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

        {/* Problem */}
        <Section id="problem" n="01" title={p(c.problem.title)}>
          <p className="lead reveal">{p(c.problem.lead)}</p>
          {c.problem.maps.map((m, i) => (
            <figure key={i} className="panel map-card map-wide reveal">
              <ImgSlot src={m.src} alt={p(m.alt)} label={p(c.ui.imagePlaceholder)} ratio="1595 / 1035" />
              <figcaption className="map-title">{p(m.title)}</figcaption>
            </figure>
          ))}
          <blockquote className="question reveal">
            <span className="q-label">{p(c.problem.questionLabel)}</span>
            <p className="q-text">{p(c.problem.question)}</p>
          </blockquote>
        </Section>

        {/* Method */}
        <Section id="method" n="02" title={p(c.method.title)}>
          <ol className="steps">
            {c.method.steps.map((s, i) => (
              <li key={i} className="step reveal">
                <span className="step-n tabnum">{String(i + 1).padStart(2, "0")}</span>
                <span className="step-icon">
                  <StepIcon name={s.icon} />
                </span>
                <div>
                  <h3 className="h3">{p(s.title)}</h3>
                  <p>{p(s.text)}</p>
                  <details>
                    <summary>{p(c.ui.details)}</summary>
                    <p>{p(s.details)}</p>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Formulas */}
        <Section id="formulas" n="03" title={p(f.title)}>
          <p className="lead reveal">{p(f.lead)}</p>
          <div className="f-grid">
            {f.items.map((it) => (
              <article key={it.id} className={`panel f-card reveal${it.id === "tsg" ? " f-key" : ""}${it.id === "huff" ? " f-wide" : ""}`}>
                <h3 className="h3">{p(it.name)}</h3>
                <Formula tex={it.tex} texEn={"texEn" in it ? it.texEn : undefined} locale={locale} />
                <p className="f-plain">
                  <span className="tag">{p(c.ui.plain)}</span> {p(it.plain)}
                </p>
                <p className="f-why">
                  <strong>{p(c.ui.why)}:</strong> {p(it.why)}
                </p>
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

        {/* Results */}
        <Section id="results" n="04" title={p(r.title)}>
          <p className="badge-pre reveal">{p(r.badge)}</p>
          {r.maps.map((m, i) => (
            <figure key={i} className="panel map-card map-wide reveal">
              <ImgSlot src={m.src} alt={p(m.alt)} label={p(c.ui.imagePlaceholder)} ratio="1898 / 1031" />
              <figcaption className="map-title">{p(m.title)}</figcaption>
            </figure>
          ))}

          <div className="res-grid">
            <article className="panel res res-big reveal">
              <span className="big tabnum">{r.peak.big}</span>
              <h3 className="h3">{p(r.peak.title)}</h3>
              <p>{p(r.peak.text)}</p>
              <div className="cmp" aria-hidden>
                <span className="cmp-bar cmp-a" style={{ width: "100%" }}>
                  {locale === "en" ? "6.3k" : "6,3 тыс."}
                </span>
                <span className="cmp-bar cmp-b" style={{ width: `${(0.9 / 6.3) * 100}%` }}>
                  {locale === "en" ? "0.9k" : "0,9 тыс."}
                </span>
              </div>
            </article>

            <article className="panel res reveal">
              <h3 className="h3">{p(r.moved.title)}</h3>
              <Bars bars={r.moved.bars} locale={locale} />
              <p className="muted small">{p(r.moved.caption)}</p>
            </article>

            <article className="panel res reveal">
              <h3 className="h3">{p(r.correlation.title)}</h3>
              <div className="corr">
                {r.correlation.items.map((it) => (
                  <div key={it.value}>
                    <span className="big-sm tabnum">{locale === "en" ? it.valueEn : it.value}</span>
                    <span className="muted">{p(it.label)}</span>
                  </div>
                ))}
              </div>
              <p className="muted small">{p(r.correlation.note)}</p>
            </article>

            <article className="panel res reveal">
              <h3 className="h3">{p(r.classChange.title)}</h3>
              <Bars bars={r.classChange.bars} locale={locale} />
              <p className="muted small">{p(r.classChange.caption)}</p>
            </article>

            <article className="panel res reveal">
              <span className="big tabnum">{r.hidden.big}</span>
              <h3 className="h3">{p(r.hidden.title)}</h3>
              <p>{p(r.hidden.text)}</p>
            </article>

            <article className="panel res hyp reveal">
              <h3 className="h3">{p(r.hypotheses.title)}</h3>
              <ul>
                {r.hypotheses.items.map((h) => (
                  <li key={h.code}>
                    <span className="hyp-code">{h.code}</span>
                    <span className="hyp-text">{p(h.text)}</span>
                    <span className={`pill pill-${h.status}`}>{p(h.statusLabel)}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="panel example reveal">
            <h3 className="h3">{p(r.example.title)}</h3>
            <dl className="facts">
              {r.example.facts.map((fa, i) => (
                <div key={i}>
                  <dt>{p(fa.label)}</dt>
                  <dd className="tabnum">{p(fa.value)}</dd>
                </div>
              ))}
            </dl>
            <p className="verdict">{p(r.example.verdict)}</p>
            <h4 className="h4">{p(r.example.scenarios.title)}</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {r.example.scenarios.cols.map((col, i) => (
                      <th key={i} scope="col">
                        {p(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.example.scenarios.rows.map((row) => (
                    <tr key={row.hours}>
                      <th scope="row" className="tabnum">
                        {row.hours}
                      </th>
                      {row.cells.map((v, i) => (
                        <td key={i} className="tabnum">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">{p(r.example.scenarios.note)}</p>
          </article>
        </Section>

        {/* App */}
        <Section id="app" n="05" title={p(c.appSection.title)}>
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

          <div className="cols3">
            <div className="reveal">
              <h3 className="h2-sub">{p(c.appSection.howTitle)}</h3>
              <ol className="rows">
                {c.appSection.how.map((h, i) => (
                  <li key={i}>
                    <h4 className="h4">{p(h.title)}</h4>
                    <p>{p(h.text)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="reveal">
              <h3 className="h2-sub">{p(c.appSection.archTitle)}</h3>
              <ol className="rows">
                {c.appSection.arch.map((a, i) => (
                  <li key={i}>
                    <h4 className="h4">{p(a.title)}</h4>
                    <p>{p(a.text)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="reveal">
              <h3 className="h2-sub">{p(c.appSection.forTitle)}</h3>
              <ul className="rows">
                {c.appSection.for.map((a, i) => (
                  <li key={i}>
                    <h4 className="h4">{p(a.title)}</h4>
                    <p>{p(a.text)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="cta-panel reveal">
            <AppCta qr={qr} locale={locale} label={openMap} />
          </div>
        </Section>

        {/* Interviews */}
        <Section id="interviews" n="06" title={p(iv.title)}>
          <p className="lead reveal">
            <Txt s={p(iv.intro)} />
          </p>
          <div className="panel method-card reveal">
            <h3 className="h3">{p(iv.method.title)}</h3>
            <div className="method-cols">
              <div>
                <h4 className="h4">{p(iv.method.tasksLabel)}</h4>
                <ul>
                  {iv.method.tasks.map((t, i) => (
                    <li key={i}>
                      <Txt s={p(t)} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="h4">{p(iv.method.measuresLabel)}</h4>
                <ul>
                  {iv.method.measures.map((t, i) => (
                    <li key={i}>{p(t)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="h4">{p(iv.method.ethicsLabel)}</h4>
                <p>{p(iv.method.ethics)}</p>
              </div>
            </div>
          </div>

          <p className="note reveal">{p(iv.plan)}</p>
          <div className="cta-panel reveal">
            <a href={c.app.url} className="btn btn-dark">
              {openMap} <span aria-hidden>→</span>
            </a>
          </div>
        </Section>

        {/* Gallery */}
        <Section id="gallery" n="07" title={p(c.gallery.title)}>
          <p className="lead reveal">{p(c.gallery.lead)}</p>
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

        {/* Limits */}
        <Section id="limits" n="08" title={p(c.limits.title)}>
          <div className="two">
            <ul className="list-x reveal">
              {c.limits.items.map((t, i) => (
                <li key={i}>{p(t)}</li>
              ))}
            </ul>
            <div className="reveal">
              <h3 className="h3">{p(c.limits.nextTitle)}</h3>
              <ul className="list-arrow">
                {c.limits.next.map((t, i) => (
                  <li key={i}>{p(t)}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Sources */}
        <Section id="sources" n="09" title={p(c.sources.title)}>
          <div className="two">
            <div className="reveal">
              <h3 className="h3">{p(c.sources.refsTitle)}</h3>
              <ol className="refs">
                {c.sources.refs.map((rf) => (
                  <li key={rf.short}>{rf.text}</li>
                ))}
              </ol>
            </div>
            <div className="reveal">
              <h3 className="h3">{p(c.sources.dataTitle)}</h3>
              <ul className="list-dot">
                {c.sources.data.map((d, i) => (
                  <li key={i}>{p(d)}</li>
                ))}
              </ul>
            </div>
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
                  <Contact kind={"kind" in it ? it.kind : undefined} value={it.value} />
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
            {c.footer.copyright} · {p(c.footer.credits)}
          </span>
          <a href="#top" className="small">
            {p(c.ui.toTop)} ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
