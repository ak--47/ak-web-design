# Plan 002: Base behaviors are idempotent, accessible, and pass WONK's own contrast and focus rules

> **Executor instructions**: Follow this plan step by step. Write each new
> check first, watch it fail, then fix the code (red → green). Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `git diff --stat ea62dcd -- assets/ references/ SKILL.md`
> must list no `assets/wonk.js`, `assets/wonk.css`, `assets/wonk-tokens.css`,
> `assets/wonk-controls.*` changes (radio files are fine). If it does, compare
> the excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (visible paper-theme color shifts; everything else is behavior-preserving)
- **Depends on**: plan 001 (`npm test` runner, `demo/base-checks.js`)
- **Category**: bug
- **Planned at**: `ea62dcd` + plan 001, 2026-09-24

## Why this matters

WONK (`/Users/ak/.agents/skills/ak-web-design`) is AK's vanilla CSS/JS
design system. Agents one-shot apps with it. A real app (cerebros Gap Radar)
hit the segmented-glide bug below, and agents that follow the docs and call
`wonk.init(scope)` after each render pile up timers and listeners. Tabs are
invisible to screen readers, toasts are silent, and the paper theme breaks
the system's own hard rule "`-text` variants pass 4.5:1 ... focus rings
visible" (`SKILL.md:38`). This plan fixes the base layer so every later
component builds on sound behavior.

## Current state (verified excerpts)

`assets/wonk.js` (IIFE, `"use strict"`, exports `window.wonk` at the end):

- `wonk.js:9` — `const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;`
  read once. `live` (`:32-43`), `glyph` (`:48-72`, a `setInterval` never
  cleared, no `isConnected` check), `scatter` (`:77-101`), `reveal`
  (`:106-125`), `vu` (`:154-183`), `scopeWidget` (`:447-480`) all branch on it
  at creation only. `wonk-motion.js:25,210-213` shows the right pattern
  (live `mql` + `change` listener).
- `wonk.js:557-567` `init(scope)` re-runs `live`, `glyph`, `scatter`, `vu`,
  `knob`, `scopeWidget`, `tabs`, `secret`, `reveal` with no guard. Only
  `tabs` (`dataset.wonkWired`) and `knob` (`el.wonkKnob`) are idempotent. A
  second `init` starts a second `live` tick loop, a second glyph interval,
  a second `vu` loop, a second scope rAF loop, re-scatters text, and adds a
  second `secret` click listener (7 clicks then reveal after 4).
- `wonk.js:137-148` `spark(el, values)` — with 1 value `i/(len-1)` is NaN;
  with 0 values `last` is undefined and `last[0]` throws.
- `wonk.js:496-514` `toast` — host `div.wonk-toasts` appended to `body`,
  no `role`/`aria-live`, no dismiss. A `<dialog>` opened with
  `showModal()` sits in the top layer and makes everything outside it
  inert, so a toast fired while a modal is open is hidden and unannounced.
- `wonk.js:518-531` `tabs` — sets only `aria-selected`; no
  `role="tablist"/"tab"/"tabpanel"`, no `aria-controls`, no arrow keys, no
  roving tabindex. `document.querySelector(x.dataset.panel || "")` throws
  `SyntaxError` when a tab has no `data-panel`, which aborts the loop mid-way.
  Initial panel visibility is never synced to the selected tab.
- `wonk.css:266-300` `.wonk-menu` (a `<details>`) — choosing an item leaves
  it open; Escape does nothing; always opens `left: 0` (runs off-screen for
  right-edge menus).
- `wonk.css:689-695` `.wonk-js .wonk-reveal { opacity: 0 }` hides every
  `.wonk-reveal` once JS runs; only elements present at `init`/`reveal()`
  time get observed, so injected sections stay invisible.
- `assets/wonk-controls.js:299-345` `segmented(el)` — `place()` measures
  `label.offsetWidth/offsetLeft` once at wiring, then only on radio
  `change` and window `resize`. Wired while hidden (closed `<details>`,
  hidden tab panel, unopened dialog) the width is 0, while
  `wonk-controls.css:209-211` (`.has-glide input:checked + span { color: var(--ak-a1-ink) }`)
  removes the per-option fill → the checked label is dark text on a dark
  track, nearly invisible. Web-font swap also leaves the glide at the
  fallback font's width.
- Focus: `wonk.css:199` `.wonk-toggle input { opacity:0; width:0; height:0 }`
  and no `input:focus-visible + .track` rule → the toggle has no focus
  indicator. `wonk-controls.css:70-74` `.wonk-knob .val:focus-visible { outline: none }`
  (only a faint hover tint). `wonk-controls.css:220` `.wonk-stepper-row { overflow: hidden }`
  clips the 2px-offset focus outline of the input and edge buttons.
  `wonk.css:137-139` `.wonk-input:focus { outline: none; border-color: … }` —
  a 1px color change only.
