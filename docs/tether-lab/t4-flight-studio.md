# T4 Flight Studio — T4p

T4p-0.1.0 is the two-stage experiment at `/lab/t4/`. It calculates a planar,
finite-mass primary arm and balanced secondary rotor joined by an ideal,
torque-free pivot. The loaded rotor starts with a payload on its positive tip;
one timed release is followed through a two-hour experiment. No capture,
atmospheric pickup or recovery is implied.

## Historical topology and scope

Brian Tillotson's two-tier topology is documented in [HASTOL Phase I](https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf),
main report p. 19 and Appendix 2 A2-15–17 (PDF pages 23 and 101–103).
The report describes a long primary arm, a pivot supported by a split end, and
a smaller balanced two-arm rotor. Its first-cut infinite-station approximation
and mass-benefit estimates are not used as validation here.

This experiment instead has finite masses and uniform rigid stages. The ideal
planar hinge does **not** model the fork, bearing dimensions, stage crossings or
physical clearance between cables. Straight stages need transverse constraint
forces, which the UI reports. Axial screening cannot establish bending strength
or flexible-tether stability. It is a dynamics experiment, not a qualified T4
design or a reproduction of the complete HASTOL system.

## State and mass accounting

All internals use SI. The generalized coordinates are pivot position P=(x,y)
and inertial stage angles θ₁, θ₂; velocities are V, ω₁, ω₂. With eᵢ=(cosθᵢ,sinθᵢ)
and eᵢ⊥=(-sinθᵢ,cosθᵢ), a mass at signed arm coordinate u has

```
r = P + u eᵢ
v = V + u ωᵢ eᵢ⊥
a = aP + u αᵢ eᵢ⊥ − u ωᵢ² eᵢ
```

The primary spans u=-L to 0; the station is at -L. The secondary spans -l to +l.
The station is 120 t, the pivot assembly 6 t, and each permanent secondary
terminal 2 t. Cargo starts at +l. These are explicit scenario assumptions.
Cable density and ultimate fiber stress reuse the sourced Zylon HM and Kevlar
49 profiles in the Earth engine; area is uniform, independently set per stage.

Default: L=300 km, l=50 km **per secondary arm**, loaded COM altitude 1,800 km,
primary ωL=1 km/s, secondary ωl=0.8 km/s, relative phase 180°, release at 120 s,
3 t cargo, primary/secondary areas 150/80 mm², Zylon with safety factor 2.
Those spin parameters are not tip ground speeds. Negative secondary spin is
supported. Initial COM translation is circular about spherical Earth; neither
the station nor pivot is prescribed to follow that circle thereafter.

Cable gravity uses 32 cells per arm, each with two-point Gauss quadrature.
Cable mass, first moment Aᵢ=Σmu and pivot inertia Iᵢ=Σmu² integrate exactly;
gravity is approximated at the same nodes used for potential energy. The
payload and hardware remain exact point masses. No body is an infinite
momentum reservoir. Frozen Earth radius/GM come from the existing Earth engine.

## Coupled equations

For each node g=-μr/|r|³. Sum F=Σmg and stage torque τᵢ=Σmu(eᵢ×g).
The four-coordinate mass equation is

```
[ M·Id₂    A₁e₁⊥   A₂e₂⊥ ] [aP]   [ F + Σ Aᵢωᵢ²eᵢ ]
[ A₁e₁⊥ᵀ     I₁       0  ] [α₁] = [ τ₁              ]
[ A₂e₂⊥ᵀ      0      I₂  ] [α₂]   [ τ₂              ]
```

The angular 2×2 Schur complement has diagonal Iᵢ−Aᵢ²/M and off-diagonal
−A₁A₂cos(θ₁−θ₂)/M. This gives both angular accelerations and pivot acceleration
without numerically mixing meter and radian scales in a generic solver. There
is no motor torque, fixed phase rate or prescribed pivot path.

Classical RK4 uses steps ≤1 s and ≤0.02 rad of current stage rotation. The
release time and end time split steps exactly. Fault crossings are bisected
24 times within the failing step. Event screening is sampled per step; it is
not a mathematically certified continuous bound for every possible input.

## Release and invariants

At separation the cargo receives its existing tip position and velocity.
The stage coordinates and velocities remain identical; only the attached mass
model changes. Cargo then follows independent Earth point gravity. There is
no artificial recoil impulse, energy credit or COM-coordinate reset.

