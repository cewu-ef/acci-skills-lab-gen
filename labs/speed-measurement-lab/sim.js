// BOX 1.1 — Laboratory measurements of speed: a trolley moves along a straight
// track, right → left (as in Figures 1.3–1.5), at constant speed or with
// uniform acceleration.
// World geometry (metres):
const X0 = 2.55;       // trolley front edge at the start
const ENDX = 0.18;     // front-edge position that ends the run
const G1 = 2.0;        // first light gate (two-gate method) — "start"
const GONE = 1.5;      // the single light gate
const TICK_X = 2.86;   // ticker-timer position
const TICK_DT = 0.02;  // 50 Hz mains → one dot every 0.02 s

class Sim {
  constructor(P) { this.reset(P); }

  reset(P) {
    this.p = P;
    this.doneT = this.tAt(X0 - ENDX);
    this.tNow = 0;
    this.running = false;
    this.finished = false;
  }

  // --- physics model (uniform acceleration, closed form; a = 0 for constant speed) ---
  aVal() { return this.p.motion === "accel" ? this.p.accel : 0; }
  sAt(t) { return this.p.v0 * t + 0.5 * this.aVal() * t * t; }   // distance travelled
  vAt(t) { return this.p.v0 + this.aVal() * t; }
  tAt(dist) {                                                    // time to travel dist
    const v = this.p.v0, a = this.aVal();
    if (a === 0) return dist / v;
    return (-v + Math.sqrt(v * v + 2 * a * dist)) / a;
  }
  xAt(t) { return X0 - this.sAt(t); }

  // --- measurement events ---
  gateTimes() {
    if (this.p.method === "two") {
      // leading edge of the card starts the timer at G1, stops it at G1 - d
      return { t1: this.tAt(X0 - G1), t2: this.tAt(X0 - (G1 - this.p.d)) };
    }
    // one gate: timer runs while the card blocks the beam (leading → trailing edge)
    return { t1: this.tAt(X0 - GONE), t2: this.tAt(X0 - GONE + this.p.cardL) };
  }

  // digital timer reading, millisecond resolution like the 4-digit timer shown
  timerVal() {
    const gt = this.gateTimes();
    if (this.tNow <= gt.t1) return 0;
    return Math.round((Math.min(this.tNow, gt.t2) - gt.t1) * 1000) / 1000;
  }

  dotCount() { return Math.floor(this.tNow / TICK_DT + 1e-9) + 1; } // dot 0 at t = 0

  step(dt, t) { if (t >= this.doneT) return "done"; }

  // --- scene ---
  draw(g) {
    this.tNow = Math.min(g.t, this.doneT);
    this.running = g.state === "running";
    this.finished = g.state === "done";
    const xf = this.xAt(this.tNow);

    g.clear();
    g.setView({ OX: 28, BY: 352, S: 280, TX: 130, TZ: 70 });
    EQ.bench(g);
    EQ.track(g);

    if (this.p.method === "ticker") this.drawTicker(g, xf);
    else this.drawGates(g, xf);
  }

  drawGates(g, xf) {
    const P = this.p, m = P.method;
    const gt = this.gateTimes();
    const timing = this.tNow > gt.t1 && this.tNow < gt.t2;
    const gatesX = m === "two" ? [G1, G1 - P.d] : [GONE];
    const blockedAt = gx => xf <= gx && gx <= xf + P.cardL;

    EQ.timerBox(g, { text: this.timerVal().toFixed(3), active: timing });
    gatesX.forEach(gx => EQ.cable(g, { from: [0.30, 0.50], to: [gx, 0.16] }));
    gatesX.forEach(gx => EQ.lightGate(g, { x: gx, blocked: blockedAt(gx), layer: "back" }));
    EQ.trolley(g, { x: xf, card: { type: "flat", length: P.cardL } });
    gatesX.forEach(gx => EQ.lightGate(g, { x: gx, blocked: blockedAt(gx), layer: "front" }));
    if (!this.finished) EQ.motionArrow(g, { x: xf });

    g.callout("timer", ...g.P(0.28, 0.64, 0.27), 110, 30);
    if (m === "two") {
      const [s1x, s1y] = g.P(G1, 0, 0.42);
      const [s2x, s2y] = g.P(G1 - P.d, 0, 0.42);
      g.callout("start", s1x, s1y, Math.min(920, s1x + 60), 30);
      g.callout("stop", s2x, s2y, Math.max(80, s2x - 60), 30);
    } else {
      const [sx, sy] = g.P(GONE, 0, 0.42);
      g.callout("light gate", sx, sy, sx + 70, 30);
    }
    const [cx, cy] = g.P(xf + P.cardL * 0.5, 0, 0.30);
    g.callout("card", cx, cy, Math.max(80, Math.min(920, cx + 40)), 452);
  }

