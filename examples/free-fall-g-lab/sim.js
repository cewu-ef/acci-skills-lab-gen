// Measuring g by free fall: electromagnet + trapdoor timer (BOX 2.2).
// ------------------------------------------------------------------
// 1. World geometry (metres) & timing constants
// ------------------------------------------------------------------
const G_TRUE = 9.81;
const SLOW = 0.35;                 // playback rate: physics seconds per animation second
const BX = 1.28;                   // drop line: ball / electromagnet / trapdoor centre x
const TRAP_Y = 0.10;               // top surface of the trapdoor
const R = 0.05;                    // steel ball radius (slightly exaggerated for visibility)
const ROD_X = 0.80;                // retort-stand rod x
const RULE_X = 1.62;               // metre rule x
const SERIES_H = [0.4, 0.8, 1.2, 1.6, 2.0];
const HOLD = 0.55, POST = 0.75, MOVE = 0.9;   // non-physics phase lengths (animation s)

class Sim {
  constructor(P) { this.reset(P); }

  reset(P) {                       // everything derives from P
    this.p = P;
    this.series = P.mode === "series";
    this.lag = P.magnet === "ideal" ? 0 : P.magnet === "real" ? 0.005 : P.lagMs / 1000;
    this.idx = 0;                  // series drop index
    this.h = this.series ? SERIES_H[0] : P.h;
    this.phase = this.series ? "hold" : "drop";
    this.phaseT = 0;               // animation seconds inside current phase
    this.simT = 0;                 // physics seconds since timer start (current drop)
    this.timerT = 0;               // what the timer face shows (s)
    this.door = 0;                 // trapdoor opening 0 (closed) .. 1 (open)
    this.ballY = this.attachY();   // ball centre height
    this.vImp = 0;                 // impact speed, for the post-impact fall
    this.pts = [];                 // measured [t^2, h] points (series)
    this.fit = null;               // { m, b, g } least-squares line
    this.result = null;            // last completed drop { t, g }
  }

