#!/usr/bin/env python3
"""Launch smoke and real file transfers between two isolated site origins.

Use --browser firefox or webkit for the other browser engines. Linux WebKit
coverage is useful compatibility evidence, not a physical Safari/iOS test.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit'], default='chromium')
    parser.add_argument('--executable')
    args = parser.parse_args()
    out = ROOT / 'qa/browser/site-launch' / args.browser
    out.mkdir(parents=True, exist_ok=True)
    servers = [ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist'))) for _ in range(2)]
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    origin, destination = [f'http://127.0.0.1:{server.server_port}' for server in servers]
    report = {'browser': args.browser, 'origins': [origin, destination], 'checks': [], 'errors': []}

    def done(message):
        report['checks'].append(message)
        print('PASS', message, flush=True)

    try:
        with sync_playwright() as p:
            options = {'headless': True}
            if args.executable:
                options['executable_path'] = args.executable
            browser = getattr(p, args.browser).launch(**options)
            report['version'] = browser.version
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(20000)
            page.on('pageerror', lambda error: report['errors'].append(str(error)))

            def saved():
                expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()

            def records():
                return page.evaluate("""async () => {
                    const db = await new Promise((ok, no) => {
                        const r = indexedDB.open('skyhook-campaigns', 1);
                        r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
                    });
                    return await new Promise((ok, no) => {
                        const r = db.transaction('worlds').objectStore('worlds').getAll();
                        r.onsuccess = () => { db.close(); ok(r.result); }; r.onerror = () => no(r.error);
                    });
                }""")

            def ready_studio():
                expect(page.get_by_role('button', name='Full-run debrief', exact=True)).to_be_enabled(timeout=90000)

            def download(button, name):
                with page.expect_download() as event:
                    button.click()
                path = out / name
                event.value.save_as(path)
                return path, json.loads(path.read_text())

            try:
                for path in ['/', '/system/', '/lab/', '/lab/campaign/', '/help/']:
                    response = page.goto(origin + path, wait_until='networkidle')
                    assert response and response.ok, f'Failed route: {path}'
                    expect(page.locator('main h1')).to_have_count(1)
                    expect(page.locator('.brand-wordmark')).to_be_visible()
                    expect(page.get_by_role('link', name='Help & saves', exact=True)).to_have_attribute('href', '/help/')
                    expect(page.get_by_role('link', name='Feedback', exact=True)).to_have_attribute('href', '/contact/#feedback')
                    if path == '/lab/':
                        ready_studio()
                    if path == '/lab/campaign/':
                        expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
                    for width in [1440, 320]:
                        page.set_viewport_size({'width': width, 'height': 1000})
                        page.evaluate('async () => { await document.fonts.ready; }')
                        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'Overflow: {path} at {width}'
                    page.set_viewport_size({'width': 1440, 'height': 1000})
                done('Homepage, illustrated flight, worker-driven Studio, Expeditions and help load at desktop and narrow-phone widths')

                for width in [1440, 320]:
                    page.set_viewport_size({'width': width, 'height': 1000})
                    page.screenshot(path=str(out / f'help-{width}.png'), full_page=True)
                expect(page.locator('main h1')).to_have_text('Keep your progress.')
                for topic in ['campaign-saves', 'studio-designs', 'troubleshooting']:
                    expect(page.locator('#' + topic)).to_have_count(1)
                question = page.locator('.help-answer').first
                question.locator('summary').focus()
                page.keyboard.press('Enter')
                expect(question).to_have_attribute('open', '')
                expect(question.locator('p')).to_be_visible()
                page.keyboard.press('Space')
                expect(question).not_to_have_attribute('open', '')
                internal_links = page.locator('main a[href^="/"]').evaluate_all('(links) => [...new Set(links.map(a => a.getAttribute("href")))]')
                for href in internal_links:
                    parts = urlsplit(href)
                    assert page.request.get(origin + parts.path).ok, f'Help destination missing: {href}'
                page.goto(origin + '/contact/#feedback', wait_until='networkidle')
                expect(page.locator('#feedback')).to_be_visible()
                done('Help topics, keyboard disclosures and feedback destinations work')

                native = browser.new_page(java_script_enabled=False, viewport={'width': 320, 'height': 1000})
                native.goto(origin + '/help/', wait_until='networkidle')
                expect(native.locator('#campaign-saves')).to_contain_text('Download backup')
                expect(native.locator('#studio-designs')).to_contain_text('Export JSON')
                native.locator('.help-answer').first.locator('summary').click()
                expect(native.locator('.help-answer').first.locator('p')).to_be_visible()
                assert not native.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                native.close()
                done('Save instructions and native troubleshooting disclosures remain available without JavaScript')

                page.set_viewport_size({'width': 1440, 'height': 1000})
                page.goto(origin + '/lab/campaign/', wait_until='networkidle')
                expect(page.get_by_role('button', name='Import campaign backup', exact=True)).to_be_enabled()
                page.locator('input[type=file]').set_input_files(str(ROOT / 'tests/fixtures/campaign-v9.json'))
                saved()
                source_record = records()[0]
                page.get_by_role('button', name='Your saves', exact=True).click()
                campaign_file, envelope = download(page.get_by_role('button', name='Download backup', exact=True), 'campaign-transfer.json')
                assert envelope['state'] == source_record['state']
                old = json.loads((ROOT / 'tests/fixtures/campaign-v9.json').read_text())['state']
                assert envelope['state']['day'] == old['day']
                assert envelope['state']['commerce']['credits'] == old['commerce']['credits']
                assert envelope['state']['flights'] == old['flights']
                assert envelope['state']['services'] == old['services']

                page.goto(destination + '/lab/campaign/', wait_until='networkidle')
                expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
                assert records() == [], 'Distinct origins unexpectedly shared campaign storage'
                page.get_by_role('button', name='Start new network', exact=True).click()
                saved()
                previous = records()[0]
                page.locator('input[type=file]').set_input_files(str(campaign_file))
                saved()
                destination_records = records()
                assert len(destination_records) == 2
                assert next(r for r in destination_records if r['id'] == previous['id']) == previous
                imported = next(r for r in destination_records if r['id'] != previous['id'])
                assert imported['id'] != source_record['id']
                assert imported['state'] == {**envelope['state'], 'id': imported['id'], 'revision': 0}
                page.reload(wait_until='networkidle')
                page.get_by_role('button', name='Load ' + imported['state']['name'], exact=True).click()
                saved()
                assert records() == destination_records
                page.goto(origin + '/lab/campaign/', wait_until='networkidle')
                expect(page.get_by_role('button', name='Load ' + source_record['state']['name'], exact=True)).to_be_enabled()
                assert records() == [source_record]
                done('A genuine cross-origin campaign export/import preserves time, cargo, orders and credits; creates a separate durable slot and leaves both original saves intact')

                key = 'skyhook-lab-design-v2'
                page.goto(origin + '/lab/', wait_until='networkidle')
                ready_studio()
                page.get_by_role('button', name='Mission', exact=True).click()
                page.get_by_label('Payload per delivery value', exact=True).fill('2')
                page.get_by_role('button', name='Save', exact=True).click()
                source_design = json.loads(page.evaluate('(key) => localStorage.getItem(key)', key))
                assert source_design['payloadT'] == 2
                design_file, exported_design = download(page.get_by_role('button', name='Export JSON', exact=True), 'studio-transfer.json')
                assert exported_design == source_design

                page.goto(destination + '/lab/', wait_until='networkidle')
                ready_studio()
                assert page.evaluate('(key) => localStorage.getItem(key)', key) is None
                page.get_by_role('button', name='Save', exact=True).click()
                existing_design = page.evaluate('(key) => localStorage.getItem(key)', key)
                assert json.loads(existing_design) != source_design
                page.locator('input[type=file]').set_input_files(str(design_file))
                ready_studio()
                page.get_by_role('button', name='Mission', exact=True).click()
                expect(page.get_by_label('Payload per delivery value', exact=True)).to_have_value('2')
                assert page.evaluate('(key) => localStorage.getItem(key)', key) == existing_design, 'Import silently overwrote saved design'
                page.get_by_role('button', name='Save', exact=True).click()
                assert json.loads(page.evaluate('(key) => localStorage.getItem(key)', key)) == source_design
                page.reload(wait_until='networkidle')
                ready_studio()
                page.get_by_role('button', name='Load', exact=True).click()
                ready_studio()
                page.get_by_role('button', name='Mission', exact=True).click()
                expect(page.get_by_label('Payload per delivery value', exact=True)).to_have_value('2')
                page.goto(origin + '/lab/', wait_until='networkidle')
                ready_studio()
                assert json.loads(page.evaluate('(key) => localStorage.getItem(key)', key)) == source_design
                done('Earth Studio v2 JSON transfers across origins; import updates visible inputs, explicit Save persists them, and the original design survives')

                assert not report['errors'], report['errors']
                report['status'] = 'passed'
            except Exception as error:
                report['status'] = 'failed'
                report['failure'] = str(error)
                page.screenshot(path=str(out / 'failure.png'), full_page=True)
                raise
            finally:
                browser.close()
    except Exception as error:
        report.setdefault('status', 'failed')
        report.setdefault('failure', str(error))
        raise
    finally:
        (out / 'report.json').write_text(json.dumps(report, indent=2))
        for server in servers:
            server.shutdown()


if __name__ == '__main__':
    main()
