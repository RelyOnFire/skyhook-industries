# System-page flight walkthrough

The five-stage illustration lives in `FlightStory.astro`, with drawing geometry
in `flight-story-motion.ts` and playback in `flight-story.ts`. It is an
educational schematic, separate from the Flight Studio and campaign models.

Approach, capture, swing and release share a continuous geometry. The hub
follows a circle around the drawn Earth, with constant tether spin opposing
the hub's prograde velocity at the lower pass. A powered approach increases
Earth-centered radius and matches the tip's position and velocity at pickup.
The same physical endpoint carries the payload throughout the attached phase.
The full tether remains outside the illustrated atmospheric band.

Release occurs partway through the swing in this example. The initial free-flight
velocity is the hub velocity plus the tip's rotational velocity. The coast is
integrated under central gravity using the gravitational parameter consistent
with the drawn circular hub orbit. It receives no release impulse. A real
release time depends on destination and loaded-system dynamics; there is no
universal requirement to release at the highest point.

These drawing units, rotation rates, sizes and clearances are illustrative.
The 100 km and 4.1 km/s text values refer to the separate screening architecture,
not to calibrated distances or velocities in the animation. Finite payload
mass, capture transients, facility recoil and flexible-tether motion are not
solved here. Full-transfer energy/recovery numbers were removed from the
walkthrough because this drawing releases earlier than that comparison case.

Recovery switches explicitly to later orbits with compressed time. The outward
path is a schematic for energy restoration, not an integrated reboost solution.
Solar panels, flowing current and a forward thrust arrow explain the chain from
electricity to magnetic force. The gray and copper orbit traces distinguish the
operating orbit from the orbit after a transfer. Spin control remains separate.

Source context:

- [NASA MXER reboost overview](https://ntrs.nasa.gov/api/citations/20020068792/downloads/20020068792.pdf)
- [NASA: electrodynamic tether power and thrust](https://ntrs.nasa.gov/citations/19850005592)
- [NASA TEPCE: current interacting with Earth's magnetic field](https://www.nasa.gov/smallsat-institute/community-of-practice/tether-electrodynamics-propulsion-cubesat-experiment-tepce/)

Stages play once and hold at the end. Pause and offscreen/hidden-page suspension
preserve the current frame. A slider provides keyboard-accessible scrubbing.
Reduced-motion visitors start with a still frame and can opt into playback.

`lab-flight-story.test.mjs` checks monotone ascent, pickup velocity matching,
continuity at stage boundaries, tether clearance, release velocity and coast
conservation, and the recovery diagram's radius and thrust direction. The
company-page browser suite also samples the rendered SVG transforms and checks
scrubbing, exact pause behavior, end-frame hold, and reduced-motion controls.
