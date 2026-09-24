# Plan 007: A `wonk-radio` pack plays random songs from a public GCS bucket with no server

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Your reviewer maintains `plans/README.md`; do not
> edit it.
>
> **Drift check (run first)**: `ls assets/wonk-radio.* demo/radio* references/radio.md 2>/dev/null`
> → must print nothing (all files are new). If any exist, STOP.

## Status

- **Priority**: P1 (owner request)
- **Effort**: M
- **Risk**: LOW (new optional pack, new files only)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `ea62dcd`, 2026-09-24

## Why this matters

AK (the owner) wants a radio in WONK apps: a player that plays random songs
from his catalog. His other app (dm4) has one, but it needs an Express
server that lists a private bucket and streams bytes. The catalog is now
public at `gs://aktunes/music/` (143 mp3 files, names like
`001 - AK - slip.mp3`, one file is 57 MB / 1 hour). A static page can list
and stream it directly. After this plan, one line of markup gives any WONK
page a working radio with shuffle, transport, seek, volume, Media Session,
and a real-audio scope visualizer.

## Facts verified before this plan was written

- Anonymous listing works and sends CORS headers (tested with curl and an
  `Origin` header):
  `GET https://storage.googleapis.com/storage/v1/b/aktunes/o?prefix=music/&fields=nextPageToken,items(name,size)`
  → `200`, `access-control-allow-origin: <origin>`, JSON `{items:[{name,size}], nextPageToken?}`.
- The **JSON API media URL** sends CORS headers AND supports Range:
  `GET https://storage.googleapis.com/storage/v1/b/aktunes/o/music%2F001%20-%20AK%20-%20slip.mp3?alt=media`
  with `Range: bytes=0-15` → `206`, `content-type: audio/mpeg`,
  `access-control-allow-origin: <origin>`. Preflight for `range` is allowed.
- The **XML URL** `https://storage.googleapis.com/aktunes/music/...` works
  for plain playback but sends **no** CORS headers (the bucket has no CORS
  config). Use the JSON API media URL, never the XML URL.
- Why CORS matters: routing an `<audio>` element through Web Audio
  (`createMediaElementSource` → `AnalyserNode`) with a cross-origin source
  that lacks CORS outputs **silence**. With `audio.crossOrigin =
  "anonymous"` and a non-CORS server, the element fails to load instead.
  A MediaElementSource cannot be disconnected once created.
- Object names contain spaces, apostrophes, parentheses
  (`005 - AK - don't say.mp3`, `088 - AK - AK's originals (1hr).mp3`).
  Encode the whole object name with `encodeURIComponent` (that turns `/`
  into `%2F`, which the JSON API requires).
- dm4's behavior to keep: never autoplay (sound only after a click); volume
  survives reload, play consent does not; a quick off/on must not leave a
  stale `play()` running. dm4's gaps to fix: pure random (only avoids an
  immediate repeat), no previous, no seek, no Media Session, no auto-skip on
  a failed track.

## Current state of WONK (what to build on)

- Repo: `/Users/ak/.agents/skills/ak-web-design`. Vanilla CSS/JS, no build.
  Tokens in `assets/wonk-tokens.css` (`--ak-*`), components in
  `assets/wonk.css`, behaviors in `assets/wonk.js`. Optional packs are
  pairs like `assets/wonk-motion.css` + `assets/wonk-motion.js`, each with a
  reference doc (`references/motion.md`) and a gallery (`demo/motion.html`)
  and a check suite (`demo/motion-checks.js`). Model the pack on
  `assets/wonk-motion.js` (IIFE, `"use strict"`, frozen public API on
  `window`, live `matchMedia` for reduced motion at `wonk-motion.js:25,210-213`).
- Classes to reuse, do not restyle: `.wonk-btn`, `.wonk-btn--primary`,
  `.wonk-btn--quiet` (`wonk.css:91-122`; note `.wonk-btn` is uppercase mono),
  `.wonk-range` (`wonk.css:344-356`), `.wonk-label`, `.wonk-num`,
  `.wonk-dot`, `.wonk-dot--idle`, `.wonk-dot--live` (`wonk.css:612-620`).
