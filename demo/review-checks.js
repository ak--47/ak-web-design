(() => {
  "use strict";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const same = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const edit = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const selectRound = (round) => {
    history.replaceState(null, "", `#${round}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  window.wonkStudyChecks = {
    async run() {
      const results = [];
      async function check(name, run) {
        try { await run(); results.push({ name, pass: true, message: "ok" }); }
        catch (error) { results.push({ name, pass: false, message: error.message }); }
      }
      if (document.querySelector(".review")) {
        await check("reading: identical prose, collapsed B, expand/collapse controls", () => {
          selectRound("reading");
          const text = (variant) => [...document.querySelectorAll(`#reading-${variant} .prose`)].map((element) => element.textContent);
          same(text("a"), text("b"), "prose parity");
          const folded = document.querySelectorAll("#reading-b details.reading-section");
          assert([...folded].every((element) => !element.open), "B starts collapsed");
          document.querySelector("#reading-b .brief-tools button").click();
          assert([...folded].every((element) => element.open), "Expand all opens every section");
          document.querySelector("#reading-b .brief-tools button:last-child").click();
          assert([...folded].every((element) => !element.open), "Collapse all closes every section");
        });
        await check("reading: failed count opens exactly three failed batches inline", () => {
          for (const variant of ["a", "b"]) {
            const scope = document.getElementById(`reading-${variant}`);
            scope.querySelector(".answer-line button").click();
            const fold = scope.querySelector(".evidence");
            same(fold.querySelectorAll("tbody tr").length, 3, "failed rows");
            assert(fold.open, "evidence opens");
            assert([...fold.querySelectorAll("tbody tr")].every((row) => row.textContent.includes("Failed")), "every row failed");
            scope.querySelector(".answer-line button:last-child").click();
            same(fold.querySelectorAll("tbody tr").length, 12, "full record total opens all batches");
            assert(fold.querySelector("tfoot").textContent.includes("186,400"), "drill total matches headline");
          }
        });
        await check("folds: Escape closes inline evidence and returns focus to its summary", () => {
          for (const variant of ["a", "b"]) {
            const fold = document.querySelector(`#reading-${variant} .evidence`);
            const sort = fold.querySelector(".wonk-sort");
            sort.focus();
            sort.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
            assert(!fold.open, "Escape closes the fold");
            assert(document.activeElement === fold.querySelector("summary"), "focus returns to summary");
            assert(!fold.querySelector("[data-wonk-motion-state]"), "no lingering fold motion");
          }
        });
        await check("forms: blank, malformed email, and hidden advanced errors block save", () => {
          selectRound("forms");
          for (const variant of ["a", "b"]) {
            const scope = document.getElementById(`forms-${variant}`);
            const form = scope.querySelector("form");
            const name = form.elements.namedItem("name");
            edit(name, "   ");
            form.requestSubmit();
            same(name.getAttribute("aria-invalid"), "true", "blank name invalid");
            assert(scope.querySelector("output").textContent.includes("Nothing was saved"), "invalid save status");
            edit(name, "Nightly imports");
            const email = form.elements.namedItem("email");
            edit(email, "bad");
            if (variant === "b") scope.querySelector(".settings-advanced").open = false;
            form.requestSubmit();
            same(email.getAttribute("aria-invalid"), "true", "malformed email invalid");
            if (variant === "b") assert(scope.querySelector(".settings-advanced").open, "hidden error revealed");
            same(document.activeElement.id, email.id, "first invalid field focused");
            scope.querySelector('[type="button"]').click();
          }
        });
        await check("forms: explicit save updates session copy; discard restores it", () => {
          for (const variant of ["a", "b"]) {
            const scope = document.getElementById(`forms-${variant}`);
            const form = scope.querySelector("form");
            const name = form.elements.namedItem("name");
            edit(name, "Saved fixture");
            assert(!scope.querySelector(".saved-settings").textContent.includes("Saved fixture"), "draft does not save");
            form.requestSubmit();
            same(scope.querySelector("output").textContent, "Saved in this tab", "save status");
            assert(scope.querySelector(".saved-settings").textContent.includes("Saved fixture"), "saved data updated");
            edit(name, "Discard this");
            scope.querySelector('[type="button"]').click();
            same(name.value, "Saved fixture", "discard restores latest save");
            assert(scope.querySelector('[type="submit"]').disabled, "clean form cannot save again");
          }
        });
        await check("forms: out-of-range retention keeps saved copy intact", () => {
          for (const variant of ["a", "b"]) {
            const scope = document.getElementById(`forms-${variant}`);
            const form = scope.querySelector("form");
            const before = scope.querySelector(".saved-settings").textContent;
            const retention = form.elements.namedItem("retention");
            edit(retention, "91");
            form.requestSubmit();
            same(retention.value, "91", "invalid draft retained");
            same(scope.querySelector(".saved-settings").textContent, before, "saved copy unchanged");
            scope.querySelector('[type="button"]').click();
          }
        });
        await check("forms: focused validation errors stay still and native select Escape is preserved", async () => {
          const scope = document.getElementById("forms-b");
          const form = scope.querySelector("form");
          const advanced = scope.querySelector(".settings-advanced");
          const email = form.elements.namedItem("email");
          advanced.open = false;
          edit(email, "invalid");
          form.requestSubmit();
          await tick();
          assert(document.activeElement === email, "invalid email gets focus");
          same(advanced.querySelector(".body").getAnimations().length, 0, "focused error is not animated");
          const retry = form.elements.namedItem("retries");
          retry.focus();
          const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
          retry.dispatchEvent(event);
          assert(!event.defaultPrevented && advanced.open, "select Escape is left to the browser");
          scope.querySelector('[type="button"]').click();
        });
        await check("motion: hiding a round cancels its effects without discarding drafts", () => {
          const scope = document.getElementById("forms-a");
          const form = scope.querySelector("form");
          const name = form.elements.namedItem("name");
          edit(name, "Motion checkpoint");
          form.requestSubmit();
          assert(scope.querySelector("output").getAnimations().length > 0, "save feedback starts");
          edit(name, "Keep this draft");
          selectRound("reading");
          same(scope.querySelector("output").getAnimations().length, 0, "hidden feedback cancelled");
          selectRound("forms");
          same(name.value, "Keep this draft", "navigation retains draft");
          scope.querySelector('[type="button"]').click();
        });
        await check("workspace: search and state filter select exact fixture rows", () => {
          selectRound("workspace");
          for (const variant of ["a", "b"]) {
            const scope = document.getElementById(`workspace-${variant}`);
            edit(scope.querySelector('input[type="search"]'), "Mobile");
            same(scope.querySelectorAll(".batch-choice").length, 4, "mobile rows");
            edit(scope.querySelector("select"), "Failed");
            same(scope.querySelectorAll(".batch-choice").length, 3, "failed rows");
            const first = scope.querySelector(".batch-choice");
            first.focus();
            first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            assert(scope.querySelector(".record-inspector h4").textContent.includes("11:00"), "keyboard selection updates inspector");
            same(scope.querySelectorAll('[aria-pressed="true"]').length, 1, "one selected record");
          }
        });
        await check("workspace: empty result clears old details; recovery restores records", () => {
          for (const variant of ["a", "b"]) {
            const scope = document.getElementById(`workspace-${variant}`);
            const search = scope.querySelector('input[type="search"]');
            edit(search, "no-match");
            assert(!scope.querySelector(".workspace-empty").hidden, "empty state shown");
            same(scope.querySelector(".record-inspector").textContent, "", "no stale inspector");
            scope.querySelector(".workspace-empty button").click();
            same(scope.querySelectorAll(".batch-choice").length, 12, "recovery rows");
            assert(document.activeElement === search, "focus returns to search");
          }
        });
        await check("workspace: selection is announced, same selection preserves details, hidden motion stops", () => {
          const scope = document.getElementById("workspace-b");
          const button = scope.querySelector('.batch-choice[data-id="batch-11-3"]');
          button.click();
          const inspector = scope.querySelector(".record-inspector");
          same(button.getAttribute("aria-controls"), inspector.id, "selection controls inspector");
          assert(scope.querySelector("[data-selection-status]").textContent.includes("Mobile, 11:00 UTC, failed"), "selection announced");
          const snapshot = inspector.querySelector("details");
          snapshot.open = true;
          button.click();
          assert(inspector.querySelector("details") === snapshot && snapshot.open, "same selection keeps open snapshot");
          const view = document.querySelector('input[name="review-view"][value="a"]');
          view.checked = true;
          view.dispatchEvent(new Event("change", { bubbles: true }));
          assert(!scope.querySelector("[data-wonk-motion-state]"), "hidden inspector motion cancelled");
          const both = document.querySelector('input[name="review-view"][value="both"]');
          both.checked = true;
          both.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await check("routing: unknown hash falls back, view mode hides correct candidate", () => {
          selectRound("unknown");
          assert(!document.getElementById("reading").hidden, "unknown hash falls back to reading");
          const view = document.querySelector('input[name="review-view"][value="a"]');
          view.checked = true;
          view.dispatchEvent(new Event("change", { bubbles: true }));
          same(getComputedStyle(document.querySelector('#reading [data-variant="b"]')).display, "none", "B hidden");
          const both = document.querySelector('input[name="review-view"][value="both"]');
          both.checked = true;
          both.dispatchEvent(new Event("change", { bubbles: true }));
        });
      } else {
        await check("baseline: grouped draft, explicit Apply, invalid and zero thresholds", () => {
          const scope = document.querySelector('[data-variant="a"]');
          const exact = scope.querySelector(".threshold-exact");
          const form = scope.querySelector(".threshold-form");
          edit(exact, "25000");
          same(exact.value, "25,000", "formatted entry");
          assert(scope.querySelector(".threshold-result").textContent.startsWith("5 batches"), "draft has no effect");
          form.requestSubmit();
          assert(scope.querySelector(".threshold-result").textContent.startsWith("11 batches"), "applied threshold");
          edit(exact, "25,00");
          same(exact.getAttribute("aria-invalid"), "true", "bad grouping invalid");
          form.requestSubmit();
          assert(scope.querySelector(".threshold-result").textContent.startsWith("11 batches"), "invalid draft changes nothing");
          edit(exact, "0");
          form.requestSubmit();
          assert(scope.querySelector(".threshold-result").textContent.startsWith("0 batches"), "zero is valid");
          edit(exact, "20000");
          form.requestSubmit();
        });
        await check("baseline: all count drills stay inline and span the metrics", async () => {
          const scope = document.querySelector('[data-variant="a"]');
          scope.querySelector('[data-metric="written"]').click();
          await tick();
          const records = scope.querySelector(".metrics > .study-records");
          same(records.querySelectorAll("tbody tr:not(.wonk-row-detail)").length, 12, "count matches source rows");
          assert(records.querySelector("tfoot").textContent.includes("186,400"), "full total grouped");
          same(getComputedStyle(records).gridColumn, "1 / -1", "records span grid");
          same(document.querySelectorAll("dialog").length, 0, "no modal record inspectors");
        });
        await check("baseline: 561 symbols exhaust twice without repetition; pause keeps place", () => {
          const trigger = document.querySelector('[data-variant="a"] .glyph-trigger');
          const text = () => trigger.querySelector(".glyph-symbol").textContent;
          const first = [text()];
          for (let index = 1; index < 561; index++) { trigger.click(); first.push(text()); }
          const second = [];
          for (let index = 0; index < 561; index++) { trigger.click(); second.push(text()); }
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
          same(new Set(first).size, 561, "first cycle unique");
          same(new Set(second).size, 561, "second cycle unique");
          assert(first.at(-1) !== second[0], "no boundary repeat");
          same(text(), second.at(-1), "Escape retains last glyph");
          assert(!trigger.classList.contains("glyph-playing"), "Escape stops loop");
        });
        await check("baseline: 800ms held highlight and 250ms inline slide are retained", () => {
          const scope = document.querySelector('[data-variant="a"]');
          edit(scope.querySelector(".threshold-exact"), "24000");
          scope.querySelector("form").requestSubmit();
          const result = scope.querySelector(".threshold-result");
          const animation = result.getAnimations()[0];
          same(animation.effect.getTiming().duration, 800, "highlight duration");
          same(animation.effect.getKeyframes().map((frame) => frame.offset), [0, 0.1, 0.3, 1], "rise hold fade offsets");
          animation.cancel();
          const row = scope.querySelector(".failure-link");
          row.click();
          const detail = document.getElementById(row.getAttribute("aria-controls"));
          same(getComputedStyle(detail).animationDuration, "0.25s", "slide duration");
          row.click();
          assert(detail.hidden, "close remains immediate");
        });
      }
      await check("accessibility: IDs are unique and visible controls have names", () => {
        const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
        same(new Set(ids).size, ids.length, "unique IDs");
        for (const button of document.querySelectorAll("button")) {
          assert(button.textContent.trim() || button.getAttribute("aria-label"), "every button has a name");
        }
      });
      const passed = results.filter((result) => result.pass).length;
      return { passed, failed: results.length - passed, results };
    },
  };
})();