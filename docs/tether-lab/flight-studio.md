# Flight Studio experience pass

Status: draft PR review; existing Cloudflare main and GoDaddy websites remain unchanged.
Numerical model: D1p-0.2.0 / schema 2. This pass does not add a second, simplified arcade solver.

## Experience

- Three explicit, reproducible challenges: make the second delivery, carry two 5 t payloads below a 100 t dry facility, and deliver twice within a 12 t loaded propellant budget.
- Guided, paused replay at actual calculated capture, release and readiness events.
- Full-run debrief distinguishes clearance cutoff, stress exceedance, compression, failed release, exhausted fuel, incomplete recovery and completion. Suggestions are experiments, not guaranteed remedies.
- Pin a calculated flight and retain it across edits. Restore its exact design and replay without rerunning. Full-run comparisons identify changed inputs and do not imply equal mission output.
- Actual sequential browser-worker trade studies for recovery, material, release phase and payload. Cancellable; no hidden resizing; model failures remain visible.
- A section inspector reads the exact axial-load cuts used by the stop condition. The engine change extracts those measurements; the equations and model version are unchanged.
- Globe, orbital-plane, payload-follow and structure views. Real trajectory labels and velocity vectors. Enlarged markers and illustrative Earth styling are labeled. Expanded view exits with Escape.
- Portable JSON flight reports are separate from bounded importable design JSON.

## Challenge contract

A pass requires the challenge’s stated fixed inputs and editable field set; a reviewed fiber-data profile, not hypothetical carbon; exactly two higher-energy deliveries with perigee at or above the 120 km cutoff and bound apogee >= 8,000 km; the stated dry mass and initially loaded propellant limits; and no modeled structural/clearance failure. The propellant budget is not reset or automatically increased. Mission progress is local and not tamper-resistant.

Tests include failing starting designs and passing solutions, to establish that challenges are reachable rather than cosmetic. Those tests do not establish flight feasibility.

## Verification commands

```sh
npm run test:lab
npm run check:lab
npm run build
python3 -m pip install playwright==1.55.0
python3 -m playwright install --with-deps chromium
python3 tests/lab-flight-studio.browser.py --require-webgl
```

The browser suite serves the production build from localhost with native module workers and the actual WebGL2 scene. It checks pointer camera control, camera buttons, guided events, structural inspection, debrief export, a challenge through failure and completion, worker trade studies and cancellation, pinned comparison, payload-range regression, Coast controls, Save/Load, share-URL reload, local mission progress, six viewport sizes, modal keyboard behavior and the Method/catalogue routes. Results and screenshots are emitted under `qa/browser/`.

An optional `--isolated --executable /usr/bin/chromium` mode is provided for offline environments that cannot navigate a local server. This mode uses local asset fulfillment and unchanged compiled worker bytes in a Blob worker; it is explicitly NOT native-origin or WebGL certification. It cannot be combined with `--require-webgl`.

## Still outside this model

Electrodynamic recovery, independently planned return traffic, asymmetric/multi-tier dynamics (including T4), eccentric initial orbits, atmospheric ascent/capture guidance, elasticity, fatigue, debris/sever propagation and lunar/solar-system targeting are not implemented. Catalogue sketches remain reference-only. Adding cosmetic dropdown entries would misrepresent the model.

## Maintenance

The challenge evaluator and debrief interpretation live in `src/simulation/insights.ts`; they consume solver results. Changes to grading criteria should update the regression suite. Model changes require numerical review, not simply regenerating expected output. Display-only timing, camera behavior and derived explanations must never mutate a flight’s design or samples.
