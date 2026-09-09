# WONK instrument controls

precision inputs for data tools: knobs, faders, bounded windows, segmented
selectors, steppers. built on `wonk.css` + `wonk.js`, not a replacement for
them. this file is the contract. `demo/instruments.html` is the living
gallery, open it, don't just read this.

## load order

```html
<link rel="stylesheet" href="../assets/wonk-tokens.css">
<link rel="stylesheet" href="../assets/wonk.css">
<link rel="stylesheet" href="../assets/wonk-controls.css">
<script src="../assets/wonk.js"></script>
<script src="../assets/wonk-controls.js"></script>
```

`wonk-controls.js` assumes `window.wonk` already exists, it calls
`wonk.knob()` directly on any `[data-wonk-knob]` inside injected DOM.

## when to reach for an instrument

use one when the value is continuous or stepped, has hard bounds, and the
exact number matters as much as the gesture: a threshold, a lookback
window, a sample rate, a page size. use `.wonk-select` or `.wonk-input`
for discrete labels with no numeric meaning, unless a mode switch should
look like one, then use the segmented selector (still just native
radios). no audio jargon: "sample rate", not "drive"; "confidence
threshold", not "wet/dry". the exotic look is the point, the naming is
not.

## the hard rule: change commits a draft, it never runs a query

these controls hold local, cheap-to-render state, none of them should
trigger an expensive backend call on their own. `input` fires while a
gesture is in progress, wire it to local, free updates only (the knob's
exact-entry editor does not emit a public `input` while you type, only
once you commit a valid value). `change` fires once, on commit (release,
enter, blur, radio selection, a stepper click), and means the user
finished setting this value, it commits a draft, nothing more. the bounded
window's `change` fires only once both ends are valid, ordered, and pass
their own native constraints, still just a draft commit.

`change` is never a license to run a query by itself. gate any real
backend call behind an explicit action, a "run query" or "apply filter"
button, even if that button just reads the draft state these controls
already hold. disable the trigger while the call is in flight so mashing
it can't fire the same query twice.

## knob (`assets/wonk.js`)

same markup as before, same `data-wonk-knob` attribute, new capabilities.

```html
<div data-wonk-knob data-label="confidence threshold"
     data-min="0" data-max="1" data-step="0.05" data-value="0.8" data-unit="">
</div>
```

| attribute | meaning | default |
|---|---|---|
| `data-min` / `data-max` | numeric bounds | `0` / `100` |
| `data-value` | initial value, snapped to nearest step | midpoint |
| `data-step` | increment for keys, drag, exact entry | `1` |
| `data-unit` | short unit after the number (`ms`, `%`, `rows`) | none |
| `data-label` | accessible label and visible caption | none |
| `disabled` | standard attribute, ignores input, dims 45% | off |

config is validated, not guessed: `wonk.knob(el)` throws if min/max aren't
both finite with min less than max, if step isn't finite and greater than
0, or if value isn't finite. wiring is automatic on load and idempotent,
calling `wonk.knob(el)` again returns the existing handle.

```js
const handle = wonk.knob(document.querySelector('[data-wonk-knob]'));
handle.value;              // current number
handle.set(0.65);          // programmatic update, fires "input" only
handle.set(0.65, { commit: true }); // also fires "change"
handle.set(NaN);           // throws, never silently no-ops on bad input
handle.disabled = true;    // toggle at runtime
handle.destroy();          // remove all listeners, clears el.wonkKnob
```

drag vertically, up increases. `pointerup` fires `change`; `pointercancel`
(touch scroll takeover, alt-tab) settles the gesture the same way but
deliberately does not fire `change`, the gesture never resolved, only
`input` already fired. arrow keys move one step, pageup/pagedown ten
steps, home/end jump to min/max. click the number (or focus it, enter or
space) to swap it for a real number input, typing there does not emit the
knob's own `input` or `change`, only committing does. enter commits,
escape cancels, blur commits. an invalid draft (out of range, or empty
since the field is required) blocks the commit and shows the browser's own
validation message instead of closing the editor, it does not stop you
from typing it, only from committing it.

