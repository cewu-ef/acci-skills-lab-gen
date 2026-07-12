import json
from pathlib import Path

from conftest import REPO, VALID_CONFIG, run_script

ASSEMBLE_ARGS = ["--theme", "theme.json", "--config", "lab-config.json", "--sim", "sim.js"]


def assemble(ws, extra=()):
    return run_script("assemble.py", [*ASSEMBLE_ARGS, *extra], ws)


def write_config(ws, mutate):
    config = json.loads(json.dumps(VALID_CONFIG))
    mutate(config)
    (ws / "lab-config.json").write_text(json.dumps(config))


# ---------- happy path ----------

def test_valid_inputs_assemble(workspace):
    code, report = assemble(workspace)
    assert code == 0, report
    assert report["ok"] is True
    out = workspace / report["out"]
    assert out.name == "test-lab.html"
    html = out.read_text()
    assert "window.LabKit" in html
    assert "class Sim" in html
    assert 'id="lk-source"' in html
    # manifest recovers theme + config
    manifest = json.loads(html.split('id="lk-source">')[1].split("</script>")[0])
    assert manifest["config"]["id"] == "test-lab"
    assert manifest["theme"]["palette"]["accent"] == "#EE6A3C"
    # sim recoverable between markers
    assert "/*__LK_SIM_BEGIN__*/" in html and "/*__LK_SIM_END__*/" in html
    sim_src = html.split("/*__LK_SIM_BEGIN__*/")[1].split("/*__LK_SIM_END__*/")[0]
    assert "class Sim" in sim_src


def test_assembly_is_deterministic(workspace):
    assemble(workspace)
    first = (workspace / "test-lab.html").read_bytes()
    assemble(workspace)
    assert (workspace / "test-lab.html").read_bytes() == first


def test_no_minify_keeps_kit_comments(workspace):
    code, _ = assemble(workspace, ["--no-minify"])
    assert code == 0
    html = (workspace / "test-lab.html").read_text()
    assert "LabKit v0.1" in html  # kit header comment survives


def test_minify_strips_kit_comments_but_not_sim(workspace):
    (workspace / "sim.js").write_text(
        "// my sim comment\n" + (workspace / "sim.js").read_text())
    code, _ = assemble(workspace)
    assert code == 0
    html = (workspace / "test-lab.html").read_text()
    assert "LabKit v0.1" not in html          # kit comments stripped
    assert "// my sim comment" in html        # sim untouched


# ---------- config validation ----------

def test_missing_id_fails(workspace):
    write_config(workspace, lambda c: c.pop("id"))
    code, report = assemble(workspace)
    assert code == 1
    assert any('"id"' in e for e in report["errors"])


def test_duplicate_control_param_id_fails(workspace):
    write_config(workspace, lambda c: c["params"].append(
        {"id": "mode", "label": "dup", "min": 0, "max": 1, "step": 0.1, "value": 0.5}))
    code, report = assemble(workspace)
    assert code == 1
    assert any("duplicate id 'mode'" in e for e in report["errors"])


def test_param_value_out_of_range_fails(workspace):
    write_config(workspace, lambda c: c["params"][0].update(value=99))
    code, report = assemble(workspace)
    assert code == 1
    assert any("outside" in e for e in report["errors"])


def test_showif_unknown_control_fails(workspace):
    write_config(workspace, lambda c: c["params"][0].update(showIf={"control": "nope", "in": ["a"]}))
    code, report = assemble(workspace)
    assert code == 1
    assert any("showIf.control" in e for e in report["errors"])


def test_showif_unknown_option_value_fails(workspace):
    write_config(workspace, lambda c: c["params"][0].update(showIf={"control": "mode", "in": ["zzz"]}))
    code, report = assemble(workspace)
    assert code == 1
    assert any("showIf.in" in e for e in report["errors"])


def test_unknown_equipment_pack_fails(workspace):
    write_config(workspace, lambda c: c.update(equipment="chemistry"))
    code, report = assemble(workspace)
    assert code == 1
    assert any("unknown equipment pack" in e for e in report["errors"])
    assert any("kinematics" in e for e in report["errors"])  # lists available packs


def test_unknown_layout_warns_not_fails(workspace):
    write_config(workspace, lambda c: c.update(layout="side-controls"))
    code, report = assemble(workspace)
    assert code == 0
    assert any("layout" in w for w in report["warnings"])


# ---------- sim validation ----------

def test_sim_missing_class_fails(workspace):
    (workspace / "sim.js").write_text("function nope() {}")
    code, report = assemble(workspace)
    assert code == 1
    assert any("class Sim" in e for e in report["errors"])


def test_sim_missing_required_method_fails(workspace):
    (workspace / "sim.js").write_text(
        "class Sim { constructor(P) {} reset(P) {} step(dt, t) {} draw(g) {} }")
    code, report = assemble(workspace)
    assert code == 1
    assert any("values()" in e for e in report["errors"])


def test_sim_unbalanced_brace_fails(workspace):
    sim = (workspace / "sim.js").read_text()
    (workspace / "sim.js").write_text(sim + "\nif (true) {\n")
    code, report = assemble(workspace)
    assert code == 1
    assert any("unclosed" in e for e in report["errors"])


def test_sim_brace_in_string_is_fine(workspace):
    sim = (workspace / "sim.js").read_text()
    (workspace / "sim.js").write_text(sim + '\nconst s = "curly { and paren ( inside string";\n')
    code, report = assemble(workspace)
    assert code == 0, report


def test_sim_fetch_fails(workspace):
    sim = (workspace / "sim.js").read_text()
    (workspace / "sim.js").write_text(sim + '\nfetch("/x");\n')
    code, report = assemble(workspace)
    assert code == 1
    assert any("fetch(" in e for e in report["errors"])


def test_sim_url_fails(workspace):
    sim = (workspace / "sim.js").read_text()
    (workspace / "sim.js").write_text(sim + '\nconst u = "https://cdn.example/x.js";\n')
    code, report = assemble(workspace)
    assert code == 1
    assert any("URL" in e for e in report["errors"])


def test_sim_url_in_comment_is_fine(workspace):
    sim = (workspace / "sim.js").read_text()
    (workspace / "sim.js").write_text(sim + "\n// see https://example.com/spec for details\n")
    code, report = assemble(workspace)
    assert code == 0, report


def test_sim_closing_script_tag_fails(workspace):
    sim = (workspace / "sim.js").read_text()
    (workspace / "sim.js").write_text(sim + '\nconst s = "</script>";\n')
    code, report = assemble(workspace)
    assert code == 1
    assert any("</script" in e for e in report["errors"])


# ---------- golden: the two hand-ported example labs ----------

def _golden_check(ws, example: str):
    src = REPO / "examples" / example
    for f in ("theme.json", "lab-config.json", "sim.js"):
        (ws / f).write_text((src / f).read_text())
    code, report = run_script("assemble.py", ASSEMBLE_ARGS, ws)
    assert code == 0, report
    produced = (ws / report["out"]).read_text()
    golden = (src / "golden.html").read_text()
    assert produced == golden, f"{example}: assembled output drifted from golden.html"


def test_golden_acceleration_lab(workspace):
    _golden_check(workspace, "acceleration-lab")


def test_golden_speed_lab(workspace):
    _golden_check(workspace, "speed-lab")
