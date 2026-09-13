#!/usr/bin/env python3
"""Native-origin integration checks for the consolidated public site and lab.
This complements (does not replace) the three numerical/application suites.
It never substitutes a generated page or mock worker for the compiled release.
"""
from __future__ import annotations
import argparse, json, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--executable')
    parser.add_argument('--output', default='qa/browser/release')
    args = parser.parse_args()
    out = ROOT / args.output
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(DIST)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    report = {'mode': 'native localhost', 'checks': [], 'errors': [], 'routes': []}
    def done(text):
        report['checks'].append(text)
        print('PASS', text, flush=True)
    with sync_playwright() as p:
        options = {'headless': True, 'args': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']}
        if args.executable:
            options['executable_path'] = args.executable
        else:
            options['channel'] = 'chromium'
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(20000)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        def open_page(path):
            response = page.goto(origin + path, wait_until='networkidle')
            assert response and response.status == 200, f'Failed route: {path}'
            expect(page.locator('.brand-header')).to_have_count(1)
        def shot(name):
            page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Horizontal page overflow'
            page.screenshot(path=str(out / (name + '.png')), full_page=True)
        try:
            pages = sorted(DIST.rglob('*.html'))
            for file in pages:
                relative = file.relative_to(DIST).as_posix()
                route = '/' + relative.removesuffix('index.html') if relative.endswith('index.html') else '/' + relative
                open_page(route)
                assert page.title().strip(), route
                assert page.locator('meta[name="description"]').get_attribute('content'), route
                expect(page.locator('h1')).to_have_count(1)
                ids = page.locator('[id]').evaluate_all('els => els.map(e => e.id)')
                assert len(ids) == len(set(ids)), f'Duplicate IDs at {route}'
                for href in page.locator('a[href]').evaluate_all('els => els.map(e => e.getAttribute("href"))'):
                    url = urlparse(urljoin(origin + route, href))
                    if url.netloc != urlparse(origin).netloc or url.scheme not in ['http','https']:
                        continue
                    target = DIST / unquote(url.path).lstrip('/')
                    if target.is_dir(): target = target / 'index.html'
                    assert target.is_file(), f'Broken local link {route} → {href}'
                    if url.fragment and '=' not in url.fragment and target.suffix == '.html':
                        # A fragment used as saved simulation state is not an HTML anchor.
                        import re
                        fragment = re.escape(unquote(url.fragment))
                        assert re.search(r'''\bid=["']''' + fragment + r'''["']''', target.read_text()), f'Broken anchor {route} → {href}'
                report['routes'].append(route)
            done(f'All {len(pages)} compiled routes, metadata, unique IDs and internal links')
            for width, height in [(1440,1000),(1280,800),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                open_page('/')
                hero = page.locator('.new-hero .launch-link')
                expect(hero).to_have_attribute('href','/lab/')
                expect(page.get_by_role('link',name='Compare tether concepts ↗',exact=True)).to_have_attribute('href','/lab/architectures/')
                expect(page.get_by_role('link',name='Operate a cargo service ↗',exact=True)).to_have_attribute('href','/lab/operations/')
                pause = page.locator('#orbit-pause')
                expect(pause).to_have_attribute('aria-pressed','true')
                canvas = page.locator('#orbital-canvas')
                assert canvas.evaluate('c => c.width > 0 && c.height > 0')
                before = canvas.screenshot()
                pause.click(); expect(pause).to_have_attribute('aria-pressed','false')
                page.wait_for_timeout(400); pause.click()
                assert canvas.screenshot() != before, 'Globe rotation must change the rendered image'
                page.locator('#orbit-reset').click()
                shot(f'homepage-{width}')
                if width <= 1000:
                    menu = page.locator('.brand-mobile')
                    menu.locator('summary').click(); expect(menu).to_have_attribute('open','')
                    page.keyboard.press('Escape'); expect(menu).not_to_have_attribute('open','')
                    expect(menu.locator('summary')).to_be_focused()
                    menu.locator('summary').click()
                    menu.get_by_role('link',name='Tether Lab',exact=True).click()
                else:
                    page.locator('.brand-links').get_by_role('link',name='Tether Lab',exact=True).click()
                expect(page).to_have_url(origin + '/lab/')
                expect(page.locator('.lab-section-nav a[aria-current="page"]')).to_have_count(1)
                page.locator('.lab-section-nav').get_by_role('link',name='Operations',exact=True).click()
                expect(page).to_have_url(origin + '/lab/operations/')
                expect(page.locator('.lab-section-nav a[aria-current="page"]')).to_have_text('Operations')
                expect(page.locator('.ops-scene')).to_be_visible(timeout=120000)
                expect(page.locator('.ops-computing')).to_have_count(0)
                expect(page.locator('.ops-feedback.error')).to_have_count(0)
                shot(f'operations-{width}')
                open_page('/lab/operations/method/')
                expect(page.locator('.lab-section-nav a[aria-current="page"]')).to_have_count(0)
                expect(page.locator('.lab-section-nav a.active')).to_have_text('Operations')
                shot(f'operations-method-{width}')
            done('Approved homepage, distinct calls to action, shared navigation and Operations integration across five viewport sizes')
            page.set_viewport_size({'width':1440,'height':1000})
            open_page('/lab/method/')
            page.keyboard.press('Tab')
            expect(page.locator('.lab-skip')).to_be_focused()
            expect(page.locator('.lab-skip')).to_be_visible()
            page.keyboard.press('Enter')
            assert page.url.endswith('#lab-content')
            disclosure = page.locator('.guide details').first
            disclosure.locator('summary').click(); expect(disclosure).to_have_attribute('open','')
            done('Keyboard skip link and guide-scoped disclosure work with shared header')
            assert not report['errors'], report['errors']
            report['status'] = 'passed'
        except Exception as error:
            report['status'] = 'failed'; report['failure'] = str(error)
            page.screenshot(path=str(out/'failure.png'),full_page=True)
            raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2))
            browser.close(); server.shutdown()

if __name__ == '__main__':
    main()