  drawTicker(g, xf) {
    const n = this.dotCount();
    const marks = [];
    for (let k = 0; k < n; k++) {
      // dot k was printed at the ticker and has since moved with the tape
      marks.push({ x: TICK_X - (this.sAt(this.tNow) - this.sAt(k * TICK_DT)), major: k % 5 === 0 });
    }
    EQ.powerSupply(g, { on: this.running });
    EQ.cable(g, { from: [0.52, 0.62], to: [TICK_X - 0.06, 0.14] });
    EQ.ticker(g, { x: TICK_X });
    EQ.tape(g, { from: xf + 0.30, marks });
    EQ.trolley(g, { x: xf });
    if (!this.finished) EQ.motionArrow(g, { x: xf });

    g.callout("power supply", ...g.P(0.29, 0.65, 0.24), 120, 30);
    g.callout("ticker-timer", ...g.P(TICK_X, 0, 0.12), 870, 452);
    const [tx, ty] = g.P(xf + 0.15, -0.12, 0.03);
    g.callout("trolley", tx, ty, Math.max(80, Math.min(600, tx)), 452);

    this.tapeInset(g, n);
  }

  // magnified view of the start of the tape, like the strip in Figure 1.5
  tapeInset(g, n) {
    const ctx = g.ctx;
    const bx = 618, by = 22, bw = 360, bh = 74;
    ctx.save();
    ctx.fillStyle = g.theme.surface;
    ctx.strokeStyle = g.shade(g.theme.ground, 0.85);
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = g.theme.muted;
    ctx.font = "600 11px " + g.theme.fontBody;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("TAPE — MAGNIFIED · one dot every 0.02 s", bx + 10, by + 16);
    const sy = by + 26, sh = 26;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(bx + 10, sy, bw - 20, sh);
    ctx.strokeStyle = g.shade(g.theme.ground, 0.9);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 10, sy, bw - 20, sh);
    const scale = 2200; // inset px per metre (~8× the scene)
    const shown = Math.min(n, 6);
    const x0 = bx + 26;
    for (let k = 0; k < shown; k++) {
      const dx = x0 + this.sAt(k * TICK_DT) * scale;
      if (dx > bx + bw - 16) break;
      ctx.fillStyle = g.theme.ink;
      ctx.beginPath();
      ctx.arc(dx, sy + sh / 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = g.theme.muted;
      ctx.font = "11px " + g.theme.fontMono;
      ctx.textAlign = "center";
      ctx.fillText(String(k), dx, sy + sh + 14);
    }
    ctx.restore();
  }

  // --- dashboard ---
  values() {
    const P = this.p, m = P.method;
    const out = {
      trueV: { value: this.vAt(this.tNow).toFixed(2),
               label: P.motion === "accel" ? "True speed (now)" : "True speed",
               live: this.running && P.motion === "accel" }
    };

    if (m === "ticker") {
      const n = this.dotCount();
      const L = Math.round(this.sAt((n - 1) * TICK_DT) * 1000) / 1000; // tape read with a mm ruler
      const T = (n - 1) * TICK_DT;
      out.timer = { value: String(n), label: "Dots on tape", unit: "", live: this.running };
      out.dist = { value: L.toFixed(3), label: "First dot to last dot", unit: "m", live: this.running };
      out.speed = { value: this.finished && n >= 2 ? (L / T).toFixed(3) : "—", label: "Speed from tape" };
      out._note = "The ticker-timer marks a dot on the tape every 1/50 s = 0.02 s. When the run ends, speed = length of the dotted tape ÷ (number of intervals × 0.02 s).";
    } else {
      const gt = this.gateTimes();
      const tv = this.timerVal();
      const timing = this.tNow > gt.t1 && this.tNow < gt.t2;
      const dist = m === "two" ? P.d : P.cardL;
      out.timer = { value: tv.toFixed(3), label: "Timer reading", unit: "s", live: timing };
      out.dist = m === "two"
        ? { value: P.d.toFixed(2), label: "Gate spacing d", unit: "m" }
        : { value: P.cardL.toFixed(2), label: "Card length ℓ", unit: "m" };
      out.speed = { value: this.tNow >= gt.t2 && tv > 0 ? (dist / tv).toFixed(3) : "—",
                    label: m === "two" ? "Average speed d ÷ t" : "Speed ℓ ÷ t" };
      out._note = m === "two"
        ? "The leading edge of the card breaks the first beam to start the timer, and stops it at the second beam. Speed = distance between the gates ÷ time interval."
        : "The timer runs while the card blocks the beam: it starts at the leading edge and stops at the trailing edge, so speed = card length ÷ time shown.";
    }
    return out;
  }
}
