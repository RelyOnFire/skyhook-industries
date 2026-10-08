#!/usr/bin/env python3
"""Native-origin lunar Flight Studio, actual workers/WebGL and separate saves."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--require-webgl',action='store_true');parser.add_argument('--executable');args=parser.parse_args()
    out=ROOT/'qa/browser/lunar';out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    report={'checks':[],'errors':[],'webgl':False}
    def done(name): report['checks'].append(name);print('PASS',name,flush=True)
    with sync_playwright() as p:
        options={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
        if args.executable: options['executable_path']=args.executable
        else: options['channel']='chromium'
        browser=p.chromium.launch(**options)
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
        page=context.new_page();page.set_default_timeout(15000)
        context.on('page',lambda pg:pg.on('pageerror',lambda e:report['errors'].append(str(e))))
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' and re.search('shader|Shader|Program|worker failed',m.text) else None)
        def ready(target=page):
            expect(target.get_by_role('button',name='Full-run debrief',exact=True)).to_be_enabled(timeout=90000)
            expect(target.locator('.scene-pending')).to_have_count(0)
            expect(target.locator('.lab-feedback.is-error')).to_have_count(0)
        def shot(name):
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            page.screenshot(path=str(out/(name+'.png')),full_page=True)
        def tab(name):
            mobile=page.get_by_role('navigation',name='Workspace panels')
            if mobile.is_visible(): mobile.get_by_role('button',name='Design',exact=True).click()
            page.locator('.control-tabs').get_by_role('button',name=name,exact=True).click()
        def fly():
            mobile=page.get_by_role('navigation',name='Workspace panels')
            if mobile.is_visible(): mobile.get_by_role('button',name='Flight',exact=True).click()
        def world(name):
            page.get_by_role('group',name='Flight environment',exact=True).get_by_role('button',name=re.compile('^'+name)).click();ready()
            assert page.url==origin+('/lab/lunar/' if name=='Moon' else '/lab/')
        def no_overflow(): assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),page.viewport_size
        def download_report():
            page.get_by_role('button',name='Full-run debrief',exact=True).click()
            with page.expect_download() as dl: page.get_by_role('button',name='Export flight report',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        try:
            page.goto(origin+'/lab/lunar/',wait_until='networkidle');ready();no_overflow()
            expect(page.locator('.workbench-bar')).to_contain_text('L1p-0.1.0')
            report['webgl']=page.locator('.scene-three canvas').count()==1
            if args.require_webgl: assert report['webgl'],'Actual lunar WebGL must initialize'
            scene=page.locator('.scene-three' if report['webgl'] else '.scene-plane')
            expect(scene).to_have_attribute('data-body','moon')
            expect(page.get_by_role('button',name='Pause replay',exact=True)).to_have_count(0)
            if report['webgl']:
                expect(scene.locator('canvas')).to_have_attribute('aria-label',re.compile('3D Moon'))
                expect(scene.locator('.world-label:not(.cargo-label)')).to_be_visible()
                expect(scene.locator('.cargo-label').first).to_be_visible()
                before=scene.locator('canvas').screenshot();box=scene.bounding_box()
                page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
                page.mouse.down();page.mouse.move(box['x']+box['width']/2+70,box['y']+box['height']/2+30,steps=8);page.mouse.up()
                assert scene.locator('canvas').screenshot()!=before
                page.get_by_role('button',name='Reset camera',exact=True).click()
            shot('lunar-desktop');done('native lunar worker, Moon renderer, camera and reduced-motion pause')
            flight=download_report()
            assert flight['model']=='L1p-0.1.0' and flight['outcome']=='complete'
            assert flight['environment']=={'body':'Moon','meanRadiusM':1737400,'muM3s2':4.902800118e12,'clearanceCutoffM':10000}
            assert len(flight['deliveries'])==2 and all(d['perigee']>10000 for d in flight['deliveries'])
            assert 0<flight['propellantUsedKg']<10000 and len(flight['rendezvous'])==2
            assert all(c['accepted'] for c in flight['rendezvous'])
            page.get_by_role('button',name='Pin this flight',exact=True).click();shot('lunar-debrief');page.keyboard.press('Escape')
            done('exported two-delivery evidence identifies lunar gravity, clearance and finite propellant')
            page.get_by_role('button',name='Guided replay',exact=True).click()
            expect(page.locator('.guided-replay')).to_contain_text('A rotating facility above the Moon.')
            page.get_by_role('button',name='Next checkpoint →',exact=True).click()
            expect(page.locator('[data-object-id="payload-1"]')).to_have_attribute('data-phase','attached')
            page.get_by_role('button',name='End guide',exact=True).click()
            page.locator('.timeline-events').get_by_role('button',name=re.compile('Payload 2 · approach')).click()
            page.get_by_role('button',name='Select Payload 2',exact=True).click()
            page.locator('.view-switch').get_by_role('button',name='Follow',exact=True).click()
            expect(scene).to_have_attribute('data-follow-target','payload-2')
            expect(page.locator('[data-object-id="payload-1"]')).to_have_attribute('data-phase','released')
            page.get_by_role('button',name='Next mission event',exact=True).click()
            expect(page.locator('[data-object-id="payload-2"]')).to_have_attribute('data-phase','attached')
            shot('lunar-second-capture')
            page.locator('.view-switch').get_by_role('button',name='Structure',exact=True).click()
            inspector=page.get_by_role('region',name='Tether structural inspector');expect(inspector).to_be_visible()
            slider=page.get_by_role('slider',name='Inspected tether section',exact=True);slider.focus();slider.press('End')
            assert int(slider.input_value())>0 and 'NaN' not in inspector.inner_text()
            page.locator('.view-switch').get_by_role('button',name='Orbit plane',exact=True).click()
            expect(page.locator('.scene-plane')).to_have_attribute('data-body','moon');shot('lunar-plane')
            done('lunar guided handoffs, distinct shipments, follow target, load inspector and plane view')
            page.get_by_role('button',name='Flight school',exact=True).click()
            expect(page.locator('.mission-choice')).to_have_count(1);page.locator('.mission-choice').click()
            expect(page.locator('.brief-rules')).to_contain_text('perigee above 10 km')
            page.get_by_role('button',name=re.compile('Start this mission')).click();ready()
            expect(page.locator('.recorder-insight')).to_contain_text('model boundary')
            tab('Recovery');expect(page.get_by_role('button',name=re.compile('^Electrodynamic'))).to_have_count(0)
            page.get_by_role('button',name=re.compile('^Chemical')).click()
            expect(page.get_by_role('spinbutton',name='Propellant budget value',exact=True)).to_have_value('10')
            page.locator('.run-design').click();ready();expect(page.locator('.mission-passed')).to_have_count(1)
            page.get_by_role('button',name='Check objectives',exact=True).click()
            expect(page.locator('.objective-list .gate-open')).to_have_count(0);shot('lunar-mission-passed');page.keyboard.press('Escape')
            page.get_by_role('button',name='Leave challenge for sandbox',exact=True).click()
            done('lunar mission fails without recovery and passes after a finite-fuel chemical run')
            page.get_by_role('button',name='Trade study',exact=True).click()
            expect(page.get_by_role('option',name='Electrical power cap',exact=True)).to_have_count(0)
            page.get_by_role('button',name='Run 2 variants →',exact=True).click()
            expect(page.locator('.study-status')).to_contain_text('Study complete',timeout=180000)
            expect(page.locator('.study-table tbody tr')).to_have_count(2);shot('lunar-study')
            page.locator('.study-table tbody tr').first.get_by_role('button').click()
            page.get_by_role('button',name='Full-run debrief',exact=True).click()
            expect(page.locator('.debrief-comparison')).to_be_visible();page.keyboard.press('Escape')
            done('two actual lunar recovery simulations and pinned full-flight comparison')
            # Save each environment through the real UI; changing bodies must clear old comparisons.
            world('Earth');tab('Recovery')
            page.get_by_role('spinbutton',name='Propellant budget value',exact=True).fill('17')
            page.get_by_role('button',name='Save',exact=True).click()
            earth_saved=page.evaluate("localStorage.getItem('skyhook-lab-design-v2')")
            world('Moon');tab('Recovery')
            page.get_by_role('spinbutton',name='Propellant budget value',exact=True).fill('9')
            page.get_by_role('button',name='Save',exact=True).click()
            moon_saved=page.evaluate("localStorage.getItem('skyhook-lab-lunar-design-v1')")
            assert json.loads(moon_saved)['fuelT']==9
            world('Earth');page.get_by_role('button',name='Load',exact=True).click();ready();tab('Recovery')
            expect(page.get_by_role('spinbutton',name='Propellant budget value',exact=True)).to_have_value('17')
            world('Moon');page.get_by_role('button',name='Load',exact=True).click();ready();tab('Recovery')
            expect(page.get_by_role('spinbutton',name='Propellant budget value',exact=True)).to_have_value('9')
            assert page.evaluate("localStorage.getItem('skyhook-lab-design-v2')")==earth_saved
            page.get_by_role('button',name='Full-run debrief',exact=True).click()
            expect(page.locator('.debrief-comparison')).to_have_count(0);page.keyboard.press('Escape')
            done('separate Earth/Moon Save and Load preserve each design and clear cross-world results')
            page.get_by_role('button',name=re.compile('^Share design')).click()
            shared=page.get_by_role('textbox',name='Shareable design link',exact=True).input_value()
            assert '/lab/lunar/#d=' in shared
            page.goto(shared,wait_until='networkidle');ready();tab('Recovery')
            expect(page.get_by_role('spinbutton',name='Propellant budget value',exact=True)).to_have_value('9')
            assert 'lunar-relay' in page.evaluate("JSON.parse(localStorage.getItem('tether-lab-missions-v1'))")
            with page.expect_download() as dl: page.get_by_role('button',name='Export JSON',exact=True).click()
            assert dl.value.suggested_filename=='skyhook-lunar-design.json'
            exported=Path(dl.value.path()).read_bytes();assert json.loads(exported)['model']=='L1p-0.1.0'
            world('Earth')
            page.reload(wait_until='networkidle');ready()
            expect(page.locator('.workbench-bar')).to_contain_text('EARTH / SINGLE-STAGE ROTOVATOR')
            page.locator('input[type=file]').set_input_files({'name':'moon.json','mimeType':'application/json','buffer':exported});ready()
            expect(page.locator('.workbench-bar')).to_contain_text('MOON / LUNAR ROTOVATOR')
            assert page.url==origin+'/lab/lunar/'
            bad=json.loads(exported);bad['recovery']='electrodynamic';bad['fuelT']=0
            page.locator('input[type=file]').set_input_files({'name':'wrong-world.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
            expect(page.locator('.lab-feedback.is-error')).to_contain_text('Earth E0')
            assert page.evaluate("localStorage.getItem('skyhook-lab-lunar-design-v1')")==moon_saved
            done('lunar share reload, portable import/export, local mission progress and wrong-world rejection')
            page.goto(origin+'/lab/lunar/',wait_until='networkidle');ready()
            page.locator('.experiment-strip').get_by_role('button',name=re.compile('Too close')).click();ready()
            expect(page.locator('.recorder-insight')).to_contain_text('model boundary')
            page.locator('.experiment-strip').get_by_role('button',name=re.compile('Load limit')).click();ready()
            expect(page.locator('.recorder-insight')).to_contain_text('load margin')
            page.locator('.experiment-strip').get_by_role('button',name=re.compile('Lunar relay')).click();ready()
            for width,height in [(1440,1000),(1280,800),(1000,900),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height});fly();no_overflow()
                expect(page.get_by_role('button',name='Full-run debrief',exact=True)).to_be_visible()
                assert page.locator('.transport').evaluate('''e=>{const p=e.closest('.flight-console').getBoundingClientRect();return [...e.querySelectorAll('button,select,.mission-clock')].every(c=>{const r=c.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom})}''')
                if report['webgl']:
                    expect(page.locator('.scene-three>.cargo-label').first).to_be_visible()
                shot(f'lunar-{width}')
                page.get_by_role('button',name='Flight school',exact=True).click();no_overflow()
                page.keyboard.press('Tab');assert page.evaluate("!!document.activeElement.closest('dialog')")
                shot(f'lunar-mission-{width}');page.keyboard.press('Escape')
                tab('Mission');expect(page.get_by_role('spinbutton',name='Initial circular altitude value',exact=True)).to_have_attribute('min','80')
                no_overflow()
            done('clearance/load failure presets and six responsive widths with visible replay controls')
            page.set_viewport_size({'width':1440,'height':1000})
            page.goto(origin+'/lab/campaign/',wait_until='networkidle')
            page.get_by_label('Name your network',exact=True).fill('Lunar studio link')
            page.get_by_role('button',name='Start new network',exact=True).click()
            expect(page.get_by_text('Saved in this browser',exact=True)).to_be_visible()
            get_records="""async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return new Promise((ok,no)=>{const r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}"""
            before=page.evaluate(get_records)
            link=page.locator('#outpost-moon').get_by_role('link',name=re.compile('Explore the lunar tether'))
            expect(link).to_have_attribute('href','/lab/lunar/');expect(link).to_have_attribute('target','_blank')
            with page.expect_popup() as popup: link.click()
            lunar=popup.value;ready(lunar);assert lunar.url==origin+'/lab/lunar/'
            assert page.evaluate(get_records)==before;lunar.close();shot('campaign-link')
            done('campaign Moon opens a working lunar Studio without changing its saved world')
            static=browser.new_context(java_script_enabled=False)
            guide=static.new_page()
            for path in ['/lab/lunar/method/','/lab/architectures/']:
                for width in [1440,390,320]:
                    guide.set_viewport_size({'width':width,'height':900});guide.goto(origin+path)
                    assert guide.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                    if 'lunar' in path: expect(guide.locator('#sources')).to_contain_text('1,737.4 km')
                    else: expect(guide.get_by_role('link',name='Open the Moon experiment →',exact=True)).to_have_count(1)
                    guide.screenshot(path=str(out/f'{"method" if "lunar" in path else "catalogue"}-{width}.png'),full_page=True)
            static.close();done('lunar method and architecture catalogue readable without JavaScript at three widths')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);shot('failure');raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()

if __name__=='__main__': main()
