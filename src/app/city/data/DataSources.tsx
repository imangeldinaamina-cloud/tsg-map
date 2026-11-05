"use client";
import Link from "next/link";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/city/ui";
import { useI18n } from "@/i18n/client";
import { track } from "@/lib/client/analytics";
import { cellIndexAt, loadAssumptions, loadUpload, PopulationUpload, saveUpload, useCityData } from "@/lib/city/client";
import { anySpecified } from "@/lib/city/model";

export function DataSources() {
  const { t, locale } = useI18n();
  const { data, error } = useCityData();
  const [upload, setUpload] = useState<PopulationUpload | null>(null);
  const [msg, setMsg] = useState<string[]>([]);
  const [census, setCensus] = useState<number | null>(null);
  const [temporal, setTemporal] = useState(false);
  useEffect(() => {
    setUpload(loadUpload());
    const a = loadAssumptions();
    setCensus(a.censusTotal);
    setTemporal(anySpecified(a));
  }, []);
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU");
  const lookup = useMemo(() => new Map((data?.grid.cells ?? []).map((c, i) => [`${c.r}:${c.c}`, i])), [data]);

  if (error) return <p className="card p-4 text-sm" role="alert">{t("city.loadError")}</p>;
  if (!data) return <p role="status">{t("city.loading")}</p>;
  const m = data.meta;
  const d = m.datasets;
  const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : "—");
  const snap = d.osm.snapshots ?? {};

  const rows: { key: string; source: React.ReactNode; date: string; res: string; badge: React.ReactNode }[] = [
    { key: "boundary", source: <a className="underline" href={`https://www.openstreetmap.org/${m.boundary.osm_id}`} target="_blank" rel="noopener noreferrer">OSM {m.boundary.osm_id}</a>, date: day(snap.boundary ?? d.osm.osm_base), res: t("city.data.resolution.vector"), badge: <Badge kind="source">OSM</Badge> },
    { key: "roads", source: `OSM highway=* · ${nf.format(d.roads.ways)} / ${nf.format(d.roads.length_km)} km`, date: day(snap.roads ?? d.osm.osm_base), res: t("city.data.resolution.vector"), badge: <Badge kind="source">OSM</Badge> },
    { key: "landuse", source: `OSM landuse=* · ${nf.format(d.landuse.polygons)}`, date: day(snap.landuse ?? d.osm.osm_base), res: t("city.data.resolution.vector"), badge: <Badge kind="source">OSM</Badge> },
    { key: "facilities", source: `OSM · ${Object.entries(d.facilities).map(([k, v]) => `${t(`city.cats.${k}`)} ${v}`).join(", ")}`, date: day(snap.pois ?? d.osm.osm_base), res: t("city.data.resolution.vector"), badge: <Badge kind="source">OSM</Badge> },
    {
      key: "worldpop",
      source: upload ? `${upload.name}` : <a className="underline" href={d.worldpop.url} target="_blank" rel="noopener noreferrer">{d.worldpop.source} ({d.worldpop.license})</a>,
      date: upload ? day(upload.uploaded_at) : String(d.worldpop.year),
      res: upload ? t("city.data.resolution.cell") : t("city.data.resolution.pixel"),
      badge: upload ? <Badge kind="uploaded">{t("city.badges.uploaded")}</Badge> : <Badge kind="source">WorldPop</Badge>,
    },
    { key: "census", source: census ? nf.format(census) : t("city.data.notLoaded"), date: "2021", res: t("city.data.resolution.city"), badge: census ? <Badge kind="assumption">{t("city.badges.assumption")}</Badge> : <Badge kind="uploaded">{t("city.data.notLoaded")}</Badge> },
    { key: "temporal", source: t("city.data.assumptionDriven"), date: "—", res: t("city.data.resolution.cell"), badge: <Badge kind={temporal ? "modelled" : "baseline"}>{temporal ? t("city.badges.modelled") : t("city.badges.baseline")}</Badge> },
    { key: "access", source: `Dijkstra · ${nf.format(d.access.pairs)} pairs ≤ ${d.access.cutoff_m} m`, date: day(m.built_at), res: t("city.data.resolution.cell"), badge: <Badge kind="source">OSM</Badge> },
  ];

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = (res.meta.fields ?? []).map((f) => f.trim().toLowerCase());
        if (!["lat", "lon", "population"].every((f) => fields.includes(f))) {
          setMsg([t("city.data.upload.error")]);
          return;
        }
        const values = new Array(data.grid.cells.length).fill(0);
        let used = 0, skipped = 0, total = 0;
        const touched = new Set<number>();
        for (const row of res.data) {
          const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]));
          const lat = Number(r.lat), lon = Number(r.lon), pop = Number(String(r.population).replace(",", "."));
          const ci = Number.isFinite(lat) && Number.isFinite(lon) ? cellIndexAt(data.grid, lookup, lat, lon) : null;
          if (ci === null || !(pop >= 0)) {
            skipped++;
            continue;
          }
          values[ci] += pop;
          touched.add(ci);
          total += pop;
          used++;
        }
        if (!used) {
          setMsg([t("city.data.upload.error")]);
          return;
        }
        const u = { name: file.name.slice(0, 80), uploaded_at: new Date().toISOString(), values };
        saveUpload(u);
        setUpload(u);
        track("city_upload", { rows: used });
        setMsg([t("city.data.upload.ok", { n: nf.format(used), c: nf.format(touched.size), p: nf.format(Math.round(total)) }), ...(skipped ? [t("city.data.upload.skipped", { n: nf.format(skipped) })] : [])]);
      },
      error: () => setMsg([t("city.data.upload.error")]),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="max-w-3xl text-muted">{t("city.data.intro")}</p>
        <p className="mt-2 text-sm text-muted">
          {t("city.data.stats", { date: day(m.built_at), ways: nf.format(d.roads.ways), km: nf.format(d.roads.length_km), pois: nf.format(d.pois_in_boundary), pixels: nf.format(d.worldpop.pixels_in_boundary) })}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {(["dataset", "source", "date", "resolution", "limits"] as const).map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {t(`city.data.cols.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border align-top">
                <th scope="row" className="px-3 py-2.5 text-left font-semibold">
                  <div>{t(`city.data.rows.${r.key}`)}</div>
                  <div className="mt-1">{r.badge}</div>
                </th>
                <td className="px-3 py-2.5">{r.source}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{r.date}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.res}</td>
                <td className="px-3 py-2.5 text-muted">{t(`city.data.lim.${r.key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        <code className="rounded bg-surface px-1">{t("city.data.rebuild")}</code>
      </p>

      <section className="card max-w-3xl space-y-3 p-5">
        <h2 className="text-lg font-bold">{t("city.data.upload.title")}</h2>
        <p className="text-sm text-muted">{t("city.data.upload.hint")}</p>
        {upload && <p className="rounded-md border border-demo-border bg-demo-bg px-3 py-2 text-sm text-demo-fg">{t("city.data.upload.active")} ({upload.name})</p>}
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-primary cursor-pointer">
            {t("city.data.upload.choose")}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {upload && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                saveUpload(null);
                setUpload(null);
                setMsg([]);
              }}
            >
              {t("city.data.upload.clear")}
            </button>
          )}
        </div>
        <div role="status" className="space-y-1 text-sm">
          {msg.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      </section>
      <Link href="/city" className="btn btn-secondary">← {t("city.nav")}</Link>
    </div>
  );
}
