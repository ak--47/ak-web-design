# WONK code pack: syntax highlighting + JSON editor

`assets/wonk-code.css` + `assets/wonk-code.js`. Real syntax highlighting for
`.wonk-pre > code` blocks and a labeled JSON editor (`.wonk-json-editor`).
Built on Prism 1.29.0, vendored locally (MIT), no custom tokenizer — all
highlighting goes through `Prism.highlight()`. Requires `wonk-tokens.css` +
`wonk.css` already loaded. Live gallery: `demo/index.html#code`.

## vendor: Prism 1.29.0, vendored, MIT

`assets/vendor/prism/` holds the pinned `prismjs@1.29.0` files, committed so
the app works offline, plus `LICENSE` (MIT, Copyright Lea Verou) — keep it
alongside the scripts.

| file | grammar(s) |
|---|---|
| `prism-core.min.js` | core engine, mandatory, load first |
| `prism-markup.min.js` | `markup` (`html`, `xml`, `svg`) |
| `prism-css.min.js` | `css`; needs markup loaded first |
| `prism-clike.min.js` | `clike`, base for `javascript` |
| `prism-javascript.min.js` | `javascript` (`js`); needs `clike` |
| `prism-json.min.js` | `json` (`webmanifest`) |
| `prism-sql.min.js` | `sql` |
| `prism-bash.min.js` | `bash` (`sh`, `shell`) |

To bump the version: redownload all 8 files + `LICENSE` from
`https://cdn.jsdelivr.net/npm/prismjs@<version>/components/prism-<name>.min.js`,
update this table and `wonkCode.PRISM_VERSION`, rerun `wonkCodeChecks.run()`.

## load order

```html
<link rel="stylesheet" href="../assets/wonk-tokens.css">
<link rel="stylesheet" href="../assets/wonk.css">
<link rel="stylesheet" href="../assets/wonk-code.css">
<script src="../assets/vendor/prism/prism-core.min.js"></script>
<script src="../assets/vendor/prism/prism-markup.min.js"></script>
<script src="../assets/vendor/prism/prism-css.min.js"></script>
<script src="../assets/vendor/prism/prism-clike.min.js"></script>
<script src="../assets/vendor/prism/prism-javascript.min.js"></script>
<script src="../assets/vendor/prism/prism-json.min.js"></script>
<script src="../assets/vendor/prism/prism-sql.min.js"></script>
<script src="../assets/vendor/prism/prism-bash.min.js"></script>
<script src="../assets/wonk.js"></script>
<script src="../assets/wonk-code.js"></script>
```

Each grammar file extends the previous one's `Prism.languages` entry, so
markup/clike must load before css/javascript. A block whose language never
got registered degrades to plain, visibly-flagged text — load only what
you need. Supported: `markup`/`html`/`xml`/`svg`, `css`, `clike`,
`javascript`/`js`, `json`, `sql`, `bash`/`sh`/`shell`
(`wonkCode.SUPPORTED_LANGUAGES`). Anything else is a visible, logged error.

## JS API (`window.wonkCode`)

- **`highlight(el, language?)`** — tokenizes `el` from its own live
  `textContent` (never cached; call again after changing the text).
  `language` defaults to `el.dataset.language`, then `"json"`. Returns
  `{ok, skipped?, reason?}`: `{ok:true}` on success; `{ok:true,
  skipped:"size-limit"}` over `MAX_HIGHLIGHT_CHARS`, left as plain safe
  text; `{ok:false, reason:"vendor-unavailable"|"unsupported-language"|"highlight-error"}`
  — plain source stays visible, `el.dataset.wonkCodeError` set,
  `console.error` logged, bubbling `wonk-code:error` fired. Throws
  `TypeError` only for a non-Element `el`.
- **`render(el, value, language='json')`** — a string `value` is used
  verbatim; anything else goes through `JSON.stringify(value, null, 2)`.
  Throws `TypeError` if `value` can't be serialized (`undefined` at the
  top level, or circular) — never silently writes the literal
  `"undefined"`. `el` may be a `<code>`, a `<pre>` (a `<code>` child is
  created, replacing any stray existing content), or any other container
  (a `.wonk-pre > code` pair is created inside it once). Always uses
  `textContent` for the source, never `innerHTML`. This is the shared
  integration point other WONK surfaces use instead of hand-building
  `<pre><code>` + `JSON.stringify` — `demo/catalog.js`'s workbench record
  inspector already calls `wonkCode.render(payloadEl, row, "json")`.
- **`init(scope=document)`** — wires `pre code[data-language]` and
  `.wonk-json-editor` inside `scope` (and `scope` itself). Idempotent: an
  already-wired block or editor is never re-processed. A malformed editor
  logs an error without stopping the rest of `scope` from wiring. Runs
  once on `DOMContentLoaded`; call again after injecting new markup.
- **`destroy(scope=document)`** — tears down every `.wonk-json-editor` in
  `scope` (and `scope` itself): removes listeners, clears its handle.
- **`jsonEditor(el)`** — wires one editor directly; idempotent per
  element. Throws a descriptive `Error` (never returns `null`) if `el` is
  missing its `<textarea>` or Format button. Returns `{format(), value,
  destroy()}`.
