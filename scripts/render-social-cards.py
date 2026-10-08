#!/usr/bin/env python3
"""Render authored SVG diagrams to share-card PNGs. Requires Playwright Chromium.

Run from any directory: python scripts/render-social-cards.py
No remote images, fonts, screenshots of player worlds or application data.
"""
from html import escape
from base64 import b64encode
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
COMET_MARK = 'data:image/png;base64,' + b64encode((ROOT / 'public/brand/comet-mark.png').read_bytes()).decode('ascii')
CARDS = [
    ('social-card', 'ORBITAL TRANSPORT / OPEN RESEARCH', ['A different', 'way up.'],
     ['Explore the science. Design a tether.', 'Build a network across the solar system.']),
    ('social-flight-studio', 'TETHER LAB / ENGINEERING SANDBOX', ['One flight.', 'Then another.'],
     ['Design. Capture. Release. Recover.', 'Five tether experiments. Real tradeoffs.']),
    ('social-expeditions', 'EXPEDITIONS / STRATEGY GAME', ['A foothold.', 'Then a network.'],
     ['Build an interplanetary supply chain.', 'Start at Earth. Build toward the Sun.']),
]


def artwork(name):
    if name == 'social-expeditions':
        return '''
        <circle cx="986" cy="327" r="125" fill="url(#halo)"/>
        <ellipse cx="986" cy="327" rx="91" ry="69" fill="none" stroke="#ba936c" stroke-width="2" stroke-dasharray="3 12"/>
        <ellipse cx="986" cy="327" rx="72" ry="50" fill="none" stroke="#8f795e" stroke-width="2" stroke-dasharray="3 10" transform="rotate(-24 986 327)"/>
        <circle cx="986" cy="327" r="25" fill="#f1c28a"/>
        <g fill="none" stroke="#536c78" stroke-width="2"><path d="M747 359 823 190 927 154 1101 149M747 359 927 154M823 190 869 445 747 359"/></g>
        <path d="M927 154 869 445 936 373" fill="none" stroke="#bb8b63" stroke-width="2"/>
        <g fill="#122028" stroke="#bcced5" stroke-width="2"><circle cx="747" cy="359" r="17"/><circle cx="823" cy="190" r="10"/><path d="m919 150 10-6 8 7-4 10-12-3Z"/><circle cx="1101" cy="149" r="7"/></g>
        <circle cx="869" cy="445" r="12" fill="#45372c" stroke="#efb888" stroke-width="2"/>
        <g fill="#efb888"><circle cx="784" cy="277" r="4"/><circle cx="846" cy="317" r="4"/><circle cx="902" cy="410" r="4"/></g>
        <g class="label" fill="#a8bec9"><text x="718" y="400">EARTH</text><text x="799" y="167">MOON</text><text x="895" y="129">PHOBOS</text><text x="1076" y="124">CERES</text><text x="832" y="481">MERCURY</text></g>'''
    return '''
        <circle cx="932" cy="340" r="170" fill="url(#earth)" stroke="#557480" stroke-width="1.5"/>
        <ellipse cx="932" cy="340" rx="113" ry="170" fill="none" stroke="#32505d"/>
        <ellipse cx="932" cy="340" rx="170" ry="64" fill="none" stroke="#32505d"/>
        <path d="M762 340H1102M932 170V510" fill="none" stroke="#32505d"/>
        <ellipse cx="932" cy="330" rx="235" ry="156" transform="rotate(-33 932 330)" fill="none" stroke="#648390" stroke-width="1.5" stroke-dasharray="4 10"/>
        <path d="M965 108 1075 264" stroke="#d6e5eb" stroke-width="3"/>
        <circle cx="1020" cy="186" r="7" fill="#112028" stroke="#e5eef0" stroke-width="2"/>
        <circle cx="965" cy="108" r="4" fill="#d6e5eb"/><circle cx="1075" cy="264" r="5" fill="#efa477"/>
        <path d="M1075 264 Q1146 220 1160 131" fill="none" stroke="#efa477" stroke-width="2"/>
        <path d="m1152 140 8-9 4 12" fill="none" stroke="#efa477" stroke-width="2"/>'''


def svg(name, label, title, body):
    lines = ''.join(f'<text x="64" y="{238 + i * 78}" fill="{"#f1ad84" if i else "#edf3f5"}">{escape(line)}</text>' for i, line in enumerate(title))
    copy = ''.join(f'<text x="66" y="{383 + i * 33}">{escape(line)}</text>' for i, line in enumerate(body))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <radialGradient id="earth" cx="25%" cy="18%"><stop stop-color="#2b4857"/><stop offset="1" stop-color="#0c151a"/></radialGradient>
        <radialGradient id="halo"><stop stop-color="#edbd80" stop-opacity=".23"/><stop offset="1" stop-color="#edbd80" stop-opacity="0"/></radialGradient>
      </defs>
      <style>text{{font-family:Arial,sans-serif}}.label{{font-size:13px;letter-spacing:1px}}</style>
      <rect width="1200" height="630" fill="#080e12"/>
      <path d="M64 106H1136M64 531H1136" stroke="#2d3e47"/>
      <image href="{COMET_MARK}" x="62" y="38" width="46" height="46"/>
      <text x="122" y="69" fill="#e5eef1" font-size="18" letter-spacing="1.3">SKYHOOK INDUSTRIES</text>
      <text x="66" y="160" fill="#b0c1ca" class="label">{escape(label)}</text>
      <g font-size="66" letter-spacing="-2">{lines}</g>
      <g fill="#b6c7cf" font-size="23">{copy}</g>
      {artwork(name)}
      <text x="66" y="575" fill="#b2c5ce" class="label">RESEARCH · FLIGHT STUDIO · EXPEDITIONS</text>
      <text x="1136" y="575" text-anchor="end" fill="#92a9b5" class="label">SKYHOOK-INDUSTRIES.COM</text>
    </svg>'''


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chromium', headless=True)
        page = browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        for name, label, title, body in CARDS:
            source = '\n'.join(line.rstrip() for line in svg(name, label, title, body).splitlines())
            page.set_content(f'<html><body style="margin:0">{source}</body></html>')
            page.evaluate('document.fonts.ready')
            page.evaluate('''async () => {
                await Promise.all([...document.querySelectorAll('svg image')].map(node => new Promise((resolve, reject) => {
                    const image = new Image(); image.onload = resolve; image.onerror = reject;
                    image.src = node.getAttribute('href');
                })));
            }''')
            page.locator('svg').screenshot(path=str(ROOT / 'public' / f'{name}.png'))
            # Preserve existing SVG URLs as a compatibility asset.
            if name == 'social-card':
                (ROOT / 'public/social-card.svg').write_text(source + '\n')
            print(f'Rendered {name}.png')
        browser.close()


if __name__ == '__main__':
    main()
