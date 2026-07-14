---
name: lab-gen
description: Generate a standalone interactive physics-lab HTML file from textbook lab material (page images or a written brief). Use when asked to build a virtual lab, lab simulation, or interactive experiment page.
---

# Lab Generator

You produce **one standalone, self-contained HTML file per lab** (`<id>.html` in the
workspace). A pre-built runtime (LabKit) provides all page chrome, theming, and the
animation harness — you author only three small files and run an assembly script:

| You write | What it is | Reference |
|---|---|---|
| `themes/<slug>.theme.json` | visual style tokens (once per textbook, reused) | `references/style-extraction.md` |
| `lab-config.json` | declarative chrome: title, selectors, sliders, stat cards | `references/lab-config.md` |
| `sim.js` | one `class Sim` — physics + canvas scene + dashboard values | `references/sim-authoring.md` + `references/drawing-api.md` |

Study `references/example-sim.md` once before writing your first sim.

## Workflow

1. **Study the material** (images or brief): identify the experiment, apparatus,
   the methods/variants offered, measurable quantities, and which parameters a
   student should be able to change.
2. **Theme**: try to read existing presets in the workspace `themes/` directory first
   (attempt `read_file themes/` — if the directory is missing or has no matching preset,
   extract). If a preset for this textbook/course exists, REUSE it — do not re-extract.
   Otherwise follow `references/style-extraction.md`, write `themes/<slug>.theme.json`,
   and check it: `run_skill_script lab-gen/scripts/validate_theme.py themes/<slug>.theme.json`
3. **Write `lab-config.json`** per `references/lab-config.md`.
4. **Author `sim.js`** per `references/sim-authoring.md`, with
   `references/drawing-api.md` at hand for the drawing calls.
5. **Assemble**:
   `run_skill_script lab-gen/scripts/assemble.py --theme themes/<slug>.theme.json --config lab-config.json --sim sim.js`
   On errors: fix the reported file with `edit_file` (minimal exact-string
   replacements — do not rewrite the whole file) and re-run. The report is JSON on
   stdout; errors name the file and, for sim.js syntax issues, the line.
6. **Report to the user**: output filename, size, the methods and adjustable
   parameters it offers. Do NOT read the assembled HTML back — trust the report.

## Modifications ("make the trolley blue", "add a friction slider")

Never edit the assembled HTML. Edit the source it was built from — `sim.js`,
`lab-config.json`, or the theme file in the workspace — then re-run step 5.
The output filename stays the same; the file is replaced.

## Rules

- Stay strictly faithful to the source material: offer only the methods, options,
  and adjustable parameters it actually shows — never invent extra variants, however
  pedagogically tempting. Users extend a lab by uploading more material later
  (e.g. a follow-up page adding methods to the same dropdown), so a single-option
  select is fine as a starting point.
- One lab per run. If the material mixes sources, build from the pages that document
  a single coherent experiment (procedure, apparatus, quantities); exclude pages that
  show no runnable experiment (course outlines, syllabi, unrelated topics) and tell
  the user what you excluded and why, rather than blending sources into one lab.
- No network anywhere: no fetch/XHR/imports/CDN/webfonts in sim.js or the theme.
  The assembler rejects violations.
- All sim state must derive from the params passed to `reset(P)` — this is what
  makes the Reset button and slider changes correct.
- The sim never touches the DOM. It only draws on the canvas via `g` and returns
  dashboard values. All chrome comes from lab-config.json.
- Canvas is 1000×470 unless the config overrides it.
- Never read files under `lab-gen/assets/` — that is the runtime the assembler
  inlines; its API is fully documented in the references.
- Physics in SI units; keep quantities honest (a measured value that differs
  slightly from the true value because of the measurement method is a feature,
  not a bug — textbooks teach exactly that).

## Scripts

- `lab-gen/scripts/assemble.py --theme <theme.json> --config <lab-config.json> --sim <sim.js> [--out <file.html>]`
  Validates everything and writes the standalone lab HTML. JSON report on stdout.
- `lab-gen/scripts/validate_theme.py <theme.json>`
  Standalone theme check (use after extracting a new theme preset).
