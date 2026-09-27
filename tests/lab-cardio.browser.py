#!/usr/bin/env python3
"""CardioRotovator actual worker, independent storage and responsive replay."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}';out=ROOT/'qa/browser/cardio';out.mkdir(parents=True,exist_ok=True)
    errors=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(origin+'/lab/cardio/',wait_until='networkidle')
            run=page.get_by_role('button',name='Compare pickup',exact=True)
            expect(run).to_be_enabled(timeout=90000)
            expect(page.get_by_test_id('cardio-empty-status')).to_have_text('One nominal orbit completed')
            expect(page.get_by_test_id('cardio-loaded-status')).to_have_text('One nominal orbit completed')
            page.evaluate("localStorage.setItem('skyhook-lab-design-v2','earth-kept');localStorage.setItem('skyhook-lab-t4-design-v1','t4-kept')")
            slider=page.get_by_role('slider',name='CardioRotovator replay time',exact=True)
            before=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==before
            page.get_by_role('button',name='Play CardioRotovator replay').click();page.wait_for_timeout(200)
            page.get_by_role('button',name='Pause CardioRotovator replay').click();assert float(slider.input_value())>0
            stopped=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==stopped
            slider.fill('1000');expect(page.locator('.cardio-scene')).to_have_attribute('data-time','1000.00')
            page.get_by_role('button',name='Empty coast',exact=True).click();expect(slider).to_have_value('0')
            page.get_by_label('Reference path',exact=True).uncheck()
            page.get_by_role('button',name='After pickup',exact=True).click()
            for width in [1440,1000,768,390,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'overflow {width}'
                page.screenshot(path=str(out/f'studio-{width}.png'),full_page=True)
            page.get_by_role('button',name='Save',exact=True).click()
            raw=page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')");saved=json.loads(raw);assert saved['architecture']=='cardiorotovator'
            phase=page.get_by_label('Apogee phase offset value',exact=True)
            phase.fill('15');expect(page.get_by_text('Inputs changed.',exact=False)).to_be_visible();expect(page.get_by_role('button',name='Play CardioRotovator replay')).to_be_disabled()
            page.get_by_role('button',name='Load',exact=True).click();expect(run).to_be_enabled(timeout=90000);expect(phase).to_have_value('0')
            initial_change=page.locator('.cardio-summary strong').nth(1).inner_text()
            page.get_by_label('Matched payload value',exact=True).fill('100');run.click();expect(run).to_be_enabled(timeout=90000)
            assert page.locator('.cardio-summary strong').nth(1).inner_text()!=initial_change
            # Save/share the actual changed inputs and replay them through a reload.
            page.get_by_role('button',name='Share design',exact=False).click()
            expect(page.get_by_label('Shareable design')).to_be_visible()
            shared=page.url;assert '#cardio=' in shared
            page.reload(wait_until='networkidle');expect(run).to_be_enabled(timeout=90000)
            expect(page.get_by_label('Matched payload value',exact=True)).to_have_value('100')
            assert page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")==raw
            page.get_by_label('Matched payload value',exact=True).fill('');expect(run).to_be_disabled()
            page.get_by_role('combobox',name='Distance unit').select_option('m');expect(run).to_be_enabled()
            expect(page.get_by_label('Station-to-tip length value',exact=True)).to_have_value('800000')
            page.get_by_role('combobox',name='Distance unit').select_option('km')
            page.get_by_label('Initial COM perigee value',exact=True).fill('1900');expect(run).to_be_disabled()
            expect(page.get_by_text('Apogee must be above perigee.',exact=True)).to_be_visible()
            page.get_by_role('button',name='Reference scenario',exact=True).click();expect(run).to_be_enabled(timeout=90000)
            page.get_by_label('Initial COM perigee value',exact=True).fill('700');page.get_by_label('Initial COM apogee value',exact=True).fill('1300');run.click();expect(run).to_be_enabled(timeout=90000)
            expect(page.get_by_test_id('cardio-loaded-status')).to_have_text('Stopped at the 120 km cutoff')
            page.get_by_text('Numerical accounting & report',exact=True).click()
            with page.expect_download() as info:page.get_by_role('button',name='Export comparison report').click()
            path=out/'report-download.json';info.value.save_as(path);report=json.loads(path.read_text());assert report['loaded']['status']=='clearance'
            assert abs(report['loaded']['minClearance']-120000)<.1
            # Superseded/closed workers must not replace a result after cancellation.
            page.evaluate("""()=>{const run=[...document.querySelectorAll('button')].find(b=>b.textContent==='Compare pickup');run.click();setTimeout(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel calculation')?.click(),0)}""")
            expect(page.get_by_text('Calculation cancelled.',exact=True)).to_be_visible(timeout=10000)
            expect(run).to_be_enabled()
            bad=out/'wrong-design.json';bad.write_text(json.dumps({'schema':2,'architecture':'single-stage-rotovator','model':'D1p-0.4.0'}))
            page.locator('input[type=file]').set_input_files(str(bad));expect(page.get_by_role('alert')).to_contain_text('CardioRotovator designs only')
            assert page.evaluate("localStorage.getItem('skyhook-lab-design-v2')")=='earth-kept'
            assert page.evaluate("localStorage.getItem('skyhook-lab-t4-design-v1')")=='t4-kept'
            assert await_free_databases(page)==[],'Cardio opened a campaign database'
            page.goto(origin+'/lab/architectures/',wait_until='networkidle')
            page.get_by_role('link',name='Open the CardioRotovator experiment').click();expect(run).to_be_enabled(timeout=90000)
            nojs=browser.new_context(java_script_enabled=False,viewport={'width':320,'height':800});guide=nojs.new_page();guide.goto(origin+'/lab/cardio/method/')
            expect(guide.get_by_role('heading',name='A long arm needs the right phase.')).to_be_visible()
            assert guide.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert not errors,errors
            (out/'report.json').write_text(json.dumps({'status':'passed','errors':errors},indent=2))
            print('PASS Cardio worker, replay, limit stop, phase/payload editing, isolated save/share/import, display units, cancellation, report, catalogue and five widths')
            browser.close()
    finally:server.shutdown()
def await_free_databases(page):return page.evaluate('indexedDB.databases()')
if __name__=='__main__':main()
