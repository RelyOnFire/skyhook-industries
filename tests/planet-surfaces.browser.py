#!/usr/bin/env python3
"""Delayed imagery must repaint paused WebGL scenes, survive failure, and load in 2D."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT/'dist')))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    out = ROOT/'qa/browser/planet-surfaces'
    out.mkdir(parents=True, exist_ok=True)
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chromium', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
            for body, path, selector in [('earth','/lab/','.scene-three'),('moon','/lab/lunar/','.scene-three'),('mars','/lab/phobos/','.phobos-three'),('t4','/lab/t4/','.t4-three')]:
                page = browser.new_page(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
                page.set_default_timeout(30000)
                page.on('pageerror', lambda e: errors.append(str(e)))
                pending = []
                page.route('**/textures/*.webp', lambda route: pending.append(route))
                page.goto(origin+path, wait_until='domcontentloaded')
                scene = page.locator(selector)
                expect(scene.locator('canvas')).to_be_visible(timeout=90000)
                expect(page.get_by_role('button', name='Play replay', exact=True)).to_be_enabled()
                if body=='t4': page.get_by_role('button', name='Earth orbit', exact=True).click()
                clock = page.get_by_label('Mission time' if body in ['earth','moon'] else 'Flight time', exact=True)
                t = clock.input_value()
                before = scene.screenshot(animations='allow')
                assert pending, 'The check must hold an actual image request'
                for route in pending:
                    asset = ROOT/'dist/textures'/route.request.url.rsplit('/',1)[-1]
                    route.fulfill(body=asset.read_bytes(), content_type='image/webp')
                page.unroute('**/textures/*.webp')
                expect(scene).to_have_attribute('data-surface','ready')
                if body in ['earth','t4']: expect(scene).to_have_attribute('data-clouds','ready')
                page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                after = scene.screenshot(path=str(out/f'{body}-3d.png'), animations='allow')
                assert before!=after, 'A paused scene failed to repaint after its surface loaded'
                assert clock.input_value()==t, 'Loading imagery advanced simulation time'
                page.get_by_role('button', name='Orbit plane', exact=True).click()
                plane = page.locator('.scene-plane' if body in ['earth','moon'] else '.phobos-plane')
                expect(plane).to_be_visible()
                page.wait_for_load_state('networkidle')
                plane.screenshot(path=str(out/f'{body}-plane.png'))
                assert clock.input_value()==t
                print('PASS',body,'delayed surface repaints while paused; 2D and time preserved',flush=True)
                page.close()
            page=browser.new_page(viewport={'width':1440,'height':1000})
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.route('**/textures/*.webp',lambda route: route.abort())
            page.goto(origin+'/lab/',wait_until='networkidle')
            expect(page.locator('.scene-three canvas')).to_be_visible(timeout=90000)
            expect(page.get_by_role('button',name='Play replay',exact=True)).to_be_enabled()
            page.get_by_role('button',name='Orbit plane',exact=True).click()
            expect(page.locator('.scene-plane canvas')).to_be_visible()
            page.close()
            print('PASS failed surface requests keep the scene and fallback controls usable',flush=True)
            page=browser.new_page(viewport={'width':1440,'height':1000})
            page.goto(origin+'/lab/cardio/',wait_until='networkidle')
            expect(page.locator('.cardio-reference-scene .planet-disc')).to_be_visible(timeout=90000)
            images=page.locator('.planet-disc image').evaluate_all('els=>els.map(e=>e.getAttribute("href"))')
            assert images and all(url=='/planets/earth.webp' for url in images)
            page.locator('.cardio-reference-scene').screenshot(path=str(out/'cardio.png'))
            print('PASS Cardio reference uses the shared Earth globe',flush=True)
            assert not errors,errors
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__=='__main__':
    main()
