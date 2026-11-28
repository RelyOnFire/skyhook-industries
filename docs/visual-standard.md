# Skyhook Industries visual standard

Updated 27 September 2026. This records the approved science-inspired direction,
superseding the early September paper/dark alternation and oversized typography.
The user's current feedback and actual browser review take priority over older
design notes.

## Identity

Continuous charcoal surfaces, copper actions, restrained typography and a
bounded reading width connect the public site, Flight Studio and Expeditions.
The site should invite curiosity, explain mechanisms and offer something real
to do. Preserve the project's research record, founder and mission history.

The homepage introduces three related activities:

- Understand the mechanism and its research basis.
- Design and fly a tether in Flight Studio.
- Grow an interplanetary supply chain in Expeditions.

Flight Studio calculates individual experiments with explicit model boundaries.
Expeditions is a strategic logistics game. Illustrations and navigation must
keep those roles clear. Commissioning a lab design uses the existing measured
performance contract; a campaign route is not a solved laboratory encounter.

## Composition and typography

- Use a shared reading measure around 1,240 px for public pages. Operational
  workspaces may use more width when that keeps related controls together.
- Lead with one clear heading and a useful action. Keep explanatory copy close
  to the diagram or control it explains.
- Preserve the homepage globe and its protected text region. The entire orbit,
  tether, endpoint markers and annotations must remain inside the canvas.
- Use restrained sans-serif headings and readable body copy. Small monospace
  labels can identify models, figures and measured values.
- Keep values and their units together. Allow controls and labels to reflow
  without clipping or separating a unit onto its own line.
- Use section numbering sparingly and consistently. Avoid a wall of equal cards
  where a diagram, sequence or editorial layout would explain more.

## Colour and motion

Near-black and charcoal are the main surfaces. Copper identifies primary
actions and selected routes; cool pale blues support technical annotation.
Hierarchy comes from spacing, type and fine rules rather than abrupt white
sections, heavy shadows or oversized headings.

Motion should explain orbit, sequence or changing state. Avoid scroll reveals,
parallax and decorative animation. Respect reduced motion and preserve manual
controls. Simulation ticks must not remount stable text or repaint the whole
scene. Reserve space for intermittent arrival/status content so columns do not
jump during play.

## Diagrams and assets

Prefer repository-native SVG, canvas and calculated geometry to generic space
art. Schematics should say when they are not to scale. Do not draw an Earth or
lunar rotovator as a ground-anchored elevator; Phobos is intentionally an anchor.
The CardioRotovator thumbnail uses the synchronized model's own geometry.

Use the owner's original orange/gold comet, dark teal disc and three white stars
beside the existing wordmark. The owner requested this restoration on 8 October
2026. The shared `BrandMark.astro` component, favicon and share images use the
same recovered artwork; the temporary Z-like line mark is retired. See
`docs/design-references/comet-brand.md` for source and format provenance.
Share images are authored diagrams, rendered by
`python scripts/render-social-cards.py` using the existing Playwright setup.
The script writes the three 1,200 × 630 PNG assets and the compatibility SVG.
They contain authored diagrams and the locally hosted owner logo, with no saved
worlds or remote fonts.

`PageMeta.astro` supplies consistent titles, descriptions and share cards. The
known Workers branch uses its stable origin for share URLs and image assets;
canonical URLs still identify the public site. Other deployments can set
`SKYHOOK_SHARE_ORIGIN`. Lab pages retain their existing `noindex,follow` policy.
The branch is identified through Cloudflare's documented
[`WORKERS_CI_BRANCH` build variable](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## Quality gates

Review actual screenshots and interaction, not only absence of page overflow.
Check at 320, 390, 768, 1,001, 1,280 and 1,440 px, including a short laptop.
The 1,001 px width is the shared header's first desktop layout. Navigation must
not overlap the wordmark at that boundary.

Public entry links must work without JavaScript. Interactive experiences need
clear loading and no-JavaScript guidance. Keyboard navigation, visible focus,
Escape dismissal, native mobile menus and reduced-motion controls are required.

For game changes, inspect a developed saved network with active traffic. Keep
scheduled services within the desktop workspace and preserve save compatibility,
resource accounting and chronological determinism. A polished empty state is
not sufficient evidence of a polished running game.

`tests/site-pages.browser.py` covers the public layout, navigation, guided first
flight, share assets and the illustrated flight sequence. The separate Studio
and campaign browser suites cover their actual workers, saves and interactions.

## Planetary surfaces and dense map traffic

Flight Studio and Expeditions share locally hosted photographic surface maps,
with full attribution at `/lab/method/#imagery` and provenance in
`public/textures/README.md`. WebGL loads textures asynchronously, repaints paused
scenes on arrival and retains a neutral lit globe on failure. The game and 2D
views use transparent globes rendered by `scripts/render-planets.py`; they do not
create six additional WebGL contexts or reload textures on simulation ticks.
Earth includes a separate cloud layer. T4 adjusts camera near clipping with the
viewing distance to keep surface/cloud depth precision in both close and wide views.

Mirror deployments follow three stable curved lanes left of the Mercury power
return. Untracked batches use small gold symbols without dark outlines, so dense
traffic does not form a black/yellow tessellated cable. Every batch remains present
and trackable; the selected batch draws last with its full marker and correct
curved route. Positions, bodies and lighting remain schematic; saves, event clocks,
energy accounting and transport times are unchanged.
