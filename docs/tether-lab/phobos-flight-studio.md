# Phobos Flight Studio — P1

P1-0.1.0 is a separate, bounded anchored-tether experiment at `/lab/phobos/`.
Phobos itself anchors two radial arms. They corotate with a prescribed circular
Mars–Phobos binary; neither arm is an independently spinning rotovator.
Earth D1p and lunar L1p retain their existing solver, constants and storage.
Expeditions retains its economy, model, schema and local saves.

## Reference constants and assumptions

| Quantity | Frozen value | Basis |
|---|---:|---|
| Mars GM | 4.282837362 × 10¹³ m³/s² | JPL satellite physical parameters, MAR097 table |
| Mars mean radius | 3,389,500 m | JPL planetary physical parameters |
| Phobos GM | 708,700 m³/s² | JPL satellite physical parameters, MAR097 table |
| Phobos equivalent-volume radius | 11,080 m | JPL satellite physical parameters |
| Binary separation | 9,375,000 m | JPL MAR099 mean semimajor axis; circularized here |
| Mars exclusion altitude | 150,000 m | Scenario boundary; not a predicted atmospheric edge |
| Each terminal/counterweight | 2,000 kg | Scenario assumption, retained after release |

Sources checked 19 September 2026:
[JPL satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/),
[planetary parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html),
[satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/).
JPL's mean elements are not ephemerides. The measured eccentricity, orientation,
Mars harmonics, Sun, Deimos and tides are excluded. Phobos is spherical, not a
shape/terrain model; its displayed marker is enlarged.

