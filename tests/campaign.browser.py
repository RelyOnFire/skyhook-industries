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
        def saved(target=page): expect(target.get_by_text('Saved in this browser',exact=True)).to_be_visible()
        def show_saves(target=page):
            if target.locator('.campaign-save-manager').get_attribute('open') is None:
                target.get_by_role('button',name='Your saves',exact=True).click()
        def action(name,target=page):
            if name=='Save now': show_saves(target)
            target.get_by_role('button',name=name,exact=True).click();saved(target)
        def no_overflow(target,width):
            result=target.evaluate('''()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:[...document.querySelectorAll('body *')].filter(e=>{let r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(0,12).map(e=>({tag:e.tagName,cls:String(e.className),right:e.getBoundingClientRect().right}))})''')
            assert not result['overflow'],f'Overflow at {width}: {result["offenders"]}'
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
            page.locator('.campaign-milestones>summary').click()
            expect(page.get_by_text('The first network is established.',exact=True)).to_be_visible()
            page.locator('.campaign-milestones>summary').click()
            done('all four objectives complete through gameplay')
            # Extend that same world into a productive, automatically supplied network.
            page.get_by_label('From',exact=True).select_option('earth')
            page.get_by_label('To',exact=True).select_option('moon')
            for _ in range(2):action('Dispatch cargo')
            page.get_by_label('Cargo type',exact=True).select_option('equipment');action('Dispatch cargo')
            action('+30 days');action('Install lunar processor')
            page.get_by_label('To',exact=True).select_option('phobos')
            action('Dispatch cargo')
            page.get_by_label('Cargo type',exact=True).select_option('materials')
            for _ in range(2):action('Dispatch cargo')
            for _ in range(9):action('+30 days')
            page.get_by_role('button',name='Phobos Tier 1').click()
            action('Install mars staging depot')
            # Equipment services keep both industries supplied; lunar output goes direct.
            page.get_by_label('To',exact=True).select_option('moon')
            page.get_by_label('Cargo type',exact=True).select_option('equipment')
            page.get_by_role('radio',name='Tether corridor').check()
            page.get_by_label('Cargo (t)',exact=True).fill('5')
            page.get_by_label('Repeat every (simulation days)',exact=True).fill('90')
            action('Schedule service')
            page.get_by_label('To',exact=True).select_option('phobos')
            page.get_by_label('Cargo (t)',exact=True).fill('3')
            page.get_by_label('Repeat every (simulation days)',exact=True).fill('100')
            action('Schedule service')
            page.get_by_label('From',exact=True).select_option('moon')
            page.get_by_label('Cargo type',exact=True).select_option('materials')
            page.get_by_label('Cargo (t)',exact=True).fill('10')
            page.get_by_label('Repeat every (simulation days)',exact=True).fill('20')
            action('Schedule service');action('+30 days')
            live=records()[0]['state'];flight=next(f for f in live['flights'] if f['from']=='moon' and f['to']=='phobos')
            action('Track flight '+str(flight['id']))
            expect(page.locator('.map-flight.tracked')).to_have_count(1)
            for _ in range(19):action('+30 days')
            live=records()[0]['state']
            assert live['marsOperations']>100 and live['lunarPhobosDeliveredT']>=100
            assert live['services'][2]['dispatched']>=20 and live['services'][2]['deliveredT']>0
            expect(page.get_by_label('Tracked flight')).to_contain_text('Delivery complete')
            expect(page.get_by_label('Recent arrivals')).to_contain_text('Deliveries received')
            assert page.locator('.campaign-network-goals li.complete').count()==4
            action('Pause service 3');paused=records()[0]['state']['services'][2]['dispatched']
            action('+30 days');assert records()[0]['state']['services'][2]['dispatched']==paused
            action('Resume service 3');action('+30 days')
            assert records()[0]['state']['services'][2]['dispatched']>paused
            done('equipment, lunar production and direct recurring Phobos deliveries sustain Mars operations')
            frozen=records()[0]['state']
            page.reload(wait_until='networkidle')
            page.get_by_role('button',name='Continue Lunar bridge').click();saved()
            assert records()[0]['state']==frozen
            page.get_by_label('Simulation speed',exact=True).select_option('30')
            page.get_by_role('button',name='Play simulation',exact=True).click()
            expect(page.get_by_test_id('campaign-day')).not_to_have_text('Day '+format(frozen['day'],',.1f'))
            page.wait_for_function("prior=>document.querySelector('[data-testid=campaign-day]').textContent!==prior",arg='Day '+format(frozen['day'],',.1f'))
            page.get_by_role('button',name='Pause simulation',exact=True).click();saved()
            paused_day=records()[0]['state']['day'];assert paused_day>=frozen['day']+30
            page.wait_for_timeout(1150);assert records()[0]['state']['day']==paused_day
            page.reload(wait_until='networkidle')
            page.get_by_role('button',name='Continue Lunar bridge').click();saved()
            expect(page.get_by_role('button',name='Play simulation',exact=True)).to_be_visible()
            assert records()[0]['state']['day']==paused_day
            done('scheduled worlds reload exactly; accelerated play advances, pause and reload stop time')
            # Exported JSON is a portable world, including all facilities/resources.
            before=records()[0]['state']
            show_saves()
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
            page.get_by_role('button',name='Your saves',exact=True).click()
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
            page.evaluate("""()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('test full','QuotaExceededError')};}""")
            page.get_by_role('button',name='Play simulation',exact=True).click()
            expect(page.get_by_role('alert')).to_contain_text('Could not save')
            expect(page.get_by_text('Not saved — download a backup',exact=True)).to_be_visible()
            assert next(r for r in records() if r['id']==recovered['id'])==newest
            page.evaluate('()=>{IDBObjectStore.prototype.put=window.originalPut;}')
            action('Retry save');done('failed saves preserve the last committed world and support retry')
            # The injected quota error is expected and may surface as pageerror.
            report['errors']=[e for e in report['errors'] if 'test full' not in e]
            legacy=json.loads((ROOT/'tests/fixtures/campaign-v1.json').read_text())['state']
            legacy['id']='legacy-browser-fixture';legacy['name']='Legacy network'
            legacy_record={'id':legacy['id'],'state':legacy,'savedAt':'2099-01-01T00:00:00.000Z','checkpoints':[]}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""",legacy_record)
            page.reload(wait_until='networkidle');page.get_by_role('button',name='Continue Legacy network').click();saved()
            assert next(r for r in records() if r['id']==legacy['id'])==legacy_record
            action('Save now')
            migrated=next(r for r in records() if r['id']==legacy['id'])
            assert migrated['state']['schema']==3 and migrated['state']['revision']==legacy['revision']+1
            assert migrated['state']['day']==legacy['day'] and migrated['state']['fuelT']==legacy['fuelT']
            assert migrated['checkpoints'][0]==legacy
            page.get_by_role('button',name='Your saves',exact=True).click()
            page.locator('.campaign-slot-list li').filter(has=page.get_by_text('CURRENT',exact=True)).get_by_role('button',name='Recover checkpoint').click();saved()
            legacy_recovery=next(r['state'] for r in records() if r['state']['name']=='Legacy network · recovery')
            assert legacy_recovery['day']==legacy['day'] and legacy_recovery['ports']['earth']['equipmentT']==20
            page.get_by_role('button',name='Load Legacy network',exact=True).click();saved()
            action('+1 day')
            assert next(r for r in records() if r['id']==legacy['id'])['state']['ports']['earth']['equipmentT']==20.5
            page.get_by_role('button',name='Load Lunar bridge · recovery',exact=True).click();saved()
            done('real first-chapter browser save migrates atomically, retains recovery and increments the stale-tab token')
            if page.locator('.campaign-save-manager').get_attribute('open') is not None:page.locator('.campaign-save-manager>summary').click()
            for width,height in [(1440,1000),(1000,900),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height});page.evaluate('document.activeElement?.blur()');page.evaluate('scrollTo(0,0)')
                no_overflow(page,width)
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
            # Reproduce equipment depletion using real controls in a separate browser save.
            supply_context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
            supply=supply_context.new_page()
            supply.on('pageerror',lambda e:report['errors'].append(str(e)))
            supply.goto(origin+'/lab/campaign/',wait_until='networkidle')
            action('Start new network',supply)
            supply.get_by_label('Cargo type',exact=True).select_option('equipment')
            action('Dispatch cargo',supply);action('Dispatch cargo',supply)
            expect(supply.get_by_test_id('origin-equipment')).to_have_text('0 t')
            expect(supply.get_by_role('button',name='Dispatch cargo',exact=True)).to_be_disabled()
            expect(supply.locator('#flight-reason')).to_contain_text('Earth manufactures 0.5 t per simulation day')
            expect(supply.get_by_label('Departure depot stock')).to_contain_text('+30 days produces 15 t')
            action('+30 days',supply)
            expect(supply.get_by_test_id('origin-equipment')).to_have_text('15 t')
            assert records(supply)[0]['state']['ports']['moon']['equipmentT']==20
            action('Dispatch cargo',supply)
            expect(supply.get_by_test_id('origin-equipment')).to_have_text('5 t')
            for width in [390,320]:
                supply.set_viewport_size({'width':width,'height':844})
                assert not supply.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                supply.locator('.campaign-dispatch').screenshot(path=str(out/f'equipment-depot-{width}.png'))
            supply_context.close()
            done('empty Earth equipment replenishes through time controls and can be shipped again')
            # Continue a real v2 network into Mercury using only ordinary game controls.
            solar_context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
            solar=solar_context.new_page();solar.set_default_timeout(12000)
            solar.on('pageerror',lambda e:report['errors'].append(str(e)))
            solar.goto(origin+'/lab/campaign/',wait_until='networkidle')
            expect(solar.get_by_role('button',name='Start new network',exact=True)).to_be_enabled()
            previous=json.loads((ROOT/'tests/fixtures/campaign-v2.json').read_text())['state']
            previous['id']='mercury-browser-fixture';previous['name']='Mercury expedition'
            previous_record={'id':previous['id'],'state':previous,'savedAt':'2099-01-01T00:00:00.000Z','checkpoints':[]}
            solar.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""",previous_record)
            solar.reload(wait_until='networkidle');solar.get_by_role('button',name='Continue Mercury expedition').click();saved(solar)
            assert records(solar)[0]==previous_record
            action('Save now',solar);migrated=records(solar)[0]
            assert migrated['state']['schema']==3 and migrated['state']['revision']==previous['revision']+1
            assert migrated['checkpoints'][0]==previous
            for key in ['flights','services','day','fuelT','marsOperations']:
                assert migrated['state'][key]==previous[key]
            for site in ['earth','moon','phobos']:
                assert migrated['state']['ports'][site]==previous['ports'][site]
            done('v2 native save upgrades without altering industry, stocks, scheduled services or in-flight cargo')
            action('Request supply allocation',solar);action('Open Mercury expedition',solar)
            solar.get_by_label('From',exact=True).select_option('moon');solar.get_by_label('To',exact=True).select_option('mercury')
            solar.get_by_role('radio',name='Bootstrap tug').check()
            for _ in range(5):action('Dispatch cargo',solar)
            solar.get_by_label('From',exact=True).select_option('earth');solar.get_by_label('Cargo type',exact=True).select_option('equipment')
            for _ in range(5):action('Dispatch cargo',solar)
            for _ in range(4):action('+30 days',solar)
            solar.get_by_role('button',name='Mercury Awaiting construction',exact=True).click()
            action('Commission rotovator · 30 t',solar);action('Install mercury refinery',solar)
            action('+30 days',solar);action('Install mirror works',solar)
            action('+30 days',solar);action('Install mirror launch array',solar)
            solar.get_by_role('radio',name='Tether corridor').check()
            solar.get_by_label('Repeat every (simulation days)',exact=True).fill('60');action('Schedule service',solar)
            action('Launch 10 t mirrors',solar);launched=records(solar)[0]['state']
            assert launched['solar']['deployedT']==0 and len(launched['solar']['deployments'])==1
            solar.reload(wait_until='networkidle');solar.get_by_role('button',name='Continue Mercury expedition').click();saved(solar)
            assert records(solar)[0]['state']==launched
            action('Enable automatic launches',solar)
            for _ in range(20):action('+30 days',solar)
            established=records(solar)[0]['state']
            assert established['solar']['deployedT']>=100
            assert solar.locator('.solar-goals li.complete').count()==4
            assert solar.locator('.map-swarm rect').count()>0
            expect(solar.get_by_text('Your first solar swarm is established.',exact=True)).to_be_visible()
            done('Mercury supply, refinery, mirror manufacture and automatic launches complete all four new milestones')
            action('Pause automatic launches',solar);last_id=records(solar)[0]['state']['solar']['nextDeployment']
            action('+30 days',solar);assert records(solar)[0]['state']['solar']['nextDeployment']==last_id
            action('Enable automatic launches',solar);action('+30 days',solar)
            assert records(solar)[0]['state']['solar']['nextDeployment']>last_id
            before=records(solar)[0]['state']
            show_saves(solar)
            with solar.expect_download() as event:solar.get_by_role('button',name='Download backup',exact=True).click()
            solar_backup=out/'solar-backup.json';event.value.save_as(solar_backup)
            assert json.loads(solar_backup.read_text())['state']==before
            solar.locator('input[type=file]').set_input_files(str(solar_backup));saved(solar)
            restored=next(r['state'] for r in records(solar) if r['id']!=before['id'])
            assert restored['solar']==before['solar'] and restored['ports']==before['ports']
            done('mirror deployments survive reload and backup import; launch pause and resume retain flights already sent')
            # Selection and order preparation are presentation only; every depot remains visible.
            before_ui=records(solar)
            solar.get_by_role('button',name='Supply Mercury with equipment',exact=True).click()
            expect(solar.get_by_label('From',exact=True)).to_have_value('earth')
            expect(solar.get_by_label('To',exact=True)).to_have_value('mercury')
            expect(solar.get_by_label('Cargo type',exact=True)).to_have_value('equipment')
            expect(solar.get_by_role('radio',name='Tether corridor')).to_be_checked()
            expect(solar.get_by_label('Repeat every (simulation days)',exact=True)).to_have_value('60')
            expect(solar.locator('.route-planned')).to_have_count(1)
            solar.get_by_role('button',name='Locate Phobos',exact=True).focus()
            solar.keyboard.press('Enter')
            expect(solar.locator('#outpost-phobos')).to_have_class('outpost selected')
            for site in ['earth','moon','phobos','mercury']:
                expect(solar.get_by_test_id(site+'-equipment')).to_be_visible()
                expect(solar.get_by_test_id(site+'-materials')).to_be_visible()
            assert records(solar)==before_ui
            for service in restored['services']:
                if service['enabled'] and service['nextDay']>restored['day']+1:
                    expect(solar.get_by_label('Service '+str(service['id']),exact=True).locator('.traffic-state')).to_have_text('Scheduled')
            times=solar.locator('.flight-row').evaluate_all('(rows)=>rows.map(r=>Number(r.dataset.arrival))')
            assert times==sorted(times)
            assert solar.locator('.mirror-tag').count()>0
            done('all outpost stocks stay exposed; supply shortcuts and keyboard map selection preserve the save; cargo and mirrors share an arrival-ordered queue')
            if solar.locator('.campaign-save-manager').get_attribute('open') is not None:solar.locator('.campaign-save-manager>summary').click()
            if solar.get_by_role('button',name='Dismiss message',exact=True).count():solar.get_by_role('button',name='Dismiss message',exact=True).click()
            for width,height in [(1440,1000),(1280,800),(1000,900),(768,1024),(390,844),(320,800)]:
                solar.set_viewport_size({'width':width,'height':height});solar.evaluate('document.activeElement?.blur()')
                no_overflow(solar,width)
                solar.evaluate('scrollTo(0,0)')
                solar.screenshot(path=str(out/f'operations-{width}.png'),full_page=True)
                solar.screenshot(path=str(out/f'operations-viewport-{width}.png'))
                if width>=1280:
                    positions=solar.locator('#outposts-heading,#schedules-heading,#traffic-heading,#network').evaluate_all('(els)=>els.map(e=>({id:e.id,y:e.getBoundingClientRect().top,x:e.getBoundingClientRect().left}))')
                    by_id={p['id']:p for p in positions}
                    assert abs(by_id['outposts-heading']['y']-by_id['traffic-heading']['y'])<5
                    assert 0<by_id['schedules-heading']['y']-by_id['traffic-heading']['y']<450
                    assert by_id['outposts-heading']['x']<by_id['network']['x']<by_id['schedules-heading']['x']
                    assert by_id['schedules-heading']['y']<height
                    assert solar.locator('#network').bounding_box()['width']>width*.49
                solar.locator('.campaign-solar').screenshot(path=str(out/f'solar-{width}.png'))
                if width in [1440,320]:solar.locator('.network-map').screenshot(path=str(out/f'solar-map-{width}.png'))
            solar_context.close()
            done('operations layout fits six widths; the map is the largest panel and both arrivals and services start within the desktop viewport')
            # A manual dispatch must share the save lock with Play, without pausing it.
            live_context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
            live=live_context.new_page();live.set_default_timeout(12000)
            live.on('pageerror',lambda e:report['errors'].append(str(e)))
            live.goto(origin+'/lab/campaign/',wait_until='networkidle');action('Start new network',live)
            live.evaluate('''()=>{
                const original=IDBDatabase.prototype.transaction;
                IDBDatabase.prototype.transaction=function(...args){
                    const tx=original.apply(this,args);
                    if(args[1]==='readwrite'){
                        IDBDatabase.prototype.transaction=original;
                        Object.defineProperty(tx,'oncomplete',{set(fn){
                            tx.addEventListener('complete',event=>{window.releaseSave=()=>fn.call(tx,event);});
                        }});
                    }
                    return tx;
                };
            }''')
            live.get_by_role('button',name='Play simulation',exact=True).click()
            live.get_by_role('button',name='Dispatch cargo',exact=True).click()
            expect(live.get_by_text('Saving…',exact=True)).to_be_visible()
            live.wait_for_function('()=>typeof window.releaseSave==="function"')
            held=records(live)[0]['state']
            assert len(held['flights'])==1 and held['ports']['earth']['materialsT']==150
            expect(live.get_by_role('button',name='Pause simulation',exact=True)).to_be_enabled()
            live.wait_for_timeout(1200)
            assert records(live)[0]['state']==held, 'Play advanced before the manual save finished'
            live.evaluate('()=>window.releaseSave()');saved(live)
            expect(live.get_by_role('button',name='Pause simulation',exact=True)).to_be_visible()
            live.wait_for_function('prior=>Number(document.querySelector("[data-testid=campaign-day]").textContent.replace(/[^0-9.]/g,""))>prior',arg=held['day'])
            saved(live)
            live.get_by_role('button',name='Pause simulation',exact=True).click()
            after=records(live)[0]['state']
            assert after['day']>held['day'] and after['nextShipment']==held['nextShipment']
            assert after['ports']['earth']['materialsT']==150
            assert after['flights'][0]==held['flights'][0]
            done('dispatch during Play saves exactly one shipment, waits for persistence, then resumes automatic time')
            live.get_by_role('button',name='Play simulation',exact=True).click()
            action('Schedule service',live);action('Pause service 1',live)
            action('Save now',live)
            expect(live.get_by_role('button',name='Pause simulation',exact=True)).to_be_visible()
            action('+1 day',live)
            expect(live.get_by_role('button',name='Play simulation',exact=True)).to_be_visible()
            live.get_by_role('button',name='Play simulation',exact=True).click()
            live.get_by_label('New network name',exact=True).fill('Clock isolation')
            action('Create separate network',live)
            fresh=next(r['state'] for r in records(live) if r['state']['name']=='Clock isolation')
            expect(live.get_by_role('button',name='Play simulation',exact=True)).to_be_visible()
            live.wait_for_timeout(1150)
            assert next(r['state'] for r in records(live) if r['state']['id']==fresh['id'])==fresh
            assert fresh['day']==0
            # A failed manual dispatch stops Play and preserves the committed head.
            live.evaluate("""()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('test full','QuotaExceededError')};}""")
            live.get_by_role('button',name='Play simulation',exact=True).click()
            live.get_by_role('button',name='Dispatch cargo',exact=True).click()
            expect(live.get_by_role('alert')).to_contain_text('Could not save')
            expect(live.get_by_role('button',name='Play simulation',exact=True)).to_be_disabled()
            expect(live.get_by_role('button',name='Export unsaved progress',exact=True)).to_be_visible()
            assert next(r['state'] for r in records(live) if r['state']['id']==fresh['id'])==fresh
            live.evaluate('()=>{IDBObjectStore.prototype.put=window.originalPut;}');action('Retry save',live)
            retried=next(r['state'] for r in records(live) if r['state']['id']==fresh['id'])
            assert retried['day']==0 and len(retried['flights'])==1 and retried['ports']['earth']['materialsT']==150
            live.wait_for_timeout(1150)
            assert next(r['state'] for r in records(live) if r['state']['id']==fresh['id'])==retried
            report['errors']=[e for e in report['errors'] if 'test full' not in e]
            live_context.close()
            done('service edits and Save now preserve Play; explicit time steps, world changes and failed manual saves stop it safely')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);page.screenshot(path=str(out/'failure.png'),full_page=True)
            if 'solar' in locals() and not solar.is_closed():solar.screenshot(path=str(out/'solar-failure.png'),full_page=True)
            raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()

if __name__=='__main__':main()
