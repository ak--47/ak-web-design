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

# ak-web-design · WONK

minimal structure, maximal color and texture, in defined slots. dark-first,
paper is the real light mode, one poster pair per app, mono for data and
labels. read only the relevant sections of [README.md](README.md).

announce the mode: **reskin**, **build**, **audit**, or **demo**. infer it if
unstated (new UI -> build, existing app -> reskin, "check/review" -> audit).

## hard rules

1. install, load order, packs: [README § install](README.md#install),
   [§ optional packs](README.md#optional-packs).
2. one poster pair per app, root only, never mixed, never a raw accent as
   text: [README § color](README.md#color-and-pairs), [pairs.md](references/pairs.md).
3. type: Space Grotesk (UI), IBM Plex Mono (data/code/numbers/labels).
   uppercase + tracking only on `.wonk-label`/`.wonk-title`, never both on
   one element: [README § typography](README.md#typography).
4. geometry/motion: 4px radius, hairlines, jitter only on live/loading:
   [README § geometry](README.md#geometry-and-motion).
5. charts never stock, read first: [charts.md](references/charts.md). every
   app hides something: [easter-eggs.md](references/easter-eggs.md).
6. accessibility: `-text` variants pass 4.5:1, no color-only status, focus
   rings visible, reduced motion respected.
7. data tools/instruments: read [data-tools.md](references/data-tools.md),
   [instruments.md](references/instruments.md) first. `input` previews
   locally, `change` commits a draft, an explicit Run/Apply action runs the
   query: [README § instruments](README.md#instruments-and-draft-state).
   never fabricate activity, VU/scope helpers are decorative only.

## modes

reskin: adapter in [adapters.md](references/adapters.md), confirm the pair,
bridge old tokens first. build: copy markup from
[components.md](references/components.md) and `demo/index.html`, a new
component earns a pack + reference + gallery entry, same change. audit:
report drift, don't fix silently, [README § validation](README.md#validation).
demo: `demo/index.html` uses `SECTION:name` markers, read [README §
galleries](README.md#galleries-and-section-markers) before editing it end to end.

before claiming done: run the [README self-audit
checklist](README.md#validation), screenshot both themes, run each pack's
browser checks. don't commit unless asked.

## deeper reference

[components.md](references/components.md) · [instruments.md](references/instruments.md) · [data-tools.md](references/data-tools.md) · [motion.md](references/motion.md) · [code.md](references/code.md) · [charts.md](references/charts.md) · [pairs.md](references/pairs.md) · [adapters.md](references/adapters.md) · [easter-eggs.md](references/easter-eggs.md)
