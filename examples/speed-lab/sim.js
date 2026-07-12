// Speed Measurement Lab — kit port (uses the "kinematics" equipment pack).
// Four ways to measure a trolley's speed: two light gates, one light gate,
// ticker-timer, motion sensor; constant-speed or accelerating motion.
//
// Params: method (two|one|ticker|sensor), motion (const|accel),
//         v0, a, gapD (gate spacing), cardL (card length), tickerInt

// world geometry (metres); trolley front starts at X0 and moves toward x=0
const X0 = 2.55, ENDX = 0.18, TROL_LEN = 0.30;
const TKX = 2.86;        // ticker-timer position
const SENSORX = 0.03;    // motion-sensor emitting face
const SAMPLE = 0.1;      // motion-sensor sample interval

class Sim {
  constructor(P) { this.reset(P); }

  reset(P) {
    this.p = P;
    this.doneT = this.timeTo(X0 - ENDX);
    this.tNow = 0;
    this.running = false;
    this.pulsePhase = 0;
  }

  // ---------- physics model ----------
  accel() { return this.p.motion === "accel" ? this.p.a : 0; }
  timeTo(dx) {
    const v0 = this.p.v0, A = this.accel();
    if (dx <= 0) return 0;
    if (A < 1e-6) return dx / v0;
    return (-v0 + Math.sqrt(v0 * v0 + 2 * A * dx)) / A;
  }
  xAt(t) { return X0 - this.p.v0 * t - 0.5 * this.accel() * t * t; }
  vAt(t) { return this.p.v0 + this.accel() * t; }

  isGate() { return this.p.method === "two" || this.p.method === "one"; }
  gates() {
    if (this.p.method === "two") {
      const stop = 0.95;
      return { start: stop + this.p.gapD, stop };
    }
    return { start: 1.45, stop: 1.45 };
  }
  // measurement window: beam events (gate modes) or first sample (others)
  events() {
    const g = this.gates();
    if (this.p.method === "two") {
      return { tA: this.timeTo(X0 - g.start), tB: this.timeTo(X0 - g.stop), d: this.p.gapD };
    }
    return { tA: this.timeTo(X0 - g.start), tB: this.timeTo(X0 - g.start + this.p.cardL), d: this.p.cardL };
  }

  step(dt, t) {
    this.pulsePhase = (this.pulsePhase + dt * 1.2) % 1;
    if (t >= this.doneT) return "done";
  }

  timerText(t) {
    if (this.isGate()) {
      const ev = this.events();
      return Math.max(0, Math.min(t - ev.tA, ev.tB - ev.tA)).toFixed(2);
    }
    return t.toFixed(2);
  }
  measured(t) {
    if (this.isGate()) return t >= this.events().tB;
    const int = this.p.method === "ticker" ? this.p.tickerInt : SAMPLE;
    return Math.floor(t / int) >= 1;
  }

