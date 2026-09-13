# Orbital visual redesign — 13 September 2026

References inspected directly in Dribbble's browser and captured as screenshots:

1. Gary Szaszik, **Aerospace Website Design** — https://dribbble.com/shots/27616213-Aerospace-Website-Design
   Oversized technical typography, dark industrial surfaces, thin metadata rules, copper accents.
2. Notionhive, **ORBITA — Orbital Research Platform Website Design** — https://dribbble.com/shots/27594250-ORBITA-Orbital-Research-Platform-Website-Design
   Dominant subject imagery, spacious storytelling, secondary technical detail.
3. BBDirector, **Premium Aerospace & Defense Landing Page Design Concept** — https://dribbble.com/shots/27387982-Premium-Aerospace-Defense-Landing-Page-Design-Concept
   Planetary scale, atmospheric light, restrained navigation.

The reference screenshots are supplied separately as design research; third-party artwork is not used as production imagery. The homepage globe is drawn from the repository's existing public-domain Natural Earth coastline data. Its tether animation is illustrative, not a simulation or physically scaled orbit. The actual numerical simulation remains in `/lab/`.

## Scope

Based on `lab-electrodynamic-recovery`, preserving Flight Studio and its numerical engine. Replaces the homepage composition; adds an interactive globe with drag, pause, reset and reduced-motion support; exposes the lab in primary navigation; introduces consistent copper accents and larger documentation text. Existing research routes and lab features remain.

## Validation

- Astro production build: passed (12 routes).
- Existing lab TypeScript check: passed.
- Cloud browser captured the three Dribbble references.
- Localhost and file previews are blocked by Cloud Browser policy. No visual QA of the finished site is claimed. Review desktop/mobile layouts locally before merging.

This branch is a review version, not a production deployment.

## Science reference refinement

Following feedback on oversized headings, screen proportions, and the abrupt white-to-black transition, searched Dribbble for `science website` and inspected:

- Tomasz Mazurczak, **Nicescale — Science Website concept**: https://dribbble.com/shots/15343607-Nicescale-Science-Website-concept — continuous dark surfaces and bounded composition.
- Tomasz Mazurczak, **Brand Designer — Portfolio & Science website**: https://dribbble.com/shots/15358440-Brand-Designer-Portfolio-Science-website — title and planet share the composition rather than competing for the full screen.
- Zajno, **Website Design for a Biopharmaceutical Research Company**: https://dribbble.com/shots/27398479-Website-Design-for-a-Biopharmaceutical-Research-Company — editorial type hierarchy, aligned research details and restrained rules.
- Zajno, **Educational Website on Space Pollution**: https://dribbble.com/shots/25860515-Educational-Website-on-Space-Pollution — technical information grid; the captured animation frame is a loading/interface sequence, not the full finished page.

Applied: 72 px maximum homepage title (previously 168 px), 48 px maximum section headings, a real two-column hero with natural text flow, mobile stacking, viewport-aware hero height without fixed 780–930 px minimums, a consistent 1240 px content measure, smaller section spacing, and a continuous dark lower page with subtle tonal transitions. Mobile content can exceed one viewport when necessary to remain readable; no scroll snapping or forced clipping.

Refinement validation: Astro build passed. Numerical code is untouched; previous numerical test results are not represented as new layout verification. Browser preview remains blocked by the existing Cloud Browser URL policy, so visual QA of the refinement is outstanding.

## Homepage / lab continuity

Replaced the separate lab masthead with the same shared `SiteHeader` component used on the company pages. Lab tools retain a secondary navigation row. The application uses the homepage's charcoal surfaces, copper actions, restrained corners and type; body-scoped legacy blue variables are now overridden correctly. Simulation colors and numerical behavior are preserved.

The homepage now has one orange Tether Lab entry. The second section leads to the architecture comparison, and the closing link leads to the engineering roadmap. This removes different names for buttons pointing to the same application. The lab's main heading is now Tether Lab.

Validation: production build and lab TypeScript check passed. Browser visual verification remains outstanding because local preview URLs are blocked in this environment.
