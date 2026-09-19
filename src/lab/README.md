# Browser application

`Lab.tsx` owns controls and versioned input state. `worker.ts` executes the pure core. `view.ts` samples immutable trajectories. `Scene.tsx` maps them into Three.js and Canvas views. No camera coordinate or frame rate feeds back into physics.

Earth and Moon share that free-rotor application. `PhobosLab.tsx`,
`phobos-worker.ts` and `PhobosScene.tsx` provide the separate anchored experiment,
backed by `src/simulation/phobos.ts`. It has isolated design storage, a circular
Mars–Phobos restricted-gravity solver, static cable loading and ideal work
accounting. See `docs/tether-lab/phobos-flight-studio.md` for boundaries and checks.

`T4Lab.tsx`, `t4-worker.ts` and `T4Scene.tsx` provide the compound-rotor
experiment, backed by `src/simulation/t4.ts`. It has separate versioned storage,
finite-mass coupled dynamics and a passive ideal hinge. `T4Study.tsx` displays
streamed phase/timing samples planned by `src/simulation/t4-study.ts`; opening a
sample restores and reruns its exact design. See
`docs/tether-lab/t4-flight-studio.md` for equations and limits. `StudioField.tsx`
is the shared Phobos/T4 numeric input; Earth texture generation is shared too.

Coastlines in `land.ts`: Natural Earth public-domain low-resolution data, sourced from pyogrio test fixtures, dissolved to remove national borders and simplified to 0.7 degrees. This is a schematic offline map, not contemporary satellite imagery. Terms: https://www.naturalearthdata.com/about/terms-of-use/

Illustrative sun/atmosphere, enlarged tether width/markers and fixed 28-degree display orientation are documented in the Method page. Current favicon remains the existing placeholder until the owner's purchased SVG is recovered.