- **`vendorReady()`** — `true` if `window.Prism` is present and working.
- **`SUPPORTED_LANGUAGES`, `MAX_HIGHLIGHT_CHARS`, `MAX_FORMAT_CHARS`,
  `PRISM_VERSION`** — frozen/read-only contract values.

## size limits: main-thread work

`Prism.highlight()` and `JSON.parse`/`JSON.stringify` all run synchronously,
no worker. Two independent 200,000-character bounds: `MAX_HIGHLIGHT_CHARS`
gates `highlight()` (skips tokenizing, shows plain safe text past it);
`MAX_FORMAT_CHARS` gates the editor's `format()`, checked against the raw
draft **before** `JSON.parse` runs, so an oversized paste never pays for a
parse-and-restringify either — it shows a visible error naming the limit
and leaves the draft untouched. Raise either only after measuring real
block sizes and frame budget.

## JSON round-trip: integers, keys, precision

`format()` goes through `JSON.parse` then `JSON.stringify(v, null, 2)` —
plain JS objects, not a format-preserving parse. **Numbers beyond
`Number.MAX_SAFE_INTEGER` (2^53-1) lose precision as a real double
rounding**: `9007199254740993` round-trips to `9007199254740992`. Keep
large IDs, snowflake IDs, or monetary minor units as JSON **strings** if
exact round-trip matters. Duplicate object keys collapse to the last one
(native `JSON.parse` behavior). **Caution, key order:** integer-like keys
(`"0"`, `"1"`, `"42"`) get reordered ascending, ahead of every other key,
regardless of where they appeared in the source — this is the JS
object-key spec, not this pack. Non-numeric keys keep their original
insertion order. Example: `{"b":1,"2":2,"a":3,"1":4}` formats to
`{"1":4,"2":2,"b":1,"a":3}`. Don't rely on ordering for numeric-looking
keys in a plain object. This pack does not implement a custom,
format-preserving parser to work around any of this.

## markup contract

```html
<pre class="wonk-pre"><code data-language="json">{"event": "purchase"}</code></pre>
```

`.wonk-pre` (`wonk.css`) supplies font, background, border, padding;
`wonk-code.css` adds token colors and line-height on top. `data-language`
selects the grammar. `render(el, value, language)` defaults `language` to
`"json"` when omitted. `init()` does **not** apply that default: it only
wires elements matching `pre code[data-language]`, so a block with no
`data-language` attribute is invisible to `init()` and never gets
auto-highlighted — call `wonkCode.highlight(el, language)` on it directly
instead.

```html
<div class="wonk-json-editor">
  <div class="wonk-json-editor-row">
    <div class="wonk-field">
      <label class="wonk-label" for="my-editor-input">draft JSON</label>
      <textarea id="my-editor-input" class="wonk-textarea" spellcheck="false">{"a": 1}</textarea>
    </div>
    <div class="wonk-json-editor-preview"><div class="wonk-label">preview</div></div>
  </div>
  <div class="wonk-json-editor-actions">
    <button type="button" class="wonk-json-editor-format wonk-btn wonk-btn--primary">Format JSON</button>
  </div>
  <div class="wonk-json-editor-error" role="alert" hidden></div>
</div>
```

Required: one `<textarea>`, one Format button (`.wonk-json-editor-format`
or `[data-wonk-json-format]`) — a button with no `type` is forced to
`type="button"` so it never submits an enclosing form. Preview and error
nodes are auto-created if omitted; the error node always ends up with
`role="alert"`. Label the textarea yourself with a real `<label for>`.
Native `disabled` on the textarea, the button, or an ancestor `<fieldset>`
blocks formatting like any other native control.

**Behavior:** valid JSON pretty-prints to 2-space indent, clears the error,
marks the preview `fresh`. Invalid JSON shows the parser's message in the
alert region, sets `aria-invalid="true"` on the textarea, and leaves the
draft untouched. Typing after either outcome clears `aria-invalid`
immediately. Once a preview has rendered, editing the draft or a failed
reformat sets `data-wonk-json-preview-state="stale"` on the preview host,
labeled visibly by CSS — never left implying it matches a draft it no
longer reflects. No `eval`, ever — parsing is `JSON.parse` only, rendering
is `textContent` + `Prism.highlight()` only. No auto-fetch: every value
comes from markup already present or an explicit call.

## browser checks

`demo/code-checks.js`, not auto-loaded. On a page with the full vendor +
`wonk-code.js` load order:

```js
await wonkCodeChecks.run();
```

Covers every supported grammar; hostile markup and JSON-embedded hostile
strings never executing; dynamic rehighlight; `init`/`destroy`
idempotency; malformed-editor markup throwing a descriptive error;
`aria-invalid` set/cleared; an auto-created `role="alert"` node;
stale-preview labeling; the Format button's forced `type="button"`;
disabled textarea/button/fieldset blocking `format()`; the
`MAX_FORMAT_CHARS` guard firing before `JSON.parse`; oversized
`highlight()` input staying safe; a missing Prism vendor and an
unsupported language both producing a visible, logged error. Every check
builds and tears down its own hidden fixture; nothing touches the network
or a host page's own markup.
