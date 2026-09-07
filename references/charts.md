# WONK charts

Charts are first-class in WONK. Default library: **Observable Plot**
(`@observablehq/plot`). For streams above ~100k points, use **uPlot** with the
same tokens. Never Recharts, never Chart.js defaults, never a stock theme.

Load Plot (UMD, defines global `Plot`; it needs the `d3` global first):

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/dist/plot.umd.min.js"></script>
```

In a bundled app (Vite etc.), `import * as Plot from "@observablehq/plot"`
instead — no d3 global needed.

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
   Offer a table view for anything a screen reader must read.
9. **Render and look.** The validator checks color, not layout. Screenshot the
   chart; check label collisions and overflow before calling it done.

## Theming Plot from tokens

Plot renders SVG, so most theming is CSS plus a few options. Use this helper:

```js
function wonkChart(el, buildOptions) {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const series = [1, 2, 3, 4, 5, 6].map((i) => v(`--ak-chart-${i}`));
  const plot = Plot.plot({
    style: {
      background: "transparent",
      color: v("--ak-ink-3"),
      fontFamily: v("--ak-font-mono"),
      fontSize: "11px",
    },
    ...buildOptions({ series, ink: v("--ak-ink-2"), grid: v("--ak-hairline") }),
  });
  el.replaceChildren(plot);
}
```

Re-render on pair/theme change (listen for the attribute change or call again).

Example, multi-series line with tooltip:

```js
wonkChart(document.querySelector("#chart"), ({ series, grid }) => ({
  height: 260,
  y: { grid: true, label: null },
  color: { domain: ["ingest", "export", "identity"], range: series },
  marks: [
    Plot.ruleY([0], { stroke: grid }),
    Plot.lineY(data, { x: "t", y: "v", stroke: "svc", strokeWidth: 2, tip: true }),
  ],
}));
```

## Changing chart colors

Do not eyeball new values. Re-run the validator from the dataviz skill:

```bash
node <dataviz-skill>/scripts/validate_palette.js "<hex,...>" --mode dark --surface "#0f1214"
node <dataviz-skill>/scripts/validate_palette.js "<hex,...>" --mode light --surface "#ece4d4"
```

All six slots must pass all five checks on both grounds before the tokens file
changes. The current values in `assets/wonk-tokens.css` all pass as of
2026-09-07.
