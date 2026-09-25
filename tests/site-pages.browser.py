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
    report = {'pages': [], 'navigation': [], 'errors': []}
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
            # Exercise the shared header in both layout families, with real
            # keyboard movement so closing a menu cannot strand keyboard focus.
            for path in ['/', '/research/', '/lab/method/']:
                page.set_viewport_size({'width': 390, 'height': 844})
                page.goto(origin + path, wait_until='networkidle')
                page.keyboard.press('Tab')
                expect(page.get_by_role('link', name='Skip to content', exact=True)).to_be_focused()
                page.keyboard.press('Enter')
                page.keyboard.press('Tab')
                assert page.evaluate("!!document.activeElement?.closest('main')"), f'Skip link failed: {path}'

                menu = page.locator('.brand-mobile')
                trigger = menu.locator('summary')
                trigger.focus(); page.keyboard.press('Enter')
                expect(menu).to_have_attribute('open', '')
                page.keyboard.press('Tab')
                expect(menu.get_by_role('link', name='Tether Lab', exact=True)).to_be_focused()
                page.screenshot(path=str(out / f'navigation-{path.strip("/").replace("/", "-") or "home"}.png'))
                page.keyboard.press('Escape')
                expect(menu).not_to_have_attribute('open', '')
                expect(trigger).to_be_focused()

                page.keyboard.press('Space')
                expect(menu).to_have_attribute('open', '')
                page.keyboard.press('Shift+Tab')
                expect(page.locator('.brand-wordmark')).to_be_focused()
                expect(menu).not_to_have_attribute('open', '')

                trigger.click()
                # Use the page gutter, outside the overlaid menu. The homepage
                # title is deliberately pointer-transparent over its illustration.
                header_box = page.locator('.brand-header').bounding_box()
                page.mouse.click(8, header_box['y'] + header_box['height'] + 24)
                expect(menu).not_to_have_attribute('open', '')
                trigger.click()
                menu.get_by_role('link', name='Contact', exact=True).focus()
                page.keyboard.press('Tab')
                if path.startswith('/lab/'):
                    expect(page.locator('.lab-section-nav a').first).to_be_focused()
                else:
                    assert page.evaluate("!!document.activeElement?.closest('main')"), f'Menu exit lost focus: {path}'
                expect(menu).not_to_have_attribute('open', '')

                trigger.click()
                menu.get_by_role('link', name='Research', exact=True).focus()
                page.set_viewport_size({'width': 1001, 'height': 844})
                expect(page.locator('.brand-links').get_by_role('link', name='Research', exact=True)).to_be_focused()
                expect(menu).not_to_have_attribute('open', '')
                page.set_viewport_size({'width': 390, 'height': 844})
                expect(trigger).to_be_focused()
                expect(menu).not_to_have_attribute('open', '')
                outside = page.locator('main a, main button, main summary').first
                outside.focus()
                page.set_viewport_size({'width': 1001, 'height': 844})
                expect(outside).to_be_focused()
                page.set_viewport_size({'width': 390, 'height': 844})
                expect(outside).to_be_focused()
                trigger.click()
                menu.get_by_role('link', name='Contact', exact=True).click()
                expect(page).to_have_url(origin + '/contact/')
                expect(page.locator('main h1')).to_have_text('Bring a real problem.')
                report['navigation'].append(path)

            # Enhancing dismissal must not make navigation depend on JavaScript.
            native = browser.new_page(java_script_enabled=False, viewport={'width': 320, 'height': 800})
            native.goto(origin + '/research/', wait_until='networkidle')
            native.locator('.brand-mobile summary').click()
            native.locator('.brand-mobile').get_by_role('link', name='Contact', exact=True).click()
            expect(native).to_have_url(origin + '/contact/')
            native.close()
            report['navigation'].append('native disclosure without JavaScript')

            # The illustrated flight keeps every stage selectable with reduced
            # motion, and motion starts only when that visitor explicitly asks.
            page.set_viewport_size({'width': 1440, 'height': 1000})
            page.goto(origin + '/system/', wait_until='networkidle')
            story = page.locator('[data-flight-story]')
            expect(story.get_by_role('heading', name='Follow the handoff.')).to_be_visible()
            expect(story.locator('[data-story-motion]')).to_have_text('Play animation')
            story.get_by_role('button', name='Swing').click()
            expect(story.locator('[data-story-title]')).to_have_text('Carry the payload outward.')
            expect(story.locator('[data-story-value]')).to_have_text('Momentum')
            expect(story.get_by_role('button', name='Swing')).to_have_attribute('aria-current', 'step')
            still = story.locator('[data-story-tether]').get_attribute('transform')
            page.wait_for_timeout(120)
            assert story.locator('[data-story-tether]').get_attribute('transform') == still
            story.locator('[data-story-motion]').click()
            expect(story.locator('[data-story-motion]')).to_have_text('Pause animation')
            page.wait_for_timeout(120)
            assert story.locator('[data-story-tether]').get_attribute('transform') != still
            # Pause freezes the current frame, including at the instant of the
            # click; it must not jump to an unrelated representative pose.
            paused = story.evaluate('''s => {
                const tether = s.querySelector('[data-story-tether]');
                const before = tether.getAttribute('transform');
                s.querySelector('[data-story-motion]').click();
                return {before, after: tether.getAttribute('transform')};
            }''')
            assert paused['before'] == paused['after']
            expect(story.locator('[data-story-motion]')).to_have_text('Play animation')
            page.wait_for_timeout(120)
            assert story.locator('[data-story-tether]').get_attribute('transform') == paused['after']

            def scrub(value):
                story.locator('[data-story-progress]').evaluate('''(input, value) => {
                    input.value = String(value); input.dispatchEvent(new Event('input', {bubbles: true}));
                }''', value)

            story.get_by_role('button', name='Capture', exact=False).click()
            scrub(0)
            story.locator('[data-story-motion]').click()
            page.wait_for_timeout(1100)
            capture_progress = int(story.locator('[data-story-progress]').input_value())
            assert 100 < capture_progress < 400, f'Capture rushes past: {capture_progress}'
            expect(story.locator('[data-story-timescale]')).to_have_text('CAPTURE · SLOW MOTION')
            scrub(500)

            # Scrub the actual rendered scene to catch coordinate or transform
            # mistakes, not just errors in the numerical drawing helper.
            prior_end = None
            for stage, name in enumerate(['Approach', 'Capture', 'Swing', 'Release', 'Recover']):
                story.get_by_role('button', name=name).click()
                positions = []
                for value in range(0, 1001, 50):
                    scrub(value)
                    positions.append(story.evaluate('''s => {
                        const earth = s.querySelector('[data-story-earth]');
                        const cx = +earth.getAttribute('cx'), cy = +earth.getAttribute('cy');
                        const point = (el, x=0, y=0) => new DOMPoint(x,y).matrixTransform(el.transform.baseVal.consolidate().matrix);
                        const payload = point(s.querySelector('[data-story-payload]'));
                        const tether = s.querySelector('[data-story-tether]');
                        const arm = +tether.querySelector('line').getAttribute('y2');
                        const tip = point(tether, 0, arm), other = point(tether, 0, -arm);
                        return {radius: Math.hypot(payload.x-cx,payload.y-cy), x: payload.x, y:payload.y,
                          attached: Math.hypot(payload.x-tip.x,payload.y-tip.y),
                          tipRadius: Math.hypot(tip.x-cx,tip.y-cy), otherRadius: Math.hypot(other.x-cx,other.y-cy)};
                    }'''))
                if stage < 3:
                    assert all(b['radius'] >= a['radius'] - 1e-7 for a, b in zip(positions, positions[1:])), f'Payload descends in {name}'
                if stage in [1, 2]:
                    assert all(p['attached'] < .001 for p in positions), f'Payload detaches during {name}'
                if 0 < stage < 4:
                    assert abs(positions[0]['x'] - prior_end['x']) < .001
                    assert abs(positions[0]['y'] - prior_end['y']) < .001
                assert all(min(p['tipRadius'], p['otherRadius']) > 359 for p in positions)
                prior_end = positions[-1]
                scrub(650)
                story.screenshot(path=str(out / f'system-flight-{name.lower()}-1440.png'))

            expect(story.locator('[data-story-explanation]')).to_contain_text('magnetic thrust')
            expect(story.locator('[data-story-timescale]')).to_have_text('LATER ORBITS · TIME COMPRESSED')
            # Current is embedded in the rotating tether, not on a hanging boom.
            assert story.locator('[data-story-tether] [data-story-current] circle').count() == 8
            for value in [0, 250, 500, 750, 1000]:
                scrub(value)
                assert story.evaluate("s => [...s.querySelectorAll('[data-story-current] circle')].every(c => +c.getAttribute('cx') === 0 && Math.abs(+c.getAttribute('cy')) < 145)")
            scrub(650)
            before = story.locator('[data-story-tether]').get_attribute('transform')
            story.get_by_role('button', name='Chemical rocket').click()
            expect(story.get_by_role('button', name='Chemical rocket')).to_have_attribute('aria-pressed', 'true')
            expect(story.locator('[data-story-value]')).to_have_text('Chemical reboost')
            expect(story.locator('[data-story-conductor]')).to_have_attribute('opacity', '0')
            expect(story.locator('[data-story-engine]')).to_have_attribute('opacity', '1')
            assert story.locator('[data-story-tether]').get_attribute('transform') == before
            assert story.locator('[data-story-progress]').input_value() == '650'
            for value in [0, 500, 1000]:
                scrub(value)
                assert story.evaluate('''s => {
                    const m = s.querySelector('[data-story-engine]').transform.baseVal.consolidate().matrix;
                    const exhaust = new DOMPoint(-100,0).matrixTransform(m);
                    const thrust = s.querySelector('[data-story-thrust]');
                    const x = +thrust.getAttribute('x2'), y = +thrust.getAttribute('y2');
                    return exhaust.x*x + exhaust.y*y < 0 && Math.abs(exhaust.x*y-exhaust.y*x) < .001;
                }''')
            scrub(650)
            story.screenshot(path=str(out / 'system-flight-chemical-1440.png'))
            story.get_by_role('button', name='Electrodynamic').click()
            # One-shot stages finish and hold; they never rewind automatically.
            scrub(999)
            story.locator('[data-story-motion]').click()
            expect(story.locator('[data-story-motion]')).to_have_text('Replay stage')
            end = story.locator('[data-story-tether]').get_attribute('transform')
            page.wait_for_timeout(180)
            assert story.locator('[data-story-tether]').get_attribute('transform') == end
            page.set_viewport_size({'width': 390, 'height': 844})
            story.get_by_role('button', name='Recover').click()
            scrub(650)
            expect(story.locator('[data-story-title]')).to_have_text('Power the orbit back up.')
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
            story.screenshot(path=str(out / 'system-flight-story-390.png'))
            story.get_by_role('button', name='Chemical rocket').click()
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
            story.screenshot(path=str(out / 'system-flight-chemical-390.png'))
            report['navigation'].append('flight story controls and reduced motion')
            report['status'] = 'failed' if report['errors'] else 'passed'
            assert not report['errors'], report['errors']
            print('PASS company pages at four widths; keyboard, dismissal, resize and native navigation; review qa/browser/company', flush=True)
        except Exception as e:
            report['status'] = 'failed'
            report['failure'] = str(e)
            report['focused_element'] = page.evaluate('document.activeElement?.outerHTML')
            page.screenshot(path=str(out / 'navigation-failure.png'))
            raise
        finally:
            (out / 'report.json').write_text(json.dumps(report, indent=2))
            browser.close()
            server.shutdown()


if __name__ == '__main__':
    main()