For the loaded COM velocity VC, the release velocity is the vector sum

```
vCargo = VC − (A₁/M)ω₁e₁⊥ + (l−A₂/M)ω₂e₂⊥.
```

The UI reports both inertial components of each contribution. Summing scalar
speeds would be wrong. The flight report includes release energy, angular
momentum and linear momentum closure, plus maximum full-run relative drift
in total mechanical energy and angular momentum. The latter totals always
include cargo after separation. Linear momentum changes under Earth gravity;
only instantaneous release closure or a zero-gravity run should conserve it.

## Load and clearance checks

Using each node's computed acceleration, accumulate m(a−g) for outboard
free bodies, separately for the primary and each secondary arm. Project the
cut reaction onto the arm to get axial tension; its perpendicular component
is the transverse force demanded by the rigid approximation. Cuts at the
quadrature masses approximate the distributed load envelope, so quadrature
refinement is tested separately. The sum over the secondary gives pivot force.

Stop on stress above fiber ultimate/safety factor, tension below -1 N (numeric
compression tolerance), or any whole straight segment/cargo below 120 km
altitude. Segment clearance uses the closest point along the entire segment,
not only its endpoints. The exclusion boundary is a scenario choice, not an
atmosphere calculation. No bearing rating is invented; force is reported.

Release periapsis/apoapsis are Earth two-body elements. The phase challenge
requires a complete two-hour run, periapsis ≥120 km and a bound apoapsis of
8,000–12,000 km. Default phase 180° yields approximately 9,500 km apoapsis;
the 60° challenge starts around 3,040 km. The preset with a 15 mm² secondary
and 8 t cargo fails the initial axial check. These are regression scenarios,
not hardware capacities.

## Application and verification

`src/simulation/t4.ts` is pure numerical code. `t4-worker.ts` runs it off the UI
thread. `t4-study.ts` plans either six phases at the chosen delay or a timing
map: phases 0/60/120/180/240/300° crossed with release delays at the current
value plus -2/-1/0/+1/+2 time-spacing increments. Spacing is 0.5, 1 or 2 minutes.
Delays clamp to the existing 0–30 minute input range; duplicate boundary rows
are removed. Every cell runs the unmodified two-hour model, including its
early-stop checks. No continuous window, interpolated flight, optimum or timing
tolerance is inferred between samples.

Completed samples stream to the map, with target, off-target, limit and pending
states distinguished by text/symbols as well as color. Selection exposes orbit
altitudes, axial margin, pivot force and the actual stop reason. The suggestion
chooses only full-check passes, nearest to 10,000 km apoapsis, breaking ties by
sample order. Fixed-input edits flag an older study; changing an axis that study
deliberately varies does not invalidate its fixed hardware. The captured plan
and every sample retain all exact settings.

Cancellation terminates the worker and retains explicitly incomplete samples;
request IDs reject stale results. A study does not replace the accepted flight.
Opening a sample restores its exact design, reruns it, and returns keyboard focus
and the viewport to the flight. A completed study can export its plan, sample
results, model version, units and target limits as JSON. Incomplete studies cannot
be exported as complete. Study results are session-only, separate from saved
designs; the design model/schema and all simulation outputs remain unchanged.
Accepted results stay distinct from draft controls. Hidden tabs and reduced
motion pause replay; there is no wall-clock catch-up. The scene samples
calculated stage angles and cargo states; no visual coordinate drives physics.

Designs use `skyhook-lab-t4-design-v1`, schema 1/model T4p-0.1.0, with `#t4=`
links and a 6 KB input limit. Other architectures are rejected. Earth, Moon,
Phobos and campaign stores are untouched. Campaign saves need no migration.

`tests/lab-t4.test.mjs` covers analytic mass moments, COM initialization,
free-body force/torque closure, finite coupling, zero-gravity and orbital
invariants, release continuity, cargo coast, step/quadrature convergence,
structural/clearance stops and replay/IO boundaries. `tests/lab-t4.browser.py`
covers native workers/WebGL, the challenge, streaming phase/timing studies,
partial cancellation, exact export and sample reopening, stale fixed-input
notices, isolated storage, sharing/imports, responsive layouts and 2D/reduced-motion
access. `tests/lab-t4-study.test.mjs` checks bounded sample planning, full-model
equivalence, recommendation filtering, fixed-input identity and export completeness.
All are CI gates.
