"""
Second independent check of the TSG model: places entrepreneurs know, business good / bad, vs the TSG class.

  python3 research/entrepreneur_check.py research/entrepreneurs/responses.csv   -> research/out/entrepreneurs.json

Hypothesis: a business does better in a DEFICIT cell (more people than open services) than in a SURPLUS cell.
Prediction "good" = TSG class deficit (TSG >= tau), "bad" = surplus (TSG <= -tau), balance = no prediction.
Reports precision / recall of "good", accuracy on decided cases with a 95 % Wilson interval, plus SUS and task success.
Places: an intersection ("Абая и Жансугурова", found in public/data/taldykorgan/streets.json) or "lat, lon".
"""
import csv
import json
import math
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.argv, _args = [sys.argv[0]], sys.argv[1:]
import runpy  # noqa: E402

lib = runpy.run_path(os.path.join(HERE, "h2_calibrate.py"), run_name="lib")  # loads the model (D, supply, Huff…)
C, N, CONFIG, SLOTS, to_utm = lib["C"], lib["N"], lib["CONFIG"], lib["SLOTS"], lib["to_utm"]
g = lib["_g"]
kde_supply, tsg = g["kde_supply"], g["tsg"]
D = lib["expected_D"](CONFIG["sched"], CONFIG["beta"])
S = {c: kde_supply(c, use_hours=True)[0] for c in ("food", "pharmacy", "catering")}
TAU = CONFIG["tau"]

# ---- tiny offline geocoder over the same street index the web app uses ----
idx = json.load(open(os.path.join(ROOT, "public", "data", "taldykorgan", "streets.json"), encoding="utf-8"))
KK = str.maketrans("әіңғүұқөһёй", "аингуукохеи")
STOP = {"улица", "ул", "проспект", "пр", "переулок", "пер", "микрорайон", "мкр", "кошеси", "коше", "дангылы", "street", "st", "avenue"}


def norm(s):
    s = re.sub(r"[«»\"'`.()№\-–—]", " ", s.lower().translate(KK))
    return " ".join(w for w in s.split() if w not in STOP)


def street_ids(q):
    qn = norm(q)
    hits = []
    for i, st in enumerate(idx["streets"]):
        names = [norm(n) for n in [st["n"], *st["a"]]]
        if any(n == qn for n in names):
            hits.append((0, i))
        elif any(n.startswith(qn) or any(w.startswith(qn) for w in n.split()) for n in names):
            hits.append((1, i))
    best = min((h[0] for h in hits), default=None)
    return {i for r, i in hits if r == best}


def geocode(place):
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$", place)
    if m:
        return float(m.group(1)), float(m.group(2))
    parts = [p for p in re.split(r"\s+(?:и|және|and|x|х|×)\s+|\s*[/&+×]\s*", place.strip()) if p]
    if len(parts) != 2:
        return None
    A, B = street_ids(parts[0]), street_ids(parts[1])
    for a, b, la, lo in idx["x"]:
        if (a in A and b in B) or (a in B and b in A):
            return la, lo
    return None


def wilson(k, n, z=1.96):
    if n == 0:
        return [float("nan"), float("nan")]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [c - h, c + h]


rows = list(csv.DictReader(open(_args[0], encoding="utf-8")))
res, unresolved = [], []
for r in rows:
    ll = geocode(r["place"])
    if not ll or r["category"] not in S or r["slot"] not in SLOTS or r["business_status"] not in ("good", "bad"):
        unresolved.append(r["id"])
        continue
    x, y = to_utm.transform(ll[1], ll[0])
    cell = int(((C - np.array([x, y])) ** 2).sum(1).argmin())
    t = float(np.nan_to_num(tsg(D[r["slot"]], S[r["category"]][r["slot"]])[cell]))
    cls = "deficit" if t >= TAU else "surplus" if t <= -TAU else "balance"
    res.append(dict(id=r["id"], category=r["category"], slot=r["slot"], status=r["business_status"], tsg=round(t, 3), cls=cls, cell=cell))

decided = [r for r in res if r["cls"] != "balance"]
tp = sum(r["cls"] == "deficit" and r["status"] == "good" for r in decided)
fp = sum(r["cls"] == "deficit" and r["status"] == "bad" for r in decided)
fn = sum(r["cls"] == "surplus" and r["status"] == "good" for r in decided)
tn = sum(r["cls"] == "surplus" and r["status"] == "bad" for r in decided)
num = lambda col: [float(r[col]) for r in rows if r.get(col, "").strip()]  # noqa: E731
sus, tasks = num("sus_score"), num("tasks_completed")
out = dict(
    places=len(rows), resolved=len(res), unresolved_ids=unresolved, balance_no_prediction=len(res) - len(decided),
    confusion=dict(tp=tp, fp=fp, fn=fn, tn=tn),
    precision_good=tp / (tp + fp) if tp + fp else None,
    recall_good=tp / (tp + fn) if tp + fn else None,
    accuracy=(tp + tn) / len(decided) if decided else None,
    accuracy_ci95=wilson(tp + tn, len(decided)),
    sus_mean=float(np.mean(sus)) if sus else None, sus_n=len(sus),
    task_success=float(np.mean(tasks) / 3) if tasks else None,
    detail=res,
)
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "out", "entrepreneurs.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "detail"}, ensure_ascii=False, indent=1))
