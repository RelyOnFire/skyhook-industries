# 15P/Finlay mission study

Added 8 October 2026. This active mission study is separate from the archived
26P proposal and the playable campaign. It connects the public site's transport,
power, water and industry story to a whole-nucleus comet-depot ambition.

## Architecture and scope

Survey the nucleus; enclose and secure it; extract accessible volatiles; feed
heated water to attached engines; establish an accessible depot orbit near Earth,
the Moon or Mars. A vapor-collection membrane and a load-bearing restraint/harness
have different jobs. Local sublimation, dust filtration, cold trapping, storage
and controlled feed/pressurization replace melting the entire comet into an
unpressurized bag.

The manual SVG sequence is a system concept, not a measured Finlay shape or a
flight simulation. It uses no third-party artwork. The workbench does not change
campaign saves, Flight Studio designs or browser storage.

## Frozen orbit

Source: [JPL SBDB API](https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=15P&phys-par=true&full-prec=true).
The exact retrieved response is in finlay-sbdb-2026-10-08.json.

- Solution K213/18, dated 2024-04-16 11:19:30.
- Epoch JD 2457327.5 TDB; J2000 ecliptic reference.
- a = 3.490479431490757 AU; e = 0.7201854360264079.
- i = 6.800480403047977°; Ω = 13.75387475146649°; ω = 347.6257499652587°.
- Solar GM = 1.32712440018 × 10¹¹ km³/s²; AU = 149597870.7 km.

This is a frozen osculating ellipse, not a current ephemeris. No departure date,
timed encounter, interplanetary transfer, low-thrust optimization or final depot
orbit is calculated.

At ecliptic nodes f = −ω or π − ω, p = a(1−e²), r = p/(1+e cos f),
and transverse speed vₜ = sqrt(μ/p)(1+e cos f). The plane-only impulse benchmark
is Δv = 2 vₜ sin(i/2), preserving radial velocity. Using total speed would
overstate the required pure rotation at a node with nonzero radial speed.
Convert p from AU to kilometres before evaluating velocity with the stated
solar gravitational parameter.

The near node is approximately 0.9863 AU and 4.6432 km/s; the far node is
approximately 5.6655 AU and 0.8083 km/s. Solar intensity is shown as 1/r² relative
to 1 AU. Available plant power is held fixed when comparing nodes; collector
area, power storage and transmission are not modeled.

## Mass and energy model

Canonical implementation: src/missions/finlay-model.ts.

Inputs: nucleus radius, bulk density, allocated water fraction, effective exhaust
speed, usable plant power and requested Δv. The public UI sums the selected
plane-change benchmark and a user-entered allowance for other manoeuvres.
The default additional allowance is zero: no arrival/capture budget is implied.

- Initial mass: m₀ = 4πr³ρ/3.
- Required expelled water: mₚ = m₀(1 − exp(−Δv/vₑ)).
- Available water: m₀ × allocated fraction.
- Maximum ideal Δv with that water: −vₑ ln(1 − allocated fraction).
- Required plant energy per kg: 3 MJ/kg extraction allowance + vₑ²/(2η).
- η = 0.6 for input power to exhaust kinetic power; extraction energy already
  lumps its heating/sublimation/loss allowance.
- Mass flow: usable plant power divided by total energy per kg.
- Thrust: mass flow × effective exhaust speed.
- Operating time: required propellant divided by mass flow.
- Elapsed time estimate: operating time / 0.7 duty cycle; one year = 365.25 days.

Dry hardware/enclosure mass, storage losses, natural outgassing, spin control,
gravity losses, coast time, rendezvous and capture are excluded. A long burn
cannot physically be executed as the instantaneous node impulse; a propagated
low-thrust trajectory must replace that benchmark before assessing a mission.

When required propellant exceeds allocated water, retained water is zero, the
shortfall is explicit, and requested operating/elapsed times are unavailable.
The model never claims completion from an insufficient inventory.

The 0.9 km radius and assumed 500 kg/m³ density follow Table 2 of Ye et al. (2015).
They imply about 1.527 × 10¹² kg, not a measured nucleus mass. The default 50%
water allocation, 3 km/s exhaust speed, 10 GW power, efficiencies and duty cycle
are scenario assumptions. The exhaust-speed control is a propulsion trade, not
a demonstrated operating range for a single steam thruster.

## Primary research

- [Ye et al., Bangs and Meteors from the Quiet Comet 15P/Finlay](https://arxiv.org/abs/1510.06645):
  observations and adopted physical parameters, including the density assumption.
- [NASA NIAC APIS](https://www.nasa.gov/general/apis-asteroid-provided-in-situ-supplies-100mt-of-water-from-a-single-falcon-9/):
  proposed enclosed asteroid processing and solar-thermal return of harvested water.
- [NASA/Honeybee WINE](https://ntrs.nasa.gov/citations/20190027057):
  extraction, cold trapping, feed and steam propulsion demonstrated with simulant
  in a vacuum chamber.
- [Asteroid retrieval study](https://ntrs.nasa.gov/citations/20130010670):
  approximately seven-metre targets; not whole-comet capture validation.
- [JPL astrodynamic parameters](https://ssd.jpl.nasa.gov/astro_par.html):
  solar gravitational parameter and AU.

## Verification

Numerical tests independently compare three-dimensional node velocity rotation,
rocket-equation accounting, energy/power closure, finite inventory, zero Δv,
power scaling, exhaust tradeoffs and invalid inputs. Public browser checks cover
site entry points, responsive layouts, keyboard controls, no-JavaScript output
and storage isolation.