- Tokens: spacing `--ak-s1..s16`, `--ak-radius`, `--ak-hairline-w`,
  `--ak-hairline`, `--ak-hairline-strong`, `--ak-ground`, `--ak-surface`,
  `--ak-ink`, `--ak-ink-2`, `--ak-ink-3`, `--ak-a1`, `--ak-a1-text`,
  `--ak-chart-1`, `--ak-chart-2`, `--ak-t-fast`, `--ak-ease`,
  `--ak-font-mono`, `--ak-font-sans`, `--ak-text-xs`, `--ak-text-sm`.
  Never write a hex color in the pack; read tokens.
- WONK rules that apply:
  - Numbers and times are mono and tabular (`.wonk-num`).
  - Never fake activity: the scope draws only real analyser data. When no
    analyser is available, draw a flat static line. Never animate a fake wave.
  - Jitter/blink (`.wonk-dot--live`) only on live states: use it while
    audio is actually playing, `.wonk-dot--idle` otherwise.
  - Respect `prefers-reduced-motion`, including changes during the session:
    no scope animation under reduced motion (static line).
  - `input` previews, `change` commits: the seek range updates the time
    readout on `input`, and seeks the audio on `change`.
  - Visible copy is plain and short. No jokes in status text.
  - 4px radius, hairline borders, both themes (dark default, `data-theme="paper"`).
- Gallery page pattern: copy the head, topbar (back link, pair label,
  theme toggle), and `<style>` helpers from `demo/instruments.html:1-110`
  and its theme-toggle script (`demo/instruments.html:324-335`).

## Scope

**In scope** (create only):
- `assets/wonk-radio.css`
- `assets/wonk-radio.js`
- `references/radio.md`
- `demo/radio.html`
- `demo/radio-checks.js`

**Out of scope** (do NOT touch — other executors are editing these right now):
- Every existing file: `README.md`, `SKILL.md`, `references/components.md`,
  `demo/index.html`, `demo/catalog.*`, all other `assets/*`, `package.json`,
  `scripts/`, `.github/`. Your reviewer links the pack into the docs and the
  check runner afterwards.
- Never `git add -A`; never delete files you did not create.

## Git workflow

Do not commit. Your reviewer commits after review.

## Design (build exactly this)

### Markup contract

```html
<link rel="stylesheet" href="assets/wonk-radio.css">   <!-- after wonk.css -->
<script defer src="assets/wonk-radio.js"></script>

<section class="wonk-radio" data-wonk-radio
         data-bucket="aktunes" data-prefix="music/"
         aria-label="Radio"></section>
```

Attributes:
- `data-bucket` + `data-prefix`: list a public GCS bucket.
- `data-manifest="tracks.json"`: alternative source, a JSON array of
  strings (URLs) or objects `{url, title?, artist?, number?}`.
- `data-title`: station label, default `radio`.
- Class `wonk-radio--dock`: fixed full-width bar at the bottom of the
  viewport. While a dock is mounted, JS adds class `wonk-has-radio-dock` to
  `<html>`; the CSS gives `body` enough `padding-bottom` so content is not
  hidden. Remove the class on destroy.

The JS renders the inner UI into the host (empty host expected). Auto-init
on `DOMContentLoaded` for every `[data-wonk-radio]`.

### Rendered UI (inside the host)

1. `canvas.wonk-radio-scope` (`aria-hidden="true"`), ~120×40 CSS px, drawn
   at devicePixelRatio.
2. Now playing: `.wonk-label` row with a status dot and the station label;
   `.wonk-radio-title` (sans, ink, one line, ellipsis); `.wonk-radio-meta`
   (mono, ink-3, `.wonk-num`): `001 · AK · 17 / 143` (track number from the
   file name, artist, position in the catalog).
3. Transport: previous, play/pause (`.wonk-btn--primary`), next. Icon-only
   buttons with inline SVG (stroke `currentColor`, `aria-hidden`) and an
   `aria-label` that changes between `Play` and `Pause`.
4. Seek: current time, `input.wonk-range` (`aria-label="Seek"`,
   `aria-valuetext="1:23 of 3:45"`), duration. Times `m:ss` (or `h:mm:ss`
   when ≥ 1 hour), mono tabular.
