# Easter eggs & microcopy

WONK apps hide things. The aktunes site put a base64 puzzle behind a hover
overlay reading "Oh... interesting" and logged "you're getting warmer..." to
the console. That habit is an official part of the system: every WONK app
ships at least one hidden thing and one piece of playful microcopy. Serious
tools earn the right to be playful by being excellent everywhere else — the
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
3. **Microcopy voice** (mandatory). AK's register:
   - Field labels can be human: "Thoughts", not "Message".
   - Buttons can talk: "Knock, knock..." for contact/invite actions.
   - Empty states are plainspoken, slightly self-deprecating, never corporate:
     "Nothing here yet. That's ok with me." — never "No data available".
   - Release/version names go ALL CAPS with a joke inside when shipping
     (GRAVITY IS A MYTH); internal codenames are invented mouth-sounds
     (glorpla, fublet, durk nurk) in lowercase.
   - 404s and error pages are prime egg real estate.

## Motion eggs

The glyph morph (`data-wonk-glyph`) is the sanctioned toy: slow 1500ms cycle,
random glyph + color + a small springy scale/rotate wobble; hover turns it
into the 100–180ms irregular strobe. Use it in brand corners, footers, empty
states — one per view, not one per component.

The type scatter (`data-wonk-scatter`) makes a short display word spring
apart letter-by-letter on hover and snap back on leave. Hero titles and
wordmarks only, never body text, one per view.

Everything respects `prefers-reduced-motion` (wonk.js checks; keep it that
way).

## The line

Eggs are for delight, not confusion. Never hide navigation, settings, or data
behind an egg. Never let an egg mutate data. If a user files a bug about an
egg, the egg is too loud.
