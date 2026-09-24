# WONK charts

Charts are first-class in WONK. Default library: **Observable Plot**
(`@observablehq/plot`). For streams above ~100k points, use **uPlot** with the
same tokens. Never Recharts, never Chart.js defaults, never a stock theme.

Plot and d3 are vendored, pinned, and committed, like Prism, so charts work
offline and under a CSP that only allows the app's own scripts:
`assets/vendor/d3/d3.min.js` (`d3` 7.9.0) and
`assets/vendor/plot/plot.umd.min.js` (`@observablehq/plot` 0.6.17), both
ISC, each with its `LICENSE` beside it. Load d3 first (Plot's UMD build
reads the `d3` global and defines the `Plot` global), both before
`wonk-charts.js`:

```html
<link rel="stylesheet" href="/wonk/wonk-fonts.css">
<link rel="stylesheet" href="/wonk/wonk-tokens.css">
<link rel="stylesheet" href="/wonk/wonk.css">
<script defer src="/wonk/vendor/d3/d3.min.js"></script>
<script defer src="/wonk/vendor/plot/plot.umd.min.js"></script>
<script defer src="/wonk/wonk-charts.js"></script>
```

Paths assume WONK's `assets/` is served at `/wonk/` (see [README § install](../README.md#install)).

In a bundled app (Vite etc.), `import * as Plot from "@observablehq/plot"`
instead (no d3 global needed) and set `window.Plot = Plot` before the first
`wonkCharts.plot()` call: `wonk-charts.js` reads the `Plot` global when it
draws.

Upgrading: re-vendor both files together from
`npm pack d3@<version> @observablehq/plot@<version>` (copy `dist/*.min.js`
and `LICENSE`), never edit a vendored file, update the versions above, run
`npm test`, and re-check the tip selector in rule 8.

### CSP

The vendored files load from the app's origin, so `script-src 'self'` is
enough. Plot also inserts small `<style>` elements: one in every chart svg,
one in a swatch legend. A CSP without `style-src 'unsafe-inline'` or their
hashes blocks them and logs a violation. The marks still draw, but the svg
loses `display: block` and `max-width: 100%`, and the swatch legend loses
its flex layout. Allow one of:

- `style-src 'self' 'unsafe-inline'`
- the hash of each block. A hash is fixed per Plot version, class name, and
  legend layout; the browser's CSP error prints it. Plot 0.6.17, default
  class name: chart svg `'sha256-jSYQUrW7J0b3jPqhZP9C2Xh1PyJKHKXd4s0fpGGKrww='`,
  wrapping swatch legend `'sha256-rCZUQsEQJf1DmnfnMZmlj08XC7qbIZySA6bEtitbQ00='`.

A nonce would have to be on each `<style>` before the figure enters the
document. `wonkCharts.plot` inserts the figure itself and sets no nonce.

## The rules (from the dataviz method, instantiated for WONK)

1. **Pick the form first.** One number the reader needs -> a stat tile
   (`.wonk-stat`), not a chart. Magnitude -> bars. Change over time -> lines.
   Identity of parts -> never a pie with >4 slices.
2. **Series colors come from `--ak-chart-1` … `--ak-chart-6`, in fixed order,
   never cycled.** These 6-slot orders are machine-validated per pair and per
   theme (CVD separation, lightness band, chroma, contrast vs ground). A 7th
   series folds into "Other" or becomes small multiples. Color follows the
   entity: filtering out series 2 must not repaint series 3.
3. **One axis.** Never two y-scales on one chart. Two measures -> two charts or
   an indexed common base.
4. **Status colors (`--ak-ok/warn/err`) are reserved for state.** Never use
   them as "series 4". When status appears in a chart, pair it with an icon or
   label — never color alone.
5. **Sequential = one hue, light->dark, from the pair's chart-1 hue.
   Diverging = the pair's coolest slot vs its warmest slot with a neutral gray
   midpoint (`--ak-ink-3`).** Never a rainbow.
6. **Text wears ink tokens, never series colors.** Axis labels and values in
   `--ak-ink-3`/`--ak-ink-2`, mono font. A colored mark next to the label
   carries identity.
7. **Marks:** 2px lines; dots >= 8px; bars thin with a 2px ground gap between
   adjacent fills; grid recessive (use `--ak-hairline` at most).
