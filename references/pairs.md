# The poster pairs

WONK color is "poster logic", taken from AK's album art: few colors per view,
one loud accent, high contrast, never soft gradients. The system ships five
named pairs and a seed-based dice generator. **One active pair lives at the
root.** Sections never mix pairs. Apps may offer a picker when the user should
control their colors; fixed-brand apps can retain their chosen preset.

Values live in `assets/wonk-tokens.css` — that file is the source of truth.
This file explains the roles and how to choose.

## The five

| Pair | Source | Feel | Reach for it when |
|---|---|---|---|
| `metathesis` (default) | METATHESIS cover (brick + turquoise) | swiss poster, loud & disciplined | the default: tools, dashboards, most apps |
| `glorpla` | a JAM-folder mouth-sound; electric violet + hot orchid, Mixpanel-adjacent purple | the loud purple, synth-lab | anything that should feel plugged in and slightly unhinged |
| `demogorgon` | DEMOGORGON cover (two blues) | deep water, orchestral | calm dashboards, reading surfaces |
| `ancient` | ANCIENT cover (orange-red + celadon) | ink splatter, warm museum | archives, docs, long-form |
| `flourish` | FLOURISH cover (acid + ultramarine) | painted, loudest of the five | playgrounds, demos, party mode |

## Token roles

- `--ak-a1` — primary accent. Fills: primary buttons, active nav, selection.
- `--ak-a1-ink` — the only text color allowed ON an a1 fill.
- `--ak-a1-text` — a1 shifted until it passes 4.5:1 as text on the ground.
  Use for links, active labels, focus rings. Never use raw `--ak-a1` as text.
- `--ak-a2` — secondary accent. Large shapes, illustration, borders. On dark,
  some a2 values (demogorgon's navy) are FILL ONLY — never text.
- `--ak-a2-text` — a2 shifted for text/border use.
- `--ak-wash` — a1 at low alpha; selected rows, active nav background.
- `--ak-ok / --ak-warn / --ak-err / --ak-info` — pair-tuned semantics
  (the user chose per-pair semantics over one global set). Invariants that
  hold in every pair: `err` is the hottest color on screen; `warn` is
  amber-family; `ok` is green-family; `info` may borrow the pair's accent.
  Status never appears as color alone — pair it with a label or icon.
- `--ak-chart-1..6` — categorical chart series. See `charts.md`. Do not remix.

## Contrast rules when tuning a pair

1. Every `-text` variant: >= 4.5:1 against its ground (dark `#0f1214`,
   paper `#ece4d4`).
2. `--ak-a1-ink` on `--ak-a1`: >= 4.5:1.
3. Semantic colors: >= 4.5:1 against their ground (they carry text and icons).
4. Chart slots: re-validate with the dataviz script (see `charts.md`).

## Adding a sixth pair

New album, new pair. Take the cover's two dominant colors, derive the token
set above, run the contrast rules and the chart validator, add one block per
theme to `wonk-tokens.css`, and add a card to the demo page. Name it in caps
after the release.

## Saved dice palettes

The base pack provides the generator and picker; no package or network request
is needed. Load the tokens before the base script. Then:

```html
<div data-wonk-palette></div>
```

The picker lists all five presets and Dice roll. Every dice-button click
generates another seed and applies its complete token set at the root. The
native select and named dice button support keyboard use. Mount it manually
with `wonk.palette.mount(host)` when using a framework; call the returned
`destroy()` before removing the host. Repeated mounting is idempotent.

Auto-mounting restores the default storage key. For an app-specific key, use
a plain host without `data-wonk-palette`, then initialize and mount in order:

```js
wonk.palette.init({ key: "my-app-palette" });
const picker = wonk.palette.mount(document.querySelector("#my-palette"));
```

A standalone `data-wonk-palette-roll` button only rolls. Call `palette.init()`
explicitly on page load if that is the only palette control and reloads should
restore the saved choice.

```js
wonk.theme.init();
wonk.palette.init({ key: "my-app-palette" });
const rolled = wonk.palette.roll();
const reproducible = wonk.palette.generate(12345678);
wonk.palette.roll({ seed: reproducible.seed });
wonk.setPair("metathesis");
```

`generate(seed)` is pure with respect to the active root theme and returns
`{ version, seed, chartPair, dark, paper }`. It requires the token stylesheet
to resolve chart colors in a browser DOM (ordinary server-side JavaScript is
not sufficient). Seeds are unsigned 32-bit integers. `roll()` adds
`storage: "localStorage" | "sessionStorage" | "memory"` to its result.
`init()` restores the active selection; it does not generate a new palette.
`setPair("dice")` reuses the current generated seed when available; use
`roll()` for a fresh one. `setTheme()` keeps that seed and chooses its other
mode. External root `data-theme` changes also repaint generated tokens on the
next mutation-observer turn. Charts receive `wonk:themechange` on every roll
and generated-mode change.

Only `{version: 1, pair, seed}` is stored, never executable CSS. The default
key is `wonk-palette`. Writes try local storage, then session storage; if both
fail the palette remains usable for the current page. Failures and corrupt
saved data are reported in the console. A session fallback takes precedence
over a possibly stale local copy. Restoring an unknown version, pair, or seed
leaves the current palette intact. Once initialized, choosing a preset also
persists and removes all generated overrides. Theme storage remains separate.

The generator retains WONK's ground and surface colors. It varies the two
accents and tunes their text variants plus semantic colors to at least 4.8:1
against all three standard surfaces. Button ink is chosen for at least 4.5:1.
The six chart slots come from one existing validated preset in its original
order. They are not arbitrary random hues and do not claim fresh CVD validation.
Custom surface overrides need their own contrast checks.

The existing no-flash snippet restores dark/paper only. Call palette `init`
as early as your loaded styles and script permit; a generated palette restores
when `palette.init()` runs, explicitly or through picker mounting, rather than
through an unvalidated inline CSS snapshot. Apps with strict first-paint
requirements can precompute with `generate(seed)` in a browser or headless
browser using the same stylesheet, then apply those trusted values before paint.
