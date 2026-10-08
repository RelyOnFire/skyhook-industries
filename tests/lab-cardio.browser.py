#!/usr/bin/env python3
"""Synchronized CardioRotovator geometry and separate passive diagnostics."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
import threading
from urllib.parse import quote
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
            exercise_reference(page,out)
            exercise_reference_release(page,out)
            exercise_reference_phases(page,out)
            exercise_reference_files(page,origin,out)
            page.get_by_text('Explore uncontrolled dynamics',exact=True).click()
            run=page.get_by_role('button',name='Compare pickup',exact=True)
            expect(run).to_be_enabled(timeout=90000)
            expect(page.get_by_test_id('cardio-empty-status')).to_have_text('One nominal orbit completed')
            expect(page.get_by_test_id('cardio-loaded-status')).to_have_text('One nominal orbit completed')
            page.evaluate("localStorage.setItem('skyhook-lab-design-v2','earth-kept');localStorage.setItem('skyhook-lab-t4-design-v1','t4-kept')")
            exercise_release(page,out,run)
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
            page.get_by_role('button',name='Reset passive scenario',exact=True).click();expect(run).to_be_enabled(timeout=90000)
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
            # Old passive designs preserve every numerical input, normalizing only the model version.
            legacy={**saved,'model':'C1p-0.1.0','phaseDeg':12,'payloadT':23}
            legacy_path=out/'legacy-cardio-design.json';legacy_path.write_text(json.dumps(legacy))
            page.locator('.cardio-diagnostics input[type=file]').set_input_files(str(legacy_path));expect(run).to_be_enabled(timeout=90000)
            expect(page.get_by_label('Apogee phase offset value',exact=True)).to_have_value('12')
            expect(page.get_by_label('Matched payload value',exact=True)).to_have_value('23')
            with page.expect_download() as info:page.get_by_role('button',name='Export design',exact=True).click()
            normalized_path=out/'normalized-cardio-design.json';info.value.save_as(normalized_path)
            normalized=json.loads(normalized_path.read_text());assert normalized=={**legacy,'model':'C1p-0.1.1'}
            assert page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")==raw,'Import overwrote the saved passive design'
            bad=out/'wrong-design.json';bad.write_text(json.dumps({'schema':2,'architecture':'single-stage-rotovator','model':'D1p-0.4.0'}))
            page.locator('.cardio-diagnostics input[type=file]').set_input_files(str(bad));expect(page.get_by_role('alert')).to_contain_text('CardioRotovator designs only')
            assert page.evaluate("localStorage.getItem('skyhook-lab-design-v2')")=='earth-kept'
            assert page.evaluate("localStorage.getItem('skyhook-lab-t4-design-v1')")=='t4-kept'
            assert await_free_databases(page)==[],'Cardio opened a campaign database'
            page.goto(origin+'/lab/architectures/',wait_until='networkidle')
            page.get_by_role('link',name='Open the CardioRotovator experiment').click()
            expect(page.get_by_test_id('cardio-reference-scene')).to_be_visible()
            expect(page.locator('.cardio-diagnostics')).not_to_have_attribute('open','')
            nojs=browser.new_context(java_script_enabled=False,viewport={'width':320,'height':800});guide=nojs.new_page();guide.goto(origin+'/lab/cardio/method/')
            expect(guide.get_by_role('heading',name='A long arm needs the right phase.')).to_be_visible()
            assert guide.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert not errors,errors
            (out/'report.json').write_text(json.dumps({'status':'passed','errors':errors},indent=2))
            print('PASS synchronized Cardio geometry, reference save/share/import, ideal releases, phase comparison and reports, apsis orientation, full-period closure, explicit replay, units, derived length, responsive primary view; separate pickup/release/timing workers, reports, legacy imports, isolated saves and catalogue')
            browser.close()
    finally:server.shutdown()
def exercise_release(page,out,run):
    panel=page.get_by_role('region',name='Payload release experiment',exact=True)
    calculate=panel.get_by_role('button',name='Calculate release',exact=True)
    page.evaluate("()=>{window.savedReleaseWorker=window.Worker;window.Worker=class{constructor(){throw Error('injected worker startup failure')}};}")
    calculate.click();expect(panel.get_by_role('alert')).to_have_text('Release calculation could not start. Try again.')
    expect(calculate).to_be_enabled();page.evaluate('window.Worker=window.savedReleaseWorker;delete window.savedReleaseWorker')
    calculate.click();expect(calculate).to_be_enabled(timeout=90000)
    try:expect(panel.get_by_text('Cargo orbit crosses the 120 km cutoff',exact=True)).to_be_visible()
    except Exception:
        print('Unexpected release panel:',panel.inner_text(),flush=True)
        panel.screenshot(path=str(out/'release-failure.png'))
        raise
    expect(panel.get_by_text('Stopped: cargo reached the 120 km cutoff.',exact=False)).to_be_visible()
    panel.get_by_role('button',name='Jump to release').click()
    expect(panel.get_by_text('Free cargo coast',exact=True)).to_be_visible()
    expect(panel.get_by_test_id('released-cargo')).to_be_visible()
    slider=panel.get_by_role('slider',name='Payload release replay time')
    before=float(slider.input_value());panel.get_by_role('button',name='Play release replay').click();page.wait_for_timeout(200)
    panel.get_by_role('button',name='Pause release replay').click();assert float(slider.input_value())>before
    stopped=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==stopped
    panel.get_by_label('Release after pickup value',exact=True).fill('')
    expect(calculate).to_be_disabled();expect(panel.get_by_role('button',name='Play release replay')).to_be_disabled()
    panel.get_by_label('Release after pickup value',exact=True).fill('90');calculate.click();expect(calculate).to_be_enabled(timeout=90000)
    expect(panel.get_by_text('Reached the end of the nominal orbit.',exact=False)).to_be_visible()
    expect(panel.get_by_text('Cargo orbit crosses the 120 km cutoff',exact=True)).to_be_visible()
    page.get_by_label('Initial spins per orbit value',exact=True).fill('2.75')
    expect(calculate).to_be_disabled();run.click();expect(run).to_be_enabled(timeout=90000)
    expect(panel.get_by_label('Release after pickup value',exact=True)).to_have_value('25')
    calculate.click();expect(calculate).to_be_enabled(timeout=90000)
    expect(panel.get_by_text('Cargo orbit clears the 120 km cutoff',exact=True)).to_be_visible()
    slider.fill(slider.get_attribute('max'))
    expect(panel.get_by_test_id('released-cargo')).to_be_visible()
    for width in [1440,768,320]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'release overflow {width}'
        panel.screenshot(path=str(out/f'release-{width}.png'))
    page.get_by_role('combobox',name='Distance unit').select_option('m')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'release metre overflow'
    page.get_by_role('combobox',name='Distance unit').select_option('km')
    panel.get_by_text('Release accounting & report',exact=True).click()
    with page.expect_download() as info:panel.get_by_role('button',name='Export release report').click()
    path=out/'release-download.json';info.value.save_as(path);report=json.loads(path.read_text())
    assert report['model']=='C1r-0.1.1' and report['fraction']==.25 and report['design']['spinRatio']==2.75
    assert report['release']['cargoOrbit']['perigee']>120000 and report['energyDrift']<1e-8
    assert report['frames'][-1]['released'] and report['frames'][-1]['cargo']
    exercise_timing(page,panel,out,report)
    # The old design format and pickup defaults are independent of release timing.
    page.get_by_role('button',name='Reset passive scenario',exact=True).click();expect(run).to_be_enabled(timeout=90000)
    expect(panel.get_by_label('Release after pickup value',exact=True)).to_have_value('25')
    expect(panel.get_by_role('button',name='Jump to release')).to_have_count(0)

def exercise_timing(page,panel,out,accepted):
    study=panel.get_by_role('region',name='Release timing comparison',exact=True)
    compare=study.get_by_role('button',name='Compare release times',exact=True)
    field=panel.get_by_label('Release after pickup value',exact=True)
    field.fill('25.123456789');compare.click();expect(compare).to_be_enabled(timeout=90000)
    expect(study.locator('.cardio-timing-grid button')).to_have_count(19)
    expect(study.get_by_role('status')).to_contain_text('Comparison complete.')
    # Running a comparison leaves the accepted single-flight replay untouched.
    expect(panel.get_by_role('slider',name='Payload release replay time')).to_have_value(str(accepted['duration']))
    with page.expect_download() as info:study.get_by_role('button',name='Export timing comparison').click()
    path=out/'timing-study.json';info.value.save_as(path);report=json.loads(path.read_text())
    assert report['complete'] and len(report['results'])==19 and len(report['plan'])==19
    assert report['design']==accepted['design'] and any(abs(f-.25123456789)<1e-14 for f in report['plan'])
    assert any(r['outcome']['clear'] for r in report['results']) and any(not r['outcome']['clear'] for r in report['results'])
    for width in [1440,768,320]:
        page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert study.locator('.cardio-timing-grid button').evaluate_all('(buttons)=>buttons.every(b=>b.scrollWidth<=b.clientWidth+1)'),f'timing card overflow {width}'
        study.screenshot(path=str(out/f'timing-{width}.png'))
    chosen=study.get_by_role('button',name='Open release at 25%: Clear bound coast',exact=True)
    chosen.focus();page.keyboard.press('Enter');expect(panel.locator('.cardio-release-verdict')).to_be_focused()
    expect(field).to_have_value('25');expect(panel.get_by_role('slider',name='Payload release replay time')).to_have_value(str(accepted['release']['t']))
    with page.expect_download() as info:panel.get_by_role('button',name='Export release report').click()
    path=out/'timing-selected-flight.json';info.value.save_as(path);assert json.loads(path.read_text())==accepted
    # Preserve a partial run and reject late queued results after cancellation.
    page.evaluate("""()=>{
      window.timingStopWorker=window.Worker;
      window.Worker=class extends window.timingStopWorker{
        set onmessage(handler){let stopped=false;super.onmessage=e=>{
          handler.call(this,e);
          if(e.data.result&&!stopped){stopped=true;queueMicrotask(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Stop timing comparison')?.click());}
        };}
      };
    }""")
    compare.click();expect(study.get_by_role('status')).to_contain_text('Comparison stopped.',timeout=90000)
    page.evaluate('window.Worker=window.timingStopWorker;delete window.timingStopWorker')
    count=study.locator('.cardio-timing-grid button').count();assert 0<count<18
    page.wait_for_timeout(200);expect(study.locator('.cardio-timing-grid button')).to_have_count(count)
    with page.expect_download() as info:study.get_by_role('button',name='Export timing comparison').click()
    path=out/'timing-partial.json';info.value.save_as(path);partial=json.loads(path.read_text());assert not partial['complete'] and len(partial['results'])==count
    expect(panel.get_by_role('slider',name='Payload release replay time')).to_have_value(str(accepted['release']['t']))
    study.get_by_role('button',name='Clear comparison').click();expect(compare).to_be_focused()
    page.evaluate("()=>{window.savedTimingWorker=window.Worker;window.Worker=class{constructor(){throw Error('injected timing startup failure')}};}")
    compare.click();expect(study.get_by_role('alert')).to_have_text('Timing comparison could not start. Try again.')
    expect(compare).to_be_enabled();page.evaluate('window.Worker=window.savedTimingWorker;delete window.savedTimingWorker')
    compare.click();expect(compare).to_be_enabled(timeout=90000);expect(study.locator('.cardio-timing-grid button')).to_have_count(18)
    field.fill('');expect(compare).to_be_disabled();expect(study.get_by_role('button',name='Export timing comparison')).to_be_disabled()
    expect(chosen).to_be_disabled();field.fill('25')
    page.get_by_label('Initial spins per orbit value',exact=True).fill('2.8');expect(compare).to_be_disabled();expect(chosen).to_be_disabled()

def numeric(locator):
    match=re.search(r'-?[\d,]+(?:\.\d+)?',locator.inner_text())
    assert match,locator.inner_text()
    return float(match.group().replace(',',''))

def exercise_reference(page,out):
    reference=page.get_by_test_id('cardio-reference')
    scene=reference.get_by_test_id('cardio-reference-scene')
    expect(scene).to_be_visible()
    expect(page.locator('.cardio-diagnostics')).not_to_have_attribute('open','')
    slider=reference.get_by_role('slider',name='Synchronized reference time',exact=True)
    arm=reference.get_by_test_id('cardio-reference-arm-length')
    altitude=reference.get_by_test_id('cardio-reference-tip-altitude')
    assert numeric(arm)==2100 and numeric(altitude)==100
    assert float(scene.get_attribute('data-arm-radial-dot'))<0,'Apogee arm must point inward'
    before=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==before,'Reference autoplayed'
    line=reference.get_by_test_id('cardio-reference-moving-arm').locator('line')
    initial=line.evaluate('(el)=>["x1","y1","x2","y2"].map(name=>+el.getAttribute(name))')
    reference.get_by_role('button',name='Perigee clearance',exact=True).click()
    assert float(scene.get_attribute('data-arm-radial-dot'))>0,'Perigee arm must point outward'
    assert numeric(altitude)==2300
    reference.screenshot(path=str(out/'reference-perigee-1440.png'))
    slider.fill(str(round(float(slider.get_attribute('max'))/4,3)))
    reference.screenshot(path=str(out/'reference-quarter-1440.png'))
    reference.get_by_role('button',name='Apogee pickup',exact=True).click();expect(slider).to_have_value('0')
    slider.press('End')
    final=line.evaluate('(el)=>["x1","y1","x2","y2"].map(name=>+el.getAttribute(name))')
    assert all(abs(a-b)<1e-6 for a,b in zip(initial,final)),'Synchronized orbit must close'
    assert numeric(altitude)==100
    reference.get_by_role('button',name='Play synchronized reference').click();page.wait_for_timeout(200)
    reference.get_by_role('button',name='Pause synchronized reference').click();assert 0<float(slider.input_value())<float(slider.get_attribute('max'))
    stopped=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==stopped
    saved=page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")
    reference.get_by_label('Station apogee value',exact=True).fill('2400');assert numeric(arm)==2300
    reference.get_by_label('Pickup altitude value',exact=True).fill('120');assert numeric(arm)==2280 and numeric(altitude)==120
    reference.get_by_role('button',name='Perigee clearance',exact=True).click();assert numeric(altitude)==2480
    page.get_by_role('combobox',name='Distance unit').select_option('m')
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2400000')
    expect(reference.get_by_label('Pickup altitude value',exact=True)).to_have_value('120000')
    assert numeric(arm)==2280000 and numeric(altitude)==2480000
    page.get_by_role('combobox',name='Distance unit').select_option('km')
    reference.get_by_label('Pickup altitude value',exact=True).fill('')
    expect(reference.get_by_role('button',name='Play synchronized reference')).to_be_disabled()
    expect(slider).to_be_disabled()
    reference.get_by_label('Pickup altitude value',exact=True).fill('120')
    reference.get_by_label('Station apogee value',exact=True).fill('500')
    reference.get_by_label('Station perigee value',exact=True).fill('600')
    expect(reference.get_by_role('alert')).to_have_text('Station apogee must be above perigee.')
    expect(reference.get_by_role('button',name='Play synchronized reference')).to_be_disabled()
    reference.get_by_role('button',name='Reset reference geometry',exact=True).click()
    expect(reference.get_by_role('button',name='Play synchronized reference')).to_be_enabled()
    assert numeric(arm)==2100 and numeric(altitude)==100
    assert page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")==saved,'Reference edits touched a saved passive design'
    for width in [1440,1000,768,390,320]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'reference overflow {width}'
        assert reference.locator('.cardio-reference-readout dd').evaluate_all('(nodes)=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)'),f'reference quantity overflow {width}'
        page.screenshot(path=str(out/f'reference-{width}.png'),full_page=True)
    page.get_by_role('combobox',name='Distance unit').select_option('m')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'reference metre overflow at320px'
    page.screenshot(path=str(out/'reference-metres-320.png'),full_page=True)
    page.get_by_role('combobox',name='Distance unit').select_option('km')
    page.set_viewport_size({'width':1440,'height':1000})

def exercise_reference_release(page,out):
    reference=page.get_by_test_id('cardio-reference')
    result=reference.get_by_role('region',name='Reference release trajectory')
    trace=reference.get_by_role('button',name='Trace release here',exact=True)
    path=reference.get_by_test_id('cardio-reference-release-path')
    slider=reference.get_by_role('slider',name='Synchronized reference time',exact=True)
    stored=page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")
    trace.click();expect(result.get_by_role('status')).to_have_text('Release point is below the 120 km cutoff')
    expect(path).to_have_count(0)
    reference.get_by_role('button',name='Perigee clearance',exact=True).click();expect(result).to_have_count(0)
    trace.click();expect(result.get_by_role('status')).to_have_text('Earth escape trajectory')
    expect(path).to_be_visible()
    start=path.locator('polyline').evaluate('(el)=>el.getAttribute("points").split(" ")[0].split(",").map(Number)')
    tip=reference.get_by_test_id('cardio-reference-moving-arm').locator('line').evaluate('(el)=>[+el.getAttribute("x2"),+el.getAttribute("y2")]')
    assert all(abs(a-b)<1e-6 for a,b in zip(start,tip)),'Release must start at the visible tip'
    assert path.locator('polyline').evaluate('(el)=>el.getAttribute("points").split(" ").every(pair=>{const [x,y]=pair.split(",").map(Number);return x>0&&x<800&&y>0&&y<620;})'),'Release trace clipped'
    with page.expect_download() as info:result.get_by_role('button',name='Export reference release').click()
    download=out/'reference-release-report.json';info.value.save_as(download);report=json.loads(download.read_text())
    assert report['format']=='skyhook-cardio-reference-release' and report['model']=='C1k-0.1.0'
    assert report['fraction']==.5 and report['design']=={'perigeeKm':200,'apogeeKm':2200,'pickupKm':100}
    assert report['initial']==report['frames'][0]['state'] and report['elements']['energy']>0
    assert report['status']=='horizon' and report['duration']==1800 and report['energyError']<1e-8
    for width in [1440,768,320]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'reference release overflow {width}'
        reference.screenshot(path=str(out/f'reference-release-{width}.png'))
    page.get_by_role('combobox',name='Distance unit').select_option('m')
    assert result.locator('dd').evaluate_all('(nodes)=>nodes.every(el=>el.getBoundingClientRect().right<=el.closest("section").getBoundingClientRect().right-5)'), 'Release quantities cropped at320px'
    result.screenshot(path=str(out/'reference-release-metres-320.png'))
    page.get_by_role('combobox',name='Distance unit').select_option('km')
    selected=slider.input_value();result.get_by_role('button',name='Clear release trace').click()
    expect(path).to_have_count(0);expect(result).to_have_count(0);assert slider.input_value()==selected
    slider.fill(str(round(float(slider.get_attribute('max'))/4,3)));trace.click()
    expect(result.get_by_role('status')).to_have_text('Earth-bound trajectory')
    slider.fill(str(round(float(slider.get_attribute('max'))/8,3)));expect(result).to_have_count(0);trace.click()
    expect(result.get_by_role('status')).to_have_text('Trajectory crosses the 120 km cutoff')
    expect(result).to_contain_text('The drawn coast stops at 120 km')
    page.get_by_role('combobox',name='Distance unit').select_option('m')
    assert result.locator('dd').evaluate_all('(nodes)=>nodes.every(el=>el.getBoundingClientRect().right<=el.closest("section").getBoundingClientRect().right-5)')
    result.screenshot(path=str(out/'reference-crossing-metres-320.png'))
    page.get_by_role('combobox',name='Distance unit').select_option('km')
    reference.get_by_label('Station apogee value',exact=True).fill('2400');expect(result).to_have_count(0)
    reference.get_by_role('button',name='Perigee clearance',exact=True).click();trace.click()
    reference.get_by_role('button',name='Play synchronized reference').click();expect(result).to_have_count(0)
    reference.get_by_role('button',name='Pause synchronized reference').click()
    reference.get_by_label('Pickup altitude value',exact=True).fill('');expect(trace).to_be_disabled()
    reference.get_by_role('button',name='Reset reference geometry',exact=True).click()
    assert page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")==stored
    page.set_viewport_size({'width':1440,'height':1000})

def exercise_reference_phases(page,out):
    reference=page.get_by_test_id('cardio-reference')
    comparison=reference.get_by_test_id('cardio-reference-phases')
    result=reference.get_by_role('region',name='Reference release trajectory')
    saved=page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")
    reference.get_by_role('button',name='Perigee clearance',exact=True).click()
    reference.get_by_role('button',name='Trace release here',exact=True).click()
    before=reference.get_by_test_id('cardio-reference-release-path').locator('polyline').get_attribute('points')
    comparison.get_by_text('Compare release phases',exact=True).click()
    samples=comparison.locator('.cardio-reference-phase-grid button')
    expect(samples).to_have_count(21)
    assert reference.get_by_test_id('cardio-reference-release-path').locator('polyline').get_attribute('points')==before
    expect(result.get_by_role('status')).to_have_text('Earth escape trajectory')
    with page.expect_download() as info:comparison.get_by_role('button',name='Export phase comparison').click()
    download=out/'reference-phases.json';info.value.save_as(download);report=json.loads(download.read_text())
    assert report['format']=='skyhook-cardio-reference-phases' and report['analysis']=='release-state orbit elements'
    assert report['design']=={'perigeeKm':200,'apogeeKm':2200,'pickupKm':100} and len(report['samples'])==21
    assert report['samples'][5]['outcome']=='bound' and report['samples'][10]['outcome']=='escape'
    selected=comparison.get_by_role('button',name='Trace at 25%: Earth-bound',exact=True)
    selected.focus();page.keyboard.press('Enter');expect(selected).to_be_focused();expect(selected).to_have_attribute('aria-pressed','true')
    expect(result.get_by_role('status')).to_have_text('Earth-bound trajectory')
    with page.expect_download() as info:result.get_by_role('button',name='Export reference release').click()
    download=out/'reference-phase-selected.json';info.value.save_as(download);coast=json.loads(download.read_text())
    assert coast['fraction']==.25 and coast['initial']==report['samples'][5]['initial'] and coast['elements']==report['samples'][5]['elements']
    for width in [1440,768,320]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'phase comparison overflow {width}'
        assert samples.evaluate_all('(nodes)=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().width>=44&&el.getBoundingClientRect().height>=44)'),f'phase target size {width}'
        comparison.screenshot(path=str(out/f'reference-phases-{width}.png'))
    page.get_by_role('combobox',name='Distance unit').select_option('m')
    expect(selected).to_have_attribute('aria-pressed','true');expect(result.get_by_role('status')).to_have_text('Earth-bound trajectory')
    page.get_by_role('combobox',name='Distance unit').select_option('km')
    reference.get_by_label('Station apogee value',exact=True).fill('2800');expect(result).to_have_count(0)
    expect(comparison.locator('button[aria-pressed=true]')).to_have_count(0)
    with page.expect_download() as info:comparison.get_by_role('button',name='Export phase comparison').click()
    download=out/'reference-phases-edited.json';info.value.save_as(download);edited=json.loads(download.read_text())
    assert edited['design']['apogeeKm']==2800 and edited['samples'][10]['elements']['energy']!=report['samples'][10]['elements']['energy']
    reference.get_by_label('Pickup altitude value',exact=True).fill('')
    expect(samples).to_have_count(0);expect(comparison.get_by_role('button',name='Export phase comparison')).to_have_count(0)
    expect(comparison).to_contain_text('Enter valid reference geometry')
    reference.get_by_role('button',name='Reset reference geometry',exact=True).click();expect(samples).to_have_count(21)
    comparison.get_by_role('button',name='Trace at 0%: Below cutoff',exact=True).click()
    expect(result.get_by_role('status')).to_have_text('Release point is below the 120 km cutoff')
    reference.get_by_role('button',name='Reset reference geometry',exact=True).click()
    comparison.get_by_text('Compare release phases',exact=True).click()
    assert page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")==saved
    page.set_viewport_size({'width':1440,'height':1000})

def exercise_reference_files(page,origin,out):
    reference=page.get_by_test_id('cardio-reference')
    files=reference.get_by_role('region',name='Reference files and sharing')
    key='skyhook-lab-cardio-reference-v1'
    page.evaluate("localStorage.setItem('skyhook-lab-cardio-design-v1','passive-kept')")
    files.get_by_role('button',name='Load reference',exact=True).click()
    expect(files.get_by_role('alert')).to_contain_text('No reference has been saved')
    reference.get_by_label('Station apogee value',exact=True).fill('2800')
    reference.get_by_label('Pickup altitude value',exact=True).fill('120')
    slider=reference.get_by_role('slider',name='Synchronized reference time',exact=True)
    slider.fill(str(round(float(slider.get_attribute('max'))*.25123456789,6)))
    reference.get_by_role('button',name='Trace release here',exact=True).click()
    phase_time=reference.get_by_test_id('cardio-reference-scene').get_attribute('data-time')
    files.get_by_role('button',name='Save reference',exact=True).click()
    expect(files.get_by_role('status')).to_have_text('Reference saved in this browser.')
    raw=page.evaluate('(key)=>localStorage.getItem(key)',key);saved=json.loads(raw)
    assert saved['format']=='skyhook-cardio-reference' and saved['version']==1 and saved['showTrace']
    assert saved['design']=={'perigeeKm':200,'apogeeKm':2800,'pickupKm':120} and abs(saved['phase']-.25123456789)<1e-9
    reference.get_by_role('button',name='Reset reference geometry',exact=True).click()
    files.get_by_role('button',name='Load reference',exact=True).click()
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
    expect(reference.get_by_test_id('cardio-reference-scene')).to_have_attribute('data-time',phase_time)
    expect(reference.get_by_test_id('cardio-reference-release-path')).to_be_visible()
    files.get_by_text('Reference files',exact=True).click()
    with page.expect_download() as info:files.get_by_role('button',name='Export reference',exact=True).click()
    exported=out/'reference-setup.json';info.value.save_as(exported);assert json.loads(exported.read_text())==saved
    files.get_by_role('button',name='Share reference',exact=True).click()
    share=files.get_by_label('Shareable reference link');expect(share).to_be_visible();shared=share.input_value()
    assert '#cardio-reference=' in shared and '#cardio=' not in shared
    page.goto(shared,wait_until='networkidle')
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
    expect(reference.get_by_test_id('cardio-reference-scene')).to_have_attribute('data-time',phase_time)
    expect(reference.get_by_test_id('cardio-reference-release-path')).to_be_visible()
    expect(reference.get_by_role('button',name='Play synchronized reference')).to_be_enabled()
    stopped=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==stopped
    assert not page.locator('.cardio-diagnostics').evaluate('(el)=>el.open')
    assert page.evaluate('(key)=>localStorage.getItem(key)',key)==raw,'Shared link overwrote the saved reference'
    reference.get_by_role('button',name='Reset reference geometry',exact=True).click()
    assert 'cardio-reference=' not in page.url
    files.get_by_label('Import reference file').set_input_files(str(exported))
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
    expect(reference.get_by_test_id('cardio-reference-scene')).to_have_attribute('data-time',phase_time)
    assert page.evaluate('(key)=>localStorage.getItem(key)',key)==raw,'Import wrote browser storage'
    for name,value in [('wrong',{'schema':1,'model':'C1p-0.1.1'}),('future',{**saved,'version':2}),('bad-phase',{**saved,'phase':2})]:
        bad=out/f'reference-{name}.json';bad.write_text(json.dumps(value))
        files.get_by_label('Import reference file').set_input_files(str(bad));expect(files.get_by_role('alert')).to_be_visible()
        expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
        expect(reference.get_by_test_id('cardio-reference-scene')).to_have_attribute('data-time',phase_time)
        assert page.evaluate('(key)=>localStorage.getItem(key)',key)==raw
    big=out/'reference-too-large.json';big.write_text('x'*16385)
    files.get_by_label('Import reference file').set_input_files(str(big));expect(files.get_by_role('alert')).to_contain_text('16 KB')
    reference.get_by_label('Station apogee value',exact=True).fill('3000')
    page.evaluate("()=>{window.referenceSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='skyhook-lab-cardio-reference-v1')throw Error('injected storage failure');return window.referenceSetItem.call(this,key,value)}}")
    files.get_by_role('button',name='Save reference',exact=True).click()
    expect(files.get_by_role('alert')).to_contain_text('injected storage failure')
    page.evaluate('Storage.prototype.setItem=window.referenceSetItem;delete window.referenceSetItem')
    assert page.evaluate('(key)=>localStorage.getItem(key)',key)==raw
    files.get_by_role('button',name='Load reference',exact=True).click()
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
    reference.get_by_label('Pickup altitude value',exact=True).fill('')
    for name in ['Save reference','Share reference']:expect(files.get_by_role('button',name=name,exact=True)).to_be_disabled()
    files.get_by_role('button',name='Load reference',exact=True).click()
    for width in [1440,768,320]:
        page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        files.screenshot(path=str(out/f'reference-files-{width}.png'))
    files.get_by_role('button',name='Share reference',exact=True).click();expect(share).to_be_visible()
    files.screenshot(path=str(out/'reference-share-320.png'))
    reference.get_by_label('Station apogee value',exact=True).fill('2900');expect(share).to_have_count(0)
    assert page.evaluate("localStorage.getItem('skyhook-lab-cardio-design-v1')")=='passive-kept'
    page.goto(origin+'/lab/cardio/#cardio-reference='+quote(json.dumps({**saved,'version':9})),wait_until='networkidle')
    expect(files.get_by_role('alert')).to_contain_text('Shared reference rejected')
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2900')
    page.reload(wait_until='networkidle')
    expect(files.get_by_role('alert')).to_contain_text('Shared reference rejected')
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2200')
    assert page.evaluate('(key)=>localStorage.getItem(key)',key)==raw
    page.goto(origin+'/lab/cardio/#cardio-reference='+quote(json.dumps(saved)),wait_until='networkidle')
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
    expect(reference.get_by_test_id('cardio-reference-scene')).to_have_attribute('data-time',phase_time)
    expect(files.get_by_role('alert')).to_have_count(0)
    page.goto(origin+'/lab/cardio/',wait_until='networkidle')
    files.get_by_role('button',name='Load reference',exact=True).click()
    expect(reference.get_by_label('Station apogee value',exact=True)).to_have_value('2800')
    reference.get_by_role('button',name='Play synchronized reference').click();page.wait_for_timeout(150)
    files.get_by_role('button',name='Save reference',exact=True).click()
    expect(reference.get_by_role('button',name='Play synchronized reference')).to_be_enabled()
    stopped=slider.input_value();page.wait_for_timeout(150);assert slider.input_value()==stopped
    assert not json.loads(page.evaluate('(key)=>localStorage.getItem(key)',key))['showTrace']
    page.evaluate("localStorage.removeItem('skyhook-lab-cardio-design-v1')")
    page.goto(origin+'/lab/cardio/',wait_until='networkidle');page.set_viewport_size({'width':1440,'height':1000})

def await_free_databases(page):return page.evaluate('indexedDB.databases()')
if __name__=='__main__':main()
