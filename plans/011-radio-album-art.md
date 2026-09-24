# Plan 011: The radio shows each track's album art, and hover or focus shows it bigger

> **Executor instructions**: Follow the steps. Write each new check first,
> watch it fail, then implement. Run every verification. Touch only the files
> in scope. Do not commit. Do not edit anything under `plans/`. STOP and
> report if a STOP condition occurs.

## Status

- **Depends on**: head of branch `wonk-oneshot` (plans 001-010 landed; `npm test` 184 passed)
- **Category**: feature (AK request before merge)
- **Planned at**: 2026-09-24

## Why

AK: "for the radio, is it possible to get the album art somewhere in the
player? and on hover on the album art, it shows you a bigger version of the
thumbnail? we do this in dm4". dm4 shows a 44px cover next to the title and an
enlarged cover in a tooltip on hover or focus
(`/Users/ak/code/dm4/ui/src/v5/ForgeMusic.jsx:158-164`, read-only). dm4 gets
the cover on its server; WONK's radio has no server, so it must read the
cover from the mp3 in the browser.

## Facts verified before writing this plan

- Every sampled file in `gs://aktunes/music/` (8 of 143, random) starts with an
  **ID3v2.3** tag (flags 0) that holds an **APIC** frame with `image/jpeg`.
  Tag sizes range from 8 KB to 162 KB.
- The JSON API media URL the radio already uses
  (`https://storage.googleapis.com/storage/v1/b/aktunes/o/<encodeURIComponent(name)>?alt=media`)
  sends CORS headers and answers `Range` requests with `206`. So
  `fetch(url, {headers: {Range: "bytes=0-9"}})` reads the 10-byte header, and a
  second range fetch reads the tag.
- ID3 header: bytes 0-2 `"ID3"`, byte 3 major version (2, 3, 4), byte 5 flags
  (0x80 unsynchronisation, 0x40 extended header), bytes 6-9 tag size as a
  28-bit synchsafe integer (7 bits per byte), not counting the 10-byte header.
- Frames: v2.3/v2.4 have a 10-byte frame header (4-char id, 4-byte size,
  2 flag bytes). v2.3 size is a plain big-endian integer; v2.4 size is
  synchsafe. v2.2 has 6-byte frame headers (3-char id, 3-byte size) and uses
  `PIC` with a 3-char image format (`JPG`/`PNG`) instead of a MIME string.
- APIC body: 1 byte text encoding, MIME string (latin1, null-terminated),
  1 byte picture type (3 = front cover), description (null-terminated: 1 null
  byte for encodings 0 and 3, 2 null bytes for encodings 1 and 2), then image bytes.

## Current state of the pack

- `assets/wonk-radio.js` (~1100 lines, `window.wonkRadio`, frozen). Pure
  helpers at the top (`parseName`, `mediaUrl`, `listBucket` with injectable
  `fetch`, `shuffleBag`), `renderUI(host, label)` at ~line 225 builds the
  scope canvas (`.wonk-radio-scope`), the now-playing block (`.wonk-radio-now`),
  transport, seek, volume, status. `updateMetadata()` at ~line 651 sets
  `navigator.mediaSession.metadata` (`MediaMetadata({title, artist, album})`)
  for the player that owns the Media Session.
- `assets/wonk-radio.css`: inline layout; container switch at 50rem; phone
  dock under 520px hides the scope and station line (dock ≈108px tall — keep
  it ≤ 110px).
- `demo/radio-checks.js`: 12 checks, `{name, fn}` array, `run()` returns
  `{passed, failed, results}`; fixture tracks are Blob URLs of a generated WAV.
- `references/radio.md`, `demo/radio.html`.
- Base `wonk.js` (optional for the radio) provides
  `wonk.tip(root, selector, render)` → `{destroy}`: a hover/focus/tap tip with
  Escape, viewport clamping, placement above/below, screen-reader text from the
  rendered node's `textContent`. `render(el)` returns a Node or a string (text).
  It adds no `tabindex`. The tip box is the inverted ink box, max width
  `min(20rem, 100vw - 16px)`.

## Design

### Reading the art (pure, testable)

- `wonkRadio.parseId3Picture(bytes)` → `{mime, data: Uint8Array, type}` or
  `null`. Input: a `Uint8Array` holding the tag **including** its 10-byte
  header. Handles v2.2 (`PIC`), v2.3 and v2.4 (`APIC`); tag-level
  unsynchronisation (remove a `0x00` that follows `0xFF`) and the extended
  header (skip it; its size is synchsafe in v2.4, plain in v2.3); in v2.4,
  skip a frame whose flags say compressed or encrypted, and strip the 4-byte
  data-length indicator when that flag is set. Prefer picture type 3 (front
  cover); else the first picture. Stop at padding (a zero byte where a frame
  id starts). Never read past the buffer; a malformed tag returns `null`.
- `wonkRadio.readArt(url, {fetch = window.fetch, signal, maxBytes = 2_000_000} = {})`
  → `Promise<{mime, blob} | null>`: range-fetch bytes 0-9; not `"ID3"` → `null`;
  size > `maxBytes` → `null`; range-fetch the rest of the tag; parse; wrap the
  picture in a `Blob` with its MIME (v2.2 `JPG` → `image/jpeg`, `PNG` →
  `image/png`). Network or HTTP errors reject (the caller decides).

