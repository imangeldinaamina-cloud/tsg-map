"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { SERVICE_CATS } from "@/lib/city/types";
import { TSG_COLORS, TSG_SYMBOL } from "@/lib/tsg";
import type { LayerState } from "./CityMap";
import { CAT_COLORS, DIST_STEPS, DIV, LANDUSE_COLORS, SEQ } from "./palette";

export function CityLegend(props: {
  tab: "population" | "gaps" | "location";
  view: "residents" | "presence" | "diff";
  gapView: "sgi" | "dist";
  period: string;
  cat: string;
  breaks: number[];
  cellM: number;
  layers: LayerState;
  setLayers: (l: LayerState) => void;
  fmt: (v: number) => string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  // Start collapsed on short screens so the map stays visible.
  useEffect(() => {
    if (window.innerHeight < 760 || window.innerWidth < 768) setOpen(false);
  }, []);
  const { tab, view, breaks, fmt } = props;
  const seqStart = SEQ.length - 1 - breaks.length;
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-8 flex flex-col items-start gap-2 md:inset-x-auto md:left-3 md:max-w-[300px]">
      <div className="pointer-events-auto w-full rounded-lg border border-border bg-white/95 text-xs shadow-sm backdrop-blur">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 font-semibold">
          {tab === "population"
            ? view === "residents"
              ? t("city.legend.residents")
              : view === "presence"
                ? t("city.legend.presence", { period: props.period })
                : t("city.legend.diff", { period: props.period })
            : props.gapView === "dist"
              ? t("city.legend.dist", { cat: props.cat })
              : t("city.legend.sgi", { cat: props.cat, period: props.period })}
          <span aria-hidden className="ml-2 text-muted">{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div className="space-y-2 border-t border-border px-3 py-2">
            {tab === "population" && view !== "diff" && (
              <ul className="grid grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-0.5">
                {SEQ.slice(seqStart).map((c, k) => (
                  <li key={c} className="text-center">
                    <span className="block h-2.5 rounded-sm ring-1 ring-inset ring-black/10" style={{ background: c }} />
                    <span className="tabular-nums text-muted">{k === 0 ? `<${fmt(breaks[0] ?? 0)}` : `${fmt(breaks[k - 1])}+`}</span>
                  </li>
                ))}
              </ul>
            )}
            {tab === "population" && view === "diff" && (
              <div>
                <div className="flex h-2.5 overflow-hidden rounded-sm ring-1 ring-inset ring-black/10">
                  {DIV.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-0.5 flex justify-between text-muted">
                  <span>− {t("city.legend.fewer")}</span>
                  <span>+ {t("city.legend.more")}</span>
                </div>
              </div>
            )}
            {tab !== "population" && props.gapView === "dist" && (
              <ul className="space-y-0.5">
                {DIST_STEPS.map((d, k) => (
                  <li key={d.color} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-5 rounded-sm ring-1 ring-inset ring-black/15" style={{ background: d.color }} />
                    <span className="tabular-nums">{d.max !== null ? t("city.meters", { n: `${k === 0 ? "≤ " : `${DIST_STEPS[k - 1].max}–`}${d.max}` }) : t("city.gap.beyond")}</span>
                  </li>
                ))}
              </ul>
            )}
            {tab !== "population" && props.gapView !== "dist" && (
              <ul className="space-y-0.5">
                {(["strong_shortage", "shortage", "balanced", "surplus", "strong_surplus"] as const).map((l) => (
                  <li key={l} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-5 rounded-sm ring-1 ring-inset ring-black/15" style={{ background: TSG_COLORS[l] }} />
                    <span className="w-6 text-center" aria-hidden>{TSG_SYMBOL[l]}</span>
                    <span>
                      {l === "strong_shortage" ? "≥ +0.50 " : l === "shortage" ? "+0.15…+0.50 " : l === "balanced" ? "±0.15 " : l === "surplus" ? "−0.50…−0.15 " : "≤ −0.50 "}
                      <span className="text-muted">
                        {l.includes("shortage") ? t("city.legend.gap") : l === "balanced" ? t("city.legend.balanced") : t("city.legend.surplus")}
                      </span>
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <span className="inline-block h-3 w-5 rounded-sm border-2 border-fg" />
                  <span className="w-6" />
                  <span>{t("city.cell.underserved")}</span>
                </li>
              </ul>
            )}
            <p className="text-muted">
              {t("city.legend.cell", { m: props.cellM })} · {t("city.legend.noData")}: <span aria-hidden>□</span>
            </p>
            {props.layers.facilities && (
              <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
                {SERVICE_CATS.map((c) => (
                  <li key={c} className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: CAT_COLORS[c] }} />
                    {t(`city.cats.${c}`)}
                  </li>
                ))}
              </ul>
            )}
            {props.layers.landuse && (
              <ul className="flex flex-wrap gap-x-2">
                {(
                  [
                    ["residential", "landRes"],
                    ["commercial", "landCom"],
                    ["industrial", "landInd"],
                  ] as const
                ).map(([k, label]) => (
                  <li key={k} className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: LANDUSE_COLORS[k] }} />
                    {t(`city.legend.${label}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <fieldset className="pointer-events-auto rounded-lg border border-border bg-white/95 text-xs shadow-sm backdrop-blur">
        <legend className="sr-only">{t("city.layers.title")}</legend>
        <button type="button" onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen} className="flex min-h-[32px] w-full items-center justify-between gap-3 px-3 font-semibold">
          ◫ {t("city.layers.title")}
          <span aria-hidden className="text-muted">{layersOpen ? "▾" : "▸"}</span>
        </button>
        <div className={`flex-wrap gap-x-3 gap-y-1 border-t border-border px-3 py-2 ${layersOpen ? "flex" : "hidden"}`}>
          {(Object.keys(props.layers) as (keyof LayerState)[]).map((k) => (
            <label key={k} className="flex min-h-[28px] cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={props.layers[k]} onChange={(e) => props.setLayers({ ...props.layers, [k]: e.target.checked })} />
              {t(`city.layers.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
