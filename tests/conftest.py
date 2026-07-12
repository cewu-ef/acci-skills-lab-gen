import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
SCRIPTS = REPO / "skills" / "lab-gen" / "scripts"


VALID_THEME = {
    "meta": {"preset": "test"},
    "palette": {
        "pageBg": "#F9E3D0", "surface": "#FFFDF9", "surfaceAlt": "#FFF7EE",
        "ink": "#3A2A22", "inkMuted": "#A06A3F",
        "accent": "#EE6A3C", "accentContrast": "#FFFFFF",
        "canvasSky": "#FDF3E7", "canvasGround": "#E9CFAE", "inkOnCanvas": "#3A2A22",
    },
    "font": {"body": "sans-serif", "mono": "monospace", "baseSizePx": 15},
    "shape": {"radiusPx": 10, "borderPx": 1.5, "shadow": "soft"},
}

VALID_CONFIG = {
    "id": "test-lab",
    "title": "Test Lab",
    "controls": [
        {"id": "mode", "label": "Mode", "options": [
            {"value": "a", "label": "A"}, {"value": "b", "label": "B"}]},
    ],
    "params": [
        {"id": "speed", "label": "Speed", "min": 0.1, "max": 2.0, "step": 0.1, "value": 1.0},
    ],
    "stats": [{"id": "x", "label": "X", "unit": "m"}],
    "note": "hello",
}

VALID_SIM = """\
class Sim {
  constructor(P) { this.reset(P); }
  reset(P) { this.p = P; this.x = 0; }
  step(dt, t) { this.x += this.p.speed * dt; if (t > 3) return "done"; }
  draw(g) { g.clear(); g.text(String(this.x), 20, 20); }
  values() { return { x: this.x.toFixed(2) }; }
}
"""


@pytest.fixture
def workspace(tmp_path):
    """A fake ACCI workspace pre-loaded with valid inputs; tests mutate as needed."""
    (tmp_path / "theme.json").write_text(json.dumps(VALID_THEME))
    (tmp_path / "lab-config.json").write_text(json.dumps(VALID_CONFIG))
    (tmp_path / "sim.js").write_text(VALID_SIM)
    return tmp_path


def run_script(script: str, args: list, cwd: Path):
    """Run a skill script exactly as the ACCI runtime does (argv subprocess)."""
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / script), *args],
        cwd=cwd, capture_output=True, text=True,
    )
    report = json.loads(proc.stdout) if proc.stdout.strip() else {}
    return proc.returncode, report
