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
            print('PASS Cardio pickup/release/timing workers, complete and partial studies, exact inspection, safe/unsafe orbits, separation replay, reports, limit stop, phase/payload editing, isolated save/share/import, display units, cancellation, report, catalogue and five widths')
            browser.close()
    finally:server.shutdown()
def exercise_release(page,out,run):
    panel=page.get_by_role('region',name='Payload release experiment',exact=True)
    calculate=panel.get_by_role('button',name='Calculate release',exact=True)
    page.evaluate("()=>{window.savedReleaseWorker=window.Worker;window.Worker=class{constructor(){throw Error('injected worker startup failure')}};}")
    calculate.click();expect(panel.get_by_role('alert')).to_have_text('Release calculation could not start. Try again.')
    expect(calculate).to_be_enabled();page.evaluate('window.Worker=window.savedReleaseWorker;delete window.savedReleaseWorker')
    calculate.click();expect(calculate).to_be_enabled(timeout=90000)
    expect(panel.get_by_text('Cargo orbit crosses the 120 km cutoff',exact=True)).to_be_visible()
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
    assert report['model']=='C1r-0.1.0' and report['fraction']==.25 and report['design']['spinRatio']==2.75
    assert report['release']['cargoOrbit']['perigee']>120000 and report['energyDrift']<1e-8
    assert report['frames'][-1]['released'] and report['frames'][-1]['cargo']
    exercise_timing(page,panel,out,report)
    # The old design format and pickup defaults are independent of release timing.
    page.get_by_role('button',name='Reference scenario',exact=True).click();expect(run).to_be_enabled(timeout=90000)
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

def await_free_databases(page):return page.evaluate('indexedDB.databases()')
if __name__=='__main__':main()
