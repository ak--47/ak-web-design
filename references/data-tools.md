# build the tool around the data task

read this before building a dashboard, event explorer, import tool, or query console.
`demo/workbench.html` is the working reference. its 12 records are local fixtures.
`assets/wonk-data.css` is the reusable layout and component pack. `demo/workbench.js`
is example application logic, not a generic query engine.

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
| results region | `.wonk-table-scroll` | local horizontal scrolling, sticky headers, caption, keyboard focus |
| sortable header | `button.wonk-sort` | update the owning `th[aria-sort]`; preserve numeric sorting |
| row selection | `tr[data-selected]`, `.wonk-selection-bar` | native checkboxes, mixed select-all state, count, explicit bulk action |
| query specification | `.wonk-query-editor`, `.wonk-query-meta` | mono editor/readout; explain whether it executes SQL or displays a specification |
| record inspector | `dialog.wonk-inspector` | side panel using native `showModal()`, Escape, focus containment and return |
| freshness strip | `.wonk-freshness` | source, timezone, snapshot timestamp, stale label |
| job queue | `.wonk-job-list`, `.wonk-job` | ordered jobs with named state and native progress |
| result state | `.wonk-state[data-state]` | separate empty, stale, failed, unconfigured, and permission states |

these are styled compositions. table filtering, sorting, selection, downloads, and
inspection are wired in `demo/workbench.js`. copy the relevant behavior into the app's
state model. the CSS alone does not wire them.

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
never label all positive deltas green; an increase in errors is a worse result.

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

in the workbench, select-all means **visible records**. filtering clears selections
that leave the result. sorting preserves selections by record ID. production apps
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
