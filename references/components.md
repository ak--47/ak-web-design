# WONK component catalog

Copy-paste markup for every component in `assets/wonk.css` / `assets/wonk.js`.
The demo page (`demo/index.html`) shows all of them live. The root needs
`class="wonk"` and a `data-pair`; wonk.js auto-wires every `data-wonk-*`
attribute, `.wonk-tabs`, and `.wonk-menu` on DOMContentLoaded. for injected
DOM call `wonk.init(scope)`: it is idempotent per element, so calling it again
on the same subtree after a render is safe (already-wired elements are
skipped). wonk.js loads with `defer`, so any inline script that calls `wonk.*`
must wait for `DOMContentLoaded`.

## specialized packs

| pack | catalog | gallery |
|---|---|---|
| precision knob, fader, bounded window, segmented selector, stepper | [instruments.md](instruments.md) | `demo/instruments.html` |
| source channels, query toolbar, applied filters, selectable table, inspector, jobs, result states | [data-tools.md](data-tools.md) | `demo/workbench.html` |
| eight state-change effects, cancellation, live reduced-motion handling | [motion.md](motion.md) | `demo/motion.html` |

load each optional pack after the base assets. `wonkControls.init(scope)` wires
instruments, including the scope itself. `wonkMotion.play(el, name)` plays one
explicit effect. data layouts are CSS compositions; their application behavior
lives in the workbench example.

## Contents

