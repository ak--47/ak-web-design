# Plan 005: Every number can open its records — reusable table, drill-down dialog, formatting helpers, and honest delta colors

> **Executor instructions**: Follow this plan step by step. Write each new
> check first, watch it fail, then implement (red → green). Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `ls assets/wonk-data.js 2>/dev/null` → nothing (new file).
> Read the current `assets/wonk.js` and `assets/wonk.css` fully first: plans
> 002-004 changed them (idempotent init, body `MutationObserver`, toasts in
> dialogs, `data-tip` hints + `wonk.tip`, `.wonk-row-toggle`, `.wonk-more`,
> `wonk.foldAll`). Reuse those; never re-implement them.

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: LOW (new pack JS + additive CSS; the workbench demo is rewired)
- **Depends on**: plan 004
- **Category**: direction
- **Planned at**: `ea62dcd` + plans 001-004, 2026-09-24

## Why this matters

AK: "big numbers should be clickable and show you a data table of what's in
that number". The one-shot cerebros apps had no such pattern; the fix PR
hand-built `JevDrill.open` (a modal table with sort, count, money totals,
focus trap, focus return) plus three different "clickable number" looks.
WONK's own docs admit the gap: `references/data-tools.md:42-44` "table
filtering, sorting, selection, downloads, and inspection are wired in
`demo/workbench.js`... the CSS alone does not wire them", and the same logic
is hand-written twice in the demos. `.wonk-stat` colors every rise green
(`wonk.css` `.delta-up { color: var(--ak-ok) }`) though
`references/data-tools.md:85` says "never label all positive deltas green; an
increase in errors is a worse result". There is no number formatting
helper, so every app formats money, compact numbers, percents, and
"unknown" differently. After this plan, one-shot agents get all of it off the shelf.

## Current state

- `assets/wonk-data.css` — CSS-only data pack: `.wonk-table-scroll`
  (`overflow:auto; max-height:28rem`, sticky `th` on `--ak-surface-2`),
  `.wonk-sort` (unstyled header button), `.wonk-table tr[data-selected="true"] td { background: var(--ak-wash) }`,
  `.wonk-selection-bar`, `dialog.wonk-inspector` side panel, `.wonk-state[data-state]`, `.wonk-filter-chip`.
- `assets/wonk.css` — `.wonk-table` (`th` mono xs uppercase ink-3, `td.num`
  right-aligned mono), `.wonk-stat` (flex column; `.wonk-num` 2xl;
  `.delta-up` ok, `.delta-down` err), `.wonk-modal` (`max-width: min(90vw, 32rem)`
  — too narrow for a records table), `.wonk-badge--*`.
- `demo/workbench.js:25-103` — the reference behavior to generalize:
  select-all means visible rows, mixed state via `indeterminate`, filtering
  drops selections that leave, sorting preserves selection by id,
  `th[aria-sort]` updated, text via `textContent` only, JSON export of the
  selected set. Sorting is hard-coded to one column.
- The proven drill contract (`/Users/ak/code/cerebros/src/apps/shared/public/jev-drill.js:80-238`, read-only):
  `open({title, subtitle, columns, rows, sort})`; columns
  `{key, label, type: text|money|num|date|link|html, href(row), width, total}`;
  `money` columns get a total unless `total:false` (one record repeated
  across rows would double-count); `link` accepts https only; count line
  "N rows · subtitle"; Esc / close button / backdrop click close; focus
  returns to the opener; sort toggles desc→asc. Its gaps: builds HTML
  strings (an `html` column type), a div with `role="dialog"` instead of
  native `<dialog>`, no export, `width` ignored in crowded tables.

## Design (build exactly this)

### 1. `wonk.fmt` (base, in `assets/wonk.js`)

All return strings; `null`, `undefined`, `""`, `NaN` → `"—"` (unknown, not zero).
Locale defaults to `"en-US"`; `wonk.fmt.locale = "…"` changes it.

