# E0 electrodynamic recovery — model D1p-0.4.0

Status: an implemented educational actuator experiment, not a validated plasma,
thermal or flight-control model. All numerical state and energy accounting uses
SI units. The current published main site is not modified by this review branch.

## What the new choice does

Two independently driven aluminum-like conductor segments follow the outer part
of the two strength-tether arms. Each extends inward from its terminal. Currents
close through an assumed plasma circuit, not through a physical return conductor
that would cancel the useful force. Collectors, emitters, wiring, isolation,
converters and the power supply are NOT engineered here. Their central mass is
an explicit user budget. Plasma current availability is an assumption.

Conductor mass is distributed at its actual position. It contributes to mass,
inertia, gravity, external force and structural loading. It provides no strength
credit. The structural material selector still controls only the strength cable.
The automatic radial resizing shortcut is disabled for E0: its old formula does
not include the new conductor system. Manual dimensions remain evaluable.

Chemical and Coast retain their existing dynamical treatment. Only Chemical
carries a propellant budget. Coast removes the E0 conductor/hardware mass as well
as fuel; it is not the same mass as an unpowered E0 system. The fixed base hub
and terminal budget remains present in all modes.

## Declared E0 simplifications

- Planar equatorial orbit; aligned dipole field normal to the numerical plane.
  Surface field magnitude 30 μT, decreasing as r^-3. Not IGRF or a real epoch.
- Corotating plasma at angular rate 7.292115e-5 rad/s. No density or collection
  solver; the chosen current ceiling is not an achievable-current prediction.
- Fixed resistivity 2.82e-8 Ωm and density 2700 kg/m³; ideal aluminum-like
  reference properties, not a selected alloy or a temperature-dependent model.
- Combined contact drop 100 V per circuit; conversion efficiency 90%. These
  are visible scenario assumptions, not claimed hardware measurements.
- Continuous available bus-power cap, no eclipse, array pointing, battery or
  automatically scaled power-system mass. Hardware mass stays a user input.
- Current changes are algebraic. No inductance, slew limit, insulation rating,
  arcing, deployment, radiation, thermal balance or flexible-body solution.
- Six-hour mission horizon, the same two independent ideal approaches as model
  0.3, and the same radius/speed/spin readiness tests. Not an unlimited service.

Named MXER concepts remain reference-only. This E0 actuator is not an imported
historical MXER facility and should not be used as evidence for one.

## Circuit and force calculation

For each conductor element of signed current I and direction u:

```
dF = I (u × B) ds
v_plasma = Ω_Earth × r
k = ∫ (u × B) · (v_element − v_plasma) ds = −motional EMF
R = resistivity × conductor_length / conductor_area
U_drive = R I + k + sign(I) V_contact
P_terminal = k I + R I² + V_contact |I|
P_bus = max(P_terminal, 0) / efficiency
P_dump = max(−P_terminal, 0)
```

Mechanical power is evaluated with the actual material-point inertial velocity.
Environment exchange is evaluated with the same force at the assumed plasma
velocity. The simulator integrates the independent quantities:

```
E_bus + E_environment = W_mechanical + E_heat_and_dump
```

The signed mechanical work includes both orbit and spin. It is NOT identical
to the first payload's energy gain. Generated electricity is dumped; it cannot
silently refill an energy store. No thermal survival follows from this ledger.

The controller projects the desired translational force onto the available
transverse axis and solves for two currents that also request a spin torque.
Twice the transverse projection is a declared phase-average compensation, not
an optimal-control result. Each current is clipped by current and conservative
voltage bounds. Both are then jointly scaled down to satisfy the total bus cap.
The actual summed Lorentz force and moment, never the unattainable request, are
applied to the equations of motion. There is no arbitrary axial EDT thrust.

A zero power, current or voltage cap opens both drives. Conductor and hardware
mass remain. The controller may brake/dump during some intervals. More power or
current does not guarantee a shorter or successful mission. The conservative
voltage limiter does not establish safe open-circuit insulation at high EMF.

## Playable reference experiment

Load the explicit example in Recovery → Electrodynamic:

