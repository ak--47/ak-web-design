/* ============================================================
   demo/data-checks.js · browser-callable checks for wonk-data.js
   (window.wonkData: table, drill, drills, toCSV)
   Runs headless via `npm test` (or `npm test -- data`). By hand:
   load it on any page that already has wonk.js, wonk-data.css, and
   wonk-data.js loaded (e.g. demo/index.html), then call:

     await wonkDataChecks.run();

   Every table renders into its own hidden fixture host, which is
   destroyed and removed afterwards. Every drill is closed in a
   finally block. No dependency on the host page's markup, no network
   calls. Returns { passed, failed, results } where each result is
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

  // a hidden host, off screen but rendered (focus and layout work)
  function withHost() {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; left:-9999px; top:0; width:800px;";
    document.body.appendChild(host);
    return host;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`;
  const same = (got, want, label) =>
    assert(JSON.stringify(got) === JSON.stringify(want), `${label}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

  // data rows only (detail rows excluded), and one column's cell text
  const bodyRows = (host) => [...host.querySelectorAll("tbody tr:not(.wonk-row-detail)")];
  const column = (host, i) => bodyRows(host).map((tr) => tr.cells[i].textContent.trim());
  const sortButton = (host, key) => host.querySelector(`thead th[data-key="${key}"] button.wonk-sort`);
  const closeDrills = () => document.querySelectorAll("dialog.wonk-drill").forEach((d) => { if (d.open) d.close(); d.remove(); });

  // ============================================================
  // table: sorting
  // ============================================================
  check("table: headers render as button.wonk-sort; a num header sorts numerically (desc first), sets th[aria-sort], keeps focus; a second click reverses", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, {
        columns: [{ key: "name", label: "name" }, { key: "n", label: "count", type: "num" }],
        rows: [{ id: "a", name: "a", n: 9 }, { id: "b", name: "b", n: 10 }, { id: "c", name: "c", n: 2 }],
      });
      const region = host.querySelector(":scope > .wonk-table-scroll");
      assert(region, "the host should hold a div.wonk-table-scroll");
      assert(region.getAttribute("role") === "region" && region.getAttribute("tabindex") === "0" && region.getAttribute("aria-label"),
        "the scroll div should have role=region, tabindex=0, and an aria-label");
      assert(region.querySelector("table.wonk-table"), "the region should hold a table.wonk-table");
      const ths = [...host.querySelectorAll("thead th")];
      assert(ths.length === 2 && ths.every((th) => th.querySelector("button.wonk-sort")), "every header should hold a button.wonk-sort");

      sortButton(host, "n").focus();
      sortButton(host, "n").click();
      same(column(host, 1), ["10", "9", "2"], "first click on a num header: numeric, descending");
      assert(host.querySelector('th[data-key="n"]').getAttribute("aria-sort") === "descending", "th[aria-sort] should be descending");
      assert(!host.querySelector('th[data-key="name"]').hasAttribute("aria-sort"), "the unsorted header should have no aria-sort");
      assert(document.activeElement === sortButton(host, "n"), `focus should stay on the count header button, got ${document.activeElement && document.activeElement.outerHTML}`);

      sortButton(host, "n").click();
      same(column(host, 1), ["2", "9", "10"], "second click: ascending");
      assert(host.querySelector('th[data-key="n"]').getAttribute("aria-sort") === "ascending", "th[aria-sort] should be ascending");
      assert(document.activeElement === sortButton(host, "n"), "focus should still be on the count header button");
      same(t.rows.map((r) => r.id), ["c", "a", "b"], "controller.rows in sorted order");
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table: nulls sort last in both directions; ties keep rowKey order (not input order); text ties are case-insensitive", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, {
        columns: [{ key: "name", label: "name" }, { key: "v", label: "v", type: "num" }],
        rows: [
          { id: "c", name: "beta", v: 1 }, { id: "f", name: null }, { id: "b", name: "Alpha", v: 1 },
          { id: "e", name: "gamma", v: "" }, { id: "d", name: "alpha", v: 5 }, { id: "a", name: "", v: null },
        ],
        sort: { key: "v", dir: "desc" },
      });
      const keys = () => bodyRows(host).map((tr) => tr.dataset.key);
      same(keys(), ["d", "b", "c", "a", "e", "f"], "num desc: nulls last, tie b/c in rowKey order");
      t.setSort("v", "asc");
      same(keys(), ["b", "c", "d", "a", "e", "f"], "num asc: nulls still last");
      t.setSort("name", "asc");
      same(keys(), ["b", "d", "c", "e", "a", "f"], "text asc: Alpha/alpha tie in rowKey order, empty and null last");
      t.setSort("name", "desc");
      same(keys(), ["e", "c", "b", "d", "a", "f"], "text desc: ties keep rowKey order, nulls last");
      same(t.rows.map((r) => r.id), keys(), "controller.rows matches the rendered order");
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  // ============================================================
  // table: safety, totals, selection, empty, limit, detail, links, hints
  // ============================================================
  check("table: markup in data, labels, captions, badges, and detail renders as text (no img element)", () => {
    const host = withHost();
    const evil = "<img src=x onerror=alert(1)>";
    let t;
    try {
      t = wonkData.table(host, {
        caption: evil,
        columns: [
          { key: "name", label: evil },
          { key: "status", label: "status", type: "badge" },
          { key: "note", label: "note", render: (row) => row.note },
        ],
        rows: [{ id: evil, name: evil, status: evil, statusKind: 'ok" onmouseover="x', note: evil }],
        onRowAction: () => {},
        detail: () => evil,
      });
      assert(!host.querySelector("img"), "no img element may be created from data");
      assert(host.querySelector("caption").textContent === evil, "the caption should show the markup as text");
      assert(host.querySelector("thead").textContent.includes(evil), "the header label should show the markup as text");
      const cells = bodyRows(host)[0].cells;
      assert(cells[0].textContent.includes(evil) && cells[1].textContent === evil && cells[2].textContent === evil,
        "every cell should show the markup as literal text");
      assert(!cells[1].querySelector("[onmouseover]"), "a bad badge kind must not inject an attribute");
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table: a money column totals in tfoot (sum, unknowns skipped); total:false has none; num has none without total:true", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, {
        columns: [
          { key: "name", label: "name" },
          { key: "amount", label: "amount", type: "money" },
          { key: "credit", label: "credit", type: "money", total: false },
          { key: "seats", label: "seats", type: "num" },
          { key: "units", label: "units", type: "num", total: true },
        ],
        rows: [
          { id: 1, name: "a", amount: 100, credit: 5, seats: 3, units: 2 },
          { id: 2, name: "b", amount: 250.5, credit: 5, seats: 4, units: 3 },
          { id: 3, name: "c", amount: null, credit: 5, seats: 1, units: null },
        ],
      });
      const foot = host.querySelector("tfoot tr");
      assert(foot, "a table with a money column should have a tfoot row");
      const cells = [...foot.cells].map((c) => c.textContent.trim());
      assert(cells[0] === "Total", `the first footer cell should say Total, got ${JSON.stringify(cells[0])}`);
      assert(cells[1] === wonk.fmt.money(350.5), `the money total should be ${wonk.fmt.money(350.5)}, got ${JSON.stringify(cells[1])}`);
      assert(cells[2] === "", `total:false should leave the cell empty, got ${JSON.stringify(cells[2])}`);
      assert(cells[3] === "", `a num column without total:true should have no total, got ${JSON.stringify(cells[3])}`);
      assert(cells[4] === "5", `a num column with total:true should total 5, got ${JSON.stringify(cells[4])}`);
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table select:true: one row -> select-all mixed; select-all -> all; sort keeps keys; setRows drops a leaving key; wonk-data:select fires", () => {
    const host = withHost();
    const events = [];
    host.addEventListener("wonk-data:select", (e) => events.push(e.detail.selected));
    const rows = [{ id: "a", name: "a", n: 1 }, { id: "b", name: "b", n: 2 }, { id: "c", name: "c", n: 3 }];
    let t;
    try {
      t = wonkData.table(host, { select: true, columns: [{ key: "name", label: "name" }, { key: "n", label: "n", type: "num" }], rows });
      const all = () => host.querySelector("thead input[type=checkbox]");
      const box = (key) => host.querySelector(`tbody tr[data-key="${key}"] input[type=checkbox]`);
      const marked = () => bodyRows(host).filter((tr) => tr.dataset.selected === "true").map((tr) => tr.dataset.key).sort();
      assert(all() && box("a"), "select:true should render a select-all checkbox and one checkbox per row");

      box("b").click();
      assert(all().indeterminate && !all().checked, "one of three selected: select-all should be indeterminate");
      same(t.selected, ["b"], "controller.selected after one click");
      same(marked(), ["b"], "tr[data-selected=true]");
      assert(events.length >= 1, "wonk-data:select should fire on a row click");
      same(events[events.length - 1], ["b"], "the event detail");

      all().click();
      assert(all().checked && !all().indeterminate, "select-all click: checked, not mixed");
      same([...t.selected].sort(), ["a", "b", "c"], "every row selected");

      box("a").click();
      sortButton(host, "n").click();
      same([...t.selected].sort(), ["b", "c"], "sorting keeps the same keys selected");
      same(marked(), ["b", "c"], "sorting keeps tr[data-selected]");
      assert(box("b").checked && !box("a").checked, "sorting keeps each checkbox state");

      const before = events.length;
      t.setRows(rows.filter((r) => r.id !== "c"));
      same(t.selected, ["b"], "setRows without c drops c from the selection");
      assert(events.length > before, "dropping a key should fire wonk-data:select");
      same(events[events.length - 1], ["b"], "the event after setRows");
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table rows:[] renders the empty copy in one cell spanning every column (select column included)", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, { columns: [{ key: "a", label: "a" }, { key: "b", label: "b" }, { key: "c", label: "c", type: "money" }], rows: [] });
      const trs = host.querySelectorAll("tbody tr");
      assert(trs.length === 1 && trs[0].cells.length === 1, "zero rows should render one row with one cell");
      assert(trs[0].cells[0].colSpan === 3, `the empty cell should span 3 columns, got ${trs[0].cells[0].colSpan}`);
      assert(trs[0].cells[0].textContent.trim() === "No records match.", `default copy, got ${JSON.stringify(trs[0].cells[0].textContent)}`);
      t.destroy();
      t = wonkData.table(host, { select: true, empty: "Nothing here.", columns: [{ key: "a", label: "a" }, { key: "b", label: "b" }], rows: [] });
      const cell = host.querySelector("tbody td");
      assert(cell.colSpan === 3 && cell.textContent.trim() === "Nothing here.", `select:true: colspan 3 and the custom copy, got ${cell.colSpan} ${JSON.stringify(cell.textContent)}`);
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table empty:null or empty:false renders no empty row (the app owns the empty state); headers stay", () => {
    const host = withHost();
    let t;
    try {
      for (const empty of [null, false]) {
        t = wonkData.table(host, { select: true, empty, columns: [{ key: "a", label: "a" }, { key: "b", label: "b" }], rows: [] });
        assert(host.querySelectorAll("tbody tr").length === 0, `empty:${empty} with zero rows should render no tbody row, got ${host.querySelectorAll("tbody tr").length}`);
        assert(!host.querySelector(".wonk-table-empty"), `empty:${empty} should not render .wonk-table-empty`);
        assert(host.querySelectorAll("thead th").length === 3, `empty:${empty} should keep the header row`);
        assert(host.querySelector("thead input[type=checkbox]").disabled, `empty:${empty}: select-all should be disabled with zero rows`);
        t.setRows([{ id: 1, a: "x", b: "y" }]);
        assert(bodyRows(host).length === 1, "setRows with one row should render it");
        t.setRows([]);
        assert(host.querySelectorAll("tbody tr").length === 0, `empty:${empty}: setRows([]) should leave tbody empty`);
        t.destroy();
        t = null;
      }
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table limit:2 on 5 rows shows 2 rows and .wonk-more; Show all shows 5 and moves focus to the first new row", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, {
        limit: 2,
        sort: { key: "n", dir: "desc" },
        columns: [{ key: "name", label: "name" }, { key: "n", label: "n", type: "num" }],
        rows: [1, 2, 3, 4, 5].map((n) => ({ id: `r${n}`, name: `row ${n}`, n })),
        onRowAction: () => {},
      });
      assert(bodyRows(host).length === 2, `limit 2 should render 2 rows, got ${bodyRows(host).length}`);
      same(column(host, 1), ["5", "4"], "the first 2 sorted rows");
      const more = host.querySelector(".wonk-more");
      assert(more && /Showing 2 of 5/.test(more.textContent.replace(/\s+/g, " ")), `.wonk-more should say Showing 2 of 5, got ${more && JSON.stringify(more.textContent)}`);
      const showAll = [...more.querySelectorAll("button")].find((b) => /show all/i.test(b.textContent));
      assert(showAll, "the .wonk-more line should have a Show all button");
      showAll.focus();
      showAll.click();
      assert(bodyRows(host).length === 5, `Show all should render 5 rows, got ${bodyRows(host).length}`);
      const moreAfter = host.querySelector(".wonk-more");
      assert(!moreAfter || moreAfter.hidden, "the .wonk-more line should go away after Show all");
      const third = bodyRows(host)[2];
      assert(third.contains(document.activeElement), `focus should move into the first newly shown row, got ${document.activeElement && document.activeElement.outerHTML}`);
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table detail: the first cell is a .wonk-row-toggle (aria-expanded=false) for a hidden detail row; click shows it; foldKey keeps it open across setRows", () => {
    const host = withHost();
    const prefix = uid("chk-fold");
    const rows = [{ id: "a", name: "a", n: 1 }, { id: "b", name: "b", n: 2 }];
    let t;
    try {
      t = wonkData.table(host, {
        columns: [{ key: "name", label: "name" }, { key: "n", label: "n", type: "num" }],
        rows,
        detail: (row) => { const p = document.createElement("p"); p.textContent = `detail ${row.name}`; return p; },
        foldKey: (row) => `${prefix}-${row.id}`,
      });
      const toggleOf = (key) => host.querySelector(`tbody tr[data-key="${key}"] > :first-child button.wonk-row-toggle`);
      const detailOf = (btn) => document.getElementById(btn.getAttribute("aria-controls"));
      const toggle = toggleOf("a");
      assert(toggle, "the first data cell should hold a button.wonk-row-toggle");
      assert(toggle.getAttribute("aria-expanded") === "false", "the toggle should start collapsed");
      assert(toggle.getAttribute("data-fold-key") === `${prefix}-a`, "foldKey should set data-fold-key on the toggle");
      const detail = detailOf(toggle);
      assert(detail && detail.matches("tr.wonk-row-detail") && detail.hidden, "aria-controls should name a hidden tr.wonk-row-detail");
      assert(detail.cells.length === 1 && detail.cells[0].colSpan === 2, "the detail row should have one full-width cell");

      toggle.click();
      assert(toggle.getAttribute("aria-expanded") === "true" && !detail.hidden, "a click should expand the row and show the detail");
      assert(detail.textContent.includes("detail a"), "the detail row should hold the detail node");

      t.setRows(rows.map((r) => ({ ...r })));
      const fresh = toggleOf("a");
      assert(fresh && fresh !== toggle, "setRows should render fresh rows");
      assert(fresh.getAttribute("aria-expanded") === "true" && !detailOf(fresh).hidden, "the keyed row should stay open across setRows");
      assert(toggleOf("b").getAttribute("aria-expanded") === "false", "an unopened row should stay closed");

      sortButton(host, "n").click();
      assert(toggleOf("a").getAttribute("aria-expanded") === "true" && !detailOf(toggleOf("a")).hidden, "sorting should keep the open row open");
      const order = [...host.querySelectorAll("tbody tr")].map((tr) => (tr.classList.contains("wonk-row-detail") ? "detail" : tr.dataset.key));
      same(order, ["b", "detail", "a", "detail"], "each detail row follows its row after a sort");
    } finally {
      if (t) t.destroy();
      host.remove();
      wonk.foldState.delete(`${prefix}-a`);
      wonk.foldState.delete(`${prefix}-b`);
    }
  });

  check("table link: a javascript: or data: href renders plain text; an https href renders a[href]", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, {
        columns: [{ key: "name", label: "name", type: "link", href: (row) => row.url }],
        rows: [
          { id: 1, name: "bad", url: "javascript:alert(1)" },
          { id: 2, name: "good", url: "https://example.com/x" },
          { id: 3, name: "data", url: "data:text/html,hi" },
        ],
      });
      const cells = bodyRows(host).map((tr) => tr.cells[0]);
      assert(!cells[0].querySelector("a") && cells[0].textContent === "bad", "a javascript: href must render as plain text");
      const a = cells[1].querySelector("a[href]");
      assert(a && a.getAttribute("href") === "https://example.com/x" && a.textContent === "good", "an https href should render a[href]");
      assert(!cells[2].querySelector("a"), "a data: href must render as plain text");
      t.destroy();
      t = wonkData.table(host, { columns: [{ key: "name", label: "name", type: "link", href: () => "javascript:alert(1)" }], rows: [{ id: 1, name: "x" }] });
      assert(!host.querySelector("tbody a[href]"), "href: () => \"javascript:alert(1)\" must not render a[href]");
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  check("table column hint renders th[data-tip]", () => {
    const host = withHost();
    let t;
    try {
      t = wonkData.table(host, { columns: [{ key: "n", label: "deals", type: "num", hint: "Deals whose close date falls in the period" }], rows: [{ id: 1, n: 3 }] });
      const th = host.querySelector('thead th[data-key="n"]');
      assert(th && th.getAttribute("data-tip") === "Deals whose close date falls in the period", `expected th[data-tip], got ${th && th.outerHTML}`);
    } finally {
      if (t) t.destroy();
      host.remove();
    }
  });

  // ============================================================
  // drill
  // ============================================================
  const drillOpts = (title) => ({
    title,
    subtitle: "this quarter",
    columns: [{ key: "name", label: "deal" }, { key: "amount", label: "amount", type: "money" }],
    rows: [{ id: 1, name: "Acme", amount: 820000 }, { id: 2, name: "Globex", amount: 640000 }, { id: 3, name: "Initech", amount: 440000 }],
  });

  check("drill: opens a :modal dialog.wonk-drill with the title, \"3 rows\", and a table; the Escape path removes it and returns focus to the opener", async () => {
    const host = withHost();
    const opener = document.createElement("button");
    opener.type = "button";
    opener.textContent = "open";
    host.appendChild(opener);
    try {
      opener.focus();
      const d = wonkData.drill(drillOpts("Open deals"));
      const dlg = d.dialog;
      assert(dlg && dlg.matches("dialog.wonk-modal.wonk-drill"), "drill should return a dialog.wonk-modal.wonk-drill");
      assert(dlg.matches(":modal"), "the drill should be modal (showModal)");
      assert(dlg.querySelector("h2") && dlg.querySelector("h2").textContent === "Open deals", "the h2 should hold the title");
      assert(/(^|\D)3 rows · this quarter/.test(dlg.textContent), `the count line should read "3 rows · this quarter", got ${JSON.stringify(dlg.textContent.slice(0, 120))}`);
      assert(dlg.querySelector("table.wonk-table") && d.table && d.table.rows.length === 3, "the drill should hold a wonkData.table with 3 rows");
      assert(typeof d.close === "function", "drill should return a close function");
      const close = [...dlg.querySelectorAll("button")].find((b) => b.textContent.trim() === "Close");
      assert(close && close.hasAttribute("autofocus"), "the drill should have a Close button with autofocus");

      if (typeof dlg.requestClose === "function") dlg.requestClose(); // the Escape path: cancel, then close
      else dlg.close();
      await sleep(30);
      assert(!dlg.isConnected, "closing should remove the dialog from the DOM");
      assert(document.activeElement === opener, `focus should return to the opener, got ${document.activeElement && document.activeElement.outerHTML}`);
    } finally {
      closeDrills();
      host.remove();
    }
  });

  check("drill: a click on the backdrop (target = dialog) closes it; a click inside does not; a second drill closes the first", async () => {
    const host = withHost();
    const opener = document.createElement("button");
    opener.type = "button";
    opener.textContent = "open";
    host.appendChild(opener);
    try {
      opener.focus();
      const first = wonkData.drill(drillOpts("First"));
      const second = wonkData.drill(drillOpts("Second"));
      await sleep(30);
      assert(!first.dialog.isConnected, "opening a second drill should remove the first");
      assert(document.querySelectorAll("dialog.wonk-drill").length === 1, "only one drill may be open");
      const dlg = second.dialog;
      dlg.querySelector("h2").click();
      await sleep(30);
      assert(dlg.open && dlg.isConnected, "a click inside the dialog must not close it");
      dlg.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await sleep(30);
      assert(!dlg.isConnected, "a click whose target is the dialog itself should close and remove it");
    } finally {
      closeDrills();
      host.remove();
    }
  });

  check("drills: a click on [data-wonk-drill=name] opens the registered drill; an unknown name warns once", async () => {
    const host = withHost();
    const name = uid("chk-drill");
    const unknown = uid("chk-missing");
    const realWarn = console.warn;
    let warned = 0;
    try {
      wonkData.drills({ [name]: () => drillOpts("Declared drill") });
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-wonk-drill", name);
      btn.textContent = "12 deals";
      host.appendChild(btn);
      btn.focus();
      btn.click();
      const dlg = document.querySelector("dialog.wonk-drill");
      assert(dlg && dlg.open && dlg.querySelector("h2").textContent === "Declared drill", "the click should open the registered drill");
      dlg.close();
      await sleep(30);
      assert(!dlg.isConnected, "closing should remove the declared drill");

      console.warn = () => { warned++; };
      const other = document.createElement("button");
      other.type = "button";
      other.setAttribute("data-wonk-drill", unknown);
      host.appendChild(other);
      other.click();
      other.click();
      assert(warned === 1, `an unknown drill name should warn exactly once, got ${warned}`);
      assert(!document.querySelector("dialog.wonk-drill"), "an unknown drill name should open nothing");
    } finally {
      console.warn = realWarn;
      closeDrills();
      host.remove();
    }
  });

  // ============================================================
  // toCSV
  // ============================================================
  check("toCSV: label header, every field quoted, inner quotes doubled, raw values, ISO dates, formula guard on strings", () => {
    const csv = wonkData.toCSV(
      [
        { key: "name", label: "Name" },
        { key: "note", label: 'Say "hi"' },
        { key: "when", label: "When", type: "date" },
        { key: "amount", label: "Amount", type: "money" },
        { key: "x", label: "X" },
      ],
      [
        { name: "=SUM(1)", note: 'a "b" c', when: "2026-09-24T15:04:00Z", amount: -5, x: null },
        { name: "+1", note: "-2", when: new Date("2026-01-02T00:00:00Z"), amount: 1234.5, x: "@home" },
        { name: "\tx", note: "\rline", when: null, amount: undefined, x: "plain" },
      ]
    );
    const lines = csv.split("\r\n");
    assert(lines.length === 4, `expected 4 lines, got ${lines.length}: ${JSON.stringify(csv)}`);
    same(lines[0], '"Name","Say ""hi""","When","Amount","X"', "header");
    same(lines[1], '"\'=SUM(1)","a ""b"" c","2026-09-24T15:04:00.000Z","-5",""', "row 1 (=SUM guarded; a number stays raw)");
    same(lines[2], '"\'+1","\'-2","2026-01-02T00:00:00.000Z","1234.5","\'@home"', "row 2 (+, -, @ guarded)");
    same(lines[3], '"\'\tx","\'\rline","","","plain"', "row 3 (tab and CR guarded; unknowns empty)");
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
    console.log(`wonkDataChecks: ${results.length - failed.length}/${results.length} passed`);
    return { passed: results.length - failed.length, failed: failed.length, results };
  }

  window.wonkDataChecks = { run, checks };
})();
