#!/usr/bin/env python3
"""Native-origin brand and interactive editorial scene regression.
No screenshots from the reference are served by the website. Actual Three.js
geometry, ordinary module loading and normal HTTP are exercised here.
"""
from __future__ import annotations
import argparse,json,threading
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--executable');parser.add_argument('--output',default='qa/browser/brand-motion');args=parser.parse_args()
    out=ROOT/args.output;out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}';report={'mode':'native localhost','webgl':False,'checks':[],'errors':[]}
    def done(text):print('PASS',text,flush=True);report['checks'].append(text)
    with sync_playwright() as p:
        opts={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
        if args.executable:opts['executable_path']=args.executable
        else:opts['channel']='chromium'
        browser=p.chromium.launch(**opts);context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
        page=context.new_page();page.set_default_timeout(20000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
        def shot(name,element=None):
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Horizontal overflow'
            if element:element.screenshot(path=str(out/(name+'.png')))
            else:page.screenshot(path=str(out/(name+'.png')),full_page=True)
        try:
            for route in ['/','/research/','/lab/','/lab/operations/','/lab/method/']:
                page.goto(origin+route,wait_until='networkidle')
                expect(page.locator('.brand-header .comet-brand-mark')).to_have_count(1)
                expect(page.locator('.brand-symbol,.wordmark-mark')).to_have_count(0)
                assert page.locator('.brand-header img').evaluate('i=>i.complete&&i.naturalWidth>=128')
                assert page.locator('link[rel="icon"]').count()==2
                for link in page.locator('link[rel="icon"],link[rel="apple-touch-icon"]').all():
                    response=context.request.get(origin+link.get_attribute('href'));assert response.status==200
                assert not page.locator('link[href*="favicon.svg"]').count()
            done('Recovered comet loads in shared header; real ICO/PNG/touch icons resolve across company and lab pages')
            for width,height in [(1440,1000),(1280,800),(768,1024),(390,844),(320,800)]:
                page.set_viewport_size({'width':width,'height':height});page.goto(origin+'/',wait_until='networkidle')
                expect(page.locator('.heritage-line')).to_have_text('A hook hanging from the clouds.')
                shot(f'homepage-{width}')
                root=page.locator('#capture-terminal');root.scroll_into_view_if_needed()
                expect(root).to_have_attribute('data-renderer','webgl',timeout=30000)
                report['webgl']=True
                expect(root.locator('[data-terminal-action="rotate"]')).to_be_disabled()
                expect(root.locator('[data-terminal-mode="assembled"]')).to_have_attribute('aria-pressed','true')
                shot(f'terminal-assembled-{width}',root)
                root.locator('[data-terminal-mode="exploded"]').click()
                expect(root).to_have_attribute('data-spread','1.0000')
                root.locator('[data-part-button="2"]').click();expect(root).to_have_attribute('data-part','2')
                expect(root.locator('#terminal-part-2')).to_be_visible();expect(root.locator('#terminal-part-0')).not_to_be_visible()
                assert root.locator('[data-terminal-caption]').inner_text()=='03 / CAPTURE INTERFACE'
                shot(f'terminal-exploded-{width}',root)
                root.locator('[data-part-button="1"]').focus();page.keyboard.press('Space')
                expect(root).to_have_attribute('data-part','1')
                root.locator('[data-terminal-mode="assembled"]').click();expect(root).to_have_attribute('data-spread','0.0000')
                root.locator('[data-terminal-action="reset"]').click()
            done('Assemble/explode, numbered component selection, keyboard controls and instant reduced-motion state at five widths')
            # Check actual animated geometry, not only changed button text.
            page.set_viewport_size({'width':1440,'height':1000});page.emulate_media(reduced_motion='no-preference')
            root.scroll_into_view_if_needed();canvas=root.locator('canvas')
            before=canvas.screenshot();root.locator('[data-terminal-mode="exploded"]').click()
            expect(root).to_have_attribute('data-spread','1.0000',timeout=10000)
            assert canvas.screenshot()!=before
            root.locator('[data-terminal-action="rotate"]').click();expect(root).to_have_attribute('data-rotating','true')
            before=canvas.screenshot();page.wait_for_timeout(600);assert canvas.screenshot()!=before
            root.locator('[data-terminal-action="rotate"]').click();expect(root).to_have_attribute('data-rotating','false')
            page.wait_for_timeout(200);count=root.get_attribute('data-render-count');page.wait_for_timeout(200);assert root.get_attribute('data-render-count')==count,'Paused scene keeps rendering'
            root.locator('[data-terminal-action="rotate"]').click();page.evaluate('window.scrollTo(0,0)');expect(root).to_have_attribute('data-visible','false')
            page.wait_for_timeout(100);count=root.get_attribute('data-render-count');page.wait_for_timeout(400);assert root.get_attribute('data-render-count')==count,'Offscreen scene keeps rendering'
            root.scroll_into_view_if_needed();page.emulate_media(reduced_motion='reduce');expect(root).to_have_attribute('data-rotating','false');expect(root.locator('[data-terminal-action="rotate"]')).to_be_disabled()
            done('Exploded geometry really moves; rotation pauses; offscreen rendering stops; runtime reduced-motion changes stop rotation')
            # A unavailable graphics context retains all essential content.
            fallback=context.new_page();fallback.on('pageerror',lambda e:report['errors'].append(str(e)))
            fallback.add_init_script("""(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:native.call(this,type,...args)}})()""")
            fallback.goto(origin+'/',wait_until='networkidle');fr=fallback.locator('#capture-terminal');fr.scroll_into_view_if_needed();expect(fr).to_have_attribute('data-renderer','fallback')
            expect(fr.locator('.terminal-fallback')).to_be_visible();fr.locator('[data-terminal-mode="exploded"]').click();expect(fr).to_have_attribute('data-exploded','true')
            fr.locator('[data-part-button="2"]').click();expect(fr.locator('#terminal-part-2')).to_be_visible()
            fallback.screenshot(path=str(out/'static-fallback.png'),full_page=True);fallback.close()
            static_context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});static=static_context.new_page();static.goto(origin+'/')
            expect(static.locator('.terminal-fallback')).to_be_visible();assert static.locator('.terminal-part-copy:visible').count()==3
            assert static.locator('.brand-header img').evaluate('i=>i.complete&&i.naturalWidth>0')
            static.screenshot(path=str(out/'no-javascript.png'),full_page=True);static_context.close()
            done('No-WebGL fallback remains interactive; no-JavaScript page retains logo, schematic and all explanations')
            assert not report['errors'],report['errors'];report['status']='passed'
        except Exception as e:
            report['status']='failed';report['failure']=str(e);page.screenshot(path=str(out/'failure.png'),full_page=True);raise
        finally:
            (out/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown()
if __name__=='__main__':main()
