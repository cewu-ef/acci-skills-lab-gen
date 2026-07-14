// Elephant Toothpaste (Science Buddies): catalase in yeast decomposes hydrogen
// peroxide, 2 H2O2 -> 2 H2O + O2; dish soap traps the oxygen as foam.
// No equipment pack applies — the apparatus (tray, bottle, cup, foam) is
// hand-drawn with DrawKit primitives.
const T_POUR = 2.5;       // s spent pouring the yeast mixture before the reaction
const MOLAR_VOL = 24000;  // mL of gas per mol at room temperature
const BX = 0.95;          // bottle centre (world m)
const BOT_R = 0.036, BOT_H = 0.24, MOUTH_R = 0.014, SHOULDER = 0.17;
const TRAY = { x0: 0.32, x1: 1.58, z0: -0.22, z1: 0.42 };

class Sim {
  constructor(P) { this.reset(P); }

  reset(P) {
    this.p = P;
    // 3% w/v peroxide: grams of H2O2 -> moles -> half as many moles of O2
    this.vO2tot = (0.03 * P.peroxide / 34) / 2 * MOLAR_VOL; // mL of O2 if all decomposes
    this.k = 0.10 * P.yeast;                                // 1st-order rate, prop. to catalase
    this.doneT = T_POUR + Math.log(25) / this.k;            // run ends near 4% H2O2 left
    this.tNow = 0;
    this.running = false;
    this.finished = false;
    this.trace = [];
  }

  // --- chemistry model (closed form) ---
  frac(t) { return t <= T_POUR ? 1 : Math.exp(-this.k * (t - T_POUR)); }
  o2At(t) { return this.vO2tot * (1 - this.frac(t)); }
  foamAt(t) { return 0.85 * this.o2At(t); }                 // some oxygen escapes untrapped
  rateAt(t) { return t <= T_POUR ? 0 : 0.85 * this.vO2tot * this.k * this.frac(t); }

  step(dt, t) {
    if (!this.trace.length || t - this.trace[this.trace.length - 1][0] > 0.1) {
      this.trace.push([t, this.foamAt(t)]);
    }
    if (t >= this.doneT) return "done";
  }

  // deterministic jitter (no randomness — resets and pauses stay exact)
  h1(n) { const s = Math.sin(n * 127.1) * 43758.545; return s - Math.floor(s); }

  foamColors() {
    if (this.p.coloring === "single") return { base: "#F6CFC7", shade: "#E5AB9F", stripes: null };
    return { base: "#FFFFFF", shade: "#DCE4E9",
             stripes: this.p.coloring === "stripes" ? ["#D95043", "#2E7E8C"] : null };
  }

  // --- scene ---
  draw(g) {
    this.tNow = Math.min(g.t, this.doneT);
    this.running = g.state === "running";
    this.finished = g.state === "done";
    const ctx = g.ctx, t = this.tNow;
    const foam = this.foamAt(t);
    const colors = this.foamColors();

    g.clear();
    g.setView({ OX: -80, BY: 390, S: 560, TX: 150, TZ: 80 });

    // metal tray: thin slab + four rim strips
    g.box3D(TRAY.x0, TRAY.x1, TRAY.z0, TRAY.z1, -0.014, 0, "#C7CDD3");
    g.box3D(TRAY.x0, TRAY.x1, TRAY.z1 - 0.018, TRAY.z1, 0, 0.02, "#BEC5CB");
    g.box3D(TRAY.x0, TRAY.x1, TRAY.z0, TRAY.z0 + 0.018, 0, 0.02, "#B4BBC2");
    g.box3D(TRAY.x0, TRAY.x0 + 0.018, TRAY.z0, TRAY.z1, 0, 0.02, "#BAC1C8");
    g.box3D(TRAY.x1 - 0.018, TRAY.x1, TRAY.z0, TRAY.z1, 0, 0.02, "#BAC1C8");

    // foam pool spreading on the tray (drawn before the bottle)
    if (foam > 250) this.pool(g, foam, colors);

    this.bottle(g, colors);

    // foam column rising out of the mouth
    if (foam > 5) this.column(g, foam, colors);

    // measuring cup: on the tray, pouring above the mouth, then back empty
    const pouring = this.running && t > 0 && t < T_POUR;
    if (pouring) this.cup(g, BX + 0.10, 0.34, -0.9, true);
    else this.cup(g, 1.32, 0.001, 0, t === 0);
    if (pouring) {
      const [sx, sy] = g.P(BX + 0.055, 0, 0.315), [mx, my] = g.P(BX, 0, BOT_H);
      ctx.strokeStyle = "#D9CFA4"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx + 4, (sy + my) / 2, mx, my);
      ctx.stroke();
    }