- Contrast (WCAG ratio, computed): paper `--ak-warn: #a66a0e` = 3.54:1 on
  ground `#ece4d4` (all five pairs); paper `--ak-ok: #2e7d43` = 4.02:1
  (metathesis, glorpla, demogorgon); paper `--ak-err: #c22f2f` = 4.44:1
  (glorpla, demogorgon, flourish?—measure); paper metathesis primary button
  `#ffffff` on `--ak-a1: #148787` = 4.33:1 (flourish similar); paper
  `--ak-ink-3: rgba(27,31,34,0.55)` = 3.5:1 on ground (used for help text,
  placeholders, units). Paper surfaces: `--ak-surface: #f2ecdf`,
  `--ak-surface-2: #f7f3e9` (lighter, so harder). Tokens live in
  `assets/wonk-tokens.css`: paper base block `:73-88`, per-pair blocks
  `:110-257` (dark then paper for each pair).
- Knob CSS is split: base knob in `wonk.css:661-665`, but the value editor,
  unit, and disabled styles are in `wonk-controls.css:44-95`, while the knob
  JS is in base `wonk.js:200-449`. A base-only app gets an unstyled editor.
- Docs contradictions:
  - `references/components.md:178` shows `<script>wonk.toast("Deployed", "ok")</script>`
    while `README.md:42` and `references/adapters.md:19` load `wonk.js` with
    `defer`: an inline script runs before deferred scripts → ReferenceError.
  - `SKILL.md:31-33` and `README.md:122-126` say uppercase + tracking only
    on `.wonk-label`/`.wonk-title`, but `wonk.css` also uppercases
    `.wonk-btn` (`:98`), `.wonk-kv dt` (`:364`), `.wonk-badge` (`:405`),
    table `th` (`:424`), `.wonk-side .brand` (`:584`), and `:48`, `:56`, `:229`.
  - `references/components.md:5-6` and `README.md:189` recommend
    `wonk.init(scope)` for injected DOM; `README.md:289-290`,
    `references/adapters.md:134-135`, `references/instruments.md:250-253` warn against it.
  - `README.md:171` points at gallery anchor `#chrome`; `demo/index.html`
    has the `SECTION:chrome` markers (`:84`) but no element with `id="chrome"`.
  - `demo/index.html:151` and `:209` show a `⌘K` shortcut with no behavior
    (`references/data-tools.md:155-156` scopes command palettes out).

Conventions: 2-space indent, double quotes, short `// ----` section
comments, no dependencies, tokens only (no hex colors outside
`wonk-tokens.css`). Check files follow `demo/code-checks.js` (`{name, fn}`
array, hidden fixture per check, cleanup in `finally`). For reduced-motion
checks, copy the mocked-`matchMedia` iframe technique from
`demo/motion-checks.js:54-100`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| All checks | `npm test` | exit 0 |
| Base only | `npm test -- base` | exit 0 |
| Controls only | `npm test -- controls` | exit 0 |
| No stray colors | `grep -nE "#[0-9a-fA-F]{3,8}\b" assets/wonk.css assets/wonk-controls.css assets/wonk.js assets/wonk-controls.js` | only pre-existing matches (e.g. the console greeting color in `wonk.js`), no new ones |

## Scope

**In scope**: `assets/wonk.js`, `assets/wonk.css`, `assets/wonk-tokens.css`,
`assets/wonk-controls.js`, `assets/wonk-controls.css`, `demo/base-checks.js`,
`demo/controls-checks.js` (add checks only), `demo/index.html` (only: add
`id="chrome"` or fix the README anchor; remove the two `⌘K` hints),
`README.md`, `SKILL.md`, `references/components.md`,
`references/adapters.md`, `references/instruments.md`, `references/pairs.md`
(only if token values are listed there).

**Out of scope**: the `.wonk-tip` tooltip (plan 003 replaces it), `.wonk-acc`
/ disclosure (plan 004), tables, drill-down, `.wonk-stat` deltas (plan 005),
install paths / versioning / templates (plan 006), all radio files, the
motion and code packs, `demo/catalog.*`, `demo/workbench.*`. Do not change
any public API signature; only add.

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

Each step: add failing checks to `demo/base-checks.js` (or
`demo/controls-checks.js` for step 6), run `npm test -- base` and see them
fail, fix, see them pass.

### Step 1: Idempotent wiring + live reduced motion in `wonk.js`

- Replace the one-time `REDUCED` constant with a live media query
  (`const mql = matchMedia(...)`; `const reduced = () => mql.matches`).
- Guard every helper per element with a module-level `WeakMap` (or
  `WeakSet`) so `live`, `glyph`, `scatter`, `vu`, `scopeWidget`, `secret`
  called twice on one element do nothing the second time (`vu` returns the
  existing API).
