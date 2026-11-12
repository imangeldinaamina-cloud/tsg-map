# Export data for the TSG web-app prototype: cells (D from 100-run means, R, S by category/slot), objects, outline.
import sys, os, json, numpy as np
DATA_DIR, OUTD = sys.argv[1], sys.argv[2]
sys.argv = [sys.argv[0], DATA_DIR, OUTD]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tsg_model.py')).read())
cells_json = json.load(open(os.path.join(sys.argv[2], 'cells.json')))['cells']
CATS = ['food', 'pharmacy', 'catering']
S = {c: kde_supply(c, use_hours=True)[0] for c in CATS}
S0 = {c: kde_supply(c, use_hours=False)[0]['morning'] for c in CATS}
x0, y0 = poly.bounds[0], poly.bounds[1]
out = dict(side=side, radius=CONFIG['radius_m'], beta=CONFIG['beta'], d_min=CONFIG['d_min'], tau=CONFIG['tau'],
           k=CONFIG['k'], city_pop=CONFIG['city_pop'], slots=CONFIG['slots'], default_hours=CONFIG['default_hours'],
           runs=CONFIG['runs'], cells=[], objects=[], outline=[], landmarks=[])
for i in range(N):
    cj = cells_json[i]
    out['cells'].append(dict(x=round(C[i,0]-x0,1), y=round(C[i,1]-y0,1), R=round(float(R[i]),1),
        D={s: round(cj[f'D_{s}'],1) for s in SLOTS},
        S={c: {s: float(f'{S[c][s][i]:.4g}') for s in SLOTS} for c in CATS},
        S0={c: float(f'{S0[c][i]:.4g}') for c in CATS}))
for o in objs:
    if o['cat']:
        out['objects'].append(dict(x=round(o['x']-x0,1), y=round(o['y']-y0,1), c=o['cat'], n=o['name'] or '',
                                   o={s: round(o['open'][s],3) for s in SLOTS}, h=bool(o['oh'])))
out['outline'] = [[round(a-x0,1), round(b-y0,1)] for a, b in poly.simplify(15).exterior.coords]
seen=set()
for o in objs:
    nm=(o['name'] or '')
    if o['att'] in ('mall','market','univ') and nm and nm not in seen and (o['att']!='mall' or any(b.lower() in nm.lower() for b in CONFIG['big_malls'])):
        seen.add(nm); out['landmarks'].append(dict(x=round(o['x']-x0,1), y=round(o['y']-y0,1), n=nm, t=o['att']))
json.dump(out, open(f'{OUTD}/app_data.json','w'), ensure_ascii=False, separators=(',',':'))
print(len(out['cells']), len(out['objects']), len(out['outline']), [l['n'] for l in out['landmarks']][:30])
print('food S nonzero', sum(1 for c in out['cells'] if c['S0']['food']>0))
