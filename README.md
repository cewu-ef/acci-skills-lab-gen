# acci-skills-lab-gen

Development repo for the **`lab-gen`** ACCI skill: generates standalone interactive
physics-lab HTML files from textbook lab material (PNG screenshots), fast, by shipping a
pre-built runtime kit (LabKit) so the model authors only the lab-specific simulation.

## Layout

- `skills/lab-gen/` — the skill itself (the only tree that migrates to `efcloud/efekta-acci-skills`)
  - `assets/` — LabKit runtime (`labkit.js`, `labkit.css`, `skeleton.html`); read by scripts,
    never by the model
  - `scripts/assemble.py` — theme.json + lab-config.json + sim.js → standalone `lab.html`
  - `references/`, `SKILL.md` — agent-facing docs (later phase)
- `examples/` — hand-ported reference labs (validation corpus)
- `dev/` — local dev loop: `run_local.py` (mimics the ACCI `run_skill_script` sandbox),
  `preview.py` (playwright render check + screenshots)
- `tests/` — pytest suite

## Quick start

```bash
pip install -r requirements-dev.txt
python dev/run_local.py --theme theme.json --config lab-config.json --sim sim.js
python dev/preview.py dev/workspace/<lab-id>.html
```

Plan: `~/.claude/plans/cool-now-lets-think-melodic-simon.md`