  // ---------- scene ----------
  draw(g) {
    const t = Math.min(g.t, this.doneT);
    this.tNow = t;
    this.running = g.state === "running";
    const method = this.p.method;
    const xl = Math.max(ENDX, this.xAt(t));
    const ctx = g.ctx, p = g.P;

    g.setView({ OX: 28, BY: 352, S: 280, TX: 130, TZ: 70 });
    g.clear(g.theme.sky, g.shade(g.theme.sky, 0.955));
    EQ.bench(g);
    EQ.track(g);

    if (this.isGate()) {
      const gts = this.gates(), ev = this.events();
      const timing = this.running && t >= ev.tA && t < ev.tB;
      EQ.timerBox(g, { text: this.timerText(t), active: timing });
      if (method === "two") {
        EQ.cable(g, { from: [0.22, 0.50], to: [gts.stop, 0.16] });
        EQ.cable(g, { from: [0.36, 0.50], to: [gts.start, 0.16] });
      } else {
        EQ.cable(g, { from: [0.30, 0.50], to: [gts.start, 0.16] });
      }
      const gateXs = method === "two" ? [gts.start, gts.stop] : [gts.start];
      const blockedAt = (gx) => xl <= gx && gx <= xl + this.p.cardL;
      for (const gx of gateXs) EQ.lightGate(g, { x: gx, blocked: blockedAt(gx), layer: "back" });
      EQ.trolley(g, { x: xl, card: { type: "flat", length: this.p.cardL } });
      for (const gx of gateXs) EQ.lightGate(g, { x: gx, blocked: blockedAt(gx), layer: "front" });
      // gate-spacing dimension line
      if (method === "two") {
        ctx.save();
        ctx.globalAlpha = Math.max(0.35, g.labelAlpha);
        const dim = g.shade(g.theme.muted, 0.86);
        const [d1x, d1y] = p(gts.stop, -0.27, 0.01), [d2x, d2y] = p(gts.start, -0.27, 0.01);
        g.arrow((d1x + d2x) / 2, (d1y + d2y) / 2, d1x, d1y, dim, 1.6);
        g.arrow((d1x + d2x) / 2, (d1y + d2y) / 2, d2x, d2y, dim, 1.6);
        g.text("d = " + this.p.gapD.toFixed(2) + " m", (d1x + d2x) / 2, (d1y + d2y) / 2 + 8,
          { size: 14, align: "center", baseline: "top", color: dim });
        ctx.restore();
      }
    } else if (method === "ticker") {
      EQ.powerSupply(g, { on: this.running });
      EQ.cable(g, { from: [0.30, 0.52], to: [2.80, 0.14] });
      EQ.tape(g, { from: xl + TROL_LEN, marks: this.tapeMarks(xl, t), dotR: 2.2 });
      EQ.trolley(g, { x: xl });
      EQ.ticker(g);
    } else { // sensor
      EQ.laptop(g);
      EQ.cable(g, { from: [0.10, 0.48], to: [-0.05, 0.07] });
      EQ.motionSensor(g, { x: SENSORX });
      EQ.pulses(g, { from: SENSORX + 0.02, to: xl, phase: this.pulsePhase });
      EQ.trolley(g, { x: xl, card: { type: "flat", length: this.p.cardL } });
      this.drawDtInset(g, t);
    }

    if (g.state !== "done") EQ.motionArrow(g, { x: xl });

    // margin callouts
    if (this.isGate()) {
      const gts = this.gates();
      const [tmx, tmy] = p(0.28, 0.64, 0.27);
      g.callout("timer", tmx, tmy, 90, 30);
      if (method === "two") {
        const [g1x, g1y] = p(gts.start, 0, 0.42);
        const [g2x, g2y] = p(gts.stop, 0, 0.42);
        g.callout("gate 1 · start", Math.min(g1x + 10, 920), g1y, Math.min(g1x + 100, 870), 30);
        g.callout("gate 2 · stop", g2x, g2y, Math.max(g2x - 80, 240), 58);
      } else {
        const [g1x, g1y] = p(gts.start, 0, 0.42);
        g.callout("light gate", g1x + 10, g1y, g1x + 80, 30);
      }
      const [cdx, cdy] = p(xl + this.p.cardL / 2, 0, 0.13);
      g.callout("card " + this.p.cardL.toFixed(2) + " m", cdx, cdy + 4, Math.min(Math.max(cdx - 60, 80), 700), 452);
    } else if (method === "ticker") {
      const [pmx, pmy] = p(0.28, 0.66, 0.24);
      g.callout("power supply", pmx, pmy, 96, 30);
      const [tkx, tky] = p(2.86, 0, 0.15);
      g.callout("ticker-timer", tkx + 6, tky - 6, Math.min(tkx + 40, 924), 30);
      const rear = xl + TROL_LEN;
      const [tpx, tpy] = p((rear + TKX) / 2, 0.04, 0.05);
      g.callout("tape", tpx, tpy + 6, Math.min(Math.max(tpx, 90), 780), 452);
    } else {
      const [cmx, cmy] = p(0.28, 0.78, 0.30);
      g.callout("computer", cmx, cmy, 90, 30);
      const [snx, sny] = p(-0.04, -0.07, 0.18);
      g.callout("motion sensor", snx, sny + 4, 110, 452);
      const [cdx, cdy] = p(xl + this.p.cardL / 2, 0, 0.38);
      g.callout("card reflects the pulses", cdx, cdy + 8, Math.min(Math.max(cdx, 230), 640), 30);
    }
  }