| call | example → result |
|---|---|
| `num(n, {digits=0})` | `1234.5` → `"1,235"` |
| `compact(n)` | `1234` → `"1.2K"`, `2500000` → `"2.5M"`, `950` → `"950"` |
| `money(n, {currency="USD", compact=false, digits=0})` | `1234.5` → `"$1,235"`; `{compact:true}` `1234567` → `"$1.2M"` |
| `pct(ratio, {digits=0})` | `0.123` → `"12%"`, `{digits:1}` → `"12.3%"` |
| `duration(ms)` | `450` → `"450 ms"`, `1200` → `"1.2 s"`, `200000` → `"3m 20s"`, `5400000` → `"1h 30m"` |
| `date(value, {tz="UTC", time=false})` | `"2026-09-24T15:04:00Z"` → `"2026-09-24"`; `{time:true}` → `"2026-09-24 15:04 UTC"` |
| `delta(change, {higherIsBetter=true, format="pct"})` | returns `{text, direction: "up"\|"down"\|"flat", sentiment: "good"\|"bad"\|"neutral", className}`; `0.12` → `{text:"▲ 12%", direction:"up", sentiment:"good", className:"delta--good"}`; with `higherIsBetter:false` → `sentiment:"bad"`, `className:"delta--bad"`; `0` → `"flat"`, `"neutral"`, text `"— 0%"`. `format` is `"pct"`, `"num"`, `"money"`, or a function. |

### 2. Delta CSS (`assets/wonk.css`)

`.delta--good { color: var(--ak-ok) }`, `.delta--bad { color: var(--ak-err) }`,
`.delta--neutral { color: var(--ak-ink-2) }` usable anywhere (not only in
`.wonk-stat`). Keep `.delta-up`/`.delta-down` working as legacy aliases.
The arrow glyph carries direction; the color carries sentiment; so color
is never the only signal.

### 3. Drillable values (`assets/wonk.css`)

- `button.wonk-stat` / `.wonk-stat--drill`: reset button chrome (no
  uppercase, no border, transparent, left-aligned, full-width in its
  cell); the `.wonk-num` gets a dotted underline (`text-decoration: underline dotted`,
  `text-decoration-color: var(--ak-ink-3)`, `text-underline-offset: 0.2em`),
  hover turns the number `--ak-a1-text`, visible focus ring.
- `.wonk-value-link`: inline `button` or `a` for a clickable number or
  record id: mono, tabular numbers, **original case** (no `text-transform`),
  `--ak-a1-text`, dotted underline, focus ring. This replaces the demo's
  misuse of `.wonk-btn--quiet` (which uppercases ids).

### 4. `assets/wonk-data.js` → `window.wonkData` (frozen)

Requires `wonk.js` (for `wonk.fmt`, `wonk.tip`, row toggles) and
`wonk-data.css`. Everything renders through DOM APIs and `textContent`;
never `innerHTML` with data.

**`wonkData.table(host, opts)`** → controller. Renders into `host`:
`div.wonk-table-scroll[role=region][tabindex=0][aria-label]` > `table.wonk-table`.

opts:
- `columns`: `[{key, label, type, hint, render, href, total, align, width, sortable=true, value}]`
  - `type`: `text` (default) | `num` | `money` | `pct` | `date` | `duration` | `badge` | `link`.
    Numeric types right-align (`.num`), format with `wonk.fmt`, sort numerically.
  - `hint`: header definition → `data-tip` on the `th` (plan 003 makes it focusable and accessible).
  - `render(row)` → Node or string (string rendered as text). Wins over `type` formatting.
  - `value(row)` → the sort/total value when it differs from `row[key]`.
  - `href(row)`: for `link`; only `http:`/`https:` URLs (checked with `new URL`), else plain text.
  - `badge`: renders `span.wonk-badge` (+ `wonk-badge--${row[key + "Kind"]}` if present).
  - `total`: `money` totals by default (set `false` to disable); `num`
    totals only with `total: true`. Totals render in `tfoot`, first cell `Total`.
- `rows`: array of plain objects. `rowKey` (default `"id"`; fall back to the index).
- `sort`: `{key, dir: "asc"|"desc"}`. Clicking a header toggles (first
  click: desc for numeric/date, asc for text). Stable: tie-break by
  `rowKey`. Nulls always last. Text compares with
  `localeCompare(…, {numeric: true, sensitivity: "base"})`. Update `th[aria-sort]`
  and keep focus on the clicked header button after re-render.
- `caption`: string; `captionHidden: true` → visually hidden caption
  (use the `.wonk-sr` class if it exists by then, else inline the standard
  visually-hidden rule in `wonk-data.css` as `.wonk-sr`; check first).
- `select: true`: checkbox column with select-all (`indeterminate` for
  mixed); selection by `rowKey`; preserved across sort; rows that leave
  via `setRows` are dropped from the selection; `tr[data-selected="true"]`;
  host dispatches `wonk-data:select` with `{detail: {selected: [...keys]}}`.
