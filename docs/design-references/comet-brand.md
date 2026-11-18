# Original comet identity

Restored at the owner's request on 8 October 2026. The owner confirmed the
orange/gold comet, dark teal disc and three white stars as the intended logo.
It replaces the temporary Z-like mark across public pages, Flight Studio,
Expeditions, browser icons and share images.

## Source and format

The original site's icon links point to:

https://img1.wsimg.com/isteam/ip/0fa0ac43-09ea-4bae-a152-48896ecd744a/favicon/9409503f-843f-4018-a17e-aa1400a7421f.png

Fetched again from the live site on 8 October 2026. Despite its `.png` URL, the
current response is a 2560 × 2560 JPEG, 122,428 bytes, SHA-256
`70844092da3dcbba99a01b54286bff8bb298f38f637b346f84644a9228399201`.
No authentic vector master was recovered. Do not describe these assets as an
original SVG or rename a raster file to imply vector artwork.

The exact transparent PNG and icon derivatives were recovered from repository
commit `b346844` (the earlier `brand-heritage-motion` branch). That preparation
used the same site's earlier 123,314-byte response, SHA-256
`1f92c662e9d62136ff03b4eb1e2a77cabaf5a350a31ad560216fa21880de89de`. It
removed only exterior-connected near-white background pixels, preserving the
enclosed white core and stars, added clearspace, and resized with Lanczos.
The 256 px logo has ample resolution for the 44 px desktop and 36 px phone
wordmarks. The master artwork was not redrawn or replaced with generated art.

- `public/brand/comet-mark.png`: 256 × 256; 5,110 bytes.
- `public/favicon.ico`: 16, 24, 32, 48 and 64 px frames.
- `public/favicon-32.png`: 32 × 32.
- `public/apple-touch-icon.png`: 180 × 180.

`BrandMark.astro` supplies the shared header/footer image. Its empty alternative
text avoids repeating the adjacent company name. `PageMeta.astro` uses the comet
icons and versioned asset URLs to replace cached Z favicons and share images.
`scripts/render-social-cards.py` embeds the same PNG into the authored diagrams
before rendering all three share cards. The compatibility social-card SVG
contains that embedded raster logo; it is not the vector master.

The introductory film has text titles and cropped application views, with no
Z mark to replace. Existing site layout, game saves and numerical models are
unchanged by the identity update.
