"""
H2 check and video calibration of the TSG agent model.

  python3 research/h2_calibrate.py            ->  research/out/h2_report.json  (+ printed summary)

What it does
1. Loads the author's model (research/agent_model/code/tsg_model_2gis.py) and computes the EXPECTED presence D per
   hex cell and time slot analytically (the mean of infinitely many ABM runs: same schedules, same Huff choice).
2. Video: YOLOv8 mean people per frame for every clip (research/video/clips.csv), at points P01–P09
   (research/video/points.csv; P10 has no location yet and is excluded).
3. H2 — does the model match the video better than the registry (residents by place of residence)?
   a) Temporal profile, per point: the log-ratio of people between two slots, e.g. log(V_evening / V_morning).
      A camera sees only a slice of a cell, but that slice is the same at every hour, so the ratio cancels
      the unknown field of view. Registry predicts ratio 1 (log 0): residents do not move.
      Metric: mean absolute error of the predicted log-ratios; model vs registry.
   b) Across points, per slot: Spearman correlation of video counts with D and with R
      (indicative only: cameras see different-sized areas). 95 % CIs: bootstrap over points.
4. Calibration (the closed loop): schedule probabilities and the Huff exponent beta are chosen so that the
   model's log-ratios match the video. Honest check: leave-one-point-out — fit on the other points,
   predict the held-out one, compare with the uncalibrated model and the registry.
Weekday clips only for fitting (agents follow a weekday schedule); the Saturday (10.10.2026) clips are reported
separately.
"""
import csv
import itertools
import json
import math
import os
import sys

import numpy as np
from scipy.stats import spearmanr

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "agent_model", "code", "tsg_model_2gis.py")
DATA = os.path.join(HERE, "agent_model", "data")
OUTD = os.path.join(HERE, "out")
os.makedirs(OUTD, exist_ok=True)

# ---- load the model (it builds the hex grid, residents R, attractors, Huff) ----
_argv = sys.argv
sys.argv = [MODEL, DATA, OUTD]
_g = {"__name__": "tsg_model", "__file__": MODEL}
exec(open(MODEL, encoding="utf-8").read(), _g)
sys.argv = _argv
C, N, R, ATT, CONFIG, SLOTS = _g["C"], _g["N"], _g["R"], _g["ATT"], _g["CONFIG"], _g["SLOTS"]
huff_probs, to_utm, run_abm = _g["huff_probs"], _g["to_utm"], _g["run_abm"]

_huff_cache = {}


def huff(kind, beta):
    key = (kind, round(beta, 4))
    if key not in _huff_cache:
        _huff_cache[key] = huff_probs(kind, beta)
    return _huff_cache[key]


def expected_D(sched, beta, shares=None):
    """Mean presence per hex cell and slot, = average of infinitely many run_abm() with these parameters."""
    shares = shares or CONFIG["shares"]
    out = {}
    for s in SLOTS:
        D = np.zeros(N)
        for tp, q in shares.items():
            kind, p = sched[tp][s]
            pop = q * R
            if kind == "home" or p == 0:
                D += pop
                continue
            D += (1 - p) * pop
            arrivals = (p * pop) @ huff(kind, beta)  # expected arrivals per attractor
            np.add.at(D, ATT[kind][2], arrivals)
        out[s] = D
    return out


# ---- video ----
clips = list(csv.DictReader(open(os.path.join(HERE, "video", "clips.csv"), encoding="utf-8")))
points = {r["point"]: r for r in csv.DictReader(open(os.path.join(HERE, "video", "points.csv"), encoding="utf-8")) if r["lat"]}
P_IDS = sorted(points)
xy = np.array([to_utm.transform(float(points[p]["lon"]), float(points[p]["lat"])) for p in P_IDS])
cell_of = dict(zip(P_IDS, ((C[:, None, :] - xy[None, :, :]) ** 2).sum(-1).argmin(0)))


def video_means(weekday_only):
    v = {}
    for c in clips:
        if c["point"] not in points or (weekday_only and c["weekday"] == "Sat"):
            continue
        v.setdefault((c["point"], c["slot"]), []).append(float(c["yolo_mean"]))
    return {k: float(np.mean(x)) for k, x in v.items()}


EPS = 0.5  # people per frame added before logs (some clips average < 1)


def ratio_pairs(V):
    """(point, slot_a, slot_b, observed log-ratio) for every pair of slots a point was filmed in."""
    out = []
    for p in P_IDS:
        have = [s for s in SLOTS if (p, s) in V]
        for a, b in itertools.combinations(have, 2):
            out.append((p, a, b, math.log((V[(p, b)] + EPS) / (V[(p, a)] + EPS))))
    return out


def predicted_ratio(D, p, a, b):
    c = cell_of[p]
    return math.log((D[b][c] + 1e-9) / (D[a][c] + 1e-9))


def mae(pairs, D):
    if not pairs:
        return float("nan")
    return float(np.mean([abs(obs - (predicted_ratio(D, p, a, b) if D is not None else 0.0)) for p, a, b, obs in pairs]))


def boot_ci(fn, items, n=4000, seed=7):
    rng = np.random.default_rng(seed)
    pts = sorted({x[0] for x in items})
    vals = []
    for _ in range(n):
        pick = rng.choice(pts, size=len(pts), replace=True)
        sample = [x for p in pick for x in items if x[0] == p]
        v = fn(sample)
        if not math.isnan(v):
            vals.append(v)
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


