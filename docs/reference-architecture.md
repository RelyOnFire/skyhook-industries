# Skyhook Reference Architecture v0.3

**Status:** first-order screening model, not a validated specification.

The purpose of this document is to prevent attractive numbers from becoming inherited facts. Every public value should have a model, source, test result or explicit rationale. Version 0.3 closes the first simple kinematic loop for the current ~4,000 km study length and makes the material/recovery consequences visible.

The reproducible calculation is committed at [`analysis/reference_architecture_v03.py`](../analysis/reference_architecture_v03.py).

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

## Geometry fixed for the first screening model

For v0.3, **~4,000 km means total physical tether length**, modeled first as two equal 2,000 km arms. The rendezvous instant is treated as a radial pass with the lower tip at 100 km altitude and the center of mass on a circular orbit.

That gives, before choosing a rendezvous speed:

| Quantity | v0.3 screening value |
| --- | ---: |
| Total physical tether length | 4,000 km |
| Arm length | 2,000 km |
| Lower-tip altitude at rendezvous | 100 km |
| Center-of-mass altitude | 2,100 km |
| Upper-tip altitude at the same radial pass | 4,100 km |
| Center-of-mass circular-orbit speed | 6.860 km/s |
| Center-of-mass orbital period | 129.3 min |

The 100 km altitude is a comparison point, not a frozen operational requirement. HASTOL Phase I used a 100 km / 4.1 km/s inertial rendezvous in its selected **600 km** architecture, so 4.1 km/s is included below as a useful historical comparison rather than imported as a Skyhook requirement. See the Boeing/NIAC Phase I report: <https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf>.

## Kinematic sensitivity

At the lower radial pass, the tether-tip rotational velocity opposes the center-of-mass orbital velocity. For the equal-arm model:

`v_lower = v_COM - omega * arm_length`

The same physical endpoint reaches the upper radial position half a rotation later, where its rotational velocity adds to the center-of-mass orbital velocity.

| Lower-tip inertial speed | Rotational tip speed relative COM | Rotation period | Upper-tip inertial speed | Lower-arm distributed self-load index | Full lower-to-upper energy gain* |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 3.0 km/s | 3.86 km/s | 54.3 min | 10.72 km/s | 10.88 MJ/kg | 76.5 MJ/kg |
| **4.1 km/s** | **2.76 km/s** | **75.9 min** | **9.62 km/s** | **7.24 MJ/kg** | **61.4 MJ/kg** |
| 5.0 km/s | 1.86 km/s | 112.6 min | 8.72 km/s | 5.16 MJ/kg | 49.0 MJ/kg |

\*The energy column is an intentionally aggressive reference case: capture at the lower radial point, carry that endpoint through half a rotation, and release at the opposite upper radial point. An operational mission can release earlier and deliver much less energy.

### Immediate conclusion

**Rendezvous speed is a structural variable, not merely a vehicle variable.** Lowering the tether-tip inertial speed makes the atmospheric vehicle's job easier, but it requires more rotational tip speed, a shorter rotation period and sharply higher tether self-load.

This means the launch vehicle, tether material, taper, facility mass and delivered trajectory have to be optimized together.

## The 4.1 km/s comparison case

Using the middle column only as a reference case:

- center-of-mass speed: **6.860 km/s**;
- rotational tip speed: **2.760 km/s**;
- rotation period: **75.9 min**;
- lower-tip speed: **4.100 km/s** by construction;
- upper-tip speed at the opposite radial pass: **9.619 km/s**;
- lower-arm distributed self-load index: **7.241 MJ/kg**;
- upper-arm distributed self-load index: **5.930 MJ/kg**.

At 4,100 km altitude, local Earth escape speed is about **8.73 km/s** in this spherical-Earth model. The 9.62 km/s upper-tip value therefore shows that a 4,000 km symmetric tether at this rotation rate is capable of substantially more than ordinary LEO insertion if a payload is carried all the way to the opposite tip. That is not automatically desirable. Release phase and mission destination become architecture variables.

## What the self-load index means

The self-load index is the exact radial-pass integral, in this simplified model, of the acceleration that internal tether tension must supply against both rotation and Earth's gravity gradient. Its units are specific energy: km²/s², numerically equal to MJ/kg.

For an ideal constant-stress taper under distributed self-load alone:

`A_center / A_tip = exp(load_index / allowable_specific_strength)`

The strength input must be **allowable specific strength**, after joints, manufacturing variation, environment, fatigue and required safety factor. It is not a published ultimate fiber number.

