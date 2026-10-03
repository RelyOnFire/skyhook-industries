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
        def export_study():
            with page.expect_download() as dl: page.get_by_role('button',name='Export arm study ↗',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        def export_comparison():
            with page.expect_download() as dl: page.get_by_role('button',name='Export comparison ↗',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        def core(r): return {k:v for k,v in r.items() if k not in ['constants','scope']}
        def study_ready():
            expect(page.get_by_label('Phobos arm study',exact=True)).to_have_attribute('aria-busy','false')
            expect(page.get_by_role('button',name='Export arm study ↗',exact=True)).to_be_visible()
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
            preset('Low Mars orbit');comparison_storage=page.evaluate('JSON.stringify({...localStorage})')
            baseline=core(export_report());comparison=page.get_by_label('Pinned flight comparison',exact=True)
            expect(comparison).to_have_count(0)
            pin=page.get_by_role('button',name='Pin calculated flight',exact=True);pin.focus();pin.press('Enter')
            expect(comparison).to_be_focused();first_comparison=export_comparison()
            assert first_comparison['pinned']==first_comparison['current']==baseline
            page.get_by_role('spinbutton',name='Inward arm value',exact=True).fill('1350')
            expect(comparison).to_have_attribute('data-draft','true');expect(comparison).to_contain_text('unrun edits')
            assert export_comparison()==first_comparison
            page.get_by_role('button',name='Run release →',exact=True).click();ready()
            pair=export_comparison();assert pair['format']=='skyhook-phobos-comparison' and pair['model']=='P1-0.1.0'
            assert pair['pinned']==baseline and pair['current']==core(export_report()) and pair['current']['design']['inwardKm']==1350
            metrics={row['id']:row for row in pair['metrics']}
            assert metrics['altitude']['delta']<0 and metrics['mass']['delta']>0 and metrics['anchor']['delta']<0
            expect(comparison).to_have_attribute('data-draft','false');expect(comparison.locator('g[data-flight]')).to_have_count(2)
            assert comparison.locator('.phobos-path-pinned polyline').get_attribute('points')!=comparison.locator('.phobos-path-current polyline').get_attribute('points')
            comparison.get_by_text('1 changed input',exact=True).click();expect(comparison).to_contain_text('1250 → 1350 km')
            done('pinned P1 flights preserve exact accepted snapshots through draft edits and show signed clearance, cable and work changes')
            for width in [1440,1280,1000,768,390,320]:
                page.set_viewport_size({'width':width,'height':950});no_overflow()
                assert comparison.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1');expect(comparison.locator('svg')).to_be_visible()
                if width<=390: assert comparison.locator('button').evaluate_all('(buttons)=>buttons.every(b=>b.getBoundingClientRect().height>=44)')
                comparison.screenshot(path=str(out/f'phobos-comparison-{width}.png'))
            page.get_by_role('spinbutton',name='Inward arm value',exact=True).fill('1350.000001')
            page.get_by_role('button',name='Run release →',exact=True).click();ready();expect(comparison).to_contain_text('1250 → 1350.000001 km');no_overflow()
            restore=page.get_by_role('button',name='Open pinned flight →',exact=True);restore.focus();restore.press('Enter');ready()
            expect(page.locator('.phobos-flight')).to_be_focused();assert 0<=page.locator('.phobos-flight').bounding_box()['y']<=40
            assert export_comparison()['current']==baseline
            page.set_viewport_size({'width':1440,'height':1050})
            done('common-scale P1 comparison fits six widths, retains full-precision input changes and restores the exact pinned flight with keyboard focus')
            preset('Outbound release');escape=export_comparison();assert escape['pinned']==baseline
            metrics={row['id']:row for row in escape['metrics']};assert metrics['apoapsis']['current'] is None and metrics['apoapsis']['delta'] is None
            assert metrics['energy']['current']>0 and metrics['anchor']['current']>0
            expect(comparison.locator('[data-metric=apoapsis] td').last).to_have_text('Unbound—')
            comparison.screenshot(path=str(out/'phobos-comparison-outward.png'))
            preset('Tune a low pass');early=export_comparison();assert early['current']['outcome']=='mars-limit'
            assert early['current']['duration']<early['pinned']['duration'];expect(comparison).to_contain_text('Mars boundary reached')
            page.get_by_role('spinbutton',name='Inward arm value',exact=True).fill('1')
            page.get_by_role('button',name='Run release →',exact=True).click();ready();stopped=export_comparison()
            assert stopped['pinned']==baseline and stopped['current']['outcome']=='structure-limit'
            assert all(row['current'] is None and row['delta'] is None for row in stopped['metrics'] if row['id'] in ['altitude','periapsis','apoapsis','energy'])
            expect(comparison.locator('.phobos-path-current')).to_have_count(0);expect(comparison).to_contain_text('Current: no cargo release.')
            expect(comparison).to_contain_text('Inward arm needs compression')
            page.get_by_role('spinbutton',name='Payload value',exact=True).fill('');expect(comparison).to_have_attribute('data-draft','true')
            assert export_comparison()==stopped
            page.get_by_role('button',name='Open pinned flight →',exact=True).click();ready();assert export_comparison()['current']==baseline
            preset('Outbound release');page.get_by_role('button',name='Replace pinned flight',exact=True).click();expect(comparison).to_be_focused()
            replacement=export_comparison();assert replacement['pinned']==replacement['current'] and replacement['pinned']['design']['release']=='outward'
            page.get_by_role('button',name='Clear comparison',exact=True).click();expect(comparison).to_have_count(0);expect(pin).to_be_focused()
            assert page.evaluate('JSON.stringify({...localStorage})')==comparison_storage
            preset('Low Mars orbit');page.get_by_role('button',name='Pin calculated flight',exact=True).click()
            done('P1 comparison distinguishes escape, early boundaries and blocked releases; invalid drafts, pin replacement and clearing preserve saved designs')
            preset('Low Mars orbit');accepted=export_report();storage_before=page.evaluate('JSON.stringify({...localStorage})')
            board=page.get_by_label('Phobos arm study',exact=True);detail=page.get_by_label('Selected arm sample',exact=True)
            expect(page.get_by_role('combobox',name='Arm study spacing',exact=True)).to_have_value('100')
            page.get_by_role('button',name='Compare arm lengths →',exact=True).click();study_ready()
            inward=export_study();assert inward['format']=='skyhook-phobos-study' and inward['model']=='P1-0.1.0'
            assert inward['plan']['lengthsKm']==[950,1050,1150,1250,1350,1450,1550] and len(inward['rows'])==7
            assert all(row['design']==inward['plan']['samples'][row['index']] for row in inward['rows'])
            assert any(row['target'] for row in inward['rows']) and any(row['outcome']=='mars-limit' for row in inward['rows'])
            assert export_report()==accepted
            point=board.locator('[data-index="6"]');point.focus();point.press('Enter')
            expect(point).to_have_attribute('aria-pressed','true');expect(detail).to_contain_text('Mars boundary')
            page.get_by_role('spinbutton',name='Payload value',exact=True).fill('5');expect(page.locator('.phobos-study-design')).to_have_attribute('data-stale','true')
            page.get_by_role('button',name='Open this flight →',exact=True).click();ready()
            expect(page.locator('.phobos-flight')).to_be_focused();expect(page.get_by_role('spinbutton',name='Payload value',exact=True)).to_have_value('3')
            opened=export_report();sample=inward['rows'][6]
            assert opened['design']==sample['design'] and opened['duration']==sample['duration'] and opened['orbit']==sample['orbit'] and opened['budget']==sample['budget']
            assert export_comparison()['pinned']==baseline and export_comparison()['current']==core(opened)
            expect(page.locator('.phobos-study-design')).to_have_attribute('data-stale','false')
            page.get_by_role('button',name='Select closest to 450 km periapsis',exact=True).click()
            expect(board.locator('[data-index="3"]')).to_have_attribute('aria-pressed','true')
            page.get_by_role('button',name='Open this flight →',exact=True).click();ready();assert export_report()==accepted
            done('seven native inward flights expose clear and boundary cases, export exact samples and restore a keyboard-selected design')
            preset('Outbound release');expect(page.locator('.phobos-study-design')).to_have_attribute('data-stale','true')
            expect(page.get_by_role('combobox',name='Arm study spacing',exact=True)).to_have_value('250')
            page.get_by_role('button',name='Compare arm lengths →',exact=True).click();study_ready()
            outward=export_study();assert outward['plan']['lengthsKm']==[2250,2500,2750,3000,3250,3500,3750]
            assert outward['rows'][0]['orbit']['energy']<0<outward['rows'][-1]['orbit']['energy']
            assert outward['rows'][-1]['massKg']>outward['rows'][0]['massKg'] and outward['rows'][-1]['margin']<outward['rows'][0]['margin']
            expect(detail).to_contain_text('Bound orbit');expect(page.get_by_role('button',name='Select closest to 450 km periapsis',exact=True)).to_have_count(0)
            board.locator('[data-index="6"]').click();expect(detail).to_contain_text('Escape energy')
            page.get_by_role('button',name='Open this flight →',exact=True).click();ready()
            assert export_report()['design']==outward['rows'][6]['design']
            board.screenshot(path=str(out/'phobos-outward-study.png'))
            done('outward arm study distinguishes bound and escape release energy while exposing cable mass and margin tradeoffs')
            page.get_by_role('spinbutton',name='Inward arm value',exact=True).fill('1')
            page.get_by_role('spinbutton',name='Outward arm value',exact=True).fill('10000')
            page.get_by_role('combobox',name='Arm study spacing',exact=True).select_option('500')
            page.get_by_role('button',name='Compare arm lengths →',exact=True).click();study_ready()
            blocked=export_study();assert blocked['plan']['lengthsKm']==[8500,9000,9500,10000]
            assert all(not row['released'] and row['orbit'] is None and row['minMarsAltitudeM'] is None for row in blocked['rows'])
            expect(detail).to_contain_text('Release blocked');expect(detail).to_contain_text('Inward arm needs compression')
            expect(board.locator('[data-result="limit"]')).to_have_count(4)
            expect(board).to_contain_text('No released flight in these samples.')
            page.get_by_role('spinbutton',name='Payload value',exact=True).fill('')
            expect(page.get_by_role('button',name='Compare arm lengths →',exact=True)).to_be_disabled()
            assert export_study()==blocked
            page.get_by_role('button',name='Open this flight →',exact=True).click();ready()
            assert export_report()['design']==blocked['rows'][0]['design']
            done('boundary lengths remain distinct and a blocked fixed arm suppresses every virtual release orbit without corrupting the study')
            preset('Low Mars orbit');accepted=export_report()
            page.get_by_role('combobox',name='Arm study spacing',exact=True).select_option('100')
            # Hold messages from the real worker to exercise cancellation races deterministically.
            page.evaluate("""()=>{window.__phobosNativeWorker=window.Worker;window.__phobosQueue=[];
              window.Worker=class {
                constructor(...args){this.inner=new window.__phobosNativeWorker(...args);this.inner.onmessage=e=>window.__phobosQueue.push(()=>this.onmessage?.(e));this.inner.onerror=e=>this.onerror?.(e);}
                postMessage(message){this.inner.postMessage(message);}terminate(){this.inner.terminate();}
              };
            }""")
            page.get_by_role('button',name='Compare arm lengths →',exact=True).click()
            page.wait_for_function('window.__phobosQueue.length===8')
            page.evaluate('()=>{window.__phobosQueue.shift()();}')
            expect(board.locator('[aria-disabled="false"]')).to_have_count(1)
            page.get_by_role('button',name='Stop study',exact=True).click();ready()
            expect(page.locator('.phobos-study-status')).to_contain_text('Stopped')
            expect(page.get_by_role('button',name='Export arm study ↗',exact=True)).to_have_count(0)
            page.evaluate('()=>{window.__phobosQueue.splice(0).forEach(deliver=>deliver());}')
            expect(board.locator('[aria-disabled="false"]')).to_have_count(1);assert export_report()==accepted
            assert export_comparison()['pinned']==baseline and export_comparison()['current']==core(accepted)
            page.evaluate("()=>{window.Worker=class {constructor(){throw Error('Injected Phobos worker startup failure')}};}")
            page.get_by_role('button',name='Compare arm lengths →',exact=True).click()
            expect(page.get_by_role('alert')).to_contain_text('Injected Phobos worker startup failure')
            expect(board).to_have_attribute('aria-busy','false');expect(page.locator('.phobos-study-status')).to_contain_text('Interrupted')
            assert export_report()==accepted
            assert export_comparison()['pinned']==baseline
            page.evaluate('()=>{window.Worker=window.__phobosNativeWorker;delete window.__phobosNativeWorker;delete window.__phobosQueue;}')
            page.get_by_role('button',name='Compare arm lengths →',exact=True).click();study_ready();assert export_study()==inward
            done('real-worker partial cancellation rejects late queued samples; startup failure preserves the flight and permits an exact retry')
            # Clearing during a native calculation must move focus somewhere enabled.
            page.evaluate("""()=>{window.__phobosNativeWorker=window.Worker;window.__phobosQueue=[];
              window.Worker=class {
                constructor(...args){this.inner=new window.__phobosNativeWorker(...args);this.inner.onmessage=e=>window.__phobosQueue.push(()=>this.onmessage?.(e));this.inner.onerror=e=>this.onerror?.(e);}
                postMessage(message){this.inner.postMessage(message);}terminate(){this.inner.terminate();}
              };
            }""")
            page.get_by_role('button',name='Run release →',exact=True).click();page.wait_for_function('window.__phobosQueue.length===1')
            expect(page.get_by_role('button',name='Open pinned flight →',exact=True)).to_be_disabled()
            expect(comparison).to_contain_text('Calculation in progress');assert export_comparison()['pinned']==baseline
            page.get_by_role('button',name='Clear comparison',exact=True).click();expect(page.locator('.phobos-flight')).to_be_focused()
            page.evaluate('()=>{window.__phobosQueue.splice(0).forEach(deliver=>deliver());window.Worker=window.__phobosNativeWorker;delete window.__phobosNativeWorker;delete window.__phobosQueue;}');ready()
            expect(comparison).to_have_count(0);page.get_by_role('button',name='Pin calculated flight',exact=True).click()
            done('pinned baseline survives real study cancellation and worker failure; clearing during calculation restores enabled keyboard focus')
            page.get_by_role('button',name='Select closest to 450 km periapsis',exact=True).click()
            for width in [1440,1280,1000,768,390,320]:
                page.set_viewport_size({'width':width,'height':950});no_overflow()
                assert board.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
                assert board.locator('.phobos-study-hit').evaluate_all('(points)=>points.every(p=>p.getBoundingClientRect().width>=44)')
                board.screenshot(path=str(out/f'phobos-study-{width}.png'))
            page.get_by_role('button',name='Select closest to 450 km periapsis',exact=True).click()
            point=board.locator('[data-index="3"]');region=page.get_by_role('region',name='Arm length samples',exact=True)
            a=point.bounding_box();b=region.bounding_box();assert a['x']>=b['x']-1 and a['x']+a['width']<=b['x']+b['width']+1
            point.focus();point.press('Space');page.get_by_role('button',name='Open this flight →',exact=True).click();ready()
            expect(page.locator('.phobos-flight')).to_be_focused();assert 0<=page.locator('.phobos-flight').bounding_box()['y']<=40
            assert page.evaluate('JSON.stringify({...localStorage})')==storage_before
            page.reload(wait_until='domcontentloaded');ready();expect(page.get_by_role('button',name='Export arm study ↗',exact=True)).to_have_count(0);expect(comparison).to_have_count(0)
            assert page.evaluate('JSON.stringify({...localStorage})')==storage_before
            page.set_viewport_size({'width':1440,'height':1050});preset('Outbound release')
            done('arm studies fit six widths with touch-sized points, internal phone scrolling, keyboard flight focus and session-only state')
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
                    if 'method' in path:
                        expect(guide.locator('#energy')).to_contain_text('The anchor orbit is held fixed.')
                        expect(guide.get_by_text('Gaps between sampled lengths are untested.',exact=True)).to_be_visible()
                        expect(guide.get_by_role('heading',name='Keep a flight for comparison',exact=True)).to_be_visible()
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