### Player behavior

- When a track becomes current (including the first track shown before
  play), start `readArt(track.url)` with an `AbortController`; abort the
  previous one on change; ignore stale results (track changed, player
  destroyed).
- Keep an in-memory cache of object URLs keyed by track URL, at most 12;
  revoke evicted URLs and all of them on `destroy()`.
- Art found → show it; none → hide the art slot (`hidden`), no placeholder box.
- A failed art read never changes playback or the status line. Log one
  `console.warn` per player the first time an art read rejects (for example a
  host without CORS), naming the reason; later failures are silent for that
  player. `readArt` resolving `null` (no picture) is not a failure.
- `state.art`: `"loading" | "on" | "none"`; include it in `wonk-radio:state`.
- Media Session: when art is on, add `artwork: [{src: objectUrl, type: mime}]`
  to the `MediaMetadata` (update the metadata when the art arrives).
- `mount(el, opts)` accepts `opts.fetch` (used for listing and art; tests
  inject a fake). Default `window.fetch`.

### UI

- `renderUI` adds, before the title text inside the now-playing area, a
  `span.wonk-radio-art` with `tabindex="0"`, `role="img"`,
  `aria-label="Album art: <title>"`, holding an `img` (`alt=""`,
  `decoding="async"`). 44px square (40px in the phone dock), `object-fit: cover`,
  4px radius, hairline border, visible `:focus-visible` ring. `hidden` until art exists.
- Enlarge: when `window.wonk && typeof wonk.tip === "function"`, register
  `wonk.tip(host, ".wonk-radio-art", render)` once per player, where
  `render` returns a small fragment: an `img` of the same object URL,
  240px square max (`max-width: 100%`), and a one-line caption
  (`title · artist`, mono xs) as a text node so screen readers get it.
  Destroy the handle in `destroy()`. Without `wonk.js`, the thumbnail still
  shows; document that the enlarge needs `wonk.js`.
- Class names and tokens only; no hex colors. Keep the phone dock ≤ 110px
  tall at 390×844 (measure).

## Scope

**In scope**: `assets/wonk-radio.js`, `assets/wonk-radio.css`,
`demo/radio-checks.js`, `demo/radio.html` (one sentence about the art),
`references/radio.md` (art behavior, `readArt`, `parseId3Picture`, `state.art`,
enlarge needs wonk.js, hosts without CORS show no art).

**Out of scope**: every other file. Another person is editing
`assets/wonk.css`, `demo/index.html`, `references/components.md` right now.
Never `git add -A`.

## Steps

1. Checks first in `demo/radio-checks.js` (build ID3 bytes in the check with a
   tiny helper; use a 1×1 PNG or a few JPEG marker bytes as the image data):
   1. `parseId3Picture` v2.3 APIC (encoding 0, type 3) → mime and exact bytes.
   2. v2.4 with a synchsafe frame size larger than 127 (so the encoding matters) → correct bytes.
   3. v2.2 `PIC` with `JPG` → `image/jpeg`.
   4. two pictures, type 0 first then type 3 → returns the type 3 one.
   5. UTF-16 description (encoding 1, double-null terminator) → correct image start.
   6. tag-level unsynchronisation (`FF 00` pairs inside) → decoded bytes.
   7. no `ID3` / tag with only a `TIT2` frame / truncated tag → `null`, no throw.
   8. `readArt(url, {fetch: fake})` where the fake serves `Range` slices of an
      in-memory buffer → a Blob with the right type and size; a fake that
      returns a non-ID3 file → `null`; a fake that rejects → rejects.
   9. mount with `opts.fetch` fake and fixture tracks whose "files" carry art
      (the fake answers range requests for the track URLs; playback of those
      URLs is not needed for this check) → `.wonk-radio-art` becomes visible
      with an `img[src^="blob:"]`, `state.art === "on"`; switching to a track
      without art hides it and `state.art === "none"`; `destroy()` revokes URLs
      (spy on `URL.revokeObjectURL`).
   10. with `wonk.tip` available (it is on radio.html if wonk.js is loaded —
       check; if not loaded, load order is out of scope: STOP), focusing
       `.wonk-radio-art` shows the hint box containing an `img`.
   Run the radio suite → the new checks fail.
2. Implement. `npm test -- radio` → all pass.
3. Live check with Playwright on `/demo/radio.html` (server: `npm run serve` or
   the runner's server): after load, the inline player's art is visible for the
   first track (network needed; if the network is down say so), hover it → the
   bigger image shows. Screenshot `/tmp/wonk-radio-art-{dark,paper}-1280.png`
   (hover state) and `/tmp/wonk-radio-art-dock-390.png`. Measure the phone dock height.
4. Docs: `references/radio.md`, one sentence in `demo/radio.html`.
5. `npm test` → all pass.

## Done criteria

- [ ] `npm test` exits 0; the new radio checks pass
- [ ] live art shows on the real bucket (or NOTES says the network was down)
- [ ] phone dock ≤ 110px at 390×844 (report the number)
- [ ] no hex colors in the pack; `git status --short` shows only in-scope files (plus others' edits to wonk.css / index.html / components.md)

## STOP conditions

- The real files' tags do not parse (report the header bytes of one file).
- `demo/radio.html` does not load `wonk.js` (then report; do not edit load order outside scope).
