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
Electrodynamic recovery carries current inside the rotating tether, with solar
panels attached at the hub. For an assumed uniform magnetic field into the
picture, the force arrow is perpendicular to the conductor. Current reverses
with spin phase to keep its along-orbit force positive, and is gated off near
unfavorable alignment. This demonstrates control, not a solved magnetic field,
plasma circuit, current collector or spin-recovery system.

A selectable chemical alternative shows a gimbaled hub engine with backward
exhaust and forward thrust. It consumes stored propellant and needs resupply.
The two modes share the schematic orbit-raising path; their playback durations
do not compare physical performance. The gray and copper orbit traces distinguish the
operating orbit from the orbit after a transfer. Spin control remains separate.

Source context:

- [NASA ISP overview: conductor incorporated into the MXER tether, pp. 9–10](https://ntrs.nasa.gov/api/citations/20040075889/downloads/20040075889.pdf)
- [NASA MXER reboost overview](https://ntrs.nasa.gov/api/citations/20020068792/downloads/20020068792.pdf)
- [NASA: electrodynamic tether power and thrust](https://ntrs.nasa.gov/citations/19850005592)
- [NASA TEPCE: current interacting with Earth's magnetic field](https://www.nasa.gov/smallsat-institute/community-of-practice/tether-electrodynamics-propulsion-cubesat-experiment-tepce/)

Capture uses its six-second playback for a camera move: zoom to 6× around the
same moving tip, close two hinged grapple jaws around the illustrated fitting,
confirm the latch, then return exactly to the normal view. The detailed hardware
fades in with magnification; it is a conceptual mechanism, not a qualified
capture design or contact-dynamics solve. Alignment, closure and latch captions
follow the same progress clock. Pausing, scrubbing and reduced-motion stills
therefore preserve both the camera and mechanism state. Leaving Capture restores
the wide camera immediately. Playback lengths serve readability, not physical
phase durations.

Stages play once and hold at the end. Pause and offscreen/hidden-page suspension
preserve the current frame. A slider provides keyboard-accessible scrubbing.
Reduced-motion visitors start with a still frame and can opt into playback.

`lab-flight-story.test.mjs` checks monotone ascent, pickup velocity matching,
continuity at stage boundaries, tether clearance, release velocity and coast
conservation, recovery radius, and the controlled magnetic force's direction through a full spin. The
company-page browser suite also samples the rendered SVG transforms and checks
scrubbing, exact pause behavior, end-frame hold, capture pacing, current placement, chemical thrust/exhaust direction, method switching without a playback reset, close-up framing and return, grapple/latch ordering, and reduced-motion controls.
