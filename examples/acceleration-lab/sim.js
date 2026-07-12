// Acceleration Lab — kit port (uses the "kinematics" equipment pack).
// Trolley accelerates along a track; measure a with a light gate + two-section
// interrupt card, or with a ticker-timer tape.
//
// Params: method (gate|ticker), v0 (start speed), a (acceleration), secL (card section length)

// world geometry (metres); trolley front starts at X0 and moves toward x=0
const X0 = 2.55, ENDX = 0.18, TROL_LEN = 0.30;
const GATE = 1.45, GAP = 0.07;              // gate position, interrupt-card notch width
const TKX = 2.86, TICK = 0.02, SECT = 0.10; // ticker position, dot interval, tape section

class Sim {
  constructor(P) { this.reset(P); }

  reset(P) {
    this.p = P;
    this.doneT = this.timeTo(X0 - ENDX);  // time at which the trolley reaches track end
    this.tNow = 0;
    this.running = false;
  }

  // ---------- physics model ----------
  timeTo(dx) {
    const { v0, a } = this.p;
    if (dx <= 0) return 0;
    return (-v0 + Math.sqrt(v0 * v0 + 2 * a * dx)) / a;
  }
  xAt(t) { return X0 - this.p.v0 * t - 0.5 * this.p.a * t * t; }
  vAt(t) { return this.p.v0 + this.p.a * t; }
  // beam block/unblock edge times for the two-section interrupt card
  gateTimes() {
    const l = this.p.secL;
    const T = (off) => this.timeTo(X0 - GATE + off);
    return { t1: T(0), t2: T(l), t3: T(l + GAP), t4: T(2 * l + GAP) };
  }

  step(dt, t) {
    if (t >= this.doneT) return "done";
  }

  timerText(t) {
    if (this.p.method === "gate") {
      const { t1, t2, t3, t4 } = this.gateTimes();
      if (t < t1) return "0.000";
      if (t < t2) return (t - t1).toFixed(3);
      if (t < t3) return (t2 - t1).toFixed(3);
      if (t < t4) return (t - t3).toFixed(3);
      return (t4 - t3).toFixed(3);
    }
    return t.toFixed(2);
  }

  // ---------- scene ----------
  draw(g) {
    const t = Math.min(g.t, this.doneT);
    this.tNow = t;
    this.running = g.state === "running";
    const method = this.p.method;
    const xl = Math.max(ENDX, this.xAt(t));
    const p = g.P;

    g.setView({ OX: 28, BY: 352, S: 280, TX: 130, TZ: 70 });
    g.clear(g.theme.sky, g.shade(g.theme.sky, 0.955));
    EQ.bench(g);
    EQ.track(g);

    if (method === "gate") {
      const l = this.p.secL;
      const blocked = (GATE >= xl && GATE <= xl + l) || (GATE >= xl + l + GAP && GATE <= xl + 2 * l + GAP);
      const { t1, t2, t3, t4 } = this.gateTimes();
      const timing = this.running && ((t >= t1 && t < t2) || (t >= t3 && t < t4));
      EQ.timerBox(g, { text: this.timerText(t), active: timing });
      EQ.cable(g, { from: [0.30, 0.50], to: [GATE, 0.16] });
      EQ.lightGate(g, { x: GATE, blocked, layer: "back" });
      EQ.trolley(g, { x: xl, card: { type: "interrupt", length: l, gap: GAP } });
      EQ.lightGate(g, { x: GATE, blocked, layer: "front" });
    } else {
      EQ.powerSupply(g, { on: this.running });
      EQ.cable(g, { from: [0.30, 0.52], to: [2.80, 0.14] });
      EQ.tape(g, { from: xl + TROL_LEN, marks: this.tapeMarks(xl, t) });
      EQ.trolley(g, { x: xl });
      EQ.ticker(g);
      this.drawVtInset(g, t);
    }

    if (g.state !== "done") EQ.motionArrow(g, { x: xl });

    // margin callouts (fade automatically while running)
    if (method === "gate") {
      const [tmx, tmy] = p(0.28, 0.64, 0.27);
      g.callout("timer", tmx, tmy, 90, 30);
      const [g1x, g1y] = p(GATE, 0, 0.42);
      g.callout("light gate", g1x + 10, g1y, g1x + 80, 30);
      const L = 2 * this.p.secL + GAP;
      const [cdx, cdy] = p(xl + L / 2, 0, 0.13);
      g.callout("interrupt card", cdx, cdy + 4, Math.min(Math.max(cdx - 60, 100), 700), 452);
    } else {
      const [pmx, pmy] = p(0.28, 0.66, 0.24);
      g.callout("power supply", pmx, pmy, 96, 30);
      const [tkx, tky] = p(2.86, 0, 0.15);
      g.callout("ticker-timer", tkx + 6, tky - 6, Math.min(tkx + 40, 924), 210);
      const rear = xl + TROL_LEN;
      const [tpx, tpy] = p((rear + TKX) / 2, 0.04, 0.05);
      g.callout("tape · red tick every 5 dots (0.10 s)", tpx, tpy + 6, Math.min(Math.max(tpx, 210), 700), 452);
    }
  }

