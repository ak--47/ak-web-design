---
name: ak-web-design
argument-hint: "[reskin | build | audit | demo] [app path or target]"
description: >
  The WONK design system — AK's personal web design language. Use whenever
  building, styling, restyling, or reviewing ANY web UI for AK: new pages,
  apps, dashboards, demo pages, prototypes, HTML tools, or frontends. Use when
  the user says "reskin", "make it look like me", "ak design", "wonk",
  "my design system", "de-AI this UI", "make it not look like every AI app",
  or invokes /ak-web-design. Also use before writing any new HTML page or
  choosing any UI colors, fonts, or chart styles in AK's personal projects —
  even if the user doesn't mention design at all. Not for Mixpanel-branded or
  customer-facing work products.
---

# ak-web-design · the WONK design system

WONK is AK's design language: **minimal structure, maximal color and texture,
in defined slots.** The thesis comes from his music project ("the aesthetic of
maximalism — cram as much content as possible into each musical moment") and
his album art: few colors per piece, one loud accent, hand-marks against
strict geometry, never soft. UIs built with WONK should be unmistakably not
another default AI app.

Announce the mode you are in: **reskin**, **build**, **audit**, or **demo**.
If the request doesn't name one, infer it (new UI -> build; existing app ->
reskin; "check/review" -> audit) and say so.

## The assets are the contract

`assets/wonk-tokens.css` (all values — the source of truth),
`assets/wonk.css` (components, `.wonk-` prefix), `assets/wonk.js` (behaviors:
live jitter, glyph morph, toasts, tabs, secrets). Read the token file before
styling anything; never invent a color, radius, or duration that has a token.
Wiring instructions per stack: [adapters.md](references/adapters.md).

## Hard rules (every mode, every time)

1. **Dark-first.** Ground `#0f1214`. Light mode is "paper": warm bone
   `#ece4d4`, ink text — the printed record to dark's stage. Both are real;
   never ship a light mode that is plain white.
2. **One poster pair per app**, set once at the root
   (`<html data-pair="metathesis" class="wonk">`). Five pairs exist:
   electric (default), metathesis, demogorgon, ancient, flourish. Choosing and
   tuning: [pairs.md](references/pairs.md). Never mix pairs in one app; never
   use a raw accent as text when a `-text` variant exists.
3. **Type:** Space Grotesk (400/500/700) for UI, JetBrains Mono (400/700) for
   data, code, numbers, and labels. Headings are mixed-case grotesk with tight
   tracking. Uppercase + 0.2rem tracking is reserved for labels
   (`.wonk-label`) and mono microcopy; uppercase + 0.5rem for page titles
   (`.wonk-title`) only. Numbers always mono, tabular.
4. **Geometry:** 4px radius, full circles for avatars/status dots, 1px
   hairline borders everywhere, connective vertical hairlines between stacked
   blocks (`.wonk-stack`). The square-wave divider (`.wonk-divider`) is the
   section separator; plain `.wonk-rule` when the wave would be noise.
5. **Motion is expressive but purposeful.** Springy easing
   (`--ak-ease`), 150/250/400ms. The **irregular jitter** (100–180ms bursts,
   then rest) is the signature and lives ONLY on live/loading states
   (`data-wonk-live`, `.wonk-spectrum`). Smooth motion everywhere else.
   Everything respects `prefers-reduced-motion` — wonk.js already checks.
6. **Waveform motifs are the decoration language.** Square-wave dividers,
   spectrum-bar loaders, oscilloscope-style empty states. No gratuitous
   gradients, no glassmorphism, no glow-on-everything.
7. **Charts are first-class and never stock.** Observable Plot, themed from
   `--ak-chart-1..6` (machine-validated per pair per theme). Rules and the
   `wonkChart` helper: [charts.md](references/charts.md). Read it before
   writing any chart.
8. **Every app hides something.** Console greeting, one hidden interaction,
   playful microcopy. Conventions and the line not to cross:
   [easter-eggs.md](references/easter-eggs.md).
9. **Accessibility is not optional maximalism.** `-text` variants pass 4.5:1;
   status never appears as color alone; focus rings visible
   (`--ak-a1-text`); reduced motion respected.

## Modes

### reskin — apply WONK to an existing app

1. Survey the app's stack (framework? Tailwind? build step?) and its current
   CSS entry points. Pick the adapter from
   [adapters.md](references/adapters.md).
2. Ask AK which pair the app gets (or recommend one from the table in
   pairs.md). One pair, at the root.
3. Install the three asset files; wire fonts, tokens, components.
4. Map the app's existing variables/utilities to WONK tokens in one bridge
   layer first — get the whole app on tokens before touching components.
5. Restyle components toward the `.wonk-` idioms; replace chart palettes
   immediately (stock chart colors are the loudest tell).
6. Add the easter-egg slots.
7. Screenshot dark AND paper at desktop + mobile widths; run the audit
   checklist below before calling it done.

### build — new UI in WONK

Start from the demo page's markup patterns (`demo/index.html`), not from
scratch. Root gets `class="wonk" data-pair="..."`. Compose from `.wonk-`
components; write new CSS only for what the system lacks — and when a new
component earns its place, add it to `assets/wonk.css` and the demo page, so
the system grows instead of forking.

### audit — check an app against WONK

Report drift, don't fix silently. Grep for: hex values not in the tokens
file; `border-radius` other than 4px/999px; font families outside the two;
Tailwind default grays (`gray-`, `slate-`, `zinc-`); chart libraries or
palettes off-contract; missing `data-theme="paper"` support; uppercase
tracking on headings (reserved for titles/labels); animation on non-live
elements using irregular timing. Output a labeled findings list (F1, F2, ...)
with file:line references.

### demo — serve or extend the component gallery

`demo/index.html` is the living proof that the system holds together, and the
reference agents copy from. Serve it with any static server from the skill
directory root (assets are referenced relatively). When components change,
the demo page changes in the same commit.

## Self-audit before claiming done

- [ ] Zero colors outside wonk-tokens.css (grep hex values in changed files)
- [ ] Both themes screenshotted; nothing unreadable in either
- [ ] Labels mono/uppercase/tracked; headings mixed-case; numbers tabular mono
- [ ] Charts themed from chart tokens, legend + tooltip present
- [ ] One pair only; `-text` variants used for all colored text
- [ ] Jitter only on live/loading; reduced-motion respected
- [ ] At least one easter egg present
- [ ] Console shows the greeting and no errors

## Deeper reference (read on demand)

- [pairs.md](references/pairs.md) — the five pairs, token roles, tuning rules
- [charts.md](references/charts.md) — Plot theming, validated palettes, the validator command
- [adapters.md](references/adapters.md) — Tailwind, shadcn/Radix, vanilla wiring
- [easter-eggs.md](references/easter-eggs.md) — hidden things, microcopy voice