  // ------------------------------------------------------------------
  // 2. Physics model (closed form)
  // ------------------------------------------------------------------
  attachY() { return TRAP_Y + this.h + R; }              // ball centre when held
  tFall() { return Math.sqrt(2 * this.h / G_TRUE); }     // true free-fall time
  tMeas() { return this.lag + this.tFall(); }            // what the timer records
  quant(t) { return Math.floor(t * 1000) / 1000; }       // 1 ms timer resolution
  yAt(ts) {                                              // ball centre at physics time ts
    if (ts <= this.lag) return this.attachY();           // field still collapsing: held
    const y = this.attachY() - 0.5 * G_TRUE * Math.pow(ts - this.lag, 2);
    return Math.max(TRAP_Y + R, y);
  }
  fitLine() {                                            // least squares h = m·t² + b
    const n = this.pts.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const [x, y] of this.pts) { sx += x; sy += y; sxy += x * y; sxx += x * x; }
    const d = n * sxx - sx * sx;
    if (Math.abs(d) < 1e-12) return null;
    const m = (n * sxy - sx * sy) / d;
    return { m: m, b: (sy - m * sx) / n, g: 2 * m };
  }

  // ------------------------------------------------------------------
  // 3. Measurement / sequencing
  // ------------------------------------------------------------------
  step(dt, t) {
    if (this.phase === "hold") {                         // series: settle before release
      this.phaseT += dt;
      if (this.phaseT >= HOLD) { this.phase = "drop"; this.phaseT = 0; this.simT = 0; }
    } else if (this.phase === "drop") {                  // timer running
      this.simT += dt * SLOW;
      const tm = this.tMeas();
      this.timerT = Math.min(this.simT, tm);
      this.ballY = this.yAt(this.simT);
      if (this.simT >= tm) {                             // ball strikes the trapdoor
        const tq = Math.max(this.quant(tm), 0.001);
        this.result = { t: tq, g: 2 * this.h / (tq * tq) };
        if (this.series) this.pts.push([tq * tq, this.h]);
        this.vImp = G_TRUE * this.tFall();
        this.phase = "post"; this.phaseT = 0;
      }
    } else if (this.phase === "post") {                  // door swings, ball drops through
      this.phaseT += dt;
      this.door = Math.min(1, this.phaseT / 0.3);
      const tau = this.phaseT * SLOW;
      this.ballY = Math.max(R, TRAP_Y + R - this.vImp * tau - 0.5 * G_TRUE * tau * tau);
      if (this.phaseT >= POST) {
        if (!this.series) return "done";
        if (this.idx === SERIES_H.length - 1) { this.fit = this.fitLine(); return "done"; }
        this.fromH = this.h; this.phase = "move"; this.phaseT = 0;
      }
    } else if (this.phase === "move") {                  // raise magnet to next height
      this.phaseT += dt;
      const f = Math.min(1, this.phaseT / MOVE), s = f * f * (3 - 2 * f);
      this.h = this.fromH + (SERIES_H[this.idx + 1] - this.fromH) * s;
      this.door = Math.max(0, 1 - this.phaseT / 0.25);
      this.ballY = this.attachY();
      this.timerT = 0;
      if (this.phaseT >= MOVE) {
        this.idx += 1; this.h = SERIES_H[this.idx];
        this.ballY = this.attachY();
        this.phase = "hold"; this.phaseT = 0; this.result = null;
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. Scene
  // ------------------------------------------------------------------
  draw(g) {
    const ctx = g.ctx;
    g.clear();
    g.setView({ OX: 40, BY: 428, S: 162, TX: 60, TZ: 40 });

    // floor slab
    g.box3D(-0.15, 5.9, -0.45, 0.55, -0.08, 0, g.theme.ground);

    // ---- retort stand + electromagnet ----
    const hMax = this.series ? SERIES_H[SERIES_H.length - 1] : this.p.h;
    const magB = TRAP_Y + this.h + 2 * R;                // magnet underside (ball hangs here)
    const rodTop = TRAP_Y + hMax + 2 * R + 0.30;
    g.box3D(0.52, 1.08, -0.17, 0.17, 0, 0.045, "#4C5560");            // base plate
    g.box3D(ROD_X - 0.02, ROD_X + 0.02, -0.018, 0.018, 0.045, rodTop, "#8B93A0"); // rod
    g.box3D(ROD_X - 0.035, ROD_X + 0.035, -0.03, 0.03, magB + 0.10, magB + 0.17, "#5A6470"); // boss
    g.box3D(ROD_X, BX + 0.03, -0.014, 0.014, magB + 0.11, magB + 0.145, "#8B93A0"); // arm
    g.box3D(BX - 0.09, BX + 0.09, -0.055, 0.055, magB, magB + 0.11, "#606870");     // magnet body
    g.box3D(BX - 0.093, BX + 0.093, -0.058, 0.058, magB + 0.025, magB + 0.075, "#B87333"); // winding

    // ---- electronic timer (floor, right) ----
    const timing = this.phase === "drop" && this.simT > 0 && this.simT < this.tMeas();
    g.box3D(2.15, 2.98, -0.16, 0.16, 0, 0.36, "#39414C");
    g.poly([g.P(2.23, -0.165, 0.305), g.P(2.90, -0.165, 0.305),
            g.P(2.90, -0.165, 0.115), g.P(2.23, -0.165, 0.115)], "#0E1216");
    const tc = g.P(2.565, -0.165, 0.21);
    g.text(this.quant(this.timerT).toFixed(3) + " s", tc[0], tc[1],
           { size: 22, mono: true, align: "center", baseline: "middle",
             color: timing ? "#5EE08A" : "#8FA98F" });
    const tl = g.P(2.565, -0.165, 0.055);
    g.text("ELECTRONIC TIMER · ms", tl[0], tl[1],
           { size: 9, align: "center", baseline: "middle", color: "#9AA7B4" });

    // ---- cables: magnet → timer, trapdoor → timer ----
    const cable = (a, b, sag, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.max(a[1], b[1]) + sag, b[0], b[1]);
      ctx.stroke();
    };
    cable(g.P(BX + 0.09, 0, magB + 0.05), g.P(2.35, -0.10, 0.36), 60, "#8C3B2E");
    cable(g.P(BX + 0.22, 0, 0.02), g.P(2.25, -0.12, 0.03), 10, "#44403C");

    // ---- trapdoor switch ----
    g.box3D(BX - 0.24, BX - 0.16, -0.11, 0.11, 0, TRAP_Y - 0.012, "#7A5A3A"); // hinge rail
    g.box3D(BX + 0.16, BX + 0.24, -0.11, 0.11, 0, TRAP_Y - 0.012, "#7A5A3A"); // contact rail
    const hingeX = BX - 0.17, a = this.door * 1.15;
    const ex = hingeX + 0.34 * Math.cos(a), ey = TRAP_Y - 0.34 * Math.sin(a);
    g.poly([g.P(hingeX, -0.10, TRAP_Y), g.P(ex, -0.10, ey),
            g.P(ex, 0.10, ey), g.P(hingeX, 0.10, TRAP_Y)],
           "#C08A4E", g.shade("#C08A4E", 0.7), 1.5);
    const led = g.P(BX + 0.20, -0.11, TRAP_Y + 0.01);    // circuit LED: green closed, red broken
    ctx.fillStyle = this.door > 0.05 ? "#E03131" : "#2BB673";
    ctx.beginPath(); ctx.arc(led[0], led[1], 3.5, 0, Math.PI * 2); ctx.fill();

    // ---- metre rule ----
    const rx = g.P(RULE_X, 0, 0)[0];
    const ry0 = g.P(RULE_X, 0, TRAP_Y)[1], ry1 = g.P(RULE_X, 0, TRAP_Y + 2.06)[1];
    ctx.fillStyle = "#F2E3B6"; ctx.fillRect(rx - 9, ry1, 18, ry0 - ry1);
    ctx.strokeStyle = "#C9AE72"; ctx.lineWidth = 1; ctx.strokeRect(rx - 9, ry1, 18, ry0 - ry1);
    for (let mm = 0; mm <= 2.0001; mm += 0.1) {
      const py = g.P(RULE_X, 0, TRAP_Y + mm)[1];
      const major = Math.round(mm * 10) % 5 === 0;
      ctx.strokeStyle = "#6B5636"; ctx.beginPath();
      ctx.moveTo(rx - 9, py); ctx.lineTo(rx - 9 + (major ? 10 : 5), py); ctx.stroke();
      if (major && mm > 0.01)
        g.text(mm.toFixed(1), rx + 12, py, { size: 10, color: g.theme.muted, baseline: "middle" });
    }
    const hy = g.P(RULE_X, 0, TRAP_Y + this.h)[1];       // accent pointer at current h
    g.poly([[rx - 22, hy - 5], [rx - 22, hy + 5], [rx - 11, hy]], g.theme.accent);

    // ---- height dimension arrow ----
    ctx.save(); ctx.globalAlpha = Math.max(0.35, g.labelAlpha);
    const dx = g.P(1.02, 0, 0)[0];
    const dy1 = g.P(1.02, 0, TRAP_Y)[1], dy2 = g.P(1.02, 0, TRAP_Y + this.h)[1];
    const dym = (dy1 + dy2) / 2;
    g.arrow(dx, dym, dx, dy2, g.theme.muted, 1.6);
    g.arrow(dx, dym, dx, dy1, g.theme.muted, 1.6);
    g.text("h = " + this.h.toFixed(2) + " m", dx - 8, dym,
           { size: 13, align: "right", baseline: "middle", color: g.theme.muted });
    ctx.restore();

    // ---- steel ball + contact shadow ----
    const bp = g.P(BX, 0, this.ballY), rp = R * 162;
    const shadowY = this.door > 0.4 ? 0 : TRAP_Y;
    const sp = g.P(BX, 0, shadowY);
    const prox = Math.max(0, 1 - (this.ballY - shadowY) / 2.4);
    ctx.fillStyle = "rgba(70,45,25," + (0.10 + 0.16 * prox).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(sp[0], sp[1], rp * (0.65 + 0.55 * prox), rp * 0.30 * (0.65 + 0.55 * prox),
                0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(bp[0] - rp * 0.35, bp[1] - rp * 0.4, rp * 0.12,
                                          bp[0], bp[1], rp);
    grad.addColorStop(0, "#F2F5F8"); grad.addColorStop(0.55, "#A8B1BC"); grad.addColorStop(1, "#525A64");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(bp[0], bp[1], rp, 0, Math.PI * 2); ctx.fill();
    if (this.phase !== "move" && this.ballY < this.attachY() - 0.01 && this.ballY > R + 0.01) {
      const v = Math.sqrt(2 * G_TRUE * Math.max(0, this.attachY() - this.ballY));
      g.arrow(bp[0] + rp + 12, bp[1], bp[0] + rp + 12, bp[1] + Math.min(52, 10 + v * 8),
              g.theme.danger, 2.5);
    }

    // ---- h–t² graph inset (series) ----
    if (this.series) {
      const box = g.graphInset({ x: 662, y: 14, w: 324, h: 196,
                                 title: "h AGAINST t²", xLabel: "t² (s²)", yLabel: "h (m)" });
      const XM = 0.48, YM = 2.2;
      ctx.save(); ctx.setLineDash([5, 4]);               // dashed true line, slope g/2
      ctx.strokeStyle = g.theme.good; ctx.lineWidth = 1.4; ctx.beginPath();
      const xr = Math.min(XM, YM / (G_TRUE / 2));
      ctx.moveTo(box.px(0), box.py(0));
      ctx.lineTo(box.px(xr / XM), box.py((G_TRUE / 2) * xr / YM));
      ctx.stroke(); ctx.restore();
      g.text("slope g/2 (true)", box.ax + box.aw - 6, box.ay + 14,
             { size: 10, color: g.theme.good, align: "right" });
      if (this.fit) {                                    // student's best-fit line
        const yA = 0.02 * this.fit.m + this.fit.b, yB = 0.46 * this.fit.m + this.fit.b;
        ctx.strokeStyle = g.theme.info; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(box.px(0.02 / XM), box.py(yA / YM));
        ctx.lineTo(box.px(0.46 / XM), box.py(yB / YM));
        ctx.stroke();
      }
      for (const [x, y] of this.pts) {
        ctx.fillStyle = g.theme.accent; ctx.beginPath();
        ctx.arc(box.px(x / XM), box.py(y / YM), 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- annotations ----
    if (g.state === "running")
      g.text("SLOW MOTION ×" + SLOW.toFixed(2), 16, 22, { size: 11, color: g.theme.muted });
    g.callout("electromagnet", ...g.P(BX - 0.09, 0, magB + 0.05), 452, 40);
    if (this.lag > 0)
      g.callout("release lag ≈ " + Math.round(this.lag * 1000) + " ms",
                ...g.P(BX + 0.09, 0, magB + 0.09), 452, 76);
    g.callout("steel ball", bp[0] + 4, bp[1] - 4, 452, 112);
    g.callout("metre rule", ...g.P(RULE_X + 0.05, 0, TRAP_Y + 1.55), 380, 150);
    g.callout("trapdoor switch", ...g.P(BX + 0.15, 0.05, TRAP_Y), 560, 434);
    g.callout("ms timer", ...g.P(2.90, -0.16, 0.30), 600, 330);
  }

  // ------------------------------------------------------------------
  // 5. Dashboard
  // ------------------------------------------------------------------
  values() {
    const timing = this.phase === "drop" && this.simT > 0 && this.simT < this.tMeas();
    const out = {
      timer: { value: this.quant(this.timerT).toFixed(3), live: timing },
      drop: this.h.toFixed(2),
      gtrue: "9.81"
    };
    if (this.series) {
      out.gmeas = { value: this.fit ? this.fit.g.toFixed(2) : "—", label: "g from h–t² gradient" };
      out.drops = { value: this.pts.length + " / " + SERIES_H.length, hidden: false };
      out._note = "h = ½gt², so the h–t² plot is a straight line of gradient g/2. " +
        (this.lag > 0
          ? "The release lag stretches every t, so the points sit right of the dashed true-g line and the fitted gradient reads slightly low."
          : "With an ideal release the points fall on the dashed true-g line.");
    } else {
      out.gmeas = { value: this.result ? this.result.g.toFixed(2) : "—", label: "Measured g = 2h/t²" };
      out.drops = { value: "—", hidden: true };
      out._note = this.lag > 0
        ? "The magnet's field takes ~" + Math.round(this.lag * 1000) +
          " ms to collapse, so the ball leaves AFTER the timer starts: t is too big and g = 2h/t² comes out below 9.81 — a systematic error."
        : "Ideal release: the ball leaves the instant the timer starts, so g = 2h/t² lands on 9.81 (within the 1 ms timer resolution).";
    }
    return out;
  }
}