- `glyph`: clear its interval/timeout when the element is disconnected
  (check `isConnected` in `swap`).
- When reduced motion turns on mid-session: stop `live` (reset inline
  `opacity`/`animation`), stop glyph cycling, stop `vu` auto-animation,
  draw one static scope frame and stop its loop. When it turns off again,
  resume the ones still connected. Keep a registry of running decorations
  to do this.
- `wonk.init(scope)` is now safe to call repeatedly on the same subtree.

Checks to add: `init twice → one live loop` (count opacity toggles over
~600ms with a stubbed `setTimeout`, or expose nothing new and assert that
a second `wonk.live(el)` call returns without scheduling — pick one
deterministic method and explain it in a comment); `secret reveals on the
7th click after double init`; `glyph interval stops after removal`;
`reduced motion flipped on stops live/vu loops` (mocked-matchMedia iframe).

**Verify**: `npm test -- base` → all pass.

### Step 2: Tabs

In `tabs(root)`: set `role="tablist"` on root, `role="tab"` on each
`.wonk-tab`, `role="tabpanel"` + `aria-labelledby` on each panel, ids
where missing, `aria-controls`, roving `tabindex` (0 on selected, -1 on
others), ArrowLeft/ArrowRight (wrap), Home, End move focus and select
(automatic activation). A tab without a resolvable `data-panel` is skipped
(no throw) with one `console.warn`. On wiring, sync: the tab with
`aria-selected="true"` (else the first) is selected and only its panel is
visible. Keep the `wonk-wired` guard.

Checks: roles/ids/aria-controls present; ArrowRight moves selection and
focus; a tab missing `data-panel` doesn't throw and others still work;
initial sync hides non-selected panels.

**Verify**: `npm test -- base` → all pass.

### Step 3: Toasts

- Host gets `role="status"` and `aria-live="polite"`; an `err` toast gets
  `role="alert"` on the toast element itself.
