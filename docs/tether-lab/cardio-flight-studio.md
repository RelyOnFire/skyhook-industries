# CardioRotovator — C1p-0.1.0

`/lab/cardio/` runs a finite-mass, planar, single-arm rigid-body comparison.
The historical topology comes from [HASTOL Phase I, pp. 17–19 / Figure 13](https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf#page=21):
an eccentric station orbit, apogee pickup and two rotations per orbit, with
pickup and resynchronization difficulties. This implementation is an independent
orbital experiment, not the historical atmospheric-launch proposal.

## Mass and state

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
if a limit is encountered. Cargo remains attached. No separation, reeling or
recovery is implemented. Initial osculating COM perigees are diagnostics under a
point-orbit approximation; the extended body does not subsequently obey an exact
Kepler ellipse. Unwrapped drift is θ(t)−[θ(0)+ω(0)t]; a full missing rotation is
not hidden by wrapping to ±180°. The dashed drawing is explicitly a prescribed
Kepler/constant-spin reference, not the integrated result.

## Loads and numerical guards

Closest-segment clearance minimizes `|R+u e|−R_Earth` over `u∈[−c,L−c]`.
At each cable cut, sum outboard `m(a−g)`; negative projection on e is tension,
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

Tests cover finite-mass attachment continuity/conservation, zero-gravity analytic
motion, free-coast conservation, independent timestep and quadrature refinement,
clearance and load stops, phase/payload sensitivity, finite values and strict
versioned input. Browser checks use the actual worker, pause/scrub, controls,
invalid input, cancellation, isolated Save/Load, share reload and responsive views.

## Integration boundary

Storage key `skyhook-lab-cardio-design-v1`; fragment parameter `cardio`; schema 1;
model `C1p-0.1.0`. Designs are ≤16 KB. Importing another architecture is rejected.
The original Earth solver, schemas and campaign bridge are untouched. Cardio has
no repeatable two-delivery or recovery proof and cannot commission an expedition
profile. Atmosphere, guidance, capture hardware, flexure, reeling, active phase
control, release and reboost remain unmodeled.
