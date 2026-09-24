# Plan 013: Improvements suggested by the dm4 upgrade to WONK 0.2

> **Note, not yet an executable plan.** This is a list of suggested
> improvements, collected while dm4 re-vendored WONK 0.2.0 (dm4 PR #256,
> merged 2026-09-24). Each item names the evidence, a suggested fix, and a
> check. Before execution, AK picks the items; then they become plan steps
> (red → green checks, one commit). Do not edit `plans/README.md` from an
> executor run.
>
> **Drift check (run first)**: `git diff --stat 63bb677 -- assets/ references/ CHANGELOG.md`.
> If an in-scope file changed, re-read the lines cited below before acting.

## Status

- **Priority**: P1 items 1-2, P2 items 3-4, P3 item 5, docs items 6-10
- **Effort**: S-M overall (each item is S, except 3 and 4, which need a decision)
- **Risk**: LOW for 1, 2, 5, 6, 7, 9, 10; MEDIUM for 3 and 4 (hint behaviour
  that WCAG 1.4.13 constrains) and for 8 (a cascade change)
- **Depends on**: plans 001-011 (all DONE); independent of plan 012
- **Category**: bug / a11y / api / docs
- **Planned at**: commit `63bb677`, 2026-09-24

## Context

dm4 (`/Users/ak/code/dm4`) is a React + Tailwind v3 app. It vendors eight
WONK files byte for byte (`ui/src/styles/wonk*.css`, `ui/src/lib/wonk*.js`),
pinned by `ui/src/v5/wonk-vendor.test.js`, and puts `class="wonk"` on
`<html>`. It uses the base, controls, data CSS, and motion packs. It does not
use hints, the data JS, charts, radio, or fonts: it has its own React
`Tooltip`, its own music player, and Google Fonts (it also needs Instrument
Sans, which the fonts pack lacks).

The re-vendor itself needed no dm4 component change. A trial that moved
five native `title=` hints to `data-tip` was reverted before merge, because
a code review found the UX problems in items 2-4 and 9. Those items come
from that trial, the review, and a reading of `assets/wonk.js`; the hint
overlap in item 3 was seen in a dark and a paper screenshot.

## Bugs (P1)

### 1. wonk.js throws at load when `CSS` is missing (`assets/wonk.js:671`)
`const MODAL_SELECTOR = CSS.supports("selector(:modal)")` runs when the
IIFE loads. jsdom has no `CSS` object, so every dm4 test that imports
`wonk.js` failed with `Cannot read properties of undefined (reading
'supports')`. dm4 added a stand-in to two test files, next to their
`matchMedia` stand-in. Trap: vitest's jsdom environment defines a `CSS` key
whose value is `undefined`, so `'CSS' in globalThis` is true; test with
`typeof CSS?.supports`.
- **Fix:** `typeof CSS !== "undefined" && typeof CSS.supports === "function"
  && CSS.supports("selector(:modal)")`. `CSS.escape` at line 1220 runs only
  on a call path, but guard it the same way or fall back to a quoted
  attribute selector.
- **Check:** a checks page that shadows `window.CSS` with `undefined` before
  loading `wonk.js` gets `window.wonk.version === "0.2.0"`, with no error.

### 2. A mouse click leaves a focus hint open (`assets/wonk.js:967`, `:946`)
The `focusin` listener calls `showTip(tip, "focus")` for any focus, including
the focus a mouse click gives a checkbox, button, or input. The `mouseout`
listener returns early when `shownBy === "focus"`. So clicking a checkbox
inside a `label[data-tip]` shows the box, and it stays after the pointer
leaves, until focus moves. The dm4 review traced this for its "Ends the
user" checkbox: the hint would stay over the warning that the tick renders.
A native `title` never stays open.
- **Fix:** in `focusin`, show the box only when `e.target.matches(":focus-visible")`.
  Keep `describe()` for every focus, so screen readers still hear the tip.
  A mouse user already gets the hover path.
