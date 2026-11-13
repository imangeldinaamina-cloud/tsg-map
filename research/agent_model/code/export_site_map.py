"""Export the hex map used by the interactive figures on the research page (public/research/hexmap.json).

  python3 research/agent_model/code/export_site_map.py

Uses the OSM-only model (tsg_model.py) so the figures match the paper; presence D = mean of 100 ABM runs,
taken from data/agent-model/taldykorgan.json (same cell order). TSG per cell:
  static  = TSG(R, S without hours)            (what a registry-based method would show)
  slot s  = TSG(D_s, S with opening hours, s)  (the dynamic index)
A cell gets a value only where the paper evaluates it: a facility of the category within 500 m and
at least 50 people (max of residents and presence). Video points P01–P10 are projected to the same metres.
"""
import csv
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DATA = os.path.join(HERE, "..", "data")
sys.argv = [sys.argv[0], DATA, os.path.join(ROOT, "research", "out")]
exec(open(os.path.join(HERE, "tsg_model.py"), encoding="utf-8").read())

agent = json.load(open(os.path.join(ROOT, "data", "agent-model", "taldykorgan.json"), encoding="utf-8"))
x0, y0 = poly.bounds[0], poly.bounds[1]
assert len(agent["cells"]) == N
for i in (0, N // 2, N - 1):
    a = agent["cells"][i]
    assert abs(a["x"] - (C[i, 0] - x0)) < 1 and abs(a["y"] - (C[i, 1] - y0)) < 1, "cell order differs"
D = {s: np.array([c["D"][s] for c in agent["cells"]]) for s in SLOTS}

CATS = ["food", "pharmacy", "catering"]
out = dict(side=round(side, 1), slots=SLOTS, cats=CATS, tau=CONFIG["tau"], cells=[], outline=[], landmarks=[], points=[], summary={})
T = {}
for c in CATS:
    Sh, _ = kde_supply(c, use_hours=True)
    Sn, _ = kde_supply(c, use_hours=False)
    T[(c, "static")] = (tsg(R, Sn["morning"]), (Sn["morning"] > 0) & (R >= CONFIG["d_min"]))
    for s in SLOTS:
        T[(c, s)] = (tsg(D[s], Sh[s]), (Sn["morning"] > 0) & (np.maximum(R, D[s]) >= CONFIG["d_min"]))


def val(c, k, i):
    t, m = T[(c, k)]
    return None if (not m[i] or np.isnan(t[i])) else round(float(t[i]), 2)


for i in range(N):
    out["cells"].append(dict(
        x=round(float(C[i, 0] - x0)), y=round(float(C[i, 1] - y0)), R=round(float(R[i])),
        D={s: round(float(D[s][i])) for s in SLOTS},
        T={c: {k: val(c, k, i) for k in ["static", *SLOTS]} for c in CATS},
    ))

# share of evaluated cells whose class differs from the static one (single mean map; the paper averages 100 runs)
for c in CATS:
    st, _ = T[(c, "static")]
    for s in SLOTS:
        t, m = T[(c, s)]
        e = m & ~np.isnan(t) & ~np.isnan(st)
        out["summary"][f"{c}|{s}"] = dict(n=int(e.sum()), changed=round(float((classes(st, 0.2)[e] != classes(t, 0.2)[e]).mean()), 3))

out["outline"] = [[round(a - x0), round(b - y0)] for a, b in poly.simplify(25).exterior.coords]
seen = set()
for o in objs:
    nm = o["name"] or ""
    if o["att"] in ("mall", "market", "univ") and nm and nm not in seen and (o["att"] != "mall" or any(b.lower() in nm.lower() for b in CONFIG["big_malls"])):
        seen.add(nm)
        out["landmarks"].append(dict(x=round(o["x"] - x0), y=round(o["y"] - y0), n=nm, t=o["att"]))
for r in csv.DictReader(open(os.path.join(ROOT, "research", "video", "points.csv"), encoding="utf-8")):
    if r["lat"]:
        x, y = to_utm.transform(float(r["lon"]), float(r["lat"]))
        out["points"].append(dict(id=r["point"], x=round(x - x0), y=round(y - y0)))

dst = os.path.join(ROOT, "public", "research", "hexmap.json")
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(dst, os.path.getsize(dst), "bytes;", json.dumps(out["summary"]), [l["n"] for l in out["landmarks"]])
