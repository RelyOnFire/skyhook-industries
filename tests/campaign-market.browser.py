#!/usr/bin/env python3
"""Real customer markets, independent rival freight and immutable saved prices."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import threading
from playwright.sync_api import sync_playwright, expect
from campaign_browser_helpers import fresh_market

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--executable')
    parser.add_argument('--origin', help='Exercise a published preview in an isolated browser')
    args = parser.parse_args()
    out = ROOT/'qa/browser/campaign-market'
    out.mkdir(parents=True, exist_ok=True)
    server = None
    if args.origin:
        origin = args.origin.rstrip('/')
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT/'dist')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}'
    report = {'origin':origin, 'checks':[], 'errors':[]}

    # A separate stocked test network makes the player/rival accounting clear.
    prepared = subprocess.run(['node','--input-type=module','-e',"""
      import {createCampaign,validateCampaign,exportCampaign} from './.lab-test/campaign/model.js';
      const w=createCampaign('market-prepared','Customer demand proving ground');
      w.ports.earth.level=3;w.fuelT=10000;
      Object.assign(w.ports.moon,{level:3,industry:true,materialsT:1000,equipmentT:100});
      Object.assign(w.ports.phobos,{level:3,materialsT:100,equipmentT:100});
      console.log(exportCampaign(validateCampaign(w)));
    """],cwd=ROOT,text=True,capture_output=True,check=True)
    clean_path=out/'prepared-market-world.json'
    clean_path.write_text(prepared.stdout)

    def done(name):
        report['checks'].append(name)
        print('PASS',name,flush=True)

    def near(a,b): assert abs(a-b)<1e-6, f'{a} != {b}'
    def n(value): return f'{value:,.1f}'.rstrip('0').rstrip('.')

    with sync_playwright() as p:
        options={'headless':True}
        if args.executable: options['executable_path']=args.executable
        else: options['channel']='chromium'
        browser=p.chromium.launch(**options)
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
        page=context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror',lambda error:report['errors'].append(str(error)))
        active_id='market-migration-v9'

        def records():
            return page.evaluate("""async()=>{const db=await new Promise((ok,no)=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return await new Promise((ok,no)=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}""")
        def record(): return next(r for r in records() if r['id']==active_id)
        def state(): return record()['state']
        def saved(): expect(page.get_by_text('Saved in this browser',exact=True)).to_be_visible()
        def action(name,scope=None):
            (scope or page).get_by_role('button',name=name,exact=True).click()
            saved()
        def toggle_open(selector):
            details=page.locator(selector)
            if details.get_attribute('open') is None: details.locator(':scope > summary').click()
        def close_saves():
            details=page.locator('.campaign-save-manager')
            if details.get_attribute('open') is not None: details.locator('summary').click()
        def import_world(path):
            nonlocal active_id
            old_ids={r['id'] for r in records()}
            page.locator('input[type=file]').set_input_files(str(path))
            saved()
            active_id=next(r['id'] for r in records() if r['id'] not in old_ids)
            close_saves()
            dismiss=page.get_by_role('button',name='Dismiss message',exact=True)
            if dismiss.count():dismiss.click()
        def geometry():
            return page.evaluate("""()=>({
              map:document.querySelector('.network-map').getBoundingClientRect().height,
              inspector:document.querySelector('#flight-inspector').getBoundingClientRect().height,
              active:document.querySelector('.contract-current').getBoundingClientRect().height,
              markets:[...document.querySelectorAll('.contract-market')].map(e=>e.getBoundingClientRect().height)
            })""")
        def offer(offer_id):return page.locator('[data-offer="'+offer_id+'"]')
        def forecast(w):
            result=subprocess.run(['node','--input-type=module','-e',"""
              import {readFileSync} from 'node:fs';
              import {validateCampaign,activeContract,advance,buyerMarket,CONTRACT_OFFERS} from './.lab-test/campaign/model.js';
              const w=validateCampaign(JSON.parse(readFileSync(0,'utf8'))),contract=activeContract(w);
              const next=advance(w,contract.dueDay-w.day);
              console.log(JSON.stringify({world:next,buyers:CONTRACT_OFFERS.map(o=>({id:o.id,buyer:o.buyer,now:buyerMarket(w,o.id),later:buyerMarket(next,o.id)}))}));
            """],input=json.dumps(w),cwd=ROOT,text=True,capture_output=True,check=True)
            return json.loads(result.stdout)

        try:
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            expect(page.get_by_role('button',name='Start new network',exact=True)).to_be_enabled()
            old=json.loads((ROOT/'tests/fixtures/campaign-v9.json').read_text())['state']
            original={'id':old['id'],'state':old,'savedAt':'2099-01-01T00:00:00.000Z','checkpoints':[]}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""",original)
            page.reload(wait_until='networkidle')
            page.get_by_role('button',name='Continue Contract market migration').click()
            saved()
            assert record()==original,'Reading v9 saved a migration or altered accepted terms'
            expect(page.locator('.contract-active .contract-locked-terms')).to_contain_text('4 cr / t locked')
            action('Your saves');action('Save now')
            migrated=record()
            w=migrated['state']
            assert w['schema']==10 and w['model']=='network-0.10.0' and w['revision']==old['revision']+1
            assert migrated['checkpoints']==[old]
            for key in old:
                if key not in ['schema','model','revision','commerce']: assert w[key]==old[key],key
            for key in old['commerce']:
                if key!='contracts': assert w['commerce'][key]==old['commerce'][key],key
            assert w['commerce']['contracts']==[{**c,'rate':4,'completionBonusCredits':30,'marketRound':None} for c in old['commerce']['contracts']]
            assert w['commerce']['market']==fresh_market(old['day'])
            action('Save now');assert record()==migrated
            close_saves()
            done('native v9 reads remain untouched; schema10 checkpoints once, preserves credits and freight, and locks legacy prices without past market activity')

            action('Pause service 2')
            toggle_open('.contract-offers')
            expect(page.get_by_test_id('buyer-market-lunar-return')).to_contain_text('300 t open')
            expect(offer('lunar-return').locator('.contract-quote-rate')).to_have_text('4 cr / t')
            geometry_before={}
            for width in [1440,768,320]:
                page.set_viewport_size({'width':width,'height':1000})
                geometry_before[width]=geometry()
            page.set_viewport_size({'width':1440,'height':1000})
            action('Advance to next event')  # Existing 7 t customer shipment.
            action('Advance to next event')  # First rival booking window, +15 d.
            bidding=state();market=bidding['commerce']['market']
            near(bidding['day'],old['day']+15)
            assert market['buyers']['lunar-return']=={'openT':210,'playerCommittedT':0,'rivalCommittedT':90}
            assert len(market['flights'])==2 and {f['operatorId'] for f in market['flights']}=={'selene','vector'}
            assert not bidding['flights'],'Rival shipments entered the player cargo queue'
            near(bidding['ports']['earth']['materialsT'],old['ports']['earth']['materialsT'])
            near(bidding['ports']['moon']['materialsT'],old['ports']['moon']['materialsT']+15)
            near(bidding['fuelT'],old['fuelT']+15)
            legacy=bidding['commerce']['contracts'][1]
            assert legacy['rate']==4 and legacy['completionBonusCredits']==30 and legacy['marketRound'] is None
            assert legacy['deliveredT']==16 and legacy['earnedCredits']==64
            expect(offer('lunar-return').locator('.contract-quote-rate')).to_have_text('2 cr / t')
            expect(page.locator('.contract-active .contract-locked-terms')).to_contain_text('4 cr / t locked')
            expect(page.get_by_test_id('buyer-market-lunar-return')).to_contain_text('90 t reserved')
            expect(page.get_by_test_id('cargo-capacity')).to_have_text('0 / 256')
            done('rival reservations reduce open demand and reprice new offers while legacy contracts keep their price and rivals use independent cargo and fuel')

            frozen=record()
            for width in [1440,768,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert geometry()==geometry_before[width],f'Market update moved fixed panels at {width}'
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow at {width}'
                page.locator('#contracts').screenshot(path=str(out/f'live-market-{width}.png'),style='.campaign-clock{visibility:hidden!important}')
            page.set_viewport_size({'width':1440,'height':1000})
            toggle_open('.contract-market-activity')
            activity=page.get_by_role('region',name='Recent buyer activity',exact=True)
            expect(activity).to_contain_text('Selene Logistics')
            expect(activity).to_contain_text('Vector Freight')
            action('Prepare shipment',page.locator('#contracts'))
            expect(page.get_by_label('Cargo recipient',exact=True)).to_have_value('2')
            expect(page.get_by_label('From',exact=True)).to_have_value('moon')
            expect(page.get_by_label('To',exact=True)).to_have_value('earth')
            assert record()==frozen,'Market browsing or preparing freight changed the save'
            done('live price and rival activity remain readable without shifting market cards; viewing and preparing orders stay read-only at three widths')

            page.get_by_role('radio',name='Bootstrap tug').check()
            page.get_by_label('Cargo (t)',exact=True).fill('7')
            action('Dispatch cargo');action('Dispatch cargo');action('+30 days')
            finished=state();legacy=finished['commerce']['contracts'][1]
            assert legacy['status']=='completed' and legacy['earnedCredits']==150
            assert finished['commerce']['credits']==264 and finished['commerce']['earnedCredits']==300 and finished['commerce']['spentCredits']==36
            expect(page.locator('.contract-current .contract-locked-terms')).to_contain_text('4 cr / t locked')
            expect(page.locator('.contract-current')).to_contain_text('150 cr')
            done('an in-progress legacy order pays the entire original 150-credit agreement after lower live quotes appear')

            import_world(clean_path)
            toggle_open('.contract-offers')
            mars=offer('mars-build')
            expect(mars.locator('.contract-quote-rate')).to_have_text('8 cr / t')
            action('Accept contract',mars)
            accepted=state();contract=accepted['commerce']['contracts'][0]
            assert contract['rate']==8 and contract['completionBonusCredits']==60 and contract['marketRound']==0
            assert accepted['commerce']['market']['buyers']['mars-build']=={'openT':570,'playerCommittedT':30,'rivalCommittedT':0}
            expect(mars.locator('.contract-quote-rate')).to_have_text('6 cr / t')
            action('Accept contract',offer('lunar-return'))
            expect(page.locator('.contract-active')).to_have_count(2)
            expect(offer('mars-build').get_by_role('button',name='Accept contract',exact=True)).to_be_disabled()
            expect(offer('lunar-return').get_by_role('button',name='Accept contract',exact=True)).to_be_disabled()
            assert state()['commerce']['contracts'][1]['rate']==4
            for contract_id,destination in [(1,'phobos'),(2,'earth')]:
                card=page.locator('.contract-active[data-contract-id="'+str(contract_id)+'"]')
                action('Prepare shipment',card)
                expect(page.get_by_label('Cargo recipient',exact=True)).to_have_value(str(contract_id))
                expect(page.get_by_label('To',exact=True)).to_have_value(destination)
                page.get_by_role('radio',name='Bootstrap tug').check()
                page.get_by_label('Cargo (t)',exact=True).fill('10')
                for _ in range(3): action('Dispatch cargo')
            dispatched=state()
            own_flights=[f for f in dispatched['flights'] if f['contractId']==1]
            assert len(own_flights)==3 and len([f for f in dispatched['flights'] if f['contractId']==2])==3
            toggle_open('.network-outlook')
            page.get_by_label('Forecast horizon',exact=True).select_option('contract')
            lunar_due=dispatched['commerce']['contracts'][1]['dueDay']
            expect(page.locator('.outlook-body')).to_contain_text('to Day '+n(lunar_due))
            page.get_by_label('Forecast horizon',exact=True).select_option('contract-1')
            expect(page.locator('.outlook-body')).to_contain_text('to Day '+n(contract['dueDay']))
            expect(page.locator('.outlook-body')).to_contain_text('Credits: 0 → 450 cr')
            assert state()==dispatched, 'Comparing concurrent contract deadlines changed the save'
            page.locator('.network-outlook>summary').click()
            for width in [1440,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                expect(page.locator('.contract-active')).to_have_count(2)
                page.locator('.contract-current').screenshot(path=str(out/f'parallel-orders-{width}.png'),style='.campaign-clock{visibility:hidden!important}')
            page.set_viewport_size({'width':1440,'height':1000})
            for _ in range(3): action('+30 days')
            reviewed=state()
            assert reviewed['day']==90 and reviewed['commerce']['market']['round']==1
            assert reviewed['flights']==own_flights and reviewed['commerce']['contracts'][0]==contract
            assert reviewed['commerce']['contracts'][1]['status']=='completed' and reviewed['commerce']['credits']==150
            assert reviewed['commerce']['market']['buyers']['mars-build']=={'openT':300,'playerCommittedT':0,'rivalCommittedT':0}
            expect(page.locator('.contract-active .contract-locked-terms')).to_contain_text('8 cr / t locked')
            expect(page.get_by_test_id('buyer-market-mars-build')).to_contain_text('300 t open')
            done('separate buyers accept concurrent orders with distinct recipients and deadlines; lunar payment and a new buyer round preserve the older Mars contract and cargo')

            expected=forecast(reviewed)
            frozen=record()
            toggle_open('.network-outlook')
            expect(page.get_by_label('Forecast horizon',exact=True)).to_have_value('contract-1')
            expect(page.locator('.outlook-body')).to_contain_text('to Day '+n(contract['dueDay']))
            page.get_by_label('Forecast horizon',exact=True).select_option('contract')
            expect(page.locator('.outlook-body')).to_contain_text('Credits: 150 → 450 cr')
            toggle_open('.outlook-market')
            projected=page.get_by_label('Projected buyer demand',exact=True)
            for buyer in expected['buyers']:
                card=projected.locator('.outlook-port').filter(has=page.get_by_text(buyer['buyer'],exact=True))
                expect(card).to_contain_text(f"{n(buyer['now']['openT'])} → {n(buyer['later']['openT'])} t")
                expect(card).to_contain_text(f"{buyer['now']['rate']} → {buyer['later']['rate']} cr/t")
            assert record()==frozen,'Projecting future market rounds or rival cargo advanced the save'
            page.locator('.network-outlook>summary').click()
            done('deadline forecasts include actual buyer rounds and rival freight, show projected prices, and leave the saved market unchanged')

            for _ in range(6): action('+30 days')
            completed=state();market=completed['commerce']['market']
            assert completed['commerce']['contracts'][0]['status']=='completed'
            assert completed['commerce']['credits']==450 and completed['commerce']['contracts'][0]['earnedCredits']==300
            assert completed['commerce']['contracts'][1]['earnedCredits']==150
            near(completed['ports']['phobos']['materialsT'],100)
            assert market['rivalDeliveredT']['selene']>0 and market['rivalDeliveredT']['vector']>0
            assert len(market['history'])==24
            assert sum(f['operatorId']=='selene' for f in market['flights'])<=1
            assert sum(f['operatorId']=='vector' for f in market['flights'])<=3
            toggle_open('.contract-market-activity')
            expect(activity.locator('li')).to_have_count(24)
            assert activity.evaluate('e=>e.scrollHeight>e.clientHeight && e.clientHeight<=251')
            for width in [1440,768,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Activity overflow at {width}'
                activity.screenshot(path=str(out/f'market-activity-{width}.png'),style='.campaign-clock{visibility:hidden!important}')
            assert state()==completed
            done('both competing fleets deliver over real transit times; player earnings stay locked and market activity remains bounded and scrollable')

            page.set_viewport_size({'width':1440,'height':1000})
            page.reload(wait_until='networkidle')
            page.get_by_role('button',name='Continue Customer demand proving ground').click();saved()
            assert state()==completed
            action('Your saves')
            with page.expect_download() as event: page.get_by_role('button',name='Download backup',exact=True).click()
            backup=out/'market-backup.json';event.value.save_as(backup)
            exported=json.loads(backup.read_text())
            assert exported['version']==10 and exported['state']==completed
            original_id=active_id;original_record=record()
            import_world(backup)
            assert state()=={**completed,'id':active_id,'revision':0}
            assert next(r for r in records() if r['id']==original_id)==original_record
            done('buyer rounds, locked receipts, rival fleet reservations and credit ledgers survive reload and separate-slot backup import')
            assert not report['errors'],report['errors']
            report['status']='passed'
        except Exception as error:
            report['status']='failed';report['failure']=str(error)
            page.screenshot(path=str(out/'failure.png'),full_page=True)
            raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2))
            browser.close()
            if server:server.shutdown()


if __name__=='__main__':main()
