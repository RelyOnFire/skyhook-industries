#!/usr/bin/env python3
"""Regression-test the compiled Lab's actual React payload controls.

Run after `npm run build`:
    python -m pip install playwright
    python -m playwright install chromium
    python tests/lab-payload-range.browser.py

Optional: --dist PATH --chromium /usr/bin/chromium

Assets are served to an about:blank document using Playwright route fulfillment.
The unchanged compiled numerical worker runs as a Blob Worker. This isolates the
control regression from external hosting and needs no network. It does NOT test
origin-dependent sharing/storage, WebGL, or the physical validity of a design.
"""
from __future__ import annotations

import argparse
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright


def check_viewport(browser, root: Path, width: int, height: int) -> None:
    page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def asset(route):
        path = (root / unquote(urlparse(route.request.url).path).lstrip("/")).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            route.abort()
            return
        route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path.name)[0]
                      or "application/octet-stream", headers={"Access-Control-Allow-Origin": "*"})

    page.route("**/*", asset)
    workers = list((root / "_astro").glob("worker-*.js"))
    if len(workers) != 1:
        raise RuntimeError("Expected one compiled Lab worker. Rebuild into a clean dist directory.")
    page.evaluate("""source => {
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          const local = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
          super(local, options);
          URL.revokeObjectURL(local);
        }
      };
    }""", workers[0].read_text())
    html = (root / "lab/index.html").read_text().replace(
        "<head>", '<head><base href="http://skyhook.test/">', 1)
    page.set_content(html, wait_until="networkidle")
    if width < 900:
        page.get_by_role("navigation", name="Workspace panels").get_by_role(
            "button", name="Design", exact=True).click()
    page.get_by_role("button", name="Mission", exact=True).click()
    toggle = page.get_by_role("checkbox", name="Extended payload range")
    label = page.locator("label.extended-switch > span")
    slider = page.get_by_role("slider", name="Payload per delivery", exact=True)
    number = page.get_by_role("spinbutton", name="Payload per delivery value", exact=True)
    run = page.locator("button.run-design")
    expect(run).to_be_enabled(timeout=30000)

    # Both pointer and keyboard activation must round-trip without changing mass.
    for value in ["0.1", "3", "20"]:
        number.fill(value)
        label.click()
        expect(toggle).to_be_checked()
        expect(slider).to_have_attribute("max", "250")
        toggle.focus()
        page.keyboard.press("Space")
        expect(toggle).not_to_be_checked()
        expect(slider).to_have_attribute("max", "20")
        expect(number).to_have_value(value)
        expect(number).not_to_have_attribute("aria-invalid", "true")
        expect(run).to_be_enabled()

    # Turning off at a large value must not trap the toggle or silently clamp mass.
    toggle.check()
    slider.fill("250")
    toggle.uncheck()
    expect(toggle).not_to_be_checked()
    expect(number).to_have_value("250")
    expect(number).to_have_attribute("max", "20")
    expect(number).to_have_attribute("aria-invalid", "true")
    expect(slider).to_have_count(0)  # Do not display a silently clamped range thumb.
    expect(run).to_be_disabled()
    expect(page.get_by_text("Your 250.0 t payload is unchanged.", exact=False)).to_be_visible()

    # Switching sections must not clear the derived range error.
    page.get_by_role("button", name="Structure", exact=True).click()
    expect(run).to_be_disabled()
    page.get_by_role("button", name="Mission", exact=True).click()
    expect(number).to_have_value("250")
    expect(run).to_be_disabled()

    # Re-enabling restores the existing high value and clears range validation.
    toggle.check()
    expect(number).to_have_value("250")
    expect(number).not_to_have_attribute("aria-invalid", "true")
    expect(slider).to_have_value("250")
    expect(run).to_be_enabled()

    # Reproduce the reported workflow: high payload -> slider minimum -> uncheck.
    slider.focus()
    page.keyboard.press("Home")
    expect(number).to_have_value("0.1")
    toggle.uncheck()
    expect(toggle).not_to_be_checked()
    expect(slider).to_have_attribute("max", "20")
    expect(number).to_have_value("0.1")
    expect(run).to_be_enabled()
    expect(page.locator(".range-warning")).to_have_count(0)

    # Explicit reduction is available; direct numeric correction works too.
    for value in ["20.1", "100", "250"]:
        toggle.check()
        number.fill(value)
        toggle.uncheck()
        expect(number).to_have_value(value)
        expect(run).to_be_disabled()
        if value == "250":
            page.get_by_role("button", name="Use 20 t", exact=True).click()
            expect(number).to_have_value("20")
        else:
            number.fill("3")
            expect(number).to_have_value("3")
        expect(toggle).not_to_be_checked()
        expect(slider).to_have_attribute("max", "20")
        expect(number).not_to_have_attribute("aria-invalid", "true")
        expect(run).to_be_enabled()
    assert not errors, errors
    page.close()
    print(f"PASS payload toggle / bounds / no clamping / tab persistence at {width}x{height}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parents[1] / "dist")
    parser.add_argument("--chromium", help="Optional installed Chromium executable")
    args = parser.parse_args()
    root = args.dist.resolve()
    if not (root / "lab/index.html").is_file():
        parser.error("No compiled Lab found. Run npm run build first.")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, headless=True)
        try:
            for width, height in [(1440, 1000), (390, 844), (320, 800)]:
                check_viewport(browser, root, width, height)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