8. **Legend always present for >= 2 series; direct-label up to 4 series.
   Ship a hover tooltip by default** (Plot's `tip: true` on the main mark).
   `wonk.css` already restyles Plot's tip to the WONK tooltip (inverted:
   ink box, ground text) via `g[aria-label="tip"]` — do not restyle it per
   chart, and keep that selector working when upgrading Plot.
   Offer a table view for anything a screen reader must read
   (`wonkCharts.plot`'s `table` option).
9. **Render and look.** The validator checks color, not layout. Screenshot the
   chart; check label collisions and overflow before calling it done.

## Sparklines

For a tiny trend inside a stat tile or table cell, skip Plot: call
`wonk.spark(el, values, {w, h})` from wonk.js. It draws a 2px polyline in
`--ak-chart-1` with a `--ak-chart-2` end dot — no axes, no labels. A spark is
a shape, not a chart; anything the reader must decode precisely gets a real
Plot chart below.

## Theming Plot from tokens: `wonkCharts.plot`

`wonk-charts.js` (`window.wonkCharts`, frozen) themes Plot from the tokens,
re-renders on pair, theme, and width changes, and adds a table view. It
needs the `Plot` global, `wonk-tokens.css`, and `wonk.css`. Live gallery:
`demo/index.html#charts`.

Example, multi-series line with tooltip, table view, and click-through:

```js
const chart = wonkCharts.plot(document.querySelector("#chart"), (t) => ({
  height: 260,
  y: { grid: true, label: null },
  color: { domain: ["ingest", "export", "identity"], range: t.series, legend: true },
  marks: [
    Plot.ruleY([0], { stroke: t.grid }),
    Plot.lineY(data, { x: "t", y: "v", stroke: "svc", strokeWidth: 2, tip: true }),
  ],
}), {
  label: "Events by service, last 48 hours",  // required: the figure's aria-label
  table: {                                     // optional: Show table toggle
    columns: [{ key: "t", label: "hour", type: "num" }, { key: "svc", label: "service" }, { key: "v", label: "events", type: "num" }],
    rows: data,
    onRowAction: (row) => openRecords(row),   // the keyboard path to the same records
  },
  onClick: (datum) => openRecords(datum),      // optional: the datum under the pointer
});
chart.render();   // re-render now, e.g. after the data changed in place
chart.destroy();  // before the node goes away
```

- `build(t)` returns `Plot.plot` options. It runs at every render, so read
  colors from `t`, never cache them. `t` holds `series` (`--ak-chart-1` …
  `--ak-chart-6`), `ink` (`--ak-ink-2`), `muted` (`--ak-ink-3`), `grid`
  (`--ak-hairline`), `ground` (`--ak-ground`), `font` (`--ak-font-mono`),
  and `width` (the element's `clientWidth`).
- the helper merges `style: { background: "transparent", color: t.muted,
  fontFamily: t.font, fontSize: "11px" }` (a `style` key from `build` wins;
  a string `style` replaces it) and `width: t.width` unless `build` sets
  `width`. A hidden element (width 0) keeps Plot's default width until it
  gets a size.
- `label` is required: `plot()` throws without it. The figure gets
  `role="img"` and `aria-label` = `label`.
- re-render: one shared `MutationObserver` watches `data-theme` and
  `data-pair` on `<html>`, and a `ResizeObserver` watches the element's
  width. Both re-render at most once per animation frame. Do not re-render
  by hand after `wonk.setPair` or `wonk.setTheme`.
- `table`: `wonkData.table` options (`columns`, `rows`, and `sort`,
  `limit`, `onRowAction`, …). It adds a `button.wonk-btn.wonk-btn--quiet`
  (Show table / Hide table, `aria-expanded`, `aria-controls`) under the
  chart and a hidden container. With `wonk-data.js` loaded the table is a
  `wonkData.table`, captioned (visually hidden) with the chart's `label`
  unless you set `caption`. Without it, a plain `table.wonk-table` of
  `row[key]` text: no sorting, formatting, or row actions.
- `onClick(datum)`: a click on the figure calls it with `figure.value`,
  the datum Plot points at for a mark with `tip: true` (or a pointer
  transform). A click with no pointed datum does nothing.
- keyboard and screen readers: Plot's pointer is mouse-only and the figure
  is not focusable. The table view is the keyboard and screen-reader path,
  so give every chart that must be read a `table`, and give its rows the
  same action (`onRowAction`) as `onClick`.
- `plot()` owns `el`: the first call empties it. Calling `plot(el, …)`
  again replaces the build and options and re-renders in place (the table
  toggle keeps its focus and open state). `destroy()` disconnects the
  observers, removes the listeners, and empties `el`: call it before a
  framework unmounts the node.
- without the `Plot` global, `plot()` throws an Error that names the two
  vendored script tags.

Browser checks: `npm test -- charts` (`demo/charts-checks.js`,
`window.wonkChartsChecks`).

## Changing chart colors

Do not eyeball new values. Re-run the validator from the dataviz skill:

```bash
node <dataviz-skill>/scripts/validate_palette.js "<hex,...>" --mode dark --surface "#0f1214"
node <dataviz-skill>/scripts/validate_palette.js "<hex,...>" --mode light --surface "#ece4d4"
```

All six slots must pass all five checks on both grounds before the tokens file
changes. The current values in `assets/wonk-tokens.css` all pass as of
2026-09-07.
