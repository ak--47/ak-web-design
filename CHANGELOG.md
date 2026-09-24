# Changelog

This file is the upgrade guide for apps that vendor a copy of `assets/`.
`VERSION`, the first header line of every asset, `wonk.version`, and the
`--wonk-version` token always carry the same number; `npm test` fails when
they differ.

## 0.2.0 (2026-09-24)

Upgrading from 0.1 (no version stamp). Copy the whole `assets/` folder
again, then check these:

- **Paper token values changed.** Paper `--ak-ink-3`, `--ak-ok`, `--ak-warn`,
  some `--ak-err`, and some `--ak-a1` values are darker, so text passes
  4.5:1. Several now sit at exactly 4.50:1. An app that overrides these
  tokens must re-check contrast.
- **`data-theme="light"` is an alias of paper.** Same selectors, same values.
- **`setTheme` and `setPair` throw on unknown names.** A typo used to fail
  silently. `wonk.theme.init()` persists the theme as `wonk-theme`, and
  the no-flash snippet in README § install applies it before first paint.
- **Hints: `.wonk-tip` became `data-tip`.** Put `data-tip="…"` (alias
  `data-hint`) on any element. `wonk.js` shows it on hover, focus, and tap,
  and describes it to screen readers. Old `.wonk-tip` markup still works.
  Replace native `title=` help text with `data-tip`.
- **`wonk.init(scope)` is idempotent.** Call it again after each render;
  it wires only elements it has not seen.
- **Check suites return `{passed, failed, results}`.**
  `wonkControlsChecks.run()` used to return a bare array.
- **New in the base:** `.wonk-term` + `wonk.glossary()`, `wonk.tip()`,
  the disclosure family (`.wonk-fold`, `.wonk-card--fold`,
  `.wonk-row-toggle`, `.wonk-more`, `wonk.foldAll()`), `wonk.fmt`,
  `.delta--good`/`--bad`/`--neutral`, `button.wonk-stat`,
  `.wonk-value-link`, the `.wonk-shell` mobile drawer,
  `[data-wonk-theme-toggle]`, `.wonk-main`/`.wonk-section`/`.wonk-row`/
  `.wonk-grid`/`.wonk-sr`, and `wonk.version`.
- **New packs:** data (`wonk-data.js`: `wonkData.table`, `wonkData.drill`),
  charts (`wonk-charts.js` with vendored d3 7.9.0 and Plot 0.6.17), radio
  (`wonk-radio.css`, `wonk-radio.js`), and fonts (`wonk-fonts.css` with
  `fonts/`, so apps stop loading Google Fonts).
- **New starter:** `templates/app.html`.
