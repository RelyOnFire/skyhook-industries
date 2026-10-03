# Planetary surfaces

Local visualization assets used by Tether Lab and Expeditions. Public attribution:
`/lab/method/#imagery`. Lighting, shape and orientation are display choices and do
not enter any physical model. No runtime hotlinks or texture requests per tick.

| Asset | Source / credit | Original download |
| --- | --- | --- |
| earth.webp | NASA Earth Observatory, Reto Stöckli and Blue Marble: Next Generation team; January 2004 | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg |
| moon.webp | NASA/GSFC Scientific Visualization Studio, Ernie Wright, LROC and LOLA; CGI Moon Kit, 2025 color map | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg |
| mars.webp | Solar System Scope / INOVE, CC BY 4.0 | https://www.solarsystemscope.com/textures/download/2k_mars.jpg |
| earth-clouds.webp | Solar System Scope / INOVE, CC BY 4.0 | https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg |
| mercury.webp | Solar System Scope / INOVE, CC BY 4.0 | https://www.solarsystemscope.com/textures/download/2k_mercury.jpg |
| ceres.webp | NASA VTAD, Ceres 3D model, Dawn imagery | https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Ceres_1_1000.glb |
| phobos.webp | NASA/JPL/Solar System Simulator, Viking imagery processed by USGS | https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/mars---phobos/Mars%20-%20Phobos.jpg |

Sources checked 27 September 2026. Solar System Scope's attribution license is
https://creativecommons.org/licenses/by/4.0/; author and texture documentation:
https://www.solarsystemscope.com/textures/. Their maps include artistic processing
and filled gaps; they are not raw scientific measurements. NASA source pages:
https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/,
https://svs.gsfc.nasa.gov/4720/,
https://science.nasa.gov/resource/ceres-3d-model/,
https://science.nasa.gov/3d-resources/mars-phobos/.

Processing: the base-color PNG (`ceres_diff.jpg` image name) was extracted unchanged
from the Ceres GLB's image bufferView. Each source was resized with Sharp to 2048 px
wide, except Earth at 4096 px, without enlargement or cropping, and encoded as WebP
quality 92 (cloud mask: quality 90). The source Phobos map is 1440 × 720 and retains that resolution.
No invented craters, albedo-derived displacement or added topography.

`python scripts/render-planets.py` renders the checked-in maps to the transparent
1024 px WebP globes in `public/planets/` using the installed Three.js and Playwright
Chromium. Those inexpensive static assets serve SVG/canvas views. The interactive
3D studios load the full maps and apply their existing simulation-driven rotation.
