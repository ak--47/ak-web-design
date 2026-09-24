# Plan 006: One copyable file starts a correct WONK app — `templates/app.html`, responsive shell, theme helper, layout utilities

> **Executor instructions**: Follow this plan step by step. Write each new
> check first, watch it fail, then implement (red → green). Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `ls templates 2>/dev/null` → nothing.
> Read the current `assets/wonk.js`, `assets/wonk.css`, `assets/wonk-data.js`,
> `assets/wonk-charts.js`, `assets/wonk-radio.js` headers and public APIs,
> and `references/components.md`, before starting. Plans 002-005, 007, 008
> built them; this plan composes them and must use their real APIs.

## Status

- **Priority**: P1 (the one-shot entry point)
- **Effort**: M
- **Risk**: LOW (new files + additive base helpers)
- **Depends on**: plans 003, 004, 005, 007, 008
- **Category**: direction
- **Planned at**: `ea62dcd` + plans 001-005, 007, 008, 2026-09-24

## Why this matters

WONK has no starter. `SKILL.md` build mode says "copy markup from
components.md and `demo/index.html`", but the demo has ~80 inline styles
and demo-only classes (`demo-row`, `demo-grid`, `demo-section` in
`demo/catalog.css`). `.wonk-shell` has no mobile layout (its drawer lives
only in `demo/catalog.js` + `demo/catalog.css`). The theme toggle is
hand-written in four demos, nothing persists it, and a saved paper theme
flashes dark on load. There is no visually-hidden utility (cerebros wrote
four). cerebros also wrote two bridges because WONK ignores
`data-theme="light"`. AK asked for the radio "in the template". After
this plan, an agent copies one file and starts from a working, correct app.

## Current state

- `assets/wonk.css` `.wonk-shell { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }`,
  `.wonk-side`, `.wonk-side .brand`, `.wonk-navlink(.active)`, `.wonk-topbar` — no breakpoint.
- `demo/catalog.js:82-116` — the mobile drawer to promote: below 800px the
  sidebar is an off-canvas panel; closed it is `inert`; a toggle button
  with `aria-expanded`; link click, Escape, and outside click close it and
  return focus to the toggle; crossing the breakpoint resets it.
  CSS: `demo/catalog.css:46-62` (`.wonk-side` fixed, `inset: 0 20% 0 0`,
  `transform: translateX(-100%)`, `.is-open` slides in).
- `assets/wonk.js` `setTheme(name)` sets/removes `data-theme="paper"` only;
  `setPair(name)` sets `data-pair` with no validation (old name
  `electric` silently falls back). No storage, no event.
- Demo layout helpers to promote (from `demo/instruments.html` `<style>`):
  `.demo-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: var(--ak-s4); }`,
  `.demo-row { display:flex; flex-wrap:wrap; gap: var(--ak-s3); align-items:center; }`.
- Pairs: `metathesis glorpla demogorgon ancient flourish` (`assets/wonk-tokens.css`).
- Check which of these already exist before adding: `grep -n "\.wonk-sr" assets/*.css`
  (plan 005 may have added `.wonk-sr` to `wonk-data.css`; if so, move it to `wonk.css`).

## Design

### Base additions (`assets/wonk.js`, `assets/wonk.css`)

1. **Theme helper** `wonk.theme`:
   - `wonk.theme.init({key = "wonk-theme"} = {})`: reads storage, else
     `prefers-color-scheme: light` → paper, else dark; applies it. Returns the theme.
   - `wonk.setTheme(name)` now accepts `"paper"`, `"light"` (alias of
     paper), `"dark"`; throws on anything else; persists to the key when
     `init` ran; dispatches `wonk:themechange` on `document` with
     `{detail: {theme, pair}}`.
   - `wonk.setPair(name)` throws on an unknown pair (list the valid ones)
     and dispatches the same event.
   - CSS: `[data-theme="light"]` behaves exactly like `[data-theme="paper"]`
     — make `wonk-tokens.css` paper selectors also match `light`
     (`:is([data-theme="paper"], [data-theme="light"])` or a duplicated selector list).
   - Any `[data-wonk-theme-toggle]` button is wired by `init`: click flips
     dark/paper; its text is `Paper` in dark and `Dark` in paper; `aria-pressed` reflects paper.
   - A copyable **no-flash head snippet** (≤ 3 lines, runs before CSS paints):
     ```html
     <script>try{var t=localStorage.getItem("wonk-theme");if(t==="paper"||(!t&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.setAttribute("data-theme","paper")}catch(e){}</script>
     ```
     (The `catch` exists only because storage access throws in some
     sandboxed iframes; it must not hide anything else — keep it that small.)
