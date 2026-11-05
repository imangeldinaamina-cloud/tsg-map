"use client";
// Small presentational pieces for the city workspace.
import { ReactNode } from "react";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</legend>
      <div className="flex rounded-lg border border-border bg-surface p-0.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-[40px] flex-1 cursor-pointer flex-col items-center justify-center rounded-md px-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[var(--focus)] ${
              value === o.value ? "bg-white font-semibold text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg"
            }`}
          >
            <input type="radio" className="sr-only" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="leading-tight">{o.label}</span>
            {o.hint && <span className="text-[11px] font-normal leading-tight text-muted">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  id,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      <select
        id={id}
        className="min-h-[40px] w-full rounded-lg border border-border bg-white px-2 text-sm"
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Badge({ kind, children }: { kind: "source" | "modelled" | "baseline" | "assumption" | "uploaded"; children: ReactNode }) {
  const cls = {
    source: "bg-real-bg text-real-fg border-[#93c5fd]",
    baseline: "bg-real-bg text-real-fg border-[#93c5fd]",
    modelled: "bg-[#ede9fe] text-[#4c1d95] border-[#c4b5fd]",
    assumption: "bg-[#ede9fe] text-[#4c1d95] border-[#c4b5fd]",
    uploaded: "bg-demo-bg text-demo-fg border-demo-border",
  }[kind];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/** Horizontal bars with numeric labels (no chart library needed). */
export function Bars({ rows, format, highlight }: { rows: { label: string; value: number }[]; format: (v: number) => string; highlight?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
          <span className={r.label === highlight ? "font-semibold" : "text-muted"}>{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-border">
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${r.label === highlight ? "bg-[#045a8d]" : "bg-[#74a9cf]"}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="tabular-nums">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {note && <div className="text-[11px] text-muted">{note}</div>}
    </div>
  );
}

export function Section({ title, children, aside }: { title?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-border px-4 py-4 first:border-t-0">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
