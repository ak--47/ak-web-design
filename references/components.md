# WONK component catalog

Copy-paste markup for every component in `assets/wonk.css` / `assets/wonk.js`.
The demo page (`demo/index.html`) shows all of them live. The root needs
`class="wonk"` and a `data-pair`; wonk.js auto-wires every `data-wonk-*`
attribute, `.wonk-tabs`, and `.wonk-menu` on DOMContentLoaded. for injected
DOM call `wonk.init(scope)`: it is idempotent per element, so calling it again
on the same subtree after a render is safe (already-wired elements are
skipped). wonk.js loads with `defer`, so any inline script that calls `wonk.*`
must wait for `DOMContentLoaded`.

to start a new app, copy [`templates/app.html`](../templates/app.html): the
shell, drawer, theme toggle, stats with drills, a records table, a chart,
state recipes, and the radio dock, with no inline styles and labeled fixtures.

## specialized packs

| pack | catalog | gallery |
|---|---|---|
| precision knob, fader, bounded window, segmented selector, stepper | [instruments.md](instruments.md) | `demo/instruments.html` |
| source channels, query toolbar, applied filters, records table (`wonkData.table`), drill-down dialog (`wonkData.drill`), inspector, jobs, result states | [data-tools.md](data-tools.md) | `demo/workbench.html`, `demo/index.html#drill` |
| eight state-change effects, cancellation, live reduced-motion handling | [motion.md](motion.md) | `demo/motion.html` |
| shuffle radio player and dock on a public GCS bucket (`data-wonk-radio`, `wonkRadio`) | [radio.md](radio.md) | `demo/radio.html` |

load each optional pack after the base assets. `wonkControls.init(scope)` wires
instruments, including the scope itself. `wonkMotion.play(el, name)` plays one
explicit effect. `wonkData.table()` and `wonkData.drill()` (`wonk-data.js`) wire
records tables and drill-downs; the other data layouts are CSS compositions whose
application behavior lives in the workbench example.

## Contents

