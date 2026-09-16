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

## 16 September continuation

Completed the shared visual treatment in the Method guide, architecture catalogue, mission/debrief dialogs, object tracker and electrical recorder. Electrical and object colors remain semantic signals, while panel surfaces follow the site palette. The scene legend now reads the same `OBJECTS` color registry as the renderers rather than inheriting the copper action color.

The workspace now lets the scene, replay controls and narration determine its height, with bounded scrolling in desktop instrument panels and natural flow on mobile. This avoids cutting off lower content to force the entire instrument into a fixed-height box.

The prior-head Actions run `34760304639` passed its numerical, type, build and six-width lab interaction checks, then failed when a broad `summary` selector found the hidden mobile navigation menu. The Method disclosure check is now scoped to `#lab-content details.guide-details`; the original behavior assertion remains. Local build, type check, generated local-link check (12 pages), and Python syntax check pass. Complete browser regression verification is delegated to the repository's existing Actions workflow; Cloud Browser local preview remains blocked.

## 16 September screenshot review

Live PR #10 still pointed to `4787628616d49bbb63259d19efd761afc46f364f`, with the same electrodynamic base and successful Actions run `35129576778`. The current `browser-qa` artifact was successfully downloaded through GitHub and inspected. This resolves the earlier inability to inspect CI screenshots; the Cloud Browser restriction on local previews remains in place.

Reviewed desktop/mobile lab views, Method and architecture pages, mission selection, debrief and electrical panels. Their main surfaces and typography retain the approved science direction. Two observed presentation defects receive targeted fixes: notification/share surfaces still used the legacy blue palette, and the playback-speed selector extended outside the flight console at 320 px. Neutral feedback now follows the lab panel palette while error styling stays distinct; narrow replay controls wrap the speed selector onto a labelled row.

The existing browser suite now checks replay-control bounds and captures the homepage at six sizes, including viewport and complete-page images, mobile navigation, and fresh homepage-to-lab visits. This fills the missing homepage evidence without introducing a preview deployment. Debrief and Method captures start at the top so intentional test scrolling does not obscure their headings. New images must be inspected after CI; passing checks alone do not establish visual approval.

Actions run `35134909998` passed at `b630b333f9e59641b8ed1944399a3aa67e2e76d9`. Its new screenshots were inspected: the homepage keeps the approved proportions, mobile stacking and continuous dark sections; the replay selector fits at 320 px and neutral feedback no longer uses the old blue surface. Fresh mobile lab images also exposed an overly narrow horizontal camera field of view that put the initial tether/payload outside the image. The renderer now widens its projection on narrow canvases while retaining the user's orbit, zoom and follow target. No integrator, design input or numerical result changes. Browser coverage checks the initial facility/payload labels on resize, fresh navigation and camera reset; final framing remains subject to inspection of the next CI screenshots.