  // plain dots at the ticker interval
  tapeMarks(xl, t) {
    const rear = xl + TROL_LEN;
    const marks = [];
    const n = Math.floor(t / this.p.tickerInt);
    for (let i = 0; i <= n; i++) {
      const dotX = TKX - (this.xAt(i * this.p.tickerInt) - xl);
      if (dotX < rear + 0.015 || dotX > TKX) continue;
      marks.push({ x: dotX });
    }
    return marks;
  }

  // distance–time inset from motion-sensor samples
  drawDtInset(g, t) {
    const ctx = g.ctx;
    const box = g.graphInset({ x: 748, y: 16, w: 234, h: 148, title: "DISTANCE–TIME", xLabel: "t", yLabel: "d" });
    const totalT = this.doneT;
    const maxD = X0 - SENSORX + 0.1;
    const m = Math.floor(t / SAMPLE);
    ctx.strokeStyle = g.theme.info; ctx.fillStyle = g.theme.info; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j <= m; j++) {
      const tj = j * SAMPLE;
      const dj = this.xAt(tj) - SENSORX;
      const x = box.px(tj / totalT), y = box.py(dj / maxD);
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (m >= 0) {
      const tj = m * SAMPLE;
      const x = box.px(tj / totalT), y = box.py((this.xAt(tj) - SENSORX) / maxD);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- dashboard ----------
  values() {
    const t = this.tNow, method = this.p.method;
    const measured = this.measured(t);
    const tt = this.timerText(t);
    const tNum = Number(tt);
    const isAccel = this.p.motion === "accel";

    if (this.isGate()) {
      const ev = this.events();
      const timing = this.running && t >= ev.tA && t < ev.tB;
      return {
        timer: { label: "Timer", value: tt, live: timing },
        dist: { label: method === "two" ? "Gate spacing d" : "Card length", unit: "m", value: ev.d.toFixed(2) },
        speed: {
          label: "Speed · v = " + (method === "two" ? "d ÷ t" : "card ÷ t"),
          value: (measured && tNum > 0) ? (Number(ev.d.toFixed(2)) / tNum).toFixed(2) : "—"
        },
        actual: { label: "True speed", value: measured ? this.vAt(ev.tB).toFixed(2) : "—", hidden: !isAccel },
        _note: this.noteText()
      };
    }

    if (method === "ticker") {
      const int = this.p.tickerInt;
      const n = Math.floor(t / int);
      let distVal = "—", speedVal = "—", actual = "—";
      if (n >= 1) {
        const sp = this.xAt((n - 1) * int) - this.xAt(n * int);
        const spCm = Number((sp * 100).toFixed(1));
        distVal = spCm.toFixed(1);
        speedVal = (spCm / 100 / int).toFixed(2);
        actual = this.vAt(n * int).toFixed(2);
      }
      return {
        timer: { label: "Elapsed time", value: tt, live: this.running },
        dist: { label: "Last dot spacing Δx" + (n >= 1 ? " · " + (n + 1) + " dots" : ""), unit: "cm", value: distVal },
        speed: { label: "Speed · v = Δx ÷ interval", value: speedVal },
        actual: { label: "True speed", value: actual, hidden: !isAccel },
        _note: this.noteText()
      };
    }

    // motion sensor
    const m = Math.floor(t / SAMPLE);
    const dNow = Number((this.xAt(m * SAMPLE) - SENSORX).toFixed(3));
    let speedVal = "—", actual = "—";
    if (m >= 1) {
      const dPrev = Number((this.xAt((m - 1) * SAMPLE) - SENSORX).toFixed(3));
      speedVal = ((dPrev - dNow) / SAMPLE).toFixed(2);
      actual = this.vAt(m * SAMPLE).toFixed(2);
    }
    return {
      timer: { label: "Elapsed time", value: tt, live: this.running },
      dist: { label: "Distance to trolley", unit: "m", value: dNow.toFixed(2) },
      speed: { label: "Speed · v = Δd ÷ Δt", value: speedVal },
      actual: { label: "True speed", value: actual, hidden: !isAccel },
      _note: this.noteText()
    };
  }

  noteText() {
    return {
      two: "Two gates give the average speed over the distance d between them.",
      one: "One gate times the card only — close to the speed at a single point.",
      ticker: "The ticker marks a dot every tick — wider spacing means higher speed.",
      sensor: "Ultrasound echoes track the distance — speed is the gradient of the d–t graph."
    }[this.p.method];
  }
}
