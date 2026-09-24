/* ============================================================
   demo/radio-checks.js · browser-callable checks for wonk-radio
   Not run automatically. Load it on a page that already has
   wonk-radio.js (demo/radio.html does), then in the console:

     await wonkRadioChecks.run();

   Returns { passed, failed, results } where each result is
   { name, pass, message }. No external network: fixture tracks are
   Blob URLs of a generated 1-second silent WAV (8 kHz mono, 16-bit).
   One check requests missing same-origin files to get real 404s.
   Every check builds its own off-screen hosts and removes them,
   and restores the wonk-radio:volume localStorage key, in finally.
   It never touches the players in the visible gallery.

   Automated browsers need --autoplay-policy=no-user-gesture-required
   for the playback checks; a person clicking "run" in devtools
   already has a user gesture on the page.
   ============================================================ */
(() => {
  "use strict";

  const STORAGE_KEY = "wonk-radio:volume";
  const checks = [];
  function check(name, fn) { checks.push(Object.freeze({ name, fn })); }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
  }

  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async function waitFor(cond, ms, what) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (cond()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    if (!cond()) throw new Error(`timed out after ${ms}ms waiting for ${what}`);
  }

  // 44-byte RIFF header + 16-bit PCM zeros, 8 kHz mono.
  function silentWav(seconds = 1) {
    const rate = 8000;
    const dataBytes = rate * seconds * 2;
    const buf = new ArrayBuffer(44 + dataBytes);
    const v = new DataView(buf);
    const ascii = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    ascii(0, "RIFF");
    v.setUint32(4, 36 + dataBytes, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    v.setUint32(16, 16, true);       // fmt chunk size
    v.setUint16(20, 1, true);        // PCM
    v.setUint16(22, 1, true);        // mono
    v.setUint32(24, rate, true);     // sample rate
    v.setUint32(28, rate * 2, true); // byte rate
    v.setUint16(32, 2, true);        // block align
    v.setUint16(34, 16, true);       // bits per sample
    ascii(36, "data");
    v.setUint32(40, dataBytes, true);
    return new Blob([buf], { type: "audio/wav" });
  }

  // Fixture state for one check: blob URLs, hosts, and the saved
  // localStorage value, all undone by cleanup().
  function fixture() {
    const urls = [];
    const hosts = [];
    const saved = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return {
      tracks(n, prefix = "fixture") {
        return Array.from({ length: n }, (_, i) => {
          const url = URL.createObjectURL(silentWav(1));
          urls.push(url);
          return { url, title: `${prefix} ${i + 1}`, artist: "WONK", number: String(i + 1).padStart(3, "0") };
        });
      },
      badTracks(n) {
        return Array.from({ length: n }, (_, i) => {
          const url = URL.createObjectURL(silentWav(1));
          URL.revokeObjectURL(url); // a revoked blob URL fails to load, with no network
          return { url, title: `bad ${i + 1}` };
        });
      },
      blobUrl(blob) {
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return url;
      },
      host(cls = "wonk-radio") {
        const el = document.createElement("section");
        el.className = cls;
        el.setAttribute("aria-label", "Radio check fixture");
        el.style.cssText = "position:fixed; left:-9999px; top:0; width:640px;";
        document.body.appendChild(el);
        hosts.push(el);
        return el;
      },
      cleanup() {
        hosts.forEach((el) => {
          const p = wonkRadio.get(el);
          if (p) p.destroy();
          el.remove();
        });
        urls.forEach((u) => URL.revokeObjectURL(u));
        if (saved === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, saved);
      },
    };
  }

  // Mounted players list their tracks asynchronously, even from an
  // in-memory array; wait until the first track is selected.
  async function mountReady(el, opts) {
    const p = wonkRadio.mount(el, opts);
    await waitFor(() => p.state.total > 0 && p.current, 2000, "the track list to load");
    return p;
  }

  // ============================================================
  // 1. parseName
  // ============================================================
  check("parseName splits number, artist, and title and keeps the title's case", () => {
    const cases = [
      ["001 - AK - slip.mp3", { number: "001", artist: "AK", title: "slip" }],
      ["music/005 - AK - don't say.mp3", { number: "005", artist: "AK", title: "don't say" }],
      ["music/088 - AK - AK's originals (1hr).mp3", { number: "088", artist: "AK", title: "AK's originals (1hr)" }],
      ["music/075 - Ro-MiNA - Queen Of The Night (AK REMIX).mp3", { number: "075", artist: "Ro-MiNA", title: "Queen Of The Night (AK REMIX)" }],
      ["Artist - Song.m4a", { artist: "Artist", title: "Song" }],
      ["loose.mp3", { title: "loose" }],
    ];
    for (const [input, want] of cases) {
      const got = wonkRadio.parseName(input);
      assert(same(got, want), `parseName(${JSON.stringify(input)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    }
  });

  // ============================================================
  // 2. mediaUrl
  // ============================================================
  check("mediaUrl builds an encoded JSON API media URL", () => {
    const url = wonkRadio.mediaUrl("aktunes", "music/005 - AK - don't say.mp3");
    assert(url.startsWith("https://storage.googleapis.com/storage/v1/b/aktunes/o/"), `wrong base: ${url}`);
    assert(url.includes("/o/music%2F005%20-%20AK%20-%20don"), `object name not encoded: ${url}`);
    assert(url.endsWith("?alt=media"), `missing ?alt=media: ${url}`);
  });

  // ============================================================
  // 3. shuffleBag
  // ============================================================
  check("shuffleBag returns permutations and never repeats across a bag boundary", () => {
    let seed = 42;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const isPerm = (bag, n) => bag.length === n && same([...bag].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
    let last = -1;
    for (let k = 0; k < 5; k++) {
      const bag = wonkRadio.shuffleBag(10, { last, random });
      assert(isPerm(bag, 10), `bag ${k} is not a permutation of 0..9: ${bag}`);
      assert(bag[0] !== last, `bag ${k} starts with the last played index ${last}: ${bag}`);
      last = bag[9];
    }
    // Force the swap path: with random() = 0 the permutation is fixed,
    // so ask for a bag whose natural first index is `last`.
    const zero = () => 0;
    const natural = wonkRadio.shuffleBag(10, { random: zero });
    const swapped = wonkRadio.shuffleBag(10, { last: natural[0], random: zero });
    assert(isPerm(swapped, 10), `swapped bag is not a permutation: ${swapped}`);
    assert(swapped[0] !== natural[0], `expected the first index ${natural[0]} to be swapped away: ${swapped}`);
  });

  // ============================================================
  // 4. listBucket
  // ============================================================
  check("listBucket pages, keeps audio only, drops placeholders, and sorts", async () => {
    const calls = [];
    const pages = {
      "": { items: [{ name: "music/", size: "0" }, { name: "music/b.mp3", size: "2" }, { name: "music/cover.jpg", size: "9" }], nextPageToken: "p2" },
      p2: { items: [{ name: "music/c.OGG", size: "3" }, { name: "music/a.m4a", size: "1" }] },
    };
    const fakeFetch = async (url) => {
      calls.push(url);
      const token = new URL(url).searchParams.get("pageToken") || "";
      return { ok: true, status: 200, json: async () => pages[token] };
    };
    const items = await wonkRadio.listBucket("aktunes", "music/", { fetch: fakeFetch });
    assert(calls.length === 2, `expected 2 page fetches, got ${calls.length}`);
    assert(new URL(calls[0]).searchParams.get("prefix") === "music/", `wrong prefix in ${calls[0]}`);
    assert(new URL(calls[1]).searchParams.get("pageToken") === "p2", `second fetch lacks pageToken=p2: ${calls[1]}`);
    const names = items.map((it) => it.name);
    assert(same(names, ["music/a.m4a", "music/b.mp3", "music/c.OGG"]), `got ${JSON.stringify(names)}`);

    let rejected = false;
    try {
      await wonkRadio.listBucket("aktunes", "music/", { fetch: async () => ({ ok: false, status: 403, json: async () => ({}) }) });
    } catch (err) {
      rejected = /403/.test(err.message);
    }
    assert(rejected, "expected an HTTP 403 listing to reject with the status in the message");
  });

  // ============================================================
  // 5. mount: accessible controls, no autoplay
  // ============================================================
  check("mount renders named controls and does not autoplay", async () => {
    const fx = fixture();
    try {
      const host = fx.host();
      const p = await mountReady(host, { tracks: fx.tracks(3) });
      const named = (label) => [...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
      assert(named("Previous track"), "missing a button named Previous track");
      assert(named("Play"), "missing a button named Play");
      assert(named("Next track"), "missing a button named Next track");
      assert(host.querySelector('input[type="range"][aria-label="Seek"]'), "missing the Seek range");
      assert(host.querySelector('input[type="range"][aria-label="Volume"]'), "missing the Volume range");
      const mute = named("Mute");
      assert(mute && mute.getAttribute("aria-pressed") === "false", "missing a Mute toggle with aria-pressed");
      const status = host.querySelector('[role="status"]');
      assert(status && status.getAttribute("aria-live") === "polite", "missing a polite role=status element");
      assert(status.textContent === "Press play to start.", `status before play: "${status.textContent}"`);
      assert(host.querySelector(".wonk-radio-title").textContent === p.current.title, "title does not show the first track of the bag");
      assert(p.audio.paused === true, "audio must stay paused until play()");
      assert(p.state.playing === false, "state.playing must be false before play()");
    } finally {
      fx.cleanup();
    }
  });

  // ============================================================
  // 6. play / next / prev
  // ============================================================
  check("play() starts audio, next() changes track, prev() returns to it", async () => {
    const fx = fixture();
    try {
      const p = await mountReady(fx.host(), { tracks: fx.tracks(4) });
      p.play();
      await waitFor(() => p.audio.paused === false, 3000, "audio.paused === false after play()");
      const first = p.state.index;
      p.next();
      const second = p.state.index;
      assert(second !== first, `next() kept index ${first}`);
      assert(p.audio.currentTime < 3, "fresh track should start near 0");
      p.prev();
      assert(p.state.index === first, `prev() went to ${p.state.index}, want ${first}`);
      assert(p.host.querySelector(".wonk-radio-play").getAttribute("aria-label") === "Pause", "play button should read Pause while playing");
    } finally {
      fx.cleanup();
    }
  });

  // ============================================================
  // 7. volume persistence
  // ============================================================
  check("setVolume persists and bad stored values fall back to 0.5", async () => {
    const fx = fixture();
    try {
      const a = await mountReady(fx.host(), { tracks: fx.tracks(1) });
      assert(a.state.volume === 0.5, `default volume ${a.state.volume}, want 0.5`);
      a.setVolume(0.3);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      assert(stored && stored.v === 0.3, `stored ${localStorage.getItem(STORAGE_KEY)}, want v: 0.3`);
      const b = await mountReady(fx.host(), { tracks: fx.tracks(1) });
      assert(b.state.volume === 0.3 && b.audio.volume === 0.3, `new mount read ${b.state.volume}, want 0.3`);

      localStorage.setItem(STORAGE_KEY, "abc");
      const c = await mountReady(fx.host(), { tracks: fx.tracks(1) });
      assert(c.state.volume === 0.5, `"abc" gave ${c.state.volume}, want 0.5`);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 7 }));
      const d = await mountReady(fx.host(), { tracks: fx.tracks(1) });
      assert(d.state.volume === 0.5, `{v: 7} gave ${d.state.volume}, want 0.5`);
    } finally {
      fx.cleanup();
    }
  });

  // ============================================================
  // 8. failed tracks skip, three in a row stop
  // ============================================================
  check("a failed track is skipped; 3 failures in a row stop the radio", async () => {
    const fx = fixture();
    let observer = null;
    try {
      const host = fx.host();
      const p = await mountReady(host, { tracks: fx.badTracks(3) });
      const status = host.querySelector('[role="status"]');
      const seen = [];
      observer = new MutationObserver(() => seen.push(status.textContent));
      observer.observe(status, { childList: true, characterData: true, subtree: true });
      const indices = new Set();
      const onTrack = (e) => indices.add(e.detail.index);
      host.addEventListener("wonk-radio:track", onTrack);
      const firstIndex = p.state.index;
      indices.add(firstIndex);
      p.play();
      await waitFor(() => /stopped/.test(status.textContent), 8000, "the stopped status");
      host.removeEventListener("wonk-radio:track", onTrack);
      assert(seen.some((t) => t.includes("Skipping")), `no status contained "Skipping": ${JSON.stringify(seen)}`);
      assert(indices.size === 3, `expected the index to advance through 3 tracks, saw ${[...indices]}`);
      assert(p.state.playing === false, "state.playing must be false after 3 failures");
      assert(/stopped/.test(p.state.error || ""), `state.error: ${p.state.error}`);
      assert(p.state.visualizer === "off", `the CORS fallback should have turned the visualizer off, got ${p.state.visualizer}`);
    } finally {
      if (observer) observer.disconnect();
      fx.cleanup();
    }
  });

  // ============================================================
  // 9. init idempotency, destroy, dock class
  // ============================================================
  check("init() is idempotent, destroy() empties the host, dock toggles the html class", async () => {
    const fx = fixture();
    try {
      const scope = fx.host("");
      const manifest = fx.blobUrl(new Blob([JSON.stringify(fx.tracks(2))], { type: "application/json" }));
      const host = document.createElement("section");
      host.className = "wonk-radio";
      host.setAttribute("data-wonk-radio", "");
      host.setAttribute("data-manifest", manifest);
      host.setAttribute("aria-label", "Radio");
      scope.appendChild(host);
      wonkRadio.init(scope);
      wonkRadio.init(scope);
      assert(host.querySelectorAll(".wonk-radio-scope").length === 1, `expected 1 scope canvas, got ${host.querySelectorAll(".wonk-radio-scope").length}`);
      const p = wonkRadio.get(host);
      assert(p, "init() did not mount the host");
      await waitFor(() => p.state.total === 2, 2000, "the manifest to load");
      wonkRadio.destroy(scope);
      assert(host.childElementCount === 0, "destroy(scope) left children in the host");
      assert(wonkRadio.get(host) === null, "get() still returns a controller after destroy");

      const root = document.documentElement;
      const otherDocks = () => [...document.querySelectorAll(".wonk-radio--dock")].some((el) => el !== dock && wonkRadio.get(el));
      const dock = fx.host("wonk-radio wonk-radio--dock");
      const d = wonkRadio.mount(dock, { tracks: fx.tracks(1) });
      assert(root.classList.contains("wonk-has-radio-dock"), "dock mount did not add wonk-has-radio-dock");
      const dockVar = root.style.getPropertyValue("--wonk-radio-dock-h");
      const dockH = Math.ceil(dock.getBoundingClientRect().height);
      assert(parseFloat(dockVar) >= dockH && dockH > 0, `--wonk-radio-dock-h is "${dockVar}", dock is ${dockH}px`);
      const pad = parseFloat(getComputedStyle(document.body).paddingBottom);
      assert(pad >= dockH, `body padding-bottom ${pad}px does not clear the ${dockH}px dock`);
      d.destroy();
      assert(dock.childElementCount === 0, "dock destroy left children");
      assert(root.classList.contains("wonk-has-radio-dock") === otherDocks(), "dock destroy did not remove wonk-has-radio-dock");
      const varLeft = root.style.getPropertyValue("--wonk-radio-dock-h") !== "";
      assert(varLeft === otherDocks(), "dock destroy did not remove --wonk-radio-dock-h");
    } finally {
      fx.cleanup();
    }
  });

  // ============================================================
  // 10. Media Session metadata
  // ============================================================
  check("Media Session metadata follows the current track", async () => {
    if (!("mediaSession" in navigator)) return "navigator.mediaSession is not available; nothing to check";
    const fx = fixture();
    try {
      const p = await mountReady(fx.host(), { tracks: fx.tracks(2) });
      p.play();
      await waitFor(() => p.audio.paused === false, 3000, "playback to start");
      const md = navigator.mediaSession.metadata;
      assert(md && md.title === p.current.title, `metadata.title ${md && md.title}, want ${p.current.title}`);
      assert(md.album === "radio", `metadata.album ${md.album}, want the station label "radio"`);
      p.next();
      assert(navigator.mediaSession.metadata.title === p.current.title, "metadata did not follow next()");
    } finally {
      fx.cleanup();
    }
  });

  // ============================================================
  // 11. CORS probe: a bad track on a CORS-capable host is skipped
  // ============================================================
  check("a same-origin 404 is skipped and the visualizer stays pending", async () => {
    if (!(window.AudioContext || window.webkitAudioContext)) return "no AudioContext; the element never uses CORS";
    const fx = fixture();
    let observer = null;
    try {
      const host = fx.host();
      const missing = [1, 2, 3].map((i) => ({ url: `/does-not-exist-radio-check-${i}.wav`, title: `missing ${i}` }));
      const p = await mountReady(host, { tracks: missing });
      assert(p.audio.crossOrigin === "anonymous", `expected a CORS-mode element, got crossOrigin=${p.audio.crossOrigin}`);
      const status = host.querySelector('[role="status"]');
      const seen = [];
      observer = new MutationObserver(() => seen.push(status.textContent));
      observer.observe(status, { childList: true, characterData: true, subtree: true });
      const firstIndex = p.state.index;
      p.play();
      await waitFor(() => seen.some((t) => t.includes("Skipping")), 5000, "a Skipping status");
      assert(p.state.index !== firstIndex, `index stayed ${firstIndex} after the skip`);
      await waitFor(() => /stopped/.test(status.textContent), 8000, "the stopped status");
      assert(p.state.visualizer === "pending", `visualizer is "${p.state.visualizer}", want "pending"`);
      assert(p.audio.crossOrigin === "anonymous", "the element was swapped to no-CORS for a plain 404");
    } finally {
      if (observer) observer.disconnect();
      fx.cleanup();
    }
  });

  // ============================================================
  // 12. one player at a time
  // ============================================================
  check("starting one player pauses the others", async () => {
    const fx = fixture();
    try {
      const a = await mountReady(fx.host(), { tracks: fx.tracks(2, "a") });
      const b = await mountReady(fx.host(), { tracks: fx.tracks(2, "b") });
      const statusOf = (p) => p.host.querySelector('[role="status"]').textContent;
      a.play();
      await waitFor(() => !a.audio.paused, 3000, "player A to start");
      b.play();
      await waitFor(() => !b.audio.paused, 3000, "player B to start");
      assert(a.audio.paused && a.state.playing === false, "player A kept playing after B started");
      assert(/Paused/.test(statusOf(a)), `player A status: "${statusOf(a)}"`);
      assert(b.state.playing === true, "player B should be playing");
      a.play();
      await waitFor(() => !a.audio.paused, 3000, "player A to start again");
      assert(b.audio.paused && b.state.playing === false, "player B kept playing after A started again");
    } finally {
      fx.cleanup();
    }
  });

  // ============================================================
  // runner
  // ============================================================
  async function run() {
    const results = [];
    for (const c of checks) {
      try {
        const note = await c.fn();
        results.push({ name: c.name, pass: true, message: typeof note === "string" ? note : "ok" });
        console.log("PASS " + c.name);
      } catch (err) {
        results.push({ name: c.name, pass: false, message: (err && err.message) || String(err) });
        console.error("FAIL " + c.name + ": " + ((err && err.message) || err));
      }
    }
    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    console.log(`wonk-radio checks: ${passed} passed, ${failed} failed`);
    return { passed, failed, results };
  }

  window.wonkRadioChecks = { run, checks: Object.freeze(checks) };
})();
