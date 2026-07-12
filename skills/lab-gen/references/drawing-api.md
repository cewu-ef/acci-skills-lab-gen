# Drawing API — the DrawKit `g` and the EQ equipment packs

`sim.draw(g)` receives one object with everything needed to paint the scene.
`g.ctx` is the raw CanvasRenderingContext2D escape hatch — use it freely for
anything the helpers don't cover.

## Fields (read-only)

| Field | Meaning |
|---|---|
| `g.ctx, g.W, g.H` | 2D context and canvas logical size (default 1000×470) |
| `g.t, g.dt` | run clock (s) and last frame's dt |
| `g.state` | `"idle" \| "running" \| "paused" \| "done"` |
| `g.params` | current control+slider values by id (same shape as `P`) |
| `g.labelAlpha` | 1 at rest → fades to 0.15 while running; used by callout |
| `g.theme` | canvas color roles: `sky ground ink muted accent good warn danger info surface fontBody fontMono` |

Use `g.theme` colors wherever a color is thematic (backgrounds, annotations,
graphs); use literal colors for physical equipment (a red trolley is red in any
theme).

## Projection — the pseudo-3D bench space

World coordinates in metres: **x** right along the bench, **z** depth (toward
the viewer is negative), **y** up.

```js
g.P(x, z, y)   // → [px, py] screen point
g.setView({ OX: 28, BY: 352, S: 280, TX: 130, TZ: 70 })  // defaults shown ≈ these
```

`px = OX + x*S + z*TX`, `py = BY - y*S - z*TZ`. The standard bench scene
(matches the kinematics pack's positions) uses exactly
`{OX: 28, BY: 352, S: 280, TX: 130, TZ: 70}` on a 1000×470 canvas — call
`g.setView(...)` once at the top of `draw` with the values you design around.

## Methods

```js
g.clear(top?, bottom?)          // clear + vertical bg gradient (defaults: theme sky)
g.shade(color, f)               // multiply color: f<1 darkens, f>1 lightens ("#hex" or rgb())
g.tint(color, t)                // blend hex color toward white, t in [0,1]
g.poly(pts, fill?, stroke?, lw?)          // filled/stroked polygon, pts = [[px,py],...]
g.box3D(xa, xb, za, zb, y0, y1, color)    // shaded cuboid in world coords. Faces drawn:
                                          // top at y1, right end at xb, and the FRONT face on
                                          // the za side (za < zb; za is toward the viewer)
g.text(str, px, py, {size, weight, color, align, baseline, mono}?)
g.arrow(x1, y1, x2, y2, color, w?)        // line + arrowhead (screen px)
g.callout(text, tx, ty, lx, ly, alpha?)   // margin label with elbow leader to target (tx,ty);
                                          // alpha defaults to g.labelAlpha (auto-fades while
                                          // running — no code needed).
   // Geometry: the label TEXT is centered horizontally at lx. The leader runs vertically from
   // just beyond the label, elbows at mid-height, then goes to the target dot. If ly < ty the
   // label sits ABOVE the target (text baseline above ly), else below. Convention from the
   // reference labs: park labels in the clear top strip (ly ≈ 30) or bottom strip (ly ≈ 452)
   // and clamp lx away from the canvas edges (keep lx within ~80..920 for short labels).
g.graphInset({x, y, w, h, title?, xLabel?, yLabel?})
   // Draws a framed mini-graph card + axes, returns the plot area:
   //   {ax, ay, aw, ah, px(fx), py(fy)}   fx, fy ∈ [0,1] fractions of the axes
   // You draw your own series inside:
   const box = g.graphInset({ x: 740, y: 16, w: 240, h: 150, title: "HEIGHT–TIME", xLabel: "t", yLabel: "h" });
   ctx.strokeStyle = g.theme.info; ctx.beginPath();
   pts.forEach(([t, h], i) => { const x = box.px(t/tMax), y = box.py(h/hMax);
                                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
   ctx.stroke();
```

---

# EQ — the "kinematics" equipment pack

Available as global `EQ` **only when lab-config declares `"equipment": "kinematics"`**.
Pre-built, visually polished apparatus for motion-along-a-track labs. All
positions are world metres. Always pass `g` first.

```js
EQ.bench(g)                              // wooden bench top+skirt (theme ground colors)
EQ.track(g)                              // straight track x∈[0,3] with two rails
EQ.trolley(g, { x, card?, color?, length? })
   // x = front edge; length default 0.30
   // card: { type: "flat", length }                — plain interrupt card
   //       { type: "interrupt", length, gap? }     — two sections + notch (gap default 0.07)
EQ.lightGate(g, { x, blocked, layer })   // layer "back" BEFORE the trolley, "front" AFTER
EQ.timerBox(g, { text, active, x?, z? }) // digital timer; active = glowing (measuring now).
                                         // Default position x=0.02, z=0.50 (bench back-left);
                                         // pass x/z to place it elsewhere. Callout target for
                                         // the device at default position: ≈ g.P(0.28, 0.64, 0.27)
EQ.cable(g, { from: [x, z], to: [x, z] })  // sagging cable between bench points
EQ.ticker(g, { x? })                     // ticker-timer device (default x = 2.86), centred on
                                         // z=0; the tape passes over it at z=0.04. Attach a
                                         // cable at roughly [x - 0.06, 0.14]
EQ.powerSupply(g, { on })                // PSU with LED; FIXED at x 0.06–0.52, z 0.52–0.78
EQ.tape(g, { from, to?, marks, dotR? })  // paper tape; from/to are world-x SCALARS (the tape
                                         // runs at z=0.04, just beside the track centreline);
                                         // to defaults to 3.04 (through the default ticker).
                                         // marks = [{x, major?}] — YOU compute dot positions
                                         // from your physics; major → red tick
EQ.laptop(g)                             // data-logging laptop with live screen trace;
                                         // FIXED at bench back-left (x 0.05–0.52, z 0.48–0.84)
EQ.motionSensor(g, { x? })               // ultrasonic sensor (default x = 0.03)
EQ.pulses(g, { from?, to, phase })       // expanding pulse arcs; advance phase in step():
                                         //   this.phase = (this.phase + dt * 1.2) % 1
EQ.motionArrow(g, { x })                 // direction arrow above the moving object
```

## Composition order matters (painter's algorithm)

Back-to-front for a gate scene:

```js
g.clear(); g.setView({ OX: 28, BY: 352, S: 280, TX: 130, TZ: 70 });
EQ.bench(g);
EQ.track(g);
EQ.timerBox(g, { text: this.timerText(t), active: timing });
EQ.cable(g, { from: [0.30, 0.50], to: [GATE, 0.16] });
EQ.lightGate(g, { x: GATE, blocked, layer: "back" });   // rear post + beam
EQ.trolley(g, { x: xl, card: { type: "flat", length: this.p.cardL } });
EQ.lightGate(g, { x: GATE, blocked, layer: "front" });  // front beam + post + crossbar
if (g.state !== "done") EQ.motionArrow(g, { x: xl });
g.callout("light gate", ...g.P(GATE, 0, 0.42), gx + 80, 30);  // callouts last
```

`blocked` is your physics: e.g. `xl <= GATE && GATE <= xl + cardLength`.

## Drawing custom apparatus (no pack covers it)

Compose `g.box3D` + `g.poly` + `ctx` gradients in the same world space; shade
faces of one base color with `g.shade(color, 1.18)` (top), `0.72` (side),
gradient `1.02→0.85` (front) to match the pack's look. Add soft ground-contact
shadows with low-alpha dark ellipses/polys (e.g. `"rgba(90,50,20,0.14)"`).
