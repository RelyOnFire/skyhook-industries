# Skyhook introduction film storyboard

This is the first original Skyhook Industries film: a 90-second introduction for someone who has never heard of a rotating tether. It explains one handoff, why recovery matters, and where to explore the idea on the site. The finished H264/AAC film, poster and English captions live in `public/films/`. The homepage includes a deliberate-play player and a full HTML transcript.

The film uses the site's charcoal, copper and restrained scientific diagrams. Its mechanism poses and camera choreography come directly from the existing flight walkthrough, with a close view of capture. The film's job is to make the idea understandable and memorable before inviting the viewer into Flight Studio or Expeditions.

## Next narration pass

Playthrough feedback found the first voice clunky, especially “lunar lunavator”
and the closing invitation. Audition those two passages before producing another
complete soundtrack. Proposed wording is “a lunavator orbiting the Moon”. Read
“See where it could lead” with understated curiosity and a gentle falling cadence.
Keep phrases connected, retain natural pauses, and fit the edit to the selected
performance. The published narration and captions below remain the first cut;
no replacement voice has been selected or generated yet.

## Published narration

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
| 24–38 s | Track the carrier climbing from below. Move into the existing grapple close-up as relative motion closes. Show alignment, jaw closure and a secure latch, then ease back out. | Meet. Match. Secure. |
| 38–44 s | Follow the loaded tether through its swing. Keep the payload visibly above the atmosphere and the hub travelling along its orbit. | Carry the load |
| 44–50 s | Show one clear release and the departing payload's trajectory. Keep the release velocity arrow briefly visible, then let the payload travel freely. | Release. Then coast. |
| 50–64 s | Hold a clear view of the changed tether orbit. Show current within the rotating tether, then brief chemical and returning-cargo alternatives. Indicate recovery over later passes rather than an instant restoration. | Recover for the next handoff |
| 64–74 s | Widen to the Earth–Moon–Phobos network. Depict free-orbiting rotors at Earth and the Moon; the inward and outward Phobos arms remain attached to Phobos. | One handoff. A wider network. |
| 74–90 s | An end card shows real Flight Studio and Expeditions captures with two clear destinations. The Studio is captured after advancing the actual mission-event control; the game uses an isolated imported test world. | Design and test a flight · Build and supply a network |

Shot boundaries are aligned to the rendered narration. The exact sentence and caption timings are tracked in [the timing manifest](skyhook-introduction.timings.json).

## Visual and scientific continuity

Use [FlightStory](../../src/components/FlightStory.astro) and its [motion model](../../src/components/flight-story-motion.ts) as the choreography reference. Camera and drawing coordinates are illustrative; the walkthrough is not a solved full capture mission. Keep the small caption “Concept illustration” visible during the mechanism sequence. Do not put demonstration measurements on illustrative scenes.

The camera may slow and zoom into capture, but both the tether and payload must continue moving coherently. The grapple is a conceptual mechanism. At release, the payload inherits the appropriate motion and continues under gravity; it does not turn abruptly toward its destination. Electrodynamic recovery shows current in the tether itself. The network view should preserve the distinct Earth, lunar and Phobos architectures.

The final product clips should show actual working controls. Describe Expeditions as a strategy game in its caption and keep its schematic routes separate from Flight Studio calculations. Avoid cost, safety or performance promises that the project's models do not establish.

## Delivery and placement

The first cut uses synthetic narration from Piper's `en_GB-cori-high` voice. The voice creator, Bryce Beattie, publishes it under a [public-domain license](https://brycebeattie.com/files/tts/); the [model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/cori/high/MODEL_CARD) identifies the LibriVox training source. The timing manifest records the model checksum and synthesis settings. No voice is presented as the founder or another identifiable speaker. Narration is normalized to approximately −18 LUFS with a −1.5 dB true-peak ceiling. There is no music track.

Delivery is 1280×720 at 24 fps, H264 video with AAC audio, a WebP poster, WebVTT captions and an HTML transcript. An explicit click or keyboard activation downloads the complete film (about 2.9 MB) while the poster shows a loading label. The native player receives a browser-local Blob URL so seeking works even when static hosting ignores byte-range requests. No video or caption resource is requested on initial homepage load. Captions start enabled, and native controls provide pause, seeking, volume and fullscreen; browsers that require another gesture after the download retain a focused native Play control. Failed requests leave a retry button and direct media link. The Blob is released when leaving the page, except when it is retained for browser back/forward restoration. Reduced-motion visitors get the same still poster until they deliberately play. The transcript and a direct media link remain usable without JavaScript. The interactive walkthrough remains available for visitors who want to pause and explore a moment themselves.

The homepage invitation should read “Watch how a skyhook works” and show the running time. The end card should lead to the existing guided flight and Expeditions. Selected external videos can remain in further learning with their creators credited; the primary introduction should tell this project's story.

## Regenerating the film

Use the narration generator with a local, licensed Cori high model, then render from a current built site. Python Playwright, Chromium, Piper, NumPy and an H264/AAC-capable ffmpeg are production tools, not runtime dependencies of the website:

```sh
python scripts/generate-introduction-audio.py --model /path/to/en_GB-cori-high.onnx --out /path/to/film-audio
python scripts/render-introduction.py --ffmpeg /path/to/ffmpeg --audio /path/to/film-audio/narration.wav --shots /path/to/film-audio/narration-timings.json
```

`scripts/introduction-scene.js` directs the existing FlightStory controls; it does not implement another physics model. Rendering uses fresh browser storage and the tracked campaign fixture. Intermediate frames, source WAV audio and application captures are written outside the published assets under `qa/` or the selected audio output directory. Review the ten generated key frames before rendering all frames with the optional `--stills-only` pass.

The detailed planet imagery is the site's established imagery; its source credits remain in [the texture provenance](../../public/textures/README.md). The film's network routes and free/anchored tether symbols are original drawings. Scientific caveats remain visible during the mechanism and network views, and the final card labels the game separately from the calculated flight experiment.
