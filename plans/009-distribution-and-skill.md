# Plan 009: Apps can install, pin, and detect drift of WONK, and SKILL.md leads a one-shot build in few reads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `ls templates/app.html VERSION 2>/dev/null` →
> only `templates/app.html` (the template exists; `VERSION` does not yet).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (docs, headers, new font files)
- **Depends on**: plan 006
- **Category**: dx / docs (DECIDE 3, taken)
- **Planned at**: `ea62dcd` + plans 001-008, 2026-09-24

## Why this matters

Apps copy WONK's files (cerebros has two copies, dm4 one). No file carries
a version, so drift is invisible; dm4 wrote its own byte-equality test
because it "sat three releases behind upstream for months and nobody
noticed" (`/Users/ak/code/dm4/ui/src/v5/wonk-vendor.test.js:1-8`). The
install docs disagree on paths (`/wonk-tokens.css`, `assets/`,
`../assets/`) and never say how to get the files into an app. WONK ships no
font files, so cerebros self-hosted them itself to satisfy its CSP. And
`SKILL.md` makes a build agent read ~1,600 lines across nine files before
it writes code. After this plan: one install recipe, a version everywhere,
a drift check to copy, local fonts, and a SKILL.md that starts from the template.

## Current state

- Assets: `assets/wonk-tokens.css`, `wonk.css`, `wonk.js`,
  `wonk-controls.{css,js}`, `wonk-data.{css,js}`, `wonk-motion.{css,js}`,
  `wonk-code.{css,js}`, `wonk-charts.js`, `wonk-radio.{css,js}`, and
  `assets/vendor/{prism,d3,plot}/`. Each asset starts with a `/* === … === */` header comment.
- `README.md` has "install", "optional packs", "framework lifecycle",
  "validation" sections; `references/adapters.md` covers Tailwind,
  shadcn/Radix, vanilla wiring, and uses `/wonk-tokens.css` root paths.
- `SKILL.md` (~65 lines): frontmatter (keep the `description` exactly),
  hard rules 1-8+, modes, "before claiming done", deeper reference.
- Fonts: galleries load Space Grotesk 400/500/700 and IBM Plex Mono
  400/500/600/700 from Google Fonts. npm has `@fontsource/space-grotesk`
  5.3.0 and `@fontsource/ibm-plex-mono` 5.3.0 (woff2 per weight, latin
  subset files named like `files/space-grotesk-latin-400-normal.woff2`),
  both OFL-1.1.
- `plans/README.md` "Loose ends for plan 006" lists: stale "not
  idempotent" comments at `demo/instruments.html:251` and
  `demo/controls-checks.js:41-43`; radio pack links missing from README,
  SKILL.md, components.md, and the gallery nav; a displayed inline
  `<script>wonk.toast(...)</script>` sample in `demo/index.html` (code section).

## Steps

### Step 1: Version stamp (DECIDE 3)
- Create `VERSION` containing `0.2.0`.
- Put `WONK v0.2.0` in the first header line of every non-vendored file in `assets/`.
- `window.wonk.version = "0.2.0"` in `wonk.js`; `--wonk-version: "0.2.0";` in `:root` of `wonk-tokens.css`.
- Add a base check: `wonk.version` equals the computed `--wonk-version`
  (strip quotes) — and a Node-side assertion in `scripts/check.mjs` (run
  before the browser starts) that `VERSION` matches every asset header
  and `wonk.version`; mismatch → exit 1 with the file name.
- Create `CHANGELOG.md`: `0.2.0` lists what plans 001-008 changed that an
  app upgrading from 0.1 must know (paper token values, `.wonk-tip` →
  `data-tip`, check result shape, `wonk.init` idempotent, new packs,
  `setTheme`/`setPair` now throw on unknown names). Keep it short.

**Verify**: `npm test` → pass; changing one header temporarily → exit 1 (revert).

