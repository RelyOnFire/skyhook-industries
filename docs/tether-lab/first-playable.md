# Tether Lab: first playable

Status: first implementation; browser review required before merging. Model D1p-0.1.0.

This is the first vertical slice of the approved Tether Lab product definition, not the full public release. Existing company pages, historical calculations and deployment domain are retained. The new routes are `/lab/` and `/lab/method/`, excluded from the sitemap and marked noindex during this experimental stage.

## Implemented scope

- Symmetric planar rotating tether, spherical Earth, distributed gravitational forces and torque.
- Uniform or parabolic fixed-area structure; published fiber/yarn profiles, hypothetical and custom profiles.
- Supplied ideal matched capture; physically continuous release; independently propagated payloads.
- Finite-thrust chemical orbit/spin recovery, finite fuel, or coast without recovery.
- Readiness conditions checked before a second supplied rendezvous; time limit 6 simulated hours.
- Earth and follow-tether WebGL views; equivalent Canvas orbital-plane fallback.
- Replay, seek, event timeline, state explanations, resource telemetry, prior-run summary.
- Versioned bounded share URLs; local save/load and JSON import/export.
- Numerical worker independent of React, Three.js, playback rate and rendering scale.

No ellipsoidal Earth, atmospheric interaction, cable elasticity, damage model, EDT, traffic exchange recovery, asymmetric body or solar-system propagation is claimed. These are separate later milestones, not inactive-looking working controls. A load margin is axial rigid-path screening, not a flexible-cable qualification.

## Implementation decision

Astro remains the static content/deployment framework. React hosts the application. A small direct Three.js adapter owns the visualization; React Three Fiber and a global state library are not necessary for this slice. Simulation has no UI or 3D dependencies. Simulation changes and catalogue changes require a new model version so shared inputs do not silently acquire new meaning.

The material catalogue uses Toyobo Zylon HM data (technical information p. 3) and DuPont Kevlar 49 conditioned-yarn data (Technical Guide Table II-1). Material ultimate properties are divided by a user-visible educational safety factor, with no pretence of environmental qualification. Advanced carbon is explicitly hypothetical. Natural Earth coastline geometry is public domain. No externally fetched textures, analytics, accounts or runtime API keys are used.

## Verification

Run `npm run test:lab` and `npm run check:lab`, then `npm run build`.

The 12 initial numerical tests cover bounded input, mass/inertia, capture and release momentum/energy accounting and point continuity, conservative coast invariants, segment-interior clearance, finite recovery resources, a material-limit stop, explicit sizing, step/quadrature convergence and an independent SciPy DOP853 coast fixture. The independent fixture generator is `analysis/lab_reference.py` and requires NumPy/SciPy only when regenerating it.

CI retains the existing v0.3/v0.4 output checks but does not treat those historic checks as validation of the browser model. A successful lab challenge does not validate the earlier ~289 t architecture or imply realistic acquisition, flexible-body stability or hardware feasibility.

## Next milestones

First close browser/render/accessibility defects. Then add a reviewed electrodynamic circuit/force model and finite incoming traffic events. Broaden geometry, target orbits and Earth–Moon dynamics only with their own tests. Do not replace the existing homepage or transfer the production domain as part of this first slice.
