# Plan 008: Charts work offline and under a strict CSP — vendored d3 + Plot and a `wonkCharts` helper

> **Executor instructions**: Follow this plan step by step. Write each new
> check first, watch it fail, then implement (red → green). Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `grep -n "cdn.jsdelivr.net" demo/index.html references/charts.md README.md`
> → matches in all three (the CDN links this plan replaces). `ls assets/vendor/`
> → only `prism`.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW (additive; the gallery switches from CDN to local files)
- **Depends on**: plan 005 (optional table fallback uses `wonkData.table`)
- **Category**: direction (DECIDE 2, taken: vendor, like Prism)
- **Planned at**: `ea62dcd` + plans 001-005, 2026-09-24

## Why this matters

WONK's chart rules (`references/charts.md`) are built on Observable Plot,
but Plot and d3 load from jsDelivr (`references/charts.md:9-12`,
`demo/index.html:52-53`). Apps with a CSP that only allows their own
scripts (cerebros: `scriptSrc: ["'self'", …]`, no jsDelivr) cannot load
them, so the one-shot cerebros apps hand-drew bars, a stacked bar, and a
heatmap in HTML. The theming helper `wonkChart` exists only as a doc
snippet (`references/charts.md:62-76`) and a demo copy
(`demo/catalog.js` `SECTION:charts`), with no re-render on theme change
and no accessible table view, although rule 8 demands one. After this plan,
Plot is local like Prism, and one helper themes, re-renders, and offers a table.

## Current state

- `assets/vendor/prism/` holds vendored Prism files plus `LICENSE` — the model for vendoring (see README "code highlighting and json editor").
- Latest versions (checked with `npm view`): `d3` 7.9.0, `@observablehq/plot` 0.6.17 (`latest`).
- `demo/index.html:52-53` loads `https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js`
  and `https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/dist/plot.umd.min.js`
  (plain `<script>`, not deferred, before the deferred WONK scripts).
- `demo/catalog.js` between `// SECTION:charts START` and `END` (~lines 210-257)
  draws the two gallery charts with a local `wonkChart` copy.
- `assets/wonk.css:527-540` restyles Plot's tip (`g[aria-label="tip"]`); keep it working.
- `README.md` "open a working example" paragraph says the base gallery's
  chart section loads d3 and Plot from jsDelivr.
- Plot's figure includes an inline `<style>` element; apps whose CSP lacks
  `style-src 'unsafe-inline'` need a nonce. Document this; do not work around it.

## Design

### Vendored files
- `assets/vendor/d3/d3.min.js` (7.9.0) + `assets/vendor/d3/LICENSE` (ISC, from the package).
- `assets/vendor/plot/plot.umd.min.js` (0.6.17) + `assets/vendor/plot/LICENSE` (ISC).
- Get them with `npm pack d3@7.9.0 @observablehq/plot@0.6.17` in `/tmp`,
  extract, copy the dist files and LICENSE. Record versions in
  `references/charts.md`. Never edit vendored files.

### `assets/wonk-charts.js` → `window.wonkCharts` (frozen)

Needs the `Plot` global (and `d3` before it), `wonk-tokens.css`, `wonk.css`.
If `Plot` is missing when `plot()` is called, throw an `Error` naming the
two script tags (do not fail quietly).

```js
const chart = wonkCharts.plot(el, (t) => ({
  height: 260,
  y: { grid: true, label: null },
  color: { domain: ["ingest", "export"], range: t.series },
  marks: [Plot.lineY(data, { x: "t", y: "v", stroke: "svc", strokeWidth: 2, tip: true })],
}), {
  label: "Events by service, last 48 hours",   // required: aria-label of the figure
  table: { columns: [...], rows: data },        // optional: adds a "Show table" toggle
  onClick: (datum) => wonkData.drill({...}),    // optional: click the pointed datum
});
chart.render(); chart.destroy();
```

- `t` (tokens, read at each render): `series` (`--ak-chart-1..6`), `ink`
  (`--ak-ink-2`), `muted` (`--ak-ink-3`), `grid` (`--ak-hairline`),
  `ground`, `font` (`--ak-font-mono`), `width` (the element's
  `clientWidth`). The helper merges `style: {background: "transparent", color: muted, fontFamily: font, fontSize: "11px"}`
  and `width` unless the build function sets them.
- The figure gets `role="img"` and `aria-label` = `label` (throw if `label` is missing).
- Re-render when `<html>`'s `data-theme` or `data-pair` changes (one
  shared `MutationObserver` for all charts) and when the element's width
  changes (`ResizeObserver`, re-render at most once per animation frame).
- `table`: render a `button.wonk-btn.wonk-btn--quiet` "Show table" /
  "Hide table" (`aria-expanded`, `aria-controls`) under the chart, and a
  container rendered with `wonkData.table` when `wonkData` exists, else a
  plain `table.wonk-table` built with `textContent`.
