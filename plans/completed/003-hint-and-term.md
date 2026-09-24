# Plan 003: `data-tip` hints work on hover, focus, touch, and screen readers, with term definitions and rich tips

> **Executor instructions**: Follow this plan step by step. Write each new
> check first, watch it fail, then implement (red → green). Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `grep -n "tooltip (CSS-only, data-tip)" assets/wonk.css`
> → one match. If it is gone, STOP (someone already changed the tooltip).
> Read the current `assets/wonk.js` in full before starting: plan 002 just
> changed it (idempotent wiring registry, live reduced-motion, a body
> `MutationObserver` for reveal, tabs, toasts, menu).

## Status

- **Priority**: P1 (the single most expensive one-shot failure)
- **Effort**: M
- **Risk**: LOW (additive; old `data-tip` markup keeps working)
- **Depends on**: plan 002
- **Category**: bug / direction
- **Planned at**: `ea62dcd` + plans 001, 002, 2026-09-24

## Why this matters

WONK's tooltip is a CSS `::after` shown on `:hover` only. Keyboard, touch,
and screen-reader users never get it, it cannot wrap, and scrolling tables
clip it. When AK one-shot three cerebros apps with WONK, the agent avoided
it and used native `title=` (14 times), which shows late or never. AK
reported "tooltip on radar doesn't show", and fixing it took six PRs
(#284-#289) that built a `data-hint` system by hand in
`/Users/ak/code/cerebros/src/apps/shared/public/jev-drill.js:283-385`. AK
also asked for tooltips on non-obvious terms ("what 'agreement' actually
means") and rich tips (a heatmap cell listing its deals and total). This
plan promotes that proven contract into WONK, fixes its remaining gaps, and
makes it the one way to do help text.

## Current state

- `assets/wonk.css:505-525` — `.wonk-tip::after { content: attr(data-tip); … white-space: nowrap; pointer-events: none; }`,
  shown only by `.wonk-tip:hover::after`. Look: inverted — `background: var(--ak-ink)`,
  `color: var(--ak-ground)`, mono `--ak-text-xs`, `letter-spacing: 0.05rem`,
  padding `0.3rem 0.55rem`, 4px radius. Keep this look.
- `assets/wonk.css:527-540` — Observable Plot chart tips are styled to
  match (inverted). Do not touch.
- `demo/index.html:180` — `<button class="wonk-btn wonk-tip" data-tip="oh... interesting">Hover me</button>`;
  `demo/index.html:339` — a `<span class="wonk-tip" data-tip="…" style="border-bottom:1px dashed …; cursor:help">`.
- `references/components.md` Feedback & overlays block shows
  `<span class="wonk-tip" data-tip="mono, inverted">hover target</span>`.
- The proven cerebros contract (`jev-drill.js:283-385`, summarized):
  - One global visual box, plain text via `textContent`, `aria-hidden="true"`,
    `position: fixed`, max 280px wide, centered below the target, flips
    above when it would overflow, 8px from viewport edges, shows at once.
  - `mouseover` on a hint target shows it; moving onto non-hint content
    brings back the focused control's hint if any, else hides.
  - `pointerdown` with `pointerType !== "mouse"` (touch/pen) shows the
    target's hint; tapping elsewhere hides; the element's click still fires.
  - `focusin` shows the hint and describes the focused control for screen
    readers through a visually hidden node referenced by
    `aria-describedby`; `focusout` removes it. Pointer movement never changes
    what a focused control announces.
  - A focused form control resolves to its `<label data-hint>` via `node.labels`.
  - Escape hides the visual box (the description stays while focus stays);
    any scroll (capture) hides the box.
  - Gaps to fix now: the box is not hoverable (`pointer-events: none`,
    fails WCAG 1.4.13); if the page already set `aria-describedby`, the
    hint adds nothing (should append instead); no reposition on resize; the
    rich `tip(root, selector, render)` helper (`jev-drill.js:245-281`) has no
    touch path, no Escape, no screen-reader text, and takes HTML strings.

## Design (build exactly this)

### Markup

```html
<!-- plain hint on anything; canonical attribute is data-tip -->
<button class="wonk-btn" data-tip="Runs the query with the current draft">Run</button>

<!-- a term with a definition: dotted underline, keyboard reachable -->
<span class="wonk-term" data-tip="Share of calls where AI and rep agree">Agreement</span>

<!-- a term defined once in a glossary -->
<script>wonk.glossary({ agreement: "Share of calls where AI and rep agree" })</script>
<span class="wonk-term" data-term="agreement">Agreement</span>

<!-- the standard "?" help button: a real button, outside the label -->
<label class="wonk-label" for="period">period</label>
<button type="button" class="wonk-hint-btn" data-tip="Uses the opportunity close date" aria-label="About period">?</button>

<!-- a label hint shows when its control has focus -->
<label class="wonk-label" for="q" data-tip="Matches deal names">search</label>
<input class="wonk-input" id="q">
```

- `data-hint` is accepted as an alias of `data-tip` (cerebros markup works
  unchanged). Document `data-tip` only, with one line noting the alias.
- `.wonk-tip` class is no longer required; keep it working (no-op class).

### Behavior (document-level delegation, no per-element wiring needed)

- Resolution: nearest ancestor with `data-tip`/`data-hint`/`data-term`
  (`data-term` resolves text from the glossary; unknown term → no tip and
  one `console.warn`); else, for a focused form control, its first
  `label` with a tip.
- Visual box: one `div.wonk-hint` appended to `body` (or inside an open
  modal `dialog`, same rule as toasts in plan 002, so it is not inert or
  hidden behind the top layer), `aria-hidden="true"`, `position: fixed`,
  `max-width: min(20rem, calc(100vw - 16px))`, wraps text, inverted look
  from the old `.wonk-tip`. Placement: centered below the target, flip
  above when it would overflow, clamp 8px from edges. Reposition on window
  resize. Hide on any scroll (capture).
- Show timing: instant on focus and tap; on hover after 50ms (avoids
  flicker when the pointer crosses many targets).
- Hoverable: the box has `pointer-events: auto`. Leaving the target
  starts a 150ms grace timer; entering the box cancels it; leaving the box
  hides. (WCAG 1.4.13 hoverable, dismissible via Escape, persistent.)
- Touch/pen: as in the cerebros contract.
- Focus + screen readers: one visually hidden `#wonk-hint-sr` node. On
  `focusin` of a resolved target, put the text there and **append**
  `wonk-hint-sr` to the focused element's `aria-describedby` tokens (keep
  existing tokens). On `focusout`, remove only that token. Pointer
  movement never changes the description.
- Focusability: on `wonk.init(scope)` and for injected nodes (reuse the
  body `MutationObserver` from plan 002), give `tabindex="0"` to
  `.wonk-term` elements and to `[data-tip]` elements that are not natively
  focusable, not inside a focusable element, and not inside a `tbody`
  (per-row repeats rely on their column header's hint). Opt out with
  `data-tip-focus="off"`.
- Escape hides the box.
- Reduced motion: no transition.
- No-JS fallback: keep a CSS-only `::after` for `.wonk-tip[data-tip]`
  that shows on `:hover` AND `:focus-visible`, and disable it under
  `.wonk-js` (JS owns hints when present).

### Rich tips

```js
const handle = wonk.tip(root, ".oe-cell", (el) => {
  // return a Node (built with DOM APIs) or a string (rendered as text)
  const frag = document.createDocumentFragment();
  …
  return frag;
});
handle.destroy();
```

Same box, same placement, hover/focus/tap/Escape rules, and screen-reader
description (use the rendered content's `textContent`). Never inject HTML
strings. Scoped to `root`; idempotent per `(root, selector)`.

### JS API additions on `window.wonk`

`wonk.glossary(map)` (merge; returns the current map),
`wonk.tip(root, selector, render)` → `{destroy}`,
`wonk.hint.show(el)`, `wonk.hint.hide()`.

### CSS

`.wonk-hint` (the box), `.wonk-term` (`text-decoration: underline dotted`,
`text-decoration-color: var(--ak-ink-3)`, `text-underline-offset: 3px`,
`cursor: help`), `.wonk-hint-btn` (1.25rem square, 4px radius, hairline
border, mono xs `?`, ink-2, hover/focus states), and focus-visible ring
for `[data-tip][tabindex]`. Tokens only.

## Scope

**In scope**: `assets/wonk.js`, `assets/wonk.css`, `demo/base-checks.js`,
`demo/index.html` (only the `overlays` and `buttons` sections: replace the
two old `.wonk-tip` demos and add a small "hints and terms" demo — a term,
a glossary term, a `?` button next to a label, a label hint on an input,
a tip inside a `.wonk-table-scroll` table header, a rich tip), `README.md`
(components table row + one install note), `SKILL.md` (one hard-rule line),
`references/components.md` (Feedback & overlays + JS API table),
`references/data-tools.md` (only if it recommends `title=` or `.wonk-tip`).

**Out of scope**: Plot chart tip CSS, disclosure/fold (plan 004), drill
tables (plan 005), cerebros (do not edit anything outside this repo),
radio files.

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

### Step 1: Checks first
Add to `demo/base-checks.js` (all fixtures hidden-then-cleaned; the box
itself may be visible during a check):
1. focus a `button[data-tip]` → `.wonk-hint` visible with the text; the
   button's `aria-describedby` includes `wonk-hint-sr`; `#wonk-hint-sr`
   has the text.
2. a button with an existing `aria-describedby="x"` keeps `x` and gains
   `wonk-hint-sr`; blur removes only `wonk-hint-sr`.
3. `pointerdown` (`pointerType: "touch"`, dispatched `PointerEvent`) on a
   `span[data-tip]` shows the box; pointerdown elsewhere hides it.
4. mouseover a target shows it (allow the 50ms delay); mouseout → after
   the grace period hides; mouseover the box during grace keeps it.
5. Escape hides the box; focus stays; description stays.
6. a focused `<input>` whose `<label>` has `data-tip` → box shows the label's text.
7. `.wonk-term` and a plain `span[data-tip]` get `tabindex="0"` after
   `wonk.init(fixture)`; a `span[data-tip]` in a `tbody` does not; a
   node injected after init gets it within a frame.
8. `data-term="x"` with `wonk.glossary({x: "def"})` shows `def`.
9. `data-hint` alias works.
10. box stays inside the viewport for a target at the right edge (its
    `getBoundingClientRect().right <= innerWidth - 8`) and flips above for
    a target at the bottom edge.
11. `wonk.tip(root, sel, render)` returning a Node shows it on focus;
    returning a string containing `<b>` shows literal text (no element).
12. a hint inside `.wonk-table-scroll` is not clipped (box is a child of
    `body` or of an open dialog, never of the scroll container).

**Verify**: `npm test -- base` → the 12 new checks FAIL (not error out the runner).

### Step 2: Implement in `assets/wonk.js` and `assets/wonk.css`
Build the design. Register nothing in the reduced-motion registry (the
box has no loop). Keep `wonk.init` idempotent.

**Verify**: `npm test -- base` → all pass.

### Step 3: Gallery and docs
Update the in-scope gallery sections and docs. In `SKILL.md` add one short
hard-rule line: help text and term definitions use `data-tip` /
`.wonk-term`, never native `title=`. In `references/components.md`, one
copy-paste block for each markup form above, and the rich-tip example.

**Verify**: `grep -n 'title="' references/components.md` → no help-text
usages; `grep -c "SECTION:.* START" demo/index.html` equals the END count;
`npm test` → all suites pass.

### Step 4: Look at it
Serve the repo (`node -e` static server or `python3 -m http.server 4748 --bind 127.0.0.1`)
and use Playwright (from `node_modules`) to screenshot `demo/index.html#overlays`
with a hint open, in dark and paper, at 1280 and 390 wide, to `/tmp/wonk-hint-*.png`.
Look at them.

**Verify**: 4 screenshots; box readable in both themes, no overflow at 390px.

## Done criteria

- [ ] `npm test` exits 0 (all suites); 12 new base checks exist and pass
- [ ] `grep -n "\.wonk-tip:hover::after" assets/wonk.css` → only inside the no-JS fallback rule (which also has `:focus-visible`)
- [ ] no hex colors added outside `wonk-tokens.css`
- [ ] `git status --short` → only in-scope files (plus others' untracked files)

## STOP conditions

- Appending the box inside an open modal breaks its positioning (fixed inside a transformed ancestor).
- Dispatched `PointerEvent`s cannot drive the touch path in headless Chromium; report and propose an alternative check instead of skipping it silently.

## Maintenance notes

- Plan 005 (drill tables) and plan 008 (charts) use `wonk.tip` for cell and mark tips.
- cerebros can later drop its `data-hint` code and load this; that migration is AK's call.
