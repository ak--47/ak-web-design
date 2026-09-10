# ak-web-design · WONK

AK's personal design skill. dark and paper themes, five poster pairs, calibrated
instrument controls, syntax highlighting, and data-tool layouts. lives in
`~/.agents/skills/ak-web-design`. this file is the full usage doc; `SKILL.md`
is the short version agents read first and links back here.

live demo: **[ak--47.github.io/ak-web-design](https://ak--47.github.io/ak-web-design/)**
(deploys from `main` via [.github/workflows/pages.yml](.github/workflows/pages.yml)).

## open a working example

visit the live demo above, or serve this directory locally and open
`/demo/index.html`.

```sh
python3 -m http.server 4748 --bind 127.0.0.1
```

| gallery | what works |
|---|---|
| [base components](demo/index.html) | typography, poster pairs, forms, charts, code + json editor, overlays, decorative widgets |
| [instruments](demo/instruments.html) | precision knobs, fader, bounded window, segmented selector, stepper, lifecycle checks |
| [data workbench](demo/workbench.html) | source meters, draft query controls, applied filters, sorting, selection, JSON download, record inspector |
| [motion](demo/motion.html) | eight replayable state-change effects and browser checks |

all examples use labeled local fixtures. the workbench does not execute SQL or
call a backend. self-host fonts in production; these galleries load fonts from
Google, and the base gallery's chart section loads d3 and Observable Plot
from jsDelivr. Prism (syntax highlighting) is vendored locally, never a CDN.

## install

the base recipe is three files, no build step required.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/wonk-tokens.css">
<link rel="stylesheet" href="/wonk.css">
<script defer src="/wonk.js"></script>
```

load order matters: tokens before components, components before behaviors.
`wonk.js` reads `--ak-*` tokens at call time, not fonts, so the font link
can load in parallel with everything else. set the pair and class on the
root:

```html
<html data-pair="metathesis" class="wonk">
```

dark is the default. switch to paper with
`document.documentElement.setAttribute("data-theme", "paper")` and persist
the choice, `prefers-color-scheme: light` may pick paper as the initial
value. never ship a light mode that is plain white, both themes are real.

self-host both faces (Space Grotesk, IBM Plex Mono) in production: download
the woff2 files, `@font-face` them, drop the Google link. every face keeps
a real system fallback (`system-ui`, `ui-monospace`).

## optional packs

| pack | files | needs | reference |
|---|---|---|---|
| instruments | `wonk-controls.css`, `wonk-controls.js` | `wonk.css`, `wonk.js` | [instruments.md](references/instruments.md) |
| data tools | `wonk-data.css` | `wonk.css` | [data-tools.md](references/data-tools.md) |
| motion | `wonk-motion.css`, `wonk-motion.js` | `wonk-tokens.css` only | [motion.md](references/motion.md) |
| code + json editor | `wonk-code.css`, `wonk-code.js`, `assets/vendor/prism/*` | `wonk-tokens.css`, `wonk.css` | [code.md](references/code.md) |

none of the packs add a package dependency, plain script/link tags. load a
pack's css after the base css, its js after the base js. the data pack
ships css only, `demo/workbench.js` is example application logic, not a
reusable module. colors, radii, and motion durations stay in
`wonk-tokens.css`, read it before styling anything.

full load order with every pack (real apps drop what they don't use, css
before js within each pack, prism core before its grammar files):

```html
<link rel="stylesheet" href="assets/wonk-tokens.css">
<link rel="stylesheet" href="assets/wonk.css">
<link rel="stylesheet" href="assets/wonk-controls.css">
<link rel="stylesheet" href="assets/wonk-data.css">
<link rel="stylesheet" href="assets/wonk-motion.css">
<link rel="stylesheet" href="assets/wonk-code.css">
<script src="assets/vendor/prism/prism-core.min.js"></script>
<script src="assets/vendor/prism/prism-markup.min.js"></script>
<script src="assets/vendor/prism/prism-css.min.js"></script>
<script src="assets/vendor/prism/prism-clike.min.js"></script>
<script src="assets/vendor/prism/prism-javascript.min.js"></script>
<script src="assets/vendor/prism/prism-json.min.js"></script>
<script src="assets/vendor/prism/prism-sql.min.js"></script>
<script src="assets/vendor/prism/prism-bash.min.js"></script>
<script src="assets/wonk.js"></script>
<script src="assets/wonk-controls.js"></script>
<script src="assets/wonk-motion.js"></script>
<script src="assets/wonk-code.js"></script>
```

an unregistered grammar degrades to plain, visibly-flagged text instead of
failing quietly. each grammar file extends the previous one's registration,
so markup and clike must load before css and javascript.

## typography

| token | value | used for |
|---|---|---|
| `--ak-font-sans` | Space Grotesk, `system-ui` fallback | UI text, headings, nav, tabs |
| `--ak-font-mono` | IBM Plex Mono 400/500/600/700, `ui-monospace` fallback | data, code, numbers, labels |
| `--ak-text-xs` | 0.8rem (12.8px) | labels, badges, table headers |
| `--ak-text-sm` | 0.875rem (14px) | help text, small print, secondary numbers |
| `--ak-text-md` | 1rem | body |
| `--ak-track-label` | 0.06em, relative to the element's own font-size | `.wonk-label`, table headers, kv terms |
| `--ak-track-title` | 0.3rem | `.wonk-title` only |
| `--ak-track-btn` | 0.08rem | buttons |

rules:

- headings (`h1`-`h4`) are mixed-case Space Grotesk with tight tracking.
  navigation and tabs are mixed-case too, mono uppercase there reads as noise.
- uppercase + tracking is reserved for `.wonk-label` (mono, weight 500, color
  ink-2, tracked `--ak-track-label`) and `.wonk-title` (sans, tracked
  `--ak-track-title`, page titles only). don't put both treatments on the
  same element.
- numbers are always mono and tabular (`.wonk-num`, `font-variant-numeric:
  tabular-nums` where it applies).
- moving an older app onto this token set: see
  [migrating from jetbrains mono](#migrating-from-jetbrains-mono).

## color and pairs

dark is the default, ground `#0f1214`. paper is the light mode, warm bone
`#ece4d4` with ink text, the printed record to dark's stage. one poster pair
per app, set once at the root, never mixed:

```html
<html data-pair="metathesis" class="wonk">
```

five pairs exist: metathesis (default), glorpla, demogorgon, ancient,
flourish. never use a raw accent (`--ak-a1`, `--ak-a2`) as text, use the
`-text` variant instead, it is the one shifted to pass 4.5:1 on the ground.
choosing and tuning a pair, the semantic tokens, and the chart series: see
[references/pairs.md](references/pairs.md).

## geometry and motion

- 4px radius everywhere (`--ak-radius`), full circles for avatars and status
  dots (`--ak-radius-full`).
- 1px hairline borders (`--ak-hairline-w`), connective vertical hairlines
  between stacked blocks (`.wonk-stack`).
- the square-wave divider (`.wonk-divider`) separates sections, plain
  `.wonk-rule` when the wave would be noise within a section.
- motion is springy but purposeful: `--ak-ease`, durations 150/250/400ms
  (`--ak-t-fast`/`-med`/`-slow`).
- the irregular jitter (100-180ms bursts, then rest) is the signature. it
  lives ONLY on live/loading states (`data-wonk-live`, `.wonk-spectrum`).
  everything else moves smoothly. honor `prefers-reduced-motion`, including
  changes during the session.
- eight explicit one-shot effects (panel enter/exit, value changed, row
  inserted, filter applied, progress complete, trace draw, confirm check)
  live in the motion pack: [references/motion.md](references/motion.md).

## components

| family | key classes | gallery section | reference |
|---|---|---|---|
| typography | `.wonk-title`, `.wonk-label`, `.wonk-num`, `<kbd>` | `#type` | components.md |
| layout | `.wonk-shell`, `.wonk-divider`, `.wonk-rule`, `.wonk-stack` | `#chrome` | components.md |
| buttons | `.wonk-btn` + `--primary`/`--danger`/`--quiet` | `#buttons` | components.md |
| forms | `.wonk-field`, `.wonk-input`, `.wonk-select`, `.wonk-textarea`, `.wonk-check`, `.wonk-toggle`, `.wonk-range` | `#forms` | components.md |
| navigation | `.wonk-crumbs`, `.wonk-pages`, `.wonk-avatar`, `.wonk-menu`, `.wonk-tabs` | `#nav`, `#tabs` | components.md |
| data display | `.wonk-card`, `.wonk-stat`, `.wonk-badge`, `.wonk-table`, `.wonk-kv`, `.wonk-pre`, `.wonk-log` | `#cards`, `#table` | components.md |
| feedback | `.wonk-alert`, `.wonk-acc`, `.wonk-modal`, `.wonk-tip`, `wonk.toast()` | `#overlays` | components.md |
| live/loading | `.wonk-dot--live`, `.wonk-spectrum`, `.wonk-skeleton`, `.wonk-empty` | `#live` | components.md |
| exotic | VU meter, precision knob, oscilloscope | `#exotic` | components.md |
| instruments | knob, fader, bounded window, segmented selector, stepper | `demo/instruments.html` | instruments.md |
| data tools | channel bank, toolbar, filters, table, inspector, jobs | `demo/workbench.html` | data-tools.md |
| motion | eight one-shot effects | `demo/motion.html` | motion.md |
| code + json | syntax highlighting, JSON editor | `#code` | code.md |
| charts | Observable Plot theming, validated palettes | `#charts` | charts.md |

base JS API (`window.wonk`), full list in components.md:

| call | what it does |
|---|---|
| `wonk.init(scope?)` | wire all `data-wonk-*` + tabs + reveal in injected DOM |
| `wonk.toast(msg, kind?, ms?)` | show a toast (ok/warn/err/info) |
| `wonk.setPair(name)` / `wonk.setTheme("paper"\|"dark")` | switch pair / theme |

`wonk.init()` does not initialize any optional pack, each one wires itself.

## instruments and draft state

the hard rule: `input` previews a local value only, cheap, no backend call.
`change` fires once, on commit (release, enter, blur, radio selection, a
stepper click), and means the user finished setting this value, it commits
a draft, nothing more. `change` is never a license to run a query by
itself, gate any real backend call behind an explicit run/apply action
that reads the draft state these controls already hold. an invalid draft
(out of range, empty, crossed range) blocks the commit and stays on screen
exactly as typed, never silently clamped or reverted. never fabricate
activity: VU and scope helpers synthesize decorative data, use native
meters and progress elements for measured values.

full config attributes, per-control `input`/`change` behavior, validation
rules, and lifecycle: [references/instruments.md](references/instruments.md).

## code highlighting and json editor

`assets/wonk-code.css` + `assets/wonk-code.js` add real syntax highlighting
for `.wonk-pre > code` blocks and a labeled JSON editor
(`.wonk-json-editor`). built on **Prism 1.29.0**, vendored locally under
`assets/vendor/prism/` (committed, so the app works offline) plus a
`LICENSE` file (MIT, Copyright Lea Verou). no custom tokenizer, every
highlight goes through `Prism.highlight()`.

| file | grammar(s) |
|---|---|
| `prism-core.min.js` | core engine, mandatory, load first |
| `prism-markup.min.js` | `markup` (`html`, `xml`, `svg`) |
| `prism-css.min.js` | `css`, needs markup loaded first |
| `prism-clike.min.js` | `clike`, base for `javascript` |
| `prism-javascript.min.js` | `javascript` (`js`), needs `clike` |
| `prism-json.min.js` | `json` (`webmanifest`) |
| `prism-sql.min.js` | `sql` |
| `prism-bash.min.js` | `bash` (`sh`, `shell`) |

markup contract:

```html
<pre class="wonk-pre"><code data-language="json">{"event": "purchase"}</code></pre>
```

`data-language` selects the grammar. `render(el, value, language)` defaults
`language` to `"json"` when omitted. `init()` does **not** apply that
default, it only wires elements matching `pre code[data-language]`, so a
block with no `data-language` attribute is invisible to `init()` and never
gets auto-highlighted, call `wonkCode.highlight(el, language)` on it
directly instead.

size limits, main-thread work: `Prism.highlight()` and
`JSON.parse`/`JSON.stringify` run synchronously, no worker. two independent
200,000-character bounds: `MAX_HIGHLIGHT_CHARS` gates `highlight()` (skips
tokenizing past it, shows plain safe text instead), `MAX_FORMAT_CHARS` gates
the editor's `format()`, checked against the raw draft **before**
`JSON.parse` runs, so an oversized paste never pays for a parse-and-
restringify either.

JSON round-trip caveats, `format()` uses plain `JSON.parse` +
`JSON.stringify(v, null, 2)`, not a format-preserving parse:

- **precision**: numbers beyond `Number.MAX_SAFE_INTEGER` (2^53-1) lose
  precision as a real double rounding, `9007199254740993` round-trips to
  `9007199254740992`. keep large IDs or monetary minor units as JSON
  **strings** if exact round-trip matters.
- **duplicate keys**: collapse to the last one, this is native `JSON.parse`
  behavior, not a bug in this pack.
- **caution, key order**: integer-like keys (`"0"`, `"1"`, `"42"`) get
  reordered ascending, ahead of every other key, regardless of where they
  appeared in the source, this is the JS object-key spec, not this pack.
  non-numeric keys keep their original insertion order. example:
  `{"b":1,"2":2,"a":3,"1":4}` formats to `{"1":4,"2":2,"b":1,"a":3}`. don't
  rely on ordering for numeric-looking keys in a plain object.

full JS API (`highlight`, `render`, `init`, `destroy`, `jsonEditor`,
`vendorReady`, and the frozen contract values), the editor markup contract,
and the browser checks: [references/code.md](references/code.md).

## framework lifecycle

in React, Vue, or Svelte, give an imperative widget (knob, fader, code
block, motion target) a dedicated DOM node the framework does not reconcile
internally. wire it after mount, tear it down before unmount:

```js
useEffect(() => {
  const panel = panelRef.current;
  wonkControls.init(panel);
  return () => wonkControls.destroy(panel);
}, []);
```

strict-mode remounts must not duplicate listeners, each pack's `init()` is
idempotent per element, calling it twice on the same node is safe.

- `wonk.init(scope)`: base behaviors (jitter, glyph morph, tabs, secrets),
  not idempotent for every legacy helper, avoid repeated calls on one subtree.
- `wonkControls.init(scope)` / `.destroy(scope)`: instruments.
- `wonkMotion.play(el, name)` / `.cancel(el)`: one-shot effects, cancel
  before removing the target, the app owns DOM removal and focus.
- `wonkCode.init(scope)` / `.destroy(scope)`: code blocks and JSON editors.

no pack is initialized by `wonk.init()`, wire each one you use. full
stack-specific wiring (Tailwind, shadcn/Radix, vanilla, no-build apps):
[references/adapters.md](references/adapters.md).

## galleries and section markers

`demo/index.html` is long by design, a full component catalog on one page.
every markup block is wrapped in a matching pair of one-line HTML comments,
`SECTION:name START` and `SECTION:name END`. `demo/catalog.js` uses the
same markers around its matching script blocks. work on one family without
reading the whole file:

```sh
grep -n "SECTION:instruments" demo/index.html demo/catalog.js
```

then read only between the START and END lines. section names, in document
order: chrome, hero, type, color, buttons, forms, badges, cards, table,
tabs, overlays, code, charts, live, nav, alerts, exotic, empty,
instruments, datatools, motion, footer. `boot` is script-only. before committing a change to either file, confirm the count
of `SECTION:` lines with the START word equals the count with the END word:

```sh
grep -c "SECTION:.* START" demo/index.html; grep -c "SECTION:.* END" demo/index.html
```

## validation

serve the skill directory with any static server, then open a gallery and
run its checks in the browser console:

```js
await wonkControlsChecks.run();   // demo/instruments.html
await wonkMotionChecks.run();     // demo/motion.html
await wonkCodeChecks.run();       // demo/index.html#code
```

each returns named pass/fail results for its pack's behavior. separately
check keyboard interaction, dark/paper readability, mobile overflow, and
actual OS reduced motion. these reference implementations still need
validation in the consuming app.

audit an existing app for drift:

```sh
grep -rEn "#[0-9a-fA-F]{3,8}" src/ | grep -v wonk-tokens.css   # colors outside tokens
grep -rn "border-radius" src/ | grep -Ev "4px|999px"           # off-contract radius
grep -rEn "bg-gray-|text-slate-|border-zinc-" src/             # tailwind default grays
```

self-audit before calling anything done:

- [ ] zero colors outside `wonk-tokens.css`
- [ ] both themes screenshotted, nothing unreadable in either
- [ ] labels mono/uppercase/tracked, headings mixed-case, numbers tabular mono
- [ ] charts themed from chart tokens, legend and tooltip present
- [ ] one pair only, `-text` variants used for all colored text
- [ ] jitter only on live/loading, reduced motion respected
- [ ] exact entry, keyboard, pointer cancellation, disabled, invalid states tested
- [ ] draft changes never trigger expensive queries
- [ ] empty, unknown, stale, partial, and error states have distinct copy
- [ ] tables scroll locally on mobile, dialogs restore focus
- [ ] optional pack init/destroy tested, no duplicate event subscriptions
- [ ] at least one easter egg present, console shows the greeting

## migrating from jetbrains mono

`--ak-font-mono` changed from JetBrains Mono to IBM Plex Mono, and three
related tokens moved with it. update these in any app built against an
older WONK install:

| token | old | new |
|---|---|---|
| `--ak-font-mono` | `"JetBrains Mono"` (400/700) | `"IBM Plex Mono"` (400/500/600/700) |
| `--ak-text-xs` | `0.7rem` | `0.8rem` (12.8px) |
| `--ak-text-sm` | `0.8rem` | `0.875rem` (14px) |
| `--ak-track-label` | `0.2rem`, fixed | `0.06em`, relative to the element's own font-size |
| `.wonk-label` | color ink-3, weight 400 | color ink-2, weight 500 |

steps: swap the font link or self-hosted files for IBM Plex Mono 400/500/
600/700. no markup changes needed, components read the tokens, not a
literal font name. re-screenshot dark and paper, `--ak-track-label` is now
`em`-based so it scales with each element's own font-size and reads
slightly tighter on small labels than the old fixed rem value. drop any
app-local override that hardcoded `"JetBrains Mono"` or the old text-size
pixel values.

all galleries now request IBM Plex Mono. no code-section font override is needed.

## deeper reference

| file | covers |
|---|---|
| [references/pairs.md](references/pairs.md) | the five poster pairs, token roles, tuning rules |
| [references/components.md](references/components.md) | copy-paste markup for every base component, JS API |
| [references/instruments.md](references/instruments.md) | knob, fader, bounded window, segmented selector, stepper |
| [references/data-tools.md](references/data-tools.md) | source channels, query state, filters, tables, selection, jobs |
| [references/motion.md](references/motion.md) | eight one-shot effects, cancellation, reduced motion |
| [references/code.md](references/code.md) | Prism vendoring, syntax highlighting, the JSON editor |
| [references/charts.md](references/charts.md) | Observable Plot theming, validated palettes |
| [references/adapters.md](references/adapters.md) | Tailwind, shadcn/Radix, vanilla wiring |
| [references/easter-eggs.md](references/easter-eggs.md) | hidden things, microcopy voice |