2. **Responsive shell + drawer**: in `wonk.css`, below 800px `.wonk-shell`
   becomes one column, `.wonk-side` becomes the off-canvas drawer, and a
   `.wonk-drawer-btn` (hidden above 800px) shows in the topbar. In
   `wonk.js`, `init` wires `[data-wonk-drawer]` (the toggle button, with
   `aria-controls` naming the `.wonk-side` id) with the exact behavior of
   `demo/catalog.js:82-116`. Then switch `demo/index.html` +
   `demo/catalog.js` + `demo/catalog.css` to the shipped version and delete
   the demo copy.
3. **Layout utilities** in `wonk.css`: `.wonk-main` (page padding
   `--ak-s8`, `--ak-s4` under 640px, `max-width: 80rem`, centered),
   `.wonk-row` (the demo-row rule), `.wonk-grid` (the demo-grid rule;
   `--wonk-grid-min` custom property, default 260px), `.wonk-section`
   (margin-bottom `--ak-s12`, `scroll-margin-top`), `.wonk-sr` (standard
   visually-hidden rule). Do not rename demo classes elsewhere; only the
   template and `demo/index.html` chrome use the new ones.

### `templates/app.html`

A single file an agent copies next to a copy of `assets/`. It loads from
`../assets/` (so it runs inside this repo); line 1 is a comment saying
"change ../assets/ to where you copied WONK's assets folder". Content,
top to bottom, all fixture data labeled as fixtures in one visible note:

- `<html lang="en" class="wonk" data-pair="metathesis">`, the no-flash
  snippet, fonts, tokens, `wonk.css`, `wonk-data.css`, `wonk-radio.css`;
  deferred scripts: vendored d3 + Plot, `wonk.js`, `wonk-data.js`,
  `wonk-charts.js`, `wonk-radio.js`; one deferred app script inline at the
  end wrapped in `DOMContentLoaded` (no inline code that runs before the deferred scripts).
- Shell: sidebar with brand + 3 nav links (`.wonk-navlink`, one `active`),
  topbar with drawer button, page title (`.wonk-title`), pair label, theme toggle.
- **Overview section** (hierarchy rule, plan 004): a `.wonk-row` of three
  `button.wonk-stat` tiles with `data-wonk-drill` names registered via
  `wonkData.drills(...)` (one money drill with totals + CSV download, one
  with row detail), each with a `.wonk-term` or `data-tip` definition on
  its label; one `delta--good` and one `delta--bad` (via `wonk.fmt.delta`);
  one line of context and a `.wonk-fold` "How these are counted".
- **Records section**: a `.wonk-fold-all` group, a `wonkData.table` with
  typed columns (text, money, date, badge), a header `hint`, `limit: 10`,
  `detail(row)`, and `select: true` with a small selection bar.
- **Trend section**: one `wonkCharts.plot` line chart with `label`, a
  `table` view, and `onClick` opening a drill for the clicked point.
- **States section**: `.wonk-empty` and `.wonk-state[data-state="error"]`
  / `stale` examples with plain copy from `references/data-tools.md`'s state table.
- A toast on one action; a `data-wonk-secret` on the brand (hidden egg);
  the console greeting comes from `wonk.js`.
- **Radio**: a `section.wonk-radio.wonk-radio--dock[data-wonk-radio]`
  on `aktunes` / `music/` right before `</body>`, wrapped in
  `<!-- radio: delete this block if the app has no radio -->` comments.
- Uses only shipped classes: `grep -n 'style="' templates/app.html` must
  print nothing, and no `demo-` classes.

### Smoke suite in the runner

