# Plan 004: Headline first, detail behind a fold — WONK ships the disclosure family and the hierarchy + copy rule

> **Executor instructions**: Follow this plan step by step. Write each new
> check first, watch it fail, then implement (red → green). Run every
> verification command. If a STOP condition occurs, stop and report — do not
> improvise. Your reviewer maintains `plans/README.md`; do not edit it.
>
> **Drift check (run first)**: `grep -n "^/\* ---- accordion ---- \*/" assets/wonk.css` → one match.
> Read the current `assets/wonk.js` fully before starting: plans 002 and
> 003 changed it (idempotent wiring registry, body `MutationObserver`,
> hints). Reuse those mechanisms; do not add a second body observer.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW (new classes; one CSS selector fix)
- **Depends on**: plan 003
- **Category**: direction / docs
- **Planned at**: `ea62dcd` + plans 001-003, 2026-09-24

## Why this matters

AK's top complaint about the one-shot cerebros apps: "too many prose that
are too hard and confusing to read and parse... long paragraph details
should always be an 'unfold' action (click in to see more)... instructions
should be concise and clear, no editorializing". Later: "make expanded
detail cards collapsable ... fold all/unfold all button ... in each
subsection". The fix PRs rebuilt the same "+ rotates 45°" fold three times
(`.gr-fold`, `.oe-fold`, `.cmm-unfold`), built expandable table rows twice
with inconsistent ARIA, and a `foldAll` with different semantics per app.
WONK has only `.wonk-acc`, and even that is broken when put directly on a
`<details>`. WONK's docs never mention hierarchy, and
`references/easter-eggs.md:21-27` *mandates* playful microcopy, which AK's
feedback rejects for work tools. After this plan, the one-shot agent has
one disclosure family and one written rule to follow.

## Current state

- `assets/wonk.css:319-341` `.wonk-acc`: styles `details` only when
  *nested* inside `.wonk-acc` (`.wonk-acc summary`, `.wonk-acc details[open] > summary::after`).
  `demo/workbench.html:66` uses `<details class="wonk-acc">` directly, so
  the `+` never rotates and the open color never applies.
  Look to keep: summary flex row, `font-weight: 500`, `color: var(--ak-ink-2)`,
  `::after { content: "+"; font-family: var(--ak-font-mono); color: var(--ak-ink-3) }`,
  rotate 45° + `--ak-a1-text` when open, `.body` padded `--ak-text-sm` ink-2.
- `demo/workbench.html:118` — a plain `<details>` with browser-default styling.
- No expandable-row, fold-all, fold-state, or "showing X of Y" pattern exists
  (`grep -rn "foldAll\|aria-expanded" assets/` finds nothing relevant).
- `references/easter-eggs.md:21-27`: "3. **Microcopy voice** (mandatory)…
  Buttons can talk: 'Knock, knock...'… Empty states are … slightly
  self-deprecating… 'Nothing here yet. That's ok with me.'" — and
  `SKILL.md` hard rule 5 says "every app hides something".
- `references/data-tools.md:136-146` already has a good plain state-copy
  table (empty/unknown/stale/partial/error). Keep it and link to it.
- `demo/index.html` sections are wrapped in `<!-- SECTION:name START -->`
  / `END` markers; `README.md:311-316` lists section names in order.

Cerebros evidence for the patterns (read-only, do not edit):
`/Users/ak/code/cerebros/src/apps/gap-radar/public/gap-radar.css:67` (`.gr-fold`),
`/Users/ak/code/cerebros/src/apps/gap-radar/public/app.js:406-431` (row
unfold with `aria-expanded` + `aria-controls`),
`/Users/ak/code/cerebros/src/apps/gap-radar/public/app.js:472-489,896-907`
(foldable deal cards; fold state kept across re-renders via capture-phase `toggle`).

## Design (build exactly this)

### CSS (in `assets/wonk.css`, next to the accordion block; tokens only)

1. **Fix `.wonk-acc`**: selectors must work for both forms —
   `.wonk-acc > details` (list) and `details.wonk-acc` (single). Keep the look.
2. **`.wonk-fold`** — the inline "How this works" unfold, for prose:
   ```html
   <details class="wonk-fold">
     <summary>How this works</summary>
     <div class="body"><p>…</p></div>
   </details>
   ```
   No border, no background. Summary: sans `--ak-text-sm`, `--ak-ink-2`,
   a mono `+` *before* the text that rotates 45° and turns `--ak-a1-text`
   when open. Body: `--ak-text-sm`, ink-2, max-width 65ch, left hairline
   (`border-left: var(--ak-hairline-w) solid var(--ak-hairline)`), small
   left padding.
