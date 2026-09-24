# build the tool around the data task

read this before building a dashboard, event explorer, import tool, or query console.
`demo/workbench.html` is the working reference. its 12 records are local fixtures.
`assets/wonk-data.css` is the reusable layout and component pack. `assets/wonk-data.js`
(`window.wonkData`) renders records tables and drill-down dialogs. `demo/workbench.js`
is example application logic on top of them, not a generic query engine.

## keep the instrument useful

put the source, parameter, and result in the same reading order. a channel strip can
show a source name, record count, bounded meter, and rejection count. a knob changes
one numeric parameter. the result table shows exactly what that parameter selected.

reserve one grouped instrument area per screen. keep navigation, record IDs, search,
and destructive actions conventional. a music reference should never require someone
to learn audio engineering before they can filter a table.

use [instruments.md](instruments.md) for input behavior and [motion.md](motion.md)
for the response to a committed change. `change` commits a draft. **Run** applies an
expensive query. show the estimated cost when the backend can provide one; otherwise
say the estimate is unavailable. never invent a scan count or completion percentage.

## component coverage

| component | shipped selector | use and behavior |
|---|---|---|
| workbench frame | `.wonk-workbench` | wide data layout with responsive page gutters |
| rack section | `.wonk-rack`, `.wonk-rack-head`, `.wonk-rack-body` | named section with a status and optional actions |
| source channel bank | `.wonk-channel-bank`, `.wonk-channel` | equal-width source summaries; stack on narrow screens |
| bounded meter | `meter.wonk-meter` | known bounded measurement; real `min`, `max`, `value`, visible label and units |
| query toolbar | `.wonk-toolbar` | wrapping labeled inputs and explicit Run/Reset buttons |
| applied filter chip | `.wonk-filter-list`, `.wonk-filter-chip` | removable applied condition; name the remove button; restore focus after removal |
| records table | `wonkData.table(host, opts)` | typed, sortable, selectable table with totals, row detail, and a row limit: [table module](#table-module) |
| drill-down dialog | `dialog.wonk-drill`, `wonkData.drill()`, `[data-wonk-drill]` | the records behind a number, in a modal table with CSV download: [drill-down](#drill-down) |
| results region | `.wonk-table-scroll` | local horizontal scrolling, sticky headers, caption, keyboard focus |
| sortable header | `button.wonk-sort` | update the owning `th[aria-sort]`; preserve numeric sorting |
| row selection | `tr[data-selected]`, `.wonk-selection-bar` | native checkboxes, mixed select-all state, count, explicit bulk action |
| query specification | `.wonk-query-editor`, `.wonk-query-meta` | mono editor/readout; explain whether it executes SQL or displays a specification |
| record inspector | `dialog.wonk-inspector` | side panel using native `showModal()`, Escape, focus containment and return |
| freshness strip | `.wonk-freshness` | source, timezone, snapshot timestamp, stale label |
| job queue | `.wonk-job-list`, `.wonk-job` | ordered jobs with named state and native progress |
| result state | `.wonk-state[data-state]` | separate empty, stale, failed, unconfigured, and permission states |

`wonk-data.js` wires the records table and the drill-down: sorting, selection, totals,
row detail, the row limit, and CSV download. the other rows are styled compositions.
the app wires them and keeps filtering, the query, and the inspector in its own state
model; `demo/workbench.js` shows one way.

## copy a section

load `wonk-data.css` after `wonk.css`. use controls and motion packs only when needed.

```html
<section class="wonk-rack" aria-labelledby="results-heading">
  <header class="wonk-rack-head">
    <h2 id="results-heading">Query results</h2>
    <output class="wonk-num" aria-live="polite">12 records</output>
  </header>
  <div class="wonk-table-scroll" role="region" aria-label="Query results" tabindex="0">
    <table class="wonk-table">
      <caption>One row per event. Latency in milliseconds.</caption>
      <thead><tr><th scope="col">event</th><th scope="col" class="num">latency</th></tr></thead>
      <tbody><tr><td>purchase</td><td class="num">450</td></tr></tbody>
    </table>
  </div>
</section>
```

## table module

`wonkData.table(host, opts)` renders a records table into `host`: a
`div.wonk-table-scroll[role=region]` holding a `table.wonk-table` with sortable
headers, typed cells, totals, selection, row detail, and a row limit. load
`wonk-data.css` and `wonk-data.js` after the base files. it renders through DOM
APIs and `textContent` only, so data never reaches `innerHTML`.

```html
<div id="deals"></div>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    const host = document.getElementById("deals");
    const deals = wonkData.table(host, {
      caption: "Open deals, this quarter",
      columns: [
        { key: "name", label: "deal" },
        { key: "stage", label: "stage", type: "badge" },   // stageKind: "ok" adds wonk-badge--ok
        { key: "amount", label: "amount", type: "money", hint: "List price, before discounts" },
        { key: "close", label: "close date", type: "date" },
        { key: "site", label: "site", type: "link", href: (row) => row.url },
      ],
      rows,                                   // plain objects, each with an id
      sort: { key: "amount", dir: "desc" },
      select: true,
      limit: 20,
      onRowAction: (row) => openDeal(row),     // the first column becomes a .wonk-value-link
    });
    host.addEventListener("wonk-data:select", (e) => {
      count.textContent = `${e.detail.selected.length} selected`;
    });
  });
</script>
```

| column option | what it does |
|---|---|
| `key`, `label` | the row property, and the header text (default: the key) |
| `type` | `text` (default), `num`, `money`, `pct`, `duration`, `date`, `badge`, `link`. numeric types right-align, format with `wonk.fmt`, and sort as numbers. `date` sorts by time |
| `format` | options for the type's `wonk.fmt` call, in cells and totals: `{ digits: 1 }`, `{ currency: "EUR" }`, `{ time: true }` |
| `hint` | the header's definition, shown as a `data-tip` hint |
| `render(row)` | a Node, or a string shown as text. wins over `type` formatting |
| `value(row)` | the sort, total, and CSV value when it differs from `row[key]` |
| `href(row)` | the `link` URL. only `http:` and `https:` URLs become links. anything else is plain text |
| `total` | `money` totals by default (`total: false` turns it off). any other column totals with `total: true`. the `tfoot` total covers every row, also rows past the limit |
| `sortable` | `false` keeps the header as plain text |
| `align`, `width` | `"left"`, `"center"`, or `"right"`; a CSS width (a number means px) |

| table option | what it does |
|---|---|
| `rows`, `rowKey` | the rows, and the property that identifies a row (default `"id"`; a row without it uses its index) |
| `sort` | `{ key, dir }`. a header click toggles it. the first click sorts numbers and dates descending, text ascending. ties keep `rowKey` order. unknown values sort last in both directions |
| `caption`, `captionHidden`, `label` | the caption (visually hidden with `captionHidden: true`). `label` names the scroll region; the default is the caption |
| `select` | a checkbox column. select-all means the visible rows. sorting keeps selections by key. rows that leave with `setRows` leave the selection. the host fires `wonk-data:select` with `detail.selected` |
| `detail(row)` | a Node or string. the first cell becomes a `.wonk-row-toggle` for a hidden detail row. return `null` for a row with no detail. return a function (`(row) => () => buildNotes(row)`) to build the detail only when its row first opens (a click, `foldAll`, a remembered fold key): a re-render on every search keystroke then builds no hidden details. `foldKey(row)` sets `data-fold-key`, so an open row stays open across `setRows` |
| `limit` | show the first N sorted rows and a `.wonk-more` line with a Show all button |
| `empty` | the zero-row copy, default "No records match.", in one full-width cell. `null` or `false` renders no empty row: use it when the app shows its own empty state with a recovery action, so the reader sees one message |
| `onRowAction(row)` | the first column's value becomes a `.wonk-value-link` button that calls it. never make the whole row the only click target |
| `actionLabel(row)` | the row action button's accessible name, when the cell text is not enough: `` (row) => `${row.name}: filter the deals` `` |
| `rowClick` | `true`: a click on a plain part of a row runs `onRowAction`, else flips the row's detail toggle. links, buttons, inputs, labels, the select cell, detail rows, and a drag that selects text keep their own behavior. the action button and the toggle stay the keyboard path |

the controller has `setRows(rows)`, `setSort(key, dir)`, `rows` (sorted),
`selected` (keys, in row order), `sort`, `clearSelection()`, and `destroy()`. a
header click fires `wonk-data:sort` with `detail: { key, dir }`. every body
render (`setRows`, a sort, Show all) fires `wonk-data:render` with
`detail: { rows, sort }`, `rows` being the rows now in the body, in order: mark
the selected row or insert an app row there, since a render replaces the body.
the first one fires inside `wonkData.table()`, before it returns: listen on
the host before the call, and use `host.wonkDataTable`, not the returned value.
a second `wonkData.table()` on the same host destroys the first. all events
bubble; a nested table's events reach the outer host too, so check
`e.target === host`.

the module is for arrays already in memory: hundreds to low thousands of rows.
server pagination and virtual scrolling stay the app's job (see [tables need a
declared selection policy](#tables-need-a-declared-selection-policy)).

## drill-down

every number that counts records opens those records
([hierarchy.md](hierarchy.md#numbers-lead-to-records)). `wonkData.drill(opts)`
opens a native modal `dialog.wonk-drill` with the title, a count line
("12 rows · this quarter"), and a `wonkData.table` with the same `columns`,
`rows`, `sort`, `limit`, `detail`, `foldKey`, `onRowAction`, `actionLabel`,
and `rowClick` options. `note` (text or a Node) shows the work under the
count line, "12,345 minutes / 60 = 205.8 h", and becomes the dialog's
accessible description.

```html
<div class="wonk-card">
  <button type="button" class="wonk-stat" data-wonk-drill="pipeline">
    <span class="wonk-label">open pipeline</span>
    <span class="wonk-num">$4.2M</span>
    <small class="delta--good">▲ 8% vs last week</small>
  </button>
</div>
<p><button type="button" class="wonk-value-link" data-wonk-drill="at-risk">3 deals</button> are at risk.</p>
```

```js
wonkData.drills({
  pipeline: () => ({
    title: "Open pipeline",
    subtitle: "this quarter",
    columns: dealColumns,
    rows: openDeals,                 // the same rows the tile sums
    sort: { key: "amount", dir: "desc" },
    download: "open-pipeline.csv",   // adds a Download CSV button
  }),
  "at-risk": (el) => ({ title: "Deals at risk", columns: dealColumns, rows: atRisk, detail: (row) => row.risk }),
});

// or open one directly, from a row action or a chart mark:
wonkData.drill({ title: "Acme deals", columns: dealColumns, rows: acmeDeals });
```

- `wonkData.drills({ name: (el) => opts })` registers drills. a click on any
  `[data-wonk-drill="name"]` opens one. the listener is on the document, so
  elements rendered later work. the factory gets the clicked element. an
  unknown name warns once in the console.
- Escape, the Close button (focused on open), and a click on the backdrop close
  the drill. closing removes the dialog and destroys its table. focus returns to
  the opener, or to `<body>` when the opener is gone.
- one drill at a time: opening a second closes the first.
- `wonkData.drill()` returns `{ close, table, dialog }`.
- the dialog is `min(72rem, 96vw)` wide and at most `88vh` tall. the head stays
  in place, the table scrolls, and the totals row stays at the bottom.
- the number and the drill come from the same rows: a total of 12 deals opens
  those 12 deals.
- a money column totals by default. when one record repeats across rows (a deal
  listed once per owner), set `total: false` so the total does not double-count.

`wonkData.toCSV(columns, rows)` returns the CSV that Download CSV saves: a header
of labels, raw values (not formatted, `value(row)` when given), every field
quoted. a `date` column writes what the table shows: `YYYY-MM-DD`, or
`YYYY-MM-DD HH:MM UTC` with `format: { time: true }` (an ISO timestamp breaks
spreadsheet date filters and can shift the day). a string that starts with
`=`, `+`, `-`, or `@` (also after leading whitespace), tab, CR, or LF gets a
leading `'`, so a spreadsheet never runs it as a formula. numbers stay as they are.

## measurement, progress, and missing data differ

```html
<label for="capacity">Queue capacity: 750 / 1,000 records</label>
<meter id="capacity" class="wonk-meter" min="0" max="1000" value="750">75%</meter>

<label for="import-progress">Import: 750 / 1,000 records written</label>
<progress id="import-progress" max="1000" value="750">75%</progress>

<label for="query-progress">Query running. Total work unknown.</label>
<progress id="query-progress"></progress>
```

an empty value means unknown, not zero. `0` means the source measured zero.
use an indeterminate progress element when the total is unknown. use a meter for
capacity or a bounded score. neither is a replacement for a time-series chart.

for a telemetry bank, put the number beside the meter. expose sample interval,
denominator, and time window. a rejected record count must have a rejection label.
never label all positive deltas green; an increase in errors is a worse result. use
`wonk.fmt.delta(change, { higherIsBetter: false })` and the `.delta--good` /
`.delta--bad` classes: [components.md § deltas](components.md#deltas).

## keep query state explicit

1. retain the last applied result while the user edits the draft.
2. show `unapplied changes` next to Run when the draft differs.
3. on Run, validate the entire draft. show field errors without deleting input.
4. during backend work, show `aria-busy="true"` on the result region. retain focus.
5. use an abort signal or request ID so an older response cannot replace a newer one.
6. on success, replace results atomically. announce the count once.
7. on failure, retain the draft and label any retained result as stale.

Run, cancel, retry, and reset are application actions. wire them to real behavior.
never display a working-looking button that only prints a toast saying it worked.
the gallery explicitly labels its static job and state recipes.

## tables need a declared selection policy

use a native table until a spreadsheet interaction genuinely needs a grid.
put a real button in a sortable header and a real link or button in the record cell.
never make a whole row clickable as the only way to inspect it.

in the workbench (and in every `wonkData.table` with `select: true`), select-all
means **visible records**. filtering clears selections that leave the result.
sorting preserves selections by record ID. production apps
must say if selection instead spans pages or the full query. downloads use only the
selected set and stay disabled when it is empty.

for large results, use server pagination or the app's existing virtual table. include
a stable sort tie-breaker, explicit page size, total count when known, and an empty
last-page response. don't send a million rows to the browser to imitate the gallery.

## inspectors keep the original context

```html
<dialog class="wonk-modal wonk-inspector" id="record" aria-labelledby="record-heading">
  <form method="dialog"><button class="wonk-btn" autofocus>Close inspector</button></form>
  <h2 id="record-heading">evt-004</h2>
  <pre class="wonk-pre"><code id="payload"></code></pre>
</dialog>
```

```js
payload.textContent = JSON.stringify(record, null, 2);
document.querySelector('#record').showModal();
```

render data through text nodes. event properties, SQL errors, source names, and record
IDs can contain markup. never interpolate them into `innerHTML`. redact credentials
before rendering or exporting. native dialog returns focus to the opener when it
still exists; explicitly choose a remaining control if a result update removes it.

## state copy must identify the cause

| state | say | recovery |
|---|---|---|
| unconfigured | no source connected | name the connection and permission needed |
| loading | query running; total work unknown | cancel only if cancellation is supported |
| empty | zero records match these filters | clear filters or widen the range |
| partial | 2 of 3 sources responded | name the missing source and affected window |
| stale | showing the 09:00 UTC snapshot; refresh failed | retry while keeping the timestamp visible |
| error | source rejected the query; field `event` is missing | preserve the draft and source error |
| forbidden | this account lacks export permission | explain the required permission; no fake retry |

show errors and partial-data warnings inline. a disappearing toast cannot carry the
only explanation. announce completed queries politely. don't announce every dragged
number, arriving row, or meter update.

## what still belongs to the application

saved views need storage and versioning. query editors need the app's SQL parser,
permissions, and execution service. command palettes need command registration and
keyboard conflict handling. graph routing needs a real graph model and an accessible
connection list. this pack does not claim to implement those systems.

## checks before shipping

- keyboard reaches every action, table scroll region, exact input, and dialog close.
- a 375px viewport scrolls the table locally; the whole page does not overflow.
- both themes preserve selected, disabled, stale, and error distinctions.
- sample fixtures, paused streams, and stale results never claim to be live.
- dates have a timezone policy; sampling has a denominator; meters have bounds.
- reduced motion leaves all values and results visible with no intermediate count.
