#!/usr/bin/env python3
"""Focused E0 controls, ledger, mode isolation and responsive UI regression.
Native localhost/module worker/WebGL in CI. --isolated mounts the compiled
assets solely for restricted component review; it is not native-origin QA.
"""
from __future__ import annotations
import argparse,json,mimetypes,re,threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote,urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]; DIST=ROOT/'dist'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--isolated',action='store_true');parser.add_argument('--require-webgl',action='store_true');parser.add_argument('--executable');parser.add_argument('--output',default='qa/browser/electrodynamic');args=parser.parse_args()
    if args.isolated and args.require_webgl: raise ValueError('Native WebGL testing cannot use isolated mode.')
    out=ROOT/args.output;out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(DIST)));threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}';report={'mode':'isolated component' if args.isolated else 'native localhost','checks':[],'errors':[]}
    with sync_playwright() as p:
        options={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
        if args.executable: options['executable_path']=args.executable
        else: options['channel']='chromium'
        browser=p.chromium.launch(**options);page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True);page.set_default_timeout(15000)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' and re.search('shader|Shader|worker failed',m.text) else None)
        def assets(route):
            file=(DIST/unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
            if file.is_dir():file=file/'index.html'
            if file.is_relative_to(DIST) and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream',headers={'Access-Control-Allow-Origin':'*'})
            else:route.abort()
        def open_page(path='/lab/'):
            if args.isolated:
                page.route('**/*',assets);source=next((DIST/'_astro').glob('worker-*.js')).read_text()
                page.evaluate("""s=>{if(window.__testWorker)return;window.__testWorker=true;const Native=Worker;window.Worker=class extends Native{constructor(url,opts){const b=URL.createObjectURL(new Blob([s],{type:'text/javascript'}));super(b,{...opts,type:'classic'});URL.revokeObjectURL(b);}}}""",source)
                page.set_content((DIST/path.strip('/')/'index.html').read_text().replace('<head>','<head><base href="http://skyhook.test/">',1),wait_until='networkidle')
            else:page.goto(origin+path,wait_until='networkidle')
        def ready():
            expect(page.get_by_role('button',name='Full-run debrief',exact=True)).to_be_enabled(timeout=90000);expect(page.locator('.scene-pending')).to_have_count(0);expect(page.locator('.lab-feedback.is-error')).to_have_count(0)
        def tab(name):
            nav=page.get_by_role('navigation',name='Workspace panels')
            if nav.is_visible():nav.get_by_role('button',name='Design',exact=True).click()
            page.locator('.control-tabs').get_by_role('button',name=name,exact=True).click()
        def panel(name):
            nav=page.get_by_role('navigation',name='Workspace panels')
            if nav.is_visible():nav.get_by_role('button',name=name,exact=True).click()
        def num(name):return page.get_by_role('spinbutton',name=name+' value',exact=True)
        def mode(name):page.get_by_role('group',name='Recovery method').get_by_role('button',name=re.compile('^'+name)).click()
        def shot(name):
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Page overflow'
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');page.screenshot(path=str(out/(name+'.png')),full_page=True)
            if page.locator('.scene-plane canvas').is_visible():
                page.wait_for_function('''()=>{const c=document.querySelector('.scene-plane canvas');if(!c?.width||!c?.height)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0);}''')
        def done(text):report['checks'].append(text);print('PASS',text,flush=True)
        try:
            open_page();ready();report['webgl']=page.locator('.scene-three canvas').count()==1
            if args.require_webgl:assert report['webgl'],'Native WebGL must initialize'
            tab('Recovery');num('Propellant budget').fill('17');mode('Electrodynamic')
            expect(num('Propellant budget')).to_have_count(0);expect(num('Total available thrust')).to_have_count(0);expect(num('Drive bus cap')).to_have_value('500')
            num('Drive bus cap').fill('750');mode('Coast');expect(num('Drive bus cap')).to_have_count(0);mode('Chemical');expect(num('Propellant budget')).to_have_value('17');mode('Electrodynamic');expect(num('Drive bus cap')).to_have_value('750')
            page.get_by_role('button',name='Load powered-conductor example →',exact=True).click();ready()
            expect(num('Drive bus cap')).to_have_value('500');expect(page.locator('.design-summary')).to_contain_text('66.5');expect(page.locator('.electrical-recorder')).to_have_count(1)
            done('Three recovery modes isolate resources and preserve user budgets; explicit E0 preset includes hardware mass')
            num('Conductor length / arm').fill('101');expect(page.locator('.run-design')).to_be_disabled();tab('Mission');expect(page.locator('.run-design')).to_be_disabled();tab('Recovery');num('Conductor length / arm').fill('50');expect(page.locator('.run-design')).to_be_enabled()
            done('Invalid conductor geometry is blocked even after changing control tabs')
            panel('Flight');page.locator('.timeline-events').get_by_role('button',name=re.compile('Payload 1 · release')).click()
            # Advance into the recovery interval using the real replay slider.
            slider=page.get_by_role('slider',name='Mission time',exact=True)
            if slider.count()==0:slider=page.locator('.timeline input[type=range]')
            t=int(float(slider.input_value()))+30;slider.fill(str(t));page.wait_for_timeout(150)
            panel('Results');rec=page.get_by_role('region',name='Electrodynamic power recorder');expect(rec).to_contain_text('Controller active');expect(rec).to_contain_text('MWh');assert 'NaN' not in rec.inner_text();shot('recorder-1440')
            page.get_by_role('button',name='Full-run debrief',exact=True).click();dialog=page.get_by_role('dialog');expect(dialog.locator('.electrical-ledger')).to_be_visible()
            with page.expect_download() as dl:dialog.get_by_role('button',name='Export flight report',exact=True).click()
            flight=json.loads(Path(dl.value.path()).read_text());e=flight['electrical']
            assert flight['model']=='D1p-0.4.0' and flight['propellantUsedKg']==0 and len(flight['deliveries'])==2
            assert e['busEnergyJ']>0 and e['conductorMassKg']==2700 and e['hardwareBudgetKg']==8000
            assert abs(e['busEnergyJ']+e['environmentExchangeJ']-e['mechanicalWorkJ']-e['heatAndDumpJ'])<10
            report['example']=e;shot('energy-debrief');page.keyboard.press('Escape');done('Actual powered flight produces two checked deliveries, zero propellant and a balanced exported energy ledger')
            before=rec.inner_text();tab('Recovery');num('Drive bus cap').fill('1000');expect(page.locator('.build-panel')).to_contain_text('UNRUN');panel('Results');assert rec.inner_text()==before,'Unrun input must not relabel accepted telemetry';tab('Recovery');num('Drive bus cap').fill('500')
            page.get_by_role('button',name='Trade study',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_role('combobox',name='Study variable',exact=True).select_option('electrical');dialog.get_by_role('button',name='Run 4 variants →',exact=True).click()
            expect(dialog.locator('tbody tr')).to_have_count(4,timeout=90000);expect(dialog.get_by_role('button',name='Cancel study')).to_have_count(0,timeout=90000);expect(dialog).to_contain_text('1000 kW');expect(dialog).to_contain_text('MWh');shot('power-study');page.keyboard.press('Escape')
            done('Unrun edits preserve accepted telemetry and electrical study runs four real power variants')
            for width,height in [(1440,1000),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height});tab('Recovery');num('Drive bus cap').scroll_into_view_if_needed();shot(f'controls-{width}');panel('Flight');shot(f'flight-{width}');panel('Results');rec.scroll_into_view_if_needed();shot(f'recorder-{width}')
            done('Electrical controls, scene and power recorder have no horizontal overflow at desktop and 390/320px')
            for width in [1440,320]:
                page.set_viewport_size({'width':width,'height':900});open_page('/lab/method/');expect(page.locator('#electrodynamic')).to_contain_text('plasma');page.locator('#electrodynamic summary').click();shot(f'method-{width}')
            assert not report['errors'],report['errors'];report['status']='passed';done('E0 Method equations and scope disclosures render on both widths without page errors')
        except Exception as e:
            report['status']='failed';report['failure']=str(e);page.screenshot(path=str(out/'failure.png'),full_page=True);raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()
if __name__=='__main__':main()