5. Volume: mute button (`aria-pressed`) + `input.wonk-range`
   (`aria-label="Volume"`). Hidden under 520px viewport width.
6. `p.wonk-radio-status` with `role="status"` and `aria-live="polite"`.
   Announce only track changes and errors, never time updates.

Before the first play: title shows the first track of the shuffle bag,
status reads `Press play to start.` Layout: one row on wide screens, wraps
to two rows (now playing + transport, then seek) on narrow screens.

### Behavior

- **Listing**: `listBucket(bucket, prefix)` pages through
  `nextPageToken`, keeps audio extensions (`mp3 m4a aac ogg oga opus wav flac`),
  drops folder placeholders, sorts by name. Listing happens once at mount.
  On failure: status `Could not load the track list. Press play to retry.`
  and the play button retries the listing.
- **Media URL**: `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`.
- **Names**: `parseName("001 - AK - slip.mp3")` → `{number:"001", artist:"AK", title:"slip"}`;
  `"Artist - Song.m4a"` → `{artist:"Artist", title:"Song"}`;
  `"loose.mp3"` → `{title:"loose"}`. Strip the prefix path and extension.
  Keep the title's own case.
- **Shuffle bag**: a permutation of all track indices using
  `crypto.getRandomValues`. Play through the bag; when empty, build a new
  bag, and if its first index equals the last played index, swap it with
  another position. No track repeats until every track has played.
- **History**: `prev()` restarts the current track if `currentTime > 3`,
  else goes back one step in play history (if none, restarts).
- **One `<audio>` element per player**, `preload="metadata"`,
  `crossOrigin = "anonymous"`.
- **No autoplay**: nothing plays until `play()` is called from a user
  action. `play()` handles the `play()` promise rejection by showing
  `Playback was blocked. Press play again.`
- **Race guard**: keep a `playIntent` flag. If `pause()` runs while a
  `play()` promise is pending, the element pauses as soon as it starts.
- **Visualizer**: on the first successful user-initiated play, if
  `AudioContext` exists AND the current source loaded with
  `crossOrigin="anonymous"`, create `AudioContext` →
  `createMediaElementSource(audio)` → `AnalyserNode` (fftSize 1024) →
  destination, and resume the context. Draw the time-domain waveform with
  `--ak-chart-1` (read via `getComputedStyle` at draw time so theme and
  pair switches apply), 1.5px line, on a transparent canvas; a faint
  `--ak-chart-2` line of the same data offset by 32 samples. Animate only
  while playing, the document is visible, and reduced motion is off.
  Otherwise draw one flat hairline and stop the rAF loop.
- **CORS fallback**: if a source fails to load while `crossOrigin` is set
  and the graph has NOT been created yet, replace the audio element with a
  fresh one without `crossOrigin`, mark `visualizer = "off"`, and retry the
  same track once. Never create the graph in that mode.
- **Errors**: an audio `error` event on a track → status
  `Could not load "title". Skipping.` → `next()`. After 3 consecutive
  failures, stop: status `The radio stopped after 3 failed tracks. Press play to retry.`
  A successful `playing` event resets the counter.
- **Track end** → `next()` if play intent is on.
- **Volume**: default 0.5. Persist volume and mute in `localStorage` key
  `wonk-radio:volume` as JSON `{v, muted}`. Reject stored values that are
  not finite numbers in 0..1 (fall back to 0.5). Play consent is never persisted.
- **Media Session** (when `navigator.mediaSession` exists): on each track,
  set `MediaMetadata({title, artist, album: station label})`; handlers for
  `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`,
  `seekbackward`, `seekforward` (10s). Call `setPositionState` at most
  once per second and only when `duration` is finite and > 0. On destroy,
  set every handler back to `null`.
- **Keyboard**: native buttons and ranges only. No global shortcuts.
- **No preloading of the next track** (one element keeps the analyser
  graph valid; GCS range streaming starts fast). The 1-hour file streams
  with Range requests; do not add a size cap.
- **Events**: dispatch on the host element `wonk-radio:track`
  (`detail: {track, index, position, total}`) and `wonk-radio:state`
  (`detail: {playing, loading, error, visualizer}`).

### Public API (`window.wonkRadio`, frozen)

