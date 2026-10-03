#!/usr/bin/env python3
"""The original film loads only on request and has captions and a static transcript."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def end_headers(self):
        if urlsplit(self.path).path.endswith('.mp4'):
            self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        # Native media seeking needs byte ranges, as served by Workers assets.
        # Python's basic static server ignores Range and cannot exercise this.
        self.remaining = None
        request_range = self.headers.get('Range')
        if not request_range or not urlsplit(self.path).path.endswith('.mp4'):
            return super().send_head()
        path = Path(self.translate_path(self.path))
        if not path.is_file():
            self.send_error(404)
            return None
        size = path.stat().st_size
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', request_range)
        if not match or not any(match.groups()):
            self.send_error(416)
            return None
        first, last = match.groups()
        start = int(first) if first else max(0, size-int(last))
        end = min(int(last), size-1) if first and last else size-1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        stream = path.open('rb')
        stream.seek(start)
        self.remaining = end-start+1
        self.send_response(206)
        self.send_header('Content-Type', 'video/mp4')
        self.send_header('Content-Length', str(self.remaining))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        return stream

    def copyfile(self, source, output):
        if self.remaining is None:
            return super().copyfile(source, output)
        remaining = self.remaining
        while remaining:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            output.write(chunk)
            remaining -= len(chunk)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--executable')
    parser.add_argument('--origin', help='Exercise a published branch in an isolated browser')
    args = parser.parse_args()
    out = ROOT / 'qa/browser/site-film'
    out.mkdir(parents=True, exist_ok=True)
    server = None
    if args.origin:
        origin = args.origin.rstrip('/')
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}'
    report = {'origin': origin, 'checks': [], 'errors': []}

    def done(message):
        report['checks'].append(message)
        print('PASS', message, flush=True)

    try:
        with sync_playwright() as p:
            options = {'headless': True}
            if args.executable:
                options['executable_path'] = args.executable
            else:
                options['channel'] = 'chromium'
            browser = p.chromium.launch(**options)
            report['browser'] = browser.version
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
            page = context.new_page()
            page.set_default_timeout(20000)
            media_requests = []
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.on('request', lambda request: media_requests.append(request.url)
                    if urlsplit(request.url).path.endswith(('.mp4', '.webm', '.vtt')) else None)
            try:
                page.goto(origin + '/', wait_until='networkidle')
                film = page.locator('[data-introduction-film]')
                film.scroll_into_view_if_needed()
                expect(film.locator('[data-film-play]')).to_be_visible()
                expect(film.locator('video, source, track')).to_have_count(0)
                assert not media_requests, 'Film media downloaded before an explicit play request'
                summary = film.locator('.film-transcript > summary')
                summary.focus()
                page.keyboard.press('Enter')
                expect(film.locator('.film-transcript')).to_have_attribute('open', '')
                expect(film.locator('.film-transcript')).to_contain_text('Reaching orbit takes speed as well as height.')
                assert not media_requests, 'Reading the transcript downloaded the film'
                summary.click()
                for width, height in [(1440, 1000), (390, 844), (320, 740)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'Homepage overflow at {width}'
                    film.screenshot(path=str(out / f'film-poster-{width}.png'))
                assert not media_requests
                done('film and captions stay unloaded until requested; the static transcript works by keyboard and the poster fits 1440, 390 and 320 px')

                page.set_viewport_size({'width': 1440, 'height': 1000})
                play = film.locator('[data-film-play]')
                play.focus()
                page.keyboard.press('Enter')
                video = film.locator('video')
                expect(video).to_be_visible()
                expect(video).to_be_focused()
                expect(video).to_have_attribute('controls', '')
                expect(video).to_have_attribute('playsinline', '')
                expect(video.locator('track[kind="captions"]')).to_have_attribute('srclang', 'en')
                sizes = video.evaluate("""video => ({
                    width:video.getBoundingClientRect().width,height:video.getBoundingClientRect().height,
                    playerWidth:video.parentElement.clientWidth,playerHeight:video.parentElement.clientHeight
                })""")
                assert abs(sizes['width']-sizes['playerWidth']) <= 1 and abs(sizes['height']-sizes['playerHeight']) <= 1, sizes
                page.wait_for_function("""() => {
                    const video=document.querySelector('[data-film-player] video');
                    return video && video.readyState>=2 && !video.paused && video.currentTime>0;
                }""", polling=100, timeout=30000)
                assert any(urlsplit(url).path.endswith('.mp4') for url in media_requests)
                page.wait_for_function("""() => {
                    const video=document.querySelector('[data-film-player] video');
                    return video && video.textTracks.length===1 && video.textTracks[0].cues?.length>3;
                }""", polling=100)
                details = video.evaluate("""video => ({
                    duration:video.duration, width:video.videoWidth, height:video.videoHeight,
                    captions:video.textTracks[0].cues.length, captionMode:video.textTracks[0].mode,
                    hasAudio:video.mozHasAudio || video.webkitAudioDecodedByteCount>0
                })""")
                assert abs(details['duration']-90) < .1, details
                assert details['width'] >= 1280 and details['height'] >= 720, details
                assert details['captionMode'] == 'showing', details
                assert details['hasAudio'], 'The narrated introduction has no decoded audio track'
                report['media'] = details
                video.evaluate('video => video.pause()')
                page.wait_for_function("""() => {
                    const video=document.querySelector('[data-film-player] video');
                    return video && video.seekable.length && video.seekable.end(video.seekable.length-1)>=24;
                }""", polling=100, timeout=30000)
                video.evaluate('video => { video.currentTime=Math.min(24, video.duration/2); }')
                page.wait_for_function("""() => {
                    const video=document.querySelector('[data-film-player] video');
                    return video && !video.seeking && video.readyState>=2 && Math.abs(video.currentTime-24)<.1;
                }""", polling=100)
                # The seek is complete before this bounded compositor settle;
                # an arbitrary delay alone would conceal a failed native seek.
                page.wait_for_timeout(200)
                film.screenshot(path=str(out / 'film-playing-1440.png'))
                for width, height in [(390, 844), (320, 740)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                    assert video.evaluate('v => Math.abs(v.getBoundingClientRect().width-v.parentElement.clientWidth)<=1 && Math.abs(v.getBoundingClientRect().height-v.parentElement.clientHeight)<=1')
                    film.screenshot(path=str(out / f'film-playing-{width}.png'))
                done('deliberate keyboard activation plays the narrated film with native controls, focused player and enabled English captions')

                nojs_context = browser.new_context(java_script_enabled=False, viewport={'width': 320, 'height': 740}, reduced_motion='reduce')
                nojs = nojs_context.new_page()
                nojs.goto(origin + '/', wait_until='networkidle')
                nojs_film = nojs.locator('[data-introduction-film]')
                expect(nojs_film.get_by_role('link', name='Open the introduction film', exact=True)).to_have_attribute('href', '/films/skyhook-introduction.mp4')
                expect(nojs_film.get_by_role('link', name='Download captions', exact=True)).to_have_attribute('href', '/films/skyhook-introduction.vtt')
                nojs_film.locator('.film-transcript > summary').click()
                expect(nojs_film.locator('.film-transcript')).to_contain_text('Start with one handoff. See where it could lead.')
                assert not nojs.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                nojs_film.screenshot(path=str(out / 'film-nojs-320.png'))
                nojs_context.close()
                done('without JavaScript, the full transcript and direct film/caption links remain available')
                assert not report['errors'], report['errors']
                report['status'] = 'passed'
            except Exception as error:
                report['status'] = 'failed'
                report['failure'] = str(error)
                report['media_debug'] = page.evaluate("""() => {
                    const v=document.querySelector('[data-film-player] video');
                    return v ? {time:v.currentTime,ready:v.readyState,network:v.networkState,error:v.error?.message,
                        seekable:Array.from({length:v.seekable.length},(_,i)=>[v.seekable.start(i),v.seekable.end(i)]),
                        buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)])} : null;
                }""")
                page.screenshot(path=str(out / 'failure.png'), full_page=True)
                raise
            finally:
                browser.close()
    finally:
        (out / 'report.json').write_text(json.dumps(report, indent=2))
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
