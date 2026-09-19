#!/usr/bin/env python3
"""Continue a genuine v4 save through the complete Ceres supply loop."""
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
    out = ROOT/'qa/browser/campaign-belt'
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
    def near(a, b): assert abs(a-b) < 1e-6, f'{a} != {b}'
    with sync_playwright() as p:
        options = {'headless': True}
        if args.executable: options['executable_path'] = args.executable
        else: options['channel'] = 'chromium'
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        def records():
            return page.evaluate("""async()=>{const db=await new Promise((ok,no)=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return await new Promise((ok,no)=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}""")
        def state(): return next(r['state'] for r in records() if r['id']=='belt-browser-fixture')
        def saved(): expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        def action(name):
            page.get_by_role('button', name=name, exact=True).click()
            saved()
        def cargo(source, destination, kind, mass=10, mode='Bootstrap tug'):
            page.get_by_label('From', exact=True).select_option(source)
            page.get_by_label('To', exact=True).select_option(destination)
            page.get_by_label('Cargo type', exact=True).select_option(kind)
            page.get_by_label('Cargo (t)', exact=True).fill(str(mass))
            page.get_by_role('radio', name=mode).check()
        def step(count):
            for _ in range(count): action('+30 days')
        def geometry():
            return page.locator('#outpost-phobos').evaluate("e=>[e.offsetHeight,e.querySelector('.outpost-supply').getBoundingClientRect().top-e.getBoundingClientRect().top]")
        def ledger(w):
            b, ports = w['belt'], w['ports']
            near(100000-b['depositT'], b['extractedT'])
            near(b['extractedT'], ports['ceres']['waterT']+ports['phobos']['waterT']+b['refinedT']+sum(f['cargoT'] for f in w['flights'] if f['kind']=='water'))
            near(b['returnedWaterT'], ports['phobos']['waterT']+b['refinedT'])
        try:
            page.goto(origin+'/lab/campaign/', wait_until='networkidle')
            expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
            old = json.loads((ROOT/'tests/fixtures/campaign-v4.json').read_text())['state']
            old['id'], old['name'] = 'belt-browser-fixture', 'Into the Belt'
            record = {'id': old['id'], 'state': old, 'savedAt': '2099-01-01T00:00:00.000Z', 'checkpoints': []}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""", record)
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Continue Into the Belt').click()
            saved()
            assert records()[0] == record
            expect(page.get_by_role('button', name='Open Ceres expedition', exact=True)).to_be_disabled()
            stale = context.new_page()
            stale.goto(origin+'/lab/campaign/', wait_until='networkidle')
            stale.get_by_role('button', name='Continue Into the Belt').click()
            action('Your saves')
            action('Save now')
            migrated = records()[0]
            assert migrated['state']['schema']==5 and migrated['state']['revision']==old['revision']+1
            assert migrated['checkpoints'][0]==old
            for key in old:
                if key not in ['schema','model','revision','ports']: assert migrated['state'][key]==old[key], key
            for site in old['ports']: assert migrated['state']['ports'][site]=={**old['ports'][site], 'waterT':0}
            assert not migrated['state']['belt']['unlocked'] and migrated['state']['ports']['ceres']['level']==0
            stale.get_by_role('button', name='+1 day', exact=True).click()
            expect(stale.get_by_role('alert')).to_contain_text('Another tab changed this campaign')
            assert records()[0]==migrated
            stale.close()
            page.locator('.campaign-save-manager>summary').click()
            done('native v4 load is read-only; migration preserves every old field, checkpoints once and blocks stale writers')

            # Clear existing traffic, then stage new construction and equipment through real flights.
            for service in state()['services']:
                if service['enabled']: action('Pause service '+str(service['id']))
            if state()['solar']['autoLaunch']: action('Pause automatic launches')
            step(10)
            assert not state()['flights'] and not state()['solar']['deployments']
            cargo('moon','phobos','materials')
            for _ in range(24): action('Dispatch cargo')
            cargo('earth','phobos','equipment')
            for _ in range(8): action('Dispatch cargo')
            assert len(state()['flights'])==32
            expect(page.get_by_role('button', name='Dispatch cargo', exact=True)).to_be_disabled()
            step(9)
            action('Upgrade anchor hub · 60 t')
            before = state()
            action('Open Ceres expedition')
            opened = state()
            near(opened['ports']['phobos']['materialsT'], before['ports']['phobos']['materialsT']-60)
            near(opened['ports']['phobos']['equipmentT'], before['ports']['phobos']['equipmentT']-20)
            assert opened['ports']['ceres']==before['ports']['ceres'] and opened['day']==before['day']
            before = opened
            action('Install Phobos propellant works')
            near(state()['ports']['phobos']['materialsT'], before['ports']['phobos']['materialsT']-40)
            near(state()['ports']['phobos']['equipmentT'], before['ports']['phobos']['equipmentT']-10)
            done('stage Phobos through cargo flights, upgrade the anchor, fund Ceres and build the local propellant works')

            before = state()
            action('Supply Ceres material ↗')
            expect(page.get_by_label('From', exact=True)).to_have_value('phobos')
            expect(page.get_by_label('To', exact=True)).to_have_value('ceres')
            expect(page.get_by_role('radio', name='Bootstrap tug')).to_be_checked()
            assert state()==before
            for _ in range(5): action('Dispatch cargo')
            action('Supply Ceres equipment ↗')
            for _ in range(2): action('Dispatch cargo')
            assert state()['ports']['ceres']['materialsT']==0 and state()['belt']['extractedT']==0
            step(20)
            assert state()['ports']['ceres']['materialsT']==50 and state()['ports']['ceres']['equipmentT']==20
            page.locator('#outpost-ceres').get_by_role('button', name='Commission rotovator · 30 t', exact=True).click()
            saved()
            action('Install ceres water works')
            assert state()['ports']['ceres']['equipmentT']==15 and state()['ports']['ceres']['waterT']==0
            action('+30 days')
            near(state()['ports']['ceres']['waterT'],60)
            near(state()['ports']['ceres']['equipmentT'],14.4)
            assert state()['belt']['refinedT']==0
            done('bootstrap Ceres from shipped stock; daily extraction consumes equipment without crediting Phobos fuel')

            # Supply all three old depots and the Ceres mine, accounting for onward equipment demand.
            for service in state()['services']:
                if service['to']=='moon' or service['from']=='moon': action('Resume service '+str(service['id']))
            cargo('earth','phobos','equipment',5,'Tether corridor')
            page.get_by_label('Repeat every (simulation days)', exact=True).fill('90')
            action('Schedule service')
            action('Supply Ceres equipment ↗')
            expect(page.get_by_label('Repeat every (simulation days)', exact=True)).to_have_value('200')
            expect(page.get_by_role('radio', name='Tether corridor')).to_be_checked()
            page.get_by_label('Cargo (t)', exact=True).fill('5')
            action('Schedule service')
            before = state()
            action('Prepare water return ↗')
            expect(page.get_by_label('From', exact=True)).to_have_value('ceres')
            expect(page.get_by_label('To', exact=True)).to_have_value('phobos')
            expect(page.get_by_label('Cargo type', exact=True)).to_have_value('water')
            expect(page.get_by_label('Repeat every (simulation days)', exact=True)).to_have_value('90')
            assert state()==before
            page.get_by_label('From', exact=True).select_option('earth')
            expect(page.get_by_label('Cargo type', exact=True)).to_have_value('materials')
            assert page.locator('#campaign-kind option[value=water]').count()==0
            assert page.locator('#campaign-destination option[value=ceres]').count()==0
            page.get_by_role('button', name='Locate Ceres', exact=True).focus()
            page.keyboard.press('Enter')
            expect(page.get_by_role('button', name='Locate Ceres', exact=True)).to_have_attribute('aria-pressed','true')
            action('Prepare water return ↗')
            assert state()==before
            done('Ceres supply and water shortcuts prepare valid routes without changing saves; keyboard location works')

            depot_geometry = geometry()
            page.get_by_label('Simulation speed', exact=True).select_option('1')
            action('Play simulation')
            action('Dispatch cargo')
            expect(page.get_by_role('button', name='Pause simulation', exact=True)).to_be_enabled()
            action('Pause simulation')
            shipped = state()
            water_flight = next(f for f in shipped['flights'] if f['kind']=='water')
            assert water_flight['cargoT']==10 and water_flight['fuelT']==2
            assert shipped['belt']['returnedWaterT']==0 and shipped['belt']['refinedT']==0
            assert geometry()==depot_geometry
            expect(page.locator('#outpost-phobos .outpost-inbound')).to_contain_text('10 t water')
            expect(page.locator('.flight-row[data-kind=water]')).to_contain_text('10 t water')
            action('Track flight '+str(water_flight['id']))
            expect(page.locator('.map-flight.water.tracked')).to_have_count(1)
            expect(page.get_by_label('Tracked flight')).to_contain_text('Ceres')
            expect(page.get_by_label('Tracked flight')).to_contain_text('Phobos')
            action('Schedule service')
            frozen = state()
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Continue Into the Belt').click()
            saved()
            assert state()==frozen
            expect(page.get_by_role('button', name='Play simulation', exact=True)).to_be_visible()
            step(18)
            assert state()['belt']['returnedWaterT']==0 and state()['belt']['refinedT']==0
            step(2)
            assert state()['belt']['returnedWaterT']>=10 and state()['belt']['refinedT']>=10
            assert geometry()==depot_geometry
            ledger(state())
            done('water dispatch preserves Play, tracking and fixed arrival geometry; reload preserves transit and fuel waits for delivery')

            step(40)
            grown = state()
            returns = next(s for s in grown['services'] if s['kind']=='water')
            assert returns['dispatched']>=3 and returns['deliveredT']>=100 and grown['belt']['refinedT']>=100
            assert grown['ports']['ceres']['equipmentT']>0 and grown['ports']['phobos']['equipmentT']>0
            assert page.locator('.belt-goals li.complete').count()==4
            expect(page.get_by_role('heading', name='The belt is supplying your network.', exact=True)).to_be_visible()
            ledger(grown)
            # Resume the shared consumer to review a busy world with both water and mirror traffic.
            action('Enable automatic launches')
            action('+30 days')
            grown = state()
            assert any(f['kind']=='water' for f in grown['flights']) and grown['solar']['deployments']
            assert len(grown['flights'])+len(grown['solar']['deployments'])<=32
            ledger(grown)
            done('recurring equipment and water services complete all belt milestones and share traffic with mirror launches')

            action('Your saves')
            with page.expect_download() as event:
                page.get_by_role('button', name='Download backup', exact=True).click()
            backup = out/'belt-backup.json'
            event.value.save_as(backup)
            exported = json.loads(backup.read_text())
            assert exported['version']==5 and exported['state']==grown
            bad = json.loads(backup.read_text())
            bad['state']['belt']['refinedT']+=1
            page.locator('input[type=file]').set_input_files({'name':'bad-water.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
            expect(page.get_by_role('alert')).to_contain_text('Water mass ledger')
            assert state()==grown and len(records())==1
            page.locator('input[type=file]').set_input_files(str(backup))
            saved()
            copy = next(r['state'] for r in records() if r['id']!=grown['id'])
            assert copy=={**grown,'id':copy['id'],'revision':0} and state()==grown
            ledger(copy)
            page.locator('.campaign-save-manager>summary').click()
            action('Dismiss message')
            done('schema-5 water backup imports into a separate slot; a broken mass ledger preserves the current world')

            for width,height in [(1440,1000),(1280,800),(1000,900),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                page.evaluate('document.activeElement?.blur();scrollTo(0,0)')
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow at {width}'
                crowded=page.locator('.outpost-stock dd,.solar-stock b').evaluate_all("""els=>els.filter(e=>{const text=(e.querySelector('span')||e).firstChild,r=document.createRange();r.selectNodeContents(text);return r.getBoundingClientRect().right>e.closest('.outpost-stock>div,.solar-stock>div').getBoundingClientRect().right+1}).map(e=>e.textContent)""")
                assert not crowded,f'Stock values collide at {width}: {crowded}'
                page.screenshot(path=str(out/f'belt-{width}.png'),full_page=True)
                page.locator('.campaign-belt').screenshot(path=str(out/f'belt-panel-{width}.png'))
                expect(page.get_by_test_id('ceres-water')).to_be_visible()
                expect(page.get_by_role('button',name='Prepare water return ↗',exact=True)).to_be_visible()
            animations=page.locator('.map-tether[data-site=ceres] .map-orbital-motion').evaluate_all('els=>els.map(e=>getComputedStyle(e).animationName)')
            assert animations==['none']
            guide_context=browser.new_context(java_script_enabled=False)
            guide=guide_context.new_page()
            guide.goto(origin+'/lab/campaign/method/#ceres',wait_until='networkidle')
            expect(guide.get_by_role('heading',name='Into the Belt: water through the Phobos hub.',exact=True)).to_be_visible()
            expect(guide.locator('#ceres')).to_contain_text('scenario assumptions')
            guide_context.close()
            done('busy belt operations fit six responsive widths, Ceres respects reduced motion and the guide works without JavaScript')
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
