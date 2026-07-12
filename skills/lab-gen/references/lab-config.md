# lab-config.json — declarative chrome

Everything on the page except the canvas scene is built from this file: header,
control bar (selects + Settings/Reset/Start buttons), the settings popover with
sliders, the dashboard stat cards, and the footer note. You never write DOM code.

## Annotated example

```json
{
  "id": "acceleration-lab",              // REQUIRED. Slug [A-Za-z0-9_-]; output filename <id>.html
  "title": "Measuring the Acceleration of a Trolley",
  "subtitle": "BOX 2.1 · Interactive lab",   // optional, small line under the title
  "layout": "standard",                  // optional; "standard" is the only v1 layout
  "equipment": "kinematics",             // optional; inlines a pre-built apparatus pack (see below)
  "canvas": { "w": 1000, "h": 470 },     // optional; these are the defaults

  "controls": [                          // dropdown selects in the control bar
    {
      "id": "method",                    // identifier; becomes P.method in the sim
      "label": "Method",                 // small uppercase caption above the select
      "width": 260,                      // px, optional
      "value": "gate",                   // optional default (else first option)
      "options": [
        { "value": "gate",   "label": "Light gate + interrupt card" },
        { "value": "ticker", "label": "Ticker-timer" }
      ]
    }
  ],

  "params": [                            // range sliders in the Settings popover
    {
      "id": "v0",                        // identifier; becomes P.v0 (a number) in the sim
      "label": "Starting speed u₀",
      "min": 0.1, "max": 0.8, "step": 0.05, "value": 0.3,
      "unit": "m/s",                     // shown next to the live value
      "decimals": 2,                     // formatting of the live value
      "showIf": { "control": "method", "in": ["gate"] }   // optional visibility rule
    }
  ],

  "stats": [                             // dashboard cards under the canvas
    { "id": "u",     "label": "Initial u",         "unit": "m/s" },
    { "id": "accel", "label": "Acceleration",      "unit": "m/s²", "variant": "accent" },
    { "id": "trueA", "label": "True acceleration", "unit": "m/s²", "variant": "info" }
  ],

  "note": "The card breaks the beam twice — u from the first section, v from the second."
}
```

## Semantics

- **Namespace**: control ids and param ids share ONE namespace — the sim receives
  them together as `P` (`P.method` is the selected option's string value,
  `P.v0` is the slider's number). Ids must be unique across both lists and match
  `[a-zA-Z][a-zA-Z0-9_]*`.
- **Any change hard-resets**: when the user moves a slider or changes a select,
  the harness calls `sim.reset(P)` with fresh values and returns to the idle
  state. You never wire change handlers.
- **showIf**: the param's slider row is only visible while the named control's
  current value is in the `in` list. Use it to show method-specific settings.
  `showIf.control` must be a declared control id and `in` values must exist
  among its options (the assembler checks). A hidden param is STILL present in
  `P` with its current slider value — the sim can rely on it unconditionally.
- **Stat ids are a separate namespace** from controls/params (a stat may reuse
  a param's name without conflict), but distinct names read better.
- **stats**: each card shows `label` (small caps), a large monospace value, and
  `unit`. Initial value is "—"; the sim updates cards every frame from
  `values()` (see sim-authoring.md — it can also update label/unit, hide cards,
  and mark them "live"). `variant`: `"accent"` = highlighted result card,
  `"info"` = secondary/true-value card (teal-ish). At most one accent card.
- **note**: initial footer text; the sim may replace it per method via the
  reserved `_note` key in `values()`.
- **Settings button** appears only if `params` is non-empty.
- **strings** (optional object): override button labels
  `{ "start", "pause", "resume", "runAgain", "reset", "settings", "settingsTitle" }` —
  e.g. for non-English labs.

## Layouts

`"standard"` (default and only v1 layout): header → control bar → canvas →
stat-card grid → note. Unknown layout names fall back to standard with a warning.

## Equipment packs

Optional pre-built apparatus drawing functions, inlined only when declared:

- `"equipment": "kinematics"` — motion-along-a-track apparatus: bench, track,
  trolley, light gates, digital timer, ticker-timer, power supply, tape, motion
  sensor, laptop, pulse arcs. Full API in `references/drawing-api.md` (the `EQ.*`
  section). Use it whenever the lab is a bench/track motion experiment — do not
  redraw this equipment by hand.

If the lab needs apparatus no pack provides (pendulums, springs, optics…), draw
it yourself with the DrawKit primitives.
