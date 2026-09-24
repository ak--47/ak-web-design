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

An app that already has its own theme switcher (a platform `theme.js` that
writes `data-theme="light"` or `"dark"` on `<html>`) keeps it and skips
`wonk.theme.init()`, the no-flash snippet, and `[data-wonk-theme-toggle]`.
No bridge is needed: `data-theme="light"` styles as paper, and
`wonkCharts.plot` charts re-render on any `data-theme` change. Only
`wonk:themechange` does not fire (it comes from `wonk.setTheme`), so the app
redraws its own canvas or svg from its switcher.

## Tailwind (v3 config or v4 @theme)

Point Tailwind's palette at the tokens so utilities resolve to WONK. Do not
restate hex values in the config — reference the CSS variables. In v3, wrap
each one in `tok()`: a bare `var()` gives Tailwind nowhere to put the alpha,
so `bg-a1/20` or `text-ink-2/70` silently fails. `color-mix` also works for
tokens that carry their own alpha, like `--ak-ink-3`. v4 builds opacity
modifiers with `color-mix` by itself, so there a bare `var()` is enough.

```ts
// tailwind.config.ts (v3)
// <alpha-value> is Tailwind's placeholder: 1, or the /NN modifier (0.2 for /20)
const tok = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  theme: {
    extend: {
      colors: {
        ground: tok("--ak-ground"),
        surface: tok("--ak-surface"),
        "surface-2": tok("--ak-surface-2"),
        ink: { DEFAULT: tok("--ak-ink"), 2: tok("--ak-ink-2"), 3: tok("--ak-ink-3") },
        hairline: { DEFAULT: tok("--ak-hairline"), strong: tok("--ak-hairline-strong") },
        a1: { DEFAULT: tok("--ak-a1"), ink: tok("--ak-a1-ink"), text: tok("--ak-a1-text") },
        a2: { DEFAULT: tok("--ak-a2"), text: tok("--ak-a2-text") },
        ok: tok("--ak-ok"), warn: tok("--ak-warn"), err: tok("--ak-err"), info: tok("--ak-info"),
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

### cascade: where wonk.css goes

WONK's element defaults (`h1`-`h4`, `p`, `small`, `a`) weigh 0,0,1, the same
as Tailwind's preflight. WONK component classes weigh 0,1,0 and up, the same
as or more than a utility. So the import order decides:

- **v3** (no native cascade layers): load `wonk.css` and the packs after
  Tailwind's base and before its components and utilities. With
  postcss-import:
  `@import "tailwindcss/base"; @import "./wonk/wonk.css"; @import "tailwindcss/components"; @import "tailwindcss/utilities";`.
  A utility then beats WONK's default for its element (`text-sm` on a `p`).
  A WONK rule with more weight (`.wonk-card--fold > summary`) still beats a
  single utility: change it with an app rule. Load WONK before the base only
  when the app wants preflight to reset WONK's element defaults.
- **v4** (`@import "tailwindcss"`, native `@layer`): CSS outside a layer
  beats every layer, whatever its specificity, so an unlayered `wonk.css`
  beats every utility. Import it into the components layer, so utilities
  still win: `@import "./wonk/wonk.css" layer(components);`.
- **App overrides** of WONK components go last: after the utilities in v3,
  outside any layer in v4. A rule there also beats every utility of the same
  weight, so a rule that must lose to a utility does not go there.

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

controlled inputs change without an event. React writes `checked` onto a
radio with no `change` event (an undo, server state, a refused edit), so the
segmented glide stays under the old option. call `set()` from an effect keyed
on the value:

```js
// Segmented.jsx: el is the .wonk-segmented fieldset
useEffect(() => {
  const seg = wonkControls.segmented(el.current);   // returns the existing handle
  return () => seg?.destroy();
}, []);
useEffect(() => { el.current.wonkSegmented?.set(value); }, [value]);
```

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
