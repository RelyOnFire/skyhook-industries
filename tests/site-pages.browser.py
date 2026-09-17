#!/usr/bin/env python3
"""Capture the built company pages and check their responsive reading layout.

Runs in the repository's native-browser CI environment. Screenshots are review
evidence, not a substitute for visual inspection.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ['system', 'research', 'roadmap', 'reference-architecture', 'about', 'contact', 'archive', '404']


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    out = ROOT / 'qa/browser/company'
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    report = {'pages': [], 'errors': []}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chromium', headless=True)
        page = browser.new_page(reduced_motion='reduce')
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        try:
            for route in ROUTES:
                for width, height in [(1440, 1000), (768, 1024), (390, 844), (320, 800)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    path = '/404.html' if route == '404' else f'/{route}/'
                    response = page.goto(origin + path, wait_until='networkidle')
                    assert response and response.ok, f'Failed to load {path}'
                    expect(page.locator('main h1')).to_have_count(1)
                    expect(page.locator('.brand-wordmark')).to_be_visible()
                    await_fonts = 'async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}'
                    page.evaluate(await_fonts)
                    page.screenshot(path=str(out / f'{route}-{width}.png'), full_page=True)
                    page.screenshot(path=str(out / f'{route}-viewport-{width}.png'))
                    overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                    if overflow:
                        report['errors'].append(f'Horizontal page overflow: {route} at {width}px')
                    report['pages'].append({'route': path, 'width': width, 'overflow': overflow})
            report['status'] = 'failed' if report['errors'] else 'passed'
            assert not report['errors'], report['errors']
            print('PASS company pages at four widths; review screenshots in qa/browser/company', flush=True)
        except Exception as e:
            report['status'] = 'failed'
            report['failure'] = str(e)
            raise
        finally:
            (out / 'report.json').write_text(json.dumps(report, indent=2))
            browser.close()
            server.shutdown()


if __name__ == '__main__':
    main()
