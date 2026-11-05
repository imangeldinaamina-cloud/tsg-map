"use client";
import { useI18n } from "@/i18n/client";
import { AreaResult, rank } from "@/lib/compute";
import { LevelChip } from "./Badges";

/** Text alternative to the map: every area is reachable by keyboard and screen readers. */
export function AreaList({ results, selected, onSelect }: { results: AreaResult[]; selected: string | null; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{t("map.areas")}</h2>
      <p className="mb-2 text-xs text-muted">{t("map.clickHint")}</p>
      <ul className="space-y-1">
        {rank(results).map((r) => (
          <li key={r.point.point_id}>
            <button
              type="button"
              aria-pressed={selected === r.point.point_id}
              onClick={() => onSelect(r.point.point_id)}
              className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-sm hover:bg-surface ${selected === r.point.point_id ? "border-primary bg-real-bg" : "border-border bg-white"}`}
            >
              <span>
                <span className="font-semibold">{r.point.point_id}</span>{" "}
                <span className="text-muted">
                  {r.point.point_type}
                  {r.point.holdout ? ` · ${t("map.holdout")}` : ""}
                </span>
              </span>
              <LevelChip level={r.level} value={r.tsg} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
