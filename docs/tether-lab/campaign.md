# Expeditions: first persistent campaign

Route: `/lab/campaign/`. Public method: `/lab/campaign/method/`.

## Playable scope

The first chapter is an individual, locally saved Earth–Moon–Phobos logistics
campaign. Supply construction cargo by tug, commission a lunar lunavator and a
Phobos-anchored hub, open return routes, then upgrade a remote facility. Tether
capacity is limited by both endpoints. Resources and active cargo persist across
reloads; cargo arrives once. Supply allocations prevent economic dead ends.

The Moon is a first-class destination. Its lunavator is a free lunar rotor, not
a surface anchor. Phobos is the central anchor for inward and outward tethers,
not a reskinned free rotor. Both are distinct from the Earth workbench solver.

## Model boundary

`src/campaign/model.ts` is pure simulation state and commands. Coast durations
use ideal circular Hohmann half-ellipse periods. Earth–Moon uses an Earth-centered
departure at 1,600 km altitude and lunar mean distance; Earth–Phobos uses an
Earth–Mars heliocentric transfer with a separate handling allowance. This does
not solve launch windows, Phobos interception, capture, surface pickup, elastic
dynamics, or loads. Reverse corridors use the same ideal coast duration.

Construction costs, immediate build, 10/20/30 t capacity tiers, per-tonne support
fuel allocations, a 60% tether-service allocation discount, handling days and
2/tier-day endpoint reservations are explicit game assumptions. Support fuel is
a pooled service budget, not an integrated propellant prediction. The game does
not import a successful Earth design and pretend it proves a lunar/Mars route.
The existing 50 physics tests and architecture catalogue remain authoritative
for what the detailed Flight Studio can simulate.

The map is a schematic network, not an orbital plot. Cargo marker position is
elapsed fraction along a diagram edge. Time advances on user commands only;
there is no interval, idle production or requirement to keep a tab open.

## Saves

IndexedDB `skyhook-campaigns`, database version 1; `worlds` object store, keyed
by campaign UUID. Save envelope `skyhook-campaign` version 1; campaign schema 1,
model `network-0.1.0`. The pure validator constructs clean state from bounded
fields, validates routes and flight timing, and rejects unknown versions.

Each atomic transaction writes the new head plus three preceding checkpoints.
Writes compare the persisted revision with the writer's expected revision, so
a stale tab cannot overwrite newer progress. New slots require a missing ID.
Imports and checkpoint recovery use a fresh ID and revision zero. Up to twelve
slots are supported. Failed writes leave the previous committed world intact;
the UI retains the unsaved in-memory world for retry or export and reports the
failure. Local storage is not advertised as a cloud backup. Saves on different
preview/production origins are separate; portable JSON is the bridge.

Data retained: named campaign, simulation day, revision, depot cargo, facility
tiers/recovery, support fuel, next supply availability, active shipments, received
and sent totals, lunar return progress, and the last sixty event-log entries.

## Verification

`tests/lab-campaign.test.mjs`: complete construction/return/Phobos progression,
cargo conservation and one-time credit, independent step size, expected physical
time scales, invalid actions, capacity/recovery, empty-economy recovery, hostile
save bounds and versions, and distinguishing lunar from Phobos return progress.

`tests/campaign.browser.py`: native-origin IndexedDB, reload during a flight,
all four objectives, portable export/import, failed-version nonmutation, checkpoint
branching, competing tabs, injected write failure and retry, five viewport sizes,
and a JavaScript-independent method guide. Runs after the existing browser suites
in GitHub Actions; output is included in `browser-qa/campaign`.

## Later chapters

Mercury mining, material processing, launching mirror/collector populations and
solar swarm expansion are recorded as future chapters, not enabled features.
Detailed lunavator geometry, Phobos anchor/tether loads, ephemeris-based windows,
route targeting, and integration of tested Flight Studio designs are separate
follow-on simulation work. Cloud saves require a later account/synchronisation
layer; the portable world format does not depend on it.

## Sources

- Hoyt, *Cislunar Tether Transport System*, 1999 NIAC Phase I final report,
  section III.A.3 and Appendix B:
  https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf
- Weinstein, *Space Colonization Using Space-Elevators from Phobos*, 2003:
  https://ntrs.nasa.gov/citations/20030065879
- JPL astrodynamic constants and approximate elements:
  https://ssd.jpl.nasa.gov/astro_par.html
  https://ssd.jpl.nasa.gov/planets/approx_pos.html
- Browser database/persistence:
  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
