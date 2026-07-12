# Worked example — a complete small lab

"Bouncing Ball Drop": one select, three sliders (one conditional), four stat
cards, custom-drawn apparatus (no equipment pack), a graph inset, callouts, and
a finite run. Study the structure; your labs follow the same shape.

## lab-config.json

```json
{
  "id": "bounce-lab",
  "title": "Bouncing Ball Drop",
  "subtitle": "Interactive lab",
  "layout": "standard",
  "canvas": { "w": 1000, "h": 470 },
  "controls": [
    { "id": "surface", "label": "Surface", "width": 220, "options": [
      { "value": "rubber", "label": "Rubber mat (e = 0.80)" },
      { "value": "clay",   "label": "Clay (e = 0.30)" },
      { "value": "custom", "label": "Custom elasticity" }
    ]}
  ],
  "params": [
    { "id": "h0", "label": "Drop height", "min": 0.5, "max": 2.0, "step": 0.05, "value": 1.4, "unit": "m", "decimals": 2 },
    { "id": "gravity", "label": "Gravity g", "min": 1.6, "max": 24.8, "step": 0.1, "value": 9.8, "unit": "m/s²", "decimals": 1 },
    { "id": "e", "label": "Elasticity e", "min": 0.1, "max": 0.95, "step": 0.05, "value": 0.6,
      "decimals": 2, "showIf": { "control": "surface", "in": ["custom"] } }
  ],
  "stats": [
    { "id": "time",    "label": "Elapsed time", "unit": "s" },
    { "id": "height",  "label": "Height",       "unit": "m" },
    { "id": "speed",   "label": "Speed",        "unit": "m/s", "variant": "accent" },
    { "id": "bounces", "label": "Bounces",      "variant": "info" }
  ],
  "note": "Drop the ball and watch the energy drain away with every bounce."
}
```

Note the pedagogical pattern: preset options carry their physics in the label
(`e = 0.80`), and the raw parameter slider appears only for `custom`.

## sim.js

