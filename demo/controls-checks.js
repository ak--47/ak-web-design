/* ============================================================
   demo/controls-checks.js · reproducible browser checks for the
   instrument controls pack (wonk-controls.css/.js + wonk.js's knob).

   NOT a build-time test runner -- there is none in this skill. This is a
   browser-callable module: load it on any page that already has
   wonk.js + wonk-controls.js loaded (e.g. demo/instruments.html, or a
   blank page with just the two scripts), then call:

     window.wonkControlsChecks.run()

   from devtools or from an automated browser session (Playwright,
   Puppeteer, etc.) via page.evaluate(). It returns a Promise<Array<{
     name: string, pass: boolean, message: string
   }>> and also prints a console.table(). Every check builds its own
   fixture DOM in a detached, hidden container and cleans up after
   itself -- nothing here depends on or mutates the host page's own
   markup, so it is safe to run against the live instruments.html gallery
   without disturbing its fixtures.

   Exists to make the specific regressions fixed in this pass
   mechanically reproducible instead of only manually re-clicked:
   - window: numeric (not string) ordering; native validity gates change;
     crossed bounds get visible custom validity and never silently
     rewrite the other endpoint; clears when fixed.
   - fader: empty native attrs never produce NaN defaults; invalid/out-of
     range exact entry is retained, not reverted or clamped; Enter/blur
     never double-fire change; both inputs get an aria-label from the
     legend.
   - stepper: invalid numeric config throws; a blank value is never
     defaulted to 0; dynamic disabled is respected on button click; uses
     native stepUp()/stepDown().
   - segmented: destroy() removes the has-glide class along with the
     glide element.
   - knob: validates finite min < max, step > 0, and a finite value --
     throws rather than silently falling back; set() throws on
     non-finite input; pointercancel settles a drag WITHOUT firing the
     committing "change" event (only pointerup does).
   - init(scope): wires scope itself when it is a knob, and never calls
     the broader wonk.init() (which would re-wire unrelated, non-
     idempotent legacy widgets like the live jitter or glyph morph).
   ============================================================ */