    // callouts (auto-fade while running)
    g.callout("plastic bottle", ...g.P(BX + BOT_R, 0, 0.10), 190, 30);
    g.callout("tray to catch the foam", ...g.P(1.40, 0.34, 0.015), 320, 452);
    g.callout(t < T_POUR ? "yeast mixture" : "measuring cup",
              ...(t > 0 && t < T_POUR && this.running ? g.P(BX + 0.13, 0, 0.36) : g.P(1.32, 0, 0.045)),
              620, 452);

    // foam–time inset
    if (this.trace.length > 1) {
      const box = g.graphInset({ x: 706, y: 16, w: 272, h: 152,
                                 title: "FOAM–TIME", xLabel: "t", yLabel: "V" });
      const yMax = Math.max(100, 0.85 * this.vO2tot);
      ctx.strokeStyle = g.theme.info; ctx.lineWidth = 2; ctx.beginPath();
      this.trace.forEach(([tt, vv], i) => {
        const x = box.px(tt / this.doneT), y = box.py(vv / yMax);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  }

  bottle(g, colors) {
    const ctx = g.ctx;
    const w = (y) => y < SHOULDER ? BOT_R
      : y < 0.21 ? BOT_R + (MOUTH_R - BOT_R) * (y - SHOULDER) / (0.21 - SHOULDER)
      : MOUTH_R;
    const side = (sgn) => {
      const pts = [];
      [0, 0.06, 0.12, SHOULDER, 0.185, 0.20, 0.21, BOT_H].forEach(y =>
        pts.push(g.P(BX + sgn * w(y), 0, y)));
      return pts;
    };
    const L = side(-1), R = side(1).reverse();

    // peroxide (+ soap) inside, level set by the chosen volume (500 mL bottle)
    const lvl = Math.min(SHOULDER - 0.005, 0.16 * this.p.peroxide / 240);
    const liquid = this.p.coloring === "single" ? "#EFB9C4" : "#DDEBF2";
    const [lx1, ly1] = g.P(BX - BOT_R + 0.004, 0, 0), [lx2, ly2] = g.P(BX + BOT_R - 0.004, 0, lvl);
    ctx.fillStyle = liquid;
    ctx.fillRect(lx1, ly2, lx2 - lx1, ly1 - ly2);

    // rising O2 bubbles while the reaction runs
    if (this.running && this.tNow > T_POUR && this.frac(this.tNow) > 0.05) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 8; i++) {
        const yy = ((this.tNow * (0.02 + 0.006 * i) + this.h1(i) * lvl) % lvl);
        const [bx, by] = g.P(BX + (this.h1(i * 3 + 1) - 0.5) * 1.6 * BOT_R, 0, yy + 0.004);
        ctx.beginPath(); ctx.arc(bx, by, 1.6 + this.h1(i * 7) * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // transparent bottle wall
    ctx.beginPath();
    L.concat(R).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.strokeStyle = "#AEB8C0"; ctx.lineWidth = 1.6;
    ctx.fill(); ctx.stroke();
    // highlight
    const [h1x, h1y] = g.P(BX - BOT_R * 0.55, 0, 0.015), [h2x, h2y] = g.P(BX - BOT_R * 0.55, 0, SHOULDER - 0.02);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(h1x, h1y); ctx.lineTo(h2x, h2y); ctx.stroke();

    // coloring drops on the rim before the reaction (stripes mode)
    if (this.p.coloring === "stripes" && this.tNow < T_POUR) {
      ["#D95043", "#2E7E8C"].forEach((c, i) => {
        const [dx1, dy1] = g.P(BX + (i ? 0.008 : -0.010), 0, BOT_H - 0.002);
        const [dx2, dy2] = g.P(BX + (i ? 0.011 : -0.013), 0, 0.205);
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(dx1, dy1); ctx.lineTo(dx2, dy2); ctx.stroke();
      });
    }
  }

  column(g, foam, colors) {
    const ctx = g.ctx;
    const h = 0.30 * Math.min(1, foam / 700);
    const rows = Math.max(1, Math.round(h / 0.022));
    for (let i = 0; i < rows; i++) {
      const y = BOT_H - 0.01 + i * 0.022;
      const w = MOUTH_R + 0.012 + Math.min(0.022, i * 0.004);
      for (let j = -2; j <= 2; j++) {
        const [bx, by] = g.P(BX + j * w * 0.42 + (this.h1(i * 5 + j) - 0.5) * 0.006, 0, y);
        const r = (w * 0.52 + this.h1(i + j * 7) * 0.007) * 560;
        ctx.fillStyle = (j + i) % 3 === 2 ? colors.shade : colors.base;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (colors.stripes) {
      const top = BOT_H - 0.01 + (rows - 1) * 0.022;
      colors.stripes.forEach((c, s) => {
        ctx.strokeStyle = c; ctx.globalAlpha = 0.8; ctx.lineWidth = 4.5; ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const y = BOT_H - 0.005 + (top - BOT_H) * i / 12;
          const wob = Math.sin(i * 1.1 + s * 2.4) * 0.006;
          const [px, py] = g.P(BX + (s ? 0.014 : -0.016) + wob, 0, y);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
  }

  pool(g, foam, colors) {
    const ctx = g.ctx;
    const rP = 0.06 + 0.20 * Math.min(1, (foam - 250) / 1400);
    const [cx, cy] = g.P(BX, 0.06, 0.008);
    const rx = rP * 560, ry = rP * 170;
    ctx.fillStyle = colors.base;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    // blobby rim
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const bx = cx + Math.cos(a) * rx * 0.95, by = cy + Math.sin(a) * ry * 0.95;
      ctx.fillStyle = i % 4 === 3 ? colors.shade : colors.base;
      ctx.beginPath(); ctx.arc(bx, by, 6 + this.h1(i) * 7, 0, Math.PI * 2); ctx.fill();
    }
    if (colors.stripes) {
      colors.stripes.forEach((c, s) => {
        ctx.strokeStyle = c; ctx.globalAlpha = 0.75; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const a = 0.5 + s * 2.6 + i * 0.30;
          const rr = (0.15 + 0.75 * i / 20) * (s ? 0.85 : 1);
          ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
  }

  cup(g, x, y, tilt, full) {
    const ctx = g.ctx;
    const [px, py] = g.P(x, 0, y);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(tilt);
    if (full) { ctx.fillStyle = "#D9CFA4"; ctx.fillRect(-13, -14, 26, 8); } // yeast mixture
    ctx.fillStyle = "#8CC63F";
    ctx.beginPath();
    ctx.moveTo(-16, -18); ctx.lineTo(16, -18); ctx.lineTo(12, 0); ctx.lineTo(-12, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#7BB335";
    ctx.fillRect(14, -16, 14, 5); // handle
    ctx.restore();
  }

  // --- dashboard ---
  values() {
    const t = this.tNow, reacting = this.running && t > T_POUR;
    return {
      foam: { value: this.foamAt(t).toFixed(0), live: reacting },
      o2: this.o2At(t).toFixed(0),
      left: { value: (100 * this.frac(t)).toFixed(1), live: reacting },
      rate: { value: this.rateAt(t).toFixed(0), live: reacting },
      _note: this.running && t < T_POUR
        ? "Pouring the yeast mixture into the bottle — step back and watch the reaction go!"
        : "Catalase in the yeast decomposes hydrogen peroxide — 2 H₂O₂ → 2 H₂O + O₂ — and the dish soap traps the escaping oxygen as foam. The reaction slows as the peroxide runs out."
    };
  }
}