```js
// Bouncing ball: integrate v/y each step (no simple closed form across bounces).
const RESTITUTION = { rubber: 0.8, clay: 0.3 };
const BALL_R = 0.06; // m

class Sim {
  constructor(P) { this.reset(P); }

  e(P) { return RESTITUTION[P.surface] !== undefined ? RESTITUTION[P.surface] : P.e; }

  reset(P) {              // EVERYTHING derives from P — Reset correctness
    this.P0 = P;
    this.y = P.h0;        // ball centre height (m)
    this.v = 0;           // velocity, up positive
    this.bounces = 0;
    this.trace = [];      // [t, y] samples for the inset graph
    this.done = false;
  }

  step(dt, t) {
    const P = this.P0, g = P.gravity, e = this.e(P);
    this.v -= g * dt;
    this.y += this.v * dt;
    if (this.y <= BALL_R && this.v < 0) {          // impact
      this.y = BALL_R;
      this.v = -this.v * e;
      this.bounces += 1;
      if (this.v < 0.15) { this.v = 0; this.done = true; }
    }
    if (!this.trace.length || t - this.trace[this.trace.length - 1][0] > 0.03) {
      this.trace.push([t, this.y]);
    }
    if (this.done) return "done";                  // ends the run; Start → "Run again"
  }

  draw(g) {
    const P = g.params;
    g.clear();                                     // theme-sky gradient background
    g.setView({ OX: 150, BY: Math.round(g.H * 0.82), S: 165, TX: 130, TZ: 55 });

    // ground slab + impact zone (custom apparatus via primitives)
    g.box3D(-0.6, 2.6, -0.35, 0.75, -0.06, 0, g.theme.ground);
    g.poly([g.P(0.3, -0.2, 0.001), g.P(1.3, -0.2, 0.001),
            g.P(1.3, 0.2, 0.001),  g.P(0.3, 0.2, 0.001)], g.shade(g.theme.ground, 0.9));

    // release stand: two shaded boxes
    const topY = P.h0 + BALL_R * 2;
    g.box3D(1.42, 1.5, -0.04, 0.04, 0, topY + 0.12, "#8FA6C8");
    g.box3D(0.72, 1.46, -0.03, 0.03, topY + 0.04, topY + 0.1, "#7E96BA");

    // the ball: radial-gradient circle + height-dependent contact shadow
    const [bx, by] = g.P(0.8, 0, this.y);
    const r = BALL_R * 165, ctx = g.ctx;
    const sh = Math.max(0.25, 1 - this.y / 2.2);
    const [gx, gy] = g.P(0.8, 0, 0);
    ctx.fillStyle = `rgba(90,50,20,${0.22 * sh})`;
    ctx.beginPath();
    ctx.ellipse(gx, gy, r * (0.7 + 0.5 * sh), r * 0.32 * (0.7 + 0.5 * sh), 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.15, bx, by, r);
    grad.addColorStop(0, g.tint(g.theme.accent, 0.5));
    grad.addColorStop(1, g.shade(g.theme.accent, 0.8));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();

    // velocity arrow, sized by |v|
    if (Math.abs(this.v) > 0.05) {
      const dir = this.v > 0 ? -1 : 1;
      const len = Math.min(60, 14 + Math.abs(this.v) * 22);
      g.arrow(bx + r + 16, by, bx + r + 16, by + dir * len, g.theme.danger, 3);
    }

    // dimension line for current height (dims but stays readable while running)
    ctx.save();
    ctx.globalAlpha = Math.max(0.35, g.labelAlpha);
    const [dx1, dy1] = g.P(0.42, 0, 0), [, dy2] = g.P(0.42, 0, this.y);
    g.arrow(dx1, (dy1 + dy2) / 2, dx1, dy2, g.theme.muted, 1.6);
    g.arrow(dx1, (dy1 + dy2) / 2, dx1, dy1, g.theme.muted, 1.6);
    g.text(this.y.toFixed(2) + " m", dx1 - 8, (dy1 + dy2) / 2,
           { size: 13, align: "right", baseline: "middle", color: g.theme.muted });
    ctx.restore();

    // callouts fade automatically while running (g.labelAlpha)
    g.callout("release stand", ...g.P(1.1, 0, topY + 0.07), 320, 30);
    g.callout("impact zone", ...g.P(1.05, 0.15, 0.01), 250, 440);

    // height–time inset
    if (this.trace.length > 1) {
      const box = g.graphInset({ x: 740, y: 16, w: 240, h: 150,
                                 title: "HEIGHT–TIME", xLabel: "t", yLabel: "h" });
      const tMax = Math.max(3, this.trace[this.trace.length - 1][0]);
      const hMax = this.P0.h0 * 1.15;
      ctx.strokeStyle = g.theme.info; ctx.lineWidth = 2; ctx.beginPath();
      this.trace.forEach(([tt, hh], i) => {
        const x = box.px(tt / tMax), y = box.py(hh / hMax);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  }

  values() {
    return {
      time: { value: this.trace.length ? this.trace[this.trace.length - 1][0].toFixed(2) : "0.00",
              live: !this.done },
      height: this.y.toFixed(2),
      speed: Math.abs(this.v).toFixed(2),
      bounces: { value: String(this.bounces),
                 label: this.done ? "Bounces (settled)" : "Bounces" }
    };
  }
}
```

## What to imitate

1. **Constants → reset-from-P → physics → step → draw → values** ordering.
2. `reset(P)` rebuilds *all* state; nothing survives a reset.
3. `step` owns physics and returns `"done"`; `draw` never mutates physics.
4. Scene composition: background → apparatus → moving object → annotations →
   inset graph. Callouts last, with `g.labelAlpha` handling fade.
5. `values()` returns pre-formatted strings; patches relabel cards as the
   situation changes.
6. Theme-aware colors for scene mood (`g.theme.*` + shade/tint), literal colors
   for physical equipment.
7. For track/trolley labs, replace the custom apparatus here with
   `"equipment": "kinematics"` + `EQ.*` calls (see drawing-api.md).
