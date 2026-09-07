# Adapters: applying WONK to existing stacks

The core is framework-agnostic: `wonk-tokens.css` + `wonk.css` + `wonk.js`.
This file covers wiring them into common stacks.

## Any app (the base recipe)

1. Copy `wonk-tokens.css`, `wonk.css`, `wonk.js` into the app's static assets
   (or serve from a shared path). They are the contract — do not fork values;
   improve them upstream in the skill instead.
2. Load fonts, tokens, components, behaviors, in that order:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/wonk-tokens.css">
<link rel="stylesheet" href="/wonk.css">
<script defer src="/wonk.js"></script>
```

3. Set the pair and class on the root:

```html
<html data-pair="metathesis" class="wonk">
```

Theme: dark is the default. `document.documentElement.setAttribute("data-theme", "paper")`
switches to paper; persist the choice in localStorage. `prefers-color-scheme: light`
may set paper as the initial value.

4. Self-host fonts for anything production-grade (download the woff2 files,
   `@font-face` them, drop the Google link). Every face gets a real fallback.

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
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
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

The base recipe is the whole story: three files, classic script/link tags.
Replace the app's own token file usage gradually — map its old variable names
to WONK tokens in one bridge block rather than editing every rule.

## Charts

Whatever the stack, chart theming follows `charts.md`. Rip out the chart
library's default palette on day one; stock palettes are the loudest tell of
an unreskinned app.