| Input | Value |
| --- | ---: |
| Total strength tether span | 200 km |
| Initial circular altitude | 700 km |
| Payload per shipment | 0.5 t |
| Strength tether | Zylon HM profile, 70 mm² uniform, safety factor 2 |
| Rotational tip speed relative to COM | 0.8 km/s |
| Conductor per arm | 50 km, 10 mm² |
| Continuous bus cap | 500 kW |
| Circuit current / drive-voltage caps | 20 A / 30 kV |
| Central electrical-hardware mass budget | 8 t |
| Added conductor mass | 2.7 t |
| Total dry facility | 66.54 t |

At the default 2 s step / 48 strength-tether cells, two transfers complete in
about 2.01 simulated hours. The bus supplies about 0.3743 MWh (1.3474 GJ), with
0.5880 GJ signed actuator work, 0.7998 GJ heat/dump losses and 0.0403 GJ signed
environment exchange. Values are rounded descriptions, not stored truth for CI;
tests recalculate them and test balances instead of granting a preset success.

The power sweep varies ONLY the bus cap, retaining conductor geometry, assumed
current availability and hardware mass. At 500 and 1000 kW the example gives the
same outcome because another cap constrains current. This is not a claim that
1000 kW is universally unnecessary or that actual 500 kW hardware fits 8 t.

A zero-power copy can also reach the second readiness window later for this
small payload. That is natural motion entering the prescribed tolerance window,
not recovered energy, a free reset, or evidence of indefinite repeat operation.
Do not hide an unfavorable trade or tune the success indicator to favor E0.

## UI and saved designs

Only E0 exposes electrical controls. Its recorder separates bus power/current,
Lorentz force, heat/dump rate and accumulated input. The debrief and exported
report contain the energy ledger and actual added mass. Unrun edits cannot
relabel accepted-flight readings. Green outer segments indicate conductors;
no chemical rocket plume is shown for E0. The 3D E0 plane is genuinely equatorial;
other modes retain the existing illustrative 28-degree display tilt.

Model 0.1/0.2/0.3 inputs require review and fresh calculation. Schema remains 2.
Migration supplies explicit dormant E0 inputs without adding electrical mass to
existing Coast or Chemical designs. Runtime dependencies are unchanged.

The three existing Flight School challenges exclude E0 from eligibility. They
were designed around the earlier material/propellant envelope; E0 can be explored
in the sandbox without awarding challenge credit for unsupported assumptions.

## Verification

`npm run test:lab`: 46 numerical/configuration tests. New coverage includes:
field falloff; conductor mass/inertia; external force and torque; current,
voltage and bus caps; instantaneous and integrated energy balance; powered
mechanical-energy work; zero-actuation cases; dissipation instead of free energy;
no spurious axial Lorentz force; timestep/quadrature convergence; two independent
checked incoming encounters; saved-design migration and challenge eligibility.

`tests/lab-electrodynamic.browser.py` exercises actual worker-calculated flights,
resource control isolation, conductor geometry rejection across tabs, JSON energy
ledger export, four power-study variants, stale-result separation and desktop/
mobile Method/control/recorder layouts. It supports an explicitly labeled isolated
component harness, but CI runs native localhost/module workers and requires WebGL.

The existing native Flight Studio regression remains enabled. Browser checks and
algebraic tests are not plasma-model validation or a qualified flight design.

## Primary and institutional references

- Khazanov, Krivorutsky & Gallagher (2006), *Electrodynamic Bare Tether Systems as
  a Thruster for the Momentum-Exchange/Electrodynamic Reboost (MXER) Project*.
  NASA NTRS: https://ntrs.nasa.gov/citations/20070013898 . Supports treating
  current collection and mission parameters as coupled, not assumed proven.
- Dobrowolny et al. (1986), *Electrodynamic Interactions*.
  NASA NTRS: https://ntrs.nasa.gov/citations/19860018942 . Equivalent-circuit and
  contact/sheath context, not validation of this particular numerical actuator.
- BYU Cleanroom resistivity reference: https://www.cleanroom.byu.edu/Resistivities .
  Aluminum-like reference resistivity at 20°C only, not in-orbit thermal behavior.
