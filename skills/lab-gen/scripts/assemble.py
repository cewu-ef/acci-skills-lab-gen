"""Assemble a standalone interactive lab HTML file.

Stitches theme.json + lab-config.json + sim.js (workspace files) together with
the bundled LabKit runtime (assets/) into one self-contained HTML document,
and embeds a source manifest (theme + config) so future sessions can recover
the editable sources from the artifact alone. sim.js is recoverable from the
/*__LK_SIM_BEGIN__*/ ... /*__LK_SIM_END__*/ markers in the output.

Usage (cwd = the agent workspace; paths are workspace-relative):
    python assemble.py --theme theme.json --config lab-config.json --sim sim.js
                       [--out lab.html] [--no-minify]

stdout: one-line JSON report {"ok": bool, "out": str, "bytes": int, "warnings": [...]}
        or {"ok": false, "errors": [...]} with exit code 1.
stderr: human-readable progress.

Python stdlib only — runs inside the ACCI run_skill_script sandbox.
"""

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"

READBACK_CAP = 48_000  # ACCI workspace read_file cap; warn if the output exceeds it

# Slot -> how it is replaced in skeleton.html
SLOT_THEME = "/*__THEME_JSON__*/ null"
SLOT_CONFIG = "/*__CONFIG_JSON__*/ null"
SLOT_MANIFEST = "/*__MANIFEST_JSON__*/"
SLOT_CSS = "/*__LABKIT_CSS__*/"
SLOT_KIT = "/*__LABKIT_JS__*/"
SLOT_EQUIPMENT = "/*__EQUIPMENT_JS__*/"
SLOT_SIM = "/*__SIM_JS__*/"
SLOT_TITLE = "__LAB_TITLE__"

