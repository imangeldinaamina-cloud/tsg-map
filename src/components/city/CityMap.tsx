"use client";
import maplibregl from "maplibre-gl";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { CityData, fetchLayer } from "@/lib/city/client";
import { ServiceCat } from "@/lib/city/types";
import { CAT_COLORS, LANDUSE_COLORS } from "./palette";

export interface LayerState {
  boundary: boolean;
  landuse: boolean;
  roads: boolean;
  facilities: boolean;
  analysis: boolean;
}

export interface CityMapHandle {
  center(): { lat: number; lon: number } | null;
  flyTo(lat: number, lon: number, zoom?: number): void;
}

interface Props {
  data: CityData;
  colors: (string | null)[];
  flags: boolean[];
  layers: LayerState;
  facilityCats: ServiceCat[];
  highlight: Set<number>;
  selectedCell: number | null;
  candidates: { id: number; lat: number; lon: number }[];
  placing: boolean;
  onCellClick: (i: number) => void;
  onPlace: (lat: number, lon: number) => void;
}

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · WorldPop (CC BY 4.0)',
    },
  },
  // Desaturated basemap so analytical colours carry the meaning.
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.9, "raster-contrast": -0.15, "raster-brightness-min": 0.08 } }],
};

const empty = { type: "FeatureCollection" as const, features: [] };

