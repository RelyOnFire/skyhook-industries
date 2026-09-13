# Operations: finite service and inbound momentum exchange

Model: **OPS-0.1.0**, plan schema 1, shared dynamics **D1p-0.4.0**.
Review extension to PR #9. No deployment/domain change is part of this work.
Route: `/lab/operations/`; public guide: `/lab/operations/method/`.

## Product boundary

This is a continuous, finite-traffic experiment, not proof of an indefinitely
sustainable service. It supports 1–20 distinct shipments over 0.25–24 simulated
hours, subject to the existing rigid-body model cutoffs. The integration does
not stop at delivery two and does not reset orbit, spin, fuel or stored energy.
When the finite queue is exhausted, the facility is still observed until the
chosen horizon (unless a physical-model limit stops the run).

The existing two-delivery Flight Studio is deliberately unchanged. OPS uses its
mass distribution, gravity, loads, electrical model and controller, but owns a
separate scheduler, result contract and variable-size shipment renderer. The
small homepage entry is outside the existing absolutely positioned hero, so it
does not recreate the old paragraph/annotation overlap.

## What is actually fixed

Both modes accept a finite, ordered manifest with immutable IDs and masses.
The generator is an explicit editing action only. It never replenishes traffic.

**Capacity experiment:** the queue is ready to be served as opportunities occur.
Its entered appointment times are ignored. This is one scheduler's available
service, not a computed optimum or a promised cadence.

**Fixed-window experiment:** each appointment is a capture-window center ± the
chosen half-width, set BEFORE integration. The scheduler cannot move a missed
appointment to a later pass. Queued windows expire even while another payload
is attached. Head-of-queue blocking is possible; it is not a global optimizer.

Crucially, fixed appointments do NOT imply pre-existing incoming orbit solutions.
For each reserved pass the model constructs a particle by back-propagating from
the predicted tip state, then independently propagates it forward for a full
90-second approach. Capture checks both position and velocity. The outbound
encounter also rechecks readiness. These remain ideal matched encounters, not
rocket launch, autonomous guidance or navigation demonstrations. The numerical
2 m / 0.02 m/s residual limits are not hardware requirements.

Planning is attempted on a deterministic 60-second clock and when the outbound
readiness hold first reaches 60 seconds. Outbound pickups seek a lower radial
pass; inbound pickups seek an upper one. Reserved forecasts coast without
reboost, and no propulsion is applied while a payload is attached. As in the
prior example, the first supplied encounter starts near the circular reference.

Inbound pickups need not wait for the original operating state to be restored:
the point is to exchange momentum with a depleted facility. Nevertheless the
actual trajectory is checked against the same material, tension and clearance
limits. Structural and clearance extrema are updated at every accepted step,
not just the downsampled replay frames. Limit crossings split the step.

## Inbound transfers are physical, not credits

Each attached payload has its own mass and contributes to the combined center
of mass, inertia, gravity and loading. Release uses its actual position and
velocity. The full signed energy and angular-momentum changes are recorded:

```
ΔE_payload = m (ε_release − ε_capture)
ΔH_payload = m (h_release − h_capture)
```

A successful outbound delivery must gain energy, stay bound with perigee at or
above 120 km and meet the selected minimum apogee. A successful inbound return
must lose energy, stay bound above the same perigee floor and meet the selected
maximum apogee. Escape is not a bound destination. Incorrect destinations remain
failed rows, but the physical transfer and its effects are NEVER erased.

The inbound example is a separate object, not the recapture of an earlier
outbound load. Rejected encounters remain flybys; they are not called releases.
Outside the 120 km particle cutoff, the model does not invent an atmospheric
trajectory. These cutoff markers are not navigable spacecraft or successful
surface deliveries.

Chemical or E0 assistance can be combined with finite incoming traffic. The
`after-return` policy defers active recovery while the next queued item is an
inbound transfer; `immediate` starts recovery while unoccupied. These are explicit
policies, not fuel-optimal laws. Either can miss future appointments.

## Continuous ledgers

Replay state indices 0–11 retain the shared physical/electrical contract. OPS
adds four integrals: actual actuator work, actual external angular impulse,
signed energy of removed hub propellant, and its angular momentum.

```
ΔE_inventory = E_captured − E_released + W_actuator − E_removed_propellant
ΔH_inventory = H_captured − H_released + J_actuator − H_removed_propellant

Wdot_actuator = V_COM · F + ω τ
Jdot_actuator = R_COM × F + τ
```

The instantaneous facility inventory includes attached cargo and remaining
propellant. At capture/release its mass changes, without moving the existing
material points. Event ledgers use the ideal matched tip state, and separately
report the residual against the independently propagated incoming state. No
unmodeled capture impulse is manufactured from a failed check.

The chemical controller only burns while unloaded; fuel is at the symmetric hub.
Its removed mass therefore carries the hub's instantaneous mechanical energy and
angular momentum. This accounting is required: counting thrust work alone would
misinterpret mass removal as a numerical violation. It is not an exhaust-plume
simulation. The inherited ideal-terminal-couple approximation remains in force.

