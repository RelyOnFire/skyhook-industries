#!/usr/bin/env python3
"""Native T4 workers/WebGL, coupled phase challenge, comparison and isolated IO."""
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
    out=ROOT/'qa/browser/t4';out.mkdir(parents=True,exist_ok=True);server=None
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
        page=context.new_page();page.set_default_timeout(30000);page.set_default_navigation_timeout(60000)
        def ready():
            expect(page.get_by_role('button',name='Run release →',exact=True)).to_be_enabled()
            expect(page.get_by_role('button',name='Export flight report ↗',exact=True)).to_be_visible()
            expect(page.locator('.phobos-flight')).to_have_attribute('aria-busy','false')
        def shot(name):
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            page.screenshot(path=str(out/(name+'.png')),full_page=True)
        def no_overflow(pg=page): assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),pg.viewport_size
        def export_report():
            with page.expect_download() as dl: page.get_by_role('button',name='Export flight report ↗',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        def preset(name): page.get_by_label('Experiment presets',exact=True).get_by_role('button',name=re.compile(name)).click();ready()
        try:
            page.goto(origin+'/lab/t4/',wait_until='domcontentloaded');ready();no_overflow()
            report['webgl']=page.locator('.t4-three canvas').count()==1
            if args.require_webgl: assert report['webgl'],'Actual T4 WebGL must initialize'
            expect(page.get_by_role('button',name='Pause replay',exact=True)).to_have_count(0)
            expect(page.locator('.phobos-challenge li[data-pass=true]')).to_have_count(3)
            expect(page.locator('.phobos-results')).not_to_contain_text('PREVIOUS RUN')
            r=export_report();assert r['outcome']=='complete' and r['design']['model']=='T4p-0.1.0'
            assert r['duration']==7200 and 9490000<r['release']['orbit']['apoapsis']<9510000
            assert r['energyError']<1e-9 and r['angularError']<1e-9 and r['release']['closure']['momentum']<1e-5
            if report['webgl']:
                canvas=page.locator('.t4-three canvas');expect(canvas).to_have_attribute('aria-label',re.compile('3D two-tier'))
                expect(page.locator('.phobos-world-label')).to_be_visible()
                initial=canvas.screenshot();page.get_by_role('slider',name='Flight time',exact=True).fill('50');assert canvas.screenshot()!=initial
                expect(page.locator('.t4-three')).to_have_attribute('data-phase','attached')
                box=canvas.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+60,box['y']+box['height']/2+20,steps=8);page.mouse.up()
                page.get_by_role('button',name='Reset camera',exact=True).click()
            shot('t4-desktop');done('native coupled worker, real WebGL stage animation, reduced-motion pause and conservation report')
            page.get_by_role('button',name='At release',exact=True).click()
            expect(page.locator('.phobos-flight-readout')).to_contain_text('CARGO RELEASED');expect(page.locator('.phobos-flight-readout')).to_contain_text('2:00')
            if report['webgl']:
                expect(page.locator('.t4-three')).to_have_attribute('data-phase','released')
                for view in ['Earth orbit','Follow cargo','Two stages']: page.get_by_role('button',name=view,exact=True).click();shot('t4-'+view.lower().replace(' ','-'))
            page.get_by_role('button',name='Orbit plane',exact=True).click();expect(page.locator('.phobos-plane')).to_be_visible()
            slider=page.get_by_role('slider',name='Flight time',exact=True);slider.fill('0');page.get_by_role('button',name='Play replay',exact=True).click()
            page.wait_for_function("Number(document.querySelector('input[aria-label=\"Flight time\"]').value)>5")
            page.get_by_role('button',name='Pause replay',exact=True).click();paused=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==paused
            slider.focus();slider.press('End');assert float(slider.input_value())==7200
            done('release boundary, all camera views, explicit replay, pause and keyboard seeking')
            preset('Find the phase');expect(page.locator('.phobos-challenge li[data-pass=true]')).to_have_count(2)
            challenge=export_report();assert 3030000<challenge['release']['orbit']['apoapsis']<3050000
            page.get_by_role('spinbutton',name='Initial phase value',exact=True).fill('180');expect(page.locator('.phobos-results')).to_contain_text('PREVIOUS RUN')
            page.get_by_role('button',name='Run release →',exact=True).click();ready();expect(page.locator('.phobos-challenge li[data-pass=true]')).to_have_count(3)
            preset('Thin secondary');expect(page.locator('.phobos-verdict')).to_contain_text('exceeds the axial material allowable')
            expect(page.get_by_role('button',name='Play replay',exact=True)).to_be_disabled();assert export_report()['release'] is None
            done('genuine phase challenge failure to success and initial axial limit blocking release')
            preset('Working release');page.get_by_role('button',name='Compare six phases →',exact=True).click()
            expect(page.locator('.t4-sweep')).to_have_attribute('aria-busy','true');page.get_by_role('button',name='Cancel calculation',exact=True).click();ready()
            expect(page.locator('.t4-trials article')).to_have_count(0);assert export_report()['design']['phaseDeg']==180
            page.get_by_role('button',name='Compare six phases →',exact=True).click();expect(page.locator('.t4-trials article')).to_have_count(6,timeout=90000)
            expect(page.locator('.t4-trials article[data-pass=true]')).to_have_count(1);no_overflow();shot('t4-phase-comparison')
            page.get_by_role('spinbutton',name='Payload value',exact=True).fill('5')
            page.get_by_role('button',name='Inspect 60° →',exact=True).click();ready()
            expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('3');expect(page.get_by_role('spinbutton',name='Initial phase value',exact=True)).to_have_value('60')
            assert export_report()['release']['orbit']==challenge['release']['orbit']
            done('cancellable phase sweep preserves accepted result; six solved trials restore exact design on inspection')
            value=page.get_by_role('spinbutton',name='Payload value',exact=True);value.fill('')
            expect(value).to_have_attribute('aria-invalid','true')
            for name in ['Run release →','Save','Share design ↗','Export design','Compare six phases →']: expect(page.get_by_role('button',name=name,exact=True)).to_be_disabled()
            value.fill('4');phase=page.get_by_role('slider',name='Initial phase',exact=True);phase.focus();phase.press('ArrowRight');phase.press('ArrowRight');assert phase.evaluate('(el)=>el===document.activeElement')
            expect(page.get_by_role('spinbutton',name='Initial phase value',exact=True)).to_have_value('62')
            page.get_by_text('Geometry & initial rotation',exact=True).click();page.get_by_role('spinbutton',name='Each secondary arm value',exact=True).fill('200')
            expect(page.get_by_role('alert')).to_contain_text('half the primary arm');expect(page.get_by_role('button',name='Run release →',exact=True)).to_be_disabled()
            preset('Working release');page.get_by_role('spinbutton',name='Payload value',exact=True).fill('4');page.get_by_role('button',name='Run release →',exact=True).click();ready()
            done('keyboard controls and invalid numeric or compound geometry inputs gate calculation and writes')
            keys=['skyhook-lab-design-v2','skyhook-lab-lunar-design-v1','skyhook-lab-phobos-design-v1']
            page.evaluate('(keys)=>keys.forEach(k=>localStorage.setItem(k,"untouched-"+k))',keys)
            page.get_by_role('button',name='Save',exact=True).click();saved=page.evaluate("localStorage.getItem('skyhook-lab-t4-design-v1')")
            assert json.loads(saved)['payloadT']==4;preset('Working release');page.get_by_role('button',name='Load',exact=True).click();ready()
            expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4')
            assert page.evaluate('(keys)=>keys.map(k=>localStorage.getItem(k))',keys)==['untouched-'+k for k in keys]
            page.get_by_role('button',name='Share design ↗',exact=True).click();link=page.get_by_role('textbox',name='Shareable design link',exact=True).input_value();assert '/lab/t4/#t4=' in link
            page.goto(link,wait_until='domcontentloaded');ready();expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4')
            with page.expect_download() as dl: page.get_by_role('button',name='Export design',exact=True).click()
            data=Path(dl.value.path()).read_bytes();assert json.loads(data)==json.loads(saved)
            preset('Working release');assert '#' not in page.url
            page.locator('input[type=file]').set_input_files({'name':'t4.json','mimeType':'application/json','buffer':data});ready()
            expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4')
            for invalid in [b'{"schema":1,"architecture":"phobos-anchored","model":"P1-0.1.0"}',b' '*6001]:
                page.locator('input[type=file]').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':invalid});expect(page.get_by_role('alert')).to_be_visible()
                expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('4');assert page.evaluate("localStorage.getItem('skyhook-lab-t4-design-v1')")==saved
            done('isolated T4 save/load, exact JSON round trip, share reload and non-mutating wrong-model/oversize rejection')
            preset('Working release');page.get_by_role('button',name='Two stages',exact=True).click();page.get_by_role('slider',name='Flight time',exact=True).fill('50')
            for width in [1440,1280,1000,768,390,320]:
                page.set_viewport_size({'width':width,'height':950});no_overflow()
                for name in ['Play replay','Save','Load']: expect(page.get_by_role('button',name=name,exact=True)).to_be_visible()
                assert page.locator('.experiment-strip button').evaluate_all('(buttons)=>buttons.every(b=>b.scrollWidth<=b.clientWidth+1)')
                if report['webgl']: expect(page.locator('.phobos-world-label')).to_be_visible()
                shot(f't4-{width}')
            done('six responsive widths including readable stage view, phase trials and 320 px touch controls')
            page.set_viewport_size({'width':1440,'height':1050})
            if report['webgl']:
                page.locator('.t4-three canvas').evaluate("el=>{const gl=el.getContext('webgl2');gl.getExtension('WEBGL_lose_context').loseContext()}")
                expect(page.locator('.phobos-plane')).to_be_visible();expect(page.locator('.phobos-fallback')).to_be_visible();expect(page.get_by_role('button',name='Earth orbit',exact=True)).to_be_disabled()
                page.get_by_role('slider',name='Flight time',exact=True).fill('200');expect(page.locator('.phobos-flight-readout')).to_contain_text('CARGO RELEASED')
            for route in ['/lab/','/lab/lunar/','/lab/phobos/']:
                page.goto(origin+route,wait_until='domcontentloaded')
                nav=page.get_by_role('group',name='Flight environment',exact=True);nav.get_by_role('link',name=re.compile('^T4')).click();ready()
                assert page.url==origin+'/lab/t4/'
            page.reload(wait_until='domcontentloaded');ready()
            done('WebGL context-loss fallback and direct Earth/Moon/Phobos links with correct T4 refresh route')
            static=browser.new_context(java_script_enabled=False);guide=static.new_page()
            for path in ['/lab/t4/method/','/lab/architectures/']:
                for width in [1440,390,320]:
                    guide.set_viewport_size({'width':width,'height':950});guide.goto(origin+path,wait_until='domcontentloaded');no_overflow(guide)
                    if 'method' in path: expect(guide.get_by_text('Crossing clearance, bearing dimensions and flexible cable behavior are not modeled.',exact=True)).to_be_visible()
                    else:
                        expect(guide.get_by_text('4 RUNNABLE EXPERIMENTS',exact=True)).to_be_visible();expect(guide.get_by_role('link',name='Open the T4 experiment →',exact=True)).to_have_attribute('href','/lab/t4/')
                    guide.screenshot(path=str(out/f'{"method" if "method" in path else "catalogue"}-{width}.png'),full_page=True)
            static.close();done('static assumptions and four-experiment catalogue remain readable without JavaScript')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);shot('failure');raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close()
            if server: server.shutdown()

if __name__=='__main__': main()