- **Check:** a synthetic click on a checkbox in `label[data-tip]`, then a
  pointer move away, hides the box after the grace delay. Tab onto the same
  checkbox shows the box, and it stays while focus stays.

## Hint behaviour that needs a decision (P2)

### 3. The hint box covers dense neighbours and takes their clicks (`assets/wonk.css:736`)
`.wonk-hint` has `pointer-events: auto` (hoverable, WCAG 1.4.13) and sits
6px below its anchor. dm4's checkbox rows wrap with a 4px gap, so the box
covers the next row. The pointer moves down toward the next checkbox, enters
the box, cancels the grace timer, and the click lands on the box. The user
must move away and click again. The screenshots showed the box over the next
disclosure summary.
- **Options (AK picks):**
  - (a) Place the box above, or beside, when below would cover a focusable
    element. Keeps 1.4.13; costs one `elementsFromPoint` probe per place.
  - (b) `pointer-events: none` for plain-text tips only, rich `wonk.tip`
    boxes stay hoverable. Simple, but plain tips stop being hoverable, which
    1.4.13 asks for.
  - (c) Document it: dense control rows take `data-tip-focus="off"` plus a
    `.wonk-hint-btn`, not a tip on each label.
- **Recommendation:** (a), with (c) as a docs line either way.
- **Check:** two checkbox rows 4px apart; hover row 1, move straight down,
  click row 2: the checkbox toggles on the first click.

### 4. Escape is swallowed while any hint is open (`assets/wonk.js:987`)
The capture-phase `keydown` listener calls `preventDefault()` and
`stopPropagation()` on Escape whenever a box shows, also a hover hint while
focus is somewhere else. In dm4 that first Escape would not reach Monaco's
suggest widget, the model picker, or the `useModal` dialog listener on
`document`. The comment cites WCAG 1.4.13, but 1.4.13 asks only that Escape
dismisses the box; blocking the key is WONK's choice, so one Escape does not
close a tip and a dialog at once.
- **Options (AK picks):**
  - (a) Swallow only when the box is a focus hint for the focused element
    (or focus is inside the box). A hover hint closes on Escape and the key
    goes on to the app.
  - (b) Keep swallowing, and document it in `components.md § hints` and in
    the CHANGELOG upgrade traps, so apps with Escape handlers know.
- **Recommendation:** (a).
- **Check:** with a hover hint open and focus in an input inside an open
  `<dialog>`, one Escape closes the hint and the dialog. With a focus hint
  on a control, the first Escape closes only the hint.

## API (P3)

### 5. A token-to-hex helper for canvas, Monaco, and WebGL
dm4 writes `tokenHex(name, alpha)` (`ui/src/v5/theme.js:108`): it reads a
token, parses hex or `rgba()`, and flattens any alpha against `--ak-ground`,
because Monaco parses only hex. `assets/wonk-charts.js:46` reads computed
tokens for Plot the same way. Any app with Monaco, a canvas, or WebGL
rewrites this.
- **Fix:** `wonk.color(name, { format: "hex", flatten: true })`, re-read on
  every call so pair and theme switches apply. dm4's function is the
  reference.
- **Check:** in paper, `wonk.color("--ak-ink-3", { format: "hex", flatten: true })`
  returns the ink-3 colour mixed over the paper ground; after `setPair`, the
  accent result changes.

## Docs

### 6. Tailwind adapter: opacity modifiers need `color-mix` (`references/adapters.md:24`)
The example maps each colour to a bare `var(--ak-*)`. Tailwind v3 cannot put
alpha into a bare variable, so `bg-a1/20` or `text-ink-2/70` fails. dm4 uses
40+ such classes (`text-muted-foreground/70` alone 13 times) through one
helper (`ui/tailwind.config.js:23`), which also works for tokens that carry
their own alpha, like `--ak-ink-3`:
`const tok = (name) => \`color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)\``.
- **Fix:** use `tok()` in the adapter example and say why.

