import sys, os, json, numpy as np
sys.argv = [sys.argv[0]] + sys.argv[1:3]
OUTD = sys.argv[2]; os.makedirs(OUTD, exist_ok=True)
exec(open(os.path.join(os.path.dirname(__file__), 'tsg_model.py')).read())
from scipy.stats import spearmanr
CATS = ['food', 'pharmacy', 'catering']
RUNS = int(os.environ.get('RUNS', CONFIG['runs']))
taus = [0.1, 0.2, 0.3]
Sh, Sn, ncat = {}, {}, {}
for c in CATS:
    Sh[c], ncat[c] = kde_supply(c, use_hours=True)
    Sn[c], _ = kde_supply(c, use_hours=False)
res = []
Dsum = {s: np.zeros(N) for s in SLOTS}
Tsum = {(c, s): np.zeros(N) for c in CATS for s in SLOTS}
for r in range(RUNS):
    D = run_abm(CONFIG['beta'], seed=1000 + r)
    for s in SLOTS: Dsum[s] += D[s]
    for c in CATS:
        Tst = tsg(R, Sn[c]['morning'])
        for s in SLOTS:
            Td = tsg(D[s], Sh[c][s]); Tsum[(c, s)] += np.nan_to_num(Td)
            Tdn = tsg(D[s], Sn[c][s])
            elig = (Sn[c]['morning'] > 0) & (np.maximum(R, D[s]) >= CONFIG['d_min']) & ~np.isnan(Td) & ~np.isnan(Tst)
            aD = D[s] / D[s].sum(); aR = R / R.sum()
            row = dict(run=r, cat=c, slot=s, n_elig=int(elig.sum()), shift=float(0.5 * np.abs(aD - aR).sum()), rhoDR=float(spearmanr(D[s], R).correlation),
                       rho=float(spearmanr(Tst[elig], Td[elig]).correlation))
            for tau in taus:
                cs, cd, cdn = classes(Tst, tau), classes(Td, tau), classes(Tdn, tau)
                row[f'change_{tau}'] = float((cs[elig] != cd[elig]).mean())
                row[f'def_static_{tau}'] = float((cs[elig] == 1).mean())
                row[f'def_dyn_{tau}'] = float((cd[elig] == 1).mean())
                row[f'def_dyn_nohours_{tau}'] = float((cdn[elig] == 1).mean())
                # static-balanced/surplus that become deficit
                row[f'hidden_def_{tau}'] = float(((cs[elig] != 1) & (cd[elig] == 1)).mean())
            res.append(row)
json.dump(res, open(f'{OUTD}/runs.json', 'w'))
# summary
def summ(key, c, s):
    v = np.array([x[key] for x in res if x['cat'] == c and x['slot'] == s])
    return dict(mean=float(v.mean()), lo=float(np.percentile(v, 2.5)), hi=float(np.percentile(v, 97.5)))
coverage = {c: dict(cells=int((Sn[c]['morning'] > 0).sum()), residents_share=float(R[Sn[c]['morning'] > 0].sum() / R.sum())) for c in CATS}
summary = dict(coverage=coverage, config={k: v for k, v in CONFIG.items() if k != 'sched'}, sched=CONFIG['sched'], n_cells=N,
               side_m=side, worldpop_total_in_city=float(worldpop_total), n_objects=ncat,
               n_oh_parsed=n_oh_parsed, attractors={k: int(len(v[1])) for k, v in ATT.items()}, metrics={})
for c in CATS:
    for s in SLOTS:
        summary['metrics'][f'{c}|{s}'] = {k: summ(k, c, s) for k in res[0] if k not in ('run', 'cat', 'slot')}
# absolute: open objects per 1000 present (city level)
summary['open_per_1000'] = {c: {s: float(sum(o['open'][s] for o in objs if o['cat'] == c) / (CONFIG['city_pop'] / 1000)) for s in SLOTS} for c in CATS}
json.dump(summary, open(f'{OUTD}/summary.json', 'w'), ensure_ascii=False, indent=1)
# per-cell means for maps / app
cells = []
import pyproj
back = pyproj.Transformer.from_crs('EPSG:32644', 'EPSG:4326', always_xy=True)
for i in range(N):
    lo, la = back.transform(C[i, 0], C[i, 1])
    cell = dict(id=i, lon=lo, lat=la, R=float(R[i]))
    for s in SLOTS:
        cell[f'D_{s}'] = float(Dsum[s][i] / RUNS)
        for c in CATS:
            cell[f'TSG_{c}_{s}'] = float(Tsum[(c, s)][i] / RUNS)
            cell[f'TSGstat_{c}'] = float(np.nan_to_num(tsg(R, Sn[c]['morning'])[i]))
    cells.append(cell)
json.dump(dict(side_m=side, cells=cells), open(f'{OUTD}/cells.json', 'w'))
print(json.dumps({k: summary[k] for k in ('n_cells', 'side_m', 'worldpop_total_in_city', 'n_objects', 'n_oh_parsed', 'attractors')}, ensure_ascii=False))
