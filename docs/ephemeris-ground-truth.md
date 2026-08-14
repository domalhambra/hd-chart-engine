# Ephemeris Ground-Truth Investigation

Date: 2026-06-20

> **Read this first (added 2026-07-27 during extraction).**
>
> This report was written inside the Plateworks HD site, when there was exactly
> one engine and "the production engine" meant whichever one had most recently
> been swapped in. This package now ships two, so read every mention of "the
> production engine" against the timeline: sections up to the 2026-06-21 swap
> describe `astronomy-engine`, and everything after describes patched-Moshier
> (`src/ephemeris/moshier.ts`).
>
> Two of its conclusions have been superseded by measurement in this repo:
>
> 1. **The per-body table in "Finding 2" understates `astronomy-engine`.** Those
>    figures were measured on GEOMETRIC longitudes. On the apparent convention
>    the same engine measures far better: at JD 2447956.5 its Moon is 0.14″ from
>    Swiss, not the 12.61″ mean the table implies. The MIT engine in this
>    package is apparent, so do not quote that table for it. Quote the README.
> 2. **"There is no drop-in JS Moshier swap" was true and then stopped being
>    true.** The next section resolves it: the ~48 s error is a UT-vs-TT time
>    base, and feeding the package instant + ΔT fixes it. That fix is the
>    engine this package ships.
>
> What stands, and is the reason this document is worth keeping: the ΔT
> diagnosis, the apparent-versus-geometric resolution, and the finding that the
> node derivation is not the source of node error.

## Question

The chart calculator uses `astronomy-engine` (pure-JS, bundled client-side).
Cross-engine validation (`docs/reference/chart-validation-report.md`) flagged
the True Lunar Node as the noisiest body and attributed it to the node
*derivation* (`L = r × v` vs "a refined integrator"). This investigation asked
two things:

1. Is the node error really a derivation problem we can fix in pure JS?
2. Against actual ground truth, how accurate is `astronomy-engine` per body,
   and is there a real accuracy gap worth closing?

The original validator uses pyswisseph in **Moshier mode** (`set_ephe_path("")`,
no data files), which is itself a truncated approximation — not ground truth.

## Method

- **Ground truth:** full Swiss Ephemeris (compressed JPL DE431) via the `.se1`
  data files (`sepl_18.se1`, `semo_18.se1`) and `FLG_SWIEPH`. Geometric
  longitudes (`FLG_NOABERR | FLG_NOGDEFL`) to match the production convention.
  Files are from the Swiss Ephemeris distribution; not committed (1.8 MB
  binary). Point the harness at them with `EPHE_PATH`.
- **Moments:** personality + design for all 30 fixture charts (60 moments),
  same TZ / design-arc logic as `validate-chart.py`.
- **Harness:** `scripts/dev-node-methods.ts` (astronomy-engine longitudes) +
  `scripts/dev-node-eval.py` (Swiss oracle + scoring). Reproduce with:
  ```bash
  EPHE_PATH=/path/to/ephe python3 scripts/dev-node-eval.py
  ```

## Finding 1 — the node derivation is not the problem

Three node derivations were compared: production `L = r × v` from
`GeoMoonState`, central finite-difference velocity (δ from 0.0001 to 0.05 d),
and arc-normal `r(t−δ) × r(t+δ)`. **All produced identical node longitudes to
<0.05″** across the 60 moments. `GeoMoonState`'s velocity is already excellent;
there is no precision to recover in the derivation. The variants were removed
from the harness.

## Finding 2 — per-body accuracy vs full Swiss Ephemeris

Absolute error in arc-seconds over 60 moments (tone slice = 93.75″, base slice
= 18.75″ for scale):

| body    | astro mean | astro max | Moshier mean | Moshier max |
|---------|-----------:|----------:|-------------:|------------:|
| sun     |       0.52 |      2.12 |         0.02 |        0.06 |
| mercury |       1.87 |      6.20 |         0.02 |        0.06 |
| venus   |       1.53 |      7.96 |         0.06 |        0.43 |
| mars    |       1.63 |     10.53 |         0.09 |        1.08 |
| jupiter |       2.44 |      7.25 |         0.14 |        0.36 |
| saturn  |       3.14 |     11.13 |         0.15 |        0.52 |
| uranus  |       5.20 |     12.11 |         0.19 |        0.47 |
| neptune |       9.92 |     17.12 |         0.14 |        0.27 |
| pluto   |       2.06 |      3.23 |         0.31 |        0.74 |
| moon    |      12.61 |     21.93 |         0.66 |        2.00 |
| node    |       4.10 |     11.78 |        10.03 |       32.45 |

## Conclusions

1. **Moshier is the more accurate engine for every direct body** — sub-arcsecond
   across the board, vs astronomy-engine's 0.5″ (Sun) to ~12–22″ (Moon).
2. **astronomy-engine's Moon is its single largest real error** (~12–22″),
   followed by Neptune (~10–17″) and Uranus (~5–12″). Its Sun is excellent
   (<2.1″), so type / profile / authority / the design arc are unaffected.
