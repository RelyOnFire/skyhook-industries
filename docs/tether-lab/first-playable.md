# Tether Lab: first playable

Status: draft PR #8, local review branch `tether-lab-first-playable`. Model **D1p-0.2.0**, configuration schema **2**. Neither deployed website is changed by this branch.

This is the first vertical slice of the Tether Lab product definition, not the full public release. Existing company pages, historical calculations, domain settings and favicon are retained. `/lab/`, `/lab/method/` and `/lab/architectures/` are excluded from the sitemap and marked noindex during review.

## Runnable scope

- Symmetric planar rotating tether, spherical Earth, distributed gravitational forces and torque.
- Uniform or parabolic fixed-area structure; published fiber/yarn profiles, hypothetical and custom profiles.
- Supplied ideal matched capture; physically continuous release; independently propagated payloads.
- Finite-thrust chemical orbit/spin recovery with finite fuel, or Coast with no active thrust and zero propellant mass.
- Readiness checked before a second supplied rendezvous; six simulated hours per experiment.
- Three.js Earth and follow views; Canvas orbital-plane fallback, replay, seek, event timeline and telemetry.
- Fixed dimensions stay fixed when changing material. Resize is a separate lower-radial sizing operation, not a guarantee of mission success.
- Standard payload inputs 0.1–20 t; opt-in extended range 0.1–250 t. The same equations and limit checks apply. These are software input ranges, not engineering capacities.
- Versioned, validated share URLs and JSON files. Old schema-1 designs require confirmation before updating, particularly Coast designs that formerly carried unused fuel.

No atmospheric interaction, cable elasticity, damage model, electrodynamic or traffic recovery, asymmetric body, elliptical starting orbit, T4 pivot dynamics or solar-system propagation is claimed. A load margin is axial rigid-path screening, not flexible-cable qualification.

## Product interface

The lab uses `LabLayout.astro` and its own CSS, independent of the brochure's ProductionLayout and paper palette. The workspace separates Design bay, flight scene and recorder; phone widths switch between Design, Flight and Results panels. The Method page uses readable dark surfaces, a contents navigation and progressive disclosure for equations and sources.

Recorder traces plot accepted clearance and axial-margin samples. Their full-run minima are explicitly distinguished from the replay cursor. An unrun edit does not change the displayed result. Input equality is value-based, not dependent on JSON property insertion order.

Coast hides budget, thrust and specific-impulse controls. Switching back to Chemical restores the session's last entered budget, but this remembered number contributes no mass in a Coast run. Draft and accepted-result states stay separate.

## Architecture catalogue

`src/simulation/catalogue.ts` separates reference records from executable Design values. Only `single-stage-rotovator` is currently runnable. The validator rejects unimplemented architecture IDs.

The other entries are Tillotson Two-Tier Tether (T4), CardioRotovator, HyperSkyhook, LIFTether, MXER, Earth–Moon relay and Hoytether construction. Each identifies missing model work and a primary source. Mechanical configurations, mission systems and structural construction are distinct categories.

T4 is an attached compound rotor: the secondary two-arm tether turns about a pivot at the end of the primary tether. It is not simply a handoff between two independent orbital facilities. See HASTOL Phase I, p. 19 and Appendix 2 A2-15–17: https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf . Early idealized mass assumptions are not imported as a validated operating design.

## Implementation and evidence

Astro remains the static content/deployment framework. React hosts controls; a direct Three.js adapter owns 3D rendering. The pure numerical core runs in a browser Worker and has no React, camera or frame-rate inputs. No accounts, analytics, runtime API keys or externally fetched textures are required.

Material references are Toyobo Zylon HM technical data and DuPont Kevlar 49 conditioned-yarn data. Fiber ultimate stress is divided by a user-visible safety factor; environmental and joint qualification remain omitted. Future carbon is explicitly hypothetical. Natural Earth coastlines are public-domain schematic geography, not satellite photography.

## Verification and local review

Run:

```sh
npm install
npm run test:lab
npm run check:lab
npm run build
npm run dev
```

Open `/lab/`, `/lab/method/` and `/lab/architectures/` on the port printed by Astro.

The 19 automated tests include conservation, point continuity, mass/inertia, interior clearance, finite recovery fuel, numerical convergence, an independent SciPy DOP853 coast fixture, expanded-payload bounds, zero-fuel Coast, versioned JSON imports, and rejection of unimplemented architectures. Regenerating the independent fixture requires NumPy/SciPy; ordinary tests use the committed fixture.

CI also retains the historical v0.3/v0.4 output checks. Those checks do not validate the new browser simulator or the earlier approximately 289 t concept.

Before merging, inspect native WebGL, camera interactions, ordinary-origin sharing/storage and mobile viewport behavior in a user's browser. Browser-build review notes are recorded in the PR. A successful compile is not sufficient visual review.

## Subsequent model work

Add an electrodynamic circuit/force model and finite incoming traffic events with separate tests. Then broaden geometry, eccentric orbits and Earth–Moon dynamics. T4 needs coupled stage states, pivot reactions, rotation phases and conservation checks before it can become runnable. Do not transfer domains or replace the company homepage as part of this review branch.
