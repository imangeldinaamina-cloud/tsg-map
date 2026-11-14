"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HexSvg, peopleColor, tsgColor, type HexData } from "@/components/research/viz";
import { cellInputs, withOutlet } from "@/lib/research/hex";
import { classify, openFraction, PARAMS, SLOT_HOURS, transitions, tsgAll, tvDistance } from "@/lib/research/math";

interface Step {
  title: string;
  text: string;
  [k: string]: string | undefined;
}
export interface DemoText {
  title: string;
  exit: string;
  prev: string;
  next: string;
  keys: string;
  version: string;
  loading: string;
  error: string;
  steps: Step[];
  legend: { def: string; bal: string; sur: string; noServ: string; few: string };
  share: { hours: string; morning: number }[];
  classes: Record<"deficit" | "balance" | "surplus", string>;
}

const FOCUS = 206;
const PEAK = 173;
const HOURS: [number, number][] = [
  [9, 21],
  [7, 19],
];

export function DemoPlayer({ t, decimal }: { t: DemoText; decimal: string }) {
  const [data, setData] = useState<HexData | null>(null);
  const [err, setErr] = useState(false);
  const [step, setStep] = useState(0);
  const [hi, setHi] = useState(0); // opening-hours option of step 5
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    let on = true;
    fetch("/research/hexmap.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v: HexData) => {
        if (!on) return;
        if (!Array.isArray(v.cells) || v.cells.length !== 355 || !v.cells[0]?.S) throw new Error("unexpected data");
        setData(v);
      })
      .catch(() => on && setErr(true));
    return () => {
      on = false;
    };
  }, []);

  const go = useCallback((d: number) => setStep((s) => Math.max(0, Math.min(t.steps.length - 1, s + d))), [t.steps.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go]);

  const calc = useMemo(() => {
    if (!data) return null;
    const stat = tsgAll(cellInputs(data, "food", "static"));
    const day = tsgAll(cellInputs(data, "food", "day"));
    const morning = tsgAll(cellInputs(data, "food", "morning"));
    const tr = transitions(stat, day);
    const m = tvDistance(
      data.cells.map((c) => c.R),
      data.cells.map((c) => c.D.day),
    );
    const noServ = day.filter((r, i) => r.reason === "no_service" && Math.max(data.cells[i].R, data.cells[i].D.day) >= PARAMS.dMin).length;
    const f = data.cells[FOCUS];
    const scen = HOURS.map(([o, cl]) => {
      const open = openFraction(o, cl, SLOT_HOURS.morning)!;
      const after = tsgAll(withOutlet(data, "food", "morning", { x: f.x, y: f.y, open }));
      const changed = after.filter((r, i) => r.cls !== morning[i].cls).length;
      return { open, after, changed };
    });
    return { stat, day, morning, tr, m, noServ, scen };
  }, [data]);

  const n = (v: number, d = 0) => v.toLocaleString(decimal === "," ? "ru-RU" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const sgn = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2).replace(".", decimal);
  const s = t.steps[step];

  let fill: ((i: number) => string) | null = null;
  if (data && calc) {
    const tsgFill = (r: (typeof calc.day)[number], i: number, D: number) =>
      r.tsg !== null ? tsgColor(r.tsg) : r.reason === "no_service" && Math.max(data.cells[i].R, D) >= PARAMS.dMin ? "url(#hatch-noserv)" : "#f3f3f5";
    if (step === 0) fill = (i) => peopleColor(data.cells[i].R);
    else if (step === 1) fill = (i) => peopleColor(data.cells[i].D.day);
    else if (step === 2 || step === 3) fill = (i) => tsgFill(calc.day[i], i, data.cells[i].D.day);
    else fill = (i) => tsgFill(calc.scen[hi].after[i], i, data.cells[i].D.morning);
  }
  const highlight = step === 0 || step === 1 ? { cell: PEAK, label: `173` } : step >= 3 ? { cell: FOCUS, label: "206" } : undefined;

  return (
    <div className="demo rs" role="application" aria-roledescription="presentation">
      <header className="demo-top">
        <span className="demo-brand">{t.title}</span>
        <ol className="demo-dots" aria-label="steps">
          {t.steps.map((st, i) => (
            <li key={i}>
              <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)} aria-label={st.title}>
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
        <Link href="/#results" className="demo-exit">
          {t.exit} ×
        </Link>
      </header>

      <main className="demo-main">
        <div className="demo-map">
          {err ? (
            <p className="demo-err" role="alert">
              {t.error}
            </p>
          ) : data && fill ? (
            <HexSvg data={data} fill={fill} onHover={setHov} hovered={hov} highlight={highlight} label={s.title} />
          ) : (
            <p className="demo-loading">{t.loading}</p>
          )}
        </div>

        <section className="demo-panel" aria-live="polite">
          <h1 className="demo-h">{s.title}</h1>
          <p className="demo-text">{s.text}</p>
          {data && calc && (
            <div className="demo-kpis">
              {step === 0 && (
                <>
                  <Kpi v={n(data.cells[PEAK].R)} l={s.k1} />
                  <Kpi v="355" l={s.k2} />
                </>
              )}
              {step === 1 && (
                <>
                  <Kpi v={n(data.cells[PEAK].D.day)} l={s.k1} sub={`× ${(data.cells[PEAK].D.day / data.cells[PEAK].R).toFixed(1).replace(".", decimal)}`} />
                  <Kpi v={`${n(calc.m! * 100)}%`} l={s.k2} />
                </>
              )}
              {step === 2 && (
                <>
                  <Kpi v={`${n((calc.tr.changed / calc.tr.n) * 100)}%`} l={`${s.k1} (n = ${calc.tr.n})`} />
                  <Kpi v={String(calc.noServ)} l={s.k2} />
                </>
              )}
              {step === 3 && (
                <>
                  <Kpi v={n(data.cells[FOCUS].R)} l={s.residents} />
                  <Kpi v={n(data.cells[FOCUS].D.morning)} l={`${s.morning} · TSG ${sgn(calc.morning[FOCUS].tsg!)}`} />
                  <Kpi v={n(data.cells[FOCUS].D.day)} l={`${s.day} · TSG ${sgn(calc.day[FOCUS].tsg!)}`} />
                  <p className="demo-note">
                    TSG {sgn(calc.stat[FOCUS].tsg!)} → {sgn(calc.morning[FOCUS].tsg!)} → {sgn(calc.day[FOCUS].tsg!)}
                  </p>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="demo-seg" role="group" aria-label={s.hours ?? ""}>
                    {HOURS.map(([o, cl], i) => (
                      <button key={i} type="button" aria-pressed={hi === i} onClick={() => setHi(i)}>
                        {o}:00–{cl}:00
                      </button>
                    ))}
                  </div>
                  <Kpi v={`${n(calc.scen[hi].open * 100)}%`} l={s.open} />
                  <Kpi
                    v={`${sgn(calc.morning[FOCUS].tsg!)} → ${sgn(calc.scen[hi].after[FOCUS].tsg!)}`}
                    l={`${s.tsg206} (${calc.scen[hi].after[FOCUS].tsg !== null ? t.classes[classify(calc.scen[hi].after[FOCUS].tsg!)] : "—"})`}
                  />
                  <Kpi v={String(calc.scen[hi].changed)} l={s.classChanged} />
                  <Kpi v={`${t.share.find((x) => x.hours.startsWith(String(HOURS[hi][0])))?.morning ?? "—"}%`} l={s.huff} />
                  <p className="demo-note">{s.huffNote}</p>
                </>
              )}
            </div>
          )}
          {(step === 2 || step === 4) && (
            <ul className="demo-legend">
              <li>
                <i style={{ background: "#2f6fdb" }} /> {t.legend.def}
              </li>
              <li>
                <i style={{ background: "#c9c8d0" }} /> {t.legend.bal}
              </li>
              <li>
                <i style={{ background: "#d9475b" }} /> {t.legend.sur}
              </li>
              <li>
                <i className="hatch" /> {t.legend.noServ}
              </li>
            </ul>
          )}
        </section>
      </main>

      <footer className="demo-foot">
        <button type="button" onClick={() => go(-1)} disabled={step === 0}>
          ← {t.prev}
        </button>
        <span className="demo-ver">
          {t.version} · {t.keys}
        </span>
        <button type="button" onClick={() => go(1)} disabled={step === t.steps.length - 1}>
          {t.next} →
        </button>
      </footer>
    </div>
  );
}

function Kpi({ v, l = "", sub }: { v: string; l?: string; sub?: string }) {
  return (
    <div className="demo-kpi">
      <b className="tabnum">
        {v}
        {sub && <small> {sub}</small>}
      </b>
      <span>{l}</span>
    </div>
  );
}
