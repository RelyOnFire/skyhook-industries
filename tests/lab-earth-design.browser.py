#!/usr/bin/env python3
"""Real worker performance, paid legacy conversion, replacements and saved flights."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, quote
import json
import threading
from playwright.sync_api import sync_playwright, expect
from campaign_browser_helpers import empty_commerce
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--executable')
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    out=ROOT/'qa/browser/earth-design';out.mkdir(parents=True,exist_ok=True)
    errors=[]
    try:
        with sync_playwright() as p:
            options={'headless':True}
            if args.executable:options['executable_path']=args.executable
            browser=p.chromium.launch(**options)
            page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
            page.on('pageerror',lambda e:errors.append(str(e)))
            origin=f'http://127.0.0.1:{server.server_port}'
            def records():
                return page.evaluate("""async()=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});return await new Promise(ok=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)}})}""")
            def saved(): expect(page.get_by_text('Saved in this browser',exact=True)).to_be_visible()
            def current(): return next(r for r in records() if r['id']==old['id'])
            def review(design):
                page.goto('about:blank')
                page.goto(origin+'/lab/campaign/#earth-design='+quote(json.dumps(design)),wait_until='networkidle')
                page.get_by_role('button',name='Continue '+old['name']).click()
                expect(page.get_by_role('dialog').get_by_role('button',name='Replace Earth design',exact=True)).to_be_enabled(timeout=90000)
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            expect(page.get_by_role('button',name='Start new network',exact=True)).to_be_enabled()
            old=json.loads((ROOT/'tests/fixtures/campaign-v7.json').read_text())['state']
            # Fund this isolated test world's replacements; keep actual legacy
            # terms, services, traffic and reservations for continuity checks.
            old['ports']['earth']['materialsT']=120;old['ports']['earth']['equipmentT']=50
            original={'id':old['id'],'state':old,'savedAt':'2099-01-01T00:00:00.000Z','checkpoints':[]}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise(ok=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok});db.close()}""",original)
            page.goto(origin+'/lab/',wait_until='networkidle')
            link=page.get_by_role('link',name='Use this design in Expeditions')
            expect(link).to_be_visible(timeout=90000)
            design=json.loads(parse_qs(urlsplit(link.get_attribute('href')).fragment)['earth-design'][0])
            page.get_by_role('button',name='Mission',exact=True).click()
            page.get_by_label('Payload per delivery value',exact=True).fill('4');expect(link).to_have_count(0)
            review(design)
            dialog=page.get_by_role('dialog')
            expect(dialog).to_contain_text('earlier 20% upgrade stays active')
            expect(dialog.locator('[data-testid="design-recovery"]')).to_have_text('2 d')
            expect(dialog).to_contain_text('0 t material + 0 t equipment')
            assert current()==original,'review silently converted legacy terms'
            page.keyboard.press('Escape');assert current()==original
            heavy={**design,'payloadT':5,'areaMm2':120}
            review(heavy)
            expect(dialog.locator('[data-testid="design-capacity"]')).to_have_text('16 t')
            expect(dialog.locator('[data-testid="design-recovery"]')).to_have_text('1.5 d')
            expect(dialog.locator('[data-testid="design-fuel"]')).to_have_text('0.86×')
            expect(dialog).to_contain_text('14 t material + 4 t equipment')
            for width in [1440,768,390,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert not dialog.evaluate('d=>d.scrollWidth>d.clientWidth+1'),f'overflow {width}'
                dialog.screenshot(path=str(out/f'review-{width}.png'))
            assert current()==original
            dialog.get_by_role('button',name='Replace Earth design',exact=True).click()
            expect(dialog.get_by_text('Commissioned · Earth recovery',exact=False)).to_be_visible();saved()
            commissioned=current();world=commissioned['state']
            assert world['schema']==10 and world['revision']==old['revision']+1
            assert world['earthDesign']['version']==2 and world['earthDesign']['payloadT']==5
            assert world['ports']['earth']['materialsT']==106 and world['ports']['earth']['equipmentT']==46
            assert world['ports']['earth']['readyDay']==old['ports']['earth']['readyDay']
            assert world['flights']==[{**f,'contractId':None} for f in old['flights']]
            assert world['services']==[{**s,'contractId':None} for s in old['services']] and commissioned['checkpoints']==[old]
            assert world['commerce']==empty_commerce(old['day'])
            page.keyboard.press('Escape')
            # Manual dispatch uses the profile (remote Moon capacity is 20 t).
            page.get_by_label('Cargo (t)',exact=True).fill('16')
            page.get_by_role('radio',name='Tether corridor',exact=False).check()
            page.get_by_role('button',name='Dispatch cargo',exact=False).click();saved()
            dispatched=current()['state'];flight=dispatched['flights'][-1]
            assert flight['cargoT']==16 and flight['fuelT']<16*.35*.4
            assert abs(dispatched['ports']['earth']['readyDay']-dispatched['day']-13011.747630119324/17319.84471845627*2)<1e-7
            small={**design,'payloadT':1,'areaMm2':60}
            review(small)
            expect(dialog.locator('[data-testid="design-capacity"]')).to_have_text('3 t')
            expect(dialog).to_contain_text('34 t material + 9 t equipment')
            expect(dialog).to_contain_text('exceed the candidate corridor capacity')
            dialog.get_by_role('button',name='Replace Earth design',exact=True).click();saved()
            expect(dialog.get_by_text('Commissioned · Earth recovery',exact=False)).to_be_visible()
            replaced=current()['state'];assert replaced['ports']['earth']['materialsT']==dispatched['ports']['earth']['materialsT']-34
            assert replaced['flights']==dispatched['flights'] and replaced['services']==dispatched['services']
            assert replaced['ports']['earth']['readyDay']==dispatched['ports']['earth']['readyDay']
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            page.get_by_role('button',name='Continue '+old['name']).click()
            page.get_by_role('button',name='Lab design · commissioned').click()
            expect(dialog.locator('[data-testid="design-capacity"]')).to_have_text('3 t')
            assert current()['state']==replaced
            dialog.get_by_role('button',name='Restore standard Earth fleet',exact=True).click();saved()
            expect(dialog.get_by_role('button',name='Restore standard Earth fleet',exact=True)).to_have_count(0)
            restored=current()['state'];assert restored['earthDesign'] is None
            assert restored['ports']==replaced['ports'] and restored['flights']==replaced['flights']
            # Broken input cannot silently reuse the last accepted report.
            page.goto('about:blank')
            page.goto(origin+'/lab/campaign/#earth-design=%7B%7D',wait_until='networkidle')
            page.get_by_role('button',name='Continue '+old['name']).click()
            expect(dialog.get_by_role('alert')).to_be_visible(timeout=90000)
            expect(dialog.get_by_role('button',name='Commission Earth design',exact=True)).to_have_count(0)
            assert current()['state']==restored
            page.keyboard.press('Escape');expect(page.get_by_role('button',name='Play simulation',exact=True)).to_be_enabled()
            assert not errors,errors
            (out/'report.json').write_text(json.dumps({'status':'passed','errors':errors},indent=2))
            print('PASS real performance comparison, paid-v7 preservation/conversion, dispatch fuel/capacity, replacement, legacy credit, service warnings, unchanged transit, standard restore, reload and four widths')
            browser.close()
    finally: server.shutdown()
if __name__=='__main__':main()