(() => {
  "use strict";

  function assert(cond, message) {
    if (!cond) throw new Error(message);
  }

  // ---- fixture helpers ----
  // Every check gets its own hidden-but-attached container so offsetWidth/
  // offsetLeft (needed by the segmented selector's glide placement) are
  // real, not zeroed out by a detached node.
  function withFixture(html) {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-9999px";
    host.style.top = "0";
    host.innerHTML = html;
    document.body.appendChild(host);
    return { host, cleanup: () => host.remove() };
  }

  function dispatchPointer(el, type, props = {}) {
    const Ctor = window.PointerEvent || window.MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, pointerId: 1, clientY: 0, ...props }));
  }

  // ---- checks ----
  const checks = [];
  function check(name, fn) {
    checks.push({ name, fn });
  }

  // -- window: numeric ordering, not string comparison --
  check("window: 9 < 10 is recognized numerically, not as strings", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-window">
        <legend>range</legend>
        <input type="number">
        <input type="number">
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-window");
      const [from, to] = el.querySelectorAll("input");
      const api = wonkControls.window(el);
      let changeDetail = null;
      el.addEventListener("change", (e) => (changeDetail = e.detail));

      from.value = "9";
      from.dispatchEvent(new Event("change", { bubbles: true }));
      to.value = "10";
      to.dispatchEvent(new Event("change", { bubbles: true }));

      assert(to.value === "10", `to.value should stay "10", got "${to.value}" (a string-compare bug would rewrite it to "9")`);
      assert(from.value === "9", `from.value should stay "9", got "${from.value}"`);
      assert(changeDetail !== null, "change should have fired once 9 -> 10 is recognized as correctly ordered");
      assert(changeDetail.from === "9" && changeDetail.to === "10", `unexpected change detail: ${JSON.stringify(changeDetail)}`);
      assert(api.valid === true, "api.valid should be true for an ordered, valid pair");
    } finally {
      cleanup();
    }
  });

  // -- window: native validity (min/max) gates change --
  check("window: a native min/max violation blocks change even if ordered", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-window" data-min="5" data-max="100">
        <legend>range</legend>
        <input type="number">
        <input type="number">
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-window");
      const [from, to] = el.querySelectorAll("input");
      wonkControls.window(el);
      let fired = false;
      el.addEventListener("change", () => (fired = true));

      from.value = "3"; // below data-min="5" -> native :invalid
      from.dispatchEvent(new Event("change", { bubbles: true }));
      to.value = "50";
      to.dispatchEvent(new Event("change", { bubbles: true }));

      assert(!from.checkValidity(), "from should be natively invalid (3 < min 5)");
      assert(fired === false, "change must not fire while either endpoint fails native validity");
    } finally {
      cleanup();
    }
  });

  // -- window: crossed bounds -> visible custom validity, no silent rewrite, clears when fixed --
  check("window: crossed bounds set visible validity on both ends, never silently swap them, and clear once fixed", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-window">
        <legend>range</legend>
        <input type="date" value="2026-10-15">
        <input type="date" value="2026-08-01">
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-window");
      const [from, to] = el.querySelectorAll("input");
      const api = wonkControls.window(el);
      let fired = 0;
      el.addEventListener("change", () => fired++);

      from.dispatchEvent(new Event("change", { bubbles: true }));
      to.dispatchEvent(new Event("change", { bubbles: true }));

      assert(from.value === "2026-10-15", `from must keep its own typed value, got "${from.value}"`);
      assert(to.value === "2026-08-01", `to must keep its own typed value (never silently pulled to match from), got "${to.value}"`);
      assert(from.validationMessage !== "", "from should carry a visible custom validity message while crossed");
      assert(to.validationMessage !== "", "to should carry a visible custom validity message while crossed");
      assert(fired === 0, "change must not fire while the pair is crossed");
      assert(api.valid === false, "api.valid should be false while crossed");

      // fix it
      to.value = "2026-11-01";
      to.dispatchEvent(new Event("input", { bubbles: true })); // clears live as the user types
      assert(from.validationMessage === "", "from's custom validity should clear once the pair is fixed");
      assert(to.validationMessage === "", "to's custom validity should clear once the pair is fixed");
      to.dispatchEvent(new Event("change", { bubbles: true }));
      assert(fired === 1, "change should fire exactly once now that the pair is valid and ordered");
    } finally {
      cleanup();
    }
  });

  // -- window: set() validates and rejects invalid/crossed writes --
  check("window: set() rejects a crossed pair, rolls back, and throws", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-window">
        <legend>range</legend>
        <input type="date" value="2026-01-01">
        <input type="date" value="2026-02-01">
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-window");
      const [from, to] = el.querySelectorAll("input");
      const api = wonkControls.window(el);
      let threw = false;
      try {
        api.set({ from: "2026-12-01", to: "2026-01-01" });
      } catch {
        threw = true;
      }
      assert(threw, "set() with from after to should throw");
      assert(from.value === "2026-01-01" && to.value === "2026-02-01", "set() must roll back both fields on an invalid write");
    } finally {
      cleanup();
    }
  });

  // -- fader: empty native attrs never produce NaN --
  check("fader: no data-* and no native min/max/step/value never yields NaN", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-fader">
        <legend>plain fader</legend>
        <div class="wonk-fader-row">
          <input type="range" class="wonk-range">
          <input type="number" class="wonk-fader-exact">
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-fader");
      const range = el.querySelector(".wonk-range");
      const exact = el.querySelector(".wonk-fader-exact");
      const api = wonkControls.fader(el);
      assert(!Number.isNaN(api.value), "fader value must not be NaN with no attrs given");
      assert(range.min === "0" && range.max === "100", `expected default bounds 0/100, got ${range.min}/${range.max}`);
      assert(!Number.isNaN(parseFloat(exact.value)), "exact input must not be left showing NaN");
    } finally {
      cleanup();
    }
  });

  // -- fader: invalid/out-of-range exact entry is retained, not reverted or clamped --
  check("fader: an out-of-range exact value is retained and marked invalid, never silently reverted", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-fader" data-min="0" data-max="100" data-value="50">
        <legend>bounded fader</legend>
        <div class="wonk-fader-row">
          <input type="range" class="wonk-range">
          <input type="number" class="wonk-fader-exact">
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-fader");
      const range = el.querySelector(".wonk-range");
      const exact = el.querySelector(".wonk-fader-exact");
      const api = wonkControls.fader(el);
      const before = range.value;

      exact.value = "9999";
      exact.dispatchEvent(new Event("change", { bubbles: true }));

      assert(exact.value === "9999", `exact input text must be retained exactly as typed, got "${exact.value}"`);
      assert(!exact.checkValidity(), "exact input should be natively :invalid at 9999 with max=100");
      assert(range.value === before, `range must NOT be silently clamped/updated from an invalid exact entry (was ${before}, now ${range.value})`);
      assert(api.valid === false, "api.valid should reflect the invalid exact input");
    } finally {
      cleanup();
    }
  });

  // -- fader: an in-range, off-grid exact value is valid and gets snapped, not rejected --
  check("fader: an off-grid exact value within range is accepted and snapped, not painted invalid", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-fader" data-min="0" data-max="100" data-step="10" data-value="50">
        <legend>stepped fader</legend>
        <div class="wonk-fader-row">
          <input type="range" class="wonk-range">
          <input type="number" class="wonk-fader-exact">
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-fader");
      const range = el.querySelector(".wonk-range");
      const exact = el.querySelector(".wonk-fader-exact");
      const api = wonkControls.fader(el);

      exact.value = "23";
      assert(exact.checkValidity(), "an in-range off-grid value must not be natively :invalid (step must not constrain exact entry)");
      exact.dispatchEvent(new Event("change", { bubbles: true }));

      assert(range.value === "20", `off-grid exact entry should snap to the nearest step on commit, got range.value ${range.value}`);
      assert(exact.value === "20", `exact input should sync back to the snapped value, got ${exact.value}`);
      assert(api.valid === true, "api.valid should be true after a snapped commit");
    } finally {
      cleanup();
    }
  });

  // -- fader: aria-label on BOTH inputs, derived from the legend --
  check("fader: both range and exact inputs get an aria-label derived from the legend", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-fader" data-min="0" data-max="500" data-value="120">
        <legend>p95 latency alert</legend>
        <div class="wonk-fader-row">
          <input type="range" class="wonk-range">
          <input type="number" class="wonk-fader-exact">
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-fader");
      wonkControls.fader(el);
      const range = el.querySelector(".wonk-range");
      const exact = el.querySelector(".wonk-fader-exact");
      assert(range.getAttribute("aria-label") === "p95 latency alert", `range aria-label was "${range.getAttribute("aria-label")}"`);
      assert(
        exact.getAttribute("aria-label") === "p95 latency alert exact value",
        `exact aria-label was "${exact.getAttribute("aria-label")}"`
      );
    } finally {
      cleanup();
    }
  });

  // -- fader: Enter and blur never double-fire change --
  check("fader: pressing Enter in the exact field fires the range's change exactly once", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-fader" data-min="0" data-max="500" data-value="120">
        <legend>p95</legend>
        <div class="wonk-fader-row">
          <input type="range" class="wonk-range">
          <input type="number" class="wonk-fader-exact">
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-fader");
      wonkControls.fader(el);
      const range = el.querySelector(".wonk-range");
      const exact = el.querySelector(".wonk-fader-exact");
      let changeCount = 0;
      range.addEventListener("change", () => changeCount++);

      exact.value = "250";
      exact.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      // Enter calls exact.blur(), which fires the native "change" on exact,
      // which this control's single commit path turns into ONE change on range.
      exact.dispatchEvent(new Event("change", { bubbles: true }));

      assert(changeCount === 1, `range change should fire exactly once, fired ${changeCount} times`);
      assert(range.value === "250", `range should reflect the committed value, got ${range.value}`);
    } finally {
      cleanup();
    }
  });

  // -- stepper: invalid numeric config throws --
  check("stepper: min >= max throws instead of silently accepting a broken config", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-stepper" data-min="10" data-max="5">
        <legend>broken</legend>
        <div class="wonk-stepper-row">
          <button type="button" class="wonk-stepper-btn" data-dir="-1"></button>
          <input type="number" class="wonk-stepper-input">
          <button type="button" class="wonk-stepper-btn" data-dir="1"></button>
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-stepper");
      let threw = false;
      try {
        wonkControls.stepper(el);
      } catch {
        threw = true;
      }
      assert(threw, "wonkControls.stepper() should throw when data-min >= data-max");
    } finally {
      cleanup();
    }
  });

  // -- stepper: blank value is never defaulted to 0 --
  check("stepper: an input with no value and no data-value stays blank, not 0", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-stepper" data-min="0" data-max="100">
        <legend>blank</legend>
        <div class="wonk-stepper-row">
          <button type="button" class="wonk-stepper-btn" data-dir="-1"></button>
          <input type="number" class="wonk-stepper-input">
          <button type="button" class="wonk-stepper-btn" data-dir="1"></button>
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-stepper");
      wonkControls.stepper(el);
      const input = el.querySelector(".wonk-stepper-input");
      assert(input.value === "", `expected the input to stay blank, got "${input.value}"`);
    } finally {
      cleanup();
    }
  });

  // -- stepper: dynamic disabled is respected on click --
  check("stepper: disabling the fieldset AFTER wiring stops the buttons from changing the value", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-stepper" data-min="0" data-max="10" data-value="5">
        <legend>rows</legend>
        <div class="wonk-stepper-row">
          <button type="button" class="wonk-stepper-btn" data-dir="-1"></button>
          <input type="number" class="wonk-stepper-input">
          <button type="button" class="wonk-stepper-btn" data-dir="1"></button>
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-stepper");
      wonkControls.stepper(el);
      const input = el.querySelector(".wonk-stepper-input");
      const plus = el.querySelector('.wonk-stepper-btn[data-dir="1"]');

      el.disabled = true; // dynamic, AFTER wiring -- native fieldset disabling cascades to input + both buttons
      const before = input.value;
      plus.click();
      assert(input.value === before, `value must not change while disabled (was ${before}, now ${input.value})`);
    } finally {
      cleanup();
    }
  });

  // -- stepper: uses native stepUp()/stepDown() --
  check("stepper: the + button uses native stepUp() semantics (value ends step-aligned)", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-stepper" data-min="0" data-max="10" data-step="2" data-value="4">
        <legend>step2</legend>
        <div class="wonk-stepper-row">
          <button type="button" class="wonk-stepper-btn" data-dir="-1"></button>
          <input type="number" class="wonk-stepper-input">
          <button type="button" class="wonk-stepper-btn" data-dir="1"></button>
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-stepper");
      wonkControls.stepper(el);
      const input = el.querySelector(".wonk-stepper-input");
      const plus = el.querySelector('.wonk-stepper-btn[data-dir="1"]');
      plus.click();
      assert(input.valueAsNumber === 6, `expected native stepUp() to land on 6, got ${input.value}`);
    } finally {
      cleanup();
    }
  });

  // -- segmented: destroy() removes has-glide along with the glide element --
  check("segmented: destroy() removes both the glide element and the has-glide class", () => {
    const { host, cleanup } = withFixture(`
      <fieldset class="wonk-segmented">
        <legend>view</legend>
        <div class="wonk-segmented-track">
          <label><input type="radio" name="ccheck-view" value="a" checked><span>a</span></label>
          <label><input type="radio" name="ccheck-view" value="b"><span>b</span></label>
        </div>
      </fieldset>
    `);
    try {
      const el = host.querySelector(".wonk-segmented");
      const track = el.querySelector(".wonk-segmented-track");
      const api = wonkControls.segmented(el);
      assert(track.classList.contains("has-glide"), "has-glide should be set once wired (unless reduced motion)");
      api.destroy();
      assert(!track.classList.contains("has-glide"), "has-glide must be removed by destroy()");
      assert(!track.querySelector(".wonk-segmented-glide"), "the glide element must be removed by destroy()");
    } finally {
      cleanup();
    }
  });

  // -- knob: validates finite min < max, step > 0, finite value --
  check("knob: throws on min >= max, on step <= 0, and on a non-finite value", () => {
    const cases = [
      { attrs: 'data-min="10" data-max="5"', label: "min >= max" },
      { attrs: 'data-min="0" data-max="10" data-step="0"', label: "step == 0" },
      { attrs: 'data-min="0" data-max="10" data-step="-1"', label: "step < 0" },
      { attrs: 'data-min="0" data-max="10" data-value="not-a-number"', label: "non-numeric value" },
    ];
    for (const c of cases) {
      const { host, cleanup } = withFixture(`<div data-wonk-knob ${c.attrs}></div>`);
      try {
        const el = host.querySelector("[data-wonk-knob]");
        let threw = false;
        try {
          wonk.knob(el);
        } catch {
          threw = true;
        }
        assert(threw, `wonk.knob() should throw for case: ${c.label}`);
      } finally {
        cleanup();
      }
    }
  });

  // -- knob: set() throws on non-finite input --
  check("knob: set(NaN) throws instead of silently no-op-ing", () => {
    const { host, cleanup } = withFixture(`<div data-wonk-knob data-min="0" data-max="10" data-value="5"></div>`);
    try {
      const el = host.querySelector("[data-wonk-knob]");
      const api = wonk.knob(el);
      let threw = false;
      try {
        api.set(NaN);
      } catch {
        threw = true;
      }
      assert(threw, "handle.set(NaN) should throw");
      assert(api.value === 5, "value should be unchanged after the rejected set()");
    } finally {
      cleanup();
    }
  });

  // -- knob: pointercancel settles the drag WITHOUT firing "change" --
  check("knob: pointercancel fires no change (only pointerup commits)", () => {
    const { host, cleanup } = withFixture(`<div data-wonk-knob data-min="0" data-max="100" data-value="50"></div>`);
    try {
      const el = host.querySelector("[data-wonk-knob]");
      wonk.knob(el);
      const svg = el.querySelector("svg");
      let inputCount = 0, changeCount = 0;
      el.addEventListener("input", () => inputCount++);
      el.addEventListener("change", () => changeCount++);

      dispatchPointer(svg, "pointerdown", { clientY: 100 });
      dispatchPointer(svg, "pointermove", { clientY: 50 }); // dragged up -> value increased
      dispatchPointer(svg, "pointercancel");

      assert(inputCount > 0, "input should have fired at least once during the move");
      assert(changeCount === 0, `pointercancel must not commit -- change fired ${changeCount} times`);

      // now prove pointerup DOES commit, on a fresh drag
      dispatchPointer(svg, "pointerdown", { clientY: 100 });
      dispatchPointer(svg, "pointermove", { clientY: 40 });
      dispatchPointer(svg, "pointerup");
      assert(changeCount === 1, `pointerup should commit exactly once, fired ${changeCount} times total`);
    } finally {
      cleanup();
    }
  });

  // -- init(scope): wires scope itself as a knob --
  check("init(scope): wires scope itself when scope is a [data-wonk-knob]", () => {
    const { host, cleanup } = withFixture(`<div data-wonk-knob data-min="0" data-max="10" data-value="5"></div>`);
    try {
      const el = host.querySelector("[data-wonk-knob]");
      wonkControls.init(el);
      assert(!!el.wonkKnob, "el.wonkKnob should be set after init(el) where el itself is the knob");
    } finally {
      cleanup();
    }
  });

  // -- init(scope): never calls the broader, non-idempotent wonk.init() --
  check("init(scope): does not call the broader wonk.init() (would re-wire unrelated legacy widgets)", () => {
    const { host, cleanup } = withFixture(`
      <div>
        <div data-wonk-knob data-min="0" data-max="10" data-value="5"></div>
      </div>
    `);
    try {
      const scope = host.firstElementChild;
      const original = window.wonk.init;
      let called = false;
      window.wonk.init = (...args) => {
        called = true;
        return original.apply(window.wonk, args);
      };
      try {
        wonkControls.init(scope);
      } finally {
        window.wonk.init = original;
      }
      assert(called === false, "wonkControls.init(scope) must not call wonk.init(scope) -- it should wire the knob directly via wonk.knob()");
      assert(!!scope.querySelector("[data-wonk-knob]").wonkKnob, "the knob inside scope should still be wired directly");
    } finally {
      cleanup();
    }
  });

  // ---- runner ----
  async function run() {
    const results = [];
    for (const { name, fn } of checks) {
      try {
        await fn();
        results.push({ name, pass: true, message: "ok" });
      } catch (err) {
        results.push({ name, pass: false, message: err && err.message ? err.message : String(err) });
      }
    }
    const failed = results.filter((r) => !r.pass);
    try {
      console.table(results);
    } catch {
      results.forEach((r) => console.log(`[${r.pass ? "PASS" : "FAIL"}] ${r.name} -- ${r.message}`));
    }
    console.log(`wonkControlsChecks: ${results.length - failed.length}/${results.length} passed`);
    return results;
  }

  window.wonkControlsChecks = { run, checks };
})();
