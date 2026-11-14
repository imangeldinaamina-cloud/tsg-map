"""hexmap.json (dataset v2-osm-2gis) with the inputs of the index, so the site recomputes a, b and TSG itself.

  python3 export_site_map_v3.py <app_data_v2_public.json> <current hexmap.json> <out hexmap.json>

Per cell (aggregates only, no object names, coordinates or hours of 2GIS objects):
  R, D[slot]                residents (WorldPop scaled to BNS) and mean modelled presence over 100 runs
  S[cat][static|slot]       kernel supply, objects per km² (quartic kernel, h = 500 m); static = without hours
  N[cat], Nh[cat]           objects of the category within 500 m of the cell centre, and how many have known hours
  T[cat][view]              TSG rounded to 0.01 as computed by the author's app (kept for cross-checking)
Shares are normalized over all 355 cells; evaluated where S0 > 0 and max(R, D) >= 50 (same as app_v2.html)."""
import json, math, sys
src, cur, dst = sys.argv[1:4]
V = json.load(open(src)); H = json.load(open(cur))
cells = V['cells']; objs = V['objects']; SL = ['morning', 'day', 'evening']; CATS = ['food', 'pharmacy', 'catering']
for i in (0, 206, 354):
    assert abs(cells[i]['x'] - H['cells'][i]['x']) < 2 and abs(cells[i]['y'] - H['cells'][i]['y']) < 2, i
g = lambda v: float(f"{v * 1e6:.6g}")  # per m² → per km², 6 significant digits
out = dict(H)
out['version'] = 'v2-osm-2gis'
out['units'] = {'R': 'people', 'D': 'people (mean of 100 runs)', 'S': 'objects per km² (quartic kernel, h = 500 m)'}
out['cells'] = []
for i, c in enumerate(cells):
    N = {k: 0 for k in CATS}; Nh = {k: 0 for k in CATS}
    for o in objs:
        if math.hypot(o['x'] - c['x'], o['y'] - c['y']) <= V['radius']:
            N[o['c']] += 1; Nh[o['c']] += 1 if o.get('h') else 0
    old = H['cells'][i]
    out['cells'].append(dict(
        x=old['x'], y=old['y'], R=round(c['R'], 1), D={s: round(c['D'][s], 1) for s in SL},
        S={k: dict(static=g(c['S0'][k]), **{s: g(c['S'][k][s]) for s in SL}) for k in CATS},
        N=N, Nh=Nh, T=old['T']))
def tsg_exact(cat, view):
    D = [c['R'] if view == 'static' else c['D'][view] for c in out['cells']]
    S = [c['S'][cat][view] for c in out['cells']]
    sD, sS = sum(D), sum(S); res = []
    for i, c in enumerate(out['cells']):
        a, b = D[i] / sD, S[i] / sS
        ok = c['S'][cat]['static'] > 0 and max(c['R'], D[i]) >= V['d_min'] and a + b > 0
        res.append((a - b) / (a + b) if ok else None)
    return res
cls = lambda t: 'def' if t >= 0.2 else 'sur' if t <= -0.2 else 'bal'
out['summary'] = {}  # exact (unrounded) TSG, the same values the site computes
for k in CATS:
    st = tsg_exact(k, 'static')
    for s in SL:
        dy = tsg_exact(k, s); e = [i for i in range(len(st)) if st[i] is not None and dy[i] is not None]
        out['summary'][f'{k}|{s}'] = dict(n=len(e), changed=round(sum(cls(st[i]) != cls(dy[i]) for i in e) / len(e), 3),
                                          hidden=round(sum(cls(st[i]) != 'def' and cls(dy[i]) == 'def' for i in e) / len(e), 3))
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('cells', len(out['cells']), 'objects', len(objs), '206', json.dumps(out['cells'][206])[:400])
