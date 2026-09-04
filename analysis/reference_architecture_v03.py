#!/usr/bin/env python3
"""First-order Skyhook reference-architecture model.

This is deliberately a transparent screening model, not a flight dynamics tool.
It evaluates a symmetric two-ended tether at the instant it is radial to Earth.
The center of mass is assumed to be on a circular orbit. Flexible-body dynamics,
non-spherical gravity, atmosphere, capture transients, payload-induced COM motion,
and electrodynamic recovery are outside this script.

Units are km, s, kg unless noted.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# Earth constants used for first-order screening.
MU_EARTH_KM3_S2 = 398600.4418
R_EARTH_KM = 6371.0

TOTAL_TETHER_LENGTH_KM = 4000.0
HALF_LENGTH_KM = TOTAL_TETHER_LENGTH_KM / 2.0
LOWER_TIP_ALTITUDE_KM = 100.0

# HASTOL Phase I used 4.1 km/s inertial rendezvous speed at 100 km in its
# selected 600-km baseline. It is used here only as a comparison point.
LOWER_TIP_SPEED_CASES_KMS = (3.0, 4.1, 5.0)
ALLOWABLE_SPECIFIC_STRENGTH_CASES_MJ_KG = (2.0, 4.0, 6.0, 8.0, 10.0)


@dataclass(frozen=True)
class Case:
    lower_tip_speed_kms: float
    com_altitude_km: float
    upper_tip_altitude_km: float
    com_speed_kms: float
    com_orbital_period_min: float
    rotational_tip_speed_kms: float
    rotation_period_min: float
    upper_tip_speed_kms: float
    lower_tip_terminal_accel_ms2: float
    upper_tip_terminal_accel_ms2: float
    lower_arm_load_index_mjkg: float
    upper_arm_load_index_mjkg: float
    full_tip_to_tip_energy_gain_mjkg: float


def build_case(lower_tip_speed_kms: float) -> Case:
    l = HALF_LENGTH_KM
    r_low = R_EARTH_KM + LOWER_TIP_ALTITUDE_KM
    r_com = r_low + l
    r_up = r_com + l

    v_com = math.sqrt(MU_EARTH_KM3_S2 / r_com)
    n = math.sqrt(MU_EARTH_KM3_S2 / r_com**3)
    t_orbit_min = 2.0 * math.pi / n / 60.0

    # At the lower-tip rendezvous instant, rotational velocity opposes the
    # COM orbital velocity.
    v_rot = v_com - lower_tip_speed_kms
    if v_rot <= 0:
        raise ValueError("Lower-tip speed must be below COM orbital speed")
    omega = v_rot / l
    t_rot_min = 2.0 * math.pi / omega / 60.0
    v_up = v_com + v_rot

    g_com = MU_EARTH_KM3_S2 / r_com**2
    g_low = MU_EARTH_KM3_S2 / r_low**2
    g_up = MU_EARTH_KM3_S2 / r_up**2

    # Net tether acceleration required at terminal masses, after gravity.
    a_term_low_kms2 = g_low - g_com + omega**2 * l
    a_term_up_kms2 = g_com - g_up + omega**2 * l

    # Characteristic distributed self-load integrals for a uniform arm.
    # They also form the exponent numerator for an ideal constant-stress
    # taper: A_center/A_tip = exp(load_index / allowable_specific_strength).
    rotation_term = 0.5 * omega**2 * l**2
    upper_index = (
        g_com * l
        + rotation_term
        - MU_EARTH_KM3_S2 * (1.0 / r_com - 1.0 / r_up)
    )
    lower_index = (
        MU_EARTH_KM3_S2 * (1.0 / r_low - 1.0 / r_com)
        - g_com * l
        + rotation_term
    )

    # Illustrative mechanical-energy gain if the captured endpoint is carried
    # from the lower radial position to the opposite upper radial position and
    # released there. Operational missions may release earlier.
    eps_low = lower_tip_speed_kms**2 / 2.0 - MU_EARTH_KM3_S2 / r_low
    eps_up = v_up**2 / 2.0 - MU_EARTH_KM3_S2 / r_up
    delta_eps = eps_up - eps_low  # km^2/s^2 == MJ/kg

    return Case(
        lower_tip_speed_kms=lower_tip_speed_kms,
        com_altitude_km=r_com - R_EARTH_KM,
        upper_tip_altitude_km=r_up - R_EARTH_KM,
        com_speed_kms=v_com,
        com_orbital_period_min=t_orbit_min,
        rotational_tip_speed_kms=v_rot,
        rotation_period_min=t_rot_min,
        upper_tip_speed_kms=v_up,
        lower_tip_terminal_accel_ms2=a_term_low_kms2 * 1000.0,
        upper_tip_terminal_accel_ms2=a_term_up_kms2 * 1000.0,
        lower_arm_load_index_mjkg=lower_index,
        upper_arm_load_index_mjkg=upper_index,
        full_tip_to_tip_energy_gain_mjkg=delta_eps,
    )


def taper_ratio(load_index_mjkg: float, allowable_specific_strength_mjkg: float) -> float:
    """Ideal constant-stress center/tip area ratio for distributed self-load.

    This does not size the absolute cross-section. Payload/end-mass tension,
    joints, redundancy, manufacturing minimums, damage allowance and safety
    factors still set absolute area and mass. The input strength must already
    be an *allowable*, not a headline ultimate value.
    """
    return math.exp(load_index_mjkg / allowable_specific_strength_mjkg)


def fmt(x: float, digits: int = 2) -> str:
    return f"{x:.{digits}f}"


def main() -> None:
    cases = [build_case(v) for v in LOWER_TIP_SPEED_CASES_KMS]
    comparison = build_case(4.1)

    print("# Skyhook Reference Architecture v0.3 - model output")
    print()
    print(f"Total physical tether length: {TOTAL_TETHER_LENGTH_KM:.0f} km")
    print(f"Symmetric arm length: {HALF_LENGTH_KM:.0f} km")
    print(f"Lower-tip altitude at rendezvous: {LOWER_TIP_ALTITUDE_KM:.0f} km")
    print(f"COM altitude: {comparison.com_altitude_km:.0f} km")
    print(f"Upper-tip altitude at radial pass: {comparison.upper_tip_altitude_km:.0f} km")
    print(f"COM circular-orbit speed: {comparison.com_speed_kms:.3f} km/s")
    print(f"COM orbital period: {comparison.com_orbital_period_min:.1f} min")
    print()

    print("## Kinematic sensitivity")
    print()
    print("| Lower-tip inertial speed | Rotational tip speed vs COM | Rotation period | Upper-tip inertial speed | Lower-arm self-load index | Full lower-to-upper energy gain |")
    print("| ---: | ---: | ---: | ---: | ---: | ---: |")
    for c in cases:
        print(
            f"| {fmt(c.lower_tip_speed_kms,1)} km/s "
            f"| {fmt(c.rotational_tip_speed_kms,2)} km/s "
            f"| {fmt(c.rotation_period_min,1)} min "
            f"| {fmt(c.upper_tip_speed_kms,2)} km/s "
            f"| {fmt(c.lower_arm_load_index_mjkg,2)} MJ/kg "
            f"| {fmt(c.full_tip_to_tip_energy_gain_mjkg,1)} MJ/kg |"
        )
    print()

    print("## 4.1 km/s comparison case")
    print()
    print(f"Lower-tip terminal tether acceleration requirement: {comparison.lower_tip_terminal_accel_ms2:.2f} m/s^2")
    print(f"Upper-tip terminal tether acceleration requirement: {comparison.upper_tip_terminal_accel_ms2:.2f} m/s^2")
    print(f"Lower-arm distributed self-load index: {comparison.lower_arm_load_index_mjkg:.3f} MJ/kg")
    print(f"Upper-arm distributed self-load index: {comparison.upper_arm_load_index_mjkg:.3f} MJ/kg")
    print(f"Illustrative full tip-to-tip energy gain: {comparison.full_tip_to_tip_energy_gain_mjkg:.3f} MJ/kg")
    print()

    print("## Ideal distributed-self-load taper sensitivity, 4.1 km/s case")
    print()
    print("| Allowable specific strength | Lower arm center/tip area ratio | Upper arm center/tip area ratio |")
    print("| ---: | ---: | ---: |")
    for s in ALLOWABLE_SPECIFIC_STRENGTH_CASES_MJ_KG:
        print(
            f"| {s:.1f} MJ/kg "
            f"| {taper_ratio(comparison.lower_arm_load_index_mjkg, s):.2f}× "
            f"| {taper_ratio(comparison.upper_arm_load_index_mjkg, s):.2f}× |"
        )


if __name__ == "__main__":
    main()