const CityMap = forwardRef<CityMapHandle, Props>(function CityMap(props, ref) {
  const { t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const loaded = useRef<{ roads?: boolean; landuse?: boolean }>({});
  const markers = useRef<maplibregl.Marker[]>([]);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    center() {
      const c = map.current?.getCenter();
      return c ? { lat: c.lat, lon: c.lng } : null;
    },
    flyTo(lat, lon, zoom) {
      map.current?.easeTo({ center: [lon, lat], zoom: zoom ?? Math.max(map.current.getZoom(), 14), duration: 600 });
    },
  }));

  // init
  useEffect(() => {
    if (!el.current) return;
    const { data } = latest.current;
    // Open on the built-up area (2nd–98th percentile of populated cells), not the whole akimat boundary.
    const pts = data.grid.cells.filter((c) => c.pop > 0);
    const q = (v: number[], p: number) => v.sort((a, b) => a - b)[Math.floor(p * (v.length - 1))];
    const [w, s, e, n] = pts.length
      ? [q(pts.map((c) => c.lon), 0.02), q(pts.map((c) => c.lat), 0.02), q(pts.map((c) => c.lon), 0.98), q(pts.map((c) => c.lat), 0.98)]
      : data.meta.boundary.bbox;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({ container: el.current, style: STYLE, bounds: [w, s, e, n], fitBoundsOptions: { padding: 20 }, attributionControl: { compact: true } });
    } catch {
      setFailed(true);
      return;
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    let init = false;
    const setup = () => {
      if (init) return;
      init = true;
      const g = data.grid;
      const cells = {
        type: "FeatureCollection" as const,
        features: g.cells.map((c, i) => {
          const la = g.origin[1] + c.r * g.dLat, lo = g.origin[0] + c.c * g.dLon;
          return {
            type: "Feature" as const,
            id: i,
            properties: {},
            geometry: { type: "Polygon" as const, coordinates: [[[lo, la], [lo + g.dLon, la], [lo + g.dLon, la + g.dLat], [lo, la + g.dLat], [lo, la]]] },
          };
        }),
      };
      m.addSource("landuse", { type: "geojson", data: empty });
      m.addSource("roads", { type: "geojson", data: empty });
      m.addSource("cells", { type: "geojson", data: cells });
      m.addSource("boundary", { type: "geojson", data: data.boundary as never });
      m.addSource("facilities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: data.facilities.map((f, i) => ({ type: "Feature", id: i, properties: { i, cat: f.cat }, geometry: { type: "Point", coordinates: [f.lon, f.lat] } })),
        },
      });
      m.addSource("selected", { type: "geojson", data: empty });

      m.addLayer({
        id: "landuse",
        type: "fill",
        source: "landuse",
        paint: { "fill-color": ["match", ["get", "c"], "residential", LANDUSE_COLORS.residential, "industrial", LANDUSE_COLORS.industrial, LANDUSE_COLORS.commercial], "fill-opacity": 0.45 },
        layout: { visibility: "none" },
      });
      m.addLayer({
        id: "cells",
        type: "fill",
        source: "cells",
        paint: {
          "fill-color": ["coalesce", ["feature-state", "color"], "#000000"],
          "fill-opacity": ["case", ["boolean", ["feature-state", "has"], false], 0.72, 0],
        },
      });
      m.addLayer({
        id: "cells-flag",
        type: "line",
        source: "cells",
        paint: { "line-color": "#0f172a", "line-opacity": 0.55, "line-width": ["case", ["boolean", ["feature-state", "flag"], false], ["interpolate", ["linear"], ["zoom"], 11, 0.4, 15, 1.4], 0] } as never,
      });
      const roadPaint = {
        "line-color": ["match", ["get", "c"], "major", "#334155", "street", "#64748b", "path", "#0e7490", "#94a3b8"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, ["match", ["get", "c"], "major", 1.2, 0.4], 16, ["match", ["get", "c"], "major", 4, "street", 2.5, 1.5]],
      } as never;
      m.addLayer({ id: "roads", type: "line", source: "roads", filter: ["!=", ["get", "c"], "path"], layout: { visibility: "none", "line-cap": "round" }, paint: roadPaint });
      m.addLayer({
        id: "roads-path",
        type: "line",
        source: "roads",
        filter: ["==", ["get", "c"], "path"],
        layout: { visibility: "none" },
        paint: { ...(roadPaint as object), "line-dasharray": [2, 1] } as never,
      });
      m.addLayer({ id: "boundary", type: "line", source: "boundary", paint: { "line-color": "#0f172a", "line-width": 1.5, "line-dasharray": [4, 2] } });
      m.addLayer({ id: "selected", type: "line", source: "selected", paint: { "line-color": "#0f172a", "line-width": 3 } });
      m.addLayer({
        id: "facilities",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["case", ["boolean", ["feature-state", "hl"], false], 6, 2.5], 16, ["case", ["boolean", ["feature-state", "hl"], false], 10, 6]],
          "circle-color": ["match", ["get", "cat"], ...Object.entries(CAT_COLORS).flat(), "#334155"] as never,
          "circle-stroke-color": ["case", ["boolean", ["feature-state", "hl"], false], "#0f172a", "#ffffff"],
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hl"], false], 2, 1],
        },
      });

      m.on("click", (e) => {
        const p = latest.current;
        const fac = m.queryRenderedFeatures(e.point, { layers: ["facilities"] })[0];
        if (fac) {
          const f = p.data.facilities[Number(fac.properties?.i)];
          if (f) {
            const box = document.createElement("div");
            box.className = "text-sm";
            const title = document.createElement("strong");
            title.textContent = f.name ?? t("city.facility.unnamed");
            const sub = document.createElement("div");
            sub.className = "text-muted";
            sub.textContent = `${t(`city.cats.${f.cat}`)} · ${f.type ?? ""}`;
            const a = document.createElement("a");
            a.href = `https://www.openstreetmap.org/${f.id}`;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.className = "underline";
            a.textContent = t("city.facility.osm");
            box.append(title, sub, a);
            new maplibregl.Popup({ closeButton: true, maxWidth: "260px" }).setLngLat([f.lon, f.lat]).setDOMContent(box).addTo(m);
            return;
          }
        }
        if (p.placing) {
          p.onPlace(e.lngLat.lat, e.lngLat.lng);
          return;
        }
        const cell = m.queryRenderedFeatures(e.point, { layers: ["cells"] }).find((f) => m.getFeatureState({ source: "cells", id: f.id as number })?.has);
        if (cell) p.onCellClick(Number(cell.id));
      });
      m.on("mousemove", (e) => {
        const p = latest.current;
        const hit = m.queryRenderedFeatures(e.point, { layers: ["facilities"] }).length > 0;
        m.getCanvas().style.cursor = hit || p.placing ? "pointer" : "";
      });
      setReady(true);
    };
    m.once("style.load", setup);
    m.once("load", setup);
    m.on("error", (e) => console.warn("map error", e.error?.message));
    map.current = m;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __cityMap?: maplibregl.Map }).__cityMap = m; // dev-only debugging hook
    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // cell colours + flags
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    props.colors.forEach((color, i) => {
      m.setFeatureState({ source: "cells", id: i }, color ? { color, has: props.layers.analysis, flag: props.layers.analysis && props.flags[i] } : { has: false, flag: false });
    });
  }, [props.colors, props.flags, props.layers.analysis, ready]);

  // layer visibility + lazy loading of the big vector layers
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const vis = (id: string, on: boolean) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    vis("boundary", props.layers.boundary);
    vis("facilities", props.layers.facilities);
    vis("roads-path", props.layers.roads);
    for (const name of ["roads", "landuse"] as const) {
      vis(name, props.layers[name]);
      if (props.layers[name] && !loaded.current[name]) {
        loaded.current[name] = true;
        fetchLayer(name).then((gj) => (m.getSource(name) as maplibregl.GeoJSONSource)?.setData(gj as never));
      }
    }
  }, [props.layers, ready]);

  // facility filter + highlight
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.setFilter("facilities", ["in", ["get", "cat"], ["literal", props.facilityCats]]);
    props.data.facilities.forEach((_, i) => m.setFeatureState({ source: "facilities", id: i }, { hl: props.highlight.has(i) }));
  }, [props.facilityCats, props.highlight, props.data, ready]);

  // selected cell outline
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const g = props.data.grid;
    const c = props.selectedCell !== null ? g.cells[props.selectedCell] : null;
    const la = c ? g.origin[1] + c.r * g.dLat : 0, lo = c ? g.origin[0] + c.c * g.dLon : 0;
    (m.getSource("selected") as maplibregl.GeoJSONSource).setData(
      c
        ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[lo, la], [lo + g.dLon, la], [lo + g.dLon, la + g.dLat], [lo, la + g.dLat], [lo, la]]] } }
        : empty,
    );
  }, [props.selectedCell, props.data, ready]);

  // candidate markers (buttons, so they are keyboard reachable and labelled)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = props.candidates.map((c) => {
      const b = document.createElement("div");
      b.className = "city-candidate";
      b.textContent = String(c.id);
      b.setAttribute("role", "img");
      b.setAttribute("aria-label", t("city.loc.candidate", { n: c.id }));
      return new maplibregl.Marker({ element: b, anchor: "bottom" }).setLngLat([c.lon, c.lat]).addTo(m);
    });
  }, [props.candidates, ready, t]);

  if (failed) return <div className="flex h-full items-center justify-center bg-surface p-4 text-center text-sm">{t("map.mapError")}</div>;
  return <div ref={el} role="region" aria-label={t("city.mapLabel")} className="h-full w-full" />;
});

export default CityMap;
