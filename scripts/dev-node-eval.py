#!/usr/bin/env python3
"""
Dev harness: score Moon + True-Node accuracy against FULL Swiss Ephemeris.

Ground truth is the compressed-JPL-DE Swiss Ephemeris (.se1 files via
FLG_SWIEPH), NOT Moshier. Set EPHE_PATH to the directory holding sepl_18.se1
and semo_18.se1 (download from the Swiss Ephemeris distribution).

For every fixture chart's personality + design moment (same TZ / design-arc
logic as validate-chart.py) it reports abs error (arc-seconds) vs that oracle
for: astronomy-engine (the product engine, via dev-node-methods.ts) and
pyswisseph Moshier (FLG_MOSEPH) — for both the Moon longitude and the True
Node. This answers: which engine is closer to truth, and is there a real error
worth fixing?

Not part of the build. Pairs with dev-node-methods.ts for the True-Node work.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import swisseph as swe

EPHE_PATH = os.environ.get("EPHE_PATH", "/tmp/ephe")
GEOM = swe.FLG_NOABERR | swe.FLG_NOGDEFL  # geometric, match astronomy-engine


def signed_angular_diff(a, b):
    return ((a - b + 540) % 360) - 180


def lon(jd, body, flag):
    pos, _ = swe.calc_ut(jd, body, flag | GEOM)
    return pos[0] % 360


def sun_lon(jd):  # design-arc search uses the truth Sun
    return lon(jd, swe.SUN, swe.FLG_SWIEPH)


def find_design_jd(p_jd):
    target = (sun_lon(p_jd) - 88) % 360
    lo, hi = p_jd - 100, p_jd - 80
    mid = (lo + hi) / 2
    for _ in range(50):
        mid = (lo + hi) / 2
        diff = signed_angular_diff(sun_lon(mid), target)
        if abs(diff) < 1e-5:
            return mid
        if diff > 0:
            hi = mid
        else:
            lo = mid
    return mid


def main():
    swe.set_ephe_path(EPHE_PATH)
    # Confirm the .se1 files are really loaded (FLG_SWIEPH must differ from
    # Moshier), else "ground truth" would silently be Moshier again.
    probe = abs(lon(2451545.0, swe.TRUE_NODE, swe.FLG_SWIEPH)
                - lon(2451545.0, swe.TRUE_NODE, swe.FLG_MOSEPH)) * 3600
    if probe < 0.001:
        sys.exit(f"ERROR: SWIEPH == MOSEPH at J2000 — .se1 files not found in {EPHE_PATH}")
    sys.stderr.write(f"ground truth: full Swiss Ephemeris in {EPHE_PATH} "
                     f"(node SWIEPH-vs-MOSEPH probe @J2000 = {probe:.3f}\")\n")

    fixture = json.loads(Path("tests/fixtures/synthetic-charts.json").read_text())

    # Bodies the TS helper emits a longitude for, mapped to swe ids. "node" is
    # special-cased to swe.TRUE_NODE (the TS key for it is "m0").
    PLANETS = {
        "sun": swe.SUN, "mercury": swe.MERCURY, "venus": swe.VENUS,
        "mars": swe.MARS, "jupiter": swe.JUPITER, "saturn": swe.SATURN,
        "uranus": swe.URANUS, "neptune": swe.NEPTUNE, "pluto": swe.PLUTO,
        "moon": swe.MOON,
    }

    jds = []
    oracle = {}
    for entry in fixture["charts"]:
        local = datetime.fromisoformat(
            f"{entry['date']}T{entry['time']}:00"
        ).replace(tzinfo=ZoneInfo(entry["tz"]))
        utc = local.astimezone(timezone.utc)
        p_jd = swe.julday(
            utc.year, utc.month, utc.day,
            utc.hour + utc.minute / 60 + utc.second / 3600,
        )
        d_jd = find_design_jd(p_jd)
        for jd in (p_jd, d_jd):
            jds.append(jd)
            o = {}
            for name, bid in PLANETS.items():
                o[f"{name}_truth"] = lon(jd, bid, swe.FLG_SWIEPH)
                o[f"{name}_mos"] = lon(jd, bid, swe.FLG_MOSEPH)
            o["node_truth"] = lon(jd, swe.TRUE_NODE, swe.FLG_SWIEPH)
            o["node_mos"] = lon(jd, swe.TRUE_NODE, swe.FLG_MOSEPH)
            oracle[round(jd, 9)] = o

    jd_input = "\n".join(f"{jd:.9f}" for jd in jds)
    proc = subprocess.run(
        ["npx", "tsx", "scripts/dev-node-methods.ts"],
        input=jd_input, capture_output=True, text=True, check=True,
    )

    # body label -> {"astro": [...errs], "moshier": [...errs]} vs full-Swiss truth
    bodies = list(PLANETS.keys()) + ["node"]
    errs = {b: {"astro": [], "moshier": []} for b in bodies}
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        o = oracle[round(row["jd"], 9)]
        for b in bodies:
            astro_val = row["m0"] if b == "node" else row[b]
            errs[b]["astro"].append(abs(signed_angular_diff(astro_val, o[f"{b}_truth"])) * 3600)
            errs[b]["moshier"].append(abs(signed_angular_diff(o[f"{b}_mos"], o[f"{b}_truth"])) * 3600)

    n = len(errs["sun"]["astro"])
    print(f"\nError vs FULL Swiss Ephemeris over {n} moments (arc-seconds):\n")
    print(f"{'body':<9} {'astro_mean':>11} {'astro_max':>10}   {'mos_mean':>9} {'mos_max':>8}")
    print("-" * 54)
    for b in bodies:
        a = sorted(errs[b]["astro"]); m = sorted(errs[b]["moshier"])
        print(f"{b:<9} {sum(a)/len(a):>11.2f} {a[-1]:>10.2f}   "
              f"{sum(m)/len(m):>9.2f} {m[-1]:>8.2f}")
    print("\nTone slice = 93.75\", base slice = 18.75\" (for scale).")


if __name__ == "__main__":
    main()
