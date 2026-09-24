# radio plays a public catalog with no server

`assets/wonk-radio.css` and `assets/wonk-radio.js` add a shuffle player to any
WONK page. it lists a public GCS bucket in the browser and streams each file
with range requests. `demo/radio.html` has a live player on `gs://aktunes/music/`
and a dock toggle.

## install

```html
<link rel="stylesheet" href="../assets/wonk-tokens.css">
<link rel="stylesheet" href="../assets/wonk.css">
<link rel="stylesheet" href="../assets/wonk-radio.css">
<script defer src="../assets/wonk-radio.js"></script>
```

load the css after `wonk.css`. the pack reuses `.wonk-btn`, `.wonk-range`,
`.wonk-label`, `.wonk-num`, and `.wonk-dot` without restyling them. it has no
package dependencies and does not need `wonk.js`.

## markup and attributes

```html
<section class="wonk-radio" data-wonk-radio
         data-bucket="aktunes" data-prefix="music/"
         aria-label="Radio"></section>
```

| attribute | does |
|---|---|
| `data-wonk-radio` | auto-mounts on `DOMContentLoaded` |
| `data-bucket` + `data-prefix` | lists a public GCS bucket under that prefix |
| `data-manifest="tracks.json"` | loads a JSON array of URL strings or `{url, title?, artist?, number?}` objects instead |
| `data-title` | station label, default `radio` |
| class `wonk-radio--dock` | fixed full-width bar at the bottom of the viewport |

the script replaces the host's content with the player. leave the host empty.
while a dock is mounted, `<html>` has the class `wonk-has-radio-dock` and the
variable `--wonk-radio-dock-h`. a `ResizeObserver` keeps the variable equal to
the dock's height. `body` padding and `.wonk-toasts` use it, so page content
and toasts stay above the bar. destroying the last dock removes both.

one row on wide containers (50rem and up). narrower containers wrap to two
rows: now playing and transport, then scope and seek. volume hides under a
520px viewport; phones have hardware volume.

## what it does

| behavior | rule |
|---|---|
| names | `001 - AK - slip.mp3` shows `slip`, meta `001 · AK · 17 / 143`. `Artist - Song.m4a` and `loose.mp3` also parse. the title keeps its own case. |
| shuffle bag | a `crypto.getRandomValues` permutation of every track. no track repeats until all have played. a new bag never starts with the track that just ended. |
| no autoplay | nothing plays until `play()` runs from a user action. play consent is never saved. a blocked `play()` shows `Playback was blocked. Press play again.` |
| race guard | `pause()` during a pending `play()` wins. the element pauses as soon as it starts. |
| one at a time | starting a player pauses every other player on the page. the paused one shows `Paused. Another player started.` |
| history | previous restarts the track after 3 seconds. before that it goes back one track. next after previous walks forward again. |
| seek | `input` previews the time readout, `change` seeks. times are `m:ss`, or `h:mm:ss` for an hour-long file. |
| volume | default 0.5. volume and mute persist in `localStorage["wonk-radio:volume"]` as `{v, muted}`. a value outside 0..1 or bad JSON falls back to 0.5. |
| media session | title, artist, and the station label as album. play, pause, previous, next, seek to, and 10s seek back/forward. position updates at most once per second. |
| failed track | status `Could not load "title". Skipping.`, then next. after 3 failures in a row the radio stops: `The radio stopped after 3 failed tracks. Press play to retry.` |
| list failure | status `Could not load the track list. Press play to retry.` play retries the listing. |

there is one `<audio>` element per player, with `preload="metadata"`. the next
track is not preloaded. the audio element loads nothing until the first play.
the hour-long file streams with range requests; there is no size cap.

## the scope draws real audio only

on the first user play, the pack creates an `AudioContext` inside the gesture.
once a CORS-mode source plays, it connects `MediaElementSource` to an
`AnalyserNode` (fftSize 1024). the scope draws the time-domain waveform in
`--ak-chart-1` with a faint `--ak-chart-2` copy offset by 32 samples. it reads
both tokens per frame, so theme and pair switches apply live.

the scope animates only while audio plays, the tab is visible, and reduced
motion is off. otherwise it stops its animation loop and shows a flat hairline.
it never animates an invented wave.

## use the API

