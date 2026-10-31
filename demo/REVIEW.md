# approved and promoted

all ten A/B choices are recorded. open [the chosen designs](review.html?chosen=1#workspace):
sectioned reading (B), core + advanced editing (B), and stacked workspace (A).
each opens at full width. dark and paper both work.

[the approved baseline](compare.html?approved=1) combines the decisions from
rounds 1-7 and links back to the chosen designs. [the alternatives](review.html)
and [the glyph comparison](compare.html) remain available.

these pages are local fixtures. forms save to the current page's memory only;
reload clears those edits. no import, retry, notification, or backend request
runs. the combined review was approved and the selected behaviors now ship in
the reusable packs. [refined components](refined.html) exercises those APIs,
including the new saved dice palette. the implementation and release review are
tracked in [PR #1](https://github.com/ak--47/ak-web-design/pull/1).
AK approved merging and shipping after the release review.

## review the chosen behavior together

the stacked workspace puts the list above its inline inspector. selection stays
when it still matches the filters; otherwise the first remaining record becomes
selected. empty results clear the old inspector.

the individual choices and combined preview are approved. the alternatives
remain for comparison; the shared components and skill defaults now use the
approved direction. the release workflow tests the merged revision before
deploying the public gallery to GitHub Pages.

## decisions already made

| decision | approved behavior |
|---|---|
| hierarchy | answer first, then evidence and controls |
| charts | sources together on the tested three-series chart, strongly preferred |
| record details | inline always, including count and chart drills |
| numeric controls | slider plus exact entry; 8px track, 24 x 32px rectangular grip, 44px input area |
| full numbers | comma grouping, including typed quantities; compact K/M values remain valid |
| density | compact rows with 8px vertical padding |
| opening motion | 6px slide over 250ms; closing stays immediate |
| changed results | 800ms accent: 80ms rise, 160ms hold, 560ms fade; actual values update immediately |
| glyph | unframed symbol shuffle; 200ms cadence, 120ms movement, keyboard/touch activation |
| variety | 561 unique symbols in a persistent shuffle bag; no repeat within a cycle or adjacent repeat across its boundary |
| reading | sectioned briefs: visible headlines with inline expandable explanations and expand/collapse all |
| editing | core fields visible; advanced settings folded inline, with explicit save/discard and hidden errors revealed on validation |
| workspace | stacked batch list above the inline inspector; keep compact rows and keyboard selection |

geometric pattern morphs remain a liked alternate. idle glyph behavior is still
experimental: the prototype stays still until interaction, while the shipped
helper also cycles slowly at rest. no decision generalized the three-series
chart preference to every chart or series count.

## checks are repeatable

```sh
npm test -- studies study-baseline
npm test
```

the new suites contain 19 checks. they cover matching reading content, exact
count drills, hidden validation errors, local save/discard, empty-state recovery,
keyboard selection, unique IDs, grouped entry, full-width inline evidence, two
complete glyph shuffle cycles, and approved motion timing. the polish checks
cover Escape and focus return, stationary focused fields, selection announcements,
and cancellation of hidden effects without losing drafts.
the chosen-design check pins B reading, B editing, and A workspace.

## release review

the complete local suite passes 254 checks. dependency audit reports no known
vulnerabilities. the review fixed numeric precision loss, comma-boundary
deletion, stale validity after native reset, external theme-switcher palette
repainting, reduced-motion glyph starts, inline focus and failed-replacement
safety, stale workbench details, and invalid motion-name handling. regression
checks cover each change; real browser input verified deletion and focus.

the Pages artifact includes only public assets, demos, templates, references,
and root documentation. development tooling and repository metadata are excluded.

selecting the current batch again keeps its open snapshot. moving to another
record announces the source, time, status, and record count. Escape closes the
current inline fold and returns to its summary; native select menus keep their
own Escape behavior.

browser checks also exercised dark/paper at 320, 390, 768, and 1,440px; full-width
comparison modes; reduced motion at startup and during an effect; and resource
loading. the glyph pool rendered without missing-character boxes in local
Chromium. other operating systems' font coverage is not established.

the repository's workflow runs on `main` pushes, not pull requests. local results
are recorded here; the Pages workflow run is the remote deployment gate.

## reusable APIs

WONK 0.4.0 promotes the console fader, grouped quantity adapter, inline drill,
compact rows, reading/advanced/workspace classes, long result accent, and
561-symbol shuffle. The starter template and refined gallery use these packs.

The shared motion pack now owns the 800ms accent and its matching safety budget.
The review pages use that shared implementation. Copy the new
`--ak-t-feedback` token with the pack. The new palette API saves a validated
seed with local/session/in-memory fallback; its chart slots come from existing
validated presets. Full color and storage details live in the pairs reference.

grouped numeric entry uses formatted text with explicit validation because native
number inputs cannot display commas. keep tests for character-by-character
typing, cursor position, malformed pasted grouping, invalid drafts, zero, and
explicit Apply. raw JSON and identifiers keep their original syntax.

the reference path `~/code/solutions-briefs` was absent. the session used DM4's
design notes and the voice guide; the reading round contains new fixture prose,
not customer material from that directory.