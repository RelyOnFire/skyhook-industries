#!/usr/bin/env python3
"""Customer freight uses real logistics, persistent credits and explicit recipients."""
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
    out = ROOT/'qa/browser/campaign-contracts'
    out.mkdir(parents=True, exist_ok=True)
    server = None
    if args.origin:
        origin = args.origin.rstrip('/')
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT/'dist')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}'
    report = {'origin': origin, 'checks': [], 'errors': []}

    # Separate test worlds only. The first keeps accounting easy to inspect; the
    # second retains a real mature network's water/mirror ledger and unlocks.
    prepared = subprocess.run(['node', '--input-type=module', '-e', """
      import {readFileSync} from 'node:fs';
      import {createCampaign,validateCampaign,exportCampaign,advance,contractQuote} from './.lab-test/campaign/model.js';
      const clean=createCampaign('contracts-prepared','Contract proving ground');
      clean.ports.earth.level=3;clean.fuelT=10000;
      Object.assign(clean.ports.moon,{level:3,industry:true,materialsT:1000,equipmentT:100});
      Object.assign(clean.ports.phobos,{level:3,materialsT:100,equipmentT:100});
      let industrial=validateCampaign(JSON.parse(readFileSync('tests/fixtures/campaign-v5.json','utf8')).state);
      industrial.services.forEach(s=>s.enabled=false);
      industrial.solar.autoLaunch=false;industrial.solar.nextLaunchDay=null;
      industrial=advance(industrial,1000);
      industrial.id='contracts-industrial';industrial.name='Industrial contract horizon';industrial.revision=0;
      industrial.ports.moon.materialsT=10000;industrial.ports.moon.equipmentT=1000;industrial.fuelT=10000;
      // Wait for enough open buyer demand for this industrial test order.
      for(let rounds=0;contractQuote(industrial,'mars-build','industrial').reason&&rounds<8;rounds++)
        industrial=advance(industrial,industrial.commerce.market.nextReviewDay-industrial.day);
      if(contractQuote(industrial,'mars-build','industrial').reason)throw Error('Industrial fixture has no available Mars order.');
      console.log(JSON.stringify({clean:JSON.parse(exportCampaign(validateCampaign(clean))),
        industrial:JSON.parse(exportCampaign(validateCampaign(industrial))),
        lunar:contractQuote(clean,'lunar-return','standard'),mars:contractQuote(industrial,'mars-build','industrial')}));
    """], cwd=ROOT, text=True, capture_output=True, check=True)
    fixtures = json.loads(prepared.stdout)
    for kind in ['clean', 'industrial']:
        (out/f'{kind}-world.json').write_text(json.dumps(fixtures[kind], indent=2))

    def done(name):
        report['checks'].append(name)
        print('PASS', name, flush=True)

    def near(a, b): assert abs(a-b) < 1e-6, f'{a} != {b}'

    with sync_playwright() as p:
        options = {'headless': True}
        if args.executable: options['executable_path'] = args.executable
        else: options['channel'] = 'chromium'
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        active_id = None

        def records():
            return page.evaluate("""async()=>{const db=await new Promise((ok,no)=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return await new Promise((ok,no)=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}""")
        def record(): return next(r for r in records() if r['id']==active_id)
        def state(): return record()['state']
        def saved(): expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        def action(name, scope=None):
            (scope or page).get_by_role('button', name=name, exact=True).click()
            saved()
        def close_saves():
            details = page.locator('.campaign-save-manager')
            if details.get_attribute('open') is not None: details.locator('summary').click()
        def import_world(path):
            nonlocal active_id
            previous_ids = {r['id'] for r in records()}
            page.locator('input[type=file]').set_input_files(str(path))
            saved()
            active_id = next(r['id'] for r in records() if r['id'] not in previous_ids)
            close_saves()
            dismiss = page.get_by_role('button', name='Dismiss message', exact=True)
            if dismiss.count(): dismiss.click()
        def geometry():
            return page.evaluate("""()=>({
              map:document.querySelector('.network-map').getBoundingClientRect().height,
              inspector:document.querySelector('#flight-inspector').getBoundingClientRect().height,
              services:document.querySelector('.campaign-schedules').getBoundingClientRect().top-document.querySelector('.ops-traffic').getBoundingClientRect().top
            })""")
        def offers_open():
            details = page.locator('.contract-offers')
            if details.get_attribute('open') is None: details.locator(':scope > summary').click()
        def offer(offer_id): return page.locator('[data-offer="'+offer_id+'"]')
        def buy_materials(amount):
            procurement = page.locator('.contract-procurement')
            if procurement.get_attribute('open') is None: procurement.locator('summary').click()
            procurement.get_by_label('Procurement resource', exact=True).select_option('materials')
            procurement.get_by_label('Purchase amount (t)', exact=True).fill(str(amount))
            return procurement

        try:
            page.goto(origin+'/lab/campaign/', wait_until='networkidle')
            expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
            import_world(out/'clean-world.json')
            panel = page.locator('#contracts')
            expect(panel).to_be_visible()
            before = record()
            offers_open()
            lunar = offer('lunar-return')
            expect(lunar).to_contain_text('Terran Orbital Works')
            expect(lunar).to_contain_text('30 t')
            expect(lunar).to_contain_text('150')
            assert record()==before, 'Reading contract terms mutated the world'
            stable = geometry()
            action('Accept contract', lunar)
            accepted = state()
            contract = accepted['commerce']['contracts'][0]
            assert contract['offerId']=='lunar-return' and contract['quantityT']==30 and contract['status']=='active'
            near(contract['dueDay'], fixtures['lunar']['dueDay'])
            assert accepted['commerce']['credits']==0 and accepted['ports']==before['state']['ports']
            assert accepted['day']==before['state']['day'] and accepted['flights']==before['state']['flights']
            assert geometry()==stable, 'Accepting a contract moved the map, inspector or services'
            done('accepted customer terms are visible, exact and saved without spending depot stock or advancing time')

            frozen = record()
            action('Prepare shipment', panel)
            recipient = page.get_by_label('Cargo recipient', exact=True)
            expect(recipient).to_have_value(str(contract['id']))
            expect(page.get_by_label('From', exact=True)).to_have_value('moon')
            expect(page.get_by_label('To', exact=True)).to_have_value('earth')
            expect(page.locator('.dispatch-contract')).to_contain_text('Terran Orbital Works')
            assert record()==frozen, 'Preparing customer freight saved or dispatched it'
            recipient.select_option('depot')
            page.get_by_label('Cargo (t)', exact=True).fill('1')
            page.get_by_role('radio', name='Bootstrap tug').check()
            action('Dispatch cargo')
            assert state()['flights'][-1]['contractId'] is None
            assert state()['commerce']==accepted['commerce'], 'Ordinary depot freight was assigned to a customer'
            action('Prepare shipment', panel)
            page.get_by_label('Cargo (t)', exact=True).fill('9')
            page.get_by_role('radio', name='Bootstrap tug').check()
            page.get_by_label('Simulation speed', exact=True).select_option('1')
            action('Play simulation')
            action('Dispatch cargo')
            expect(page.get_by_role('button', name='Pause simulation', exact=True)).to_be_enabled()
            action('Pause simulation')
            assert state()['flights'][-1]['contractId']==contract['id']
            assert state()['flights'][-1]['cargoT']==9
            assert state()['commerce']['contracts'][0]['deliveredT']==0
            expect(page.locator('#outpost-earth .outpost-inbound')).to_contain_text('1 t material · 0 t equipment')
            expect(page.locator('#outpost-earth .outpost-stock dd').nth(2)).to_have_text('1 t')
            done('customer preparation is read-only; explicit recipient tags separate depot freight and dispatch preserves Play')

            page.get_by_label('Cargo (t)', exact=True).fill('8')
            page.get_by_label('Repeat every (simulation days)', exact=True).fill('2')
            preview = page.get_by_role('region', name='New service preview', exact=True)
            preview.get_by_label('Service preview horizon', exact=True).select_option('contract')
            frozen = record()
            action('Preview service', preview)
            expect(preview.locator('.service-preview-result')).to_be_visible()
            assert record()==frozen, 'Contract service forecast changed saved state or history'
            recipient.select_option('depot')
            expect(preview.get_by_label('Service preview horizon',exact=True)).to_have_value('365')
            action('Preview service',preview)
            expect(preview.locator('.service-preview-date')).to_contain_text('· 365 days')
            recipient.select_option(str(contract['id']))
            preview.get_by_label('Service preview horizon',exact=True).select_option('contract')
            action('Preview service',preview)
            assert record()==frozen, 'Switching forecast recipients changed the saved world'
            action('Schedule service')
            service = state()['services'][-1]
            assert service['contractId']==contract['id'] and service['cargoT']==8 and service['intervalDays']==2
            page.locator('.network-outlook>summary').click()
            page.get_by_label('Forecast horizon', exact=True).select_option('contract')
            frozen = record()
            expect(page.locator('.outlook-body')).to_contain_text('150')
            assert record()==frozen
            page.locator('.network-outlook>summary').click()
            done('deadline forecasts preserve saves and recurring services keep an explicit customer assignment')

            buy_materials(2)
            frozen = record()
            for width, height in [(1440,1000),(1366,768),(768,1024),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                page.evaluate('document.activeElement?.blur()')
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'), f'Contract controls overflow at {width}'
                panel.screenshot(path=str(out/f'contract-active-{width}.png'),style='.campaign-clock{visibility:hidden!important}')
                page.locator('.campaign-dispatch').screenshot(path=str(out/f'contract-dispatch-{width}.png'),style='.campaign-clock{visibility:hidden!important}')
                if width==320:
                    expect(page.get_by_role('link',name='Contracts',exact=True)).to_be_visible()
            assert record()==frozen
            page.set_viewport_size({'width':1440,'height':1000})
            done('contract terms, recipient and procurement surfaces fit desktop, laptop, tablet and 320 px phone without mutating saves')

            action('+30 days')
            completed = state()
            receipt = completed['commerce']['contracts'][0]
            page.locator('.network-outlook>summary').click()
            expect(page.get_by_label('Forecast horizon',exact=True)).to_have_value('90')
            page.locator('.network-outlook>summary').click()
            assert receipt['status']=='completed' and receipt['deliveredT']==30 and receipt['earnedCredits']==150
            assert completed['commerce']['credits']==150 and completed['commerce']['earnedCredits']==150
            final_service = next(s for s in completed['services'] if s['id']==service['id'])
            assert final_service['dispatched']==3 and not final_service['enabled']
            near(final_service['deliveredT'],21)
            expect(page.get_by_role('button',name='Resume service '+str(service['id']),exact=True)).to_be_disabled()
            near(completed['ports']['earth']['materialsT'],before['state']['ports']['earth']['materialsT']+1)
            near(completed['ports']['earth']['receivedT'],before['state']['ports']['earth']['receivedT']+1)
            near(completed['lunarReturnedT'],before['state']['lunarReturnedT']+1)
            assert any('5 t' in entry['text'] for entry in completed['log']), 'The final recurring departure was not clamped to 5 t'
            expect(panel).to_contain_text('Completed')
            done('three recurring loads finish with a 5 t batch; customer goods earn 150 credits once without filling player depots or milestones')

            procurement = buy_materials(2)
            prior = state()
            action('Play simulation')
            action('Buy supplies', procurement)
            expect(page.get_by_role('button', name='Pause simulation', exact=True)).to_be_enabled()
            action('Pause simulation')
            purchased = state()
            near(purchased['ports']['earth']['materialsT'],prior['ports']['earth']['materialsT']+2)
            assert purchased['commerce']['credits']==126 and purchased['commerce']['spentCredits']==24
            assert purchased['commerce']['earnedCredits']==150
            done('earned credits buy real Earth supplies at quoted prices and purchases preserve Play')

            procurement = buy_materials(1)
            frozen = record()
            page.evaluate("""()=>{window.originalContractPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('contracts test full','QuotaExceededError')};}""")
            procurement.get_by_role('button',name='Buy supplies',exact=True).click()
            expect(page.get_by_role('alert')).to_contain_text('Could not save')
            expect(page.get_by_text('Not saved — download a backup',exact=True)).to_be_visible()
            assert record()==frozen, 'A failed purchase overwrote committed credits or stock'
            page.evaluate('()=>{IDBObjectStore.prototype.put=window.originalContractPut;}')
            action('Retry save')
            retried = state()
            assert retried['commerce']['credits']==114 and retried['commerce']['spentCredits']==36
            near(retried['ports']['earth']['materialsT'],frozen['state']['ports']['earth']['materialsT']+1)
            report['errors']=[e for e in report['errors'] if 'contracts test full' not in e]
            done('failed purchase preserves committed balances and retry applies the single purchase once')

            page.reload(wait_until='networkidle')
            page.get_by_role('button',name='Continue Contract proving ground',exact=False).click()
            saved()
            assert state()==retried
            action('Your saves')
            with page.expect_download() as event: page.get_by_role('button',name='Download backup',exact=True).click()
            backup = out/'contracts-backup.json'
            event.value.save_as(backup)
            exported = json.loads(backup.read_text())
            assert exported['version']==10 and exported['state']==retried
            original_id = active_id
            original_record = record()
            import_world(backup)
            copy = state()
            assert copy=={**retried,'id':active_id,'revision':0}
            assert next(r for r in records() if r['id']==original_id)==original_record
            done('contract receipt, credit ledger and service tags survive reload and separate-slot backup import')

            offers_open()
            action('Accept contract',offer('mars-build'))
            active = state()['commerce']['contracts'][-1]
            action('Prepare shipment',panel)
            page.get_by_label('Cargo (t)',exact=True).fill('10')
            page.get_by_role('radio',name='Bootstrap tug').check()
            action('Dispatch cargo')
            before_cancel = state()
            panel.locator('.contract-active .contract-active-terms>summary').click()
            action('Cancel contract',panel)
            cancelled = state()
            assert cancelled['commerce']['contracts'][-1]['status']=='cancelled'
            assert cancelled['flights']==before_cancel['flights']
            assert cancelled['commerce']['credits']==before_cancel['commerce']['credits']
            for _ in range(9): action('+30 days')
            returned = state()
            assert not any(f['contractId']==active['id'] for f in returned['flights'])
            near(returned['ports']['phobos']['materialsT'],before_cancel['ports']['phobos']['materialsT']+10)
            assert returned['commerce']['credits']==cancelled['commerce']['credits']
            done('cancelled customer cargo remains in flight and later becomes ordinary destination stock without a customer reward')

            import_world(out/'industrial-world.json')
            offers_open()
            mars = offer('mars-build')
            mars.get_by_label('Order size',exact=True).select_option('industrial')
            action('Accept contract',mars)
            industrial = state()
            contract = industrial['commerce']['contracts'][0]
            assert contract['quantityT']==300 and contract['dueDay']-industrial['day']>365
            action('Prepare shipment',panel)
            page.get_by_label('Cargo (t)',exact=True).fill('10')
            page.get_by_label('Repeat every (simulation days)',exact=True).fill('2')
            page.get_by_role('radio',name='Bootstrap tug').check()
            preview.get_by_label('Service preview horizon',exact=True).select_option('contract')
            frozen = record()
            action('Preview service',preview)
            expect(preview.locator('.service-preview-result')).to_be_visible()
            assert record()==frozen
            page.locator('.network-outlook>summary').click()
            page.get_by_label('Forecast horizon',exact=True).select_option('contract')
            expect(page.locator('.outlook-body')).to_contain_text(f"Day {contract['dueDay']:,.1f}")
            assert record()==frozen, 'Long deadline horizon advanced the actual world'
            panel.screenshot(path=str(out/'industrial-contract.png'),style='.campaign-clock{visibility:hidden!important}')
            done('industrial contracts forecast through an exact delivery deadline beyond the normal 365-day horizon')
            assert not report['errors'], report['errors']
            report['status']='passed'
        except Exception as error:
            report['status']='failed'
            report['failure']=str(error)
            page.screenshot(path=str(out/'failure.png'),full_page=True)
            raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2))
            browser.close()
            if server: server.shutdown()


if __name__=='__main__': main()