- `detail(row)` → Node: first data cell becomes a `.wonk-row-toggle`
  (plan 004) controlling a following `tr.wonk-row-detail[hidden]` with a
  full-width cell. Pass `foldKey(row)` to set `data-fold-key` so open rows
  survive `setRows`.
- `limit: n`: render the first `n` sorted rows plus a `.wonk-more` line
  ("Showing n of N" + "Show all" button). "Show all" renders the rest and
  moves focus to the first newly shown row's first focusable cell or the table region.
- `empty`: copy for zero rows, default `"No records match."`, rendered as
  one full-width cell (`td[colspan]`) with ink-2 text.
- `onRowAction(row)`: if given, the first column renders its text inside
  a `.wonk-value-link` button that calls it (never a whole-row click handler).

controller: `setRows(rows)`, `setSort(key, dir)`, `rows` (current sorted),
`selected` (array of keys), `clearSelection()`, `destroy()` (empties host,
removes listeners).

**`wonkData.drill(opts)`** → `{close, table, dialog}`. Opens a native
`dialog.wonk-modal.wonk-drill` with `showModal()`:
- head: `h2` title; a line `N rows · subtitle` (mono, ink-2, `wonk.fmt.num`);
  optional `download: "deals.csv"` → a `Download CSV` button;
  a `Close` button (`autofocus`).
- body: a `wonkData.table` with the same `columns`, `rows`, `sort`,
  `limit`, `detail` options.
- width `min(72rem, 96vw)`, max-height `88vh`, body scrolls, sticky head.
- Escape (native), the close button, and a click on the backdrop (click
  whose target is the dialog element itself) close it. Closing removes the
  dialog from the DOM and destroys the table. Native `<dialog>` returns
  focus to the opener; if the opener is gone, focus `document.body`.
- Only one drill at a time: opening a second closes the first.

**Declarative drills**: `wonkData.drills({name: () => opts})` registers
factories; a click on any `[data-wonk-drill="name"]` (document-level
delegation) opens `wonkData.drill(factory())`. Unknown name → one
`console.warn`.

**`wonkData.toCSV(columns, rows)`** → string. Header row of labels; cell
values are the raw values (not formatted), dates as ISO; quote every
field, double inner quotes; guard spreadsheet formulas: a cell starting
with `=`, `+`, `-`, `@`, tab, or CR gets a leading `'`. The drill's
Download button uses it with a Blob and a temporary `a[download]`.

### 5. Wire the workbench demo onto the module

`demo/workbench.js`: replace the hand-built results table (render rows,
sort, selection, record button) with `wonkData.table(..., {select: true,
onRowAction: inspect, sort: {key: "latency", dir: "desc"}})`. Keep the
draft/applied query logic, filter chips, channel bank, inspector, and
export exactly as they behave now (export reads `controller.selected`).
Load `../assets/wonk-data.js` in `demo/workbench.html` after `wonk.js`.
The page must look and behave the same except: every column now sorts, and
record ids keep their case.

## Scope

