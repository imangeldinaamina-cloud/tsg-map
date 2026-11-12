"""
Accuracy of the YOLOv8 people count against the author's manual count.

  python3 research/yolo_error.py manual_counts.csv      (CSV saved by research/manual-count/index.html)

For every frame: YOLO count (from research/video/clips.csv, column yolo_per_frame) vs manual count.
Prints MAE, mean bias (YOLO − manual), relative error of the clip means, per clip and overall,
with a 95 % bootstrap interval over frames. Writes research/out/yolo_error.json.
"""
import csv
import json
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
clips = {r["clip"]: r for r in csv.DictReader(open(os.path.join(HERE, "video", "clips.csv"), encoding="utf-8"))}
manual = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))

rows = []
for m in manual:
    g = re.search(r"_(C\d+)_frame(\d+)", m["file"])
    if not g:
        continue
    clip, n = g.group(1), int(g.group(2))
    per = [int(x) for x in clips[clip]["yolo_per_frame"].split()]
    k = n - 2  # result/ frames start at frame002 (the first frame is skipped by count_people.py)
    if 0 <= k < len(per):
        rows.append(dict(clip=clip, frame=n, yolo=per[k], manual=int(m["manual_count"])))
if not rows:
    sys.exit("No matching frames — check the file names (…_C081_frame005.jpg).")

y = np.array([r["yolo"] for r in rows], float)
h = np.array([r["manual"] for r in rows], float)
rng = np.random.default_rng(1)
boot = [np.mean(np.abs(y[i] - h[i])) for i in (rng.integers(0, len(y), len(y)) for _ in range(4000))]
out = dict(
    frames=len(rows),
    mae=float(np.mean(np.abs(y - h))),
    mae_ci=[float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
    bias=float(np.mean(y - h)),
    rel_error_of_mean=float((y.mean() - h.mean()) / max(h.mean(), 1e-9)),
    per_clip={},
)
for c in sorted({r["clip"] for r in rows}):
    yy = np.array([r["yolo"] for r in rows if r["clip"] == c], float)
    hh = np.array([r["manual"] for r in rows if r["clip"] == c], float)
    out["per_clip"][c] = dict(frames=len(yy), slot=clips[c]["slot"], yolo_mean=float(yy.mean()), manual_mean=float(hh.mean()),
                              mae=float(np.mean(np.abs(yy - hh))), rel_error_of_mean=float((yy.mean() - hh.mean()) / max(hh.mean(), 1e-9)))
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
json.dump(dict(out, frames_detail=rows), open(os.path.join(HERE, "out", "yolo_error.json"), "w"), indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