```js
wonkRadio.init(scope = document)      // mounts every [data-wonk-radio]; idempotent per element
wonkRadio.destroy(scope = document)   // tears down every player in scope
wonkRadio.mount(el, opts)             // opts: {bucket, prefix, manifest, tracks, title}
                                      // tracks: array of {url, title?, artist?, number?}
                                      // returns the controller (same one if already mounted)
wonkRadio.get(el)                     // controller or null
wonkRadio.parseName(name)
wonkRadio.mediaUrl(bucket, name)
wonkRadio.listBucket(bucket, prefix, {fetch} = {})  // fetch injectable for tests
wonkRadio.shuffleBag(n, {last, random} = {})        // random injectable for tests

controller: play(), pause(), toggle(), next(), prev(), seek(seconds),
  setVolume(0..1), setMuted(bool), destroy(),
  readonly state {playing, loading, error, visualizer: "on"|"off"|"pending",
                  index, position, total, volume, muted},
  readonly tracks, readonly current, readonly audio, readonly analyser (null until created)
```

`destroy()` pauses, clears `src`, closes the AudioContext, cancels rAF,
removes listeners and Media Session handlers, empties the host, removes
`wonk-has-radio-dock` when no dock remains.

## Steps

### Step 1: `assets/wonk-radio.js`
Implement the design. Pure helpers (`parseName`, `mediaUrl`, `listBucket`,
`shuffleBag`, time formatting) at the top so they are testable.

**Verify**: `node -e "new Function(require('fs').readFileSync('assets/wonk-radio.js','utf8'))" && echo ok` → `ok` (parses).

### Step 2: `assets/wonk-radio.css`
Tokens only; `grep -nE "#[0-9a-fA-F]{3,8}\b" assets/wonk-radio.css` must print nothing.
Include: default inline layout (surface card, hairline border, 4px radius),
`.wonk-radio--dock` (fixed bottom, full width, `border-top: var(--ak-hairline-w) solid var(--ak-a1)`,
`background: var(--ak-ground)`), `html.wonk-has-radio-dock body { padding-bottom: … }`,
narrow-screen wrap, volume hidden under 520px, visible `:focus-visible`
on every control, reduced-motion rule for any transition.

**Verify**: the grep above prints nothing.

### Step 3: `demo/radio-checks.js`
`window.wonkRadioChecks = { run, checks }`; `run()` returns
`{ passed, failed, results: [{name, pass, message}] }`. Model on
`demo/code-checks.js` (`{name, fn}` array, try/catch runner). **No network**:
build fixture tracks as Blob URLs of a generated 1-second silent WAV
(44-byte RIFF header + 16-bit PCM zeros, 8 kHz mono). Checks:

1. `parseName` cases from the design (3+ cases incl. the apostrophe/parentheses name).
2. `mediaUrl("aktunes", "music/005 - AK - don't say.mp3")` contains
   `/o/music%2F005%20-%20AK%20-%20don` and ends with `?alt=media`.
3. `shuffleBag`: n=10, 5 consecutive bags — each is a permutation of 0..9;
   first of each bag ≠ last of the previous (use a deterministic `random`).
4. `listBucket` with a fake `fetch` returning 2 pages (`nextPageToken` on page 1),
   including a `music/` placeholder and a `music/cover.jpg` → only audio
   items, merged, sorted.
5. Mount with fixture tracks: prev/play/next buttons exist with accessible
   names, seek and volume ranges have `aria-label`, a `role="status"`
   element exists, and `audio.paused === true` (no autoplay).
6. `play()` → within 3s `audio.paused === false`; `next()` changes
   `state.index`; `prev()` (with `currentTime` < 3) returns to the previous index.
7. `setVolume(0.3)` → `localStorage["wonk-radio:volume"]` parses to `v: 0.3`;
   a new mount reads 0.3; stored `"abc"` or `{v: 7}` → 0.5.
8. A track with a bad URL (`blob:` URL revoked, or `/does-not-exist.wav`)
   is skipped (index advances, status contains `Skipping`); 3 bad tracks in a
   row → `state.playing === false` and status contains `stopped`.
9. `init()` twice on the same host → one `.wonk-radio-scope` canvas;
   `destroy()` empties the host; a dock mount adds `wonk-has-radio-dock`
   to `<html>` and destroy removes it.
