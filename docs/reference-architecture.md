# Skyhook Reference Architecture v0.4

**Status:** first-order kinematic and ideal structural mass screening model, not a validated specification.

This document exists to stop attractive numbers from becoming inherited facts. Every public value should have a model, source, test result or explicit rationale.

Version 0.3 closed the first simple kinematic loop for the current ~4,000 km study length. Version 0.4 adds payload/end-mass tension, an ideal constant-stress tapered tether mass model, facility-mass sensitivity, an instantaneous post-capture center-of-mass calculation, and a first symmetric-versus-asymmetric architecture trade.

Reproducible calculations:

- [`analysis/reference_architecture_v03.py`](../analysis/reference_architecture_v03.py)
- [`analysis/reference_architecture_v04.py`](../analysis/reference_architecture_v04.py)
- generated outputs are committed beside both scripts and verified by CI.

## Current study baseline

| Parameter | Current working position | Status |
| --- | --- | --- |
| Configuration | Freely orbiting rotating momentum-exchange tether | Skyhook study |
| Earth anchor | None | Skyhook study |
| Nominal physical tether length | ~4,000 km total length class | Open target |
| Baseline topology | Two equal ~2,000 km working arms | Preferred screening baseline |
| Tether construction | Tapered, redundant, sectional | Skyhook study |
| Payload class | 5–20 t sensitivity sweep; no frozen payload | Open trade |
| Total system mass | First ideal mass closure now exists; real facility mass remains open | Open target |
| Dedicated ballast | No large dedicated counterweight in the preferred symmetric baseline | Skyhook study |
| Capture | Moving-tip rendezvous | Skyhook study |
| Capture mechanism | Not selected | Open trade |
| Reboost | Electrodynamic reboost is a leading candidate | Open trade |
| Energy source | Solar-electric is a leading candidate | Open trade |
| Failure management | Redundant load paths, sectional isolation and controlled post-failure behavior | Skyhook study |

## Geometry retained from v0.3

For the first screening architecture, **~4,000 km means total physical tether length**, modeled as two equal 2,000 km arms. The capture comparison instant is a radial pass with the lower tip at 100 km altitude and the center of mass initially on a circular orbit.

| Quantity | Screening value |
| --- | ---: |
| Total physical tether length | 4,000 km |
| Arm length | 2,000 km |
| Lower-tip altitude at comparison capture | 100 km |
| Center-of-mass altitude before capture | 2,100 km |
| Upper-tip altitude at the same radial pass | 4,100 km |
| Center-of-mass circular-orbit speed | 6.860 km/s |
| Lower-tip inertial speed comparison | 4.100 km/s |
| Rotational tip speed relative COM | 2.760 km/s |
| Rotation period | 75.9 min |

The **4.1 km/s** lower-tip value remains a historical comparison point, not a Skyhook vehicle requirement. Boeing's HASTOL work used a 100 km / ~4.1 km/s inertial rendezvous in a very different ~600 km architecture.

## What v0.4 adds: absolute tether mass

For an ideal constant-stress arm with terminal design mass `m_tip`, allowable specific strength `S`, and tension-supported acceleration field `a(x)`:

`T_tip = m_tip * a_tip`

`T(x) = T_tip * exp( integral(a dx) / S )`

`linear_mass_density = T / S`

The input `S` is **allowable specific strength**, not ultimate fiber strength. It must already include the chosen derating for safety factor, joints, manufacturing variation, fatigue, environment and other material-system losses.

The model sizes each symmetric arm against the more demanding lower-side radial load case. Both arms are assumed capable of carrying the design payload so the facility does not need a dedicated massive counterweight or a single permanently designated working arm.

### Structural mass multiplier

For the 4.1 km/s comparison geometry:

| Allowable specific strength | One arm mass / terminal design mass | Two-arm tether mass / terminal design mass | Center/tip area ratio |
| ---: | ---: | ---: | ---: |
| 4 MJ/kg | 15.00× | 30.00× | 6.11× |
| 6 MJ/kg | 6.22× | 12.44× | 3.34× |
| 8 MJ/kg | 3.71× | 7.42× | 2.47× |
| 10 MJ/kg | 2.59× | 5.19× | 2.06× |

This is the first useful answer to the old "few hundred tonnes" question: the answer depends very strongly on the **allowable** material system, not simply on choosing a nominal tether length.

