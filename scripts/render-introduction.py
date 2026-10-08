#!/usr/bin/env python3
"""Render the introduction using the built application's real scene controls.

Requires a current dist/, Python Playwright/Chromium and an H264/AAC ffmpeg.
Audio is generated separately; pass the licensed narration WAV and shot JSON.
No personal browser profile or existing player saves are read.
Proof stills need no audio or encoder. Full renders stay in qa/ unless --publish
is explicitly requested after review of the selected voice and shot timing.
"""
import argparse
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import threading
import time as runtime
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


DEPARTURE_CSS = """
html,body{width:1000px!important;height:620px!important;margin:0!important;overflow:hidden!important;background:#070d13!important}
.campaign .departure-dialog{width:1000px!important;height:620px!important;max-width:none!important;max-height:none!important;inset:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:hidden!important}
.campaign .departure-dialog > :not(.departure-stage),.campaign .departure-caption,.campaign .departure-overlay{display:none!important}
.campaign .departure-stage{border:0!important;width:1000px!important;height:620px!important}
.campaign .departure-dialog::backdrop{background:#070d13!important;backdrop-filter:none!important}
"""


def prepare_departure(frame, body):
    """An isolated real campaign creates its own demonstration; no synthetic poses."""
    expect(frame.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
    frame.get_by_role('button', name='Start new network', exact=True).evaluate('(button)=>button.click()')
    launch = frame.get_by_role('button', name=f'Explore {body} launch', exact=True)
    expect(launch).to_be_enabled()
    launch.evaluate('(button)=>button.click()')
    expect(frame.locator('.departure-visual')).to_have_attribute('data-renderer', 'webgl', timeout=60000)
    detail = 'earthDetail' if body == 'Earth' else 'moonGround'
    frame.wait_for_function('(name)=>document.querySelector(".departure-webgl").dataset[name]==="ready"', arg=detail)
    frame.add_style_tag(content=DEPARTURE_CSS)


def seek_departure(frame, elapsed, duration):
    # Use the native setter so React handles the same input event as the player.
    frame.locator('input[aria-label="Departure progress"]').evaluate("""(input,value)=>{
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
    }""", round(max(0, min(1, elapsed / duration)) * 1000))


def departure_time(time, shots):
    """Edit the real replay clocks; scene models continue to own their motion."""
    shot = next((s for s in shots if s['start'] <= time < s['end']), shots[-1])
    progress = max(0, min(1, (time - shot['start']) / (shot['end'] - shot['start'])))
    def interpolate(points):
        for (start, a), (end, b) in zip(points, points[1:]):
            if time <= end:
                return a + (b - a) * max(0, min(1, (time - start) / (end - start)))
        return points[-1][1]
    if shot['id'] == 'opening':
        return 'earth', .5 + 5.3 * progress
    if shot['id'] == 'earth':
        # Establish the arriving carrier, then retain the close grapple view
        # long enough to see jaw closure and the latched cargo fitting.
        sentences = shot.get('sentences', [])
        if len(sentences) >= 3:
            return 'earth', interpolate([(shot['start'], 5.8), (sentences[0]['end'], 9),
                                         (sentences[2]['start'], 11.2), (shot['end'], 16)])
        return 'earth', 5.8 + 10.2 * progress
    if shot['id'] == 'release':
        return 'earth', 16 + 16 * progress
    if shot['id'] == 'moon':
        # Show powered acceleration and then unpowered coast. Preserve the
        # existing continuous rail-exit clock instead of speeding up the cargo.
        sentences = shot.get('sentences', [])
        if len(sentences) >= 2:
            acceleration = sentences[1]['start']
            # Acceleration occupies the first phrase of the second sentence;
            # the following coast keeps almost the same editorial time scale.
            coast = acceleration + (sentences[1]['end'] - acceleration) * .55
            return 'moon', interpolate([(shot['start'], 0), (acceleration, 4), (coast, 10), (shot['end'], 17)])
        return 'moon', 13 * progress + 4
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg')
    parser.add_argument('--audio')
    parser.add_argument('--shots', required=True)
    parser.add_argument('--stills-only', action='store_true')
    parser.add_argument('--publish', action='store_true', help='Write reviewed media to public/films rather than qa/introduction-film/rendered')
    parser.add_argument('--fps', type=int, default=24)
    args = parser.parse_args()
    if not args.stills_only and (not args.ffmpeg or not args.audio):
        parser.error('A full render requires --ffmpeg and --audio; use --stills-only for visual proofs.')
    if args.fps < 1:
        parser.error('--fps must be positive.')
    out = ROOT / 'qa/introduction-film'
    frames = out / 'frames'
    frames.mkdir(parents=True, exist_ok=True)
    public = ROOT / 'public/films' if args.publish else out / 'rendered'
    public.mkdir(parents=True, exist_ok=True)
    data = json.loads(Path(args.shots).read_text())
    shots = data['shots'] if isinstance(data, dict) else data
    expected_ids = ['opening', 'principle', 'earth', 'release', 'recovery', 'moon', 'network', 'endcard']
    if [shot['id'] for shot in shots] != expected_ids:
        parser.error('The composition requires the eight named storyboard shots in their established order.')
    if shots[0]['start'] != 0 or any(shot['end'] <= shot['start'] for shot in shots) or any(left['end'] != right['start'] for left, right in zip(shots, shots[1:])):
        parser.error('Shot ranges must be positive and contiguous.')
    duration = shots[-1]['end']
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    report = {'duration': duration, 'fps': args.fps, 'shots': shots, 'errors': []}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chromium', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1440, 'height': 960}, reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        # Genuine application views, using isolated throwaway storage.
        page.goto(origin + '/lab/?mission=second-delivery', wait_until='networkidle')
        page.get_by_role('button', name='Start this mission', exact=True).click()
        expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
        expect(page.locator('.scene-pending')).to_have_count(0)
        challenge = page.get_by_role('region', name='Active challenge')
        challenge.get_by_role('button', name='Open recovery controls →', exact=True).click()
        page.get_by_role('group', name='Recovery method').get_by_role('button', name='Chemical', exact=False).click()
        page.get_by_role('spinbutton', name='Propellant budget', exact=False).fill('20')
        challenge.get_by_role('button', name='Run changed design →', exact=True).click()
        expect(page.locator('.mission-passed')).to_be_visible(timeout=90000)
        report['studio_result'] = page.locator('.mission-passed').inner_text()
        studio_outcome = page.locator('.mission-passed').screenshot(path=str(out / 'studio-outcome.png'))
        page.locator('.flight-panel').scroll_into_view_if_needed()
        # A calculated capture checkpoint from the actual guided flight.
        page.get_by_role('button', name='Guided replay', exact=True).click()
        page.get_by_role('button', name='Next checkpoint →', exact=True).click()
        expect(page.locator('.guided-replay')).to_contain_text('The payload joins the rotating machine.')
        page.wait_for_timeout(350)
        studio = page.locator('.scene-box').screenshot(path=str(out / 'studio.png'))
        page.goto(origin + '/lab/campaign/', wait_until='networkidle')
        expect(page.get_by_role('button', name='Import campaign backup', exact=True)).to_be_enabled()
        page.get_by_role('button', name='Start new network', exact=True).click()
        expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        page.add_style_tag(content='.ops-grid{display:block!important}.map-visual{width:1100px!important;max-width:none!important}')
        page.locator('.map-visual').scroll_into_view_if_needed()
        game_start = page.locator('.map-visual').screenshot(path=str(out / 'game-start.png'))
        fixture = ROOT / 'tests/fixtures/campaign-v7.json'
        fixture_name = json.loads(fixture.read_text())['state']['name']
        page.locator('input[type=file]').set_input_files(str(fixture))
        expect(page.locator('.campaign-header h1')).to_contain_text(fixture_name)
        expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        page.locator('.map-visual').scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        game = page.locator('.map-visual').screenshot(path=str(out / 'game.png'))
        page.set_viewport_size({'width': 1280, 'height': 720})
        page.goto(origin + '/system/', wait_until='networkidle')
        expect(page.locator('[data-story-step="0"]')).to_be_enabled()
        page.evaluate((ROOT / 'scripts/introduction-scene.js').read_text())
        departure_frames = {}
        for body in ['Earth', 'Moon']:
            frame = page.locator(f'#{body.lower()}-scene').element_handle().content_frame()
            frame.wait_for_load_state('networkidle')
            prepare_departure(frame, body)
            departure_frames[body.lower()] = frame
        params = {
            'shots': shots, 'duration': duration,
            'studio': 'data:image/png;base64,' + base64.b64encode(studio).decode(),
            'studioOutcome': 'data:image/png;base64,' + base64.b64encode(studio_outcome).decode(),
            'game': 'data:image/png;base64,' + base64.b64encode(game).decode(),
            'gameStart': 'data:image/png;base64,' + base64.b64encode(game_start).decode(),
        }
        page.evaluate('params=>{window.filmParams=params;window.drawIntroduction({...params,time:0});}', params)
        page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        page.wait_for_timeout(200)
        def draw(time):
            departure = departure_time(time, shots)
            if departure:
                body, elapsed = departure
                seek_departure(departure_frames[body], elapsed, 32 if body == 'earth' else 39)
            page.evaluate('time=>window.drawIntroduction({...window.filmParams,time})', time)

        stills = [(shot['id'], shot['start'] + (shot['end'] - shot['start']) * p)
                  for shot in shots for p in ([.2, .55, .85] if shot['id'] in ['earth', 'moon', 'network'] else [.55])]
        for shot_id, time in stills:
            draw(time)
            page.screenshot(path=str(out / f'still-{shot_id}-{time:05.1f}.png'))
        if not args.stills_only:
            render_start = runtime.monotonic()
            for index in range(round(duration * args.fps)):
                time = index / args.fps
                draw(time)
                page.screenshot(path=str(frames / f'{index:05}.png'))
                if index % (args.fps * 10) == 0:
                    print(f'Rendered {time:.0f} / {duration:.0f}s', flush=True)
                if index == 99:
                    seconds = runtime.monotonic() - render_start
                    print(f'First 100 frames: {seconds:.1f}s ({100 / seconds:.1f} frames/s); estimated full capture {duration * args.fps * seconds / 6000:.1f} min', flush=True)
            report['render_seconds'] = round(runtime.monotonic() - render_start, 2)
        browser.close()
    server.shutdown()
    if report['errors']:
        raise RuntimeError(report['errors'])
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    if args.stills_only:
        return
    subprocess.run([args.ffmpeg, '-y', '-framerate', str(args.fps), '-i', str(frames / '%05d.png'), '-i', args.audio,
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-t', str(duration),
                    str(public / 'skyhook-introduction.mp4')], check=True)
    poster_time = next(shot for shot in shots if shot['id'] == 'earth')
    poster = out / f"still-earth-{poster_time['start'] + (poster_time['end'] - poster_time['start']) * .85:05.1f}.png"
    subprocess.run([args.ffmpeg, '-y', '-i', str(poster), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88',
                    str(public / 'skyhook-introduction-poster.webp')], check=True)
    print(f'Film written to {public}', flush=True)


if __name__ == '__main__':
    main()
