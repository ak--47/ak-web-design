# Adapters: applying WONK to existing stacks

The core is framework-agnostic: `wonk-tokens.css` + `wonk.css` + `wonk.js`.
This file covers wiring them into common stacks.

## Any app (the base recipe)

1. Install with the one recipe in [README § install](../README.md#install):
   copy `assets/` to the app's `/wonk/`, link `/wonk/wonk-fonts.css`,
   `/wonk/wonk-tokens.css`, `/wonk/wonk.css`, and `/wonk/wonk.js` (with the
   no-flash snippet above them), pin `wonk.version`, and add the drift test.
   The vendored files are the contract — do not fork values; improve them
   upstream in the skill instead.
2. Set the pair and class on the root:

```html
<html data-pair="metathesis" class="wonk">
```

Theme: dark is the default. `wonk.theme.init()` applies the saved theme or
`prefers-color-scheme`; after it, `wonk.setTheme("paper" | "dark")` switches
and saves the choice ([README § install](../README.md#install)).

## Tailwind (v3 config or v4 @theme)

Point Tailwind's palette at the tokens so utilities resolve to WONK. Do not
restate hex values in the config — reference the CSS variables:

```ts
// tailwind.config.ts (v3)
export default {
  theme: {
    extend: {
      colors: {
        ground: "var(--ak-ground)",
        surface: "var(--ak-surface)",
        "surface-2": "var(--ak-surface-2)",
        ink: { DEFAULT: "var(--ak-ink)", 2: "var(--ak-ink-2)", 3: "var(--ak-ink-3)" },
        hairline: { DEFAULT: "var(--ak-hairline)", strong: "var(--ak-hairline-strong)" },
        a1: { DEFAULT: "var(--ak-a1)", ink: "var(--ak-a1-ink)", text: "var(--ak-a1-text)" },
        a2: { DEFAULT: "var(--ak-a2)", text: "var(--ak-a2-text)" },
        ok: "var(--ak-ok)", warn: "var(--ak-warn)", err: "var(--ak-err)", info: "var(--ak-info)",
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "4px", full: "999px" },
    },
  },
};
```

Then sweep the codebase: `bg-gray-*`, `text-slate-*`, `border-zinc-*` etc. all
become the semantic names above. Any raw Tailwind gray that survives a reskin
is drift — the audit mode greps for it.

## shadcn/ui + Radix (e.g. ak-observability)

shadcn components read their own CSS variables. Map them once, in the app's
global CSS, after the tokens import:

```css
:root, [data-pair] {
  --background: var(--ak-ground);
  --foreground: var(--ak-ink);
  --card: var(--ak-surface);
  --card-foreground: var(--ak-ink);
  --popover: var(--ak-surface-2);
  --popover-foreground: var(--ak-ink);
  --primary: var(--ak-a1);
  --primary-foreground: var(--ak-a1-ink);
  --secondary: var(--ak-surface-2);
  --secondary-foreground: var(--ak-ink-2);
  --muted: var(--ak-surface);
  --muted-foreground: var(--ak-ink-3);
  --accent: var(--ak-wash);
  --accent-foreground: var(--ak-ink);
  --destructive: var(--ak-err);
  --border: var(--ak-hairline);
  --input: var(--ak-hairline);
  --ring: var(--ak-a1-text);
  --radius: 4px;
}
```

shadcn's HSL-wrapped themes (`hsl(var(--border))`) need the variables to hold
raw color values instead — if the app uses that convention, either switch its
`hsl()` wrappers to plain `var()`, or restate the mapping in HSL components.
Check which convention the app uses before mapping.

Buttons, tabs, tables from shadcn then inherit WONK automatically. On top of
that, restyle typography per the SKILL.md rules (labels mono/uppercase/tracked,
headings mixed-case grotesk).

## Vanilla JS apps (e.g. cerebros-style, no build step)

The base recipe is the whole story: classic script/link tags under `/wonk/`.
Replace the app's own token file usage gradually — map its old variable names
to WONK tokens in one bridge block rather than editing every rule.

## optional packs and framework lifecycle

load `wonk-controls.css` after `wonk.css`, then `wonk-controls.js` after `wonk.js`
for instruments. load `wonk-data.css` for data layouts. load `wonk-motion.css`
and `wonk-motion.js` for explicit one-shot effects. load `wonk-code.css` and
the vendored Prism files, then `wonk-code.js`, for syntax highlighting and
the JSON editor (see [code.md](code.md) for the grammar load order). none of
these add a package dependency.

in React/Vue/Svelte, prefer the framework's native controlled inputs and reuse
the CSS. when using the imperative controls, give them a dedicated DOM node the
framework does not reconcile internally. wire after mount and destroy before
unmount. strict-mode remounts must not duplicate listeners.

```js
// inside an effect/mount hook; panel is the dedicated DOM subtree
wonkControls.init(panel);
return () => wonkControls.destroy(panel);
```

`wonkControls.init(panel)` initializes only instrument controls. it includes the
panel itself if it matches. base `wonk.init(panel)` is idempotent per element:
calling it again on the same subtree after a re-render wires only the elements
it has not seen.

motion is explicit: `wonkMotion.play(element, 'value-changed')`. cancel before
unmount with `wonkMotion.cancel(element)`. don't use effects to own framework
visibility state. the component owns whether it exists and where focus returns.

fonts and charts need no CDN: `/wonk/wonk-fonts.css` self-hosts both faces,
and the charts pack uses the vendored d3 and Plot under `/wonk/vendor/`. an
app that already pins its own Plot or d3 version keeps it.

## Charts

Whatever the stack, chart theming follows `charts.md`. Rip out the chart
library's default palette on day one; stock palettes are the loudest tell of
an unreskinned app.
