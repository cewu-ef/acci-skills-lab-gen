# Style extraction — theme.json

The theme carries every visual token the lab chrome and canvas derive from.
**One theme per textbook/course, reused across all its labs.**

## Before extracting — cheaper paths first

**1. Workspace reuse.** Try reading workspace files under `themes/` (e.g. attempt
`read_file themes/<likely-slug>.theme.json`; a failed read's error message may
list what exists). If a preset plausibly matching this material's book/course
exists, use it and skip everything below. Consistency across a textbook's
labs matters more than a marginally better per-page match.

**2. Stock presets.** Five validated presets ship with the skill under
`lab-gen/presets/`. Classify the material against this table — you already know
the answer from studying it in step 1:

| Stock preset | Use when the material looks like |
|---|---|
| `textbook-warm` | warm-toned print textbook: cream/peach page, coral/orange/red box headers |
| `textbook-cool` | cool-toned print textbook: white or blue-grey page, blue headers |
| `web-neutral` | web page or plain PDF handout: white cards, grey text, blue links, flat |
| `academic-serif` | bookish/older academic text: cream paper, serif body, deep muted accent |
| `dark-slate` | dark screen-first material: slides or dark-mode sites |

If one fits, copy it into the workspace as `themes/<slug>.theme.json` and use
**delta-extraction**: keep everything, adjust only the identity tokens that
visibly differ on the page — usually some of `accent`, `pageBg`, `canvasGround`,
`info` — and set `meta.preset` to your slug and `meta.source` to
`"<stock-name> + <material>"`. Naming: material from a specific textbook/course →
a slug for that book (future labs then hit path 1); generic material (a random
web page) → keep the stock name unchanged, copy as-is.

**3. Full extraction** (the rest of this document) only when no stock preset is
close and the material has a strong visual identity worth matching.

## Schema (all keys shown; palette roles marked * are required)

```json
{
  "meta": {
    "preset": "phys-igcse-warm",        // slug — becomes the filename themes/<preset>.theme.json
    "source": "page-042.png"            // what it was extracted from
  },
  "palette": {
    "pageBg": "#F9E3D0",       // * page background behind everything
    "surface": "#FFFDF9",      // * cards / control bar background
    "surfaceAlt": "#FFF7EE",   // * inputs, secondary buttons
    "line": "#EAD0BA",         //   card & input borders (optional; derived if absent)
    "ink": "#3A2A22",          // * primary text
    "inkMuted": "#A06A3F",     // * captions, labels, secondary text
    "accent": "#EE6A3C",       // * primary action (Start button, highlights, sliders)
    "accentContrast": "#FFFFFF", // * text on accent
    "good": "#1E9E5A",         //   live/positive readouts (optional)
    "warn": "#B45309",         //   (optional)
    "danger": "#B91C1C",       //   error banner (optional)
    "info": "#0E7C86",         //   true-value cards, graph lines (optional)
    "canvasSky": "#FDF3E7",    // * canvas scene background (top)
    "canvasGround": "#E9CFAE", // * bench/floor tones in the scene
    "inkOnCanvas": "#3A2A22"   // * annotation text drawn on the canvas
  },
  "font": {
    "body": "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    "heading": "inherit",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "baseSizePx": 15
  },
  "shape": {
    "radiusPx": 12,            // corner rounding feel: 0-4 sharp, 8-14 friendly, 16+ soft
    "borderPx": 1.5,           // border weight
    "shadow": "soft"           // "flat" | "soft" | "crisp" (crisp = offset hard shadow)
  }
}
```

## Reading tokens off the material image

- **pageBg**: the page's dominant paper/background color. If the page is plain
  white, use a very slightly tinted off-white rather than pure #FFF.
- **surface / surfaceAlt**: colors of boxes/panels on the page; usually a step
  lighter or warmer than pageBg. surfaceAlt slightly tinted toward pageBg.
- **line**: the border color of boxes/rules on the page.
- **ink / inkMuted**: heading-and-body text color; muted = the color used for
  captions, figure labels, page furniture. If the page has no muted text color
  (all-black captions), derive one: mix ink toward pageBg (~50%).
- **accent**: the strongest recurring highlight color (box headers, key terms,
  arrows in figures). accentContrast = white unless the accent is light.
  - **Tie-breaking**: if the page has TWO highlight families (e.g. a coral
    header bar AND teal links/rules), accent = the one used for structural
    headers/boxes; route the secondary family to `info`.
  - **Contrast beats literal sampling**: if the sampled accent is too light for
    white text on it, darken it until it reads comfortably — a slightly deeper
    accent that works is more faithful than an unusable literal sample.
- **canvasSky / canvasGround**: what the *figure illustrations* use for open
  background and surfaces/floors. The figures' LITERAL colors win: if the
  book's apparatus drawings sit on a cool blue-grey baseplate, canvasGround is
  that blue-grey, not a warm wood tone. These drive the whole scene's mood.
- **info / good**: if the material has a secondary color family (often
  teal/blue/green in science texts), use it; otherwise omit (defaults exist).
- **Fonts must be SYSTEM STACKS** — never webfonts or URLs (rejected by the
  validator). Map the material's feel: geometric/clean → the -apple-system
  stack; bookish/serif → `Georgia, 'Times New Roman', serif` for body or
  heading; data readouts always keep a mono stack.
- **shape**: rounded boxes on the page → radiusPx 10–14; sharp academic boxes →
  2–6; heavy rules → borderPx 2; hairlines → 1.

Aim for a palette that would look at home printed on the same page as the
material. When unsure between two candidates, pick the softer/warmer one.

## Validate and save

```
write_file themes/<preset>.theme.json
run_skill_script lab-gen/scripts/validate_theme.py themes/<preset>.theme.json
```

Fix reported errors before assembling. (If a dedicated style pipeline provides
a conforming theme.json, use it as-is — everything downstream only needs the
file.)
