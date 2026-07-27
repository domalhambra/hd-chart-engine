#!/usr/bin/env python3
"""
Chart validator: measures an engine against Swiss Ephemeris.

For each fixture chart, runs:
  (a) this package, via `npx tsx scripts/calculate-chart.ts --engine=...`
  (b) an independent pyswisseph pipeline implemented inline below

and compares per-planet (g, l, c, t, b) plus the underlying longitude.

Exits 0 if the selected engine passes its thresholds, nonzero otherwise.

CRITICAL: this script implements its OWN copy of the wheel-start constant,
the slice widths, and the gate sequence. It deliberately does not import
src/wheel.ts. Independence between the two encodings of the HD wheel is the
whole point; sharing them would make this a tautology rather than a test.

Usage:
    python3 scripts/validate-chart.py --engine moshier
    python3 scripts/validate-chart.py --engine astronomy

By default pyswisseph runs in Moshier mode, which is itself a truncated
approximation rather than ground truth. Point EPHE_PATH at the Swiss .se1
data files for a real JPL DE431 oracle:

    EPHE_PATH=/path/to/ephe python3 scripts/validate-chart.py --engine moshier
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import swisseph as swe

# ── Independent constants — deliberately NOT imported from src/wheel.ts. ──
WHEEL_START = 223.25  # 13°15'00" Scorpio
GATE_WIDTH = 5.625
LINE_WIDTH = GATE_WIDTH / 6
COLOR_WIDTH = LINE_WIDTH / 6
TONE_WIDTH = COLOR_WIDTH / 6
BASE_WIDTH = TONE_WIDTH / 5

# Independent gate sequence by wheel position 0..63, from 13°15' Scorpio.
GATE_SEQUENCE = [
    1, 43, 14, 34,  9,  5, 26, 11,   # Heaven
    10, 58, 38, 54, 61, 60, 41, 19,  # Lake
    13, 49, 30, 55, 37, 63, 22, 36,  # Fire
    25, 17, 21, 51, 42,  3, 27, 24,  # Thunder
    2, 23,  8, 20, 16, 35, 45, 12,   # Earth
    15, 52, 39, 53, 62, 56, 31, 33,  # Mountain
    7,  4, 29, 59, 40, 64, 47,  6,   # Water
    46, 18, 48, 57, 32, 50, 28, 44,  # Wind
]
assert len(GATE_SEQUENCE) == 64

PLANET_KEYS = [
    "sun", "earth", "moon", "north_node", "south_node",
    "mercury", "venus", "mars", "jupiter", "saturn",
    "uranus", "neptune", "pluto",
]

PLANET_TO_SWE = {
    "sun": swe.SUN, "moon": swe.MOON, "mercury": swe.MERCURY,
    "venus": swe.VENUS, "mars": swe.MARS, "jupiter": swe.JUPITER,
    "saturn": swe.SATURN, "uranus": swe.URANUS, "neptune": swe.NEPTUNE,
    "pluto": swe.PLUTO,
}

# Per-engine pass thresholds.
#
# The MIT engine is allowed gate and line disagreements ONLY where the two
# longitudes sit within `straddle_arcsec` of each other. At that separation the
# slice boundary provably lies between them, so neither engine is wrong in any
# way a reader would notice. The fixture includes deliberate gate-boundary
# cases (gb-1..gb-6), so demanding zero disagreement there would be demanding
# that two different ephemerides agree to infinite precision.
#
# Direct bodies and the lunar nodes get SEPARATE longitude budgets, because
# they fail for different reasons. A direct-body disagreement means one of the
# two ephemerides is less accurate, and for the patched-Moshier engine that
# number should be sub-arcsecond. A node disagreement is mostly definitional:
# the osculating node is sensitive to how it is derived, and pyswisseph uses a
# refined integrator where this package takes the normal of the Moon's orbital
# plane over a short arc. Those two answers differ by up to ~30" no matter how
# good either Moon model is.
#
# Collapsing both into one budget would mean either failing on a definitional
# difference or setting the direct-body budget so loose that a real accuracy
# regression slips through. So they are split.
NODE_KEYS = {"north_node", "south_node"}

THRESHOLDS = {
    "moshier": {
        "straddle_arcsec": 5.0,
        "max_color_rate": 0.01,
        "max_tone_rate": 0.05,
        "max_body_arcsec": 5.0,
        "max_node_arcsec": 40.0,
    },
    "astronomy": {
        "straddle_arcsec": 30.0,
        "max_color_rate": 0.02,
        "max_tone_rate": 0.10,
        "max_body_arcsec": 30.0,
        "max_node_arcsec": 40.0,
    },
}


def longitude_to_activation(lon_deg):
    lon = lon_deg % 360
    offset = (lon - WHEEL_START) % 360
    wheel_index = int(offset // GATE_WIDTH)
    g = GATE_SEQUENCE[wheel_index]
    line_offset = offset - wheel_index * GATE_WIDTH
    line = int(line_offset // LINE_WIDTH) + 1
    color_offset = line_offset - (line - 1) * LINE_WIDTH
    color = int(color_offset // COLOR_WIDTH) + 1
    tone_offset = color_offset - (color - 1) * COLOR_WIDTH
    tone = int(tone_offset // TONE_WIDTH) + 1
    base_offset = tone_offset - (tone - 1) * TONE_WIDTH
    base = min(5, int(base_offset // BASE_WIDTH) + 1)
    return {"g": g, "l": line, "c": color, "t": tone, "b": base}


def signed_angular_diff(a, b):
    return ((a - b + 540) % 360) - 180


def body_longitude(jd_ut, planet):
    if planet == "earth":
        return (body_longitude(jd_ut, "sun") + 180) % 360
    if planet == "north_node":
        # True Node. Calibrated against Jovian Archive 2026-05-08.
        pos, _ = swe.calc_ut(jd_ut, swe.TRUE_NODE)
        return pos[0] % 360
    if planet == "south_node":
        return (body_longitude(jd_ut, "north_node") + 180) % 360
    # Apparent geocentric longitude (aberration + nutation), which is the HD
    # convention. FLG_SWIEPH uses the full Swiss Ephemeris when EPHE_PATH points
    # at the .se1 files, and falls back to Moshier otherwise.
    pos, _ = swe.calc_ut(jd_ut, PLANET_TO_SWE[planet], swe.FLG_SWIEPH)
    return pos[0] % 360


def find_design_jd(personality_jd):
    target = (body_longitude(personality_jd, "sun") - 88) % 360
    lo, hi = personality_jd - 100, personality_jd - 80
    mid = (lo + hi) / 2
    for _ in range(50):
        mid = (lo + hi) / 2
        diff = signed_angular_diff(body_longitude(mid, "sun"), target)
        if abs(diff) < 1e-5:
            return mid
        if diff > 0:
            hi = mid
        else:
            lo = mid
    return mid


def swiss_pipeline(entry):
    time_str = entry["time"] if entry["time"].count(":") == 2 else entry["time"] + ":00"
    local = datetime.fromisoformat(f"{entry['date']}T{time_str}").replace(
        tzinfo=ZoneInfo(entry["tz"])
    )
    utc = local.astimezone(timezone.utc)
    p_jd = swe.julday(
        utc.year, utc.month, utc.day,
        utc.hour + utc.minute / 60 + utc.second / 3600,
    )
    d_jd = find_design_jd(p_jd)

    out = {"personality": {}, "design": {}}
    for key in PLANET_KEYS:
        for which, jd in (("personality", p_jd), ("design", d_jd)):
            lon = body_longitude(jd, key)
            out[which][key] = {"lon": lon, **longitude_to_activation(lon)}
    return out


def package_pipeline(entry, engine):
    proc = subprocess.run(
        ["npx", "tsx", "scripts/calculate-chart.ts",
         f"--lat={entry['lat']}", f"--lon={entry['lon']}", f"--tz={entry['tz']}",
         f"--date={entry['date']}", f"--time={entry['time']}",
         f"--engine={engine}", "--verbose"],
        capture_output=True, text=True, check=True,
    )
    chart = json.loads(proc.stdout)

    p_lons, d_lons = {}, {}
    section = None
    for line in proc.stderr.splitlines():
        if "Personality longitudes" in line:
            section = "p"
        elif "Design longitudes" in line:
            section = "d"
        elif section and line.strip():
            parts = line.strip().split()
            if len(parts) >= 2 and parts[1].endswith("°"):
                (p_lons if section == "p" else d_lons)[parts[0]] = float(parts[1].rstrip("°"))

    out = {"personality": {}, "design": {}}
    for key in PLANET_KEYS:
        out["personality"][key] = {"lon": p_lons[key], **chart["planets"][key]["p"]}
        out["design"][key] = {"lon": d_lons[key], **chart["planets"][key]["d"]}
    return out


def diff_rows(entry, swiss, pkg):
    rows = []
    for which in ("personality", "design"):
        for key in PLANET_KEYS:
            s, p = swiss[which][key], pkg[which][key]
            rows.append({
                "id": entry["id"], "side": which, "planet": key,
                "lon_diff_arcsec": abs(signed_angular_diff(s["lon"], p["lon"])) * 3600,
                **{f"{f}_match": s[f] == p[f] for f in ("g", "l", "c", "t", "b")},
            })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=["moshier", "astronomy"], default="moshier")
    args = ap.parse_args()
    limits = THRESHOLDS[args.engine]

    fixture = json.loads(Path("tests/fixtures/synthetic-charts.json").read_text())
    ephe_path = os.environ.get("EPHE_PATH", "")
    swe.set_ephe_path(ephe_path)

    err = sys.stderr.write
    err(f"engine: {args.engine}\n")
    err(f"oracle: {'full Swiss Ephemeris (' + ephe_path + ')' if ephe_path else 'pyswisseph Moshier mode (no .se1 files)'}\n\n")

    all_rows = []
    for entry in fixture["charts"]:
        err(f"checking {entry['id']} ({entry['place']}, {entry['date']} {entry['time']}) ... ")
        swiss = swiss_pipeline(entry)
        pkg = package_pipeline(entry, args.engine)
        rows = diff_rows(entry, swiss, pkg)
        all_rows.extend(rows)
        hard = [r for r in rows if not (r["g_match"] and r["l_match"])]
        err(f"{len(hard)} gate/line disagreement(s)\n" if hard else "ok\n")

    n = len(all_rows)
    counts = {f: sum(1 for r in all_rows if not r[f"{f}_match"]) for f in ("g", "l", "c", "t", "b")}
    lons = sorted(r["lon_diff_arcsec"] for r in all_rows)

    body_rows = [r for r in all_rows if r["planet"] not in NODE_KEYS]
    node_rows = [r for r in all_rows if r["planet"] in NODE_KEYS]
    worst_body = max(body_rows, key=lambda r: r["lon_diff_arcsec"])
    worst_node = max(node_rows, key=lambda r: r["lon_diff_arcsec"])

    # A gate/line disagreement is benign if the two longitudes are close enough
    # that the boundary must lie between them.
    non_straddle = [
        r for r in all_rows
        if (not r["g_match"] or not r["l_match"])
        and r["lon_diff_arcsec"] > limits["straddle_arcsec"]
    ]

    err("\n=== Summary ===\n")
    err(f"rows compared:    {n}\n")
    err(f"gate mismatches:  {counts['g']}\n")
    err(f"line mismatches:  {counts['l']}\n")
    err(f"color mismatches: {counts['c']} ({counts['c'] / n * 100:.2f}%)\n")
    err(f"tone mismatches:  {counts['t']} ({counts['t'] / n * 100:.2f}%)\n")
    err(f"base mismatches:  {counts['b']} ({counts['b'] / n * 100:.2f}%)\n")
    err(f"longitude error:  median {lons[len(lons) // 2]:.3f}\" "
        f"p95 {lons[int(len(lons) * 0.95)]:.3f}\" max {lons[-1]:.3f}\"\n")
    err(f"  worst direct body: {worst_body['lon_diff_arcsec']:.3f}\" "
        f"({worst_body['side']} {worst_body['planet']} in {worst_body['id']})\n")
    err(f"  worst node:        {worst_node['lon_diff_arcsec']:.3f}\" "
        f"({worst_node['side']} {worst_node['planet']} in {worst_node['id']}) [definitional]\n")
    err(f"non-straddle gate/line failures: {len(non_straddle)}\n")

    fail = False
    for r in non_straddle:
        fail = True
        err(f"FAIL: {r['id']}/{r['side']}/{r['planet']} disagrees at "
            f"{r['lon_diff_arcsec']:.2f}\", beyond the {limits['straddle_arcsec']}\" straddle budget\n")
    if counts["c"] / n > limits["max_color_rate"]:
        fail = True
        err(f"FAIL: color disagreement rate above {limits['max_color_rate'] * 100:.0f}%\n")
    if counts["t"] / n > limits["max_tone_rate"]:
        fail = True
        err(f"FAIL: tone disagreement rate above {limits['max_tone_rate'] * 100:.0f}%\n")
    if worst_body["lon_diff_arcsec"] > limits["max_body_arcsec"]:
        fail = True
        err(f"FAIL: direct-body longitude error above {limits['max_body_arcsec']}\"\n")
    if worst_node["lon_diff_arcsec"] > limits["max_node_arcsec"]:
        fail = True
        err(f"FAIL: node longitude error above {limits['max_node_arcsec']}\"\n")

    err("\nRESULT: " + ("FAIL\n" if fail else "PASS\n"))
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
