#!/usr/bin/env python3
"""Native-origin P1 worker, WebGL, genuine failure/success and isolated persistence."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--require-webgl',action='store_true');parser.add_argument('--executable');parser.add_argument('--origin');args=parser.parse_args()
    out=ROOT/'qa/browser/phobos';out.mkdir(parents=True,exist_ok=True)
    server=None
    if args.origin: origin=args.origin.rstrip('/')
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'dist')))
        threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
    report={'checks':[],'errors':[],'webgl':False,'origin':origin}
    def done(name): report['checks'].append(name);print('PASS',name,flush=True)
    with sync_playwright() as p:
        options={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
        if args.executable: options['executable_path']=args.executable
        else: options['channel']='chromium'
        browser=p.chromium.launch(**options)
        context=browser.new_context(viewport={'width':1440,'height':1050},reduced_motion='reduce',accept_downloads=True)
        context.on('page',lambda pg:pg.on('pageerror',lambda e:report['errors'].append(str(e))))
        page=context.new_page();page.set_default_timeout(20000);page.set_default_navigation_timeout(60000)
        def ready(pg=page):
            expect(pg.get_by_role('button',name='Run release →',exact=True)).to_be_enabled()
            expect(pg.get_by_role('button',name='Export flight report ↗',exact=True)).to_be_visible()
            expect(pg.locator('.phobos-flight')).to_have_attribute('aria-busy','false')
        def shot(name):
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            page.screenshot(path=str(out/(name+'.png')),full_page=True)
        def no_overflow(pg=page): assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),pg.viewport_size
        def export_report():
            with page.expect_download() as dl: page.get_by_role('button',name='Export flight report ↗',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        def preset(name): page.get_by_label('Experiment presets',exact=True).get_by_role('button',name=re.compile(name)).click();ready()
        try:
            page.goto(origin+'/lab/phobos/',wait_until='domcontentloaded');ready();no_overflow()
            report['webgl']=page.locator('.phobos-three canvas').count()==1
            if args.require_webgl: assert report['webgl'],'Actual P1 WebGL must initialize'
            expect(page.get_by_role('button',name='Pause replay',exact=True)).to_have_count(0)
            expect(page.locator('.phobos-challenge li[data-pass=true]')).to_have_count(3)
            if report['webgl']:
                canvas=page.locator('.phobos-three canvas');expect(canvas).to_have_attribute('aria-label',re.compile('3D Mars, Phobos'))
                expect(page.locator('.phobos-world-label')).to_be_visible()
                before=canvas.screenshot();box=canvas.bounding_box()
                page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down()
                page.mouse.move(box['x']+box['width']/2+75,box['y']+box['height']/2+20,steps=8);page.mouse.up()
                assert canvas.screenshot()!=before
                page.get_by_role('button',name='Reset camera',exact=True).click()
            shot('phobos-desktop');r=export_report()
            assert r['outcome']=='clear' and r['design']['model']=='P1-0.1.0'
            assert 500000<r['orbit']['periapsis']<505000 and r['jacobiRelativeError']<1e-10
            assert all(l['margin']>1 and l['minTensionN']>=0 for l in r['loads'])
            assert r['budget']['anchorWorkJ']<0 and abs(r['budget']['deltaEnergyJ']-r['budget']['anchorWorkJ']-r['budget']['winchWorkJ'])<1e-5
            done('native P1 worker, actual Mars–Phobos WebGL, reduced-motion pause and numerical report')
            slider=page.get_by_role('slider',name='Flight time',exact=True);slider.fill('10000')
            expect(page.locator('.phobos-flight-readout')).to_contain_text('2h 46m')
            if report['webgl']:
                page.get_by_role('button',name='Follow cargo',exact=True).click();shot('phobos-follow')
            page.get_by_role('button',name='Orbit plane',exact=True).click();expect(page.locator('.phobos-plane')).to_be_visible();shot('phobos-plane')
            page.get_by_role('button',name='Restart',exact=True).click()
            page.get_by_role('button',name='Play replay',exact=True).click();page.wait_for_function("Number(document.querySelector('input[aria-label=\"Flight time\"]').value)>5")
            page.get_by_role('button',name='Pause replay',exact=True).click();paused=slider.input_value();page.wait_for_timeout(160);assert slider.input_value()==paused
            slider.focus();slider.press('End');assert float(slider.input_value())>55000
            done('calculated trajectory replay, follow, plane, keyboard seeking and exact pause')
            preset('Tune a low pass');expect(page.locator('.phobos-verdict')).to_contain_text('This pass is too low.')
            bad=export_report();assert bad['outcome']=='mars-limit' and abs(bad['minMarsAltitudeM']-150000)<.01
            shot('phobos-low-pass')
            page.get_by_role('spinbutton',name='Inward arm value',exact=True).fill('1250')
            expect(page.locator('.phobos-results')).to_contain_text('PREVIOUS RUN')
            page.get_by_role('button',name='Run release →',exact=True).click();ready()
            expect(page.locator('.phobos-challenge li[data-pass=true]')).to_have_count(3)
            page.get_by_role('spinbutton',name='Outward arm value',exact=True).fill('8000')
            page.get_by_role('button',name='Run release →',exact=True).click();ready()
            expect(page.locator('.phobos-verdict')).to_contain_text('exceeds the material allowable')
            expect(page.get_by_role('button',name='Play replay',exact=True)).to_be_disabled()
            preset('Low Mars orbit');page.get_by_role('spinbutton',name='Inward arm value',exact=True).fill('1')
            page.get_by_role('button',name='Run release →',exact=True).click();ready()
            expect(page.locator('.phobos-verdict')).to_contain_text('needs compression')
            done('real low-pass failure to success, stress failure and compression-blocked release')
            preset('Outbound release');r=export_report();assert r['outcome']=='clear' and r['orbit']['apoapsis'] is None and r['budget']['anchorWorkJ']>0
            expect(page.locator('.phobos-verdict')).to_contain_text('An outbound trajectory.')
            page.get_by_role('group',name='Inspected arm',exact=True).get_by_role('button',name='Outward',exact=True).click()
            expect(page.locator('.phobos-loads svg')).to_have_attribute('aria-label',re.compile('outward cable tension'))
            shot('phobos-outbound');done('outbound release, escape excess, positive anchor work and arm load inspection')
            value=page.get_by_role('spinbutton',name='Payload value',exact=True);value.fill('')
            expect(value).to_have_attribute('aria-invalid','true');expect(page.get_by_role('button',name='Run release →',exact=True)).to_be_disabled()
            expect(page.get_by_role('button',name='Save',exact=True)).to_be_disabled();expect(page.get_by_role('button',name='Share design ↗',exact=True)).to_be_disabled()
            value.fill('4');slider=page.get_by_role('slider',name='Inward arm',exact=True);slider.focus();slider.press('ArrowRight');slider.press('ArrowRight')
            assert slider.evaluate('(el)=>el===document.activeElement')
            expect(page.get_by_role('spinbutton',name='Inward arm value',exact=True)).to_have_value('1252')
            page.get_by_role('button',name='Run release →',exact=True).click();ready()
            done('invalid input gates all design writes; keyboard range changes retain focus')
            page.evaluate("localStorage.setItem('skyhook-lab-design-v2','earth-sentinel');localStorage.setItem('skyhook-lab-lunar-design-v1','moon-sentinel')")
            page.get_by_role('button',name='Save',exact=True).click()
            saved=page.evaluate("localStorage.getItem('skyhook-lab-phobos-design-v1')")
            assert json.loads(saved)['payloadT']==4
            preset('Low Mars orbit');page.get_by_role('button',name='Load',exact=True).click();ready()
            expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4')
            assert page.evaluate("[localStorage.getItem('skyhook-lab-design-v2'),localStorage.getItem('skyhook-lab-lunar-design-v1')]")==['earth-sentinel','moon-sentinel']
            page.get_by_role('button',name='Share design ↗',exact=True).click();link=page.get_by_role('textbox',name='Shareable design link',exact=True).input_value()
            page.goto(link,wait_until='domcontentloaded');ready();expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4')
            with page.expect_download() as dl: page.get_by_role('button',name='Export design',exact=True).click()
            exported=Path(dl.value.path()).read_bytes();assert json.loads(exported)==json.loads(saved)
            preset('Low Mars orbit');assert '#' not in page.url
            page.locator('input[type=file]').set_input_files({'name':'phobos.json','mimeType':'application/json','buffer':exported});ready()
            expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4')
            original=page.get_by_role('spinbutton',name='Payload value',exact=True).input_value()
            page.locator('input[type=file]').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"schema":2,"architecture":"single-stage-rotovator"}'})
            expect(page.get_by_role('alert')).to_contain_text('Phobos anchored designs only');assert page.get_by_role('spinbutton',name='Payload value',exact=True).input_value()==original
            assert page.evaluate("localStorage.getItem('skyhook-lab-phobos-design-v1')")==saved
            done('isolated saves, portable export/import, shared-link reload and non-mutating invalid import')
            preset('Low Mars orbit')
            if report['webgl']: page.get_by_role('button',name='System',exact=True).click()
            for width in [1440,1280,1000,768,390,320]:
                page.set_viewport_size({'width':width,'height':950});no_overflow();expect(page.get_by_role('button',name='Play replay',exact=True)).to_be_visible()
                expect(page.get_by_role('button',name='Save',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Load',exact=True)).to_be_visible()
                assert page.locator('.experiment-strip button').evaluate_all('(buttons)=>buttons.every(b=>b.scrollWidth<=b.clientWidth+1)')
                if report['webgl']: expect(page.locator('.phobos-world-label')).to_be_visible()
                shot(f'phobos-{width}')
            done('six responsive widths with visible flight, controls and results')
            page.set_viewport_size({'width':1440,'height':1050})
            if report['webgl']:
                page.locator('.phobos-three canvas').evaluate("el=>{const gl=el.getContext('webgl2');gl.getExtension('WEBGL_lose_context').loseContext()}")
                expect(page.locator('.phobos-plane')).to_be_visible();expect(page.locator('.phobos-fallback')).to_be_visible()
            page.goto(origin+'/lab/lunar/',wait_until='domcontentloaded');expect(page.get_by_role('button',name='Full-run debrief',exact=True)).to_be_enabled(timeout=90000)
            page.get_by_role('group',name='Flight environment',exact=True).get_by_role('link',name=re.compile('^Phobos')).click();ready()
            page.reload(wait_until='domcontentloaded');ready();assert page.url==origin+'/lab/phobos/'
            page.get_by_role('group',name='Flight environment',exact=True).get_by_role('link',name=re.compile('^Earth')).click()
            expect(page.get_by_role('button',name='Full-run debrief',exact=True)).to_be_enabled(timeout=90000)
            page.get_by_role('group',name='Flight environment',exact=True).get_by_role('link',name=re.compile('^Phobos')).click();ready()
            done('WebGL loss fallback and Earth/Moon/Phobos navigation with correct refresh route')
            page.goto(origin+'/lab/campaign/',wait_until='domcontentloaded')
            page.get_by_label('Name your network',exact=True).fill('Phobos studio link');page.get_by_role('button',name='Start new network',exact=True).click()
            expect(page.get_by_text('Saved in this browser',exact=True)).to_be_visible()
            records="""async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('skyhook-campaigns',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return new Promise((ok,no)=>{const r=db.transaction('worlds').objectStore('worlds').getAll();r.onsuccess=()=>{db.close();ok(r.result)};r.onerror=()=>no(r.error)})}"""
            before=page.evaluate(records);link=page.locator('#outpost-phobos').get_by_role('link',name=re.compile('Explore the Phobos tether'))
            expect(link).to_have_attribute('href','/lab/phobos/');expect(link).to_have_attribute('target','_blank')
            with page.expect_popup() as popup: link.click()
            ready(popup.value);assert page.evaluate(records)==before;popup.value.close()
            done('campaign Phobos opens the experiment without changing the saved world')
            static=browser.new_context(java_script_enabled=False);guide=static.new_page()
            for path in ['/lab/phobos/method/','/lab/architectures/']:
                for width in [1440,390,320]:
                    guide.set_viewport_size({'width':width,'height':950});guide.goto(origin+path,wait_until='domcontentloaded');no_overflow(guide)
                    if 'method' in path: expect(guide.locator('#energy')).to_contain_text('The anchor orbit is held fixed.')
                    else: expect(guide.get_by_role('link',name='Open the Phobos experiment →',exact=True)).to_have_count(1)
                    guide.screenshot(path=str(out/f'{"method" if "method" in path else "catalogue"}-{width}.png'),full_page=True)
            static.close();done('Phobos method and architecture catalogue readable without JavaScript')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);shot('failure');raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close()
            if server: server.shutdown()

if __name__=='__main__': main()
