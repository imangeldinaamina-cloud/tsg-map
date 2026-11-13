"""
Сколько в Талдыкоргане магазинов, аптек, школ, садиков, поликлиник и другой инфраструктуры — по официальному API 2ГИС.

НУЖЕН ТВОЙ КЛЮЧ 2ГИС (тот же, что для fetch_2gis_hours.py: dev.2gis.com → «Демо-ключ»).
Запуск (из папки tsg-map):
    python3 research/agent_model/fetch_2gis_counts.py ТВОЙ_КЛЮЧ

Результат:
  research/agent_model/data/infra_2gis_counts.csv  — ИТОГИ по категориям (их можно показывать на стенде,
                                                     источник: «2ГИС, API, <месяц> 2026»)
  research/agent_model/data/infra_2gis.csv         — сырой список объектов (НЕ публиковать, в .gitignore)
Ключ никуда не сохраняется. Если API вернёт ошибку — пришли текст ошибки.

Как считается: для каждой категории — несколько поисковых запросов «<запрос> Талдыкорган», только филиалы
(type=branch) внутри границы города; объекты с одинаковым id 2ГИС считаются один раз. «api_total» — сколько
нашёл сам 2ГИС по запросу (может включать похожие рубрики), «unique_in_city» — что реально скачано и попало в город.
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

KEY = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
API = "https://catalog.api.2gis.com/3.0/items"
CITY = "Талдыкорган"
# rough city bbox (same as the OSM query of the model)
LAT0, LAT1, LON0, LON1 = 44.957, 45.057, 78.283, 78.449
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")

CATS = {
    "food": ("Продуктовые магазины", ["продуктовый магазин", "супермаркет", "минимаркет", "гипермаркет"]),
    "pharmacy": ("Аптеки", ["аптека"]),
    "catering": ("Общепит", ["кафе", "ресторан", "столовая", "фастфуд", "кофейня"]),
    "school": ("Школы", ["школа", "гимназия", "лицей"]),
    "kindergarten": ("Детские сады", ["детский сад"]),
    "college": ("Колледжи", ["колледж"]),
    "university": ("Вузы", ["университет", "институт"]),
    "clinic": ("Поликлиники и медцентры", ["поликлиника", "медицинский центр", "врачебная амбулатория"]),
    "hospital": ("Больницы", ["больница"]),
    "dentist": ("Стоматологии", ["стоматология"]),
    "bank": ("Банки (отделения)", ["банк"]),
    "atm": ("Банкоматы", ["банкомат"]),
    "post": ("Почта", ["почтовое отделение", "Казпочта"]),
    "mall": ("ТРЦ", ["торговый центр", "торгово-развлекательный центр"]),
    "market": ("Рынки", ["рынок", "базар"]),
    "sport": ("Спорт и фитнес", ["фитнес-клуб", "спортзал", "бассейн"]),
    "beauty": ("Салоны красоты и парикмахерские", ["парикмахерская", "салон красоты"]),
    "fuel": ("АЗС", ["АЗС"]),
}


def get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 2:
                raise
            print("  повтор после ошибки:", e)
            time.sleep(2)


rows, counts = [], []
for cat, (label, queries) in CATS.items():
    seen, api_total = set(), 0
    for q in queries:
        page = 1
        while page <= 20:
            d = get(dict(q=f"{q} {CITY}", type="branch", page=page, page_size=10, fields="items.point,items.rubrics", key=KEY))
            if d.get("meta", {}).get("code") not in (200, None):
                err = d.get("meta", {}).get("error", {})
                if page == 1 and err.get("type") == "itemNotFound":
                    break
                if err.get("type") != "itemNotFound":
                    print("ОШИБКА API:", json.dumps(d.get("meta"), ensure_ascii=False))
                break
            res = d.get("result", {})
            if page == 1:
                api_total = max(api_total, int(res.get("total", 0)))
            items = res.get("items", [])
            if not items:
                break
            for it in items:
                p = it.get("point") or {}
                lat, lon = p.get("lat"), p.get("lon")
                if it["id"] in seen or lat is None or not (LAT0 <= lat <= LAT1 and LON0 <= lon <= LON1):
                    continue
                seen.add(it["id"])
                rub = "; ".join(r.get("name", "") for r in it.get("rubrics", []))
                rows.append([cat, it.get("name", ""), lat, lon, rub])
            page += 1
            time.sleep(0.3)
    counts.append([cat, label, len(seen), api_total])
    print(f"{label:35s} {len(seen):5d}   (2ГИС нашёл по запросам до {api_total})", flush=True)

with open(os.path.join(OUT, "infra_2gis.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["category", "name", "lat", "lon", "rubrics"])
    w.writerows(rows)
with open(os.path.join(OUT, "infra_2gis_counts.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["category", "label", "unique_in_city", "api_total_max_query", "source"])
    for r in counts:
        w.writerow([*r, f"2ГИС, API, {time.strftime('%m.%Y')}"])
print("\nГотово:", os.path.join(OUT, "infra_2gis_counts.csv"))
