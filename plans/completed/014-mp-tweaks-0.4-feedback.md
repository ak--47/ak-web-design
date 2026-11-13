# 014: Suggested improvements from the MP Tweaks 0.4.0 upgrade

Source: MP Tweaks (Chrome extension popup, 520px wide), branch `ak-reskin`,
commit `e14279b` in mixpanel/mp-tweaks, 2026-11-04. MP Tweaks vendors 6
files: `wonk-fonts.css`, `wonk-tokens.css`, `wonk.css`, `wonk.js`,
`wonk-radio.css`, `wonk-radio.js`.

Status: DONE in 0.5.0 (2026-11-13). Items 1-4 shipped. Item 5 skipped by AK.

## Upgrade result

- 0.3.0 to 0.4.0 was a plain copy. Fonts did not change.
- MP Tweaks changed only the version pin in its drift test.
- All MP Tweaks tests passed with no other change: 150 unit, 329 e2e.

## Item 1: a "rest glyph" mode for `wonk.glyph`

**Finding.** AK asked for glyphs that act as icons: ♫ for the radio toggle
and ⚄ for 2 dice buttons. An icon must keep its meaning, so it must return
to its own glyph when the user stops interacting. `wonk.glyph` keeps the last
random symbol on leave (easter-eggs.md § motion eggs). It also overwrites the
markup glyph at wire time (`el.textContent = next()`).

**What MP Tweaks did.** It wrote its own helper, `src/ui/glyph.js` (about 75
lines). It reads `wonk.glyphs` and copies the shuffle bag. The behavior:

- At rest, the element shows its markup glyph.
- Hover or `:focus-visible` cycles at 200ms. Leave or blur restores the rest glyph.
- `setActive(true)` cycles at 700ms with no hover. The radio uses this while it plays.
- Reduced motion always shows the rest glyph.

**Review finding.** A code review of the helper found 3 gaps that
`wonk.glyph` does not have. The helper had no listener for a
`prefers-reduced-motion` change, no blur or `:disabled` handling, and no
guard against a repeat when the bag refills. MP Tweaks fixed all 3. The
cause is 2 copies of one engine. Each WONK fix must now be copied to MP
Tweaks by hand.

**Suggestion.** Add the mode to `wonk.glyph`, so apps do not fork it:

- `data-glyph-rest`: keep the markup glyph at wire time. Restore it on leave, blur, and Escape.
- An active state: `handle.setActive(bool)` or `data-glyph-active`, with its own
  cadence (for example `data-glyph-active-ms="700"`). Use it for "playing" or
  "working". Reduced motion suppresses it.
- Document the pattern in easter-eggs.md, or in components.md if it is an
  icon control and not an egg.

After this ships, MP Tweaks can delete `src/ui/glyph.js` and use
`data-wonk-glyph data-glyph-idle="0" data-glyph-rest`.

## Item 2: fixed text glyphs as icons

**Finding.** AK asked for small icons on the Magic AI buttons and before
each section title. MP Tweaks used fixed Unicode glyphs, not emoji or SVG.
WONK has no guidance for this use.

**Problems seen.**

- Some code points render as color emoji on macOS Chrome. MP Tweaks avoided
  ▶ ⏺ ⚙ ⚒ ⌨ ⚡ ℹ for this reason.
- IBM Plex Mono (latin subset) has none of these glyphs. The platform fallback
  font draws them, so widths vary. A fixed width (`width: 1.2em; text-align: center`) keeps labels aligned.
- Color: `--ak-ink-2` or `--ak-ink-3` at rest, `--ak-a1-text` on hover. On a
  danger button the glyph takes the error color (`color: inherit`).
- The glyph is decoration: `aria-hidden="true"`. The label still names the action.

**Glyphs MP Tweaks used (all render as text on macOS Chrome):**

| Use | Glyphs |
|---|---|
| Magic AI buttons | ¶ ⌗ ⋈ ◐ ✎ ◇ ⊞ ❝ ≣ ∑ § ↧ № ↺ ⋔ |
| Section headers | ⊕ ◉ ⇄ ✦ ↯ ▷ ⧉ ⚑ ∞ ◎ ⁂ ▥ |
| Controls | ♫ (radio), ⚄ (dice), ☾ ☀ (theme), ⋯ (menu) |

**Suggestion.** Add a small `.wonk-icon-glyph` class (fixed width, mono,
`ink-2`, hover accent, inherits danger color). Add a reference list of safe
icon glyphs that render as text, plus a list of glyphs that render as emoji.
A check could scan the demo and template for code points with default
emoji presentation.

## Item 3: button tracking in dense mono grids

**Finding.** AK said the letter spacing on a 3-column grid of mono uppercase
buttons was "a little too wide". The buttons used `--ak-track-btn`
(0.08rem, about 1.3px at 12.8px text). MP Tweaks changed them to
`--ak-track-label` (0.06em, about 0.8px). AK has not reviewed the result yet.

**Suggestion.** Think about a compact tracking value for dense button
grids and small text. Two options:

- a `--ak-track-btn-tight` token
- tracking in `em` that scales with font size

## Item 4: density in narrow surfaces

**Finding.** AK said the 520px popup felt "smooshed" at `--ak-s2` (8px)
row padding. MP Tweaks increased spacing as follows:

- section rows: about 10px top and bottom
- outer gutters: `--ak-s3` to `--ak-s4`
- button-row and grid gaps: `--ak-s2` to `--ak-s3`
- tool card padding: `--ak-s3`

**Suggestion.** hierarchy.md asks for compact rows. Add a minimum: compact
rows keep at least about 10px vertical padding, and gutters stay at least
`--ak-s4`, even in narrow surfaces.

## Item 5: a narrow two-line header pattern (optional)

**Finding.** At 520px, one header line did not fit the brand, radio toggle,
theme control, account selector, and menu. AK asked for a 2-line header:

- The brand mark (a 60px animated cube) covers both lines in column 1.
- Line 1: wordmark + glyph morph, spacer, icon controls, menu.
- Line 2: the account and org selector at full width. It hides when signed out (`:has()`).

**Suggestion.** If more WONK apps run in popups or side panels, add this
layout to `templates/` or to the hierarchy reference as a narrow-header
pattern. Skip it if MP Tweaks stays the only narrow consumer.
