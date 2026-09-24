/* Local fixture application. No backend or artificial telemetry. */
(() => {
  "use strict";
  const rows = [
    ["page_view", "web", 75, "accepted"], ["purchase", "server", 450, "accepted"],
    ["sign_up", "mobile", 200, "accepted"], ["purchase", "web", 800, "rejected"],
    ["page_view", "web", 125, "accepted"], ["identify", "server", 50, "accepted"],
    ["session_start", "mobile", 325, "accepted"], ["purchase", "server", 975, "rejected"],
    ["page_view", "mobile", 175, "accepted"], ["sign_up", "web", 250, "accepted"],
    ["identify", "server", 100, "accepted"], ["session_start", "mobile", 600, "accepted"],
  ].map(([event, source, latency, status], i) => ({ id: `evt-${String(i + 1).padStart(3, "0")}`, event, source, latency, status }));
  const get = (id) => document.getElementById(id);
  const threshold = get("threshold").wonkKnob;
  let applied = { search: "", source: "all", minimumLatency: 0 };
  let visible = [];
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const defaults = () => ({ search: "", source: "all", minimumLatency: 0 });
  function draft() {
    return { search: get("search").value.trim(), source: get("source").value, minimumLatency: threshold.value };
  }
  function markDraft() {
    get("draft-state").textContent = JSON.stringify(draft()) === JSON.stringify(applied) ? "applied" : "unapplied changes";
  }
  function setDraft(value) {
    get("search").value = value.search;
    get("source").value = value.source;
    threshold.set(value.minimumLatency);
    markDraft();
  }
  function updateSelection() {
    const count = results.selected.length;
    get("selection-count").textContent = `${count} selected`;
    get("export-selection").disabled = get("clear-selection").disabled = !count;
  }
  function inspect(row) {
    get("inspector-title").textContent = row.id;
    get("record-meta").replaceChildren();
    for (const [label, value] of [["source", row.source], ["status", row.status], ["latency", `${row.latency} ms`]]) {
      get("record-meta").append(node("dt", label), node("dd", value));
    }
    const payloadEl = get("record-payload");
    wonkCode.render(payloadEl, row, "json");
    get("inspector").showModal();
  }
  // the results table: sorting (every column), selection by record ID,
  // and the record button come from wonkData.table (assets/wonk-data.js).
  // select-all means visible records; filtering drops selections that
  // leave the result; sorting keeps selections by record ID.
  const results = wonkData.table(get("results"), {
    label: "Event results, scroll horizontally for all columns",
    caption: "Latency in milliseconds. Each row represents one event. Select a record ID to inspect its payload.",
    select: true,
    onRowAction: inspect,
    sort: { key: "latency", dir: "desc" },
    empty: null, // #no-results below owns the empty state and its recovery button
    columns: [
      { key: "id", label: "record" },
      { key: "event", label: "event" },
      { key: "source", label: "source" },
      { key: "latency", label: "latency", type: "num" },
      { key: "status", label: "status", type: "badge" },
    ],
  });
  get("results").addEventListener("wonk-data:select", updateSelection);
  get("results").addEventListener("wonk-data:sort", () => renderFilters());
  function renderRows() {
    visible = rows.filter((row) => (applied.source === "all" || row.source === applied.source)
      && row.latency >= applied.minimumLatency
      && `${row.id} ${row.event}`.toLowerCase().includes(applied.search.toLowerCase()));
    results.setRows(visible);
    get("result-count").textContent = `${visible.length} / ${rows.length} records`;
    get("no-results").hidden = visible.length !== 0;
    updateSelection();
  }
  function renderFilters() {
    get("filter-chips").replaceChildren();
    const filters = [["search", applied.search, ""], ["source", applied.source === "all" ? "" : applied.source, "all"], ["minimumLatency", applied.minimumLatency ? `≥ ${applied.minimumLatency} ms` : "", 0]];
    for (const [key, value, reset] of filters) {
      if (!value) continue;
      const chip = node("li", `${key}: ${value}`, "wonk-filter-chip");
      const remove = node("button", "×"); remove.type = "button"; remove.setAttribute("aria-label", `Remove ${key} filter`);
      remove.addEventListener("click", () => {
        applied[key] = reset;
        setDraft(applied);
        render();
        get("query-form").querySelector("button[type=submit]").focus();
      });
      chip.append(remove); get("filter-chips").append(chip);
    }
    const sort = results.sort;
    const spec = { dataset: "local-events", filters: applied, orderBy: { [sort.key]: sort.dir } };
    const specEl = get("query-spec");
    wonkCode.render(specEl, spec, "json");
  }
  function render() { renderRows(); renderFilters(); markDraft(); }
  for (const source of ["web", "server", "mobile"]) {
    const sourceRows = rows.filter((row) => row.source === source);
    const accepted = sourceRows.filter((row) => row.status === "accepted").length;
    const channel = node("article", undefined, "wonk-channel");
    const label = node("label", `${accepted} / ${sourceRows.length} accepted`, "wonk-mono"); label.htmlFor = `meter-${source}`;
    const meter = node("meter", `${accepted} of ${sourceRows.length}`, "wonk-meter");
    meter.id = label.htmlFor; meter.min = 0; meter.max = sourceRows.length; meter.value = accepted;
    channel.append(node("h3", source), node("span", `${sourceRows.length} records`, "wonk-num"), label, meter,
      node("small", `${sourceRows.length - accepted} rejected · snapshot only`));
    get("channels").append(channel);
  }
  get("query-form").addEventListener("input", markDraft);
  get("query-form").addEventListener("change", markDraft);
  get("query-form").addEventListener("submit", (e) => {
    e.preventDefault(); applied = draft(); render();
    wonkMotion.play(get("result-count"), "value-changed");
  });
  get("reset").addEventListener("click", () => setDraft(defaults()));
  get("clear-filters").addEventListener("click", () => { applied = defaults(); setDraft(applied); render(); get("search").focus(); });
  get("clear-selection").addEventListener("click", () => {
    results.clearSelection();
    get("results").querySelector("thead input[type=checkbox]").focus();
  });
  get("export-selection").addEventListener("click", () => {
    const keys = new Set(results.selected);
    const blob = new Blob([JSON.stringify(results.rows.filter((row) => keys.has(row.id)), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = node("a"); link.href = url; link.download = "wonk-selected-events.json";
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  get("theme-toggle").addEventListener("click", () => {
    const paper = document.documentElement.dataset.theme !== "paper";
    wonk.setTheme(paper ? "paper" : "dark"); get("theme-toggle").textContent = paper ? "Dark" : "Paper";
  });
  render();
})();
