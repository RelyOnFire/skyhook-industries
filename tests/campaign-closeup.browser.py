#!/usr/bin/env python3
"""A cargo departure replay is a read-only view with its own playback clock."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import subprocess
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


RECORDS = """async () => {
    const db = await new Promise((ok, no) => {
        const request = indexedDB.open('skyhook-campaigns', 1);
        request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error);
    });
    return await new Promise((ok, no) => {
        const request = db.transaction('worlds').objectStore('worlds').getAll();
        request.onsuccess = () => { db.close(); ok(request.result); };
        request.onerror = () => no(request.error);
    });
}"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--executable')
    parser.add_argument('--origin', help='Check a published branch in an isolated browser profile')
    args = parser.parse_args()
    out = ROOT / 'qa/browser/campaign-closeup'
    out.mkdir(parents=True, exist_ok=True)
    server = None
    if args.origin:
        origin = args.origin.rstrip('/')
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}'
    report = {'origin': origin, 'checks': [], 'errors': []}

    prepared = subprocess.run(['node', '--input-type=module', '-e', """
        import {readFileSync} from 'node:fs';
        import {createCampaign,validateCampaign,dispatch,advance,exportCampaign} from './.lab-test/campaign/model.js';
        let world=createCampaign('closeup-fixture','Departure rehearsal');
        world.ports.earth.level=3;world.fuelT=1000;
        Object.assign(world.ports.moon,{level:3,materialsT:100,equipmentT:20});
        Object.assign(world.ports.phobos,{level:3,materialsT:100,equipmentT:20});
        world=dispatch(world,'earth','moon',7,'tether','equipment');
        world=dispatch(world,'earth','phobos',2,'tug','materials');
        world=advance(world,1);
        world=dispatch(world,'moon','phobos',5,'tether','materials');
        world=advance(world,1);
        world=dispatch(world,'earth','phobos',3,'tether','materials');
        const mature=validateCampaign(JSON.parse(readFileSync('tests/fixtures/campaign-v5.json','utf8')).state);
        mature.id='closeup-mirrors';mature.name='Mirror route exclusion';
        console.log(JSON.stringify({cargo:JSON.parse(exportCampaign(world)),mirrors:JSON.parse(exportCampaign(mature))}));
    """], cwd=ROOT, text=True, capture_output=True, check=True)
    fixtures = json.loads(prepared.stdout)
    for name, envelope in fixtures.items():
        (out / f'{name}.json').write_text(json.dumps(envelope, indent=2))

    def done(message):
        report['checks'].append(message)
        print('PASS', message, flush=True)

    def import_world(page, name='cargo'):
        page.goto(origin + '/lab/campaign/', wait_until='networkidle')
        expect(page.get_by_role('button', name='Start new network', exact=True)).to_be_enabled()
        page.locator('input[type=file]').set_input_files(str(out / f'{name}.json'))
        expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
        manager = page.locator('.campaign-save-manager')
        if manager.get_attribute('open') is not None:
            manager.locator(':scope > summary').click()
        dismiss = page.get_by_role('button', name='Dismiss message', exact=True)
        if dismiss.count():
            dismiss.click()

    def records(page):
        return page.evaluate(RECORDS)

    def backup(page, filename):
        page.get_by_role('button', name='Your saves', exact=True).click()
        with page.expect_download() as event:
            page.get_by_role('button', name='Download backup', exact=True).click()
        path = out / filename
        event.value.save_as(path)
        page.locator('.campaign-save-manager > summary').click()
        return path.read_bytes()

    def progress(dialog):
        return dialog.get_by_role('slider', name='Departure progress', exact=True)

    def scrub(dialog, value):
        progress(dialog).evaluate("""(input, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
            input.dispatchEvent(new Event('input', {bubbles: true}));
        }""", value)
        expect(progress(dialog)).to_have_value(str(value))

    def watch(page, flight=1):
        trigger = page.get_by_role('button', name=f'Explore Earth launch for flight {flight}', exact=True)
        trigger.click()
        dialog = page.get_by_role('dialog', name='Earth launch', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.locator('.departure-header')).to_contain_text(re.compile(rf'Flight {flight}\b', re.I))
        return dialog, trigger

    def capture(page, dialog, name):
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'Page overflows horizontally'
        assert not dialog.evaluate('element => element.scrollWidth > element.clientWidth + 1'), 'Departure dialog overflows horizontally'
        box = dialog.bounding_box()
        assert box and box['x'] >= -1 and box['x'] + box['width'] <= page.viewport_size['width'] + 1
        page.screenshot(path=str(out / name))

    try:
        with sync_playwright() as p:
            options = {'headless': True}
            if args.executable:
                options['executable_path'] = args.executable
            else:
                options['channel'] = 'chromium'
            browser = p.chromium.launch(**options)
            report['browser'] = browser.version
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(20000)
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            scene_requests = []
            page.on('request', lambda request: scene_requests.append(request.url) if 'DepartureScene' in request.url else None)
            detail_requests = []
            page.on('request', lambda request: detail_requests.append(request.url) if '/textures/earth-launch-atlantic.webp' in request.url else None)
            try:
                import_world(page)
                initial = records(page)
                initial_backup = backup(page, 'before-closeup.json')
                expect(page.get_by_role('button', name='Explore Earth launch for flight 1', exact=True)).to_be_visible()
                expect(page.get_by_role('button', name='Explore Earth launch for flight 4', exact=True)).to_be_visible()
                for flight in [2, 3]:
                    expect(page.locator(f'.flight-row[data-traffic-id="cargo-{flight}"]')).to_be_visible()
                    expect(page.get_by_role('button', name=f'Explore Earth launch for flight {flight}', exact=True)).to_have_count(0)
                expect(page.get_by_role('dialog', name='Earth launch', exact=True)).to_have_count(0)
                assert not scene_requests, 'The optional 3D departure bundle loaded before opening a replay'
                assert not detail_requests, 'Regional launch imagery loaded before opening the viewer'
                assert records(page) == initial
                expect(page.get_by_role('button', name='Explore Moon launch for flight 3', exact=True)).to_be_visible()
                done('Earth and Moon tether cargo offer their own departure views; tug traffic does not')

                dialog, trigger = watch(page)
                expect(dialog).to_contain_text('Earth')
                expect(dialog).to_contain_text('Moon')
                expect(dialog).to_contain_text('7 t')
                expect(dialog).to_contain_text('In transit')
                expect(dialog.locator('[data-renderer="webgl"]')).to_be_visible(timeout=30000)
                expect(dialog.locator('[data-earth-detail]')).to_have_attribute('data-earth-detail', 'ready', timeout=30000)
                assert scene_requests, 'Departure replay did not load its optional scene bundle'
                pause = dialog.get_by_role('button', name='Pause close-up', exact=True)
                expect(pause).to_be_visible()
                pause.click()
                expect(dialog.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                dialog.locator('.departure-stage').focus()
                page.keyboard.press('Space')
                expect(dialog.get_by_role('button', name='Pause close-up', exact=True)).to_be_visible()
                page.keyboard.press('Space')
                expect(dialog.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                expect(dialog.locator('.departure-footer')).to_contain_text('Simulation paused')
                assert records(page) == initial, 'Space inside the replay started or changed the paused game'
                for phase in ['Climb', 'Rendezvous', 'Lift', 'Release']:
                    dialog.get_by_role('button', name=phase, exact=True).click()
                    expect(dialog).to_have_attribute('data-phase', phase.lower())
                    expect(dialog.locator('.departure-telemetry')).to_contain_text('km/s')
                    if phase == 'Rendezvous':
                        expect(dialog.locator('.departure-telemetry')).to_contain_text('150 km')
                        expect(dialog.locator('.departure-telemetry')).to_contain_text('4.5 km/s')
                    if phase == 'Lift':
                        expect(dialog.locator('.departure-telemetry')).to_contain_text('Returning')
                    expect(dialog.get_by_role('button', name=phase, exact=True)).to_have_attribute('aria-pressed', 'true')
                    assert records(page) == initial, f'{phase} changed the campaign save'
                    capture(page, dialog, f'{phase.lower()}-1440.png')
                for value in [0, 270, 500, 880, 1000]:
                    scrub(dialog, value)
                    assert records(page) == initial, f'Scrubbing to {value} changed the campaign save'
                replay = dialog.get_by_role('button', name='Replay close-up', exact=True)
                expect(replay).to_be_visible()
                replay.click()
                page.wait_for_function("""() => {
                    const input=document.querySelector('dialog input[aria-label="Departure progress"]');
                    return input && Number(input.value)>0;
                }""", polling=100)
                dialog.get_by_role('button', name='Pause close-up', exact=True).click()
                assert records(page) == initial
                done('WebGL replay, aircraft climb, rendezvous, lift and release, scrubbing and replay controls leave the entire saved record and checkpoints unchanged')

                for width, height in [(1440, 1000), (390, 844), (320, 740)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    dialog.get_by_role('button', name='Rendezvous', exact=True).click()
                    capture(page, dialog, f'capture-{width}.png')
                    expect(dialog.get_by_role('button', name='Close departure', exact=True)).to_be_visible()
                    expect(progress(dialog)).to_be_visible()
                page.set_viewport_size({'width': 1440, 'height': 1000})
                dialog.locator('canvas').evaluate("canvas => canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true}))")
                expect(dialog.locator('[data-renderer="diagram"]')).to_be_visible()
                assert records(page) == initial
                dialog.get_by_role('button', name='Close departure', exact=True).focus()
                report['focus_cycle'] = []
                for _ in range(14):
                    page.keyboard.press('Tab')
                    focus = page.evaluate("""() => ({
                        tag:document.activeElement.tagName, id:document.activeElement.id,
                        label:document.activeElement.getAttribute('aria-label'),
                        text:document.activeElement.textContent.slice(0,80), hasFocus:document.hasFocus(),
                        inDialog:document.querySelector('dialog').contains(document.activeElement)
                    })""")
                    report['focus_cycle'].append(focus)
                    # Native modal dialogs permit visiting browser chrome. They
                    # must not let Tab reach an underlying page control.
                    assert focus['inDialog'] or (not focus['hasFocus'] and focus['tag'] == 'BODY'), f'Focus escaped to the underlying page: {focus}'
                page.keyboard.press('Escape')
                expect(dialog).not_to_be_visible()
                expect(trigger).to_be_focused()
                assert records(page) == initial
                assert backup(page, 'after-closeup.json') == initial_backup, 'Viewing changed the exported campaign JSON'
                done('desktop and narrow-phone views fit; modal excludes background controls, Escape restores focus, and exported saves remain byte-identical')

                # A true game tick must continue while its separate close-up clock is paused.
                page.get_by_label('Simulation speed', exact=True).select_option('30')
                page.get_by_role('button', name='Play simulation', exact=True).click()
                dialog, _ = watch(page)
                dialog.locator('.departure-stage').focus()
                page.keyboard.press('Space')
                expect(dialog.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                frozen_visual = progress(dialog).input_value()
                expect(dialog).to_contain_text('Delivered', timeout=15000)
                assert progress(dialog).input_value() == frozen_visual, 'Game ticks advanced the paused close-up clock'
                advanced = records(page)[0]['state']
                assert advanced['day'] > initial[0]['state']['day']
                assert all(flight['id'] != 1 for flight in advanced['flights'])
                assert advanced['ports']['moon']['equipmentT'] == initial[0]['state']['ports']['moon']['equipmentT'] + 7
                expect(dialog.locator('.departure-header')).to_contain_text(re.compile(r'Flight 1\b', re.I))
                expect(dialog).to_contain_text('7 t')
                dialog.get_by_role('button', name='Back to network', exact=True).click()
                expect(page.locator('#lab-content')).to_be_focused()
                page.get_by_role('button', name='Pause simulation', exact=True).click()
                expect(page.get_by_text('Saved in this browser', exact=True)).to_be_visible()
                done('Space controls the close-up without pausing the game; real arrival updates live status while the departure snapshot remains intact')

                fallback_context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
                fallback_context.add_init_script("""(() => {
                    const original=HTMLCanvasElement.prototype.getContext;
                    HTMLCanvasElement.prototype.getContext=function(kind,...args) {
                        if (String(kind).includes('webgl')) return null;
                        return original.call(this,kind,...args);
                    };
                })();""")
                fallback = fallback_context.new_page()
                fallback.set_default_timeout(20000)
                fallback.on('pageerror', lambda error: report['errors'].append(str(error)))
                import_world(fallback)
                unchanged = records(fallback)
                fallback_dialog, fallback_trigger = watch(fallback)
                expect(fallback_dialog.locator('[data-renderer="diagram"]')).to_be_visible(timeout=30000)
                expect(fallback_dialog.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                reduced_start = progress(fallback_dialog).input_value()
                fallback.wait_for_timeout(300)
                assert progress(fallback_dialog).input_value() == reduced_start
                fallback_dialog.get_by_role('button', name='Rendezvous', exact=True).click()
                capture(fallback, fallback_dialog, 'fallback-capture-390.png')
                fixed = progress(fallback_dialog).input_value()
                fallback.wait_for_timeout(300)
                assert progress(fallback_dialog).input_value() == fixed
                assert records(fallback) == unchanged
                fallback.keyboard.press('Escape')
                expect(fallback_trigger).to_be_focused()
                assert records(fallback) == unchanged
                done('reduced motion opens paused; WebGL failure keeps a usable diagram and keyboard controls without changing saves')
                fallback_context.close()

                lunar_context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                lunar = lunar_context.new_page()
                lunar.on('pageerror', lambda error: report['errors'].append(str(error)))
                lunar_scene_requests = []
                lunar.on('request', lambda r: lunar_scene_requests.append(r.url) if 'LunarDepartureScene' in r.url else None)
                import_world(lunar)
                lunar_before = records(lunar)
                assert not lunar_scene_requests, 'Lunar scene loaded before opening the viewer'
                lunar_trigger = lunar.get_by_role('button', name='Explore Moon launch for flight 3', exact=True)
                lunar_trigger.click()
                moon = lunar.get_by_role('dialog', name='Moon launch', exact=True)
                expect(moon).to_contain_text('Phobos')
                expect(moon).to_contain_text('5 t')
                expect(moon).to_contain_text('In transit')
                expect(moon.locator('[data-renderer="webgl"]')).to_be_visible(timeout=30000)
                expect(moon.locator('[data-moon-texture]')).to_have_attribute('data-moon-texture', 'ready', timeout=30000)
                expect(moon.locator('[data-moon-ground]')).to_have_attribute('data-moon-ground', 'ready', timeout=30000)
                assert lunar_scene_requests
                for phase in ['Load', 'Accelerate', 'Coast', 'Capture', 'Swing', 'Release']:
                    moon.get_by_role('button', name=phase, exact=True).click()
                    expect(moon).to_have_attribute('data-phase', phase.lower())
                    if phase == 'Capture':
                        expect(moon.locator('.departure-telemetry')).to_contain_text('50 km')
                        expect(moon.locator('.departure-telemetry')).to_contain_text('0.9 km/s')
                    capture(lunar, moon, f'moon-{phase.lower()}-1440.png')
                for value in [0, 235, 460, 690, 950, 1000]:
                    scrub(moon, value)
                assert records(lunar) == lunar_before
                for width, height in [(390, 844), (320, 740)]:
                    lunar.set_viewport_size({'width': width, 'height': height})
                    moon.get_by_role('button', name='Capture', exact=True).click()
                    capture(lunar, moon, f'moon-capture-{width}.png')
                    assert moon.get_by_role('button', name='Accelerate', exact=True).bounding_box()['height'] >= 44
                lunar.set_viewport_size({'width': 1440, 'height': 1000})
                moon.locator('canvas').evaluate("c => c.dispatchEvent(new Event('webglcontextlost', {cancelable:true}))")
                expect(moon.locator('[data-renderer="diagram"]')).to_be_visible()
                capture(lunar, moon, 'moon-context-loss-1440.png')
                lunar.keyboard.press('Escape')
                expect(lunar_trigger).to_be_focused()
                assert records(lunar) == lunar_before
                done('Moon cargo keeps its real manifest; six phases, phone layout, lazy texture and context-loss fallback leave saves unchanged')

                # An always-available concept entry lets existing worlds try it
                # without manufacturing a new Moon shipment or resetting saves.
                lunar.get_by_role('button', name='Explore Moon launch', exact=True).click()
                concept = lunar.get_by_role('dialog', name='Moon launch', exact=True)
                expect(concept).to_have_attribute('data-mode', 'concept')
                expect(concept).to_contain_text('sends no cargo')
                expect(concept.locator('.departure-manifest')).not_to_contain_text('5 t')
                expect(concept.locator('.departure-footer')).not_to_contain_text('Arrives')
                expect(concept.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                lunar.keyboard.press('Escape')
                assert records(lunar) == lunar_before
                lunar.get_by_label('Simulation speed', exact=True).select_option('30')
                lunar.get_by_role('button', name='Play simulation', exact=True).click()
                lunar_trigger.click()
                moon = lunar.get_by_role('dialog', name='Moon launch', exact=True)
                expect(moon.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                frozen = progress(moon).input_value()
                expect(moon.locator('.departure-live')).to_have_text('Delivered', timeout=25000)
                assert progress(moon).input_value() == frozen
                delivered = records(lunar)[0]['state']
                assert not any(f['id'] == 3 for f in delivered['flights'])
                expected_material = lunar_before[0]['state']['ports']['phobos']['materialsT'] + sum(f['cargoT'] for f in lunar_before[0]['state']['flights'] if f['to'] == 'phobos' and f['kind'] == 'materials' and f['arrival'] <= delivered['day'])
                assert delivered['ports']['phobos']['materialsT'] == expected_material
                expect(moon.locator('.departure-header')).to_contain_text('Flight 3')
                moon.get_by_role('button', name='Back to network', exact=True).click()
                lunar.get_by_role('button', name='Pause simulation', exact=True).click()
                expect(lunar.locator('#lab-content')).not_to_contain_text('Not saved')
                done('Moon concept invents no shipment; the paused Moon viewer allows game ticks and real cargo arrival while preserving its opening manifest')
                lunar_context.close()

                moon_fallback_context = browser.new_context(viewport={'width': 320, 'height': 740}, reduced_motion='reduce')
                moon_fallback_context.add_init_script("""(() => {
                    const original=HTMLCanvasElement.prototype.getContext;
                    HTMLCanvasElement.prototype.getContext=function(kind,...args) {
                        return String(kind).includes('webgl') ? null : original.call(this,kind,...args);
                    };
                })();""")
                moon_fallback = moon_fallback_context.new_page()
                moon_fallback.on('pageerror', lambda error: report['errors'].append(str(error)))
                import_world(moon_fallback)
                moon_fallback_before = records(moon_fallback)
                moon_fallback.get_by_role('button', name='Explore Moon launch', exact=True).click()
                moon_diagram = moon_fallback.get_by_role('dialog', name='Moon launch', exact=True)
                expect(moon_diagram.locator('[data-renderer="diagram"]')).to_be_visible(timeout=30000)
                expect(moon_diagram.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                for phase in ['Load', 'Accelerate', 'Coast', 'Capture', 'Swing', 'Release']:
                    moon_diagram.get_by_role('button', name=phase, exact=True).click()
                    expect(moon_diagram).to_have_attribute('data-phase', phase.lower())
                capture(moon_fallback, moon_diagram, 'moon-fallback-320.png')
                assert records(moon_fallback) == moon_fallback_before
                moon_fallback.keyboard.press('Escape')
                expect(moon_fallback.get_by_role('button', name='Explore Moon launch', exact=True)).to_be_focused()
                done('Moon reduced-motion and WebGL constructor failure retain all phase controls, phone layout and saved state')
                moon_fallback_context.close()

                # Regional imagery must repaint a paused frame, and a failed
                # optional request must keep the globally mapped Moon usable.
                ground_context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                ground = ground_context.new_page()
                ground.on('pageerror', lambda e: report['errors'].append(str(e)))
                held = []
                ground.route('**/textures/moon-launch-hadley.webp', lambda route: held.append(route))
                import_world(ground)
                ground_before = records(ground)
                ground.get_by_role('button', name='Explore Moon launch', exact=True).click()
                ground_dialog = ground.get_by_role('dialog', name='Moon launch', exact=True)
                expect(ground_dialog.locator('[data-renderer="webgl"]')).to_be_visible(timeout=30000)
                expect(ground_dialog.locator('[data-moon-texture]')).to_have_attribute('data-moon-texture', 'ready', timeout=30000)
                expect(ground_dialog.locator('[data-moon-ground]')).to_have_attribute('data-moon-ground', 'loading')
                assert len(held) == 1
                fixed = progress(ground_dialog).input_value()
                before_pixels = ground_dialog.locator('canvas').screenshot()
                held[0].fulfill(path=str(ROOT / 'public/textures/moon-launch-hadley.webp'), content_type='image/webp')
                expect(ground_dialog.locator('[data-moon-ground]')).to_have_attribute('data-moon-ground', 'ready')
                assert ground_dialog.locator('canvas').screenshot() != before_pixels, 'Lunar ground did not repaint the paused frame'
                assert progress(ground_dialog).input_value() == fixed
                assert records(ground) == ground_before
                ground.keyboard.press('Escape')
                ground_context.close()
                failed_context = browser.new_context(viewport={'width': 320, 'height': 740}, reduced_motion='reduce')
                failed_ground = failed_context.new_page()
                failed_ground.on('pageerror', lambda e: report['errors'].append(str(e)))
                failed_ground.route('**/textures/moon-launch-hadley.webp', lambda route: route.abort())
                import_world(failed_ground)
                failed_before = records(failed_ground)
                failed_ground.get_by_role('button', name='Explore Moon launch', exact=True).click()
                failed_dialog = failed_ground.get_by_role('dialog', name='Moon launch', exact=True)
                expect(failed_dialog.locator('[data-moon-ground]')).to_have_attribute('data-moon-ground', 'unavailable', timeout=30000)
                expect(failed_dialog.locator('[data-moon-texture]')).to_have_attribute('data-moon-texture', 'ready', timeout=30000)
                expect(failed_dialog.locator('[data-renderer="webgl"]')).to_be_visible()
                failed_dialog.get_by_role('button', name='Accelerate', exact=True).click()
                capture(failed_ground, failed_dialog, 'moon-ground-unavailable-320.png')
                assert records(failed_ground) == failed_before
                failed_ground.keyboard.press('Escape')
                failed_context.close()
                done('native lunar imagery repaints a paused frame; failure retains the mapped globe, controls and unchanged saves')

                mirror_context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                mirror_page = mirror_context.new_page()
                mirror_page.on('pageerror', lambda error: report['errors'].append(str(error)))
                import_world(mirror_page, 'mirrors')
                mirror_before = records(mirror_page)
                mirror_rows = mirror_page.locator('.flight-row[data-kind="mirrors"]')
                assert mirror_rows.count() > 0
                expect(mirror_rows.get_by_role('button', name='Earth launch', exact=False)).to_have_count(0)
                mirror_id = fixtures['mirrors']['state']['solar']['deployments'][0]['id']
                mirror_page.get_by_role('button', name=f'Track mirror launch {mirror_id}', exact=True).click()
                expect(mirror_page.get_by_role('dialog', name='Earth launch', exact=True)).to_have_count(0)
                assert records(mirror_page) == mirror_before
                done('solar mirror traffic retains its own tracking and never presents an Earth cargo capture')
                mirror_context.close()

                demo_context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
                demo = demo_context.new_page()
                demo.set_default_timeout(20000)
                demo.on('pageerror', lambda error: report['errors'].append(str(error)))
                demo.goto(origin + '/lab/campaign/', wait_until='networkidle')
                demo.get_by_label('Name your network', exact=True).fill('Departure demo')
                demo.get_by_role('button', name='Start new network', exact=True).click()
                expect(demo.get_by_text('Saved in this browser', exact=True)).to_be_visible()

                def demonstration(label):
                    before = records(demo)
                    exported = backup(demo, f'{label}-before.json')
                    entry = demo.get_by_role('button', name='Explore Earth launch', exact=True)
                    expect(entry).to_be_enabled()
                    expect(demo.locator('.map-actions')).to_contain_text('Explore Earth launch')
                    for width, height in [(1440, 1000), (320, 740)]:
                        demo.set_viewport_size({'width': width, 'height': height})
                        entry.scroll_into_view_if_needed()
                        assert not demo.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                        demo.locator('.map-actions').screenshot(path=str(out / f'{label}-entry-{width}.png'))
                        entry.click()
                        concept = demo.get_by_role('dialog', name='Earth launch', exact=True)
                        expect(concept).to_be_visible()
                        expect(concept).to_contain_text('Concept demonstration')
                        expect(concept).to_contain_text('sends no cargo')
                        expect(concept.locator('.departure-header')).to_contain_text(re.compile('HASTOL-INSPIRED CONCEPT', re.I))
                        text = concept.inner_text()
                        assert not re.search(r'\bFlight\s*#?\s*\d', text, re.I), 'The demo invented a shipment identity'
                        assert not re.search(r'\b\d+(?:[.,]\d+)*\s*t\b', text), 'The demo invented a cargo mass'
                        assert not re.search(r'\b(?:Arrives|Arrival|Delivered|In transit)\b', text, re.I), 'The demo claims a shipment timeline'
                        expect(concept.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                        concept.get_by_role('button', name='Rendezvous', exact=True).click()
                        capture(demo, concept, f'{label}-capture-{width}.png')
                        scrub(concept, 880)
                        assert records(demo) == before, 'Viewing or scrubbing the concept demo changed saved state'
                        demo.keyboard.press('Escape')
                        expect(entry).to_be_focused()
                    assert records(demo) == before, 'The concept demo changed the network, revision or checkpoints'
                    assert backup(demo, f'{label}-after.json') == exported, 'The concept demo changed the exported campaign'

                assert records(demo)[0]['state']['day'] == 0
                assert not records(demo)[0]['state']['flights']
                demonstration('fresh-demo')
                demo.set_viewport_size({'width': 1440, 'height': 1000})
                demo.get_by_label('From', exact=True).select_option('earth')
                demo.get_by_label('To', exact=True).select_option('moon')
                demo.get_by_label('Cargo (t)', exact=True).fill('5')
                demo.get_by_role('radio', name='Bootstrap tug').check()
                demo.get_by_role('button', name='Dispatch cargo', exact=True).click()
                expect(demo.get_by_text('Saved in this browser', exact=True)).to_be_visible()
                assert len(records(demo)[0]['state']['flights']) == 1
                assert records(demo)[0]['state']['flights'][0]['mode'] == 'tug'
                expect(demo.get_by_role('button', name='Explore Earth launch for flight 1', exact=True)).to_have_count(0)
                demonstration('tug-only-demo')
                done('persistent map entry opens an explicit concept demo in fresh and tug-only networks without inventing cargo or changing records, exports or time')
                demo_context.close()

                # Late regional imagery must repaint an already paused frame;
                # a failed download must retain the global globe and controls.
                texture_context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                texture_page = texture_context.new_page()
                texture_page.on('pageerror', lambda error: report['errors'].append(str(error)))
                held = []
                texture_page.route('**/textures/earth-launch-atlantic.webp', lambda route: held.append(route))
                import_world(texture_page)
                texture_before = records(texture_page)
                texture_dialog, _ = watch(texture_page)
                expect(texture_dialog.locator('[data-earth-detail]')).to_have_attribute('data-earth-detail', 'loading')
                expect(texture_dialog.locator('[data-renderer="webgl"]')).to_be_visible()
                expect(texture_dialog.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                scrub(texture_dialog, 45)
                texture_page.evaluate("""async () => {
                    await Promise.all(['/textures/earth.webp','/textures/earth-clouds.webp'].map(src => new Promise((ok,no) => {
                        const image=new Image();image.onload=ok;image.onerror=no;image.src=src;
                    })));
                    await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
                }""")
                canvas = texture_dialog.locator('canvas')
                before_image = canvas.screenshot()
                assert len(held) == 1, 'The check must hold the real regional image request'
                held[0].fulfill(response=held[0].fetch())
                expect(texture_dialog.locator('[data-earth-detail]')).to_have_attribute('data-earth-detail', 'ready')
                assert canvas.screenshot() != before_image, 'Late regional imagery did not repaint the paused surface'
                expect(progress(texture_dialog)).to_have_value('45')
                assert records(texture_page) == texture_before
                capture(texture_page, texture_dialog, 'regional-earth-ready-1440.png')
                texture_page.keyboard.press('Escape')
                texture_page.unroute('**/textures/earth-launch-atlantic.webp')
                texture_page.route('**/textures/earth-launch-atlantic.webp', lambda route: route.abort())
                texture_dialog, _ = watch(texture_page)
                expect(texture_dialog.locator('[data-earth-detail]')).to_have_attribute('data-earth-detail', 'unavailable')
                expect(texture_dialog.locator('[data-renderer="webgl"]')).to_be_visible()
                scrub(texture_dialog, 45)
                capture(texture_page, texture_dialog, 'regional-earth-fallback-1440.png')
                texture_dialog.locator('.departure-stage').focus()
                texture_page.keyboard.press('Space')
                expect(texture_dialog.get_by_role('button', name='Pause close-up', exact=True)).to_be_visible()
                texture_page.keyboard.press('Space')
                expect(texture_dialog.get_by_role('button', name='Play close-up', exact=True)).to_be_visible()
                assert records(texture_page) == texture_before
                texture_context.close()
                done('regional imagery loads only on opening, repaints paused ground views on arrival, and retains the globe and controls on failure without save changes')
                assert not report['errors'], report['errors']
                report['status'] = 'passed'
            except Exception as error:
                report['status'] = 'failed'
                report['failure'] = str(error)
                page.screenshot(path=str(out / 'failure.png'), full_page=True)
                raise
            finally:
                browser.close()
    finally:
        (out / 'report.json').write_text(json.dumps(report, indent=2))
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
