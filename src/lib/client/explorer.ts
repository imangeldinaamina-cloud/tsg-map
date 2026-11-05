"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import osm from "@/data/osm/services.json";
import { DEMO_BUNDLE } from "@/data/demo/demo-data";
import { computeArea } from "@/lib/compute";
import {
  CATEGORIES,
  Category,
  DataBundle,
  Dataset,
  DEFAULT_RADIUS_M,
  FREE_SLOT,
  Mode,
  RADIUS_OPTIONS_M,
  Service,
  Slot,
  SLOTS,
} from "@/lib/domain";
import { track } from "./analytics";
import { usePro } from "./pro";

export const SERVICES = osm.services as Service[];
export const OSM_META = { extracted_at: osm.extracted_at, osm_base: osm.osm_base, count: osm.count };

export interface Filters {
  slot: Slot;
  mode: Mode;
  cat: Category;
  r: number;
  ds: Dataset | null; // null = auto (real if available)
  area: string | null;
}

function parse(sp: URLSearchParams): Filters {
  const slot = sp.get("slot");
  const mode = sp.get("mode");
  const cat = sp.get("cat");
  const r = Number(sp.get("r"));
  const ds = sp.get("ds");
  return {
    slot: (SLOTS as readonly string[]).includes(slot ?? "") ? (slot as Slot) : FREE_SLOT,
    mode: mode === "static" ? "static" : "dynamic",
    cat: (CATEGORIES as readonly string[]).includes(cat ?? "") ? (cat as Category) : "all",
    r: RADIUS_OPTIONS_M.includes(r) ? r : DEFAULT_RADIUS_M,
    ds: ds === "real" || ds === "demo" ? ds : null,
    area: sp.get("area"),
  };
}

export function useExplorer() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pro = usePro();
  const raw = useMemo(() => parse(new URLSearchParams(sp.toString())), [sp]);

  const [real, setReal] = useState<DataBundle | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((j) => setReal(j.real))
      .catch(() => {
        setLoadError(true);
        setReal({ dataset: "real", points: [], updated_at: null });
      });
  }, []);

  const hasReal = !!real && real.points.length > 0;
  const dataset: Dataset = raw.ds ?? (hasReal ? "real" : "demo");
  const bundle = dataset === "demo" ? DEMO_BUNDLE : real;
  // Freemium: without Pro preview only the free slot is available.
  const slot: Slot = pro.preview ? raw.slot : FREE_SLOT;
  const filters: Filters = { ...raw, slot, ds: dataset };

  const results = useMemo(() => {
    if (!bundle) return [];
    return bundle.points.map((p) =>
      computeArea(p, SERVICES, { slot, mode: raw.mode, category: raw.cat, radiusM: raw.r, isDemo: dataset === "demo" }),
    );
  }, [bundle, slot, raw.mode, raw.cat, raw.r, dataset]);

  const setFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      if (key === "slot" && value !== FREE_SLOT && !pro.requestPro("slot")) return;
      const next = new URLSearchParams(sp.toString());
      if (value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      if (key !== "area") track("filter_change", { filter: key, value: String(value) });
      else if (value) track("area_open", { dataset });
    },
    [sp, router, pathname, pro, dataset],
  );

  return {
    filters,
    setFilter,
    results,
    bundle,
    loading: real === null && dataset === "real",
    hasReal,
    loadError,
    dataset,
    isDemo: dataset === "demo",
  };
}

/** Compute results for arbitrary slot/mode (used for comparisons in the detail panel and ranking). */
export function computeFor(bundle: DataBundle | null, f: { slot: Slot; mode: Mode; cat: Category; r: number }) {
  if (!bundle) return [];
  return bundle.points.map((p) =>
    computeArea(p, SERVICES, { slot: f.slot, mode: f.mode, category: f.cat, radiusM: f.r, isDemo: bundle.dataset === "demo" }),
  );
}
