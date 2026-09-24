#!/usr/bin/env python3
"""Exercise industrial expansion and service tuning without replacing an old save."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
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
    out = ROOT/'qa/browser/campaign-development'
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

    # Only this separate test-world backup receives construction stock. The native
    # legacy fixture and all its water/mirror accounting are retained verbatim.
    prepared = subprocess.run(['node', '--input-type=module', '-e', """
      import {readFileSync} from 'node:fs';
      import {validateCampaign, exportCampaign} from './.lab-test/campaign/model.js';
      const w=validateCampaign(JSON.parse(readFileSync('tests/fixtures/campaign-v5.json','utf8')).state);
      w.id='development-prepared';w.name='Industrial proving ground';w.revision=0;
      for(const id of ['mercury','phobos','ceres']) {
        w.ports[id].materialsT=300000;w.ports[id].equipmentT=10000;
      }
      console.log(exportCampaign(w));
    """], cwd=ROOT, text=True, capture_output=True, check=True)
    prepared_path = out/'prepared-industrial-world.json'
    prepared_path.write_text(prepared.stdout)

    with sync_playwright() as p:
        options = {'headless': True}
        if args.executable: options['executable_path'] = args.executable
        else: options['channel'] = 'chromium'
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        active_id = 'development-native'

        def records():
            return page.evaluate("""async()=>{const db=await new Promise((ok,no)=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return await new Promise((ok,no)=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}""")
        def record(world_id=None): return next(r for r in records() if r['id']==(world_id or active_id))
        def state(): return record()['state']
        def saved(): expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        def action(name):
            page.get_by_role('button', name=name, exact=True).click()
            saved()
        def close_saves():
            details = page.locator('.campaign-save-manager')
            if details.get_attribute('open') is not None: details.locator('summary').click()
        def ledger(w):
            near(w['solar']['manufacturedT'], w['solar']['mirrorsT']+w['solar']['deployedT']+sum(d['massT'] for d in w['solar']['deployments']))
            b, ports = w['belt'], w['ports']
            near(b['extractedT'], ports['ceres']['waterT']+ports['phobos']['waterT']+b['refinedT']+sum(f['cargoT'] for f in w['flights'] if f['kind']=='water'))
            near(b['returnedWaterT'], ports['phobos']['waterT']+b['refinedT'])

        try:
            page.goto(origin+'/lab/campaign/', wait_until='networkidle')
            expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
            old = json.loads((ROOT/'tests/fixtures/campaign-v5.json').read_text())['state']
            old['id'], old['name'] = active_id, 'Preserved network'
            original = {'id':old['id'], 'state':old, 'savedAt':'2099-01-01T00:00:00.000Z', 'checkpoints':[]}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""", original)
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Continue Preserved network').click()
            saved()
            assert record()==original, 'Reading the old world rewrote its stored head'
            action('Your saves')
            action('Save now')
            migrated = record()
            assert migrated['state']['schema']==6 and migrated['state']['revision']==old['revision']+1
            assert migrated['checkpoints']==[old]
            for key in old:
                if key not in ['schema','model','revision']: assert migrated['state'][key]==old[key], key
            assert migrated['state']['development']=={'launchLevel':0,'waterLevel':0,'fuelLevel':0,'mercuryTracts':0,'ceresTracts':0,'fuelReserveT':0}
            action('Save now')
            assert record()==migrated
            done('native v5 load is read-only; schema 6 checkpoints every old field once and starts with no development upgrades')

            page.locator('input[type=file]').set_input_files(str(prepared_path))
            saved()
            imported = next(r for r in records() if r['id']!=old['id'])
            active_id = imported['id']
            assert active_id!=old['id'] and record(old['id'])==migrated
            close_saves()
            chapter = page.locator('#development-operations')
            expect(chapter).to_be_visible()

            for project, field, site in [('launch','launchLevel','mercury'),('water','waterLevel','ceres'),('fuel','fuelLevel','phobos')]:
                before = state()
                chapter.locator('[data-project="'+project+'"] .development-project-actions > .primary').click()
                saved()
                after = state()
                assert after['development'][field]==before['development'][field]+1
                assert after['ports'][site]['materialsT']<before['ports'][site]['materialsT']
                assert after['ports'][site]['equipmentT']<before['ports'][site]['equipmentT']
                assert after['day']==before['day'] and after['flights']==before['flights']
                assert after['solar']==before['solar'] and after['belt']==before['belt']
                ledger(after)
            done('three capacity projects consume local construction and equipment without advancing time or altering existing transit')

            before = state()
            assert before['solar']['depositT']==0
            chapter.locator('.development-tracts > summary').click()
            chapter.locator('[data-project="mercuryTract"]').get_by_role('button', name='Open next mercury mining tract', exact=True).click()
            saved()
            expanded = state()
            assert expanded['development']['mercuryTracts']==1
            near(expanded['solar']['depositT'],100000)
            assert expanded['solar']['manufacturedT']==before['solar']['manufacturedT']
            assert expanded['solar']['deployments']==before['solar']['deployments']
            ledger(expanded)
            done('an exhausted Mercury deposit opens a paid finite tract without crediting past production')

            reserve = chapter.get_by_label('Fuel protected for cargo (t)', exact=True)
            reserve.fill('5000')
            chapter.get_by_role('button', name='Apply reserve', exact=True).click()
            saved()
            before = state()
            assert before['development']['fuelReserveT']==5000
            action('+1 day')
            held = state()
            assert held['solar']['nextDeployment']==before['solar']['nextDeployment']
            assert held['solar']['nextLaunchDay']>before['solar']['nextLaunchDay']
            page.locator('.network-outlook > summary').click()
            expect(page.locator('.outlook-hold-scroll')).to_contain_text('holding 5000 t of support propellant')
            page.get_by_role('link', name='Review mirror controls').click()
            assert page.evaluate('location.hash')=='#development-operations'
            assert state()==held, 'The outlook or its link changed saved resources'
            page.locator('.network-outlook > summary').click()
            page.get_by_label('From', exact=True).select_option('earth')
            page.get_by_label('To', exact=True).select_option('phobos')
            page.get_by_label('Cargo type', exact=True).select_option('equipment')
            page.get_by_label('Cargo (t)', exact=True).fill('1')
            page.get_by_role('radio', name='Bootstrap tug').check()
            action('Dispatch cargo')
            assert state()['nextShipment']==held['nextShipment']+1
            assert state()['development']['fuelReserveT']==5000
            done('cargo reserve persists, holds automatic mirrors on their next attempt and still permits manual cargo')

            before = state()
            edit = page.get_by_role('button', name='Edit service 7', exact=True)
            edit.focus()
            page.keyboard.press('Enter')
            editor = page.get_by_role('form', name='Edit service 7', exact=True)
            expect(editor.get_by_label('Payload · t', exact=True)).to_be_focused()
            editor.get_by_label('Payload · t', exact=True).fill('8')
            editor.get_by_label('Interval · days', exact=True).fill('45')
            page.keyboard.press('Escape')
            expect(edit).to_be_focused()
            assert state()==before
            edit.click()
            editor.get_by_label('Payload · t', exact=True).fill('8')
            editor.get_by_label('Interval · days', exact=True).fill('45')
            editor.get_by_role('button', name='Save service', exact=True).click()
            saved()
            updated = state()
            old_service = next(s for s in before['services'] if s['id']==7)
            new_service = next(s for s in updated['services'] if s['id']==7)
            assert new_service=={**old_service, 'cargoT':8, 'intervalDays':45}
            assert updated['flights']==before['flights'] and updated['day']==before['day']
            assert updated['ports']==before['ports'] and updated['fuelT']==before['fuelT']
            ledger(updated)
            done('keyboard service editing cancels cleanly and preserves identity, departure timing, counters, resources and in-flight cargo')

            edit.click()
            editor.get_by_label('Interval · days', exact=True).fill('1')
            editor.get_by_role('button', name='Save service', exact=True).click()
            saved()
            before = state()
            page.locator('.network-outlook > summary').click()
            page.get_by_label('Forecast horizon').select_option('365')
            recovery = page.locator('.outlook-delays li').filter(has_text='#7 Ceres → Phobos').filter(has_text='tether service is recovering').first
            expect(recovery).to_be_visible()
            recovery.get_by_role('link', name='Review service').click()
            assert page.evaluate('location.hash')=='#service-7'
            expect(page.locator('#service-7')).to_be_in_viewport()
            assert state()==before, 'Forecast navigation changed the saved service'
            page.locator('.network-outlook > summary').click()
            done('outlook names exact cargo and mirror hold reasons and links to the relevant controls without editing the save')

            for _ in range(7):
                chapter.locator('[data-project="mercuryTract"]').get_by_role('button', name='Open next mercury mining tract', exact=True).click()
                saved()
            assert state()['development']['mercuryTracts']==8
            expect(chapter.locator('[data-project="mercuryTract"]').get_by_role('button', name='Open next mercury mining tract', exact=True)).to_have_count(0)
            expect(chapter.locator('[data-project="mercuryTract"] .development-level')).to_have_text('Complete')
            done('Mercury expansion has a visible finite eight-tract limit')

            frozen = state()
            page.reload(wait_until='networkidle')
            page.get_by_role('button', name='Continue Industrial proving ground').click()
            saved()
            assert state()==frozen and record(old['id'])==migrated
            expect(chapter.get_by_label('Fuel protected for cargo (t)', exact=True)).to_have_value('5000')
            action('Your saves')
            with page.expect_download() as event:
                page.get_by_role('button', name='Download backup', exact=True).click()
            backup = out/'industrial-backup.json'
            event.value.save_as(backup)
            envelope = json.loads(backup.read_text())
            assert envelope['version']==6 and envelope['state']==frozen
            page.locator('input[type=file]').set_input_files(str(backup))
            saved()
            copy = next(r['state'] for r in records() if r['id'] not in [old['id'], active_id])
            assert copy=={**frozen, 'id':copy['id'], 'revision':0}
            assert record(old['id'])==migrated and state()==frozen
            close_saves()
            done('all project levels, reserves and edited services survive reload and a separate backup import; the original remains unchanged')

            for width,height in [(1440,1000),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                chapter.evaluate("element=>element.scrollIntoView({block:'start'})")
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'), f'Overflow at {width}'
                clock = page.locator('.campaign-clock').bounding_box()
                assert chapter.bounding_box()['y'] >= clock['y']+clock['height']-1, f'Chapter title hidden behind clock at {width}'
                page.screenshot(path=str(out/f'development-viewport-{width}.png'))
                # Isolated full-component captures omit the unrelated sticky clock;
                # the viewport image above verifies its real position and clearance.
                chapter.screenshot(path=str(out/f'development-{width}.png'), style='.campaign-clock{visibility:hidden!important}')
                page.get_by_role('button', name='Edit service 7', exact=True).click()
                editor = page.get_by_role('form', name='Edit service 7', exact=True)
                editor.scroll_into_view_if_needed()
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'), f'Editor overflows at {width}'
                editor.screenshot(path=str(out/f'service-editor-{width}.png'))
                editor.get_by_role('button', name='Cancel', exact=True).click()
                if width==320:
                    outlook = page.locator('.network-outlook')
                    outlook.locator('summary').click()
                    outlook.evaluate("element=>element.scrollIntoView({block:'start'})")
                    expect(outlook.locator('.outlook-hold-scroll')).to_be_visible()
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'), 'Departure reasons overflow at 320 px'
                    page.screenshot(path=str(out/'outlook-holds-320.png'))
                    outlook.locator('summary').click()
            done('industrial projects and service editing fit desktop, tablet and 390/320 px phones')
            assert not report['errors'], report['errors']
            report['status']='passed'
        except Exception as error:
            report['status']='failed'
            report['failure']=str(error)
            page.screenshot(path=str(out/'failure.png'), full_page=True)
            raise
        finally:
            (out/'report.json').write_text(json.dumps(report, indent=2))
            browser.close()
            if server: server.shutdown()


if __name__=='__main__': main()
