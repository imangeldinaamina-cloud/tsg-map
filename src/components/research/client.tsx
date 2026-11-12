"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALE_COOKIE, type Locale } from "@/i18n";
import { Txt } from "./bits";

/** RU / EN / KZ switch; shares the site-wide language cookie. */
export function LangToggle({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const opts: [Locale, string][] = [
    ["ru", "RU"],
    ["en", "EN"],
    ["kk", "KZ"],
  ];
  return (
    <div className="lang" role="group" aria-label={label}>
      {opts.map(([l, txt]) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          lang={l}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
        >
          {txt}
        </button>
      ))}
    </div>
  );
}

/** Scroll-reveal for elements with class "reveal". Off for prefers-reduced-motion and without JS. */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".rs");
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    const vh = window.innerHeight;
    // Anything already on screen stays visible: no flash on load.
    els.forEach((el) => el.getBoundingClientRect().top < vh && el.classList.add("in"));
    root.classList.add("rs-anim");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => !el.classList.contains("in") && io.observe(el));
    // Printing (e.g. saving the page as PDF) must show everything.
    const showAll = () => els.forEach((el) => el.classList.add("in"));
    window.addEventListener("beforeprint", showAll);
    return () => {
      io.disconnect();
      window.removeEventListener("beforeprint", showAll);
    };
  }, []);
  return null;
}

export interface DemoText {
  title: string;
  hint: string;
  a: string;
  b: string;
  presets: string;
  deficit: string;
  balance: string;
  surplus: string;
  undefined: string;
}

const TAU = 0.2;

/** Interactive TSG calculator: two shares in, index and class out. */
export function TsgDemo({ t, decimal }: { t: DemoText; decimal: string }) {
  const [a, setA] = useState(2);
  const [b, setB] = useState(1);
  const tsg = a + b > 0 ? (a - b) / (a + b) : null;
  const cls = tsg === null ? null : tsg >= TAU ? "deficit" : tsg <= -TAU ? "surplus" : "balance";
  const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", decimal).replace("-", "−");
  const presets: [string, number, number][] = [
    ["a = 2b", 2, 1],
    ["a = b", 1.5, 1.5],
    ["a = 0.5b", 1, 2],
  ];
  return (
    <div className="demo card sticker">
      <h3 className="h3">{t.title}</h3>
      <p className="muted">{t.hint}</p>
      <div className="demo-grid">
        <div className="demo-inputs">
          {(
            [
              ["a", a, setA, t.a],
              ["b", b, setB, t.b],
            ] as const
          ).map(([id, v, set, label]) => (
            <label key={id} className="slider">
              <span className="slider-top">
                <span>{label}</span>
                <output className="tabnum">{fmt(v, 1)}%</output>
              </span>
              <input type="range" min={0} max={10} step={0.1} value={v} onChange={(e) => set(Number(e.target.value))} />
            </label>
          ))}
          <div className="presets" role="group" aria-label={t.presets}>
            <span className="muted small">{t.presets}:</span>
            {presets.map(([name, pa, pb]) => (
              <button
                key={name}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setA(pa);
                  setB(pb);
                }}
              >
                {name.replace(".", decimal)}
              </button>
            ))}
          </div>
        </div>
        <div className="demo-out" aria-live="polite">
          <div className="demo-value tabnum">{tsg === null ? "—" : `${tsg > 0 ? "+" : ""}${fmt(tsg)}`}</div>
          <div className={`demo-class cls-${cls ?? "none"}`}>{cls ? t[cls] : t.undefined}</div>
          <div className="scale" aria-hidden>
            <div className="scale-bar" />
            <span className="scale-tick" style={{ left: `${((1 - TAU) / 2) * 100}%` }} />
            <span className="scale-tick" style={{ left: `${((1 + TAU) / 2) * 100}%` }} />
            {tsg !== null && <span className="scale-marker" style={{ left: `${((tsg + 1) / 2) * 100}%` }} />}
            <div className="scale-labels">
              <span>−1</span>
              <span>0</span>
              <span>+1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface GalleryItem {
  src: string | null;
  caption: string;
  date: string;
  alt: string;
}
export interface GalleryTab {
  id: string;
  label: string;
  items: GalleryItem[];
}

/** Tabbed masonry gallery with an accessible <dialog> lightbox. */
export function Gallery({ tabs, ui }: { tabs: GalleryTab[]; ui: { close: string; prev: string; next: string; placeholder: string } }) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const items = tabs[tab].items;
  const shown = items.filter((i) => i.src);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const step = (dir: number) => setOpen((o) => (o === null ? o : (o + dir + shown.length) % shown.length));
  const ratios = ["4 / 3", "3 / 4", "1 / 1", "16 / 10"];
  const cur = open !== null ? shown[open] : null;

  return (
    <div>
      <div
        className="tabs"
        role="tablist"
        aria-label="Gallery"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const n = (tab + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          setTab(n);
          tabRefs.current[n]?.focus();
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`gt-${t.id}`}
            aria-selected={i === tab}
            aria-controls={`gp-${t.id}`}
            tabIndex={i === tab ? 0 : -1}
            onClick={() => setTab(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="masonry" role="tabpanel" id={`gp-${tabs[tab].id}`} aria-labelledby={`gt-${tabs[tab].id}`}>
        {items.map((it, i) => {
          const fig = (
            <>
              {it.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.src} alt={it.alt} loading="lazy" decoding="async" />
              ) : (
                <div className="slot-ph" style={{ aspectRatio: ratios[i % ratios.length] }} role="img" aria-label={it.alt}>
                  <span className="ph">[{ui.placeholder}]</span>
                </div>
              )}
              <figcaption>
                <Txt s={it.caption} /> · <Txt s={it.date} />
              </figcaption>
            </>
          );
          return (
            <figure key={i} className="m-item">
              {it.src ? (
                <button type="button" className="m-btn" onClick={() => setOpen(shown.indexOf(it))}>
                  {fig}
                </button>
              ) : (
                fig
              )}
            </figure>
          );
        })}
      </div>
      <dialog
        ref={dlg}
        className="lightbox"
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dlg.current && setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        {cur && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.src!} alt={cur.alt} />
            <figcaption>
              <Txt s={cur.caption} /> · <Txt s={cur.date} />
            </figcaption>
          </figure>
        )}
        <div className="lb-ctrl">
          {shown.length > 1 && (
            <button type="button" onClick={() => step(-1)} aria-label={ui.prev}>
              ←
            </button>
          )}
          <button type="button" onClick={() => setOpen(null)}>
            {ui.close} ✕
          </button>
          {shown.length > 1 && (
            <button type="button" onClick={() => step(1)} aria-label={ui.next}>
              →
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}
