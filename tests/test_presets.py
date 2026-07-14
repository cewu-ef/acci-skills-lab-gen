import json

import pytest

from conftest import REPO, run_script

PRESETS = sorted((REPO / "skills" / "lab-gen" / "presets").glob("*.theme.json"))


def test_presets_shipped():
    assert len(PRESETS) >= 5


@pytest.mark.parametrize("preset", PRESETS, ids=lambda p: p.stem)
def test_stock_preset_validates_clean(preset, tmp_path):
    (tmp_path / "theme.json").write_text(preset.read_text())
    code, report = run_script("validate_theme.py", ["theme.json"], tmp_path)
    assert code == 0
    assert report["ok"] is True
    assert report["warnings"] == []


@pytest.mark.parametrize("preset", PRESETS, ids=lambda p: p.stem)
def test_stock_preset_filename_matches_meta(preset):
    meta = json.loads(preset.read_text())["meta"]
    assert preset.name == meta["preset"] + ".theme.json"
