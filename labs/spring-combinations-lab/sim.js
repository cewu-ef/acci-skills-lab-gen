// BOX 7.1 — Investigating springs: hang a load from a single spring, two in
// series, or two in parallel (Figure 7.9); measure extension, get k_eq = F/x.
// Off-pack: support, coil springs, load block and ruler are hand-drawn.
const L0 = 0.25;        // natural length of one spring (m)
const SUP_Y = 0.86;     // underside of the wooden support (m)
const LAM = 1.6;        // damping rate of the settling oscillation (1/s)
const GRAV = 9.81;
const CX = 1.02;        // arrangement centreline (world m)
const RULER_X = 1.30;

class Sim {
  constructor(P) { this.reset(P); }

  keq() {
    const k = this.p.k, a = this.p.arrangement;
    return a === "series" ? k / 2 : a === "parallel" ? 2 * k : k;
  }
  natLen() { return this.p.arrangement === "series" ? 2 * L0 + 0.02 : L0; }

  reset(P) {
    this.p = P;
    this.F = P.mass * GRAV;
    this.extEq = this.F / this.keq();            // equilibrium extension
    this.om = Math.sqrt(this.keq() / P.mass);    // oscillation frequency
    this.doneT = Math.log(50) / LAM;             // settled to within 2%
    this.tNow = 0;
    this.running = false;
    this.finished = false;
    this.trace = [];
  }

  // --- physics: damped settle onto the new equilibrium (closed form) ---
  extAt(t) {
    if (t <= 0) return 0;
    return this.extEq * (1 - Math.exp(-LAM * t) * Math.cos(this.om * t));
  }

  step(dt, t) {
    if (!this.trace.length || t - this.trace[this.trace.length - 1][0] > 0.02) {
      this.trace.push([t, this.extAt(t)]);
    }
    if (t >= this.doneT) return "done";
  }