`scripts/check.mjs`: support a suite entry with `smoke: true` and no
`global`: load the page, wait for `DOMContentLoaded` + 1s, fail on any
`pageerror`, and assert a list of selectors exists (`selectors: [...]`).
Add `{ name: "template", page: "/templates/app.html", smoke: true, selectors: [".wonk-shell", "button.wonk-stat", ".wonk-table", "[data-wonk-radio] .wonk-radio-scope", "figure, svg"] }`.

## Scope

**In scope**: `assets/wonk.js`, `assets/wonk.css`, `assets/wonk-tokens.css`
(light alias selectors only), `assets/wonk-data.css` (only to move `.wonk-sr`
out, if it is there), `templates/app.html` (create), `demo/base-checks.js`,
`scripts/check.mjs`, `demo/index.html` (chrome section: shipped drawer +
theme toggle; nothing else), `demo/catalog.js` (remove the drawer + theme
toggle copies), `demo/catalog.css` (remove the drawer CSS copy),
`demo/instruments.html`, `demo/motion.html`, `demo/workbench.html`,
`demo/workbench.js`, `demo/radio.html` (replace each hand-written theme
toggle with `data-wonk-theme-toggle`; delete the toggle JS),
`references/components.md` (theme, drawer, layout utilities), `README.md`
(install section: the no-flash snippet; a "start from the template" line
at the top of "open a working example").

**Out of scope**: SKILL.md rewrite, versioning, fonts, install/distribution
docs (plan 009 does those), chart/table/radio internals.

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

### Step 1: Checks first (`demo/base-checks.js`)
1. `wonk.setTheme("light")` → `data-theme` is `paper` or `light`, and
   `--ak-ground` computes to the paper ground; `setTheme("bogus")` throws.
2. `wonk.setPair("electric")` throws with the valid names in the message.
3. `wonk:themechange` fires on `setTheme` and `setPair` with `detail.theme` / `detail.pair`.
4. after `wonk.theme.init({key: "wonk-theme-check"})`, `setTheme("paper")`
   writes the key; restore attributes and remove the key in `finally`.
5. `[data-wonk-theme-toggle]` click flips the theme and its text.
6. drawer: in a fixture shell with a `[data-wonk-drawer]` button (force the
   mobile state by running the check in a 390px-wide iframe, like the
   mocked iframe technique in `demo/motion-checks.js`), click opens
   (`aria-expanded="true"`, side not `inert`), Escape closes and focuses the button.
7. `.wonk-sr` computes to a 1px clipped box; `.wonk-grid`, `.wonk-row` exist
   (computed `display` grid/flex).

**Verify**: `npm test -- base` → the new checks fail.

### Step 2: Implement the base additions.
**Verify**: `npm test -- base` → all pass.

### Step 3: Demos switch to shipped helpers.
**Verify**: `grep -rn "theme-toggle\")" demo/*.js demo/*.html` → no hand-written
listeners left; `grep -n "menuBtn\|mobileMenuQuery" demo/catalog.js` → nothing;
`npm test` → all pass.

### Step 4: `templates/app.html` + smoke suite.
**Verify**: `npm test -- template` → pass; `grep -c 'style="' templates/app.html` → 0.

### Step 5: Look at it
Screenshots of `templates/app.html`: dark and paper at 1280, 390 with the
drawer closed and open, and one with a drill open → `/tmp/wonk-template-*.png`.
Look at them. Nothing overflows at 390 except table regions that scroll locally.

**Verify**: screenshots taken; issues fixed or listed.

### Step 6: Docs.
**Verify**: `grep -n "templates/app.html" README.md references/components.md` → ≥ 1 each.

## Done criteria

- [ ] `npm test` exits 0, including `template`
- [ ] no inline styles and no `demo-` classes in the template
- [ ] every demo's theme toggle uses `data-wonk-theme-toggle`
- [ ] `git status --short` → only in-scope files

## STOP conditions

- A shipped API the template needs (drill registry, table options, chart `label`/`table`/`onClick`, radio dock) does not exist or differs from plans 005/007/008 — list the differences instead of inventing.
- Making paper selectors match `light` would change dark-theme values.

## Maintenance notes

- Plan 009 rewrites SKILL.md build mode around this template.
- Every new shipped component should appear in the template only if most apps need it; the gallery shows the rest.
