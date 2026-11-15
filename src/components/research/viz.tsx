"use client";
// Interactive figures of the research page: hex map (people / TSG / filming points), the computation flow,
// the agent schedule, class-change chart, market share and the field explorer (video + YOLO).
import { useEffect, useMemo, useRef, useState } from "react";
import { cellInputs, type HexCell } from "@/lib/research/hex";
import { CATS, PARAMS, SLOTS, transitions, tsgAll, type Cat, type CellResult, type NoValueReason, type TsgClass, type View } from "@/lib/research/math";

/* ───────────── shared ───────────── */

export interface HexData {
  side: number;
  slots: string[];
  cats: string[];
  cells: HexCell[];
  outline: [number, number][];
  points: { id: string; x: number; y: number }[];
}

let hexCache: Promise<HexData> | null = null;
export function useHex(): HexData | null {
  const [d, setD] = useState<HexData | null>(null);
  useEffect(() => {
    hexCache ??= fetch("/research/hexmap.json").then((r) => r.json());
    let on = true;
    hexCache.then((v) => on && setD(v)).catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return d;
}

function Seg<T extends string>({ value, options, onChange, label, small }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div className={`seg${small ? " seg-sm" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fmtN = (v: number, dec: string) => (v >= 1000 ? (v / 1000).toFixed(1).replace(".", dec) + (dec === "," ? " тыс." : "k") : String(Math.round(v)));
const fmtT = (v: number, dec: string) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2).replace(".", dec);

// purple sequential (log scale), matches the paper's figure 2
const PURPLE = ["#f4f1f8", "#dcd3ea", "#b9a6d6", "#9576bf", "#7347a3", "#4a1d7e"];
function lerpHex(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = parseInt(stops[i].slice(1), 16);
  const b = parseInt(stops[i + 1].slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
export const peopleColor = (v: number) => (v < 5 ? "#ececf0" : lerpHex(PURPLE, Math.log10(v) / Math.log10(6500)));
export function tsgColor(t: number | null | undefined) {
  if (t == null) return "#ebebee";
  const a = Math.abs(t);
  if (a < 0.2) return "#c9c8d0";
  const k = 0.35 + 0.65 * Math.min(1, (a - 0.2) / 0.6);
  return t > 0 ? lerpHex(["#dfe8fb", "#2f6fdb"], k) : lerpHex(["#fbe0e4", "#d9475b"], k);
}

/* ───────────── hex map ───────────── */

export interface HexText {
  slots: Record<string, string>; // static, morning, day, evening
  cats?: Record<string, string>;
  timeLabel: string;
  catLabel?: string;
  people: string; // "people"
  tsg?: string;
  noValue?: string;
  changed?: string;
  cell?: string;
}

export function HexSvg({
  data,
  fill,
  onHover,
  onSelect,
  hovered,
  highlight,
  points,
  selected,
  onPoint,
  label,
  fitPoints,
}: {
  data: HexData;
  fill: (i: number) => string;
  onHover: (i: number | null) => void;
  onSelect?: (i: number) => void;
  hovered: number | null;
  highlight?: { cell: number; label: string };
  points?: { id: string; label: string }[];
  selected?: string;
  onPoint?: (id: string) => void;
  label: string;
  fitPoints?: boolean;
}) {
  const s = data.side;
  const xs = data.cells.map((c) => c.x);
  const ys = data.cells.map((c) => c.y);
  const minX = Math.min(...xs) - s * 1.2;
  const maxX = Math.max(...xs) + s * 1.2;
  const minY = Math.min(...ys) - s * 1.2;
  const maxY = Math.max(...ys) + s * 1.2;
  const Y = (y: number) => maxY - y + minY;
  let vb = [minX, minY, maxX - minX, maxY - minY];
  if (fitPoints && data.points.length) {
    const pad = s * 2.6;
    const px = data.points.map((q) => q.x);
    const py = data.points.map((q) => Y(q.y));
    const x0 = Math.min(...px) - pad;
    const y0 = Math.min(...py) - pad;
    vb = [x0, y0, Math.max(...px) + pad - x0, Math.max(...py) + pad - y0];
  }
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k;
      return `${(cx + s * 0.97 * Math.cos(a)).toFixed(0)},${(Y(cy) + s * 0.97 * Math.sin(a)).toFixed(0)}`;
    }).join(" ");
  const pts = points ? data.points.filter((p) => points.some((q) => q.id === p.id)) : [];
  const ptLabel = (id: string) => points?.find((q) => q.id === id)?.label ?? id;
  const hl = highlight ? data.cells[highlight.cell] : null;
  return (
    <svg viewBox={vb.join(" ")} className="hexsvg" role="img" aria-label={label} onMouseLeave={() => onHover(null)}>
      <defs>
        <pattern id="hatch-noserv" width={s * 0.5} height={s * 0.5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={s * 0.5} height={s * 0.5} fill="#fff7e6" />
          <line x1="0" y1="0" x2="0" y2={s * 0.5} stroke="#b7791f" strokeWidth={s * 0.12} />
        </pattern>
      </defs>
      <polygon points={data.outline.map(([x, y]) => `${x},${Y(y)}`).join(" ")} className="hex-outline" />
      {data.cells.map((c, i) => (
        <polygon
          key={i}
          points={hex(c.x, c.y)}
          fill={fill(i)}
          className={hovered === i ? "hex on" : "hex"}
          onMouseEnter={() => onHover(i)}
          onClick={() => (onSelect ? onSelect(i) : onHover(i))}
        />
      ))}
      {hl && highlight && (
        <g className="hex-hl" pointerEvents="none">
          <circle cx={hl.x} cy={Y(hl.y)} r={s * 1.35} />
          <text x={hl.x + s * 1.6} y={Y(hl.y) + s * 0.4}>
            {highlight.label}
          </text>
        </g>
      )}
      {pts.map((p) => (
        <g
          key={p.id}
          className={`hex-pt${selected === p.id ? " sel" : ""}`}
          onClick={() => onPoint?.(p.id)}
          role="button"
          tabIndex={0}
          aria-label={ptLabel(p.id)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPoint?.(p.id)}
        >
          <circle cx={p.x} cy={Y(p.y)} r={s * 0.46} />
          <text x={p.x} y={Y(p.y) + s * 0.17} textAnchor="middle">
            {p.id.replace("P", "")}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** People per cell: registration vs. agent-model presence by slot. */
export function PeopleMap({ t, decimal, legend, source }: { t: HexText; decimal: string; legend: string; source: string }) {
  const data = useHex();
  const [slot, setSlot] = useState<View>("day");
  const [hov, setHov] = useState<number | null>(null);
  const val = (i: number) => (slot === "static" ? data!.cells[i].R : data!.cells[i].D[slot]);
  const max = data ? Math.max(...data.cells.map((_, i) => val(i))) : 0;
  return (
    <div className="viz viz-people">
      <div className="viz-bar">
        <Seg value={slot} onChange={(v) => setSlot(v as View)} label={t.timeLabel} options={(["static", ...SLOTS] as View[]).map((id) => ({ id, label: t.slots[id] }))} />
        <span className="viz-max">
          max <b className="tabnum">{data ? fmtN(max, decimal) : "…"}</b> {t.people}
        </span>
      </div>
      <div className="viz-stage">
        {data ? <HexSvg data={data} fill={(i) => peopleColor(val(i))} onHover={setHov} hovered={hov} label={`${t.slots[slot]}`} /> : <div className="viz-loading" />}
        {data && hov != null && (
          <div className="viz-tip" aria-live="polite">
            <b className="tabnum">{fmtN(val(hov), decimal)}</b> {t.people}
            <span className="muted">
              {" "}
              · {t.slots.static}: {fmtN(data.cells[hov].R, decimal)}
            </span>
          </div>
        )}
      </div>
      <div className="viz-legend">
        <span className="ramp ramp-purple" aria-hidden />
        <span className="tabnum">10</span>
        <span className="tabnum">100</span>
        <span className="tabnum">1 000</span>
        <span className="tabnum">6 000+</span>
        <span className="muted">{legend}</span>
      </div>
      <p className="viz-src">{source}</p>
    </div>
  );
}

/** Text of the cell explainer and comparison mode (content/research.json → results.map.x). */
export interface ExplainText {
  modeLabel: string;
  modeTsg: string;
  modeCmp: string;
  pick: string;
  goto: string;
  cell: string;
  area: string;
  residents: string;
  presence: string;
  supply: string;
  supplyUnit: string;
  shareA: string;
  shareB: string;
  cls: string;
  clsStatic: string;
  changed: string;
  yes: string;
  no: string;
  nearby: string;
  hoursKnown: string;
  distance: string;
  distanceV: string;
  version: string;
  uncertainty: string;
  uncertaintyV: string;
  how: string;
  howNorm: string;
  delta: string;
  deltaNote: string;
  classes: Record<"deficit" | "balance" | "surplus", string>;
  reasons: Record<NoValueReason, string>;
  legendNoService: string;
  legendFew: string;
  trans: { title: string; n: string; toDef: string; toBal: string; toSur: string; same: string; from: string; to: string };
}

const CLASS_ORDER: TsgClass[] = ["deficit", "balance", "surplus"];
const TRANS_COLOR = { same: "#d9d8de", deficit: "#2f6fdb", balance: "#e0a526", surplus: "#d9475b" } as const;

function cellFill(r: CellResult, R: number, D: number) {
  if (r.tsg !== null) return tsgColor(r.tsg);
  if (r.reason === "no_service" && Math.max(R, D) >= PARAMS.dMin) return "url(#hatch-noserv)";
  return "#f3f3f5";
}

/** TSG per cell for a category and view, recomputed from the published inputs (D, S) with the calculation core. */
export function TsgMap({
  t,
  x,
  decimal,
  legend,
  source,
  highlight,
  version,
}: {
  t: HexText;
  x: ExplainText;
  decimal: string;
  legend: { def: string; bal: string; sur: string; none: string };
  source: string;
  highlight: { cell: number; label: string };
  version: string;
}) {
  const data = useHex();
  const [cat, setCat] = useState<Cat>("food");
  const [slot, setSlot] = useState<View>("day");
  const [mode, setMode] = useState<"tsg" | "cmp">("tsg");
  const [hov, setHov] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(highlight.cell);
  const res = useMemo(() => (data ? tsgAll(cellInputs(data, cat, slot)) : null), [data, cat, slot]);
  const stat = useMemo(() => (data ? tsgAll(cellInputs(data, cat, "static")) : null), [data, cat]);
  const tr = useMemo(() => (res && stat && slot !== "static" ? transitions(stat, res) : null), [res, stat, slot]);
  const counts = useMemo(() => {
    if (!res || !data) return null;
    const k = { d: 0, b: 0, s: 0, noServ: 0, few: 0 };
    res.forEach((r, i) => {
      if (r.cls === "deficit") k.d++;
      else if (r.cls === "balance") k.b++;
      else if (r.cls === "surplus") k.s++;
      else if (r.reason === "no_service" && Math.max(data.cells[i].R, slot === "static" ? 0 : data.cells[i].D[slot]) >= PARAMS.dMin) k.noServ++;
      else k.few++;
    });
    return k;
  }, [res, data, slot]);
  const cmpMode = mode === "cmp" && slot !== "static";
  const D = (i: number) => (slot === "static" ? data!.cells[i].R : data!.cells[i].D[slot]);
  const fill = (i: number) => {
    const r = res![i];
    if (!cmpMode) return cellFill(r, data!.cells[i].R, D(i));
    const s = stat![i];
    if (!r.cls || !s.cls) return cellFill(r.cls ? r : s.cls ? s : r, data!.cells[i].R, D(i));
    return r.cls === s.cls ? TRANS_COLOR.same : TRANS_COLOR[r.cls];
  };
  const num = (v: number, d = 0) => v.toLocaleString(decimal === "," ? "ru-RU" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const sig = (v: number) => (v === 0 ? "0" : v.toPrecision(3).replace(".", decimal));
  const sums = useMemo(() => {
    if (!data) return null;
    const inp = cellInputs(data, cat, slot);
    return { D: inp.reduce((s, c) => s + c.D, 0), S: inp.reduce((s, c) => s + c.S, 0) };
  }, [data, cat, slot]);
  const viewName = t.slots[slot];

  return (
    <div className="viz viz-tsg">
      <div className="viz-bar">
        <Seg value={cat} onChange={(v) => setCat(v as Cat)} label={t.catLabel ?? ""} options={CATS.map((id) => ({ id, label: t.cats![id] }))} />
        <Seg value={slot} onChange={(v) => setSlot(v as View)} label={t.timeLabel} options={(["static", ...SLOTS] as View[]).map((id) => ({ id, label: t.slots[id] }))} />
        <Seg value={mode} onChange={(v) => setMode(v as "tsg" | "cmp")} label={x.modeLabel} small options={[{ id: "tsg", label: x.modeTsg }, { id: "cmp", label: x.modeCmp }]} />
      </div>
      <div className="viz-split">
        <div className="viz-stage">
          {data && res ? (
            <HexSvg data={data} fill={fill} onHover={setHov} onSelect={setSel} hovered={sel ?? hov} highlight={highlight} label={`${t.cats![cat]} · ${viewName}`} />
          ) : (
            <div className="viz-loading" />
          )}
          {data && res && hov != null && (
            <div className="viz-tip" aria-live="polite">
              {x.cell} {hov}: {res[hov].tsg == null ? <span className="muted">{x.reasons[res[hov].reason ?? "undefined"]}</span> : <b className="tabnum">TSG {fmtT(res[hov].tsg!, decimal)}</b>}
              <span className="muted">
                {" "}
                · {fmtN(D(hov), decimal)} {t.people}
              </span>
            </div>
          )}
        </div>
        <aside className="viz-side">
          {counts && !cmpMode && (
            <dl className="viz-counts">
              <div className="c-def">
                <dt>{legend.def}</dt>
                <dd className="tabnum">{counts.d}</dd>
              </div>
              <div className="c-bal">
                <dt>{legend.bal}</dt>
                <dd className="tabnum">{counts.b}</dd>
              </div>
              <div className="c-sur">
                <dt>{legend.sur}</dt>
                <dd className="tabnum">{counts.s}</dd>
              </div>
              <div className="c-noserv">
                <dt>{x.legendNoService}</dt>
                <dd className="tabnum">{counts.noServ}</dd>
              </div>
              <div className="c-few">
                <dt>{x.legendFew}</dt>
                <dd className="tabnum">{counts.few}</dd>
              </div>
            </dl>
          )}
          {cmpMode && tr && (
            <div className="trans">
              <p className="trans-h">{x.trans.title}</p>
              <table className="trans-m">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">{x.trans.from}</span>
                    </th>
                    {CLASS_ORDER.map((c) => (
                      <th key={c} scope="col">
                        {x.classes[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CLASS_ORDER.map((a) => (
                    <tr key={a}>
                      <th scope="row">{x.classes[a]}</th>
                      {CLASS_ORDER.map((b) => (
                        <td key={b} className={`tabnum${a === b ? " same" : ` to-${b}`}`}>
                          {tr.matrix[a][b]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                {x.trans.from} → {x.trans.to}. n = {tr.n} {x.trans.n}
              </p>
              <ul className="trans-key">
                <li>
                  <span className="sw" style={{ background: TRANS_COLOR.deficit }} aria-hidden /> {x.trans.toDef}
                </li>
                <li>
                  <span className="sw" style={{ background: TRANS_COLOR.balance }} aria-hidden /> {x.trans.toBal}
                </li>
                <li>
                  <span className="sw" style={{ background: TRANS_COLOR.surplus }} aria-hidden /> {x.trans.toSur}
                </li>
                <li>
                  <span className="sw" style={{ background: TRANS_COLOR.same }} aria-hidden /> {x.trans.same}
                </li>
              </ul>
            </div>
          )}
          {tr && (
            <p className="viz-big">
              <b className="tabnum">{((tr.changed / tr.n) * 100).toFixed(1).replace(".", decimal)}%</b>
              <span>
                {t.changed} (n = {tr.n})
              </span>
            </p>
          )}
          <p className="viz-none">
            <span className="sw sw-hatch" aria-hidden /> {x.legendNoService}
          </p>
          <p className="viz-none">
            <span className="sw" aria-hidden /> {legend.none}
          </p>
        </aside>
      </div>

      <div className="cellx" aria-live="polite">
        <label className="cellx-goto">
          {x.goto}{" "}
          <input
            type="number"
            min={0}
            max={354}
            value={sel ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSel(Number.isInteger(v) && v >= 0 && v <= 354 ? v : null);
            }}
          />
        </label>
        {sel == null || !data || !res || !stat || !sums ? (
          <p className="muted small">{x.pick}</p>
        ) : (
          (() => {
            const c = data.cells[sel];
            const r = res[sel];
            const s = stat[sel];
            const S = c.S[cat][slot];
            const changed = slot !== "static" && r.cls && s.cls ? r.cls !== s.cls : null;
            const delta = slot !== "static" && r.tsg !== null && s.tsg !== null ? r.tsg - s.tsg : null;
            return (
              <div className="cellx-body">
                <h4 className="cellx-h">
                  {x.cell} {sel} · {t.cats![cat]} · {viewName}
                </h4>
                <dl className="cellx-dl">
                  <dt>{x.area}</dt>
                  <dd>0{decimal}25 км²</dd>
                  <dt>{x.residents}</dt>
                  <dd className="tabnum">{num(c.R)}</dd>
                  {slot !== "static" && (
                    <>
                      <dt>{x.presence}</dt>
                      <dd className="tabnum">{num(c.D[slot])}</dd>
                    </>
                  )}
                  <dt>{x.supply}</dt>
                  <dd className="tabnum">
                    {sig(S)} {x.supplyUnit}
                  </dd>
                  <dt>{x.shareA}</dt>
                  <dd className="tabnum">{sig(r.a)}</dd>
                  <dt>{x.shareB}</dt>
                  <dd className="tabnum">{sig(r.b)}</dd>
                  <dt>TSG</dt>
                  <dd className="tabnum">{r.tsg === null ? <span className="muted">{x.reasons[r.reason ?? "undefined"]}</span> : fmtT(r.tsg, decimal)}</dd>
                  <dt>{x.cls}</dt>
                  <dd>{r.cls ? x.classes[r.cls] : "—"}</dd>
                  {slot !== "static" && (
                    <>
                      <dt>{x.clsStatic}</dt>
                      <dd>{s.cls ? `${x.classes[s.cls]} (TSG ${fmtT(s.tsg!, decimal)})` : x.reasons[s.reason ?? "undefined"]}</dd>
                      <dt>{x.changed}</dt>
                      <dd>{changed === null ? "—" : changed ? x.yes : x.no}</dd>
                      <dt>{x.delta}</dt>
                      <dd className="tabnum">{delta === null ? "—" : fmtT(delta, decimal)}</dd>
                    </>
                  )}
                  <dt>{x.nearby}</dt>
                  <dd className="tabnum">
                    {c.N[cat]} ({x.hoursKnown}: {c.Nh[cat]})
                  </dd>
                  <dt>{x.distance}</dt>
                  <dd>{x.distanceV}</dd>
                  <dt>{x.version}</dt>
                  <dd>{version}</dd>
                </dl>
                <details className="cellx-how">
                  <summary>{x.how}</summary>
                  <p className="tabnum">
                    a = D / ΣD = {num(slot === "static" ? c.R : c.D[slot])} / {num(sums.D)} = {sig(r.a)}
                    <br />b = S / ΣS = {sig(S)} / {sig(sums.S)} = {sig(r.b)}
                    <br />
                    {r.tsg === null ? (
                      x.reasons[r.reason ?? "undefined"]
                    ) : (
                      <>
                        TSG = (a − b) / (a + b) = {fmtT(r.tsg, decimal)} → {x.classes[r.cls!]} (τ = 0{decimal}2)
                      </>
                    )}
                  </p>
                  <p className="muted small">{x.howNorm}</p>
                  {delta !== null && <p className="muted small">{x.deltaNote}</p>}
                </details>
              </div>
            );
          })()
        )}
      </div>
      <p className="viz-src">{source}</p>
    </div>
  );
}

/* ───────────── method: flow diagram ───────────── */

export interface FlowNode {
  id: string;
  kind: string;
  title: string;
  text: string;
  formula?: string;
  detailTitle: string;
  detail: string;
}

export function Flow({ nodes, formulaLabel }: { nodes: FlowNode[]; formulaLabel: string }) {
  const [sel, setSel] = useState("tsg");
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const cur = by[sel];
  const Node = ({ id }: { id: string }) => {
    const n = by[id];
    return (
      <button type="button" className={`fn fn-${n.kind}`} aria-pressed={sel === id} onClick={() => setSel(id)}>
        <span className="fn-t">{n.title}</span>
        <span className="fn-x">{n.text}</span>
        {n.formula && (
          <span className="fn-f">
            {formulaLabel} {n.formula}
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="flow">
      <div className="flow-grid">
        <Node id="people" />
        <span className="fa fa-r" aria-hidden>
          →
        </span>
        <Node id="agents" />
        <Node id="services" />
        <span className="fa fa-r" aria-hidden>
          →
        </span>
        <Node id="supply" />
        <span className="fa fa-d fa-wide" aria-hidden>
          ↓
        </span>
        <div className="fn-wide">
          <Node id="tsg" />
        </div>
        <span className="fa fa-d fa-wide" aria-hidden>
          ↓
        </span>
        <Node id="video" />
        <span className="fa fa-r" aria-hidden>
          ↔
        </span>
        <Node id="app" />
      </div>
      <div className="flow-detail" aria-live="polite">
        <h4>{cur.detailTitle}</h4>
        <p>{cur.detail}</p>
      </div>
    </div>
  );
}

/* ───────────── method: agent schedule ───────────── */

export function Schedule({
  slots,
  rows,
  hint,
  typeLabel,
  shareLabel,
}: {
  slots: { id: string; label: string; time: string }[];
  rows: { type: string; share: number; shareText?: string; cells: string[] }[];
  hint: string;
  typeLabel: string;
  shareLabel: string;
}) {
  const [k, setK] = useState(1);
  const home = (s: string) => /^(дома|home|үйде)/i.test(s);
  return (
    <div className="sched">
      <div className="viz-bar">
        <Seg value={String(k)} onChange={(v) => setK(Number(v))} label={hint} options={slots.map((s, i) => ({ id: String(i), label: `${s.label} · ${s.time}` }))} />
      </div>
      <div className="sched-bar" aria-hidden>
        {rows.map((r, i) => (
          <span key={i} style={{ flexGrow: r.share }} className={home(r.cells[k]) ? "home" : "out"}>
            {r.type} {r.shareText ?? r.share}%
          </span>
        ))}
      </div>
      <div className="table-wrap">
        <table className="t t-sched">
          <thead>
            <tr>
              <th scope="col">{typeLabel}</th>
              <th scope="col" className="num">
                {shareLabel}
              </th>
              {slots.map((s, i) => (
                <th key={s.id} scope="col" className={i === k ? "on" : ""}>
                  {s.label}
                  <span className="th-sub">{s.time}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <th scope="row">{r.type}</th>
                <td className="num tabnum">{r.shareText ?? r.share}%</td>
                {r.cells.map((cval, i) => (
                  <td key={i} className={i === k ? "on" : ""}>
                    {cval}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── results: class change (Table 2) ───────────── */

export function ClassChange({
  rows,
  cols,
  slots,
  views,
}: {
  rows: { name: string; v: number[]; ci: string[]; rho: string }[];
  cols: string[];
  slots: string[];
  views: [string, string];
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <div className="cc">
      <div className="viz-bar">
        <Seg
          small
          value={view}
          onChange={setView}
          label={views.join(" / ")}
          options={[
            { id: "chart", label: views[0] },
            { id: "table", label: views[1] },
          ]}
        />
        <span className="cc-key" aria-hidden>
          {slots.map((s, i) => (
            <span key={s} className={`k k${i}`}>
              {s}
            </span>
          ))}
        </span>
      </div>
      {view === "chart" ? (
        <div className="cc-chart">
          {rows.map((r) => (
            <div key={r.name} className="cc-row">
              <span className="cc-name">{r.name}</span>
              <div className="cc-bars">
                {r.v.map((v, i) => (
                  <span key={i} className={`cc-bar k${i}`} style={{ width: `${(v / 40) * 100}%` }} title={`${slots[i]}: ${v}% [${r.ci[i]}]`}>
                    <b className="tabnum">{v}%</b>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={i} scope="col" className={i ? "num" : ""}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  {r.v.map((v, i) => (
                    <td key={i} className="num tabnum">
                      {v}% <span className="muted">[{r.ci[i]}]</span>
                    </td>
                  ))}
                  <td className="num tabnum">{r.rho}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───────────── results: market share of a new shop ───────────── */

export function MarketShare({
  options,
  slots,
  stat,
  statLabel,
  hoursLabel,
}: {
  options: { hours: string; v: number[] }[];
  slots: string[];
  stat: number;
  statLabel: string;
  hoursLabel: string;
}) {
  const [k, setK] = useState(0);
  const max = 32;
  return (
    <div className="ms">
      <div className="viz-bar">
        <span className="muted small">{hoursLabel}</span>
        <Seg small value={String(k)} onChange={(v) => setK(Number(v))} label={hoursLabel} options={options.map((o, i) => ({ id: String(i), label: o.hours }))} />
      </div>
      <div className="ms-cols">
        {slots.map((s, i) => (
          <div key={s} className="ms-col">
            <div className="ms-track">
              <span className="ms-stat" style={{ bottom: `${(stat / max) * 100}%` }} aria-hidden />
              <span className="ms-fill" style={{ height: `${(options[k].v[i] / max) * 100}%` }}>
                <b className="tabnum">{options[k].v[i]}%</b>
              </span>
            </div>
            <span className="ms-label">{s}</span>
          </div>
        ))}
      </div>
      <p className="ms-note">
        <span className="ms-dash" aria-hidden /> {stat}% — {statLabel}
      </p>
    </div>
  );
}

/* ───────────── field: points map + video ───────────── */

export interface FieldPoint {
  id: string;
  name: string;
  type: string;
  role: string;
  clips: number;
  mean: (number | null)[];
  video: string;
  videoDate: string;
  videoSlot: string;
  raw: boolean;
}

export function FieldExplorer({
  points,
  t,
  decimal,
}: {
  points: FieldPoint[];
  t: { hint: string; rawHidden: string; raw: string; yolo: string; slow: string; meanTitle: string; slots: string[]; roleCalib: string; roleControl: string; cols: string[]; slotNames: Record<string, string> };
  decimal: string;
}) {
  const data = useHex();
  const [sel, setSel] = useState("P05");
  const [mode, setMode] = useState<"raw" | "yolo">("yolo");
  const [hov, setHov] = useState<number | null>(null);
  const vref = useRef<HTMLVideoElement>(null);
  const p = points.find((x) => x.id === sel)!;
  const m = p.raw ? mode : "yolo";
  const src = `/research/video/${p.video}${m === "yolo" ? "-yolo" : ""}`;
  const max = Math.max(...points.flatMap((x) => x.mean.filter((v): v is number => v != null)));
  useEffect(() => {
    vref.current?.load();
    vref.current?.play().catch(() => {});
  }, [src]);
  return (
    <div className="field">
      <div className="field-map">
        {data ? (
          <HexSvg
            data={data}
            fill={(i) => (data.cells[i].D.day < 5 ? "#f1f2ef" : lerpHex(["#eef0ec", "#c9d6c8", "#8fb19a"], Math.log10(data.cells[i].D.day) / Math.log10(6500)))}
            onHover={setHov}
            hovered={hov}
            points={points.map((x) => ({ id: x.id, label: `${x.id} · ${x.name}` }))}
            selected={sel}
            onPoint={setSel}
            label={t.hint}
            fitPoints
          />
        ) : (
          <div className="viz-loading" />
        )}
        <ol className="field-list">
          {points.map((x) => (
            <li key={x.id}>
              <button type="button" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
                <span className="tabnum">{x.id}</span> {x.name}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="field-view">
        <div className="field-video">
          <video ref={vref} key={src} muted loop playsInline autoPlay preload="metadata" poster={`${src}.jpg`} aria-label={`${p.id} · ${p.name}`}>
            <source src={`${src}.mp4`} type="video/mp4" />
          </video>
          <div className="field-toggle">
            {p.raw ? (
              <Seg
                small
                value={m}
                onChange={setMode}
                label={`${t.raw} / ${t.yolo}`}
                options={[
                  { id: "raw", label: t.raw },
                  { id: "yolo", label: t.yolo },
                ]}
              />
            ) : (
              <span className="field-hidden">{t.rawHidden}</span>
            )}
          </div>
        </div>
        <p className="field-cap">
          <b>
            {p.id} · {p.name}
          </b>{" "}
          — {p.type}, {p.role === "calib" ? t.roleCalib : t.roleControl} · {p.videoDate} ({t.slotNames[p.videoSlot]}) · <span className="muted">{t.slow}</span>
        </p>
        <h4 className="field-h">{t.meanTitle}</h4>
        <div className="field-bars">
          {p.mean.map((v, i) => (
            <div key={i} className="fb">
              <span className="fb-l">{t.slots[i]}</span>
              <span className="fb-t">
                <span className="fb-f" style={{ width: v == null ? 0 : `${(v / max) * 100}%` }} />
              </span>
              <span className="fb-v tabnum">{v == null ? "—" : v.toFixed(1).replace(".", decimal)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
