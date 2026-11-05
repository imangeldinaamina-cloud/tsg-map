"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { TemporalAssumptions, UNSPECIFIED, validateAssumptions } from "@/lib/city/model";
import { ATTRACTORS, PERIOD_WINDOWS, PERIODS } from "@/lib/city/types";
import { Badge, Section } from "./ui";

type Draft = { stay: Record<string, string>; weights: Record<string, string>; census: string; note: string };
const toDraft = (a: TemporalAssumptions): Draft => ({
  stay: Object.fromEntries(PERIODS.map((p) => [p, a.stay[p] === null ? "" : String(a.stay[p])])),
  weights: Object.fromEntries(ATTRACTORS.map((k) => [k, String(a.weights[k])])),
  census: a.censusTotal === null ? "" : String(a.censusTotal),
  note: a.note,
});
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function AssumptionsForm({ value, onApply }: { value: TemporalAssumptions; onApply: (a: TemporalAssumptions) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => toDraft(value));
  const [errors, setErrors] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => setDraft(toDraft(value)), [value]);

  const build = (): TemporalAssumptions => ({
    stay: Object.fromEntries(PERIODS.map((p) => [p, num(draft.stay[p])])) as TemporalAssumptions["stay"],
    weights: Object.fromEntries(ATTRACTORS.map((k) => [k, num(draft.weights[k]) ?? 0])) as TemporalAssumptions["weights"],
    censusTotal: num(draft.census),
    note: draft.note.slice(0, 500),
  });
  const bad = (k: string) => errors.includes(k);
  const input = "min-h-[36px] w-full rounded-md border bg-white px-2 text-sm tabular-nums";

  return (
    <Section title={t("city.pop.assumptions.title")} aside={<Badge kind="assumption">{t("city.badges.assumption")}</Badge>}>
      <details className="group" open={false}>
        <summary className="cursor-pointer text-sm font-medium text-primary">{t("city.pop.assumptions.open")}</summary>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const a = build();
            const errs = validateAssumptions(a);
            setErrors(errs);
            if (errs.length) {
              setMsg(t("city.pop.assumptions.invalid"));
              return;
            }
            onApply(a);
            setMsg(t("city.pop.assumptions.applied"));
          }}
        >
          <p className="rounded-md bg-surface p-2 font-mono text-[11px] leading-relaxed">{t("city.pop.assumptions.formula")}</p>
          <fieldset>
            <legend className="text-xs font-semibold">{t("city.pop.assumptions.stay")}</legend>
            <p className="mb-1.5 text-[11px] text-muted">{t("city.pop.assumptions.stayHint")}</p>
            <div className="grid grid-cols-4 gap-2">
              {PERIODS.map((p) => (
                <label key={p} className="text-[11px] text-muted">
                  {t(`city.periods.${p}`)} <span className="block">{PERIOD_WINDOWS[p]}</span>
                  <input
                    inputMode="decimal"
                    className={`${input} ${bad(`stay.${p}`) ? "border-[#b91c1c]" : "border-border"}`}
                    value={draft.stay[p]}
                    aria-invalid={bad(`stay.${p}`)}
                    onChange={(e) => setDraft({ ...draft, stay: { ...draft.stay, [p]: e.target.value } })}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold">{t("city.pop.assumptions.weights")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {ATTRACTORS.map((k) => (
                <label key={k} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2 text-xs">
                  <span className="truncate">{t(`city.pop.attractors.${k}`)}</span>
                  <input
                    inputMode="decimal"
                    className={`${input} ${bad(`weights.${k}`) ? "border-[#b91c1c]" : "border-border"}`}
                    value={draft.weights[k]}
                    aria-invalid={bad(`weights.${k}`)}
                    onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, [k]: e.target.value } })}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs font-semibold">
            {t("city.pop.assumptions.census")}
            <span className="block text-[11px] font-normal text-muted">{t("city.pop.assumptions.censusHint")}</span>
            <input
              inputMode="numeric"
              className={`${input} mt-1 ${bad("censusTotal") ? "border-[#b91c1c]" : "border-border"}`}
              value={draft.census}
              aria-invalid={bad("censusTotal")}
              onChange={(e) => setDraft({ ...draft, census: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold">
            {t("city.pop.assumptions.note")}
            <textarea className={`${input} mt-1 min-h-[60px] border-border py-1.5`} maxLength={500} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary">
              {t("city.pop.assumptions.apply")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setErrors([]);
                onApply(UNSPECIFIED);
                setMsg(t("city.pop.assumptions.applied"));
              }}
            >
              {t("city.pop.assumptions.reset")}
            </button>
          </div>
          <p role="status" className="text-xs">
            {msg}
          </p>
        </form>
      </details>
    </Section>
  );
}
