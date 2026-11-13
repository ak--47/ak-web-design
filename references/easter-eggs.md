# Easter eggs & microcopy

WONK apps hide things. The aktunes site put a base64 puzzle behind a hover
overlay reading "Oh... interesting" and logged "you're getting warmer..." to
the console. That habit is an official part of the system: every WONK app
ships at least one hidden thing. Visible copy stays plain by default (slot 3).
Serious tools earn the right to be playful by being excellent everywhere else — the
eggs never sit in the critical path, never block a task, and never fire during
an incident view.

## The three slots

1. **Console greeting** (mandatory). `wonk.js` prints one automatically, mono,
   tracked, cyan. Add app-specific lines to the pool when the app has its own
   inside joke.
2. **One hidden interaction** (mandatory). The built-in: any element with
   `data-wonk-secret="<message>"` reveals its message after seven rapid
   clicks. Better: replace it with something bespoke to the app (a konami
   code, a glyph that unlocks "performance mode", a datamosh flash on a
   version number). Reward whoever bothers to look.
3. **Microcopy voice** (plain by default). Visible copy is plain, concise,
   and imperative, with no jokes: [hierarchy.md § copy](hierarchy.md#copy).
   An empty state names the cause: "No deals match these filters."
   Playful visible copy belongs only in AK's personal projects (portfolio,
   music, toys). Never use it in work tools or data apps. In a personal
   project, AK's register:
   - Field labels can be human: "Thoughts", not "Message".
   - Buttons can talk: "Knock, knock..." for contact/invite actions.
   - Empty states are plainspoken, slightly self-deprecating, never corporate:
     "Nothing here yet. That's ok with me." — never "No data available".
   - Release/version names go ALL CAPS with a joke inside when shipping
     (GRAVITY IS A MYTH); internal codenames are invented mouth-sounds
     (glorpla, fublet, durk nurk) in lowercase.
   - 404s and error pages are prime egg real estate.

## Motion eggs

The glyph morph (`data-wonk-glyph`) uses 561 mathematical, musical, technical,
arrow, and geometric symbols. A shuffled bag exhausts every symbol before
reuse and prevents a repeat at the reshuffle boundary. Hover cycles at 200ms;
each symbol moves 2px over 120ms. Leaving keeps the last symbol and shuffle
position. Click or keyboard activation plays a six-symbol burst. Escape stops
it, and reduced motion suppresses cycling. Color follows the surrounding
accent rather than implying a status.

```html
<button type="button" class="wonk-glyph" aria-label="Cycle symbols">
  <span data-wonk-glyph data-glyph-idle="0" aria-hidden="true">&#8767;</span>
</button>
```

The button is unframed with a stable 56px target and visible keyboard focus.
`data-glyph-idle="0"` stays still until interaction. Omit it to retain the
legacy 1500ms idle cycle. `wonk.glyph(el)` returns an idempotent handle with
`stop()`, `start()`, `next()`, and `destroy()`; dispose it before framework
unmount. `wonk.glyphs` exposes the frozen symbol pool. Font coverage depends
on the platform; the local Chromium rendering audit passes. Use one in a
brand corner or footer, not on every record or incident indicator.

### Rest glyph: a glyph that is an icon

`data-glyph-rest` turns the morph into an icon control. An icon must keep its
meaning, so it returns to its own glyph when interaction stops.

```html
<button type="button" class="wonk-glyph" aria-label="Radio" aria-pressed="false">
  <span data-wonk-glyph data-glyph-rest data-glyph-active-ms="700" aria-hidden="true">♫</span>
</button>
```

- At rest, the element shows its markup glyph. Wiring does not replace it.
- Hover or `:focus-visible` cycles at 200ms. Leave, blur, and Escape restore
  the rest glyph. A click plays the burst, then restores it.
- `handle.setActive(true)` cycles at `data-glyph-active-ms` (default 700) with
  no hover. Use it for "playing" or "working". `setActive(false)` restores the
  rest glyph. Hover during the active state strobes, then returns to it.
- A disabled trigger and reduced motion (also when it turns on mid-session)
  always show the rest glyph.
- Rest mode has no idle cycle. `data-glyph-idle` other than 0 throws, an
  empty markup glyph throws, and `setActive` without `data-glyph-rest` throws.
- Pick the rest glyph from the text-safe list in
  [components.md § icon glyphs](components.md#icon-glyphs).

The type scatter (`data-wonk-scatter`) makes a short display word spring
apart letter-by-letter on hover and snap back on leave. Hero titles and
wordmarks only, never body text, one per view.

Everything respects `prefers-reduced-motion` (wonk.js checks; keep it that
way).

## The line

Eggs are for delight, not confusion. Never hide navigation, settings, or data
behind an egg. Never let an egg mutate data. If a user files a bug about an
egg, the egg is too loud.
