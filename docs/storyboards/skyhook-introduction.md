# Skyhook introduction film storyboard

This is the first original Skyhook Industries film: a 95-second introduction for someone who has never heard of a rotating tether. It explains one handoff, why recovery matters, and where to explore the idea on the site. The finished H264/AAC film, poster and English captions live in `public/films/`. The homepage includes a deliberate-play player and a full HTML transcript.

The film uses the site's charcoal, copper and restrained scientific diagrams. Its aircraft and lunar launcher come from the real departure viewers; the orbital principle and recovery views use the existing flight walkthrough. Capture is shown close enough to see the grapple. The film's job is to make the idea understandable and memorable before inviting the viewer into Flight Studio or Expeditions.

## Published narration

Reaching orbit takes speed as well as height. What if the machinery that gives a payload that speed could stay in space?

A skyhook is a rotating tether in orbit. Near the bottom of its swing, the tip moves against the orbital motion, reducing the speed an approaching payload needs to match.

In this concept, a hypersonic aircraft climbs, then coasts toward the moving tip. Position, speed and timing must align. A grapple secures the payload, and the tether carries the load.

The tether lifts the payload and releases it onto a higher-energy trajectory. After release, it coasts under gravity.

That energy comes from the tether's motion. Propulsion, or carefully planned returning cargo, could restore what the outgoing payload took before the next delivery.

At the Moon, a mass driver could launch cargo toward a lunavator. The payload accelerates along the track, then coasts to the grapple.

Phobos itself could anchor the network at Mars. Mercury could support solar industry. And a mission to comet Finlay could put a source of water within reach.

Try a guided flight in Flight Studio. Build and supply a network in Expeditions. Start with one handoff, and see where it could lead.

## Shot plan

| Time | Picture and camera | On-screen text |
| --- | --- | --- |
| 0.0–9.7 s | The actual hypersonic aircraft begins its climb above Earth. | Speed. As well as height. |
| 9.7–23.2 s | The existing orbital illustration shows opposing orbit and spin velocity arrows. | Orbit + rotation. |
| 23.2–38.0 s | Track the aircraft into the real departure viewer’s close grapple sequence. | Meet. Match. Secure. |
| 38.0–47.9 s | Follow the loaded tether through swing and release; the departing payload coasts. | Swing. Release. Then coast. |
| 47.9–60.1 s | Show current within the tether, chemical propulsion and returning cargo in the existing walkthrough. | Recover for the next handoff. |
| 60.1–70.8 s | The actual lunar departure viewer shows acceleration along the rail and ballistic coast. | A different world. The same idea. |
| 70.8–82.9 s | A new network develops into the working campaign, with a brief Finlay mission invitation. | One handoff. A wider network. |
| 82.9–95.4 s | A genuinely completed two-delivery flight and a developed campaign invite the next interaction. | Start with one handoff. |

The edit follows the selected voice’s natural timing. The exact sentence, caption and shot boundaries are tracked in [the timing manifest](skyhook-introduction.timings.json), which also supplies the homepage’s transcript and duration.

## Visual and scientific continuity

Use [FlightStory](../../src/components/FlightStory.astro) and its [motion model](../../src/components/flight-story-motion.ts) as the choreography reference. Camera and drawing coordinates are illustrative; the walkthrough is not a solved full capture mission. Keep the small caption “Concept illustration” visible during the mechanism sequence. Do not put demonstration measurements on illustrative scenes.

The camera may slow and zoom into capture, but both the tether and payload must continue moving coherently. The grapple is a conceptual mechanism. At release, the payload inherits the appropriate motion and continues under gravity; it does not turn abruptly toward its destination. Electrodynamic recovery shows current in the tether itself. The network view should preserve the distinct Earth, lunar and Phobos architectures.

The final product clips should show actual working controls. Describe Expeditions as a strategy game in its caption and keep its schematic routes separate from Flight Studio calculations. Avoid cost, safety or performance promises that the project's models do not establish.

## Delivery and placement

The selected voice is George (`bm_george`), a synthetic stock voice from [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), whose model and voice weights are Apache-2.0 licensed. The local [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) runtime is MIT licensed. The user selected George after hearing Emma and George auditions. Complete shots are synthesized as connected passages at 0.96 speed, with pronunciation overrides for Phobos and lunavator. The edit follows that performance; no speech is time-stretched. Caption timings come from the model’s phoneme durations. The manifest pins model and voice archive hashes, synthesis settings and provenance. No voice is presented as the founder or another identifiable speaker. The finished narration measures −18.05 LUFS integrated and −1.50 dB true peak, with no clipped samples. There is no music track.

Delivery is 1280×720 at 24 fps, H264 video with AAC audio, a WebP poster, WebVTT captions and an HTML transcript. An explicit click or keyboard activation downloads the complete film (5.02 MB) while the poster shows a loading label. The native player receives a browser-local Blob URL so seeking works even when static hosting ignores byte-range requests. No video or caption resource is requested on initial homepage load. Captions start enabled, and native controls provide pause, seeking, volume and fullscreen; browsers that require another gesture after the download retain a focused native Play control. Failed requests leave a retry button and direct media link. The Blob is released when leaving the page, except when it is retained for browser back/forward restoration. Reduced-motion visitors get the same still poster until they deliberately play. The transcript and a direct media link remain usable without JavaScript. The interactive walkthrough remains available for visitors who want to pause and explore a moment themselves.

The homepage invitation should read “Watch how a skyhook works” and show the running time. The end card should lead to the existing guided flight and Expeditions. Selected external videos can remain in further learning with their creators credited; the primary introduction should tell this project's story.

## Regenerating the film

Use the narration generator with the pinned Kokoro model and voices archive, then render from a current built site. Python Playwright, Chromium, kokoro-onnx, NumPy and an H264/AAC-capable ffmpeg are production tools, not runtime dependencies of the website:

```sh
python scripts/generate-introduction-audio.py --engine kokoro --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin --voice bm_george --out /path/to/film-audio
python scripts/render-introduction.py --shots /path/to/film-audio/narration-timings.json --stills-only
python scripts/render-introduction.py --ffmpeg /path/to/ffmpeg --audio /path/to/film-audio/narration.wav --shots /path/to/film-audio/narration-timings.json
```

`scripts/introduction-scene.js` directs the existing FlightStory and departure viewer controls; it does not implement another physics model. Rendering uses fresh browser storage and the tracked campaign fixture. The Flight Studio capture comes from passing the actual second-delivery challenge. Intermediate frames, WAV audio, application captures and default encoded output remain under `qa/` or the selected audio directory. Review the key frames with `--stills-only` before rendering the full film. `--publish` writes reviewed output to `public/films/`; copy the matching generated captions and timing manifest with it.

When publishing a new cut, update the version used for all three media URLs in `IntroductionFilm.astro` so cached audio, poster and captions cannot belong to different edits.

The detailed planet imagery is the site's established imagery; its source credits remain in [the texture provenance](../../public/textures/README.md). The film's network routes and free/anchored tether symbols are original drawings. Scientific caveats remain visible during the mechanism and network views, and the final card labels the game separately from the calculated flight experiment.
