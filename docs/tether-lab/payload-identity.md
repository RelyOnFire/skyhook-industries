# Persistent shipments and checked approaches — model 0.3

This pass follows the Flight Studio (`9625097`). It fixes the ambiguity between a
facility recovering its orbit/spin and a payload being recaptured. It does not
add return traffic, electrodynamic propulsion, ascent, guidance or T4 dynamics.

## Physical timeline

1. Payload 1 has a 90-second constructed, independently propagated approach.
2. Position and velocity residuals are checked at the working tip. Accepted
   captures retain the existing ideal matched-attachment accounting.
3. Payload 1 is released and remains on its independent two-body trajectory.
4. Facility readiness means the orbit/spin tolerances held for 60 seconds. It
   is not a payload capture. A coast forecast checks the next lower radial pass.
5. A passing forecast defines a separate Payload 2 meeting state. Integrating
   that particle backward constructs the beginning of an approach window (up to
   90 seconds). Once that window starts, the particle is propagated independently
   forward; it is not dragged along an animation path or inserted at the tip.
6. The second capture checks position/velocity residuals AND facility readiness.
   Failed checks do not attach the shipment. Payload 1 is never reused as Payload 2.

The forecast uses the same rigid-body gravity equations, time-step limit, mass
quadrature, event bracketing and environmental/load cutoffs as the main mission.
The numeric acceptance tolerances are 2 m and 0.02 m/s. They test these ideal
constructed examples; they are NOT requirements or validated tolerances for real
capture hardware or navigation. The inbound orbit before the recorded approach
window, vehicle guidance, launch and mission logistics are outside scope.

In the baseline experiment the earlier nominal mission outcome and fuel bill
are retained, but the second approach is now independently present and checked.
An earlier readiness window fails the coast forecast; no second shipment is
scheduled for that window. This is not hidden by an automatic reset.

## Presentation contract

- Facility: cyan; Payload 1: orange circle; Payload 2: violet diamond.
- Numbered identity and palette are shared by both renderers and the object list.
- Selection persists across capture, release and scrubbing. Follow never chooses
  the latest shipment implicitly. An absent selection follows no substitute.
- Both WebGL and the Canvas fallback support Follow. Approaching/attached payloads
  get a closer default view; symbolic marker sizes remain display aids.
- World labels avoid one another and the scene's top/bottom controls. The object
  list remains available when an annotation is hidden or behind Earth.
- Pre-event and post-event frames prevent interpolation across attachment states.
- Flight reports include approach initial states, times and numerical residuals.

## Versioning

The design schema remains 2; the model is `D1p-0.3.0`. Version 0.2 imports require
explicit confirmation and a fresh calculation. Version 0.1 migration retains its
warning about removing unused propellant from Coast. No previous result is
silently relabeled as a new-model result.

## Verification

`npm run test:lab` includes 31 tests: existing conservation, convergence, challenge
and configuration tests plus both independent approaches, capture rejection,
no second shipment in Coast, stable identities, continuous event replay and
explicit 0.2 migration. `npm run check:lab` checks renderer/application types.

`tests/lab-flight-studio.browser.py` exercises the production build, real workers,
mission/debrief/trade workflows, expanded payload regressions, both object
identities and selected-target persistence through Payload 2's approach/capture.
In native WebGL mode it additionally checks the actual camera-target residual
against the selected object's position and nonoverlapping world labels.

Local browser navigation can be restricted; `--isolated` is a component-review
fallback and is NOT native-origin verification. CI runs the normal localhost
mode with `--require-webgl` and uploads `qa/browser/` as evidence. See the PR
checks and comments for the verified commit and the exact CI result.
