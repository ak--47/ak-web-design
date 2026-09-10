/* ============================================================
   wonk-controls.js · instrument controls pack for WONK data tools
   Depends on wonk.js (loaded first) and wonk-controls.css.
   Dependency-free otherwise. Safe to load once per page.

   Semantic controls, not decoration: every widget here wraps a real
   native input (<input type=range>, <input type=number>, <input
   type=radio>) so keyboard, screen reader, and form submission all work
   for free. wonk.js's knob is the one exception (no native rotary input
   exists) and it exposes a real value/input/change contract instead.

   Every wire function below validates its own config (data-min/max/step,
   an out-of-range data-value) and throws rather than silently falling
   back to a guessed number -- a misconfigured control is a bug worth
   surfacing immediately, not a bug worth hiding behind a default.

   Full markup, copy recipes, and the instrument -> data-tool contract:
   references/instruments.md.
   ============================================================ */
(() => {
  "use strict";

  // shared: parse a data-*/attribute value that may be undefined, null, or
  // an empty string (the native default for unset <input> min/max/step
  // properties) into either `null` (unset, fall through to the next
  // source) or a finite number. Returns NaN if the raw value was present
  // but not a parseable number, so callers can throw instead of silently
  // treating garbage as "unset".
  function readNum(raw) {
    if (raw === undefined || raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  // resolves a bound from (in priority order) a data-* override, a native
  // attribute/property, then a fallback -- throwing if either explicit
  // source was present but not a finite number.
  function resolveNum(dataRaw, attrRaw, fallback, what) {
    const fromData = readNum(dataRaw);
    if (fromData !== null) {
      if (Number.isNaN(fromData)) throw new Error(`${what}: data value (${dataRaw}) must be a finite number`);
      return fromData;
    }
    const fromAttr = readNum(attrRaw);
    if (fromAttr !== null) {
      if (Number.isNaN(fromAttr)) throw new Error(`${what}: attribute value (${attrRaw}) must be a finite number`);
      return fromAttr;
    }
    return fallback;
  }

  // ---- fader ----
  // <fieldset class="wonk-fader" data-min data-max data-value data-step data-unit>
  //   <legend class="wonk-label">label</legend>
  //   <div class="wonk-fader-row">
  //     <input type="range" class="wonk-range">
  //     <input type="number" class="wonk-fader-exact">
  //     <span class="wonk-fader-unit"></span>
  //   </div>
  // </fieldset>
  // Wires the range and the exact numeric input together: dragging the
  // range updates the number, typing an exact number updates the range.
  // Fires native "input" (while moving) and "change" (on commit) on BOTH
  // inputs, same as any native range -- there is no custom event to learn.
  function fader(el) {
    if (el.wonkFader) return el.wonkFader;
    const range = el.querySelector(".wonk-range, input[type=range]");
    const exact = el.querySelector(".wonk-fader-exact, input[type=number]");
    if (!range) return null;

    const min = resolveNum(el.dataset.min, range.min, 0, "wonkControls.fader min");
    const max = resolveNum(el.dataset.max, range.max, 100, "wonkControls.fader max");
    if (min >= max) throw new Error(`wonkControls.fader: min (${min}) must be less than max (${max})`);
    const step = resolveNum(el.dataset.step, range.step, 1, "wonkControls.fader step");
    if (step <= 0) throw new Error(`wonkControls.fader: step (${step}) must be greater than 0`);
    const initial = resolveNum(el.dataset.value, range.value, (min + max) / 2, "wonkControls.fader value");

    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(initial);
    if (exact) {
      exact.min = String(min);
      exact.max = String(max);
      // "any", not the fader step: onExactCommit already snaps a typed
      // off-grid value via snap() below. A native step attribute would
      // make the browser flag that same value stepMismatch and paint it
      // :invalid before snap() ever runs, rejecting input the spec
      // treats as valid (see references/instruments.md).
      exact.step = "any";
      exact.required = true;
      exact.value = range.value;
    }

    // accessible names for BOTH inputs, derived from the legend, unless
    // the author already gave one explicitly.
    const legendText = el.querySelector("legend")?.textContent.trim();
    if (legendText) {
      if (!range.hasAttribute("aria-label")) range.setAttribute("aria-label", legendText);
      if (exact && !exact.hasAttribute("aria-label")) exact.setAttribute("aria-label", `${legendText} exact value`);
    }

    const clamp = (v) => Math.max(min, Math.min(max, v));
    const snap = (v) => clamp(Math.round((v - min) / step) * step + min);

    const onRangeInput = () => {
      if (exact) exact.value = range.value;
    };
    // commit path used by both the exact input's native "change" (fires on
    // blur once the value actually changed) and Enter (which just calls
    // exact.blur() below) -- a single path means Enter can never double-fire
    // this alongside the native change event.
    const onExactCommit = (event) => {
      event.stopPropagation();
      if (!exact.checkValidity() || exact.value === "") {
        // retain and report the invalid/empty text as typed -- never
        // silently revert to the last good value or clamp it away. Native
        // :invalid styling (wonk-controls.css) already reflects the
        // problem; nothing commits to the range until it is fixed.
        return;
      }
      const snapped = snap(exact.valueAsNumber);
      range.value = String(snapped); // browser clamps to min/max here too
      exact.value = range.value; // sync back through the authoritative range value
      range.dispatchEvent(new Event("input", { bubbles: true }));
      range.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const onExactKeydown = (e) => {
      // defer to the single onExactCommit path above (invoked via the
      // native "change" listener once blur fires) instead of also calling
      // it here -- calling it from both places would double-dispatch
      // "change" on the range for one Enter press.
      if (e.key === "Enter") { e.preventDefault(); exact.blur(); }
    };

    range.addEventListener("input", onRangeInput);
    if (exact) {
      exact.addEventListener("change", onExactCommit);
      exact.addEventListener("keydown", onExactKeydown);
    }

    const api = {
      get value() { return parseFloat(range.value); },
      get valid() { return !exact || (exact.value !== "" && exact.checkValidity()); },
      set(v) {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) throw new Error(`wonkControls.fader.set: value (${v}) must be a finite number`);
        const clamped = snap(n);
        range.value = String(clamped);
        if (exact) exact.value = range.value;
      },
      destroy() {
        range.removeEventListener("input", onRangeInput);
        if (exact) {
          exact.removeEventListener("change", onExactCommit);
          exact.removeEventListener("keydown", onExactKeydown);
        }
        delete el.wonkFader;
      },
    };
    el.wonkFader = api;
    return api;
  }

  // ---- bounded time/range window ----
  // <fieldset class="wonk-window" data-min data-max>
  //   <legend class="wonk-label">label</legend>
  //   <div class="wonk-window-row">
  //     <div class="wonk-field"><label>from</label><input class="wonk-input" type="date|number|..."></div>
  //     <span class="wonk-window-sep">to</span>
  //     <div class="wonk-field"><label>to</label><input class="wonk-input" type="date|number|..."></div>
  //   </div>
  // </fieldset>
  // Two plain inputs (date, datetime-local, or number -- author's choice)
  // kept mutually bounded: "from" cannot commit past "to" and vice versa.
  // Bounds from data-min/data-max on the fieldset are also enforced if the
  // input type supports them natively.
  // Fires "change" on the fieldset itself with detail {from, to} once
  // BOTH ends hold a valid, ordered value -- this is the one moment safe
  // to commit a draft. Never wire a query to input events on either box,
  // and never wire it to this "change" either -- see instruments.md:
  // change commits a DRAFT range, an expensive query still needs an
  // explicit Run/Apply action from the user.
  function windowControl(el) {
    if (el.wonkWindow) return el.wonkWindow;
    const inputs = [...el.querySelectorAll("input")];
    const [from, to] = inputs;
    if (!from || !to) return null;

    const bound = (name) => (el.dataset[name] !== undefined ? el.dataset[name] : null);
    const dataMin = bound("min");
    const dataMax = bound("max");
    if (dataMin !== null) { from.min = dataMin; to.min = dataMin; }
    if (dataMax !== null) { from.max = dataMax; to.max = dataMax; }

    // numeric-like input types expose a real valueAsNumber; comparing
    // that avoids the lexicographic bug where "9" > "10" as strings even
    // though 9 < 10 as numbers. Types with no numeric representation
    // (text) fall back to string comparison -- same as native HTML.
    const NUMERIC_TYPES = new Set(["date", "datetime-local", "month", "week", "time", "number", "range"]);
    const orderable = (input) => {
      if (NUMERIC_TYPES.has(input.type)) {
        const n = input.valueAsNumber;
        return Number.isNaN(n) ? null : n;
      }
      return input.value === "" ? null : input.value;
    };

    const CROSSED = "must not be after the other end of the range";
    const clearCustom = () => { from.setCustomValidity(""); to.setCustomValidity(""); };

    // Re-checks ordering and sets (or clears) a visible custom validity
    // message on BOTH ends -- this never silently rewrites the other
    // endpoint's value. A crossed pair is a validation error the user
    // must resolve themselves, same as any other native constraint.
    const validateOrder = () => {
      clearCustom();
      const f = orderable(from);
      const t = orderable(to);
      if (f === null || t === null) return true; // nothing to compare yet
      if (f > t) {
        from.setCustomValidity(`from ${CROSSED}`);
        to.setCustomValidity(`to ${CROSSED}`);
        return false;
      }
      return true;
    };

    const emitChange = () => {
      const ordered = validateOrder();
      if (!ordered) return; // crossed bounds -- surfaced as native :invalid, no change fired
      if (!from.checkValidity() || !to.checkValidity()) return; // native min/max/step/required violations
      const f = orderable(from), t = orderable(to);
      if (f === null || t === null) return; // one or both empty -- wait for the user
      el.dispatchEvent(
        new CustomEvent("change", { detail: { from: from.value, to: to.value }, bubbles: true })
      );
    };

    // stopPropagation: the native "change"/"input" on each raw input would
    // otherwise also bubble up to el with no detail, alongside the custom
    // "change" this control dispatches -- listeners on el should see
    // exactly one "change", always shaped {from, to}.
    const onFromChange = (e) => { e.stopPropagation(); emitChange(); };
    const onToChange = (e) => { e.stopPropagation(); emitChange(); };
    // live-clears the crossed-bounds message as soon as the user fixes it,
    // without waiting for blur/change.
    const onFromInput = (e) => { e.stopPropagation(); validateOrder(); };
    const onToInput = (e) => { e.stopPropagation(); validateOrder(); };

    from.addEventListener("change", onFromChange);
    to.addEventListener("change", onToChange);
    from.addEventListener("input", onFromInput);
    to.addEventListener("input", onToInput);

    const api = {
      get value() { return { from: from.value, to: to.value }; },
      get valid() { return validateOrder() && from.checkValidity() && to.checkValidity(); },
      // set(): validates like a user commit would. Rejects (rolls back and
      // throws) a crossed or otherwise invalid pair instead of writing bad
      // state -- it never fires "change" for an invalid result.
      set({ from: f, to: t } = {}) {
        const prevFrom = from.value, prevTo = to.value;
        if (f !== undefined) from.value = f;
        if (t !== undefined) to.value = t;
        const ordered = validateOrder();
        const valid = ordered && from.checkValidity() && to.checkValidity();
        if (!valid) {
          from.value = prevFrom;
          to.value = prevTo;
          clearCustom();
          throw new Error("wonkControls.window.set: from/to must both be valid and from <= to");
        }
      },
      destroy() {
        from.removeEventListener("change", onFromChange);
        to.removeEventListener("change", onToChange);
        from.removeEventListener("input", onFromInput);
        to.removeEventListener("input", onToInput);
        clearCustom();
        delete el.wonkWindow;
      },
    };
    el.wonkWindow = api;
    return api;
  }

  // ---- segmented selector (native radios) ----
  // <fieldset class="wonk-segmented" data-name="view">
  //   <legend class="wonk-label">label</legend>
  //   <div class="wonk-segmented-track">
  //     <label><input type="radio" name="view" value="table" checked><span>table</span></label>
  //     <label><input type="radio" name="view" value="chart"><span>chart</span></label>
  //   </div>
  // </fieldset>
  // Real radios underneath -- keyboard arrow-key roving and forms work
  // without any JS. This function only adds the sliding glide highlight;
  // it degrades to per-option fill (see wonk-controls.css) with no JS or
  // under prefers-reduced-motion. Fires nothing custom: listen to native
  // "change" on the radios (or the fieldset, since it bubbles).
  function segmented(el) {
    if (el.wonkSegmented) return el.wonkSegmented;
    const track = el.querySelector(".wonk-segmented-track");
    const radios = [...el.querySelectorAll("input[type=radio]")];
    if (!track || !radios.length) return null;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let glide = null;
    if (!reduced) {
      glide = document.createElement("span");
      glide.className = "wonk-segmented-glide";
      glide.setAttribute("aria-hidden", "true");
      track.prepend(glide);
      track.classList.add("has-glide");
    }

    const place = () => {
      if (!glide) return;
      const checked = radios.find((r) => r.checked);
      const label = checked ? checked.closest("label") : null;
      if (!label) { glide.style.width = "0"; return; }
      glide.style.width = label.offsetWidth + "px";
      glide.style.height = label.offsetHeight + "px";
      glide.style.transform = `translateX(${label.offsetLeft - 2}px)`;
    };
    place();

    const onChange = () => place();
    radios.forEach((r) => r.addEventListener("change", onChange));
    window.addEventListener("resize", place);

    const api = {
      get value() { return radios.find((r) => r.checked)?.value ?? null; },
      set(v) {
        const match = radios.find((r) => r.value === String(v));
        if (!match) throw new Error(`wonkControls.segmented.set: no option with value "${v}"`);
        match.checked = true;
        place();
      },
      destroy() {
        radios.forEach((r) => r.removeEventListener("change", onChange));
        window.removeEventListener("resize", place);
        if (glide) glide.remove();
        track.classList.remove("has-glide"); // restore the no-JS solid-fill fallback
        delete el.wonkSegmented;
      },
    };
    el.wonkSegmented = api;
    return api;
  }

  // ---- stepper ----
  // <fieldset class="wonk-stepper" data-min data-max data-step data-unit data-value>
  //   <legend class="wonk-label">label</legend>
  //   <div class="wonk-stepper-row">
  //     <button type="button" class="wonk-stepper-btn" data-dir="-1">-</button>
  //     <input type="number" class="wonk-stepper-input">
  //     <button type="button" class="wonk-stepper-btn" data-dir="1">+</button>
  //   </div>
  //   <span class="wonk-stepper-unit"></span>
  // </fieldset>
  // A plain <input type=number> is already a stepper (spin buttons, arrow
  // keys, exact typing) -- this only adds bigger click targets that share
  // its min/max/step, using the input's own native stepUp()/stepDown() so
  // blank-value and clamping semantics come from the platform, not a
  // guessed default. The root is a real <fieldset>: setting the standard
  // `disabled` attribute on it natively disables the input AND both
  // buttons, so a disabled stepper can never be clicked, no JS required.
  // Fires the input's own native "input"/"change" -- nothing custom to learn.
  function stepper(el) {
    if (el.wonkStepper) return el.wonkStepper;
    const input = el.querySelector(".wonk-stepper-input, input[type=number]");
    if (!input) return null;

    const min = resolveNum(el.dataset.min, input.min, -Infinity, "wonkControls.stepper min");
    const max = resolveNum(el.dataset.max, input.max, Infinity, "wonkControls.stepper max");
    if (min >= max) throw new Error(`wonkControls.stepper: min (${min}) must be less than max (${max})`);
    const step = resolveNum(el.dataset.step, input.step, 1, "wonkControls.stepper step");
    if (step <= 0) throw new Error(`wonkControls.stepper: step (${step}) must be greater than 0`);

    input.step = String(step);
    if (Number.isFinite(min)) input.min = String(min);
    if (Number.isFinite(max)) input.max = String(max);
    // only ever apply an EXPLICIT starting value -- never invent one (and
    // never default a blank input to 0). A stepper with no data-value and
    // no value attribute simply starts blank, same as a bare number input.
    if (el.dataset.value !== undefined && input.value === "") {
      const v = readNum(el.dataset.value);
      if (v === null || Number.isNaN(v)) {
        throw new Error(`wonkControls.stepper: data-value (${el.dataset.value}) must be a finite number`);
      }
      input.value = String(v);
    }

    const buttons = [...el.querySelectorAll(".wonk-stepper-btn")];
    const clamp = (v) => Math.max(min, Math.min(max, v));

    const paintDisabled = () => {
      const v = input.valueAsNumber; // NaN when blank -- comparisons below are then false, so buttons stay enabled
      buttons.forEach((b) => {
        const dir = parseFloat(b.dataset.dir || "1");
        b.disabled = input.disabled || (dir > 0 ? v >= max : v <= min);
      });
    };

    const nudge = (dir) => (e) => {
      // defense in depth: a disabled fieldset already blocks this click
      // natively, but a disabled BUTTON can still receive a
      // programmatically dispatched click in some test harnesses, so
      // check the live disabled state here too rather than trusting
      // whatever was true when the listener was attached.
      if (input.matches(":disabled") || e.currentTarget.matches(":disabled")) return;
      // native stepUp()/stepDown(): the platform decides what a blank
      // input becomes (its own min, or a spec-defined default) -- we
      // never hardcode "blank means 0" ourselves.
      if (dir > 0) input.stepUp(); else input.stepDown();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      paintDisabled();
    };
    const handlers = buttons.map((b) => nudge(parseFloat(b.dataset.dir || "1")));
    buttons.forEach((b, i) => b.addEventListener("click", handlers[i]));
    input.addEventListener("input", paintDisabled);
    paintDisabled();

    const api = {
      get value() { return input.valueAsNumber; },
      get valid() { return input.checkValidity(); },
      set(v) {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) throw new Error(`wonkControls.stepper.set: value (${v}) must be a finite number`);
        input.value = String(clamp(n));
        paintDisabled();
      },
      destroy() {
        buttons.forEach((b, i) => b.removeEventListener("click", handlers[i]));
        input.removeEventListener("input", paintDisabled);
        delete el.wonkStepper;
      },
    };
    el.wonkStepper = api;
    return api;
  }

  // ---- auto-wire ----
  // wonkControls.init(scope?) wires every instrument inside scope, AND
  // scope itself if scope matches one of the selectors below (mirrors
  // wonk.js's init(scope) contract). Safe to call repeatedly: every wire
  // function above is idempotent (each checks its own el.wonk* cache
  // before doing anything).
  const SELECTORS = {
    fader: ".wonk-fader",
    window: ".wonk-window",
    segmented: ".wonk-segmented",
    stepper: ".wonk-stepper",
  };

  function wireOne(el) {
    if (el.matches?.(SELECTORS.fader)) return fader(el);
    if (el.matches?.(SELECTORS.window)) return windowControl(el);
    if (el.matches?.(SELECTORS.segmented)) return segmented(el);
    if (el.matches?.(SELECTORS.stepper)) return stepper(el);
    return null;
  }

  function init(scope = document) {
    if (scope.nodeType === 1) wireOne(scope);
    scope.querySelectorAll(SELECTORS.fader).forEach(fader);
    scope.querySelectorAll(SELECTORS.window).forEach(windowControl);
    scope.querySelectorAll(SELECTORS.segmented).forEach(segmented);
    scope.querySelectorAll(SELECTORS.stepper).forEach(stepper);
    // Only the knob from wonk.js is ours to (re)wire here, and only the
    // knob itself -- wonk.knob() is idempotent (it no-ops if el.wonkKnob
    // already exists). We deliberately do NOT call the broader
    // wonk.init(scope): that also re-runs wonk.js's live/glyph/scatter/vu/
    // tabs/secret wiring, none of which guard against being re-wired, so
    // calling it a second time on a scope that already has those widgets
    // would attach duplicate listeners and restart intervals.
    if (window.wonk?.knob) {
      if (scope.nodeType === 1 && scope.matches?.("[data-wonk-knob]")) window.wonk.knob(scope);
      scope.querySelectorAll?.("[data-wonk-knob]").forEach(window.wonk.knob);
    }
  }

  // destroy(scope): tear down every wired instrument inside scope (and
  // scope itself). Call before removing a subtree that holds a listener
  // anchored OUTSIDE the subtree itself -- the segmented selector's
  // `window` resize listener is the one case here that would otherwise
  // keep the removed DOM alive/reachable. (The knob's pointer listeners
  // live on its own SVG element, so they are collected along with it once
  // the element is dereferenced; destroy() is still worth calling on a
  // knob to cancel any in-flight drag/edit and clear its cached handle,
  // not to avoid a leak.)
  function destroy(scope = document) {
    const all = scope.nodeType === 1 ? [scope, ...scope.querySelectorAll("*")] : [...scope.querySelectorAll("*")];
    all.forEach((el) => {
      el.wonkFader?.destroy();
      el.wonkWindow?.destroy();
      el.wonkSegmented?.destroy();
      el.wonkStepper?.destroy();
      el.wonkKnob?.destroy();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  window.wonkControls = { init, destroy, fader, window: windowControl, segmented, stepper };
})();
