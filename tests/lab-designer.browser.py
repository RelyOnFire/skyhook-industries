#!/usr/bin/env python3
"""G1 integration: real native-origin module workers, WebGL and Canvas.
Run after npm run build. Existing application suites remain independent.
"""
from __future__ import annotations
import argparse,json,threading,re
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--executable');parser.add_argument('--require-webgl',action='store_true')
    parser.add_argument('--output',default='qa/browser/designer');args=parser.parse_args()
    out=ROOT/args.output;out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    report={'mode':'native localhost','checks':[],'errors':[]}
    def done(text):report['checks'].append(text);print('PASS',text,flush=True)
    with sync_playwright() as p:
        options={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
        if args.executable:options['executable_path']=args.executable
        else:options['channel']='chromium'
        browser=p.chromium.launch(**options)
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
        page=context.new_page();page.set_default_timeout(20000)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        def ready():
            expect(page.locator('.gd-report')).to_have_count(1,timeout=90000)
            expect(page.locator('.gd-computing')).to_have_count(0,timeout=90000)
            expect(page.locator('.gd-error')).to_have_count(0)
        def tab(name):
            nav=page.get_by_role('navigation',name='Designer panels')
            if nav.is_visible():nav.get_by_role('button',name=name,exact=True).click()
        def number(name):return page.get_by_role('spinbutton',name=name,exact=True)
        def shot(name,element=None):
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Page overflow'
            if element:element.screenshot(path=str(out/(name+'.png')))
            else:page.screenshot(path=str(out/(name+'.png')),full_page=True)
        def export_report():
            tab('Calculated coast')
            details=page.locator('.gd-report details')
            if details.get_attribute('open') is None:details.locator('summary').click()
            with page.expect_download() as dl:page.get_by_role('button',name='Export coast report',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        def scene_ready():
            scene=page.locator('.gd-scene');scene.scroll_into_view_if_needed()
            expect(scene).to_have_attribute('data-ready','true')
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            return scene
        try:
            page.goto(origin+'/lab/designer/',wait_until='networkidle');ready();scene=scene_ready()
            report['webgl']=scene.get_attribute('data-renderer')=='webgl'
            if args.require_webgl:assert report['webgl'],'The real WebGL renderer must initialize'
            expect(page.get_by_role('button',name='Play designer replay',exact=True)).to_be_enabled()
            expect(page.locator('.gd-controls .gd-primary')).to_contain_text('Run coast analysis')
            baseline=export_report();assert baseline['model']=='G1-0.1.0' and baseline['outcome']=='observed'
            assert abs(baseline['body']['center'])<1e-6 and baseline['body']['mass']>34000
            shot('symmetric-reference')
            done('Real module-worker coast, paused initial replay and accepted symmetric report')
            page.locator('.gd-presets').get_by_role('button',name=re.compile('^Unequal arms')).click();ready()
            unequal=export_report();assert unequal['design']['armAKm']==100 and unequal['design']['armBKm']==500
            assert unequal['body']['center']>100000
            tab('Geometry & orbit');number('End A hardware').fill('80')
            expect(page.locator('.gd-controls .gd-primary')).to_contain_text('Run edited geometry')
            # The draft mass moves while the saved numerical result stays untouched.
            stale=export_report();assert stale['design']['endAT']==40
            assert stale['initial']==unequal['initial'] and stale['final']==unequal['final']
            tab('Geometry & orbit');number('Initial apogee').fill('1000')
            expect(page.locator('.gd-controls .gd-primary')).to_be_disabled()
            expect(number('Initial perigee')).to_have_value('2000')
            number('Initial apogee').fill('2000');number('End A hardware').fill('40')
            expect(page.locator('.gd-controls .gd-primary')).to_contain_text('Run coast analysis')
            done('Draft center-of-mass edit does not relabel accepted results; invalid ellipse never silently clamps')
            page.locator('.gd-presets').get_by_role('button',name=re.compile('^Elliptical explorer')).click();ready()
            ellipse=export_report();assert ellipse['outcome']=='observed' and ellipse['design']['perigeeKm']==1500 and ellipse['design']['apogeeKm']==6000
            assert ellipse['maxEnergyError']/abs(ellipse['initialEnergy'])<1e-10
            report['example']={'dryMassKg':ellipse['body']['mass'],'centroidOffsetM':ellipse['body']['center'],'minimumMargin':ellipse['minMargin'],'energyDriftJ':ellipse['maxEnergyError']}
            scene=scene_ready();page.get_by_role('button',name='Machine view',exact=True).click()
            expect(scene).to_have_attribute('data-machine-view','true');scene_ready()
            before=scene.locator('canvas').screenshot()
            page.get_by_role('slider',name='Designer replay time').fill('600');scene_ready()
            assert scene.locator('canvas').screenshot()!=before,'Replay must alter the rendered physical state'
            page.get_by_role('button',name='Restart',exact=True).click();scene_ready()
            page.get_by_role('button',name='Fit design',exact=True).click();scene_ready()
            if report['webgl']:
                expected=scene.get_attribute('data-camera')
                page.get_by_role('button',name='Zoom designer camera in',exact=True).click();scene_ready()
                assert scene.get_attribute('data-camera')!=expected
                page.get_by_role('button',name='Fit design',exact=True).click();scene_ready()
                assert scene.get_attribute('data-camera')==expected
            shot('elliptical-machine',scene)
            page.get_by_role('button',name='Orbit plane',exact=True).click();scene_ready()
            expect(scene).to_have_attribute('data-renderer','canvas')
            assert scene.locator('canvas').evaluate('c=>c.getContext("2d").getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)')
            shot('elliptical-plane',scene)
            page.get_by_role('button',name='Globe',exact=True).click();scene_ready()
            done('Elliptical coast and stress report; actual WebGL/Canvas replay, machine focus and repeatable camera fit')
            tab('Geometry & orbit');page.get_by_role('button',name='Save design',exact=True).click()
            saved=json.loads(page.evaluate("localStorage.getItem('skyhook-geometry-g1')"))
            number('Arm B length').fill('450')
            page.get_by_role('button',name='Load',exact=True).click();ready()
            tab('Geometry & orbit');expect(number('Arm B length')).to_have_value('400')
            page.get_by_role('button',name='Share',exact=True).click()
            url=page.get_by_role('textbox',name='Shareable geometry link').input_value()
            page.goto(url,wait_until='networkidle');ready();assert export_report()['design']==saved
            # Reject another lab's file, preserving the accepted coast.
            page.locator('.gd-files input[type=file]').set_input_files({'name':'not-g1.json','mimeType':'application/json','buffer':b'{"schema":2,"model":"D1p-0.4.0"}'})
            expect(page.locator('.gd-error')).to_contain_text('different models')
            assert export_report()['design']==saved
            page.get_by_role('button',name='Dismiss designer message').click()
            done('Native Save/Load, versioned share reload and rejected legacy import preserve exact accepted geometry')
            for width,height in [(1440,1000),(1280,800),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                tab('Geometry & orbit');shot(f'controls-{width}')
                tab('Calculated coast');scene=scene_ready();shot(f'coast-{width}')
                if page.locator('.gd-view button[aria-pressed=true]').filter(has_text='Machine view').count()==0:
                    page.get_by_role('button',name='Machine view',exact=True).click();scene_ready()
                shot(f'machine-{width}',scene)
                labels=page.locator('.gd-world-label:visible').evaluate_all('es=>es.map(e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
                for i,a in enumerate(labels):
                    for b in labels[i+1:]:assert not(a['x']<b['x']+b['w'] and a['x']+a['w']>b['x'] and a['y']<b['y']+b['h'] and a['y']+a['h']>b['y'])
            done('Five viewport widths, visible controls, nonoverlapping machine labels and no page-wide overflow')
            for width in [1440,390,320]:
                page.set_viewport_size({'width':width,'height':900})
                page.goto(origin+'/lab/designer/method/',wait_until='networkidle')
                expect(page.locator('.lab-section-nav a.active')).to_have_text('Designer')
                expect(page.locator('.lab-section-nav a[aria-current=page]')).to_have_count(0)
                page.locator('.guide details summary').click();shot(f'method-{width}')
            done('Designer Method route, readable disclosures and correct parent-section navigation')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e)
            page.screenshot(path=str(out/'failure.png'),full_page=True);raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()
if __name__=='__main__':main()