- `onClick`: listen for `click` on the figure; call `onClick(figure.value)`
  when `figure.value` is not null (Plot sets `value` when a mark with
  `tip`/pointer is active). Also make the figure focusable is NOT required
  (Plot pointer marks are mouse-only); the table view is the keyboard path —
  document that.
- Idempotent per element: calling `plot(el, …)` again replaces the build
  and re-renders; `destroy()` disconnects observers, removes listeners, empties `el`.

## Scope

**In scope**: `assets/vendor/d3/*`, `assets/vendor/plot/*` (create),
`assets/wonk-charts.js` (create), `demo/charts-checks.js` (create,
`window.wonkChartsChecks`), `scripts/check.mjs` (one `SUITES` line:
`{ name: "charts", page: "/demo/index.html", global: "wonkChartsChecks" }`),
`demo/index.html` (swap the two CDN tags for vendored files, add
`wonk-charts.js` and `charts-checks.js`; in `SECTION:charts` add a table
toggle and an `onClick` → drill example), `demo/catalog.js` (only the
`SECTION:charts` block: use `wonkCharts.plot`, delete the local helper),
`references/charts.md`, `README.md` (install/packs table: a charts pack;
the jsDelivr sentence), `SKILL.md` (only if its charts line mentions a CDN).

**Out of scope**: chart colors/tokens, the Plot tip CSS, uPlot, CSS-only
chart primitives (rejected: vendoring Plot removes the reason cerebros
drew them), radio files, cerebros.

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

### Step 1: Vendor
Fetch, copy, add LICENSE files.

**Verify**: `head -c 300 assets/vendor/plot/plot.umd.min.js` shows the
0.6.17 banner (or `grep -o "0\.6\.17" assets/vendor/plot/plot.umd.min.js | head -1`);
`grep -o "7\.9\.0" assets/vendor/d3/d3.min.js | head -1` → `7.9.0`.

### Step 2: Checks first (`demo/charts-checks.js`)
1. `wonkCharts.plot(el, build, {label})` → `el` contains a figure/svg with `role="img"` and the aria-label.
2. missing `label` → throws.
3. build receives `t.series` of length 6, all non-empty strings equal to the computed `--ak-chart-N` values.
4. switching `data-pair` re-renders within 2 frames (the series passed to build changes; restore the pair after).
5. `table` option → "Show table" button with `aria-expanded="false"`; click → a table with one row per datum.
6. calling `plot` twice on one element leaves one figure; `destroy()` empties it and a later pair switch does not call build again.
7. `onClick` is called with `figure.value` when set (set `figure.value` manually on the rendered figure, then dispatch `click`).

Add the `SUITES` line + script tags. `npm test -- charts` → fail.

### Step 3: Implement `assets/wonk-charts.js`; switch the gallery to vendored files and the helper.

**Verify**: `npm test` → all suites pass; `grep -rn "cdn.jsdelivr" demo/ assets/*.js` → nothing.

### Step 4: Docs
`references/charts.md`: replace the CDN block with the vendored tags
(d3 before Plot, both before `wonk-charts.js`), replace the `wonkChart`
snippet with `wonkCharts.plot`, note the bundled-app import path, the
CSP note (script from self; Plot's inline `<style>` needs
`style-src 'unsafe-inline'` or a nonce), and the table view as the
keyboard/screen-reader path. `README.md`: add the charts pack row
(`wonk-charts.js` + `assets/vendor/d3`, `assets/vendor/plot`), fix the
jsDelivr sentence (fonts still load from Google in galleries).

**Verify**: `grep -n "jsdelivr" README.md references/charts.md` → nothing.

### Step 5: Look at it
Screenshot `demo/index.html#charts` dark and paper, 1280 and 390, with the
table open once → `/tmp/wonk-charts-*.png`. Look at them.

**Verify**: charts re-themed in paper (not dark colors on bone), no overflow at 390.

## Done criteria

- [ ] `npm test` exits 0 including `charts` (7 checks)
- [ ] no jsDelivr references left in `demo/`, `assets/*.js`, `README.md`, `references/charts.md`
- [ ] vendored files byte-identical to the npm tarballs (`cmp`)
- [ ] `git status --short` → only in-scope files (plus others' untracked files)

## STOP conditions

- The Plot UMD build no longer defines a global `Plot` or needs a d3 version other than 7.x.
- `figure.value` is not set by Plot 0.6.17 for `tip: true` marks (then report; do not invent a pointer system).

## Maintenance notes

- Upgrading Plot: re-vendor both files together, re-run `npm test`, re-check the tip CSS selector.
- Plan 006's template shows one chart through `wonkCharts.plot`.
