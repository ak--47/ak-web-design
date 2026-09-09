/* ============================================================
   wonk-motion.js · purposeful motion pack for the WONK system
   Dependency-free. Pairs with assets/wonk-motion.css. Requires
   wonk-tokens.css to already be loaded (durations come from it).

   Every effect is a one-shot, triggered by you, never on load and
   never looping. See references/motion.md for the full contract.

   API:
     wonkMotion.play(el, name) -> Promise<{status, name, el}>
       status: "done"      effect reached its end state
               "cancelled" interrupted by cancel(), a newer play(),
                           or a real animationcancel event
               "skipped"   safety timeout fired, no animationend
                           arrived; target likely went display:none
                           or was detached mid-effect, so completion
                           is unconfirmed
     wonkMotion.cancel(el)     -> void, safe on any element
     wonkMotion.effects        -> frozen list of the 8 effect names
     wonkMotion.prefersReduced() -> live boolean
   ============================================================ */
(() => {
  "use strict";

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

  const token = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Reads a token as milliseconds. Throws instead of guessing: a
  // missing/malformed duration token is a setup bug (wonk-tokens.css
  // not loaded, or a token renamed), not something to paper over.
  function ms(name) {
    const raw = token(name);
    const n = parseFloat(raw);
    if (!raw || Number.isNaN(n)) {
      throw new Error(
        `wonk-motion: token ${name} is missing or not a valid CSS time ("${raw}"). Load wonk-tokens.css before wonk-motion.js.`
      );
    }
    return raw.endsWith("ms") ? n : n * 1000;
  }

  // Computed once at load, not per play() call: durations are
  // global tokens, they don't change with pair/theme.
  const T_FAST = ms("--ak-t-fast");
  const T_MED = ms("--ak-t-med");
  const T_SLOW = ms("--ak-t-slow");

  // name -> class to toggle, animation-name(s) that mark it done,
  // the descendant selector for multi-target effects (null = el
  // itself is the only target), whether targets need pathLength="1",
  // and a safety-timeout budget in ms.
  const EFFECTS = Object.freeze({
    "panel-enter":       { cls: "wonk-anim-panel-enter",       anims: ["wonk-panel-enter"],                               selector: null,                                 budget: T_MED },
    "panel-exit":        { cls: "wonk-anim-panel-exit",        anims: ["wonk-panel-exit"],                                selector: null,                                 budget: T_FAST },
    "value-changed":     { cls: "wonk-anim-value-changed",     anims: ["wonk-value-changed"],                             selector: null,                                 budget: T_MED },
    "row-inserted":      { cls: "wonk-anim-row-inserted",      anims: ["wonk-row-inserted"],                              selector: null,                                 budget: T_MED },
    "filter-applied":    { cls: "wonk-anim-filter-applied",    anims: ["wonk-filter-applied"],                            selector: null,                                 budget: T_FAST },
    "progress-complete": { cls: "wonk-anim-progress-complete", anims: ["wonk-progress-complete"],                         selector: null,                                 budget: T_SLOW },
    "trace-draw":        { cls: "wonk-anim-trace-draw",        anims: ["wonk-trace-draw"],                                selector: "[data-wonk-trace]",                  budget: T_SLOW, needsPathLength: true },
    "confirm-check":     { cls: "wonk-anim-confirm-check",     anims: ["wonk-confirm-check-draw", "wonk-confirm-pop"],    selector: "[data-wonk-trace],[data-wonk-pop]",  budget: T_MED + T_FAST, needsPathLength: true },
  });
  const EFFECT_NAMES = Object.freeze(Object.keys(EFFECTS));

  // el -> { name, cls, onEvent, timeoutId, resolve }
  const active = new Map();

  // Validates el and gathers the real target list. Throws (caller
  // turns it into a rejected promise) instead of guessing a
  // fallback: a wrongly-marked-up target should fail loud, not
  // silently animate nothing.
  function resolveTargets(el, name, def) {
    if (!(el instanceof Element)) {
      throw new TypeError(
        `wonkMotion.play: el must be a DOM Element, got ${el === null ? "null" : typeof el}.`
      );
    }
    if (!def.selector) return [el];

    const targets = [...el.querySelectorAll(def.selector)];
    if (!targets.length) {
      throw new Error(
        `wonkMotion.play: "${name}" needs descendant(s) matching ${def.selector}. Mark each traced path data-wonk-trace (with pathLength="1"); confirm-check also needs one data-wonk-pop wrapper.`
      );
    }
    if (def.needsPathLength) {
      const bad = targets.find(
        (t) => t.hasAttribute("data-wonk-trace") && t.getAttribute("pathLength") !== "1"
      );
      if (bad) {
        throw new Error(
          `wonkMotion.play: "${name}" target <${bad.tagName.toLowerCase()}> is missing pathLength="1", required for size-independent dash drawing.`
        );
      }
    }
    return targets;
  }

  function finalize(el, status) {
    const entry = active.get(el);
    if (!entry) return;
    active.delete(el);
    clearTimeout(entry.timeoutId);
    el.removeEventListener("animationend", entry.onEvent);
    el.removeEventListener("animationcancel", entry.onEvent);
    el.classList.remove(entry.cls);
    el.removeAttribute("data-wonk-motion-state");
    // Progress-complete's --ak-ok fill must survive the transient
    // class coming off. Only a confirmed "done" earns it: a
    // cancelled or unconfirmed ("skipped") run has not earned the
    // claim that the bar actually finished.
    if (entry.name === "progress-complete" && status === "done") {
      el.classList.add("wonk-motion-done");
    }
    entry.resolve({ status, name: entry.name, el });
  }

  /**
   * Plays one named effect on `el`. Resolves once the effect has
   * settled; see the status meanings in the header comment. Never
   * call this from a load handler, timer, or poll loop: every call
   * must trace back to a real user action or a real data change.
   */
  function play(el, name) {
    const def = EFFECTS[name];
    if (!def) {
      return Promise.reject(
        new Error(`wonkMotion.play: unknown effect "${name}". Use one of: ${EFFECT_NAMES.join(", ")}`)
      );
    }

    let targets;
    try {
      targets = resolveTargets(el, name, def);
    } catch (err) {
      return Promise.reject(err);
    }

    // Overlap: interrupt whatever was already running on el first.
    cancel(el);

    // Reduced motion: settle synchronously, no transient animation
    // class ever gets added. This is a deliberate, deterministic
    // outcome (not a guess), so it resolves "done" and, for
    // progress-complete, applies the persisted end color directly.
    if (mql.matches) {
      if (name === "progress-complete") el.classList.add("wonk-motion-done");
      return Promise.resolve({ status: "done", name, el });
    }

    if (name === "progress-complete") el.classList.remove("wonk-motion-done");

    const targetSet = new Set(targets);
    const settled = new Set();
    let resolveFn;
    const promise = new Promise((resolve) => { resolveFn = resolve; });

    const onEvent = (e) => {
      // Only react to our own tracked targets, matching one of our
      // own animation names. Without this check, a matching-named
      // animation on an unrelated nested element could bubble up and
      // finish (or cancel) this effect early.
      if (!targetSet.has(e.target) || !def.anims.includes(e.animationName)) return;
      // A real animationcancel (element hidden/removed mid-flight by
      // something other than us) means that target did not complete.
      if (e.type === "animationcancel") { finalize(el, "cancelled"); return; }
      if (settled.has(e.target)) return;
      settled.add(e.target);
      if (settled.size === targets.length) finalize(el, "done");
    };
    el.addEventListener("animationend", onEvent);
    el.addEventListener("animationcancel", onEvent);

    // Safety net only: guarantees play() always settles even if
    // animationend never arrives. That's an unconfirmed outcome, so
    // it resolves "skipped", not "done" - we cannot claim a target
    // that went display:none or detached actually finished animating.
    const timeoutId = setTimeout(() => finalize(el, "skipped"), def.budget + 80);

    active.set(el, { name, cls: def.cls, onEvent, timeoutId, resolve: resolveFn });

    // Flush after the previous class was removed (by cancel() above)
    // and before adding the new one. Reading layout here forces the
    // browser to commit the removal, so re-adding the same class name
    // (replaying an effect right after it finished) restarts the
    // animation instead of being a no-op.
    void el.offsetWidth;
    el.setAttribute("data-wonk-motion-state", "running");
    el.classList.add(def.cls);

    return promise;
  }

  /**
   * Cancels any wonk-motion effect running on `el`, right away.
   * Safe to call on an element with nothing running (no-op). Every
   * wonk-motion class only paints transient decoration over the
   * base styles, so removing it leaves no stale state behind.
   */
  function cancel(el) {
    if (active.has(el)) finalize(el, "cancelled");
  }

  // If reduced motion turns on mid-flight, wonk-motion.css has
  // already collapsed the running animation's duration to ~0, so the
  // element is effectively at its end state. Finalize immediately
  // rather than waiting on that near-instant animationend, so nothing
  // stays marked "running" for even one extra frame.
  mql.addEventListener("change", () => {
    if (!mql.matches) return;
    [...active.keys()].forEach((el) => finalize(el, "done"));
  });

  window.wonkMotion = {
    play,
    cancel,
    effects: EFFECT_NAMES,
    prefersReduced: () => mql.matches,
  };
})();
