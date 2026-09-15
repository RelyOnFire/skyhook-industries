# G1 geometry checkpoint

Recovered from the interrupted Designer work and assembled on top of
`brand-heritage-motion` at `b38b893e4c335d5edea7cc3d7dab5e6573e5e430`.
Routes: `/lab/designer/` and `/lab/designer/method/`.

This release adds independent arm lengths, hub/terminal masses, uniform or
hub-relative tapered area, initial perigee/apogee, true anomaly, orientation and
spin period. It is a **fixed-mass coast model**, not elliptical powered recovery,
T4, a new cargo-transfer architecture or an Operations integration. These later
steps remain explicit milestones. No old design is silently migrated.

The live draft schematic marks the physical hub separately from the computed
mass centroid. The accepted scene/report stays with its last calculated design.
Machine view labels the two ends, hub and mass center; the globe and Canvas
views use identical calculated states. The initial Kepler ellipse is a reference,
not an imposed path. The axial load chart is sampled at the selected replay time.
The tapered load estimate checks the narrower interval boundary including tips;
it does not modify D1p's older midpoint convention.

Important physical boundary: rigid-body motion plus positive axial tension does
not establish a straight flexible-cable solution. Transverse deformation,
capture shock, joints, fatigue, active propulsion, atmosphere and debris are not
modeled. Hardware and cable display widths are enlarged. Initial orbital elements
refer to the mass center. See the public Method page for conventions and equations.

## Recovery and branch safety

The previous reply saved the engine, UI, renderer, CSS and 17-test suite as Git
blobs but did not commit them to a runnable branch. This checkpoint links those
verified blob IDs into a complete tree, adds the missing worker, routes, guide,
reference fixture and browser suite. Existing five browser suites remain enabled;
the new sixth suite runs first for fast feedback. Main and all live deployments
are left unchanged except any automatic non-production branch preview.

## Verification

The G1 suite covers analytical mass moments, uniform symmetric equivalence to
D1p's dry body, mirror geometry, orbital apses/vis-viva initialization, force as a
potential gradient, conservation, cutoff stops, refinement and JSON/replay contracts.
`analysis/geometry_reference.py` independently implements distributed rigid-body
gravity in Python and integrates with SciPy DOP853. Its stored reference does not
use a TypeScript-generated result. Regenerate it with NumPy and SciPy installed.

The browser suite uses native localhost, compiled module workers and actual
Three.js rendering. It exercises the three reference designs, stale draft edits,
invalid ellipse rejection, report export, camera/replay, native storage/share
reload, import rejection, mobile controls and guide routes. Final pass/fail status
and reviewed commit are recorded in the PR, not asserted merely from this file.

## Pending owner feedback

The homepage text “select a part to isolate” still did not behave as the owner
expected. Do not mark that new observation resolved by the previous automated
checks. It is deferred from G1 so another logo/animation pass does not displace
the approved architecture work. Neither homepage code nor terminal models change
in this checkpoint.
