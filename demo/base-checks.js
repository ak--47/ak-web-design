/* ============================================================
   demo/base-checks.js · browser-callable checks for wonk.js base
   behaviors (window.wonk: idempotent init, reduced motion, toast,
   setTheme, setPair, tabs, spark, menu, reveal), token contrast, and
   focus rings.
   Runs headless via `npm test` (or `npm test -- base`). By hand:
   load it on any page that already has wonk.js loaded (e.g.
   demo/index.html), then call:

     await wonkBaseChecks.run();

   Every check builds its own hidden fixture DOM and tears it down
   after itself, and restores any <html> attribute it changes. No
   dependency on any specific host page's markup, no network calls.
   Returns { passed, failed, results } where each result is
   { name, pass, message } (message is "ok" on pass), and also prints
   a console.table().
   ============================================================ */
(() => {
  "use strict";

  const checks = [];
  function check(name, fn) { checks.push({ name, fn }); }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
  }

  function withFixture(html) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; left:-9999px; top:0; width:400px;";
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  }

  // Restores one <html> attribute to its value before the check ran
  // (removing it if it was absent).
  function restoreRootAttr(name, original) {
    const root = document.documentElement;
    if (original === null) root.removeAttribute(name);
    else root.setAttribute(name, original);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  // Runs fn with win[name] replaced by a recording wrapper around the
  // real timer function; returns { result, calls } where each call is
  // { args, ret }. Always restores the real function.
  function withTimerSpy(win, name, fn) {
    const real = win[name];
    const calls = [];
    win[name] = function (...args) {
      const ret = real.apply(win, args);
      calls.push({ args, ret });
      return ret;
    };
    try {
      return { result: fn(calls), calls };
    } finally {
      win[name] = real;
    }
  }

  // ---- loads a second, isolated copy of wonk.js into a throwaway
  // iframe with a mocked matchMedia, so reduced-motion checks can flip
  // the preference on demand without touching the real OS setting or
  // the page's already-initialized module (same technique as
  // demo/motion-checks.js). ----
  function loadIsolatedWonk() {
    const assetURL = new URL("../assets/wonk.js", document.baseURI).href;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute; width:0; height:0; border:0; visibility:hidden;";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      doc.open();
      doc.write("<!doctype html><html><head></head><body></body></html>");
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
            state.listeners = state.listeners.filter((f) => f !== cb);
          },
        };
      };

      const script = doc.createElement("script");
      script.src = assetURL;
      script.onload = () => resolve({
        win,
        doc,
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

  // ---- idempotent wiring ----
  // Deterministic method: wonk.js schedules each live-jitter tick with
  // the global setTimeout. After a first init() starts the loop, spy on
  // setTimeout during a second init(): a second loop would call its first
  // tick synchronously and schedule a timer; an idempotent init schedules
  // nothing. No waiting on random jitter timing.
  check("init(scope) twice on a live dot runs one jitter loop (second init schedules nothing)", () => {
    const host = withFixture(`<span class="wonk-dot wonk-dot--live" data-wonk-live></span>`);
    try {
      wonk.init(host);
      const { calls } = withTimerSpy(window, "setTimeout", () => wonk.init(host));
      assert(calls.length === 0, `second init scheduled ${calls.length} timer(s); expected 0`);
      const { calls: direct } = withTimerSpy(window, "setTimeout", () => wonk.live(host.querySelector("[data-wonk-live]")));
      assert(direct.length === 0, `a repeat wonk.live(el) scheduled ${direct.length} timer(s); expected 0`);
    } finally {
      host.remove();
    }
  });

  check("secret reveals exactly once on the 7th click after a double init", () => {
    const msg = "wonk-base-check-secret-" + Math.random().toString(36).slice(2);
    const host = withFixture(`<span data-wonk-secret="${msg}">x</span>`);
    const countToasts = () =>
      [...document.querySelectorAll(".wonk-toast")].filter((t) => t.textContent.includes(msg)).length;
    try {
      wonk.init(host);
      wonk.init(host);
      const el = host.querySelector("[data-wonk-secret]");
      for (let i = 0; i < 6; i++) el.click();
      assert(countToasts() === 0, `expected no reveal after 6 clicks, got ${countToasts()} toast(s)`);
      el.click();
      assert(countToasts() === 1, `expected exactly 1 reveal on the 7th click, got ${countToasts()}`);
    } finally {
      document.querySelectorAll(".wonk-toast").forEach((t) => { if (t.textContent.includes(msg)) t.remove(); });
      host.remove();
    }
  });

  check("glyph clears its interval once the element is removed", () => {
    const host = withFixture(`<span data-wonk-glyph>x</span>`);
    const el = host.querySelector("[data-wonk-glyph]");
    let id = null;
    try {
      const { calls } = withTimerSpy(window, "setInterval", () => wonk.glyph(el));
      assert(calls.length === 1, `expected glyph to start one interval, got ${calls.length}`);
      const [{ args: [tick], ret }] = calls;
      id = ret;
      host.remove();
      const before = el.textContent;
      const { calls: cleared } = withTimerSpy(window, "clearInterval", () => tick());
      assert(cleared.some((c) => c.args[0] === id), "a tick after removal should clear its own interval");
      assert(el.textContent === before, "a tick after removal should not swap the glyph");
    } finally {
      host.remove();
      if (id !== null) clearInterval(id);
    }
  });

  check("reduced motion flipped on mid-session stops live and vu loops; flipped off resumes them", async () => {
    const iso = await loadIsolatedWonk();
    try {
      const { win, doc } = iso;
      const dot = doc.createElement("span");
      dot.setAttribute("data-wonk-live", "");
      const meter = doc.createElement("div");
      meter.setAttribute("data-wonk-vu", "6");
      doc.body.append(dot, meter);
      win.wonk.live(dot);
      win.wonk.vu(meter);
      assert(dot.style.animationName === "none", `live should take over the CSS animation, got "${dot.style.animationName}"`);

      iso.setReduced(true);
      assert(dot.style.opacity === "", `live should reset inline opacity on reduce, got "${dot.style.opacity}"`);
      assert(dot.style.animation === "", `live should reset inline animation on reduce, got "${dot.style.animation}"`);
      const heights = () => [...meter.querySelectorAll(".bar")].map((b) => b.style.height).join(",");
      const frozen = heights();
      const real = win.setTimeout;
      let scheduled = 0;
      win.setTimeout = function (...args) { scheduled++; return real.apply(win, args); };
      try {
        await sleep(300);
      } finally {
        win.setTimeout = real;
      }
      assert(scheduled === 0, `no loop should schedule timers while reduced, got ${scheduled}`);
      assert(heights() === frozen, "vu bars should hold still while reduced");

      iso.setReduced(false);
      assert(dot.style.animationName === "none", "live should resume when reduced motion turns off");
      await sleep(300);
      assert(heights() !== frozen, "vu should resume self-animating when reduced motion turns off");
    } finally {
      iso.cleanup();
    }
  });

  // ---- toast ----
  check("toast(\"x\", \"ok\") appends a .wonk-toast--ok with text x inside .wonk-toasts", () => {
    const hadHost = !!document.querySelector(".wonk-toasts");
    let t = null;
    try {
      t = wonk.toast("x", "ok");
      const host = document.querySelector(".wonk-toasts");
      assert(!!host, "expected a .wonk-toasts host to exist after toast()");
      assert(t instanceof Element, "toast() should return the toast element");
      assert(t.parentElement === host, "toast element should be a child of .wonk-toasts");
      assert(t.classList.contains("wonk-toast--ok"), `expected class wonk-toast--ok, got "${t.className}"`);
      assert(t.textContent === "x", `expected text "x", got "${t.textContent}"`);
    } finally {
      if (t) t.remove();
      const host = document.querySelector(".wonk-toasts");
      if (!hadHost && host && !host.children.length) host.remove();
    }
  });

  check("toast host is a polite status live region; an err toast is role=alert", () => {
    const made = [];
    try {
      made.push(wonk.toast("polite one", "info"));
      const host = document.querySelector(".wonk-toasts");
      assert(host.getAttribute("aria-live") === "polite", `host aria-live should be "polite", got ${host.getAttribute("aria-live")}`);
      assert(host.getAttribute("role") === "status", `host role should be "status", got ${host.getAttribute("role")}`);
      const err = wonk.toast("loud one", "err");
      made.push(err);
      assert(err.getAttribute("role") === "alert", `err toast role should be "alert", got ${err.getAttribute("role")}`);
      assert(made[0].getAttribute("role") !== "alert", "a non-err toast must not be role=alert");
    } finally {
      made.forEach((t) => t.remove());
    }
  });

  check("toast has a Dismiss button that removes it", () => {
    const t = wonk.toast("dismiss me", "ok");
    try {
      const btn = t.querySelector("button[aria-label='Dismiss']");
      assert(!!btn, "expected a button[aria-label=Dismiss] inside the toast");
      btn.click();
      assert(!t.isConnected, "clicking Dismiss should remove the toast");
    } finally {
      t.remove();
    }
  });

  check("toast fired while a modal dialog is open lands inside the dialog, pinned to the viewport corner", async () => {
    const dlg = document.createElement("dialog");
    dlg.className = "wonk-modal";
    dlg.textContent = "fixture modal";
    document.body.appendChild(dlg);
    let t = null;
    try {
      dlg.showModal();
      t = wonk.toast("inside the modal", "info");
      assert(dlg.contains(t), "toast should be a descendant of the open modal dialog");
      await sleep(400); // let the wonk-pop open animation finish (its transform ends as none)
      const r = t.closest(".wonk-toasts").getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(t.closest(".wonk-toasts")).right);
      assert(Math.abs(window.innerWidth - r.right - gap) < 2, `host should pin ${gap}px from the viewport's right edge, right=${r.right} innerWidth=${window.innerWidth}`);
      assert(Math.abs(window.innerHeight - r.bottom - gap) < 2, `host should pin ${gap}px from the viewport's bottom edge, bottom=${r.bottom} innerHeight=${window.innerHeight}`);
    } finally {
      if (t) t.remove();
      dlg.close();
      dlg.remove();
    }
  });

  // ---- theme ----
  check("setTheme(\"paper\") sets data-theme=paper on <html>; setTheme(\"dark\") removes it", () => {
    const root = document.documentElement;
    const original = root.getAttribute("data-theme");
    try {
      wonk.setTheme("paper");
      assert(root.getAttribute("data-theme") === "paper", `expected data-theme="paper", got ${JSON.stringify(root.getAttribute("data-theme"))}`);
      wonk.setTheme("dark");
      assert(!root.hasAttribute("data-theme"), `expected no data-theme after setTheme("dark"), got ${JSON.stringify(root.getAttribute("data-theme"))}`);
    } finally {
      restoreRootAttr("data-theme", original);
    }
  });

  // ---- pair ----
  check("setPair(\"glorpla\") sets data-pair=glorpla on <html>", () => {
    const root = document.documentElement;
    const original = root.getAttribute("data-pair");
    try {
      wonk.setPair("glorpla");
      assert(root.getAttribute("data-pair") === "glorpla", `expected data-pair="glorpla", got ${JSON.stringify(root.getAttribute("data-pair"))}`);
    } finally {
      restoreRootAttr("data-pair", original);
    }
  });

  // ---- tabs ----
  check("tabs(root): clicking tab 2 hides panel 1, shows panel 2, and selects tab 2", () => {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="wonk-tabs">
        <button type="button" class="wonk-tab" data-panel="#${id}-1" aria-selected="true">one</button>
        <button type="button" class="wonk-tab" data-panel="#${id}-2" aria-selected="false">two</button>
      </div>
      <div id="${id}-1">panel one</div>
      <div id="${id}-2" hidden>panel two</div>
    `);
    try {
      const root = host.querySelector(".wonk-tabs");
      const [, tab2] = host.querySelectorAll(".wonk-tab");
      const panel1 = host.querySelector(`#${id}-1`);
      const panel2 = host.querySelector(`#${id}-2`);
      wonk.tabs(root);
      tab2.click();
      assert(panel1.hidden === true, "panel 1 should be hidden after clicking tab 2");
      assert(panel2.hidden === false, "panel 2 should not be hidden after clicking tab 2");
      assert(tab2.getAttribute("aria-selected") === "true", `expected tab 2 aria-selected="true", got ${JSON.stringify(tab2.getAttribute("aria-selected"))}`);
    } finally {
      host.remove();
    }
  });

  // builds a three-tab fixture; returns { host, root, tabs, panels, cleanup }
  function tabsFixture({ selected = 0, hideAll = false } = {}) {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="wonk-tabs">
        ${[0, 1, 2].map((i) =>
          `<button type="button" class="wonk-tab" data-panel="#${id}-${i}"${i === selected ? ' aria-selected="true"' : ""}>t${i}</button>`
        ).join("")}
      </div>
      ${[0, 1, 2].map((i) => `<div id="${id}-${i}"${hideAll ? " hidden" : ""}>panel ${i}</div>`).join("")}
    `);
    return {
      host,
      root: host.querySelector(".wonk-tabs"),
      tabs: [...host.querySelectorAll(".wonk-tab")],
      panels: [0, 1, 2].map((i) => host.querySelector(`#${id}-${i}`)),
    };
  }
  const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

  check("tabs(root): sets tablist/tab/tabpanel roles, ids, aria-controls, aria-labelledby, roving tabindex", () => {
    const { host, root, tabs, panels } = tabsFixture({ selected: 1 });
    try {
      wonk.tabs(root);
      assert(root.getAttribute("role") === "tablist", `root role should be tablist, got ${root.getAttribute("role")}`);
      tabs.forEach((t, i) => {
        assert(t.getAttribute("role") === "tab", `tab ${i} role should be tab, got ${t.getAttribute("role")}`);
        assert(!!t.id, `tab ${i} should have an id`);
        assert(t.getAttribute("aria-controls") === panels[i].id, `tab ${i} aria-controls should be "${panels[i].id}", got ${t.getAttribute("aria-controls")}`);
        assert(panels[i].getAttribute("role") === "tabpanel", `panel ${i} role should be tabpanel`);
        assert(panels[i].getAttribute("aria-labelledby") === t.id, `panel ${i} aria-labelledby should be the tab id`);
        const wantIdx = i === 1 ? "0" : "-1";
        assert(t.getAttribute("tabindex") === wantIdx, `tab ${i} tabindex should be ${wantIdx}, got ${t.getAttribute("tabindex")}`);
      });
    } finally {
      host.remove();
    }
  });

  check("tabs(root): ArrowRight/ArrowLeft (wrapping), Home, End move selection and focus", () => {
    const { host, root, tabs, panels } = tabsFixture();
    try {
      wonk.tabs(root);
      tabs[0].focus();
      key(tabs[0], "ArrowRight");
      assert(tabs[1].getAttribute("aria-selected") === "true", "ArrowRight should select tab 1");
      assert(document.activeElement === tabs[1], "ArrowRight should move focus to tab 1");
      assert(panels[1].hidden === false && panels[0].hidden === true, "ArrowRight should show panel 1 only");
      key(tabs[1], "End");
      assert(document.activeElement === tabs[2] && tabs[2].getAttribute("aria-selected") === "true", "End should select + focus the last tab");
      key(tabs[2], "ArrowRight");
      assert(document.activeElement === tabs[0] && tabs[0].getAttribute("aria-selected") === "true", "ArrowRight on the last tab should wrap to the first");
      key(tabs[0], "ArrowLeft");
      assert(document.activeElement === tabs[2], "ArrowLeft on the first tab should wrap to the last");
      key(tabs[2], "Home");
      assert(document.activeElement === tabs[0] && tabs[0].getAttribute("tabindex") === "0", "Home should select + focus the first tab (tabindex 0)");
      assert(tabs[2].getAttribute("tabindex") === "-1", "unselected tabs should have tabindex -1");
    } finally {
      host.remove();
    }
  });

  check("tabs(root): a tab with no data-panel does not throw and the other tabs still work", () => {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="wonk-tabs">
        <button type="button" class="wonk-tab" aria-selected="true" data-panel="#${id}-1">one</button>
        <button type="button" class="wonk-tab">orphan</button>
        <button type="button" class="wonk-tab" data-panel="#${id}-3">three</button>
      </div>
      <div id="${id}-1">panel one</div>
      <div id="${id}-3" hidden>panel three</div>
    `);
    const realWarn = console.warn;
    let warned = 0;
    console.warn = () => { warned++; };
    try {
      const root = host.querySelector(".wonk-tabs");
      const tabs = host.querySelectorAll(".wonk-tab");
      wonk.tabs(root);
      assert(warned === 1, `expected exactly one console.warn for the orphan tab, got ${warned}`);
      tabs[2].click();
      assert(host.querySelector(`#${id}-3`).hidden === false, "panel three should show after clicking tab three");
      assert(host.querySelector(`#${id}-1`).hidden === true, "panel one should hide after clicking tab three");
    } finally {
      console.warn = realWarn;
      host.remove();
    }
  });

  check("tabs(root): wiring syncs panels to the selected tab (first tab when none is selected)", () => {
    const a = tabsFixture({ selected: 2 });
    const b = tabsFixture({ selected: -1, hideAll: false });
    try {
      wonk.tabs(a.root);
      assert(a.panels.map((p) => p.hidden).join() === "true,true,false", `expected only panel 2 visible, got hidden=${a.panels.map((p) => p.hidden)}`);
      wonk.tabs(b.root);
      assert(b.tabs[0].getAttribute("aria-selected") === "true", "with no selected tab, the first tab should be selected");
      assert(b.panels.map((p) => p.hidden).join() === "false,true,true", `expected only panel 0 visible, got hidden=${b.panels.map((p) => p.hidden)}`);
    } finally {
      a.host.remove();
      b.host.remove();
    }
  });

  // ---- spark ----
  check("spark(el, [1, 3, 2]) renders an svg polyline with no NaN in points", () => {
    const host = withFixture("<span></span>");
    try {
      const el = host.querySelector("span");
      wonk.spark(el, [1, 3, 2]);
      const svg = el.querySelector("svg");
      assert(!!svg, "expected an <svg> inside the element");
      const line = svg.querySelector("polyline");
      assert(!!line, "expected a <polyline> inside the svg");
      const points = line.getAttribute("points") || "";
      assert(points.trim().length > 0, "expected a non-empty points attribute");
      assert(!points.includes("NaN"), `points contains NaN: "${points}"`);
    } finally {
      host.remove();
    }
  });

  check("spark(el, []) renders nothing; spark(el, [5]) draws one centered dot; non-finite values are dropped; never NaN", () => {
    const host = withFixture("<span></span><span></span><span></span>");
    try {
      const [empty, one, mixed] = host.querySelectorAll("span");
      empty.textContent = "stale";
      wonk.spark(empty, []);
      assert(empty.innerHTML === "", `spark([]) should leave the element empty, got "${empty.innerHTML}"`);
      wonk.spark(one, [5], { w: 120, h: 32 });
      assert(!one.innerHTML.includes("NaN"), `spark([5]) markup contains NaN: ${one.innerHTML}`);
      const dot = one.querySelector("circle");
      assert(!!dot, "spark([5]) should draw a dot");
      assert(dot.getAttribute("cx") === "60.0" && dot.getAttribute("cy") === "16.0", `spark([5]) dot should be centered at 60,16, got ${dot.getAttribute("cx")},${dot.getAttribute("cy")}`);
      wonk.spark(mixed, [1, NaN, 3, Infinity, 2]);
      assert(!mixed.innerHTML.includes("NaN") && !mixed.innerHTML.includes("Infinity"), `non-finite values leaked into markup: ${mixed.innerHTML}`);
      const pts = mixed.querySelector("polyline").getAttribute("points").trim().split(/\s+/);
      assert(pts.length === 3, `expected 3 plotted points after dropping non-finite values, got ${pts.length}`);
    } finally {
      host.remove();
    }
  });

  // ---- menu ----
  function menuFixture(style) {
    const host = document.createElement("div");
    host.style.cssText = style;
    host.innerHTML = `
      <details class="wonk-menu">
        <summary class="wonk-btn">actions</summary>
        <div class="menu">
          <button type="button">first</button>
          <button type="button">second</button>
        </div>
      </details>`;
    document.body.appendChild(host);
    wonk.init(host);
    return { host, menu: host.querySelector(".wonk-menu") };
  }
  const toggled = (details) => new Promise((resolve) => details.addEventListener("toggle", resolve, { once: true }));

  check("menu: clicking an item closes it; Escape closes it and returns focus to the summary", async () => {
    const { host, menu } = menuFixture("position:fixed; left:0; top:0;");
    try {
      menu.open = true;
      await toggled(menu);
      menu.querySelector(".menu button").click();
      assert(menu.open === false, "clicking a menu item should close the menu");
      menu.open = true;
      await toggled(menu);
      const second = menu.querySelectorAll(".menu button")[1];
      second.focus();
      key(second, "Escape");
      assert(menu.open === false, "Escape should close the menu");
      assert(document.activeElement === menu.querySelector("summary"), "Escape should return focus to the summary");
    } finally {
      host.remove();
    }
  });

  check("menu: opening near the viewport's right edge adds .wonk-menu--end so the panel stays on screen", async () => {
    const { host, menu } = menuFixture("position:fixed; right:0; top:0;");
    try {
      menu.open = true;
      await toggled(menu);
      assert(menu.classList.contains("wonk-menu--end"), "expected .wonk-menu--end on a right-edge menu");
      const r = menu.querySelector(".menu").getBoundingClientRect();
      assert(r.right <= document.documentElement.clientWidth + 0.5, `menu panel overflows the viewport: right=${r.right}, viewport=${document.documentElement.clientWidth}`);
    } finally {
      host.remove();
    }
  });

  // ---- reveal ----
  check("reveal: a .wonk-reveal injected after init stays visible until armed, then gets is-in within 500ms", async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; left:0; top:0; width:200px;";
    document.body.appendChild(host);
    try {
      const sec = document.createElement("section");
      sec.className = "wonk-reveal";
      sec.textContent = "injected";
      host.appendChild(sec);
      const before = getComputedStyle(sec).opacity;
      assert(before === "1", `an un-armed injected .wonk-reveal must be visible, computed opacity was ${before}`);
      const t0 = performance.now();
      while (!sec.classList.contains("is-in") && performance.now() - t0 < 500) await frame();
      assert(sec.classList.contains("is-in"), "injected .wonk-reveal should be observed and marked is-in within 500ms");
    } finally {
      host.remove();
    }
  });

  // ---- contrast ----
  // For every pair x theme: read the computed tokens off <html>,
  // alpha-composite rgba text tokens over each opaque background, and
  // compute the WCAG 2 contrast ratio. The gate for any token change.
  const PAIRS = ["metathesis", "glorpla", "demogorgon", "ancient", "flourish"];
  const TEXT_TOKENS = ["--ak-ink", "--ak-ink-2", "--ak-ink-3", "--ak-a1-text", "--ak-a2-text", "--ak-ok", "--ak-warn", "--ak-err", "--ak-info"];
  const BG_TOKENS = ["--ak-ground", "--ak-surface", "--ak-surface-2"];

  // any CSS color string -> [r, g, b, a] via the browser's own parser
  function parseColor(probe, value) {
    probe.style.color = "";
    probe.style.color = value;
    if (!probe.style.color) throw new Error(`unparseable color token value "${value}"`);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
  }
  const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
  function luminance([r, g, b]) {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function ratio(fg, bg) {
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  }

  check("contrast: every text token >= 4.5:1 on ground/surface/surface-2, and a1-ink on a1, for 5 pairs x 2 themes", () => {
    const root = document.documentElement;
    const originalPair = root.getAttribute("data-pair");
    const originalTheme = root.getAttribute("data-theme");
    const probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
    const failures = [];
    try {
      for (const pair of PAIRS) {
        for (const theme of ["dark", "paper"]) {
          root.setAttribute("data-pair", pair);
          if (theme === "paper") root.setAttribute("data-theme", "paper");
          else root.removeAttribute("data-theme");
          const css = getComputedStyle(root);
          const read = (name) => {
            const v = css.getPropertyValue(name).trim();
            if (!v) throw new Error(`${pair}/${theme}: token ${name} is empty`);
            return parseColor(probe, v);
          };
          for (const bgName of BG_TOKENS) {
            const bg = read(bgName);
            if (bg[3] !== 1) throw new Error(`${pair}/${theme}: background ${bgName} must be opaque`);
            for (const fgName of TEXT_TOKENS) {
              const r = ratio(over(read(fgName), bg), bg);
              if (r < 4.5) failures.push(`${pair}/${theme}/${fgName}/${bgName} ${r.toFixed(2)}`);
            }
          }
          const a1 = read("--ak-a1");
          const r = ratio(over(read("--ak-a1-ink"), a1), a1);
          if (r < 4.5) failures.push(`${pair}/${theme}/--ak-a1-ink/--ak-a1 ${r.toFixed(2)}`);
        }
      }
    } finally {
      probe.remove();
      restoreRootAttr("data-pair", originalPair);
      restoreRootAttr("data-theme", originalTheme);
    }
    assert(failures.length === 0, `${failures.length} pair(s) below 4.5:1: ${failures.join("; ")}`);
  });

  // ---- focus indicators ----
  // Keyboard focus must draw a visible ring: a non-none outline or
  // box-shadow on the control (or on the toggle's .track, since the real
  // checkbox is invisible), and the stepper row must not clip it.
  function hasRing(el) {
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    return outline || cs.boxShadow !== "none";
  }
  function clipped(el, clipper) {
    const cs = getComputedStyle(el);
    const reach = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
    return getComputedStyle(clipper).overflow === "hidden" && reach > 0 && cs.boxShadow === "none";
  }

  check("focus: toggle, knob value, stepper input + buttons, and text input show an unclipped focus ring", () => {
    const host = withFixture(`
      <label class="wonk-toggle"><input type="checkbox"><span class="track"></span></label>
      <div data-wonk-knob data-label="gain" data-min="0" data-max="10" data-value="5"></div>
      <fieldset class="wonk-stepper">
        <div class="wonk-stepper-row">
          <button type="button" class="wonk-stepper-btn" data-dir="-1" aria-label="less">-</button>
          <input type="number" class="wonk-stepper-input" aria-label="n" value="3">
          <button type="button" class="wonk-stepper-btn" data-dir="1" aria-label="more">+</button>
        </div>
      </fieldset>
      <input class="wonk-input" aria-label="text">
    `);
    const failures = [];
    const focus = (el) => el.focus({ focusVisible: true, preventScroll: true });
    try {
      wonk.knob(host.querySelector("[data-wonk-knob]"));
      const toggle = host.querySelector(".wonk-toggle input");
      focus(toggle);
      if (!hasRing(host.querySelector(".wonk-toggle .track"))) failures.push("toggle: .track shows no ring when its input has focus");
      const val = host.querySelector(".wonk-knob .val");
      focus(val);
      if (!hasRing(val)) failures.push("knob .val: no ring");
      const row = host.querySelector(".wonk-stepper-row");
      const [less, more] = host.querySelectorAll(".wonk-stepper-btn");
      for (const [name, el] of [["stepper input", host.querySelector(".wonk-stepper-input")], ["stepper - button", less], ["stepper + button", more]]) {
        focus(el);
        if (!hasRing(el)) failures.push(`${name}: no ring`);
        else if (clipped(el, row)) failures.push(`${name}: ring is clipped by .wonk-stepper-row overflow:hidden`);
      }
      const text = host.querySelector(".wonk-input");
      focus(text);
      if (!hasRing(text)) failures.push(".wonk-input: no ring (border color alone is not a focus indicator)");
    } finally {
      if (host.contains(document.activeElement)) document.activeElement.blur();
      host.remove();
    }
    assert(failures.length === 0, failures.join("; "));
  });

  // ============================================================
  // runner
  // ============================================================
  async function run() {
    const results = [];
    for (const { name, fn } of checks) {
      try {
        await fn();
        results.push({ name, pass: true, message: "ok" });
        console.log("PASS " + name);
      } catch (err) {
        results.push({ name, pass: false, message: (err && err.message) || String(err) });
        console.error("FAIL " + name + ": " + ((err && err.message) || err));
      }
    }
    try { console.table(results); } catch { /* console.table not available in some hosts */ }
    const failed = results.filter((r) => !r.pass);
    console.log(`wonkBaseChecks: ${results.length - failed.length}/${results.length} passed`);
    return { passed: results.length - failed.length, failed: failed.length, results };
  }

  window.wonkBaseChecks = { run, checks };
})();
