(() => {
  "use strict";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const same = (actual, expected, label) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.wonkRefinedChecks = {
    async run() {
      const results = [];
      const root = document.documentElement;
      const pair = root.dataset.pair;
      const theme = root.dataset.theme;
      const check = async (name, run) => {
        try { await run(); results.push({ name, pass: true, message: "ok" }); }
        catch (error) { results.push({ name, pass: false, message: error.message }); }
      };
      await check("palette: 200 deterministic seeds meet 4.5:1 on every surface and button", () => {
        const luminance = (hex) => hex.match(/[\da-f]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const contrast = (first, second) => (Math.max(luminance(first), luminance(second)) + 0.05) / (Math.min(luminance(first), luminance(second)) + 0.05);
        for (let index = 0; index < 200; index++) {
          const seed = (index * 2654435761) >>> 0;
          const palette = wonk.palette.generate(seed);
          same(palette, wonk.palette.generate(seed), "same seed");
          for (const mode of ["dark", "paper"]) {
            const tokens = palette[mode];
            const grounds = mode === "dark" ? ["#0f1214", "#16191c", "#1c2024"] : ["#ece4d4", "#f2ecdf", "#f7f3e9"];
            for (const token of ["--ak-a1-text", "--ak-a2-text", "--ak-ok", "--ak-warn", "--ak-err", "--ak-info"]) {
              for (const ground of grounds) assert(contrast(tokens[token], ground) >= 4.5, `${seed}/${mode}/${token} contrast`);
            }
            assert(contrast(tokens["--ak-a1"], tokens["--ak-a1-ink"]) >= 4.5, "button ink contrast");
            assert(new Set([1, 2, 3, 4, 5, 6].map((slot) => tokens[`--ak-chart-${slot}`])).size === 6, "six distinct chart slots");
          }
        }
      });
      await check("palette: invalid seeds and corrupt storage never apply arbitrary styles", () => {
        for (const seed of [-1, NaN, Infinity, "4", 4294967296, 1.2]) {
          let threw = false;
          try { wonk.palette.generate(seed); } catch { threw = true; }
          assert(threw, "invalid seed rejected");
        }
        localStorage.setItem("refined-corrupt", JSON.stringify({ version: 1, pair: "dice", seed: "var(--malicious)" }));
        const before = root.dataset.pair;
        wonk.palette.init({ key: "refined-corrupt" });
        same(root.dataset.pair, before, "invalid saved value ignored");
        localStorage.removeItem("refined-corrupt");
      });
      await check("palette: rolls persist seeds, theme changes recolor, presets remove overrides", () => {
        wonk.palette.init({ key: "refined-palette" });
        wonk.setTheme("dark");
        const generated = wonk.palette.roll({ seed: 12345678 });
        same(JSON.parse(localStorage.getItem("refined-palette")).seed, 12345678, "stored seed");
        same(getComputedStyle(root).getPropertyValue("--ak-a1").trim(), generated.dark["--ak-a1"], "dark accent");
        wonk.setTheme("paper");
        same(getComputedStyle(root).getPropertyValue("--ak-a1").trim(), generated.paper["--ak-a1"], "paper accent");
        wonk.setPair("ancient");
        same(root.style.getPropertyValue("--ak-a1"), "", "generated override removed");
        same(JSON.parse(localStorage.getItem("refined-palette")).pair, "ancient", "preset persisted");
      });
      await check("palette: external data-theme changes repaint generated tokens", async () => {
        wonk.setTheme("dark");
        const palette = wonk.palette.roll({ seed: 87654321 });
        root.dataset.theme = "light";
        await frame();
        same(root.style.getPropertyValue("--ak-a1"), palette.paper["--ak-a1"], "external light accent");
        same(root.style.getPropertyValue("--ak-chart-1"), palette.paper["--ak-chart-1"], "external light chart");
        root.dataset.theme = "dark";
        await frame();
        same(root.style.getPropertyValue("--ak-a1"), palette.dark["--ak-a1"], "external dark accent");
      });
      await check("palette: blocked local storage falls back to session; blocked both stays usable", () => {
        const original = Storage.prototype.setItem;
        try {
          wonk.palette.init({ key: "refined-fallback" });
          Storage.prototype.setItem = function (key, value) {
            if (this === localStorage) throw new DOMException("blocked", "SecurityError");
            return original.call(this, key, value);
          };
          same(wonk.palette.roll({ seed: 12 }).storage, "sessionStorage", "session fallback");
          same(JSON.parse(sessionStorage.getItem("refined-fallback")).seed, 12, "session copy");
          Storage.prototype.setItem = () => { throw new DOMException("blocked", "SecurityError"); };
          same(wonk.palette.roll({ seed: 13 }).storage, "memory", "memory fallback");
          same(root.dataset.pair, "dice", "palette still applied");
        } finally { Storage.prototype.setItem = original; sessionStorage.removeItem("refined-fallback"); }
      });
      await check("palette: repeated dice rolls repaint a live chart and picker mounts once", async () => {
        wonk.palette.roll({ seed: 88 });
        await frame();
        const first = document.querySelector("#refined-chart > [role=img]");
        wonk.palette.roll({ seed: 99 });
        await frame();
        assert(first !== document.querySelector("#refined-chart > [role=img]"), "reroll repaints chart");
        const host = document.createElement("div");
        document.body.append(host);
        const picker = wonk.palette.mount(host);
        same(wonk.palette.mount(host), picker, "mount idempotent");
        same(host.querySelectorAll("button").length, 1, "one dice button");
        picker.destroy();
        same(host.children.length, 0, "picker destroy clears children");
        host.remove();
      });
      await check("grouped fader: commas, raw draft value, invalid drafts, keyboard, destroy", () => {
        const host = document.createElement("fieldset");
        host.className = "wonk-fader";
        Object.assign(host.dataset, { grouped: "", min: "0", max: "30000", step: "1000", value: "20000" });
        host.innerHTML = '<legend>Records</legend><input type="range" class="wonk-range"><input type="number" class="wonk-fader-exact">';
        document.body.append(host);
        const fader = wonkControls.fader(host);
        const exact = host.querySelector(".wonk-fader-exact");
        same(exact.value, "20,000", "initial grouping");
        exact.value = "25000";
        exact.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
        same(exact.value, "25,000", "pasted integer grouped");
        same(fader.draftValue, 25000, "numeric draft");
        exact.dispatchEvent(new Event("change", { bubbles: true }));
        same(fader.value, 25000, "draft committed");
        exact.value = "25,00";
        exact.dispatchEvent(new Event("input", { bubbles: true }));
        assert(!fader.valid, "malformed grouping rejected");
        same(exact.value, "25,00", "invalid text retained");
        fader.set(20000);
        exact.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
        same(exact.value, "21,000", "keyboard grouping");
        fader.destroy();
        same(exact.type, "number", "input type restored");
        host.remove();
      });
      await check("number input: decimal grouping preserves fractions, negative values and invalid bounds", () => {
        const input = document.createElement("input");
        input.value = "-1234.50";
        document.body.append(input);
        const api = wonkControls.numberInput(input, { min: -5000, max: 5000, step: 0.25 });
        same(input.value, "-1,234.50", "fraction preserved");
        same(api.value, -1234.5, "numeric decimal");
        input.value = "5001";
        input.dispatchEvent(new Event("input"));
        assert(!api.valid, "bounds enforced");
        api.destroy(); input.remove();
      });
      await check("number input: large integer increments and tiny decimals retain precision", () => {
        const input = document.createElement("input");
        document.body.append(input);
        const api = wonkControls.numberInput(input);
        try {
          api.set(100000000000000);
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
          same(api.value, 100000000000001, "large exact increment");
          for (const value of [1e-13, -1e-13, Number.MIN_VALUE, 0.12345678901234567]) {
            api.set(value);
            same(api.value, value, "numeric round trip");
          }
        } finally { api.destroy(); input.remove(); }
        const decimal = document.createElement("input");
        decimal.value = "0.1";
        document.body.append(decimal);
        const fraction = wonkControls.numberInput(decimal, { min: -1, max: 1, step: 0.2 });
        decimal.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
        same(fraction.value, 0.3, "decimal step does not accumulate binary tail");
        fraction.destroy(); decimal.remove();
      });
      await check("number input: separator deletion progresses and native reset revalidates", async () => {
        const form = document.createElement("form");
        const input = document.createElement("input");
        input.defaultValue = "1234";
        form.append(input); document.body.append(form);
        const api = wonkControls.numberInput(input, { min: 0, max: 5000 });
        try {
          input.focus(); input.setSelectionRange(1, 1);
          input.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentForward", bubbles: true }));
          same([input.selectionStart, input.selectionEnd], [1, 3], "separator and adjacent digit selected");
          input.setRangeText("", input.selectionStart, input.selectionEnd, "start");
          input.dispatchEvent(new InputEvent("input", { inputType: "deleteContentForward", bubbles: true }));
          same(input.value, "134", "forward delete progresses");
          input.value = "bad"; input.dispatchEvent(new Event("input"));
          assert(!form.checkValidity(), "invalid before reset");
          form.reset(); await Promise.resolve();
          assert(form.checkValidity(), "reset clears invalid state");
          same(input.value, "1,234", "reset groups default value");
          input.value = "bad"; input.dispatchEvent(new Event("input"));
          const prevent = (event) => event.preventDefault();
          form.addEventListener("reset", prevent);
          form.reset(); await Promise.resolve();
          same(input.value, "bad", "cancelled reset keeps draft");
          assert(!form.checkValidity(), "cancelled reset keeps validity");
          form.removeEventListener("reset", prevent);
        } finally { api.destroy(); form.remove(); }
      });
      await check("number input: readonly and disabled keys do nothing; destroy restores authored attributes", () => {
        const host = document.createElement("fieldset");
        const input = document.createElement("input");
        input.value = "2500";
        input.inputMode = "numeric";
        input.setAttribute("aria-valuetext", "Original description");
        host.append(input);
        document.body.append(host);
        const api = wonkControls.numberInput(input, { min: 0, max: 5000, step: 100 });
        input.readOnly = true;
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
        same(api.value, 2500, "readonly retains value");
        input.readOnly = false;
        host.disabled = true;
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
        same(api.value, 2500, "disabled fieldset retains value");
        api.destroy();
        same(input.inputMode, "numeric", "input mode restored");
        same(input.getAttribute("aria-valuetext"), "Original description", "authored description restored");
        same(input.getAttribute("role"), null, "added role removed");
        host.remove();
      });
      await check("inline drills: one per host, matching records, Escape focus and invalid options", () => {
        const host = document.createElement("section");
        const opener = document.createElement("button");
        opener.textContent = "Records";
        host.append(opener);
        document.body.append(host);
        const opts = { title: "Records", rows: [{ id: "one", count: 25000 }], columns: [{ key: "count", type: "num" }], opener };
        const first = wonkData.inline(host, opts);
        assert(first.element.open, "inline opens");
        assert(first.element.textContent.includes("25,000"), "grouped records");
        let threw = false;
        try { wonkData.inline(host, { ...opts, rows: null }); } catch { threw = true; }
        assert(threw && first.element.isConnected, "invalid call preserves existing drill");
        const second = wonkData.inline(host, opts);
        assert(!first.element.isConnected, "replacement destroys old drill");
        second.element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        assert(!second.element.open && document.activeElement === opener, "Escape closes and restores focus");
        second.destroy(); host.remove();
      });
      await check("inline drills: failed replacement preserves note and close finds usable focus", () => {
        const host = document.createElement("section");
        const opener = document.createElement("button");
        opener.textContent = "Inspect";
        const note = document.createElement("p");
        note.textContent = "Original context";
        document.body.append(opener, host);
        const opts = { title: "Rows", subtitle: "October snapshot", columns: [{ key: "value" }], rows: [{ value: 1 }], opener, note };
        const drill = wonkData.inline(host, opts);
        try {
          let rejected = false;
          try { wonkData.inline(host, { ...opts, columns: [] }); } catch { rejected = true; }
          assert(rejected && drill.element.contains(note), "invalid replacement preserves caller note");
          assert(drill.element.textContent.includes("October snapshot"), "inline subtitle retained");
          opener.disabled = true;
          drill.element.querySelector(".wonk-sort").focus();
          drill.close();
          assert(document.activeElement === drill.element.querySelector("summary"), "disabled opener falls back to summary");
          opener.disabled = false; opener.hidden = true;
          drill.open(); drill.close();
          assert(document.activeElement === drill.element.querySelector("summary"), "hidden opener falls back to summary");
        } finally { drill.destroy(); host.remove(); opener.remove(); }
      });
      await check("motion: inherited effect names reject without cancelling the active effect", async () => {
        const element = document.createElement("span");
        document.body.append(element);
        const pending = wonkMotion.play(element, "value-changed");
        try {
          for (const name of ["constructor", "toString", "__proto__"]) {
            let rejected = false;
            try { await wonkMotion.play(element, name); } catch { rejected = true; }
            assert(rejected, "inherited effect rejected");
            same(element.dataset.wonkMotionState, "running", "current effect remains");
          }
        } finally { wonkMotion.cancel(element); await pending; element.remove(); }
      });
      await check("workbench: filtered-out records remove the previous inline inspector", async () => {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:absolute;left:-10000px;width:900px;height:700px";
        iframe.src = "workbench.html";
        try {
          const loaded = new Promise((resolve, reject) => { iframe.onload = resolve; iframe.onerror = reject; });
          document.body.append(iframe); await loaded;
          const doc = iframe.contentDocument;
          doc.querySelector("#results .wonk-value-link").click();
          assert(doc.querySelector("#inspector details[open]"), "inspector opened");
          doc.getElementById("search").value = "missing-record";
          doc.getElementById("query-form").requestSubmit();
          assert(!doc.querySelector("#inspector details"), "stale inspector removed");
          assert(!doc.getElementById("no-results").hidden, "empty results visible");
        } finally { iframe.remove(); }
      });
      await check("glyph: 561 unique symbols, nonrepeating cycles, idempotent API and cleanup", () => {
        const button = document.createElement("button");
        const span = document.createElement("span");
        span.dataset.glyphIdle = "0";
        button.append(span); document.body.append(button);
        const api = wonk.glyph(span);
        same(wonk.glyph(span), api, "glyph idempotent");
        const first = [span.textContent];
        for (let index = 1; index < wonk.glyphs.length; index++) first.push(api.next());
        const second = Array.from({ length: wonk.glyphs.length }, () => api.next());
        same(new Set(first).size, 561, "first unique cycle");
        same(new Set(second).size, 561, "second unique cycle");
        assert(first.at(-1) !== second[0], "boundary differs");
        api.destroy(); button.remove();
      });
      wonk.setPair(pair === "dice" ? "metathesis" : pair || "metathesis");
      wonk.setTheme(theme || "dark");
      for (const key of ["refined-palette", "refined-fallback", "refined-corrupt"]) { localStorage.removeItem(key); sessionStorage.removeItem(key); }
      const passed = results.filter((result) => result.pass).length;
      return { passed, failed: results.length - passed, results };
    },
  };
})();