1. [Typography](#typography) · 2. [Layout & dividers](#layout--dividers) ·
3. [Buttons](#buttons) · 4. [Forms](#forms) · 5. [Navigation](#navigation) ·
6. [Data display](#data-display) · 7. [Feedback & overlays](#feedback--overlays) ·
8. [Disclosure](#disclosure) · 9. [Live & loading](#live--loading) · 10. [Exotic](#exotic) ·
11. [JS API](#js-api)

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

the element defaults (`h1`-`h4`, `p`, `small`, `a`) weigh as a bare element
(`:where(.wonk) p`, specificity 0,0,1). any class on the element wins, a
WONK component's or a utility's (`.text-sm`, `.m-0`), and an app element
rule loaded after `wonk.css` wins by order.

## Layout & dividers

```html
<div class="wonk-shell">                         <!-- sidebar app frame -->
  <nav class="wonk-side" id="app-nav" aria-label="Main">
    <div class="brand">WONK</div>
    <a class="wonk-navlink active" href="#" aria-current="page">Overview</a>
    <a class="wonk-navlink" href="#">Logs</a>
  </nav>
  <div>
    <header class="wonk-topbar">
      <div class="wonk-row">
        <!-- shows below 800px; opens the side as a drawer -->
        <button type="button" class="wonk-btn wonk-drawer-btn" data-wonk-drawer
                aria-controls="app-nav" aria-expanded="false">Menu</button>
        <div class="wonk-title" role="heading" aria-level="1">Overview</div>
      </div>
      <button type="button" class="wonk-btn" data-wonk-theme-toggle>Paper</button>
    </header>
    <main class="wonk-main">                     <!-- page padding, centered 80rem column -->
      <section class="wonk-section">…</section>  <!-- bottom space, anchor offset, s4 between children -->
    </main>
  </div>
</div>

<div class="wonk-row">…</div>                    <!-- wrapping row of controls, s3 gap -->
<div class="wonk-grid">…</div>                   <!-- auto-fit cards; style="--wonk-grid-min: 320px" to change the 260px minimum -->
<h2 class="wonk-sr">Summary</h2>                 <!-- visually hidden, still read by screen readers -->

<section class="wonk-reveal">…</section>        <!-- fades + slides in on scroll -->

<hr class="wonk-divider">                        <!-- square wave: between CHAPTERS -->
<hr class="wonk-divider wonk-divider--accent">   <!-- accent-colored wave -->
<hr class="wonk-divider wonk-divider--live">     <!-- scrolling wave: live/loading states only -->
<hr class="wonk-rule">                           <!-- hairline: within a chapter -->
<div class="wonk-stack">…</div>                  <!-- children joined by vertical hairlines -->
```

`.wonk-reveal` hides only once wonk.js arms it (`.is-armed`, right before it
starts watching the element), then shows it (`.is-in`) as it scrolls into
view. a no-JS page, or an element wonk.js never saw, stays visible. sections
injected after load are armed automatically (one page-wide
`MutationObserver`), no `wonk.reveal()` call needed. reduced motion shows
them at once.

drawer: below 800px `.wonk-shell` is one column and `.wonk-side` is an
off-canvas panel. wonk.js wires every `[data-wonk-drawer]` button whose
`aria-controls` names the side: a click toggles it and `aria-expanded`; a
link click inside it, Escape, and a click outside it close it, and Escape
returns focus to the button. the closed drawer is `inert`, so Tab never
lands on a hidden link. crossing 800px resets it to closed. above 800px the
button is hidden and the side is a normal column. a missing `aria-controls`
target warns and does nothing.

### theme

```html
<!-- in <head>, above the stylesheets: a saved paper theme never flashes dark -->
<script>try{var t=localStorage.getItem("wonk-theme");if(t==="paper"||(!t&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.setAttribute("data-theme","paper")}catch(e){}</script>

<button type="button" class="wonk-btn" data-wonk-theme-toggle>Paper</button>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    wonk.theme.init();                           // saved theme, else prefers-color-scheme
    document.addEventListener("wonk:themechange", (e) => {
      console.log(e.detail.theme, e.detail.pair); // "dark" | "paper", "metathesis" | …
    });
  });
</script>
```

- `wonk.theme.init({key = "wonk-theme"})` applies the stored theme, else
  paper when `prefers-color-scheme` is light, else dark, and returns it.
  init stores nothing. after it, every `setTheme` stores the choice under
  `key`. the snippet reads the same key.
- `wonk.setTheme("dark" | "paper" | "light")`: `"light"` is an alias and
  applies `data-theme="paper"`. `wonk.setPair(name)` takes metathesis,
  glorpla, demogorgon, ancient, or flourish. both throw on any other name,
  and both fire `wonk:themechange` on `document` with
  `{detail: {theme, pair}}`.
- a `[data-wonk-theme-toggle]` button flips dark and paper. it reads `Paper`
  in dark and `Dark` in paper; `aria-pressed` is `true` in paper.
- `data-theme="light"` written by hand styles exactly like paper.

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
a click or key that selects another tab fires a bubbling `wonk:tabchange` on
the tablist with `detail: { tab, panel }`, so the app knows the active tab
after keyboard selection too. wonk.js owns the arrow keys: an app arrow-key
handler on the tabs double-steps.

## Data display

```html
<div class="wonk-card">…</div>                   <!-- --accent: a1 top bar; --flat: no fill -->

<div class="wonk-stat">
  <span class="wonk-label">events / sec</span>
  <span class="wonk-num">48,112</span>
  <small class="delta--good">▲ 12%</small>        <!-- delta--good / delta--bad / delta--neutral -->
</div>

<!-- a stat that opens its records: the whole tile is the button -->
<div class="wonk-card">
  <button type="button" class="wonk-stat" data-wonk-drill="open-deals">
    <span class="wonk-label">open deals</span>
    <span class="wonk-num">12</span>
  </button>
</div>

<!-- an inline number or record id that opens something; keeps its case -->
<button type="button" class="wonk-value-link">evt-004</button>

<span class="wonk-badge">default</span>          <!-- --ok --warn --err --info --accent -->

<table class="wonk-table">                       <!-- a th[data-tip] gets the dotted term underline -->
  <thead><tr><th>service</th><th class="num">req/s</th></tr></thead>
  <tbody><tr><td>ingest-api</td><td class="num">18,204</td></tr></tbody>
</table>

<dl class="wonk-kv">                             <!-- under 640px each term stacks over its value -->
  <dt>version</dt><dd>v2.4.1</dd>
</dl>

<pre class="wonk-pre"><code>…</code></pre>       <!-- spans: tok-key tok-str tok-com -->

<div class="wonk-log">                           <!-- spans: ts, msg, lv-ok/lv-warn/lv-err -->
  <div><span class="ts">04:31:17</span> <span class="lv-ok">OK</span> <span class="msg">…</span></div>
</div>
```

Charts: see [charts.md](charts.md). Sparklines: `wonk.spark(el, values)`.

### deltas

the arrow carries the direction. the color carries the sentiment: a rise in
errors or latency is bad, so it is red. color is never the only signal.

| class | color | use |
|---|---|---|
| `.delta--good` | `--ak-ok` | the change is good for the reader |
| `.delta--bad` | `--ak-err` | the change is bad for the reader |
| `.delta--neutral` | `--ak-ink-2` | no change, or unknown |

the classes work on any element, not only in `.wonk-stat`. `.delta-up` and
`.delta-down` still color by direction inside `.wonk-stat`; they are legacy, so
use the sentiment classes in new code. `wonk.fmt.delta()` returns both the text
and the class:

```js
const d = wonk.fmt.delta(0.12, { higherIsBetter: false }); // p95 latency rose 12%
el.textContent = `${d.text} vs last week`;                 // "▲ 12% vs last week"
el.className = d.className;                                // "delta--bad"
```

### drillable values

- `button.wonk-stat`, or `.wonk-stat--drill` on another element: the tile has
  no button chrome, keeps left-aligned text, and fills its cell. its
  `.wonk-num` gets a dotted underline and turns `--ak-a1-text` on hover.
  `class="wonk-card wonk-stat"` on the button makes the tile the card itself:
  it keeps the card's padding, border, and fill (and `--accent`/`--flat`).
- `.wonk-value-link` on a `button` or `a`: mono, tabular numbers, original
  case, `--ak-a1-text`, dotted underline. use it for a clickable number or
  record id. never put an id in `.wonk-btn--quiet`: buttons are uppercase.
- open the records with `wonkData.drill()` or `data-wonk-drill`:
  [data-tools.md § drill-down](data-tools.md#drill-down).

### formatting: wonk.fmt

every helper returns a string. `null`, `undefined`, `""`, and `NaN` return `—`
(unknown, not zero). `wonk.fmt.locale` (default `"en-US"`) sets the number
locale. dates are always `YYYY-MM-DD`.

| call | example → result |
|---|---|
| `num(n, {digits=0})` | `1234.5` → `"1,235"` |
| `compact(n, {digits})` | `1234` → `"1.2K"`, `971100` → `"971K"`, `2500000` → `"2.5M"`, `950` → `"950"` |
| `money(n, {currency="USD", compact=false, digits})` | `1234.5` → `"$1,235"`; `{compact:true}` `971100` → `"$971K"`, `1234567` → `"$1.2M"`, `12345678` → `"$12M"` |
| `pct(ratio, {digits=0})` | `0.123` → `"12%"`; `{digits:1}` → `"12.3%"` |
| `duration(ms)` | `450` → `"450 ms"`, `1200` → `"1.2 s"`, `200000` → `"3m 20s"`, `5400000` → `"1h 30m"` |
| `date(value, {tz="UTC", time=false})` | `"2026-09-24T15:04:00Z"` → `"2026-09-24"`; `{time:true}` → `"2026-09-24 15:04 UTC"` |
| `delta(change, {higherIsBetter=true, format="pct"})` | `0.12` → `{text:"▲ 12%", direction:"up", sentiment:"good", className:"delta--good"}`; `{higherIsBetter:false}` → `sentiment:"bad"`, `className:"delta--bad"`; `0` → `"— 0%"`, `"flat"`, `"neutral"` |

compact output without `digits` rounds the standard Intl way: at most two
significant digits, and never fewer digits than the whole number (`$971K`,
not `$970K`; `$1.5K`, `$46K`). `digits` sets the most decimals instead
(`{compact:true, digits:1}` `971100` → `"$971.1K"`). non-compact `money`
defaults to 0 decimals.

`delta`'s `format` is `"pct"`, `"num"`, `"money"`, or a function that gets the
absolute change. `digits` and `currency` pass through. a change that formats as
zero is flat.

## Feedback & overlays

```html
<div class="wonk-alert wonk-alert--warn">        <!-- default=info; --ok --warn --err -->
  <span class="ico">△</span>
  <span><strong>Degrading.</strong> p95 doubled since 09:00.</span>
</div>

<div class="wonk-acc">                           <!-- accordion list: native details -->
  <details><summary>Question</summary><div class="body">Answer.</div></details>
</div>
<details class="wonk-acc">                       <!-- single accordion item -->
  <summary>Question</summary><div class="body">Answer.</div>
</details>

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

- hover shows after 50ms. keyboard focus (`:focus-visible`) and tap show at
  once. a mouse click that focuses a checkbox or button shows no box of its
  own: the hover box covers it, and it hides when the pointer leaves. a text
  field matches `:focus-visible` on a click, so its box shows and stays while
  you type. the pointer can move onto the box. a scroll closes it (a focus hint follows
  its control).
- the box sits below its target. when it would cover another control there
  (the next checkbox row, a button), it goes above, then right, then left:
  the first side that fits and covers nothing clickable. when every side
  covers one, it stays below.
- Escape closes the box. when the box shows the focused element's hint, that
  Escape stops there: an open dialog or menu stays open, and a second Escape
  reaches it. a hover or tap hint on anything else closes, and the same
  Escape goes on to the app.
- every focus (mouse too) appends `wonk-hint-sr` to the control's
  `aria-describedby` and keeps the page's own tokens. blur removes only that
  token.
- `wonk.init(scope)`, and nodes injected later, give `.wonk-term` and
  non-focusable `[data-tip]` elements `tabindex="0"`, except inside an
  interactive element, inside a `tbody` (per-row repeats rely on their column
  header's hint), inside `aria-hidden="true"` content (one arrives once
  `aria-hidden` comes off), and a `.wonk-term` with no hint of its own inside
  a control's `<label>` (the control's focus shows the label's hint). opt out
  with `data-tip-focus="off"`.
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

where a hint may go:

- **one hint per thing, defined once.** a hint that repeats on every item
  (ten result cards with four hinted badges each) is forty tab stops. outside
  a `tbody`, give repeats `data-tip-focus="off"` and define the term once: in
  a column header, a fold, or one `.wonk-term` above the list.
- **a `data-tip` covers its whole subtree.** a hint on a `fieldset` or a
  `section` shows for every child that has none of its own. a child with its
  own tooltip (an app's React tooltip) then opens two boxes at once. put the
  hint on the element it explains.
- **dense control rows** (checkbox lists with a few px between rows): put one
  `.wonk-hint-btn` beside the group, not a hint on every label.
- **disabled controls never take focus**, so their hint never reaches
  `aria-describedby`. say why a control is disabled as visible text, or point
  its `aria-describedby` at a `.wonk-sr` node with the reason.
- **a native `<option>` cannot hold a hint.** put the detail in the option's
  text ("Last 6 months · 2026-05-01 to 2026-10-31"), or show the selected
  option's detail as visible text beside the field, or update the field's
  `.wonk-hint-btn` `data-tip` on `change`. `title=` on an `<option>` shows
  only on some desktop browsers, never on touch or to the keyboard: use it
  only as an extra, never as the only place the detail lives.
- **`data-tip` is display text.** wonk.js shows every `data-tip` and
  `data-hint` value. never use either as a lookup key for app code, and
  remove an app's own `data-hint` tooltip handler, or both boxes open.

Plot chart tooltips are auto-styled by wonk.css — never restyle per chart.

## Disclosure

headline first, detail behind a fold. which one to use, and the copy rules:
[hierarchy.md](hierarchy.md).

```html
<!-- prose: an inline "How this works" unfold -->
<details class="wonk-fold">
  <summary>How this works</summary>
  <div class="body"><p>Open pipeline is the sum of every open deal…</p></div>
</details>

<!-- a record: the summary keeps the headline and key facts -->
<details class="wonk-card wonk-card--fold" data-fold-key="deal-123">
  <summary>
    <span class="headline">Acme renewal · $820k</span>
    <span class="facts">AE Dana · CE Lee · closes Oct 31</span>
  </summary>
  <div class="body">…</div>
</details>

<!-- an expandable table row: wonk.js flips aria-expanded and hidden -->
<tr>
  <td><button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="r1-detail">Security review</button></td>
  <td class="num">12</td>
</tr>
<tr class="wonk-row-detail" id="r1-detail" hidden><td colspan="2">…</td></tr>

<!-- a truncated list: CSS only, the app owns the list -->
<p class="wonk-more">Showing <span class="wonk-num">20</span> of <span class="wonk-num">143</span> <button type="button" class="wonk-btn wonk-btn--quiet">Show all</button></p>

<!-- unfold all / fold all, in the section header -->
<div class="wonk-fold-all" role="group" aria-label="Fold controls">
  <button type="button" class="wonk-btn wonk-btn--quiet" data-wonk-fold-all="open" data-target="#deals">Unfold all</button>
  <button type="button" class="wonk-btn wonk-btn--quiet" data-wonk-fold-all="close" data-target="#deals">Fold all</button>
</div>
```

- no wiring. wonk.js listens on the document, so rows and buttons rendered
  later work at once. Enter and Space work because the toggles are buttons.
- a row toggle whose `aria-controls` target is missing warns once in the
  console and does nothing.
- a fold-all button folds its `data-target`. with no `data-target` it folds
  its closest `section`, `article`, or `[data-fold-scope]`. a `data-target`
  that matches nothing warns and does nothing.
- `wonk.foldAll(root, open)` sets every `<details>` (all depths) and every
  row toggle in `root`. it skips `.wonk-menu` popups.
  `wonk.foldAll(root, open, { nested: false })` sets only the outermost ones,
  those not inside another `<details>` or row detail within `root`: "Unfold
  all areas" opens the area rows and leaves the deal cards inside them closed.
- a row toggle that changes (a click, `foldAll`, a restored key) fires a
  bubbling `wonk:fold` at once, and a keyed `<details>` fires one after its
  native `toggle`. `detail: { el, key, open }` (`key` is `null` on an unkeyed
  row toggle). use it to keep open state in the URL. an unkeyed `<details>`
  has only the native `toggle` event (it does not bubble: listen in the
  capture phase).
- `data-fold-key` on a `<details>` or a row toggle keeps its open state
  across re-renders, in memory only (`wonk.foldState`, a `Map`). a keyed
  element inserted later, or passed through `wonk.init(scope)`, gets its
  state back. `wonk.foldState.clear()` forgets every key.

## Live & loading

```html
<span class="wonk-dot wonk-dot--live" data-wonk-live></span>  <!-- irregular jitter -->
<span class="wonk-dot wonk-dot--idle"></span>
<span class="wonk-spectrum"><span></span>…12 spans…</span>    <!-- loader -->
<hr class="wonk-divider wonk-divider--live">          <!-- scrolling square wave: a stream is open -->
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
| `wonk.init(scope?)` | wire all `data-wonk-*` + tabs + menus + reveal + hint `tabindex`, and restore `data-fold-key` states, in injected DOM; idempotent per element |
| `wonk.toast(msg, kind?, ms?)` | show a toast (ok/warn/err/info); returns the toast element |
| `wonk.glossary(map?)` | merge term definitions for `data-term`; returns the current map |
| `wonk.tip(root, selector, render)` | rich hint for matches inside `root`; `render(el)` returns a Node or a string (shown as text); returns `{destroy}` |
| `wonk.hint.show(el)` / `wonk.hint.hide()` | show `el`'s hint now (returns `false` if it has none) / hide the box |
| `wonk.foldAll(root, open, {nested}?)` | open (`true`) or close (`false`) every `<details>` and `.wonk-row-toggle` in `root`, `.wonk-menu` excluded; `nested: false` only the outermost; returns how many changed; changes fire `wonk:fold` |
| `wonk.foldState` | the `Map` of remembered `data-fold-key` -> open states; `.clear()` forgets them |
| `wonk.spark(el, values, {w,h,stroke,dot}?)` | inline sparkline; drops missing values, `[]` empties `el`, one value draws a dot |
| `wonk.fmt.num` / `.compact` / `.money` / `.pct` / `.duration` / `.date` / `.delta` | format numbers, dates, and deltas as strings; unknown input returns `—`; [formatting](#formatting-wonkfmt) |
| `wonk.setPair(name)` / `wonk.setTheme("dark"\|"paper"\|"light")` | switch pair / theme; throw on an unknown name; fire `wonk:themechange` |
| `wonk.theme.init({key}?)` | apply the saved theme (else `prefers-color-scheme`) and save later `setTheme` calls; returns the theme; [theme](#theme) |
| `wonk.drawer(button)` | wire one `[data-wonk-drawer]` button (init does this) |
| `wonk.live(el)` | irregular live jitter (`[data-wonk-live]`) |
| `wonk.glyph(el)` | glyph morph (`[data-wonk-glyph]`) |
| `wonk.scatter(el)` | hover type scatter (`[data-wonk-scatter]`) |
| `wonk.tabs(root)` | wire one `.wonk-tabs` (ARIA + keyboard); a new selection fires `wonk:tabchange` |
| `wonk.menu(details)` | wire one `.wonk-menu` (close on choose, Escape, edge flip) |
| `wonk.vu(el)`, `wonk.knob(el)`, `wonk.scope(el)` | wire an exotic widget manually |
| `wonk.reveal(scope?)` | arm scroll reveals not yet armed |

every wiring call is idempotent per element: a second call on the same
element does nothing (`vu` and `knob` return the existing handle).

After a `setPair`/`setTheme`, re-render your own canvas or svg drawings on
`wonk:themechange`. `wonkCharts.plot` charts re-render by themselves, and
token reads inside wonk.js utilities are already live.
