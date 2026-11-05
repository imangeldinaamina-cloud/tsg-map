"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { AreaDetail } from "@/components/explorer/AreaDetail";
import { AreaList } from "@/components/explorer/AreaList";
import { Controls } from "@/components/explorer/Controls";
import { Legend } from "@/components/explorer/Legend";
import { useI18n } from "@/i18n/client";
import { SERVICES, useExplorer } from "@/lib/client/explorer";

const MapView = dynamic(() => import("@/components/explorer/MapView"), { ssr: false });

export function MapExplorer() {
  const { t } = useI18n();
  const ex = useExplorer();
  const [showServices, setShowServices] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const f = ex.filters;
  const selected = ex.results.find((r) => r.point.point_id === ex.filters.area) ?? null;
  const select = (id: string) => ex.setFilter("area", id);

  return (
    <>
      {ex.isDemo && <DemoBanner />}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 md:grid-cols-[360px_minmax(0,1fr)]">
        <h1 className="text-xl font-bold md:col-span-2">{t("map.title")}</h1>
        <aside className="order-1 min-w-0 space-y-4">
          <button
            type="button"
            className="btn btn-secondary w-full justify-between md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="filters-panel"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <span className="whitespace-nowrap">⚙ {t("map.filters")}</span>
            <span className="min-w-0 truncate text-sm font-normal text-muted">
              {t(`slots.${f.slot}`)} · {f.mode === "dynamic" ? t("modes.dynamicShort") : t("modes.staticShort")} · {t(`categories.${f.cat}`)}
            </span>
          </button>
          <div id="filters-panel" className={`card p-4 ${filtersOpen ? "block" : "hidden"} md:block`}>
            <Controls
              filters={ex.filters}
              setFilter={ex.setFilter}
              hasReal={ex.hasReal}
              showServices={showServices}
              setShowServices={setShowServices}
            />
          </div>
          <div className="hidden md:block">
            {selected ? (
              <AreaDetail result={selected} filters={ex.filters} onClose={() => ex.setFilter("area", null)} />
            ) : (
              <AreaList results={ex.results} selected={null} onSelect={select} />
            )}
          </div>
        </aside>
        <div className="order-2 min-w-0 space-y-3">
          <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-xl border border-border md:h-[70vh]">
            <MapView
              results={ex.results}
              radiusM={ex.filters.r}
              selected={ex.filters.area}
              onSelect={select}
              services={SERVICES}
              category={ex.filters.cat}
              showServices={showServices}
            />
          </div>
          <div className="card p-3">
            <Legend />
          </div>
          {ex.loading && <p role="status">{t("common.loading")}</p>}
          {!ex.loading && ex.results.length === 0 && <p className="card p-4 text-sm">{t("dataset.noReal")}</p>}
          <div className="space-y-4 md:hidden">
            {selected && <AreaDetail result={selected} filters={ex.filters} onClose={() => ex.setFilter("area", null)} />}
            <AreaList results={ex.results} selected={ex.filters.area} onSelect={select} />
          </div>
        </div>
      </div>
    </>
  );
}
