"""Property-based checks of the TSG formula on random data (10 000 cities)."""
import numpy as np
def tsg(D, S):
    a, b = D / D.sum(), S / S.sum()
    return (a - b) / (a + b)
rng = np.random.default_rng(0)
fails = dict(bounded=0, antisym=0, scale=0, monotone=0, ratio=0)
for _ in range(10_000):
    n = rng.integers(5, 400)
    D = rng.gamma(1.0, 100, n) + 1e-9; S = rng.gamma(0.5, 3, n) + 1e-9
    t = tsg(D, S)
    fails['bounded'] += int(np.any(np.abs(t) > 1 + 1e-12))
    fails['antisym'] += int(not np.allclose(tsg(S, D), -t))
    lam, mu = rng.uniform(0.01, 100, 2)
    fails['scale'] += int(not np.allclose(tsg(lam * D, mu * S), t))
    i = rng.integers(n); D2 = D.copy(); D2[i] *= 1.5   # more people in cell i
    a_old, a_new = D[i] / D.sum(), D2[i] / D2.sum()
    b = S[i] / S.sum()
    fails['monotone'] += int(((a_new - b) / (a_new + b)) < ((a_old - b) / (a_old + b)) - 1e-12)
    rho = (D / D.sum()) / (S / S.sum())
    fails['ratio'] += int(not np.allclose((rho - 1) / (rho + 1), t))
print('10 000 random cities, failures per property:', fails)