# ---- calibration search space (small on purpose: few points, avoid over-fitting) ----
BASE_SCHED = CONFIG["sched"]


def make_sched(other_day, other_morning, evening_mall_scale, worker_day):
    s = json.loads(json.dumps(BASE_SCHED))  # deep copy (tuples -> lists)
    s = {tp: {sl: list(v) for sl, v in d.items()} for tp, d in s.items()}
    s["other"]["day"][1] = other_day
    s["other"]["morning"][1] = other_morning
    s["worker"]["day"][1] = worker_day
    for tp in ("worker", "pupil", "student"):
        s[tp]["evening"][1] = min(0.9, BASE_SCHED[tp]["evening"][1] * evening_mall_scale)
    return {tp: {sl: tuple(v) for sl, v in d.items()} for tp, d in s.items()}


GRID = dict(
    beta=[1.0, 1.5, 2.0, 2.5, 3.0],
    other_day=[0.10, 0.25, 0.40, 0.55],
    other_morning=[0.05, 0.15, 0.30],
    evening_mall_scale=[0.5, 1.0, 1.5, 2.0, 3.0],
    worker_day=[0.70, 0.85, 0.95],
)
COMBOS = [dict(zip(GRID, v)) for v in itertools.product(*GRID.values())]
_D_cache = {}


def D_for(th):
    key = tuple(sorted(th.items()))
    if key not in _D_cache:
        _D_cache[key] = expected_D(make_sched(th["other_day"], th["other_morning"], th["evening_mall_scale"], th["worker_day"]), th["beta"])
    return _D_cache[key]


def fit(pairs):
    best = min(COMBOS, key=lambda th: mae(pairs, D_for(th)))
    return best, mae(pairs, D_for(best))


def main():
    base_th = dict(beta=CONFIG["beta"], other_day=BASE_SCHED["other"]["day"][1], other_morning=BASE_SCHED["other"]["morning"][1],
                   evening_mall_scale=1.0, worker_day=BASE_SCHED["worker"]["day"][1])
    D0 = expected_D(BASE_SCHED, CONFIG["beta"])
    rep = dict(points={p: dict(name=points[p]["name"], hex_cell=int(cell_of[p])) for p in P_IDS}, eps=EPS)

    for label, weekday_only in (("weekdays", True), ("all_days", False)):
        V = video_means(weekday_only)
        pairs = ratio_pairs(V)
        r = dict(n_points=len({p for p, *_ in pairs}), n_ratios=len(pairs))
        r["mae_registry"] = mae(pairs, None)
        r["mae_model"] = mae(pairs, D0)
        r["mae_registry_ci"] = boot_ci(lambda s: mae(s, None), pairs)
        r["mae_model_ci"] = boot_ci(lambda s: mae(s, D0), pairs)
        r["improvement_model_vs_registry"] = boot_ci(lambda s: mae(s, None) - mae(s, D0), pairs)
        # direction: does the model get the sign of the change right?
        r["sign_agreement_model"] = float(np.mean([np.sign(obs) == np.sign(predicted_ratio(D0, p, a, b)) for p, a, b, obs in pairs]))
        # cross-sectional (indicative)
        cs = {}
        for s in SLOTS:
            ps = [p for p in P_IDS if (p, s) in V]
            if len(ps) >= 5:
                v = [V[(p, s)] for p in ps]
                cs[s] = dict(n=len(ps), rho_model=float(spearmanr(v, [D0[s][cell_of[p]] for p in ps]).correlation),
                             rho_registry=float(spearmanr(v, [R[cell_of[p]] for p in ps]).correlation))
        r["cross_section"] = cs
        if weekday_only:
            th, loss = fit(pairs)
            r["calibrated_params"] = th
            r["mae_calibrated_in_sample"] = loss
            # leave-one-point-out
            loo = []
            for p in sorted({x[0] for x in pairs}):
                train = [x for x in pairs if x[0] != p]
                test = [x for x in pairs if x[0] == p]
                th_p, _ = fit(train)
                loo.append(dict(point=p, params=th_p, mae_calibrated=mae(test, D_for(th_p)), mae_model=mae(test, D0), mae_registry=mae(test, None)))
            r["loo"] = loo
            r["loo_mae"] = {k: float(np.mean([x[k] for x in loo])) for k in ("mae_calibrated", "mae_model", "mae_registry")}
            r["uncalibrated_params"] = base_th
            r["observed"] = [dict(point=p, a=a, b=b, obs=o, model=predicted_ratio(D0, p, a, b), calibrated=predicted_ratio(D_for(th), p, a, b)) for p, a, b, o in pairs]
        rep[label] = r

    json.dump(rep, open(os.path.join(OUTD, "h2_report.json"), "w"), ensure_ascii=False, indent=1)
    w = rep["weekdays"]
    print(json.dumps({k: w[k] for k in ("n_points", "n_ratios", "mae_registry", "mae_model", "improvement_model_vs_registry", "sign_agreement_model", "cross_section", "calibrated_params", "mae_calibrated_in_sample", "loo_mae")}, ensure_ascii=False, indent=1))
    a = rep["all_days"]
    print("all days:", json.dumps({k: a[k] for k in ("n_ratios", "mae_registry", "mae_model", "improvement_model_vs_registry", "cross_section")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
