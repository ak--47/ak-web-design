# 015: The inline drill table is capped at 65ch

Source: Cerebros, Who Did What app (`/who-did-what`), PR mixpanel/cerebros#413,
2026-11-13. Cerebros vendors WONK 0.4.0 at `src/apps/shared/public/wonk/`.

Status: DONE in 0.5.0 (2026-11-13). AK also chose to drop the fold rail on
the drill body, so the table lines up with the host's left edge. It shipped
with plan 014 as 0.5.0, not as patch 0.4.1.

## Finding

`wonkData.inline()` builds its fold as `details.wonk-fold.wonk-inline-drill`
(`assets/wonk-data.js`, `inline()`). The table goes inside `div.body`.

`assets/wonk.css` gives every fold body a reading width:

```css
.wonk-fold > .body {
  max-width: 65ch;
  ...
}
```

`assets/wonk-data.css` styles the drill but does not lift that cap:

```css
.wonk-inline-drill > .body { min-width: 0; }
```

Result: the records table under a stat tile is about 590px wide in a
1200px rack. It scrolls sideways while half the rack stays empty. The
table already has its own scroll box (`.wonk-table-scroll`, `max-height:
28rem`), so the 65ch cap only hurts.

The 65ch cap is correct for prose folds ("How this works"). It is wrong for
any fold that holds a table.

## What Cerebros did

An app-local override in `src/apps/who-did-what/public/wdw.css`:

```css
/* WONK caps every fold body at 65ch for prose; an inline drill holds a table. */
.wonk-inline-drill > .body { max-width: none; }
```

Every other Cerebros app that uses `wonkData.inline()` still has the bug:
the 4 kev apps (Gap Radar, Outcome Explorer, Call Me Maybe, Crystal Ball),
FDE and Pipeline. They get the fix on their next WONK re-vendor.

## Fix

1. In `assets/wonk-data.css`, change the drill body rule to:

   ```css
   .wonk-inline-drill > .body { min-width: 0; max-width: none; }
   ```

   `wonk-data.css` loads after `wonk.css`, and both selectors have the same
   specificity, so the later rule wins. Do not change `.wonk-fold > .body`:
   prose folds keep 65ch.

2. Check the other fold-shaped containers that can hold a table or a chart,
   and lift the cap there too if they use `.wonk-fold > .body`:
   - a `lazyDetail` body inside a table row (`tr.wonk-row-detail`),
   - `.wonk-card--fold` bodies (they have their own body rule; confirm),
   - any demo page that puts a `wonkData.table` inside a `.wonk-fold`.

   If a plain `.wonk-fold` can legitimately hold a table, add a documented
   opt-out instead of more special cases, for example
   `.wonk-fold--wide > .body { max-width: none; }`, and use it in the drill.

3. Document it in `references/data-tools.md` § drill-down: "The inline drill
   body is full width. Prose folds stay at 65ch."

## Check

Add a case to `scripts/check.mjs` (the headless runner):

- Render `demo/workbench` (or a fixture) at 1280px wide.
- Open an inline drill.
- Assert the drill `.body` width is at least 90% of its host width, and
  that a `.wonk-fold > .body` with prose is still at most 65ch wide.

## Release

Patch release (0.4.1): CSS only, no API change. Note it in `CHANGELOG.md`.
After it ships, Cerebros re-vendors (bump `WONK_VERSION` in
`tests/wonk-vendor.test.js`) and deletes the app-local override in
`wdw.css`.
