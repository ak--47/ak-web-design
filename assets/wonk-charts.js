/* ============================================================
   WONK v0.3.0 · wonk-charts.js · Observable Plot, themed from WONK tokens
   window.wonkCharts (frozen): plot.

   Needs the d3 and Plot globals: load assets/vendor/d3/d3.min.js,
   then assets/vendor/plot/plot.umd.min.js, both before this file.
   Needs wonk-tokens.css and wonk.css (wonk.css restyles Plot's tip).
   The table view uses wonkData.table (wonk-data.js) when it is
   loaded, else a plain table.wonk-table. Everything this file adds
   renders with DOM APIs and textContent: data is never parsed as HTML.
   Full contract and copy-paste examples: references/charts.md.

     const chart = wonkCharts.plot(el, (t) => ({ ...Plot.plot options }), {
       label: "Events by service, last 48 hours",  // required: the aria-label
       table: { columns, rows },                    // optional: Show table toggle
       onClick: (datum) => ...,                     // optional: the pointed datum
     });
     chart.render(); chart.destroy();
   ============================================================ */
(() => {
  "use strict";

  const NUMERIC = new Set(["num", "money", "pct", "duration"]);
  const UNKNOWN = "—";

  // el -> state, for every live chart (the theme observer walks it)
  const charts = new Map();
  let themeObserver = null;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  let uidCount = 0;
  const nextId = (prefix) => {
    let id;
    do { id = `${prefix}-${++uidCount}`; } while (document.getElementById(id));
    return id;
  };

  // tokens, read fresh at each render: pairs and themes live on <html>
  function readTokens(el) {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return {
      series: [1, 2, 3, 4, 5, 6].map((i) => v(`--ak-chart-${i}`)),
      ink: v("--ak-ink-2"),
      muted: v("--ak-ink-3"),
      grid: v("--ak-hairline"),
      ground: v("--ak-ground"),
      font: v("--ak-font-mono"),
      width: el.clientWidth,
    };
  }

  // build(t) -> Plot.plot options, with the WONK style and the element's
  // width merged in unless build set them. A hidden element (width 0)
  // keeps Plot's default width; the ResizeObserver re-renders it once it
  // has a size.
  function draw(el, build) {
    const t = readTokens(el);
    const built = build(t);
    if (!built || typeof built !== "object") {
      throw new TypeError("wonkCharts.plot: build(t) must return a Plot.plot options object");
    }
    const style = typeof built.style === "string"
      ? built.style
      : { background: "transparent", color: t.muted, fontFamily: t.font, fontSize: "11px", ...built.style };
    const options = { ...built, style };
    if (built.width === undefined && t.width > 0) options.width = t.width;
    return { node: Plot.plot(options), width: t.width };
  }

  function mount(state, node, width) {
    // a legend or title makes Plot return a <figure>: drop the browser's
    // default figure margin (1em 40px) so the svg gets the width it was
    // drawn at instead of shrinking under Plot's max-width: 100%
    if (node.tagName === "FIGURE") node.style.margin = "0";
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", state.label);
    node.addEventListener("click", state.onFigureClick);
    const old = state.node;
    if (old) old.removeEventListener("click", state.onFigureClick);
    if (old && old.parentNode === state.el) old.replaceWith(node);
    else state.el.prepend(node);
    state.node = node;
    // the plot's own svg: Plot appends it after any legends
    state.svg = node.tagName === "FIGURE" ? node.querySelector(":scope > svg:last-of-type") : node;
    state.width = width;
  }

  function render(state) {
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    const { node, width } = draw(state.el, state.build);
    mount(state, node, width);
  }

  // theme and resize changes re-render at most once per animation frame
  function schedule(state) {
    if (state.frame || state.destroyed) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      render(state);
    });
  }

  function watchTheme() {
    if (themeObserver) return;
    themeObserver = new MutationObserver(() => charts.forEach(schedule));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-pair"] });
  }

  // ---- table view ----
  function checkTable(table) {
    if (!table || typeof table !== "object") {
      throw new TypeError("wonkCharts.plot: options.table must be { columns, rows }");
    }
    if (!Array.isArray(table.columns) || !table.columns.length) {
      throw new TypeError("wonkCharts.plot: options.table.columns must be a non-empty array of { key, label, type }");
    }
    if (!Array.isArray(table.rows)) {
      throw new TypeError("wonkCharts.plot: options.table.rows must be an array");
    }
  }

  // without wonk-data.js: row[key] as plain text, no sorting or formatting
  function plainTable(table, label) {
    const region = make("div", "wonk-table-scroll");
    region.setAttribute("role", "region");
    region.setAttribute("tabindex", "0");
    region.setAttribute("aria-label", String(table.label || table.caption || label));
    const tableEl = make("table", "wonk-table");
    if (table.caption) tableEl.appendChild(make("caption", "", String(table.caption)));
    const headRow = make("tr");
    table.columns.forEach((c) => {
      const th = make("th", NUMERIC.has(c.type) ? "num" : "", String(c.label ?? c.key));
      th.scope = "col";
      headRow.appendChild(th);
    });
    const body = make("tbody");
    table.rows.forEach((row) => {
      const tr = make("tr");
      table.columns.forEach((c) => {
        const v = row[c.key];
        tr.appendChild(make("td", NUMERIC.has(c.type) ? "num" : "", v === null || v === undefined || v === "" ? UNKNOWN : String(v)));
      });
      body.appendChild(tr);
    });
    const head = make("thead");
    head.appendChild(headRow);
    tableEl.append(head, body);
    region.appendChild(tableEl);
    return region;
  }

  // builds the table into a detached panel: a bad table option throws
  // here, before plot() changes anything
  function buildTable(table, label) {
    const panel = make("div", "wonk-chart-table");
    let controller = null;
    if (window.wonkData && typeof window.wonkData.table === "function") {
      // the chart's label captions the table unless the caller set one
      const opts = table.caption === undefined ? { caption: label, captionHidden: true, ...table } : table;
      controller = window.wonkData.table(panel, opts);
    } else {
      panel.appendChild(plainTable(table, label));
    }
    return { panel, controller };
  }

  function setOpen(view, open) {
    view.button.setAttribute("aria-expanded", String(open));
    view.button.textContent = open ? "Hide table" : "Show table";
    view.panel.hidden = !open;
  }

  // keeps the button (and its focus and open state) across plot() calls;
  // built is buildTable()'s result, or null for no table
  function syncTable(state, built) {
    if (!built) {
      unmountTable(state);
      return;
    }
    const view = state.tableView;
    if (!view) {
      built.panel.id = nextId("wonk-chart-table");
      const button = make("button", "wonk-btn wonk-btn--quiet");
      button.type = "button";
      button.setAttribute("aria-controls", built.panel.id);
      const fresh = { button, panel: built.panel, controller: built.controller, toggle: null };
      fresh.toggle = () => setOpen(fresh, fresh.panel.hidden);
      button.addEventListener("click", fresh.toggle);
      setOpen(fresh, false);
      state.el.append(button, built.panel);
      state.tableView = fresh;
      return;
    }
    // swap in the new panel under the old id and open state
    if (view.controller) view.controller.destroy();
    const { id, hidden } = view.panel;
    view.panel.replaceWith(built.panel);
    built.panel.id = id;
    built.panel.hidden = hidden;
    view.panel = built.panel;
    view.controller = built.controller;
  }

  function unmountTable(state) {
    const view = state.tableView;
    if (!view) return;
    if (view.controller) view.controller.destroy();
    view.button.removeEventListener("click", view.toggle);
    view.button.remove();
    view.panel.remove();
    state.tableView = null;
  }

  function destroy(state) {
    if (state.destroyed) return;
    state.destroyed = true;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.resizeObserver.disconnect();
    if (state.node) state.node.removeEventListener("click", state.onFigureClick);
    unmountTable(state);
    if (charts.get(state.el) === state) charts.delete(state.el);
    if (!charts.size && themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
    state.el.replaceChildren();
    state.node = null;
  }

  // ============================================================
  // wonkCharts.plot(el, build, { label, table?, onClick? }) -> controller
  // ============================================================
  function plot(el, build, options) {
    if (!(el instanceof Element)) throw new TypeError("wonkCharts.plot: el must be an Element");
    if (typeof build !== "function") throw new TypeError("wonkCharts.plot: build must be a function (t) => Plot.plot options");
    const opts = options || {};
    if (typeof opts.label !== "string" || !opts.label.trim()) {
      throw new TypeError('wonkCharts.plot: options.label is required, the chart\'s aria-label, e.g. { label: "Events by service, last 48 hours" }');
    }
    if (opts.onClick !== undefined && typeof opts.onClick !== "function") {
      throw new TypeError("wonkCharts.plot: options.onClick must be a function (datum) => ...");
    }
    if (opts.table !== undefined) checkTable(opts.table);
    if (typeof window.Plot === "undefined" || typeof window.Plot.plot !== "function") {
      throw new Error(
        'wonkCharts.plot needs Observable Plot: load <script src="assets/vendor/d3/d3.min.js"></script> ' +
        'then <script src="assets/vendor/plot/plot.umd.min.js"></script> before wonk-charts.js'
      );
    }

    // draw and build the table before touching any state, so a throwing
    // build or table option changes nothing
    const { node, width } = draw(el, build);
    const built = opts.table === undefined ? null : buildTable(opts.table, opts.label);

    let state = charts.get(el);
    if (!state) {
      el.replaceChildren();
      state = {
        el, build, label: "", onClick: undefined, node: null, svg: null, width: 0, frame: 0,
        tableView: null, destroyed: false, resizeObserver: null, onFigureClick: null, controller: null,
      };
      const self = state;
      self.onFigureClick = (event) => {
        // only a click in the plot's own svg: a legend click must not
        // reuse the last pointed datum
        if (!self.svg.contains(event.target)) return;
        const value = event.currentTarget.value;
        if (!self.onClick || value === null || value === undefined) return;
        // Plot pinned its tip on pointerdown: a fresh render on the next
        // frame clears it, so the next click opens again
        try {
          self.onClick(value);
        } finally {
          schedule(self);
        }
      };
      self.resizeObserver = new ResizeObserver(() => {
        if (self.el.clientWidth !== self.width) schedule(self);
      });
      self.controller = Object.freeze({
        render() {
          if (self.destroyed) throw new Error("wonkCharts: render() after destroy(); call wonkCharts.plot(el, ...) again");
          render(self);
        },
        destroy() { destroy(self); },
      });
      charts.set(el, state);
      state.resizeObserver.observe(el);
      watchTheme();
    }
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.build = build;
    state.label = opts.label;
    state.onClick = opts.onClick;
    mount(state, node, width);
    syncTable(state, built);
    return state.controller;
  }

  window.wonkCharts = Object.freeze({ plot });
})();
