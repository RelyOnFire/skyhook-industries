#!/usr/bin/env python3
"""Skyhook Reference Architecture v0.4: first-order mass closure.

This extends v0.3 by adding terminal/payload tension to an ideal constant-stress
taper, a symmetric two-working-arm facility mass sweep, instantaneous
post-capture center-of-mass/orbit bookkeeping, and a simple asymmetric
working-arm/counterarm trade.

It remains a screening model, not a flexible-body flight dynamics code.

Units:
- distances: km
- speeds: km/s
- masses in public tables: metric tonnes
- allowable specific strength: MJ/kg == km^2/s^2

The material input is an *allowable* specific strength. It must already include
whatever derating is chosen for safety factor, joints, manufacturing,
environment, fatigue, etc. The model does not map these values to named
materials.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

MU_EARTH_KM3_S2 = 398600.4418
R_EARTH_KM = 6371.0

TOTAL_TETHER_LENGTH_KM = 4000.0
SYMMETRIC_ARM_LENGTH_KM = TOTAL_TETHER_LENGTH_KM / 2.0
LOWER_TIP_ALTITUDE_KM = 100.0
LOWER_TIP_SPEED_KMS = 4.1

# Explicit screening allowances, not frozen hardware specifications.
TIP_MODULE_T = 5.0
CENTRAL_FUNCTIONAL_ALLOWANCE_T = 30.0

PAYLOAD_CASES_T = (5.0, 10.0, 15.0, 20.0)
ALLOWABLE_SPECIFIC_STRENGTH_CASES_MJ_KG = (4.0, 6.0, 8.0, 10.0)

INTEGRATION_STEPS = 20000


@dataclass(frozen=True)
class ArmCoefficients:
    mass_ratio_per_terminal_mass: float
    first_moment_ratio_km: float
    center_to_tip_area_ratio: float
    terminal_accel_ms2: float


@dataclass(frozen=True)
class FacilityCase:
    payload_t: float
    allowable_mjkg: float
    tether_mass_t: float
    dry_facility_mass_t: float
    dry_to_payload_ratio: float
    post_capture_com_shift_km: float
    post_capture_com_speed_loss_ms: float
    post_capture_com_perigee_km: float
    post_capture_com_apogee_km: float


def lower_side_effective_accel_kms2(
    y_from_hub_km: float,
    r_com_km: float,
    omega_s: float,
) -> float:
    """Tension-supported acceleration for an arm when it points toward Earth."""
    g_com = MU_EARTH_KM3_S2 / r_com_km**2
    r = r_com_km - y_from_hub_km
    return MU_EARTH_KM3_S2 / r**2 - g_com + omega_s**2 * y_from_hub_km


def upper_side_effective_accel_kms2(
    y_from_hub_km: float,
    r_com_km: float,
    omega_s: float,
) -> float:
    """Tension-supported acceleration for an arm when it points away from Earth."""
    g_com = MU_EARTH_KM3_S2 / r_com_km**2
    r = r_com_km + y_from_hub_km
    return g_com - MU_EARTH_KM3_S2 / r**2 + omega_s**2 * y_from_hub_km


def arm_coefficients(
    length_km: float,
    r_com_km: float,
    omega_s: float,
    allowable_mjkg: float,
    side: str = "lower",
) -> ArmCoefficients:
    """Numerically integrate an ideal constant-stress tapered arm.

    The terminal design mass is normalized to 1 kg. The result therefore gives
    arm structural mass / terminal design mass directly.

    T_tip = m_terminal * a_tip
    T(x) = T_tip * exp(integral(a dx) / S)
    linear_density = T / S

    where S is allowable specific strength.
    """
    accel = (
        lower_side_effective_accel_kms2
        if side == "lower"
        else upper_side_effective_accel_kms2
    )

    dx = length_km / INTEGRATION_STEPS
    a_tip = accel(length_km, r_com_km, omega_s)

    prev_a = a_tip
    prev_y = length_km
    load_integral = 0.0
    prev_linear_mass_ratio = a_tip / allowable_mjkg

    mass_ratio = 0.0
    moment_ratio = 0.0

    for i in range(1, INTEGRATION_STEPS + 1):
        y = length_km - i * dx
        a = accel(y, r_com_km, omega_s)
        load_integral += 0.5 * (prev_a + a) * dx

        tension_per_terminal_mass = a_tip * math.exp(
            load_integral / allowable_mjkg
        )
        linear_mass_ratio = tension_per_terminal_mass / allowable_mjkg

        mass_ratio += 0.5 * (
            prev_linear_mass_ratio + linear_mass_ratio
        ) * dx
        moment_ratio += 0.5 * (
            prev_linear_mass_ratio * prev_y + linear_mass_ratio * y
        ) * dx

        prev_a = a
        prev_y = y
        prev_linear_mass_ratio = linear_mass_ratio

    return ArmCoefficients(
        mass_ratio_per_terminal_mass=mass_ratio,
        first_moment_ratio_km=moment_ratio,
        center_to_tip_area_ratio=math.exp(load_integral / allowable_mjkg),
        terminal_accel_ms2=a_tip * 1000.0,
    )


def baseline_geometry() -> tuple[float, float, float]:
    r_com = (
        R_EARTH_KM
        + LOWER_TIP_ALTITUDE_KM
        + SYMMETRIC_ARM_LENGTH_KM
    )
    v_com = math.sqrt(MU_EARTH_KM3_S2 / r_com)
    omega = (v_com - LOWER_TIP_SPEED_KMS) / SYMMETRIC_ARM_LENGTH_KM
    return r_com, v_com, omega


def osculating_orbit_from_tangential_state(
    r_km: float,
    v_kms: float,
) -> tuple[float, float, float]:
    """Return eccentricity, perigee altitude, apogee altitude."""
    specific_energy = v_kms**2 / 2.0 - MU_EARTH_KM3_S2 / r_km
    semi_major_axis = -MU_EARTH_KM3_S2 / (2.0 * specific_energy)
    angular_momentum = r_km * v_kms
    eccentricity = math.sqrt(
        max(
            0.0,
            1.0
            + 2.0
            * specific_energy
            * angular_momentum**2
            / MU_EARTH_KM3_S2**2,
        )
    )
    r_perigee = semi_major_axis * (1.0 - eccentricity)
    r_apogee = semi_major_axis * (1.0 + eccentricity)
    return (
        eccentricity,
        r_perigee - R_EARTH_KM,
        r_apogee - R_EARTH_KM,
    )


def post_capture_com_state(
    dry_facility_mass_t: float,
    payload_t: float,
    pickup_arm_length_km: float,
    r_com_km: float,
    v_com_kms: float,
) -> tuple[float, float, float, float, float]:
    """Instantaneous perfect-velocity-match capture bookkeeping.

    Because the payload is assumed to match the tip velocity exactly, there is
    no impulsive relative-velocity shock in this idealized calculation.
    Adding the payload still shifts the combined center of mass and lowers its
    translational orbital velocity. Flexible dynamics and the later rotating
    tip trajectory are not modeled.
    """
    payload_fraction = payload_t / (dry_facility_mass_t + payload_t)

    combined_r = r_com_km - payload_fraction * pickup_arm_length_km
    combined_v = (
        dry_facility_mass_t * v_com_kms
        + payload_t * LOWER_TIP_SPEED_KMS
    ) / (dry_facility_mass_t + payload_t)

    eccentricity, perigee_km, apogee_km = (
        osculating_orbit_from_tangential_state(combined_r, combined_v)
    )

    return (
        payload_fraction * pickup_arm_length_km,
        (v_com_kms - combined_v) * 1000.0,
        eccentricity,
        perigee_km,
        apogee_km,
    )


def symmetric_facility_case(
    payload_t: float,
    allowable_mjkg: float,
) -> FacilityCase:
    """Two identical arms, each capable of carrying the design payload.

    Each arm is sized against the more demanding lower-side radial load case
    for a terminal design mass equal to payload + tip module. The dry facility
    carries no payload before capture.
    """
    r_com, v_com, omega = baseline_geometry()
    arm = arm_coefficients(
        SYMMETRIC_ARM_LENGTH_KM,
        r_com,
        omega,
        allowable_mjkg,
        side="lower",
    )

    terminal_design_mass_t = payload_t + TIP_MODULE_T
    tether_mass_t = (
        2.0
        * arm.mass_ratio_per_terminal_mass
        * terminal_design_mass_t
    )
    dry_facility_mass_t = (
        tether_mass_t
        + 2.0 * TIP_MODULE_T
        + CENTRAL_FUNCTIONAL_ALLOWANCE_T
    )

    shift, dv_ms, _, perigee, apogee = post_capture_com_state(
        dry_facility_mass_t,
        payload_t,
        SYMMETRIC_ARM_LENGTH_KM,
        r_com,
        v_com,
    )

    return FacilityCase(
        payload_t=payload_t,
        allowable_mjkg=allowable_mjkg,
        tether_mass_t=tether_mass_t,
        dry_facility_mass_t=dry_facility_mass_t,
        dry_to_payload_ratio=dry_facility_mass_t / payload_t,
        post_capture_com_shift_km=shift,
        post_capture_com_speed_loss_ms=dv_ms,
        post_capture_com_perigee_km=perigee,
        post_capture_com_apogee_km=apogee,
    )


def allowable_for_target_dry_mass(
    payload_t: float,
    target_dry_mass_t: float,
) -> float:
    low = 0.5
    high = 50.0
    for _ in range(80):
        mid = 0.5 * (low + high)
        if symmetric_facility_case(payload_t, mid).dry_facility_mass_t > target_dry_mass_t:
            low = mid
        else:
            high = mid
    return high


def single_working_arm_balanced_case(
    working_arm_length_km: float,
    payload_t: float,
    allowable_mjkg: float,
) -> tuple[float, float, float, float, float]:
    """One payload-rated working arm plus a lighter counterarm.

    The total physical tether remains 4,000 km. The longer arm is the pickup
    arm so no tip on a full rotation goes below the 100 km screening altitude.

    The working arm is structurally sized for payload + tip module, but the
    payload is absent in the dry pre-capture balance. Counter-tip balance mass
    is solved so the dry first moment about the hub is zero.
    """
    counter_arm_length_km = TOTAL_TETHER_LENGTH_KM - working_arm_length_km
    r_com = R_EARTH_KM + LOWER_TIP_ALTITUDE_KM + working_arm_length_km
    v_com = math.sqrt(MU_EARTH_KM3_S2 / r_com)
    omega = (v_com - LOWER_TIP_SPEED_KMS) / working_arm_length_km

    working = arm_coefficients(
        working_arm_length_km,
        r_com,
        omega,
        allowable_mjkg,
        side="lower",
    )
    counter = arm_coefficients(
        counter_arm_length_km,
        r_com,
        omega,
        allowable_mjkg,
        side="lower",
    )

    working_terminal_design_t = payload_t + TIP_MODULE_T
    working_structure_t = (
        working.mass_ratio_per_terminal_mass * working_terminal_design_t
    )

    # Dry first moment: payload is not aboard before capture, but the working
    # arm has already been built thick enough to carry it.
    working_dry_moment_t_km = (
        TIP_MODULE_T * working_arm_length_km
        + working.first_moment_ratio_km * working_terminal_design_t
    )

    # Counterarm structural mass/moment scale linearly with terminal mass.
    counter_terminal_total_t = working_dry_moment_t_km / (
        counter_arm_length_km + counter.first_moment_ratio_km
    )
    balance_mass_t = counter_terminal_total_t - TIP_MODULE_T

    counter_structure_t = (
        counter.mass_ratio_per_terminal_mass * counter_terminal_total_t
    )

    dry_facility_mass_t = (
        CENTRAL_FUNCTIONAL_ALLOWANCE_T
        + TIP_MODULE_T
        + counter_terminal_total_t
        + working_structure_t
        + counter_structure_t
    )

    counter_tip_min_altitude_km = (
        r_com - counter_arm_length_km - R_EARTH_KM
    )

    return (
        balance_mass_t,
        working_structure_t,
        counter_structure_t,
        dry_facility_mass_t,
        counter_tip_min_altitude_km,
    )


def zero_ballast_balance_length(
    payload_t: float,
    allowable_mjkg: float,
) -> tuple[float, float]:
    """Find the working-arm length that balances with zero added ballast.

    This search intentionally allows physically invalid lengths below 2,000 km
    so we can show whether a no-ballast asymmetric solution violates the
    minimum-altitude geometry.
    """
    low = 1400.0
    high = 2000.0

    for _ in range(70):
        mid = 0.5 * (low + high)
        balance_mass_t, _, _, _, _ = single_working_arm_balanced_case(
            mid, payload_t, allowable_mjkg
        )
        if balance_mass_t < 0.0:
            low = mid
        else:
            high = mid

    _, _, _, _, counter_tip_min_altitude_km = (
        single_working_arm_balanced_case(
            high, payload_t, allowable_mjkg
        )
    )
    return high, counter_tip_min_altitude_km


def hastol_sanity_check() -> tuple[float, float, float, float]:
    """Recreate the order of magnitude of the HASTOL Phase-I/II mass result.

    Boeing reported:
    - 600 km total tether
    - COM 510 km from grapple and 90 km from central station
    - 3.5 km/s nominal rotational tip speed
    - Spectra 2000 derated characteristic velocity 2.03 km/s (SF=2)
    - central station mass about 110x payload
    - tether mass about 91x payload

    A characteristic velocity Vc maps to specific strength S = Vc^2 / 2.
    """
    r_com = R_EARTH_KM + 610.0
    omega = 3.5 / 510.0
    allowable_mjkg = 2.03**2 / 2.0

    grapple_arm = arm_coefficients(
        510.0, r_com, omega, allowable_mjkg, side="lower"
    )
    station_arm = arm_coefficients(
        90.0, r_com, omega, allowable_mjkg, side="upper"
    )

    predicted_total_tether_to_payload = (
        grapple_arm.mass_ratio_per_terminal_mass
        + 110.0 * station_arm.mass_ratio_per_terminal_mass
    )

    return (
        allowable_mjkg,
        grapple_arm.mass_ratio_per_terminal_mass,
        110.0 * station_arm.mass_ratio_per_terminal_mass,
        predicted_total_tether_to_payload,
    )


def main() -> None:
    r_com, v_com, omega = baseline_geometry()

    print("# Skyhook Reference Architecture v0.4 - model output")
    print()
    print("## Screening baseline")
    print()
    print(f"Total physical tether length: {TOTAL_TETHER_LENGTH_KM:.0f} km")
    print(f"Symmetric arm length: {SYMMETRIC_ARM_LENGTH_KM:.0f} km")
    print(f"Lower-tip altitude at capture comparison: {LOWER_TIP_ALTITUDE_KM:.0f} km")
    print(f"Lower-tip inertial speed comparison: {LOWER_TIP_SPEED_KMS:.1f} km/s")
    print(f"COM altitude before capture: {r_com - R_EARTH_KM:.0f} km")
    print(f"COM circular speed before capture: {v_com:.3f} km/s")
    print(f"Rotation period: {2.0 * math.pi / omega / 60.0:.1f} min")
    print(f"Tip-module screening allowance: {TIP_MODULE_T:.1f} t per end")
    print(f"Central functional screening allowance: {CENTRAL_FUNCTIONAL_ALLOWANCE_T:.1f} t")
    print()

    print("## HASTOL order-of-magnitude sanity check")
    print()
    h_s, h_lower, h_upper, h_total = hastol_sanity_check()
    print(f"HASTOL derated characteristic velocity 2.03 km/s -> allowable specific strength: {h_s:.3f} MJ/kg")
    print(f"v0.4 modeled 510 km grapple-side tether mass ratio: {h_lower:.1f}x payload")
    print(f"v0.4 modeled 90 km station-side contribution with 110x-payload station: {h_upper:.1f}x payload")
    print(f"v0.4 modeled total tether ratio: {h_total:.1f}x payload")
    print("Boeing/NIAC reported tether ratio: approximately 91x payload")
    print()

    print("## Symmetric two-working-arm structural mass multiplier")
    print()
    print("| Allowable specific strength | One arm mass / terminal design mass | Two-arm tether mass / terminal design mass | Center/tip area ratio |")
    print("| ---: | ---: | ---: | ---: |")
    for s in ALLOWABLE_SPECIFIC_STRENGTH_CASES_MJ_KG:
        arm = arm_coefficients(
            SYMMETRIC_ARM_LENGTH_KM, r_com, omega, s, side="lower"
        )
        print(
            f"| {s:.1f} MJ/kg "
            f"| {arm.mass_ratio_per_terminal_mass:.2f}x "
            f"| {2.0 * arm.mass_ratio_per_terminal_mass:.2f}x "
            f"| {arm.center_to_tip_area_ratio:.2f}x |"
        )
    print()

    print("## Symmetric facility dry-mass sweep")
    print()
    print("Assumes both arms are payload-rated, 5 t terminal module per end, and 30 t central functional allowance.")
    print()
    print("| Allowable | Payload | Ideal tether mass | Screening dry facility mass | Dry mass / payload |")
    print("| ---: | ---: | ---: | ---: | ---: |")
    for s in ALLOWABLE_SPECIFIC_STRENGTH_CASES_MJ_KG:
        for p in PAYLOAD_CASES_T:
            c = symmetric_facility_case(p, s)
            print(
                f"| {s:.1f} MJ/kg | {p:.0f} t "
                f"| {c.tether_mass_t:.1f} t "
                f"| {c.dry_facility_mass_t:.1f} t "
                f"| {c.dry_to_payload_ratio:.1f}x |"
            )
    print()

    print("## Allowable specific strength needed to keep screening dry mass <= 300 t")
    print()
    print("| Payload | Required allowable specific strength |")
    print("| ---: | ---: |")
    for p in PAYLOAD_CASES_T:
        required = allowable_for_target_dry_mass(p, 300.0)
        print(f"| {p:.0f} t | {required:.2f} MJ/kg |")
    print()

    print("## Instantaneous post-capture COM sensitivity - 15 t payload")
    print()
    print("This is the combined center-of-mass osculating orbit immediately after an ideal velocity-matched capture. It is not a minimum tether-tip altitude or a full dynamics result.")
    print()
    print("| Allowable | Dry facility | COM shift toward payload | COM speed loss | Osculating COM perigee |")
    print("| ---: | ---: | ---: | ---: | ---: |")
    for s in ALLOWABLE_SPECIFIC_STRENGTH_CASES_MJ_KG:
        c = symmetric_facility_case(15.0, s)
        print(
            f"| {s:.1f} MJ/kg "
            f"| {c.dry_facility_mass_t:.1f} t "
            f"| {c.post_capture_com_shift_km:.1f} km "
            f"| {c.post_capture_com_speed_loss_ms:.0f} m/s "
            f"| {c.post_capture_com_perigee_km:.0f} km |"
        )
    print()

    print("## Single-working-arm / counterarm trade - 10 t payload")
    print()
    print("The working arm is payload-rated; the counterarm is not. Added balance mass is solved from dry first-moment balance. Physically admissible pickup-arm lengths are >= 2,000 km so the opposite tip never dips below the 100 km screening altitude during a full rotation.")
    print()
    print("| Allowable | Working arm | Added counter-tip balance | Dry facility | Counter-tip minimum altitude |")
    print("| ---: | ---: | ---: | ---: | ---: |")
    for s in (6.0, 8.0, 10.0):
        for length in (2000.0, 2400.0, 2800.0):
            balance, _, _, dry, min_alt = single_working_arm_balanced_case(
                length, 10.0, s
            )
            print(
                f"| {s:.1f} MJ/kg "
                f"| {length:.0f} km "
                f"| {balance:.1f} t "
                f"| {dry:.1f} t "
                f"| {min_alt:.0f} km |"
            )
    print()

    print("## Zero-ballast asymmetric balance test - 10 t payload")
    print()
    print("| Allowable | Working-arm length that balances with no added ballast | Opposite-tip minimum altitude | Geometry valid? |")
    print("| ---: | ---: | ---: | ---: |")
    for s in (6.0, 8.0, 10.0):
        length, min_alt = zero_ballast_balance_length(10.0, s)
        valid = "yes" if min_alt >= LOWER_TIP_ALTITUDE_KM else "no"
        print(
            f"| {s:.1f} MJ/kg "
            f"| {length:.0f} km "
            f"| {min_alt:.0f} km "
            f"| {valid} |"
        )


if __name__ == "__main__":
    main()