## Screening facility-mass closure

To turn the structural multiplier into an absolute facility mass, v0.4 introduces two explicit placeholders:

- **5 t terminal module per end** for local capture hardware / avionics / interfaces;
- **30 t central functional allowance** for hub, power, control, servicing and other near-COM hardware.

These are study allowances, not specifications. They exist so the mass sensitivity can be seen rather than hidden behind a normalized ratio.

For a **15 t payload**:

| Allowable specific strength | Ideal tether mass | Screening dry facility mass |
| ---: | ---: | ---: |
| 4 MJ/kg | 599.9 t | 639.9 t |
| 6 MJ/kg | 248.8 t | 288.8 t |
| 8 MJ/kg | 148.4 t | 188.4 t |
| 10 MJ/kg | 103.8 t | 143.8 t |

Under these idealized assumptions, keeping the dry facility at or below **300 t** requires about:

| Payload | Required allowable specific strength |
| ---: | ---: |
| 5 t | 4.24 MJ/kg |
| 10 t | 5.09 MJ/kg |
| 15 t | 5.86 MJ/kg |
| 20 t | 6.60 MJ/kg |

### Immediate conclusion

A few-hundred-tonne 4,000 km facility is **not ruled out by the first ideal taper model**, but neither is it established. For a 15 t payload, the screening model crosses 300 t near **5.9 MJ/kg allowable specific strength**. That is a requirement for the complete derated material system, not a claim that a current material already provides it in flight-ready form.

Real mass will increase from capture shock margin, redundant load paths, joints, coatings, conductor, minimum manufacturable sections, instrumentation, repair architecture, power hardware and damage tolerance. Some central mass may also be operationally useful as a momentum buffer rather than dead ballast.

## HASTOL sanity check

The v0.4 mass equation was checked against Boeing/NIAC HASTOL numbers rather than accepted on faith.

HASTOL reported:

- a 600 km tether;
- the COM 510 km from the grapple and 90 km from the central station;
- ~3.5 km/s rotational tip speed;
- Spectra 2000 derated characteristic velocity **2.03 km/s** with safety factor 2;
- central-station mass about **110× payload**;
- tether mass about **91× payload**.

For a characteristic velocity `Vc`, specific strength is `S = Vc² / 2`, so the reported derated Spectra figure corresponds to about **2.060 MJ/kg allowable specific strength**.

Using those HASTOL geometry/mass inputs, the v0.4 ideal taper calculation gives:

- grapple-side tether contribution: **71.2× payload**;
- station-side tether contribution: **22.8× payload**;
- total modeled tether: **94.0× payload**.

That is within a few percent of the reported ~91× value. It is not a substitute for HASTOL's full simulation, but it is a useful order-of-magnitude validation that the simple constant-stress integration is behaving sensibly.

Primary source: <https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf>.

## Capture makes facility mass a dynamics variable

A perfectly velocity-matched payload produces no relative-velocity impact impulse in this idealization, but attaching the payload still changes the combined center of mass and its translational orbital state.

For a 15 t payload in the symmetric reference geometry:

| Allowable | Screening dry facility | COM shift toward payload | COM speed loss | Immediate osculating COM perigee |
| ---: | ---: | ---: | ---: | ---: |
| 4 MJ/kg | 639.9 t | 45.8 km | 63 m/s | 1,665 km |
| 6 MJ/kg | 288.8 t | 98.8 km | 136 m/s | 1,196 km |
| 8 MJ/kg | 188.4 t | 147.5 km | 204 m/s | 793 km |
| 10 MJ/kg | 143.8 t | 188.9 km | 261 m/s | 471 km |

The perigee column is **only the osculating orbit of the combined center of mass immediately after idealized capture**. It is not a minimum tether-tip altitude and it does not prove a safe post-capture trajectory. The tether continues rotating while the COM follows the new orbit, so full coupled propagation is required next.

The design lesson is nevertheless important: **making the tether extremely light increases the fraction of system mass represented by each payload and therefore increases the facility-state change per capture.** Stronger material does not make system inertia irrelevant.

## Symmetric vs asymmetric architecture

v0.4 also tests a single payload-rated working arm with a lighter counterarm. The dry structural first moment is balanced by adding mass at the counter tip.

For a 10 t payload, 5 t terminal modules and 30 t central allowance:

