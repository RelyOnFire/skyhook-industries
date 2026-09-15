# Component selection and Reset view correction

Scope: repair the homepage terminal explainer on `brand-heritage-motion` (PR #12).
Start from the current reviewed head `b346844`, not from the unfinished geometry
experiment tree. No simulation, saved-design schema or deployment configuration
is changed. Asymmetric geometry / elliptical-orbit work remains a separate stage.

## Owner-reported issues

The earlier component buttons changed prose and an emissive accent, but retained
the whole assembly in all three views. Reset restored camera orientation but left
component selection and exploded spacing active. The prior browser suite clicked
Reset without verifying its resulting state, and checked component text rather
than distinct rendered geometry. Passing that suite did not establish either of
the behaviors the owner reasonably expected.

## Revised behavior

- Start with a clearly labeled Whole assembly view and overview explanation.
- Selecting a component isolates that actual Three.js group, fits the camera to
  its bounds and shows only its explanation. The SVG fallback isolates and
  reframes the same named component. No third-party mesh is substituted.
- Assembled/Exploded view returns to the whole machine. Whole assembly returns
  from inspection while preserving the chosen assembled/exploded arrangement.
- Reset view stops rotation, clears component selection, closes exploded spacing,
  restores the model's orientation and fits the camera to the assembled model.
  Repeating Reset is idempotent. Reset also works during a transition and in the
  static fallback.
- Reduced-motion behavior, keyboard activation and no-JavaScript explanations
  remain available. Idle rendering stops, without scheduling duplicate frames
  from OrbitControls change events emitted inside a render.

## Verification

The native brand/motion suite now compares all three component canvas images,
not only the labels. At 320, 390, 768, 1280 and 1440 pixels it tests component
isolation, real pointer orbit, exact camera restoration and rendered-pixel
restoration after Reset. Pixel checks decode PNGs and allow one pixel of element
clip rounding; they retain strict image-difference limits. Initial and reset
canvas images are saved for review.
It also tests active rotation and mid-transition Reset, repeated Reset, and the
no-WebGL fallback. The existing four application/site suites remain unchanged.

Local TypeScript and build checks use the available cached runtime (Astro 7.2.2).
The repository retains pinned Astro 7.2.8; GitHub's clean install/build and native
browser run are authoritative for that dependency set. Local native browser
navigation is blocked in this environment, so it is not reported as passing.
Final commit and CI evidence are recorded in PR #12 after the run completes.

The first native run passed the 1440/1280/768 px resets but rejected a 390 px
PNG-byte comparison although the exact camera check passed. Comparing the saved
full-section images showed zero canvas-pixel difference. The assertion now
checks decoded image pixels rather than PNG encoding/clip boundaries, without
weakening the exact camera or visible-component assertions.
