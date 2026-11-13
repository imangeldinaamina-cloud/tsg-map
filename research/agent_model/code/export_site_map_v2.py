"""hexmap.json v2: cells from website_data_v2/app_data_v2_public.json (aggregates only), TSG per cell the same way as
app_v2.html (static = R vs S0 without hours; slot = D vs S with hours; evaluated where S0>0 and max(R,D)>=50).
Outline / landmarks / video points are kept from the current hexmap (same metric frame, checked on cell coords)."""
import json, math, sys
src, cur, dst = sys.argv[1:4]
V = json.load(open(src)); H = json.load(open(cur))
cells = V['cells']; SL = ['morning', 'day', 'evening']; CATS = ['food', 'pharmacy', 'catering']
for i in (0, 206, 354):
    assert abs(cells[i]['x'] - H['cells'][i]['x']) < 2 and abs(cells[i]['y'] - H['cells'][i]['y']) < 2, i
def tsg(cat, slot):
    D = [c['R'] if slot == 'static' else c['D'][slot] for c in cells]
    S = [c['S0'][cat] if slot == 'static' else c['S'][cat][slot] for c in cells]
    sD, sS = sum(D), sum(S); out = []
    for i, c in enumerate(cells):
        a, b = D[i] / sD, S[i] / sS
        t = (a - b) / (a + b) if a + b > 0 else None
        ok = c['S0'][cat] > 0 and max(c['R'], D[i]) >= V['d_min'] and t is not None
        out.append(round(t, 2) if ok else None)
    return out
T = {(c, k): tsg(c, k) for c in CATS for k in ['static', *SL]}
cls = lambda t: 'def' if t >= 0.2 else 'sur' if t <= -0.2 else 'bal'
out = dict(H); out['cells'] = []; out['summary'] = {}
for i, c in enumerate(cells):
    out['cells'].append(dict(x=round(c['x']), y=round(c['y']), R=round(c['R']), D={s: round(c['D'][s]) for s in SL},
                             T={k: {s: T[(k, s)][i] for s in ['static', *SL]} for k in CATS}))
for k in CATS:
    for s in SL:
        e = [i for i in range(len(cells)) if T[(k, 'static')][i] is not None and T[(k, s)][i] is not None]
        ch = sum(cls(T[(k, 'static')][i]) != cls(T[(k, s)][i]) for i in e)
        hid = sum(cls(T[(k, 'static')][i]) != 'def' and cls(T[(k, s)][i]) == 'def' for i in e)
        out['summary'][f'{k}|{s}'] = dict(n=len(e), changed=round(ch / len(e), 3), hidden=round(hid / len(e), 3))
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(json.dumps(out['summary'])); print('206', out['cells'][206])
