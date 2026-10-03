# Skyhook introduction film storyboard

This is the proposed first original Skyhook Industries film: a 90-second introduction for someone who has never heard of a rotating tether. It explains one handoff, why recovery matters, and where to explore the idea on the site. The script and shot plan are ready for review; narration, rendered footage and a finished video have not been produced.

The film should inherit the site's charcoal, copper and restrained scientific diagrams. Use the existing flight walkthrough as the motion reference, with deliberate camera movement and a close view of capture. The film's job is to make the idea understandable and memorable before inviting the viewer into Flight Studio or Expeditions.

## Narration draft

Reaching orbit takes speed as well as height. What if some of the machinery that gives a payload that speed could stay in space?

A skyhook is a rotating tether in orbit. Near the bottom of its swing, its tip moves against the orbital motion, reducing the speed an approaching payload needs to match.

A launch vehicle climbs to the meeting point. Position, speed and timing must align. A grapple secures the payload, and the tether carries the load.

As the tether turns, the payload gains orbital energy. At a chosen release point, it leaves on its own trajectory.

That energy comes from the tether's motion. Before the next handoff, the system must recover. Propulsion, or carefully planned returning cargo, could help restore what the outgoing payload took.

One tether could become part of a transport network: a lunar lunavator, an anchor at Phobos, and routes further into the solar system.

Skyhook Industries explores that possibility. Design and test a flight in Flight Studio. Build and supply a network in Expeditions.

Start with one handoff. See where it could lead.

## Shot plan

| Time | Picture and camera | On-screen text |
| --- | --- | --- |
| 0–10 s | Begin close to Earth's horizon. Reveal an orbital arc and a small payload; a velocity arrow establishes the problem before the tether appears. | Reaching orbit takes speed |
| 10–24 s | Pull back to the free-orbiting tether. Show the hub moving along its orbit while the tether rotates. At the lower tip, two restrained arrows explain opposing orbital and rotational motion. | Orbit + rotation |
| 24–39 s | Track the carrier climbing from below. Move into the existing grapple close-up as relative motion closes. Show alignment, jaw closure and a secure latch, then ease back out. | Match motion · grapple · secure |
| 39–49 s | Follow the loaded tether through its swing. Keep the payload visibly above the atmosphere and the hub travelling along its orbit. | Carry the load |
| 49–60 s | Show one clear release and the departing payload's trajectory. Keep the release velocity arrow briefly visible, then let the payload travel freely. | Release onto a new trajectory |
| 60–73 s | Hold a clear view of the changed tether orbit. Show current within the rotating tether, then brief chemical and returning-cargo alternatives. Indicate recovery over later passes rather than an instant restoration. | Recover for the next handoff |
| 73–82 s | Widen to the Earth–Moon–Phobos network. Depict free-orbiting rotors at Earth and the Moon; the inward and outward Phobos arms remain attached to Phobos. | One handoff. A wider network. |
| 82–90 s | Use short captures of the actual Flight Studio and Expeditions interfaces, followed by a quiet end card with two clear destinations. | Explore a flight · Build a network |

Timing is a proposed edit, to be adjusted after a spoken read. Preserve intelligibility and the capture detail if the narration requires a few more seconds.

## Visual and scientific continuity

Use [FlightStory](../../src/components/FlightStory.astro) and its [motion model](../../src/components/flight-story-motion.ts) as the choreography reference. Camera and drawing coordinates are illustrative; the walkthrough is not a solved full capture mission. Keep the small caption “Concept illustration” visible during the mechanism sequence. Do not put demonstration measurements on illustrative scenes.

The camera may slow and zoom into capture, but both the tether and payload must continue moving coherently. The grapple is a conceptual mechanism. At release, the payload inherits the appropriate motion and continues under gravity; it does not turn abruptly toward its destination. Electrodynamic recovery shows current in the tether itself. The network view should preserve the distinct Earth, lunar and Phobos architectures.

The final product clips should show actual working controls. Describe Expeditions as a strategy game in its caption and keep its schematic routes separate from Flight Studio calculations. Avoid cost, safety or performance promises that the project's models do not establish.

## Production and placement

Record a calm narration at a comfortable pace, then time the edit to it. Render motion from controlled scene code and capture the real interfaces. Use original or appropriately licensed sound, keeping the voice easy to understand without headphones.

Deliver a 16:9 master, a lightweight web version, a poster frame, captions and a text transcript. Use deliberate playback with visible controls. Load the video player after activation so the homepage remains fast; retain a useful poster and transcript if playback is unavailable. Keep the interactive walkthrough available for visitors who want to pause and explore a moment themselves.

The homepage invitation should read “Watch how a skyhook works” and show the running time. The end card should lead to the existing guided flight and Expeditions. Selected external videos can remain in further learning with their creators credited; the primary introduction should tell this project's story.

## Review before rendering

Read the narration aloud against the shot timings. Check the capture, atmospheric clearance, release and recovery choreography against the existing walkthrough and its tests. Review text size on a phone, caption contrast and the distinction between concept illustration, calculated flight and game footage. Rendering and publication follow that review; this storyboard alone is not a finished video.
