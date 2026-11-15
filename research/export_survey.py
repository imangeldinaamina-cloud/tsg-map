"""content/survey.json — anonymised aggregates of the entrepreneur Google Form for the research page.

  python3 research/export_survey.py research/entrepreneurs/form_responses_2026-11-14.csv

The raw CSV stays private (.gitignore: contacts, districts, free text). Only counts are exported; free-text quotes
are taken only from respondents who allowed their words to be used ("Да, …"), without district or contacts."""
import csv, json, os, sys
from collections import Counter
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8-sig')))
assert all(r['Согласие на участие'].startswith('Я прочитал') for r in rows)
H = rows[0].keys()
def col(prefix):
    m = [h for h in H if h.startswith(prefix)]
    assert len(m) == 1, (prefix, m); return m[0]
def one(prefix, order=None):
    c = Counter(r[col(prefix)].strip() or '—' for r in rows)
    keys = order or [k for k, _ in c.most_common()]
    return [[k, c.get(k, 0)] for k in keys if c.get(k, 0) or order]
def multi(prefix):
    c = Counter(x.strip() for r in rows for x in r[col(prefix)].split(';') if x.strip())
    return [[k, v] for k, v in c.most_common()]
def scale(prefix):
    v = [int(r[col(prefix)]) for r in rows if r[col(prefix)].strip().isdigit()]
    s = sorted(v); n = len(s)
    med = (s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2) if n else None
    return dict(n=n, dist=[[k, v.count(k)] for k in range(1, 6)], median=med, mean=round(sum(v) / n, 2) if n else None)
LEVEL = ['Больше всего клиентов', 'Средне', 'Мало']
peak = {s: one(f'Когда у вас больше всего клиентов? [{lab}', LEVEL) for s, lab in
        [('morning', 'Утро'), ('day', 'День'), ('evening', 'Вечер')]}
# free text "what services are missing": explicit normalisation (shown on the site as categories)
NORM = {'аптек': 'Аптеки', 'аптеки': 'Аптеки', 'продуктовых': 'Продуктовые магазины', 'медицинских центров для детей': 'Детские медцентры',
        'игровые клубы ночьб': 'Досуг ночью (игровые клубы)'}
miss = Counter()
for r in rows:
    t = r[col('Каких услуг')].strip().lower()
    if t: miss[NORM.get(t, 'Другое / без категории')] += 1
FIX = {'Аптека нужна всегда и люди знают что аптек много на этоц улице и могут приехать': 'Аптека нужна всегда, и люди знают, что аптек много на этой улице, и могут приехать'}
consent = col('Можно ли использовать ваши слова')
quotes = []
for r in rows:
    if not r[consent].startswith('Да'): continue
    for h in ('Если меняли: почему', 'Почему так?', 'Почему вы так думаете'):
        t = r[col(h)].strip()
        t = FIX.get(t, t)  # obvious typos only
        if len(t) > 20: quotes.append(dict(type=r[col('Выберите тип')].strip(), text=t))
dates = sorted(r['Timestamp'].split(' ')[0] for r in rows)
out = dict(
    source='Google Form «Где не хватает магазинов, аптек и кафе в Талдыкоргане», ответы 12–14.11.2026; research/export_survey.py',
    n=len(rows), dates=[dates[0], dates[-1]],
    type=one('Выберите тип'), tenure=one('Как давно вы работаете'), chose=multi('Что было главным'), demandData=one('Были ли у вас данные о спросе'),
    clients=multi('Кто ваши клиенты?'), peak=peak, weekend=one('Чем выходные отличаются'), competitors=one('Сколько похожих точек'),
    changedHours=one('Меняли ли вы когда-нибудь часы работы'), missing=[[k, v] for k, v in miss.most_common()],
    app=dict(foundCell=one('Удалось ли вам найти свою ячейку'), colourMatch=one('Совпадает ли цвет вашей ячейки'),
             shareMatch=one('Похожа ли ожидаемая доля рынка'), decision=one('Изменилось бы ваше решение'),
             clarity=scale('Насколько приложение понятно'), usefulness=scale('Насколько оно полезно'),
             wouldUse=one('Воспользовались бы вы таким отчётом'), priceNamed=sum(1 for r in rows if r[col('Сколько, по-вашему')].strip())),
    consent=one('Можно ли использовать ваши слова'), quotes=quotes)
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'content', 'survey.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False)[:3000])
