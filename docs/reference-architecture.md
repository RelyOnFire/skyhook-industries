# Skyhook Reference Architecture v0.2

**Status:** working design frame, not a validated specification.

The purpose of this document is to prevent attractive numbers from becoming inherited facts. Every value below must eventually have a model, source, test result or explicit rationale.

## Current study baseline

| Parameter | Current working position | Status |
| --- | --- | --- |
| Configuration | Freely orbiting rotating momentum-exchange tether | Skyhook study |
| Earth anchor | None | Skyhook study |
| Nominal physical tether length | ~4,000 km total length class | Open target |
| Baseline topology | Two-ended / approximately mass-balanced configuration under study | Open trade |
| Tether construction | Tapered, redundant, sectional | Skyhook study |
| Total system mass | Few-hundred-tonne class remains an aspirational target, not a closed estimate | Open target |
| Dedicated ballast | No multi-million-ton counterweight assumption | Skyhook study |
| Capture | Moving-tip rendezvous | Skyhook study |
| Capture mechanism | Not selected | Open trade |
| Reboost | Electrodynamic reboost is a leading candidate | Open trade |
| Energy source | Solar-electric is a leading candidate | Open trade |
| Failure management | Redundant load paths, sectional isolation and controlled post-failure behavior | Skyhook study |

## Geometry note

For current work, **~4,000 km refers to the physical tether length class**, not one arm extending 4,000 km from the center of mass. A roughly symmetric two-ended configuration is being studied first because it can avoid assuming a separate enormous ballast mass. This is not yet a frozen topology.

Payload capture temporarily changes mass distribution, center of mass and rotational state. Any symmetric baseline therefore still needs a control and operations strategy for the post-capture transient.

## Variables that must close together

- center-of-mass orbit and eccentricity;
- total tether length and arm-length distribution;
- mass distribution along the tether;
- rotation period and tip velocity;
- minimum rendezvous altitude;
- arriving vehicle velocity and flight-path angle;
- payload mass;
- capture shock and transient loads;
- release geometry and delivered delta-v;
- orbital momentum lost per payload;
- post-capture center-of-mass shift and attitude dynamics;
- electrodynamic reboost force and duty cycle;
- time required to restore the pre-capture operating state;
- material allowable specific strength after joints, environment and safety factor;
- taper ratio and local section sizing;
- micrometeoroid and orbital-debris survival probability;
- intentional isolation / sever trajectories;
- deployment, inspection, repair and replacement architecture.

## Required material metric

Published ultimate tensile strength is not enough. The structural model should use an **allowable specific strength** that includes at least:

- manufactured fiber/laminate variability;
- joints and terminations;
- creep and fatigue;
- thermal cycling;
- atomic oxygen and radiation exposure;
- local damage and flaw tolerance;
- required safety factor.

The few-hundred-tonne target should be treated as unproven until a tapered structural model closes using this allowable, not a marketing-strength number.

## Retired inherited values

The following values from the former website should not be reused without a fresh derivation:

- exactly 4,252 km total tether length;
- 64 interwoven Kevlar strands;
- Kevlar at approximately $1/kg;
- a fixed central-hub altitude at one-third Earth radius;
- a 67 m spider-tentacle capture mechanism;
- the 2024 / 2027 / 2031 / 2042 prototype schedule.

## Next numerical work

The next model should close the first-order kinematics and structural requirements together rather than optimize one number in isolation. At minimum it should calculate:

1. center-of-mass orbit needed for a chosen lower-tip rendezvous altitude;
2. rotation rate needed for a chosen lower-tip inertial velocity;
3. upper-tip velocity and altitude;
4. distributed centrifugal and gravity-gradient loading;
5. taper and total mass for a range of allowable specific strengths;
6. payload-induced changes in orbit and rotational state;
7. first-order recovery energy and time.

Only after those quantities are internally consistent should the study freeze a more specific geometry or material system.
