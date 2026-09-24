/* ============================================================
   wonk-radio.js · shuffle radio pack for the WONK system
   Dependency-free. Pairs with assets/wonk-radio.css. Reads colors
   from wonk-tokens.css at draw time, so theme and pair switches
   apply to the scope without a reload.

   Plays random tracks from a public GCS bucket, a JSON manifest,
   or an explicit track list. No server. Never autoplays: sound
   starts only after play() runs from a user action.
   See references/radio.md for the full contract.

   API (window.wonkRadio, frozen):
     init(scope = document)     mount every [data-wonk-radio] in scope
     destroy(scope = document)  tear down every player in scope
     mount(el, opts)            opts: {bucket, prefix, manifest, tracks, title}
                                -> controller (same one if already mounted)
     get(el)                    -> controller or null
     parseName(name)            "001 - AK - slip.mp3" -> {number, artist, title}
     mediaUrl(bucket, name)     JSON API media URL (sends CORS, supports Range)
     listBucket(bucket, prefix, {fetch})  -> Promise<[{name, size}]>
     shuffleBag(n, {last, random})        -> permutation of 0..n-1
     formatTime(seconds, withHours)       -> "m:ss" or "h:mm:ss"

   controller: play() pause() toggle() next() prev() seek(s)
     setVolume(0..1) setMuted(bool) destroy()
     readonly state, tracks, current, audio, analyser, host
   ============================================================ */
