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
labels. read only the sections of [README.md](README.md) the task needs.

announce the mode: **build**, **reskin**, **audit**, or **demo**. infer it if
unstated (new UI -> build, existing app -> reskin, "check/review" -> audit).

## build: start from the template

1. copy [`templates/app.html`](templates/app.html) into the app and
   [install](README.md#install) `assets/` at `/wonk/`; delete sections you
   don't need.
2. for each component you add, find its row in
   [cheatsheet.md](references/cheatsheet.md) and read only its linked reference.
3. a new WONK component earns a pack + reference + gallery entry in the same change.

## other modes

- **reskin**: wire the stack with [adapters.md](references/adapters.md),
  confirm the pair, bridge old tokens before restyling.
- **audit**: report drift, never fix silently: [README § validation](README.md#validation).
- **demo**: `demo/index.html` uses `SECTION:name` markers; read [README §
  galleries](README.md#galleries-and-section-markers) before editing it end to end.

## hard rules

1. install: one recipe, `/wonk/` paths, fonts first, packs load after the base: [README § install](README.md#install), [§ optional packs](README.md#optional-packs).
2. color: one poster pair per app, on the root only, never mixed; colored text uses a `-text` variant, never a raw accent: [README § color](README.md#color-and-pairs), [pairs.md](references/pairs.md).
3. type: Space Grotesk for UI, IBM Plex Mono for data, code, numbers, labels. uppercase + tracking only on labels, chrome (`.wonk-label`, buttons, badges, table headers, kv terms, brand) and page titles (`.wonk-title`); body, headings, nav, tabs stay mixed case, never uppercase prose: [README § typography](README.md#typography).
4. geometry: 4px radius, hairlines, jitter only on live/loading states: [README § geometry](README.md#geometry-and-motion).
5. accessibility: `-text` variants pass 4.5:1, no color-only status, visible focus rings, reduced motion respected.
6. hierarchy: lead with the answer, detail behind `.wonk-fold`, plain visible copy: [hierarchy.md](references/hierarchy.md).
7. numbers open records: every count is a `button.wonk-stat` or `.wonk-value-link` that opens a drill: [data-tools.md § drill-down](references/data-tools.md#drill-down).
8. hints: help text and term definitions use `data-tip` / `.wonk-term`, never native `title=`: [components.md § hints](references/components.md#hints-and-terms).
9. charts: `wonkCharts.plot` on the vendored d3 + Plot, never a CDN, never stock styling; read [charts.md](references/charts.md) first.
10. instruments and data tools: read [instruments.md](references/instruments.md) and [data-tools.md](references/data-tools.md) first. `input` previews locally, `change` commits a draft, only an explicit Run/Apply runs the query; never fabricate activity, VU/scope helpers are decorative: [README § instruments](README.md#instruments-and-draft-state).
11. audio: a player is the radio pack (`data-wonk-radio`), its scope draws real audio only: [radio.md](references/radio.md).
12. eggs: every app hides an easter egg; visible copy stays plain: [easter-eggs.md](references/easter-eggs.md).
13. done: `npm test` passes before any claim of done (checklist below).

## before claiming done

1. `npm test` in this repo passes when WONK changed; it also checks
   `VERSION` against every asset header. in an app, its tests pass,
   including the WONK drift test ([README § install](README.md#install), step 4).
2. screenshot dark and paper; nothing is unreadable in either.
3. every item of the [README self-audit checklist](README.md#validation) holds.

don't commit unless asked.

## deeper reference

[cheatsheet.md](references/cheatsheet.md) · [components.md](references/components.md) · [hierarchy.md](references/hierarchy.md) · [data-tools.md](references/data-tools.md) · [charts.md](references/charts.md) · [instruments.md](references/instruments.md) · [motion.md](references/motion.md) · [code.md](references/code.md) · [radio.md](references/radio.md) · [pairs.md](references/pairs.md) · [adapters.md](references/adapters.md) · [easter-eggs.md](references/easter-eggs.md) · [CHANGELOG.md](CHANGELOG.md)
