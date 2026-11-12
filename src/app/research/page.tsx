import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import katex from "katex";
import QRCode from "qrcode";
import "katex/dist/katex.min.css";
import "./research.css";
import { ImgSlot, Spark, StepIcon, TsgLogo, Txt } from "@/components/research/bits";
import { Gallery, LangToggle, Reveal, TsgDemo } from "@/components/research/client";
import type { Locale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { content as c, findGaps, L, pick } from "@/lib/research/content";

const mont = Montserrat({ subsets: ["latin", "cyrillic", "cyrillic-ext"], weight: ["500", "700", "800"], display: "swap", variable: "--font-mont" });

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

function Section({ id, n, title, children, tint }: { id: string; n: string; title: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`sec${tint ? " sec-tint" : ""}`}>
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

function AppCta({ qr, locale, big }: { qr: string; locale: Locale; big?: boolean }) {
  const host = c.app.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className={`cta-block${big ? " cta-big" : ""}`}>
      <a href={c.app.url} className="btn-app">
        <Spark className="spark-in" />
        {pick(c.app.label, locale)}
        <span aria-hidden>→</span>
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

export default async function ResearchPage() {
  const { locale } = await getI18n();
  const p = (v: L | null | undefined) => pick(v, locale);
  const dec = locale === "en" ? "." : ",";
  const qr = await QRCode.toString(c.app.url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#27152BFF", light: "#FFFFFFFF" } });
  const gaps = findGaps().length;
  const r = c.results;
  const iv = c.interviews;
  const f = c.formulas;

  return (
    <div className={`rs ${mont.variable}`} lang={locale}>
      <Reveal />

      {gaps > 0 && (
        <p className="gaps-strip">
          <span className="ph">[{gaps}]</span>{" "}
          {locale === "en" ? "placeholders on this page still need real content." : locale === "kk" ? "толтырылмаған орын бар." : "заглушек на странице ещё ждут реального контента."}
        </p>
      )}

      {/* ───────────── 4.1 Hero ───────────── */}
      <section className="hero" aria-labelledby="hero-h">
        <div className="wrap hero-grid">
          <div className="hero-main">
            <p className="eyebrow">
              <Spark /> {p(c.hero.eyebrow)}
            </p>
            <h1 id="hero-h" className="h1" lang="ru">
              {c.hero.titleRu}
            </h1>
            <p className="hero-en" lang="en">
              {c.hero.titleEn}
            </p>
            <p className="lead">{p(c.hero.pitch)}</p>
            <AppCta qr={qr} locale={locale} />
            <a href="#method" className="link-soft">
              {p(c.hero.secondaryCta)}
            </a>
          </div>
          <div className="hero-side">
            <TsgLogo caption="индекс разрыва" className="hero-logo" />
            <p className="badge-pre">
              <Spark /> {p(c.ui.preliminary)}
            </p>
          </div>
        </div>
        <div className="wrap">
          <ul className="chips">
            {c.hero.chips.map((ch) => (
              <li key={ch.value + pick(ch.label, "ru")} className="chip reveal">
                <span className="chip-v tabnum">{ch.value}</span>
                <span className="chip-l">{p(ch.label)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <nav className="subnav" aria-label={p(c.ui.onThisPage)}>
        <div className="wrap subnav-in">
          <ul>
            {c.nav.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`}>{p(n.label)}</a>
              </li>
            ))}
          </ul>
          <LangToggle locale={locale} label={p(c.ui.language)} />
        </div>
      </nav>

      {/* ───────────── 4.2 Problem ───────────── */}
      <Section id="problem" n="01" title={p(c.problem.title)}>
        <p className="lead reveal">{p(c.problem.lead)}</p>
        <div className="vs reveal">
          {c.problem.maps.map((m, i) => (
            <figure key={i} className="card map-card">
              <figcaption className="map-title">{p(m.title)}</figcaption>
              <ImgSlot src={m.src} alt={p(m.alt)} label={p(c.ui.imagePlaceholder)} />
            </figure>
          ))}
          <span className="vs-arrow" aria-hidden>
            ≠
          </span>
        </div>
        <div className="question sticker reveal">
          <span className="q-label">
            <Spark /> {p(c.problem.questionLabel)}
          </span>
          <p className="q-text">{p(c.problem.question)}</p>
        </div>
      </Section>

      {/* ───────────── 4.3 Method ───────────── */}
      <Section id="method" n="02" title={p(c.method.title)} tint>
        <ol className="timeline">
          {c.method.steps.map((s, i) => (
            <li key={i} className="tl-item reveal">
              <span className="tl-icon">
                <StepIcon name={s.icon} />
              </span>
              <div className="tl-body card">
                <span className="tl-n">{String(i + 1).padStart(2, "0")}</span>
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

      {/* ───────────── 4.4 Formulas ───────────── */}
      <Section id="formulas" n="03" title={p(f.title)}>
        <p className="lead reveal">{p(f.lead)}</p>
        <div className="f-grid">
          {f.items.map((it) => (
            <article key={it.id} className={`card f-card reveal${it.id === "tsg" ? " f-key sticker" : ""}${it.id === "huff" ? " f-wide" : ""}`}>
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

        <h3 className="h2 h2-sub reveal">{p(f.propsTitle)}</h3>
        <ol className="props">
          {f.props.map((pr, i) => (
            <li key={i} className="card prop reveal">
              <span className="prop-n">{i + 1}</span>
              <h4 className="h3">{p(pr.name)}</h4>
              <Formula tex={pr.tex} texEn={"texEn" in pr ? pr.texEn : undefined} locale={locale} inline />
              <p>{p(pr.plain)}</p>
              <details>
                <summary>{p(c.ui.proof)}</summary>
                <p>{p(pr.proof)}</p>
              </details>
            </li>
          ))}
        </ol>
        <p className="note reveal">{p(f.limitation)}</p>
      </Section>

      {/* ───────────── 4.5 Results ───────────── */}
      <Section id="results" n="04" title={p(r.title)} tint>
        <p className="badge-pre badge-wide reveal">
          <Spark /> {p(r.badge)}
        </p>
        <div className="maps3 reveal">
          {r.maps.map((m, i) => (
            <figure key={i} className="card map-card">
              <figcaption className="map-title">{p(m.title)}</figcaption>
              <ImgSlot src={m.src} alt={p(m.alt)} label={p(c.ui.imagePlaceholder)} ratio="1 / 1" />
            </figure>
          ))}
        </div>

        <div className="res-grid">
          <article className="card res reveal">
            <h3 className="h3">{p(r.moved.title)}</h3>
            <Bars bars={r.moved.bars} locale={locale} />
            <p className="muted small">{p(r.moved.caption)}</p>
          </article>

          <article className="card res res-big sticker reveal">
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

          <article className="card res reveal">
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

          <article className="card res reveal">
            <h3 className="h3">{p(r.classChange.title)}</h3>
            <Bars bars={r.classChange.bars} locale={locale} />
            <p className="muted small">{p(r.classChange.caption)}</p>
          </article>

          <article className="card res res-hidden reveal">
            <span className="big tabnum">{r.hidden.big}</span>
            <h3 className="h3">{p(r.hidden.title)}</h3>
            <p>{p(r.hidden.text)}</p>
          </article>

          <article className="card res hyp reveal">
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

        <article className="card example sticker reveal">
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

      {/* ───────────── 4.6 App ───────────── */}
      <Section id="app" n="05" title={p(c.appSection.title)}>
        <p className="lead reveal">{p(c.appSection.lead)}</p>
        <div className="shots reveal">
          {c.appSection.screenshots.map((s, i) => (
            <figure key={i} className="card shot">
              <ImgSlot src={s.src} alt={p(s.alt)} label={p(c.ui.imagePlaceholder)} ratio="16 / 10" />
              <figcaption>
                <Txt s={p(s.caption)} />
              </figcaption>
            </figure>
          ))}
        </div>

        <h3 className="h2 h2-sub reveal">{p(c.appSection.howTitle)}</h3>
        <ol className="how">
          {c.appSection.how.map((h, i) => (
            <li key={i} className="card reveal">
              <span className="how-n">{i + 1}</span>
              <h4 className="h3">{p(h.title)}</h4>
              <p>{p(h.text)}</p>
            </li>
          ))}
        </ol>

        <h3 className="h2 h2-sub reveal">{p(c.appSection.archTitle)}</h3>
        <ol className="arch reveal">
          {c.appSection.arch.map((a, i) => (
            <li key={i} className="card">
              <h4 className="h3">{p(a.title)}</h4>
              <p>{p(a.text)}</p>
            </li>
          ))}
        </ol>

        <h3 className="h2 h2-sub reveal">{p(c.appSection.forTitle)}</h3>
        <ul className="for">
          {c.appSection.for.map((a, i) => (
            <li key={i} className="card reveal">
              <h4 className="h3">{p(a.title)}</h4>
              <p>{p(a.text)}</p>
            </li>
          ))}
        </ul>

        <div className="cta-panel sticker reveal">
          <AppCta qr={qr} locale={locale} big />
        </div>
      </Section>

      {/* ───────────── 4.7 Interviews ───────────── */}
      <Section id="interviews" n="06" title={p(iv.title)} tint>
        <p className="lead reveal">
          <Txt s={p(iv.intro)} />
        </p>
        <div className="card method-card reveal">
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

        <ul className="iv-grid">
          {iv.cards.map((cd, i) => (
            <li key={i} className="card iv reveal">
              <div className="iv-head">
                <span className="iv-n">
                  {p(iv.labels.participant)} {i + 1}
                </span>
                <span className="iv-type">
                  <Txt s={cd.type} />
                </span>
              </div>
              <blockquote>
                «<Txt s={cd.quote} />»
              </blockquote>
              <dl className="iv-meta">
                <div>
                  <dt>{p(iv.labels.years)}</dt>
                  <dd>
                    <Txt s={cd.years} />
                  </dd>
                </div>
                <div>
                  <dt>{p(iv.labels.rating)}</dt>
                  <dd>
                    <Txt s={cd.rating} />
                    /5
                  </dd>
                </div>
              </dl>
              <p className="iv-plus">
                <strong>+ {p(iv.labels.liked)}:</strong> <Txt s={cd.liked} />
              </p>
              <p className="iv-minus">
                <strong>? {p(iv.labels.confused)}:</strong> <Txt s={cd.confused} />
              </p>
            </li>
          ))}
        </ul>

        <div className="card summary sticker reveal">
          <h3 className="h3">{p(iv.summary.title)}</h3>
          <div className="sum-stats">
            <div>
              <span className="big-sm">
                <Txt s={iv.summary.sus.value} />
              </span>
              <span className="muted">{p(iv.summary.sus.label)}</span>
            </div>
            <div>
              <span className="big-sm">
                <Txt s={iv.summary.success.value} />
              </span>
              <span className="muted">{p(iv.summary.success.label)}</span>
            </div>
          </div>
          <div className="method-cols">
            <div>
              <h4 className="h4">{p(iv.summary.commentsLabel)}</h4>
              <ol>
                {iv.summary.comments.map((t, i) => (
                  <li key={i}>
                    <Txt s={t} />
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="h4">{p(iv.summary.changesLabel)}</h4>
              <ul>
                {iv.summary.changes.map((t, i) => (
                  <li key={i}>
                    <Txt s={t} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="card reveal">
          <h3 className="h3">{p(iv.match.title)}</h3>
          <p className="muted">{p(iv.match.lead)}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {iv.match.cols.map((col, i) => (
                    <th key={i} scope="col">
                      {p(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {iv.match.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>
                        <Txt s={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>
              <Txt s={p(iv.match.total)} />
            </strong>
          </p>
        </div>
      </Section>

      {/* ───────────── 4.8 Gallery ───────────── */}
      <Section id="gallery" n="07" title={p(c.gallery.title)}>
        <p className="lead reveal">{p(c.gallery.lead)}</p>
        <div className="reveal">
          <Gallery
            tabs={c.gallery.tabs.map((t) => ({ id: t.id, label: p(t.label), items: t.items }))}
            ui={{ close: p(c.ui.close), prev: p(c.ui.prev), next: p(c.ui.next), placeholder: p(c.ui.imagePlaceholder) }}
          />
        </div>
        <h3 className="h2 h2-sub reveal">{p(c.gallery.timelineTitle)}</h3>
        <ol className="htl reveal">
          {c.gallery.timeline.map((t, i) => (
            <li key={i}>
              <span className="htl-dot" aria-hidden />
              <span className="htl-date">
                <Txt s={t.date} />
              </span>
              <span className="htl-label">{p(t.label)}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* ───────────── 4.9 Limitations ───────────── */}
      <Section id="limits" n="08" title={p(c.limits.title)} tint>
        <div className="two">
          <div className="card reveal">
            <ul className="list-x">
              {c.limits.items.map((t, i) => (
                <li key={i}>{p(t)}</li>
              ))}
            </ul>
          </div>
          <div className="card reveal">
            <h3 className="h3">{p(c.limits.nextTitle)}</h3>
            <ul className="list-arrow">
              {c.limits.next.map((t, i) => (
                <li key={i}>{p(t)}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ───────────── 4.10 Sources ───────────── */}
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
            <h3 className="h3 mt">{p(c.sources.downloadsTitle)}</h3>
            <div className="dl">
              {c.sources.downloads.map((d, i) =>
                d.href ? (
                  <a key={i} href={d.href} className="btn-sec" download>
                    ↓ {p(d.label)}
                  </a>
                ) : (
                  <span key={i} className="btn-sec btn-off" aria-disabled="true">
                    ↓ {p(d.label)} <Txt s={d.note} />
                  </span>
                ),
              )}
              <a href={c.app.url} className="btn-sec">
                ↗ {p(c.app.label)}
              </a>
            </div>
          </div>
        </div>

        <footer className="rs-foot card reveal">
          <TsgLogo className="foot-logo" />
          <dl>
            {(["author", "school", "supervisor", "contact"] as const).map((k) => (
              <div key={k}>
                <dt>{p(c.footer[k].label)}</dt>
                <dd>
                  <Txt s={c.footer[k].value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted small">
            {c.footer.copyright} · <a href="#hero-h">{p(c.ui.toTop)} ↑</a>
          </p>
        </footer>
      </Section>
    </div>
  );
}