# Markers that intentionally remain in the assembled output (sim source recovery)
KEPT_MARKERS = ("/*__LK_SIM_BEGIN__*/", "/*__LK_SIM_END__*/")

ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")
SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(")

# ---- theme schema (keep in sync with validate_theme.py, duplicated by design:
# the runtime only executes top-level scripts/<name>.py, so no shared module) ----
REQUIRED_PALETTE = [
    "pageBg", "surface", "surfaceAlt", "ink", "inkMuted",
    "accent", "accentContrast", "canvasSky", "canvasGround", "inkOnCanvas",
]
OPTIONAL_PALETTE = ["line", "good", "warn", "danger", "info"]
SHADOWS = ("flat", "soft", "crisp")

VARIANTS = ("accent", "info")
# Deny-list of constructs the generated sim.js may not contain. These are regex
# patterns matched against the sim source to REJECT it — nothing here is executed.
FORBIDDEN_SIM = [
    (r"\bfetch\s*\(", "fetch("),
    (r"\bXMLHttpRequest\b", "XMLHttpRequest"),
    (r"\bimport\b", "import"),
    (r"\brequire\s*\(", "require("),
    (r"\beval\s*\(", "eval("),
    (r"\bnew\s+Function\b", "new Function"),
    (r"\bdocument\.write\b", "document.write"),
    (r"https?://", "http(s):// URL"),
    (r"<script", "<script tag"),
]


def progress(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def fail(errors) -> None:
    print(json.dumps({"ok": False, "errors": errors}))
    sys.exit(1)


def load_json(path: Path, label: str, errors: list):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"{label}: file not found: {path}")
    except json.JSONDecodeError as e:
        errors.append(f"{label}: invalid JSON at line {e.lineno} col {e.colno}: {e.msg}")
    return None


# ================= theme validation =================

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
            if not isinstance(v, str) or not COLOR_RE.match(v.strip()):
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


# ================= config validation =================

def check_config(config, errors: list, warnings: list) -> None:
    if not isinstance(config, dict):
        errors.append("config: must be a JSON object")
        return
    cid = config.get("id")
    if not isinstance(cid, str) or not SLUG_RE.match(cid or ""):
        errors.append(f'config: "id" is required and must be a slug ([A-Za-z0-9_-], starts alphanumeric), got {cid!r}')
    if not config.get("title"):
        warnings.append('config: no "title" set — the lab header will be generic')

    layout = config.get("layout", "standard")
    if layout != "standard":
        warnings.append(f'config: unknown layout {layout!r} — falling back to "standard" (the only v1 layout)')

    eq = config.get("equipment")
    if eq is not None and (not isinstance(eq, str) or not SLUG_RE.match(eq)):
        errors.append(f"config: equipment must be a pack-name slug, got {eq!r}")

    canvas = config.get("canvas", {})
    if not isinstance(canvas, dict):
        errors.append("config: canvas must be an object")
    else:
        w, h = canvas.get("w", 1000), canvas.get("h", 470)
        if not isinstance(w, int) or not 320 <= w <= 1600:
            errors.append(f"config: canvas.w must be an int in [320, 1600], got {w!r}")
        if not isinstance(h, int) or not 240 <= h <= 1000:
            errors.append(f"config: canvas.h must be an int in [240, 1000], got {h!r}")

    controls = config.get("controls", [])
    params = config.get("params", [])
    stats = config.get("stats", [])
    for name, arr in (("controls", controls), ("params", params), ("stats", stats)):
        if not isinstance(arr, list):
            errors.append(f"config: {name} must be an array")
            return

    # controls and params share one values namespace in the harness
    seen = {}
    control_options = {}
    for c in controls:
        cid2 = c.get("id", "")
        if not ID_RE.match(str(cid2)):
            errors.append(f"config: control id {cid2!r} must be an identifier")
            continue
        if cid2 in seen:
            errors.append(f"config: duplicate id {cid2!r} (controls and params share a namespace)")
        seen[cid2] = "control"
        opts = c.get("options") or []
        if not opts:
            errors.append(f"config: control {cid2!r} needs a non-empty options array")
        vals = []
        for o in opts:
            if not isinstance(o, dict) or "value" not in o or "label" not in o:
                errors.append(f"config: control {cid2!r} options need value+label")
            else:
                vals.append(o["value"])
        if len(set(vals)) != len(vals):
            errors.append(f"config: control {cid2!r} has duplicate option values")
        if "value" in c and c["value"] not in vals:
            errors.append(f"config: control {cid2!r} default value {c['value']!r} is not among its options")
        control_options[cid2] = vals

    for prm in params:
        pid = prm.get("id", "")
        if not ID_RE.match(str(pid)):
            errors.append(f"config: param id {pid!r} must be an identifier")
            continue
        if pid in seen:
            errors.append(f"config: duplicate id {pid!r} (controls and params share a namespace)")
        seen[pid] = "param"
        mn, mx, st, val = prm.get("min"), prm.get("max"), prm.get("step"), prm.get("value")
        nums = all(isinstance(x, (int, float)) for x in (mn, mx, st, val))
        if not nums:
            errors.append(f"config: param {pid!r} needs numeric min/max/step/value")
        else:
            if mn >= mx:
                errors.append(f"config: param {pid!r} needs min < max (got {mn} >= {mx})")
            if st <= 0:
                errors.append(f"config: param {pid!r} needs step > 0")
            if not mn <= val <= mx:
                errors.append(f"config: param {pid!r} value {val} outside [{mn}, {mx}]")
        dec = prm.get("decimals")
        if dec is not None and (not isinstance(dec, int) or not 0 <= dec <= 4):
            errors.append(f"config: param {pid!r} decimals must be an int in [0, 4]")
        si = prm.get("showIf")
        if si is not None:
            ref = si.get("control") if isinstance(si, dict) else None
            if ref not in control_options:
                errors.append(f"config: param {pid!r} showIf.control {ref!r} is not a declared control id")
            else:
                unknown = [v for v in (si.get("in") or []) if v not in control_options[ref]]
                if unknown:
                    errors.append(f"config: param {pid!r} showIf.in has values not offered by control {ref!r}: {unknown}")

    stat_ids = set()
    for st in stats:
        sid = st.get("id", "")
        if not ID_RE.match(str(sid)):
            errors.append(f"config: stat id {sid!r} must be an identifier")
            continue
        if sid in stat_ids:
            errors.append(f"config: duplicate stat id {sid!r}")
        stat_ids.add(sid)
        if st.get("variant") is not None and st["variant"] not in VARIANTS:
            errors.append(f"config: stat {sid!r} variant must be one of {VARIANTS}")

    note = config.get("note", "")
    if isinstance(note, str) and len(note) > 500:
        warnings.append("config: note is very long (> 500 chars)")


# ================= sim validation =================

def _js_scan(src: str, keep_comments: bool = False):
    """Yield (index, char, state) for JS source, tracking string/template/comment
    state. state is None for code, else one of ' \" ` line block."""
    i, n = 0, len(src)
    state = None
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if state is None:
            if c == "/" and nxt == "/":
                state = "line"; yield i, c, state; i += 1; yield i, nxt, state; i += 1; continue
            if c == "/" and nxt == "*":
                state = "block"; yield i, c, state; i += 1; yield i, nxt, state; i += 1; continue
            if c in ("'", '"', "`"):
                yield i, c, c
                state = c; i += 1; continue
            yield i, c, None; i += 1; continue
        if state == "line":
            if c == "\n":
                state = None
                yield i, c, None
            else:
                yield i, c, "line"
            i += 1; continue
        if state == "block":
            if c == "*" and nxt == "/":
                yield i, c, "block"; i += 1; yield i, nxt, "block"; i += 1
                state = None; continue
            yield i, c, "block"; i += 1; continue
        # in a string/template
        if c == "\\" and i + 1 < n:
            yield i, c, state; i += 1; yield i, src[i], state; i += 1; continue
        yield i, c, state
        if c == state:
            state = None
        i += 1


def strip_comments(src: str) -> str:
    """Comment-free copy of JS source (strings/templates preserved)."""
    return "".join(c for _, c, st in _js_scan(src) if st not in ("line", "block"))


def check_sim(js: str, errors: list, warnings: list) -> None:
    if "</script" in js.lower():
        errors.append(
            "sim.js: contains a literal '</script' which would truncate the inline embed. "
            "Inside string literals write '<\\/script' instead."
        )
    code = strip_comments(js)
    if not re.search(r"\bclass\s+Sim\b", code):
        errors.append("sim.js: must define exactly one `class Sim` (none found)")
    for m in ("reset", "step", "draw", "values"):
        if not re.search(rf"\b{m}\s*\(", code):
            errors.append(f"sim.js: required Sim method {m}() not found")
    for pattern, label in FORBIDDEN_SIM:
        if re.search(pattern, code):
            errors.append(f"sim.js: forbidden construct: {label} (labs must be self-contained, no network/dynamic code)")

    # bracket balance, string/comment aware
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    line = 1
    for _, c, st in _js_scan(js):
        if c == "\n":
            line += 1
        if st is not None:
            continue
        if c in "([{":
            stack.append((c, line))
        elif c in ")]}":
            if not stack or stack[-1][0] != pairs[c]:
                errors.append(f"sim.js: unbalanced {c!r} around line {line}")
                return
            stack.pop()
    if stack:
        c, ln = stack[-1]
        errors.append(f"sim.js: unclosed {c!r} opened around line {ln}")

    if len(js.encode("utf-8")) > 40_000:
        warnings.append(f"sim.js is large ({len(js.encode('utf-8'))} bytes); aim for well under 40KB")


# ================= output validation =================

VOID_TAGS = {"meta", "link", "br", "hr", "img", "input", "source", "wbr", "area", "base", "col", "embed", "track"}


class _TagBalance(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.problems = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        if not self.stack or self.stack[-1] != tag:
            self.problems.append(f"unexpected </{tag}> (open stack: {self.stack[-3:]})")
        else:
            self.stack.pop()


def check_html(html: str, errors: list) -> None:
    p = _TagBalance()
    try:
        p.feed(html)
        p.close()
    except Exception as e:  # html.parser is forgiving; this is belt-and-braces
        errors.append(f"output: HTML parse failed: {e}")
        return
    for prob in p.problems:
        errors.append(f"output: {prob}")
    if p.stack:
        errors.append(f"output: unclosed tags at end of document: {p.stack}")


# ================= minification (kit assets only, never sim.js) =================

def strip_js(src: str) -> str:
    """Light minify for bundled kit assets: drop comments, indentation, blank lines."""
    out = "".join(c for _, c, st in _js_scan(src) if st not in ("line", "block"))
    lines = [ln.strip() for ln in out.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def strip_css(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    lines = [ln.strip() for ln in src.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def json_for_inline_script(obj) -> str:
    """JSON that is safe to embed inside <script> content."""
    return json.dumps(obj, ensure_ascii=True, separators=(",", ":")).replace("</", "<\\/")


# ================= main =================

def main() -> None:
    ap = argparse.ArgumentParser(description="Assemble a standalone lab HTML file")
    ap.add_argument("--theme", required=True, help="theme.json path (workspace-relative)")
    ap.add_argument("--config", required=True, help="lab-config.json path")
    ap.add_argument("--sim", required=True, help="sim.js path")
    ap.add_argument("--out", help="output HTML path (default: <config.id>.html)")
    ap.add_argument("--no-minify", action="store_true", help="keep kit assets unstripped (debugging)")
    args = ap.parse_args()

    errors: list = []
    warnings: list = []

    progress("reading inputs…")
    theme = load_json(Path(args.theme), "theme", errors)
    config = load_json(Path(args.config), "config", errors)
    sim_path = Path(args.sim)
    try:
        sim_js = sim_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        sim_js = None
        errors.append(f"sim: file not found: {sim_path}")
    if errors:
        fail(errors)

    progress("validating…")
    check_theme(theme, errors)
    check_config(config, errors, warnings)
    check_sim(sim_js, errors, warnings)
    if errors:
        fail(errors)

    progress("reading LabKit assets…")
    try:
        skeleton = (ASSETS / "skeleton.html").read_text(encoding="utf-8")
        kit_js = (ASSETS / "labkit.js").read_text(encoding="utf-8")
        kit_css = (ASSETS / "labkit.css").read_text(encoding="utf-8")
    except FileNotFoundError as e:
        fail([f"skill assets missing (broken install): {e}"])

    # optional equipment pack, declared as `"equipment": "<name>"` in lab-config
    equipment_js = ""
    eq_name = config.get("equipment")
    if eq_name:
        eq_path = ASSETS / f"equipment-{eq_name}.js"
        if not eq_path.exists():
            available = sorted(q.stem.replace("equipment-", "") for q in ASSETS.glob("equipment-*.js"))
            fail([f'config: unknown equipment pack "{eq_name}" (available: {available})'])
        equipment_js = eq_path.read_text(encoding="utf-8")

    if not args.no_minify:
        kit_js = strip_js(kit_js)
        kit_css = strip_css(kit_css)
        if equipment_js:
            equipment_js = strip_js(equipment_js)

    progress("assembling…")
    manifest = {
        "labkit": "0.1.0",
        "theme": theme,
        "config": config,
        "sim": "inline:lk-sim-markers",  # sim.js sits between /*__LK_SIM_BEGIN__*/ and /*__LK_SIM_END__*/
    }

    html = skeleton
    replacements = [
        (SLOT_TITLE, str(config.get("title", "Interactive lab"))),
        (SLOT_CSS, kit_css),
        (SLOT_MANIFEST, json_for_inline_script(manifest)),
        (SLOT_THEME, json_for_inline_script(theme)),
        (SLOT_CONFIG, json_for_inline_script(config)),
        (SLOT_KIT, kit_js),
        (SLOT_EQUIPMENT, equipment_js),
        (SLOT_SIM, sim_js),
    ]
    for slot, content in replacements:
        if slot not in html:
            fail([f"internal: skeleton slot {slot!r} missing (broken install)"])
        html = html.replace(slot, content, 1)

    leftover = [
        m.group(0)
        for m in re.finditer(r"/\*__[A-Z_]+__\*/|__LAB_TITLE__", html)
        if m.group(0) not in KEPT_MARKERS
    ]
    if leftover:
        fail([f"internal: unfilled skeleton slots remain: {sorted(set(leftover))}"])

    check_html(html, errors)
    if errors:
        fail(errors)

    out_path = Path(args.out) if args.out else Path(f"{config['id']}.html")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")

    size = len(html.encode("utf-8"))
    if size > READBACK_CAP:
        warnings.append(
            f"output is {size} bytes (> {READBACK_CAP} workspace read-back cap); "
            "it works, but the agent cannot read_file it in one go"
        )

    progress(f"wrote {out_path} ({size} bytes)")
    print(json.dumps({"ok": True, "out": str(out_path), "bytes": size, "warnings": warnings}))


if __name__ == "__main__":
    main()
