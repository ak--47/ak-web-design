/* ============================================================
   demo/catalog.js · all script logic for demo/index.html.
   Read the big comment at the top of demo/index.html first: this
   file mirrors that file's section markers exactly (same family
   names, same SECTION-colon-name-plus-boundary-word format), so you
   can grep one family name in both files and read only the matching
   range.

   Local fixtures only. Nothing here polls, streams, or calls a
   backend. No `input`/`change` handler in this file fires an
   expensive query on preview; only explicit Run/Format/Export
   buttons commit or produce anything.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // Shared by every event log on this page (instruments, datatools,
  // and the code-pack sample log): renders one padded, expandable
  // <details> entry holding a real wonkCode.render'd JSON payload
  // instead of a flattened JSON.stringify string. The timestamp and
  // a padded type label are always visible in the summary row, open
  // or closed. Only the newest entry defaults open; `max` bounds how
  // many entries stay in the DOM. The code pack reports missing Prism while retaining readable source.
  function renderLogEntry(host, kind, payload, max) {
    const entry = document.createElement("details");
    entry.className = `event-log-entry ${kind}`;
    const summary = document.createElement("summary");
    const t = new Date().toISOString().slice(11, 23);
    summary.textContent = `${t}  ${kind.padEnd(6)}`;
    const body = document.createElement("pre");
    body.className = "wonk-pre";
    const code = document.createElement("code");
    code.dataset.language = "json";
    body.appendChild(code);
    entry.append(summary, body);
    [...host.children].forEach((child) => (child.open = false));
    host.appendChild(entry);
    entry.open = true;
    wonkCode.render(code, payload, "json");
    host.scrollTop = host.scrollHeight;
    while (host.children.length > max) host.removeChild(host.firstChild);
  }

  // SECTION:chrome START
  const PAIRS = ["metathesis", "glorpla", "demogorgon", "ancient", "flourish"];

  const picker = document.getElementById("pair-picker");
  const nameEl = document.getElementById("pair-name");
  function chipColor(pair) {
    const probe = document.createElement("div");
    probe.setAttribute("data-pair", pair);
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).getPropertyValue("--ak-a1").trim();
    probe.remove();
    return c;
  }
  PAIRS.forEach((p) => {
    const b = document.createElement("button");
    b.className = "pair-chip";
    b.title = p;
    b.style.background = chipColor(p);
    b.setAttribute("aria-pressed", p === "metathesis");
    b.addEventListener("click", () => {
      wonk.setPair(p);
      nameEl.textContent = "pair: " + p;
      [...picker.children].forEach((c) => c.setAttribute("aria-pressed", c === b));
      [...picker.children].forEach((c) => (c.style.background = chipColor(c.title)));
      renderAll();
    });
    picker.appendChild(b);
  });

  const toggle = document.getElementById("theme-toggle");
  toggle.addEventListener("click", () => {
    const paper = document.documentElement.getAttribute("data-theme") === "paper";
    wonk.setTheme(paper ? "dark" : "paper");
    toggle.textContent = paper ? "Paper" : "Dark";
    [...picker.children].forEach((c) => (c.style.background = chipColor(c.title)));
    renderAll();
  });

  // mobile TOC drawer: the sidebar becomes a toggled off-canvas panel
  // below 800px (see .wonk-side rules in catalog.css). Closed, it is
  // `inert` (unfocusable, unclickable) so a keyboard or screen-reader
  // user tabbing through the page never lands on a link hidden off
  // the left edge. Escape and an outside click both close it and
  // return focus to the toggle button. Crossing the 800px breakpoint
  // (resize) resets the drawer to the desktop's always-visible state.
  const side = document.getElementById("wonk-side");
  const menuBtn = document.getElementById("menu-toggle");
  const mobileMenuQuery = window.matchMedia("(max-width: 800px)");
  function setMenu(open) {
    side.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    side.inert = mobileMenuQuery.matches && !open;
  }
  function syncMenuToViewport() {
    setMenu(mobileMenuQuery.matches && side.classList.contains("is-open"));
  }
  syncMenuToViewport();
  menuBtn.addEventListener("click", () => setMenu(!side.classList.contains("is-open")));
  side.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && side.classList.contains("is-open")) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!mobileMenuQuery.matches || !side.classList.contains("is-open")) return;
    if (side.contains(e.target) || menuBtn.contains(e.target)) return;
    setMenu(false);
  });
  mobileMenuQuery.addEventListener("change", syncMenuToViewport);

  document.getElementById("open-modal").addEventListener("click", () =>
    document.getElementById("demo-modal").showModal()
  );
  // SECTION:chrome END

  // SECTION:color START
  function renderSwatches() {
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const rows = [
      ["a1", "--ak-a1"], ["a1-text", "--ak-a1-text"], ["a2", "--ak-a2"], ["a2-text", "--ak-a2-text"],
      ["ok", "--ak-ok"], ["warn", "--ak-warn"], ["err", "--ak-err"], ["info", "--ak-info"],
      ["chart-1", "--ak-chart-1"], ["chart-2", "--ak-chart-2"], ["chart-3", "--ak-chart-3"],
      ["chart-4", "--ak-chart-4"], ["chart-5", "--ak-chart-5"], ["chart-6", "--ak-chart-6"],
    ];
    const inkFor = (hex) => {
      const m = hex.match(/^#([0-9a-f]{6})$/i);
      if (!m) return "#fff";
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum > 0.45 ? "#0f1214" : "#ffffff";
    };
    document.getElementById("swatch-grid").innerHTML = rows
      .map(([name, token]) => {
        const val = v(token);
        return `<div class="demo-swatch" style="background:${val}">
          <span class="wonk-label" style="color:${inkFor(val)}">${name} &middot; ${val}</span>
        </div>`;
      })
      .join("");
  }
  // SECTION:color END

  // SECTION:hero START
  function renderHero() {
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const W = 800, H = 90, mid = H / 2, A = 34, k = 0.085, lam = 260;
    const pts = [], top = [], bot = [];
    for (let x = 0; x <= W; x += 4) {
      const env = A * Math.exp(-x / lam);
      pts.push(`${x},${(mid - Math.sin(x * k) * env).toFixed(1)}`);
      top.push(`${x},${(mid - env).toFixed(1)}`);
      bot.push(`${x},${(mid + env).toFixed(1)}`);
    }
    document.getElementById("hero-wave").innerHTML =
      `<polyline points="${top.join(" ")}" fill="none" stroke="${v("--ak-hairline")}" stroke-width="1" stroke-dasharray="4 5"/>` +
      `<polyline points="${bot.join(" ")}" fill="none" stroke="${v("--ak-hairline")}" stroke-width="1" stroke-dasharray="4 5"/>` +
      `<line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="${v("--ak-hairline")}" stroke-width="1"/>` +
      `<polyline points="${pts.join(" ")}" fill="none" stroke="${v("--ak-a1-text")}" stroke-width="1.75" opacity="0.85"/>`;
  }
  // SECTION:hero END

  // SECTION:cards START
  const sparkValues = Array.from({ length: 32 }, (_, i) =>
    40 + Math.sin(i / 4) * 12 + Math.random() * 9 + i * 0.6
  );
  function renderSpark() {
    wonk.spark(document.getElementById("stat-spark"), sparkValues, { w: 160, h: 34 });
  }
  // SECTION:cards END

  // SECTION:code START
  // fixture events for the sample log, plus a click handler for
  // demo/code-checks.js's own "Run code checks" button. code-checks.js
  // just defines window.wonkCodeChecks; nothing runs it automatically.
  const codeLog = document.getElementById("code-log");
  [
    ["ok", { source: "ingest-api", message: "accepted batch of 512" }],
    ["warn", { source: "export-worker", message: "queue depth 12,004" }],
    ["err", { source: "webhook-fanout", message: "connection refused", attempt: 3 }],
    ["ok", { source: "identity-merge", message: "flushed 9,551 profiles" }],
  ].forEach(([kind, detail]) => renderLogEntry(codeLog, kind, detail, 30));

  const codeChecksBtn = document.getElementById("run-code-checks-btn");
  const codeChecksLog = document.getElementById("code-checks-log");
  const codeChecksSummary = document.getElementById("code-checks-summary");
  codeChecksBtn.addEventListener("click", async () => {
    if (!window.wonkCodeChecks) {
      codeChecksSummary.textContent = "wonkCodeChecks did not load (see demo/code-checks.js script tag)";
      return;
    }
    codeChecksBtn.disabled = true;
    codeChecksSummary.textContent = "running...";
    codeChecksLog.replaceChildren();
    const { passed, failed, results } = await wonkCodeChecks.run();
    results.forEach((r) => renderLogEntry(codeChecksLog, r.pass ? "ok" : "err", r, 200));
    codeChecksSummary.textContent = `${passed}/${passed + failed} passed`;
    codeChecksBtn.disabled = false;
  });
  // SECTION:code END

  // SECTION:charts START
  const SERVICES = ["ingest", "export", "identity"];
  const lineData = [];
  for (let h = 0; h < 48; h++) {
    SERVICES.forEach((s, i) => {
      lineData.push({ t: h, svc: s, v: 800 + i * 400 + Math.sin(h / 5 + i * 2) * 300 + Math.random() * 120 });
    });
  }
  const barData = [
    { svc: "ingest-api", errs: 12 }, { svc: "identity", errs: 4 },
    { svc: "export", errs: 41 }, { svc: "webhooks", errs: 88 }, { svc: "cdc", errs: 7 },
  ];
  function wonkChart(el, build) {
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const series = [1, 2, 3, 4, 5, 6].map((i) => v(`--ak-chart-${i}`));
    el.replaceChildren(
      Plot.plot({
        style: { background: "transparent", color: v("--ak-ink-3"), fontFamily: v("--ak-font-mono"), fontSize: "11px" },
        ...build({ series, grid: v("--ak-hairline") }),
      })
    );
  }
  function renderCharts() {
    wonkChart(document.getElementById("chart-line"), ({ series, grid }) => ({
      height: 240,
      marginLeft: 50,
      x: { label: "hour" },
      y: { grid: true, label: null },
      color: { domain: SERVICES, range: series, legend: true },
      marks: [
        Plot.ruleY([0], { stroke: grid }),
        Plot.lineY(lineData, { x: "t", y: "v", stroke: "svc", strokeWidth: 2, tip: true }),
      ],
    }));
    wonkChart(document.getElementById("chart-bar"), ({ series, grid }) => ({
      height: 200,
      marginLeft: 90,
      x: { grid: true, label: "errors" },
      y: { label: null },
      marks: [
        Plot.ruleX([0], { stroke: grid }),
        Plot.barX(barData, { y: "svc", x: "errs", fill: series[0], rx: 2, insetTop: 1, insetBottom: 1, sort: { y: "-x" }, tip: true }),
        Plot.textX(barData, { y: "svc", x: "errs", text: (d) => d.errs, dx: 14 }),
      ],
    }));
  }
  // SECTION:charts END

  // SECTION:instruments START
  // one shared log, fed by every instrument in the #instruments
  // section (knob, fader, window, segmented, stepper). `input`
  // previews a draft value; only `change` commits one.
  //
  // Each entry is a <details class="event-log-entry"> whose summary
  // always shows the timestamp and padded type label; the body is a
  // real wonkCode.render'd JSON payload (source, kind, detail), not a
  // flattened JSON.stringify string -- so the structure stays
  // inspectable and highlighted like every other code sample on this
  // page. Only the latest entry defaults open; older ones collapse
  // but stay in the height-bounded log. The code pack owns highlighting.
  const instrLog = document.getElementById("instr-log");
  function logInstr(source, kind, detail) {
    renderLogEntry(instrLog, kind, { source, kind, detail }, 30);
  }
  const instrKnob = document.querySelector('#instr-knob [data-wonk-knob]');
  instrKnob.addEventListener("input", (e) => logInstr("confidence threshold", "input", e.detail));
  instrKnob.addEventListener("change", (e) => logInstr("confidence threshold", "change", e.detail));

  const instrFaderRange = document.querySelector("#instr-fader .wonk-range");
  instrFaderRange.addEventListener("input", () => logInstr("p95 alert", "input", { value: instrFaderRange.value }));
  instrFaderRange.addEventListener("change", () => logInstr("p95 alert", "change", { value: instrFaderRange.value }));

  document.querySelector("#instr-window .wonk-window").addEventListener("change", (e) => logInstr("comparison window", "change", e.detail));

  document.querySelector("#instr-segmented .wonk-segmented").addEventListener("change", (e) => logInstr("granularity", "change", { value: e.target.value }));

  const instrStepperInput = document.querySelector("#instr-stepper .wonk-stepper-input");
  instrStepperInput.addEventListener("input", () => logInstr("rows per page", "input", { value: instrStepperInput.value }));
  instrStepperInput.addEventListener("change", () => logInstr("rows per page", "change", { value: instrStepperInput.value }));
  // SECTION:instruments END

  // SECTION:datatools START
  // compact version of demo/workbench.js: 6 local fixture records,
  // one query toolbar, a selectable/sortable table, jobs, and the
  // state recipes. see workbench.html for the full 12-record app
  // with an inspector-owning record set; this one owns its own 6.
  (() => {
    const dtRows = [
      ["page_view", "web", 75, "accepted"], ["purchase", "server", 450, "accepted"],
      ["sign_up", "mobile", 200, "accepted"], ["purchase", "web", 800, "rejected"],
      ["page_view", "web", 125, "accepted"], ["identify", "server", 50, "accepted"],
    ].map(([event, source, latency, status], i) => ({ id: `evt-${String(i + 1).padStart(3, "0")}`, event, source, latency, status }));
    const get = (id) => document.getElementById(id);
    const threshold = get("dt-threshold").wonkKnob;
    const selected = new Set();
    let applied = { search: "", source: "all", minimumLatency: 0 };
    let descending = true;
    let visible = [];
    const node = (tag, text, className) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (className) el.className = className;
      return el;
    };
    const defaults = () => ({ search: "", source: "all", minimumLatency: 0 });
    function draft() {
      return { search: get("dt-search").value.trim(), source: get("dt-source").value, minimumLatency: threshold.value };
    }
    function markDraft() {
      get("dt-draft-state").textContent = JSON.stringify(draft()) === JSON.stringify(applied) ? "applied" : "unapplied changes";
    }
    function setDraft(value) {
      get("dt-search").value = value.search;
      get("dt-source").value = value.source;
      threshold.set(value.minimumLatency);
      markDraft();
    }
    function updateSelection() {
      get("dt-selection-count").textContent = `${selected.size} selected`;
      get("dt-export-selection").disabled = get("dt-clear-selection").disabled = !selected.size;
      get("dt-select-all").disabled = !visible.length;
      get("dt-select-all").checked = visible.length > 0 && visible.every((row) => selected.has(row.id));
      get("dt-select-all").indeterminate = selected.size > 0 && !get("dt-select-all").checked;
      get("dt-result-rows").querySelectorAll("tr").forEach((tr) => {
        tr.dataset.selected = String(selected.has(tr.dataset.id));
        tr.querySelector("input").checked = selected.has(tr.dataset.id);
      });
    }
    // body source text (event, source, status) is rendered through
    // node()/textContent below, never innerHTML: it can hold
    // arbitrary characters safely, same rule as the full workbench.
    function inspect(row) {
      get("dt-inspector-title").textContent = row.id;
      get("dt-record-meta").replaceChildren();
      for (const [label, value] of [["source", row.source], ["status", row.status], ["latency", `${row.latency} ms`]]) {
        get("dt-record-meta").append(node("dt", label), node("dd", value));
      }
      const payloadEl = get("dt-record-payload");
      wonkCode.render(payloadEl, row, "json");
      get("dt-inspector").showModal();
    }
    function renderRows() {
      visible = dtRows.filter((row) => (applied.source === "all" || row.source === applied.source)
        && row.latency >= applied.minimumLatency
        && `${row.id} ${row.event}`.toLowerCase().includes(applied.search.toLowerCase()))
        .sort((a, b) => descending ? b.latency - a.latency : a.latency - b.latency);
      for (const id of selected) if (!visible.some((row) => row.id === id)) selected.delete(id);
      get("dt-result-rows").replaceChildren();
      for (const row of visible) {
        const tr = node("tr"); tr.dataset.id = row.id;
        const selectCell = node("td");
        const checkbox = node("input"); checkbox.type = "checkbox"; checkbox.setAttribute("aria-label", `Select ${row.id}`);
        checkbox.addEventListener("change", () => { checkbox.checked ? selected.add(row.id) : selected.delete(row.id); updateSelection(); });
        selectCell.append(checkbox);
        const recordCell = node("td");
        const button = node("button", row.id, "wonk-btn wonk-btn--quiet"); button.type = "button";
        button.addEventListener("click", () => inspect(row)); recordCell.append(button);
        const statusCell = node("td"); statusCell.append(node("span", row.status, "wonk-badge"));
        tr.append(selectCell, recordCell, node("td", row.event), node("td", row.source), node("td", String(row.latency), "num"), statusCell);
        get("dt-result-rows").append(tr);
      }
      get("dt-result-count").textContent = `${visible.length} / ${dtRows.length} records`;
      get("dt-no-results").hidden = visible.length !== 0;
      get("dt-sort-latency").textContent = `latency ${descending ? "\u2193" : "\u2191"}`;
      get("dt-sort-latency").closest("th").setAttribute("aria-sort", descending ? "descending" : "ascending");
      updateSelection();
    }
    function renderFilters() {
      get("dt-filter-chips").replaceChildren();
      const filters = [["search", applied.search, ""], ["source", applied.source === "all" ? "" : applied.source, "all"], ["minimumLatency", applied.minimumLatency ? `\u2265 ${applied.minimumLatency} ms` : "", 0]];
      for (const [key, value, reset] of filters) {
        if (!value) continue;
        const chip = node("li", `${key}: ${value}`, "wonk-filter-chip");
        const remove = node("button", "\u00d7"); remove.type = "button"; remove.setAttribute("aria-label", `Remove ${key} filter`);
        remove.addEventListener("click", () => {
          applied[key] = reset;
          setDraft(applied);
          render();
          get("dt-query-form").querySelector("button[type=submit]").focus();
        });
        chip.append(remove); get("dt-filter-chips").append(chip);
      }
    }
    function render() { renderRows(); renderFilters(); markDraft(); }
    for (const source of ["web", "server", "mobile"]) {
      const sourceRows = dtRows.filter((row) => row.source === source);
      const accepted = sourceRows.filter((row) => row.status === "accepted").length;
      const channel = node("article", undefined, "wonk-channel");
      const label = node("label", `${accepted} / ${sourceRows.length} accepted`, "wonk-mono"); label.htmlFor = `dt-meter-${source}`;
      const meter = node("meter", `${accepted} of ${sourceRows.length}`, "wonk-meter");
      meter.id = label.htmlFor; meter.min = 0; meter.max = sourceRows.length; meter.value = accepted;
      channel.append(node("h3", source), node("span", `${sourceRows.length} records`, "wonk-num"), label, meter,
        node("small", `${sourceRows.length - accepted} rejected \u00b7 snapshot only`));
      get("dt-channel-bank").append(channel);
    }
    get("dt-query-form").addEventListener("input", markDraft);
    get("dt-query-form").addEventListener("change", markDraft);
    get("dt-query-form").addEventListener("submit", (e) => {
      e.preventDefault(); applied = draft(); render();
      wonkMotion.play(get("dt-result-count"), "value-changed");
    });
    get("dt-reset").addEventListener("click", () => setDraft(defaults()));
    get("dt-clear-filters").addEventListener("click", () => { applied = defaults(); setDraft(applied); render(); get("dt-search").focus(); });
    get("dt-sort-latency").addEventListener("click", () => { descending = !descending; render(); });
    get("dt-select-all").addEventListener("change", () => {
      visible.forEach((row) => get("dt-select-all").checked ? selected.add(row.id) : selected.delete(row.id)); updateSelection();
    });
    get("dt-clear-selection").addEventListener("click", () => { selected.clear(); updateSelection(); get("dt-select-all").focus(); });
    get("dt-export-selection").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(visible.filter((row) => selected.has(row.id)), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = node("a"); link.href = url; link.download = "wonk-catalog-selected-events.json";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    render();
  })();
  // SECTION:datatools END

  // SECTION:motion START
  // one button per effect; every button calls the real
  // wonkMotion.play(el, name). See references/motion.md for the
  // status contract (done/cancelled/skipped) and reduced-motion
  // behavior. Nothing here plays on load or loops.
  const motionPanelEl = document.getElementById("motion-panel-el");
  document.getElementById("motion-panel-open").addEventListener("click", () => {
    motionPanelEl.hidden = false;
    wonkMotion.play(motionPanelEl, "panel-enter");
  });
  document.getElementById("motion-panel-close").addEventListener("click", async () => {
    if (motionPanelEl.hidden) return;
    const result = await wonkMotion.play(motionPanelEl, "panel-exit");
    if (result.status !== "cancelled") motionPanelEl.hidden = true;
  });

  const motionValueNum = document.getElementById("motion-value-num");
  const motionFixtureValues = [48112, 49830, 47220, 52045, 50390];
  let motionValueIndex = 0;
  document.getElementById("motion-value-bump").addEventListener("click", () => {
    motionValueIndex = (motionValueIndex + 1) % motionFixtureValues.length;
    motionValueNum.textContent = motionFixtureValues[motionValueIndex].toLocaleString();
    wonkMotion.play(motionValueNum, "value-changed");
  });

  const motionRowBody = document.getElementById("motion-row-body");
  const motionFixtureRows = [["export-worker", "2,140"], ["webhook-fanout", "6,004"], ["cdc-relay", "1,225"]];
  let motionRowIndex = 0;
  document.getElementById("motion-row-add").addEventListener("click", () => {
    const [name, rate] = motionFixtureRows[motionRowIndex % motionFixtureRows.length];
    motionRowIndex++;
    const tr = motionRowBody.insertRow();
    tr.innerHTML = `<td>${name}</td><td class="num">${rate}</td>`;
    wonkMotion.play(tr, "row-inserted");
  });

  const motionFilterFixture = [
    { name: "ingest-api", status: "ok" }, { name: "identity-merge", status: "ok" },
    { name: "export-worker", status: "warn" },
  ];
  const motionFilterBody = document.getElementById("motion-filter-body");
  function renderMotionFilter(kind, animate) {
    const rows = kind === "all" ? motionFilterFixture : motionFilterFixture.filter((r) => r.status === kind);
    motionFilterBody.innerHTML = rows
      .map((r) => {
        const badge = r.status === "ok"
          ? `<span class="wonk-badge wonk-badge--ok">&#10003; ok</span>`
          : `<span class="wonk-badge wonk-badge--warn">&#9651; degraded</span>`;
        return `<tr><td>${r.name}</td><td>${badge}</td></tr>`;
      })
      .join("");
    if (animate) wonkMotion.play(motionFilterBody.closest("table"), "filter-applied");
  }
  renderMotionFilter("all", false); // first paint is not a user action; no motion plays
  document.querySelectorAll("[data-motion-filter]").forEach((btn) =>
    btn.addEventListener("click", () => renderMotionFilter(btn.dataset.motionFilter, true))
  );

  const motionFill = document.getElementById("motion-progress-fill");
  document.getElementById("motion-progress-run").addEventListener("click", () => {
    motionFill.style.width = "100%";
    wonkMotion.play(motionFill, "progress-complete");
  });

  document.getElementById("motion-trace-replay").addEventListener("click", () => {
    wonkMotion.play(document.getElementById("motion-trace-svg"), "trace-draw");
  });

  document.getElementById("motion-confirm-run").addEventListener("click", () => {
    wonkMotion.play(document.getElementById("motion-confirm-svg"), "confirm-check");
  });
  // SECTION:motion END

  // SECTION:boot START (runs renderAll + wires the scrollspy; depends
  // on every render function defined in the sections above)
  function renderAll() {
    renderSwatches();
    renderHero();
    renderSpark();
    renderCharts();
    const kv = document.getElementById("kv-pair");
    if (kv) kv.textContent = document.documentElement.getAttribute("data-pair");
  }
  renderAll();

  const links = [...document.querySelectorAll(".wonk-navlink")];
  const byId = Object.fromEntries(links.map((l) => [l.getAttribute("href").slice(1), l]));
  const setActive = (id) => links.forEach((l) => l.classList.toggle("active", l === byId[id]));
  links.forEach((l) => l.addEventListener("click", () => setActive(l.getAttribute("href").slice(1))));
  const spy = new IntersectionObserver(
    (entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit && byId[hit.target.id]) setActive(hit.target.id);
    },
    { rootMargin: "-20% 0px -60% 0px" }
  );
  document.querySelectorAll(".demo-section[id]").forEach((s) => spy.observe(s));
  // SECTION:boot END
});