  // --- scene ---
  draw(g) {
    this.tNow = Math.min(g.t, this.doneT);
    this.running = g.state === "running";
    this.finished = g.state === "done";
    const ctx = g.ctx, arr = this.p.arrangement;
    const ext = this.extAt(this.tNow);

    g.clear();
    g.setView({ OX: 0, BY: 445, S: 440, TX: 150, TZ: 80 });

    // wooden support bar (as in Figure 7.9)
    g.box3D(0.72, 1.38, -0.06, 0.06, SUP_Y, SUP_Y + 0.045, "#E9CA9C");

    const yNat = SUP_Y - this.natLen();   // unstretched bottom position
    const yBot = yNat - ext;

    this.ruler(g, RULER_X, yNat);

    // dashed natural-length line + extension dimension arrow
    ctx.save();
    ctx.globalAlpha = Math.max(0.5, g.labelAlpha);
    const [n1x, n1y] = g.P(CX - 0.12, 0, yNat), [n2x] = g.P(RULER_X + 0.05, 0, yNat);
    ctx.strokeStyle = g.theme.muted; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(n1x, n1y); ctx.lineTo(n2x, n1y); ctx.stroke();
    ctx.setLineDash([]);
    if (ext > 0.004) {
      const [ax, ay1] = g.P(CX + 0.17, 0, yNat), [, ay2] = g.P(CX + 0.17, 0, yBot);
      g.arrow(ax, (ay1 + ay2) / 2, ax, ay1, g.theme.danger, 1.6);
      g.arrow(ax, (ay1 + ay2) / 2, ax, ay2, g.theme.danger, 1.6);
      g.text("x = " + Math.round(ext * 1000) + " mm", ax + 8, (ay1 + ay2) / 2,
             { size: 13, color: g.theme.danger, baseline: "middle" });
    }
    ctx.restore();

    if (arr === "parallel") {
      this.spring(g, CX - 0.05, SUP_Y, L0 + ext);
      this.spring(g, CX + 0.05, SUP_Y, L0 + ext);
      g.box3D(CX - 0.075, CX + 0.075, -0.015, 0.015, yBot - 0.018, yBot, "#C8CDD2");
      this.mass(g, CX, yBot - 0.018);
    } else if (arr === "series") {
      const each = L0 + ext / 2;
      this.spring(g, CX, SUP_Y, each);
      const [lx, ly] = g.P(CX, 0, SUP_Y - each - 0.01);
      ctx.fillStyle = "#7A848D";
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
      this.spring(g, CX, SUP_Y - each - 0.02, each);
      this.mass(g, CX, yBot);
    } else {
      this.spring(g, CX, SUP_Y, L0 + ext);
      this.mass(g, CX, yBot);
    }

    // callouts: static labels top strip; the load moves, so it goes bottom strip
    g.callout("wooden support", ...g.P(0.80, 0, SUP_Y + 0.02), 140, 30);
    g.callout(arr === "single" ? "spring" : "identical springs",
              ...g.P(CX + (arr === "parallel" ? 0.06 : 0.016), 0, SUP_Y - L0 * 0.55), 330, 30);
    g.callout("load", ...g.P(CX + 0.03, -0.03, yBot - 0.035), 470, 452);
    g.callout("ruler (mm)", ...g.P(RULER_X + 0.015, 0, yNat - 0.2), 660, 452);

    // extension–time inset (shows the overshoot dying away)
    if (this.trace.length > 1) {
      const box = g.graphInset({ x: 706, y: 16, w: 272, h: 152,
                                 title: "EXTENSION–TIME", xLabel: "t", yLabel: "x" });
      const yMax = this.extEq * 1.9 || 1;
      ctx.strokeStyle = g.theme.info; ctx.lineWidth = 2; ctx.beginPath();
      this.trace.forEach(([tt, xx], i) => {
        const x = box.px(tt / this.doneT), y = box.py(xx / yMax);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  }

  // coil spring drawn as a zigzag between square ends (grey metal, like Figure 7.9)
  spring(g, cx, yTop, len) {
    const ctx = g.ctx, r = 0.016, coils = 12;
    ctx.strokeStyle = "#5A6570";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const [p0x, p0y] = g.P(cx, 0, yTop); ctx.moveTo(p0x, p0y);
    const [p1x, p1y] = g.P(cx, 0, yTop - 0.018); ctx.lineTo(p1x, p1y);
    const segTop = yTop - 0.018, segLen = len - 0.036, N = coils * 2;
    for (let i = 1; i <= N; i++) {
      const [px, py] = g.P(cx + (i % 2 ? -r : r), 0, segTop - segLen * i / N);
      ctx.lineTo(px, py);
    }
    const [p2x, p2y] = g.P(cx, 0, yTop - len + 0.018); ctx.lineTo(p2x, p2y);
    const [p3x, p3y] = g.P(cx, 0, yTop - len); ctx.lineTo(p3x, p3y);
    ctx.stroke();
  }

  // blue load block hanging with its top at topY (like Figure 7.9's block)
  mass(g, cx, topY) {
    g.box3D(cx - 0.042, cx + 0.042, -0.032, 0.032, topY - 0.07, topY, "#9DB6CD");
  }

  // ruler with zero aligned to the unstretched spring bottom — reads x directly
  ruler(g, x, yZero) {
    const ctx = g.ctx;
    const [px, py] = g.P(x, 0, yZero + 0.02);
    const wPx = 26, hPx = 0.42 * 440;
    ctx.save();
    ctx.fillStyle = g.theme.surface;
    ctx.strokeStyle = g.shade(g.theme.ground, 0.85);
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, wPx, hPx);
    ctx.strokeRect(px, py, wPx, hPx);
    const [, pyZero] = g.P(x, 0, yZero);
    for (let cm = 0; cm <= 38; cm++) {
      const ty = pyZero + cm * 0.01 * 440;
      if (ty > py + hPx - 4) break;
      const major = cm % 5 === 0;
      ctx.strokeStyle = g.theme.muted;
      ctx.beginPath(); ctx.moveTo(px, ty); ctx.lineTo(px + (major ? 10 : 6), ty); ctx.stroke();
      if (major) {
        ctx.fillStyle = g.theme.muted;
        ctx.font = "9px " + g.theme.fontMono;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(String(cm), px + 12, ty);
      }
    }
    ctx.restore();
  }

  // --- dashboard ---
  values() {
    const ext = this.extAt(this.tNow);
    const extMm = Math.round(ext * 1000);       // read off the ruler to the nearest mm
    const arr = this.p.arrangement;
    return {
      force: (this.F).toFixed(2),
      ext: { value: String(extMm), live: this.running },
      kmeas: { value: this.finished && extMm > 0 ? (this.F / (extMm / 1000)).toFixed(1) : "—",
               label: "Measured k_eq = F ÷ x" },
      kpred: { value: this.finished ? this.keq().toFixed(1) : "?",
               label: this.finished ? "Predicted k_eq (revealed)" : "Predicted k_eq — your guess?" },
      _note: arr === "series"
        ? "Two identical springs end-to-end: EACH spring feels the full load F, so each stretches by F/k. Predict k_eq, then run to check."
        : arr === "parallel"
        ? "Two identical springs side-by-side: each spring supports HALF the load. Predict k_eq, then run to check."
        : "Hooke's law: F = kx. Hang the load, wait for it to settle, and k = F ÷ x."
    };
  }
}
