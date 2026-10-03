#!/usr/bin/env python3
"""Render the original introduction from the built, tested FlightStory controls.

Requires a current dist/, Python Playwright/Chromium and an H264/AAC ffmpeg.
Audio is generated separately; pass the licensed narration WAV and shot JSON.
No personal browser profile or existing player saves are read.
"""
import argparse
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--audio', required=True)
    parser.add_argument('--shots', required=True)
    parser.add_argument('--stills-only', action='store_true')
    parser.add_argument('--fps', type=int, default=24)
    parser.add_argument('--from-second', type=float, default=0, help='Regenerate a shot range in an existing frame set')
    parser.add_argument('--to-second', type=float, help='Exclusive end of a regenerated shot range')
    args = parser.parse_args()
    out = ROOT / 'qa/introduction-film'
    frames = out / 'frames'
    frames.mkdir(parents=True, exist_ok=True)
    public = ROOT / 'public/films'
    public.mkdir(exist_ok=True)
    data = json.loads(Path(args.shots).read_text())
    shots = data['shots'] if isinstance(data, dict) else data
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
        page.goto(origin + '/lab/', wait_until='networkidle')
        expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
        expect(page.locator('.scene-pending')).to_have_count(0)
        page.locator('.flight-panel').scroll_into_view_if_needed()
        page.get_by_role('button', name='Next mission event', exact=True).click()
        page.wait_for_timeout(350)
        studio = page.locator('.flight-panel').screenshot(path=str(out / 'studio.png'))
        page.goto(origin + '/lab/campaign/', wait_until='networkidle')
        expect(page.get_by_role('button', name='Import campaign backup', exact=True)).to_be_enabled()
        page.locator('input[type=file]').set_input_files(str(ROOT / 'tests/fixtures/campaign-v9.json'))
        expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        page.locator('.map-visual').scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        game = page.locator('.map-visual').screenshot(path=str(out / 'game.png'))
        page.set_viewport_size({'width': 1280, 'height': 720})
        page.goto(origin + '/system/', wait_until='networkidle')
        expect(page.locator('[data-story-step="0"]')).to_be_enabled()
        page.evaluate((ROOT / 'scripts/introduction-scene.js').read_text())
        params = {
            'shots': shots, 'duration': duration,
            'studio': 'data:image/png;base64,' + base64.b64encode(studio).decode(),
            'game': 'data:image/png;base64,' + base64.b64encode(game).decode(),
        }
        page.evaluate('params=>{window.filmParams=params;window.drawIntroduction({...params,time:0});}', params)
        page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        page.wait_for_timeout(200)
        stills = [2, 16, 33, 41, 47, 53, 59, 62, 69, 83]
        for time in stills:
            page.evaluate('time=>window.drawIntroduction({...window.filmParams,time})', time)
            page.screenshot(path=str(out / f'still-{time:02}.png'))
        if not args.stills_only:
            for index in range(round(args.from_second * args.fps), round((args.to_second or duration) * args.fps)):
                time = index / args.fps
                page.evaluate('time=>window.drawIntroduction({...window.filmParams,time})', time)
                page.screenshot(path=str(frames / f'{index:05}.png'))
                if index % (args.fps * 10) == 0:
                    print(f'Rendered {time:.0f} / {duration:.0f}s', flush=True)
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
    subprocess.run([args.ffmpeg, '-y', '-i', str(out / 'still-41.png'), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88',
                    str(public / 'skyhook-introduction-poster.webp')], check=True)
    print('Film written to public/films/', flush=True)


if __name__ == '__main__':
    main()