3. **`.wonk-card--fold`** — a record card whose summary keeps the headline:
   ```html
   <details class="wonk-card wonk-card--fold">
     <summary>
       <span class="headline">Peloton · $420k</span>
       <span class="facts">AE Dana · CE Lee · closes Oct 31</span>
     </summary>
     <div class="body">…</div>
   </details>
   ```
   Summary row: headline (sans, ink, 500) and facts (mono xs, ink-2) on
   one line, wrap on narrow screens, `+` at the right end.
4. **Expandable table rows**:
   ```html
   <tr>
     <td><button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="r1-detail">Security review</button></td>
     <td class="num">12</td>
   </tr>
   <tr class="wonk-row-detail" id="r1-detail" hidden><td colspan="2">…</td></tr>
   ```
   `.wonk-row-toggle`: unstyled button that looks like cell text, with a
   mono `+` that rotates when `aria-expanded="true"`, visible focus ring.
   `.wonk-row-detail > td`: `--ak-surface-2` background, padded.
5. **`.wonk-more`** — list truncation notice:
   `<p class="wonk-more">Showing <span class="wonk-num">20</span> of <span class="wonk-num">143</span> <button type="button" class="wonk-btn wonk-btn--quiet">Show all</button></p>`
   (mono xs, ink-2). CSS only; the app owns the list.
6. **`.wonk-fold-all`** — a small button group placed in a section header:
   ```html
   <div class="wonk-fold-all" role="group" aria-label="Fold controls">
     <button type="button" class="wonk-btn wonk-btn--quiet" data-wonk-fold-all="open" data-target="#deals">Unfold all</button>
     <button type="button" class="wonk-btn wonk-btn--quiet" data-wonk-fold-all="close" data-target="#deals">Fold all</button>
   </div>
   ```

### JS (in `assets/wonk.js`; document-level delegation, no per-element wiring)

- **Row toggles**: a click on `.wonk-row-toggle` flips its `aria-expanded`
  and the `hidden` attribute of the element named by `aria-controls`
  (missing target → one `console.warn`, no throw). Enter/Space come free
  from `<button>`.
