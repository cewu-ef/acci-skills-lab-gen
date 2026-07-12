/* LabKit v0.1 — generic runtime harness for standalone interactive lab HTML.
 *
 * Assembled inline by scripts/assemble.py together with a theme (JSON), a lab
 * config (JSON) and a generated `class Sim`. Exposes window.LabKit with:
 *   applyTheme(theme)                    theme.json -> CSS custom properties
 *   buildChrome(config, mount)           declarative page chrome -> Chrome handles
 *   start(config, theme, SimClass, mount) full harness (chrome + rAF loop + DrawKit)
 *
 * No network, no dependencies, pointer events only, ARIA on all controls.
 */
(() => {
  "use strict";

  const VERSION = "0.1.0";

  /* ================= theme ================= */

  const THEME_DEFAULTS = {
    meta: {},
    palette: {
      pageBg: "#f6f4ef", surface: "#ffffff", surfaceAlt: "#f1ede4",
      ink: "#241f1a", inkMuted: "#8a7a66",
      accent: "#d4622a", accentContrast: "#ffffff",
      good: "#1e9e5a", warn: "#b45309", danger: "#b91c1c", info: "#0e7c86",
      canvasSky: "#fdf3e7", canvasGround: "#e9cfae", inkOnCanvas: "#3a2a22"
    },
    font: {
      body: "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      heading: "inherit",
      mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      baseSizePx: 15
    },
    shape: { radiusPx: 11, borderPx: 1.5, shadow: "soft" }
  };

  const SHADOWS = {
    flat:  { card: "none", pop: "0 12px 28px rgba(0,0,0,0.18)" },
    soft:  { card: "0 3px 12px rgba(0,0,0,0.07)", pop: "0 18px 36px rgba(0,0,0,0.22)" },
    crisp: { card: "2px 2px 0 rgba(0,0,0,0.14)", pop: "4px 4px 0 rgba(0,0,0,0.2)" }
  };

  function deepMerge(base, over) {
    const out = {};
    for (const k of Object.keys(base)) {
      const b = base[k], o = over ? over[k] : undefined;
      out[k] = (b && typeof b === "object" && !Array.isArray(b))
        ? deepMerge(b, o || {})
        : (o !== undefined ? o : b);
    }
    if (over) for (const k of Object.keys(over)) if (!(k in out)) out[k] = over[k];
    return out;
  }

  // Multiply an RGB color by factor f (f<1 darkens, f>1 lightens). Hex or rgb().
  function shadeColor(color, f) {
    let r, g, b, a = null;
    if (color[0] === "#") {
      let h = color.slice(1);
      if (h.length === 3) h = h.replace(/./g, (c) => c + c);
      const n = parseInt(h.slice(0, 6), 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      const m = /rgba?\(([^)]+)\)/.exec(color);
      if (!m) return color;
      const parts = m[1].split(",").map(Number);
      [r, g, b] = parts; a = parts[3] ?? null;
    }
    r = Math.min(255, Math.round(r * f));
    g = Math.min(255, Math.round(g * f));
    b = Math.min(255, Math.round(b * f));
    return a === null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  // Blend color toward white by t in [0,1].
  function tintColor(color, t) {
    let h = color[0] === "#" ? color.slice(1) : null;
    if (h && h.length === 3) h = h.replace(/./g, (c) => c + c);
    if (!h) return color;
    const n = parseInt(h.slice(0, 6), 16);
    const mix = (c) => Math.round(c + (255 - c) * t);
    return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
  }

  function applyTheme(theme, root) {
    const th = deepMerge(THEME_DEFAULTS, theme || {});
    const p = th.palette, f = th.font, s = th.shape;
    const sh = SHADOWS[s.shadow] || SHADOWS.soft;
    const line = p.line || shadeColor(p.surfaceAlt, 0.9);
    const vars = {
      "--lk-page-bg": p.pageBg,
      "--lk-surface": p.surface,
      "--lk-surface-alt": p.surfaceAlt,
      "--lk-surface-raise": tintColor(p.accent, 0.88),
      "--lk-ink": p.ink,
      "--lk-ink-muted": p.inkMuted,
      "--lk-line": line,
      "--lk-line-strong": shadeColor(line, 0.88),
      "--lk-accent": p.accent,
      "--lk-accent-contrast": p.accentContrast,
      "--lk-accent-strong": shadeColor(p.accent, 0.72),
      "--lk-accent-soft": tintColor(p.accent, 0.55),
      "--lk-accent-ink": shadeColor(p.accent, 0.85),
      "--lk-good": p.good,
      "--lk-warn": p.warn,
      "--lk-danger": p.danger,
      "--lk-info": p.info,
      "--lk-info-soft": tintColor(p.info, 0.6),
      "--lk-canvas-sky": p.canvasSky,
      "--lk-canvas-ground": p.canvasGround,
      "--lk-font-body": f.body,
      "--lk-font-heading": f.heading === "inherit" ? f.body : f.heading,
      "--lk-font-mono": f.mono,
      "--lk-base-size": f.baseSizePx + "px",
      "--lk-radius": s.radiusPx + "px",
      "--lk-border-w": s.borderPx + "px",
      "--lk-shadow": sh.card,
      "--lk-shadow-pop": sh.pop
    };
    const el = root || document.documentElement;
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    return th;
  }

  /* ================= config defaults ================= */

  const STRINGS = {
    start: "Start", pause: "Pause", resume: "Resume", runAgain: "Run again",
    reset: "Reset", settings: "Settings", settingsTitle: "Experiment settings"
  };

  function normalizeConfig(config) {
    const c = Object.assign({ layout: "standard", controls: [], params: [], stats: [] }, config);
    c.canvas = Object.assign({ w: 1000, h: 470 }, config.canvas || {});
    c.strings = Object.assign({}, STRINGS, config.strings || {});
    return c;
  }

  /* ================= dom helpers ================= */

  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    return n;
  }

  function fmtParam(def, value) {
    const d = def.decimals !== undefined ? def.decimals : 2;
    return Number(value).toFixed(d) + (def.unit ? " " + def.unit : "");
  }

  /* ================= chrome ================= */

  function buildChrome(config, mount) {
    const c = normalizeConfig(config);
    const S = c.strings;
    const values = {};          // control/select id -> string, param id -> number
    const changeCbs = [], runCbs = [], resetCbs = [];

    const page = el("div", "lk-page");

    // --- header ---
    const header = el("header", "lk-header");
    header.appendChild(el("h1", null, { text: c.title || "Interactive lab" }));
    if (c.subtitle) header.appendChild(el("p", "lk-subtitle", { text: c.subtitle }));
    page.appendChild(header);

    // --- control bar ---
    const bar = el("div", "lk-controlbar lk-card");
    const controlsBox = el("div", "lk-controls");
    const selectEls = {};
    for (const ctl of c.controls) {
      const field = el("div", "lk-field");
      const labId = "lk-lab-" + ctl.id;
      field.appendChild(el("span", "lk-label", { text: ctl.label || ctl.id, id: labId }));
      const sel = el("select", "lk-select", { "aria-labelledby": labId });
      if (ctl.width) sel.style.width = ctl.width + "px";
      for (const opt of ctl.options || []) {
        const o = el("option", null, { value: opt.value, text: opt.label });
        sel.appendChild(o);
      }
      sel.value = ctl.value !== undefined ? ctl.value : (ctl.options?.[0]?.value ?? "");
      values[ctl.id] = sel.value;
      sel.addEventListener("change", () => {
        values[ctl.id] = sel.value;
        refreshVisibility();
        emitChange(ctl.id, sel.value);
      });
      selectEls[ctl.id] = sel;
      field.appendChild(sel);
      controlsBox.appendChild(field);
    }
    bar.appendChild(controlsBox);

    const buttons = el("div", "lk-buttons");
    let settingsBtn = null, popover = null;
    const paramRows = {};

    if (c.params.length) {
      settingsBtn = el("button", "lk-btn", { type: "button", text: S.settings, "aria-expanded": "false", "aria-haspopup": "true" });
      buttons.appendChild(settingsBtn);

      popover = el("div", "lk-popover lk-card", { role: "group", "aria-label": S.settingsTitle, hidden: "" });
      popover.appendChild(el("div", "lk-popover-title", { text: S.settingsTitle }));
      for (const def of c.params) {
        const row = el("div", "lk-param", { "data-param": def.id });
        const label = el("span", "lk-param-label");
        label.appendChild(document.createTextNode((def.label || def.id) + " · "));
        const valSpan = el("span", "lk-param-value", { text: fmtParam(def, def.value) });
        label.appendChild(valSpan);
        row.appendChild(label);
        const input = el("input", null, {
          type: "range", min: def.min, max: def.max, step: def.step,
          value: def.value, "aria-label": def.label || def.id
        });
        values[def.id] = Number(def.value);
        input.addEventListener("input", () => {
          values[def.id] = Number(input.value);
          valSpan.textContent = fmtParam(def, input.value);
          emitChange(def.id, values[def.id]);
        });
        row.appendChild(input);
        paramRows[def.id] = { row, def, input, valSpan };
        popover.appendChild(row);
      }
      settingsBtn.addEventListener("click", () => toggleSettings());
      document.addEventListener("pointerdown", (e) => {
        if (popover.hidden) return;
        if (!popover.contains(e.target) && e.target !== settingsBtn) toggleSettings(false);
      });
    }

    const resetBtn = el("button", "lk-btn", { type: "button", text: S.reset });
    resetBtn.addEventListener("click", () => { toggleSettings(false); resetCbs.forEach((f) => f()); });
    buttons.appendChild(resetBtn);

    const runBtn = el("button", "lk-btn-primary", { type: "button", text: S.start, "data-lk": "run" });
    runBtn.addEventListener("click", () => { toggleSettings(false); runCbs.forEach((f) => f()); });
    buttons.appendChild(runBtn);

    bar.appendChild(buttons);
    if (popover) bar.appendChild(popover);
    page.appendChild(bar);

    // --- stage / canvas ---
    const stage = el("div", "lk-stage lk-card");
    const canvas = el("canvas", null, {
      width: c.canvas.w, height: c.canvas.h,
      role: "img", "aria-label": (c.title || "lab") + " — simulation view"
    });
    stage.appendChild(canvas);
    page.appendChild(stage);

    // --- stats dashboard ---
    const statsBox = el("div", "lk-stats");
    const statEls = {};
    for (const st of c.stats) {
      const card = el("div", "lk-stat lk-card", { "data-stat": st.id });
      if (st.variant) card.setAttribute("data-variant", st.variant);
      const label = el("div", "lk-stat-label", { text: st.label || st.id });
      const value = el("div", "lk-stat-value");
      const num = el("span", "lk-num", { text: "—" });
      const unit = el("span", "lk-stat-unit", { text: st.unit ? " " + st.unit : "" });
      value.appendChild(num); value.appendChild(unit);
      card.appendChild(label); card.appendChild(value);
      statEls[st.id] = { card, label, num, unit };
      statsBox.appendChild(card);
    }
    if (c.stats.length) page.appendChild(statsBox);

    // --- note footer ---
    const note = el("p", "lk-note");
    if (c.note) note.textContent = c.note;
    page.appendChild(note);

    (mount || document.body).appendChild(page);

    /* --- behaviors --- */

    function toggleSettings(force) {
      if (!popover) return;
      const show = force !== undefined ? force : popover.hidden;
      popover.hidden = !show;
      if (settingsBtn) settingsBtn.setAttribute("aria-expanded", String(show));
    }

    // params/controls may declare showIf: {control: "<selectId>", in: ["a","b"]}
    function visible(def) {
      if (!def.showIf) return true;
      const cur = values[def.showIf.control];
      return (def.showIf.in || []).includes(cur);
    }
    function refreshVisibility() {
      for (const { row, def } of Object.values(paramRows)) row.hidden = !visible(def);
    }
    refreshVisibility();

    function emitChange(id, v) { changeCbs.forEach((f) => f(id, v)); }

    return {
      root: page,
      canvas,
      ctx: canvas.getContext("2d"),
      config: c,
      params: () => Object.assign({}, values),
      setStat(id, patch) {
        const s = statEls[id];
        if (!s) return;
        if (typeof patch === "string" || typeof patch === "number") patch = { value: patch };
        if (patch.value !== undefined) s.num.textContent = String(patch.value);
        if (patch.label !== undefined) s.label.textContent = patch.label;
        if (patch.unit !== undefined) s.unit.textContent = patch.unit ? " " + patch.unit : "";
        if (patch.hidden !== undefined) s.card.hidden = !!patch.hidden;
        if (patch.live !== undefined) {
          if (patch.live) s.card.setAttribute("data-state", "live");
          else s.card.removeAttribute("data-state");
        }
      },
      setNote(text) { note.textContent = text || ""; },
      setRunLabel(text) { runBtn.textContent = text; },
      setSelect(id, v) {
        const sel = selectEls[id];
        if (sel && sel.value !== v) { sel.value = v; values[id] = v; refreshVisibility(); }
      },
      closeSettings: () => toggleSettings(false),
      onChange: (f) => changeCbs.push(f),
      onRun: (f) => runCbs.push(f),
      onReset: (f) => resetCbs.push(f),
      showError(msg) {
        const box = el("div", "lk-error", { role: "alert", text: "Lab error:\n" + msg });
        page.insertBefore(box, page.firstChild);
      }
    };
  }

  /* ================= DrawKit ================= */

  function makeDrawKit(chrome, theme) {
    const ctx = chrome.ctx;
    const W = chrome.canvas.width, H = chrome.canvas.height;
    const p = theme.palette, f = theme.font;
    const view = { OX: 28, BY: Math.round(H * 0.75), S: 280, TX: 130, TZ: 70 };

    const g = {
      ctx, W, H,
      t: 0, dt: 0, state: "idle", params: {}, labelAlpha: 1,
      theme: {
        sky: p.canvasSky, ground: p.canvasGround, ink: p.inkOnCanvas,
        muted: p.inkMuted, accent: p.accent, good: p.good, warn: p.warn,
        danger: p.danger, info: p.info, surface: p.surface,
        fontBody: f.body, fontMono: f.mono
      },

      setView(v) { Object.assign(view, v); },
      // pseudo-3D projection: world (x right, z depth, y up) -> canvas px
      P(x, z, y) { return [view.OX + x * view.S + z * view.TX, view.BY - y * view.S - z * view.TZ]; },

      shade: shadeColor,
      tint: tintColor,

      clear(top, bottom) {
        ctx.clearRect(0, 0, W, H);
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, top || p.canvasSky);
        bg.addColorStop(1, bottom || shadeColor(p.canvasSky, 0.94));
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
      },

      poly(pts, fill, stroke, lw) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
      },

      // cuboid from world coords: x in [xa,xb], z in [za,zb], y in [y0,y1]
      box3D(xa, xb, za, zb, y0, y1, col) {
        const q = g.P;
        g.poly([q(xa, za, y1), q(xb, za, y1), q(xb, zb, y1), q(xa, zb, y1)], shadeColor(col, 1.18));
        g.poly([q(xb, za, y0), q(xb, za, y1), q(xb, zb, y1), q(xb, zb, y0)], shadeColor(col, 0.72));
        const [f1x, f1y] = q(xa, za, y0), [f2x, f2y] = q(xb, za, y1);
        const grad = ctx.createLinearGradient(0, f2y, 0, f1y);
        grad.addColorStop(0, shadeColor(col, 1.02));
        grad.addColorStop(1, shadeColor(col, 0.85));
        ctx.fillStyle = grad;
        ctx.fillRect(f1x, f2y, f2x - f1x, f1y - f2y);
        ctx.strokeStyle = shadeColor(col, 0.65);
        ctx.lineWidth = 1;
        ctx.strokeRect(f1x, f2y, f2x - f1x, f1y - f2y);
      },

      text(str, x, y, o = {}) {
        ctx.font = `${o.weight || 700} ${o.size || 13}px ${o.mono ? g.theme.fontMono : g.theme.fontBody}`;
        ctx.textAlign = o.align || "left";
        ctx.textBaseline = o.baseline || "alphabetic";
        ctx.fillStyle = o.color || g.theme.ink;
        ctx.fillText(str, x, y);
      },

      arrow(x1, y1, x2, y2, color, w = 3) {
        ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.lineWidth = w; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1), hs = Math.max(8, w * 3.3);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - hs * Math.cos(ang - 0.45), y2 - hs * Math.sin(ang - 0.45));
        ctx.lineTo(x2 - hs * Math.cos(ang + 0.45), y2 - hs * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
      },

      // Margin label with an elbow leader line to a target point. alpha defaults
      // to g.labelAlpha (harness fades labels while the sim is running).
      callout(txt, tx, ty, lx, ly, alpha) {
        const a = alpha !== undefined ? alpha : g.labelAlpha;
        if (a < 0.02) return;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = g.theme.muted; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx, ly + (ly < ty ? 8 : -10));
        ctx.lineTo(lx, (ly + ty) / 2);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = g.theme.muted;
        ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, Math.PI * 2); ctx.fill();
        g.text(txt, lx, ly + (ly < ty ? 6 : -6), {
          size: 14, align: "center",
          baseline: ly < ty ? "bottom" : "top",
          color: shadeColor(g.theme.muted, 0.8)
        });
        ctx.restore();
      },

      // Framed mini-graph card; draws frame/title/axes and returns the plot
      // area {ax, ay, aw, ah, px(fx), py(fy)} (fx, fy are 0..1 fractions;
      // py(0) is the x-axis, py(1) the top). Caller draws its own series.
      graphInset(o) {
        const x = o.x, y = o.y, w = o.w || 234, h = o.h || 150;
        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.fillStyle = g.theme.surface;
        ctx.strokeStyle = shadeColor(g.theme.ground, 0.95);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
        ctx.fill(); ctx.stroke();
        if (o.title) g.text(o.title, x + 14, y + 10, { size: 11, weight: 800, color: g.theme.muted, baseline: "top" });
        const ax = x + 36, ay = y + h - 24, aw = w - 52, ah = h - 58;
        ctx.strokeStyle = g.theme.muted; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay - ah); ctx.lineTo(ax, ay); ctx.lineTo(ax + aw, ay);
        ctx.stroke();
        if (o.xLabel) g.text(o.xLabel, ax + aw + 4, ay - 4, { size: 10, color: g.theme.muted });
        if (o.yLabel) g.text(o.yLabel, ax - 12, ay - ah - 2, { size: 10, color: g.theme.muted });
        ctx.restore();
        return { ax, ay, aw, ah, px: (fx) => ax + fx * aw, py: (fy) => ay - fy * ah };
      }
    };
    return g;
  }

  /* ================= harness ================= */

  function start(config, theme, SimClass, mount) {
    const th = applyTheme(theme);
    const chrome = buildChrome(config, mount);
    const S = chrome.config.strings;

    function fail(msg) {
      chrome.showError(msg);
      throw new Error("LabKit: " + msg);
    }

    if (typeof SimClass !== "function") fail("Sim class is missing or not a class.");
    for (const m of ["reset", "step", "draw", "values"]) {
      if (typeof SimClass.prototype[m] !== "function") fail(`Sim is missing required method ${m}()`);
    }

    const g = makeDrawKit(chrome, th);
    let sim;
    try {
      sim = new SimClass(chrome.params());
    } catch (e) {
      fail("Sim constructor threw: " + (e && e.message ? e.message : e));
    }

    let state = "idle";
    let t = 0;
    let raf = 0;
    let last = performance.now();

    function setState(s) {
      state = s;
      chrome.setRunLabel(s === "running" ? S.pause : s === "done" ? S.runAgain : s === "paused" ? S.resume : S.start);
    }

    function hardReset() {
      t = 0;
      setState("idle");
      try { sim.reset(chrome.params()); } catch (e) { die(e); }
    }

    function die(e) {
      cancelAnimationFrame(raf);
      chrome.showError((e && e.stack) ? e.stack.split("\n").slice(0, 4).join("\n") : String(e));
      console.error(e);
    }

    chrome.onChange((id, v) => {
      if (sim.onChange) { try { sim.onChange(id, v, chrome.params()); } catch (e) { die(e); return; } }
      hardReset();
    });
    chrome.onReset(hardReset);
    chrome.onRun(() => {
      if (state === "done") { t = 0; try { sim.reset(chrome.params()); } catch (e) { die(e); return; } setState("running"); }
      else if (state === "running") setState("paused");
      else setState("running");
    });

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        if (state === "running") {
          t += dt;
          if (sim.step(dt, t) === "done") setState("done");
        }
        // callouts fade while running (matches reference labs)
        const target = state === "running" ? 0.15 : 1;
        g.labelAlpha += (target - g.labelAlpha) * Math.min(1, dt * 6);
        g.t = t; g.dt = dt; g.state = state; g.params = chrome.params();
        sim.draw(g);
        const vals = sim.values() || {};
        for (const [id, patch] of Object.entries(vals)) {
          if (id === "_note") chrome.setNote(patch);   // reserved: updates the footer note
          else chrome.setStat(id, patch);
        }
      } catch (e) {
        die(e);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    hardReset();
    raf = requestAnimationFrame(frame);

    return {
      chrome, sim, drawKit: g,
      state: () => state,
      reset: hardReset,
      stop: () => cancelAnimationFrame(raf)
    };
  }

  window.LabKit = { version: VERSION, applyTheme, buildChrome, start };
})();
