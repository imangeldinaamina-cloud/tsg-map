# Агентная модель TSG, Талдыкорган

Код модели лежал в облачной рабочей папке, а не на твоём диске, поэтому ты его не нашла. Здесь он весь.

## Файлы
- `code/tsg_model.py` — сама агентная модель (OSM-объекты, доля работающих 45%, часы по умолчанию).
- `code/tsg_model_2gis.py` — то же, плюс часы работы из 2ГИС (`data/hours_2gis.csv`). Долю работающих в нём меняют в строке `shares=dict(...)` (по БНС ≈ 0.425).
- `code/analyze.py`, `code/analyze_2gis.py` — 100 прогонов и подсчёт TSG, сдвигов, смены классов, скрытого дефицита.
- `code/export_app.py` — выгрузка результатов в формат веб-приложения.
- `code/test_tsg_properties.py` — проверка свойств TSG.
- `data/` — WorldPop 2024 (kaz_pop_2024.tif), граница города (nomi.json), объекты OSM (osm.json), часы 2ГИС.

## Запуск
pip install numpy scipy rasterio shapely pyproj
python3 code/analyze_2gis.py data out_2gis      # или analyze.py для старой версии
Результат: out_2gis/summary.json, cells.json, runs.json.

## Где «замкнутый цикл» (видео -> расписания агентов)
Расписание агентов задано в CONFIG['sched'] в начале tsg_model*.py: для каждого типа (worker, pupil, student, other)
и каждого окна (morning, day, evening) указано (куда идут, вероятность). Видео-подсчёт настраивает именно эти вероятности:
сравниваешь модельное D по ячейке с подсчётом по видео и подбираешь вероятности (и beta), чтобы они совпали.
Сейчас вероятности — допущения, не откалиброваны по видео.

## Not in the repository
- `data/hours_2gis.csv` — 2GIS opening hours (2GIS licence: use for the model only, do not publish). Re-create with your own key: `python3 fetch_2gis_hours.py KEY`.
- `data/kaz_pop_2024.tif` — WorldPop 2024 Kazakhstan 100 m (≈50 MB, CC BY 4.0), download from https://hub.worldpop.org and save under this name.

## Video check and calibration
`python3 research/h2_calibrate.py` (from the repository root) — see `research/H2_REPORT.md`.

## Recalculation with 2GIS (November 2026)
`code/tsg_model_2gis.py` switches (environment variables):
- `WORKER_SHARE=0.45` — share of workers (0.425 = national statistics); "other" absorbs the difference.
- `GIS_INFRA=1` — add schools, colleges/universities, malls, a market and extra services from `data/infra_2gis.csv`
  (`fetch_2gis_counts.py`), filtered by 2GIS rubric, de-duplicated against OSM (50–200 m).
- `GIS_HOURS2=1` — opening hours from the second 2GIS export `data/hours_2gis_contacts.csv` (hours only, no contacts).
```
RUNS=100 python3 code/analyze.py data out_osm                                               # paper (OSM)
GIS_INFRA=1 GIS_HOURS2=1 WORKER_SHARE=0.45 RUNS=100 python3 code/analyze_2gis.py data out_2gis  # all 2GIS
```
Results (category totals and metrics only): `research/recalc_2gis/` — `compare_OSM_vs_2GIS.csv` and `summary_*.json`.
