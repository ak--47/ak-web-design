/* ============================================================
   wonk.js · behaviors for the WONK design system
   Dependency-free. Safe to load once per page (idempotent-ish).
   Everything respects prefers-reduced-motion.
   ============================================================ */
(() => {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (min, max) => min + Math.random() * (max - min);

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
  // Slow cycle through glyphs + pair-ish colors; strobes on hover.
  // Apply to any element with [data-wonk-glyph].
  const GLYPHS = ["∿", "⌁", "♪", "⚙", "λ", "⌥", "∫", "⧉", "♭", "№", "⚡", "✄"];
  function glyph(el) {
    const swap = () => {
      // read tokens live: pair/theme can change under us
      const css = getComputedStyle(document.documentElement);
      const colors = ["--ak-a1-text", "--ak-a2-text", "--ak-ok", "--ak-warn", "--ak-info"]
        .map((v) => css.getPropertyValue(v).trim())
        .filter(Boolean);
      el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      if (colors.length) el.style.color = colors[Math.floor(Math.random() * colors.length)];
      // subtle morph: tiny scale/rotate wobble, springs back
      if (!REDUCED) {
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
    scope.querySelectorAll(".wonk-tabs").forEach(tabs);
    scope.querySelectorAll("[data-wonk-secret]").forEach(secret);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  window.wonk = { toast, live, glyph, tabs, setPair, setTheme, init };
})();