### Step 2: Local fonts
- `npm pack @fontsource/space-grotesk@5.3.0 @fontsource/ibm-plex-mono@5.3.0` in `/tmp`,
  copy the latin woff2 files for Space Grotesk 400/500/700 and IBM Plex
  Mono 400/500/600/700 to `assets/fonts/`, plus `assets/fonts/OFL.txt`
  (from the packages' LICENSE).
- Create `assets/wonk-fonts.css` with one `@font-face` per file
  (`font-display: swap`, `unicode-range` from fontsource's latin CSS).
  Family names exactly `Space Grotesk` and `IBM Plex Mono` so the tokens work unchanged.
- Switch `templates/app.html` to `wonk-fonts.css` (drop the Google links).
  Leave the galleries on Google Fonts (no need to churn them).

**Verify**: a Playwright probe on `templates/app.html` →
`document.fonts.check("16px 'Space Grotesk'")` and
`document.fonts.check("16px 'IBM Plex Mono'")` true after `document.fonts.ready`,
and no network request to `fonts.googleapis.com`.

### Step 3: Install into an app (README + adapters)
Rewrite README "install" as **one** recipe with one path convention:
1. copy: `cp -R ~/.agents/skills/ak-web-design/assets ./public/wonk`
   (drop packs the app does not use; keep `vendor/` subfolders intact).
2. link: the tags with `/wonk/…` paths, fonts first, the no-flash snippet
   (from plan 006) in `<head>`.
3. start from `templates/app.html` (change its `../assets/` prefix to `/wonk/`).
4. pin and detect drift: record `wonk.version`; copy the byte-equality
   test pattern (a short generic version of dm4's test: list vendored
   files, compare with the skill's `assets/`, skip with a message when the
   skill checkout is absent, e.g. on CI).
5. CSP: `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (Plot's
   inline style) and, for the radio, `connect-src https://storage.googleapis.com`
   and `media-src https://storage.googleapis.com`.
Update `references/adapters.md` paths to the same `/wonk/` convention.

**Verify**: `grep -rn 'href="/wonk-tokens.css"\|src="/wonk.js"' README.md references/` → nothing.

### Step 4: SKILL.md for one-shot builds
Keep the frontmatter `description` byte-identical. Rewrite the body (≤ 80 lines):
- **build mode first step**: "copy `templates/app.html`; delete sections you don't need; read only the reference for each component you add."
- Hard rules stay, each one line with its link; include: hierarchy
  ([hierarchy.md](references/hierarchy.md)), hints (`data-tip`, never `title=`),
  numbers open records (drill), charts via `wonkCharts` (vendored), radio
  pack ([radio.md](references/radio.md)), `npm test` before done.
- Create `references/cheatsheet.md`: one table, one row per component —
  need → class/attribute → JS call → reference link. Every row must name
  something that exists (verify each with grep).
- "before claiming done": `npm test`, screenshots both themes, the self-audit list.

**Verify**: `wc -l SKILL.md` → ≤ 80; `git diff SKILL.md | grep "^[-+]description"` → nothing;
for every class in `references/cheatsheet.md`, `grep -q` finds it in `assets/` (write a one-line loop and show its output).

### Step 5: Loose ends
Fix every item in `plans/README.md` "Loose ends for plan 006" (listed
above). Add the radio gallery and the template to the galleries table in
README and to the gallery nav in `demo/index.html` (chrome section only).

**Verify**: `grep -n "not idempotent" demo/ -r` → nothing; `grep -n "radio" README.md SKILL.md references/components.md` → ≥ 1 each; `npm test` → pass.

## Scope

**In scope**: `VERSION`, `CHANGELOG.md` (create), every non-vendored file
in `assets/` (header line only, plus `wonk.version` / `--wonk-version`),
`assets/fonts/*`, `assets/wonk-fonts.css` (create), `templates/app.html`
(fonts only), `scripts/check.mjs` (version assertion), `demo/base-checks.js`
(one check), `README.md`, `SKILL.md`, `references/adapters.md`,
`references/cheatsheet.md` (create), `references/components.md` (radio
link), `demo/index.html` (nav links + the inline-script sample),
`demo/instruments.html:251` comment, `demo/controls-checks.js` header comment.

**Out of scope**: behavior changes in any asset; other references beyond the listed ones.

## Git workflow

Do not commit. Your reviewer commits after review.

## Done criteria

- [ ] `npm test` exits 0, including the version assertion
- [ ] SKILL.md ≤ 80 lines, description unchanged, links resolve (`ls` each linked path)
- [ ] template renders with local fonts, no Google requests
- [ ] `git status --short` → only in-scope files

## STOP conditions

- fontsource 5.3.0 packages lack latin woff2 files for a required weight.
- Rewriting SKILL.md would drop a hard rule that exists today (list it instead).

## Maintenance notes

- Bump `VERSION` and every header together; the runner enforces it.
- The CHANGELOG is the upgrade guide for vendored copies (cerebros, dm4).
