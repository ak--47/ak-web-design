document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  wonk.theme.init();
  wonk.palette.init();
  const sources = ["Web", "Server", "Mobile"];
  const values = [[18400, 22100, 8200], [20100, 23400, 0], [21700, 24100, 0], [22600, 25800, 0]];
  const rows = values.flatMap((hour, hourIndex) => hour.map((written, sourceIndex) => ({
    id: `batch-${hourIndex + 9}-${sourceIndex + 1}`, source: sources[sourceIndex], hour: hourIndex + 9,
    written, state: written ? "Complete" : "Failed", stateKind: written ? "ok" : "err",
  })));
  const columns = [{ key: "id", label: "Batch" }, { key: "source", label: "Source" }, { key: "hour", label: "Hour / UTC", type: "num" }, { key: "written", label: "Written", type: "num", total: true }, { key: "state", label: "State", type: "badge" }];
  const detail = (row) => row.written ? "All records passed validation." : "Required field user_id is missing. Correct the payload before retrying.";
  wonkData.drills({ "refined-failed": () => ({ title: "Failed batches", columns, rows: rows.filter((row) => !row.written), detail }) });
  wonkData.table(document.getElementById("refined-table"), { columns, rows, detail, caption: "All source batches", captionHidden: true });
  const fader = wonkControls.fader(document.getElementById("threshold-fader"));
  let applied = fader.value;
  const count = document.getElementById("threshold-count");
  const result = document.getElementById("threshold-result");
  const state = document.getElementById("draft-state");
  let drill;
  const selected = () => rows.filter((row) => row.written < applied);
  const update = () => {
    count.textContent = `${wonk.fmt.num(selected().length)} batches`;
    document.getElementById("threshold-description").textContent = ` below ${wonk.fmt.num(applied)} records.`;
  };
  const draft = () => { state.textContent = fader.valid && fader.draftValue === applied ? "Applied" : "Unapplied changes"; };
  const form = document.getElementById("threshold-form");
  form.addEventListener("input", draft);
  form.addEventListener("change", draft);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!fader.valid || !form.reportValidity()) return;
    fader.set(fader.draftValue);
    const changed = applied !== fader.value;
    applied = fader.value;
    state.textContent = "Applied";
    update();
    chart.render();
    drill?.destroy();
    if (changed) wonkMotion.play(result, "value-changed");
  });
  count.addEventListener("click", () => { drill = wonkData.inline(document.getElementById("threshold-records"), { title: "Below threshold", columns, rows: selected(), detail, opener: count }); });
  const openPoint = (row) => wonkData.inline(document.getElementById("chart-records"), { title: `${row.source} / ${row.hour}:00 UTC`, columns, rows: [row], detail });
  const chart = wonkCharts.plot(document.getElementById("refined-chart"), (tokens) => ({
    height: 280, marginLeft: 48, marginRight: 24,
    x: { ticks: [9, 10, 11, 12], tickFormat: (hour) => `${hour}:00`, label: null },
    y: { domain: [0, 30000], ticks: [0, 10000, 20000, 30000], tickFormat: (value) => wonk.fmt.compact(value), grid: true, label: null },
    color: { domain: sources, range: tokens.series, legend: true },
    marks: [Plot.ruleY([applied], { stroke: tokens.ink, strokeDasharray: "4,4" }), Plot.lineY(rows, { x: "hour", y: "written", stroke: "source", strokeWidth: 2 }), Plot.dot(rows, { x: "hour", y: "written", stroke: "source", fill: tokens.ground, r: 4, tip: true })],
  }), { label: "Records written by source and hour", table: { columns, rows, detail, onRowAction: openPoint }, onClick: openPoint });
  update();
});