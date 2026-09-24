/* ============================================================
   demo/charts-checks.js · browser-callable checks for wonk-charts.js
   (window.wonkCharts: plot)
   Runs headless via `npm test` (or `npm test -- charts`). By hand:
   load it on any page that already has wonk-tokens.css, wonk.css,
   the vendored d3 + Plot, and wonk-charts.js loaded (e.g.
   demo/index.html), then call:

     await wonkChartsChecks.run();

   Every chart renders into its own hidden fixture host, which is
   destroyed and removed afterwards. Checks that switch data-pair
   restore the original pair in a finally block. No dependency on the
   host page's markup, no network calls. Returns
   { passed, failed, results } where each result is
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

  // a hidden host, off screen but rendered (layout and clientWidth work)
  function withHost() {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; left:-9999px; top:0; width:800px;";
    document.body.appendChild(host);
    return host;
  }

  const frames = (n) => new Promise((resolve) => {
    const step = (left) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
  const same = (got, want, label) =>
    assert(JSON.stringify(got) === JSON.stringify(want), `${label}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

  const root = document.documentElement;
  const PAIRS = ["metathesis", "glorpla", "demogorgon", "ancient", "flourish"];
  const computedSeries = () => {
    const css = getComputedStyle(root);
    return [1, 2, 3, 4, 5, 6].map((i) => css.getPropertyValue(`--ak-chart-${i}`).trim());
  };
  // the first pair (other than the current one) whose series differ
  function otherPair() {
    const start = root.getAttribute("data-pair");
    const before = JSON.stringify(computedSeries());
    try {
      for (const p of PAIRS) {
        if (p === start) continue;
        root.setAttribute("data-pair", p);
        if (JSON.stringify(computedSeries()) !== before) return p;
      }
    } finally {
      root.setAttribute("data-pair", start);
    }
    throw new Error("no pair with different chart series found");
  }

  const DATA = [{ k: "a", v: 3 }, { k: "b", v: 7 }, { k: "c", v: 5 }];
  const bars = (t) => ({ height: 160, marks: [Plot.barY(DATA, { x: "k", y: "v", fill: t.series[0], tip: true })] });
  const figureOf = (host) => host.querySelector(':scope > [role="img"]');

  // ============================================================
  // rendering and accessible name
  // ============================================================
  check("plot: el gets one figure/svg with role=img and aria-label = label; t.width is the element's clientWidth; a legend figure spans el", () => {
    const host = withHost();
    let chart;
    let seen;
    try {
      chart = wonkCharts.plot(host, (t) => { seen = t; return bars(t); }, { label: "Fixture bars" });
      const fig = figureOf(host);
      assert(fig, `host should hold a [role=img] child, got ${host.innerHTML.slice(0, 120)}`);
      assert(/^(figure|svg)$/i.test(fig.tagName), `the role=img element should be a figure or svg, got ${fig.tagName}`);
      assert(fig.getAttribute("aria-label") === "Fixture bars", `aria-label should be "Fixture bars", got ${JSON.stringify(fig.getAttribute("aria-label"))}`);
      assert(fig.tagName.toLowerCase() === "svg" || fig.querySelector("svg"), "the figure should be or contain the rendered Plot svg");
      assert(seen && seen.width === host.clientWidth, `t.width should be ${host.clientWidth}, got ${seen && seen.width}`);
      assert(typeof chart.render === "function" && typeof chart.destroy === "function", "the controller should have render() and destroy()");
      assert(Object.isFrozen(wonkCharts), "window.wonkCharts should be frozen");

      // a legend makes Plot return a <figure>; it must span el, not shrink the svg
      chart = wonkCharts.plot(host, (t) => ({
        height: 160,
        color: { domain: ["a", "b", "c"], range: t.series, legend: true },
        marks: [Plot.barY(DATA, { x: "k", y: "v", fill: "k" })],
      }), { label: "Fixture legend" });
      const legendFig = figureOf(host);
      assert(legendFig && legendFig.tagName === "FIGURE", `a legend should render a figure, got ${legendFig && legendFig.tagName}`);
      const svgW = Math.round([...legendFig.querySelectorAll("svg")].pop().getBoundingClientRect().width);
      const figW = Math.round(legendFig.getBoundingClientRect().width);
      assert(figW === host.clientWidth && svgW === host.clientWidth,
        `the figure and its chart svg should be ${host.clientWidth}px wide, got figure ${figW}px, svg ${svgW}px`);
    } finally {
      if (chart) chart.destroy();
      host.remove();
    }
  });

  check("plot: a missing or empty label throws and renders nothing", () => {
    assert(window.wonkCharts && typeof window.wonkCharts.plot === "function", "window.wonkCharts.plot should exist");
    const host = withHost();
    try {
      for (const opts of [undefined, {}, { label: "" }, { label: "   " }]) {
        let error = null;
        try {
          wonkCharts.plot(host, bars, opts);
        } catch (err) {
          error = err;
        }
        assert(error instanceof Error && /label/.test(error.message),
          `plot() with options ${JSON.stringify(opts)} should throw an Error naming label, got ${error && error.message}`);
        assert(host.childNodes.length === 0, `nothing should render after a throw, got ${host.innerHTML.slice(0, 120)}`);
      }
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // tokens
  // ============================================================
  check("tokens: build receives t.series (6 non-empty strings equal to the computed --ak-chart-1..6) plus ink, muted, grid, ground, font", () => {
    const host = withHost();
    let chart;
    let t;
    try {
      chart = wonkCharts.plot(host, (tokens) => { t = tokens; return bars(tokens); }, { label: "Fixture tokens" });
      assert(t && Array.isArray(t.series), "build should receive t.series as an array");
      assert(t.series.length === 6, `t.series should have 6 entries, got ${t.series.length}`);
      assert(t.series.every((s) => typeof s === "string" && s.length > 0), `every series entry should be a non-empty string, got ${JSON.stringify(t.series)}`);
      same(t.series, computedSeries(), "t.series");
      const css = getComputedStyle(root);
      const v = (n) => css.getPropertyValue(n).trim();
      same(
        { ink: t.ink, muted: t.muted, grid: t.grid, ground: t.ground, font: t.font },
        { ink: v("--ak-ink-2"), muted: v("--ak-ink-3"), grid: v("--ak-hairline"), ground: v("--ak-ground"), font: v("--ak-font-mono") },
        "t.ink/muted/grid/ground/font"
      );
    } finally {
      if (chart) chart.destroy();
      host.remove();
    }
  });

  check("theme: switching <html data-pair> re-renders within 2 frames with the new series", async () => {
    const host = withHost();
    const start = root.getAttribute("data-pair");
    const next = otherPair();
    const calls = [];
    let chart;
    try {
      chart = wonkCharts.plot(host, (t) => { calls.push(t.series.slice()); return bars(t); }, { label: "Fixture theme" });
      assert(calls.length === 1, `build should run once on plot(), ran ${calls.length} times`);
      root.setAttribute("data-pair", next);
      await frames(2);
      assert(calls.length >= 2, `build should run again within 2 frames of the pair switch, ran ${calls.length} times`);
      assert(JSON.stringify(calls[calls.length - 1]) !== JSON.stringify(calls[0]), "the series passed to build should change with the pair");
      same(calls[calls.length - 1], computedSeries(), `t.series after switching to ${next}`);
      assert(figureOf(host) && host.querySelectorAll(':scope > [role="img"]').length === 1, "exactly one figure after the re-render");
    } finally {
      root.setAttribute("data-pair", start);
      await frames(2);
      if (chart) chart.destroy();
      host.remove();
    }
  });

  // ============================================================
  // table view
  // ============================================================
  check("table: a Show table button (aria-expanded=false, aria-controls) toggles a table with one row per datum; the plain fallback works without wonkData", () => {
    const columns = [{ key: "k", label: "key" }, { key: "v", label: "value", type: "num" }];
    const host = withHost();
    let chart;
    const verify = (where) => {
      const btn = host.querySelector(":scope > button.wonk-btn.wonk-btn--quiet");
      assert(btn, `${where}: a button.wonk-btn.wonk-btn--quiet should follow the chart`);
      assert(btn.type === "button", `${where}: the toggle should be type=button`);
      assert(btn.textContent.trim() === "Show table", `${where}: the button should read "Show table", got ${JSON.stringify(btn.textContent)}`);
      assert(btn.getAttribute("aria-expanded") === "false", `${where}: aria-expanded should start "false"`);
      const panel = document.getElementById(btn.getAttribute("aria-controls") || "");
      assert(panel && host.contains(panel), `${where}: aria-controls should name the table container inside el`);
      assert(panel.hidden, `${where}: the table container should start hidden`);
      btn.click();
      assert(btn.getAttribute("aria-expanded") === "true" && btn.textContent.trim() === "Hide table", `${where}: after a click the button should read "Hide table" with aria-expanded="true"`);
      assert(!panel.hidden, `${where}: the table container should be visible after a click`);
      const table = panel.querySelector("table.wonk-table");
      assert(table, `${where}: the container should hold a table.wonk-table`);
      const rows = [...table.querySelectorAll("tbody tr:not(.wonk-row-detail)")];
      assert(rows.length === DATA.length, `${where}: expected ${DATA.length} body rows, got ${rows.length}`);
      same(rows.map((tr) => tr.cells[0].textContent.trim()), DATA.map((d) => d.k), `${where}: first-column cells`);
      btn.click();
      assert(panel.hidden && btn.getAttribute("aria-expanded") === "false" && btn.textContent.trim() === "Show table", `${where}: a second click should hide the table again`);
      return table;
    };
    const saved = window.wonkData;
    try {
      assert(window.wonkData && typeof window.wonkData.table === "function", "this page should load wonk-data.js (wonkData.table)");
      chart = wonkCharts.plot(host, bars, { label: "Fixture table", table: { columns, rows: DATA } });
      const table = verify("with wonkData");
      assert(table.closest(".wonk-table-scroll[role=region]"), "with wonkData: the table should come from wonkData.table (inside its .wonk-table-scroll region)");
      chart.destroy();
      chart = null;

      window.wonkData = undefined;
      chart = wonkCharts.plot(host, bars, { label: "Fixture fallback", table: { columns, rows: DATA } });
      verify("fallback");
      same([...host.querySelectorAll("thead th")].map((th) => th.textContent.trim()), ["key", "value"], "fallback: header labels");
    } finally {
      window.wonkData = saved;
      if (chart) chart.destroy();
      host.remove();
    }
  });

  // ============================================================
  // lifecycle
  // ============================================================
  check("lifecycle: plot() twice on one el leaves one figure (and one table toggle); destroy() empties el and stops re-rendering", async () => {
    const host = withHost();
    const start = root.getAttribute("data-pair");
    const next = otherPair();
    let chart;
    let builds = 0;
    const build = (t) => { builds++; return bars(t); };
    try {
      wonkCharts.plot(host, build, { label: "First", table: { columns: [{ key: "k" }], rows: DATA } });
      chart = wonkCharts.plot(host, build, { label: "Second", table: { columns: [{ key: "k" }], rows: DATA } });
      const figs = host.querySelectorAll(':scope > [role="img"]');
      assert(figs.length === 1, `expected one figure after two plot() calls, got ${figs.length}`);
      assert(figs[0].getAttribute("aria-label") === "Second", "the second call's label should win");
      assert(host.querySelectorAll(":scope > button").length === 1, `expected one table toggle, got ${host.querySelectorAll(":scope > button").length}`);
      assert(host.querySelectorAll("table").length === 1, `expected one table, got ${host.querySelectorAll("table").length}`);

      chart.destroy();
      assert(host.childNodes.length === 0, `destroy() should empty el, got ${host.innerHTML.slice(0, 120)}`);
      const after = builds;
      root.setAttribute("data-pair", next);
      await frames(2);
      assert(builds === after, `build should not run after destroy(), ran ${builds - after} more times`);
      assert(host.childNodes.length === 0, "el should stay empty after a pair switch");
      chart.destroy(); // a second destroy is a no-op
    } finally {
      root.setAttribute("data-pair", start);
      await frames(2);
      if (chart) chart.destroy();
      host.remove();
    }
  });

  // ============================================================
  // click-through
  // ============================================================
  check("onClick: a click on the figure calls onClick(figure.value) when value is set, and not when it is null", () => {
    const host = withHost();
    let chart;
    const got = [];
    try {
      chart = wonkCharts.plot(host, bars, { label: "Fixture click", onClick: (d) => got.push(d) });
      const fig = figureOf(host);
      assert(fig, "a figure should render");
      fig.value = null;
      fig.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      assert(got.length === 0, `onClick should not run while figure.value is null, ran ${got.length} times`);
      fig.value = DATA[1];
      fig.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      assert(got.length === 1 && got[0] === DATA[1], `onClick should receive figure.value once, got ${JSON.stringify(got)}`);
    } finally {
      if (chart) chart.destroy();
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
    console.log(`wonkChartsChecks: ${results.length - failed.length}/${results.length} passed`);
    return { passed: results.length - failed.length, failed: failed.length, results };
  }

  window.wonkChartsChecks = { run, checks };
})();
