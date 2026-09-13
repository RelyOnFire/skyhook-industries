#!/usr/bin/env python3
"""Exercise the built Flight Studio, using real simulation workers.

Default: native localhost origin, native module workers, actual WebGL renderer.
  python3 -m pip install playwright==1.55.0
  python3 -m playwright install --with-deps chromium
  python3 tests/lab-flight-studio.browser.py --require-webgl

--isolated is only for restricted offline component QA. It fulfills local assets
on about:blank and starts unchanged compiled worker bytes in a classic Blob
worker. It does NOT certify native-origin persistence, routing or WebGL.
"""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import re
import threading
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--isolated', action='store_true')
    parser.add_argument('--require-webgl', action='store_true')
    parser.add_argument('--executable')
    parser.add_argument('--output', default='qa/browser')
    args = parser.parse_args()
    if args.isolated and args.require_webgl:
        raise ValueError('Native WebGL verification cannot use isolated mode.')
    out = (ROOT / args.output).resolve(); out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(DIST)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    findings = {'mode':'isolated component QA' if args.isolated else 'native localhost', 'checks':[], 'errors':[], 'webgl':False}
    def done(name):
        findings['checks'].append(name); print('PASS', name, flush=True)
    with sync_playwright() as p:
        options = dict(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        if args.executable: options['executable_path'] = args.executable
        else: options['channel'] = 'chromium'
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page(); page.set_default_timeout(15000)
        page.on('pageerror', lambda e: findings['errors'].append(str(e)))
        page.on('console', lambda m: findings['errors'].append(m.text) if m.type=='error' and re.search('shader|Shader|Program|worker failed', m.text) else None)
        def assets(route):
            path = (DIST / unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
            if path.is_dir(): path = path / 'index.html'
            if path.is_relative_to(DIST) and path.is_file():
                route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream', headers={'Access-Control-Allow-Origin':'*'})
            else: route.abort()
        def open_page(path='/lab/'):
            if args.isolated:
                page.route('**/*', assets)
                source = next((DIST/'_astro').glob('worker-*.js')).read_text()
                page.evaluate('''source=>{if(window.__testWorker)return;window.__testWorker=true;const Native=Worker;window.Worker=class extends Native{constructor(url,opts){const blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));super(blob,{...opts,type:'classic'});URL.revokeObjectURL(blob);}}}''', source)
                page.set_content((DIST/path.strip('/')/'index.html').read_text().replace('<head>', '<head><base href="http://skyhook.test/">', 1), wait_until='networkidle')
            else: page.goto(origin+path, wait_until='networkidle')
        def ready():
            expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)
            expect(page.locator('.scene-pending')).to_have_count(0)
            expect(page.locator('.lab-feedback.is-error')).to_have_count(0)
        def no_overflow():
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), f'Horizontal overflow at {page.viewport_size}'
        def shot(name, full=True):
            # Flush the canvas/compositor after React updates; a DOM assertion
            # alone can succeed before the requested replay frame is painted.
            page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
            if page.locator('.scene-plane canvas').count():
                assert page.locator('.scene-plane canvas').evaluate('''c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i])return true;return false;}'''), 'Visible orbital canvas must not be blank'
            page.screenshot(path=str(out/(name+'.png')), full_page=full)
        def choose_tab(name):
            mobile=page.get_by_role('navigation', name='Workspace panels')
            if mobile.is_visible(): mobile.get_by_role('button', name='Design', exact=True).click()
            page.locator('.control-tabs').get_by_role('button', name=name, exact=True).click()
        def fly():
            mobile=page.get_by_role('navigation', name='Workspace panels')
            if mobile.is_visible(): mobile.get_by_role('button', name='Flight', exact=True).click()
        def run():
            page.locator('.run-design').click();ready()
        try:
            open_page();ready();no_overflow()
            findings['webgl'] = page.locator('.scene-three canvas').count()==1
            if args.require_webgl: assert findings['webgl'], 'WebGL2 renderer must actually initialize in the native CI run.'
            assert not page.get_by_role('button', name='Pause replay', exact=True).count(), 'Reduced motion starts paused'
            done('native worker calculation and paused initial flight' if not args.isolated else 'unchanged compiled worker calculation in isolated harness')
            shot('studio-desktop')
            if findings['webgl']:
                canvas=page.locator('.scene-three canvas'); box=canvas.bounding_box()
                before=canvas.screenshot()
                page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
                page.mouse.down();page.mouse.move(box['x']+box['width']/2+80,box['y']+box['height']/2+30,steps=8);page.mouse.up();page.wait_for_timeout(150)
                assert canvas.screenshot()!=before, 'Orbit control must visibly change the renderer'
                page.get_by_role('button', name='Reset camera', exact=True).click()
                page.get_by_role('button', name='Zoom camera in', exact=True).click()
                page.get_by_role('button', name='Zoom camera out', exact=True).click()
                done('WebGL globe initialized; pointer and keyboard-operable camera buttons render changes')
            page.get_by_role('button', name='Guided replay', exact=True).click()
            expect(page.get_by_role('region', name='Guided replay')).to_be_visible()
            page.get_by_role('button', name='Next checkpoint →', exact=True).click()
            expect(page.locator('.guided-replay h3')).to_have_text('The payload joins the rotating machine.')
            page.get_by_role('button', name='Next checkpoint →', exact=True).click()
            expect(page.locator('.guided-replay h3')).to_have_text('The payload leaves; the facility pays.')
            if findings['webgl']: shot('payload-release')
            page.get_by_role('button', name='End guide', exact=True).click()
            page.get_by_role('button', name='Expand flight view', exact=True).click()
            expect(page.locator('.focus-scene')).to_have_count(1)
            page.keyboard.press('Escape');expect(page.locator('.focus-scene')).to_have_count(0)
            done('guided capture/release checkpoints and Escape from expanded scene')
            page.get_by_role('button', name='Velocity vectors', exact=True).click()
            page.locator('.view-switch').get_by_role('button', name='Structure', exact=True).click()
            inspector=page.get_by_role('region', name='Tether structural inspector')
            expect(inspector).to_be_visible()
            selector=page.get_by_role('slider', name='Inspected tether section', exact=True)
            selector.focus();page.keyboard.press('Home');expect(selector).to_have_value('0')
            selector.press('End');assert int(selector.input_value())>0
            assert 'NaN' not in inspector.inner_text()
            shot('structure-inspector');done('structural inspector is scrollable and keyboard-operable')
            page.locator('.view-switch').get_by_role('button', name='Orbit plane', exact=True).click()
            expect(page.locator('.scene-plane canvas')).to_have_count(1)
            page.get_by_role('button', name='Zoom in', exact=True).click();page.get_by_role('button', name='Fit', exact=True).click()
            page.get_by_role('button', name='Full-run debrief', exact=True).click()
            dialog=page.get_by_role('dialog');expect(dialog).to_be_visible()
            expect(dialog.locator('.debrief-lead')).to_contain_text('Two deliveries')
            with page.expect_download() as download:
                dialog.get_by_role('button', name='Export flight report', exact=True).click()
            report=json.loads(Path(download.value.path()).read_text())
            assert report['format']=='tether-lab-flight-report' and len(report['deliveries'])==2
            dialog.get_by_role('button', name='Pin this flight', exact=True).click();shot('flight-debrief')
            page.keyboard.press('Escape');done('full-run debrief and actual JSON flight-report download')
            # Distinct shipments and a persistent camera target at the second handoff.
            assert len(report['approaches']) == 2 and len(report['rendezvous']) == 2
            assert all(c['accepted'] and c['positionErrorM'] < 2 and c['velocityErrorMs'] < .02 for c in report['rendezvous'])
            one = page.locator('[data-object-id="payload-1"]')
            two = page.locator('[data-object-id="payload-2"]')
            def scene_root():
                return page.locator('.scene-three') if page.locator('.scene-three').count() else page.locator('.scene-plane')
            def expect_follow(target):
                expect(scene_root()).to_have_attribute('data-follow-target', target)
                if findings['webgl'] and target != 'none':
                    assert float(scene_root().get_attribute('data-follow-error-km')) < 1e-6
            page.get_by_role('button', name='Select Payload 1', exact=True).click()
            page.locator('.view-switch').get_by_role('button', name='Follow', exact=True).click()
            page.locator('.timeline-events').get_by_role('button', name=re.compile('Payload 2 · approach')).click()
            expect(one).to_have_attribute('data-phase', 'released')
            expect(two).to_have_attribute('data-phase', 'approach')
            expect(one).to_have_attribute('aria-pressed', 'true');expect_follow('payload-1')
            assert one.evaluate("e=>getComputedStyle(e).getPropertyValue('--object-color')") != two.evaluate("e=>getComputedStyle(e).getPropertyValue('--object-color')")
            page.get_by_role('button', name='Next mission event', exact=True).click()
            expect(two).to_have_attribute('data-phase', 'attached')
            expect(one).to_have_attribute('data-phase', 'released');expect_follow('payload-1')
            page.get_by_role('button', name='Select Payload 2', exact=True).click();expect_follow('payload-2')
            page.get_by_role('button', name='Restart replay', exact=True).click()
            expect(two).to_have_attribute('aria-pressed', 'true')
            expect(two).to_have_attribute('data-phase', 'absent');expect_follow('none')
            expect(page.locator('.tracking-detail')).to_contain_text('Not in the scene at this time')
            page.get_by_role('button', name=re.compile('Go to approach')).click()
            expect(two).to_have_attribute('data-phase', 'approach');expect_follow('payload-2')
            expect(page.locator('.range-to-tip')).to_be_visible()
            if findings['webgl']:
                boxes = page.locator('.world-label:visible').evaluate_all('els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
                for i,a in enumerate(boxes):
                    for b in boxes[i+1:]:
                        assert not (a['x']<b['x']+b['w'] and a['x']+a['w']>b['x'] and a['y']<b['y']+b['h'] and a['y']+a['h']>b['y'])
            shot('payload-2-approach')
            page.get_by_role('button', name='Next mission event', exact=True).click()
            expect(two).to_have_attribute('data-phase', 'attached');expect_follow('payload-2')
            shot('distinct-shipments')
            page.locator('.timeline-events').get_by_role('button', name=re.compile('Payload 2 · release')).click()
            expect(two).to_have_attribute('data-phase', 'released');expect_follow('payload-2')
            # Explicitly repeat selection and scrubbing in the Canvas renderer.
            page.locator('.view-switch').get_by_role('button', name='Orbit plane', exact=True).click()
            page.get_by_role('button', name='Select Payload 1', exact=True).click()
            page.locator('.timeline-events').get_by_role('button', name=re.compile('Payload 2 · capture')).click()
            expect(one).to_have_attribute('aria-pressed', 'true');expect(one).to_have_attribute('data-phase', 'released')
            expect(two).to_have_attribute('data-phase', 'attached');shot('payload-identities-plane')
            done('both checked approaches, numbered shipment states, stable follow target and absent-object replay')

            page.get_by_role('button', name='Flight school', exact=True).click();shot('mission-room')
            page.locator('.mission-choice').first.click()
            page.get_by_role('button', name=re.compile('Start this mission')).click();ready()
            expect(page.locator('.recorder-insight')).to_contain_text('no second operating window')
            choose_tab('Recovery');page.get_by_role('button', name=re.compile('^Chemical')).click()
            page.get_by_role('spinbutton', name='Propellant budget value', exact=True).fill('20')
            run();expect(page.locator('.mission-passed')).to_have_count(1)
            page.get_by_role('button', name='Check objectives', exact=True).click()
            expect(page.locator('.objective-list')).to_be_visible();assert page.locator('.objective-list .gate-open').count()==0
            shot('mission-complete');page.keyboard.press('Escape')
            done('first challenge fails without recovery and passes after a real chemical-recovery run')
            page.get_by_role('button', name='Leave challenge for sandbox', exact=True).click()
            page.get_by_role('button', name='Trade study', exact=True).click()
            page.get_by_role('button', name='Run 3 variants →', exact=True).click()
            expect(page.locator('.study-status')).to_contain_text('Study complete', timeout=180000)
            expect(page.locator('.study-table tbody tr')).to_have_count(3)
            assert all(page.locator('.study-table tbody tr').nth(i).locator('td').count()==6 for i in range(3))
            shot('trade-study')
            page.locator('.study-table tbody tr').first.get_by_role('button').click()
            expect(page.locator('.recorder-insight')).to_contain_text('no second operating window')
            page.get_by_role('button', name='Full-run debrief', exact=True).click()
            expect(page.locator('.debrief-comparison')).to_be_visible();shot('pinned-comparison')
            page.keyboard.press('Escape');done('three actual worker simulations, exact row restoration and pinned baseline comparison')
            # Return to the source preset and check the regression reported by the owner.
            page.locator('.experiment-strip button').first.click();ready();choose_tab('Mission')
            toggle=page.get_by_role('checkbox', name=re.compile('Extended payload range'))
            value=page.get_by_role('spinbutton', name='Payload per delivery value', exact=True)
            toggle.check();value.fill('250')
            slider=page.get_by_role('slider', name='Payload per delivery', exact=True);slider.focus();page.keyboard.press('Home')
            expect(value).to_have_value('0.1');toggle.uncheck();expect(toggle).not_to_be_checked()
            toggle.check();value.fill('100');toggle.uncheck();expect(value).to_have_value('100')
            expect(page.locator('.run-design')).to_be_disabled()
            page.get_by_role('button', name='Use 20 t', exact=True).click();expect(value).to_have_value('20')
            value.fill('3');toggle.check();value.fill('251');expect(value).to_have_attribute('aria-invalid','true')
            value.fill('3');toggle.uncheck()
            choose_tab('Recovery');page.get_by_role('spinbutton', name='Propellant budget value', exact=True).fill('17')
            page.get_by_role('button', name=re.compile('^Coast')).click()
            expect(page.get_by_role('spinbutton', name='Propellant budget value', exact=True)).to_have_count(0)
            page.get_by_role('button', name=re.compile('^Chemical')).click()
            expect(page.get_by_role('spinbutton', name='Propellant budget value', exact=True)).to_have_value('17')
            done('extended payload round trip, invalid input, no hidden Coast fuel control, restored budget')
            if not args.isolated:
                page.get_by_role('button', name='Save', exact=True).click()
                saved=json.loads(page.evaluate("localStorage.getItem('skyhook-lab-design-v2')"));assert saved['fuelT']==17
                page.get_by_role('spinbutton', name='Propellant budget value', exact=True).fill('19')
                page.get_by_role('button', name='Load', exact=True).click();ready()
                expect(page.get_by_role('spinbutton', name='Propellant budget value', exact=True)).to_have_value('17')
                page.get_by_role('button', name=re.compile('^Share design')).click()
                shared=page.get_by_role('textbox', name='Shareable design link', exact=True).input_value()
                assert '#d=' in shared
                page.goto(shared,wait_until='networkidle');ready();choose_tab('Recovery')
                expect(page.get_by_role('spinbutton', name='Propellant budget value', exact=True)).to_have_value('17')
                assert 'second-delivery' in page.evaluate("JSON.parse(localStorage.getItem('tether-lab-missions-v1'))")
                done('native-origin Save/Load, versioned URL reload and local mission progress')
            # Test cancellation: the last accepted flight must not be replaced.
            page.get_by_role('button', name='Trade study', exact=True).click()
            page.get_by_role('button', name='Run 3 variants →', exact=True).click()
            page.get_by_role('button', name='Cancel study', exact=True).click()
            expect(page.locator('.study-status')).to_contain_text('Stopped')
            page.keyboard.press('Escape');done('trade study cancellation returns control without replacing the accepted flight')
            for width,height in [(1440,1000),(1280,800),(1000,900),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height});fly();no_overflow()
                expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_visible()
                page.locator('.view-switch').get_by_role('button', name='Orbit plane', exact=True).click()
                if findings['webgl']: page.locator('.view-switch').get_by_role('button', name='Globe', exact=True).click()
                page.wait_for_timeout(120);shot(f'studio-{width}')
                page.get_by_role('button', name='Flight school', exact=True).click();no_overflow()
                page.keyboard.press('Tab');assert page.evaluate("!!document.activeElement?.closest('dialog')")
                shot(f'missions-{width}');page.keyboard.press('Escape')
                if width<801:
                    choose_tab('Mission');expect(toggle).to_be_visible();toggle.check();toggle.uncheck()
            done('six viewport sizes, no page overflow, mobile panels and modal keyboard focus')
            for path in ['/lab/method/','/lab/architectures/']:
                for width in [1440,390,320]:
                    page.set_viewport_size({'width':width,'height':900});open_page(path);no_overflow()
                    if path.endswith('method/'):
                        page.locator('summary').first.click();expect(page.locator('details').first).to_have_attribute('open','')
                    shot(f'{path.split("/")[2]}-{width}')
            done('Method and architecture catalogue responsive routes and disclosures')
            assert not findings['errors'], findings['errors']
            findings['status']='passed'
        except Exception as e:
            findings['status']='failed';findings['failure']=str(e)
            shot('failure');raise
        finally:
            (out/'report.json').write_text(json.dumps(findings,indent=2))
            browser.close();server.shutdown()
if __name__=='__main__': main()
