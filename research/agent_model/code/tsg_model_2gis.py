"""
TSG model for Taldykorgan: agent-based presence (D), KDE supply with opening hours (S),
Temporal Service Gap index. All assumptions are collected in CONFIG and reported.
Run: python3 tsg_model.py <data_dir> <out_dir>
"""
import sys, json, re, math
import numpy as np
import rasterio
from rasterio.transform import xy
from shapely.geometry import shape, Point, Polygon
from shapely.prepared import prep
from pyproj import Transformer

DATA, OUT = sys.argv[1], sys.argv[2]

CONFIG = dict(
    city_pop=171_618,          # BNS RK, city proper, 01.04.2026 (T-18-06-K)
    k=10,                      # residents per agent
    hex_area_km2=0.25,
    radius_m=500,              # SP RK 3.01-101-2013 p.4.1.7
    beta=2.0,                  # Huff decay (to be calibrated)
    runs=100,
    d_min=50,                  # min people for TSG
    tau=0.2,
    # type shares (ASSUMPTION, national proportions, to verify on stat.gov.kz)
    shares=dict(worker=0.425, pupil=0.21, student=0.03, other=0.335),
    # schedule probabilities (ASSUMPTION, fixed before calculation)
    sched=dict(
        worker=dict(morning=('work', 0.85), day=('work', 0.85), evening=('mall', 0.20)),
        pupil=dict(morning=('school', 0.65), day=('school', 0.35), evening=('mall', 0.15)),
        student=dict(morning=('univ', 0.80), day=('univ', 0.60), evening=('mall', 0.20)),
        other=dict(morning=('mall_market', 0.15), day=('mall_market', 0.25), evening=('home', 0.0)),
    ),
    slots=dict(morning=(7.0, 11.0), day=(11.0, 16.5), evening=(16.5, 22.0)),
    # default opening hours when OSM has none (ASSUMPTION)
    default_hours=dict(food=(8, 22), pharmacy=(8, 21), catering=(10, 23)),
    big_malls=('Атамекен', 'Sity Plus', 'Сити плюс'),
    big_mall_weight=5.0,
)

import os
for _k in ('hex_area_km2','radius_m','beta'):
    if os.environ.get(_k.upper()): CONFIG[_k]=float(os.environ[_k.upper()])
SLOTS = list(CONFIG['slots'])
to_utm = Transformer.from_crs('EPSG:4326', 'EPSG:32644', always_xy=True)

# ---------------- city polygon ----------------
nomi = json.load(open(f'{DATA}/nomi.json'))
city = next(x for x in nomi if x['osm_type'] == 'way')
poly_ll = shape(city['geojson'])
poly = Polygon([to_utm.transform(x, y) for x, y in poly_ll.exterior.coords])
ppoly = prep(poly)

# ---------------- hex grid (flat-top) ----------------
A = CONFIG['hex_area_km2'] * 1e6
side = math.sqrt(2 * A / (3 * math.sqrt(3)))
w, h = 1.5 * side, math.sqrt(3) * side
minx, miny, maxx, maxy = poly.bounds
centers = []
col = 0
x = minx - side
while x < maxx + side:
    y0 = miny - h + (h / 2 if col % 2 else 0)
    y = y0
    while y < maxy + h:
        hexagon = Polygon([(x + side * math.cos(math.radians(a)), y + side * math.sin(math.radians(a))) for a in range(0, 360, 60)])
        if hexagon.intersects(poly):
            centers.append((x, y))
        y += h
    x += w
    col += 1
C = np.array(centers)
N = len(C)

def nearest_cell(xy):
    d = ((C[:, None, :] - np.asarray(xy)[None, :, :]) ** 2).sum(-1)
    return d.argmin(0)

# ---------------- residents from WorldPop ----------------
with rasterio.open(f'{DATA}/kaz_pop_2024.tif') as src:
    win = rasterio.windows.from_bounds(78.25, 44.93, 78.48, 45.08, transform=src.transform)
    arr = src.read(1, window=win).astype(float)
    tr = src.window_transform(win)
    nod = src.nodata
arr[(arr < 0) | (arr == nod)] = 0
rows, cols = np.nonzero(arr > 0)
lon, lat = xy(tr, rows, cols)
px, py = to_utm.transform(np.array(lon), np.array(lat))
vals = arr[rows, cols]
inside = np.array([ppoly.contains(Point(a, b)) for a, b in zip(px, py)])
px, py, vals = px[inside], py[inside], vals[inside]
W = np.zeros(N)
cell_of_px = np.concatenate([nearest_cell(np.c_[px[i:i+5000], py[i:i+5000]]) for i in range(0, len(px), 5000)])
np.add.at(W, cell_of_px, vals)
worldpop_total = vals.sum()
R = W * CONFIG['city_pop'] / W.sum()

