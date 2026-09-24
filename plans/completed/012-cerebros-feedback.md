# Plan 012: Improvements suggested by the Cerebros upgrade to WONK 0.2

> **Note, not yet an executable plan.** This is a list of suggested
> improvements, collected while five Cerebros apps moved from WONK 0.1 to
> 0.2 (cerebros PR #293, merged 2026-09-24). Each item names the evidence,
> a suggested fix, and a check. Before execution, AK picks the items; then
> they become plan steps (red → green checks, one commit). Do not edit
> `plans/README.md` from an executor run.
>
> **Drift check (run first)**: `git diff --stat 63bb677 -- assets/ references/ CHANGELOG.md`.
> If an in-scope file changed, re-read the lines cited below before acting.

## Status

- **Priority**: P1 items 1-3, P2 items 4-11, P3 items 12-16, docs items 17-21
- **Effort**: M overall (each item is S)
- **Risk**: LOW (additive options and CSS fixes; items 4 and 13 change visible styling)
- **Depends on**: plans 001-011 (all DONE)
- **Category**: bug / api / docs
- **Planned at**: commit `63bb677`, 2026-09-24

## Context

Cerebros (`/Users/ak/code/cerebros`) vendors WONK once at
`src/apps/shared/public/wonk/` for Gap Radar, Outcome Explorer, Call Me
Maybe, Crystal Ball, and FDE. The upgrade replaced a hand-built helper
(`jev-drill.js`) with `data-tip`, `wonk.tip`, `wonkData.table`,
`wonkData.drill`, the disclosure family, and `wonkCharts.plot`. WONK 0.2
covered almost all of it. The items below are the places where each app had
to add a workaround, or where a default hurt. Cerebros workarounds live in
`src/apps/shared/public/jev-kit.js` and in each app's `public/app.js` / CSS;
`docs/memory/wonk-vendoring.md` in that repo lists the traps.

## Bugs (P1)

### 1. CSV writes a `date` column as a UTC timestamp (`assets/wonk-data.js:584`)
`toCSV` turns every `type: "date"` value into `new Date(t).toISOString()`,
so `2026-10-31` becomes `2026-10-31T00:00:00.000Z`. Excel and Sheets keep
that as text (date filters break), and a tool that parses it in a US time
zone shows 2026-10-30. Cerebros moved every drill date to a text column
(`JevKit.dateColumn`) to keep plain dates.
- **Fix:** write a `date` column as `wonk.fmt.date(v, c.format)`, so the CSV
  holds `YYYY-MM-DD`, or `YYYY-MM-DD HH:MM UTC` when `format.time` is set.
- **Check (`demo/data-checks.js`):** `toCSV([{key:"d",type:"date"}], [{d:"2026-10-31"}])`
  returns `"d"\r\n"2026-10-31"`.

### 2. The CSV formula guard misses leading whitespace (`assets/wonk-data.js:580`)
`guard` tests only the first character (`/^[=+\-@\t\r]/`). A Salesforce
subject like `" =HYPERLINK(...)"` or `"\n=1+1"` passes, and some spreadsheet
imports trim the whitespace and run the formula (found by Greptile on
cerebros #293).
- **Fix:** test after leading whitespace: `/^[\s]*[=+\-@]/` or a first
  character in `[\t\r\n]`, then prefix `'`. Keep numbers untouched.
- **Check:** `toCSV` of `" =1+1"`, `"\n=1+1"`, and `"\t=1"` each starts the
  field with `'`; `"-5"` as a number stays `-5`.

### 3. Auto tab stops land inside `aria-hidden` and duplicate label hints (`assets/wonk.js:1030`)
`focusTips` gives `tabindex="0"` to every non-focusable `[data-tip]` and
`.wonk-term`, unless it is in a `tbody`, an interactive element, or a
control's `<label>`. Two cases slipped through in Cerebros:
- a hint inside an `aria-hidden="true"` legend got a tab stop (focusable
  hidden content, an axe violation);
- a `.wonk-term` span inside a `<label data-tip>` got its own tab stop that
  shows the same hint the control's focus already shows.
Every app had to add `data-tip-focus="off"` by hand (dozens of places).
- **Fix:** skip elements inside `[aria-hidden="true"]` and `[inert]`; skip a
  `.wonk-term` that has no tip of its own when an ancestor `<label>` of a
  control carries the tip.
- **Check (`demo/base-checks.js`):** after `wonk.init`, neither fixture has a
  `tabindex`; a plain `.wonk-term[data-tip]` outside them still does.

## API gaps (P2)

### 4. `wonkData.table` builds every row's detail on every render (`assets/wonk-data.js:288`)
`buildRow` calls `detail(row)` for each shown row, and `setRows` rebuilds
all rows. Outcome Explorer re-rendered on each search keystroke and built
~200 hidden details (notes, AI readings) each time; Gap Radar built up to
27 snippet lists that were usually closed. Cerebros added
`JevKit.lazyDetail` (a `MutationObserver` that fills a placeholder when its
detail row shows).
- **Fix:** build a detail when its row first opens: the toggle click,
  `foldAll`, and a restored `data-fold-key` state. Keep the current eager
  behavior behind `detailEager: true` if needed.
- **Check:** a table with 100 rows and a counting `detail` calls it 0 times
  on render, once after one toggle click, and 0 more times after `setSort`.

### 5. No event after the table body renders
Crystal Ball marks the selected row and inserts a drill row under it after
every `setRows` and every header sort. The app listens to `wonk-data:sort`
and re-runs its decoration after its own `setRows`. "Show all" has no event.
- **Fix:** dispatch `wonk-data:render` on the host after every body render
  (`detail: { rows, sort }`), and add a `rowClass(row)` option for simple
  row state (selected, active).
- **Check:** one listener counts one event per `setRows`, per header sort,
  and per Show all; `rowClass` classes survive a sort.

### 6. No event when a fold opens or closes (`assets/wonk.js:1248`)
Gap Radar keeps open areas in the URL (`?area=`). wonk.js flips row
toggles from a `document` click listener, so an app listener on the host
runs first and has to invert `aria-expanded` to guess the new state.
`foldAll` changes rows with no event at all.
- **Fix:** dispatch a bubbling `wonk:fold` event (`detail: { el, key, open }`)
  from `setRow`, from keyed `<details>` toggles, and from `foldAll`.
- **Check:** a click, a `foldAll(root, true)`, and a restored key each fire
  one event per changed element, with the new state.

### 7. Whole-row click is hand-built in every app
Gap Radar, Outcome Explorer, Crystal Ball, and FDE each added a host click
listener that forwards a row click to the row toggle or the row action and
skips buttons, links, inputs, and detail rows.
- **Fix:** `rowClick: true` does that forwarding (never the only target:
  the toggle and `onRowAction` button stay).
- **Check:** a click on a plain cell fires the row action once; a click on a
  link inside the row does not.

### 8. The row action button has no accessible name option
With `onRowAction`, the first cell becomes a `.wonk-value-link` whose name is
the cell text ("Amplitude"). Outcome Explorer needed "Amplitude: filter the
deals" and added a `.wonk-sr` span inside `render`.
- **Fix:** `actionLabel(row)` sets the button's `aria-label` (and the detail
  toggle's "Details for …" label keeps working).
- **Check:** the button's accessible name equals `actionLabel(row)`.

### 9. `foldAll` has no depth (`assets/wonk.js:1248`)
Gap Radar's "Unfold all areas" must not open the deal cards inside each
area. `foldAll(tbody, true)` opens every nested `<details>`; the app calls
`foldAll` on each row instead.
- **Fix:** `wonk.foldAll(root, open, { nested: false })` changes only the
  outermost folds and row toggles in `root`.
- **Check:** with a nested fixture, `nested: false` opens the row and leaves
  the inner `<details>` closed.

### 10. Tabs change with no event (`assets/wonk.js:1140`)
0.2 wires `.wonk-tabs` keyboard support, but an app cannot learn which tab
is active except by listening to clicks (keyboard selection sends none).
FDE only escaped this because `wonkCharts.plot` re-renders on resize.
- **Fix:** dispatch `wonk:tabchange` on the tablist (`detail: { tab, panel }`)
  on click and on keyboard selection.
- **Check:** ArrowRight fires one event naming the next tab.

### 11. Compact money reads odd in the thousands (`assets/wonk.js:1338`)
`money(n, {compact: true})` allows one decimal, so `$971,100` prints
`$971.1K` and `$45,600` prints `$45.6K`. Cerebros readers are used to
`$971K` / `$1.2M` (JevDrill's rule: whole K, one decimal for M under 10M).
- **Fix:** add `digits: "auto"`: 0 decimals below 1M, 1 decimal from 1M to
  10M, 0 above; keep today's default unless AK picks "auto" as default.
- **Check:** auto gives `$971K`, `$1.2M`, `$12M`, `$800`.

## Styling (P3)

### 12. `.wonk-card.wonk-stat` loses the card (`assets/wonk.css:544`)
`button.wonk-stat` resets border, background, padding, and width at
(0,1,1), so `<button class="wonk-card wonk-stat">` has no card chrome.
Outcome Explorer and Crystal Ball rewrote their tile rules as `.wonk .x`.
- **Fix:** add `button.wonk-stat.wonk-card { padding; border; background;
  width: auto }` (card chrome back, the reset elsewhere), or move the reset
  into `:where()`.
- **Check:** the combined fixture computes the `.wonk-card` border and
  padding.

### 13. The fold card's `+` wraps onto its own line (`assets/wonk.css:446`)
In `.wonk-card--fold`, the `::after` mark flows after the facts. When the
headline and facts wrap (a 390px phone), the `+` sits alone on a middle
line. Gap Radar and FDE pinned it top right.
- **Fix:** `summary { position: relative; padding-right: calc(var(--ak-s6) + 1.5rem) }`
  and `summary::after { position: absolute; top: var(--ak-s4); right: var(--ak-s6); margin: 0 }`.
- **Check:** at 390px, the mark's top equals the headline's first line top.

### 14. Header hints have no visual mark (`assets/wonk-data.js:239`)
A column `hint` becomes `th[data-tip]` with no dotted underline, so readers
do not know a definition exists (AK's rule: define every non-obvious term,
marked as a term). Three Cerebros apps added the same CSS.
- **Fix:** `.wonk-table th[data-tip] .wonk-sort, .wonk-table th[data-tip]:not(:has(.wonk-sort))`
  get the `.wonk-term` underline.
- **Check:** a hinted header's button computes `text-decoration-style: dotted`.

### 15. `.wonk-kv` overflows on a phone (`assets/wonk.css:506`)
`max-content 1fr` puts long uppercase labels ("COULD MIXPANEL HAVE CHANGED
IT (AI)") beside their values; at 390px the values fall off screen.
Outcome Explorer stacks them under 640px.
- **Fix:** `@media (max-width: 640px) { .wonk-kv { grid-template-columns: minmax(0, 1fr) } }`
  with a small gap below each `dd`.
- **Check:** at 390px, every `dd` right edge is inside its container.

### 16. The drill dialog has no place for a formula line
FDE's metric drills show "12,345 minutes / 60 = 205.8 h" above the table
(show-your-work), so FDE kept its own `<dialog>` instead of
`wonkData.drill`. The drill has only `title` and `subtitle`.
- **Fix:** a `note` option (a Node or text) rendered under the count line.
- **Check:** the note renders as text and is part of the dialog's accessible
  description.

## Docs

### 17. CHANGELOG 0.2 misses three upgrade traps
Add to "Upgrading from 0.1":
- wonk.js shows every `[data-hint]` too, so an app with its own `data-hint`
  handler shows two tooltips; never use `data-tip` as a lookup key for app
  code (its value is shown);
- `button.wonk-stat` now resets card chrome (item 12 until fixed);
- wonk.js now owns `.wonk-tabs` arrow keys; remove app arrow handlers or
  they double-step.

### 18. Adapters: an app with its own theme switcher
`references/adapters.md` assumes `wonk.theme.init()`. Cerebros has a
platform `theme.js` that writes `data-theme="light"|"dark"`. Document:
such an app skips `wonk.theme.init()`; `"light"` already styles as paper;
no bridge.

### 19. Native `<option>` cannot hold a hint
Hard rule 8 says never `title=`. A period `<option title="2026-05-01 to
2026-10-31">` is the only way to show each option's range, so Cerebros
kept it. Document the exception, or the pattern of updating the field's
`.wonk-hint-btn` `data-tip` with the selected option's detail.

### 20. Per-item hints need guidance
Ten result cards with four hinted badges each became forty tab stops. Add
to `components.md § hints`: repeats outside a `tbody` take
`data-tip-focus="off"` and get defined once (a fold or a header).

### 21. Drift test example
README § install step 4 checks bytes only where the skill exists. Suggest
two CI-safe checks too, as Cerebros does in `tests/wonk-vendor.test.js`:
every asset header carries the pinned version, and every `url()` in a
vendored stylesheet and every `/wonk/` path an app links exists (0.2
renamed all font files).

## Considered and left out

- A shared `esc()` helper in WONK: WONK renders with `textContent`; apps
  that build HTML strings own their escaping.
- A client-side pagination mode for `wonkData.table`: `limit` + Show all
  replaced FDE's pages well enough.

## Outcome (2026-09-24, WONK 0.3.0)

- Shipped: items 1-4 and 6-21, each with a check in `demo/base-checks.js`
  or `demo/data-checks.js`.
- Item 4: `detail(row)` may return a function, built when the row first
  opens. A row with no detail still returns `null`, so the toggle shows only
  on rows that have one.
- Item 5: the `wonk-data:render` event shipped. `rowClass` was skipped: the
  event covers it, and a class set once at build time goes stale.
- Item 11: Intl's standard compact rounding became the default (AK's pick).
- Item 3: aria-hidden content is skipped, and the body observer adds the
  tab stop once `aria-hidden` comes off. Inert content is not skipped: the
  browser keeps it out of the tab order, and a skip would outlive the inert
  state (the closed drawer at 390px).
- Item 12: the chrome reset now reads `button.wonk-stat:not(.wonk-card)`, so
  the card and its `--accent` and `--flat` apply, and an app's bare `button`
  rule still cannot reach a tile.
- Item 15: the value column is also `minmax(0, 1fr)` at every width.
- Item 17: the stat trap is listed under 0.2.0 as "fixed in 0.3.0".
