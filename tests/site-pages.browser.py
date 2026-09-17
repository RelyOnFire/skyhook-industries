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