### 7. Tailwind adapter: where WONK sits in the cascade
`adapters.md` does not say where `wonk.css` goes relative to `@tailwind`.
dm4 imports it first. Its rules then beat Tailwind utilities on specificity
(`.wonk p` is 0,1,1; `.text-sm` is 0,1,0), and app overrides must come after
`@tailwind utilities`. dm4 once rendered a busy bar at zero width because an
app rule meant to lose to a utility won instead. In Tailwind v4, native
layers apply: unlayered CSS beats every layer.
- **Fix:** a short "cascade" paragraph for v3 and v4: import order, where
  overrides go, and what wins.

### 8. Bare-element rules fight app utilities (`assets/wonk.css:29-47`)
`.wonk h1`-`h4`, `.wonk p`, and `.wonk small` set size, margin, and colour
at 0,1,1. With `class="wonk"` on `<html>`, every Tailwind v3 utility on those
elements loses, so dm4 undoes size, weight, margin, and colour on `p`,
`h1`-`h4`, `a`, and `small` in its own CSS (`docs/design-system.md`,
"neutralises"). 0.2 already moved links to `:where(.wonk) a` for the same
reason.
- **Fix (a code change, decide with item 7):** move these rules to
  `:where(.wonk) h1` etc. Risk: a plain app element rule (0,0,1) then ties
  and order decides; re-check the demo and the template.
- **Check:** `<p class="x">` with `.x { margin: 0 }` computes margin 0.

### 9. Hints: where a `data-tip` may go (`references/components.md § hints`)
- `tipFor` walks up to the nearest ancestor with a tip, so a `data-tip` on a
  `fieldset` or `section` applies to every child. If a child has its own
  tooltip (an app's React tooltip), two boxes open at once. The dm4 trial did
  this on its AI settings fieldset.
- A disabled control, or a control inside a disabled `fieldset`, never takes
  focus, so its tip never reaches `aria-describedby`. The native `title` it
  replaced was announced. Say: give the reason as visible text, or point
  `aria-describedby` at a `.wonk-sr` node.
- **Fix:** add both as rules under hints, beside plan 012 item 20.

### 10. Controlled frameworks and the segmented glide (`references/adapters.md:111`)
React writes `checked` onto a radio with no `change` event (undo, server
state, a refused edit). The glide then sits under the old option. dm4 calls
`el.wonkSegmented.set(value)` in an effect keyed on the value
(`ui/src/v5/Segmented.jsx:45-52`). `instruments.md` documents `set()` for
the fader but not for the segmented control.
- **Fix:** one paragraph and the effect snippet under "optional packs and
  framework lifecycle".

## Supports plan 012

- **012 item 21 (CI-safe drift check):** dm4's byte test skips in CI. All
  eight vendored files drifted, and nobody saw it until a manual audit on
  2026-09-24. The `WONK v0.2.0` header now makes a CI-safe version check
  possible.

## Considered and left out

- **The body-wide MutationObserver (`assets/wonk.js:233`) is cheap.** In dm4
  (template load, a tab switch, 40 Monaco scroll steps) it saw 428 added
  nodes; running its `reveal` and `focusTips` queries on all of them took
  0.33 ms, about 0.8 µs a node. No change needed.
- **Moving dm4's player to the radio pack:** the pack already emits
  `wonk-radio:state` and track events. dm4 picks tracks through its own
  server endpoint, so the gap is dm4's, not WONK's.
- **Instrument Sans in the fonts pack:** dm4's prose face is an app choice,
  not a WONK face.

## Outcome (2026-09-24, WONK 0.3.0)

- Shipped: items 1-4 and 6-10, each code item with a check in
  `demo/base-checks.js`.
- Item 3: option (a), smart placement (below, else above, right, left; the
  old rule when every side covers a control), plus the dense-rows docs line
  from (c).
- Item 4: option (a).
- Item 8: moved to `:where(.wonk)` (AK's pick). Side effect, all intended:
  `p.wonk-help` now shows ink-3, `p.wonk-help--error` turns red, and
  `h2.wonk-sr` gets its -1px margin.
- Item 5 (`wonk.color`): rejected by AK. Plot and canvas take `rgba()`, and
  dm4 keeps its own `tokenHex`.
