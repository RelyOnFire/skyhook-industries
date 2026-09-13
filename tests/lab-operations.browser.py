#!/usr/bin/env python3
"""Native localhost + real module-worker operations regression.
Run after npm run build. Requires Playwright and Chromium; CI uses its installed
Chromium/SwiftShader, not a claim of physical-GPU or cross-browser qualification.
"""
from __future__ import annotations
import argparse,json,re,threading,mimetypes
from urllib.parse import urlparse,unquote
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--isolated',action='store_true');parser.add_argument('--executable');parser.add_argument('--require-webgl',action='store_true');parser.add_argument('--output',default='qa/browser/operations');args=parser.parse_args()
    if args.isolated and args.require_webgl:raise ValueError('Native WebGL verification cannot use isolated component mode.')
    out=ROOT/args.output;out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    report={'origin':'isolated local component' if args.isolated else 'native localhost','checks':[],'errors':[]}
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
        if args.executable:opts['executable_path']=args.executable
        else:opts['channel']='chromium'
        browser=p.chromium.launch(**opts);context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
        page=context.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' and re.search('shader|Shader|worker failed',m.text) else None)
        def open_page(path='/lab/operations/'):
            if not args.isolated:
                page.goto(origin+path,wait_until='networkidle');return
            def assets(route):
                target=(ROOT/'dist'/unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
                if target.is_dir():target=target/'index.html'
                if target.is_relative_to(ROOT/'dist') and target.is_file():route.fulfill(body=target.read_bytes(),content_type=mimetypes.guess_type(target.name)[0] or 'application/octet-stream',headers={'Access-Control-Allow-Origin':'*'})
                else:route.abort()
            page.route('**/*',assets)
            source=next(f for f in (ROOT/'dist/_astro').glob('worker-*.js') if 'OPS-0.1.0' in f.read_text()).read_text()
            page.evaluate('''source=>{if(window.__testWorker)return;window.__testWorker=true;const Native=Worker;window.Worker=class extends Native{constructor(url,opts){const blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));super(blob,{...opts,type:'classic'});URL.revokeObjectURL(blob);}}}''',source)
            page.set_content((ROOT/'dist'/path.strip('/')/'index.html').read_text().replace('<head>','<head><base href="http://skyhook.test/">',1),wait_until='networkidle')
        def done(text):report['checks'].append(text);print('PASS',text,flush=True)
        def ready():
            expect(page.locator('.ops-results-table')).to_have_count(1,timeout=180000)
            expect(page.get_by_role('button',name=re.compile('Cancel operations'))).to_have_count(0,timeout=180000)
            expect(page.locator('.ops-feedback.error')).to_have_count(0)
        def tab(name):page.get_by_role('navigation',name='Operations panels').get_by_role('button',name=name,exact=True).click()
        def input(name):return page.get_by_role('spinbutton',name=name,exact=True)
        def run():
            tab('Manifest & design');page.get_by_role('button',name=re.compile('Run (operations|edited manifest)')).click();ready()
        def download():
            tab('Results & balance')
            with page.expect_download() as dl:page.get_by_role('button',name='Export shift report',exact=True).click()
            return json.loads(Path(dl.value.path()).read_text())
        def shot(name):
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Horizontal overflow: {page.viewport_size}'
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');page.screenshot(path=str(out/(name+'.png')),full_page=True)
        try:
            open_page();ready()
            report['webgl']=page.locator('.ops-scene[data-renderer="webgl"] canvas').count()==1
            if args.require_webgl:assert report['webgl'],'Operations must use actual WebGL in this run'
            expect(page.locator('.ops-badge')).not_to_contain_text('UNRUN')
            expect(page.get_by_role('button',name='Play operations replay',exact=True)).to_be_enabled()
            shot('operations-desktop');first=download()
            assert first['model']=='OPS-0.1.0' and len(first['rows'])==6
            assert first['outbound']>=3 and first['fuelUsedKg']<=40000.01
            assert first['unserved']>0 and first['finalFrame']['t']==43200
            assert abs(first['energyResidualJ'])<100 and abs(first['angularResidual'])<1e6
            done('Repeated outbound service uses a finite tank; calculated ledger and full observation horizon')
            page.get_by_role('button',name='Pin shift',exact=True).click()
            tab('Manifest & design');input('Observation horizon').fill('3');expect(page.locator('.ops-badge')).to_contain_text('UNRUN')
            # Old accepted results are not silently re-labeled by edits.
            stale=download();assert stale['plan']['horizonHours']==12 and stale['outbound']==first['outbound']
            page.get_by_role('button',name='Restore pinned shift',exact=True).click()
            tab('Manifest & design');expect(input('Observation horizon')).to_have_value('12')
            done('Unrun edits preserve accepted reports; pinned shift restores the exact original plan')
            page.get_by_role('region',name='Operations presets').get_by_role('button',name=re.compile('Make the return trip count')).click();ready()
            traffic=download();assert traffic['outbound']>=1 and traffic['inbound']>=1
            outbound=next(r for r in traffic['rows'] if r['status']=='delivered');inbound=next(r for r in traffic['rows'] if r['status']=='returned')
            assert outbound['massT']==inbound['massT'] and outbound['energyGainJ']>0 and inbound['energyGainJ']<0
            assert abs(outbound['energyGainJ']+inbound['energyGainJ'])>1e9
            assert traffic['fuelUsedKg']==0 and traffic['busEnergyJ']==0
            for r in [outbound,inbound]:assert r['encounter']['accepted'] and r['encounter']['positionErrorM']<=2 and r['encounter']['velocityErrorMs']<=.02
            report['traffic']={'outboundEnergyJ':outbound['energyGainJ'],'inboundEnergyJ':inbound['energyGainJ'],'equalMassT':inbound['massT']}
            tab('Live shift');page.get_by_role('combobox',name='Tracked operations object').select_option(outbound['id']);page.get_by_role('button',name='Follow',exact=True).click()
            page.get_by_role('slider',name='Operations replay time').fill(str(int(inbound['encounter']['capture'])+1));page.wait_for_timeout(100)
            expect(page.locator('.ops-scene')).to_have_attribute('data-follow-target',outbound['id'])
            if report['webgl']:assert float(page.locator('.ops-scene').get_attribute('data-follow-error'))<1e-6
            page.get_by_role('combobox',name='Tracked operations object').select_option(inbound['id'])
            expect(page.locator('.ops-scene')).to_have_attribute('data-follow-target',inbound['id']);shot('inbound-encounter')
            page.get_by_role('button',name='Restart',exact=True).click();expect(page.locator('.ops-scene')).to_have_attribute('data-follow-target','none');expect(page.locator('.ops-scene-label')).to_contain_text('not in the scene')
            page.get_by_role('button',name='Orbit plane',exact=True).click();page.get_by_role('slider',name='Operations replay time').fill(str(int(inbound['releasedAt'])+1));shot('inbound-plane')
            tab('Results & balance');shot('traffic-balance');done('Finite inbound transfers return calculated energy; identities persist independently through capture and scrubbing')
            # Three deliberately tight windows: occupied tether must not reschedule them.
            tab('Manifest & design');page.get_by_text('Generate a finite manifest',exact=True).click();input('Outbound count').fill('3');input('Inbound count').fill('0');page.get_by_role('button',name='Replace manifest with these rows',exact=True).click()
            page.get_by_role('combobox',name='Operations mode').select_option('schedule');input('Observation horizon').fill('1');input('Capture window half-width').fill('.5')
            for i in range(3):input(f'OUT-{i+1:02d} window center').fill(str(2+i))
            run();scheduled=download();assert scheduled['rows'][1]['status']=='missed' and scheduled['rows'][2]['status']=='missed'
            assert [r['atMinutes'] for r in scheduled['plan']['manifest']]==[2,3,4]
            shot('fixed-windows');done('Fixed capture windows stay unchanged, including those missed while the tether is occupied')
            tab('Manifest & design');page.get_by_role('combobox',name='Operations mode').select_option('capacity');input('Observation horizon').fill('2')
            if not args.isolated:
                page.get_by_role('button',name='Save plan',exact=True).click();stored=json.loads(page.evaluate("localStorage.getItem('skyhook-operations-v1')"));assert stored['horizonHours']==2
                input('Observation horizon').fill('3');page.get_by_role('button',name='Load',exact=True).click();ready();tab('Manifest & design');expect(input('Observation horizon')).to_have_value('2')
                page.get_by_role('button',name=re.compile('Share shift')).click();shared=page.get_by_role('textbox',name='Shareable operations link').input_value();assert '#ops=' in shared
                page.goto(shared,wait_until='networkidle');ready();assert download()['plan']==stored
                done('Native local Save/Load and versioned URL reload keep the finite manifest intact')
            page.get_by_role('region',name='Operations presets').get_by_role('button',name=re.compile('Power a longer shift')).click();ready();powered=download()
            assert powered['busEnergyJ']>0 and powered['fuelUsedKg']==0
            tab('Manifest & design');input('Observation horizon').fill('2');page.get_by_role('button',name=re.compile('Set power to zero')).click();run();off=download()
            assert off['dryMassKg']==powered['dryMassKg'] and off['busEnergyJ']==0 and off['fuelUsedKg']==0
            assert off['plan']['design']['edPowerKw']==0 and off['plan']['design']['recovery']=='electrodynamic'
            done('Power-off control retains electrical hardware mass and produces zero electrical work or hidden propellant')
            # Invalid numeric edits cannot erase the previous flight.
            tab('Manifest & design');input('Observation horizon').fill('25');expect(page.get_by_role('button',name=re.compile('Run (operations|edited manifest)'))).to_be_disabled();input('Observation horizon').fill('24')
            page.get_by_role('button',name=re.compile('Run (operations|edited manifest)')).click();page.get_by_role('button',name='Cancel operations',exact=True).click();expect(page.locator('.ops-feedback')).to_contain_text('cancelled');assert download()['plan']['horizonHours']==2
            done('Invalid plans are blocked; cancelling a live worker preserves the previous accepted shift')
            for width,height in [(1440,1000),(1280,800),(1000,900),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height})
                for name in ['Manifest & design','Live shift','Results & balance']:
                    tab(name);shot(f'{name.split()[0].lower()}-{width}')
            for width in [1440,390,320]:
                page.set_viewport_size({'width':width,'height':900});open_page('/lab/operations/method/');expect(page.get_by_role('heading',name='A service is more than two throws.')).to_be_visible();shot(f'method-{width}')
            if not args.isolated:
                for width in [1440,390,320]:
                    page.set_viewport_size({'width':width,'height':900});page.goto(origin+'/',wait_until='networkidle');expect(page.locator('.new-hero .launch-link')).to_have_attribute('href','/lab/');expect(page.get_by_role('link',name='Operate a cargo service ↗',exact=True)).to_be_visible();shot(f'homepage-{width}')
            done('Operations panels and its Method route remain readable without page overflow from 320 to 1440 px')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);page.screenshot(path=str(out/'failure.png'),full_page=True);raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()
if __name__=='__main__':main()
