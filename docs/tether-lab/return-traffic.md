# Earth return-traffic comparison — R1-0.1.0

Entry: Earth Flight Studio → Return-traffic recovery, enabled after a safe first
outbound delivery. The main mission, saved design and campaign are unchanged.
The source is the last flown design; unrun edits disable the comparison entry.

`src/simulation/return-traffic.ts` begins at the first outbound release's actual
unloaded state. With all actuators off, it predicts the next upper-tip radial
pass at least 90 seconds ahead. A particle is integrated backward from the
predicted tip position/velocity to construct an arrival. The facility and
particle then propagate independently forward; the normal 2 m / 0.02 m/s
numerical match checks gate attachment. This is a supplied local rendezvous,
not Earth–Moon transfer targeting, real navigation or capture hardware.

The returning payload can have a different mass (0.1–250 t). Ideal matched
attachment reframes the body centroid while preserving every point velocity.
Distributed gravity and gravity-gradient torque evolve the loaded body; release
at 20–150 degrees relative to the local radial direction adds no impulse.
The original fuel and electrical hardware stay aboard, without any actuation.

The output compares payload energy lost with facility mechanical energy gained,
and records total energy and Earth-centered angular momentum residuals. The
recovered fraction is facility energy gained divided by the original outbound
payload's energy gain. It is not a fraction of complete readiness or a direct
fuel-saving estimate. Instantaneous radius, tangential-speed and spin errors
against the original target remain visible. Sustained readiness and powered
trim after the exchange are not simulated.

A release counts as usable only if facility energy increases and the return
orbit's perigee stays above the 120 km cutoff. The existing segment-clearance,
axial allowable and compression checks apply throughout the facility trajectory.
A heavy return or unsafe release remains a visible failure. There is no energy
credit inserted into the facility state. Post-release cargo coasts independently;
the replay stops before following cargo into the atmospheric regime.

Default Earth design, 3 t return, 90° swing: approximately 52.05% of outbound
energy returned, 31.64 GJ facility gain and 807.6 km return perigee. Orbit/spin
readiness is not restored. A 120° swing raises energy return to roughly 76.35%
but gives a below-surface osculating perigee and is rejected. These are outcomes
of this specific model, not operational predictions.

Tests cover conservation, attachment/release continuity, numerical convergence,
unsafe release, overload, invalid inputs and unchanged source results. Browser
checks exercise the actual worker, replay, cancellation, changing parameters,
four responsive sizes and unchanged local saves. Existing design imports keep
their model/schema; no campaign migration is introduced.

The System walkthrough's Returning payload option is a separate drawing-unit
illustration. Its prescribed orbit raising conveys the exchange concept and
does not display R1 numerical results.

Source context: Hoyt and Uphoff, [Cislunar Tether Transport System](https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf),
including return-traffic exchange. A full connected relay remains reference-only.