# ---------------- OSM objects ----------------
osm = json.load(open(f'{DATA}/osm.json'))['elements']
def coord(e):
    if 'lat' in e: return e['lon'], e['lat']
    return e['center']['lon'], e['center']['lat']

FOOD = {'supermarket', 'convenience', 'grocery', 'greengrocer', 'butcher', 'bakery', 'general', 'kiosk', 'deli', 'dairy', 'beverages', 'food', 'frozen_food'}
objs = []
for e in osm:
    t = e.get('tags', {})
    lo, la = coord(e)
    X, Y = to_utm.transform(lo, la)
    if not ppoly.contains(Point(X, Y)):
        continue
    cat = None; att = None
    if t.get('shop') in FOOD: cat = 'food'
    elif t.get('amenity') == 'pharmacy' or t.get('healthcare') == 'pharmacy': cat = 'pharmacy'
    elif t.get('amenity') in ('cafe', 'restaurant', 'fast_food', 'food_court'): cat = 'catering'
    if t.get('amenity') == 'school' or t.get('building') == 'school': att = 'school'
    elif t.get('amenity') in ('university', 'college') or t.get('building') == 'university': att = 'univ'
    elif t.get('shop') in ('mall', 'department_store'): att = 'mall'
    elif t.get('amenity') == 'marketplace': att = 'market'
    elif t.get('office') or t.get('amenity') in ('hospital', 'clinic', 'bank', 'post_office', 'townhall') \
            or t.get('building') in ('commercial', 'office', 'industrial', 'government', 'public', 'retail') \
            or t.get('landuse') in ('industrial', 'commercial', 'retail'):
        att = 'work'
    objs.append(dict(x=X, y=Y, cat=cat, att=att, name=t.get('name') or t.get('name:ru'), oh=t.get('opening_hours')))

# ---------------- 2GIS hours (merged into OSM objects) ----------------
import csv as _csv
_g = list(_csv.DictReader(open(f'{DATA}/hours_2gis.csv', encoding='utf-8')))
GIS_STATS = dict(total=len(_g), matched=0, added=0, outside=0, nohours=0)
for _r in _g:
    _lo, _la = float(_r['lon']), float(_r['lat'])
    _X, _Y = to_utm.transform(_lo, _la)
    if not ppoly.contains(Point(_X, _Y)):
        GIS_STATS['outside'] += 1; continue
    _oh = ','.join(x for x in (_r['wed'] or '').split(';') if x)
    if not _oh: GIS_STATS['nohours'] += 1
    _cands = [o for o in objs if o['cat'] == _r['category'] and (o['x']-_X)**2 + (o['y']-_Y)**2 < 50**2]
    if _cands:
        _c = min(_cands, key=lambda o: (o['x']-_X)**2 + (o['y']-_Y)**2)
        if _oh: _c['oh'] = _oh
        GIS_STATS['matched'] += 1
    else:
        objs.append(dict(x=_X, y=_Y, cat=_r['category'], att=None, name=_r['name'], oh=_oh or None))
        GIS_STATS['added'] += 1
print('2GIS merge:', GIS_STATS)

# ---------------- opening hours ----------------
DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
def day_in(spec, day='We'):
    for part in spec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-')
            if a in DAYS and b in DAYS:
                i, j, k = DAYS.index(a), DAYS.index(b), DAYS.index(day)
                if (i <= k <= j) if i <= j else (k >= i or k <= j): return True
        elif part == day:
            return True
    return False

def parse_hours(oh, day='We'):
    """Return list of (start,end) hours for a weekday, or None if unparseable."""
    if not oh: return None
    oh = oh.strip()
    if oh == '24/7': return [(0, 24)]
    best = None
    for rule in oh.split(';'):
        rule = rule.strip()
        m = re.match(r'^(?:([A-Za-z,\- ]+)\s+)?([0-9:,\- ]+)$', rule)
        if not m: return None
        days, times = m.group(1), m.group(2)
        if days and not day_in(days.replace(' ', ''), day): continue
        rng = []
        for tpart in times.split(','):
            a, b = tpart.strip().split('-')
            ha = int(a[:2]) + int(a[3:5]) / 60; hb = int(b[:2]) + int(b[3:5]) / 60
            if hb <= ha: hb += 24
            rng.append((ha, hb))
        best = rng
    return best if best is not None else []

