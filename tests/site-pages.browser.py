#!/usr/bin/env python3
"""Capture the built company pages and check their responsive reading layout.

Runs in the repository's native-browser CI environment. Screenshots are review
evidence, not a substitute for visual inspection.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import struct
import threading
from urllib.parse import quote, urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ['', 'system', 'research', 'roadmap', 'reference-architecture', 'about', 'contact', 'help', 'archive', '404', 'lab/architectures']


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
                sizes = [(1440, 1000), (768, 1024), (390, 844), (320, 800)]
                if not route:
                    sizes += [(1001, 844), (1280, 800)]
                for width, height in sizes:
                    page.set_viewport_size({'width': width, 'height': height})
                    path = '/404.html' if route == '404' else f'/{route}/' if route else '/'
                    response = page.goto(origin + path, wait_until='networkidle')
                    assert response and response.ok, f'Failed to load {path}'
                    expect(page.locator('main h1')).to_have_count(1)
                    expect(page.locator('.brand-wordmark')).to_be_visible()
                    await_fonts = 'async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}'
                    page.evaluate(await_fonts)
                    name = route.replace('/', '-') or 'home'
                    page.screenshot(path=str(out / f'{name}-{width}.png'), full_page=True)
                    page.screenshot(path=str(out / f'{name}-viewport-{width}.png'))
                    if not route:
                        page.locator('#explore').screenshot(path=str(out / f'gateway-{width}.png'))
                    overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                    if overflow:
                        report['errors'].append(f'Horizontal page overflow: {route} at {width}px')
                    report['pages'].append({'route': path, 'width': width, 'overflow': overflow})

            # A public entry point must lead to a usable first action. Open the
            # actual worker-driven briefing and verify saved designs survive it.
            page.set_viewport_size({'width': 1280, 'height': 800})
            page.goto(origin + '/lab/', wait_until='networkidle')
            expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
            page.get_by_role('button', name='Save', exact=True).click()
            saved = page.evaluate("localStorage.getItem('skyhook-lab-design-v2')")
            assert saved
            page.goto(origin + '/', wait_until='networkidle')
            gateway = page.locator('#explore')
            expect(gateway.get_by_role('link', name='Play Expeditions')).to_have_attribute('href', '/lab/campaign/')
            experiments = gateway.get_by_role('navigation', name='Choose a tether experiment')
            assert experiments.locator('a').evaluate_all('(links) => links.map(a => a.pathname)') == [
                '/lab/', '/lab/lunar/', '/lab/phobos/', '/lab/t4/', '/lab/cardio/']
            for href in experiments.locator('a').evaluate_all('(links) => links.map(a => a.pathname)'):
                assert page.request.get(origin + href).ok, f'Experiment entry does not resolve: {href}'
            gateway.get_by_role('link', name='Try a guided flight').click()
            briefing = page.get_by_role('dialog', name='Make the second delivery')
            expect(briefing).to_be_visible()
            expect(briefing.get_by_role('button', name='Start this mission')).to_be_visible()
            assert page.evaluate("localStorage.getItem('skyhook-lab-design-v2')") == saved
            # Briefing remains usable on a narrow phone and can be dismissed.
            page.set_viewport_size({'width': 320, 'height': 800})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
            page.screenshot(path=str(out / 'first-flight-briefing-320.png'))
            page.keyboard.press('Escape')
            expect(briefing).to_have_count(0)
            expect(page.get_by_role('region', name='Active challenge')).to_have_count(0)
            page.set_viewport_size({'width': 1280, 'height': 800})
            page.reload(wait_until='networkidle')
            briefing.get_by_role('button', name='Start this mission').click()
            expect(page.get_by_role('region', name='Active challenge')).to_contain_text('Make the second delivery')
            expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
            assert page.evaluate("localStorage.getItem('skyhook-lab-design-v2')") == saved
            # Explicit shared designs win over the public mission suggestion.
            page.goto(origin + '/lab/?mission=second-delivery#d=' + quote(saved, safe=''), wait_until='networkidle')
            # A fragment-only navigation does not remount the current Studio;
            # reload as a recipient opening the full shared URL would do.
            page.reload(wait_until='networkidle')
            expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
            expect(page.get_by_role('dialog')).to_have_count(0)
            expect(page.get_by_role('region', name='Active challenge')).to_have_count(0)
            page.goto(origin + '/lab/?mission=lunar-relay', wait_until='networkidle')
            expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
            expect(page.get_by_role('dialog')).to_have_count(0)
            assert page.evaluate("localStorage.getItem('skyhook-lab-design-v2')") == saved
            report['navigation'].append('homepage experiment links and guided mission; shared designs and saved designs preserved')

            # A shared game link needs a usable image and the right navigation
            # identity, including when opening its explanatory method page.
            for path, card in [('/', 'social-card'), ('/lab/', 'social-flight-studio'), ('/lab/campaign/', 'social-expeditions')]:
                page.goto(origin + path, wait_until='networkidle')
                expect(page.locator('head meta[property="og:title"]')).to_have_attribute('content', page.title())
                source = page.locator('head meta[property="og:image"]').get_attribute('content')
                assert urlparse(source).scheme == 'https' and urlparse(source).path == f'/{card}.png'
                response = page.request.get(origin + urlparse(source).path)
                assert response.ok and response.headers['content-type'].startswith('image/png')
                png = response.body()
                assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1200, 630)
                expect(page.locator('head meta[name="twitter:image"]')).to_have_attribute('content', source)
                # This suite exercises the normal production build. Preview
                # metadata is checked separately by the launch policy test.
                expect(page.locator('head meta[name="robots"]')).to_have_count(0)
            page.goto(origin + '/lab/campaign/method/', wait_until='networkidle')
            expect(page.locator('.brand-links a.active')).to_have_count(1)
            expect(page.locator('.brand-links a.active')).to_have_attribute('href', '/lab/campaign/')
            report['navigation'].append('distinct share images and campaign navigation identity')

            # Seven primary links must fit at the desktop breakpoint, not just
            # avoid making the document wider by overlapping the wordmark.
            for width in [1001, 1100, 1280, 1440]:
                page.set_viewport_size({'width': width, 'height': 800})
                assert page.locator('.brand-header').evaluate('''header => {
                    const mark = header.querySelector('.brand-wordmark').getBoundingClientRect();
                    const links = [...header.querySelectorAll('.brand-links a')].map(a => a.getBoundingClientRect());
                    return links[0].left > mark.right + 8 && links.every((r, i) => r.right <= innerWidth && (!i || r.left > links[i - 1].right));
                }'''), f'Primary navigation overlaps at {width}px'
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
                expect(page.locator('main h1')).to_have_text('Tell us what you found.')
                report['navigation'].append(path)

            # Enhancing dismissal must not make navigation depend on JavaScript.
            native = browser.new_page(java_script_enabled=False, viewport={'width': 320, 'height': 800})
            native.goto(origin + '/research/', wait_until='networkidle')
            native.locator('.brand-mobile summary').click()
            native.locator('.brand-mobile').get_by_role('link', name='Contact', exact=True).click()
            expect(native).to_have_url(origin + '/contact/')
            native.goto(origin + '/', wait_until='networkidle')
            expect(native.locator('#explore a[href="/lab/?mission=second-delivery"]')).to_be_visible()
            native.locator('#explore').get_by_role('link', name='Play Expeditions').click()
            expect(native.get_by_role('link', name='campaign guide and assumptions')).to_be_visible()
            native.close()
            report['navigation'].append('native disclosure without JavaScript')

            # Drive the real homepage canvas through a full orbit, measuring
            # the paths it draws (including endpoint rings and its label).
            globe = browser.new_page(reduced_motion='no-preference')
            globe.add_init_script('''(() => {
                let next = 0, time = 0;
                const frames = new Map();
                window.requestAnimationFrame = cb => { frames.set(++next, cb); return next; };
                window.cancelAnimationFrame = id => frames.delete(id);
                window.orbitStep = () => {
                    window.orbitBounds = [];
                    time += 50;
                    const callbacks = [...frames.values()]; frames.clear();
                    callbacks.forEach(cb => cb(time));
                    return window.orbitBounds;
                };
                window.orbitBounds = [];
                const proto = CanvasRenderingContext2D.prototype;
                const arc = proto.arc, ellipse = proto.ellipse, text = proto.fillText;
                const box = (ctx, x, y, rx, ry) => {
                    if (ctx.canvas.id === 'orbital-canvas') window.orbitBounds.push([x-rx,y-ry,x+rx,y+ry]);
                };
                proto.arc = function(x,y,r,...rest) {
                    if (r <= 10) box(this,x,y,r,r);
                    return arc.call(this,x,y,r,...rest);
                };
                proto.ellipse = function(x,y,rx,ry,a,...rest) {
                    box(this,x,y,Math.hypot(rx*Math.cos(a),ry*Math.sin(a)),Math.hypot(rx*Math.sin(a),ry*Math.cos(a)));
                    return ellipse.call(this,x,y,rx,ry,a,...rest);
                };
                proto.fillText = function(value,x,y,...rest) {
                    if (this.canvas.id === 'orbital-canvas') {
                        const m=this.measureText(value);
                        window.orbitBounds.push([x,y-m.actualBoundingBoxAscent,x+m.width,y+m.actualBoundingBoxDescent]);
                    }
                    return text.call(this,value,x,y,...rest);
                };
            })();''')
            globe.goto(origin + '/', wait_until='networkidle')
            for width, height in [(1440, 1000), (1000, 800), (768, 1024), (390, 844), (320, 800)]:
                globe.set_viewport_size({'width': width, 'height': height})
                globe.wait_for_timeout(100)
                globe.locator('#orbit-reset').click()
                sweep = globe.evaluate('''() => {
                    const canvas = document.querySelector('#orbital-canvas');
                    const r = canvas.getBoundingClientRect();
                    let maxRight = 0, worstFrame = 1, samples = 0;
                    for (let i=1; i<=1260; i++) {
                        for (const [left,top,right,bottom] of window.orbitStep()) {
                            samples++;
                            if (left < 1 || top < 1 || right > r.width-1 || bottom > r.height-1)
                                return {clipped: [left,top,right,bottom], width:r.width,height:r.height};
                            if (right > maxRight) { maxRight=right; worstFrame=i; }
                        }
                    }
                    return {samples,worstFrame};
                }''')
                assert 'clipped' not in sweep, f'Homepage orbit clipped at {width}px: {sweep}'
                assert sweep['samples'] > 6000, 'full orbit must actually render'
                globe.locator('#orbit-reset').click()
                globe.evaluate('(n) => { for(let i=0;i<n;i++) window.orbitStep(); }', sweep['worstFrame'])
                canvas_box = globe.locator('#orbital-canvas').bounding_box()
                controls_box = globe.locator('.globe-controls').bounding_box()
                assert canvas_box['y'] + canvas_box['height'] < controls_box['y'], 'controls overlap orbital view'
                assert not globe.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                globe.locator('.new-hero').screenshot(path=str(out / f'homepage-orbit-rightmost-{width}.png'))
            globe.close()
            report['navigation'].append('homepage full orbit and tether fit at five widths')

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
            expect(story.locator('[data-story-timescale]')).to_have_text('CAPTURE · CLOSE-UP')
            scrub(500)

            # The close-up is a camera move, not a change in the trajectory.
            for value, name in [(0, 'wide'), (280, 'aligned'), (450, 'grappling'), (680, 'latched'), (1000, 'returned')]:
                scrub(value)
                camera = story.locator('[data-story-world]').evaluate('(el) => { const m = el.transform.baseVal.consolidate().matrix; return {scale: m.a, x: m.e, y: m.f}; }')
                if value in [0, 1000]:
                    assert camera == {'scale': 1, 'x': 0, 'y': 0}
                else:
                    assert camera['scale'] > 5.9
                expect(story.locator('[data-story-latch]')).to_have_attribute('opacity', '1' if value >= 620 else '0')
                story.screenshot(path=str(out / f'system-capture-{name}-1440.png'))
            scrub(450)
            stationary = story.locator('[data-story-world]').get_attribute('transform')
            page.wait_for_timeout(120)
            assert story.locator('[data-story-world]').get_attribute('transform') == stationary
            # Switching stages during a close-up must restore the normal camera.
            story.get_by_role('button', name='Swing').click()
            expect(story.locator('[data-story-world]')).to_have_attribute('transform', 'translate(0 0) scale(1)')
            for width in [390, 320]:
                page.set_viewport_size({'width': width, 'height': 844})
                story.get_by_role('button', name='Capture').click()
                scrub(450)
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                story.screenshot(path=str(out / f'system-capture-grappling-{width}.png'))
            page.set_viewport_size({'width': 1440, 'height': 1000})

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
            story.get_by_role('button', name='Returning payload').click()
            expect(story.locator('[data-story-value]')).to_have_text('Return traffic')
            expect(story.locator('[data-story-thrust]')).to_have_attribute('opacity', '0')
            expect(story.locator('[data-story-engine]')).to_have_attribute('opacity', '0')
            expect(story.locator('[data-story-conductor]')).to_have_attribute('opacity', '0')
            for value, attached in [(50, False), (400, True), (950, False)]:
                scrub(value)
                expect(story.locator('[data-story-payload]')).to_have_attribute('opacity', '1')
                expect(story.locator('[data-story-return-grapple]')).to_have_attribute('opacity', '1' if attached else '0')
            scrub(450)
            story.screenshot(path=str(out / 'system-flight-return-390.png'))
            page.set_viewport_size({'width': 1440, 'height': 1000})
            story.screenshot(path=str(out / 'system-flight-return-1440.png'))
            report['navigation'].append('flight story controls and reduced motion')
            report['status'] = 'failed' if report['errors'] else 'passed'
            assert not report['errors'], report['errors']
            print('PASS public pages, homepage at six widths, guided entry, share cards and accessible navigation; review qa/browser/company', flush=True)
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
