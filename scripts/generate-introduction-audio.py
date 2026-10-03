#!/usr/bin/env python3
"""Regenerate the original introduction's synthetic narration and captions.

Install in a virtual environment: pip install piper-tts==1.8.0 imageio-ffmpeg==0.6.0
Download: python -m piper.download_voices --download-dir ./voices en_GB-cori-high
Run: python scripts/generate-introduction-audio.py \
    --model ./voices/en_GB-cori-high.onnx --out ./qa/introduction-audio

Cori high is a stock voice published as public domain by Bryce Beattie:
https://brycebeattie.com/files/tts/
https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/cori/high/MODEL_CARD
Piper is the local GPL-3.0 synthesis tool; neither its runtime nor the model is
included in the website. No voice cloning, remote API, account or key is used.

The checked-in timing manifest supplies all spoken text and edit boundaries.
Neural synthesis is not byte-deterministic; regenerated sentences are gently
retimed to preserve the finished film's existing edit and caption timing.
Review the resulting audio before replacing the published film soundtrack.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave


def stamp(seconds):
    milliseconds = round(seconds * 1000)
    return (f'{milliseconds // 3600000:02}:'
            f'{milliseconds // 60000 % 60:02}:'
            f'{milliseconds // 1000 % 60:02}.{milliseconds % 1000:03}')


def write_wav(path, samples, rate):
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(samples.astype('<i2').tobytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--model', type=Path, required=True, help='Downloaded en_GB-cori-high.onnx; its .onnx.json must be adjacent')
    parser.add_argument('--out', type=Path, required=True, help='Generated audio directory, usually outside committed source')
    parser.add_argument('--manifest', type=Path, default=Path(__file__).resolve().parents[1] / 'docs/storyboards/skyhook-introduction.timings.json')
    parser.add_argument('--ffmpeg', help='Optional ffmpeg executable; otherwise use imageio-ffmpeg')
    args = parser.parse_args()

    import numpy as np
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    import imageio_ffmpeg

    manifest = json.loads(args.manifest.read_text())
    model_hash = hashlib.sha256(args.model.read_bytes()).hexdigest()
    if model_hash != manifest['modelSHA256']:
        parser.error('Voice checksum differs from the film manifest; download the documented Cori high model.')
    ffmpeg = args.ffmpeg or imageio_ffmpeg.get_ffmpeg_exe()
    voice = PiperVoice.load(args.model)
    rate = voice.config.sample_rate
    settings = SynthesisConfig(**manifest['synthesis'], normalize_audio=False, volume=1)
    total = manifest['duration']
    samples = np.zeros(round(total * rate), dtype=np.int16)
    previous_end = 0.0
    for shot in manifest['shots']:
        for sentence in shot['sentences']:
            start, end = sentence['start'], sentence['end']
            if not (previous_end <= start < end <= shot['end'] <= total and shot['start'] <= start):
                parser.error(f'Invalid sentence timing in {shot["id"]}')
            previous_end = end

    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='skyhook-narration-') as scratch:
        scratch = Path(scratch)
        for shot in manifest['shots']:
            for sentence in shot['sentences']:
                spoken = sentence['text'].replace('Phobos', '[[fˈəʊbɒs]]')
                audio = np.concatenate([chunk.audio_float_array for chunk in voice.synthesize(spoken, syn_config=settings)])
                sounding = np.flatnonzero(np.abs(audio) > .003)
                if not len(sounding):
                    raise RuntimeError(f'No speech generated for {sentence["text"]}')
                # Preserve breathing room; trim only the low-level leading/tail silence.
                first = max(0, int(sounding[0]) - round(.08 * rate))
                last = min(len(audio), int(sounding[-1]) + round(.18 * rate))
                audio = np.round(np.clip(audio[first:last], -.98, .98) * 32767).astype('<i2')
                start = round(sentence['start'] * rate)
                target_samples = round(sentence['end'] * rate) - start
                target_seconds = target_samples / rate
                tempo = len(audio) / target_samples
                if not .65 <= tempo <= 1.5:
                    raise RuntimeError(f'Large speech timing change ({tempo:.2f}×) in {shot["id"]}; review and retime the manifest.')
                write_wav(scratch / 'sentence.wav', audio, rate)
                subprocess.run([
                    ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(scratch / 'sentence.wav'), '-af',
                    f'atempo={tempo:.9f},apad,atrim=duration={target_seconds:.9f}',
                    '-ar', str(rate), str(scratch / 'timed.wav'),
                ], check=True)
                with wave.open(str(scratch / 'timed.wav'), 'rb') as timed:
                    data = np.frombuffer(timed.readframes(timed.getnframes()), dtype='<i2')
                if abs(len(data) - target_samples) > 1:
                    raise RuntimeError('Encoder produced an unexpected sentence duration')
                samples[start:start + min(len(data), target_samples)] = data[:target_samples]
            print(f'Generated {shot["id"]}', flush=True)
        write_wav(scratch / 'master.wav', samples, rate)
        subprocess.run([
            ffmpeg, '-hide_banner', '-loglevel', 'warning', '-y',
            '-i', str(scratch / 'master.wav'),
            '-af', 'loudnorm=I=-18:TP=-1.5:LRA=9',
            '-ar', str(manifest['sampleRate']), str(args.out / 'narration.wav'),
        ], check=True)

    cues = manifest['captions']
    captions = 'WEBVTT\n\n' + '\n\n'.join(
        f'{index + 1}\n{stamp(cue["start"])} --> {stamp(cue["end"])}\n{cue["text"]}'
        for index, cue in enumerate(cues)
    ) + '\n'
    (args.out / 'skyhook-introduction.en.vtt').write_text(captions)
    regenerated = {**manifest, 'audio': 'narration.wav', 'regeneration': 'Sentences retimed to the checked-in edit; listen before publication.'}
    (args.out / 'narration-timings.json').write_text(json.dumps(regenerated, indent=2) + '\n')
    print(f'Created {total:g}s narration, timing manifest and {len(cues)} caption cues in {args.out}')


if __name__ == '__main__':
    main()
