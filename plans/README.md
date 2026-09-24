# Implementation plans: one-shot friendly WONK

Written by the improve skill, 2026-09-24, against `ea62dcd`. AK asked for
all of it, executed overnight. Each plan runs through an executor agent,
then a review. Work lands on branch `wonk-oneshot`, one commit per plan.
Plans are written just in time, so each one matches the code its
predecessors left.

Evidence behind the plans: the cerebros jev apps (one-shot in #272, then
#281-#289 fixing tooltips, fold/unfold, drill tables, the segmented glide
bug, and copy), a WONK audit, and the dm4 radio.

## Execution order & status

| Plan | ACT | Title | Effort | Depends on | Status |
|---|---|---|---|---|---|
| 001 | ACT 1 | Headless check runner + CI gate | M | — | DONE (26e98a3) |
| 007 | ACT 7 | `wonk-radio` pack (static, public GCS) | M | — | DONE (see git log) |
| 002 | ACT 2 | Base bug bundle: init, tabs, toast, glide, motion, spark, menu, reveal, contrast, focus, doc contradictions | M | 001 | DONE (6be5b9e) |
| 003 | ACT 3 | `wonk.hint` + `.wonk-term` (replaces hover-only `.wonk-tip`) | M | 002 | DONE (see git log) |
| 004 | ACT 4 | Disclosure family + fold-all + hierarchy rule + microcopy rule (DECIDE 1) | S-M | 003 | DONE (see git log) |
| 005 | ACT 5 | Table module + drill-down + `wonk.fmt` + delta sentiment | M-L | 004 | DONE (see git log) |
| 008 | DECIDE 2 | Vendor d3 + Plot, `wonkCharts` helper | S-M | 005 | DONE (see git log) |
| 006 | ACT 6 | `templates/app.html`, responsive shell + drawer, theme helper, layout utilities, `.wonk-sr`, smoke suite | M | 003-005, 007, 008 | DONE (see git log) |
| 009 | ACT 6 / DECIDE 3 | Version stamp, CHANGELOG, local fonts, one install recipe, SKILL.md rewrite + cheatsheet, loose ends | M | 006 | DONE (see git log) |
| 010 | review | Fixes from the full-branch code review (F1-F11) | S-M | 001-009 | DONE (see git log) |
| 011 | AK feedback | Radio album art + hover enlarge (with select caret, a.wonk-btn border, live divider fixes done directly) | S-M | 010 | DONE (see git log) |

All plans are DONE. `npm test`: 197 passed, 0 failed.

Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (reason)

## Decisions taken (AK said "do everything"; these are the advisor's recommendations)

- DECIDE 1: hidden easter eggs stay mandatory; visible copy is plain by
  default; playful visible copy only in personal projects.
- DECIDE 2: vendor d3 + Observable Plot under `assets/vendor/`, like Prism.
- DECIDE 3: apps keep vendoring WONK; every asset gets a version stamp and
  `wonk.version`; docs describe dm4's byte-equality test as the drift check.

## Dependency notes

- 001 first: every later plan verifies with `npm test`.
- 002 → 003 → 004 → 005 run in sequence because they all edit
  `assets/wonk.js`, `assets/wonk.css`, and the docs.
- 007 creates only new files, so it runs in parallel with 001.
- 006 composes the hint, disclosure, drill, charts, and radio; 009 then
  documents install and rewrites SKILL.md around the template.
- After 009: a full-branch code review; fixes land as a final commit.

## Loose ends (plan 009 fixes these)

- `demo/index.html` code section sample shows an inline
  `<script>wonk.toast(...)</script>`, which throws under the deferred install.

- Link the radio pack from README (packs table, galleries table), SKILL.md
  deeper reference, references/components.md, and the demo/index.html nav.

- `demo/instruments.html:251` comment and `demo/controls-checks.js:41-43`
  header still say `wonk.init` is not idempotent (plan 002 made it idempotent).
- Several paper tokens now sit at exactly 4.50:1. Any token edit must re-run
  `npm test -- base` (the contrast check).

## Code review findings (all fixed in plan 010)

- README validation suite table lacks `radio` and `template` rows; `references/radio.md` still shows `../assets/` paths.

- Charts: a click pins Plot's tip; after a drill closes, the next click
  only unpins the tip and does not open a drill (read from Plot source, untested).
- `h1.wonk-title` loses its wide tracking: `.wonk h1` wins over `.wonk-title` (seen in demo titles).
- The radio dock takes ~153px of a 390px-wide phone screen; consider a compact mobile dock.
- The template's `.wonk-empty` heading is larger than the `.wonk-state` headings beside it.

## Findings considered and rejected

- Command palette: `references/data-tools.md:155-156` scopes it out on
  purpose. Only the dead `⌘K` hint in the demo gets removed (plan 002).
- Copy-to-clipboard helper: useful, but not in the requested scope.
- Period presets on `.wonk-window`: the preset list is domain logic
  (cerebros builds it from its own `/periods` endpoint).
