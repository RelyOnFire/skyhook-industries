#!/usr/bin/env python3
"""Real Lab → campaign worker → optional commissioning, with native v6 continuity."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    out=ROOT/'qa/browser/earth-design';out.mkdir(parents=True,exist_ok=True)
    errors=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
            page.on('pageerror',lambda e:errors.append(str(e)))
            origin=f'http://127.0.0.1:{server.server_port}'
            def records():
                return page.evaluate("""async()=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});return await new Promise(ok=>{let r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)}})}""")
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            expect(page.get_by_role('button',name='Start new network',exact=True)).to_be_enabled()
            old=json.loads((ROOT/'tests/fixtures/campaign-v6.json').read_text())['state']
            # Enough stocks for the one paid commission; reservations and all
            # traffic remain those of the schema-6 migration fixture.
            old['ports']['earth']['materialsT']=100
            old['ports']['earth']['equipmentT']=30
            original={'id':old['id'],'state':old,'savedAt':'2099-01-01T00:00:00.000Z','checkpoints':[]}
            page.evaluate("""async record=>{const db=await new Promise(ok=>{let r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result)});await new Promise(ok=>{let t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(record);t.oncomplete=ok});db.close()}""",original)
            page.goto(origin+'/lab/',wait_until='networkidle')
            link=page.get_by_role('link',name='Use this design in Expeditions')
            expect(link).to_be_visible(timeout=90000)
            href=link.get_attribute('href')
            # A changed input cannot transfer the previous result.
            page.get_by_role('button',name='Mission',exact=True).click()
            page.get_by_label('Payload per delivery value',exact=True).fill('4')
            expect(link).to_have_count(0)
            page.goto(origin+href,wait_until='networkidle')
            expect(page.get_by_text('A Flight Studio design is ready to review.',exact=False)).to_be_visible()
            page.get_by_role('button',name='Continue '+old['name']).click()
            dialog=page.get_by_role('dialog')
            button=dialog.get_by_role('button',name='Commission Earth design',exact=True)
            expect(button).to_be_enabled(timeout=90000)
            expect(dialog).to_contain_text('Two successful deliveries')
            assert records()==[original], 'Review wrote the native schema-6 save'
            for width in [1440,768,390,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert not dialog.evaluate('d=>d.scrollWidth>d.clientWidth+1'),f'overflow {width}'
                dialog.screenshot(path=str(out/f'review-{width}.png'))
            page.keyboard.press('Escape');expect(dialog).to_have_count(0)
            assert records()==[original]
            page.get_by_role('button',name='Earth design · Flight Studio').click()
            expect(button).to_be_enabled(timeout=90000)
            button.click()
            expect(dialog.get_by_text('Commissioned · Earth recovery',exact=False)).to_be_visible()
            expect(page.get_by_text('Saved in this browser',exact=True)).to_be_visible()
            saved=records()[0];world=saved['state']
            assert world['schema']==7 and world['revision']==old['revision']+1
            assert world['earthDesign']['payloadT']==3
            assert world['ports']['earth']['materialsT']==60 and world['ports']['earth']['equipmentT']==20
            assert world['ports']['earth']['readyDay']==old['ports']['earth']['readyDay']
            assert world['flights']==old['flights'] and world['services']==old['services']
            assert saved['checkpoints']==[old]
            expect(button).to_have_count(0)
            dialog.screenshot(path=str(out/'commissioned-mobile.png'))
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            page.get_by_role('button',name='Continue '+old['name']).click()
            page.get_by_role('button',name='Lab design · commissioned').click()
            expect(dialog).to_contain_text('Two successful deliveries')
            assert records()==[saved]
            # Malformed handoff cannot write, grant an upgrade, or block play.
            page.goto('about:blank')
            page.goto(origin+'/lab/campaign/#earth-design=%7B%7D',wait_until='networkidle')
            page.get_by_role('button',name='Start new network',exact=True).click()
            expect(dialog.get_by_role('alert')).to_be_visible(timeout=90000)
            expect(button).to_be_disabled()
            assert records()[0 if records()[0]['id']!=old['id'] else 1]['state']['earthDesign'] is None
            page.keyboard.press('Escape')
            expect(page.get_by_role('button',name='Play simulation',exact=True)).to_be_enabled()
            assert not errors,errors
            (out/'report.json').write_text(json.dumps({'status':'passed','errors':errors},indent=2))
            print('PASS Earth Lab transfer, worker recheck, v6 read-only review, paid commission, checkpoints, reload, invalid handoff and four widths')
            browser.close()
    finally: server.shutdown()
if __name__=='__main__':main()
