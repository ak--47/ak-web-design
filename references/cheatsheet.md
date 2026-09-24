# WONK cheatsheet

One row per component. Find the need, copy the class or attribute, then read
only the linked section for its markup. Every call below is idempotent per
element; `wonk.js` auto-wires `data-wonk-*` on load, `wonk.init(scope)` wires
injected DOM. "auto" means no call is needed.

| need | class / attribute | JS call | reference |
|---|---|---|---|
| app shell with sidebar | `.wonk-shell`, `.wonk-side`, `.wonk-navlink`, `.wonk-topbar`, `.wonk-main` | auto | [components.md § layout](components.md#layout--dividers) |
| mobile menu drawer | `.wonk-drawer-btn` + `data-wonk-drawer` | auto (`wonk.drawer(btn)`) | [components.md § layout](components.md#layout--dividers) |
| page sections and rows | `.wonk-section`, `.wonk-grid`, `.wonk-row`, `.wonk-stack` | — | [components.md § layout](components.md#layout--dividers) |
| screen-reader-only text | `.wonk-sr` | — | [components.md § layout](components.md#layout--dividers) |
| section divider | `.wonk-divider`, `.wonk-rule` | — | [components.md § layout](components.md#layout--dividers) |
| dark / paper toggle | `data-wonk-theme-toggle` | `wonk.theme.init()`, `wonk.setTheme("paper")` | [components.md § theme](components.md#theme) |
| poster pair | `data-pair` on `<html>` | `wonk.setPair(name)` | [pairs.md](pairs.md) |
| page title, label, number | `.wonk-title`, `.wonk-label`, `.wonk-num` | — | [components.md § typography](components.md#typography) |
| formatted value | — | `wonk.fmt.num` / `.compact` / `.money` / `.pct` / `.duration` / `.date` / `.delta` | [components.md § wonk.fmt](components.md#formatting-wonkfmt) |
| button | `.wonk-btn`, `.wonk-btn--primary`, `.wonk-btn--danger`, `.wonk-btn--quiet` | — | [components.md § buttons](components.md#buttons) |
| form field | `.wonk-field`, `.wonk-input`, `.wonk-select`, `.wonk-textarea`, `.wonk-check`, `.wonk-toggle`, `.wonk-range` | — | [components.md § forms](components.md#forms) |
| tabs | `.wonk-tabs` | auto (`wonk.tabs(root)`) | [components.md § navigation](components.md#navigation) |
| dropdown menu | `details.wonk-menu` | auto (`wonk.menu(details)`) | [components.md § navigation](components.md#navigation) |
| breadcrumbs, pages, avatar | `.wonk-crumbs`, `.wonk-pages`, `.wonk-avatar` | — | [components.md § navigation](components.md#navigation) |
| card | `.wonk-card`, `.wonk-card--accent` | — | [components.md § data display](components.md#data-display) |
| headline stat that opens its records | `button.wonk-stat` + `data-wonk-drill` | `wonkData.drills(map)` | [data-tools.md § drill-down](data-tools.md#drill-down) |
| inline value that opens records | `.wonk-value-link` | `wonkData.drill(opts)` | [components.md § drillable values](components.md#drillable-values) |
| change vs last period | `.delta--good`, `.delta--bad`, `.delta--neutral` | `wonk.fmt.delta` | [components.md § deltas](components.md#deltas) |
| records table (sort, totals, select, CSV) | `.wonk-table` | `wonkData.table(el, opts)` | [data-tools.md § table module](data-tools.md#table-module) |
| badge, key-value list | `.wonk-badge`, `.wonk-kv` | — | [components.md § data display](components.md#data-display) |
| help text on hover, focus, tap | `data-tip`, `.wonk-hint-btn` | `wonk.tip(root, selector, render)` for rich tips | [components.md § hints](components.md#hints-and-terms) |
| defined term | `.wonk-term`, `data-term` | `wonk.glossary(map)` | [components.md § hints](components.md#hints-and-terms) |
| alert, modal, accordion | `.wonk-alert`, `dialog.wonk-modal`, `.wonk-acc` | `dialog.showModal()` | [components.md § feedback](components.md#feedback--overlays) |
| toast | — | `wonk.toast(msg, "ok")` | [components.md § feedback](components.md#feedback--overlays) |
| detail behind a fold | `.wonk-fold`, `.wonk-card--fold` | — | [hierarchy.md](hierarchy.md), [components.md § disclosure](components.md#disclosure) |
| expandable row, long list | `.wonk-row-toggle`, `.wonk-more` | — | [components.md § disclosure](components.md#disclosure) |
| open / close all folds | `.wonk-fold-all`, `data-fold-key` | `wonk.foldAll(root, open)` | [components.md § disclosure](components.md#disclosure) |
| live or loading | `.wonk-dot--live`, `data-wonk-live`, `.wonk-spectrum`, `.wonk-skeleton` | auto (`wonk.live(el)`) | [components.md § live](components.md#live--loading) |
| empty state | `.wonk-empty` | — | [components.md § live](components.md#live--loading) |
| empty, stale, failed result | `.wonk-state` + `data-state` | — | [data-tools.md § state copy](data-tools.md#state-copy-must-identify-the-cause) |
| chart | a container element | `wonkCharts.plot(el, build, opts)` | [charts.md § wonkCharts.plot](charts.md#theming-plot-from-tokens-wonkchartsplot) |
| sparkline | — | `wonk.spark(el, values)` | [charts.md § sparklines](charts.md#sparklines) |
| code block | `.wonk-pre` > `code[data-language]` | auto (`wonkCode.init(scope)`) | [code.md § markup](code.md#markup-contract) |
| JSON editor | `.wonk-json-editor` | `wonkCode.jsonEditor(el)` | [code.md § markup](code.md#markup-contract) |
| knob | `.wonk-knob` | `wonk.knob(el)` | [instruments.md](instruments.md) |
| fader, range window, segmented, stepper | `.wonk-fader`, `.wonk-window`, `.wonk-segmented`, `.wonk-stepper` | `wonkControls.init(scope)` / `.destroy(scope)` | [instruments.md](instruments.md) |
| one-shot state-change effect | — | `wonkMotion.play(el, name)` / `.cancel(el)` | [motion.md](motion.md) |
| radio player or dock | `.wonk-radio` + `data-wonk-radio`, `.wonk-radio--dock` | auto (`wonkRadio.mount(el, opts)`) | [radio.md](radio.md) |
| hidden easter egg | `data-wonk-secret`, `data-wonk-glyph` | auto | [easter-eggs.md](easter-eggs.md) |
| version check | — | `wonk.version` | [README § install](../README.md#install) |
