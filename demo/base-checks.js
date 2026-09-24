/* ============================================================
   demo/base-checks.js · browser-callable checks for wonk.js base
   behaviors (window.wonk: idempotent init, reduced motion, toast,
   setTheme, setPair, theme.init, wonk:themechange, the theme toggle,
   the responsive drawer, layout utilities (.wonk-sr, .wonk-grid,
   .wonk-row, .wonk-main), element defaults, stat tiles, the kv list,
   the fold card, header hints, tabs + wonk:tabchange, spark, menu,
   reveal, hints: data-tip / data-hint / data-term, glossary, wonk.tip,
   placement, focus, Escape, disclosure: .wonk-acc, .wonk-fold, row
   toggles, foldAll, fold keys, wonk:fold, formatting: wonk.fmt), the
   delta classes, token contrast, focus rings, loading without a CSS
   object, and the version stamp.
   Runs headless via `npm test` (or `npm test -- base`). By hand:
   load it on any page that already has wonk.js loaded (e.g.
   demo/index.html), then call:

     await wonkBaseChecks.run();

   Every check builds its own hidden fixture DOM and tears it down
   after itself, and restores any <html> attribute it changes. No
   dependency on any specific host page's markup, no network calls.
   Returns { passed, failed, results } where each result is
   { name, pass, message } (message is "ok" on pass), and also prints
   a console.table().
   ============================================================ */
