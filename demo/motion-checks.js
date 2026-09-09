/* ============================================================
   motion-checks.js · browser-callable checks for wonk-motion
   Not loaded automatically. Open demo/motion.html, then in the
   console:

     await wonkMotionChecks.run();

   Builds its own off-screen scratch DOM (not the visible gallery),
   runs every check, logs pass/fail, and returns
   { passed, failed, results }. No dependencies beyond wonk-motion.js
   already being loaded on the page. No network calls.
   ============================================================ */
(() => {
  "use strict";

  const checks = [];
  function check(name, fn) { checks.push({ name, fn }); }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
  }

  async function assertRejects(promise, msg) {
    let threw = false;
    try { await promise; } catch (e) { threw = true; }
    assert(threw, msg || "expected promise to reject");
  }

  // ---- scratch DOM, off-screen but not display:none (animations
  // don't reliably fire events on display:none elements) ----
  function makeScratch() {
    const root = document.createElement("div");
    root.style.cssText = "position:absolute; left:-9999px; top:0; width:200px;";
    document.body.appendChild(root);
    return root;
  }

  function el(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  // fires a synthetic animation event on `target`, bubbling to
  // whatever ancestor is listening. Used to test event-scoping logic
  // without waiting on real CSS timing.
  function fireAnim(type, target, animationName) {
    target.dispatchEvent(new AnimationEvent(type, { animationName, bubbles: true }));
  }

  // ---- loads a second, isolated copy of wonk-motion.js into a
  // throwaway iframe with a mocked matchMedia, so reduced-motion
  // checks can flip the preference on demand without touching the
  // real OS setting or the page's already-initialized module. ----
  function loadIsolatedInstance() {
    const assetURL = new URL("../assets/wonk-motion.js", document.baseURI).href;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute; width:0; height:0; border:0; visibility:hidden;";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      doc.open();
      doc.write(
        "<!doctype html><html><head><style>:root{" +
        ["--ak-t-fast", "--ak-t-med", "--ak-t-slow", "--ak-ease", "--ak-ease-out", "--ak-wash", "--ak-ok", "--ak-a1", "--ak-radius"]
          .map((name) => `${name}:${getComputedStyle(document.documentElement).getPropertyValue(name)};`).join("") +
        "}</style></head><body></body></html>"
      );
      doc.close();

      const realMatchMedia = win.matchMedia.bind(win);
      const state = { matches: false, listeners: [] };
      win.matchMedia = function (query) {
        if (query.indexOf("prefers-reduced-motion") === -1) return realMatchMedia(query);
        return {
          get matches() { return state.matches; },
          media: query,
          addEventListener(type, cb) { if (type === "change") state.listeners.push(cb); },
          removeEventListener(type, cb) {
            state.listeners = state.listeners.filter((fn) => fn !== cb);
          },
        };
      };

      const script = doc.createElement("script");
      script.src = assetURL;
      script.onload = () => resolve({
        win,
        setReduced(val) {
          state.matches = val;
          state.listeners.slice().forEach((cb) => cb({ matches: val }));
        },
        cleanup() { iframe.remove(); },
      });
      script.onerror = () => reject(new Error("could not load " + assetURL + " into isolated iframe"));
      doc.body.appendChild(script);
    });
  }

  // ============================================================
  // the 8 effects, played for real, waiting on the real promise
  // ============================================================
  const EFFECT_FIXTURES = {
    "panel-enter": () => el(`<div></div>`),
    "panel-exit": () => el(`<div></div>`),
    "value-changed": () => el(`<span></span>`),
    "row-inserted": () => el(`<div></div>`),
    "filter-applied": () => el(`<div></div>`),
    "progress-complete": () => el(`<div class="wonk-progress"><span style="width:100%"></span></div>`),
    "trace-draw": () => el(
      `<svg viewBox="0 0 10 10"><path data-wonk-trace pathLength="1" d="M0,0 L10,10"/></svg>`
    ),
    "confirm-check": () => el(
      `<svg viewBox="0 0 10 10"><g data-wonk-pop>` +
      `<circle data-wonk-trace pathLength="1" cx="5" cy="5" r="4"/>` +
      `<path data-wonk-trace pathLength="1" d="M2,5 L4,7 L8,3"/>` +
      `</g></svg>`
    ),
  };

  wonkMotion.effects.forEach((name) => {
    check(`play("${name}") resolves done and leaves clean state`, async () => {
      const scratch = makeScratch();
      const build = EFFECT_FIXTURES[name];
      const target = build();
      scratch.appendChild(target);
      const playTarget = name === "progress-complete" ? target.querySelector("span") : target;

      const result = await wonkMotion.play(playTarget, name);
      assert(result.status === "done", `expected status "done", got "${result.status}"`);
      assert(!playTarget.hasAttribute("data-wonk-motion-state"), "running state should be cleared");
      assert(![...playTarget.classList].some((name) => name.startsWith("wonk-anim-")), "animation class should be removed");
      if (name === "progress-complete") {
        assert(playTarget.classList.contains("wonk-motion-done"), "progress bar should keep the done class");
      }
      scratch.remove();
    });
  });

  // ============================================================
  // overlap: a second play() cancels the first
  // ============================================================
  check("overlapping play() cancels the first call", async () => {
    const scratch = makeScratch();
    const target = el(`<div></div>`);
    scratch.appendChild(target);

    const first = wonkMotion.play(target, "panel-enter");
    const second = wonkMotion.play(target, "panel-enter");
    fireAnim("animationend", target, "wonk-panel-enter"); // settles the second run

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert(firstResult.status === "cancelled", `expected first call cancelled, got "${firstResult.status}"`);
    assert(secondResult.status === "done", `expected second call done, got "${secondResult.status}"`);
    scratch.remove();
  });

  // ============================================================
  // manual cancel()
  // ============================================================
  check("cancel() interrupts a running effect", async () => {
    const scratch = makeScratch();
    const target = el(`<div></div>`);
    scratch.appendChild(target);

    const pending = wonkMotion.play(target, "row-inserted");
    wonkMotion.cancel(target);
    const result = await pending;

    assert(result.status === "cancelled", `expected "cancelled", got "${result.status}"`);
    assert(!target.hasAttribute("data-wonk-motion-state"), "running state should be cleared");
    assert(!target.classList.contains("wonk-anim-row-inserted"), "animation class should be removed");
    scratch.remove();
  });

  // ============================================================
  // a genuine animationcancel resolves "cancelled", not "done"
  // ============================================================
  check("animationcancel event resolves cancelled", async () => {
    const scratch = makeScratch();
    const target = el(`<div></div>`);
    scratch.appendChild(target);

    const pending = wonkMotion.play(target, "panel-enter");
    fireAnim("animationcancel", target, "wonk-panel-enter");
    const result = await pending;

    assert(result.status === "cancelled", `expected "cancelled", got "${result.status}"`);
    scratch.remove();
  });

  // ============================================================
  // nested elements: an unrelated animationend bubbling from inside
  // the same container, with a matching animation name but from a
  // non-target element, must not finish the effect early
  // ============================================================
  check("unrelated nested animationend does not finish the effect early", async () => {
    const scratch = makeScratch();
    // trace-draw targets only [data-wonk-trace]; the plain circle is
    // a bystander inside the same svg, not a wonk-motion target.
    const target = el(
      `<svg viewBox="0 0 10 10">` +
      `<path class="p1" data-wonk-trace pathLength="1" d="M0,0 L10,10"/>` +
      `<path class="p2" data-wonk-trace pathLength="1" d="M0,10 L10,0"/>` +
      `<circle class="ghost" cx="5" cy="5" r="1"/>` +
      `</svg>`
    );
    scratch.appendChild(target);
    const ghost = target.querySelector(".ghost");
    const p1 = target.querySelector(".p1");
    const p2 = target.querySelector(".p2");

    const pending = wonkMotion.play(target, "trace-draw");
    let settled = false;
    pending.then(() => { settled = true; });

    // bubbles up to `target`, matches the real animation name, but
    // originates from an element wonk-motion never started an
    // animation on. Must be ignored.
    fireAnim("animationend", ghost, "wonk-trace-draw");
    await Promise.resolve(); // flush microtasks
    assert(!settled, "effect resolved early from an unrelated element's animationend");

    // only after BOTH real targets report in should the effect settle.
    fireAnim("animationend", p1, "wonk-trace-draw");
    await Promise.resolve();
    assert(!settled, "effect resolved before every real target settled");
    fireAnim("animationend", p2, "wonk-trace-draw");

    const result = await pending;
    assert(result.status === "done", `expected "done", got "${result.status}"`);
    scratch.remove();
  });

  // ============================================================
  // a duplicate event on an already-settled target is a safe no-op
  // ============================================================
  check("duplicate animationend on the same target does not throw", async () => {
    const scratch = makeScratch();
    const target = el(`<div></div>`);
    scratch.appendChild(target);

    const pending = wonkMotion.play(target, "panel-enter");
    fireAnim("animationend", target, "wonk-panel-enter");
    await pending;
    // effect already settled and cleaned up; a stray duplicate event
    // must not throw or resolve anything a second time.
    fireAnim("animationend", target, "wonk-panel-enter");
    scratch.remove();
  });

  // ============================================================
  // invalid input: rejects, never silently no-ops
  // ============================================================
  check("play() rejects an unknown effect name", async () => {
    await assertRejects(wonkMotion.play(el(`<div></div>`), "not-a-real-effect"));
  });

  check("play() rejects a non-Element target", async () => {
    await assertRejects(wonkMotion.play(null, "panel-enter"));
    await assertRejects(wonkMotion.play({}, "panel-enter"));
  });

  check("play() rejects trace-draw with no [data-wonk-trace] descendant", async () => {
    const scratch = makeScratch();
    const target = el(`<svg viewBox="0 0 10 10"><path d="M0,0 L10,10"/></svg>`);
    scratch.appendChild(target);
    await assertRejects(wonkMotion.play(target, "trace-draw"));
    scratch.remove();
  });

  check("play() rejects a traced element missing pathLength=\"1\"", async () => {
    const scratch = makeScratch();
    const target = el(`<svg viewBox="0 0 10 10"><path data-wonk-trace d="M0,0 L10,10"/></svg>`);
    scratch.appendChild(target);
    await assertRejects(wonkMotion.play(target, "trace-draw"));
    scratch.remove();
  });

  // ============================================================
  // reduced motion: already on, and flipped on mid-flight.
  // Uses an isolated iframe instance so this never touches the
  // real page's module or the user's actual OS setting.
  // ============================================================
  check("reduced motion already on: settles synchronously, no transient class", async () => {
    const instance = await loadIsolatedInstance();
    try {
      instance.setReduced(true);
      const doc = instance.win.document;
      const target = doc.createElement("div");
      doc.body.appendChild(target);

      const promise = instance.win.wonkMotion.play(target, "panel-enter");
      // still the same tick: the animation class must never be added
      // when reduced motion is already on.
      assert(!target.classList.contains("wonk-anim-panel-enter"), "should never add the animation class");
      assert(!target.hasAttribute("data-wonk-motion-state"), "should never mark running state");

      const result = await promise;
      assert(result.status === "done", `expected "done", got "${result.status}"`);
    } finally {
      instance.cleanup();
    }
  });

  check("reduced motion already on: progress-complete keeps final fill state", async () => {
    const instance = await loadIsolatedInstance();
    try {
      instance.setReduced(true);
      const doc = instance.win.document;
      const bar = doc.createElement("div");
      bar.className = "wonk-progress";
      const fill = doc.createElement("span");
      bar.appendChild(fill);
      doc.body.appendChild(bar);

      const result = await instance.win.wonkMotion.play(fill, "progress-complete");
      assert(result.status === "done", `expected "done", got "${result.status}"`);
      assert(fill.classList.contains("wonk-motion-done"), "fill should carry the persisted done class");
    } finally {
      instance.cleanup();
    }
  });

  check("reduced motion flipped on mid-flight settles the pending effect", async () => {
    const instance = await loadIsolatedInstance();
    try {
      const doc = instance.win.document;
      const target = doc.createElement("div");
      doc.body.appendChild(target);

      const promise = instance.win.wonkMotion.play(target, "panel-enter");
      assert(target.classList.contains("wonk-anim-panel-enter"), "animation should be running normally first");

      instance.setReduced(true); // flip mid-flight, no animationend fired
      const result = await promise;
      assert(result.status === "done", `expected "done", got "${result.status}"`);
      assert(!target.hasAttribute("data-wonk-motion-state"), "running state should be cleared");
    } finally {
      instance.cleanup();
    }
  });

  // ============================================================
  // runner
  // ============================================================
  async function run() {
    const results = [];
    for (const c of checks) {
      try {
        await c.fn();
        results.push({ name: c.name, pass: true });
        console.log("PASS " + c.name);
      } catch (err) {
        results.push({ name: c.name, pass: false, error: (err && err.message) || String(err) });
        console.error("FAIL " + c.name + ": " + ((err && err.message) || err));
      }
    }
    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    console.log(`wonk-motion checks: ${passed} passed, ${failed} failed`);
    return { passed, failed, results };
  }

  window.wonkMotionChecks = { run };
})();
