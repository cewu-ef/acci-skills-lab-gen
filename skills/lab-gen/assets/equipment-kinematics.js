/* LabKit equipment pack: kinematics — apparatus sprites for motion-along-a-track
 * labs (bench, track, trolley, light gates, digital timer, ticker-timer, power
 * supply, tape, motion sensor, laptop). Inlined by assemble.py when lab-config
 * declares `"equipment": "kinematics"`. Exposes window.EQ.
 *
 * Every function takes the DrawKit `g` first; all positions are world metres
 * (the g.P pseudo-3D space). Extracted verbatim from two proven reference labs.
 */
(() => {
  "use strict";

  // bench top + skirt + side face + highlight band; colors derive from g.theme.ground
  function bench(g, o = {}) {
    const { x0 = -0.15, x1 = 3.15, z0 = -0.34, z1 = 0.72, skirtH = 40 } = o;
    const ctx = g.ctx, p = g.P, ground = g.theme.ground;
    g.poly([p(x0, z0, 0), p(x1, z0, 0), p(x1, z1, 0), p(x0, z1, 0)], ground);
    const [s1x, s1y] = p(x0, z0, 0), [s2x] = p(x1, z0, 0);
    const skirt = ctx.createLinearGradient(0, s1y, 0, s1y + skirtH);
    skirt.addColorStop(0, g.shade(ground, 0.87));
    skirt.addColorStop(1, g.shade(ground, 0.76));
    ctx.fillStyle = skirt;
    ctx.fillRect(s1x, s1y, s2x - s1x, skirtH);
    const [e1x, e1y] = p(x1, z0, 0), [e2x, e2y] = p(x1, z1, 0);
    g.poly([[e1x, e1y], [e2x, e2y], [e2x, e2y + skirtH], [e1x, e1y + skirtH]], g.shade(ground, 0.82));
    g.poly([p(x0, 0.3, 0), p(x1, 0.3, 0), p(x1, z1, 0), p(x0, z1, 0)], "rgba(255,255,255,0.16)");
  }

  // straight track with two rails
  function track(g, o = {}) {
    const { x0 = 0, x1 = 3, halfW = 0.13, railZ = 0.10 } = o;
    const ctx = g.ctx, p = g.P;
    g.poly([p(x0, -halfW, 0.005), p(x1, -halfW, 0.005), p(x1, halfW, 0.005), p(x0, halfW, 0.005)], "#CDD3DB", "#ADB4BE", 1);
    for (const zz of [-railZ, railZ]) {
      const [r1x, r1y] = p(x0, zz, 0.006), [r2x, r2y] = p(x1, zz, 0.006);
      ctx.strokeStyle = "#9AA2AD"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r1x, r1y); ctx.lineTo(r2x, r2y); ctx.stroke();
    }
  }

  // trolley at front-edge x; card: null | {type:"flat"|"interrupt", length, gap?}
  function trolley(g, o) {
    const { x, card = null, color = "#D8382A", length = 0.30 } = o;
    const ctx = g.ctx, p = g.P;
    const x2 = x + length, y1 = 0.035, y2 = 0.135, zf = -0.10, zb = 0.10;
    g.poly([p(x - 0.02, zf, 0.002), p(x2 + 0.02, zf, 0.002), p(x2 + 0.02, zb, 0.002), p(x - 0.02, zb, 0.002)], "rgba(90,50,20,0.14)");
    const wheel = (wx, wz, r) => {
      const [cx, cy] = p(wx, wz, 0.035);
      ctx.fillStyle = "#26262B"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8E8E96"; ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2); ctx.fill();
    };
    wheel(x + 0.07, zb, 8); wheel(x2 - 0.07, zb, 8);
    g.poly([p(x, zf, y2), p(x2, zf, y2), p(x2, zb, y2), p(x, zb, y2)], g.shade(color, 1.3));
    g.poly([p(x2, zf, y1), p(x2, zf, y2), p(x2, zb, y2), p(x2, zb, y1)], g.shade(color, 0.72));
    const [ax, ay] = p(x, zf, y1), [bx, by] = p(x2, zf, y2);
    const grad = ctx.createLinearGradient(0, by, 0, ay);
    grad.addColorStop(0, g.shade(color, 1.08));
    grad.addColorStop(1, g.shade(color, 0.82));
    ctx.fillStyle = grad;
    ctx.fillRect(ax, by, bx - ax, ay - by);
    wheel(x + 0.07, zf, 9); wheel(x2 - 0.07, zf, 9);

    if (!card) return;
    if (card.type === "interrupt") {
      // two tall sections with a notch between (beam passes through the notch)
      const l = card.length, gap = card.gap ?? 0.07;
      const yLo = 0.12, yNotch = 0.185, yHi = 0.36;
      const px = (xx, yy) => p(xx, 0, yy);
      const pts = [
        px(x, yLo), px(x, yHi), px(x + l, yHi), px(x + l, yNotch),
        px(x + l + gap, yNotch), px(x + l + gap, yHi), px(x + 2 * l + gap, yHi), px(x + 2 * l + gap, yLo)
      ];
      ctx.save();
      ctx.shadowColor = "rgba(90,50,20,0.25)"; ctx.shadowBlur = 5;
      g.poly(pts, "#FEFDF8");
      ctx.restore();
      g.poly(pts, null, "#C9BFA9", 1);
      const [e1x, e1y] = px(x, yLo), [e2x, e2y] = px(x, yHi);
      ctx.strokeStyle = "#E04020"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e1x, e1y); ctx.lineTo(e2x, e2y); ctx.stroke();
    } else { // flat card
      const cl = card.length;
      const [c1x, c1y] = p(x, 0, 0.12), [c2x, c2y] = p(x + cl, 0, 0.36);
      ctx.save();
      ctx.shadowColor = "rgba(90,50,20,0.25)"; ctx.shadowBlur = 5;
      ctx.fillStyle = "#FEFDF8";
      ctx.fillRect(c1x, c2y, c2x - c1x, c1y - c2y);
      ctx.restore();
      ctx.strokeStyle = "#C9BFA9"; ctx.lineWidth = 1;
      ctx.strokeRect(c1x, c2y, c2x - c1x, c1y - c2y);
      ctx.strokeStyle = "#E04020"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c1x, c2y); ctx.lineTo(c1x, c1y); ctx.stroke();
    }
  }

  // light gate at x. Draw layer:"back" (rear post + rear beam) BEFORE the
  // trolley and layer:"front" (front beam + front post + crossbar) AFTER it.
  function lightGate(g, o) {
    const { x, blocked = false, layer = "front" } = o;
    const ctx = g.ctx, p = g.P;
    const post = (z, colBase) => {
      const [bx, by] = p(x, z, 0), [, ty] = p(x, z, 0.38);
      ctx.fillStyle = g.shade(colBase, 0.75);
      ctx.beginPath(); ctx.ellipse(bx, by, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createLinearGradient(bx - 5, 0, bx + 5, 0);
      grad.addColorStop(0, g.shade(colBase, 1.2));
      grad.addColorStop(0.5, colBase);
      grad.addColorStop(1, g.shade(colBase, 0.7));
      ctx.fillStyle = grad;
      ctx.fillRect(bx - 5, ty, 10, by - ty);
      const [, ey] = p(x, z, 0.205);
      ctx.fillStyle = "#2E3A48"; ctx.fillRect(bx - 7, ey - 6, 14, 12);
      ctx.fillStyle = "#FF4D3A";
      ctx.beginPath(); ctx.arc(bx, ey, 2.5, 0, Math.PI * 2); ctx.fill();
    };
    const beam = (z1, z2, dot) => {
      const [x1, y1] = p(x, z1, 0.205), [x2, y2] = p(x, z2, 0.205);
      ctx.save();
      ctx.strokeStyle = "rgba(255,45,35,0.85)"; ctx.lineWidth = 2;
      ctx.shadowColor = "#FF3020"; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (dot) {
        ctx.fillStyle = "#FF5030"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x2, y2, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    if (layer === "back") {
      post(0.16, "#8FA6C8");
      if (!blocked) beam(0, 0.145, false);
      return;
    }
    beam(-0.145, 0, blocked);
    post(-0.16, "#7E96BA");
    const [c1x, c1y] = p(x, -0.16, 0.38), [c2x, c2y] = p(x, 0.16, 0.38);
    ctx.strokeStyle = "#6F87A8"; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(c1x, c1y); ctx.lineTo(c2x, c2y); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c1x, c1y - 2.5); ctx.lineTo(c2x, c2y - 2.5); ctx.stroke();
  }

  // digital timer box with LCD readout; active = glowing green while timing
  function timerBox(g, o) {
    const { text, active = false, x = 0.02, z = 0.50 } = o;
    const ctx = g.ctx, p = g.P;
    const xb = x + 0.53, zb = z + 0.28, h = 0.25;
    g.poly([p(x, z, h), p(xb, z, h), p(xb, zb, h), p(x, zb, h)], "#D8E2E8");
    g.poly([p(xb, z, 0), p(xb, z, h), p(xb, zb, h), p(xb, zb, 0)], "#9FB1BD");
    const [fx1, fy1] = p(x, z, 0), [fx2, fy2] = p(xb, z, h);
    const grad = ctx.createLinearGradient(0, fy2, 0, fy1);
    grad.addColorStop(0, "#CBD8DF"); grad.addColorStop(1, "#AFC0CA");
    ctx.fillStyle = grad;
    ctx.fillRect(fx1, fy2, fx2 - fx1, fy1 - fy2);
    ctx.strokeStyle = "#8FA2AE"; ctx.lineWidth = 1;
    ctx.strokeRect(fx1, fy2, fx2 - fx1, fy1 - fy2);
    const dw = fx2 - fx1 - 44, dh = 30, dx = fx1 + 22, dy = fy2 + 12;
    ctx.fillStyle = "#161F28"; ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeStyle = "#5A6B77"; ctx.strokeRect(dx, dy, dw, dh);
    ctx.font = `22px ${g.theme.fontMono}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = active ? "#5AF2A0" : "#3FA86F";
    ctx.shadowColor = active ? "#5AF2A0" : "transparent";
    ctx.shadowBlur = active ? 8 : 0;
    ctx.fillText(text, dx + dw / 2, dy + dh / 2 + 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#39434C";
    ctx.beginPath(); ctx.arc(fx1 + 12, fy1 - 8, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(fx1 + 26, fy1 - 8, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  // sagging connection cable between two bench points
  function cable(g, o) {
    const { from, to } = o; // [x, z] pairs
    const ctx = g.ctx;
    const [x1, y1] = g.P(from[0], from[1], 0.02), [x2, y2] = g.P(to[0], to[1], 0.02);
    ctx.strokeStyle = "#4148B0"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + 16, x2, y2);
    ctx.stroke();
  }

  // ticker-timer device
  function ticker(g, o = {}) {
    const { x = 2.86 } = o;
    const ctx = g.ctx;
    g.box3D(x - 0.12, x + 0.12, -0.14, 0.14, 0, 0.035, "#B9C6D6");
    g.box3D(x - 0.08, x + 0.08, -0.09, 0.09, 0.035, 0.115, "#9FB4CC");
    const [dx, dy] = g.P(x, 0, 0.13);
    ctx.fillStyle = "#5B6B7E";
    ctx.beginPath(); ctx.ellipse(dx, dy, 15, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8395A9";
    ctx.beginPath(); ctx.ellipse(dx, dy - 1.5, 10, 4.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // bench power supply with vent + status LED
  function powerSupply(g, o = {}) {
    const { on = false } = o;
    const ctx = g.ctx;
    g.box3D(0.06, 0.52, 0.52, 0.78, 0, 0.22, "#BFCCD6");
    const [s1x, s1y] = g.P(0.13, 0.52, 0.15), [s2x] = g.P(0.42, 0.52, 0.15);
    ctx.fillStyle = "#20242B"; ctx.fillRect(s1x, s1y - 4, s2x - s1x, 8);
    const [lx, ly] = g.P(0.46, 0.52, 0.16);
    ctx.fillStyle = on ? "#43D97C" : "#7C8B96";
    ctx.shadowColor = on ? "#43D97C" : "transparent";
    ctx.shadowBlur = on ? 8 : 0;
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // paper tape from `from` (world x) to `to`, with marks the sim computed.
  // marks: [{x: worldX, major?: bool}]; major marks render as red ticks.
  function tape(g, o) {
    const { from, to = 3.04, marks = [], dotR = 1.4 } = o;
    const ctx = g.ctx;
    const [t1x, t1y] = g.P(from, 0.04, 0.06), [t2x, t2y] = g.P(to, 0.04, 0.06);
    ctx.strokeStyle = "#D9CDB6"; ctx.lineWidth = 9; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(t2x, t2y); ctx.stroke();
    ctx.strokeStyle = "#FDFBF4"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(t2x, t2y); ctx.stroke();
    for (const m of marks) {
      const [dx, dy] = g.P(m.x, 0.04, 0.062);
      if (m.major) {
        ctx.strokeStyle = "#C2401B"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(dx, dy - 4); ctx.lineTo(dx, dy + 4); ctx.stroke();
      } else {
        ctx.fillStyle = "#20242B";
        ctx.beginPath(); ctx.arc(dx, dy, dotR, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // laptop with a tiny live trace on screen
  function laptop(g, o = {}) {
    const ctx = g.ctx, p = g.P;
    g.box3D(0.05, 0.52, 0.48, 0.72, 0, 0.025, "#AEBBC7");
    g.poly([p(0.05, 0.72, 0.02), p(0.52, 0.72, 0.02), p(0.52, 0.84, 0.30), p(0.05, 0.84, 0.30)], "#3E4A56", "#2C3640", 1);
    const q1 = p(0.08, 0.727, 0.045), q2 = p(0.49, 0.727, 0.045), q3 = p(0.49, 0.833, 0.275), q4 = p(0.08, 0.833, 0.275);
    const grad = ctx.createLinearGradient(q4[0], q4[1], q1[0], q1[1]);
    grad.addColorStop(0, "#7FB3E8"); grad.addColorStop(1, "#2A6FDB");
    g.poly([q1, q2, q3, q4], grad);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const f = k / 10;
      const gx = q4[0] + (q3[0] - q4[0]) * (0.12 + 0.76 * f) + (q1[0] - q4[0]) * 0.15;
      const gy = q4[1] + (q3[1] - q4[1]) * (0.12 + 0.76 * f) + (q1[1] - q4[1]) * (0.2 + 0.6 * f);
      if (k === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
    }
    ctx.stroke(); ctx.restore();
  }

  // ultrasonic motion sensor; emitting face at world x
  function motionSensor(g, o = {}) {
    const { x = 0.03 } = o;
    const ctx = g.ctx;
    g.box3D(x - 0.13, x, -0.07, 0.07, 0, 0.17, "#AEBBC7");
    const [gx, gy] = g.P(x, 0, 0.10);
    ctx.fillStyle = "#39434C";
    ctx.beginPath(); ctx.ellipse(gx + 3, gy, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#20282F";
    ctx.beginPath(); ctx.ellipse(gx + 3, gy, 3.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  // expanding ultrasound pulse arcs from the sensor toward world x `to`
  function pulses(g, o) {
    const { from = 0.05, to, phase } = o;
    const ctx = g.ctx;
    const [sx, sy] = g.P(from, 0, 0.10);
    const [tx] = g.P(to, 0, 0.10);
    const dist = Math.max(20, tx - sx);
    ctx.save();
    for (let k = 0; k < 3; k++) {
      const f = (phase + k / 3) % 1;
      const r = 8 + f * (dist - 8);
      ctx.strokeStyle = "rgba(46,158,79," + (0.55 * (1 - f) + 0.1).toFixed(2) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r, -0.85, 0.85); ctx.stroke();
    }
    ctx.restore();
  }

  // fading direction-of-motion arrow above the trolley at world x
  function motionArrow(g, o) {
    const { x, y = 0.44, color = "#E23B1E" } = o;
    const ctx = g.ctx;
    ctx.save(); ctx.globalAlpha = 0.85;
    const [m1x, m1y] = g.P(x + 0.34, 0, y), [m2x, m2y] = g.P(x - 0.04, 0, y);
    g.arrow(m1x, m1y, m2x, m2y, color, 3);
    ctx.restore();
  }

  window.EQ = {
    bench, track, trolley, lightGate, timerBox, cable,
    ticker, powerSupply, tape, laptop, motionSensor, pulses, motionArrow
  };
})();
