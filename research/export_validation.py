"""content/validation.json — public, aggregated summary of the H2 video check for the research page.

  python3 research/h2_calibrate.py        # → research/out/h2_report.json (needs numpy, scipy, rasterio, shapely, pyproj)
  python3 research/export_validation.py   # → content/validation.json

Copies the numbers of h2_report.json without changing them and adds per-point clip availability from
research/video/clips.csv. Nothing is estimated here."""
import csv, json, os
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
rep = json.load(open(os.path.join(HERE, 'out', 'h2_report.json'), encoding='utf-8'))
clips = list(csv.DictReader(open(os.path.join(HERE, 'video', 'clips.csv'), encoding='utf-8')))
roles = {p['id']: p['role'] for p in json.load(open(os.path.join(HERE, '..', 'content', 'research.json'), encoding='utf-8'))['field']['points']}
avail = defaultdict(lambda: {'weekday': {'morning': 0, 'day': 0, 'evening': 0}, 'saturday': {'morning': 0, 'day': 0, 'evening': 0}})
for c in clips:
    avail[c['point']]['saturday' if c['weekday'] == 'Sat' else 'weekday'][c['slot']] += 1
cell_count = defaultdict(int)
for p in rep['points'].values(): cell_count[p['hex_cell']] += 1
def per_point(block):
    g = defaultdict(list)
    for o in block['observed']: g[o['point']].append(o)
    return {k: dict(n=len(v), mae_model=sum(abs(o['obs'] - o['model']) for o in v) / len(v),
                    mae_registry=sum(abs(o['obs']) for o in v) / len(v),
                    sign_ok=sum((o['obs'] > 0) == (o['model'] > 0) for o in v)) for k, v in g.items()}
pp = per_point(rep['weekdays'])
keep = ['n_points', 'n_ratios', 'mae_registry', 'mae_registry_ci', 'mae_model', 'mae_model_ci', 'improvement_model_vs_registry', 'sign_agreement_model', 'cross_section']
out = dict(
    source='research/out/h2_report.json ← research/h2_calibrate.py (re-run 15.11.2026: identical output)',
    metric='MAE of log-ratios of people between two slots at the same point; registry predicts 0. 95% CI: bootstrap over points.',
    eps=rep['eps'],
    weekdays={k: rep['weekdays'][k] for k in keep} | {'loo_mae': rep['weekdays']['loo_mae']},
    all_days={k: rep['all_days'][k] for k in keep if k in rep['all_days']},
    points=[dict(id=k, name=v['name'], hex_cell=v['hex_cell'], shared_cell=cell_count[v['hex_cell']] > 1, role=roles.get(k),
                 clips=sum(sum(s.values()) for s in avail[k].values()), avail=avail[k], weekday_fit=pp.get(k))
            for k, v in sorted(rep['points'].items())],
)
json.dump(out, open(os.path.join(HERE, '..', 'content', 'validation.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('points', len(out['points']), 'weekday ratios', out['weekdays']['n_ratios'])
