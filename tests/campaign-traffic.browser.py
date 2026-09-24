#!/usr/bin/env python3
"""Resume a genuinely congested v5 save and exercise expanded traffic in the UI."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--executable')
    parser.add_argument('--origin', help='Exercise a published preview in an isolated browser')
    args = parser.parse_args()
    out = ROOT/'qa/browser/campaign-traffic'
    out.mkdir(parents=True, exist_ok=True)
    server = None
    if args.origin:
        origin = args.origin.rstrip('/')
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT/'dist')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}'
    report = {'origin': origin, 'checks': [], 'errors': []}
    def done(name):
        report['checks'].append(name)
        print('PASS', name, flush=True)
    with sync_playwright() as p:
        options = {'headless': True}
        if args.executable: options['executable_path'] = args.executable
        else: options['channel'] = 'chromium'
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        def records():
            return page.evaluate("""async()=>{const db=await new Promise((ok,no)=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return await new Promise((ok,no)=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}""")
        def record(): return next(r for r in records() if r['id']=='traffic-fixture')
        def state(): return record()['state']
        def saved(): expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        def action(name):
            page.get_by_role('button', name=name, exact=True).click()
            saved()
        def cargo(source, destination, kind):
            page.get_by_label('From', exact=True).select_option(source)
            page.get_by_label('To', exact=True).select_option(destination)
            page.get_by_label('Cargo type', exact=True).select_option(kind)
            page.get_by_label('Cargo (t)', exact=True).fill('1')
            page.get_by_role('radio', name='Bootstrap tug').check()
        try:
            page.goto(origin+'/lab/campaign/', wait_until='networkidle')
            expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
            old = json.loads((ROOT/'tests/fixtures/campaign-v5.json').read_text())['state']
            old['id'], old['name'] = 'traffic-fixture', 'Open corridors'
            original = {'id':old['id'], 'state':old, 'savedAt':'2099-01-01T00:00:00.000Z', 'checkpoints':[]}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""", original)
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Continue Open corridors').click()
            saved()
            assert record()==original
            assert len(old['flights'])+len(old['solar']['deployments'])==32
            stale = context.new_page()
            stale.goto(origin+'/lab/campaign/', wait_until='networkidle')
            stale.get_by_role('button', name='Continue Open corridors').click()
            expect(stale.get_by_text('Saved in this browser', exact=True)).to_be_visible()
            action('Your saves')
            action('Save now')
            migrated = record()
            assert migrated['state']=={**old, 'model':'network-0.5.1', 'revision':old['revision']+1}
            assert migrated['checkpoints']==[old]
            action('Save now')
            assert record()==migrated
            stale.get_by_role('button', name='+1 day', exact=True).click()
            expect(stale.get_by_role('alert')).to_contain_text('Another tab changed this campaign')
            assert record()==migrated
            stale.close()
            page.locator('.campaign-save-manager>summary').click()
            done('native v5 model migration preserves all progress, checkpoints once, keeps unchanged saves idle and invalidates stale writers')

            cargo('earth','phobos','equipment')
            action('Dispatch cargo')
            after = state()
            assert len(after['flights'])==len(old['flights'])+1
            assert after['flights'][:-1]==old['flights'] and after['day']==old['day']
            action('Launch 30 t mirrors')
            assert len(state()['solar']['deployments'])==len(old['solar']['deployments'])+1
            cargo('ceres','phobos','water')
            page.get_by_label('Repeat every (simulation days)', exact=True).fill('30')
            action('Schedule service')
            action('+1 day')
            live = state()
            assert live['services'][-1]['dispatched']==1
            assert live['solar']['nextDeployment']>old['solar']['nextDeployment']+1
            expect(page.get_by_test_id('cargo-capacity')).to_have_text(f"{len(live['flights'])} / 256")
            expect(page.get_by_test_id('mirror-capacity')).to_have_text(f"{len(live['solar']['deployments'])} / 128")
            done('the old 32-flight bottleneck clears immediately for manual cargo, scheduled water and automatic mirrors')

            cargo('earth','phobos','equipment')
            for _ in range(64): action('Dispatch cargo')
            action('+30 days')
            busy = state()
            assert len(busy['flights'])>64 and len(busy['solar']['deployments'])>6
            assert len(busy['flights'])+len(busy['solar']['deployments'])>100
            assert page.locator('.flight-row').count()==len(busy['flights'])+len(busy['solar']['deployments'])
            arrivals = page.locator('.flight-row').evaluate_all('els=>els.map(e=>Number(e.dataset.arrival))')
            assert arrivals==sorted(arrivals)
            last = max(busy['flights'], key=lambda f:f['arrival'])
            action('Track flight '+str(last['id']))
            expect(page.locator('.map-flight.tracked')).to_have_attribute('data-traffic-id','cargo-'+str(last['id']))
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Continue Open corridors').click()
            saved()
            assert state()==busy
            page.locator('.network-outlook>summary').click()
            expect(page.get_by_label('Forecast horizon')).to_have_value('90')
            expect(page.locator('.outlook-body')).to_contain_text(f"to Day {busy['day']+90:,.1f}")
            expect(page.locator('.outlook-ports')).to_contain_text('Ceres')
            assert state()==busy
            page.get_by_label('Forecast horizon').select_option('365')
            expect(page.locator('.outlook-body')).to_contain_text(f"to Day {busy['day']+365:,.1f}")
            assert state()==busy
            page.locator('.network-outlook').screenshot(path=str(out/'outlook-desktop.png'))
            page.set_viewport_size({'width':320,'height':800})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'Outlook overflows at 320 px'
            page.locator('.network-outlook').evaluate("e=>e.scrollIntoView({block:'start'})")
            assert page.locator('.network-outlook>summary').bounding_box()['y'] >= page.locator('.campaign-clock').bounding_box()['height']-1
            page.screenshot(path=str(out/'outlook-phone.png'))
            page.locator('.network-outlook>summary').click()
            page.set_viewport_size({'width':1440,'height':1000})
            done('read-only 90/365-day outlook projects mature-network stocks and delays without touching saves or overflowing on phones')
            action('Your saves')
            with page.expect_download() as event:
                page.get_by_role('button', name='Download backup', exact=True).click()
            backup = out/'traffic-backup.json'
            event.value.save_as(backup)
            assert json.loads(backup.read_text())['state']==busy
            page.locator('input[type=file]').set_input_files(str(backup))
            saved()
            copy = next(r['state'] for r in records() if r['id']!=busy['id'])
            assert copy=={**busy, 'id':copy['id'], 'revision':0} and state()==busy
            page.locator('.campaign-save-manager>summary').click()
            done('more than 100 simultaneous flights remain ordered and trackable, reload exactly and round-trip through a separate backup slot')

            for width,height in [(1440,1000),(1280,800),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                page.evaluate('document.activeElement?.blur();scrollTo(0,0)')
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow at {width}'
                expect(page.get_by_test_id('cargo-capacity')).to_have_text(f"{len(busy['flights'])} / 256")
                expect(page.get_by_test_id('mirror-capacity')).to_have_text(f"{len(busy['solar']['deployments'])} / 128")
                assert page.locator('.flight-scroll').evaluate('e=>e.scrollHeight>e.clientHeight && e.clientHeight<=350')
                page.screenshot(path=str(out/f'traffic-{width}.png'),full_page=True)
                page.locator('.campaign-traffic').screenshot(path=str(out/f'traffic-panel-{width}.png'))
            done('expanded traffic retains bounded scrolling and readable independent capacities across desktop, tablet and phone')
            assert not report['errors'],report['errors']
            report['status']='passed'
        except Exception as e:
            report['status']='failed'
            report['failure']=str(e)
            page.screenshot(path=str(out/'failure.png'),full_page=True)
            raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2))
            browser.close()
            if server: server.shutdown()

if __name__=='__main__': main()
