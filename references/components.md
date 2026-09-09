# WONK component catalog

Copy-paste markup for every component in `assets/wonk.css` / `assets/wonk.js`.
The demo page (`demo/index.html`) shows all of them live. The root needs
`class="wonk"` and a `data-pair`; wonk.js auto-wires every `data-wonk-*`
attribute on DOMContentLoaded (call `wonk.init(scope)` for injected DOM).

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

<hr class="wonk-divider">                        <!-- square wave: between CHAPTERS -->
<hr class="wonk-divider wonk-divider--accent">   <!-- accent-colored wave -->
<hr class="wonk-rule">                           <!-- hairline: within a chapter -->
<div class="wonk-stack">…</div>                  <!-- children joined by vertical hairlines -->
```

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

<details class="wonk-menu">                      <!-- dropdown, zero JS -->
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

<span class="wonk-tip" data-tip="mono, inverted">hover target</span>

<!-- toasts are JS-only: -->
<script>wonk.toast("Deployed", "ok")</script>    <!-- ok | warn | err | info -->
```

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

All three respect `prefers-reduced-motion` (static frame, no animation).

## JS API

| Call | What it does |
|---|---|
| `wonk.init(scope?)` | wire all `data-wonk-*` + tabs + reveal in injected DOM |
| `wonk.toast(msg, kind?, ms?)` | show a toast (ok/warn/err/info) |
| `wonk.spark(el, values, {w,h,stroke,dot}?)` | inline sparkline |
| `wonk.setPair(name)` / `wonk.setTheme("paper"\|"dark")` | switch pair / theme |
| `wonk.vu(el)`, `wonk.knob(el)`, `wonk.scope(el)` | wire an exotic widget manually |
| `wonk.reveal(scope?)` | re-arm scroll reveals |

After a `setPair`/`setTheme`, re-render charts and any canvas widgets; token
reads inside wonk.js utilities are already live.