The conceptual topology is described in Leonard Weinstein's 2003
[Space Colonization Using Space-Elevators from Phobos](https://ntrs.nasa.gov/citations/20030065879):
an arm toward Mars and another outward, both anchored on Phobos. P1 does not
reproduce that proposed infrastructure, its nanotube material, surface pickup,
loop climbers or interplanetary capture system. Zylon HM and Kevlar 49 properties
reuse the existing, sourced lab fiber profiles. A strength/safety-factor ratio
is not a qualified cable allowable.

## Gravity and release

Let separation be `a`, total gravitational parameter `μ`, and
`n = sqrt(μ/a³)`. In the rotating barycentric plane,
`xM = -a μP/μ`, `xP = xM+a`. The two primaries are stationary.

`Ω(x,y) = μM/rM + μP/rP + n²(x²+y²)/2`

`x″ = ∂Ω/∂x + 2n y′` and `y″ = ∂Ω/∂y − 2n x′`.

The release state is `(xP ± (RP + length), 0, 0, 0)`: a prepositioned payload at
rest in the rotating frame. Release adds no impulse. Fourth-order Runge–Kutta
uses steps of at most two seconds for two binary periods (~15.31 h), sampling
every 30 seconds. Both bodies' gravity acts on the released cargo. Mars altitude
150 km or the spherical Phobos surface stops the flight, with refined entry
time; there is no atmosphere, landing or impact continuation. Cable interception
and later capture are not checked.

`C = 2Ω − vx² − vy²` is the conserved Jacobi quantity. Reported relative drift
is measured at every step, including a boundary event. Replay uses cubic Hermite
interpolation between samples, with exact endpoints. Display motion never feeds
back into the integrator. Reduced motion starts paused; hiding the tab pauses.

Reported periapsis, apoapsis and escape excess are **instantaneous Mars-centered
two-body elements at release**. The trajectory itself includes Phobos gravity.
Positive release energy is not proof of reaching a chosen solar-system body,
and a clear two-period run is not indefinite orbital safety.

## Static cable loading

Each uniform cable starts at the spherical Phobos surface and ends at its
terminal. At distance `u` from Phobos' center along sign `s = ±1`, its effective
outward acceleration is `g(u) = s ∂Ω(xP+s u,0)/∂x`.

For area `A`, density `ρ`, end coordinate `b` and terminal mass `m`:

`T(u) = m g(b) + ρ A [Ω(xP+s b,0) − Ω(xP+s u,0)]`.

This analytically integrates distributed cable weight, including Phobos gravity.
Both unloaded arms and the selected arm with cargo are checked. The derivative
`dg/du = n² + 2μM/rM³ + 2μP/u³` is positive on these radial segments. Thus the
only possible interior maximum of tension is at `g=0` (near L1/L2); bisection
locates it. Endpoint minima and this interior maximum are checked explicitly,
not inferred from the 97 plotting samples. Compression beyond 1 μN, stress
above `ultimate/safetyFactor`, or an inward terminal below the Mars boundary
blocks release. Thin cables, long arms and near-surface slack are real failures.

The 2 t terminals remain after cargo release. Both pre-release and post-release
static states are required; transient unloading waves, elastic stretch, cable
oscillation, climber Coriolis forces, anchor geology and attitude control are
outside P1. Opposite root loads are individually reported; unequal loads are
absorbed by the prescribed Phobos state, not silently claimed to balance.

## Ideal transfer budget

The payload starts at the tip. A separate **quasistatic** surface-to-tip budget
explains the energy and momentum that positioning it would exchange. It is not
a simulated climber or an integrated power requirement.

At the same binary phase, barycentric specific inertial energy is
`E = n² x²/2 − μM/rM − μP/rP`, and specific angular momentum `L = n x²`.
For payload mass `m`, compare the chosen surface anchor with its terminal:

`ΔL = m n (xTip² − xSurface²)`

`Wanchor = n ΔL`, `Wwinch = −m (ΩTip − ΩSurface)`

`ΔEpayload = Wanchor + Wwinch`.

Positive anchor work is energy drawn from the binary's prescribed orbital
reservoir; negative means energy returned. Negative winch work is ideal net
regeneration, not guaranteed recoverable electricity. Climbing out of Phobos'
local potential still has a barrier; the displayed net value is not peak motor
power or maximum intermediate work. Efficiencies and hardware are not modeled.
Phobos' actual orbital/attitude change, replenishment and repeatable operation
are not solved. Reports include signed angular momentum as well as both work
terms. This avoids presenting the anchored release as a free energy source.

## Interface and persistence

Default: 1,250 km inward, 3,000 km outward, 50 mm² Zylon HM, safety factor 2,
3 t cargo. The inward release has ~502 km osculating periapsis; outbound has
~1,029 m/s Mars escape excess. A 1,500 km inward arm crosses the Mars boundary
and starts the low-pass challenge. Its goal is an inward periapsis of 150–750 km,
both arms in tension and within allowable, and a full two-period clear flight.

The Mars/Phobos scene, orbit-plane fallback, timeline, load curves and work
budget all use the same numerical result. Edited but unrun inputs leave the
last flight visibly identified. Design saves use only
`skyhook-lab-phobos-design-v1`. Schema 1 is specific to this architecture/model,
not the Earth/lunar design schema or the campaign schema. Export/import accepts
only the matching P1 design (6 KB maximum). A shared `#p=` URL uses this same
validator. Result exports include constants, frames, loads, work terms, limits
and Jacobi drift. Loading/importing/presets clear a stale shared-design fragment.

## Arm-length studies

`src/simulation/phobos-study.ts` plans seven samples around the selected arm's
length, spaced by 50, 100, 250 or 500 km. It changes only that arm, preserving
the other arm, payload, area, material, safety factor and release direction.
Lengths clamp to the existing design bounds; duplicate boundary samples are
removed. Each sample runs the unmodified full P1 solver, including initial
structural blocks and refined boundary stops. No interpolation, continuous
operating interval or global optimum is inferred from the discrete results.

`PhobosStudy.tsx` plots inward samples by the minimum simulated Mars altitude;
the 150 km line is the engine's stopping boundary. Outward samples use signed
Mars-centered two-body release energy in MJ/kg; the zero line separates bound
and unbound release states. This is not a solved solar-system destination or
proof of indefinite escape. Length columns are evenly spaced categorical
samples, labelled with their actual lengths. Blocked releases have no flight
orbit or clearance and appear on a separate no-release row. Symbols and text
distinguish clear, target/escape-energy, stopped, blocked and pending samples.

Selection exposes exact design length, flight duration, outcome/issues,
minimum Mars altitude, release periapsis or escape excess, both-arm load
margin, cable/terminal mass and the separate ideal positioning work budget.
The optional inward suggestion uses only full low-pass challenge passes,
nearest to the 450 km midpoint of its 150–750 km release-periapsis band.
Outward flights are not ranked as an optimum; energy, mass and loads remain
separate observations.

Studies stream completed rows without replacing the accepted flight. Stopping
retains explicitly partial results; request IDs reject queued stale messages.
Worker failures interrupt the study and permit retry. Presets and sample
inspection stop an active study. Opening a row restores and reruns its exact
design, clears invalid drafts and returns keyboard focus to the flight. Edits
to fixed inputs or direction mark the earlier study stale; changing only its
sampled length does not. Complete studies export the plan and actual result
summaries as versioned JSON. Partial studies cannot export as complete.
Study state is session-only and never writes saved designs or campaign worlds.
Phones scroll the plot internally with at least 44 px point targets.

`tests/lab-phobos.test.mjs` covers force/potential consistency, independent
quadrature of cable loads, interior maxima, pre/post states, conservation,
Kepler release values, step convergence, budget identities and malformed IO.
`tests/lab-phobos.browser.py` exercises the actual worker, WebGL, challenge,
replay, validation, isolated storage, share/import/export, navigation, reduced
motion, fallback, responsive widths and the campaign link.
`tests/lab-phobos-study.test.mjs` checks bounded planning, native-solver result
equivalence, blocked releases, signed energy, candidate filtering, stale inputs
and complete exports. Browser coverage also includes exact sample reopening,
both study directions, blocked fixed arms, partial cancellation with queued
real-worker responses, startup failure/retry and six-width study interaction.