**In scope**: `assets/wonk.js` (fmt only), `assets/wonk.css` (delta,
drillable values), `assets/wonk-data.js` (create), `assets/wonk-data.css`
(drill dialog, table additions), `demo/base-checks.js` (fmt + delta
checks), `demo/data-checks.js` (create, `window.wonkDataChecks`),
`scripts/check.mjs` (add one `SUITES` line:
`{ name: "data", page: "/demo/index.html", global: "wonkDataChecks" }`),
`demo/index.html` (load `wonk-data.css`/`wonk-data.js`/`data-checks.js`;
add one `SECTION:drill` block after `datatools`; update the `cards`
section's delta example to `delta--good/--bad`), `demo/workbench.html`,
`demo/workbench.js`, `references/data-tools.md`, `references/components.md`,
`references/hierarchy.md` (make its "numbers lead to records" line link
the new drill section), `README.md` (packs table: data pack now has JS;
components row; section list), `SKILL.md` (only if a hard-rule line needs
the drill link — keep it short).

**Out of scope**: `demo/catalog.js` datatools duplicate (leave it), charts,
radio files, cerebros, server pagination/virtualization (document the
limit only).

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

### Step 1: `wonk.fmt` + delta — checks first
Add to `demo/base-checks.js`: every example row in the fmt table above,
plus `—` for `null`, `undefined`, `NaN`, `""`; `delta` good/bad/neutral
classes. Run `npm test -- base` → new checks fail. Implement. → pass.

**Verify**: `npm test -- base` → all pass.

### Step 2: `demo/data-checks.js` — checks first
Model on `demo/code-checks.js`. Fixture hosts hidden-then-removed. Checks:
1. headers render as `button.wonk-sort`; click a `num` header → numeric
   order (`10` after `9` descending first), `th[aria-sort]` set, focus stays on that button; second click reverses.
2. nulls sort last in both directions; ties keep `rowKey` order.
3. a row value `"<img src=x onerror=alert(1)>"` renders as text (no `img` in the table).
4. `money` total in `tfoot` equals the sum; `total:false` → no total; `num` without `total:true` → no total.
5. `select:true`: select one → select-all `indeterminate`; select-all →
   all selected; sort → same keys selected; `setRows` without one key →
   that key dropped; `wonk-data:select` fired.
6. `rows: []` → empty copy cell spanning all columns.
7. `limit: 2` on 5 rows → 2 rows + `.wonk-more`; click Show all → 5 rows.
8. `detail` → `.wonk-row-toggle` with `aria-expanded="false"`; click →
   detail row visible.
9. `link` with `href: () => "javascript:alert(1)"` → no `a[href]`; https → `a[href]`.
10. column `hint` → `th[data-tip]`.
11. `drill(...)` → `dialog.wonk-drill` matches `:modal`, contains title,
    `3 rows` count text, and a table; Escape closes it (dispatch
    `keydown`, or call `dialog.close()` via the cancel path — verify the
    element is removed) and focus returns to the opener button.
12. click on the dialog backdrop (dispatch click with target = dialog) closes it.
13. `[data-wonk-drill="x"]` click with `wonkData.drills({x: () => opts})` opens a drill.
14. `toCSV`: quotes, doubled quotes, formula guard (`"=SUM(1)"` → `"'=SUM(1)"`).

Add the `SUITES` line and the script tags. Run `npm test -- data` → fail. Implement `assets/wonk-data.js` + CSS. → pass.

**Verify**: `npm test -- data` → 14 pass.

### Step 3: Workbench rewire
Rewire as designed.

**Verify**: `npm test` → all suites pass; manually (Playwright) load
`/demo/workbench.html`, run a query with a search term, sort by source,
select two rows, open one record's inspector → no page errors; record ids
display in their original lowercase.

### Step 4: Gallery + docs
`SECTION:drill` in `demo/index.html`: a row of three `button.wonk-stat`
tiles (fixture data) opening drills (one with money totals and CSV, one
with row detail), a `wonkData.table` with typed columns, header hints, a
limit, and a `.wonk-value-link`; a small delta example (latency up =
`delta--bad`, conversions up = `delta--good`). Update docs: data-tools.md
gets "table module" and "drill-down" sections with copy-paste examples and
replaces the "CSS alone does not wire them" paragraph; components.md gets
the fmt table, delta classes, drillable values.

**Verify**: `grep -n "CSS alone does not wire" references/data-tools.md` → nothing;
START/END section marker counts equal; `npm test` → all pass.

### Step 5: Look at it
Screenshots of `demo/index.html#drill` with a drill open, dark and paper,
1280 and 390 wide → `/tmp/wonk-drill-*.png`. Look at them.

**Verify**: 4 screenshots; drill fits 390px (table scrolls inside), totals readable.

## Done criteria

- [ ] `npm test` exits 0 including the new `data` suite (14) and new base fmt checks
- [ ] `grep -n "innerHTML" assets/wonk-data.js` → nothing, or only assigning `""`
- [ ] no new hex colors outside `wonk-tokens.css`
- [ ] `git status --short` → only in-scope files (plus others' untracked files)

## STOP conditions

- Plan 004's `.wonk-row-toggle` delegation conflicts with table re-render (state lost on `setRows` even with `foldKey`).
- The workbench rewire changes existing behavior described in `references/data-tools.md` "tables need a declared selection policy".

## Maintenance notes

- Server pagination stays the app's job; the module is for arrays already in memory (hundreds to low thousands of rows).
- Plan 008 (charts) can open `wonkData.drill` from a chart mark.
- Plan 006's template uses `button.wonk-stat` + a registered drill.