| Allowable | Equal 2,000 km single-working-arm dry mass | Added counter-tip balance | Symmetric dual-working-arm dry mass |
| ---: | ---: | ---: | ---: |
| 6 MJ/kg | 216.3 t | 7.2 t | 226.6 t |
| 8 MJ/kg | 143.2 t | 6.2 t | 151.3 t |
| 10 MJ/kg | 111.1 t | 5.4 t | 117.8 t |

So the single-working-arm arrangement saves only about **5%** in this screening case while introducing dedicated balancing mass and losing the operational symmetry of two payload-capable ends.

Making the working arm longer than 2,000 km makes the balance problem worse. At 6 MJ/kg, extending it to 2,400 km raises required counter-tip balance to about **38 t** and the dry facility to about **267 t**.

A mathematically zero-ballast balance solution exists only if the payload-rated working arm is *shorter* than 2,000 km. But then the opposite arm is longer than 2,000 km and, on a full rotation, its lower excursion passes hundreds of kilometres below Earth's reference surface. That geometry is physically invalid.

### Current architecture decision

The symmetric two-working-arm baseline is therefore strengthened rather than weakened by v0.4. It is slightly heavier in the ideal structural model, but it:

- avoids a dedicated tip counterweight;
- keeps both arm lengths compatible with the 100 km minimum-altitude screening geometry;
- makes the dry mass distribution naturally symmetric;
- permits either end to be designed as a working/capture end;
- costs only a modest mass penalty versus the single-working-arm case in the current sweep.

This is still a study conclusion, not a frozen configuration.

## Energy and reboost scale from v0.3

The 4.1 km/s full lower-to-upper reference transfer increases payload Earth-relative mechanical energy by about **61.4 MJ/kg**, or **61.4 GJ per metric tonne**.

Recovering that in one day would require an ideal average of about **0.71 MW per tonne of payload**, before electrodynamic or electrical losses. This remains an intentionally high-energy reference transfer; earlier release can deliver much less energy.

## What remains outside v0.4

The model still omits:

- flexible-body tether dynamics;
- capture shock and finite closing error;
- post-capture coupled orbit/rotation propagation;
- release-phase targeting for LEO, GTO, cislunar or escape missions;
- aerodynamic drag/heating during the low-altitude pass;
- J2 and higher-order gravity;
- detailed terminal hardware sizing;
- redundant strand / laminate topology;
- joints, coatings and repair hardware as explicit masses;
- electrodynamic conductor/collector mass and force model;
- solar-array/storage sizing;
- debris survival probability;
- sever-fragment propagation.

Therefore the 144–640 t screening results above are **not flight mass estimates**. They are the mass scale of an idealized, payload-loaded, constant-stress structural core plus explicit placeholder hardware allowances.

## Failure management remains an analysis problem

The structural direction remains tapered, redundant and sectional, but deliberate severing is not assumed safe. NASA's active orbital-debris standard requires tether analyses to address tether dimensions/materials, sever probability, collision probability, severed-fragment lifetime and disposal behavior: <https://standards.nasa.gov/standard/NASA/NASA-STD-871914>.

A credible sectional design therefore needs propagated fragment trajectories for each intended isolation boundary before any controlled-sever concept can be called a safety feature.

## Retired inherited values

The following values from the former website remain retired unless freshly derived:

- exactly 4,252 km total tether length;
- 64 interwoven Kevlar strands;
- Kevlar at approximately $1/kg;
- a fixed central-hub altitude at one-third Earth radius;
- a 67 m spider-tentacle capture mechanism;
- the 2024 / 2027 / 2031 / 2042 prototype schedule.

## What v0.5 should close

Version 0.4 establishes a first mass/material threshold and strengthens the symmetric two-arm baseline. The next model should focus on **what happens after capture in time**, not just at the capture instant:

1. propagate the COM osculating orbit and tether rotation together through at least one full cycle;
2. track both tip altitudes through the post-capture transient;
3. conserve full system linear and angular momentum with the captured payload;
4. include release phase as a variable and solve target trajectories;
5. determine whether immediate reboost/control is required to protect minimum altitude;
6. add finite capture-velocity error and shock attenuation;
7. introduce a first flexible-tether mode model rather than rigid-body rotation only;
8. then couple the required recovery impulse/energy to an electrodynamic force and power model.

That is the next point at which the facility can start claiming an operational payload/cadence envelope rather than only a structural mass envelope.
