document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  wonk.theme.init();
  const sources = ["Web", "Server", "Mobile"];
  const volumes = [[18400, 22100, 8200], [20100, 23400, 0], [21700, 24100, 0], [22600, 25800, 0]];
  const batches = volumes.flatMap((values, hourIndex) => values.map((written, sourceIndex) => ({
    id: `batch-${hourIndex + 9}-${sourceIndex + 1}`,
    source: sources[sourceIndex],
    time: `${hourIndex + 9}:00`,
    written,
    state: written ? "Complete" : "Failed",
    stateKind: written ? "ok" : "err",
    issue: written ? "None" : "Missing user_id",
  })));
  const failed = batches.filter((batch) => batch.state === "Failed");
  const total = batches.reduce((sum, batch) => sum + batch.written, 0);
  const columns = [
    { key: "source", label: "Source" },
    { key: "time", label: "UTC" },
    { key: "written", label: "Written", type: "num", total: true },
    { key: "state", label: "State", type: "badge" },
    { key: "issue", label: "Validation" },
  ];
  const rounds = {
    reading: ["How much of a brief should stay open?", "Same text, evidence, and type. Only disclosure changes."],
    forms: ["How many settings should appear at once?", "Same fields and save behavior. Only advanced-field disclosure changes."],
    workspace: ["Where should the selected record live?", "Same records and details. Stacked versus side-by-side, never a modal."],
  };
  const chosen = document.documentElement.dataset.review === "chosen";
  const chosenTitles = { reading: "Sectioned reading", forms: "Core + advanced editing", workspace: "Stacked batch workspace" };
  if (chosen) {
    document.querySelector(".review-head h1").textContent = "WONK / chosen designs";
    document.querySelector(".review-head p").textContent = "All ten choices recorded / combined review";
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function header(host, title, context) {
    const head = node("header", "preview-head");
    head.append(node("strong", "", title), node("span", "", context));
    const body = node("div", "preview-body");
    host.append(head, body);
    return body;
  }
  function animateFold(fold, body) {
    fold.addEventListener("toggle", () => {
      if (fold.open && body.getClientRects().length && !body.contains(document.activeElement)) wonkMotion.play(body, "panel-enter");
      else wonkMotion.cancel(body);
    });
    body.addEventListener("focusin", () => wonkMotion.cancel(body));
    fold.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || !fold.open || event.target.matches("select")) return;
      event.preventDefault();
      event.stopPropagation();
      wonkMotion.cancel(body);
      fold.open = false;
      fold.querySelector(":scope > summary").focus();
    });
  }
  function evidence(host, title, rows) {
    const fold = node("details", "evidence");
    const summary = node("summary", "", title);
    const body = node("div", "body");
    fold.append(summary, body);
    host.append(fold);
    wonkData.table(body, { columns, rows, caption: title, captionHidden: true });
    animateFold(fold, body);
    return fold;
  }
  const sections = [
    ["Web and server imports are complete", [
      "The snapshot contains four hourly batches from each source. Web and server completed all four. Mobile completed its 09:00 batch, then failed validation at 10:00, 11:00, and 12:00 UTC.",
      "The successful batches wrote 186,400 records. The failed batches wrote none. These counts describe this local fixture, not a connected production system.",
    ]],
    ["The source payload needs a user ID", [
      "Each record must include an event name and a user ID. The failed mobile batches contain records without user_id. The importer rejects the complete batch when that required field is missing.",
      "Keep the rejected payload available for inspection. Changing the reporting threshold does not repair a payload or alter an import result. It only changes which completed or failed batches appear below that threshold.",
    ]],
    ["Repair the payload before retrying", [
      "Add user_id at the source, then validate the corrected records before scheduling another import. Retry the failed mobile batches only. Web and server batches already completed.",
      "Keep the original batch identifiers when checking for duplicates. Confirm that each retry writes the expected records, then compare its result with the original rejected batch. This preview does not send a retry request.",
    ]],
    ["The snapshot leaves two questions open", [
      "This fixture contains batch totals and validation status. It does not contain the rejected event payloads or the expected number of records in each failed batch. A missing count is unknown, not zero.",
      "Before deciding whether the issue is resolved, inspect a corrected payload and verify the retry result. A successful validation alone does not prove that the records reached their destination.",
    ]],
  ];
  for (const variant of ["a", "b"]) {
    const body = header(document.getElementById(`reading-${variant}`), "Import review", "Local fixture / 30 Oct 2026");
    const reading = node("div", "reading-body wonk-reading");
    const answer = node("div", "answer-line");
    answer.append(node("h3", "", "Repair the mobile payload before retrying."));
    const lead = node("p");
    const count = node("button", "wonk-value-link", `${wonk.fmt.num(failed.length)} batches failed validation.`);
    count.type = "button";
    const written = node("button", "wonk-value-link", `${wonk.fmt.num(total)} records`);
    written.type = "button";
    lead.append(count, document.createTextNode(" Successful imports wrote "), written, document.createTextNode("."));
    answer.append(lead);
    reading.append(answer);
    body.append(reading);
    if (variant === "b") {
      const tools = node("div", "brief-tools");
      for (const [label, open] of [["Expand all", true], ["Collapse all", false]]) {
        const button = node("button", "wonk-btn wonk-btn--quiet", label);
        button.type = "button";
        button.addEventListener("click", () => reading.querySelectorAll("details.reading-section").forEach((fold) => { fold.open = open; }));
        tools.append(button);
      }
      reading.append(tools);
    }
    for (const [title, paragraphs] of sections) {
      const section = node(variant === "a" ? "section" : "details", "reading-section");
      section.append(node(variant === "a" ? "h4" : "summary", "", title));
      const prose = node("div", "prose");
      paragraphs.forEach((text) => prose.append(node("p", "", text)));
      section.append(prose);
      if (variant === "b") animateFold(section, prose);
      reading.append(section);
    }
    const records = evidence(reading, "Batch evidence / 12 batches", batches);
    count.addEventListener("click", () => {
      records.querySelector("summary").textContent = "Failed batches / 3 batches";
      records.querySelector(".body").wonkDataTable.setRows(failed);
      records.open = true;
      records.querySelector("summary").focus({ preventScroll: true });
      records.scrollIntoView({ block: "nearest" });
    });
    written.addEventListener("click", () => {
      records.querySelector("summary").textContent = "Records written / 12 batches";
      records.querySelector(".body").wonkDataTable.setRows(batches);
      records.open = true;
      records.querySelector("summary").focus({ preventScroll: true });
      records.scrollIntoView({ block: "nearest" });
    });
  }
  function highlight(element) {
    wonkMotion.play(element, "value-changed");
  }
  function cancelMotion(scope) {
    scope.querySelectorAll("[data-wonk-motion-state]").forEach((element) => wonkMotion.cancel(element));
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelMotion(document); });
  window.addEventListener("pagehide", () => cancelMotion(document));
  const settingsDefaults = { name: "Mobile imports", source: "mobile", cadence: "hourly", email: "operator@example.test", retries: "2", retention: "30" };
  const fieldDefinitions = [
    { key: "name", label: "Import name", type: "text", required: true, maxLength: 80 },
    { key: "source", label: "Source", options: [["web", "Web"], ["server", "Server"], ["mobile", "Mobile"]] },
    { key: "cadence", label: "Schedule", options: [["hourly", "Hourly"], ["daily", "Daily"], ["manual", "Manual"]] },
    { key: "email", label: "Failure notification email", type: "email", required: true, advanced: true },
    { key: "retries", label: "Retry attempts", options: [["0", "No retries"], ["1", "1 retry"], ["2", "2 retries"], ["3", "3 retries"]], advanced: true },
    { key: "retention", label: "Log retention (days)", type: "number", min: 1, max: 90, step: 1, required: true, advanced: true },
  ];
  for (const variant of ["a", "b"]) {
    const body = header(document.getElementById(`forms-${variant}`), "Import settings", "Session-only fixture");
    body.append(node("h3", "", "Mobile imports"));
    const form = node("form", "settings-form");
    form.noValidate = true;
    let saved = { ...settingsDefaults };
    const controls = new Map();
    let attempted = false;
    const core = node("fieldset", "settings-section");
    core.append(node("legend", "", "Source and schedule"));
    const coreFields = node("div", "settings-fields");
    core.append(coreFields);
    const advanced = node(variant === "a" ? "fieldset" : "details", variant === "a" ? "settings-section" : "settings-advanced wonk-advanced");
    advanced.append(node(variant === "a" ? "legend" : "summary", "", "Notifications and recovery"));
    const advancedFields = node("div", "settings-fields body");
    advanced.append(advancedFields);
    if (variant === "b") animateFold(advanced, advancedFields);
    for (const definition of fieldDefinitions) {
      const wrapper = node("div", "setting-field");
      const label = node("label", "", definition.label);
      label.htmlFor = `setting-${variant}-${definition.key}`;
      const input = node(definition.options ? "select" : "input", definition.options ? "wonk-select" : "wonk-input");
      input.id = label.htmlFor;
      input.name = definition.key;
      if (definition.options) {
        definition.options.forEach(([value, text]) => {
          const option = node("option", "", text);
          option.value = value;
          input.append(option);
        });
      } else {
        input.type = definition.type;
        for (const attribute of ["min", "max", "step", "maxLength"]) if (definition[attribute] !== undefined) input[attribute] = definition[attribute];
        input.required = Boolean(definition.required);
      }
      input.value = saved[definition.key];
      const error = node("p", "field-error");
      error.id = `${input.id}-error`;
      error.hidden = true;
      input.setAttribute("aria-describedby", error.id);
      wrapper.append(label, input, error);
      (definition.advanced ? advancedFields : coreFields).append(wrapper);
      controls.set(definition.key, { input, error, definition });
    }
    const actions = node("div", "form-actions");
    const status = node("output", "", "No unsaved changes");
    status.setAttribute("aria-live", "polite");
    const save = node("button", "wonk-btn wonk-btn--primary", "Save changes");
    save.type = "submit";
    const discard = node("button", "wonk-btn", "Discard changes");
    discard.type = "button";
    actions.append(status, save, discard);
    form.append(core, advanced, actions);
    body.append(form);
    const savedFold = node("details", "evidence");
    savedFold.append(node("summary", "", "Saved settings / this tab"));
    const savedBody = node("div", "body");
    savedFold.append(savedBody);
    body.append(savedFold);
    animateFold(savedFold, savedBody);
    const draft = () => Object.fromEntries([...controls].map(([key, control]) => [key, control.input.value]));
    function dirty() { return JSON.stringify(draft()) !== JSON.stringify(saved); }
    function validate(control, show) {
      const { input, error, definition } = control;
      input.setCustomValidity("");
      if (definition.required && !input.value.trim()) input.setCustomValidity(`${definition.label} is required.`);
      const valid = input.checkValidity();
      error.textContent = valid ? "" : input.validationMessage;
      error.hidden = valid || !show;
      input.setAttribute("aria-invalid", String(show && !valid));
      return valid;
    }
    function renderSaved() {
      const list = node("dl", "saved-settings");
      for (const definition of fieldDefinitions) {
        const value = definition.options?.find(([option]) => option === saved[definition.key])?.[1] ?? saved[definition.key];
        list.append(node("dt", "", definition.label), node("dd", "", value));
      }
      savedBody.replaceChildren(list);
    }
    function updateState() {
      const changed = dirty();
      save.disabled = !changed;
      discard.disabled = !changed;
      status.textContent = changed ? "Unsaved changes" : "No unsaved changes";
    }
    form.addEventListener("input", () => {
      controls.forEach((control) => validate(control, attempted));
      updateState();
    });
    form.addEventListener("change", updateState);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      attempted = true;
      const invalid = [...controls.values()].filter((control) => !validate(control, true));
      if (invalid.length) {
        if (variant === "b" && invalid.some((control) => control.definition.advanced)) advanced.open = true;
        status.textContent = "Correct the marked fields. Nothing was saved.";
        invalid[0].input.focus();
        return;
      }
      if (!dirty()) return;
      saved = draft();
      attempted = false;
      renderSaved();
      updateState();
      status.textContent = "Saved in this tab";
      highlight(status);
    });
    discard.addEventListener("click", () => {
      controls.forEach((control, key) => { control.input.value = saved[key]; validate(control, false); });
      attempted = false;
      updateState();
      status.textContent = "Changes discarded";
      controls.get("name").input.focus();
    });
    renderSaved();
    updateState();
  }
  for (const variant of ["a", "b"]) {
    const body = header(document.getElementById(`workspace-${variant}`), "Batch workspace", "Local fixture / 12:05 UTC");
    if (variant === "b") body.classList.add("workspace-split");
    const toolbar = node("div", "workspace-toolbar");
    const searchLabel = node("label", "", "Find a batch");
    const search = node("input", "wonk-input");
    search.type = "search";
    search.placeholder = "Mobile or batch-12";
    searchLabel.append(search);
    const stateLabel = node("label", "", "State");
    const state = node("select", "wonk-select");
    state.setAttribute("aria-label", "State");
    for (const [value, text] of [["all", "All batches"], ["Failed", "Failed"], ["Complete", "Complete"]]) {
      const option = node("option", "", text);
      option.value = value;
      state.append(option);
    }
    stateLabel.append(state);
    toolbar.append(searchLabel, stateLabel);
    const count = node("button", "wonk-value-link workspace-count");
    count.type = "button";
    const main = node("div", "workspace-main wonk-workspace");
    const list = node("ul", "batch-list wonk-workspace-list");
    list.setAttribute("aria-label", "Batches");
    const inspector = node("section", "record-inspector wonk-workspace-detail");
    inspector.id = `workspace-inspector-${variant}`;
    inspector.setAttribute("aria-label", "Selected batch");
    inspector.addEventListener("focusin", () => wonkMotion.cancel(inspector));
    const announcement = node("output", "wonk-sr");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.dataset.selectionStatus = "";
    const empty = node("div", "workspace-empty");
    empty.hidden = true;
    const clear = node("button", "wonk-btn", "Clear filters");
    clear.type = "button";
    empty.append(node("h4", "", "No batches match."), node("p", "", "No source or batch ID matches these filters."), clear);
    main.append(list, inspector);
    body.append(toolbar, count, announcement, empty, main);
    let selected = "batch-12-3";
    let visible = [...batches].reverse();
    function showSelected(animate = true) {
      const batch = visible.find((record) => record.id === selected);
      wonkMotion.cancel(inspector);
      inspector.replaceChildren();
      list.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.id === selected)));
      announcement.textContent = batch
        ? `${wonk.fmt.num(visible.length)} batches. Selected ${batch.source}, ${batch.time} UTC, ${batch.state.toLowerCase()}, ${wonk.fmt.num(batch.written)} records written.`
        : "No batches match. No batch selected.";
      if (!batch) return;
      inspector.append(node("h4", "", `${batch.source} / ${batch.time} UTC`));
      const fields = node("dl", "record-fields");
      for (const [term, value] of [["Batch ID", batch.id], ["Status", batch.state], ["Records written", wonk.fmt.num(batch.written)], ["Validation", batch.issue]]) {
        fields.append(node("dt", "", term), node("dd", "", value));
      }
      inspector.append(fields, node("p", "record-next", batch.state === "Failed" ? "Correct user_id in the source payload before retrying. No records were written." : "All records in this batch passed validation and were written."));
      const snapshot = node("details");
      const payload = node("pre", "", JSON.stringify(batch, null, 2));
      snapshot.append(node("summary", "", "Batch snapshot"), payload);
      inspector.append(snapshot);
      animateFold(snapshot, payload);
      if (animate) wonkMotion.play(inspector, "panel-enter");
    }
    function renderList() {
      const term = search.value.trim().toLowerCase();
      visible = [...batches].reverse().filter((batch) => (state.value === "all" || state.value === batch.state) && `${batch.id} ${batch.source} ${batch.time}`.toLowerCase().includes(term));
      if (!visible.some((batch) => batch.id === selected)) selected = visible[0]?.id ?? null;
      list.replaceChildren();
      for (const batch of visible) {
        const item = node("li");
        const button = node("button", "batch-choice");
        button.type = "button";
        button.dataset.id = batch.id;
        button.setAttribute("aria-label", `Inspect ${batch.source} batch at ${batch.time} UTC`);
        button.setAttribute("aria-controls", inspector.id);
        const name = node("span");
        name.append(node("strong", "", `${batch.source} / ${batch.time}`), node("small", "", batch.state));
        button.append(name, node("span", "", wonk.fmt.num(batch.written)));
        button.addEventListener("click", () => {
          if (selected === batch.id) return;
          selected = batch.id;
          showSelected();
        });
        item.append(button);
        list.append(item);
      }
      const hasRows = visible.length > 0;
      main.hidden = !hasRows;
      empty.hidden = hasRows;
      count.textContent = `${wonk.fmt.num(visible.length)} batches`;
      count.disabled = !hasRows;
      showSelected(false);
    }
    list.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !event.target.matches("button")) return;
      event.preventDefault();
      const buttons = [...list.querySelectorAll("button")];
      const index = buttons.indexOf(event.target);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      buttons[next].focus();
      buttons[next].click();
    });
    count.addEventListener("click", () => list.querySelector("button")?.focus());
    search.addEventListener("input", renderList);
    state.addEventListener("change", renderList);
    clear.addEventListener("click", () => { search.value = ""; state.value = "all"; renderList(); search.focus(); });
    renderList();
  }
  function showRound() {
    const requested = location.hash.slice(1);
    const active = Object.hasOwn(rounds, requested) ? requested : "reading";
    for (const name of Object.keys(rounds)) {
      const round = document.getElementById(name);
      if (name !== active) cancelMotion(round);
      round.hidden = name !== active;
    }
    document.querySelectorAll("[data-round]").forEach((link) => {
      if (link.dataset.round === active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.getElementById("question").textContent = chosen ? chosenTitles[active] : rounds[active][0];
    document.getElementById("comparison-note").textContent = chosen ? "Chosen design / final review before promotion" : rounds[active][1];
    const modeLink = document.getElementById("review-mode-link");
    modeLink.textContent = chosen ? "Compare alternatives" : "Chosen designs";
    modeLink.href = chosen ? `review.html#${active}` : `review.html?chosen=1#${active}`;
    document.title = `WONK / ${active} ${chosen ? "chosen design" : "study"}`;
  }
  window.addEventListener("hashchange", showRound);
  document.querySelectorAll('input[name="review-view"]').forEach((input) => {
    input.addEventListener("change", () => document.querySelectorAll(".round-grid").forEach((grid) => {
      grid.querySelectorAll("[data-variant]").forEach((candidate) => {
        if (input.value !== "both" && candidate.dataset.variant !== input.value) cancelMotion(candidate);
      });
      grid.dataset.view = input.value;
    }));
  });
  showRound();
});