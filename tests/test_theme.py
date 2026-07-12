import json

from conftest import VALID_THEME, run_script


def write_theme(ws, mutate):
    theme = json.loads(json.dumps(VALID_THEME))
    mutate(theme)
    (ws / "theme.json").write_text(json.dumps(theme))


def validate(ws):
    return run_script("validate_theme.py", ["theme.json"], ws)


def test_valid_theme_passes(workspace):
    code, report = validate(workspace)
    assert code == 0
    assert report["ok"] is True
    assert report["preset"] == "test"


def test_missing_palette_key_fails(workspace):
    write_theme(workspace, lambda t: t["palette"].pop("accent"))
    code, report = validate(workspace)
    assert code == 1
    assert any("palette.accent" in e for e in report["errors"])


def test_bad_color_fails(workspace):
    write_theme(workspace, lambda t: t["palette"].update(ink="not-a-color"))
    code, report = validate(workspace)
    assert code == 1
    assert any("palette.ink" in e for e in report["errors"])


def test_webfont_url_fails(workspace):
    write_theme(workspace, lambda t: t["font"].update(body="url(https://fonts.example/x.woff2)"))
    code, report = validate(workspace)
    assert code == 1
    assert any("self-contained" in e for e in report["errors"])


def test_bad_shadow_fails(workspace):
    write_theme(workspace, lambda t: t["shape"].update(shadow="dramatic"))
    code, report = validate(workspace)
    assert code == 1
    assert any("shape.shadow" in e for e in report["errors"])


def test_missing_preset_warns(workspace):
    write_theme(workspace, lambda t: t.update(meta={}))
    code, report = validate(workspace)
    assert code == 0
    assert any("meta.preset" in w for w in report["warnings"])