def open_fraction(rng, slot):
    s0, s1 = CONFIG['slots'][slot]
    tot = 0.0
    for a, b in rng:
        tot += max(0.0, min(b, s1) - max(a, s0))
    return tot / (s1 - s0)

n_oh_parsed = 0
for o in objs:
    if o['cat']:
        r = parse_hours(o['oh'])
        if r is not None and o['oh']: n_oh_parsed += 1
        if r is None: r = [CONFIG['default_hours'][o['cat']]]
        o['open'] = {s: open_fraction(r, s) for s in SLOTS}

# ---------------- supply S (quartic KDE) ----------------
r0 = CONFIG['radius_m']
def kde_supply(cat, radius=r0, use_hours=True):
    out = {s: np.zeros(N) for s in SLOTS}
    pts = [o for o in objs if o['cat'] == cat]
    for o in pts:
        d2 = (C[:, 0] - o['x']) ** 2 + (C[:, 1] - o['y']) ** 2
        k = np.where(d2 < radius ** 2, 3 / (math.pi * radius ** 2) * (1 - d2 / radius ** 2) ** 2, 0.0)
        for s in SLOTS:
            out[s] += k * (o['open'][s] if use_hours else 1.0)
    return out, len(pts)

# ---------------- attractors ----------------
def attractor(kind):
    sel = [o for o in objs if o['att'] == kind]
    if kind == 'mall_market':
        sel = [o for o in objs if o['att'] in ('mall', 'market')]
    if kind == 'mall':
        sel = [o for o in objs if o['att'] in ('mall',)]
    xyz = np.array([[o['x'], o['y']] for o in sel])
    wgt = np.array([CONFIG['big_mall_weight'] if (o['name'] and any(b.lower() in o['name'].lower() for b in CONFIG['big_malls'])) else
                    (3.0 if o['att'] == 'market' else 1.0) for o in sel])
    return xyz, wgt, nearest_cell(xyz)

ATT = {k: attractor(k) for k in ('work', 'school', 'univ', 'mall', 'mall_market')}

def huff_probs(kind, beta):
    xyz, wgt, _ = ATT[kind]
    d = np.sqrt(((C[:, None, :] - xyz[None, :, :]) ** 2).sum(-1))
    d = np.maximum(d, 100.0)                     # avoid zero distance within a cell
    u = wgt[None, :] * d ** (-beta)
    return u / u.sum(1, keepdims=True)

# ---------------- agent-based model ----------------
def run_abm(beta, seed):
    rng = np.random.default_rng(seed)
    n_agents = int(round(CONFIG['city_pop'] / CONFIG['k']))
    home = rng.choice(N, size=n_agents, p=R / R.sum())
    types = rng.choice(list(CONFIG['shares']), size=n_agents, p=list(CONFIG['shares'].values()))
    P = {k: huff_probs(k, beta) for k in ATT}
    # fixed destinations (assigned once per agent)
    fixed = {}
    for tp, kind in (('worker', 'work'), ('pupil', 'school'), ('student', 'univ')):
        idx = np.where(types == tp)[0]
        dest = np.array([rng.choice(P[kind].shape[1], p=P[kind][h]) for h in home[idx]])
        fixed[tp] = (idx, ATT[kind][2][dest])
    D = {}
    for s in SLOTS:
        loc = home.copy()
        for tp in CONFIG['shares']:
            kind, p = CONFIG['sched'][tp][s]
            idx = np.where(types == tp)[0]
            go = rng.random(len(idx)) < p
            if kind == 'home' or p == 0: continue
            if tp in fixed and kind in ('work', 'school', 'univ'):
                loc[idx[go]] = fixed[tp][1][go]
            else:  # leisure trip chosen per slot
                g = idx[go]
                dest = np.array([rng.choice(P[kind].shape[1], p=P[kind][h]) for h in home[g]], dtype=int)
                loc[g] = ATT[kind][2][dest]
        D[s] = np.bincount(loc, minlength=N) * CONFIG['k']
    return D

# ---------------- TSG ----------------
def tsg(D, S):
    a = D / D.sum(); b = S / S.sum() if S.sum() > 0 else S
    den = a + b
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(den > 0, (a - b) / den, np.nan)

def classes(t, tau):
    return np.where(np.isnan(t), np.nan, np.where(t >= tau, 1, np.where(t <= -tau, -1, 0)))