(() => {
  "use strict";

  // ---- pure helpers (no DOM, testable) -------------------------

  const API_ROOT = "https://storage.googleapis.com/storage/v1/b/";
  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i;

  // "music/001 - AK - slip.mp3" -> {number:"001", artist:"AK", title:"slip"}
  // "Artist - Song.m4a"         -> {artist:"Artist", title:"Song"}
  // "loose.mp3"                 -> {title:"loose"}
  // Keys that are not present in the name are left out, not set to "".
  function parseName(name) {
    const base = String(name).split("/").pop();
    const stem = base.replace(/\.[A-Za-z0-9]{1,5}$/, "");
    const parts = stem.split(" - ").map((s) => s.trim());
    const out = {};
    if (parts.length >= 2 && /^\d+$/.test(parts[0])) out.number = parts.shift();
    if (parts.length >= 2) out.artist = parts.shift();
    out.title = parts.join(" - ");
    return out;
  }

  // The JSON API media URL sends CORS headers and honors Range. The
  // XML URL (storage.googleapis.com/<bucket>/<name>) does not send
  // CORS for a bucket without a CORS config, which silences the
  // analyser. encodeURIComponent turns "/" into "%2F", which the
  // JSON API requires for object names.
  function mediaUrl(bucket, name) {
    return `${API_ROOT}${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`;
  }

  // Lists a public bucket anonymously. Pages through nextPageToken,
  // keeps audio files only, drops folder placeholders, sorts by name.
  // Rejects on any HTTP failure; the caller decides what to show.
  async function listBucket(bucket, prefix = "", { fetch: fetchImpl } = {}) {
    const doFetch = fetchImpl || ((url) => window.fetch(url));
    const found = [];
    const seen = new Set();
    let pageToken = "";
    do {
      const url = new URL(`${API_ROOT}${encodeURIComponent(bucket)}/o`);
      url.searchParams.set("prefix", prefix);
      url.searchParams.set("fields", "nextPageToken,items(name,size)");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await doFetch(url.toString());
      if (!res.ok) {
        throw new Error(`wonk-radio: listing gs://${bucket}/${prefix} failed (HTTP ${res.status}).`);
      }
      const data = await res.json();
      if (Array.isArray(data.items)) found.push(...data.items);
      pageToken = data.nextPageToken || "";
      if (pageToken && seen.has(pageToken)) {
        throw new Error(`wonk-radio: listing gs://${bucket}/${prefix} returned page token "${pageToken}" twice.`);
      }
      seen.add(pageToken);
    } while (pageToken);
    return found
      .filter((it) => it && typeof it.name === "string" && !it.name.endsWith("/") && AUDIO_EXT.test(it.name))
      .map((it) => ({ name: it.name, size: it.size == null ? null : Number(it.size) }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  function cryptoRandom() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296; // [0, 1)
  }

  // Fisher-Yates permutation of 0..n-1. If the first index equals
  // `last` (the track that just played), swap it with another
  // position so a new bag never repeats the previous track.
  function shuffleBag(n, { last = -1, random = cryptoRandom } = {}) {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`wonkRadio.shuffleBag: n must be a non-negative integer, got ${n}.`);
    }
    const pick = (k) => Math.min(k - 1, Math.max(0, Math.floor(random() * k))); // 0..k-1
    const bag = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = pick(i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (n > 1 && bag[0] === last) {
      const k = 1 + pick(n - 1);
      [bag[0], bag[k]] = [bag[k], bag[0]];
    }
    return bag;
  }

  // 83 -> "1:23"; 3725 -> "1:02:05". withHours forces h:mm:ss so a
  // current time lines up with an hour-long duration.
  function formatTime(seconds, withHours = false) {
    if (!Number.isFinite(seconds) || seconds < 0) return "-:--";
    const t = Math.floor(seconds);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = String(t % 60).padStart(2, "0");
    return h > 0 || withHours ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  }

  function fileNameOf(url) {
    let last;
    try {
      last = new URL(url).pathname.split("/").pop();
    } catch {
      last = String(url).split("/").pop();
    }
    try {
      return decodeURIComponent(last);
    } catch {
      return last; // malformed percent-encoding: the raw segment is still a usable label
    }
  }

  // Manifest entries: strings (URLs) or {url, title?, artist?, number?}.
  // Throws on a malformed entry instead of skipping it.
  function normalizeTracks(list, where, base = document.baseURI) {
    if (!Array.isArray(list)) throw new TypeError(`wonk-radio: ${where} must be an array of tracks.`);
    return Object.freeze(list.map((entry, i) => {
      const item = typeof entry === "string" ? { url: entry } : entry;
      if (!item || typeof item.url !== "string" || !item.url) {
        throw new TypeError(`wonk-radio: ${where}[${i}] needs a url string.`);
      }
      const url = new URL(item.url, base).href;
      const parsed = parseName(fileNameOf(url));
      const track = { url, title: item.title != null ? String(item.title) : parsed.title };
      const artist = item.artist != null ? String(item.artist) : parsed.artist;
      const number = item.number != null ? String(item.number) : parsed.number;
      if (artist) track.artist = artist;
      if (number) track.number = number;
      return Object.freeze(track);
    }));
  }

  // ---- volume persistence --------------------------------------

  const STORAGE_KEY = "wonk-radio:volume";
  const DEFAULT_VOLUME = 0.5;

  function readVolume() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn("wonk-radio: localStorage is not readable, using the default volume.", err);
    }
    let v = DEFAULT_VOLUME;
    let muted = false;
    if (raw !== null) {
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null; // not JSON: documented fallback to the default volume
      }
      if (data && typeof data === "object") {
        if (typeof data.v === "number" && Number.isFinite(data.v) && data.v >= 0 && data.v <= 1) v = data.v;
        muted = data.muted === true;
      }
    }
    return { v, muted };
  }

  function writeVolume(v, muted) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v, muted }));
    } catch (err) {
      console.warn("wonk-radio: localStorage is not writable, volume will not survive a reload.", err);
    }
  }

  // ---- markup --------------------------------------------------

  const ICONS = {
    prev: '<path d="M4 3.5v9"/><path d="M12.5 3.5 6 8l6.5 4.5z" fill="currentColor"/>',
    next: '<path d="M12 3.5v9"/><path d="M3.5 3.5 10 8l-6.5 4.5z" fill="currentColor"/>',
    play: '<path d="M5 3.2v9.6L12.5 8z" fill="currentColor"/>',
    pause: '<path d="M5.5 3.5v9M10.5 3.5v9" stroke-width="2"/>',
    volume: '<path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5"/>',
    muted: '<path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"/><path d="M11 6l3 4M14 6l-3 4"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

  function node(tag, cls, attrs = {}) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function iconButton(cls, label, iconName) {
    const b = node("button", `wonk-btn ${cls} wonk-radio-btn`, { type: "button", "aria-label": label });
    b.innerHTML = icon(iconName);
    return b;
  }

  function renderUI(host, label) {
    const scope = node("canvas", "wonk-radio-scope", { "aria-hidden": "true" });

    const now = node("div", "wonk-radio-now");
    const station = node("div", "wonk-label wonk-radio-station");
    const dot = node("span", "wonk-dot wonk-dot--idle");
    const name = node("span", "wonk-radio-station-name");
    name.textContent = label;
    const sep = node("span", "wonk-radio-sep", { "aria-hidden": "true" });
    sep.textContent = "·";
    const stateWord = node("span", "wonk-radio-state");
    station.append(dot, name, sep, stateWord);
    const title = node("div", "wonk-radio-title");
    const meta = node("div", "wonk-radio-meta wonk-num");
    now.append(station, title, meta);

    const transport = node("div", "wonk-radio-transport", { role: "group", "aria-label": "Transport" });
    const prevBtn = iconButton("wonk-btn--quiet", "Previous track", "prev");
    const playBtn = iconButton("wonk-btn--primary wonk-radio-play", "Play", "play");
    const nextBtn = iconButton("wonk-btn--quiet", "Next track", "next");
    transport.append(prevBtn, playBtn, nextBtn);

    const progress = node("div", "wonk-radio-progress");
    const seekRow = node("div", "wonk-radio-seek");
    const cur = node("span", "wonk-radio-time wonk-num");
    const seek = node("input", "wonk-range", {
      type: "range", min: "0", max: "0", step: "1", value: "0", "aria-label": "Seek",
    });
    const dur = node("span", "wonk-radio-time wonk-radio-time--total wonk-num");
    seekRow.append(cur, seek, dur);
    const status = node("p", "wonk-radio-status", { role: "status", "aria-live": "polite" });
    progress.append(seekRow, status);

    const volume = node("div", "wonk-radio-volume");
    const muteBtn = iconButton("wonk-btn--quiet", "Mute", "volume");
    muteBtn.setAttribute("aria-pressed", "false");
    const vol = node("input", "wonk-range", {
      type: "range", min: "0", max: "1", step: "0.01", "aria-label": "Volume",
    });
    volume.append(muteBtn, vol);

    // The host is the size container; the inner grid is what the
    // container query re-flows (a container cannot restyle itself).
    const inner = node("div", "wonk-radio-inner");
    inner.append(scope, now, transport, progress, volume);
    host.replaceChildren(inner);
    return { scope, dot, stateWord, title, meta, prevBtn, playBtn, nextBtn, cur, seek, dur, status, muteBtn, vol };
  }

  // ---- player --------------------------------------------------

  const MAX_FAILURES = 3;
  const RESTART_AFTER = 3; // seconds: prev() past this point restarts the track
  const SEEK_STEP = 10;    // seconds, Media Session seekbackward/seekforward default
  const FFT_SIZE = 1024;
  const ECHO_OFFSET = 32;  // samples between the scope's two lines
  const HISTORY_CAP = 500;
  const SESSION_ACTIONS = ["play", "pause", "previoustrack", "nexttrack", "seekto", "seekbackward", "seekforward"];

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const registry = new WeakMap(); // host -> controller
  const players = new Map();      // live controller -> internal hooks
  const docks = new Set();        // live dock hosts
  const DOCK_VAR = "--wonk-radio-dock-h";
  let dockObserver = null;
  let sessionOwner = null;        // controller that owns navigator.mediaSession

  // Publishes the tallest mounted dock's height on <html> as
  // --wonk-radio-dock-h, so body padding and toasts clear the bar.
  // Both the class and the variable go when the last dock goes.
  function syncDocks() {
    const root = document.documentElement;
    if (!docks.size) {
      root.classList.remove("wonk-has-radio-dock");
      root.style.removeProperty(DOCK_VAR);
      return;
    }
    let h = 0;
    docks.forEach((el) => { h = Math.max(h, el.getBoundingClientRect().height); });
    root.style.setProperty(DOCK_VAR, `${Math.ceil(h)}px`);
    root.classList.add("wonk-has-radio-dock");
  }

  function addDock(el) {
    docks.add(el);
    if (!dockObserver) dockObserver = new ResizeObserver(syncDocks);
    dockObserver.observe(el);
    syncDocks();
  }

  function removeDock(el) {
    if (!docks.delete(el)) return;
    dockObserver.unobserve(el);
    syncDocks();
  }

  function resolveSource(host, opts) {
    const d = host.dataset;
    if (opts.tracks != null) return { tracks: normalizeTracks(opts.tracks, "opts.tracks") };
    if (opts.manifest) return { manifest: opts.manifest };
    if (opts.bucket) return { bucket: opts.bucket, prefix: opts.prefix ?? d.prefix ?? "" };
    if (d.manifest) return { manifest: d.manifest };
    if (d.bucket) return { bucket: d.bucket, prefix: d.prefix ?? "" };
    throw new TypeError(
      "wonkRadio.mount: give the host data-bucket (and data-prefix) or data-manifest, or pass opts.tracks."
    );
  }

  async function fetchTracks(source) {
    if (source.tracks) return source.tracks;
    if (source.manifest) {
      const manifestUrl = new URL(source.manifest, document.baseURI).href;
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`wonk-radio: manifest ${source.manifest} failed (HTTP ${res.status}).`);
      return normalizeTracks(await res.json(), `manifest ${source.manifest}`, manifestUrl);
    }
    const items = await listBucket(source.bucket, source.prefix);
    return Object.freeze(items.map((it) =>
      Object.freeze({ url: mediaUrl(source.bucket, it.name), name: it.name, size: it.size, ...parseName(it.name) })
    ));
  }

  function createPlayer(host, opts) {
    const source = resolveSource(host, opts); // throws on a missing source
    const stationLabel = opts.title || host.dataset.title || "radio";
    const isDock = host.classList.contains("wonk-radio--dock");
    const addedClass = !host.classList.contains("wonk-radio");
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    let tracks = Object.freeze([]);
    let bag = [];
    let back = [];          // play history before the current track
    let forward = [];       // tracks stepped back over with prev()
    let index = -1;
    let loadedIndex = -1;   // track whose URL the audio element holds
    let loadSeq = 0;        // bumps on every new src; stale async results check it
    let probe = null;       // AbortController of a pending CORS probe
    let listing = null;     // pending track-list promise
    let playIntent = false; // true between a user play() and pause()/stop
    let playSeq = 0;
    let loading = false;
    let error = null;
    let failures = 0;
    let announced = -1;
    let dragging = false;
    let destroyed = false;
    let visualizer = AudioCtx ? "pending" : "off";
    let actx = null;
    let sourceNode = null;
    let analyser = null;
    let samples = null;
    let raf = 0;
    let lastPositionAt = 0;
    let lastEmitted = "";
    let playIcon = "play";
    let muteIcon = "volume";
    let { v: volume, muted } = readVolume();
    const offs = [];

    const listen = (target, type, fn) => {
      target.addEventListener(type, fn);
      offs.push(() => target.removeEventListener(type, fn));
    };

    if (addedClass) host.classList.add("wonk-radio");
    const ui = renderUI(host, stationLabel);
    const g = ui.scope.getContext("2d");

    // Without an AudioContext there is no visualizer, so the element
    // never needs CORS and works with any host.
    let audio = createAudio(visualizer === "pending");

    function createAudio(withCors) {
      const a = document.createElement("audio");
      a.preload = "metadata";
      if (withCors) a.crossOrigin = "anonymous";
      a.volume = volume;
      a.muted = muted;
      return a;
    }

    const audioHandlers = {
      playing: onPlaying,
      pause: onPause,
      waiting: onWaiting,
      loadedmetadata: onDuration,
      durationchange: onDuration,
      timeupdate: onTime,
      ended: onEnded,
      error: onError,
    };
    const bindAudio = (a) => Object.entries(audioHandlers).forEach(([t, fn]) => a.addEventListener(t, fn));
    const unbindAudio = (a) => Object.entries(audioHandlers).forEach(([t, fn]) => a.removeEventListener(t, fn));

    // ---- derived state ----
    const isOn = () => playIntent && (!audio.paused || !!listing || !!probe);
    const isLoading = () => !!listing || (playIntent && loading);
    const loadedDuration = () => (loadedIndex === index && loadedIndex !== -1 ? audio.duration : NaN);

    // ---- output ----
    function setStatus(text) {
      if (ui.status.textContent !== text) ui.status.textContent = text;
    }

    function stateWord() {
      if (listing) return "loading";
      if (!tracks.length) return error === "No tracks found." ? "empty" : "error";
      if (isOn()) return isLoading() ? "loading" : "playing";
      if (failures >= MAX_FAILURES) return "stopped";
      return loadedIndex === -1 ? "ready" : "paused";
    }

    function syncUI() {
      if (destroyed) return;
      const on = isOn();
      const live = on && !isLoading() && !audio.paused;
      ui.dot.classList.toggle("wonk-dot--live", live);
      ui.dot.classList.toggle("wonk-dot--idle", !live);
      ui.stateWord.textContent = stateWord();
      const want = on ? "pause" : "play";
      if (want !== playIcon) {
        playIcon = want;
        ui.playBtn.innerHTML = icon(want);
      }
      ui.playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
      ui.muteBtn.setAttribute("aria-pressed", String(muted));
      if ((muted ? "muted" : "volume") !== muteIcon) {
        muteIcon = muted ? "muted" : "volume";
        ui.muteBtn.innerHTML = icon(muteIcon);
      }
      ui.vol.value = String(volume);
    }

    function emitState() {
      if (destroyed) return;
      const detail = { playing: isOn(), loading: isLoading(), error, visualizer };
      const key = JSON.stringify(detail);
      if (key === lastEmitted) return;
      lastEmitted = key;
      host.dispatchEvent(new CustomEvent("wonk-radio:state", { detail }));
    }

    function emitTrack() {
      host.dispatchEvent(new CustomEvent("wonk-radio:track", {
        detail: { track: tracks[index] || null, index, position: index + 1, total: tracks.length },
      }));
    }

    function showTrack() {
      const t = tracks[index];
      ui.title.textContent = t ? t.title : "";
      ui.title.title = t ? t.title : "";
      const bits = [];
      if (t && t.number) bits.push(t.number);
      if (t && t.artist) bits.push(t.artist);
      if (t) bits.push(`${index + 1} / ${tracks.length}`);
      ui.meta.textContent = bits.join(" · ");
    }

    function updateTimeUI(t = loadedIndex === index ? audio.currentTime : 0) {
      const d = loadedDuration();
      const known = Number.isFinite(d) && d > 0;
      const long = known && d >= 3600;
      const curText = formatTime(t, long);
      ui.cur.textContent = curText;
      ui.dur.textContent = known ? formatTime(d, long) : "-:--";
      ui.seek.max = known ? String(d) : "0";
      if (!dragging) ui.seek.value = String(t);
      ui.seek.setAttribute("aria-valuetext", known ? `${curText} of ${formatTime(d, long)}` : `${curText}, length unknown`);
    }

    // ---- scope: real analyser data only, else a flat line ----
    function shouldAnimate() {
      return !!analyser && !destroyed && playIntent && !audio.paused &&
        document.visibilityState === "visible" && !mql.matches;
    }

    function sizeCanvas() {
      const c = ui.scope;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(c.clientWidth * dpr));
      const h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      return { w, h, dpr };
    }

    // The flat hairline is the canvas's CSS baseline (wonk-radio.css),
    // so it follows theme switches without a redraw. Clearing the
    // canvas leaves exactly that line.
    function drawFlat() {
      if (destroyed) return;
      const { w, h } = sizeCanvas();
      g.clearRect(0, 0, w, h);
    }

    function trace(w, h, color, offset, alpha) {
      const n = samples.length - ECHO_OFFSET;
      const mid = h / 2;
      g.globalAlpha = alpha;
      g.strokeStyle = color;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = mid + ((samples[i + offset] - 128) / 128) * (mid - g.lineWidth);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      g.globalAlpha = 1;
    }

    function frame() {
      raf = 0;
      if (!shouldAnimate()) {
        drawFlat();
        return;
      }
      const { w, h, dpr } = sizeCanvas();
      analyser.getByteTimeDomainData(samples);
      const css = getComputedStyle(host); // read per frame: theme/pair switches apply live
      g.clearRect(0, 0, w, h);
      g.lineWidth = 1.5 * dpr;
      g.lineJoin = "round";
      trace(w, h, css.getPropertyValue("--ak-chart-2").trim(), ECHO_OFFSET, 0.35);
      trace(w, h, css.getPropertyValue("--ak-chart-1").trim(), 0, 1);
      raf = requestAnimationFrame(frame);
    }

    function updateScope() {
      if (destroyed) return;
      if (shouldAnimate()) {
        if (!raf) raf = requestAnimationFrame(frame);
        return;
      }
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      drawFlat();
    }

    // ---- Web Audio: context unlocked inside the user gesture, graph
    // connected only once a CORS-mode source is actually playing ----
    function unlockAudio() {
      if (actx && actx.state === "suspended") {
        actx.resume().catch((err) => console.warn("wonk-radio: AudioContext.resume() was rejected.", err));
      }
      if (actx || visualizer !== "pending" || audio.crossOrigin !== "anonymous") return;
      try {
        actx = new AudioCtx();
      } catch (err) {
        console.warn("wonk-radio: could not create an AudioContext, playing without the scope.", err);
        visualizer = "off";
        emitState();
        return;
      }
      actx.addEventListener("statechange", connectGraph);
      if (actx.state === "suspended") {
        actx.resume().catch((err) => console.warn("wonk-radio: AudioContext.resume() was rejected.", err));
      }
    }

    // Routing a media element through a context that is not running
    // would silence it, so connect only when the context runs and the
    // CORS-mode source has loaded and is playing.
    function connectGraph() {
      if (destroyed || !actx || sourceNode || visualizer !== "pending") return;
      if (actx.state !== "running" || audio.paused || audio.crossOrigin !== "anonymous" ||
          audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const an = actx.createAnalyser();
      an.fftSize = FFT_SIZE;
      try {
        sourceNode = actx.createMediaElementSource(audio);
      } catch (err) {
        console.warn("wonk-radio: could not route the audio element into Web Audio, playing without the scope.", err);
        visualizer = "off";
        emitState();
        return;
      }
      sourceNode.connect(an);
      an.connect(actx.destination);
      analyser = an;
      samples = new Uint8Array(an.fftSize);
      visualizer = "on";
      emitState();
      updateScope();
    }

    function closeContext() {
      if (!actx) return;
      actx.removeEventListener("statechange", connectGraph);
      actx.close().catch((err) => console.warn("wonk-radio: AudioContext.close() was rejected.", err));
      actx = null;
    }

    // ---- Media Session (global: the last player to play owns it) ----
    const sessionHandlers = {
      play: () => play(),
      pause: () => pause(),
      previoustrack: () => prev(),
      nexttrack: () => next(),
      seekto: (d) => { if (Number.isFinite(d.seekTime)) seek(d.seekTime); },
      seekbackward: (d) => { seek(audio.currentTime - (d.seekOffset || SEEK_STEP)); },
      seekforward: (d) => { seek(audio.currentTime + (d.seekOffset || SEEK_STEP)); },
    };

    function setHandler(action, fn) {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch (err) {
        // Feature detection: browsers throw a TypeError for actions
        // they do not support. The other actions still work.
        if (!(err instanceof TypeError)) throw err;
      }
    }

    function claimSession() {
      if (!navigator.mediaSession) return;
      if (sessionOwner !== ctrl) {
        sessionOwner = ctrl;
        SESSION_ACTIONS.forEach((a) => setHandler(a, sessionHandlers[a]));
      }
      updateMetadata();
    }

    function updateMetadata() {
      if (sessionOwner !== ctrl || !navigator.mediaSession || typeof MediaMetadata !== "function") return;
      const t = tracks[index];
      if (!t) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || "", album: stationLabel });
    }

    function setPlaybackState(s) {
      if (sessionOwner === ctrl && navigator.mediaSession) navigator.mediaSession.playbackState = s;
    }

    function positionState() {
      const ms = navigator.mediaSession;
      if (sessionOwner !== ctrl || !ms || typeof ms.setPositionState !== "function") return;
      const d = audio.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const now = performance.now();
      if (lastPositionAt && now - lastPositionAt < 1000) return;
      lastPositionAt = now;
      ms.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(Math.max(0, audio.currentTime), d) });
    }

    function releaseSession() {
      if (sessionOwner !== ctrl || !navigator.mediaSession) return;
      SESSION_ACTIONS.forEach((a) => setHandler(a, null));
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      sessionOwner = null;
    }

    // ---- track list ----
    async function loadTracks() {
      if (listing) return listing;
      error = null;
      const pending = fetchTracks(source);
      listing = pending;
      syncUI();
      emitState();
      let list = null;
      let failure = null;
      try {
        list = await pending;
      } catch (err) {
        failure = err;
      }
      listing = null;
      if (destroyed) return;
      if (failure) {
        console.error(failure);
        playIntent = false;
        error = "Could not load the track list.";
        setStatus("Could not load the track list. Press play to retry.");
      } else if (!list.length) {
        playIntent = false;
        error = "No tracks found.";
        setStatus("No tracks found. Press play to retry.");
      } else {
        tracks = list;
        bag = shuffleBag(tracks.length);
        index = bag.shift();
        showTrack();
        updateTimeUI(0);
        emitTrack();
        if (playIntent) start();
        else setStatus("Press play to start.");
      }
      syncUI();
      emitState();
    }

    // ---- transport ----
    function setSource(i) {
      cancelProbe();
      loadSeq += 1;
      loadedIndex = i;
      audio.src = tracks[i].url; // starts the load algorithm
    }

    function blocked() {
      playIntent = false;
      loading = false;
      error = "Playback was blocked.";
      setStatus("Playback was blocked. Press play again.");
      setPlaybackState("paused");
      syncUI();
      emitState();
      updateScope();
    }

    // Internal start: used by play() and by auto-advance.
    function start() {
      if (destroyed || !tracks.length) return;
      // One radio plays at a time: every other player on the page yields.
      players.forEach((hooks, other) => { if (other !== ctrl) hooks.yieldPlayback(); });
      playIntent = true;
      if (loadedIndex !== index || audio.error) setSource(index);
      loading = true;
      claimSession();
      setPlaybackState("playing");
      const el = audio;
      const seq = ++playSeq;
      const p = el.play();
      syncUI();
      emitState();
      if (!p || typeof p.then !== "function") return;
      p.then(() => {
        // Race guard: pause() ran while this play() was pending.
        if (!destroyed && el === audio && !playIntent) el.pause();
      }, (err) => {
        // A newer play(), a pause(), a track change, an element swap,
        // or destroy() superseded this request: its outcome is owned
        // by whatever superseded it.
        if (destroyed || seq !== playSeq || el !== audio || !playIntent) return;
        if (err && err.name === "NotAllowedError") return blocked();
        if (err && err.name === "AbortError") return; // load interrupted by a newer src
        if (el.error) return; // the element's error event handles skip and stop
        console.error("wonk-radio: play() failed.", err);
        blocked();
      });
    }

    function select(i) {
      index = i;
      showTrack();
      if (playIntent) {
        start();
      } else {
        if (loadedIndex !== -1) setSource(i); // player in use: load metadata so seek works while paused
        setStatus(`Selected "${tracks[i].title}".`);
      }
      updateTimeUI(0);
      updateMetadata();
      emitTrack();
      syncUI();
      emitState();
    }

    function goNext() {
      if (index >= 0) {
        back.push(index);
        if (back.length > HISTORY_CAP) back.shift();
      }
      if (forward.length) return select(forward.pop());
      if (!bag.length) bag = shuffleBag(tracks.length, { last: index });
      select(bag.shift());
    }

    function play() {
      if (destroyed) return;
      unlockAudio();
      if (!tracks.length) {
        playIntent = true;
        loadTracks();
        return;
      }
      if (playIntent && !audio.paused) return;
      failures = 0;
      error = null;
      start();
    }

    function pause() {
      if (destroyed) return;
      playIntent = false;
      loading = false;
      audio.pause();
      setPlaybackState("paused");
      syncUI();
      emitState();
      updateScope();
    }

    // Another player on the page started.
    function yieldPlayback() {
      if (destroyed || !playIntent) return;
      pause();
      setStatus("Paused. Another player started.");
    }

    function toggle() {
      if (isOn()) pause();
      else play();
    }

    function next() {
      if (destroyed || !tracks.length) return;
      if (playIntent) unlockAudio();
      goNext();
    }

    function prev() {
      if (destroyed || !tracks.length) return;
      if (playIntent) unlockAudio();
      const loaded = loadedIndex === index;
      if ((loaded && audio.currentTime > RESTART_AFTER) || !back.length) {
        if (loaded) audio.currentTime = 0;
        updateTimeUI(0);
        return;
      }
      forward.push(index);
      select(back.pop());
    }

    // Returns false when the current track has no known duration yet.
    function seek(seconds) {
      if (destroyed) return false;
      if (typeof seconds !== "number" || Number.isNaN(seconds)) {
        throw new RangeError(`wonkRadio: seek expects a number of seconds, got ${seconds}.`);
      }
      const d = loadedDuration();
      if (!Number.isFinite(d) || d <= 0) return false;
      audio.currentTime = Math.min(Math.max(0, seconds), d);
      updateTimeUI(audio.currentTime);
      return true;
    }

    // Clamps to 0..1. Persists with mute state.
    function setVolume(v) {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new RangeError(`wonkRadio: setVolume expects a number 0..1, got ${v}.`);
      }
      volume = Math.min(1, Math.max(0, v));
      audio.volume = volume;
      writeVolume(volume, muted);
      syncUI();
    }

    function setMuted(m) {
      muted = !!m;
      audio.muted = muted;
      writeVolume(volume, muted);
      syncUI();
    }

    // ---- audio element events ----
    function onPlaying() {
      if (!playIntent) {
        audio.pause(); // race guard: pause() ran while play() was pending
        return;
      }
      failures = 0;
      loading = false;
      const t = tracks[index];
      if (t && (announced !== index || error)) {
        announced = index;
        error = null;
        setStatus(`Playing "${t.title}"${t.artist ? ` by ${t.artist}` : ""}.`);
      }
      connectGraph();
      syncUI();
      emitState();
      updateScope();
    }

    function onPause() {
      syncUI();
      emitState();
      updateScope();
    }

    function onWaiting() {
      if (!playIntent) return;
      loading = true;
      syncUI();
      emitState();
    }

    function onDuration() {
      updateTimeUI(dragging ? Number(ui.seek.value) : audio.currentTime);
    }

    function onTime() {
      if (!dragging) updateTimeUI(audio.currentTime);
      positionState();
    }

    function onEnded() {
      if (playIntent) goNext();
      else syncUI();
    }

    function onError() {
      if (destroyed) return;
      const failedIndex = loadedIndex;
      // A CORS-mode load failed before the analyser graph exists. The
      // media error does not say why, so probe the same URL with fetch.
      if (audio.crossOrigin === "anonymous" && !sourceNode && failedIndex !== -1) {
        probeCors(failedIndex);
        return;
      }
      trackFailed(failedIndex);
    }

    function cancelProbe() {
      if (!probe) return;
      probe.abort();
      probe = null;
    }

    // Any HTTP response (even 404) means CORS works and the track itself
    // is bad: keep the visualizer pending and skip. A rejected fetch
    // (TypeError) means the host sends no CORS headers: fall back to a
    // plain element. A track change, a newer probe, or destroy() while
    // the probe is pending makes its result stale.
    function probeCors(failedIndex) {
      cancelProbe();
      const ac = new AbortController();
      const el = audio;
      const token = loadSeq;
      probe = ac;
      loading = playIntent;
      syncUI();
      emitState();
      const stale = () => destroyed || probe !== ac || el !== audio || loadSeq !== token;
      fetch(tracks[failedIndex].url, {
        mode: "cors", headers: { Range: "bytes=0-1" }, cache: "no-store", signal: ac.signal,
      }).then(() => {
        ac.abort(); // the response headers answer the question; skip the body
        if (stale()) return;
        probe = null;
        trackFailed(failedIndex);
      }, (err) => {
        if (stale()) return;
        probe = null;
        if (err instanceof TypeError) {
          corsFallback();
        } else {
          console.error("wonk-radio: the CORS probe failed unexpectedly.", err);
          trackFailed(failedIndex);
        }
      });
    }

    // Swap to a fresh element without crossOrigin and retry the same
    // track once. The graph is never created in that mode.
    function corsFallback() {
      visualizer = "off";
      closeContext();
      const old = audio;
      unbindAudio(old);
      old.removeAttribute("src");
      old.load();
      audio = createAudio(false);
      bindAudio(audio);
      loadedIndex = -1;
      if (playIntent) start();
      else setSource(index);
      syncUI();
      emitState();
      updateScope();
    }

    function trackFailed(failedIndex) {
      loading = false;
      const failed = tracks[failedIndex];
      const title = failed ? failed.title : "track";
      if (!playIntent) {
        error = `Could not load "${title}".`;
        setStatus(`Could not load "${title}".`);
        syncUI();
        emitState();
        return;
      }
      failures += 1;
      if (failures >= MAX_FAILURES) {
        playIntent = false;
        error = `The radio stopped after ${MAX_FAILURES} failed tracks.`;
        setStatus(`The radio stopped after ${MAX_FAILURES} failed tracks. Press play to retry.`);
        setPlaybackState("paused");
        syncUI();
        emitState();
        updateScope();
        return;
      }
      error = `Could not load "${title}".`;
      setStatus(`Could not load "${title}". Skipping.`);
      goNext();
    }

    // ---- UI events: native buttons and ranges only ----
    listen(ui.playBtn, "click", toggle);
    listen(ui.prevBtn, "click", prev);
    listen(ui.nextBtn, "click", next);
    listen(ui.muteBtn, "click", () => setMuted(!muted));
    // input previews the time, change seeks
    listen(ui.seek, "input", () => {
      dragging = true;
      updateTimeUI(Number(ui.seek.value));
    });
    listen(ui.seek, "change", () => {
      dragging = false;
      if (!seek(Number(ui.seek.value))) updateTimeUI();
    });
    listen(ui.seek, "blur", () => {
      if (!dragging) return;
      dragging = false;
      updateTimeUI();
    });
    // input previews the level, change commits and persists it
    listen(ui.vol, "input", () => {
      volume = Number(ui.vol.value);
      audio.volume = volume;
    });
    listen(ui.vol, "change", () => setVolume(Number(ui.vol.value)));
    listen(mql, "change", updateScope);
    listen(document, "visibilitychange", updateScope);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      playIntent = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      cancelProbe();
      unbindAudio(audio);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      closeContext();
      sourceNode = null;
      analyser = null;
      offs.splice(0).forEach((off) => off());
      releaseSession();
      host.replaceChildren();
      if (addedClass) host.classList.remove("wonk-radio");
      registry.delete(host);
      players.delete(ctrl);
      removeDock(host);
    }

    const ctrl = Object.freeze({
      play, pause, toggle, next, prev, seek, setVolume, setMuted, destroy,
      get state() {
        return Object.freeze({
          playing: isOn(), loading: isLoading(), error, visualizer,
          index, position: index + 1, total: tracks.length, volume, muted,
        });
      },
      get tracks() { return tracks; },
      get current() { return tracks[index] || null; },
      get audio() { return audio; },
      get analyser() { return analyser; },
      get host() { return host; },
    });

    registry.set(host, ctrl);
    players.set(ctrl, { yieldPlayback });
    if (isDock) addDock(host);
    bindAudio(audio);
    updateTimeUI(0);
    syncUI();
    updateScope();
    loadTracks();
    return ctrl;
  }

  // ---- public API ----------------------------------------------

  function mount(el, opts = {}) {
    if (!(el instanceof Element)) {
      throw new TypeError(`wonkRadio.mount: el must be a DOM Element, got ${el === null ? "null" : typeof el}.`);
    }
    return registry.get(el) || createPlayer(el, opts || {});
  }

  function get(el) {
    return registry.get(el) || null;
  }

  function report(err) {
    if (typeof window.reportError === "function") window.reportError(err);
    else setTimeout(() => { throw err; });
  }

  // One misconfigured host must not stop the others from mounting;
  // its error still surfaces as an uncaught error.
  function init(scope = document) {
    const hosts = [...scope.querySelectorAll("[data-wonk-radio]")];
    if (scope instanceof Element && scope.matches("[data-wonk-radio]")) hosts.unshift(scope);
    for (const el of hosts) {
      try {
        mount(el);
      } catch (err) {
        report(err);
      }
    }
  }

  function destroy(scope = document) {
    for (const p of [...players.keys()]) {
      if (scope === document || scope === p.host || scope.contains(p.host)) p.destroy();
    }
  }

  window.wonkRadio = Object.freeze({
    init, destroy, mount, get, parseName, mediaUrl, listBucket, shuffleBag, formatTime,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})();
