/* ============================================================
   WONK v0.2.0 · wonk.js · behaviors for the WONK design system
   Dependency-free. Safe to load once per page.
   Everything respects prefers-reduced-motion.
   ============================================================ */
(() => {
  "use strict";

  // live, not read once: the OS preference can flip mid-session
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => mql.matches;
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

  // ---- idempotent wiring + reduced-motion registry ----
  // Every helper wires an element at most once (per-helper WeakMap/
  // WeakSet), so wonk.init(scope) is safe to call repeatedly on the same
  // subtree. Every decorative loop registers {el, start, stop} here;
  // when reduced motion turns on mid-session the running loops stop,
  // and when it turns off the still-connected ones resume. start() and
  // stop() are themselves idempotent.
  const WIRED = {
    live: new WeakMap(),
    glyph: new WeakMap(),
    scatter: new WeakSet(),
    vu: new WeakMap(),
    scope: new WeakMap(),
    secret: new WeakSet(),
    menu: new WeakSet(),
    themeToggle: new WeakSet(),
    drawer: new WeakSet(),
  };
  const decorations = new Set();
  // register a decoration and start it unless reduced motion is on. Also
  // used on a repeat call for an already-wired element: a loop drops
  // itself from the registry when its element leaves the DOM, so this
  // re-registers it; a still-running loop ignores start().
  function engage(d) {
    decorations.add(d);
    if (!reduced()) d.start();
  }
  // a loop whose element left the DOM stops and leaves the registry
  const retire = (d) => { d.stop(); decorations.delete(d); };
  mql.addEventListener("change", () => {
    decorations.forEach((d) => {
      if (!d.el.isConnected) retire(d);
      else if (reduced()) d.stop();
      else d.start();
    });
  });

  // ---- irregular live jitter ----
  // The WONK signature: bursts of 100-180ms blinks, then a rest.
  // Apply to any element with [data-wonk-live].
  function live(el) {
    const known = WIRED.live.get(el);
    if (known) { engage(known); return; }
    let on = true, timer = null, running = false;
    const d = {
      el,
      start() {
        if (running) return;
        running = true;
        el.style.animation = "none"; // take over from the CSS fallback
        (function tick() {
          if (!running) return;
          if (!el.isConnected) { retire(d); return; }
          on = !on;
          el.style.opacity = on ? 1 : 0.15;
          const burst = Math.random() < 0.7;
          timer = setTimeout(tick, burst ? rand(100, 180) : rand(600, 1500));
        })();
      },
      stop() {
        if (!running) return;
        running = false;
        clearTimeout(timer);
        el.style.opacity = "";
        el.style.animation = ""; // hand back to the CSS fallback
      },
    };
    WIRED.live.set(el, d);
    engage(d);
  }

  // ---- glyph morph ----
  // Slow cycle through glyphs + token colors; strobes on hover.
  // Apply to any element with [data-wonk-glyph].
  const GLYPHS = ["∿", "⌁", "♪", "⚙", "λ", "⌥", "∫", "⧉", "♭", "№", "⚡", "✄"];
  function glyph(el) {
    const known = WIRED.glyph.get(el);
    if (known) { engage(known); return; }
    let slow = null, strobe = null, running = false;
    const paint = () => {
      // read tokens live: pair/theme can change under us
      const colors = ["--ak-a1-text", "--ak-a2-text", "--ak-ok", "--ak-warn", "--ak-info"]
        .map(token)
        .filter(Boolean);
      el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      if (colors.length) el.style.color = colors[Math.floor(Math.random() * colors.length)];
      if (!reduced()) {
        el.style.display = "inline-block";
        el.style.transition = "transform 250ms cubic-bezier(.2,.9,.25,1.05)";
        el.style.transform = `scale(${rand(0.92, 1.12)}) rotate(${rand(-8, 8)}deg)`;
        setTimeout(() => { el.style.transform = "none"; }, 260);
      }
    };
    // timer callback: a removed element stops cycling instead of
    // swapping forever in the background
    const swap = () => {
      if (!el.isConnected) { retire(d); return; }
      paint();
    };
    if (reduced()) paint();
    const d = {
      el,
      start() {
        if (running) return;
        running = true;
        slow = setInterval(swap, 1500);
      },
      stop() {
        running = false;
        clearInterval(slow);
        clearTimeout(strobe);
      },
    };
    WIRED.glyph.set(el, d);
    engage(d);
    el.addEventListener("mouseenter", () => {
      if (!running) return;
      clearInterval(slow);
      clearTimeout(strobe);
      (function s() { swap(); if (running) strobe = setTimeout(s, rand(100, 180)); })();
    });
    el.addEventListener("mouseleave", () => {
      if (!running) return;
      clearTimeout(strobe);
      clearInterval(slow);
      slow = setInterval(swap, 1500);
    });
  }

  // ---- type scatter ----
  // Letters spring apart on hover, spring back on leave.
  // Apply to short display text with [data-wonk-scatter]. One per view.
  function scatter(el) {
    if (WIRED.scatter.has(el)) return;
    if (reduced()) return;
    WIRED.scatter.add(el);
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
    el.addEventListener("mouseenter", () => {
      if (reduced()) return;
      spans.forEach((s) => {
        s.style.transform =
          `translate(${rand(-6, 6)}px, ${rand(-10, 10)}px) rotate(${rand(-14, 14)}deg)`;
      });
    });
    el.addEventListener("mouseleave", () =>
      spans.forEach((s) => (s.style.transform = "none"))
    );
  }

  // ---- scroll reveal ----
  // Elements with .wonk-reveal fade/slide in when they enter the viewport.
  // CSS hides only elements this function has armed (.is-armed), so a
  // no-JS page, or an element JS never saw, stays visible. Each element
  // is armed at most once. A MutationObserver (watchInjected, below) arms
  // .wonk-reveal elements injected after init.
  const REVEAL_SEL = ".wonk-reveal:not(.is-in):not(.is-armed)";
  let revealIO = null;
  function reveal(scope = document) {
    const els = [...scope.querySelectorAll(REVEAL_SEL)];
    if (scope.matches && scope.matches(REVEAL_SEL)) els.unshift(scope);
    if (!els.length) return;
    if (reduced() || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    revealIO = revealIO || new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            revealIO.unobserve(e.target);
          }
        }),
      { threshold: 0.08 }
    );
    els.forEach((e) => {
      e.classList.add("is-armed");
      revealIO.observe(e);
    });
  }
  // one observer for the page; added subtrees are batched and passed to
  // reveal() and focusTips() at most once per animation frame (before
  // that frame paints). Removals drop a hint whose target left the DOM.
  // Keyed folds are restored at once, in the observer callback: a
  // <details open> inserted by a render queues a toggle event, and that
  // event must see the remembered state, not the rendered default.
  function watchInjected() {
    if (!("MutationObserver" in window)) return;
    const added = new Set();
    let queued = false;
    new MutationObserver((records) => {
      const fresh = [];
      records.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) { added.add(n); fresh.push(n); } }));
      if (foldState.size) fresh.forEach((n) => { if (n.isConnected) restoreFolds(n); });
      pruneHint();
      if (!added.size || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const nodes = [...added];
        added.clear();
        nodes.forEach((n) => {
          if (!n.isConnected) return;
          reveal(n);
          focusTips(n);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---- sparkline ----
  // wonk.spark(el, values, {stroke, dot, w, h}) -> inline SVG trend.
  // No axes, no labels: a spark is a shape, not a chart. For anything the
  // reader must decode precisely, use a real Plot chart (references/charts.md).
  // Missing values (null, "", NaN, +-Infinity) are dropped, never
  // plotted as 0. No values -> the element is emptied; one value -> a
  // single centered dot.
  function spark(el, values, opts = {}) {
    const w = opts.w || 120, h = opts.h || 32, pad = 3;
    const vals = Array.from(values, (v) => (v === null || v === "" ? NaN : Number(v))).filter(Number.isFinite);
    if (!vals.length) { el.replaceChildren(); return; }
    const stroke = opts.stroke || token("--ak-chart-1") || "currentColor";
    const dot = opts.dot || token("--ak-chart-2") || stroke;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const pts = vals.length === 1
      ? [[w / 2, h / 2]]
      : vals.map((v, i) => [
        pad + (i / (vals.length - 1)) * (w - pad * 2),
        h - pad - ((v - min) / span) * (h - pad * 2),
      ]);
    const last = pts[pts.length - 1];
    const line = pts.length > 1
      ? `<polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}"` +
        ` fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`
      : "";
    el.innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="display:inline-block;vertical-align:middle">` +
      line +
      `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${dot}"/></svg>`;
  }

  // ---- VU meter ----
  // <div data-wonk-vu="12"></div> -> animated level bars, WONK-irregular timing.
  // Decorative by default; call wonk.vu(el).set([0..100,...]) to drive it with
  // real values (it stops self-animating once you feed it).
  function vu(el) {
    const known = WIRED.vu.get(el);
    if (known) { engage(known.d); return known.api; }
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
    let auto = true, running = false, timer = null;
    let levels = bars.map(() => rand(10, 60));
    paint(levels);
    const d = {
      el,
      start() {
        if (running || !auto) return;
        running = true;
        (function tick() {
          if (!running) return;
          if (!el.isConnected) { retire(d); return; }
          levels = levels.map((l) => Math.max(4, Math.min(100, l + rand(-22, 24))));
          paint(levels);
          timer = setTimeout(tick, rand(90, 160));
        })();
      },
      stop() {
        running = false;
        clearTimeout(timer);
      },
    };
    const api = { set(vals) { auto = false; retire(d); paint(vals); } };
    WIRED.vu.set(el, { d, api });
    engage(d);
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
    const known = WIRED.scope.get(el);
    if (known) { engage(known); return; }
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
    // reduced motion (now or later) gets one static frame, no loop
    let running = false, raf = 0;
    if (reduced()) frame();
    const d = {
      el,
      start() {
        if (running) return;
        running = true;
        (function loop() {
          if (!running) return;
          if (!el.isConnected) { retire(d); return; }
          t += 0.045;
          frame();
          raf = requestAnimationFrame(loop);
        })();
      },
      stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
        if (el.isConnected) frame();
      },
    };
    WIRED.scope.set(el, d);
    engage(d);
  }

  // ---- toast ----
  // wonk.toast("Deployed", "ok" | "warn" | "err" | "info") -> the toast element
  // The host is a polite status live region; an err toast is also
  // role=alert. Each toast has a Dismiss button; hover or focus inside
  // it pauses its timer. A modal <dialog> makes everything outside it
  // inert, so while one is open the host moves inside it (and back to
  // <body> when it closes) so the toast stays visible and announced.
  const MODAL_SELECTOR = CSS.supports("selector(:modal)");
  const topModal = () =>
    MODAL_SELECTOR
      ? [...document.querySelectorAll("dialog[open]")].filter((d) => d.matches(":modal")).pop() || null
      : null;
  function toastHost() {
    let host = document.querySelector(".wonk-toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "wonk-toasts";
    }
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    const modal = topModal();
    const container = modal || document.body;
    if (host.parentNode !== container) {
      container.appendChild(host);
      if (modal) {
        modal.addEventListener("close", () => {
          if (host.parentNode === modal) document.body.appendChild(host);
        }, { once: true });
      }
    }
    return host;
  }
  function toast(msg, kind = "info", ms = 3500) {
    const host = toastHost();
    const t = document.createElement("div");
    t.className = `wonk-toast wonk-toast--${kind}`;
    if (kind === "err") t.setAttribute("role", "alert");
    t.textContent = msg;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "wonk-toast-x";
    x.setAttribute("aria-label", "Dismiss"); // the x glyph is CSS content
    t.appendChild(x);
    host.appendChild(t);

    let timer = null, left = ms, since = 0, hover = false, focus = false;
    const fade = () => {
      t.style.transition = "opacity 250ms, transform 250ms";
      t.style.opacity = "0";
      t.style.transform = "translateX(20px)";
      setTimeout(() => t.remove(), 260);
    };
    const run = () => { since = Date.now(); timer = setTimeout(fade, left); };
    const hold = () => { clearTimeout(timer); timer = null; left -= Date.now() - since; };
    const sync = () => {
      const paused = hover || focus;
      if (paused && timer !== null) hold();
      else if (!paused && timer === null) run();
    };
    t.addEventListener("mouseenter", () => { hover = true; sync(); });
    t.addEventListener("mouseleave", () => { hover = false; sync(); });
    t.addEventListener("focusin", () => { focus = true; sync(); });
    t.addEventListener("focusout", (e) => { focus = t.contains(e.relatedTarget); sync(); });
    x.addEventListener("click", () => { clearTimeout(timer); t.remove(); });
    run();
    return t;
  }

  // ---- hints: data-tip, .wonk-term, wonk.tip ----
  // The one way to do help text. Markup: [data-tip="text"] on anything
  // ([data-hint] is an alias), .wonk-term[data-term="key"] resolved from
  // wonk.glossary(), and a focused form control shows its <label>'s tip.
  // Document-level delegation, no per-element wiring:
  //  - one visual box, div.wonk-hint (aria-hidden), in <body> or inside
  //    the open modal dialog (same rule as toasts). position: fixed,
  //    centered below its target, flips above when it would overflow,
  //    8px from the viewport edges; follows resizes.
  //  - hover shows after 50ms; focus and a touch/pen tap show at once.
  //    Leaving the target starts a 150ms grace timer and entering the
  //    box cancels it (hoverable). When it runs out, the focused
  //    control's tip comes back, else the box hides. Escape hides it. A
  //    scroll hides it; a focus tip follows its control instead.
  //  - screen readers: on focus the text goes into the visually hidden
  //    #wonk-hint-sr, and "wonk-hint-sr" is appended to the control's
  //    aria-describedby (the page's own tokens stay; blur removes only
  //    ours). Pointer movement never changes the description.
  //  - wonk.tip(root, selector, render): rich tips. render(el) returns a
  //    Node (built with DOM APIs) or a string (shown as text, never
  //    parsed as HTML). Same box and rules.
  const TIP_SEL = "[data-tip], [data-hint], [data-term]";
  const SR_ID = "wonk-hint-sr";
  const SR_ONLY = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;";
  const HOVER_DELAY = 50, GRACE = 150, EDGE = 8, GAP = 6;
  const glossaryMap = Object.create(null);
  const warnedTerms = new Set();
  const tipRegs = [];
  let hintBox = null, hintSr = null;
  let shown = null, shownBy = null; // tip in the box: {el, anchor, text | reg}; "hover" | "touch" | "focus" | "api"
  let srFor = null, srReg = null;   // control described by #wonk-hint-sr, and the rich tip it came from
  let escaped = null;               // tip closed with Escape: hover leaves it closed until the pointer moves on
  let hoverTimer = null, graceTimer = null;

  // wonk.glossary({ term: "definition" }) merges; returns the current map
  function glossary(map) {
    if (map !== undefined) {
      if (map === null || typeof map !== "object") {
        throw new TypeError("wonk.glossary(map): map must be an object of term -> definition strings");
      }
      const entries = Object.entries(map);
      entries.forEach(([term, def]) => {
        if (typeof def !== "string") {
          throw new TypeError(`wonk.glossary: the definition for "${term}" must be a string, got ${typeof def}`);
        }
      });
      entries.forEach(([term, def]) => { glossaryMap[term] = def; });
    }
    return { ...glossaryMap };
  }

  // the plain tip text of one element, or null. An unknown data-term
  // has no tip and warns once per term.
  function tipText(el) {
    const text = el.getAttribute("data-tip") || el.getAttribute("data-hint");
    if (text) return text;
    const term = el.getAttribute("data-term");
    if (term === null) return null;
    if (term in glossaryMap) return glossaryMap[term] || null;
    if (!warnedTerms.has(term)) {
      warnedTerms.add(term);
      console.warn(`wonk.hint: no glossary entry for data-term=${JSON.stringify(term)}; add it with wonk.glossary({ ${JSON.stringify(term)}: "definition" })`);
    }
    return null;
  }

  // the tip for a node: the nearest ancestor with a rich tip, a
  // data-tip/data-hint, or a known data-term. With labels, a form
  // control falls back to its first <label> with a tip (the box then
  // sits under the control). Returns {el, anchor, text | reg} or null.
  function tipFor(node, labels) {
    const start = node && (node.nodeType === 1 ? node : node.parentElement);
    for (let el = start; el; el = el.parentElement) {
      if (hintBox && hintBox.contains(el)) return null;
      for (const reg of tipRegs) {
        if (reg.root.contains(el) && el.matches(reg.selector)) return { el, anchor: el, reg };
      }
      if (el.matches(TIP_SEL)) {
        const text = tipText(el);
        if (text) return { el, anchor: el, text };
      }
    }
    if (labels && start && start.labels) {
      for (const label of start.labels) {
        const text = label.matches(TIP_SEL) && tipText(label);
        if (text) return { el: label, anchor: start, text };
      }
    }
    return null;
  }

  // create the box and the screen-reader node once, and keep both in
  // <body>, or inside the open modal dialog so neither is inert or
  // hidden behind the top layer
  function hintHome() {
    if (!hintBox) {
      hintBox = document.createElement("div");
      hintBox.className = "wonk-hint";
      hintBox.setAttribute("aria-hidden", "true");
      hintBox.hidden = true;
      hintSr = document.createElement("div");
      hintSr.id = SR_ID;
      hintSr.style.cssText = SR_ONLY;
    }
    const home = topModal() || document.body;
    if (hintBox.parentNode !== home) home.appendChild(hintBox);
    if (hintSr.parentNode !== home) home.appendChild(hintSr);
    return home;
  }

  const hintOpen = () => !!hintBox && !hintBox.hidden;
  const stopTimers = () => {
    clearTimeout(hoverTimer);
    clearTimeout(graceTimer);
    hoverTimer = graceTimer = null;
  };

  function hideHint() {
    stopTimers();
    if (hintBox) {
      hintBox.hidden = true;
      hintBox.replaceChildren();
    }
    shown = shownBy = null;
  }

  // centered below the anchor, above when below would overflow and
  // above fits (or has more room), then clamped EDGE px inside the
  // viewport
  function placeHint() {
    if (!hintOpen() || !shown) return;
    if (!shown.anchor.isConnected) { hideHint(); return; }
    const s = hintBox.style;
    s.left = "0px";
    s.top = "0px";
    // at 0,0 the box has its natural size, and its rect shows where its
    // containing block starts (not 0,0 only under a transformed ancestor)
    const o = hintBox.getBoundingClientRect();
    const a = shown.anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const left = Math.max(EDGE, Math.min(a.left + a.width / 2 - o.width / 2, vw - EDGE - o.width));
    let top = a.bottom + GAP;
    const above = a.top - GAP - o.height;
    if (top + o.height > vh - EDGE && (above >= EDGE || a.top > vh - a.bottom)) top = above;
    top = Math.max(EDGE, Math.min(top, vh - EDGE - o.height));
    s.left = `${left - o.left}px`;
    s.top = `${top - o.top}px`;
  }

  // show a resolved tip at once; returns the text now in the box ("" if
  // the tip rendered nothing)
  function showTip(tip, by) {
    stopTimers();
    const content = tip.reg ? tip.reg.render(tip.el) : tip.text;
    if (content === null || content === undefined || content === "") { hideHint(); return ""; }
    hintHome();
    if (typeof content === "object" && typeof content.nodeType === "number") hintBox.replaceChildren(content);
    else hintBox.textContent = String(content);
    hintBox.hidden = false;
    shown = tip;
    shownBy = by;
    escaped = null;
    placeHint();
    return hintBox.textContent;
  }

  function describe(control, text, reg) {
    undescribe();
    if (!text) return;
    hintHome();
    hintSr.textContent = text;
    const ids = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    if (!ids.includes(SR_ID)) ids.push(SR_ID);
    control.setAttribute("aria-describedby", ids.join(" "));
    srFor = control;
    srReg = reg || null;
  }
  function undescribe() {
    if (srFor) {
      const ids = (srFor.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== SR_ID);
      if (ids.length) srFor.setAttribute("aria-describedby", ids.join(" "));
      else srFor.removeAttribute("aria-describedby");
    }
    srFor = srReg = null;
    if (hintSr) hintSr.textContent = "";
  }

  // the grace timer ran out: the focused control's tip comes back, else
  // the box hides
  function settleHint() {
    graceTimer = null;
    const tip = srFor ? tipFor(srFor, true) : null;
    if (!tip) hideHint();
    else if (!hintOpen() || !shown || tip.el !== shown.el) showTip(tip, "focus");
  }

  // a removed target takes its box and its description with it
  function pruneHint() {
    if (shown && (!shown.el.isConnected || !shown.anchor.isConnected)) hideHint();
    if (srFor && !srFor.isConnected) undescribe();
  }

  document.addEventListener("mouseover", (e) => {
    if (hintBox && hintBox.contains(e.target)) { clearTimeout(graceTimer); graceTimer = null; return; }
    const tip = tipFor(e.target, false);
    if (!tip || tip.el !== escaped) escaped = null;
    if (!tip) { clearTimeout(hoverTimer); hoverTimer = null; return; }
    if (tip.el === escaped) return;
    if (hintOpen() && shown && tip.el === shown.el) { stopTimers(); return; }
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showTip(tip, "hover"), HOVER_DELAY);
  }, true);

  document.addEventListener("mouseout", (e) => {
    const to = e.relatedTarget;
    if (!to) { clearTimeout(hoverTimer); hoverTimer = null; } // the pointer left the page
    if (!hintOpen() || !shown || shownBy === "focus") return;
    const from = e.target;
    if (!shown.el.contains(from) && !hintBox.contains(from)) return;
    if (to && (shown.el.contains(to) || hintBox.contains(to))) return;
    clearTimeout(graceTimer);
    graceTimer = setTimeout(settleHint, GRACE);
  }, true);

  // touch and pen: iOS sends no mouseover to plain text, but pointer
  // events reach every element. The tap's click still fires.
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    if (hintBox && hintBox.contains(e.target)) return;
    const tip = tipFor(e.target, false);
    if (tip) showTip(tip, "touch");
    else if (hintOpen()) hideHint();
  }, true);

  document.addEventListener("focusin", (e) => {
    if (hintBox && hintBox.contains(e.target)) return;
    const tip = tipFor(e.target, true);
    if (!tip) {
      undescribe();
      if (hintOpen()) hideHint();
      return;
    }
    describe(e.target, showTip(tip, "focus"), tip.reg);
  }, true);

  document.addEventListener("focusout", (e) => {
    if (srFor === e.target) undescribe();
    if (shownBy === "focus" && shown && (shown.el.contains(e.target) || shown.anchor === e.target)) hideHint();
  }, true);

  // Escape closes the box; the description stays while focus stays
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !hintOpen()) return;
    escaped = shown && shown.el;
    hideHint();
  }, true);

  // position: fixed would leave the box behind a scrolled target. A focus
  // tip follows its control (focusing an off-screen control scrolls it
  // into view) and closes once the control leaves the viewport.
  window.addEventListener("scroll", () => {
    if (!hintOpen()) return;
    if (shownBy !== "focus" || !shown) { hideHint(); return; }
    const a = shown.anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    if (a.bottom < 0 || a.top > vh || a.right < 0 || a.left > vw) hideHint();
    else placeHint();
  }, true);
  window.addEventListener("resize", placeHint);
  // an ancestor that finished moving carried the target with it: place
  // again. Covers a scroll reveal sliding in, and a modal's open
  // animation (its transform makes the dialog the box's containing
  // block until it ends).
  const replaceHint = (e) => {
    if (hintOpen() && shown && e.target.contains && e.target.contains(shown.anchor)) placeHint();
  };
  document.addEventListener("transitionend", replaceHint, true);
  document.addEventListener("animationend", replaceHint, true);

  // keyboard reach: .wonk-term and tip elements that cannot take focus
  // get tabindex="0", except inside an interactive element (no nested
  // tab stops), inside a tbody (per-row repeats rely on their column
  // header's tip), a <label> of a control (the control's focus shows
  // it), an author-set tabindex, or data-tip-focus="off"
  const FOCUS_SEL = `.wonk-term, ${TIP_SEL}`;
  const NATIVE_FOCUS =
    "a[href], area[href], button, input, select, textarea, iframe, summary, audio[controls], video[controls], " +
    "[contenteditable]:not([contenteditable='false'])";
  const INTERACTIVE =
    `${NATIVE_FOCUS}, [role='button'], [role='link'], [role='tab'], [role='menuitem'], ` +
    "[role='option'], [role='checkbox'], [role='switch'], [role='slider']";
  function focusTips(scope = document) {
    const els = [...scope.querySelectorAll(FOCUS_SEL)];
    if (scope.matches && scope.matches(FOCUS_SEL)) els.unshift(scope);
    els.forEach((el) => {
      if (el.hasAttribute("tabindex") || el.getAttribute("data-tip-focus") === "off") return;
      if (el.matches(NATIVE_FOCUS) || (el.localName === "label" && el.control)) return;
      if (el.closest("tbody, .wonk-hint")) return;
      if (el.parentElement && el.parentElement.closest(INTERACTIVE)) return;
      el.setAttribute("tabindex", "0");
    });
  }

  // wonk.tip(root, selector, render) -> {destroy}. Scoped to root;
  // a second call with the same root and selector returns the same
  // handle (and uses the newer render). wonk.tip adds no tabindex: make
  // targets focusable yourself when keyboard users need them.
  function tip(root, selector, render) {
    if (!root || typeof root.contains !== "function" || typeof root.querySelector !== "function") {
      throw new TypeError("wonk.tip(root, selector, render): root must be an element or a document");
    }
    if (typeof selector !== "string" || !selector.trim()) {
      throw new TypeError("wonk.tip: selector must be a non-empty CSS selector string");
    }
    if (typeof render !== "function") {
      throw new TypeError("wonk.tip: render must be a function (el) => Node | string");
    }
    root.querySelector(selector); // an invalid selector throws here, not on every hover
    const known = tipRegs.find((r) => r.root === root && r.selector === selector);
    if (known) {
      known.render = render;
      return known.handle;
    }
    const reg = { root, selector, render };
    reg.handle = {
      destroy() {
        const i = tipRegs.indexOf(reg);
        if (i === -1) return;
        tipRegs.splice(i, 1);
        if (shown && shown.reg === reg) hideHint();
        if (srReg === reg) undescribe();
      },
    };
    tipRegs.push(reg);
    return reg.handle;
  }

  const hint = {
    // show el's tip (or its label's) now; returns false if el has none
    show(el) {
      const found = tipFor(el, true);
      if (!found) return false;
      showTip(found, "api");
      return hintOpen();
    },
    hide: hideHint,
  };

  // ---- menu ----
  // Markup: details.wonk-menu > summary + .menu > button|a
  // Works without JS (native <details>). This adds: choosing an item
  // closes the menu; Escape closes it and returns focus to the summary;
  // on open, a menu that would run off the viewport's right edge gets
  // .wonk-menu--end (right-aligned). An author-set .wonk-menu--end is
  // left alone.
  function menu(d) {
    if (WIRED.menu.has(d)) return;
    WIRED.menu.add(d);
    const summary = d.querySelector(":scope > summary");
    const panel = d.querySelector(":scope > .menu");
    const authorEnd = d.classList.contains("wonk-menu--end");
    d.addEventListener("click", (e) => {
      const item = e.target.closest("button, a");
      if (item && panel && panel.contains(item)) d.open = false;
    });
    d.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !d.open) return;
      e.preventDefault();
      e.stopPropagation(); // Escape here closes the menu, not an enclosing dialog
      d.open = false;
      if (summary) summary.focus();
    });
    d.addEventListener("toggle", () => {
      if (!d.open || !panel || authorEnd) return;
      d.classList.remove("wonk-menu--end");
      if (panel.getBoundingClientRect().right > document.documentElement.clientWidth) {
        d.classList.add("wonk-menu--end");
      }
    });
  }

  // ---- tabs ----
  // Markup: .wonk-tabs > button.wonk-tab[data-panel="#id"]
  // Adds the ARIA tabs pattern: tablist/tab/tabpanel roles, ids where
  // missing, aria-controls/aria-labelledby, roving tabindex, and
  // ArrowLeft/ArrowRight (wrapping), Home, End with automatic
  // activation. On wiring, the tab with aria-selected="true" (else the
  // first) is selected and only its panel is visible. A tab whose
  // data-panel is missing or matches nothing is skipped with a warning.
  let uid = 0;
  const ensureId = (el, prefix) => {
    if (el.id) return el.id;
    let id;
    do { id = `${prefix}-${++uid}`; } while (document.getElementById(id));
    el.id = id;
    return id;
  };
  const findPanel = (sel) => {
    if (!sel) return null;
    try { return document.querySelector(sel); } catch { return null; } // invalid selector: caller warns
  };
  function tabs(root) {
    if (root.dataset.wonkWired) return;
    root.dataset.wonkWired = "1";
    root.setAttribute("role", "tablist");
    const items = [];
    root.querySelectorAll(".wonk-tab").forEach((tab) => {
      const panel = findPanel(tab.dataset.panel);
      if (!panel) {
        console.warn(
          `wonk.tabs: skipped tab "${tab.textContent.trim()}": data-panel ${JSON.stringify(tab.dataset.panel ?? null)} does not match an element`
        );
        return;
      }
      tab.setAttribute("role", "tab");
      panel.setAttribute("role", "tabpanel");
      tab.setAttribute("aria-controls", ensureId(panel, "wonk-tabpanel"));
      panel.setAttribute("aria-labelledby", ensureId(tab, "wonk-tab"));
      items.push({ tab, panel });
    });
    if (!items.length) return;
    const select = (chosen, focus = false) => {
      items.forEach(({ tab, panel }) => {
        const on = tab === chosen;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        panel.hidden = !on;
      });
      if (focus) chosen.focus();
    };
    items.forEach(({ tab }, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        const last = items.length - 1;
        const to =
          e.key === "ArrowRight" ? (i === last ? 0 : i + 1) :
          e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) :
          e.key === "Home" ? 0 :
          e.key === "End" ? last : null;
        if (to === null) return;
        e.preventDefault();
        select(items[to].tab, true);
      });
    });
    const initial = items.find(({ tab }) => tab.getAttribute("aria-selected") === "true") || items[0];
    select(initial.tab);
  }

  // ---- disclosure: row toggles, foldAll, fold-all buttons, fold keys ----
  // Markup: button.wonk-row-toggle[aria-expanded][aria-controls="id"]
  // (the id names a tr.wonk-row-detail), [data-wonk-fold-all="open" |
  // "close"][data-target], and data-fold-key="..." on a <details> or a
  // row toggle. Document-level delegation, no per-element wiring:
  //  - a click on a row toggle flips its aria-expanded and the hidden
  //    attribute of the element(s) its aria-controls names. A missing
  //    target warns once per toggle and changes nothing.
  //  - wonk.foldAll(root, open) sets every <details> in root (root
  //    included, .wonk-menu popups excluded) and every row toggle in
  //    root. Returns how many changed.
  //  - a fold-all button folds document.querySelector(data-target), or,
  //    with no data-target, its closest section, article, or
  //    [data-fold-scope]. No match warns and changes nothing.
  //  - wonk.foldState is a Map (memory only) of data-fold-key -> open.
  //    A keyed <details> is recorded on toggle (capture phase: toggle
  //    does not bubble), a keyed row toggle on click and by foldAll.
  //    Keyed elements inserted later (the body observer) and those in
  //    wonk.init(scope) get their remembered state back.
  const foldState = new Map();
  const warnedRows = new WeakSet();
  const FOLD_KEY_SEL = "details[data-fold-key], .wonk-row-toggle[data-fold-key]";

  const remember = (el, open) => {
    const key = el.getAttribute("data-fold-key");
    if (key !== null) foldState.set(key, open);
  };

  // the element(s) a row toggle controls, or null (warned once per
  // toggle) when aria-controls is empty or names a missing id
  function rowTargets(btn) {
    const ids = (btn.getAttribute("aria-controls") || "").split(/\s+/).filter(Boolean);
    const home = btn.getRootNode();
    const byId = (id) => (home.getElementById ? home.getElementById(id) : home.querySelector(`#${CSS.escape(id)}`));
    const targets = ids.map(byId);
    if (ids.length && targets.every(Boolean)) return targets;
    if (!warnedRows.has(btn)) {
      warnedRows.add(btn);
      console.warn(`wonk.rowToggle: aria-controls=${JSON.stringify(btn.getAttribute("aria-controls"))} on "${btn.textContent.trim()}" does not name an element; the toggle does nothing`);
    }
    return null;
  }

  // set one row toggle; returns true when anything changed
  function setRow(btn, open) {
    const targets = rowTargets(btn);
    if (!targets) return false;
    const changed = btn.getAttribute("aria-expanded") !== String(open) || targets.some((t) => t.hidden === open);
    btn.setAttribute("aria-expanded", String(open));
    targets.forEach((t) => { t.hidden = !open; });
    remember(btn, open);
    return changed;
  }

  function setDetails(d, open) {
    remember(d, open);
    if (d.open === open) return false;
    d.open = open;
    return true;
  }

  function foldAll(root, open) {
    if (!root || typeof root.querySelectorAll !== "function") {
      throw new TypeError("wonk.foldAll(root, open): root must be an element or a document");
    }
    if (typeof open !== "boolean") {
      throw new TypeError("wonk.foldAll(root, open): open must be true or false");
    }
    const details = [...root.querySelectorAll("details")];
    if (root.matches && root.matches("details")) details.unshift(root);
    let changed = 0;
    details.forEach((d) => { if (!d.closest(".wonk-menu") && setDetails(d, open)) changed++; });
    root.querySelectorAll(".wonk-row-toggle").forEach((b) => { if (setRow(b, open)) changed++; });
    return changed;
  }

  // give keyed elements in scope (scope included) their remembered state
  function restoreFolds(scope) {
    if (!foldState.size) return;
    const els = [...scope.querySelectorAll(FOLD_KEY_SEL)];
    if (scope.matches && scope.matches(FOLD_KEY_SEL)) els.unshift(scope);
    els.forEach((el) => {
      const key = el.getAttribute("data-fold-key");
      if (!foldState.has(key)) return;
      const open = foldState.get(key);
      if (el.localName === "details") { if (el.open !== open) el.open = open; }
      else setRow(el, open);
    });
  }

  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d.localName === "details" && d.hasAttribute("data-fold-key")) remember(d, d.open);
  }, true);

  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;
    const row = e.target.closest(".wonk-row-toggle");
    if (row) {
      setRow(row, row.getAttribute("aria-expanded") !== "true");
      return;
    }
    const btn = e.target.closest("[data-wonk-fold-all]");
    if (!btn) return;
    const sel = btn.getAttribute("data-target");
    const target = sel ? document.querySelector(sel) : btn.closest("section, article, [data-fold-scope]");
    if (!target) {
      console.warn(sel
        ? `wonk.foldAll: data-target ${JSON.stringify(sel)} matches no element`
        : "wonk.foldAll: a [data-wonk-fold-all] button needs a data-target or an enclosing section, article, or [data-fold-scope]");
      return;
    }
    foldAll(target, btn.getAttribute("data-wonk-fold-all") === "open");
  });

  // ---- formatting: wonk.fmt ----
  // Every helper returns a string. null, undefined, "", NaN, and
  // +-Infinity are unknown and format as "—", never as 0. Numeric
  // strings are accepted. wonk.fmt.locale (default "en-US") applies to
  // every number; dates are always YYYY-MM-DD.
  //   num(n, {digits=0})                     1234.5 -> "1,235"
  //   compact(n, {digits=1})                 1234 -> "1.2K"
  //   money(n, {currency="USD", compact=false, digits=0 (1 if compact)})
  //   pct(ratio, {digits=0})                 0.123 -> "12%"
  //   duration(ms)                           200000 -> "3m 20s"
  //   date(value, {tz="UTC", time=false})    "2026-09-24 15:04 UTC" with time
  //   delta(change, {higherIsBetter=true, format="pct"|"num"|"money"|fn, digits, currency})
  //     -> {text, direction, sentiment, className}. The arrow carries the
  //     direction and the class carries the sentiment, so color is never
  //     the only signal. A change that formats as zero is flat.
  const UNKNOWN = "—";
  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const numberFormat = (options) => new Intl.NumberFormat(fmt.locale, options);
  const fixed = (digits) => ({ minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmt = {
    locale: "en-US",
    num(n, { digits = 0 } = {}) {
      const v = toNumber(n);
      return Number.isNaN(v) ? UNKNOWN : numberFormat(fixed(digits)).format(v);
    },
    compact(n, { digits = 1 } = {}) {
      const v = toNumber(n);
      return Number.isNaN(v) ? UNKNOWN : numberFormat({ notation: "compact", maximumFractionDigits: digits }).format(v);
    },
    money(n, { currency = "USD", compact = false, digits } = {}) {
      const v = toNumber(n);
      if (Number.isNaN(v)) return UNKNOWN;
      const options = compact
        ? { style: "currency", currency, notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: digits ?? 1 }
        : { style: "currency", currency, ...fixed(digits ?? 0) };
      return numberFormat(options).format(v);
    },
    pct(ratio, { digits = 0 } = {}) {
      const v = toNumber(ratio);
      return Number.isNaN(v) ? UNKNOWN : numberFormat({ style: "percent", ...fixed(digits) }).format(v);
    },
    duration(ms) {
      const v = toNumber(ms);
      if (Number.isNaN(v)) return UNKNOWN;
      if (v < 0) return `-${fmt.duration(-v)}`;
      const whole = (n) => numberFormat(fixed(0)).format(n);
      if (v < 999.5) return `${whole(Math.round(v))} ms`;
      if (v < 59950) return `${numberFormat({ maximumFractionDigits: 1 }).format(v / 1000)} s`;
      const secs = Math.round(v / 1000);
      if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
      const mins = Math.round(v / 60000);
      if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      const hours = Math.round(v / 3600000);
      return `${whole(Math.floor(hours / 24))}d ${hours % 24}h`;
    },
    date(value, { tz = "UTC", time = false } = {}) {
      if (value === null || value === undefined || value === "") return UNKNOWN;
      const d = value instanceof Date ? value : new Date(typeof value === "number" ? value : String(value));
      if (Number.isNaN(d.getTime())) return UNKNOWN;
      const parts = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
      }).formatToParts(d).forEach((p) => { parts[p.type] = p.value; });
      const day = `${parts.year}-${parts.month}-${parts.day}`;
      if (!time) return day;
      const zone = tz === "UTC" ? "UTC" : parts.timeZoneName;
      return `${day} ${parts.hour}:${parts.minute} ${zone}`;
    },
    delta(change, { higherIsBetter = true, format = "pct", digits, currency } = {}) {
      const v = toNumber(change);
      if (Number.isNaN(v)) return { text: UNKNOWN, direction: "flat", sentiment: "neutral", className: "delta--neutral" };
      const opts = {};
      if (digits !== undefined) opts.digits = digits;
      if (currency !== undefined) opts.currency = currency;
      let render;
      if (typeof format === "function") render = (n) => String(format(n));
      else if (format === "pct" || format === "num" || format === "money") render = (n) => fmt[format](n, opts);
      else throw new TypeError(`wonk.fmt.delta: format must be "pct", "num", "money", or a function, got ${JSON.stringify(format)}`);
      const text = render(Math.abs(v));
      const direction = v === 0 || text === render(0) ? "flat" : v > 0 ? "up" : "down";
      if (direction === "flat") return { text: `— ${render(0)}`, direction, sentiment: "neutral", className: "delta--neutral" };
      const good = (direction === "up") === higherIsBetter;
      const sentiment = good ? "good" : "bad";
      return { text: `${direction === "up" ? "▲" : "▼"} ${text}`, direction, sentiment, className: `delta--${sentiment}` };
    },
  };

  // ---- theme + pair helpers ----
  // setTheme("dark" | "paper" | "light") -- "light" is an alias of paper
  // and applies data-theme="paper" (wonk-tokens.css also styles a
  // hand-written data-theme="light" as paper). setPair(name) takes one of
  // PAIRS. Both throw on an unknown name, and both dispatch
  // wonk:themechange on document with {detail: {theme, pair}}.
  // wonk.theme.init({key = "wonk-theme"}) applies the stored theme, else
  // paper when prefers-color-scheme is light, else dark, and returns it.
  // After init, every setTheme stores the choice under key. init itself
  // stores nothing, so an unchosen theme keeps following the OS.
  // [data-wonk-theme-toggle] buttons (wired by wonk.init) flip dark and
  // paper; each reads "Paper" in dark and "Dark" in paper, and
  // aria-pressed is true in paper.
  // The no-flash head snippet (README install, references/components.md)
  // applies a stored paper theme before the first paint.
  const PAIRS = ["metathesis", "glorpla", "demogorgon", "ancient", "flourish"];
  const THEMES = { dark: "dark", paper: "paper", light: "paper" };
  const TOGGLE_SEL = "[data-wonk-theme-toggle]";
  let themeKey = null;

  const currentTheme = () => {
    const t = document.documentElement.getAttribute("data-theme");
    return t === "paper" || t === "light" ? "paper" : "dark";
  };
  // no data-pair: :root carries the metathesis values
  const currentPair = () => document.documentElement.getAttribute("data-pair") || "metathesis";

  function paintToggle(btn) {
    const paper = currentTheme() === "paper";
    btn.textContent = paper ? "Dark" : "Paper";
    btn.setAttribute("aria-pressed", String(paper));
  }
  const emitTheme = () => {
    document.querySelectorAll(TOGGLE_SEL).forEach(paintToggle);
    document.dispatchEvent(new CustomEvent("wonk:themechange", { detail: { theme: currentTheme(), pair: currentPair() } }));
  };

  function applyTheme(theme) {
    if (theme === "paper") document.documentElement.setAttribute("data-theme", "paper");
    else document.documentElement.removeAttribute("data-theme");
    emitTheme();
  }

  function setTheme(name) {
    if (!Object.prototype.hasOwnProperty.call(THEMES, name)) {
      throw new TypeError(`wonk.setTheme: unknown theme ${JSON.stringify(name)}; use "dark", "paper", or "light" (an alias of paper)`);
    }
    const theme = THEMES[name];
    if (themeKey !== null) {
      // storage throws in some sandboxed iframes: the theme still
      // applies, the warning says it will not persist
      try {
        localStorage.setItem(themeKey, theme);
      } catch (err) {
        console.warn(`wonk.setTheme: localStorage is not writable, the theme will not survive a reload.`, err);
      }
    }
    applyTheme(theme);
  }

  function setPair(name) {
    if (!PAIRS.includes(name)) {
      throw new TypeError(`wonk.setPair: unknown pair ${JSON.stringify(name)}; use one of ${PAIRS.join(", ")}`);
    }
    document.documentElement.setAttribute("data-pair", name);
    emitTheme();
  }

  function initTheme({ key = "wonk-theme" } = {}) {
    if (typeof key !== "string" || !key) {
      throw new TypeError(`wonk.theme.init({key}): key must be a non-empty string, got ${JSON.stringify(key)}`);
    }
    themeKey = key;
    let stored = null;
    try {
      stored = localStorage.getItem(key);
    } catch (err) {
      console.warn(`wonk.theme.init: localStorage is not readable, using prefers-color-scheme.`, err);
    }
    const theme = Object.prototype.hasOwnProperty.call(THEMES, stored)
      ? THEMES[stored]
      : window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "dark";
    applyTheme(theme);
    return theme;
  }

  // [data-wonk-theme-toggle]: labeled for the current theme on wiring
  function themeToggle(btn) {
    if (WIRED.themeToggle.has(btn)) return;
    WIRED.themeToggle.add(btn);
    paintToggle(btn);
    btn.addEventListener("click", () => setTheme(currentTheme() === "paper" ? "dark" : "paper"));
  }

  // ---- responsive shell: drawer ----
  // Markup: button.wonk-drawer-btn[data-wonk-drawer][aria-controls=id]
  // in the .wonk-topbar, and aside.wonk-side#id. Below 800px the side is
  // an off-canvas panel (wonk.css). Closed there, it is inert, so a
  // keyboard or screen-reader user never lands on a link hidden off the
  // left edge. The button toggles it and keeps aria-expanded; a link
  // click inside it, Escape, and a click outside it close it (Escape
  // also returns focus to the button). Crossing the breakpoint resets
  // it to closed, and the side is never inert above 800px.
  const DRAWER_QUERY = "(max-width: 800px)";
  function drawer(btn) {
    if (WIRED.drawer.has(btn)) return;
    const id = btn.getAttribute("aria-controls");
    const side = id ? document.getElementById(id) : null;
    if (!side) {
      console.warn(`wonk.drawer: aria-controls=${JSON.stringify(id)} on the [data-wonk-drawer] button does not name an element; the drawer does nothing`);
      return;
    }
    WIRED.drawer.add(btn);
    const mq = window.matchMedia(DRAWER_QUERY);
    const isOpen = () => side.classList.contains("is-open");
    const set = (open) => {
      side.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      side.inert = mq.matches && !open;
    };
    const sync = () => set(mq.matches && isOpen());
    sync();
    btn.addEventListener("click", () => set(!isOpen()));
    side.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest("a")) set(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !isOpen()) return;
      set(false);
      btn.focus();
    });
    document.addEventListener("click", (e) => {
      if (!mq.matches || !isOpen()) return;
      if (side.contains(e.target) || btn.contains(e.target)) return;
      set(false);
    });
    mq.addEventListener("change", sync);
  }

  // ---- hidden puzzle slot ----
  // Give any element [data-wonk-secret="<message>"]. Seven rapid clicks reveal it.
  // (aktunes idiom: there is always a reward for whoever bothers to look.)
  function secret(el) {
    if (WIRED.secret.has(el)) return;
    WIRED.secret.add(el);
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
  // Idempotent per element: safe to call again on the same subtree after
  // a render (already-wired elements are skipped, new ones get wired).
  function init(scope = document) {
    scope.querySelectorAll("[data-wonk-live]").forEach(live);
    scope.querySelectorAll("[data-wonk-glyph]").forEach(glyph);
    scope.querySelectorAll("[data-wonk-scatter]").forEach(scatter);
    scope.querySelectorAll("[data-wonk-vu]").forEach(vu);
    scope.querySelectorAll("[data-wonk-knob]").forEach(knob);
    scope.querySelectorAll("[data-wonk-scope]").forEach(scopeWidget);
    scope.querySelectorAll(".wonk-tabs").forEach(tabs);
    scope.querySelectorAll(".wonk-menu").forEach(menu);
    scope.querySelectorAll("[data-wonk-secret]").forEach(secret);
    scope.querySelectorAll(TOGGLE_SEL).forEach(themeToggle);
    scope.querySelectorAll("[data-wonk-drawer]").forEach(drawer);
    restoreFolds(scope);
    focusTips(scope);
    reveal(scope);
  }
  const boot = () => { init(); watchInjected(); };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.wonk = {
    toast, live, glyph, tabs, menu, setPair, setTheme, init, reveal, spark, scatter,
    vu, knob, scope: scopeWidget, glossary, tip, hint, foldAll, foldState, fmt,
    theme: { init: initTheme }, drawer, version: "0.2.0",
  };
})();