  // dots printed so far; every 5th tick is a red major mark
  tapeMarks(xl, t) {
    const rear = xl + TROL_LEN;
    const marks = [];
    const n = Math.floor(t / TICK);
    for (let i = 0; i <= n; i++) {
      const dotX = TKX - (this.xAt(i * TICK) - xl);
      if (dotX < rear + 0.015 || dotX > TKX) continue;
      marks.push({ x: dotX, major: i % 5 === 0 });
    }
    return marks;
  }

  // velocity-time inset built from tape sections
  drawVtInset(g, t) {
    const ctx = g.ctx;
    const box = g.graphInset({ x: 736, y: 16, w: 246, h: 156, title: "VELOCITY–TIME (tape sections)", xLabel: "t", yLabel: "v" });
    const totalT = this.doneT;
    const nTot = Math.floor(totalT / SECT);
    const n = Math.min(Math.floor(t / SECT), nTot);
    if (n < 1 || nTot < 1) return;
    const vMax = this.vAt(totalT) * 1.1;
    const bw = Math.max(3, Math.min(16, box.aw / nTot - 2));
    const secV = (k) => (this.xAt(k * SECT) - this.xAt((k + 1) * SECT)) / SECT;
    for (let k = 0; k < n; k++) {
      const bx = box.px((k * SECT) / totalT) + 1;
      const bh = (secV(k) / vMax) * box.ah;
      ctx.save(); ctx.globalAlpha = 0.55;
      ctx.fillStyle = g.theme.info;
      ctx.fillRect(bx, box.ay - bh, bw, bh);
      ctx.restore();
      ctx.strokeStyle = g.theme.info; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, box.ay - bh); ctx.lineTo(bx + bw, box.ay - bh); ctx.stroke();
    }
    if (n >= 2) {
      ctx.strokeStyle = "#C2401B"; ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const px = box.px(((k + 0.5) * SECT) / totalT);
        const py = box.ay - (secV(k) / vMax) * box.ah;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // ---------- dashboard ----------
  values() {
    const t = this.tNow;
    if (this.p.method === "gate") {
      const l = this.p.secL;
      const { t1, t2, t3, t4 } = this.gateTimes();
      const i1 = Number((t2 - t1).toFixed(3));
      const i2 = Number((t4 - t3).toFixed(3));
      const dtBig = Number((t3 - t1).toFixed(3));
      const haveU = t >= t2, haveV = t >= t4;
      const u2 = haveU ? Number((l / i1).toFixed(2)) : null;
      const v2 = haveV ? Number((l / i2).toFixed(2)) : null;
      return {
        u: { label: "Initial u = l ÷ (t₂−t₁)", unit: "m/s", value: haveU ? u2.toFixed(2) : "—" },
        v: { label: "Final v = l ÷ (t₄−t₃)", unit: "m/s", value: haveV ? v2.toFixed(2) : "—" },
        accel: { label: "Acceleration (v−u) ÷ (t₃−t₁)", unit: "m/s²", value: haveV ? ((v2 - u2) / dtBig).toFixed(2) : "—" },
        trueA: this.p.a.toFixed(2),
        _note: "The card breaks the beam twice — u from the first section, v from the second, a = (v − u) ÷ (t₃ − t₁)."
      };
    }
    const n = Math.floor(t / SECT);
    let vLatest = "—", accel = "—";
    if (n >= 1) {
      const lenN = this.xAt((n - 1) * SECT) - this.xAt(n * SECT);
      const vN = Number((lenN * 100).toFixed(1)) / 100 / SECT;
      vLatest = vN.toFixed(2);
      if (n >= 2) {
        const len0 = this.xAt(0) - this.xAt(SECT);
        const v0s = Number((len0 * 100).toFixed(1)) / 100 / SECT;
        accel = ((Number(vN.toFixed(2)) - Number(v0s.toFixed(2))) / ((n - 1) * SECT)).toFixed(2);
      }
    }
    return {
      u: { label: "Tape sections (0.10 s)", unit: "", value: String(n) },
      v: { label: "Latest section v = Δx ÷ 0.10", unit: "m/s", value: vLatest },
      accel: { label: "Acceleration Δv ÷ Δt", unit: "m/s²", value: accel },
      trueA: this.p.a.toFixed(2),
      _note: "Each 0.10 s tape section shows the velocity — the steady increase per section is the acceleration."
    };
  }
}