For the 4.1 km/s comparison case:

| Allowable specific strength | Lower arm center/tip area ratio | Upper arm center/tip area ratio |
| ---: | ---: | ---: |
| 2 MJ/kg | 37.37× | 19.39× |
| 4 MJ/kg | 6.11× | 4.40× |
| 6 MJ/kg | 3.34× | 2.69× |
| 8 MJ/kg | 2.47× | 2.10× |
| 10 MJ/kg | 2.06× | 1.81× |

These are **not tether mass estimates**. They include distributed self-load only. Payload/end-mass tension sets the absolute tip cross-section, while redundancy, joints, minimum manufacturable section, damage allowance, capture shock and safety factor all add mass. Payload capture also changes the center of mass and rotational state.

The table does, however, make one point unambiguous: a few-hundred-tonne 4,000 km tether cannot be justified from headline tensile strength alone. It needs a material system with high *allowable* specific strength and a full tapered mass model.

NASA's tether design criteria explicitly treat strength, dynamics, materials, severing by micrometeoroids/debris, safety and reliability as coupled design concerns: <https://ntrs.nasa.gov/citations/19970027081>.

## Energy and reboost scale

In the 4.1 km/s full lower-to-upper reference transfer, the payload's Earth-relative mechanical energy increases by about **61.4 MJ/kg**, or **61.4 GJ per metric tonne of payload**.

Recovering that amount of facility energy in one day would require an ideal average input of about **0.71 MW per tonne of payload**, before electrodynamic, power-conversion or operational losses. A ten-tonne payload would therefore correspond to roughly 7.1 MW average for a one-day ideal recovery in this deliberately high-energy reference transfer.

This is why reboost cannot be described merely as a propulsion choice. **Payload throughput is a power-system requirement.** Earlier release, lower delivered energy, incoming momentum exchange and longer recovery time all change the number substantially.

HASTOL likewise treated solar-powered electrodynamic recovery as a multi-day cycle dependent on payload trajectory and available power; its geometry and mass were very different from the present Skyhook study and should not be conflated with it.

## Assumptions and omissions in v0.3

The model currently assumes:

- spherical Earth;
- center of mass in a circular orbit;
- two equal 2,000 km arms;
- tether instantaneously radial at capture/release comparison points;
- rigid kinematics for screening purposes;
- no atmosphere or aerodynamic loading;
- no J2 or higher-order gravity;
- no flexible-body modes;
- no capture shock;
- no payload-induced center-of-mass shift during the calculation;
- no terminal hardware mass in the taper ratios;
- no electrodynamic force model;
- no deployment dynamics.

Therefore none of the v0.3 numbers should be presented as a flight specification.

## Failure management remains an analysis problem

The structural direction remains tapered, redundant and sectional, but deliberate severing is not assumed safe. NASA's active orbital-debris standard requires tether analyses to address tether dimensions/materials, sever probability, collision probability, severed-fragment lifetime and disposal behavior. See NASA-STD-8719.14C: <https://standards.nasa.gov/standard/NASA/NASA-STD-871914>.

A credible sectional design therefore needs propagated fragment trajectories for each intended break/isolation boundary before any controlled-sever concept can be called a safety feature.

## Retired inherited values

The following values from the former website remain retired unless freshly derived:

- exactly 4,252 km total tether length;
- 64 interwoven Kevlar strands;
- Kevlar at approximately $1/kg;
- a fixed central-hub altitude at one-third Earth radius;
- a 67 m spider-tentacle capture mechanism;
- the 2024 / 2027 / 2031 / 2042 prototype schedule.

## What v0.4 must close

Version 0.3 is enough to show that the 4,000 km concept is kinematically powerful and structurally unforgiving. The next model should add the quantities that determine whether it is practical:

1. payload mass and terminal capture-hardware mass;
2. ideal tapered tether mass for a sweep of allowable specific strengths;
3. asymmetric arm-length and mass-distribution trades;
4. payload-induced center-of-mass shift and rotational-state change;
5. capture impulse / shock attenuation;
6. release phase required for target LEO, GTO, cislunar and escape trajectories;
7. flexible-tether dynamics and gravity-gradient coupling through the full rotation;
8. electrodynamic force, conductor mass, collection architecture and orbit/inclination dependence;
9. solar-array/storage sizing versus mission cadence;
10. debris survival, sectional isolation and sever-fragment propagation.

Only after those quantities are internally consistent should the study claim a payload class, total system mass or operational cadence.
