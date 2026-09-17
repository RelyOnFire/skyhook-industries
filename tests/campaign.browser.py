#!/usr/bin/env python3
"""Real browser campaign progression, IndexedDB durability and recovery."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--executable');args=parser.parse_args()
    out=ROOT/'qa/browser/campaign';out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    report={'checks':[],'errors':[]}
    def done(name): report['checks'].append(name);print('PASS',name,flush=True)
    with sync_playwright() as p:
        options={'headless':True}
        if args.executable: options['executable_path']=args.executable
        else: options['channel']='chromium'
        browser=p.chromium.launch(**options)
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
        page=context.new_page();page.set_default_timeout(12000)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        def saved(): expect(page.get_by_text('Saved in this browser',exact=True)).to_be_visible()
        def action(name): page.get_by_role('button',name=name,exact=True).click();saved()
        def records(target=page):
            return target.evaluate("""async()=>{const db=await new Promise((ok,no)=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return await new Promise((ok,no)=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}""")
        try:
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            expect(page.get_by_role('button',name='Start new network',exact=True)).to_be_enabled()
            page.screenshot(path=str(out/'welcome-1440.png'),full_page=True)
            page.get_by_label('Name your network',exact=True).fill('Lunar bridge')
            action('Start new network')
            expect(page.get_by_role('heading',level=1)).to_have_text('Lunar bridge')
            action('Dispatch cargo')
            first=records()[0]['state'];assert len(first['flights'])==1 and first['ports']['moon']['materialsT']==0
            page.reload(wait_until='networkidle')
            page.get_by_role('button',name='Continue Lunar bridge').click();saved()
            assert records()[0]['state']==first
            done('reload restores an in-flight shipment without advancing simulation time')
            for _ in range(3): action('Dispatch cargo')
            action('+30 days');assert records()[0]['state']['ports']['moon']['materialsT']==40
            action('Commission lunavator · 30 t')
            page.get_by_label('From',exact=True).select_option('moon')
            page.get_by_role('radio',name='Tether corridor').check()
            action('Dispatch cargo');action('+30 days')
            assert records()[0]['state']['lunarReturnedT']==10
            done('supply Moon, commission lunavator, and deliver lunar return cargo')
            page.get_by_label('From',exact=True).select_option('earth');page.get_by_label('To',exact=True).select_option('phobos')
            page.get_by_role('radio',name='Bootstrap tug').check()
            for _ in range(3):action('Dispatch cargo')
            action('Advance to next event')
            page.get_by_role('button',name='Phobos Awaiting construction').click()
            action('Commission anchor hub · 30 t')
            assert records()[0]['state']['ports']['phobos']['level']==1
            done('Earth–Phobos cargo arrives and builds the central anchor hub')
            # Supply and upgrade the lunavator to complete the first chapter.
            page.get_by_label('To',exact=True).select_option('moon')
            for _ in range(6):action('Dispatch cargo')
            action('+30 days')
            page.get_by_role('button',name='Moon Tier 1').click()
            action('Upgrade lunavator · 60 t')
            expect(page.get_by_text('The first network is established.',exact=True)).to_be_visible()
            done('all four objectives complete through gameplay')
            # Exported JSON is a portable world, including all facilities/resources.
            before=records()[0]['state']
            with page.expect_download() as event: page.get_by_role('button',name='Download backup',exact=True).click()
            backup=out/'campaign-backup.json';event.value.save_as(backup)
            data=json.loads(backup.read_text());assert data['state']==before
            bad=json.loads(backup.read_text());bad['state']['schema']=999
            page.locator('input[type=file]').set_input_files({'name':'unsupported.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
            expect(page.get_by_role('alert')).to_contain_text('different campaign version')
            assert records()[0]['state']==before
            page.locator('input[type=file]').set_input_files(str(backup));saved()
            expect(page.get_by_text('Imported into a new slot. Existing campaigns are unchanged.',exact=True)).to_be_visible()
            assert len(records())==2
            done('backup round-trip creates a separate slot; invalid versions preserve current state')
            action('+1 day')
            active=next(r for r in records() if r['state']['id']!=before['id'])
            page.locator('.campaign-slot-list li').filter(has=page.get_by_text('CURRENT',exact=True)).get_by_role('button',name='Recover checkpoint').click();saved()
            expect(page.get_by_text('Recovered into a new save slot. The original campaign is unchanged.',exact=True)).to_be_visible()
            assert len(records())==3
            recovered=next(r for r in records() if r['state']['name'].endswith('recovery'))
            assert recovered['state']['day']==before['day']
            done('recovery checkpoint branches without destroying the newer save')
            # Two tabs load the same revision, then attempt competing writes.
            other=context.new_page();other.goto(origin+'/lab/campaign/',wait_until='networkidle')
            other.get_by_role('button',name='Continue Lunar bridge · recovery').click()
            expect(other.get_by_text('Saved in this browser',exact=True)).to_be_visible()
            action('+1 day');newest=next(r for r in records() if r['id']==recovered['id'])
            other.get_by_role('button',name='+30 days',exact=True).click()
            expect(other.get_by_role('alert')).to_contain_text('Another tab changed this campaign')
            assert next(r for r in records() if r['id']==recovered['id'])==newest
            other.close();done('stale tabs cannot overwrite a newer save')
            # Force a real IndexedDB transaction failure to prove the UI does
            # not announce success and the existing record remains atomic.
            page.evaluate("""window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('test full','QuotaExceededError')}""")
            action_button=page.get_by_role('button',name='+1 day',exact=True);action_button.click()
            expect(page.get_by_role('alert')).to_contain_text('Could not save')
            expect(page.get_by_text('Not saved — download a backup',exact=True)).to_be_visible()
            assert next(r for r in records() if r['id']==recovered['id'])==newest
            page.evaluate('IDBObjectStore.prototype.put=window.originalPut')
            action('Save now');done('failed saves preserve the last committed world and support retry')
            # The injected quota error is expected and may surface as pageerror.
            report['errors']=[e for e in report['errors'] if 'test full' not in e]
            for width,height in [(1440,1000),(1000,900),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height});page.evaluate('document.activeElement?.blur()');page.evaluate('scrollTo(0,0)')
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow at {width}'
                page.screenshot(path=str(out/f'campaign-{width}.png'),full_page=True)
                expect(page.get_by_role('button',name='Dispatch cargo',exact=True)).to_be_visible()
            done('campaign is usable without horizontal page overflow at five viewport sizes')
            page.get_by_role('link',name='Assumptions & research',exact=True).click()
            expect(page.get_by_role('heading',name='The Moon has its own machine.',exact=True)).to_be_visible()
            page.screenshot(path=str(out/'method-320.png'),full_page=True)
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            native=browser.new_page(java_script_enabled=False)
            native.goto(origin+'/lab/campaign/method/',wait_until='networkidle')
            expect(native.get_by_role('heading',name='Phobos is the central anchor.',exact=True)).to_be_visible();native.close()
            done('model guide and research remain readable without JavaScript')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);page.screenshot(path=str(out/'failure.png'),full_page=True);raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()

if __name__=='__main__':main()
