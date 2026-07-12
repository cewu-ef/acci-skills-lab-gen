# sim.js — authoring the Sim class

`sim.js` is a plain top-level script (no imports, no DOM) defining exactly one
class named `Sim`. The harness instantiates it, drives it from a
requestAnimationFrame loop, and connects it to the chrome you declared in
lab-config.json.

## The contract

```js
class Sim {
  constructor(P) { this.reset(P); }   // P: initial values — selects (strings) + sliders (numbers) by id

  reset(P) {}      // REQUIRED. Re-derive ALL state from P. Called on Reset, on any
                   // slider/select change, and on "Run again". Store P (this.p = P).

  step(dt, t) {}   // REQUIRED. Advance physics by dt seconds (already clamped ≤ 0.05).
                   // t = total run time. Called only while running.
                   // Return the string "done" to end the run.

  draw(g) {}       // REQUIRED. Repaint the whole canvas scene using the DrawKit g.
                   // Called EVERY frame in every state (idle/running/paused/done).

  values() {}      // REQUIRED. Return dashboard updates: { statId: patch, ... }.
                   // Called every frame after draw().

  onChange(id, value, P) {}  // OPTIONAL. Peek at a control/param change before the
                             // automatic hardReset that follows it.
}
```

## Lifecycle (what the harness does)

```
boot:        new Sim(P) → reset(P) happens via your constructor
every frame: [running? → t += dt; step(dt, t)] → draw(g) → values() → stat cards update
Start btn:   idle→running, running→paused, paused→running, done→(t=0, reset(P), running)
Reset btn / any slider or select change: t=0, state=idle, reset(P)
step returns "done": state=done, Start button relabels "Run again"
```

- The run clock `t` belongs to the harness; read it as `g.t` in `draw` and store
  what you need (common pattern: `this.tNow = Math.min(g.t, this.doneT)` at the
  top of `draw`, then `values()` uses `this.tNow`).
- `values()` receives NO arguments and has no access to the harness state —
  capture whatever it needs (`this.tNow`, `this.running = g.state === "running"`)
  in `draw`/`step` first.
- If your constructor or any method throws, a visible error banner appears on
  the page with the message — write defensively, especially division by zero.

## values() patch semantics

Each entry updates the stat card with that id:

```js
values() {
  return {
    speed: "1.29",                                   // string/number → just the value
    timer: { value: "1.29", live: true },            // live: value turns green (measuring now)
    dist:  { value: "0.80", label: "Gate spacing d", unit: "m" },  // relabel/re-unit per method
                                                     // (unit: "" cleanly removes the unit)
    actual:{ value: "—", hidden: true },             // hide/show whole card
    _note: "Two gates give the average speed…"       // RESERVED: replaces the footer note
  };
}
```

Use `"—"` (em dash) for not-yet-measured values. Pre-format numbers with
`.toFixed(...)` — cards display exactly the string you send.

## Prescribed internal layout

Keep this order — it keeps physics, measurement, drawing, and dashboard separable:

```js
// 1. World-geometry constants (metres): track length, equipment positions…
const X0 = 2.55, ENDX = 0.18;

class Sim {
  constructor(P) { this.reset(P); }
  reset(P) { this.p = P; this.doneT = this.timeTo(X0 - ENDX); /* all state from P */ }

  // 2. Physics model — closed-form where possible (exact, reversible, no drift)
  timeTo(dx) { /* time to travel dx */ }
  xAt(t) { /* position at t */ }
  vAt(t) { /* velocity at t */ }

  // 3. Measurement-event logic (when do gates trigger, samples land, dots print)
  gateTimes() { /* ... */ }

  step(dt, t) { if (t >= this.doneT) return "done"; }

  // 4. Scene: compose equipment + bespoke drawing, then callouts
  draw(g) { /* see drawing-api.md */ }

  // 5. Dashboard
  values() { /* per-method captions and computed readouts */ }
}
```

## Conventions & tips

- **SI units, world coordinates in metres**; the projection maps world → pixels
  (drawing-api.md). Standard bench scene: track from x=3 to x=0, object starts
  at X0≈2.55 moving toward 0, ends at ENDX≈0.18.
- **Closed-form physics beats integration** when available (`xAt(t)` from
  kinematics equations): Reset/pause/scrub stay exact and measured values are
  reproducible. Integrate incrementally only when there is no closed form
  (with dt already clamped, simple Euler is acceptable).
- **Reset correctness**: everything derives from `P` inside `reset` — never
  cache anything across resets.
- **Measured vs true**: compute the *measured* value the real apparatus would
  produce (average over a card length, spacing of tape dots, sample deltas) and,
  when instructive, show the *true* instantaneous value in an `"info"` card.
  The small discrepancy is the pedagogy.
- **Method switching**: read the current method from `this.p.<controlId>` —
  branch in `step`/`draw`/`values`. Don't build separate classes.
- **Slow motion for fast experiments** (free fall, collisions — anything under
  ~1.5 s): keep physics time honest but advance it at a fraction of real time,
  e.g. `this.simT += dt * 0.35` inside `step`, deriving everything from
  `this.simT`. Timers/readouts display *physics* time. Disclose it on-canvas
  (e.g. `g.text("SLOW MOTION ×0.35", 14, 20, …)`).
- Keep sim.js under ~350 lines / 40KB. If you exceed that, you are probably
  hand-drawing equipment a pack provides.
