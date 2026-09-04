# Skyhook Industries visual standard

This document records the visual decisions that define the current Skyhook Industries site. It exists so future redesigns, audits, automated tools and contributors can distinguish intentional design language from actual defects.

## Design read

Skyhook Industries should feel like an orbital megastructure presented by an advanced aerospace program.

The public site combines two modes:

1. **Cinematic orbital scale** — near-black space, Earth limb, the tether as a large compositional object, large direct typography.
2. **Technical program documentation** — warm paper surfaces, restrained rules, figure numbers, study values, source records and engineering gates.

Neither mode should take over the entire site. The contrast between them is part of the identity.

## Priority order

When design rules conflict, use this order:

1. Skyhook's established visual identity and project-specific meaning.
2. Real visual QA at representative viewport sizes.
3. Technical clarity and credibility.
4. Accessibility, usability and performance.
5. Generic design checklists and external taste rules.

A checklist never overrules a composition that works for a specific reason.

## Deliberate elements — preserve

### Dark / paper alternation

The transition between cinematic dark sections and warm technical-paper sections is intentional. It separates spectacle from engineering detail and gives long pages rhythm.

Do not flatten the site into one continuous light or dark theme merely to satisfy a generic consistency rule.

### Numbered engineering sections

Labels such as `01 / Geometry`, `02 / Capture` and `Fig. 03 / Scale reference` are intentional. They borrow the language of aerospace reports and test documentation.

They should remain sparse, useful and internally consistent. They are not decorative numbering for its own sake.

### Custom technical diagrams

Orbital geometry, velocity vectors, scale comparisons and future structural diagrams should be custom to the actual Skyhook concept. A generic icon library or stock illustration is not a substitute for a technical figure.

Decorative icons should be rare. Mechanism diagrams should be physically meaningful.

### Large homepage hero

The homepage should communicate physical scale before it explains every subsystem. The large headline, Earth limb and diagonal tether are intentional.

The hero may be dramatic, but text and annotations must always retain a protected readable region. No line, node, label or Earth detail may collide with the copy.

### Restrained palette

Core surfaces:
- near-black orbital background;
- warm technical paper;
- cool steel / pale blue for aerospace annotations;
- muted orange for risk, warning and hard-engineering emphasis.

Do not introduce extra brand accents without a strong reason.

### Sparse motion

Motion is allowed only when it communicates orbital motion, sequence, state or interaction. The site should not acquire generic scroll reveals, parallax, cursor effects or animation simply to appear more expensive.

## Things that are defects — fix

- annotations or tether lines crossing readable copy;
- clipped headlines or orphaned controls;
- weak contrast on technical labels;
- missing keyboard focus indication;
- mobile layouts that merely shrink desktop composition rather than recompose;
- source links or CTAs with unclear interactive state;
- inconsistent figure numbering;
- decorative detail that implies incorrect orbital geometry;
- unexplained precision in study values;
- stock imagery that makes the project look more generic or less technically credible;
- page-specific styling that breaks the common wordmark, navigation or typographic hierarchy.

## Viewport QA matrix

Every major visual change should be checked at least conceptually against these classes before merge:

- 360 × 800 — narrow phone
- 390 × 844 — modern phone
- 768 × 1024 — tablet portrait
- 1024 × 768 — tablet / compact landscape
- 1280 × 800 — compact laptop
- 1366 × 768 — common laptop
- 1440 × 900 — desktop
- 1920 × 1080 — large desktop

The hero deserves special review at intermediate laptop widths because the rotating tether crosses the composition diagonally.

## Typography

The current hierarchy matters more than fashion:

- large, tight sans-serif display type for mechanism and thesis statements;
- serif body copy where the site shifts into explanatory / report mode;
- monospace for figures, technical labels, study values and program states.

A future font change is welcome only if it improves the identity at all three levels. Do not replace fonts merely because a design checklist dislikes a particular family.

## Images and generated art

High-quality Earth / orbital imagery may eventually replace or supplement the CSS hero rendering, but it must preserve the current composition and cannot imply a ground anchor, giant ballast or incorrect tether geometry.

Real diagrams outrank decorative space imagery when the page is explaining mechanism.

## Brand mark

The current line mark and favicon are temporary. The previously purchased Skyhook SVG may replace them when recovered, subject to its license and a visual check at favicon, wordmark and social-card scales.

Do not silently redesign the logo or wordmark.

## Anti-goals

The site should not become:

- a generic dark aerospace startup landing page;
- an Awwwards-style interaction demo;
- a wall of equal feature cards;
- a grant proposal made visually timid by disclaimers;
- science-fiction concept art with weak engineering explanation;
- a technical report so dry that the scale and ambition disappear.

The target is: **spectacular at first glance, mechanically legible on the second, technically serious on the third.**
