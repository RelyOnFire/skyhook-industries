# CardioRotovator — synchronized reference and passive diagnostics

`/lab/cardio/` starts with the defining synchronized reference geometry. A separate disclosure contains the finite-mass, planar, uncontrolled rigid-body comparison.
The historical topology comes from [HASTOL Phase I, pp. 17–19 / Figure 13](https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf#page=21):
an eccentric station orbit, apogee pickup and two rotations per orbit, with
pickup and resynchronization difficulties. The main reference is kinematic; it does not simulate a controller. The passive diagnostics are independent orbital experiments, not a solved CardioRotovator service.

## Correct architecture boundary

The primary geometry uses the **station** Kepler ellipse and arm length derived
from station apogee minus pickup altitude. It fixes two inertial arm turns per
orbit and the phase: inward at apogee, outward at perigee. The SVG samples the
analytic reference state at a common physical scale; it does not draw a stylized
heart or substitute passive integration for synchronized motion. No actuator,
structure or atmospheric feasibility is inferred from this prescribed path.

The earlier passive default had an initial tip altitude about 1067 km and lost
roughly a full spin of phase in one orbit. Its conservative integrator described
an uncontrolled rotor, not the defining CardioRotovator architecture. Conservation
tests alone cannot validate that architectural claim. New regressions explicitly
check both apsides, the two-turn closure, derived pickup reach and velocity.
The independent passive design controls and saves remain in a disclosure.

## Release from the synchronized reference: C1k-0.1.0

`Trace release here` freezes the selected reference phase and starts an ideal
test particle at the exact tip position and inertial velocity. There is no
release impulse. The particle follows `rddot = -mu*r/|r|³` for at most 1800 s,
using the existing point-cargo RK4 stepper (default 2 s). A crossing of the
120 km cutoff is bracketed 32 times; the drawn coast ends on the upper side.
A reference tip already below the cutoff produces no propagated segment.

The plot fits both the reference orbit and the particle trace at one physical
scale. It holds the tether at its release configuration while drawing the
particle's future path; this is a static trace, not a coupled tether replay.
Scrubbing, playing, changing phase or editing geometry clears the trace.
Display units leave the accepted calculation intact. Export retains exact
geometry, release fraction/time, initial state, sampled coast, orbit elements,
cutoff/horizon status and numerical invariant residuals.

Orbit classification uses the full release state, independently of the finite
drawn horizon: bound orbits return to perigee; only incoming unbound trajectories
have a future perigee. A future crossing remains flagged even if it lies beyond
30 minutes. Excess escape speed is `sqrt(2*epsilon)` for nonnegative specific
energy. The reported energy error is scaled by `max(mu/r_initial, |epsilon|, 1)`
to remain well-conditioned near escape, and angular error by the initial
specific angular momentum with a 1-unit floor.

This diagnostic excludes payload mass, tether recoil, loading, active control,
reboost and destination targeting. It cannot qualify a tether or commission an
Expeditions design. It does not change the independent C1p/C1r design or saves.
Regressions check initial-state continuity, distinct phase outcomes, cutoff
termination, future-crossing classification, invariants and timestep refinement.

## Compare synchronized release phases

The reference comparison classifies 21 exact release states at fractions
`i/20`, from 0 through 1. It uses the same release-state calculation as the
single-particle trace, including future cutoff crossings; it does not integrate
21 coasts or interpolate a continuous release window. Both endpoints represent
apogee, at different times in the same completed orbit.

Opening the disclosure leaves the current trace unchanged. Choosing a sample
pauses the reference, selects its exact phase and integrates that one coast.
Keyboard focus stays on the selected sample for further comparison. Symbols,
text labels and color distinguish below-cutoff, future crossing, bound and
escape outcomes. Geometry edits recompute the comparison and clear the prior
trace; invalid input hides its actions. Display units preserve the comparison.

The version-1 `skyhook-cardio-reference-phases` JSON export records the C1k model,
release-state analysis type, exact geometry, period and every sample's initial
state, orbit elements and outcome. It contains no implied control, loading or
continuous-window result and does not modify any saved design or campaign.

## Passive mass and state

State is `[Rx,Ry,Vx,Vy,theta,omega]`, using Earth-inertial SI coordinates and
an unwrapped angle. A station point mass is at s=0, a 2 t grapple at s=L,
and the loaded case adds cargo to that same tip. Cable area is linear:
`A(s)=A_tip × [taper − (taper−1)s/L]`. Zylon HM uses the existing engine's
material constants with safety factor two. There is no optimized taper model.

Two-point Gauss quadrature in each of 48 cells exactly integrates the polynomial
mass moments, including inertia. Gravity and potential use those same nodes.
`M=Σm`, `c=Σms/M`, `I=Σm(s−c)²`. With u=s−c, e=(cosθ,sinθ):

```
r_i = R + u_i e
v_i = V + u_i omega e_perp
g_i = -mu r_i / |r_i|³
Rddot = Σ m_i g_i / M
omegadot = Σ m_i u_i (e cross g_i) / I
```

Default COM perigee/apogee: 1200/1800 km; arm 800 km; station 5000 t;
cargo 10 t; tip area 500 mm²; taper 3; initial spin 2× mean motion, phase 0°.
The empty COM starts at positive-x apogee, moving +y; θ=π points inward.
`a=(ra+rp)/2`, `T=2π sqrt(a³/mu)`, `Va=sqrt(mu(2/ra−1/a))`, `omega=ratio×2π/T`.
No controller maintains this ratio during the calculated coast.

## Pickup

Incoming cargo is supplied at the current tip position and velocity. It has no
independently solved launch/approach. With `dc=c_loaded−c_empty`, the loaded state
uses `R'=R+dc e`, `V'=V+dc omega e_perp`, unchanged θ and ω. All existing
material points retain their positions/velocities. Energy and angular momentum
before pickup include the incoming cargo; the closure residual is reported.
Neither energy nor orbital momentum is granted for free.

Both bodies then coast for one **original nominal period**, stopping separately
if a limit is encountered. Cargo remains attached in this baseline comparison. The separate C1r release
experiment below changes that condition; neither experiment implements reeling or recovery. Initial osculating COM perigees are diagnostics under a
point-orbit approximation; the extended body does not subsequently obey an exact
Kepler ellipse. Unwrapped drift is θ(t)−[θ(0)+ω(0)t]; a full missing rotation is
not hidden by wrapping to ±180°. The dashed drawing is explicitly a prescribed
Kepler/constant-spin reference, not the integrated result.

## Loads and numerical guards

Closest-segment clearance minimizes `|R+u e|−R_Earth` over `u∈[−c,L−c]`.
At each cable cut, including the tip left-limit with its grapple/cargo terminal mass, sum outboard `m(a−g)`; negative projection on e is tension,
and the perpendicular projection is the transverse constraint force. The axial
stress screen does not qualify a straight flexible cable or bending strength.
Stops: clearance <120 km, axial stress >material allowable, or tension <−100 N.
No state past a detected stop is included in a successful trajectory.

RK4 uses ≤5 s and ≤0.01 rad of rotation per step, splitting at the nominal end.
Detected failures are bisected 24 times. Samples between accepted step endpoints
are not a mathematical guarantee against arbitrarily narrow transient violations.
Replay interpolation is presentation only and never drives the solver. Full-run
energy and angular momentum include every node. Reported drifts are relative to
the initial invariant, with a 1-unit denominator floor to avoid division by zero.

Reference regressions check the apsidal orientations, two-turn orbit closure,
derived pickup reach, analytic velocity against position differences, Kepler
invariants and clearance along the whole arm. Browser checks cover the reference
controls, replay, units, invalid geometry and responsive framing separately from
the preserved passive design.

Passive tests cover finite-mass attachment continuity/conservation, zero-gravity analytic
motion, free-coast conservation, independent timestep and quadrature refinement,
clearance and load stops, phase/payload sensitivity, finite values and strict
versioned input. Browser checks use the actual worker, pause/scrub, controls,
invalid input, cancellation, isolated Save/Load, share reload and responsive views.

## Integration boundary

Storage key `skyhook-lab-cardio-design-v1`; fragment parameter `cardio`; schema 1;
model `C1p-0.1.1`. Legacy `C1p-0.1.0` schema-1 designs normalize to the corrected model on read, preserving all numeric settings; reading does not rewrite storage. Designs are ≤16 KB. Importing another architecture is rejected.
The original Earth solver, schemas and campaign bridge are untouched. Cardio has
no repeatable two-delivery or recovery proof and cannot commission an expedition
profile. Atmosphere, guidance, capture hardware, flexure, reeling, active phase
control and reboost remain unmodeled.

## C1r-0.1.1: selectable release

`cardio-release.ts` reuses the C1p body and gravity-gradient integrator, starting
from the same exact matched pickup. Release time is 5–90% of the original nominal
period, supplied separately from the unchanged C1p design. The worker has its
own cancelable lifetime. Reports record the exact design and timing.

At release, `q = cardioPoint(y_loaded, loaded, L)` supplies the cargo state.
`cardioCapture(y_loaded, loaded, empty)` performs the inverse COM transformation;
all retained material points keep their velocities. This is impulse-free
separation, not an imposed change of spin, launch kick or recovery burn.
Energy/angular closure includes the cargo at separation. Subsequent diagnostics
sum both the remaining extended body and the point cargo.

Free cargo follows `rddot = -mu*r/|r|³` with RK4, sharing the tether's ≤5 s step.
Steps split exactly at release and stop at the first cargo/tether cutoff or
structural failure, refined with the same 24-step bracket. An unreachable
release has `release: null`, never invented orbit diagnostics. Frames at the
separation instant store both mass frames; replay selects the post-release state
at that exact time and interpolates only within each phase.

The cargo's osculating orbit determines its perigee/apogee. A future perigee
below 120 km is flagged even if the replay ends before reaching the boundary.
Outbound unbound cargo has its perigee in the past and is assessed by its current
altitude rather than falsely treated as an incoming trajectory.
Unbound trajectories have no apogee. The remaining tether's osculating COM orbit
is diagnostic; whole-segment clearance and loads continue to be screened.
No mutual cargo/tether gravity, collision detection, atmosphere, targeting,
release mechanism, controller or repeatable traffic service is solved.

Regression tests check separation continuity, mass and conserved quantities,
independent circular point-cargo motion, timestep/quadrature refinement, failure
before release, cargo cutoff, timing sensitivity, and replay across the event.
The default 25% release crosses the cutoff; a 2.75 initial spin ratio with the
otherwise unchanged default at 25% produces a clear bound cargo orbit. This is
a reproducible experiment setting, not an optimized or qualified vehicle.

## Release timing comparison

The session-only comparison streams 18 full C1r flights at 5% increments from
5% through 90%, including the exact currently selected fraction as a nineteenth
sample when it differs from the grid. Only timing varies; every sample retains
the same validated C1p design. The worker can be terminated; generation tokens
reject late messages, and completed samples remain available after stopping.

A clear passive result requires both a completed coast and no future cargo crossing of the 120 km cutoff.
Cargo alone clearing the cutoff cannot override a failed tether. Unreached
releases carry no invented orbit. Sampling does not prove the intervening
intervals or a repeatable service. Selecting a completed row restores its exact
result and timing in the main release replay, focusing the verdict. Comparisons
do not replace the accepted flight until a row is selected.

Summary exports include exact design, model, ordered plan, solved rows, orbit
diagnostics, limits, and a completion flag. Partial runs cannot appear complete.
Full-precision timings are retained in reports and accessible labels; compact
cards round the headline to three decimal places and mark off-grid selections.
The main design's save and shared-link formats remain unchanged.
