# The poster pairs

WONK color is "poster logic", taken from AK's album art: few colors per view,
one loud accent, high contrast, never soft gradients. The system ships five
named pairs. **One app gets one pair, at the root, for its whole life.**
Sections never switch pairs inside an app. The demo page is the only place
with a switcher.

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
