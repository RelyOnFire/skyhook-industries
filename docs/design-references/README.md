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
