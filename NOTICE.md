# Third-party licensing

`hd-chart-engine` is MIT licensed. Its default import path pulls in MIT dependencies only.

One optional import path is copyleft. Read the table before you choose an engine.

## What ships where

| Import path | Dependencies | License consequence |
|---|---|---|
| `hd-chart-engine` | `astronomy-engine` (MIT), `luxon` (MIT) | MIT throughout. Use it in closed-source work. |
| `hd-chart-engine/moshier` | `ephemeris` (**GPL-3.0**) | Importing this path links GPL-3.0 code into your program. Your combined work is then subject to GPL-3.0 terms. |

The two paths are separated at the module level, not by configuration. Nothing reachable from the default entry point imports the `ephemeris` package, and a test in `tests/licensing-boundary.test.ts` fails the build if that ever changes. A bundler following the default path will not include GPL code.

Shipping JavaScript to a browser counts as distribution. If you import the `moshier` path into a web application, the GPL-3.0 obligations apply to the bundle you serve.

## Components

**astronomy-engine** (MIT) by Don Cross. https://github.com/cosinekitty/astronomy

**luxon** (MIT) by the Moment.js contributors. https://github.com/moment/luxon

**ephemeris** (GPL-3.0), a JavaScript port of Stephen Moshier's `aa` ephemeris. https://github.com/hemantgoswami/ephemeris. Optional peer dependency, reachable only via the `moshier` sub-path.

**ΔT polynomials** from Espenak and Meeus, published by NASA and in the public domain. https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html

## Swiss Ephemeris

Swiss Ephemeris is **not** a dependency of this package. It is neither distributed nor linked.

It appears only in the development-time validation harness under `scripts/`, where `pyswisseph` acts as an accuracy oracle that the engines are measured against. Running that harness is optional, requires a separate install, and is not part of building or using the package. The reference longitudes those runs produced are committed as plain numbers in test files, which is measurement data rather than a derived work of the Swiss Ephemeris source.

Swiss Ephemeris is a product of Astrodienst AG, dual licensed under the AGPL and a commercial license. Avoiding a hard dependency on it is the reason this package exists.
