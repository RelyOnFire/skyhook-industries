# Consolidated release candidate

This is stage 1 of the approved sequence: consolidate and test → asymmetric
geometry and elliptical orbits → T4 → use those architectures in Operations.
It does not claim that the later three stages are implemented.

## Sources of this candidate

- Published main: `2fbf910bb624614ac3d631d6a64c319aba940f77` (PR #8).
- Electrodynamic recovery: `330d5a62a2637814ea8a0326cf7ef2e75b7155d3` (PR #9).
- Approved latest visual branch: `4f74b24ed17b0706e68ca11510043138ebeae79c`
  (PR #10). Preserve the shared header and continuous charcoal/copper design.
- Locally reviewed Operations patch, SHA-256
  `3bad1b9cb2b2f37a1c6cdaad8ed9da73d0a60fc767d26db0267b81eb095e1fe1`, based on
  the electrodynamic commit above. Its original applied tree was
  `86e6b05230394be9621e22326fdbf5bdf03c081a`.

The Operations integration deliberately does not apply that patch's old homepage,
old LabLayout, or old promotional stylesheet over the newer approved visuals.
Instead the current homepage gains an Operations entry; the shared lab navigation
links Flight Studio, Operations, Architectures and Method. The app's physical
object colors and numerical outputs are not changed by the copper UI treatment.

The numerical source `src/simulation/operations.ts` is preserved byte-for-byte
from the reviewed patch (Git blob `85215e26b3177fb9b91d5ef2e1d671e62e8ee021`).
D1p remains 0.4.0; Operations remains OPS-0.1.0. Release consolidation is not a new
physics model and does not silently migrate or reinterpret a saved result.

## Integration corrections

- The shared header's hidden mobile-menu summary was mistaken for the Method
  disclosure by an old unscoped browser selector. Scope it to `.guide details`;
  preserve the full browser test rather than skipping the Method assertions.
- Isolated test harnesses select their intended numerical worker rather than the
  first hashed bundle now that both Flight Studio and Operations have workers.
- Operations joins the same shared navigation and typography. An ancestor link
  can be visually active without falsely declaring itself `aria-current=page`.
- Escape and outside clicks close the mobile menu; Escape returns focus to Menu.
- Add native route/link/metadata/navigation tests and native Operations WebGL
  tests alongside both existing native application suites.

## Dependency patch

Astro is pinned to 7.2.8, the maintainer's patch for
https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2 .
The vulnerable image-processing path requires an untrusted AVIF image to reach
Astro's optimizer; this is not a claim that the static site was compromised.
The updated build resolves Sharp 0.35.4. The dependency audit is preserved as an
artifact and fails the release workflow on high/critical findings or an invalid
report. A clean audit is not a general security certification.

## Release gate and scope

The candidate must pass all numerical/configuration tests, TypeScript checks,
legacy output checks, production build, and four native browser suites: Flight
Studio, E0 electrical recovery, Operations, and integrated site routes/navigation.
Review the exact CI screenshots, including Operations in WebGL, before promoting.
Local isolated Canvas checks are supplementary and must not be described as native
WebGL checks. Final CI evidence and reviewed commit belong in PR #11.

No main update, merge, DNS change or GoDaddy deployment is made by creating this
review branch. Publishing the candidate is a separate, explicit operation.

## Architecture work after this gate

1. Independent arm lengths and hardware masses; distinguish the physical hub
   from the calculated center of mass. Regression-recover the symmetric baseline.
2. Elliptical initial conditions AND appropriate reference/encounter/recovery
   logic. Do not graft an ellipse onto a circular controller. E0 stays equatorial.
3. Dedicated coupled-rotor T4 dynamics with pivot reactions, conservation tests,
   stage inspection and checked payload events. Not two prescribed animations.
4. Run the supported new designs against finite Operations manifests, retaining
   physical ledgers, missed windows, old model versioning and explicit limits.
