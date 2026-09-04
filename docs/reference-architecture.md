# Skyhook Reference Architecture v0.1

**Status:** working design frame, not a validated specification.

The purpose of this document is to prevent attractive numbers from becoming inherited facts. Every value below must eventually have a model, source, test result or explicit rationale.

## Current design direction

| Parameter | Current working position | Status |
| --- | --- | --- |
| Configuration | Freely orbiting rotating momentum-exchange tether | Design direction |
| Earth anchor | None | Design direction |
| Nominal total tether length | ~4,000 km | Open target |
| Tether construction | Tapered, redundant, sectional | Design direction |
| Total system mass | Few-hundred-tonne class | Open target; unvalidated |
| Dedicated ballast | No multi-million-ton counterweight assumption | Design direction |
| Capture | Moving-tip rendezvous | Design direction |
| Capture mechanism | Not selected | Open trade |
| Reboost | Electrodynamic reboost is a leading candidate | Open trade |
| Energy source | Solar-electric is a leading candidate | Open trade |
| Failure management | Redundant load paths, isolation and controlled post-failure behavior | Design direction |

## Variables that must close together

- center-of-mass orbit and eccentricity;
- total tether length and taper ratio;
- mass distribution along the tether;
- rotation period and tip velocity;
- minimum rendezvous altitude;
- arriving vehicle velocity and flight-path angle;
- payload mass;
- capture shock and transient loads;
- release geometry and delivered delta-v;
- orbital momentum lost per payload;
- electrodynamic reboost force and duty cycle;
- time required to restore the pre-capture orbit;
- material specific strength and safety factor;
- micrometeoroid and orbital-debris survival probability;
- intentional isolation / sever trajectories;
- deployment and maintenance architecture.

## Retired inherited values

The following values from the former website should not be reused without a fresh derivation:

- exactly 4,252 km total tether length;
- 64 interwoven Kevlar strands;
- Kevlar at approximately $1/kg;
- a fixed central-hub altitude at one-third Earth radius;
- a 67 m spider-tentacle capture mechanism;
- the 2024 / 2027 / 2031 / 2042 prototype schedule.

## Next analysis

The first numerical model should determine whether the present ~4,000 km architecture closes at all. At minimum it should solve orbital geometry, rotation, tip-relative velocity, structural load distribution and momentum exchange as one coupled problem before optimizing materials or capture hardware.