The HISTORY graphs instead track a fixed **dry facility**: strength tether,
hub, terminals and any electrical system. They exclude fuel and attached cargo,
avoiding inventory bookkeeping jumps. These are actual sums over the distributed
body, not merely an osculating point-mass orbital energy. Orbital/spin diagnostic
components are also retained in frames. E and H residual maxima are maxima over
recorded ledger frames, not interval arithmetic bounds.

For E0 the original bus + environment = mechanical work + losses ledger is
preserved. The same-hardware zero-power control changes only the bus cap;
conductors and the hardware budget remain. Selecting None instead removes the
E0 system. Neither is labeled a free refill. Power is a continuous cap, not a
battery inventory. Plasma closure, temperatures, eclipse and power-hardware
sizing remain assumptions/omissions from E0.

## Interpretation examples, not hardcoded success

At the reference inputs and 2 s / 48-cell budget:

- The six-outbound / 40 t chemical example delivers three loads during a 12-hour
  observation and consumes the finite tank. The remaining rows stay unserved.
- In the equal 3 t traffic-only example, the first outbound transfer gives the
  payload about **60.52 GJ**, while the first inbound return removes about
  **31.73 GJ** from that payload. It restores only part of the outbound exchange.
  Both signed angular-momentum changes are separately recorded. Equal mass
  alone is not a balance condition for these chosen trajectories/phases.
- Adding chemical assistance after those inbound transfers can enable additional
  operations. Compare actual destinations, incoming supply and horizon before
  calling a strategy more efficient.
- A two-delivery E0 success is not automatically a ten-delivery success. The
  continuous finite manifest exposes the subsequent state and resource burden.

These are recalculated observations, not injected outputs or preset pass flags.
No transport-cost or hardware-feasibility claim follows from these examples.

## Interface and review

The object selector can track every manifest ID, independently of newer captures.
Outbound is amber/circular, inbound violet/diamond, facility cyan. No camera
substitute is used when a selected object is absent. Event replay avoids blending
across attachment, appearance, actuation and cutoff-state changes.

Editing controls cannot relabel the previous accepted result. Fixed windows are
shown from the accepted plan in the results table, separately from actual capture
and release. A forecast that never captures does not appear as an actual capture.
Pin/restore, versioned JSON and bounded URL inputs preserve the exact plan. Cancel
terminates the real worker and keeps the last accepted shift. Old flight-design
JSON is not misinterpreted as an operations manifest.

The model and renderer run in the browser; no new runtime dependency or external
service is required. Public Method and the small homepage entry remain static.
The lab's original noindex review policy is retained; no DNS, custom-domain,
Cloudflare settings or GoDaddy changes are made.

## Verification

`npm run test:lab`: 69 tests total, including 19 operations regressions. Coverage:
finite input/manifest validation; JSON round trips; repeated shipments without
refills; distinct inbound/outbound conservation; original appointment windows;
head-of-queue blocking; invalid destination effects; per-payload identities;
same-hardware zero-power behavior; hybrid assistance; observation after all
shipments; exact endpoint release handling; and reduced-step/doubled-quadrature
comparisons for chemical, coast and E0 runs. Existing 50 tests still run.

`tests/lab-operations.browser.py` runs on native localhost with real module
workers and requires Three.js WebGL in CI. Its optional isolated mode is only
local component QA when navigation is blocked; it omits native storage/URL checks
and does not claim actual WebGL qualification. The existing Flight Studio and
E0 native browser suites also remain in CI.

## Research context

Hoyt et al., *Cislunar Tether Transport System*, NIAC Phase I final report,
30 May 1999: https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf

Introduction, printed p. 1, discusses restoration by slowing return traffic.
The specific Earth–Moon mass balance in that study is not imported as a universal
rule. OPS is Earth-only and does not reproduce the report's lunar architecture
or establish its feasibility. The current implementation has no Moon, T4,
elastic cable, debris, autonomous launch/guidance or real hardware qualification.

### Original patch review status (historical)

The following records the initial patch handoff, not the current release
candidate. See `release-consolidation.md` and PR #11 for the combined review.

The 69-test suite, TypeScript checks and static production build pass locally.
All three compiled browser suites (Flight Studio, E0, Operations) pass in the
explicitly isolated component harness, with actual compiled calculations in
browser Blob workers and the Canvas fallback. This runtime blocks native
localhost navigation and does not initialize WebGL. Native storage/URL reload
and the new Operations WebGL renderer still need the added CI suite to run.
No new CI result, remote branch, PR or deployment is claimed for this patch.

The base is PR #9 head `330d5a62a2637814ea8a0326cf7ef2e75b7155d3`, tree
`d4d06f0c31b6076d1c8b90823cb40e8c3583ea85`. The available GitHub tools during
this delivery exposed reads but no branch/commit writes, so the reviewed delta
is preserved as a regular Git patch rather than silently lost or called pushed.
