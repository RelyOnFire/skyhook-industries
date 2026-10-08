#!/usr/bin/env python3
"""Generate the introduction's licensed stock narration and timed captions.

Current narration (natural timing, no time stretching):
  pip install kokoro-onnx==0.5.0 imageio-ffmpeg==0.6.0
  python scripts/generate-introduction-audio.py --engine kokoro \
    --model ./voices/kokoro-v1.0.onnx --voices ./voices/voices-v1.0.bin \
    --voice bm_george --out ./qa/introduction-audio

The pinned model and voice archive are available at:
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1
Kokoro's weights are Apache-2.0; kokoro-onnx is MIT licensed. The synthesis
tools and models are production tools, not dependencies shipped to visitors.
The film edit follows the complete-shot performance. Captions use the model's
phoneme durations, rather than stretching speech to the previous edit.

Historical first-cut regeneration (--engine piper):

Install in a virtual environment: pip install piper-tts==1.8.0 imageio-ffmpeg==0.6.0
Download: python -m piper.download_voices --download-dir ./voices en_GB-cori-high
Run: python scripts/generate-introduction-audio.py --engine piper \
    --model ./voices/en_GB-cori-high.onnx \
    --manifest /path/to/first-cut.timings.json --out ./qa/introduction-audio
Use the first-cut timing manifest from commit 38b2952 for that historical cut.

Cori high is a stock voice published as public domain by Bryce Beattie:
https://brycebeattie.com/files/tts/
https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/cori/high/MODEL_CARD
Piper is the local GPL-3.0 synthesis tool; neither its runtime nor the model is
included in the website. No voice cloning, remote API, account or key is used.

For historical Piper regeneration only, sentence audio is gently retimed to
the first cut's edit and captions. The current Kokoro path never time-stretches
speech: its generated manifest supplies the new edit and caption boundaries.
Review regenerated audio before replacing the published film soundtrack.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import wave


KOKORO_MODEL_SHA256 = 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a'
KOKORO_VOICES_SHA256 = 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'
PRONUNCIATIONS = {'lunavator': 'lˈuːnəveɪtə', 'Phobos': 'fˈəʊbɒs'}


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


def write_captions(path, cues):
    path.write_text('WEBVTT\n\n' + '\n\n'.join(
        f'{index + 1}\n{stamp(cue["start"])} --> {stamp(cue["end"])}\n{cue["text"]}'
        for index, cue in enumerate(cues)
    ) + '\n')


def generate_kokoro(args, manifest):
    import numpy as np
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    import imageio_ffmpeg

    if args.voices is None:
        raise ValueError('Kokoro requires --voices pointing to voices-v1.0.bin')
    for path, expected in [(args.model, KOKORO_MODEL_SHA256), (args.voices, KOKORO_VOICES_SHA256)]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Unexpected checksum for {path.name}; use the documented model-files-v1.1 release.')

    rate = 24000
    output_rate = 48000
    speed = args.speed if args.speed is not None else manifest.get('synthesis', {}).get('speed', .96)
    if not .5 <= speed <= 2:
        raise ValueError('Speech speed must be between 0.5 and 2')
    settings = ort.SessionOptions()
    settings.intra_op_num_threads = args.threads
    settings.inter_op_num_threads = 1
    session = ort.InferenceSession(str(args.model), sess_options=settings, providers=['CPUExecutionProvider'])
    voice = Kokoro.from_session(session, str(args.voices))
    if args.voice not in voice.voices:
        raise ValueError(f'Unknown stock voice {args.voice}')
    language = 'en-gb' if args.voice.startswith('b') else 'en-us'

    # Use the pinned graph directly: kokoro-onnx 0.5.0 casts this graph's
    # fractional speed to int32, and its public helper discards phoneme timing.
    # The graph accepts float32 speed and also returns duration per input token.
    style = voice.get_voice_style(args.voice)
    samples, shots, cues = [], [], []
    cursor = 0
    args.out.mkdir(parents=True, exist_ok=True)
    for index, source in enumerate(manifest['shots']):
        sentence_sources = source.get('sentences') or [
            {'text': text} for text in re.split(r'(?<=[.!?])\s+', source['text'])
        ]
        if ' '.join(s['text'] for s in sentence_sources) != source['text']:
            raise ValueError(f'Sentence text does not match shot {source["id"]}')
        pieces, ranges, sentence_ranges = [], [], []
        token_cursor = 1  # The graph begins with a padding token.
        for sentence in sentence_sources:
            phrases = sentence.get('phrases') or textwrap.wrap(sentence['text'], 76, break_long_words=False, break_on_hyphens=False)
            if ' '.join(phrases) != sentence['text']:
                raise ValueError(f'Caption phrases do not match {sentence["text"]}')
            first = len(ranges)
            for phrase in phrases:
                phonemes = voice.tokenizer.phonemize(phrase, language)
                for word, pronunciation in PRONUNCIATIONS.items():
                    phonemes = phonemes.replace(voice.tokenizer.phonemize(word, language), pronunciation)
                if pieces:
                    pieces.append(' ')
                    token_cursor += 1
                start = token_cursor
                pieces.append(phonemes)
                token_cursor += len(voice.tokenizer.tokenize(phonemes))
                ranges.append((phrase, start, token_cursor))
            sentence_ranges.append((sentence, first, len(ranges) - 1))
        phonemes = ''.join(pieces)
        tokens = voice.tokenizer.tokenize(phonemes)
        if not tokens or len(tokens) > 508:
            raise ValueError(f'Shot {source["id"]} exceeds a single natural synthesis passage; split the shot.')
        waveform, durations = session.run(['waveform', 'duration'], {
            'input_ids': np.array([[0, *tokens, 0]], dtype=np.int64),
            'style': np.array(style[len(tokens)], dtype=np.float32),
            'speed': np.array([speed], dtype=np.float32),
        })
        if len(durations) != len(tokens) + 2 or not np.all(np.isfinite(waveform)) or np.max(np.abs(waveform)) < .01:
            raise RuntimeError(f'Invalid synthesis output for {source["id"]}')
        # The model emits 600 waveform samples for each duration frame.
        if len(waveform) != int(durations.sum()) * 600:
            raise RuntimeError('The pinned model phoneme clock no longer matches its waveform')
        leading = source.get('leadingSilence', .6 if index == 0 else .3)
        trailing = source.get('trailingSilence', 2.5 if index == len(manifest['shots']) - 1 else .8)
        if not (0 <= leading <= 5 and 0 <= trailing <= 5):
            raise ValueError('Shot breathing room must be between zero and five seconds')
        lead_samples, tail_samples = round(leading * rate), round(trailing * rate)
        speech_start = cursor + lead_samples
        boundaries = np.concatenate(([0], np.cumsum(durations))) * 600
        shot_cues = [{
            'start': round((speech_start + int(boundaries[start])) / rate, 3),
            'end': round((speech_start + int(boundaries[end])) / rate, 3),
            'text': '\n'.join(textwrap.wrap(text, 42, break_long_words=False, break_on_hyphens=False)),
        } for text, start, end in ranges]
        sentences = [{
            'text': sentence['text'],
            'phrases': sentence.get('phrases') or [r[0] for r in ranges[first:last + 1]],
            'start': shot_cues[first]['start'], 'end': shot_cues[last]['end'],
        } for sentence, first, last in sentence_ranges]
        end = speech_start + len(waveform) + tail_samples
        shots.append({
            'id': source['id'], 'start': cursor / rate, 'end': end / rate,
            'text': source['text'], 'sentences': sentences,
            'leadingSilence': leading, 'trailingSilence': trailing,
        })
        cues.extend(shot_cues)
        samples.extend([np.zeros(lead_samples), waveform, np.zeros(tail_samples)])
        print(f'{source["id"]}: {cursor / rate:.3f}–{end / rate:.3f}s ({(end - cursor) / rate:.3f}s)', flush=True)
        cursor = end

    combined = np.concatenate(samples)
    ffmpeg = args.ffmpeg or imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix='skyhook-narration-') as scratch:
        raw = Path(scratch) / 'master.wav'
        # Preserve waveform peaks before conversion to integer PCM. Loudness
        # normalization follows; do not clip the neural model's raw samples.
        combined *= min(1, .98 / float(np.max(np.abs(combined))))
        write_wav(raw, np.round(combined * 32767), rate)
        subprocess.run([
            ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw),
            '-af', 'loudnorm=I=-18:TP=-1.5:LRA=9', '-ar', str(output_rate), str(args.out / 'narration.wav'),
        ], check=True)
    write_captions(args.out / 'skyhook-introduction.en.vtt', cues)
    generated = {
        'duration': cursor / rate, 'sampleRate': output_rate, 'audio': 'narration.wav',
        'voice': f'Kokoro {args.voice}, synthetic stock narration',
        'modelCard': 'https://huggingface.co/hexgrad/Kokoro-82M',
        'voiceLicense': 'Apache-2.0 model and stock voice weights',
        'voiceLicenseURL': 'https://huggingface.co/hexgrad/Kokoro-82M',
        'engine': 'kokoro-onnx 0.5.0',
        'modelSource': 'https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1',
        'modelSHA256': KOKORO_MODEL_SHA256, 'voicesSHA256': KOKORO_VOICES_SHA256,
        'synthesis': {'voice': args.voice, 'speed': speed, 'language': language, 'pronunciations': PRONUNCIATIONS},
        'captionTiming': 'Kokoro phoneme durations, 600 samples per frame at 24 kHz; no speech time stretching.',
        'loudness': {'integratedLUFS': -18, 'truePeakDB': -1.5},
        'shots': shots, 'captions': cues,
    }
    (args.out / 'narration-timings.json').write_text(json.dumps(generated, indent=2, ensure_ascii=False) + '\n')
    print(f'Created {cursor / rate:g}s {args.voice} narration and {len(cues)} caption cues in {args.out}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--model', type=Path, required=True, help='Downloaded Kokoro model, or historical Piper model with its adjacent JSON')
    parser.add_argument('--engine', choices=['kokoro', 'piper'], help='Defaults to the engine recorded in the manifest')
    parser.add_argument('--voices', type=Path, help='Downloaded Kokoro voices-v1.0.bin')
    parser.add_argument('--voice', default='bm_george', help='Licensed Kokoro stock voice; default is the selected George voice')
    parser.add_argument('--speed', type=float, help='Natural synthesis speech rate; default is the manifest rate or 0.96')
    parser.add_argument('--threads', type=int, default=4, help='CPU synthesis threads')
    parser.add_argument('--out', type=Path, required=True, help='Generated audio directory, usually outside committed source')
    parser.add_argument('--manifest', type=Path, default=Path(__file__).resolve().parents[1] / 'docs/storyboards/skyhook-introduction.timings.json')
    parser.add_argument('--ffmpeg', help='Optional ffmpeg executable; otherwise use imageio-ffmpeg')
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text())
    engine = args.engine or ('kokoro' if manifest.get('engine', '').startswith('kokoro') or args.voices else 'piper')
    if engine == 'kokoro':
        try:
            generate_kokoro(args, manifest)
        except (ValueError, RuntimeError) as error:
            parser.error(str(error))
        return

    import numpy as np
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    import imageio_ffmpeg

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
