"use client";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { AreaResult, circlePolygon } from "@/lib/compute";
import { CITY_CENTER, Category, Service } from "@/lib/domain";
import { TSG_COLORS, TSG_SYMBOL, TSG_TEXT, formatTsg } from "@/lib/tsg";

interface Props {
  results: AreaResult[];
  radiusM: number;
  selected: string | null;
  onSelect: (id: string) => void;
  services: Service[];
  category: Category;
  showServices: boolean;
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export default function MapView({ results, radiusM, selected, onSelect, services, category, showServices }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: OSM_STYLE,
        center: CITY_CENTER,
        zoom: 12.3,
        attributionControl: { compact: false },
        cooperativeGestures: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // "style.load" fires before tiles finish downloading, so areas show immediately.
    let initialised = false;
    const setup = () => {
      if (initialised) return;
      initialised = true;
      m.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("services", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "areas-fill", type: "fill", source: "areas", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.5 } });
      m.addLayer({
        id: "areas-line",
        type: "line",
        source: "areas",
        paint: { "line-color": "#0f172a", "line-width": ["case", ["get", "selected"], 3.5, 1.2] },
      });
      m.addLayer({
        id: "services-dots",
        type: "circle",
        source: "services",
        paint: { "circle-radius": 3, "circle-color": "#1e3a8a", "circle-stroke-color": "#fff", "circle-stroke-width": 1 },
      });
      m.on("click", "areas-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRef.current(String(id));
      });
      m.on("mouseenter", "areas-fill", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "areas-fill", () => (m.getCanvas().style.cursor = ""));
      setReady(true);
    };
    m.once("style.load", setup);
    m.once("load", setup); // fallback
    m.on("error", (e) => console.warn("map error", e.error?.message));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Areas + accessible label markers
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("areas") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: results.map((r) => ({
        type: "Feature",
        properties: { id: r.point.point_id, color: TSG_COLORS[r.level], selected: r.point.point_id === selected },
        geometry: { type: "Polygon", coordinates: [circlePolygon(r.point.lon, r.point.lat, radiusM)] },
      })),
    });
    markers.current.forEach((mk) => mk.remove());
    markers.current = results.map((r) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "tsg-marker";
      const isSel = r.point.point_id === selected;
      el.style.cssText = `background:${TSG_COLORS[r.level]};color:${TSG_TEXT[r.level]};border:${isSel ? 3 : 1.5}px solid #0f172a;border-radius:8px;padding:2px 6px;font:600 12px/1.3 system-ui,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.35)`;
      el.textContent = `${TSG_SYMBOL[r.level]} ${r.point.point_id} ${formatTsg(r.tsg)}`;
      el.setAttribute("aria-label", `${t("detail.title", { id: r.point.point_id })}: TSG ${formatTsg(r.tsg)}, ${t(`levels.${r.level}`)}`);
      el.setAttribute("aria-pressed", String(isSel));
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current(r.point.point_id);
      });
      return new maplibregl.Marker({ element: el }).setLngLat([r.point.lon, r.point.lat]).addTo(m);
    });
  }, [results, radiusM, selected, ready, t]);

  // Services dots
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const list = showServices ? services.filter((s) => category === "all" || s.category === category) : [];
    (m.getSource("services") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: list.map((s) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [s.lon, s.lat] } })),
    });
  }, [services, category, showServices, ready]);

  // Fly to selection
  useEffect(() => {
    const m = map.current;
    const r = results.find((x) => x.point.point_id === selected);
    if (m && ready && r) m.easeTo({ center: [r.point.lon, r.point.lat], duration: 500 });
  }, [selected, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className="flex h-full items-center justify-center bg-surface p-4 text-center text-sm">{t("map.mapError")}</div>;
  return <div ref={container} role="region" aria-label={t("map.mapLabel")} className="h-full w-full" />;
}