- **`wonk.foldAll(root, open)`**: sets `open` on every `<details>` inside
  `root` (all depths) and sets every `.wonk-row-toggle` inside `root` to
  `open` (updating `aria-expanded` and its target's `hidden`). Returns the
  number of disclosures changed. Same semantics for open and close.
- **Fold-all buttons**: a click on `[data-wonk-fold-all]` calls
  `wonk.foldAll(target, value === "open")`, where target is
  `document.querySelector(data-target)`, else the closest
  `section, article, [data-fold-scope]`.
- **Fold state across re-renders**: a `<details>` or `.wonk-row-toggle`
  with `data-fold-key="deal-123"` has its open state remembered in memory
  (a `Map`, not storage) when toggled (listen to `toggle` in the capture
  phase for details; the click handler for rows). When an element with a
  known key is inserted (reuse the body `MutationObserver` from plan 002)
  or when `wonk.init(scope)` runs, restore its state. `wonk.foldState.clear()`
  empties the map.

### Docs: hierarchy and copy

Create `references/hierarchy.md` (voice of `references/motion.md`:
lowercase headings, short sentences, tables). Content:
- **lead with the answer**: each section opens with its headline — the
  number, the ranked list, the verdict. One short line of context at most.
- **detail behind a fold**: any explanation longer than two lines goes in
  `.wonk-fold` ("How this works", "How to read this"). Records go in
  `.wonk-card--fold` or expandable rows. Sections with 3+ folds get a
  `.wonk-fold-all` group.
- **numbers lead to records**: every number that counts records is
  clickable and opens the records behind it (point to the drill-down
  added by plan 005 as "see references/data-tools.md, drill-down" — write the
  sentence so it stays true once that section exists).
- **copy**: plain, concise, imperative. No editorializing, no jokes in
  visible UI copy of work tools. Sentence case. Define every non-obvious
  term with `.wonk-term` (plan 003). Link the state-copy table in
  `references/data-tools.md`.
- A short before/after example table (generic, no customer names):
  a prose intro paragraph → one line + a fold; a static total → a
  clickable total; "Nothing here yet. That's ok with me." → "No deals match
  these filters."

Update `references/easter-eggs.md` (DECIDE 1, taken): hidden eggs stay
mandatory (console greeting, a hidden interaction); **visible microcopy is
plain by default**; playful visible copy only in AK's personal projects
(portfolio, music, toys), never in work tools or data apps. Rewrite item 3
accordingly and keep the rest.

`SKILL.md`: add one hard-rule line: "hierarchy: lead with the answer,
detail behind `.wonk-fold`, plain copy: [hierarchy.md](references/hierarchy.md)".
Adjust hard rule 5's wording so "every app hides something" refers to
hidden eggs only. Keep SKILL.md short.

## Scope

**In scope**: `assets/wonk.css`, `assets/wonk.js`, `demo/base-checks.js`,
`demo/index.html` (add one `SECTION:disclosure` block after the `alerts`
section, with matching START/END markers; move nothing else),
`demo/workbench.html` (lines ~66 and ~118: use `details.wonk-acc` /
`.wonk-fold` correctly), `references/hierarchy.md` (create),
`references/easter-eggs.md`, `references/components.md` (a Disclosure
block + JS API rows), `README.md` (components table row, section-name list,
deeper-reference table row), `SKILL.md`.

**Out of scope**: drill-down and tables (plan 005), hints (done in 003),
`demo/catalog.js`/`catalog.css` (unless the new gallery block needs zero
JS — it should need none), radio files, cerebros.

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

### Step 1: Checks first (`demo/base-checks.js`)
1. `details.wonk-acc` (direct) open → `getComputedStyle(summary, "::after").transform` is not `none`.
2. `.wonk-fold` open → its summary's `::before` (or `::after`, whichever holds the `+`) is rotated.
3. row toggle click → `aria-expanded="true"` and target not `hidden`; second click reverses.
4. row toggle with a missing `aria-controls` target → no throw.
5. `wonk.foldAll(root, true)` opens nested details (2 levels) and row toggles, returns the count; `false` closes all.
6. `[data-wonk-fold-all="open"][data-target]` click opens everything in the target.
7. `data-fold-key`: open a keyed details, remove it, insert a fresh one with the same key → it is open after one frame; `wonk.foldState.clear()` then re-insert → closed.

**Verify**: `npm test -- base` → the 7 new checks FAIL, others pass.

### Step 2: CSS + JS
Implement the design.

**Verify**: `npm test -- base` → all pass;
`grep -nE "#[0-9a-fA-F]{3,8}\b" assets/wonk.css` → no new matches.

### Step 3: Gallery
Add `SECTION:disclosure` to `demo/index.html`: a `.wonk-fold` under a
headline stat, three `.wonk-card--fold` records with a `.wonk-fold-all`
group, a small table with two expandable rows, a `.wonk-more` line. Plain
copy, labeled fixture data. Fix the two `demo/workbench.html` details.

**Verify**: `grep -c "SECTION:.* START" demo/index.html` equals the END count; `npm test` → all suites pass.

### Step 4: Docs
Write `references/hierarchy.md`, update `references/easter-eggs.md`,
`references/components.md`, `README.md`, `SKILL.md` as designed.

**Verify**: `grep -n "hierarchy.md" SKILL.md README.md` → ≥ 1 match each;
`grep -n "Knock, knock" references/easter-eggs.md` → only inside a
"personal projects" context (or gone).

### Step 5: Look at it
Screenshot `demo/index.html#disclosure` with folds open and closed, dark and
paper, 1280 and 390 wide, to `/tmp/wonk-disclosure-*.png` (Playwright from
`node_modules`, any static server). Look at them.

**Verify**: 4 screenshots; no overflow at 390px; open/closed states distinct in both themes.

## Done criteria

- [ ] `npm test` exits 0; 7 new base checks pass
- [ ] `references/hierarchy.md` exists and SKILL.md links it
- [ ] `git status --short` → only in-scope files (plus others' untracked files)

## STOP conditions

- Restoring fold state needs a second `MutationObserver` because plan 002's observer is not reusable — report the shape you found instead of adding one.
- The `.wonk-acc` fix changes how the existing nested-accordion demo looks (compare screenshots of `#alerts` before/after).

## Maintenance notes

- Plan 005 adds drill-down; `references/hierarchy.md` should then link its exact section.
- Plan 006's template must use `.wonk-fold` for its explanatory copy.