3. **The node is the one place astronomy-engine beats Moshier** (4.1″ vs 10″
   mean). A Moon *longitude* error is largely along-track and barely tips the
   orbital plane that fixes the node, so the osculating node tolerates it. The
   earlier report's "derivation differs" framing was misleading: it is the Moon
   *model* that differs, and the osculating node is genuinely
   definition-sensitive across ephemerides.
4. **Materiality is marginal.** astronomy-engine's worst error (~22″, Moon) is
   ~23% of a tone slice and ~1.2 base slices. Gate (20250″), line (3375″), and
   color (562.5″) are never affected; only tone (rarely, near boundaries) and
   base (which is birth-time-limited regardless and already shown as an
   estimate). Everything is well within the validator's 60″ longitude bound.

## Spike: is a pure-JS Moshier swap a drop-in win? (No)

The obvious next step would be swapping astronomy-engine for a pure-JS
Moshier/analytic ephemeris. We spiked the most direct candidate, the `ephemeris`
npm package (a JS port of Moshier's `aa`), measured apparent-vs-apparent against
the full Swiss oracle over the same 60 moments:

| body | mean | max |   | body | mean | max |
|------|-----:|----:|---|------|-----:|----:|
| sun     | 1.96 | 2.77 | | jupiter | 0.29 | 0.84 |
| moon    | **25.93** | **39.56** | | saturn  | 0.34 | 0.76 |
| mercury | 2.42 | 5.41 | | uranus  | 0.17 | 0.45 |
| venus   | 1.90 | 3.40 | | neptune | 0.16 | 0.38 |
| mars    | 1.16 | 2.22 | | pluto   | 1.29 | 2.83 |

**The candidate's Moon (26″/40″) is *worse* than astronomy-engine's (13″/22″)** —
the opposite of what we wanted. The Sun (1.96″) and Moon (25.93″) errors sit in
a ~13× ratio, exactly the Sun/Moon angular-speed ratio: 1.96″ ÷ 0.041″/s ≈ 48 s,
and 48 s × 0.549″/s ≈ 26″. That points to a **~48-second time-base error**
(ΔT / UT-vs-TT handling) in the package, not the underlying Moshier theory. The
package is also apparent-first, so matching the HD geometric (no-aberration)
convention would mean unwinding aberration + nutation on top of fixing the time
base. Bundle: ~400 KB unminified JS (similar order to astronomy-engine).

Conclusion: there is **no drop-in JS Moshier swap**. Getting real sub-arcsecond
accuracy in the browser would require either correcting a third-party package's
time-base + convention handling and re-validating, or porting Moshier/ELP series
from scratch — real engineering, not a swap.

## Engine-selection spike (2026-06-20): a sub-arcsecond JS path exists

Revisited once it was clear that **for a to-the-second birth time the ephemeris,
not the birth time, becomes the limiter on base** (a base slice is 18.75″, and
astronomy-engine's Moon is 12–22″ off — more than a full slice). Two candidates,
both measured through the harness over the 60 fixture moments.

**1. The `ephemeris` time-base bug is a one-line fix.** The ~48 s error is the
package treating the input instant as TT instead of UT. Feeding it the instant
**+ ΔT** collapses the error:

| variant | Moon mean | Moon max | Sun mean | Sun max |
|---------|----------:|---------:|---------:|--------:|
| as-is   |     25.93 |    39.56 |     1.96 |    2.77 |
| **+ ΔT**|  **0.27** | **0.73** | **0.02** | **0.06**|
| − ΔT    |     51.76 |    79.11 |     3.90 |    5.45 |

Full profile, patched-`ephemeris` (+ ΔT) vs Swiss over 60 moments — **every body
sub-arcsecond except Pluto, which is still ~2.9″ max (~15% of a base slice):**

| body | mean | max |   | body | mean | max |
|------|-----:|----:|---|------|-----:|----:|
| sun     | 0.02 | 0.06 | | jupiter | 0.15 | 0.45 |
| moon    | 0.27 | 0.73 | | saturn  | 0.28 | 0.61 |
| mercury | 0.13 | 0.46 | | uranus  | 0.17 | 0.47 |
| venus   | 0.14 | 0.77 | | neptune | 0.16 | 0.39 |
| mars    | 0.20 | 1.68 | | pluto   | 1.28 | 2.89 |

**2. `astronomia` is disqualified for base.** Its only lunar module is Meeus's
abridged ELP; properly time-based and nutation-corrected it still gives the Moon
at **12.47″ mean / 26.77″ max** — no better than astronomy-engine. Its VSOP87
planets would be excellent, but the Moon is the body we need and it is the weak
point.

**Winner: patched-`ephemeris` (Moshier).** Bundle ~212 KB gzipped (vs
astronomy-engine 108 KB); ~+100 KB net if astronomy-engine is fully replaced.

### Two caveats that gate asserting base (not the engine choice)

1. **The + ΔT input shift is a workaround around a package bug**, not a clean
   API. Production should fork/patch the package (or vendor a focused Moshier)
   and lock the accuracy with a regression test against these numbers, so an
   upstream change can't silently reintroduce the 26″ error.
2. **Apparent vs geometric convention is unresolved at base resolution.** These
   numbers are apparent-vs-apparent. Production uses *geometric* (no-aberration);
   aberration is ~20.5″ ≈ **1.1 base slices**. That difference is invisible at
   the gate/line/color resolution where the calculator was calibrated against
   Jovian Archive, so we do **not** actually know which convention Jovian uses
   for base. Asserting base requires resolving this against a base-resolution
   reference first.

## Implication / recommendation

- **Gate / line / color: already correct** — no change needed at any birth-time
  precision.
- **Tone / base with a to-the-second birth time: a sub-arcsecond pure-JS engine
  is achievable** (patched-Moshier), client-side, ~+100 KB. This unblocks
  asserting base *for the minority of users who truly know their time to the
  second* — gated on a precision-aware confidence model and on resolving the
  aberration-convention question above.
- **Base with a to-the-minute birth time stays an estimate** regardless of
  engine: one minute ≈ 33″ of Moon motion ≈ 1.8 base slices.

## Implemented (2026-06-21): Moshier engine swap

The production ephemeris was swapped from astronomy-engine to the patched-Moshier
engine (`src/ephemeris/moshier.ts`, `src/ephemeris/delta-t.ts`):

- **Time base:** ΔT via Espenak–Meeus polynomials (`delta-t.ts`); the package is
  fed instant + ΔT. Matches Swiss ΔT to <0.5 s across the era.
- **Convention: kept geometric.** Rather than ship the package's apparent
  longitude (which flipped 2 of 104 fixture *lines* at boundaries — an
  unacceptable change to asserted output on an unresolved question), we subtract
  annual aberration (Meeus Ch. 23) to recover geometric, matching the prior
  engine exactly. Result: **zero gate/line drift** vs the old frozen fixtures.
- **Node:** derived from the Moon's apparent direction over a short arc (tracks
  Swiss TRUE_NODE to ~3″; aberration-correcting the node rotates the plane and
  regresses it, so the node path stays apparent).

Validated against full Swiss Ephemeris (geometric) over the 30-chart fixture:

| metric | old (astronomy-engine) | new (Moshier) |
|---|---|---|
| gate / line / color mismatches | 0 / 0 / 0.4% | **0 / 0 / 0%** |
| tone mismatches | 3.7–6% | **0.4%** |
| base mismatches | 17.2% | **0.8%** |
| max longitude error | 33.9″ | **3.0″** (node) |

Base improved ~21×; every direct body is now sub-arcsecond. A regression test
(`ephemeris-moshier.test.ts`) pins the engine to Swiss reference values at <3″ so
an upstream package change can't silently reintroduce the time-base error.

**Base is still not asserted as correct** (at the time of the swap). The accuracy
ceiling is no longer the ephemeris, but (a) the apparent-vs-geometric convention
was unresolved at base resolution and (b) base needs a to-the-second birth time.
Item (a) was resolved later the same day — see "Convention resolved" below.

## Precision-aware confidence (2026-06-21)

With the ephemeris no longer the limiter, the birth *time* is. The birth-data
form now takes an optional **seconds** field (`BirthDataForm.svelte`); a seconds
component in the stored time marks the chart as second-precision
(`birthTimePrecision`, persisted via `chartTimePrecisionStore` in lockstep with
the chart). The per-planet readout (`PlanetChartIndicator.svelte`) reads that
precision and grades the sub-line layers accordingly:

- **second** precision → color, tone, base all shown as reliable;
- **minute** (typical) → color + tone reliable, **base shown as an estimate**
  (one minute ≈ 1.8 base slices of Moon motion);
- **unknown** time → all three estimates.

Base is surfaced; whether it is *asserted* as correct hinged on the
apparent-vs-geometric convention, resolved next.

## Convention resolved → apparent (2026-06-21)

Settled empirically with `scripts/dev-convention-compare.ts`, which prints a
chart's color/tone/base under both conventions. For the **Pensacola
1993-10-18 01:30** chart (the repo's True-Node calibration chart), the two
conventions put the Personality Sun at the same gate·line·color·tone (32.5.3.4)
but different base: **geometric 3, apparent 2**. Jovian Archive reports **base
2** → **HD uses apparent positions** (consistent with Swiss Ephemeris's default
and astrology convention generally).

The production engine was switched to apparent (`computeBodyLongitudes`'
`convention` now defaults to `'apparent'`; the design-arc Sun and the node were
already apparent). Consequences:

- This also **corrects 2 of 104 fixture lines** the geometric engine had on the
  wrong side of a boundary — the old engine was not just imprecise on base but
  wrong on those lines.
- Re-validated vs Swiss **apparent**: gate/line/color 0/0/0, tone 0.3%, base
  1.9%, max 3.0″. Regression test and frozen fixtures updated to apparent.
- `convention: 'geometric'` is retained for the comparison harness.

**Base is now asserted.** With apparent confirmed and the engine sub-arcsecond,
a to-the-second birth time yields a trustworthy base; the confidence model shows
it as reliable in that case (and an estimate otherwise, which is a birth-time
limit, not an ephemeris one).
