# Changelog

This file is the upgrade guide for apps that vendor a copy of `assets/`.
`VERSION`, the first header line of every asset, `wonk.version`, and the
`--wonk-version` token always carry the same number; `npm test` fails when
they differ.

## 0.3.0 (2026-09-24)

Upgrading from 0.2: copy the whole `assets/` folder again, bump the pinned
version in the drift test, then check these:

- **Element defaults weigh less.** `.wonk h1`-`h4`, `.wonk p`, and
  `.wonk small` became `:where(.wonk) …` (specificity 0,0,1, like links in
  0.2). Any class on those elements now wins, so a class that used to lose
  applies: `p.wonk-help` shows the muted help color, `p.wonk-help--error`
  turns red, and `h2.wonk-sr` gets its -1px margin. An app element rule
  loaded after `wonk.css` wins too. Tailwind apps: read the new cascade
  section in `references/adapters.md`.
- **Compact numbers round the standard Intl way.** `wonk.fmt.compact(n)` and
  `wonk.fmt.money(n, { compact: true })` without `digits` print `$971K` (was
  `$971.1K`), `$46K` (was `$45.6K`), `$1.2M`, `$12M`. `digits: 1` gives the
  old output.
- **CSV date columns write what the table shows.** `wonkData.toCSV` and
  Download CSV write a `date` column as `YYYY-MM-DD`, or
  `YYYY-MM-DD HH:MM UTC` with `format: { time: true }`, not an ISO timestamp.
  A text column for dates is no longer needed. The formula guard now also
  catches `=`, `+`, `-`, or `@` after leading whitespace, and a leading LF.
- **Hints.** A mouse click that focuses a checkbox or button no longer opens
  a box that stays until blur; keyboard focus still shows one, and screen
  readers get the description either way. The box goes above or beside its
  target when below would cover another control. Escape is cancelled only
  when the box shows the focused element's hint: a hover hint closes and the
  same Escape reaches the app's dialog or editor. wonk.js no longer adds a
  `tabindex` inside `aria-hidden` content (it adds one once `aria-hidden`
  comes off), or to a `.wonk-term` with no hint of its own inside a
  control's `<label>`: the `data-tip-focus="off"` added for those cases can
  go (it still works).
- **`<button class="wonk-card wonk-stat">` keeps the card** (padding,
  border, fill, `--accent`, `--flat`). App rules that rebuilt the card can go.
- **Small fixes.** `.wonk-kv` stacks each term over its value under 640px,
  and its value column no longer overflows. The fold card's `+` stays top
  right on a wrapped summary. A table header with a hint gets the dotted
  term underline. `wonk.js` loads in a window with no `CSS` object (jsdom,
  vitest): a test stand-in for `CSS.supports` can go.
- **New:** `wonk:fold` (row toggles and keyed `<details>`),
  `wonk.foldAll(root, open, { nested: false })`, `wonk:tabchange`;
  `wonkData.table` `detail` may return a function (built when the row first
  opens), `rowClick`, `actionLabel`, and the `wonk-data:render` event;
  `wonkData.drill` `note`.
- **Docs:** the Tailwind `tok()` helper for opacity modifiers and where
  `wonk.css` goes in the cascade, apps with their own theme switcher,
  where a hint may go, the segmented control's `set()` for controlled
  frameworks, and drift checks that run in CI (README § install, step 4).

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
- **wonk.js shows every `data-hint` too.** An app with its own `data-hint`
  tooltip handler shows two boxes: remove the handler. Never use `data-tip`
  or `data-hint` as a lookup key for app code; wonk.js shows its value.
- **wonk.js owns the `.wonk-tabs` arrow keys.** Remove an app's arrow-key
  handler on tabs, or each key press moves two tabs.
- **`button.wonk-stat` resets card chrome.** In 0.2,
  `<button class="wonk-card wonk-stat">` has no card padding or border
  (fixed in 0.3.0).
- **`wonk.init(scope)` is idempotent.** Call it again after each render;
  it wires only elements it has not seen.
- **Link rules no longer reach components.** `.wonk a` became a
  zero-specificity rule, and the hover underline applies only to links
  without a `wonk-*` class. An `a.wonk-btn` now has its full border and
  the button's ink color (it used to lose its bottom border and turn
  `--ak-a1-text`). An app CSS rule on plain `a` now wins over WONK's.
- **`.wonk-select` draws its own caret**, inset from the right edge
  (`appearance: none`, extra right padding). Multiple and sized selects keep
  the native list box.
- **Check suites return `{passed, failed, results}`.**
  `wonkControlsChecks.run()` used to return a bare array.
- **New in the base:** `.wonk-term` + `wonk.glossary()`, `wonk.tip()`,
  the disclosure family (`.wonk-fold`, `.wonk-card--fold`,
  `.wonk-row-toggle`, `.wonk-more`, `wonk.foldAll()`), `wonk.fmt`,
  `.delta--good`/`--bad`/`--neutral`, `button.wonk-stat`,
  `.wonk-value-link`, the `.wonk-shell` mobile drawer,
  `[data-wonk-theme-toggle]`, `.wonk-divider--live` (the scrolling square
  wave, live/loading only), `.wonk-main`/`.wonk-section`/`.wonk-row`/
  `.wonk-grid`/`.wonk-sr`, and `wonk.version`.
- **New packs:** data (`wonk-data.js`: `wonkData.table`, `wonkData.drill`),
  charts (`wonk-charts.js` with vendored d3 7.9.0 and Plot 0.6.17), radio
  (`wonk-radio.css`, `wonk-radio.js`, with album art read from each mp3's ID3 tag), and fonts (`wonk-fonts.css` with
  `fonts/`, so apps stop loading Google Fonts).
- **New starter:** `templates/app.html`.
