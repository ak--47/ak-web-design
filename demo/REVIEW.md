# resume at round 10

open [the next studies](review.html#workspace). workspace is the final A/B round.
round 08 is decided: B, sectioned reading. round 09 is also B, core fields with
advanced settings folded inline. use A + B for comparison, or A/B to see one
candidate at full width. dark and paper both work.

[the approved baseline](compare.html?approved=1) combines the decisions from
rounds 1-7. [the glyph comparison](compare.html) remains available.

these pages are local fixtures. forms save to the current page's memory only;
reload clears those edits. no import, retry, notification, or backend request
runs. no shipped asset, version, or skill rule changed. work continues on
`refine/wonk-design-studies` in [draft PR #1](https://github.com/ak--47/ak-web-design/pull/1).
the pull request stays in draft until review.

## choices still open

| round | A | B | try |
|---|---|---|---|
| 10 / workspace | list above inspector | list beside inspector | search for Mobile, filter Failed, select with arrow keys, clear an empty search |

the split workspace stacks on narrow screens. compare its desktop or full-width
view before choosing. neither version uses a modal inspector. both retain the
same selection when it still matches the filters; otherwise they select the
first remaining record. empty results clear the old inspector.

the workspace composition is not approved yet. both options hold the type,
data, and shared controls steady. choose one, then review the combined baseline
before promoting changes into WONK.

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

geometric pattern morphs remain a liked alternate. idle glyph behavior is still
experimental: the prototype stays still until interaction, while the shipped
helper also cycles slowly at rest. no decision generalized the three-series
chart preference to every chart or series count.

## checks are repeatable

```sh
npm test -- studies study-baseline
npm test
```

the new suites contain 18 checks. they cover matching reading content, exact
count drills, hidden validation errors, local save/discard, empty-state recovery,
keyboard selection, unique IDs, grouped entry, full-width inline evidence, two
complete glyph shuffle cycles, and approved motion timing. the polish checks
cover Escape and focus return, stationary focused fields, selection announcements,
and cancellation of hidden effects without losing drafts.

selecting the current batch again keeps its open snapshot. moving to another
record announces the source, time, status, and record count. Escape closes the
current inline fold and returns to its summary; native select menus keep their
own Escape behavior.

browser checks also exercised dark/paper at 320, 390, 768, and 1,440px; full-width
comparison modes; reduced motion at startup and during an effect; and resource
loading. the glyph pool rendered without missing-character boxes in local
Chromium. other operating systems' font coverage is not established.

the repository's workflow runs on `main` pushes, not pull requests. the draft
records local test results; no remote CI result is implied.

## promotion needs a separate pass

the approved behaviors currently live in the prototype, not in reusable packs.
after the final review, move them into their owning components with focused
tests, references, gallery examples, and a version update where needed.

the longer result accent currently uses a local Web Animations implementation.
the shared motion pack's fixed 250ms safety budget would cut off a CSS-only
extension. promotion must update the animation lifecycle as well as its duration.

grouped numeric entry uses formatted text with explicit validation because native
number inputs cannot display commas. keep tests for character-by-character
typing, cursor position, malformed pasted grouping, invalid drafts, zero, and
explicit Apply. raw JSON and identifiers keep their original syntax.

the reference path `~/code/solutions-briefs` was absent. the session used DM4's
design notes and the voice guide; the reading round contains new fixture prose,
not customer material from that directory.