`handle.value` and `set(v)` are always snapped and clamped to
`[min, max]`. the exact-entry editor is the exception, an open invalid
draft stays on screen exactly as typed, never clamped or reverted, so the
validation message stays meaningful.

copy recipe: `data-label="event sampling rate"` `data-unit="%"`, a
sampling fraction is a percentage of events kept. `Hz` is still correct
for a genuinely periodic value like a polling interval, pick the unit that
matches what the number means.

## fader (`assets/wonk-controls.css` + `.js`)

a native range input, styled `.wonk-range`, kept in sync with an exact
numeric input. reach for this first if a knob feels like overkill for a
straightforward linear value.

```html
<fieldset class="wonk-fader" data-min="0" data-max="500" data-step="10" data-value="120">
  <legend class="wonk-label">p95 latency alert · ms</legend>
  <div class="wonk-fader-row">
    <input type="range" class="wonk-range">
    <input type="number" class="wonk-fader-exact">
    <span class="wonk-fader-unit">ms</span>
  </div>
</fieldset>
```

`wonkControls.fader(el)` returns `{ value, valid, set(v), destroy() }`.
bounds resolve from `data-*`, then native `min`/`max`/`step` attributes,
then a 0/100/1 default; an unset or empty native attribute never produces
`NaN`. dragging live-updates the number. typing an exact value and
pressing enter (which blurs), or blurring directly, pushes the value to
the range and fires the range's own `input` and `change` exactly once.
both inputs get an `aria-label` derived from the legend unless you set one
yourself.

an out-of-range or malformed number in the exact input is never silently
reverted or clamped: type `9999` against `max="500"`, leave it empty, or
type letters, the text stays exactly as typed, native `:invalid` styling
applies, nothing commits until you fix it (check `handle.valid` or
`checkValidity()`). `set(v)` is different, it always snaps and clamps `v`,
calling `set()` asserts a value rather than drafting one. disable with
`<fieldset disabled>`, both inputs go inert for free.

## bounded time/range window (`.wonk-window`)

two plain inputs, `date`, `datetime-local`, or `number`, kept mutually
ordered.

```html
<fieldset class="wonk-window" data-min="2026-01-01" data-max="2026-12-31">
  <legend class="wonk-label">date range</legend>
  <div class="wonk-window-row">
    <input class="wonk-input" type="date" value="2026-08-01"> <!-- from -->
    <span class="wonk-window-sep">to</span>
    <input class="wonk-input" type="date" value="2026-09-01"> <!-- to -->
  </div>
</fieldset>
```

`wonkControls.window(el)` reads the first two inputs, order matters, first
is from, second is to. it fires one `change` on the fieldset,
`detail: { from, to }`, once both ends are filled in, individually valid
(native min/max/step/required satisfied), and correctly ordered. that
`change` commits a draft range, wire an explicit run/apply action to the
real query and have it read this draft. returns
`{ value, valid, set({from, to}), destroy() }`; `set()` validates like a
real commit, writing an invalid or crossed pair rolls both fields back and
throws.

ordering compares numerically for numeric-like types, never as strings:
`date`, `datetime-local`, `month`, `week`, `time`, `number`, `range`
compare via `valueAsNumber`, so a number input going from 9 to 10 is
correctly recognized as increasing. only bare `text` inputs fall back to
string comparison.

a crossed pair, from after to, is a validation error. typing "from" past
"to" retains both values exactly as typed and sets a visible custom
validity message on both via `setCustomValidity` (native `:invalid`
applies), blocking `change`. it never rewrites the other end for you, and
does not stop you from typing the crossed value, only from committing it.
the message clears the instant you fix either end.

copy recipe: label the legend with what the window scopes ("date range",
"lookback window"), not "time" alone.

## segmented selector (`.wonk-segmented`)

native radios, grouped with a sliding highlight, for a small fixed set of
mutually exclusive display modes.

```html
<fieldset class="wonk-segmented">
  <legend class="wonk-label">granularity</legend>
  <div class="wonk-segmented-track">
    <label><input type="radio" name="granularity" value="hour" checked><span>hour</span></label>
    <label><input type="radio" name="granularity" value="day"><span>day</span></label>
  </div>
</fieldset>
```

