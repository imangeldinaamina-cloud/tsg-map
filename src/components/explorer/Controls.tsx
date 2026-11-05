"use client";
import { useI18n } from "@/i18n/client";
import { CATEGORIES, FREE_SLOT, RADIUS_OPTIONS_M, SLOTS } from "@/lib/domain";
import { Filters } from "@/lib/client/explorer";
import { usePro } from "@/lib/client/pro";

interface Props {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  hasReal: boolean;
  showServices?: boolean;
  setShowServices?: (v: boolean) => void;
}

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  locked,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  locked?: (v: T) => boolean;
}) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const isLocked = locked?.(o.value) ?? false;
          return (
            <label key={o.value} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <span className="flex min-h-[44px] items-center gap-1 rounded-lg border border-border bg-white px-3 text-sm font-medium peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--focus)]">
                {o.label}
                {isLocked && (
                  <span className="rounded bg-slate-800 px-1 text-[10px] font-bold uppercase text-white">🔒 {t("pro.badge")}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Controls({ filters, setFilter, hasReal, showServices, setShowServices }: Props) {
  const { t, locale } = useI18n();
  const pro = usePro();
  const unit = locale === "en" ? "m" : "м";
  return (
    <div className="space-y-4">
      <Segmented
        legend={t("dataset.label")}
        name="ds"
        value={filters.ds ?? "demo"}
        options={[
          { value: "real", label: t("dataset.real") },
          { value: "demo", label: t("dataset.demo") },
        ]}
        onChange={(v) => setFilter("ds", v)}
      />
      {!hasReal && <p className="text-xs text-muted">{t("dataset.noReal")}</p>}
      <Segmented
        legend={t("map.slot")}
        name="slot"
        value={filters.slot}
        options={SLOTS.map((s) => ({ value: s, label: t(`slots.${s}`) }))}
        onChange={(v) => setFilter("slot", v)}
        locked={(v) => !pro.preview && v !== FREE_SLOT}
      />
      {pro.preview && <p className="text-xs font-medium text-real-fg">✓ {t("pro.previewOn")}</p>}
      <Segmented
        legend={t("modes.label")}
        name="mode"
        value={filters.mode}
        options={[
          { value: "dynamic", label: t("modes.dynamic") },
          { value: "static", label: t("modes.static") },
        ]}
        onChange={(v) => setFilter("mode", v)}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t("categories.label")}</span>
          <select
            className="min-h-[44px] w-full rounded-lg border border-border bg-white px-2"
            value={filters.cat}
            onChange={(e) => setFilter("cat", e.target.value as Filters["cat"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t("map.radius")}</span>
          <select
            className="min-h-[44px] w-full rounded-lg border border-border bg-white px-2"
            value={filters.r}
            onChange={(e) => setFilter("r", Number(e.target.value))}
          >
            {RADIUS_OPTIONS_M.map((r) => (
              <option key={r} value={r}>
                {r} {unit}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted">{t("map.radiusAssumption", { r: filters.r })}</p>
      {setShowServices && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={!!showServices} onChange={(e) => setShowServices(e.target.checked)} />
          {t("map.showServices")}
        </label>
      )}
    </div>
  );
}
