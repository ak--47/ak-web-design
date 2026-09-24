/* ============================================================
   demo/base-checks.js · browser-callable checks for wonk.js base
   behaviors (window.wonk: toast, setTheme, setPair, tabs, spark).
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