```js
wonkRadio.init(scope);          // mounts every [data-wonk-radio] in scope, once per host
wonkRadio.destroy(scope);       // tears down every player in scope
const radio = wonkRadio.mount(el, { tracks: [{ url, title, artist }], title: 'studio' });
wonkRadio.get(el);              // the controller, or null

radio.play(); radio.pause(); radio.toggle(); radio.next(); radio.prev();
radio.seek(90);                 // false while the duration is unknown
radio.setVolume(0.3);           // clamps to 0..1, persists
radio.setMuted(true);           // persists
radio.state;    // {playing, loading, error, visualizer, index, position, total, volume, muted}
radio.tracks; radio.current; radio.audio; radio.analyser; // analyser is null until created
radio.destroy();
```

`mount` options are `bucket`, `prefix`, `manifest`, `tracks`, and `title`.
options win over data attributes. `mount` on a mounted host returns the same
controller. a host with no source throws a `TypeError`; `init()` reports it
and keeps mounting the other hosts. `state.playing` means the radio is on
(play intent and an unpaused element). `state.position` is the 1-based place
in the catalog. `visualizer` is `"pending"`, `"on"`, or `"off"`.

`destroy()` pauses, clears `src`, closes the `AudioContext`, cancels the
animation frame, removes every listener and Media Session handler, and empties
the host.

pure helpers, for tests and custom sources:

```js
wonkRadio.parseName('music/005 - AK - don\'t say.mp3'); // {number:'005', artist:'AK', title:"don't say"}
wonkRadio.mediaUrl('aktunes', 'music/001 - AK - slip.mp3');
await wonkRadio.listBucket('aktunes', 'music/', { fetch });  // [{name, size}], sorted, audio only
wonkRadio.shuffleBag(10, { last: 3, random });                // permutation of 0..9
wonkRadio.formatTime(3725);                                   // "1:02:05"
```

events fire on the host:

| event | detail | when |
|---|---|---|
| `wonk-radio:track` | `{track, index, position, total}` | the current track changes, including the first one |
| `wonk-radio:state` | `{playing, loading, error, visualizer}` | any of those values changes |

## host a catalog

1. put audio files in a bucket under one prefix.
2. grant `allUsers` the role `roles/storage.objectViewer`.
3. point the player at it with `data-bucket` and `data-prefix`.

the player lists with the JSON API and plays from the JSON API media URL,
`https://storage.googleapis.com/storage/v1/b/<bucket>/o/<encoded name>?alt=media`.
those URLs send CORS headers and honor range requests, so the scope works
without a CORS config on the bucket. the XML URL
(`storage.googleapis.com/<bucket>/<name>`) sends no CORS headers; don't use it.

other hosts need CORS for the scope. a media error does not say why a load
failed. so when a CORS-mode load fails before the analyser exists, the player
probes the same URL with `fetch` (`mode: "cors"`, `Range: bytes=0-1`):

| probe result | meaning | action |
|---|---|---|
| any HTTP response, even 404 | CORS works, the track is bad | skip it; the scope stays available |
| rejected with `TypeError` | no CORS headers (or no network) | swap to a plain audio element, retry the track once; the scope stays flat for the session |

a track change, a newer probe, or `destroy()` makes a pending probe stale; its
result is ignored. a CDN or a private host can use `data-manifest` instead.

## accessibility and reduced motion

- every control is a native button or range. there are no global shortcuts.
- transport buttons have `aria-label`s. play reads `Play` or `Pause`. mute is a
  toggle with `aria-pressed`.
- the seek range has `aria-valuetext` like `1:23 of 3:45`.
- `role="status"` announces track changes and errors only, never time updates.
- the station row shows state as text (`ready`, `loading`, `playing`, `paused`,
  `stopped`, `error`), not only as the dot color.
- the dot blinks only while audio actually plays.
- reduced motion stops the scope animation and the dot blink. the pack reads the
  preference live, so a change during the session applies at once.
- every control shows a `:focus-visible` outline. icon buttons are 44px.

## run the browser checks

open `demo/radio.html`, then run:

```js
await wonkRadioChecks.run();
// { passed, failed, results: [{ name, pass, message }] }
```

`demo/radio-checks.js` covers name parsing, media URLs, shuffle bags, paged
listing, accessible markup, no autoplay, transport, volume persistence, failed
track skip and stop, init/destroy/dock lifecycle with `--wonk-radio-dock-h`,
Media Session metadata, the CORS probe on a same-origin 404, and one player at
a time. fixtures are Blob URLs of a generated silent WAV. the only requests go
to missing files on the page's own origin, for real 404s. automated browsers
need `--autoplay-policy=no-user-gesture-required`.

also listen to the live player, try both themes and a phone width, and test the
real OS reduced-motion setting. the checks do not prove the sound is good.