1. [Typography](#typography) · 2. [Layout & dividers](#layout--dividers) ·
3. [Buttons](#buttons) · 4. [Forms](#forms) · 5. [Navigation](#navigation) ·
6. [Data display](#data-display) · 7. [Feedback & overlays](#feedback--overlays) ·
8. [Live & loading](#live--loading) · 9. [Exotic](#exotic) · 10. [JS API](#js-api)

## Typography

```html
<h1>Mixed-case grotesk headings</h1>            <!-- h1-h4 styled -->
<p>Body. Links look like <a href="#">this</a>. <small>small print</small></p>
<div class="wonk-title">Page title</div>         <!-- uppercase, 0.3rem tracked; page titles ONLY -->
<span class="wonk-label">section label</span>    <!-- mono, weight 500, uppercase, 0.06em tracked -->
<span class="wonk-num">48,112</span>             <!-- tabular mono; ALL numbers -->
<kbd>⌘</kbd> <kbd>K</kbd>
```

`--ak-font-mono` is IBM Plex Mono (400/500/600/700). `--ak-track-label` is
`0.06em`, relative to the element's own font-size, not a fixed rem value.

## Layout & dividers

```html
<div class="wonk-shell">                         <!-- sidebar app frame -->
  <aside class="wonk-side">
    <div class="brand">WONK</div>
    <a class="wonk-navlink active" href="#">Overview</a>
    <a class="wonk-navlink" href="#">Logs</a>
  </aside>
  <div>
    <header class="wonk-topbar">…</header>
    <main>…</main>
  </div>
</div>

<section class="wonk-reveal">…</section>        <!-- fades + slides in on scroll -->

<hr class="wonk-divider">                        <!-- square wave: between CHAPTERS -->
<hr class="wonk-divider wonk-divider--accent">   <!-- accent-colored wave -->
<hr class="wonk-rule">                           <!-- hairline: within a chapter -->
<div class="wonk-stack">…</div>                  <!-- children joined by vertical hairlines -->
```

`.wonk-reveal` hides only once wonk.js arms it (`.is-armed`, right before it
starts watching the element), then shows it (`.is-in`) as it scrolls into
view. a no-JS page, or an element wonk.js never saw, stays visible. sections
injected after load are armed automatically (one page-wide
`MutationObserver`), no `wonk.reveal()` call needed. reduced motion shows
them at once.

## Buttons

```html
<button class="wonk-btn wonk-btn--primary">Deploy</button>
<button class="wonk-btn">Inspect</button>
<button class="wonk-btn wonk-btn--danger">Destroy</button>
<button class="wonk-btn wonk-btn--quiet">Nevermind</button>
<button class="wonk-btn" disabled>Disabled</button>
```

## Forms

```html
<div class="wonk-field">
  <label class="wonk-label" for="x">name</label>
  <input class="wonk-input" id="x" placeholder="…">
  <span class="wonk-help">helper text</span>
</div>
<!-- error: add wonk-input--error to the input, wonk-help--error to the help -->
<select class="wonk-select">…</select>
<textarea class="wonk-textarea"></textarea>

<label class="wonk-check"><input type="checkbox" checked> sidechain</label>
<label class="wonk-check"><input type="radio" name="g" checked> wet</label>

<label class="wonk-toggle"><input type="checkbox" checked><span class="track"></span></label>

<input type="range" class="wonk-range" min="0" max="100" value="64">

<div class="wonk-progress"><span style="width:64%"></span></div>
```

## Navigation

```html
<nav class="wonk-crumbs" aria-label="breadcrumbs">
  <a href="#">cerebros</a><span class="sep">/</span>
  <a href="#">pipelines</a><span class="sep">/</span>
  <span class="here">ingest-api</span>
</nav>

<nav class="wonk-pages">
  <button class="wonk-page" disabled>←</button>
  <button class="wonk-page">1</button>
  <button class="wonk-page" aria-current="page">2</button>
  <button class="wonk-page">→</button>
</nav>

<span class="wonk-avatar">ak</span>              <!-- circle monogram; --sm for 28px -->

<details class="wonk-menu">                      <!-- dropdown; add wonk-menu--end to right-align -->
  <summary class="wonk-btn">Actions ▾</summary>
  <div class="menu">
    <button>Redeploy</button>
    <a href="#">View logs</a>
    <hr>
    <button class="danger">Destroy</button>
  </div>
</details>

<div class="wonk-tabs">                          <!-- wonk.js wires data-panel -->
  <button class="wonk-tab" aria-selected="true" data-panel="#p1">Overview</button>
  <button class="wonk-tab" aria-selected="false" data-panel="#p2">Logs</button>
</div>
<div id="p1">…</div><div id="p2" hidden>…</div>
```

menu: the dropdown works with zero JS (native `<details>`). wonk.js adds:
choosing an item closes it, Escape closes it and returns focus to the
`summary`, and a menu that would run off the viewport's right edge gets
`.wonk-menu--end` when it opens. set `.wonk-menu--end` yourself to always
right-align; wonk.js leaves an author-set one alone.

tabs: wonk.js adds the ARIA tabs pattern: `role="tablist"`/`"tab"`/`"tabpanel"`,
ids where missing, `aria-controls` and `aria-labelledby`, and a roving
`tabindex` (only the selected tab is in the Tab order). ArrowLeft/ArrowRight
(wrapping), Home, and End move focus and select (automatic activation). on
wiring, the tab with `aria-selected="true"` (else the first) is selected and
only its panel is visible, whatever `hidden` said in the markup. a tab whose
`data-panel` is missing or matches nothing is skipped with a `console.warn`.

## Data display

```html
<div class="wonk-card">…</div>                   <!-- --accent: a1 top bar; --flat: no fill -->

<div class="wonk-stat">
  <span class="wonk-label">events / sec</span>
  <span class="wonk-num">48,112</span>
  <small class="delta-up">▲ 12%</small>          <!-- or delta-down -->
</div>

<span class="wonk-badge">default</span>          <!-- --ok --warn --err --info --accent -->

<table class="wonk-table">
  <thead><tr><th>service</th><th class="num">req/s</th></tr></thead>
  <tbody><tr><td>ingest-api</td><td class="num">18,204</td></tr></tbody>
</table>

<dl class="wonk-kv">
  <dt>version</dt><dd>v2.4.1</dd>
</dl>

<pre class="wonk-pre"><code>…</code></pre>       <!-- spans: tok-key tok-str tok-com -->

<div class="wonk-log">                           <!-- spans: ts, msg, lv-ok/lv-warn/lv-err -->
  <div><span class="ts">04:31:17</span> <span class="lv-ok">OK</span> <span class="msg">…</span></div>
</div>
```

Charts: see [charts.md](charts.md). Sparklines: `wonk.spark(el, values)`.

## Feedback & overlays

```html
<div class="wonk-alert wonk-alert--warn">        <!-- default=info; --ok --warn --err -->
  <span class="ico">△</span>
  <span><strong>Degrading.</strong> p95 doubled since 09:00.</span>
</div>

<div class="wonk-acc">                           <!-- accordion: native details -->
  <details><summary>Question</summary><div class="body">Answer.</div></details>
</div>

<dialog class="wonk-modal" id="m">…</dialog>     <!-- open with .showModal() -->

<!-- toasts are JS-only. wonk.js loads with defer, so wait for it: -->
<script>
  document.addEventListener("DOMContentLoaded", () => {
    wonk.toast("Deployed", "ok");                // ok | warn | err | info
  });
</script>
```

toasts: the host (`.wonk-toasts`) is a `role="status"` `aria-live="polite"`
region, and an `err` toast is also `role="alert"`. every toast has a Dismiss
button (`aria-label="Dismiss"`); hovering or focusing a toast pauses its
timer. a modal `<dialog>` (`showModal()`) makes the rest of the page inert,
so while one is open the host moves inside it (and back to `<body>` when it
closes): a toast fired from a modal stays visible and announced.

### hints and terms

help text and term definitions use `data-tip` and `.wonk-term`, never
native `title=` (it shows late or never, and never on focus or touch).
wonk.js shows one inverted box on hover, keyboard focus, and tap, and
describes the focused control to screen readers. no class, no wiring.
`data-hint` works as an alias of `data-tip`.

```html
<!-- plain hint on anything -->
<button class="wonk-btn" data-tip="Runs the query with the current draft">Run</button>

<!-- a term with a definition: dotted underline, keyboard reachable -->
<span class="wonk-term" data-tip="Share of calls where AI and rep agree">Agreement</span>

<!-- a term defined once in a glossary -->
<span class="wonk-term" data-term="agreement">Agreement</span>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    wonk.glossary({ agreement: "Share of calls where AI and rep agree" });
  });
</script>

<!-- the standard "?" help button: a real button, outside the label -->
<label class="wonk-label" for="period">period</label>
<button type="button" class="wonk-hint-btn" data-tip="Uses the opportunity close date" aria-label="About period">?</button>

<!-- a label hint shows when its control has focus -->
<label class="wonk-label" for="q" data-tip="Matches deal names">search</label>
<input class="wonk-input" id="q">
```

- hover shows after 50ms, focus and tap show at once. the pointer can move
  onto the box. Escape closes it. a scroll closes it (a focus hint follows
  its control).
- focus appends `wonk-hint-sr` to the control's `aria-describedby` and keeps
  the page's own tokens. blur removes only that token.
- `wonk.init(scope)`, and nodes injected later, give `.wonk-term` and
  non-focusable `[data-tip]` elements `tabindex="0"`, except inside an
  interactive element or a `tbody` (per-row repeats rely on their column
  header's hint). opt out with `data-tip-focus="off"`.
- an unknown `data-term` shows nothing and warns once in the console.
- the box lives in `<body>` (or the open modal), so a scrolling table never
  clips it.
- without JS, `.wonk-tip[data-tip]` keeps a CSS-only fallback on hover and
  focus.

rich tips, e.g. a heatmap cell that lists its deals and total:

```js
const handle = wonk.tip(grid, ".oe-cell", (el) => {
  // return a Node built with DOM APIs, or a string (always shown as text, never HTML)
  const frag = document.createDocumentFragment();
  const head = document.createElement("strong");
  head.textContent = `${el.dataset.count} deals · ${el.dataset.total}`;
  frag.append(head);
  for (const name of el.dataset.deals.split("|")) {
    const row = document.createElement("div");
    row.textContent = name;
    frag.append("\n", row);            // keeps words apart in the screen-reader text
  }
  return frag;
});
handle.destroy();                      // before the grid unmounts
```

same box and rules. the screen-reader text is the content's `textContent`.
a second call with the same `root` and selector returns the same handle.
`wonk.tip` adds no `tabindex`: give targets one (or a roving tabindex) when
keyboard users need them.

Plot chart tooltips are auto-styled by wonk.css — never restyle per chart.

## Live & loading

```html
<span class="wonk-dot wonk-dot--live" data-wonk-live></span>  <!-- irregular jitter -->
<span class="wonk-dot wonk-dot--idle"></span>
<span class="wonk-spectrum"><span></span>…12 spans…</span>    <!-- loader -->
<div class="wonk-skeleton" style="height:14px"></div>
<div class="wonk-empty">
  <div class="glyph" data-wonk-glyph>∿</div>
  <h4>Nothing here yet.</h4><p>That's ok with me.</p>
</div>
```

The irregular jitter belongs ONLY on live/loading states. Everything else
moves smoothly.

## Exotic

group related parameters in one instrument area per view. read
[instruments.md](instruments.md) for production control contracts. VU and scope
helpers below generate decorative data; never present them as measured telemetry.

```html
<div data-wonk-vu="14"></div>
<!-- animated VU meter. Drive with real data: el.wonkVu.set([0..100, …]) -->

<div data-wonk-knob data-label="drive" data-min="0" data-max="11" data-value="7"></div>
<!-- precision knob: drag, keys, exact entry; input previews, change commits draft -->

<div data-wonk-scope></div>
<!-- animated oscilloscope trace; brand corners and loading walls -->
```

All three respect `prefers-reduced-motion` (static frame, no animation),
including a change mid-session: running loops stop when it turns on and
resume when it turns off.

## JS API

| Call | What it does |
|---|---|
| `wonk.init(scope?)` | wire all `data-wonk-*` + tabs + menus + reveal + hint `tabindex` in injected DOM; idempotent per element |
| `wonk.toast(msg, kind?, ms?)` | show a toast (ok/warn/err/info); returns the toast element |
| `wonk.glossary(map?)` | merge term definitions for `data-term`; returns the current map |
| `wonk.tip(root, selector, render)` | rich hint for matches inside `root`; `render(el)` returns a Node or a string (shown as text); returns `{destroy}` |
| `wonk.hint.show(el)` / `wonk.hint.hide()` | show `el`'s hint now (returns `false` if it has none) / hide the box |
| `wonk.spark(el, values, {w,h,stroke,dot}?)` | inline sparkline; drops missing values, `[]` empties `el`, one value draws a dot |
| `wonk.setPair(name)` / `wonk.setTheme("paper"\|"dark")` | switch pair / theme |
| `wonk.live(el)` | irregular live jitter (`[data-wonk-live]`) |
| `wonk.glyph(el)` | glyph morph (`[data-wonk-glyph]`) |
| `wonk.scatter(el)` | hover type scatter (`[data-wonk-scatter]`) |
| `wonk.tabs(root)` | wire one `.wonk-tabs` (ARIA + keyboard) |
| `wonk.menu(details)` | wire one `.wonk-menu` (close on choose, Escape, edge flip) |
| `wonk.vu(el)`, `wonk.knob(el)`, `wonk.scope(el)` | wire an exotic widget manually |
| `wonk.reveal(scope?)` | arm scroll reveals not yet armed |

every wiring call is idempotent per element: a second call on the same
element does nothing (`vu` and `knob` return the existing handle).

After a `setPair`/`setTheme`, re-render charts and any canvas widgets; token
reads inside wonk.js utilities are already live.
