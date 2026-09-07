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
    scope.querySelectorAll(".wonk-tabs").forEach(tabs);
    scope.querySelectorAll("[data-wonk-secret]").forEach(secret);
    reveal(scope);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  window.wonk = { toast, live, glyph, tabs, setPair, setTheme, init, reveal, spark, scatter };
})();
