# Restore the original comet; explain the hardware through motion

## Owner-selected references

- Existing Skyhook site: https://skyhook-industries.com/ (www redirects here).
- Conceptzilla, *Satellite Landing Page Animation*:
  https://dribbble.com/shots/16467758-Satellite-Landing-Page-Animation

Both were inspected through normal public-page requests and ordinary Chromium.
No authentication, CAPTCHA interaction, paid-file retrieval or access-control
workaround was used. Temporary source-review artifacts contain the evidence,
not production media. The two collection scripts/workflow were removed once
review finished; they do not create recurring crawls or new deployments.

## Recovered owner artwork, not a replacement Z

The old page's explicit icon links point to this GoDaddy CDN asset:

https://img1.wsimg.com/isteam/ip/0fa0ac43-09ea-4bae-a152-48896ecd744a/favicon/9409503f-843f-4018-a17e-aa1400a7421f.png

Despite the `.png` path, its original response is a **2560×2560 JPEG**, 123,314
bytes. SHA-256:
`1f92c662e9d62136ff03b4eb1e2a77cabaf5a350a31ad560216fa21880de89de`.
The old root `/favicon.ico` returns 404; the linked CDN image is what the browser
uses. No authentic SVG source or verified stock-vendor listing was recovered.
Do not call a raster-in-SVG wrapper the original vector artwork.

The mark is the existing orange/gold comet, dark teal disc and three white stars.
The owner previously stated that he purchased the stock artwork and requested
its reuse. This record does not establish an exclusive trademark or a new license.
No third-party stock watermarks were removed. Only the original site's linked
artwork was used for the production derivatives.

Asset preparation: remove exterior-connected near-white background pixels while
preserving the enclosed white core and stars; crop to the visible mark with a
small clearspace; resize with Lanczos. `/brand/comet-mark.png` serves the header
and footer. `/favicon.ico` includes 16,24,32,48,64-pixel entries; a 32-pixel PNG and
180-pixel Apple touch image have matching content. These are genuine raster
formats. The original full-size master is not republished in this public repo.
Both page layouts share one favicon component, with a version query to displace
cached tab icons. The temporary Z-like CSS marks and SVG favicon are removed.

The title-case wordmark, small original phrase **“A hook hanging from the clouds”**
and restrained violet/amber night-sky tones preserve some of the old personality.
Old claims about assured costs, safety or payback are NOT reinstated.

## What the animation actually suggested

The reference's 15-second video was downloaded only into the expiring evidence
artifact and decoded at approximately 1,3,5,7,9 and 11 seconds for review. Its
satellite separates into hardware layers while the framing and annotations make
components understandable. That is a stronger reference than generic scroll fades.

Public video observed on the provided page:
https://cdn.dribbble.com/userupload/40460474/file/large-1dc74ff04d2dbac9147e8942edcb6c6f.mp4

The new homepage implements an **original procedural capture-terminal concept**,
not a copy of the satellite model, NASA branding, video, sound, screenshots or
text. It has three illustrative groups: tether load interface, guidance/power
bay and capture yoke. There is no solved hardware design, inferred component
mass, simulated guidance or capture-shock claim. The disclaimer stays visible.

Users switch assembled/exploded views, inspect named components, rotate and
reset. The group positions really change in the WebGL scene. Text stays outside
the hardware so it does not collide with the illustration. This is editorial
motion; the Flight Studio and Operations renderers and all numerical engines
remain unchanged. No new runtime dependency is needed.

## Motion, availability and performance

Three.js loads near the section through a dynamic import, not before the hero or
lab entry. The model begins still; rotation is an explicit choice. Scene updates
stop offscreen, when the document is hidden, and when no motion is pending.
Reduced-motion preference makes state changes instant and disables auto-rotation;
changes to that preference are honored at runtime. Dragging does not hijack page
scroll or move the page. There is no scroll snapping, forced cinematic playback,
audio, or entrance delay on headings.

An original static schematic and written explanations work without WebGL. View
and component controls still work with the schematic. With JavaScript disabled,
all three explanations stay visible. The usual lab visualizer is not replaced by
this schematic or by a movie.

## Review gate

Keep `brand-heritage-motion` as a draft on top of `release-consolidation` until
its ordinary build, 69 existing tests, four existing browser suites and added
brand/motion suite pass. The new suite checks real icon files, shared logos,
assembled/exploded geometry, keyboard selection, pause/offscreen behavior,
reduced motion at runtime, fallback content and five viewport sizes. Final
head/check IDs belong in the PR after the exact native screenshots are inspected.
No main merge, production traffic, GoDaddy or DNS changes are part of this pass.