(() => {
  "use strict";

  const checks = [];
  function check(name, fn) { checks.push({ name, fn }); }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
  }

  function withFixture(html) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; left:-9999px; top:0; width:400px;";
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  }

  // Restores one <html> attribute to its value before the check ran
  // (removing it if it was absent).
  function restoreRootAttr(name, original) {
    const root = document.documentElement;
    if (original === null) root.removeAttribute(name);
    else root.setAttribute(name, original);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  // Runs fn with win[name] replaced by a recording wrapper around the
  // real timer function; returns { result, calls } where each call is
  // { args, ret }. Always restores the real function.
  function withTimerSpy(win, name, fn) {
    const real = win[name];
    const calls = [];
    win[name] = function (...args) {
      const ret = real.apply(win, args);
      calls.push({ args, ret });
      return ret;
    };
    try {
      return { result: fn(calls), calls };
    } finally {
      win[name] = real;
    }
  }

  // ---- loads a second, isolated copy of wonk.js into a throwaway
  // iframe with a mocked matchMedia, so reduced-motion checks can flip
  // the preference on demand without touching the real OS setting or
  // the page's already-initialized module (same technique as
  // demo/motion-checks.js). ----
  function loadIsolatedWonk() {
    const assetURL = new URL("../assets/wonk.js", document.baseURI).href;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute; width:0; height:0; border:0; visibility:hidden;";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      doc.open();
      doc.write("<!doctype html><html><head></head><body></body></html>");
      doc.close();

      const realMatchMedia = win.matchMedia.bind(win);
      const state = { matches: false, listeners: [] };
      win.matchMedia = function (query) {
        if (query.indexOf("prefers-reduced-motion") === -1) return realMatchMedia(query);
        return {
          get matches() { return state.matches; },
          media: query,
          addEventListener(type, cb) { if (type === "change") state.listeners.push(cb); },
          removeEventListener(type, cb) {
            state.listeners = state.listeners.filter((f) => f !== cb);
          },
        };
      };

      const script = doc.createElement("script");
      script.src = assetURL;
      script.onload = () => resolve({
        win,
        doc,
        setReduced(val) {
          state.matches = val;
          state.listeners.slice().forEach((cb) => cb({ matches: val }));
        },
        cleanup() { iframe.remove(); },
      });
      script.onerror = () => reject(new Error("could not load " + assetURL + " into isolated iframe"));
      doc.body.appendChild(script);
    });
  }

  // ---- idempotent wiring ----
  // Deterministic method: wonk.js schedules each live-jitter tick with
  // the global setTimeout. After a first init() starts the loop, spy on
  // setTimeout during a second init(): a second loop would call its first
  // tick synchronously and schedule a timer; an idempotent init schedules
  // nothing. No waiting on random jitter timing.
  check("init(scope) twice on a live dot runs one jitter loop (second init schedules nothing)", () => {
    const host = withFixture(`<span class="wonk-dot wonk-dot--live" data-wonk-live></span>`);
    try {
      wonk.init(host);
      const { calls } = withTimerSpy(window, "setTimeout", () => wonk.init(host));
      assert(calls.length === 0, `second init scheduled ${calls.length} timer(s); expected 0`);
      const { calls: direct } = withTimerSpy(window, "setTimeout", () => wonk.live(host.querySelector("[data-wonk-live]")));
      assert(direct.length === 0, `a repeat wonk.live(el) scheduled ${direct.length} timer(s); expected 0`);
    } finally {
      host.remove();
    }
  });

  check("secret reveals exactly once on the 7th click after a double init", () => {
    const msg = "wonk-base-check-secret-" + Math.random().toString(36).slice(2);
    const host = withFixture(`<span data-wonk-secret="${msg}">x</span>`);
    const countToasts = () =>
      [...document.querySelectorAll(".wonk-toast")].filter((t) => t.textContent.includes(msg)).length;
    try {
      wonk.init(host);
      wonk.init(host);
      const el = host.querySelector("[data-wonk-secret]");
      for (let i = 0; i < 6; i++) el.click();
      assert(countToasts() === 0, `expected no reveal after 6 clicks, got ${countToasts()} toast(s)`);
      el.click();
      assert(countToasts() === 1, `expected exactly 1 reveal on the 7th click, got ${countToasts()}`);
    } finally {
      document.querySelectorAll(".wonk-toast").forEach((t) => { if (t.textContent.includes(msg)) t.remove(); });
      host.remove();
    }
  });

  check("glyph clears its interval once the element is removed", () => {
    const host = withFixture(`<span data-wonk-glyph>x</span>`);
    const el = host.querySelector("[data-wonk-glyph]");
    let id = null;
    try {
      const { calls } = withTimerSpy(window, "setInterval", () => wonk.glyph(el));
      assert(calls.length === 1, `expected glyph to start one interval, got ${calls.length}`);
      const [{ args: [tick], ret }] = calls;
      id = ret;
      host.remove();
      const before = el.textContent;
      const { calls: cleared } = withTimerSpy(window, "clearInterval", () => tick());
      assert(cleared.some((c) => c.args[0] === id), "a tick after removal should clear its own interval");
      assert(el.textContent === before, "a tick after removal should not swap the glyph");
    } finally {
      host.remove();
      if (id !== null) clearInterval(id);
    }
  });

  check("reduced motion flipped on mid-session stops live and vu loops; flipped off resumes them", async () => {
    const iso = await loadIsolatedWonk();
    try {
      const { win, doc } = iso;
      const dot = doc.createElement("span");
      dot.setAttribute("data-wonk-live", "");
      const meter = doc.createElement("div");
      meter.setAttribute("data-wonk-vu", "6");
      doc.body.append(dot, meter);
      win.wonk.live(dot);
      win.wonk.vu(meter);
      assert(dot.style.animationName === "none", `live should take over the CSS animation, got "${dot.style.animationName}"`);

      iso.setReduced(true);
      assert(dot.style.opacity === "", `live should reset inline opacity on reduce, got "${dot.style.opacity}"`);
      assert(dot.style.animation === "", `live should reset inline animation on reduce, got "${dot.style.animation}"`);
      const heights = () => [...meter.querySelectorAll(".bar")].map((b) => b.style.height).join(",");
      const frozen = heights();
      const real = win.setTimeout;
      let scheduled = 0;
      win.setTimeout = function (...args) { scheduled++; return real.apply(win, args); };
      try {
        await sleep(300);
      } finally {
        win.setTimeout = real;
      }
      assert(scheduled === 0, `no loop should schedule timers while reduced, got ${scheduled}`);
      assert(heights() === frozen, "vu bars should hold still while reduced");

      iso.setReduced(false);
      assert(dot.style.animationName === "none", "live should resume when reduced motion turns off");
      await sleep(300);
      assert(heights() !== frozen, "vu should resume self-animating when reduced motion turns off");
    } finally {
      iso.cleanup();
    }
  });

  // ---- toast ----
  check("toast(\"x\", \"ok\") appends a .wonk-toast--ok with text x inside .wonk-toasts", () => {
    const hadHost = !!document.querySelector(".wonk-toasts");
    let t = null;
    try {
      t = wonk.toast("x", "ok");
      const host = document.querySelector(".wonk-toasts");
      assert(!!host, "expected a .wonk-toasts host to exist after toast()");
      assert(t instanceof Element, "toast() should return the toast element");
      assert(t.parentElement === host, "toast element should be a child of .wonk-toasts");
      assert(t.classList.contains("wonk-toast--ok"), `expected class wonk-toast--ok, got "${t.className}"`);
      assert(t.textContent === "x", `expected text "x", got "${t.textContent}"`);
    } finally {
      if (t) t.remove();
      const host = document.querySelector(".wonk-toasts");
      if (!hadHost && host && !host.children.length) host.remove();
    }
  });

  check("toast host is a polite status live region; an err toast is role=alert", () => {
    const made = [];
    try {
      made.push(wonk.toast("polite one", "info"));
      const host = document.querySelector(".wonk-toasts");
      assert(host.getAttribute("aria-live") === "polite", `host aria-live should be "polite", got ${host.getAttribute("aria-live")}`);
      assert(host.getAttribute("role") === "status", `host role should be "status", got ${host.getAttribute("role")}`);
      const err = wonk.toast("loud one", "err");
      made.push(err);
      assert(err.getAttribute("role") === "alert", `err toast role should be "alert", got ${err.getAttribute("role")}`);
      assert(made[0].getAttribute("role") !== "alert", "a non-err toast must not be role=alert");
    } finally {
      made.forEach((t) => t.remove());
    }
  });

  check("toast has a Dismiss button that removes it", () => {
    const t = wonk.toast("dismiss me", "ok");
    try {
      const btn = t.querySelector("button[aria-label='Dismiss']");
      assert(!!btn, "expected a button[aria-label=Dismiss] inside the toast");
      btn.click();
      assert(!t.isConnected, "clicking Dismiss should remove the toast");
    } finally {
      t.remove();
    }
  });

  check("toast fired while a modal dialog is open lands inside the dialog, pinned to the viewport corner", async () => {
    const dlg = document.createElement("dialog");
    dlg.className = "wonk-modal";
    dlg.textContent = "fixture modal";
    document.body.appendChild(dlg);
    let t = null;
    try {
      dlg.showModal();
      t = wonk.toast("inside the modal", "info");
      assert(dlg.contains(t), "toast should be a descendant of the open modal dialog");
      await sleep(400); // let the wonk-pop open animation finish (its transform ends as none)
      const r = t.closest(".wonk-toasts").getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(t.closest(".wonk-toasts")).right);
      assert(Math.abs(window.innerWidth - r.right - gap) < 2, `host should pin ${gap}px from the viewport's right edge, right=${r.right} innerWidth=${window.innerWidth}`);
      assert(Math.abs(window.innerHeight - r.bottom - gap) < 2, `host should pin ${gap}px from the viewport's bottom edge, bottom=${r.bottom} innerHeight=${window.innerHeight}`);
    } finally {
      if (t) t.remove();
      dlg.close();
      dlg.remove();
    }
  });

  // ---- theme ----
  check("setTheme(\"paper\") sets data-theme=paper on <html>; setTheme(\"dark\") removes it", () => {
    const root = document.documentElement;
    const original = root.getAttribute("data-theme");
    try {
      wonk.setTheme("paper");
      assert(root.getAttribute("data-theme") === "paper", `expected data-theme="paper", got ${JSON.stringify(root.getAttribute("data-theme"))}`);
      wonk.setTheme("dark");
      assert(!root.hasAttribute("data-theme"), `expected no data-theme after setTheme("dark"), got ${JSON.stringify(root.getAttribute("data-theme"))}`);
    } finally {
      restoreRootAttr("data-theme", original);
    }
  });

  // ---- pair ----
  check("setPair(\"glorpla\") sets data-pair=glorpla on <html>", () => {
    const root = document.documentElement;
    const original = root.getAttribute("data-pair");
    try {
      wonk.setPair("glorpla");
      assert(root.getAttribute("data-pair") === "glorpla", `expected data-pair="glorpla", got ${JSON.stringify(root.getAttribute("data-pair"))}`);
    } finally {
      restoreRootAttr("data-pair", original);
    }
  });

  // ---- theme helper, pair validation, theme toggle, drawer, layout ----
  // Loads wonk.js, plus optional stylesheets and fixture markup, into an
  // off-screen iframe with a real viewport size. The drawer check needs
  // a 390px viewport for its (max-width: 800px) query; the storage check
  // needs its own module state (a storage key) and a mocked
  // prefers-color-scheme; the layout check needs a page with only the
  // base stylesheets.
  function loadWonkFrame({ width = 390, height = 600, css = [], body = "", lightScheme = null } = {}) {
    const url = (p) => new URL(p, document.baseURI).href;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = `position:fixed; left:-10000px; top:0; width:${width}px; height:${height}px; border:0;`;
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      doc.open();
      doc.write(
        `<!doctype html><html class="wonk" data-pair="metathesis"><head>` +
        css.map((p) => `<link rel="stylesheet" href="${url(p)}">`).join("") +
        `</head><body>${body}</body></html>`
      );
      doc.close();
      if (lightScheme !== null) {
        const realMatchMedia = win.matchMedia.bind(win);
        win.matchMedia = (query) => (query.indexOf("prefers-color-scheme") === -1
          ? realMatchMedia(query)
          : { matches: query.indexOf("light") !== -1 ? lightScheme : !lightScheme, media: query, addEventListener() {}, removeEventListener() {} });
      }
      const sheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => new Promise((ok, fail) => {
        if (link.sheet) ok();
        else {
          link.onload = ok;
          link.onerror = () => fail(new Error("could not load " + link.href + " into the iframe"));
        }
      }));
      Promise.all(sheets).then(() => {
        const script = doc.createElement("script");
        script.src = url("../assets/wonk.js");
        script.onload = () => resolve({ iframe, win, doc, cleanup() { iframe.remove(); } });
        script.onerror = () => { iframe.remove(); reject(new Error("could not load wonk.js into the iframe")); };
        doc.body.appendChild(script);
      }, (err) => { iframe.remove(); reject(err); });
    });
  }

  // polls cond() every frame until it is true or ms runs out
  async function until(cond, ms, what) {
    const end = performance.now() + ms;
    while (!cond()) {
      if (performance.now() > end) throw new Error(`timed out after ${ms}ms waiting for ${what}`);
      await frame();
    }
  }

  const themeOf = (root) => root.getAttribute("data-theme");

  check("setTheme(\"light\") applies paper (data-theme paper or light, paper --ak-ground); setTheme(\"bogus\") throws", () => {
    const root = document.documentElement;
    const original = themeOf(root);
    const ground = () => getComputedStyle(root).getPropertyValue("--ak-ground").trim();
    try {
      root.setAttribute("data-theme", "paper");
      const paperGround = ground();
      root.removeAttribute("data-theme");
      wonk.setTheme("light");
      assert(themeOf(root) === "paper" || themeOf(root) === "light", `expected data-theme paper or light after setTheme("light"), got ${JSON.stringify(themeOf(root))}`);
      assert(ground() === paperGround, `expected --ak-ground ${paperGround} (paper) after setTheme("light"), got ${ground()}`);
      let threw = null;
      try { wonk.setTheme("bogus"); } catch (err) { threw = err; }
      assert(threw, "setTheme(\"bogus\") should throw");
      assert(/dark/.test(threw.message) && /paper/.test(threw.message), `the error should name the valid themes, got ${JSON.stringify(threw.message)}`);
    } finally {
      restoreRootAttr("data-theme", original);
    }
  });

  check("css: data-theme=\"light\" computes the same tokens as data-theme=\"paper\" for all 5 pairs; dark is unchanged", () => {
    const TOKENS = ["--ak-ground", "--ak-surface", "--ak-surface-2", "--ak-ink", "--ak-ink-2", "--ak-hairline",
      "--ak-a1", "--ak-a1-ink", "--ak-a1-text", "--ak-a2-text", "--ak-wash", "--ak-ok", "--ak-warn", "--ak-err", "--ak-info",
      "--ak-chart-1", "--ak-chart-6"];
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const read = () => TOKENS.map((t) => getComputedStyle(probe).getPropertyValue(t).trim()).join(" ");
    try {
      for (const pair of PAIRS) {
        probe.setAttribute("data-pair", pair);
        probe.removeAttribute("data-theme");
        const dark = read();
        probe.setAttribute("data-theme", "paper");
        const paper = read();
        probe.setAttribute("data-theme", "light");
        const light = read();
        assert(light === paper, `${pair}: light tokens differ from paper\n light: ${light}\n paper: ${paper}`);
        assert(dark !== paper, `${pair}: dark and paper tokens should differ`);
      }
    } finally {
      probe.remove();
    }
  });

  check("setPair(\"electric\") throws, names every valid pair, and leaves data-pair alone", () => {
    const root = document.documentElement;
    const original = root.getAttribute("data-pair");
    try {
      let threw = null;
      try { wonk.setPair("electric"); } catch (err) { threw = err; }
      assert(threw, "setPair(\"electric\") should throw");
      PAIRS.forEach((p) => assert(threw.message.includes(p), `the error should list "${p}", got ${JSON.stringify(threw.message)}`));
      assert(root.getAttribute("data-pair") === original, `data-pair changed to ${JSON.stringify(root.getAttribute("data-pair"))}`);
    } finally {
      restoreRootAttr("data-pair", original);
    }
  });

  check("wonk:themechange fires on document for setTheme and setPair with detail.theme and detail.pair", () => {
    const root = document.documentElement;
    const theme = themeOf(root);
    const pair = root.getAttribute("data-pair");
    const seen = [];
    const onChange = (e) => seen.push(e.detail);
    document.addEventListener("wonk:themechange", onChange);
    try {
      wonk.setTheme("paper");
      wonk.setPair("glorpla");
      wonk.setTheme("dark");
      assert(seen.length === 3, `expected 3 events, got ${seen.length}: ${JSON.stringify(seen)}`);
      const want = [{ theme: "paper", pair: "glorpla" }, { theme: "paper", pair: "glorpla" }, { theme: "dark", pair: "glorpla" }];
      assert(seen[0] && seen[0].theme === "paper", `event 1 detail.theme should be "paper", got ${JSON.stringify(seen[0])}`);
      assert(seen[1] && seen[1].pair === "glorpla" && seen[1].theme === "paper", `event 2 detail should be ${JSON.stringify(want[1])}, got ${JSON.stringify(seen[1])}`);
      assert(seen[2] && seen[2].theme === "dark" && seen[2].pair === "glorpla", `event 3 detail should be ${JSON.stringify(want[2])}, got ${JSON.stringify(seen[2])}`);
    } finally {
      document.removeEventListener("wonk:themechange", onChange);
      restoreRootAttr("data-pair", pair);
      restoreRootAttr("data-theme", theme);
    }
  });

  check("theme.init({key}) reads the stored theme, else prefers-color-scheme; after it, setTheme writes the key", async () => {
    const KEY = "wonk-theme-check";
    const frames = [];
    try {
      localStorage.setItem(KEY, "paper");
      const stored = await loadWonkFrame({ width: 0, height: 0, lightScheme: false });
      frames.push(stored);
      const sroot = stored.doc.documentElement;
      const got = stored.win.wonk.theme.init({ key: KEY });
      assert(got === "paper", `init should return the stored "paper", got ${JSON.stringify(got)}`);
      assert(themeOf(sroot) === "paper", `init should apply the stored theme, data-theme is ${JSON.stringify(themeOf(sroot))}`);
      stored.win.wonk.setTheme("dark");
      assert(localStorage.getItem(KEY) === "dark", `setTheme("dark") should write "dark" to ${KEY}, got ${JSON.stringify(localStorage.getItem(KEY))}`);
      stored.win.wonk.setTheme("paper");
      assert(localStorage.getItem(KEY) === "paper", `setTheme("paper") should write "paper" to ${KEY}, got ${JSON.stringify(localStorage.getItem(KEY))}`);

      localStorage.removeItem(KEY);
      const light = await loadWonkFrame({ width: 0, height: 0, lightScheme: true });
      frames.push(light);
      assert(light.win.wonk.theme.init({ key: KEY }) === "paper", "with no stored theme and prefers-color-scheme: light, init should return \"paper\"");
      assert(themeOf(light.doc.documentElement) === "paper", "prefers-color-scheme: light should apply paper");
      assert(localStorage.getItem(KEY) === null, "init should not write the key; only setTheme persists a choice");

      const dark = await loadWonkFrame({ width: 0, height: 0, lightScheme: false });
      frames.push(dark);
      assert(dark.win.wonk.theme.init({ key: KEY }) === "dark", "with no stored theme and no light preference, init should return \"dark\"");
      assert(!dark.doc.documentElement.hasAttribute("data-theme"), "dark should leave no data-theme");
    } finally {
      frames.forEach((f) => f.cleanup());
      localStorage.removeItem(KEY);
    }
  });

  check("[data-wonk-theme-toggle]: init labels it for the current theme; a click flips the theme, its text (Paper/Dark), and aria-pressed", () => {
    const root = document.documentElement;
    const original = themeOf(root);
    const host = withFixture(`<button type="button" class="wonk-btn" data-wonk-theme-toggle>Theme</button>`);
    const btn = host.querySelector("button");
    try {
      wonk.setTheme("dark");
      wonk.init(host);
      assert(btn.textContent === "Paper", `in dark the toggle should read "Paper", got ${JSON.stringify(btn.textContent)}`);
      assert(btn.getAttribute("aria-pressed") === "false", `in dark aria-pressed should be "false", got ${JSON.stringify(btn.getAttribute("aria-pressed"))}`);
      btn.click();
      assert(themeOf(root) === "paper", `a click in dark should apply paper, data-theme is ${JSON.stringify(themeOf(root))}`);
      assert(btn.textContent === "Dark", `in paper the toggle should read "Dark", got ${JSON.stringify(btn.textContent)}`);
      assert(btn.getAttribute("aria-pressed") === "true", `in paper aria-pressed should be "true", got ${JSON.stringify(btn.getAttribute("aria-pressed"))}`);
      wonk.init(host); // idempotent: a second init must not add a second listener
      btn.click();
      assert(!root.hasAttribute("data-theme"), `a click in paper should apply dark, data-theme is ${JSON.stringify(themeOf(root))}`);
      assert(btn.textContent === "Paper", `back in dark the toggle should read "Paper", got ${JSON.stringify(btn.textContent)}`);
    } finally {
      host.remove();
      wonk.setTheme(original === "paper" || original === "light" ? "paper" : "dark");
      restoreRootAttr("data-theme", original);
    }
  });

  check("drawer at 390px: the button shows, the closed side is inert; a click opens it; Escape closes it and focuses the button; a link click and an outside click close it; crossing to desktop resets it", async () => {
    const f = await loadWonkFrame({
      width: 390,
      css: ["../assets/wonk-tokens.css", "../assets/wonk.css"],
      body: `
        <div class="wonk-shell">
          <aside class="wonk-side" id="chk-side">
            <div class="brand">WONK</div>
            <a class="wonk-navlink" href="#chk-main">Main</a>
          </aside>
          <div>
            <header class="wonk-topbar">
              <button type="button" class="wonk-btn wonk-drawer-btn" data-wonk-drawer aria-controls="chk-side" aria-expanded="false">Menu</button>
            </header>
            <main id="chk-main"><button type="button" id="chk-outside">outside</button></main>
          </div>
        </div>`,
    });
    try {
      const { win, doc } = f;
      const btn = doc.querySelector("[data-wonk-drawer]");
      const side = doc.getElementById("chk-side");
      const expanded = () => btn.getAttribute("aria-expanded");
      assert(win.matchMedia("(max-width: 800px)").matches, `the iframe viewport should be mobile, innerWidth is ${win.innerWidth}`);
      assert(win.getComputedStyle(btn).display !== "none", "the drawer button should show below 800px");
      assert(win.getComputedStyle(side).position === "fixed", `the side should be an off-canvas fixed panel below 800px, position is ${win.getComputedStyle(side).position}`);
      assert(side.inert === true, "the closed side should be inert below 800px");
      assert(expanded() === "false", `closed: aria-expanded should be "false", got ${expanded()}`);

      btn.click();
      assert(expanded() === "true", `after a click aria-expanded should be "true", got ${expanded()}`);
      assert(side.inert === false, "the open side should not be inert");

      doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      assert(expanded() === "false", "Escape should close the drawer");
      assert(side.inert === true, "Escape should make the side inert again");
      assert(doc.activeElement === btn, `Escape should focus the drawer button, focus is on ${doc.activeElement && doc.activeElement.outerHTML.slice(0, 60)}`);

      btn.click();
      side.querySelector("a").click();
      assert(expanded() === "false", "a link click inside the side should close the drawer");

      btn.click();
      doc.getElementById("chk-outside").click();
      assert(expanded() === "false", "a click outside the side should close the drawer");

      btn.click();
      f.iframe.style.width = "1024px";
      await until(() => !win.matchMedia("(max-width: 800px)").matches, 2000, "the iframe to reach desktop width");
      await until(() => side.inert === false && expanded() === "false", 2000, "the drawer to reset at desktop width");
      assert(win.getComputedStyle(btn).display === "none", "the drawer button should hide above 800px");
      assert(!side.classList.contains("is-open"), "crossing to desktop should drop is-open");
    } finally {
      f.cleanup();
    }
  });

  check("layout: with only tokens + wonk.css, .wonk-sr is a 1px clipped box, .wonk-grid is grid, .wonk-row is flex, .wonk-main is centered", async () => {
    const f = await loadWonkFrame({
      width: 1280,
      css: ["../assets/wonk-tokens.css", "../assets/wonk.css"],
      body: `<main class="wonk-main"><span class="wonk-sr">hidden label</span><div class="wonk-grid"><div>a</div></div><div class="wonk-row"><span>b</span></div></main>`,
    });
    try {
      const cs = (sel) => f.win.getComputedStyle(f.doc.querySelector(sel));
      const sr = f.doc.querySelector(".wonk-sr").getBoundingClientRect();
      assert(cs(".wonk-sr").position === "absolute", `.wonk-sr position should be absolute, got ${cs(".wonk-sr").position}`);
      assert(Math.round(sr.width) === 1 && Math.round(sr.height) === 1, `.wonk-sr should be 1x1, got ${sr.width}x${sr.height}`);
      assert(cs(".wonk-sr").overflow === "hidden", `.wonk-sr overflow should be hidden, got ${cs(".wonk-sr").overflow}`);
      assert(cs(".wonk-sr").clipPath !== "none", "`.wonk-sr` should be clipped (clip-path)");
      assert(cs(".wonk-grid").display === "grid", `.wonk-grid display should be grid, got ${cs(".wonk-grid").display}`);
      assert(cs(".wonk-row").display === "flex", `.wonk-row display should be flex, got ${cs(".wonk-row").display}`);
      assert(cs(".wonk-row").flexWrap === "wrap", `.wonk-row should wrap, got ${cs(".wonk-row").flexWrap}`);
      assert(cs(".wonk-main").maxWidth === "1280px", `.wonk-main max-width should be 80rem (1280px), got ${cs(".wonk-main").maxWidth}`);
    } finally {
      f.cleanup();
    }
  });

  check("typography: h1.wonk-title computes the same letter-spacing and font-size as div.wonk-title (the title rule beats .wonk h1)", () => {
    const host = withFixture(`<h1 class="wonk-title">Heading title</h1><div class="wonk-title">Div title</div>`);
    try {
      const h1 = getComputedStyle(host.querySelector("h1"));
      const div = getComputedStyle(host.querySelector("div"));
      assert(h1.letterSpacing === div.letterSpacing, `h1.wonk-title letter-spacing should be ${div.letterSpacing}, got ${h1.letterSpacing}`);
      assert(h1.fontSize === div.fontSize, `h1.wonk-title font-size should be ${div.fontSize}, got ${h1.fontSize}`);
      assert(h1.textTransform === "uppercase", `h1.wonk-title should be uppercase, got ${h1.textTransform}`);
    } finally {
      host.remove();
    }
  });

  check("links: an a.wonk-btn has the same borders and color as a button.wonk-btn (plain link rules never reach a component)", () => {
    const host = withFixture(`<a class="wonk-btn" href="#x">Link button</a><button type="button" class="wonk-btn">Button</button><a href="#y">plain link</a>`);
    try {
      const a = getComputedStyle(host.querySelector("a.wonk-btn"));
      const b = getComputedStyle(host.querySelector("button"));
      const plain = getComputedStyle(host.querySelector("a:not([class])"));
      for (const side of ["Top", "Right", "Bottom", "Left"]) {
        assert(a[`border${side}Color`] === b[`border${side}Color`], `a.wonk-btn border-${side.toLowerCase()} color should be ${b[`border${side}Color`]}, got ${a[`border${side}Color`]}`);
        assert(a[`border${side}Width`] === b[`border${side}Width`], `a.wonk-btn border-${side.toLowerCase()} width should be ${b[`border${side}Width`]}, got ${a[`border${side}Width`]}`);
      }
      assert(a.color === b.color, `a.wonk-btn color should be ${b.color}, got ${a.color}`);
      assert(a.textDecorationLine === "none", `a.wonk-btn should not be underlined, got ${a.textDecorationLine}`);
      assert(plain.textDecorationLine === "none", `a plain link uses a border underline on hover, not text-decoration; got ${plain.textDecorationLine}`);
      const linkColor = getComputedStyle(document.documentElement).getPropertyValue("--ak-a1-text").trim();
      const probe = document.createElement("span");
      probe.style.color = linkColor;
      host.appendChild(probe);
      assert(plain.color === getComputedStyle(probe).color, `a plain link should use --ak-a1-text, got ${plain.color}`);
    } finally {
      host.remove();
    }
  });

  check("select: .wonk-select draws its own caret inset from the right edge", () => {
    const host = withFixture(`<select class="wonk-select"><option>one</option></select><select class="wonk-select" multiple><option>a</option></select>`);
    try {
      const [single, multi] = host.querySelectorAll("select");
      const s = getComputedStyle(single);
      assert(s.appearance === "none", `single select appearance should be none, got ${s.appearance}`);
      assert(parseFloat(s.paddingRight) >= 32, `single select needs >= 32px right padding for the caret, got ${s.paddingRight}`);
      assert((s.backgroundImage.match(/linear-gradient/g) || []).length === 2, `single select should draw a two-gradient caret, got ${s.backgroundImage}`);
      assert(getComputedStyle(multi).backgroundImage === "none", "a multiple select is a list box and gets no caret");
    } finally {
      host.remove();
    }
  });

  check("live divider: .wonk-divider--live runs the scrolling wave animation", () => {
    const host = withFixture(`<hr class="wonk-divider wonk-divider--live">`);
    try {
      const cs = getComputedStyle(host.querySelector("hr"));
      const reducedNow = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedNow) {
        assert(cs.animationName === "none", `under reduced motion the live divider should not animate, got ${cs.animationName}`);
      } else {
        assert(cs.animationName === "wonk-wave-scroll", `animation-name should be wonk-wave-scroll, got ${cs.animationName}`);
        assert(cs.animationIterationCount === "infinite", `the wave should loop, got ${cs.animationIterationCount}`);
      }
    } finally {
      host.remove();
    }
  });

  check("typography: a class on p, h2, or small beats the element defaults (:where(.wonk)); p.wonk-help--error is red; a plain p keeps ink-2", () => {
    const host = withFixture(`
      <style>.chk-flat { margin: 0; color: rgb(1, 2, 3); } .chk-size { font-size: 10px; margin: 0; }</style>
      <p class="chk-flat">p</p><h2 class="chk-size">h2</h2><small class="chk-flat">small</small>
      <p class="wonk-help wonk-help--error">error help</p><p class="plain">plain</p>
      <span class="p-err" style="color:var(--ak-err)">e</span><span class="p-ink2" style="color:var(--ak-ink-2)">i</span>`);
    try {
      const cs = (sel) => getComputedStyle(host.querySelector(sel));
      eq(cs("p.chk-flat").marginBottom, "0px", "p.chk-flat margin-bottom");
      eq(cs("p.chk-flat").color, "rgb(1, 2, 3)", "p.chk-flat color");
      eq(cs("h2.chk-size").fontSize, "10px", "h2.chk-size font-size");
      eq(cs("small.chk-flat").color, "rgb(1, 2, 3)", "small.chk-flat color");
      eq(cs("p.wonk-help--error").color, cs(".p-err").color, "p.wonk-help--error color");
      eq(cs("p.plain").color, cs(".p-ink2").color, "a plain p color");
      assert(cs("p.plain").marginBottom !== "0px", "a plain p should keep its bottom margin");
    } finally {
      host.remove();
    }
  });

  check("stat: button.wonk-card.wonk-stat keeps the card's padding, border, and background; --accent still applies; a bare button.wonk-stat has none, even under an app button rule", () => {
    const host = withFixture(`
      <style>:where(.chk-app) button { padding: 10px; border: 3px solid rgb(200, 0, 0); background: rgb(200, 0, 0); }</style>
      <div class="wonk-card ref">card</div>
      <button type="button" class="wonk-card wonk-stat tile"><span class="wonk-label">open</span><span class="wonk-num">12</span></button>
      <button type="button" class="wonk-card wonk-card--accent wonk-stat accent"><span class="wonk-num">3</span></button>
      <button type="button" class="wonk-stat bare"><span class="wonk-num">4</span></button>
      <div class="chk-app"><button type="button" class="wonk-stat app"><span class="wonk-num">5</span></button></div>`);
    try {
      const cs = (sel) => getComputedStyle(host.querySelector(sel));
      for (const prop of ["paddingTop", "paddingLeft", "borderTopWidth", "borderTopStyle", "backgroundColor"]) {
        eq(cs(".tile")[prop], cs(".ref")[prop], `button.wonk-card.wonk-stat ${prop}`);
      }
      eq(cs(".accent").borderTopWidth, "3px", "button.wonk-card--accent.wonk-stat border-top-width");
      eq(cs(".bare").paddingTop, "0px", "a bare button.wonk-stat padding-top");
      eq(cs(".bare").borderTopStyle, "none", "a bare button.wonk-stat border-top-style");
      eq(cs(".app").paddingTop, "0px", "an app's bare button rule must not reach button.wonk-stat padding");
      eq(cs(".app").backgroundColor, "rgba(0, 0, 0, 0)", "an app's bare button rule must not reach button.wonk-stat background");
    } finally {
      host.remove();
    }
  });

  check("kv at 390px: a long label stacks over its value, and every dd stays inside the list", async () => {
    const f = await loadWonkFrame({
      width: 390,
      css: ["../assets/wonk-tokens.css", "../assets/wonk.css"],
      body: `
        <dl class="wonk-kv" style="margin:16px">
          <dt>could mixpanel have changed it (ai)</dt><dd>Yes: the tracking plan changed on 2026-09-01 and the event was renamed</dd>
          <dt>owner</dt><dd>Dana Lee</dd>
        </dl>`,
    });
    try {
      const dl = f.doc.querySelector("dl");
      const right = dl.getBoundingClientRect().right;
      const dt = dl.querySelector("dt");
      const dds = [...dl.querySelectorAll("dd")];
      assert(dds[0].getBoundingClientRect().top >= dt.getBoundingClientRect().bottom - 0.5, "at 390px a value should sit under its label");
      dds.forEach((dd, i) => {
        const r = dd.getBoundingClientRect().right;
        assert(r <= right + 0.5, `dd ${i} right edge ${r} should be inside the list (${right})`);
      });
    } finally {
      f.cleanup();
    }
  });

  check("fold card at 390px: the summary's + is pinned top right (absolute, at the top padding), and the wrapped facts stay clear of it", async () => {
    const f = await loadWonkFrame({
      width: 390,
      css: ["../assets/wonk-tokens.css", "../assets/wonk.css"],
      body: `
        <details class="wonk-card wonk-card--fold" style="margin:8px">
          <summary><span class="headline">Acme renewal with a long account name · $820k</span><span class="facts">AE Dana · CE Lee · closes Oct 31 · stage 4 · risk high</span></summary>
          <div class="body">x</div>
        </details>`,
    });
    try {
      const summary = f.doc.querySelector("summary");
      const s = f.win.getComputedStyle(summary);
      const mark = f.win.getComputedStyle(summary, "::after");
      eq(mark.position, "absolute", "summary::after position");
      eq(mark.top, s.paddingTop, "summary::after top (the summary's top padding)");
      const headline = f.doc.querySelector(".headline").getBoundingClientRect();
      const facts = f.doc.querySelector(".facts").getBoundingClientRect();
      assert(facts.top > headline.top, "setup: at 390px the facts should wrap under the headline");
      const inner = summary.getBoundingClientRect().right - parseFloat(s.paddingRight);
      assert(facts.right <= inner + 0.5 && headline.right <= inner + 0.5, `headline and facts should end before the + column (${inner}), got ${headline.right} and ${facts.right}`);
    } finally {
      f.cleanup();
    }
  });

  check("table: a header with a hint gets the dotted term underline (on the sort button's text when sortable); a header without one gets none", () => {
    const host = withFixture(`
      <table class="wonk-table"><thead><tr>
        <th class="plain">plain</th>
        <th class="hinted" data-tip="def">hinted</th>
        <th class="sortable" data-tip="def"><button type="button" class="wonk-sort">sortable<span class="wonk-sort-arrow">↓</span></button></th>
      </tr></thead></table>`);
    try {
      const cs = (sel) => getComputedStyle(host.querySelector(sel));
      assert(cs("th.hinted").textDecorationLine.includes("underline"), `th[data-tip] should be underlined, got ${cs("th.hinted").textDecorationLine}`);
      eq(cs("th.hinted").textDecorationStyle, "dotted", "th[data-tip] text-decoration-style");
      assert(cs("th.sortable .wonk-sort").textDecorationLine.includes("underline"), "a hinted sortable header's button should be underlined");
      eq(cs("th.sortable .wonk-sort").textDecorationStyle, "dotted", "hinted .wonk-sort text-decoration-style");
      assert(!cs("th.plain").textDecorationLine.includes("underline"), "a header without a hint should not be underlined");
    } finally {
      host.remove();
    }
  });

  // ---- tabs ----
  check("tabs(root): clicking tab 2 hides panel 1, shows panel 2, and selects tab 2", () => {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="wonk-tabs">
        <button type="button" class="wonk-tab" data-panel="#${id}-1" aria-selected="true">one</button>
        <button type="button" class="wonk-tab" data-panel="#${id}-2" aria-selected="false">two</button>
      </div>
      <div id="${id}-1">panel one</div>
      <div id="${id}-2" hidden>panel two</div>
    `);
    try {
      const root = host.querySelector(".wonk-tabs");
      const [, tab2] = host.querySelectorAll(".wonk-tab");
      const panel1 = host.querySelector(`#${id}-1`);
      const panel2 = host.querySelector(`#${id}-2`);
      wonk.tabs(root);
      tab2.click();
      assert(panel1.hidden === true, "panel 1 should be hidden after clicking tab 2");
      assert(panel2.hidden === false, "panel 2 should not be hidden after clicking tab 2");
      assert(tab2.getAttribute("aria-selected") === "true", `expected tab 2 aria-selected="true", got ${JSON.stringify(tab2.getAttribute("aria-selected"))}`);
    } finally {
      host.remove();
    }
  });

  // builds a three-tab fixture; returns { host, root, tabs, panels, cleanup }
  function tabsFixture({ selected = 0, hideAll = false } = {}) {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="wonk-tabs">
        ${[0, 1, 2].map((i) =>
          `<button type="button" class="wonk-tab" data-panel="#${id}-${i}"${i === selected ? ' aria-selected="true"' : ""}>t${i}</button>`
        ).join("")}
      </div>
      ${[0, 1, 2].map((i) => `<div id="${id}-${i}"${hideAll ? " hidden" : ""}>panel ${i}</div>`).join("")}
    `);
    return {
      host,
      root: host.querySelector(".wonk-tabs"),
      tabs: [...host.querySelectorAll(".wonk-tab")],
      panels: [0, 1, 2].map((i) => host.querySelector(`#${id}-${i}`)),
    };
  }
  const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

  check("tabs(root): sets tablist/tab/tabpanel roles, ids, aria-controls, aria-labelledby, roving tabindex", () => {
    const { host, root, tabs, panels } = tabsFixture({ selected: 1 });
    try {
      wonk.tabs(root);
      assert(root.getAttribute("role") === "tablist", `root role should be tablist, got ${root.getAttribute("role")}`);
      tabs.forEach((t, i) => {
        assert(t.getAttribute("role") === "tab", `tab ${i} role should be tab, got ${t.getAttribute("role")}`);
        assert(!!t.id, `tab ${i} should have an id`);
        assert(t.getAttribute("aria-controls") === panels[i].id, `tab ${i} aria-controls should be "${panels[i].id}", got ${t.getAttribute("aria-controls")}`);
        assert(panels[i].getAttribute("role") === "tabpanel", `panel ${i} role should be tabpanel`);
        assert(panels[i].getAttribute("aria-labelledby") === t.id, `panel ${i} aria-labelledby should be the tab id`);
        const wantIdx = i === 1 ? "0" : "-1";
        assert(t.getAttribute("tabindex") === wantIdx, `tab ${i} tabindex should be ${wantIdx}, got ${t.getAttribute("tabindex")}`);
      });
    } finally {
      host.remove();
    }
  });

  check("tabs(root): ArrowRight/ArrowLeft (wrapping), Home, End move selection and focus", () => {
    const { host, root, tabs, panels } = tabsFixture();
    try {
      wonk.tabs(root);
      tabs[0].focus();
      key(tabs[0], "ArrowRight");
      assert(tabs[1].getAttribute("aria-selected") === "true", "ArrowRight should select tab 1");
      assert(document.activeElement === tabs[1], "ArrowRight should move focus to tab 1");
      assert(panels[1].hidden === false && panels[0].hidden === true, "ArrowRight should show panel 1 only");
      key(tabs[1], "End");
      assert(document.activeElement === tabs[2] && tabs[2].getAttribute("aria-selected") === "true", "End should select + focus the last tab");
      key(tabs[2], "ArrowRight");
      assert(document.activeElement === tabs[0] && tabs[0].getAttribute("aria-selected") === "true", "ArrowRight on the last tab should wrap to the first");
      key(tabs[0], "ArrowLeft");
      assert(document.activeElement === tabs[2], "ArrowLeft on the first tab should wrap to the last");
      key(tabs[2], "Home");
      assert(document.activeElement === tabs[0] && tabs[0].getAttribute("tabindex") === "0", "Home should select + focus the first tab (tabindex 0)");
      assert(tabs[2].getAttribute("tabindex") === "-1", "unselected tabs should have tabindex -1");
    } finally {
      host.remove();
    }
  });

  check("tabs(root): a tab with no data-panel does not throw and the other tabs still work", () => {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="wonk-tabs">
        <button type="button" class="wonk-tab" aria-selected="true" data-panel="#${id}-1">one</button>
        <button type="button" class="wonk-tab">orphan</button>
        <button type="button" class="wonk-tab" data-panel="#${id}-3">three</button>
      </div>
      <div id="${id}-1">panel one</div>
      <div id="${id}-3" hidden>panel three</div>
    `);
    const realWarn = console.warn;
    let warned = 0;
    console.warn = () => { warned++; };
    try {
      const root = host.querySelector(".wonk-tabs");
      const tabs = host.querySelectorAll(".wonk-tab");
      wonk.tabs(root);
      assert(warned === 1, `expected exactly one console.warn for the orphan tab, got ${warned}`);
      tabs[2].click();
      assert(host.querySelector(`#${id}-3`).hidden === false, "panel three should show after clicking tab three");
      assert(host.querySelector(`#${id}-1`).hidden === true, "panel one should hide after clicking tab three");
    } finally {
      console.warn = realWarn;
      host.remove();
    }
  });

  check("tabs(root): wiring syncs panels to the selected tab (first tab when none is selected)", () => {
    const a = tabsFixture({ selected: 2 });
    const b = tabsFixture({ selected: -1, hideAll: false });
    try {
      wonk.tabs(a.root);
      assert(a.panels.map((p) => p.hidden).join() === "true,true,false", `expected only panel 2 visible, got hidden=${a.panels.map((p) => p.hidden)}`);
      wonk.tabs(b.root);
      assert(b.tabs[0].getAttribute("aria-selected") === "true", "with no selected tab, the first tab should be selected");
      assert(b.panels.map((p) => p.hidden).join() === "false,true,true", `expected only panel 0 visible, got hidden=${b.panels.map((p) => p.hidden)}`);
    } finally {
      a.host.remove();
      b.host.remove();
    }
  });

  check("tabs(root): a click or arrow key that selects another tab fires one bubbling wonk:tabchange on the tablist with {tab, panel}; wiring and the current tab fire none", () => {
    const { host, root, tabs, panels } = tabsFixture({ selected: 0 });
    const seen = [];
    const onChange = (e) => seen.push({ target: e.target, tab: e.detail.tab, panel: e.detail.panel });
    host.addEventListener("wonk:tabchange", onChange);
    try {
      wonk.tabs(root);
      eq(seen.length, 0, "events after wiring");
      tabs[0].click();
      eq(seen.length, 0, "events after clicking the selected tab");
      key(tabs[0], "ArrowRight");
      eq(seen.length, 1, "events after ArrowRight");
      assert(seen[0].target === root && seen[0].tab === tabs[1] && seen[0].panel === panels[1], "the event should fire on the tablist and name tab 1 and panel 1");
      tabs[2].click();
      eq(seen.length, 2, "events after clicking tab 2");
      assert(seen[1].tab === tabs[2] && seen[1].panel === panels[2], "the second event should name tab 2 and panel 2");
    } finally {
      host.removeEventListener("wonk:tabchange", onChange);
      host.remove();
    }
  });

  // ---- spark ----
  check("spark(el, [1, 3, 2]) renders an svg polyline with no NaN in points", () => {
    const host = withFixture("<span></span>");
    try {
      const el = host.querySelector("span");
      wonk.spark(el, [1, 3, 2]);
      const svg = el.querySelector("svg");
      assert(!!svg, "expected an <svg> inside the element");
      const line = svg.querySelector("polyline");
      assert(!!line, "expected a <polyline> inside the svg");
      const points = line.getAttribute("points") || "";
      assert(points.trim().length > 0, "expected a non-empty points attribute");
      assert(!points.includes("NaN"), `points contains NaN: "${points}"`);
    } finally {
      host.remove();
    }
  });

  check("spark(el, []) renders nothing; spark(el, [5]) draws one centered dot; non-finite values are dropped; never NaN", () => {
    const host = withFixture("<span></span><span></span><span></span>");
    try {
      const [empty, one, mixed] = host.querySelectorAll("span");
      empty.textContent = "stale";
      wonk.spark(empty, []);
      assert(empty.innerHTML === "", `spark([]) should leave the element empty, got "${empty.innerHTML}"`);
      wonk.spark(one, [5], { w: 120, h: 32 });
      assert(!one.innerHTML.includes("NaN"), `spark([5]) markup contains NaN: ${one.innerHTML}`);
      const dot = one.querySelector("circle");
      assert(!!dot, "spark([5]) should draw a dot");
      assert(dot.getAttribute("cx") === "60.0" && dot.getAttribute("cy") === "16.0", `spark([5]) dot should be centered at 60,16, got ${dot.getAttribute("cx")},${dot.getAttribute("cy")}`);
      wonk.spark(mixed, [1, NaN, 3, Infinity, 2]);
      assert(!mixed.innerHTML.includes("NaN") && !mixed.innerHTML.includes("Infinity"), `non-finite values leaked into markup: ${mixed.innerHTML}`);
      const pts = mixed.querySelector("polyline").getAttribute("points").trim().split(/\s+/);
      assert(pts.length === 3, `expected 3 plotted points after dropping non-finite values, got ${pts.length}`);
    } finally {
      host.remove();
    }
  });

  // ---- menu ----
  function menuFixture(style) {
    const host = document.createElement("div");
    host.style.cssText = style;
    host.innerHTML = `
      <details class="wonk-menu">
        <summary class="wonk-btn">actions</summary>
        <div class="menu">
          <button type="button">first</button>
          <button type="button">second</button>
        </div>
      </details>`;
    document.body.appendChild(host);
    wonk.init(host);
    return { host, menu: host.querySelector(".wonk-menu") };
  }
  const toggled = (details) => new Promise((resolve) => details.addEventListener("toggle", resolve, { once: true }));

  check("menu: clicking an item closes it; Escape closes it and returns focus to the summary", async () => {
    const { host, menu } = menuFixture("position:fixed; left:0; top:0;");
    try {
      menu.open = true;
      await toggled(menu);
      menu.querySelector(".menu button").click();
      assert(menu.open === false, "clicking a menu item should close the menu");
      menu.open = true;
      await toggled(menu);
      const second = menu.querySelectorAll(".menu button")[1];
      second.focus();
      key(second, "Escape");
      assert(menu.open === false, "Escape should close the menu");
      assert(document.activeElement === menu.querySelector("summary"), "Escape should return focus to the summary");
    } finally {
      host.remove();
    }
  });

  check("menu: opening near the viewport's right edge adds .wonk-menu--end so the panel stays on screen", async () => {
    const { host, menu } = menuFixture("position:fixed; right:0; top:0;");
    try {
      menu.open = true;
      await toggled(menu);
      assert(menu.classList.contains("wonk-menu--end"), "expected .wonk-menu--end on a right-edge menu");
      const r = menu.querySelector(".menu").getBoundingClientRect();
      assert(r.right <= document.documentElement.clientWidth + 0.5, `menu panel overflows the viewport: right=${r.right}, viewport=${document.documentElement.clientWidth}`);
    } finally {
      host.remove();
    }
  });

  // ---- reveal ----
  check("reveal: a .wonk-reveal injected after init stays visible until armed, then gets is-in within 500ms", async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; left:0; top:0; width:200px;";
    document.body.appendChild(host);
    try {
      const sec = document.createElement("section");
      sec.className = "wonk-reveal";
      sec.textContent = "injected";
      host.appendChild(sec);
      const before = getComputedStyle(sec).opacity;
      assert(before === "1", `an un-armed injected .wonk-reveal must be visible, computed opacity was ${before}`);
      const t0 = performance.now();
      while (!sec.classList.contains("is-in") && performance.now() - t0 < 500) await frame();
      assert(sec.classList.contains("is-in"), "injected .wonk-reveal should be observed and marked is-in within 500ms");
    } finally {
      host.remove();
    }
  });

  // ---- contrast ----
  // For every pair x theme: read the computed tokens off <html>,
  // alpha-composite rgba text tokens over each opaque background, and
  // compute the WCAG 2 contrast ratio. The gate for any token change.
  const PAIRS = ["metathesis", "glorpla", "demogorgon", "ancient", "flourish"];
  const TEXT_TOKENS = ["--ak-ink", "--ak-ink-2", "--ak-ink-3", "--ak-a1-text", "--ak-a2-text", "--ak-ok", "--ak-warn", "--ak-err", "--ak-info"];
  const BG_TOKENS = ["--ak-ground", "--ak-surface", "--ak-surface-2"];

  // any CSS color string -> [r, g, b, a] via the browser's own parser
  function parseColor(probe, value) {
    probe.style.color = "";
    probe.style.color = value;
    if (!probe.style.color) throw new Error(`unparseable color token value "${value}"`);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
  }
  const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
  function luminance([r, g, b]) {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function ratio(fg, bg) {
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  }

  check("contrast: every text token >= 4.5:1 on ground/surface/surface-2, and a1-ink on a1, for 5 pairs x 2 themes", () => {
    const root = document.documentElement;
    const originalPair = root.getAttribute("data-pair");
    const originalTheme = root.getAttribute("data-theme");
    const probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
    const failures = [];
    try {
      for (const pair of PAIRS) {
        for (const theme of ["dark", "paper"]) {
          root.setAttribute("data-pair", pair);
          if (theme === "paper") root.setAttribute("data-theme", "paper");
          else root.removeAttribute("data-theme");
          const css = getComputedStyle(root);
          const read = (name) => {
            const v = css.getPropertyValue(name).trim();
            if (!v) throw new Error(`${pair}/${theme}: token ${name} is empty`);
            return parseColor(probe, v);
          };
          for (const bgName of BG_TOKENS) {
            const bg = read(bgName);
            if (bg[3] !== 1) throw new Error(`${pair}/${theme}: background ${bgName} must be opaque`);
            for (const fgName of TEXT_TOKENS) {
              const r = ratio(over(read(fgName), bg), bg);
              if (r < 4.5) failures.push(`${pair}/${theme}/${fgName}/${bgName} ${r.toFixed(2)}`);
            }
          }
          const a1 = read("--ak-a1");
          const r = ratio(over(read("--ak-a1-ink"), a1), a1);
          if (r < 4.5) failures.push(`${pair}/${theme}/--ak-a1-ink/--ak-a1 ${r.toFixed(2)}`);
        }
      }
    } finally {
      probe.remove();
      restoreRootAttr("data-pair", originalPair);
      restoreRootAttr("data-theme", originalTheme);
    }
    assert(failures.length === 0, `${failures.length} pair(s) below 4.5:1: ${failures.join("; ")}`);
  });

  // ---- focus indicators ----
  // Keyboard focus must draw a visible ring: a non-none outline or
  // box-shadow on the control (or on the toggle's .track, since the real
  // checkbox is invisible), and the stepper row must not clip it.
  function hasRing(el) {
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    return outline || cs.boxShadow !== "none";
  }
  function clipped(el, clipper) {
    const cs = getComputedStyle(el);
    const reach = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
    return getComputedStyle(clipper).overflow === "hidden" && reach > 0 && cs.boxShadow === "none";
  }

  check("focus: toggle, knob value, stepper input + buttons, and text input show an unclipped focus ring", () => {
    const host = withFixture(`
      <label class="wonk-toggle"><input type="checkbox"><span class="track"></span></label>
      <div data-wonk-knob data-label="gain" data-min="0" data-max="10" data-value="5"></div>
      <fieldset class="wonk-stepper">
        <div class="wonk-stepper-row">
          <button type="button" class="wonk-stepper-btn" data-dir="-1" aria-label="less">-</button>
          <input type="number" class="wonk-stepper-input" aria-label="n" value="3">
          <button type="button" class="wonk-stepper-btn" data-dir="1" aria-label="more">+</button>
        </div>
      </fieldset>
      <input class="wonk-input" aria-label="text">
    `);
    const failures = [];
    const focus = (el) => el.focus({ focusVisible: true, preventScroll: true });
    try {
      wonk.knob(host.querySelector("[data-wonk-knob]"));
      const toggle = host.querySelector(".wonk-toggle input");
      focus(toggle);
      if (!hasRing(host.querySelector(".wonk-toggle .track"))) failures.push("toggle: .track shows no ring when its input has focus");
      const val = host.querySelector(".wonk-knob .val");
      focus(val);
      if (!hasRing(val)) failures.push("knob .val: no ring");
      const row = host.querySelector(".wonk-stepper-row");
      const [less, more] = host.querySelectorAll(".wonk-stepper-btn");
      for (const [name, el] of [["stepper input", host.querySelector(".wonk-stepper-input")], ["stepper - button", less], ["stepper + button", more]]) {
        focus(el);
        if (!hasRing(el)) failures.push(`${name}: no ring`);
        else if (clipped(el, row)) failures.push(`${name}: ring is clipped by .wonk-stepper-row overflow:hidden`);
      }
      const text = host.querySelector(".wonk-input");
      focus(text);
      if (!hasRing(text)) failures.push(".wonk-input: no ring (border color alone is not a focus indicator)");
    } finally {
      if (host.contains(document.activeElement)) document.activeElement.blur();
      host.remove();
    }
    assert(failures.length === 0, failures.join("; "));
  });

  // ---- hints: data-tip / data-hint / data-term, glossary, wonk.tip ----
  // One visual box (.wonk-hint, aria-hidden) follows hover, tap, and
  // focus; one visually hidden #wonk-hint-sr describes the focused
  // control. Fixtures are hidden; the box itself may show during a check.
  const SR_ID = "wonk-hint-sr";
  const hintBox = () => document.querySelector(".wonk-hint");
  const hintShown = () => {
    const b = hintBox();
    return !!b && !b.hidden && getComputedStyle(b).display !== "none" && b.getBoundingClientRect().width > 0;
  };
  const describedBy = (el) => (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  const touch = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true }));
  const mouse = (el, type, relatedTarget = null) =>
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget }));
  // check cleanup: blur the fixture's focused control, then hide the box.
  // Tolerates a missing wonk.hint so a failing check still tears down.
  function resetHint() {
    const a = document.activeElement;
    if (a && a !== document.body) a.blur();
    if (window.wonk && wonk.hint) wonk.hint.hide();
  }

  check("hint: focusing a button[data-tip] shows an aria-hidden .wonk-hint with its text and describes the button via #wonk-hint-sr", () => {
    const text = "Runs the query with the current draft";
    const host = withFixture(`<button type="button" data-tip="${text}">Run</button>`);
    const btn = host.querySelector("button");
    try {
      btn.focus();
      assert(hintShown(), "expected a visible .wonk-hint after focusing the button");
      const box = hintBox();
      assert(box.textContent === text, `box text should be the data-tip, got ${JSON.stringify(box.textContent)}`);
      assert(box.getAttribute("aria-hidden") === "true", "the visual box must be aria-hidden (screen readers get #wonk-hint-sr)");
      assert(describedBy(btn).includes(SR_ID), `button aria-describedby should include ${SR_ID}, got ${JSON.stringify(btn.getAttribute("aria-describedby"))}`);
      const sr = document.getElementById(SR_ID);
      assert(!!sr && sr.textContent === text, `#${SR_ID} should hold the hint text, got ${sr ? JSON.stringify(sr.textContent) : "no element"}`);
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: an existing aria-describedby=\"x\" keeps x and gains wonk-hint-sr; blur removes only wonk-hint-sr", () => {
    const host = withFixture(`<button type="button" data-tip="with a description" aria-describedby="x">b</button>`);
    const btn = host.querySelector("button");
    try {
      btn.focus();
      const ids = describedBy(btn);
      assert(ids.includes("x") && ids.includes(SR_ID), `expected tokens x and ${SR_ID}, got ${JSON.stringify(btn.getAttribute("aria-describedby"))}`);
      btn.blur();
      assert(btn.getAttribute("aria-describedby") === "x", `blur should leave only "x", got ${JSON.stringify(btn.getAttribute("aria-describedby"))}`);
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: a touch pointerdown on a span[data-tip] shows the box; a touch pointerdown elsewhere hides it", () => {
    const host = withFixture(`<span class="target" data-tip="touch text">tap me</span> <span class="elsewhere">elsewhere</span>`);
    try {
      touch(host.querySelector(".target"));
      assert(hintShown(), "a touch pointerdown on the target should show the box at once");
      assert(hintBox().textContent === "touch text", `box text should be "touch text", got ${JSON.stringify(hintBox().textContent)}`);
      touch(host.querySelector(".elsewhere"));
      assert(!hintShown(), "a touch pointerdown on non-hint content should hide the box");
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: mouseover shows the box after the hover delay; mouseout hides it after the grace period; hovering the box during grace keeps it", async () => {
    const host = withFixture(`<span data-tip="hover text">hover me</span>`);
    const target = host.querySelector("[data-tip]");
    // This check plays the pointer with synthetic events. A real (trusted)
    // pointer must not take part: headless Chromium on Linux keeps its
    // cursor inside the viewport and sends a trusted mouseover to whatever
    // sits under it after a layout change, which correctly cancels the
    // pending hover. Stop trusted mouse events before wonk.js sees them.
    const isolate = (e) => { if (e.isTrusted) e.stopImmediatePropagation(); };
    window.addEventListener("mouseover", isolate, true);
    window.addEventListener("mouseout", isolate, true);
    try {
      mouse(target, "mouseover");
      assert(!hintShown(), "hover should wait out the short delay, not show synchronously");
      await sleep(120);
      assert(hintShown(), "mouseover should show the box within 120ms");
      assert(getComputedStyle(hintBox()).pointerEvents !== "none", "the box must be hoverable (pointer-events not none)");
      mouse(target, "mouseout", document.body);
      await sleep(300);
      assert(!hintShown(), "mouseout onto non-hint content should hide the box after the grace period");

      mouse(target, "mouseover");
      await sleep(120);
      assert(hintShown(), "a second mouseover should show the box again");
      mouse(target, "mouseout", document.body);
      await sleep(40);
      assert(hintShown(), "the box should still show during the grace period");
      const box = hintBox();
      mouse(box, "mouseover", document.body);
      await sleep(300);
      assert(hintShown(), "hovering the box during the grace period should keep it");
      mouse(box, "mouseout", document.body);
      await sleep(300);
      assert(!hintShown(), "leaving the box should hide it after the grace period");
    } finally {
      window.removeEventListener("mouseover", isolate, true);
      window.removeEventListener("mouseout", isolate, true);
      resetHint();
      host.remove();
    }
  });

  check("hint: Escape hides the box; focus and the screen-reader description stay", () => {
    const host = withFixture(`<button type="button" data-tip="escape text">b</button>`);
    const btn = host.querySelector("button");
    try {
      btn.focus();
      assert(hintShown(), "focus should show the box");
      key(btn, "Escape");
      assert(!hintShown(), "Escape should hide the box");
      assert(document.activeElement === btn, "focus should stay on the button after Escape");
      const sr = document.getElementById(SR_ID);
      assert(describedBy(btn).includes(SR_ID) && !!sr && sr.textContent === "escape text", "the description should stay while focus stays");
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: in an open modal, Escape while the focused button's box shows only hides it (defaultPrevented, no bubbling); with no box it passes through", () => {
    const dlg = document.createElement("dialog");
    dlg.className = "wonk-modal";
    dlg.innerHTML = `<button type="button" data-tip="modal escape">inside</button>`;
    document.body.appendChild(dlg);
    let bubbled = 0;
    const onBubble = () => { bubbled++; };
    document.addEventListener("keydown", onBubble);
    const esc = () => new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    try {
      dlg.showModal();
      const btn = dlg.querySelector("button");
      btn.focus();
      assert(hintShown(), "focusing the button inside the modal should show the box");
      const first = esc();
      btn.dispatchEvent(first);
      assert(!hintShown(), "the first Escape should hide the box");
      assert(first.defaultPrevented === true, "the first Escape should be defaultPrevented so the dialog stays open");
      assert(bubbled === 0, "the first Escape should not reach bubble-phase listeners (a drawer, a menu)");
      assert(dlg.open, "the dialog should stay open");
      const second = esc();
      btn.dispatchEvent(second);
      assert(second.defaultPrevented === false, "with no box showing, Escape should not be defaultPrevented");
      assert(bubbled === 1, `with no box showing, Escape should bubble, reached bubble listeners ${bubbled} times`);
    } finally {
      document.removeEventListener("keydown", onBubble);
      resetHint();
      if (dlg.open) dlg.close();
      dlg.remove();
    }
  });

  check("hint: a focused <input> whose <label> has data-tip shows the label's text and is described by it", () => {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`<label for="${id}" data-tip="Matches deal names">search</label><input id="${id}">`);
    const input = host.querySelector("input");
    try {
      input.focus();
      assert(hintShown(), "focusing the input should show its label's hint");
      assert(hintBox().textContent === "Matches deal names", `box text should be the label's data-tip, got ${JSON.stringify(hintBox().textContent)}`);
      assert(describedBy(input).includes(SR_ID), "the input should be described by #wonk-hint-sr");
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: init gives .wonk-term, span[data-tip], and thead th[data-tip] tabindex=0; skips tbody, buttons, and data-tip-focus=off; an injected node gets it within a frame", async () => {
    const host = withFixture(`
      <span class="term wonk-term" data-tip="def">term</span>
      <span class="plain" data-tip="plain">plain</span>
      <span class="off" data-tip="off" data-tip-focus="off">off</span>
      <button type="button" data-tip="native">native</button>
      <table><thead><tr><th data-tip="column">col</th></tr></thead>
      <tbody><tr><td><span class="cell" data-tip="cell">1</span></td></tr></tbody></table>`);
    try {
      wonk.init(host);
      const idx = (sel) => host.querySelector(sel).getAttribute("tabindex");
      assert(idx(".term") === "0", `.wonk-term tabindex should be "0", got ${JSON.stringify(idx(".term"))}`);
      assert(idx(".plain") === "0", `span[data-tip] tabindex should be "0", got ${JSON.stringify(idx(".plain"))}`);
      assert(idx("th") === "0", `thead th[data-tip] tabindex should be "0", got ${JSON.stringify(idx("th"))}`);
      assert(idx(".cell") === null, `a span[data-tip] in a tbody must not get a tabindex, got ${JSON.stringify(idx(".cell"))}`);
      assert(idx("button") === null, `a natively focusable button must not get a tabindex, got ${JSON.stringify(idx("button"))}`);
      assert(idx(".off") === null, `data-tip-focus="off" must not get a tabindex, got ${JSON.stringify(idx(".off"))}`);
      const late = document.createElement("span");
      late.setAttribute("data-tip", "late");
      late.textContent = "late";
      host.appendChild(late);
      for (let i = 0; i < 3 && !late.hasAttribute("tabindex"); i++) await frame();
      assert(late.getAttribute("tabindex") === "0", `a span[data-tip] injected after init should get tabindex "0" within a frame, got ${JSON.stringify(late.getAttribute("tabindex"))}`);
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: data-term resolves its text from wonk.glossary; an unknown term shows no box and warns once", () => {
    const term = "wonkcheck" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <span class="known wonk-term" data-term="${term}">Known</span>
      <span class="missing wonk-term" data-term="${term}-missing">Missing</span>`);
    const realWarn = console.warn;
    let warned = 0;
    console.warn = () => { warned++; };
    try {
      const map = wonk.glossary({ [term]: "def" });
      assert(map && map[term] === "def", "wonk.glossary(map) should return the merged map");
      wonk.init(host);
      const known = host.querySelector(".known");
      const missing = host.querySelector(".missing");
      known.focus();
      assert(hintShown(), "focusing a known term should show the box");
      assert(hintBox().textContent === "def", `box text should be the glossary definition, got ${JSON.stringify(hintBox().textContent)}`);
      known.blur();
      missing.focus();
      assert(!hintShown(), "an unknown term should show no box");
      missing.blur();
      missing.focus();
      assert(warned === 1, `expected exactly one console.warn for the unknown term, got ${warned}`);
    } finally {
      console.warn = realWarn;
      resetHint();
      host.remove();
    }
  });

  check("hint: data-hint works as an alias of data-tip", () => {
    const host = withFixture(`<button type="button" data-hint="alias text">b</button>`);
    const btn = host.querySelector("button");
    try {
      btn.focus();
      assert(hintShown(), "focusing a button[data-hint] should show the box");
      assert(hintBox().textContent === "alias text", `box text should be the data-hint, got ${JSON.stringify(hintBox().textContent)}`);
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: the box wraps, stays 8px inside the viewport for a right-edge target, and flips above a bottom-edge target", () => {
    const long = "a longer hint that has to wrap onto more than one line inside the box, like a real definition";
    const make = (css) => {
      const el = document.createElement("span");
      el.style.cssText = `position:fixed; visibility:hidden; ${css}`;
      el.setAttribute("data-tip", long);
      el.textContent = "target";
      document.body.appendChild(el);
      return el;
    };
    const right = make("right:0; top:120px;");
    const bottom = make("left:50%; bottom:0;");
    try {
      wonk.hint.show(right);
      assert(hintShown(), "wonk.hint.show(el) should show the box");
      let r = hintBox().getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      assert(r.width <= Math.min(20 * rem, innerWidth - 16) + 0.5, `box should wrap at 20rem, width was ${r.width}`);
      assert(r.right <= innerWidth - 8 + 0.5, `box right ${r.right} should be <= innerWidth - 8 (${innerWidth - 8})`);
      assert(r.left >= 8 - 0.5, `box left ${r.left} should be >= 8`);
      wonk.hint.show(bottom);
      r = hintBox().getBoundingClientRect();
      const t = bottom.getBoundingClientRect();
      assert(r.bottom <= t.top + 0.5, `box should flip above a bottom-edge target: box bottom ${r.bottom}, target top ${t.top}`);
      assert(r.top >= 8 - 0.5, `box top ${r.top} should be >= 8`);
    } finally {
      resetHint();
      right.remove();
      bottom.remove();
    }
  });

  check("hint: wonk.tip(root, sel, render) shows a returned Node on focus, a returned string as literal text, is idempotent, and destroy() stops it", () => {
    const host = withFixture(`
      <button type="button" class="cell" data-kind="node">n</button>
      <button type="button" class="cell" data-kind="str">s</button>`);
    const render = (el) => {
      if (el.dataset.kind === "str") return "<b>not bold</b>";
      const frag = document.createDocumentFragment();
      const strong = document.createElement("strong");
      strong.className = "rich";
      strong.textContent = "3 deals";
      frag.append(strong, document.createTextNode(" · $12k"));
      return frag;
    };
    let handle = null;
    try {
      handle = wonk.tip(host, ".cell", render);
      assert(wonk.tip(host, ".cell", render) === handle, "a second wonk.tip(root, sel) should return the same handle");
      const [nodeBtn, strBtn] = host.querySelectorAll(".cell");
      nodeBtn.focus();
      assert(hintShown(), "focusing a rich-tip target should show the box");
      assert(!!hintBox().querySelector("strong.rich"), "a returned Node should be rendered as built");
      assert(hintBox().textContent === "3 deals · $12k", `box text should be the node's text, got ${JSON.stringify(hintBox().textContent)}`);
      const sr = document.getElementById(SR_ID);
      assert(!!sr && sr.textContent === "3 deals · $12k", "the description should be the rendered textContent");
      nodeBtn.blur();
      strBtn.focus();
      assert(hintBox().textContent === "<b>not bold</b>", `a returned string should show as literal text, got ${JSON.stringify(hintBox().textContent)}`);
      assert(!hintBox().querySelector("b"), "a returned string must never be parsed as HTML");
      strBtn.blur();
      handle.destroy();
      nodeBtn.focus();
      assert(!hintShown(), "after destroy() the rich tip should not show");
    } finally {
      if (handle) handle.destroy();
      resetHint();
      host.remove();
    }
  });

  check("hint: a th[data-tip] in .wonk-table-scroll puts the box outside the scroll container; in an open modal the box is the dialog's child, placed below its target", async () => {
    const host = withFixture(`
      <div class="wonk-table-scroll" tabindex="0" style="max-height:80px">
        <table class="wonk-table"><thead><tr><th data-tip="column hint">col</th></tr></thead>
        <tbody><tr><td>1</td></tr></tbody></table>
      </div>`);
    const dlg = document.createElement("dialog");
    dlg.className = "wonk-modal";
    dlg.innerHTML = `<button type="button" data-tip="modal hint">inside</button>`;
    document.body.appendChild(dlg);
    try {
      wonk.init(host);
      const th = host.querySelector("th");
      th.focus();
      assert(hintShown(), "focusing the th[data-tip] should show the box");
      const scroller = host.querySelector(".wonk-table-scroll");
      assert(!scroller.contains(hintBox()), "the box must never be inside the scroll container");
      assert(hintBox().parentElement === document.body, `the box should be a child of <body>, got ${hintBox().parentElement ? hintBox().parentElement.tagName : "none"}`);
      th.blur();

      dlg.showModal();
      const btn = dlg.querySelector("button");
      btn.focus();
      await sleep(400); // let the wonk-pop open animation finish (its transform ends as none)
      assert(hintShown(), "focusing a button inside the modal should show the box");
      assert(hintBox().parentElement === dlg, `inside an open modal the box should be a child of the dialog, got ${hintBox().parentElement ? hintBox().parentElement.tagName : "none"}`);
      const r = hintBox().getBoundingClientRect();
      const a = btn.getBoundingClientRect();
      assert(r.top >= a.bottom - 0.5 && r.top - a.bottom < 20, `box should sit just below its target: box top ${r.top}, target bottom ${a.bottom}`);
      const offCenter = Math.abs((r.left + r.right) / 2 - (a.left + a.right) / 2);
      assert(offCenter < 1, `box should be centered under its target, off by ${offCenter}px`);
    } finally {
      resetHint();
      if (dlg.open) dlg.close();
      dlg.remove();
      host.remove();
      resetHint();
    }
  });

  check("hint: init gives no tabindex inside aria-hidden content (one arrives once aria-hidden comes off), nor to a .wonk-term with no tip of its own inside a control's label; a .wonk-term[data-tip] there keeps one", async () => {
    const id = "wonk-base-check-" + Math.random().toString(36).slice(2);
    const host = withFixture(`
      <div class="hider" aria-hidden="true"><span class="hidden-tip" data-tip="legend">legend</span></div>
      <label for="${id}" data-tip="label hint"><span class="bare wonk-term">Agreement</span> <span class="own wonk-term" data-tip="own definition">rate</span></label>
      <input id="${id}">
      <span class="plain wonk-term" data-tip="plain">plain</span>`);
    try {
      wonk.init(host);
      const idx = (sel) => host.querySelector(sel).getAttribute("tabindex");
      eq(idx(".hidden-tip"), null, "a span[data-tip] inside aria-hidden tabindex");
      eq(idx(".bare"), null, "a .wonk-term with no tip inside a control's label tabindex");
      eq(idx(".own"), "0", "a .wonk-term[data-tip] inside a control's label tabindex");
      eq(idx(".plain"), "0", "a plain .wonk-term[data-tip] tabindex");
      await frame(); // let the insertion's own observer pass run first
      await frame();
      eq(idx(".hidden-tip"), null, "the span[data-tip] inside aria-hidden tabindex after the insertion pass");
      host.querySelector(".hider").removeAttribute("aria-hidden");
      for (let i = 0; i < 3 && idx(".hidden-tip") === null; i++) await frame();
      eq(idx(".hidden-tip"), "0", "the span[data-tip] tabindex within a frame after aria-hidden comes off");
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: keyboard focus into a web component (open shadow root, delegatesFocus) with data-tip shows the box", () => {
    const name = "wonk-chk-field";
    if (!customElements.get(name)) {
      customElements.define(name, class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: "open", delegatesFocus: true }).innerHTML = `<input aria-label="inner">`;
        }
      });
    }
    const host = withFixture(`<${name} data-tip="shadow hint"></${name}>`);
    try {
      const inner = host.querySelector(name).shadowRoot.querySelector("input");
      inner.focus();
      assert(inner.matches(":focus-visible"), "setup: the inner input should match :focus-visible");
      assert(hintShown(), "keyboard focus inside the component should show its box");
      eq(hintBox().textContent, "shadow hint", "box text");
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: a mouse-style focus (not :focus-visible) on a checkbox in label[data-tip] shows no box but describes it; leaving after a hover hides the box; keyboard focus shows a box that stays", async () => {
    const host = withFixture(`<label data-tip="Ends the user"><input type="checkbox"> end the user</label>`);
    const label = host.querySelector("label");
    const box = host.querySelector("input");
    // synthetic pointer only (see the hover check above)
    const isolate = (e) => { if (e.isTrusted) e.stopImmediatePropagation(); };
    window.addEventListener("mouseover", isolate, true);
    window.addEventListener("mouseout", isolate, true);
    try {
      box.focus({ focusVisible: false });
      assert(document.activeElement === box && !box.matches(":focus-visible"), "setup: focus({focusVisible:false}) should focus without :focus-visible, like a mouse click");
      assert(!hintShown(), "a mouse-style focus should show no box");
      const sr = document.getElementById(SR_ID);
      assert(describedBy(box).includes(SR_ID) && !!sr && sr.textContent === "Ends the user", "a mouse-style focus should still describe the checkbox to screen readers");
      mouse(label, "mouseover");
      await sleep(120);
      assert(hintShown(), "hovering the label should show its box");
      mouse(label, "mouseout", document.body);
      await sleep(300);
      assert(!hintShown(), "leaving the label should hide the box, although the checkbox keeps focus");
      box.blur();
      box.focus();
      assert(box.matches(":focus-visible"), "setup: a plain focus() should match :focus-visible here");
      assert(hintShown(), "keyboard focus should show the box");
      mouse(label, "mouseout", document.body);
      await sleep(300);
      assert(hintShown(), "a keyboard focus box should stay while focus stays");
    } finally {
      window.removeEventListener("mouseover", isolate, true);
      window.removeEventListener("mouseout", isolate, true);
      resetHint();
      host.remove();
    }
  });

  check("hint: the box never covers the next control: for the first checkbox row it goes above, for a middle row beside, and with room below it stays below", () => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed; inset:0; z-index:150; background:var(--ak-ground);";
    host.innerHTML = `<div style="position:absolute; top:300px; left:300px; display:grid; gap:4px; justify-items:start">
      ${[1, 2, 3].map((i) => `<label class="r${i}" data-tip="hint for row ${i}"><input type="checkbox"> row ${i}</label>`).join("")}
    </div>`;
    document.body.appendChild(host);
    const rect = (sel) => host.querySelector(sel).getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    try {
      wonk.hint.show(host.querySelector(".r1"));
      let r = hintBox().getBoundingClientRect();
      assert(!overlaps(r, rect(".r2")), "row 1's box should not cover row 2");
      assert(r.bottom <= rect(".r1").top + 0.5, `row 1's box should go above row 1: box bottom ${r.bottom}, row top ${rect(".r1").top}`);
      wonk.hint.show(host.querySelector(".r2"));
      r = hintBox().getBoundingClientRect();
      assert(!overlaps(r, rect(".r1")) && !overlaps(r, rect(".r3")), "row 2's box should cover neither row 1 nor row 3");
      assert(r.left >= rect(".r2").right - 0.5, `row 2's box should go right of row 2: box left ${r.left}, row right ${rect(".r2").right}`);
      wonk.hint.show(host.querySelector(".r3"));
      r = hintBox().getBoundingClientRect();
      assert(r.top >= rect(".r3").bottom - 0.5, `row 3 has room below, so its box should stay below: box top ${r.top}, row bottom ${rect(".r3").bottom}`);
    } finally {
      resetHint();
      host.remove();
    }
  });

  check("hint: a hover hint open while focus sits in a dialog's input: Escape hides the box and still reaches the app (not defaultPrevented, bubbles)", () => {
    const dlg = document.createElement("dialog");
    dlg.className = "wonk-modal";
    dlg.innerHTML = `<input aria-label="field"> <span class="term" data-tip="hover only">term</span>`;
    document.body.appendChild(dlg);
    let bubbled = 0;
    const onBubble = () => { bubbled++; };
    document.addEventListener("keydown", onBubble);
    try {
      dlg.showModal();
      const input = dlg.querySelector("input");
      input.focus();
      wonk.hint.show(dlg.querySelector(".term"));
      assert(hintShown(), "wonk.hint.show should open the term's box");
      const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      input.dispatchEvent(esc);
      assert(!hintShown(), "Escape should hide the box");
      assert(esc.defaultPrevented === false, "a box that is not the focused element's should not cancel Escape");
      assert(bubbled === 1, `Escape should reach bubble-phase listeners (the app's dialog handler), reached ${bubbled} times`);
    } finally {
      document.removeEventListener("keydown", onBubble);
      resetHint();
      if (dlg.open) dlg.close();
      dlg.remove();
    }
  });

  // ---- disclosure: .wonk-acc, .wonk-fold, row toggles, foldAll, fold keys ----
  // Fixtures are created with their final open state (no transition to
  // wait out), so computed pseudo-element transforms are settled values.
  const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`;
  const pseudoTransform = (el, pseudo) => getComputedStyle(el, pseudo).transform;
  // a row toggle is "open" when aria-expanded is true and its target is shown
  const rowOpen = (btn) => {
    const target = document.getElementById(btn.getAttribute("aria-controls"));
    return btn.getAttribute("aria-expanded") === "true" && !!target && !target.hidden;
  };

  check("disclosure: details.wonk-acc (single) open rotates its summary's + and colors it; the nested list form still does", () => {
    const host = withFixture(`
      <details class="wonk-acc single" open><summary>single</summary><div class="body">a</div></details>
      <details class="wonk-acc closed"><summary>closed</summary><div class="body">a</div></details>
      <div class="wonk-acc"><details class="nested" open><summary>nested</summary><div class="body">b</div></details></div>
      <span class="probe" style="color:var(--ak-a1-text)">p</span>`);
    try {
      const single = host.querySelector(".single > summary");
      const closed = host.querySelector(".closed > summary");
      const nested = host.querySelector(".nested > summary");
      const accent = getComputedStyle(host.querySelector(".probe")).color;
      assert(pseudoTransform(single, "::after") !== "none", `open details.wonk-acc summary::after should be rotated, transform was "none"`);
      assert(getComputedStyle(single).color === accent, `open details.wonk-acc summary color should be --ak-a1-text (${accent}), got ${getComputedStyle(single).color}`);
      assert(pseudoTransform(closed, "::after") === "none", `closed details.wonk-acc summary::after should not rotate, got ${pseudoTransform(closed, "::after")}`);
      assert(pseudoTransform(nested, "::after") !== "none", "open .wonk-acc > details summary::after should still be rotated");
    } finally {
      host.remove();
    }
  });

  check("disclosure: .wonk-fold open rotates the + in its summary's ::before; closed does not", () => {
    const host = withFixture(`
      <details class="wonk-fold open" open><summary>How this works</summary><div class="body"><p>x</p></div></details>
      <details class="wonk-fold closed"><summary>How this works</summary><div class="body"><p>x</p></div></details>`);
    try {
      const open = host.querySelector(".open > summary");
      const closed = host.querySelector(".closed > summary");
      const content = getComputedStyle(open, "::before").content;
      assert(content === '"+"', `.wonk-fold summary::before should hold "+", got ${content}`);
      assert(pseudoTransform(open, "::before") !== "none", "open .wonk-fold summary::before should be rotated, transform was \"none\"");
      assert(pseudoTransform(closed, "::before") === "none", `closed .wonk-fold summary::before should not rotate, got ${pseudoTransform(closed, "::before")}`);
    } finally {
      host.remove();
    }
  });

  check("disclosure: clicking a .wonk-row-toggle sets aria-expanded=true and shows its aria-controls row; a second click reverses both", () => {
    const id = uid("wonk-row");
    const host = withFixture(`
      <table class="wonk-table"><tbody>
        <tr><td><button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="${id}">Security review</button></td><td class="num">12</td></tr>
        <tr class="wonk-row-detail" id="${id}" hidden><td colspan="2">detail</td></tr>
      </tbody></table>`);
    try {
      const btn = host.querySelector(".wonk-row-toggle");
      const detail = host.querySelector(".wonk-row-detail");
      btn.click();
      assert(btn.getAttribute("aria-expanded") === "true", `first click: aria-expanded should be "true", got ${JSON.stringify(btn.getAttribute("aria-expanded"))}`);
      assert(detail.hidden === false, "first click: the detail row should not be hidden");
      btn.click();
      assert(btn.getAttribute("aria-expanded") === "false", `second click: aria-expanded should be "false", got ${JSON.stringify(btn.getAttribute("aria-expanded"))}`);
      assert(detail.hidden === true, "second click: the detail row should be hidden again");
    } finally {
      host.remove();
    }
  });

  check("disclosure: a .wonk-row-toggle whose aria-controls target is missing does not throw and warns once", () => {
    const host = withFixture(`<button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="${uid("wonk-missing")}">orphan</button>`);
    const realWarn = console.warn;
    let warned = 0;
    const errors = [];
    const onError = (e) => { errors.push(e.message); e.preventDefault(); };
    console.warn = () => { warned++; };
    window.addEventListener("error", onError);
    try {
      const btn = host.querySelector(".wonk-row-toggle");
      btn.click();
      btn.click();
      assert(errors.length === 0, `clicking an orphan row toggle threw: ${errors.join("; ")}`);
      assert(warned === 1, `expected exactly one console.warn for the missing target, got ${warned}`);
      assert(btn.getAttribute("aria-expanded") === "false", `an orphan toggle should not claim to be expanded, got ${JSON.stringify(btn.getAttribute("aria-expanded"))}`);
    } finally {
      window.removeEventListener("error", onError);
      console.warn = realWarn;
      host.remove();
    }
  });

  check("disclosure: wonk.foldAll(root, true) opens nested details (2 levels) and row toggles and returns the count changed; false closes all", () => {
    const id = uid("wonk-row");
    const host = withFixture(`
      <details class="a"><summary>a</summary>
        <details class="b"><summary>b</summary>inner</details>
      </details>
      <details class="c" open><summary>c</summary>c</details>
      <table><tbody>
        <tr><td><button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="${id}">r</button></td></tr>
        <tr class="wonk-row-detail" id="${id}" hidden><td>d</td></tr>
      </tbody></table>`);
    try {
      assert(typeof wonk.foldAll === "function", "wonk.foldAll should be a function");
      const all = [...host.querySelectorAll("details")];
      const btn = host.querySelector(".wonk-row-toggle");
      const opened = wonk.foldAll(host, true);
      assert(all.every((d) => d.open), `every details should be open, got ${all.map((d) => d.open)}`);
      assert(rowOpen(btn), "the row toggle should be expanded with its detail row shown");
      assert(opened === 3, `foldAll(root, true) should return 3 (a, b, the row; c was already open), got ${opened}`);
      const closed = wonk.foldAll(host, false);
      assert(all.every((d) => !d.open), `every details should be closed, got ${all.map((d) => d.open)}`);
      assert(btn.getAttribute("aria-expanded") === "false" && document.getElementById(id).hidden, "the row toggle should be collapsed with its detail row hidden");
      assert(closed === 4, `foldAll(root, false) should return 4, got ${closed}`);
      assert(wonk.foldAll(host, false) === 0, "a second foldAll(root, false) should change nothing and return 0");
    } finally {
      host.remove();
    }
  });

  check("disclosure: a [data-wonk-fold-all=open][data-target] click opens everything in the target; a close button with no data-target folds its section", () => {
    const target = uid("wonk-scope");
    const id = uid("wonk-row");
    const host = withFixture(`
      <button type="button" class="opener" data-wonk-fold-all="open" data-target="#${target}">Unfold all</button>
      <section id="${target}">
        <button type="button" class="closer" data-wonk-fold-all="close">Fold all</button>
        <details><summary>one</summary><details><summary>deep</summary>x</details></details>
        <details><summary>two</summary>y</details>
        <table><tbody>
          <tr><td><button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="${id}">r</button></td></tr>
          <tr class="wonk-row-detail" id="${id}" hidden><td>d</td></tr>
        </tbody></table>
      </section>
      <details class="outside"><summary>outside</summary>z</details>`);
    try {
      const inside = [...host.querySelectorAll("section details")];
      const btn = host.querySelector(".wonk-row-toggle");
      host.querySelector(".opener").click();
      assert(inside.every((d) => d.open), `every details in the target should be open, got ${inside.map((d) => d.open)}`);
      assert(rowOpen(btn), "the row toggle in the target should be expanded");
      assert(!host.querySelector(".outside").open, "a details outside the target must stay closed");
      host.querySelector(".closer").click();
      assert(inside.every((d) => !d.open), `the close button should fold its own section, got ${inside.map((d) => d.open)}`);
      assert(btn.getAttribute("aria-expanded") === "false", "the close button should collapse the row toggle");
    } finally {
      host.remove();
    }
  });

  check("disclosure: data-fold-key remembers open state across re-renders; wonk.init(scope) restores it; wonk.foldState.clear() forgets", async () => {
    const key = uid("deal");
    const rowKey = uid("row");
    const host = withFixture("");
    const make = (html) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      return wrap;
    };
    const detailsHTML = `<details data-fold-key="${key}"><summary>deal</summary>body</details>`;
    const rowHTML = (id) => `<table><tbody>
        <tr><td><button type="button" class="wonk-row-toggle" data-fold-key="${rowKey}" aria-expanded="false" aria-controls="${id}">r</button></td></tr>
        <tr class="wonk-row-detail" id="${id}" hidden><td>d</td></tr>
      </tbody></table>`;
    const settle = async (done) => { for (let i = 0; i < 3 && !done(); i++) await frame(); };
    try {
      assert(wonk.foldState && typeof wonk.foldState.clear === "function", "wonk.foldState.clear should be a function");
      let render = make(detailsHTML + rowHTML(uid("wonk-row")));
      host.appendChild(render);
      const first = render.querySelector("details");
      first.querySelector("summary").click();
      await toggled(first);
      assert(first.open, "clicking the summary should open the keyed details");
      render.querySelector(".wonk-row-toggle").click();

      // re-render: remove, insert fresh closed copies with the same keys
      render.remove();
      render = make(detailsHTML + rowHTML(uid("wonk-row")));
      host.appendChild(render);
      const fresh = render.querySelector("details");
      const freshRow = render.querySelector(".wonk-row-toggle");
      await settle(() => fresh.open && rowOpen(freshRow));
      assert(fresh.open, "a fresh details with the same data-fold-key should be open within a frame");
      assert(rowOpen(freshRow), "a fresh row toggle with the same data-fold-key should be expanded within a frame");

      // wonk.init(scope) restores on a subtree the observer never saw
      const detached = make(detailsHTML);
      wonk.init(detached);
      assert(detached.querySelector("details").open, "wonk.init(scope) should restore a keyed details' remembered state");

      wonk.foldState.clear();
      render.remove();
      render = make(detailsHTML + rowHTML(uid("wonk-row")));
      host.appendChild(render);
      const cleared = render.querySelector("details");
      const clearedRow = render.querySelector(".wonk-row-toggle");
      await frame();
      await frame();
      await frame();
      assert(!cleared.open, "after wonk.foldState.clear() a fresh keyed details should stay closed");
      assert(!rowOpen(clearedRow), "after wonk.foldState.clear() a fresh keyed row toggle should stay collapsed");
    } finally {
      if (window.wonk && wonk.foldState && typeof wonk.foldState.clear === "function") wonk.foldState.clear();
      host.remove();
    }
  });

  check("disclosure: wonk:fold fires once per change with {el, key, open}: a row toggle click, foldAll, a keyed <details>; an unkeyed <details> and a no-op foldAll fire none", async () => {
    const id = uid("wonk-row");
    const rowKey = uid("row");
    const detailsKey = uid("deal");
    const host = withFixture(`
      <details class="keyed" data-fold-key="${detailsKey}"><summary>k</summary>x</details>
      <details class="plain"><summary>p</summary>y</details>
      <table><tbody>
        <tr><td><button type="button" class="wonk-row-toggle" data-fold-key="${rowKey}" aria-expanded="false" aria-controls="${id}">r</button></td></tr>
        <tr class="wonk-row-detail" id="${id}" hidden><td>d</td></tr>
      </tbody></table>`);
    const seen = [];
    const onFold = (e) => seen.push(e.detail);
    host.addEventListener("wonk:fold", onFold);
    try {
      const btn = host.querySelector(".wonk-row-toggle");
      const keyed = host.querySelector(".keyed");
      const plain = host.querySelector(".plain");
      btn.click();
      eq(seen.length, 1, "events after a row toggle click");
      assert(seen[0].el === btn && seen[0].key === rowKey && seen[0].open === true, `the click event should carry {el: the toggle, key, open: true}, got key ${seen[0].key}, open ${seen[0].open}`);
      const opening = Promise.all([toggled(keyed), toggled(plain)]);
      eq(wonk.foldAll(host, true), 2, "foldAll(host, true) count (the row is open already)");
      eq(seen.length, 1, "an already open row fires nothing, and a <details> fires only after its native toggle");
      await opening;
      eq(seen.length, 2, "events after foldAll(host, true): the keyed <details> only");
      assert(seen[1].el === keyed && seen[1].key === detailsKey && seen[1].open === true, "the keyed <details> event should carry its key and open: true");
      const closing = Promise.all([toggled(keyed), toggled(plain)]);
      wonk.foldAll(host, false);
      eq(seen.length, 3, "foldAll(host, false) fires the row's event at once");
      assert(seen[2].el === btn && seen[2].open === false, "the row event should say open: false");
      await closing;
      eq(seen.length, 4, "events after foldAll(host, false)");
      eq(wonk.foldAll(host, false), 0, "a second foldAll(host, false) count");
      await frame();
      await frame();
      eq(seen.length, 4, "a foldAll that changes nothing fires nothing");
    } finally {
      host.removeEventListener("wonk:fold", onFold);
      wonk.foldState.delete(rowKey);
      wonk.foldState.delete(detailsKey);
      host.remove();
    }
  });

  check("disclosure: foldAll(root, open, {nested: false}) changes only the outermost folds (a row, an outer <details>), never folds inside them; a non-boolean nested throws", () => {
    const id = uid("wonk-row");
    const host = withFixture(`
      <details class="outer"><summary>o</summary><details class="deep"><summary>d</summary>x</details></details>
      <table><tbody>
        <tr><td><button type="button" class="wonk-row-toggle" aria-expanded="false" aria-controls="${id}">area</button></td></tr>
        <tr class="wonk-row-detail" id="${id}" hidden><td><details class="card"><summary>deal</summary>y</details></td></tr>
      </tbody></table>`);
    try {
      const btn = host.querySelector(".wonk-row-toggle");
      const q = (sel) => host.querySelector(sel);
      eq(wonk.foldAll(host, true, { nested: false }), 2, "foldAll(host, true, {nested:false}) count");
      assert(rowOpen(btn) && q(".outer").open, "the row and the outer <details> should open");
      assert(!q(".deep").open && !q(".card").open, "a <details> inside the outer <details> or inside the row detail should stay closed");
      eq(wonk.foldAll(host, false, { nested: false }), 2, "foldAll(host, false, {nested:false}) count");
      let threw = null;
      try { wonk.foldAll(host, true, { nested: "no" }); } catch (err) { threw = err; }
      assert(threw instanceof TypeError, "a non-boolean nested should throw a TypeError");
    } finally {
      host.remove();
    }
  });

  // ---- formatting: wonk.fmt, and the delta classes ----
  // Every example row of the fmt table in references/components.md.
  // Unknown input (null, undefined, "", NaN) formats as "—", never as 0.
  const UNKNOWN = "—";
  const eq = (got, want, label) =>
    assert(got === want, `${label}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

  check("fmt: num, compact, money, and pct format the documented examples", () => {
    const f = wonk.fmt;
    assert(f && typeof f.num === "function", "wonk.fmt.num should be a function");
    eq(f.num(1234.5), "1,235", "num(1234.5)");
    eq(f.num(1234.5, { digits: 1 }), "1,234.5", "num(1234.5, {digits:1})");
    eq(f.num(0), "0", "num(0): zero is a measurement, not unknown");
    eq(f.compact(1234), "1.2K", "compact(1234)");
    eq(f.compact(2500000), "2.5M", "compact(2500000)");
    eq(f.compact(950), "950", "compact(950)");
    eq(f.money(1234.5), "$1,235", "money(1234.5)");
    eq(f.money(1234567, { compact: true }), "$1.2M", "money(1234567, {compact:true})");
    eq(f.money(971100, { compact: true }), "$971K", "money(971100, {compact:true})");
    eq(f.money(45600, { compact: true }), "$46K", "money(45600, {compact:true})");
    eq(f.money(1500, { compact: true }), "$1.5K", "money(1500, {compact:true})");
    eq(f.money(12345678, { compact: true }), "$12M", "money(12345678, {compact:true})");
    eq(f.money(800, { compact: true }), "$800", "money(800, {compact:true})");
    eq(f.money(971100, { compact: true, digits: 1 }), "$971.1K", "money(971100, {compact:true, digits:1})");
    eq(f.compact(971100), "971K", "compact(971100)");
    eq(f.compact(971100, { digits: 1 }), "971.1K", "compact(971100, {digits:1})");
    eq(f.money(0), "$0", "money(0)");
    eq(f.pct(0.123), "12%", "pct(0.123)");
    eq(f.pct(0.123, { digits: 1 }), "12.3%", "pct(0.123, {digits:1})");
  });

  check("fmt: duration reads 450 ms, 1.2 s, 3m 20s, 1h 30m", () => {
    const f = wonk.fmt;
    assert(f && typeof f.duration === "function", "wonk.fmt.duration should be a function");
    eq(f.duration(450), "450 ms", "duration(450)");
    eq(f.duration(1200), "1.2 s", "duration(1200)");
    eq(f.duration(200000), "3m 20s", "duration(200000)");
    eq(f.duration(5400000), "1h 30m", "duration(5400000)");
  });

  check("fmt: date is YYYY-MM-DD in UTC by default; {time:true} adds HH:MM UTC; a bad date is unknown", () => {
    const f = wonk.fmt;
    assert(f && typeof f.date === "function", "wonk.fmt.date should be a function");
    eq(f.date("2026-09-24T15:04:00Z"), "2026-09-24", "date(iso)");
    eq(f.date("2026-09-24T15:04:00Z", { time: true }), "2026-09-24 15:04 UTC", "date(iso, {time:true})");
    eq(f.date(new Date("2026-09-24T23:30:00Z")), "2026-09-24", "date(Date) in UTC");
    eq(f.date("not a date"), UNKNOWN, "date(\"not a date\")");
  });

  check("fmt: null, undefined, NaN, and \"\" format as — (unknown, not zero) in every helper", () => {
    const f = wonk.fmt;
    const helpers = ["num", "compact", "money", "pct", "duration", "date"];
    for (const name of helpers) {
      assert(typeof f[name] === "function", `wonk.fmt.${name} should be a function`);
      for (const value of [null, undefined, NaN, ""]) {
        eq(f[name](value), UNKNOWN, `${name}(${value === "" ? "\"\"" : String(value)})`);
      }
    }
    for (const value of [null, undefined, NaN, ""]) {
      const d = f.delta(value);
      eq(d.text, UNKNOWN, `delta(${value === "" ? "\"\"" : String(value)}).text`);
      eq(d.sentiment, "neutral", `delta(${String(value)}).sentiment`);
    }
  });

  check("fmt: the locale defaults to en-US; setting wonk.fmt.locale changes it", () => {
    const f = wonk.fmt;
    const original = f.locale;
    try {
      eq(original, "en-US", "default wonk.fmt.locale");
      f.locale = "de-DE";
      eq(f.num(1234.5), "1.235", "num(1234.5) with locale de-DE");
    } finally {
      f.locale = original;
    }
    eq(f.num(1234.5), "1,235", "num(1234.5) after restoring en-US");
  });

  check("fmt.delta: the arrow follows the sign, sentiment follows higherIsBetter, the class follows sentiment", () => {
    const f = wonk.fmt;
    assert(typeof f.delta === "function", "wonk.fmt.delta should be a function");
    const same = (got, want, label) => eq(JSON.stringify(got), JSON.stringify(want), label);
    same(f.delta(0.12), { text: "▲ 12%", direction: "up", sentiment: "good", className: "delta--good" }, "delta(0.12)");
    same(f.delta(0.12, { higherIsBetter: false }), { text: "▲ 12%", direction: "up", sentiment: "bad", className: "delta--bad" }, "delta(0.12, {higherIsBetter:false})");
    same(f.delta(-0.05), { text: "▼ 5%", direction: "down", sentiment: "bad", className: "delta--bad" }, "delta(-0.05)");
    same(f.delta(-0.05, { higherIsBetter: false }), { text: "▼ 5%", direction: "down", sentiment: "good", className: "delta--good" }, "delta(-0.05, {higherIsBetter:false})");
    same(f.delta(0), { text: "— 0%", direction: "flat", sentiment: "neutral", className: "delta--neutral" }, "delta(0)");
    eq(f.delta(1500, { format: "num" }).text, "▲ 1,500", "delta(1500, {format:\"num\"}).text");
    eq(f.delta(-1234.5, { format: "money" }).text, "▼ $1,235", "delta(-1234.5, {format:\"money\"}).text");
    eq(f.delta(3, { format: (n) => `${n} pts` }).text, "▲ 3 pts", "delta(3, {format: fn}).text");
  });

  check("delta CSS: .delta--good/--bad/--neutral color any element (ok/err/ink-2); legacy .delta-up/.delta-down still work in .wonk-stat", () => {
    const host = withFixture(`
      <small class="delta--good">a</small>
      <span class="delta--bad">b</span>
      <p class="delta--neutral">c</p>
      <div class="wonk-stat"><small class="delta-up">d</small><small class="delta-down">e</small></div>
      <span class="p-ok" style="color:var(--ak-ok)">p</span>
      <span class="p-err" style="color:var(--ak-err)">p</span>
      <span class="p-ink2" style="color:var(--ak-ink-2)">p</span>`);
    try {
      const color = (sel) => getComputedStyle(host.querySelector(sel)).color;
      eq(color("small.delta--good"), color(".p-ok"), "small.delta--good color (must beat .wonk small)");
      eq(color("span.delta--bad"), color(".p-err"), "span.delta--bad color");
      eq(color("p.delta--neutral"), color(".p-ink2"), "p.delta--neutral color (must beat .wonk p)");
      eq(color(".delta-up"), color(".p-ok"), "legacy .wonk-stat .delta-up color");
      eq(color(".delta-down"), color(".p-err"), "legacy .wonk-stat .delta-down color");
    } finally {
      host.remove();
    }
  });

  check("load: wonk.js loads in a window with no CSS object (jsdom, vitest) and still exposes wonk.version", async () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute; width:0; height:0; border:0; visibility:hidden;";
    document.body.appendChild(iframe);
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      doc.open();
      doc.write("<!doctype html><html><head></head><body></body></html>");
      doc.close();
      win.CSS = undefined;
      assert(win.CSS === undefined, "setup: the iframe's CSS should be undefined");
      const errors = [];
      win.addEventListener("error", (e) => errors.push(e.message));
      await new Promise((resolve, reject) => {
        const script = doc.createElement("script");
        script.src = new URL("../assets/wonk.js", document.baseURI).href;
        script.onload = resolve;
        script.onerror = () => reject(new Error("could not load wonk.js into the iframe"));
        doc.body.appendChild(script);
      });
      assert(errors.length === 0, `loading wonk.js with no CSS object threw: ${errors.join("; ")}`);
      assert(win.wonk && win.wonk.version === wonk.version, `the iframe's wonk.version should be ${wonk.version}, got ${win.wonk && win.wonk.version}`);
    } finally {
      iframe.remove();
    }
  });

  check("version: wonk.version equals the --wonk-version token in wonk-tokens.css", () => {
    const token = getComputedStyle(document.documentElement).getPropertyValue("--wonk-version").trim().replace(/^["']|["']$/g, "");
    assert(/^\d+\.\d+\.\d+$/.test(String(wonk.version)), `wonk.version is ${JSON.stringify(wonk.version)}, expected x.y.z`);
    assert(token === wonk.version, `--wonk-version is ${JSON.stringify(token)}, wonk.version is ${JSON.stringify(wonk.version)}`);
  });

  // ============================================================
  // runner
  // ============================================================
  async function run() {
    const results = [];
    for (const { name, fn } of checks) {
      try {
        await fn();
        results.push({ name, pass: true, message: "ok" });
        console.log("PASS " + name);
      } catch (err) {
        results.push({ name, pass: false, message: (err && err.message) || String(err) });
        console.error("FAIL " + name + ": " + ((err && err.message) || err));
      }
    }
    try { console.table(results); } catch { /* console.table not available in some hosts */ }
    const failed = results.filter((r) => !r.pass);
    console.log(`wonkBaseChecks: ${results.length - failed.length}/${results.length} passed`);
    return { passed: results.length - failed.length, failed: failed.length, results };
  }

  window.wonkBaseChecks = { run, checks };
})();
