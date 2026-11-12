"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { crossingsOf, GeoHit, search, StreetIndex } from "@/lib/city/geocode";

let cache: Promise<StreetIndex> | null = null;
function loadStreets(): Promise<StreetIndex> {
  cache ??= fetch("/data/taldykorgan/streets.json").then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  return cache;
}

/** Street / intersection search. A crossing goes straight to the Location analysis; a street opens its along-street view. */
export function StreetSearch(props: {
  onCrossing: (hit: Extract<GeoHit, { kind: "crossing" }>) => void;
  onStreet: (street: { name: string; points: [number, number][]; crossings: GeoHit[] }) => void;
}) {
  const { t } = useI18n();
  const [idx, setIdx] = useState<StreetIndex | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const ensure = () => {
    if (idx || failed) return;
    loadStreets().then(setIdx, () => setFailed(true));
  };
  useEffect(() => setActive(0), [q]);

  const hits = useMemo(() => (idx ? search(idx, q) : []), [idx, q]);

  const choose = (h: GeoHit) => {
    if (!idx) return;
    setOpen(false);
    setQ(h.label);
    if (h.kind === "crossing") props.onCrossing(h);
    else props.onStreet({ name: idx.streets[h.street].n, points: idx.streets[h.street].p, crossings: crossingsOf(idx, h.street) });
  };

  return (
    <div className="relative">
      <label htmlFor={`${listId}-in`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {t("city.search.label")}
      </label>
      <input
        ref={inputRef}
        id={`${listId}-in`}
        type="search"
        role="combobox"
        aria-expanded={open && q.length > 1}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={t("city.search.placeholder")}
        value={q}
        onFocus={() => {
          ensure();
          setOpen(true);
        }}
        onChange={(e) => {
          ensure();
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            choose(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="min-h-[44px] w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-fg"
      />
      {open && q.trim().length > 1 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {!idx && !failed && <p className="p-3 text-sm text-muted" role="status">{t("city.search.loading")}</p>}
          {failed && <p className="p-3 text-sm text-[#7c2d12]" role="alert">{t("city.loadError")}</p>}
          {idx && hits.length === 0 && <p className="p-3 text-sm text-muted">{t("city.search.empty")}</p>}
          {idx && hits.length > 0 && (
            <ul id={listId} role="listbox" aria-label={t("city.search.label")}>
              {hits.map((h, i) => (
                <li
                  key={`${h.label}-${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 text-sm ${i === active ? "bg-surface" : ""}`}
                >
                  <span>{h.label}</span>
                  <span className="shrink-0 text-xs text-muted">{t(`city.search.${h.kind}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{t("city.search.hint")}</p>
    </div>
  );
}
