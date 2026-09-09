# motion follows a real change

load `assets/wonk-motion.css` and `assets/wonk-motion.js` after
`assets/wonk-tokens.css`. the pack has no package dependencies. it works without
base `wonk.js`; the gallery uses both. `demo/motion.html` has eight replay buttons.

## install

```html
<link rel="stylesheet" href="../assets/wonk-tokens.css">
<link rel="stylesheet" href="../assets/wonk-motion.css">
<script defer src="../assets/wonk-motion.js"></script>
```

tokens define durations and easing. missing or malformed duration tokens produce
an error when the module loads. don't hide that error with a default duration.

## choose the effect by the event

| name | event | target | duration |
|---|---|---|---|
| `panel-enter` | user opens a panel | panel | 250ms |
| `panel-exit` | user closes a panel | panel | 150ms |
| `value-changed` | a measured value changes | number wrapper | 250ms |
| `row-inserted` | a record arrives or is created | row or list item | 250ms |
| `filter-applied` | committed filters replace a result | result container | 150ms |
| `progress-complete` | backend confirms completion | progress fill span | 400ms |
| `trace-draw` | user reveals a static diagram | SVG with traced paths | 400ms |
| `confirm-check` | save succeeds | SVG with traced paths and pop group | 400ms total |

these are one-shot effects. no effect starts on load. no effect loops. change
numbers immediately, then accent the new value. never count through invented
intermediate values. a changing latency readout must show the measured latency.

## use the API

```js
wonkMotion.effects; // frozen array of effect names
wonkMotion.prefersReduced(); // current media-query value
const result = await wonkMotion.play(element, 'value-changed');
// { status: 'done' | 'cancelled' | 'skipped', name, el }
wonkMotion.cancel(element);
```

`done` means the animation reported completion, or reduced motion applied the
resting appearance immediately. `cancelled` means a later effect, explicit cancel,
or browser animation cancellation interrupted it. `skipped` means the safety timer
expired without a completion event. hidden or detached targets can cause that.

`play()` rejects unknown names, non-Element targets, missing traced descendants,
and traced descendants without `pathLength="1"`. handle errors at the application
boundary; do not silently ignore invalid markup.

one effect owns an element at a time. another `play()` cancels the old effect first.
`cancel()` on an idle element does nothing. cancel effects before removing their
targets. the app owns DOM removal, visibility, and focus return.

## copy the common reactions

```js
// panel enter
panel.hidden = false;
wonkMotion.play(panel, 'panel-enter');

// panel exit: a newer open action can cancel this request
const result = await wonkMotion.play(panel, 'panel-exit');
if (result.status !== 'cancelled') panel.hidden = true;

// numeric update: the source owns the number
readout.textContent = measuredValue.toLocaleString();
wonkMotion.play(readout, 'value-changed');

// row insertion: insert the real record before animating it
tbody.append(row);
wonkMotion.play(row, 'row-inserted');

// filtering: render the committed result first
renderResults(rows);
wonkMotion.play(results, 'filter-applied');
```

use a request ID when application-level open/close operations have other asynchronous
steps. motion cancellation only controls this pack's own animation.

```html
<div class="wonk-progress"><span id="fill" style="width:100%"></span></div>
<p>Complete. 1,200 records written.</p>
```

```js
wonkMotion.play(fill, 'progress-complete');
```

completion adds `.wonk-motion-done`, which keeps the fill in `--ak-ok`. starting
another completion effect clears the previous class. remove that class when an
application starts a new job. the fill is a visual companion; use native progress
or a correctly named progressbar with real counts for accessibility.

## draw a static trace

```html
<svg id="trace" viewBox="0 0 120 40" role="img" aria-label="Example trace">
  <path data-wonk-trace pathLength="1" d="M2 32 L30 10 L60 28 L90 8 L118 20"
        fill="none" stroke="var(--ak-a1-text)" stroke-width="2" />
</svg>
```

```js
wonkMotion.play(document.querySelector('#trace'), 'trace-draw');
```

this effect decorates a static diagram. use [charts.md](charts.md) for analytical
charts. don't redraw every line on each poll, hide a fresh result while a stroke
appears, or imply a time axis through animation. preserve uncertainty and gaps.

## confirm an action after it succeeds

```html
<svg id="confirmed" viewBox="0 0 40 40" aria-hidden="true">
  <g data-wonk-pop fill="none" stroke="var(--ak-ok)" stroke-width="2">
    <circle data-wonk-trace pathLength="1" cx="20" cy="20" r="16" />
    <path data-wonk-trace pathLength="1" d="M12 20 L18 26 L29 14" />
  </g>
</svg>
<p role="status">Saved.</p>
```

```js
wonkMotion.play(document.querySelector('#confirmed'), 'confirm-check');
```

traces draw for 250ms; the group then scales for 150ms. the adjacent text supplies
the status. don't play success before a request resolves. don't rely on the icon's
color or animation to communicate success.

## reduced motion works during the session

when reduced motion is already on, `play()` applies the resting appearance without
adding an animation class. its promise resolves immediately. when the preference
changes mid-animation, the media-query listener finalizes active effects and clears
their classes. progress completion retains its done color.

removing an effect leaves visible content. a panel exit still requires the app to
hide or remove the panel after checking the returned status. a reduced-motion
setting never changes the query result, data values, focus order, or enabled state.

## keep the motion budget small

- use one response per action. a query needs one result accent, not 200 animated rows.
- keep irregular timing on genuine live/loading indicators. it has no role in a button hover.
- prefer transform and opacity. small value washes and SVG stroke effects also paint;
  keep their targets small. never animate table layout or dashboard-sized shadows.
- don't keep `will-change` on idle elements. don't start a timer to imply activity.
- don't move a focused control or wait for motion before enabling an action.
- keep errors persistent. motion may draw attention once; text explains the cause.

base `.wonk-spectrum`, `.wonk-skeleton`, and `data-wonk-live` are existing loading
options. use them only while real work runs. legacy JS decorative helpers read
reduced motion at startup; the new motion pack handles preference changes live.

## lifecycle and event scoping

`data-wonk-motion-state="running"` exists only during an active effect. classes use
the form `.wonk-anim-panel-enter`. prefer `play()` over manual class management;
it owns cleanup, replay, overlap, and media-query changes.

SVG effects track each matching descendant and animation name. unrelated nested
animation events cannot finish the parent's effect. duplicate completion events
cannot count twice. all tracked targets must finish before the promise resolves.

## run the browser checks

open `demo/motion.html`, then run:

```js
await wonkMotionChecks.run();
// { passed, failed, results }
```

`demo/motion-checks.js` tests all eight effects, overlap, explicit cancellation,
browser cancellation, nested events, duplicate events, invalid inputs, and reduced
motion at startup and mid-flight. it creates temporary fixtures and an isolated
iframe for preference tests. the iframe loads the local motion asset again.

also test the actual OS setting, dark/paper themes, and mobile widths. automated
animation events do not prove readability or keyboard usability.
