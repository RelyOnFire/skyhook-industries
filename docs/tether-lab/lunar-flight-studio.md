# Lunar Flight Studio

Model `L1p-0.1.0`, design schema 2, architecture `lunar-rotovator`. Route `/lab/lunar/`; static public method `/lab/lunar/method/`. Earth remains `D1p-0.4.0`, `single-stage-rotovator`.

## Scope

Two ideal orbital transfers around a spherical Moon, sharing the planar rigid-body solver with Earth. This is a first orbital lunavator experiment, not a model of the historical reeling/ballast mechanism or surface pickup. No terrain, mascons, Earth/Sun perturbations, Earth–Moon targeting, flexible dynamics or long-term stability prediction. Flight Studio does not validate Expeditions routes.

`environment.ts` supplies explicit per-design constants to gravity, point-particle propagation, energy/orbit diagnostics, clearance, initialization, approach planning and readiness. No mutable global body selection. Earth-facing numerical APIs retain their Earth defaults. Moon E0 configurations are rejected: the Earth dipole/plasma actuator is not transferred to the Moon.

Frozen lunar GM: 4.902800118e12 m³/s² ([JPL DE440](https://ssd.jpl.nasa.gov/astro_par.html)). Mean radius: 1,737,400 m. Display-only sidereal rotation: 655.720 h ([NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)). The 10 km clearance boundary is measured above the mean sphere, not local terrain. Readiness tolerances are scenario choices: 2 km radius error, 2 m/s radial speed, 3 m/s tangential-speed error, 0.5% spin error. The existing 60-second ready hold, independently propagated 90-second approach, capture residuals and six-hour horizon remain in force.

Reference default: 200 km span, 250 km initial altitude, 0.4 km/s initial spin-tip speed, 3 t payload, 50 mm² uniform Zylon, safety factor 2, 10 t fuel, 3,000 N force budget, 320 s Isp, 180° release. Hub 30 t and tips 2 t each are retained scenario budgets. Default dry mass 49.6 t; the reference flight completes twice and spends about 4.87 t of propellant. Those results are controller/scenario outputs, not optimized hardware requirements.

Lunar input envelope: span 40–1,200 km; initial center altitude 80–2,000 km; spin-tip speed 0.1–1.5 km/s. Other validated bounds are shared. Accepted inputs can immediately fail model limits. The low-clearance and overload presets deliberately demonstrate those limits.

Historical context: [Hoyt, Cislunar Tether Transport System (1999)](https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf), III.A.3 and Appendix B. Full surface transfer needs configuration changes, reeling and movable ballast beyond this equal-arm rigid model.

## Experience and compatibility

- Earth/Moon selector, body-specific presets, lunar mission, guided replay, WebGL Moon, orbital-plane view, object tracking, structural inspector, actual worker trade studies and pinned comparisons.
- Moon imagery is a deterministic procedural canvas illustration, not topography. Body radius supplies the rendering scale; the image never enters the solver.
- Model and architecture must agree during imports and shares. Cross-world adoption clears stale results and comparisons before calculation. Changing environments also updates the route and removes the previous world's shared fragment, so refresh stays in the selected experiment. Share URLs use the corresponding route.
- Earth Save/Load retains `skyhook-lab-design-v2` and the existing legacy fallback. Moon uses `skyhook-lab-lunar-design-v1`. Saving one world cannot overwrite the other. Earlier Earth models retain explicit import confirmation.
- Flight reports include the environment constants and limitations. Mission progress retains the existing browser key with a new `lunar-relay` ID.
- The campaign Moon outpost opens “Explore this tether” in a separate tab. No campaign economy, model, schema, time or persistence changes are introduced.

## Validation

`npm run check:lab`, `npm run test:lab`, `npm run build`, and `python3 tests/lab-lunar.browser.py --require-webgl`. CI also retains the complete Earth, E0, campaign and site suites.

Lunar numerical checks cover analytic Kepler orbits, conservation, capture/release energy and angular momentum, whole-segment clearance, independent incoming and outgoing particle propagation, finite-fuel mission success, real failure presets, time-step/quadrature convergence, wrong-world grading, design round trips and invalid model/environment combinations. The existing Earth tests remain authoritative for compatibility.

Browser evidence is written under `qa/browser/lunar/`, exercising actual workers and WebGL, mission failure→success, inspection/studies, body switching, separate storage, imported/shared designs, campaign navigation, reduced motion, responsive layouts and the static public method.
