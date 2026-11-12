"""
Скачивает часы работы магазинов / аптек / кафе Талдыкоргана через официальный API 2ГИС.
НУЖЕН ТВОЙ СОБСТВЕННЫЙ КЛЮЧ: dev.2gis.com -> регистрация -> «Демо-ключ» (бесплатно, для учебных целей).
Запуск:  python3 fetch_2gis_hours.py ТВОЙ_КЛЮЧ
Результат: hours_2gis.csv  (name, category, lat, lon, mon..sun как "HH:MM-HH:MM", is_24x7)
ВАЖНО: не публикуй ключ и сами сырые данные 2ГИС на стенде; в источниках пиши «2ГИС, API, дата выгрузки».
Не проверено на реальном ключе — если API вернёт ошибку, пришли мне текст ошибки.
"""
import sys, csv, json, time, urllib.request, urllib.parse
KEY = sys.argv[1]
API = "https://catalog.api.2gis.com/3.0/items"
QUERIES = {"food": ["продуктовый магазин", "супермаркет", "минимаркет"],
           "pharmacy": ["аптека"],
           "catering": ["кафе", "ресторан", "столовая", "фастфуд"]}
CITY = "Талдыкорган"
DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

def get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

def fmt(day):
    if not day: return ""
    return ";".join(f'{w["from"]}-{w["to"]}' for w in day.get("working_hours", []))

seen, rows = set(), []
for cat, qs in QUERIES.items():
    for q in qs:
        page = 1
        while page <= 20:
            d = get(dict(q=f"{q} {CITY}", type="branch", page=page, page_size=10,
                         fields="items.point,items.schedule,items.name", key=KEY))
            items = d.get("result", {}).get("items", [])
            if not items: break
            for it in items:
                if it["id"] in seen: continue
                seen.add(it["id"])
                sch = it.get("schedule") or {}
                p = it.get("point") or {}
                rows.append([it.get("name",""), cat, p.get("lat"), p.get("lon"),
                             *[fmt(sch.get(dd)) for dd in DAYS], sch.get("is_24x7", False)])
            page += 1; time.sleep(0.3)
with open("hours_2gis.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["name","category","lat","lon",*[x.lower() for x in DAYS],"is_24x7"]); w.writerows(rows)
print(len(rows), "объектов записано в hours_2gis.csv")
