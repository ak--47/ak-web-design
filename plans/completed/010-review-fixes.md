# Plan 010: Fix the findings of the full-branch code review

> **Executor instructions**: Fix each finding below. For each behavior bug,
> write a failing check first (in the suite named), then fix. Run `npm test`
> after each fix. Touch only the files named per finding. Do not commit. Do
> not edit anything under `plans/`. If a fix needs a change outside the named
> files, or a finding turns out to be wrong, STOP on that item, report it, and
> continue with the rest.

## Status

- **Depends on**: plans 001-009 (all landed on `wonk-oneshot`, head `3ea95af`)
- **Category**: bug
- **Planned at**: `3ea95af`, 2026-09-24

## Context

WONK is a vanilla CSS/JS design system at `/Users/ak/.agents/skills/ak-web-design`.
`npm test` (scripts/check.mjs) runs every gallery check suite in headless
Chromium; it passes today (177 checks). A code review of the branch found the
items below. Keep the repo's conventions: 2-space indent, double quotes,
`"use strict"` IIFEs, short `// ----` comments, tokens only (no hex colors
outside `assets/wonk-tokens.css`), text rendered with `textContent`, errors
thrown, never swallowed, and no default values that hide a failure.

## Findings to fix

### F1. Chart tip stays pinned after a click-through (`assets/wonk-charts.js` ~line 259)
Plot pins its tip on `pointerdown`. `onFigureClick` then calls `onClick`
(for example opening a drill). After the drill closes, the tip is still
pinned: the next click only unpins it (no drill), and while pinned, a click
elsewhere on the figure (legend) fires `onClick` with the stale datum.
Fix: after `onClick` runs, clear the pinned state by re-rendering the chart
on the next frame (the controller's `render()`), and only call `onClick` when
the click target is inside the plot's SVG marks area, not the legend.
Check (`demo/charts-checks.js`): after a click that calls `onClick`, the
figure is re-rendered (a new figure element) and `figure.value` is null;
a click on a legend swatch does not call `onClick`.

### F2. `plot()` leaks state when the table option throws (`assets/wonk-charts.js` ~line 283)
`plot()` registers the chart (map, ResizeObserver, theme observer) and mounts
the figure before building the table; a `wonkData.table` error then escapes
with no controller to destroy. Fix: do every step that can throw (option
validation, table build into a detached container) before any side effect,
or clean up fully (disconnect observers, delete the map entry, restore `el`)
before rethrowing.
Check: `plot(el, build, {label, table: {columns: [{key: "v", type: "bogus"}], rows}})`
throws, `el` is left empty, and a later pair switch does not call `build`.

### F3. Escape on a hint also closes the dialog (`assets/wonk.js` ~line 985)
When a hint box is visible, the first Escape must only hide the hint
(WCAG 1.4.13 pattern); a second Escape closes the dialog or drawer. Fix:
when the hint is visible, the Escape handler calls `preventDefault()` and
`stopPropagation()` (listen in the capture phase so it runs before the
dialog's close request). When no hint is visible, do nothing.
Verify with a real key press (Playwright `page.keyboard.press("Escape")` on
the drill in `demo/index.html#drill` or `templates/app.html`): first press
hides the hint and the dialog stays open; second press closes the dialog.
Add a check in `demo/base-checks.js` that dispatches a cancelable Escape
`keydown` while a hint is visible inside an open modal fixture and asserts
`defaultPrevented === true`; with no hint visible, `defaultPrevented === false`.

### F4. `h1.wonk-title` loses its tracking (`assets/wonk.css` line ~29)
`.wonk h1` (0,1,1) beats `.wonk-title` (0,1,0). Raise the `.wonk-title` rule
to `.wonk .wonk-title` (keep its declarations) so the title treatment wins on
any element. Inline `font-size` in demos still overrides size.
Check (`demo/base-checks.js`): an `h1.wonk-title` fixture computes the same
`letter-spacing` as a `div.wonk-title`.

### F5. `drill()` hides a missing `rows` (`assets/wonk-data.js` ~line 604)
`drill()` turns a missing or non-array `opts.rows` into `[]`. Throw a
`TypeError` naming `rows` instead (same as `table()`).
Check (`demo/data-checks.js`): `wonkData.drill({title: "x", columns, row: []})` throws and opens no dialog.

### F6. `table()` destroys the old table before validating (`assets/wonk-data.js` ~line 546)
Validate `columns`, `sort` (key exists), and `rows` before emptying the host,
destroying the previous table, or attaching listeners. On invalid options,
throw and leave the existing table working.
Check: an existing table, then `wonkData.table(host, {..., sort: {key: "nope"}})`
throws, and `host.wonkDataTable` still sorts on header click.

### F7. Missing gallery page skips its suite silently (`scripts/check.mjs` ~line 257)
A suite whose page file is missing prints `SKIP` and still exits 0. Make it a
failure (`FAIL <suite> › page not found: <path>`), counted in the failed total.
Verify: temporarily point one SUITES entry at a missing page → exit 1; revert.

### F8. Template smoke selector too loose (`scripts/check.mjs` ~line 37)
Remove `"figure, svg"` from the template suite's selectors; keep
`"#trend-chart > [role='img']"`.

### F9. README validation table incomplete (`README.md` ~line 442)
Add rows for `radio` (`demo/radio.html`, `wonkRadioChecks`) and `template`
(`templates/app.html`, smoke: page loads with no errors and key selectors exist).

### F10. Install snippets disagree with the README recipe (`references/radio.md` ~line 11, `references/charts.md`)
Use the README convention (`/wonk/` paths, `wonk-fonts.css` first) in both
snippets, with one line: "paths assume WONK's `assets/` is served at `/wonk/`
(see README § install)".

### F11. The radio dock is too tall on phones (`assets/wonk-radio.css`)
At a 390px viewport the dock is ~153px tall (18% of the screen). In dock mode
under 520px: hide the scope canvas, keep the title + meta and the transport on
one row, and the seek row below it, compact (target ≤ 110px total). The
inline (non-dock) player is unchanged. Keep the `--wonk-radio-dock-h`
mechanism. Verify: measure the dock height at 390px with Playwright before and
after; screenshot `/tmp/wonk-radio-dock-390-after.png`; `npm test -- radio` passes.

## Done criteria

- [ ] `npm test` exits 0; new checks for F1-F6 exist and pass
- [ ] F3 verified with real key presses (report what you observed)
- [ ] F7 verified with a temporary missing page (then reverted)
- [ ] `git status --short` shows only the named files
