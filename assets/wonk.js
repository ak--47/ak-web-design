/* ============================================================
   wonk.js · behaviors for the WONK design system
   Dependency-free. Safe to load once per page.
   Everything respects prefers-reduced-motion.
   ============================================================ */
(() => {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (min, max) => min + Math.random() * (max - min);
  const token = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // marks "JS is here" so CSS may hide things that JS will reveal
  document.documentElement.classList.add("wonk-js");

  // ---- easter egg: every WONK app greets whoever opens the console ----
  const GREETINGS = [
    "you're getting wonkier...",
    "music is endlessly divisible. so is this DOM.",
    "COLLABORATION IS HOW PROJECTS GET FINISHED",
    "knock, knock...",
  ];
  console.log(
    "%c" + GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    "font-family: monospace; letter-spacing: 0.2em; color: #00eeff;"
  );

  // ---- irregular live jitter ----
  // The WONK signature: bursts of 100-180ms blinks, then a rest.
  // Apply to any element with [data-wonk-live].
  function live(el) {
    if (REDUCED) return;
    el.style.animation = "none"; // take over from the CSS fallback
    let on = true;
    (function tick() {
      if (!el.isConnected) return;
      on = !on;
      el.style.opacity = on ? 1 : 0.15;
      const burst = Math.random() < 0.7;
      setTimeout(tick, burst ? rand(100, 180) : rand(600, 1500));
    })();
  }

  // ---- glyph morph ----
  // Slow cycle through glyphs + token colors; strobes on hover.
  // Apply to any element with [data-wonk-glyph].
  const GLYPHS = ["∿", "⌁", "♪", "⚙", "λ", "⌥", "∫", "⧉", "♭", "№", "⚡", "✄"];
  function glyph(el) {
    const swap = () => {
      // read tokens live: pair/theme can change under us
      const colors = ["--ak-a1-text", "--ak-a2-text", "--ak-ok", "--ak-warn", "--ak-info"]
        .map(token)
        .filter(Boolean);
      el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      if (colors.length) el.style.color = colors[Math.floor(Math.random() * colors.length)];
      if (!REDUCED) {
        el.style.display = "inline-block";
        el.style.transition = "transform 250ms cubic-bezier(.2,.9,.25,1.05)";
        el.style.transform = `scale(${rand(0.92, 1.12)}) rotate(${rand(-8, 8)}deg)`;
        setTimeout(() => { el.style.transform = "none"; }, 260);
      }
    };
    if (REDUCED) { swap(); return; }
    let slow = setInterval(swap, 1500);
    let strobe = null;
    el.addEventListener("mouseenter", () => {
      clearInterval(slow);
      (function s() { swap(); strobe = setTimeout(s, rand(100, 180)); })();
    });
    el.addEventListener("mouseleave", () => {
      clearTimeout(strobe);
      slow = setInterval(swap, 1500);
    });
  }

  // ---- type scatter ----
  // Letters spring apart on hover, spring back on leave.
  // Apply to short display text with [data-wonk-scatter]. One per view.
  function scatter(el) {
    if (REDUCED) return;
    const text = el.textContent;
    el.textContent = "";
    el.setAttribute("aria-label", text);
    const spans = [...text].map((ch) => {
      const s = document.createElement("span");
      s.textContent = ch;
      s.setAttribute("aria-hidden", "true");
      s.style.display = "inline-block";
      s.style.whiteSpace = "pre";
      s.style.transition = "transform 300ms cubic-bezier(.2,.9,.25,1.05)";
      el.appendChild(s);
      return s;
    });
    el.addEventListener("mouseenter", () =>
      spans.forEach((s) => {
        s.style.transform =
          `translate(${rand(-6, 6)}px, ${rand(-10, 10)}px) rotate(${rand(-14, 14)}deg)`;
      })
    );
    el.addEventListener("mouseleave", () =>
      spans.forEach((s) => (s.style.transform = "none"))
    );
  }

  // ---- scroll reveal ----
  // Elements with .wonk-reveal fade/slide in when they enter the viewport.
  // CSS hides them only under .wonk-js, so no-JS pages stay visible.
  function reveal(scope = document) {
    const els = [...scope.querySelectorAll(".wonk-reveal:not(.is-in)")];
    if (!els.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08 }
    );
    els.forEach((e) => io.observe(e));
  }

  // ---- sparkline ----
  // wonk.spark(el, values, {stroke, dot, w, h}) -> inline SVG trend.
  // No axes, no labels: a spark is a shape, not a chart. For anything the
  // reader must decode precisely, use a real Plot chart (references/charts.md).
  function spark(el, values, opts = {}) {
    const w = opts.w || 120, h = opts.h || 32, pad = 3;
    const stroke = opts.stroke || token("--ak-chart-1") || "currentColor";
    const dot = opts.dot || token("--ak-chart-2") || stroke;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [
      pad + (i / (values.length - 1)) * (w - pad * 2),
      h - pad - ((v - min) / span) * (h - pad * 2),
    ]);
    const last = pts[pts.length - 1];
    el.innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="display:inline-block;vertical-align:middle">` +
      `<polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}"` +
      ` fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>` +
      `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${dot}"/></svg>`;
  }

  // ---- VU meter ----
  // <div data-wonk-vu="12"></div> -> animated level bars, WONK-irregular timing.
  // Decorative by default; call wonk.vu(el).set([0..100,...]) to drive it with
  // real values (it stops self-animating once you feed it).
  function vu(el) {
    const n = parseInt(el.dataset.wonkVu, 10) || 12;
    el.classList.add("wonk-vu");
    el.setAttribute("aria-hidden", "true");
    el.replaceChildren();
    const bars = Array.from({ length: n }, () => {
      const b = document.createElement("span");
      b.className = "bar";
      el.appendChild(b);
      return b;
    });
    const paint = (levels) =>
      bars.forEach((b, i) => {
        const l = Math.max(4, Math.min(100, levels[i] ?? 4));
        b.style.height = l + "%";
        b.classList.toggle("clip", l > 88);
        b.classList.toggle("hot", l > 68 && l <= 88);
      });
    let auto = !REDUCED;
    let levels = bars.map(() => rand(10, 60));
    paint(levels);
    (function tick() {
      if (!el.isConnected || !auto) return;
      levels = levels.map((l) => Math.max(4, Math.min(100, l + rand(-22, 24))));
      paint(levels);
      setTimeout(tick, rand(90, 160));
    })();
    const api = { set(vals) { auto = false; paint(vals); } };
    el.wonkVu = api;
    return api;
  }

  // ---- knob ----
  // <div data-wonk-knob data-label="drive" data-min="0" data-max="11" data-value="7"
  //      data-step="1" data-unit="db"></div>
  // Precision rotary control. Drag vertically, arrow/Home/End/PageUp/PageDown
  // keys, or click the number to type an exact value (Enter commits, Escape
  // cancels). Fires "input" while the value is moving and "change" once a
  // gesture commits (mirrors native range inputs). Disable with the standard
  // `disabled` attribute or property; a disabled knob ignores all input.
  // Returns {get value(), set(v, opts), destroy()}; also stored on
  // el.wonkKnob. Calling knob(el) twice on the same element is a no-op that
  // returns the existing API (idempotent wiring) -- use the returned
  // .set()/.destroy() instead of re-wiring an already-wired knob.
  // Full contract, copy recipes, and data-tool mapping: references/instruments.md.
  function knob(el) {
    if (el.wonkKnob) return el.wonkKnob;

    // validate config up front -- a knob with an inverted or zero range has
    // no sane geometry, and silently "fixing" it (e.g. swapping min/max)
    // would hide a real bug in whoever configured this element. fail loud.
    const rawMin = Number(el.dataset.min ?? 0);
    const rawMax = Number(el.dataset.max ?? 100);
    const rawStep = el.dataset.step === undefined ? 1 : Number(el.dataset.step);
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax) || rawMin >= rawMax) {
      throw new Error(
        `wonk.knob: data-min (${el.dataset.min}) and data-max (${el.dataset.max}) must be finite numbers with min < max`
      );
    }
    if (!Number.isFinite(rawStep) || rawStep <= 0) {
      throw new Error(`wonk.knob: data-step (${el.dataset.step}) must be a finite number > 0`);
    }
    const min = rawMin;
    const max = rawMax;
    const step = rawStep;
    const unit = el.dataset.unit || "";
    const label = el.dataset.label || "";
    const precision = (n) => {
      const [coefficient, exponent = "0"] = String(n).split("e");
      return Math.max(0, (coefficient.split(".")[1]?.length || 0) - Number(exponent));
    };
    const decimals = Math.min(10, Math.max(precision(step), precision(min)));
    const clamp = (v) => Math.max(min, Math.min(max, v));
    const snap = (v) => {
      const snapped = Math.round((v - min) / step) * step + min;
      return clamp(parseFloat(snapped.toFixed(10)));
    };
    const fmt = (v) => v.toFixed(decimals);

    const rawValue = el.dataset.value === undefined ? (min + max) / 2 : Number(el.dataset.value);
    if (!Number.isFinite(rawValue)) {
      throw new Error(`wonk.knob: data-value (${el.dataset.value}) must be a finite number`);
    }
    let val = snap(rawValue);
    let disabled = el.hasAttribute("disabled") || el.dataset.disabled === "true";

    el.classList.add("wonk-knob");
    el.replaceChildren();

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "56");
    svg.setAttribute("height", "56");
    svg.setAttribute("viewBox", "0 0 56 56");
    svg.setAttribute("role", "slider");
    svg.setAttribute("tabindex", disabled ? "-1" : "0");
    svg.setAttribute("aria-label", label);
    svg.setAttribute("aria-orientation", "vertical");
    svg.setAttribute("aria-valuemin", String(min));
    svg.setAttribute("aria-valuemax", String(max));
    svg.style.touchAction = "none"; // vertical drag must not also scroll the page
    svg.innerHTML =
      `<circle cx="28" cy="28" r="24" fill="var(--ak-surface)" stroke="var(--ak-hairline-strong)"/>` +
      `<line x1="28" y1="47" x2="28" y2="52" stroke="var(--ak-hairline-strong)" transform="rotate(-135 28 28)"/>` +
      `<line x1="28" y1="47" x2="28" y2="52" stroke="var(--ak-hairline-strong)" transform="rotate(135 28 28)"/>` +
      `<line class="ptr" x1="28" y1="28" x2="28" y2="9" stroke="var(--ak-a1)" stroke-width="2.5" stroke-linecap="round"/>`;

    const out = document.createElement("span");
    out.className = "val-wrap";
    const num = document.createElement("span");
    num.className = "val wonk-num";
    num.tabIndex = disabled ? -1 : 0;
    num.setAttribute("role", "button");
    num.setAttribute("aria-label", `edit ${label || "value"} exactly`);
    const unitEl = document.createElement("span");
    unitEl.className = "unit wonk-label";
    unitEl.textContent = unit;
    unitEl.setAttribute("aria-hidden", "true");
    out.append(num, unitEl);

    const lbl = document.createElement("span");
    lbl.className = "lbl wonk-label";
    lbl.textContent = label;

    el.append(svg, out, lbl);

    const ptr = svg.querySelector(".ptr");

    const paintDisabled = () => {
      el.classList.toggle("is-disabled", disabled);
      svg.setAttribute("aria-disabled", String(disabled));
      svg.setAttribute("tabindex", disabled ? "-1" : "0");
      num.tabIndex = disabled ? -1 : 0;
    };
    paintDisabled();

    const render = () => {
      const frac = (val - min) / (max - min);
      ptr.setAttribute("transform", `rotate(${-135 + frac * 270} 28 28)`);
      svg.setAttribute("aria-valuenow", fmt(val));
      svg.setAttribute("aria-valuetext", unit ? `${fmt(val)} ${unit}` : fmt(val));
      num.textContent = fmt(val);
    };
    render();

    const emit = (type) =>
      el.dispatchEvent(new CustomEvent(type, { detail: { value: val }, bubbles: true }));

    // set(v): programmatic update. Emits "input" only (never "change") unless
    // opts.commit is true, matching how a caller resets state vs. a user
    // committing a gesture. throws on a non-numeric v instead of silently
    // ignoring it -- a caller passing garbage has a bug worth surfacing,
    // not a value worth swallowing.
    function set(v, opts = {}) {
      const parsed = v === "" || v === null ? NaN : Number(v);
      if (!Number.isFinite(parsed)) {
        throw new Error(`wonk.knob.set: value (${v}) must be a finite number`);
      }
      const next = snap(parsed);
      const changed = next !== val;
      val = next;
      render();
      if (changed || opts.force) {
        emit("input");
        if (opts.commit) emit("change");
      }
    }

    let fromY = null, fromVal = 0, dragged = false;

    const onPointerDown = (e) => {
      if (disabled || e.button !== 0 || fromY !== null) return;
      svg.setPointerCapture(e.pointerId);
      svg.focus();
      fromY = e.clientY; fromVal = val; dragged = false;
    };
    const onPointerMove = (e) => {
      if (fromY === null || disabled) return;
      dragged = true;
      const next = clamp(fromVal + ((fromY - e.clientY) / 100) * (max - min));
      val = snap(next);
      render();
      emit("input");
    };
    // pointerup is a real commit (the user released a completed drag) --
    // fire "change" to commit the draft. Expensive work needs explicit Run.
    // pointercancel is NOT a commit (touch scroll takeover, alt-tab,
    // browser-initiated interruption): the gesture never resolved, so it
    // must never fire "change" -- only "input" already fired during the
    // move. otherwise an interrupted, accidental drag could trigger the
    // same expensive query a real release would.
    const settleDrag = (commit) => (e) => {
      if (fromY === null) return;
      fromY = null;
      if (typeof e?.pointerId === "number" && svg.hasPointerCapture?.(e.pointerId)) {
        svg.releasePointerCapture(e.pointerId);
      }
      if (dragged && commit) emit("change");
      dragged = false;
    };
    const onPointerUp = settleDrag(true);
    const onPointerCancel = settleDrag(false);

    const onKeydown = (e) => {
      if (disabled) return;
      const big = step * 10 || (max - min) / 10;
      let next = null;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") next = val + step;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = val - step;
      else if (e.key === "PageUp") next = val + big;
      else if (e.key === "PageDown") next = val - big;
      else if (e.key === "Home") next = min;
      else if (e.key === "End") next = max;
      if (next === null) return;
      e.preventDefault();
      const snapped = snap(next);
      const changed = snapped !== val;
      val = snapped;
      render();
      if (changed) { emit("input"); emit("change"); }
    };

    // exact numeric entry: click/Enter/Space on the number swaps it for a
    // real <input type=number> so typing, paste, and screen readers all work.
    let editing = false;
    const startEdit = () => {
      if (disabled || editing) return;
      editing = true;
      const input = document.createElement("input");
      input.type = "number";
      input.className = "val-edit";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = fmt(val);
      input.setAttribute("aria-label", `${label || "value"} exact input`);
      out.replaceChild(input, num);
      input.focus();
      input.select();

      input.required = true;
      const finish = (commit, restoreFocus = false) => {
        if (!editing) return;
        if (commit && !disabled && !input.checkValidity()) {
          input.reportValidity();
          return;
        }
        editing = false;
        if (commit && !disabled) set(input.valueAsNumber, { commit: true });
        out.replaceChild(num, input);
        if (restoreFocus) num.focus();
      };
      // this is a plain number input for typing/paste/screen-reader support,
      // not the control's public API -- stop its native input/change from
      // bubbling onto el, where they'd be mistaken for the knob's own
      // custom events (set() above fires the real ones once committed).
      input.addEventListener("input", (e) => e.stopPropagation());
      input.addEventListener("change", (e) => e.stopPropagation());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); finish(true, true); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false, true); }
      });
      input.addEventListener("blur", () => finish(true));
    };
    const onNumClick = () => startEdit();
    const onNumKeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); }
    };

    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerCancel);
    svg.addEventListener("keydown", onKeydown);
    num.addEventListener("click", onNumClick);
    num.addEventListener("keydown", onNumKeydown);

    const api = {
      get value() { return val; },
      set,
      get disabled() { return disabled; },
      set disabled(v) { disabled = !!v; paintDisabled(); },
      destroy() {
        svg.removeEventListener("pointerdown", onPointerDown);
        svg.removeEventListener("pointermove", onPointerMove);
        svg.removeEventListener("pointerup", onPointerUp);
        svg.removeEventListener("pointercancel", onPointerCancel);
        svg.removeEventListener("keydown", onKeydown);
        num.removeEventListener("click", onNumClick);
        num.removeEventListener("keydown", onNumKeydown);
        delete el.wonkKnob;
      },
    };
    el.wonkKnob = api;
    return api;
  }

  // ---- oscilloscope ----
  // <div data-wonk-scope></div> -> animated trace over a hairline grid.
  // Decoration for brand corners and loading walls; reduced motion gets one
  // static frame.
  function scopeWidget(el) {
    el.classList.add("wonk-scope");
    el.setAttribute("aria-hidden", "true");
    const c = document.createElement("canvas");
    el.replaceChildren(c);
    const ctx = c.getContext("2d");
    let t = rand(0, 100);
    const frame = () => {
      const w = (c.width = c.clientWidth || 300);
      const h = (c.height = c.clientHeight || 120);
      const css = getComputedStyle(document.documentElement);
      const grid = css.getPropertyValue("--ak-hairline").trim();
      const trace = css.getPropertyValue("--ak-a1-text").trim();
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = trace;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y =
          h / 2 +
          Math.sin(x * 0.045 + t) * (h * 0.28) * Math.sin(t * 0.31 + x * 0.003) +
          Math.sin(x * 0.21 - t * 1.7) * 4;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    if (REDUCED) { frame(); return; }
    (function loop() {
      if (!el.isConnected) return;
      t += 0.045;
      frame();
      requestAnimationFrame(loop);
    })();
  }

  // ---- toast ----
  // wonk.toast("Deployed", "ok" | "warn" | "err" | "info")
  function toast(msg, kind = "info", ms = 3500) {
    let host = document.querySelector(".wonk-toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "wonk-toasts";
      document.body.appendChild(host);
    }
    const t = document.createElement("div");
    t.className = `wonk-toast wonk-toast--${kind}`;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity 250ms, transform 250ms";
      t.style.opacity = "0";
      t.style.transform = "translateX(20px)";
      setTimeout(() => t.remove(), 260);
    }, ms);
    return t;
  }

  // ---- tabs ----
  // Markup: .wonk-tabs > button.wonk-tab[data-panel="#id"]
  function tabs(root) {
    if (root.dataset.wonkWired) return;
    root.dataset.wonkWired = "1";
    const btns = [...root.querySelectorAll(".wonk-tab")];
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        btns.forEach((x) => {
          x.setAttribute("aria-selected", x === b);
          const p = document.querySelector(x.dataset.panel || "");
          if (p) p.hidden = x !== b;
        });
      })
    );
  }

  // ---- theme + pair helpers ----
  const setPair = (name) => document.documentElement.setAttribute("data-pair", name);
  const setTheme = (name) =>
    name === "paper"
      ? document.documentElement.setAttribute("data-theme", "paper")
      : document.documentElement.removeAttribute("data-theme");

  // ---- hidden puzzle slot ----
  // Give any element [data-wonk-secret="<message>"]. Seven rapid clicks reveal it.
  // (aktunes idiom: there is always a reward for whoever bothers to look.)
  function secret(el) {
    let clicks = 0, timer = null;
    el.addEventListener("click", () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => (clicks = 0), 800);
      if (clicks >= 7) {
        clicks = 0;
        toast(el.dataset.wonkSecret || "oh... interesting", "info", 6000);
      }
    });
  }

  // ---- auto-wire ----
  function init(scope = document) {
    scope.querySelectorAll("[data-wonk-live]").forEach(live);
    scope.querySelectorAll("[data-wonk-glyph]").forEach(glyph);
    scope.querySelectorAll("[data-wonk-scatter]").forEach(scatter);
    scope.querySelectorAll("[data-wonk-vu]").forEach(vu);
    scope.querySelectorAll("[data-wonk-knob]").forEach(knob);
    scope.querySelectorAll("[data-wonk-scope]").forEach(scopeWidget);
    scope.querySelectorAll(".wonk-tabs").forEach(tabs);
    scope.querySelectorAll("[data-wonk-secret]").forEach(secret);
    reveal(scope);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  window.wonk = {
    toast, live, glyph, tabs, setPair, setTheme, init, reveal, spark, scatter,
    vu, knob, scope: scopeWidget,
  };
})();