- Each toast gets a close button (`aria-label="Dismiss"`, `×`).
- Hover or focus inside a toast pauses its timer; leaving resumes.
- If a modal dialog is open (`document.querySelector("dialog[open]")` that
  matches `:modal`), append the host inside that dialog for this toast,
  so it is visible and announced; otherwise use `body`. Make sure the
  host's fixed positioning still pins to the viewport corner inside the
  dialog (the `wonk-pop` animation's transform ends as `none`).
- `wonk.toast` still returns the toast element.

Checks: host has `aria-live="polite"`; err toast has `role="alert"`;
dismiss removes it; toast fired while a fixture `dialog.showModal()` is
open is a descendant of that dialog.

**Verify**: `npm test -- base` → all pass.

### Step 4: `spark` edge cases, menu, reveal

- `spark`: filter non-finite values; 0 values → render nothing (empty
  element) and return; 1 value → single dot centered; no `NaN` anywhere.
- Menu: add a small `menu(details)` wired by `init` for `.wonk-menu`:
  clicking a `button`/`a` inside `.menu` closes it; Escape closes it and
  returns focus to the `summary`; on open, if the menu would overflow the
  viewport's right edge, add `.wonk-menu--end` (CSS: `right: 0; left: auto`).
  Also add `.wonk-menu--end` to CSS as an author-set option.
- Reveal: change the CSS to hide only armed elements
  (`.wonk-js .wonk-reveal.is-armed:not(.is-in)`) and have `reveal()` add
  `is-armed` right before observing. Un-armed (injected) elements stay visible.
  Add a single `MutationObserver` on `document.body` (childList, subtree)
  that calls `reveal(node)` for added element subtrees containing
  `.wonk-reveal`, throttled to once per animation frame.

Checks: spark with `[]` and `[5]` → no throw, no `NaN`; menu closes on
item click and Escape (focus back on summary); an injected `.wonk-reveal`
node is visible (computed opacity 1 or becomes `is-in`) within 500ms.

**Verify**: `npm test -- base` → all pass.

### Step 5: Contrast (tokens) + a contrast check

Add a `contrast` check group to `demo/base-checks.js`: for every pair
(`metathesis glorpla demogorgon ancient flourish`) × theme (dark, paper),
set the attributes on `<html>`, read computed tokens, alpha-composite
rgba tokens over the background, and compute the WCAG ratio for:

- text tokens `--ak-ink`, `--ak-ink-2`, `--ak-ink-3`, `--ak-a1-text`,
  `--ak-a2-text`, `--ak-ok`, `--ak-warn`, `--ak-err`, `--ak-info`
- on `--ak-ground`, `--ak-surface`, `--ak-surface-2`
- plus `--ak-a1-ink` on `--ak-a1` (primary button)

All must be ≥ 4.5. Restore the original attributes in `finally`. The
failure message lists every failing `pair/theme/token/bg ratio`.

Then fix `assets/wonk-tokens.css` with the **smallest** change that passes:
darken paper `--ak-ok`, `--ak-warn`, `--ak-err` (per pair where they
differ), paper `--ak-ink-3` (raise alpha), and the failing paper `--ak-a1`
fills (or switch that pair's `--ak-a1-ink`). Keep hue; change lightness.
Do not touch dark values unless the check fails there. Update any token
table in `references/pairs.md` that lists changed values.

**Verify**: `npm test -- base` → contrast check passes; report each changed
token old → new in NOTES.

### Step 6: Segmented glide measures correctly (controls pack)

In `segmented(el)`: observe the track with a `ResizeObserver` and call
`place()` on resize; call `place()` after `document.fonts.ready`; when the
measured label width is 0, remove `has-glide` from the track (per-option
fill shows) and add it back once a non-zero width is measured. Disconnect
the observer in `destroy()`.

Check (in `demo/controls-checks.js`): wire a segmented control inside a
`hidden` container → checked `span` has a non-transparent background
(fallback fill); unhide → after a frame, the glide has width > 0 and
`has-glide` is back.

**Verify**: `npm test -- controls` → all pass.

### Step 7: Focus indicators

- `.wonk-toggle input:focus-visible + .track { outline: 2px solid var(--ak-a1-text); outline-offset: 2px; }`
- `.wonk-knob .val:focus-visible` → real 2px outline (keep the tint).
- Stepper: stop clipping (use `outline-offset: -2px` on the stepper's
  input and buttons, or remove `overflow: hidden` and round the end buttons).
- `.wonk-input/.wonk-select/.wonk-textarea:focus-visible` → keep the
  border color and add a 2px ring (outline or box-shadow with `--ak-a1-text`).
- Move the knob's refinement CSS (`wonk-controls.css:44-95`) into
  `wonk.css` next to the base knob block, so a base-only page styles the
  exact-edit input and disabled state. Update `references/instruments.md:50`
  and `references/components.md` if they say where knob CSS lives.

Check: for each of toggle input, knob value button, stepper input, a
text input: focus it via `.focus({focusVisible: true})` (or keyboard Tab in
the fixture) and assert `getComputedStyle(...)` shows a non-`none` outline
or a non-`none` box-shadow on the element or its `.track`.

**Verify**: `npm test` → all suites pass.

### Step 8: Docs

- `references/components.md`: every inline JS example runs after the
  deferred scripts (wrap in `document.addEventListener("DOMContentLoaded", …)`).
  Document the JS API additions: tabs keyboard/ARIA, toast dismiss and
  dialog behavior, `wonk.init(scope)` is idempotent, `.wonk-menu--end`,
  `.wonk-reveal` markup, `wonk.live/glyph/tabs/scatter` in the API table.
- `README.md` + `SKILL.md`: restate the typography rule truthfully:
  uppercase + tracking belongs to labels and UI chrome (`.wonk-label`,
  buttons, badges, table headers, kv terms, brand) and page titles
  (`.wonk-title`); body text, headings, nav, and tabs stay mixed case;
  never uppercase prose. Keep `SKILL.md` short (it is read first).
- `README.md:287-294`, `references/adapters.md:134-135`,
  `references/instruments.md:250-253`: replace the "not idempotent / avoid
  repeated calls" warnings with "idempotent per element".
- Fix the `#chrome` anchor (add `id="chrome"` to the `<aside>` at
  `demo/index.html:85` or change the README cell); remove both `⌘K` hints.

**Verify**:
`grep -n "not idempotent" README.md references/*.md` → nothing;
`grep -c "SECTION:.* START" demo/index.html` equals `grep -c "SECTION:.* END" demo/index.html`;
`grep -n "&#8984;" demo/index.html` → nothing.

## Test plan

New checks (≈15) in `demo/base-checks.js` and 1 in
`demo/controls-checks.js`, listed per step. Every existing check still passes.

## Done criteria

- [ ] `npm test` exits 0, all suites
- [ ] contrast check passes for 5 pairs × 2 themes
- [ ] `git status --short` shows only in-scope files (plus untracked radio files from another executor)
- [ ] no new hex colors outside `assets/wonk-tokens.css`
- [ ] NOTES lists every token value changed (old → new)

## STOP conditions

- Passing contrast needs a hue change or a change of more than ~15% lightness on any accent (visual identity risk) — report the numbers instead.
- The toast-in-dialog approach cannot position correctly without changing `.wonk-modal`'s animation.
- Any existing check starts failing and the fix would change an existing public API.

## Maintenance notes

- Plan 003 replaces `.wonk-tip` with `wonk.hint`; it relies on the idempotent `init` from Step 1.
- Every new decorative loop must register with the reduced-motion registry from Step 1.
- The contrast check is the gate for any future pair or token change.
