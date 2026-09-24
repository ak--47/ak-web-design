/* ============================================================
   wonk-data.js · records table, drill-down dialog, CSV export
   window.wonkData (frozen): table, drill, drills, toCSV.

   Requires wonk.js (wonk.fmt formats every number; row toggles,
   data-fold-key, and data-tip hints are wonk.js's document-level
   delegation) and wonk-data.css. Load it after wonk.js.
   Everything renders with DOM APIs and textContent: data is never
   parsed as HTML. For arrays already in memory (hundreds to low
   thousands of rows); server pagination stays the app's job.
   Full contract and copy-paste examples: references/data-tools.md.
   ============================================================ */
(() => {
  "use strict";

  const TYPES = new Set(["text", "num", "money", "pct", "date", "duration", "badge", "link"]);
  const NUMERIC = new Set(["num", "money", "pct", "duration"]);
  const UNKNOWN = "—";

  function fmt() {
    if (!window.wonk || !window.wonk.fmt) {
      throw new Error("wonk-data.js needs wonk.js loaded first: wonkData formats values with wonk.fmt");
    }
    return window.wonk.fmt;
  }

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const isNode = (v) => v !== null && typeof v === "object" && typeof v.nodeType === "number";
  // a render result: a Node as is, anything else as literal text
  const toContent = (v) => (isNode(v) ? v : document.createTextNode(v === null || v === undefined ? "" : String(v)));

  let uidCount = 0;
  const nextId = (prefix) => {
    let id;
    do { id = `${prefix}-${++uidCount}`; } while (document.getElementById(id));
    return id;
  };

  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const toTime = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const t = (v instanceof Date ? v : new Date(typeof v === "number" ? v : String(v))).getTime();
    return Number.isFinite(t) ? t : null;
  };

  // only http: and https: URLs become links; anything else is plain text
  function safeHref(h) {
    if (h === null || h === undefined || h === "") return null;
    let url;
    try {
      url = new URL(String(h), document.baseURI);
    } catch {
      return null; // not a URL: the cell renders as plain text, by design
    }
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  }

  function normalizeColumns(columns, where) {
    if (!Array.isArray(columns) || !columns.length) {
      throw new TypeError(`${where}: columns must be a non-empty array of { key, label, type, ... }`);
    }
    return columns.map((c, i) => {
      if (!c || typeof c.key !== "string" || !c.key) throw new TypeError(`${where}: column ${i} needs a string key`);
      const type = c.type || "text";
      if (!TYPES.has(type)) {
        throw new TypeError(`${where}: column "${c.key}" has unknown type ${JSON.stringify(c.type)}; use one of ${[...TYPES].join(", ")}`);
      }
      return { ...c, type, label: c.label ?? c.key, sortable: c.sortable !== false, numeric: NUMERIC.has(type) };
    });
  }

  // money totals unless total:false; any other column only with total:true
  const hasTotal = (c) => c.total === true || (c.type === "money" && c.total !== false);
  // the sort / total value: value(row) when given, else row[key]
  const rawValue = (c, row) => (typeof c.value === "function" ? c.value(row) : row[c.key]);
  // the displayed value: row[key], or value(row) when row[key] is absent
  const shownValue = (c, row) => (row[c.key] === undefined && typeof c.value === "function" ? c.value(row) : row[c.key]);

  function sortValue(c, row) {
    const v = rawValue(c, row);
    if (c.numeric) return toNum(v);
    if (c.type === "date") return toTime(v);
    if (v === null || v === undefined) return null;
    const s = String(v);
    return s === "" ? null : s;
  }

  function formatValue(c, v) {
    const f = fmt();
    const opts = c.format || {};
    switch (c.type) {
      case "num": return f.num(v, opts);
      case "money": return f.money(v, opts);
      case "pct": return f.pct(v, opts);
      case "duration": return f.duration(v);
      case "date": return f.date(v, opts);
      default: return v === null || v === undefined || v === "" ? UNKNOWN : String(v);
    }
  }

  function cellContent(c, row) {
    if (typeof c.render === "function") return toContent(c.render(row));
    const v = shownValue(c, row);
    const text = formatValue(c, v);
    if (c.type === "badge" && text !== UNKNOWN) {
      const badge = make("span", "wonk-badge", text);
      const kind = row[`${c.key}Kind`];
      if (typeof kind === "string" && /^[\w-]+$/.test(kind)) badge.classList.add(`wonk-badge--${kind}`);
      return badge;
    }
    if (c.type === "link" && text !== UNKNOWN) {
      const href = safeHref(typeof c.href === "function" ? c.href(row) : v);
      if (href) {
        const a = make("a", "", text);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        return a;
      }
    }
    return document.createTextNode(text);
  }

  const alignCell = (cell, c) => {
    cell.dataset.type = c.type;
    if (c.numeric) cell.classList.add("num");
    if (c.align) cell.dataset.align = c.align;
  };

  // ============================================================
  // wonkData.table(host, opts) -> controller
  // ============================================================
  function table(host, opts = {}) {
    if (!host || typeof host.appendChild !== "function") {
      throw new TypeError("wonkData.table(host, opts): host must be an element");
    }
    const f = fmt();
    const columns = normalizeColumns(opts.columns, "wonkData.table");
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const rowKey = opts.rowKey || "id";
    const select = !!opts.select;
    const detail = typeof opts.detail === "function" ? opts.detail : null;
    const foldKey = typeof opts.foldKey === "function" ? opts.foldKey : null;
    const onRowAction = typeof opts.onRowAction === "function" ? opts.onRowAction : null;
    if (opts.limit !== undefined && opts.limit !== null && !(Number.isInteger(opts.limit) && opts.limit > 0)) {
      throw new TypeError(`wonkData.table: limit must be a positive integer, got ${JSON.stringify(opts.limit)}`);
    }
    const limit = opts.limit || null;
    // null or false: no empty row, the app shows its own empty state
    const emptyText = opts.empty === null || opts.empty === false ? null : String(opts.empty ?? "No records match.");
    const span = columns.length + (select ? 1 : 0);
    const tableId = nextId("wonk-data");

    // one table per host: rendering again replaces the previous one
    if (host.wonkDataTable) host.wonkDataTable.destroy();

    let entries = [];        // every row, in sorted order: { row, key, keyed, index, nodes }
    let sort = null;         // { key, dir }
    let expanded = false;    // "Show all" was pressed
    let destroyed = false;
    const selected = new Set();
    const rowOf = new WeakMap();      // tr -> entry
    const checkboxOf = new WeakMap(); // row checkbox -> entry
    const actions = new WeakSet();    // this table's onRowAction buttons

    // ---- frame ----
    host.replaceChildren();
    const region = make("div", "wonk-table-scroll");
    region.setAttribute("role", "region");
    region.tabIndex = 0;
    region.setAttribute("aria-label", String(opts.label || opts.caption || "Records"));
    const tableEl = make("table", "wonk-table");
    if (opts.caption) tableEl.appendChild(make("caption", opts.captionHidden ? "wonk-sr" : "", String(opts.caption)));
    const thead = make("thead");
    const tbody = make("tbody");
    const tfoot = make("tfoot");
    tableEl.append(thead, tbody, tfoot);
    region.appendChild(tableEl);
    const more = make("p", "wonk-more");
    more.hidden = true;
    const showAllBtn = make("button", "wonk-btn wonk-btn--quiet", "Show all");
    showAllBtn.type = "button";
    host.append(region, more);

    // ---- header ----
    const headRow = make("tr");
    let selectAll = null;
    if (select) {
      const th = make("th", "wonk-select-cell");
      th.scope = "col";
      selectAll = make("input");
      selectAll.type = "checkbox";
      selectAll.setAttribute("aria-label", "Select all visible rows");
      th.appendChild(selectAll);
      headRow.appendChild(th);
    }
    const headers = new Map(); // key -> { th, arrow }
    columns.forEach((c) => {
      const th = make("th");
      th.scope = "col";
      th.dataset.key = c.key;
      alignCell(th, c);
      if (c.width !== undefined && c.width !== null) {
        const w = typeof c.width === "number" ? `${c.width}px` : String(c.width);
        th.style.width = w;
        th.style.minWidth = w;
      }
      if (c.hint) th.setAttribute("data-tip", String(c.hint));
      let arrow = null;
      if (c.sortable) {
        const button = make("button", "wonk-sort");
        button.type = "button";
        button.dataset.key = c.key;
        button.appendChild(document.createTextNode(String(c.label)));
        arrow = make("span", "wonk-sort-arrow");
        arrow.setAttribute("aria-hidden", "true");
        button.appendChild(arrow);
        th.appendChild(button);
        // the button's focus already shows the header's tip: no second tab stop
        if (c.hint) th.setAttribute("data-tip-focus", "off");
      } else {
        th.textContent = String(c.label);
      }
      headers.set(c.key, { th, arrow });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    // ---- rows ----
    function buildRow(entry) {
      const { row, key } = entry;
      const tr = make("tr");
      tr.dataset.key = String(key);
      rowOf.set(tr, entry);
      let checkbox = null;
      if (select) {
        const td = make("td", "wonk-select-cell");
        checkbox = make("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", `Select ${entry.keyed ? key : `row ${entry.index + 1}`}`);
        checkboxOf.set(checkbox, entry);
        td.appendChild(checkbox);
        tr.appendChild(td);
      }
      let detailTr = null;
      columns.forEach((c, i) => {
        const td = make("td");
        alignCell(td, c);
        let content = cellContent(c, row);
        if (i === 0 && onRowAction) {
          const action = make("button", "wonk-value-link");
          action.type = "button";
          action.appendChild(content);
          actions.add(action);
          content = action;
        }
        const extra = i === 0 && detail ? detail(row) : null;
        if (extra === null || extra === undefined) {
          td.appendChild(content);
        } else {
          const id = nextId(`${tableId}-detail`);
          const fk = foldKey ? foldKey(row) : null;
          const keyed = fk !== null && fk !== undefined;
          const open = keyed && window.wonk.foldState.get(String(fk)) === true;
          const toggle = make("button", "wonk-row-toggle");
          toggle.type = "button";
          toggle.setAttribute("aria-expanded", String(open));
          toggle.setAttribute("aria-controls", id);
          if (keyed) toggle.setAttribute("data-fold-key", String(fk));
          if (onRowAction) {
            // a button cannot hold a button: the toggle keeps only its +
            toggle.setAttribute("aria-label", `Details for ${content.textContent}`);
            td.append(toggle, " ", content);
          } else {
            toggle.appendChild(content);
            td.appendChild(toggle);
          }
          detailTr = make("tr", "wonk-row-detail");
          detailTr.id = id;
          detailTr.hidden = !open;
          const cell = make("td");
          cell.colSpan = span;
          cell.appendChild(toContent(extra));
          detailTr.appendChild(cell);
        }
        tr.appendChild(td);
      });
      entry.nodes = { tr, detailTr, checkbox };
    }

    const shownEntries = () => (limit && !expanded ? entries.slice(0, limit) : entries);

    function renderBody() {
      const frag = document.createDocumentFragment();
      if (!entries.length) {
        if (emptyText !== null) {
          const tr = make("tr", "wonk-table-empty");
          const td = make("td", "", emptyText);
          td.colSpan = span;
          tr.appendChild(td);
          frag.appendChild(tr);
        }
      } else {
        shownEntries().forEach((entry) => {
          if (!entry.nodes) buildRow(entry);
          frag.appendChild(entry.nodes.tr);
          if (entry.nodes.detailTr) frag.appendChild(entry.nodes.detailTr);
        });
      }
      tbody.replaceChildren(frag);
      renderMore();
      syncSelection();
    }

    function renderMore() {
      if (!limit || expanded || entries.length <= limit) {
        more.hidden = true;
        more.replaceChildren();
        return;
      }
      more.replaceChildren(
        "Showing ", make("span", "wonk-num", f.num(limit)), " of ", make("span", "wonk-num", f.num(entries.length)), " ", showAllBtn
      );
      more.hidden = false;
    }

    function renderFoot() {
      const totals = columns.map((c) => {
        if (!hasTotal(c)) return undefined;
        let sum = 0, n = 0;
        entries.forEach((entry) => {
          const v = toNum(rawValue(c, entry.row));
          if (v !== null) { sum += v; n++; }
        });
        return formatValue(c, n ? sum : null);
      });
      if (!entries.length || totals.every((t) => t === undefined)) {
        tfoot.replaceChildren();
        return;
      }
      const tr = make("tr");
      // "Total" goes in the first column, or in the select column when
      // the first column carries a total itself
      const labelFirst = totals[0] === undefined;
      if (select) tr.appendChild(make("td", `wonk-select-cell${labelFirst ? "" : " wonk-total-label"}`, labelFirst ? "" : "Total"));
      columns.forEach((c, i) => {
        const td = make("td");
        alignCell(td, c);
        if (i === 0 && labelFirst) {
          td.classList.add("wonk-total-label");
          td.textContent = "Total";
        } else if (totals[i] !== undefined) {
          td.textContent = i === 0 && !select ? `Total ${totals[i]}` : totals[i];
        }
        tr.appendChild(td);
      });
      tfoot.replaceChildren(tr);
    }

    // ---- sorting ----
    const defaultDir = (c) => (c.numeric || c.type === "date" ? "desc" : "asc");

    function sortEntries() {
      if (!sort) return;
      const c = byKey.get(sort.key);
      const collator = new Intl.Collator(f.locale, { numeric: true, sensitivity: "base" });
      const sign = sort.dir === "asc" ? 1 : -1;
      const byValue = c.numeric || c.type === "date" ? (a, b) => a - b : (a, b) => collator.compare(a, b);
      const tie = (x, y) => (typeof x.key === "number" && typeof y.key === "number"
        ? x.key - y.key
        : collator.compare(String(x.key), String(y.key)));
      const values = new Map(entries.map((entry) => [entry, sortValue(c, entry.row)]));
      entries.sort((x, y) => {
        const a = values.get(x), b = values.get(y);
        if (a === null || b === null) return a === b ? tie(x, y) : a === null ? 1 : -1; // unknowns last, both ways
        return byValue(a, b) * sign || tie(x, y);
      });
    }

    function paintHeaders() {
      headers.forEach(({ th, arrow }, key) => {
        const on = !!sort && sort.key === key;
        if (on) th.setAttribute("aria-sort", sort.dir === "asc" ? "ascending" : "descending");
        else th.removeAttribute("aria-sort");
        if (arrow) arrow.textContent = on ? (sort.dir === "asc" ? "↑" : "↓") : "";
      });
    }

    function setSortState(key, dir) {
      const c = byKey.get(key);
      if (!c) throw new Error(`wonkData.table: no column with key ${JSON.stringify(key)}`);
      if (dir !== undefined && dir !== null && dir !== "asc" && dir !== "desc") {
        throw new TypeError(`wonkData.table: sort dir must be "asc" or "desc", got ${JSON.stringify(dir)}`);
      }
      sort = { key: c.key, dir: dir || defaultDir(c) };
    }

    function resort() {
      sortEntries();
      paintHeaders();
      renderBody();
    }

    // ---- selection ----
    const selectedKeys = () => entries.filter((entry) => selected.has(entry.key)).map((entry) => entry.key);

    function syncSelection() {
      if (!select) return;
      entries.forEach((entry) => {
        if (!entry.nodes) return;
        const on = selected.has(entry.key);
        entry.nodes.tr.dataset.selected = String(on);
        entry.nodes.checkbox.checked = on;
      });
      const shown = shownEntries();
      const all = shown.length > 0 && shown.every((entry) => selected.has(entry.key));
      selectAll.checked = all;
      selectAll.indeterminate = selected.size > 0 && !all;
      selectAll.disabled = shown.length === 0;
    }

    const emitSelect = () =>
      host.dispatchEvent(new CustomEvent("wonk-data:select", { bubbles: true, detail: { selected: selectedKeys() } }));

    // ---- events (delegated on the host; nested tables are skipped) ----
    function showAll() {
      const firstNew = entries[limit];
      expanded = true;
      renderBody();
      const target = firstNew && firstNew.nodes && firstNew.nodes.tr.querySelector("input, button, a[href], [tabindex]");
      (target || region).focus();
    }

    function onClick(e) {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const sortBtn = t.closest("button.wonk-sort");
      if (sortBtn && thead.contains(sortBtn)) {
        const key = sortBtn.dataset.key;
        const dir = sort && sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : defaultDir(byKey.get(key));
        setSortState(key, dir);
        resort();
        sortBtn.focus();
        host.dispatchEvent(new CustomEvent("wonk-data:sort", { bubbles: true, detail: { ...sort } }));
        return;
      }
      const action = t.closest(".wonk-value-link");
      if (action && actions.has(action)) {
        const entry = rowOf.get(action.closest("tr"));
        if (entry) onRowAction(entry.row);
        return;
      }
      if (t.closest("button") === showAllBtn) showAll();
    }

    function onChange(e) {
      const t = e.target;
      if (select && t === selectAll) {
        shownEntries().forEach((entry) => (selectAll.checked ? selected.add(entry.key) : selected.delete(entry.key)));
        syncSelection();
        emitSelect();
        return;
      }
      const entry = checkboxOf.get(t);
      if (!entry) return;
      if (t.checked) selected.add(entry.key);
      else selected.delete(entry.key);
      syncSelection();
      emitSelect();
    }

    host.addEventListener("click", onClick);
    host.addEventListener("change", onChange);

    // ---- data ----
    function alive() {
      if (destroyed) throw new Error("wonkData.table: this table was destroyed");
    }

    function setRows(rows) {
      alive();
      if (!Array.isArray(rows)) throw new TypeError("wonkData.table: rows must be an array of plain objects");
      const seen = new Set();
      let duplicate;
      entries = rows.map((row, index) => {
        if (!row || typeof row !== "object") throw new TypeError(`wonkData.table: row ${index} must be an object, got ${JSON.stringify(row)}`);
        const raw = row[rowKey];
        const keyed = raw !== undefined && raw !== null && raw !== "";
        const key = keyed ? raw : index;
        if (seen.has(key)) duplicate = key;
        seen.add(key);
        return { row, key, keyed, index, nodes: null };
      });
      if (duplicate !== undefined) {
        console.warn(`wonkData.table: duplicate rowKey ${JSON.stringify(duplicate)} (rowKey "${rowKey}"); selection treats rows with the same key as one`);
      }
      const before = selected.size;
      for (const key of [...selected]) if (!seen.has(key)) selected.delete(key);
      sortEntries();
      paintHeaders();
      renderBody();
      renderFoot();
      if (selected.size !== before) emitSelect();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      host.removeEventListener("click", onClick);
      host.removeEventListener("change", onChange);
      host.replaceChildren();
      entries = [];
      selected.clear();
      if (host.wonkDataTable === controller) delete host.wonkDataTable;
    }

    const controller = Object.freeze({
      setRows,
      setSort(key, dir) {
        alive();
        setSortState(key, dir);
        resort();
      },
      get rows() { return entries.map((entry) => entry.row); },
      get selected() { return selectedKeys(); },
      get sort() { return sort ? { ...sort } : null; },
      clearSelection() {
        alive();
        if (!selected.size) return;
        selected.clear();
        syncSelection();
        emitSelect();
      },
      destroy,
    });

    if (opts.sort) setSortState(opts.sort.key, opts.sort.dir);
    setRows(opts.rows || []);
    host.wonkDataTable = controller;
    return controller;
  }

  // ============================================================
  // wonkData.toCSV(columns, rows) -> string
  // ============================================================
  // Raw values (value(row) when given, else row[key]), dates as ISO,
  // every field quoted, inner quotes doubled. A string that starts
  // with = + - @ tab or CR gets a leading ' so a spreadsheet never
  // runs it as a formula; numbers are written as they are.
  function toCSV(columns, rows) {
    if (!Array.isArray(columns)) throw new TypeError("wonkData.toCSV(columns, rows): columns must be an array");
    if (!Array.isArray(rows)) throw new TypeError("wonkData.toCSV(columns, rows): rows must be an array");
    const quote = (s) => `"${s.replace(/"/g, '""')}"`;
    const guard = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
    const field = (c, row) => {
      const v = rawValue(c, row);
      if (v === null || v === undefined) return "";
      if (v instanceof Date || c.type === "date") {
        const t = toTime(v);
        if (t !== null) return new Date(t).toISOString();
        if (v instanceof Date) return "";
      }
      if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
      if (typeof v === "object") return guard(JSON.stringify(v));
      return guard(String(v));
    };
    const lines = [columns.map((c) => quote(guard(String(c.label ?? c.key)))).join(",")];
    rows.forEach((row) => lines.push(columns.map((c) => quote(field(c, row))).join(",")));
    return lines.join("\r\n");
  }

  function saveCSV(filename, columns, rows, container) {
    const blob = new Blob(["\ufeff", toCSV(columns, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = make("a");
    a.href = url;
    a.download = filename;
    a.hidden = true;
    container.appendChild(a); // inside the modal: everything outside it is inert
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ============================================================
  // wonkData.drill(opts) -> { close, table, dialog }
  // ============================================================
  let current = null;

  function drill(opts = {}) {
    if (typeof opts.title !== "string" || !opts.title) {
      throw new TypeError("wonkData.drill(opts): opts.title must be a non-empty string");
    }
    const f = fmt();
    const rows = Array.isArray(opts.rows) ? opts.rows : [];

    const dialog = make("dialog", "wonk-modal wonk-drill");
    const titleId = nextId("wonk-drill-title");
    dialog.setAttribute("aria-labelledby", titleId);
    const head = make("header", "wonk-drill-head");
    const heading = make("div", "wonk-drill-heading");
    const h2 = make("h2", "", opts.title);
    h2.id = titleId;
    const count = `${f.num(rows.length)} ${rows.length === 1 ? "row" : "rows"}${opts.subtitle ? ` · ${opts.subtitle}` : ""}`;
    heading.append(h2, make("p", "wonk-drill-count", count));
    const actions = make("div", "wonk-drill-actions");
    let download = null;
    if (opts.download) {
      download = make("button", "wonk-btn", "Download CSV");
      download.type = "button";
      actions.appendChild(download);
    }
    const closeBtn = make("button", "wonk-btn", "Close");
    closeBtn.type = "button";
    closeBtn.autofocus = true;
    actions.appendChild(closeBtn);
    head.append(heading, actions);
    const body = make("div", "wonk-drill-body");
    dialog.append(head, body);

    // build the table before the dialog enters the page: bad options
    // throw here and leave nothing behind
    const t = table(body, {
      columns: opts.columns,
      rows,
      sort: opts.sort,
      limit: opts.limit,
      detail: opts.detail,
      foldKey: opts.foldKey,
      rowKey: opts.rowKey,
      onRowAction: opts.onRowAction,
      empty: opts.empty,
      label: opts.title,
      caption: opts.title,
      captionHidden: true,
    });

    if (current) current.close(); // one drill at a time
    // after that close: focus may have moved back to the first drill's opener
    const opener = opts.opener instanceof Element && opts.opener.isConnected ? opts.opener : document.activeElement;

    let closed = false;
    function finish() {
      if (closed) return;
      closed = true;
      t.destroy();
      dialog.remove();
      if (current === api) current = null;
      // native <dialog> already returned focus to the element focused at
      // showModal(); this also covers an explicit opener. A removed
      // opener leaves focus on <body>.
      if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === "function") opener.focus();
      else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    }
    const api = Object.freeze({
      dialog,
      table: t,
      close() {
        if (dialog.open) dialog.close();
        finish();
      },
    });

    dialog.addEventListener("close", finish); // Escape, form method=dialog, dialog.close()
    // backdrop: a click whose target is the dialog itself (it has no
    // padding). A drag that starts inside and ends outside is not one.
    let downInside = false;
    dialog.addEventListener("pointerdown", (e) => { downInside = e.target !== dialog; });
    dialog.addEventListener("click", (e) => {
      const inside = downInside;
      downInside = false;
      if (e.target === dialog && !inside) api.close();
    });
    closeBtn.addEventListener("click", () => api.close());
    if (download) {
      const filename = typeof opts.download === "string" ? opts.download : "records.csv";
      download.addEventListener("click", () => saveCSV(filename, opts.columns, t.rows, dialog));
    }

    document.body.appendChild(dialog);
    current = api;
    dialog.showModal();
    return api;
  }

  // ============================================================
  // declarative drills: [data-wonk-drill="name"] + wonkData.drills()
  // ============================================================
  const registry = new Map();
  const warnedDrills = new Set();

  function drills(map) {
    if (!map || typeof map !== "object") {
      throw new TypeError("wonkData.drills(map): map must be an object of name -> (el) => drill options");
    }
    const entries = Object.entries(map);
    entries.forEach(([name, factory]) => {
      if (typeof factory !== "function") {
        throw new TypeError(`wonkData.drills: "${name}" must be a function that returns drill options`);
      }
    });
    entries.forEach(([name, factory]) => registry.set(name, factory));
  }

  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;
    const trigger = e.target.closest("[data-wonk-drill]");
    if (!trigger) return;
    const name = trigger.getAttribute("data-wonk-drill");
    const factory = registry.get(name);
    if (!factory) {
      if (!warnedDrills.has(name)) {
        warnedDrills.add(name);
        console.warn(`wonkData: no drill registered for data-wonk-drill=${JSON.stringify(name)}; add it with wonkData.drills({ ${JSON.stringify(name)}: () => ({ title, columns, rows }) })`);
      }
      return;
    }
    e.preventDefault();
    drill({ ...factory(trigger), opener: trigger });
  });

  window.wonkData = Object.freeze({ table, drill, drills, toCSV });
})();
