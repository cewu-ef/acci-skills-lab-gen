"""Validate a theme.json against the LabKit theme contract.

Standalone acceptance check for the style-extraction step (and for any external
style pipeline that produces theme presets). The check logic mirrors
assemble.py's check_theme — duplicated by design: the ACCI runtime only
executes top-level scripts/<name>.py files, so the two scripts cannot share a
module. Keep the two in sync.

Usage (cwd = the agent workspace):
    python validate_theme.py <theme.json>

stdout: {"ok": true, "preset": "...", "warnings": [...]}
        or {"ok": false, "errors": [...]} with exit code 1.
"""

import json
import re
import sys
from pathlib import Path

ID_COLOR = re.compile(r"^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(")
REQUIRED_PALETTE = [
    "pageBg", "surface", "surfaceAlt", "ink", "inkMuted",
    "accent", "accentContrast", "canvasSky", "canvasGround", "inkOnCanvas",
]
SHADOWS = ("flat", "soft", "crisp")


def check_theme(theme, errors: list) -> None:
    if not isinstance(theme, dict):
        errors.append("theme: must be a JSON object")
        return
    blob = json.dumps(theme)
    for bad in ("url(", "@font-face", "http://", "https://", "@import"):
        if bad in blob:
            errors.append(f"theme: contains {bad!r} — themes must be self-contained (no network, system font stacks only)")
    pal = theme.get("palette")
    if not isinstance(pal, dict):
        errors.append("theme: missing palette object")
    else:
        for k in REQUIRED_PALETTE:
            if k not in pal:
                errors.append(f"theme: palette.{k} is required")
        for k, v in pal.items():
            if not isinstance(v, str) or not ID_COLOR.match(v.strip()):
                errors.append(f"theme: palette.{k} is not a valid color: {v!r}")
    font = theme.get("font")
    if not isinstance(font, dict):
        errors.append("theme: missing font object")
    else:
        for k in ("body", "mono"):
            if not isinstance(font.get(k), str) or not font.get(k, "").strip():
                errors.append(f"theme: font.{k} (a system font stack string) is required")
        size = font.get("baseSizePx", 15)
        if not isinstance(size, (int, float)) or not 10 <= size <= 24:
            errors.append(f"theme: font.baseSizePx must be a number in [10, 24], got {size!r}")
    shape = theme.get("shape")
    if not isinstance(shape, dict):
        errors.append("theme: missing shape object")
    else:
        r = shape.get("radiusPx", 11)
        if not isinstance(r, (int, float)) or not 0 <= r <= 32:
            errors.append(f"theme: shape.radiusPx must be a number in [0, 32], got {r!r}")
        b = shape.get("borderPx", 1.5)
        if not isinstance(b, (int, float)) or not 0 <= b <= 6:
            errors.append(f"theme: shape.borderPx must be a number in [0, 6], got {b!r}")
        sh = shape.get("shadow", "soft")
        if sh not in SHADOWS:
            errors.append(f"theme: shape.shadow must be one of {SHADOWS}, got {sh!r}")


def main() -> None:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "errors": ["usage: python validate_theme.py <theme.json>"]}))
        sys.exit(1)
    errors: list = []
    warnings: list = []
    path = Path(sys.argv[1])
    try:
        theme = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(json.dumps({"ok": False, "errors": [f"file not found: {path}"]}))
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "errors": [f"invalid JSON at line {e.lineno} col {e.colno}: {e.msg}"]}))
        sys.exit(1)

    check_theme(theme, errors)
    if not (theme.get("meta") or {}).get("preset"):
        warnings.append("meta.preset is unset — presets are reused across labs by this slug; set one (e.g. the textbook name)")
    if errors:
        print(json.dumps({"ok": False, "errors": errors}))
        sys.exit(1)
    print(json.dumps({"ok": True, "preset": (theme.get("meta") or {}).get("preset"), "warnings": warnings}))


if __name__ == "__main__":
    main()
