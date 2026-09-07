# Browser application

`Lab.tsx` owns controls and versioned input state. `worker.ts` executes the pure core. `view.ts` samples immutable trajectories. `Scene.tsx` maps them into Three.js and Canvas views. No camera coordinate or frame rate feeds back into physics.

Coastlines in `land.ts`: Natural Earth public-domain low-resolution data, sourced from pyogrio test fixtures, dissolved to remove national borders and simplified to 0.7 degrees. This is a schematic offline map, not contemporary satellite imagery. Terms: https://www.naturalearthdata.com/about/terms-of-use/

Illustrative sun/atmosphere, enlarged tether width/markers and fixed 28-degree display orientation are documented in the Method page. Current favicon remains the existing placeholder until the owner's purchased SVG is recovered.
