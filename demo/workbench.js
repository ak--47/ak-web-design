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
    get("selection-count").textContent = `${selected.size} selected`;
    get("export-selection").disabled = get("clear-selection").disabled = !selected.size;
    get("select-all").disabled = !visible.length;
    get("select-all").checked = visible.length > 0 && visible.every((row) => selected.has(row.id));
    get("select-all").indeterminate = selected.size > 0 && !get("select-all").checked;
    get("result-rows").querySelectorAll("tr").forEach((tr) => {
      tr.dataset.selected = String(selected.has(tr.dataset.id));
      tr.querySelector("input").checked = selected.has(tr.dataset.id);
    });
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
  function renderRows() {
    visible = rows.filter((row) => (applied.source === "all" || row.source === applied.source)
      && row.latency >= applied.minimumLatency
      && `${row.id} ${row.event}`.toLowerCase().includes(applied.search.toLowerCase()))
      .sort((a, b) => descending ? b.latency - a.latency : a.latency - b.latency);
    for (const id of selected) if (!visible.some((row) => row.id === id)) selected.delete(id);
    get("result-rows").replaceChildren();
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
      get("result-rows").append(tr);
    }
    get("result-count").textContent = `${visible.length} / ${rows.length} records`;
    get("no-results").hidden = visible.length !== 0;
    get("sort-latency").textContent = `latency ${descending ? "↓" : "↑"}`;
    get("sort-latency").closest("th").setAttribute("aria-sort", descending ? "descending" : "ascending");
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
    const spec = { dataset: "local-events", filters: applied, orderBy: { latency: descending ? "desc" : "asc" } };
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
  get("sort-latency").addEventListener("click", () => { descending = !descending; render(); });
  get("select-all").addEventListener("change", () => {
    visible.forEach((row) => get("select-all").checked ? selected.add(row.id) : selected.delete(row.id)); updateSelection();
  });
  get("clear-selection").addEventListener("click", () => { selected.clear(); updateSelection(); get("select-all").focus(); });
  get("export-selection").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(visible.filter((row) => selected.has(row.id)), null, 2)], { type: "application/json" });
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