10. If `navigator.mediaSession` exists: after `play()`,
    `navigator.mediaSession.metadata.title` equals `current.title`.

Every check cleans up its hosts and `localStorage` key in `finally`.

**Verify**: Step 5's command.

### Step 4: `demo/radio.html`
Gallery page in the style of `demo/instruments.html` (head, topbar with
back link + pair label + theme toggle, `demo-main`). Load `wonk-tokens.css`,
`wonk.css`, `wonk-radio.css`, `wonk.js`, `wonk-radio.js`, `radio-checks.js`.
Sections: a live inline player on `aktunes` / `music/`; a button that
toggles a second player into dock mode (mount/destroy a
`.wonk-radio--dock` host); the one-line markup in a `<pre class="wonk-pre"><code>`
block; a short API table; a short note on hosting (public bucket, JSON API
media URLs send CORS, manifest option). Plain copy.

**Verify**: Step 5's command also loads this page without page errors.

### Step 5: Verify headless
The repo's `npm test` runner may not exist yet (another executor is
building it). Write a throwaway script OUTSIDE the repo,
`/tmp/wonk-radio-verify.mjs`: a `node:http` static server for the repo
root on a random port (with Range support for media), then Playwright
Chromium (`import { chromium } from "playwright"`; run it with
`NODE_PATH=$(npm root -g) node /tmp/wonk-radio-verify.mjs`, or install
playwright into `/tmp` with `npm i --prefix /tmp playwright` if that
fails) launched with `--autoplay-policy=no-user-gesture-required`; open
`/demo/radio.html`, collect `pageerror`s, `await wonkRadioChecks.run()`,
print results, exit 1 on any failure or page error.

**Verify**: the script exits 0; all 10 checks PASS; zero page errors.
Also confirm the live player listed the real bucket:
`page.evaluate(() => wonkRadio.get(document.querySelector('[data-wonk-radio]')).state.total)` → `143`
(network needed; if the network is down, say so in NOTES, do not fake it).

### Step 6: Screenshots
With the same script, save screenshots of `/demo/radio.html` in dark and
paper (`document.documentElement.setAttribute("data-theme","paper")`) at
1280×900 and 390×844 to `/tmp/wonk-radio-*.png`. Look at them. Nothing
may overflow horizontally at 390px; text must be readable in both themes.

**Verify**: 4 PNG files exist; report any visual problem you saw.

### Step 7: `references/radio.md`
Match the voice of `references/motion.md` (lowercase headings, short
sentences, tables). Sections: install; markup and attributes; what it does
(shuffle bag, no autoplay, history, seek, volume persistence, Media
Session, error skip); API and events; hosting a catalog (public GCS bucket
with `allUsers` → `roles/storage.objectViewer`; JSON API media URLs send
CORS so the visualizer works without a bucket CORS config; other hosts
need CORS for the visualizer, else it falls back to plain playback);
accessibility and reduced motion; checks (`await wonkRadioChecks.run()`).

**Verify**: `grep -c "wonkRadio\." references/radio.md` → ≥ 5.

## Done criteria

- [ ] `/tmp/wonk-radio-verify.mjs` exits 0, 10/10 checks PASS, 0 page errors
- [ ] live player reports `state.total === 143` (or NOTES says the network was down)
- [ ] `grep -nE "#[0-9a-fA-F]{3,8}\b" assets/wonk-radio.css assets/wonk-radio.js` → nothing
- [ ] `git status --short` lists only the 5 new files as your changes
- [ ] 4 screenshots taken and reviewed

## STOP conditions

- The JSON API media URL stops returning CORS headers or 206 (check with
  `curl -s -D - -o /dev/null -H "Origin: http://127.0.0.1" -H "Range: bytes=0-15" "<url>"`).
- Headless Chromium cannot play the WAV fixture even with the autoplay flag.
- The design requires editing any existing file.

## Maintenance notes

- dm4 (`/Users/ak/code/dm4`) has its own React radio; this pack does not
  replace it.
- If the bucket ever moves behind a CDN, pass a `data-manifest` instead.
- The reviewer adds `radio` to the check runner's `SUITES`, links the pack
  in README/SKILL/components, and adds the gallery link.
