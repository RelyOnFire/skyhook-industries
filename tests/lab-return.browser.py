#!/usr/bin/env python3
"""Returning-cargo recovery: real worker, safe/unsafe results and responsive replay."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    out=ROOT/'qa/browser/return';out.mkdir(parents=True,exist_ok=True)
    errors=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/lab/',wait_until='networkidle')
            opener=page.get_by_role('button',name='Return-traffic recovery',exact=True)
            expect(opener).to_be_enabled(timeout=90000)
            saved=page.evaluate('JSON.stringify({...localStorage})')
            opener.click()
            dialog=page.get_by_role('dialog')
            expect(dialog.get_by_role('heading',name='Recover with returning cargo')).to_be_visible()
            dialog.get_by_role('button',name='Compare return exchange',exact=True).click()
            expect(dialog.locator('[data-return-status]')).to_have_attribute('data-return-status','complete',timeout=90000)
            expect(dialog).to_contain_text('52.1%')
            expect(dialog).to_contain_text('Energy return alone has not restored')
            slider=dialog.get_by_role('slider',name='Return replay time')
            before=slider.input_value();page.wait_for_timeout(200);assert slider.input_value()==before
            dialog.get_by_role('button',name='Play return replay').click()
            page.wait_for_timeout(250);assert slider.input_value()!=before
            dialog.get_by_role('button',name='Pause return replay').click()
            for width in [1440,768,390,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert not dialog.evaluate('d=>d.scrollWidth>d.clientWidth+1'), f'Return modal overflow at {width}'
                dialog.screenshot(path=str(out/f'return-{width}.png'))
            dialog.get_by_label('Return swing (°)',exact=True).fill('120')
            expect(dialog.locator('[data-return-status]')).to_have_count(0)
            dialog.get_by_role('button',name='Compare return exchange',exact=True).click()
            expect(dialog.locator('[data-return-status]')).to_have_attribute('data-return-status','unsafe-release',timeout=90000)
            expect(dialog).to_contain_text('Release is not usable')
            dialog.get_by_label('Returning mass (t)',exact=True).fill('')
            expect(dialog.get_by_role('button',name='Compare return exchange',exact=True)).to_be_disabled()
            dialog.get_by_label('Returning mass (t)',exact=True).fill('3')
            dialog.get_by_role('button',name='Compare return exchange',exact=True).click()
            dialog.get_by_role('button',name='Cancel',exact=True).click()
            expect(dialog.get_by_role('button',name='Compare return exchange',exact=True)).to_be_enabled()
            page.keyboard.press('Escape');expect(dialog).to_have_count(0)
            assert page.evaluate('JSON.stringify({...localStorage})')==saved,'comparison changed saved design or progress'
            assert not errors,errors
            (out/'report.json').write_text(json.dumps({'status':'passed','errors':errors},indent=2))
            print('PASS return worker, conservation display, unsafe release, replay, cancel, four widths and save isolation')
            browser.close()
    finally: server.shutdown()
if __name__=='__main__':main()