`wonkControls.segmented(el)` only adds the glide bar, without JS or under
reduced motion each option fills solid when checked. listen to native
`change` on any radio, or the fieldset since it bubbles. 3 to 5 options is
the sweet spot. `destroy()` removes the glide element and the `has-glide`
class it added, so the track falls back to the solid-fill styling.

## stepper (`.wonk-stepper`)

a plain number input is already a stepper. this wrapper adds bigger click
targets sharing the input's min/max/step. the root is a real fieldset, so
`disabled` natively disables the input and both buttons.

```html
<fieldset class="wonk-stepper" data-min="1" data-max="100" data-step="1" data-value="20">
  <legend class="wonk-label">rows per page</legend>
  <div class="wonk-stepper-row">
    <button type="button" class="wonk-stepper-btn" data-dir="-1">-</button>
    <input type="number" class="wonk-stepper-input" aria-label="rows per page">
    <button type="button" class="wonk-stepper-btn" data-dir="1">+</button>
  </div>
</fieldset>
```

`wonkControls.stepper(el)` wires the buttons to call the input's own
native `stepUp()`/`stepDown()`, the platform decides what a blank field
becomes, never "blank means 0". `data-value` only applies as an explicit
starting value when the input has none, leave it off and the field starts
blank. buttons disable at the bounds and recheck the live disabled state
on every click. returns `{ value, valid, set(v), destroy() }`; `set(v)`
throws on a non-numeric `v` instead of defaulting to 0.

## contract: instrument to data tool mapping

| data tool need | instrument | why |
|---|---|---|
| a threshold that gates an alert or highlight | knob or fader | continuous, bounded, exact value matters |
| a lookback window, cohort date range, comparison period | bounded window | two ends, must stay ordered, one commit event |
| chart granularity, view mode, aggregation function | segmented selector | small fixed set, one active at a time |
| page size, row limit, retry count, decimal precision | stepper | small integers, +/- buttons |
| a single on/off setting | `.wonk-toggle` (in `wonk.css`) | not an instrument, binary state |
| free-text filter, search, ID lookup | `.wonk-input` (in `wonk.css`) | not bounded or continuous |

## lifecycle: `init(scope)` and `destroy(scope)`

```js
wonkControls.init();              // wire every instrument on the page, runs automatically on load
wonkControls.init(someNewPanel);  // wire instruments inside injected DOM, also wires someNewPanel itself if it matches
wonkControls.destroy(somePanel);  // tear down every wired instrument inside (and including) somePanel
```

`init(scope)` wires fader/window/segmented/stepper inside `scope`, plus
`scope` itself if it matches, plus any `[data-wonk-knob]` inside or as
`scope` via `wonk.knob()` directly. it does not call the broader
`wonk.init(scope)`, that would re-run wonk.js's live/glyph/scatter/vu/
tabs/secret wiring, none of which guard against re-attachment, so a
second call on an already-wired scope would double listeners and restart
intervals. wire any non-instrument `data-wonk-*` widgets yourself, one
`wonk.*` call each.

call `destroy(scope)` before removing a subtree containing a segmented
selector, its window resize listener is anchored outside the subtree and
would keep referencing the removed DOM otherwise. fader, window, stepper,
and the knob only attach listeners to their own elements, all collected
normally once the subtree is dereferenced, but `destroy()` is still worth
calling: it cancels an in-flight drag/edit and clears each control's
cached handle, useful if you plan to re-wire the element later.

## selectors, for automated checks

| control | root selector | value lives on | validity |
|---|---|---|---|
| knob | `[data-wonk-knob]` | `el.wonkKnob.value`, text in `.val` | `set()` throws on non-finite input |
| fader | `.wonk-fader` | `.wonk-range` (native `value`) | `.valid`, or `:invalid` on `.wonk-fader-exact` |
| window | `.wonk-window` | the two inputs inside, in DOM order | `.valid`, or `:invalid` on either input |
| segmented | `.wonk-segmented` | `input[type=radio]:checked` in `.wonk-segmented-track` | always valid, one option checked |
| stepper | `.wonk-stepper` | `.wonk-stepper-input` (native `value`) | `.valid`, or `.checkValidity()` on the input |

every control keeps state on a real, inspectable DOM element, nothing
lives only in a closure a test can't reach.
