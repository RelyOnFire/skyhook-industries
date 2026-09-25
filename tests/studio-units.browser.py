#!/usr/bin/env python3
"""Check display conversion without changing the saved Flight Studio design."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    evidence = ROOT / 'qa/browser/units'
    evidence.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chromium', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        page.set_default_timeout(30000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(origin + '/lab/', wait_until='domcontentloaded')
            expect(page.get_by_label('Distance unit')).to_have_value('km')
            expect(page.get_by_role('spinbutton', name='Total tether span value')).to_have_value('600')
            page.get_by_label('Distance unit').select_option('m')
            expect(page.get_by_role('spinbutton', name='Total tether span value')).to_have_value('600000')
            expect(page.locator('.build-panel .tag')).to_have_text('CONFIGURATION')

            page.get_by_label('Speed unit').select_option('m/s')
            page.get_by_role('button', name='Mission', exact=True).click()
            expect(page.get_by_role('spinbutton', name='Tip speed relative to center value')).to_have_value('1200')
            page.get_by_role('button', name='Recovery', exact=True).click()
            expect(page.get_by_role('spinbutton', name='Total available thrust value')).to_have_value('5')
            page.get_by_label('Force unit').select_option('N')
            thrust = page.get_by_role('spinbutton', name='Total available thrust value')
            expect(thrust).to_have_value('5000')
            thrust.fill('6000')
            page.get_by_label('Force unit').select_option('kN')
            expect(thrust).to_have_value('6')
            page.get_by_role('button', name='Save', exact=True).click()
            design = json.loads(page.evaluate("localStorage.getItem('skyhook-lab-design-v2')"))
            assert (design['spanKm'], design['tipSpeedKms'], design['thrustN']) == (600, 1.2, 6000)
            expect(page.locator('.trace-clearance figcaption')).to_contain_text('m')
            page.get_by_role('button', name='Full-run debrief', exact=True).click()
            expect(page.locator('.delivered-orbits')).to_contain_text('m perigee')
            page.keyboard.press('Escape')
            print('PASS Earth conversion and canonical saved design', flush=True)

            page.goto(origin + '/lab/lunar/', wait_until='domcontentloaded')
            expect(page.get_by_label('Distance unit')).to_have_value('m')
            expect(page.get_by_role('spinbutton', name='Total tether span value')).to_have_value('200000')
            page.get_by_role('button', name='Recovery', exact=True).click()
            expect(page.get_by_role('spinbutton', name='Total available thrust value')).to_have_value('3')
            print('PASS Moon and persisted display preference', flush=True)

            page.goto(origin + '/lab/phobos/', wait_until='domcontentloaded')
            expect(page.get_by_role('spinbutton', name='Inward arm value')).to_have_value('1250000')
            expect(page.get_by_label('Speed unit')).to_have_value('m/s')
            page.get_by_label('Force unit').select_option('N')
            expect(page.locator('.phobos-load-stats')).to_contain_text('N')
            page.get_by_role('button', name='Pin calculated flight', exact=True).click()
            expect(page.locator('.phobos-comparison [data-metric=altitude] th small')).to_have_text('m')
            page.get_by_role('button', name='Compare arm lengths →', exact=True).click()
            expect(page.get_by_role('button', name='Export arm study ↗', exact=True)).to_be_visible(timeout=90000)
            expect(page.locator('.phobos-study-chart h3')).to_contain_text('altitude · m')
            print('PASS Phobos distance, speed and force preference', flush=True)

            page.goto(origin + '/lab/t4/', wait_until='domcontentloaded')
            page.locator('.phobos-material').first.locator('summary').click()
            expect(page.get_by_role('spinbutton', name='Primary length value')).to_have_value('300000')
            expect(page.get_by_role('spinbutton', name='Primary spin × length value')).to_have_value('1000')
            expect(page.locator('.t4-velocity table caption')).to_contain_text('m/s')
            page.get_by_role('button', name='Pin calculated flight', exact=True).click()
            expect(page.locator('.t4-comparison [data-metric=pivot] th small')).to_have_text('N')
            expect(page.locator('.t4-comparison [data-metric=apoapsis] th small')).to_have_text('m')
            page.get_by_role('button', name='Compare six phases →', exact=True).click()
            expect(page.get_by_role('button', name='Export study ↗', exact=True)).to_be_visible(timeout=90000)
            assert any(text.endswith(' m') for text in page.locator('.t4-trials strong').all_text_contents())
            page.set_viewport_size({'width': 320, 'height': 800})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'T4 overflows 320 px'
            page.screenshot(path=str(evidence / 't4-320.png'), full_page=True)
            print('PASS T4 design and velocity results', flush=True)

            page.set_viewport_size({'width': 320, 'height': 800})
            page.goto(origin + '/lab/campaign/', wait_until='domcontentloaded')
            page.get_by_label('Name your network', exact=True).fill('Unit layout')
            page.get_by_role('button', name='Start new network', exact=True).click()
            stock = page.locator('[data-testid="earth-materials"]')
            expect(stock).to_contain_text('160 t')
            assert stock.evaluate("e=>{const a=e.querySelector('span').getBoundingClientRect(),b=e.querySelector('small').getBoundingClientRect();return Math.abs(a.bottom-b.bottom)<8}"), 'Number and tonne suffix split across lines'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Campaign overflows 320 px'
            page.screenshot(path=str(evidence / 'campaign-320.png'), full_page=True)
            print('PASS campaign mass readout stays on one line at 320 px', flush=True)
            assert not errors, errors
        finally:
            browser.close()
            server.shutdown()


if __name__ == '__main__':
    main()
