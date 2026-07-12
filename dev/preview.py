"""Render an assembled lab.html in a real browser and verify it behaves.

Checks (all must pass):
  - page loads with zero console errors / uncaught page errors
  - no LabKit error banner (.lk-error) is shown
  - screenshots at 1000px and 480px widths
  - clicks the Start button ([data-lk=run]), waits, screenshots again and
    verifies the canvas actually changed (the rAF loop is live)

Usage:
    python dev/preview.py dev/workspace/<lab-id>.html [--out dev/out]

Requires: pip install playwright && playwright install chromium
(falls back to system Chrome via channel="chrome" if chromium isn't installed)
"""

import argparse
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("html", help="path to the assembled lab HTML")
    ap.add_argument("--out", default="dev/out", help="screenshot output dir")
    ap.add_argument("--settle-ms", type=int, default=600, help="wait after load before first screenshot")
    ap.add_argument("--run-ms", type=int, default=2000, help="how long to let the sim run")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    html = Path(args.html).resolve()
    if not html.exists():
        sys.exit(f"no such file: {html}")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stem = html.stem

    issues: list[str] = []

    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch()
        except Exception:
            browser = pw.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1000, "height": 900})

        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))

        page.goto(html.as_uri())
        page.wait_for_timeout(args.settle_ms)

        if console_errors:
            issues.extend(console_errors)
        if page.locator(".lk-error").count() > 0:
            issues.append("LabKit error banner shown: " + page.locator(".lk-error").first.inner_text())

        page.screenshot(path=str(out / f"{stem}-1000-idle.png"), full_page=True)

        # prove the animation loop runs: canvas pixels must change after Start
        def canvas_hash() -> str:
            return page.evaluate(
                "() => { const c = document.querySelector('canvas');"
                " return c ? c.toDataURL().length + ':' + c.toDataURL().slice(-80) : 'no-canvas'; }"
            )

        before = canvas_hash()
        run_btn = page.locator("[data-lk=run]")
        if run_btn.count() == 0:
            issues.append("no Start button ([data-lk=run]) found")
        else:
            run_btn.click()
            page.wait_for_timeout(args.run_ms)
            after = canvas_hash()
            if before == "no-canvas":
                issues.append("no canvas element found")
            elif before == after:
                issues.append("canvas did not change after clicking Start (rAF loop dead?)")
            page.screenshot(path=str(out / f"{stem}-1000-running.png"), full_page=True)

        if console_errors and console_errors != issues[: len(console_errors)]:
            issues.extend(c for c in console_errors if c not in issues)

        page.set_viewport_size({"width": 480, "height": 900})
        page.wait_for_timeout(300)
        page.screenshot(path=str(out / f"{stem}-480.png"), full_page=True)

        browser.close()

    print(f"screenshots -> {out}/{stem}-*.png")
    if issues:
        print("FAIL:")
        for i in issues:
            print(f"  - {i}")
        sys.exit(1)
    print("OK: no console errors, no error banner, animation runs")


if __name__ == "__main__":
    main()
