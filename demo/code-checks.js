/* ============================================================
   demo/code-checks.js · browser-callable checks for wonk-code
   Not loaded automatically. Load it on any page that already has
   wonk-code.js AND the vendored Prism core + grammars loaded (see
   references/code.md for the exact script order), then call:

     await wonkCodeChecks.run();

   Every check builds its own hidden fixture DOM and tears it down
   after itself. No dependency on any specific host page's markup,
   no network calls. Returns { passed, failed, results } and also
   prints a console.table().

   Covers: every supported grammar; hostile-markup and JSON-data
   safety; dynamic rehighlight; init/destroy lifecycle idempotency;
   the highlight() size bound; a missing Prism vendor and an
   unsupported language; malformed editor markup throwing a
   descriptive error (not a silent null); aria-invalid on invalid
   JSON and its clearing on input; an auto-created role=alert error
   node; stale-preview labeling after an edit or a failed reformat;
   the format() button's forced type=button; native and ancestor-
   fieldset disabled states blocking formatting; the format() size
   guard firing before JSON.parse; render()'s duplicate-content and
   non-serializable-value handling; and documented large-integer
   round-trip precision.
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

  // Loads a second, isolated copy of wonk-code.js into a throwaway
  // iframe. `withPrism` controls whether the iframe also gets the
  // vendored Prism scripts, so vendor-missing behavior can be tested
  // without touching the host page's already-initialized Prism/wonkCode.
  function loadIsolatedInstance(withPrism) {
    const scriptURL = new URL("../assets/wonk-code.js", document.baseURI).href;
    const prismURLs = [
      "../assets/vendor/prism/prism-core.min.js",
      "../assets/vendor/prism/prism-markup.min.js",
      "../assets/vendor/prism/prism-css.min.js",
      "../assets/vendor/prism/prism-clike.min.js",
      "../assets/vendor/prism/prism-javascript.min.js",
      "../assets/vendor/prism/prism-json.min.js",
      "../assets/vendor/prism/prism-sql.min.js",
      "../assets/vendor/prism/prism-bash.min.js",
    ].map((p) => new URL(p, document.baseURI).href);

    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute; width:0; height:0; border:0; visibility:hidden;";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      doc.open();
      doc.write("<!doctype html><html><head></head><body></body></html>");
      doc.close();

      const urls = withPrism ? [...prismURLs, scriptURL] : [scriptURL];
      let i = 0;
      function loadNext() {
        if (i >= urls.length) {
          resolve({ win, doc, cleanup() { iframe.remove(); } });
          return;
        }
        const script = doc.createElement("script");
        script.src = urls[i++];
        script.onload = loadNext;
        script.onerror = () => reject(new Error("could not load " + script.src));
        doc.body.appendChild(script);
      }
      loadNext();
    });
  }

  // ============================================================
  // supported grammars: every advertised language highlights
  // ============================================================
  const SOURCE_BY_GRAMMAR = {
    markup: "<div class=\"x\">hi</div>",
    css: ".a { color: red; }",
    clike: "if (x) { y(); }",
    javascript: "const x = 1;",
    json: "{\"a\": 1}",
    sql: "SELECT * FROM t;",
    bash: "echo hello",
  };
  wonkCode.SUPPORTED_LANGUAGES.forEach((lang) => {
    check(`highlight() supports declared language "${lang}"`, () => {
      const host = withFixture("<pre class=\"wonk-pre\"><code></code></pre>");
      try {
        const code = host.querySelector("code");
        const grammarKey = SOURCE_BY_GRAMMAR[lang] ? lang : lang; // aliases share a source key set below
        const source = SOURCE_BY_GRAMMAR[lang] || SOURCE_BY_GRAMMAR[
          lang === "html" || lang === "xml" || lang === "svg" ? "markup" :
          lang === "js" ? "javascript" :
          lang === "sh" || lang === "shell" ? "bash" : lang
        ];
        code.textContent = source;
        const result = wonkCode.highlight(code, lang);
        assert(result.ok, `expected ok:true for "${lang}", got ${JSON.stringify(result)}`);
        assert(code.innerHTML.includes("token"), `expected tokenized markup for "${lang}"`);
        assert(!code.dataset.wonkCodeError, `expected no error flag for "${lang}"`);
      } finally {
        host.remove();
      }
    });
  });

  check("highlight() rejects a non-Element target", () => {
    let threw = false;
    try { wonkCode.highlight(null, "json"); } catch { threw = true; }
    assert(threw, "expected highlight(null, ...) to throw");
  });

  // ============================================================
  // parse: valid JSON formats and clears any prior error
  // ============================================================
  check("jsonEditor: valid JSON formats to 2 spaces and clears the error", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"b\":2,\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-preview\"></div>" +
      "<div class=\"wonk-json-editor-error\" role=\"alert\" hidden></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      editor.format();
      const textarea = root.querySelector("textarea");
      assert(textarea.value === JSON.stringify({ b: 2, a: 1 }, null, 2), "expected pretty-printed 2-space JSON");
      const errorEl = root.querySelector(".wonk-json-editor-error");
      assert(errorEl.hidden === true, "expected error box hidden after a valid format");
      const preview = root.querySelector(".wonk-json-editor-preview code");
      assert(preview && preview.textContent.includes("\"a\""), "expected preview to render the formatted JSON");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // parse: invalid JSON shows an error and retains the draft
  // ============================================================
  check("jsonEditor: invalid JSON shows an error, sets aria-invalid, and retains the invalid draft", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"a\": }</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-preview\"></div>" +
      "<div class=\"wonk-json-editor-error\" role=\"alert\" hidden></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      const before = root.querySelector("textarea").value;
      editor.format();
      const textarea = root.querySelector("textarea");
      assert(textarea.value === before, "invalid draft must not be rewritten");
      assert(textarea.getAttribute("aria-invalid") === "true", "expected aria-invalid=true on the textarea");
      const errorEl = root.querySelector(".wonk-json-editor-error");
      assert(errorEl.hidden === false, "expected the error box to be visible");
      assert(errorEl.getAttribute("role") === "alert", "expected the error box to keep role=alert");
      assert(errorEl.textContent.length > 0, "expected a non-empty error message");

      // typing after an invalid format clears aria-invalid again, even
      // though the error message itself only clears on a successful format
      textarea.value = before + " ";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      assert(!textarea.hasAttribute("aria-invalid"), "expected input to clear aria-invalid");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // error node auto-creation: role=alert exists even if the markup
  // omitted it, so a failure is never invisible
  // ============================================================
  check("jsonEditor: creates a visible role=alert error node when the markup omits one", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>not json</textarea>" +
      "<button class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      assert(!root.querySelector("[role='alert']"), "fixture must start with no alert node, to prove one gets created");
      const editor = wonkCode.jsonEditor(root);
      editor.format();
      const errorEl = root.querySelector("[role='alert']");
      assert(errorEl, "expected wonkCode to create a role=alert node");
      assert(errorEl.hidden === false, "expected the created error node to be visible after a failed format");
      assert(errorEl.textContent.length > 0, "expected the created error node to carry the message");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // preview staleness: never implies the preview matches a draft it
  // no longer reflects
  // ============================================================
  check("jsonEditor: preview is marked stale after editing a fresh draft", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-preview\"></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      const preview = root.querySelector(".wonk-json-editor-preview");
      editor.format();
      assert(preview.dataset.wonkJsonPreviewState === "fresh", "expected fresh state right after a successful format");

      const textarea = root.querySelector("textarea");
      textarea.value = textarea.value + " ";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      assert(preview.dataset.wonkJsonPreviewState === "stale", "expected stale state after editing a fresh draft");
    } finally {
      host.remove();
    }
  });

  check("jsonEditor: preview is marked stale after a failed reformat, not silently left fresh", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-preview\"></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      const preview = root.querySelector(".wonk-json-editor-preview");
      editor.format();
      assert(preview.dataset.wonkJsonPreviewState === "fresh", "expected fresh state after the first successful format");

      const textarea = root.querySelector("textarea");
      textarea.value = "{ broken";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      editor.format();
      assert(preview.dataset.wonkJsonPreviewState === "stale", "expected a failed reformat to mark the still-visible preview stale");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // safe against hostile markup: no injected script executes, no
  // raw tags survive into the DOM as real elements
  // ============================================================
  check("render()/highlight() neutralize hostile markup", () => {
    window.__wonkCodeHostileProbe = false;
    const hostile = "<img src=x onerror=\"window.__wonkCodeHostileProbe = true\">" +
      "<script>window.__wonkCodeHostileProbe = true;</scr" + "ipt>";
    const host = withFixture("<div></div>");
    try {
      const target = host.querySelector("div");
      wonkCode.render(target, hostile, "markup");
      assert(window.__wonkCodeHostileProbe === false, "hostile markup must never execute");
      assert(!target.querySelector("script"), "no real <script> element may be created");
      assert(!target.querySelector("img[onerror]"), "no live onerror-bearing element may be created");
    } finally {
      host.remove();
      delete window.__wonkCodeHostileProbe;
    }
  });

  check("render() treats an object payload as data, not markup, even with HTML-like strings", () => {
    window.__wonkCodeHostileProbe2 = false;
    const host = withFixture("<div></div>");
    try {
      const target = host.querySelector("div");
      wonkCode.render(target, { note: "<img src=x onerror=\"window.__wonkCodeHostileProbe2 = true\">" }, "json");
      assert(window.__wonkCodeHostileProbe2 === false, "hostile string inside JSON data must never execute");
      assert(!target.querySelector("img[onerror]"), "no live onerror-bearing element may be created from JSON data");
    } finally {
      host.remove();
      delete window.__wonkCodeHostileProbe2;
    }
  });

  check("render() throws for a value that cannot be JSON-serialized, never renders the literal \"undefined\"", () => {
    const host = withFixture("<div></div>");
    try {
      const target = host.querySelector("div");
      let threw = false;
      try { wonkCode.render(target, undefined, "json"); } catch { threw = true; }
      assert(threw, "expected render(el, undefined) to throw");

      const circular = {};
      circular.self = circular;
      threw = false;
      try { wonkCode.render(target, circular, "json"); } catch { threw = true; }
      assert(threw, "expected render(el, <circular>) to throw");
    } finally {
      host.remove();
    }
  });

  check("render() replaces a pre's existing plain-text content instead of duplicating it", () => {
    const host = withFixture("<pre class=\"wonk-pre\">stale placeholder text</pre>");
    try {
      const pre = host.querySelector("pre");
      wonkCode.render(pre, { a: 1 }, "json");
      assert(!pre.textContent.includes("stale placeholder"), "expected the old plain text to be replaced, not appended alongside the new <code>");
      assert(pre.querySelectorAll("code").length === 1, "expected exactly one <code> element inside the pre");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // dynamic rehighlight: changing textContent and calling
  // highlight() again reflects the new content, not a stale cache
  // ============================================================
  check("highlight() re-tokenizes fresh textContent on every call", () => {
    const host = withFixture("<pre class=\"wonk-pre\"><code data-language=\"json\"></code></pre>");
    try {
      const code = host.querySelector("code");
      code.textContent = "{\"a\": 1}";
      wonkCode.highlight(code);
      assert(code.innerHTML.includes(">1<") || code.innerHTML.includes(">1</span>"), "expected first value tokenized");

      code.textContent = "{\"b\": 2}";
      wonkCode.highlight(code);
      assert(code.textContent === "{\"b\": 2}", "expected second highlight to reflect the new source text");
      assert(!code.innerHTML.includes("\"a\""), "expected stale first-render content to be gone");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // lifecycle: init(scope) is idempotent, destroy(scope) tears down
  // ============================================================
  check("init(scope) does not re-highlight an already-wired code block", () => {
    const host = withFixture("<pre class=\"wonk-pre\"><code data-language=\"json\">{\"a\":1}</code></pre>");
    try {
      wonkCode.init(host);
      const code = host.querySelector("code");
      const afterFirst = code.innerHTML;
      // Mutate the rendered markup directly to prove a second init()
      // pass leaves it alone (it must not detect + re-highlight
      // blocks it already marked as wired).
      code.innerHTML = afterFirst + "<!--sentinel-->";
      wonkCode.init(host);
      assert(code.innerHTML.includes("sentinel"), "a second init() must not touch an already-wired block");
    } finally {
      host.remove();
    }
  });

  check("init(scope) wires a .wonk-json-editor exactly once across repeated calls", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-preview\"></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      wonkCode.init(host);
      const firstHandle = root.wonkJsonEditor;
      wonkCode.init(host);
      wonkCode.init(host);
      assert(root.wonkJsonEditor === firstHandle, "expected the same editor handle across repeated init() calls");

      let highlightCount = 0;
      const realHighlight = window.Prism.highlight;
      // Spy on Prism.highlight to count how many times a single click
      // actually reaches it. render()/format() are closure-scoped, so
      // this is the one shared choke point every format() call passes
      // through. If init() had attached the click listener more than
      // once, one click would highlight more than once.
      window.Prism.highlight = function (...args) { highlightCount++; return realHighlight.apply(this, args); };
      try {
        root.querySelector(".wonk-json-editor-format").click();
      } finally {
        window.Prism.highlight = realHighlight;
      }
      assert(highlightCount === 1, `expected exactly one Prism.highlight() call per click after repeated init(), got ${highlightCount}`);
    } finally {
      host.remove();
    }
  });

  check("destroy(scope) clears the editor handle and stops formatting", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-preview\"></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      wonkCode.init(host);
      assert(root.wonkJsonEditor, "expected the editor to be wired first");
      wonkCode.destroy(host);
      assert(!root.wonkJsonEditor, "expected destroy() to clear the cached handle");

      const before = root.querySelector("textarea").value;
      root.querySelector(".wonk-json-editor-format").click();
      assert(root.querySelector("textarea").value === before, "a click after destroy() must not format anything");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // malformed markup: throws a descriptive error, never a silent null
  // ============================================================
  check("jsonEditor: throws a descriptive error when the textarea is missing", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      let message = null;
      try { wonkCode.jsonEditor(root); } catch (err) { message = err.message; }
      assert(message !== null, "expected jsonEditor() to throw, not return null, for missing markup");
      assert(message.includes("textarea"), `expected the error to name the missing element, got: ${message}`);
    } finally {
      host.remove();
    }
  });

  check("jsonEditor: throws a descriptive error when the Format button is missing", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\"><textarea>{}</textarea></div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      let message = null;
      try { wonkCode.jsonEditor(root); } catch (err) { message = err.message; }
      assert(message !== null, "expected jsonEditor() to throw, not return null, for missing markup");
      assert(message.toLowerCase().includes("format button"), `expected the error to name the missing button, got: ${message}`);
    } finally {
      host.remove();
    }
  });

  check("init(scope): a malformed editor logs an error but does not stop wiring the rest of scope", () => {
    const host = withFixture(
      "<div>" +
      "<div class=\"wonk-json-editor\"><button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button></div>" +
      "<pre class=\"wonk-pre\"><code data-language=\"json\">{\"a\":1}</code></pre>" +
      "</div>"
    );
    try {
      wonkCode.init(host); // must not throw out of init() itself
      const code = host.querySelector("code");
      assert(code.classList.contains("wonk-code-highlighted"), "expected the valid code block to still get highlighted");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // formatBtn defaults to type=button so it never submits a form
  // ============================================================
  check("jsonEditor: a Format button with no explicit type is forced to type=button", () => {
    const host = withFixture(
      "<form>" +
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{}</textarea>" +
      "<button class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>" +
      "</form>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      wonkCode.jsonEditor(root);
      const btn = root.querySelector(".wonk-json-editor-format");
      assert(btn.type === "button", `expected type to be forced to "button", got "${btn.type}"`);
    } finally {
      host.remove();
    }
  });

  check("jsonEditor: an explicit button type is left alone", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{}</textarea>" +
      "<button type=\"reset\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      wonkCode.jsonEditor(root);
      const btn = root.querySelector(".wonk-json-editor-format");
      assert(btn.type === "reset", `expected an explicit type to be left alone, got "${btn.type}"`);
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // disabled state: native disabled blocks formatting; a direct
  // format() call while disabled is also a no-op, not a crash
  // ============================================================
  check("jsonEditor: format() is a no-op while the textarea is disabled", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea disabled>{\"b\":2,\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      const before = root.querySelector("textarea").value;
      editor.format();
      assert(root.querySelector("textarea").value === before, "format() must not rewrite a disabled textarea's value");
    } finally {
      host.remove();
    }
  });

  check("jsonEditor: format() is a no-op while the Format button itself is disabled", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"b\":2,\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\" disabled>Format JSON</button>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      const before = root.querySelector("textarea").value;
      editor.format();
      assert(root.querySelector("textarea").value === before, "format() must not rewrite the draft while the button is disabled");
    } finally {
      host.remove();
    }
  });

  check("jsonEditor: a disabling ancestor fieldset blocks the native click from formatting", () => {
    const host = withFixture(
      "<fieldset disabled>" +
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"b\":2,\"a\":1}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>" +
      "</fieldset>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      wonkCode.jsonEditor(root);
      const before = root.querySelector("textarea").value;
      // A disabled fieldset makes descendant form controls disabled per
      // the HTML spec; a real click on a disabled button never fires a
      // click event at all, so this is what a genuine pointer click
      // would do -- not a simulation gap.
      root.querySelector(".wonk-json-editor-format").click();
      assert(root.querySelector("textarea").value === before, "a disabled-by-fieldset button must not format on click");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // format() size guard: runs BEFORE JSON.parse, distinct from the
  // highlight() size guard
  // ============================================================
  check("jsonEditor: format() rejects a draft over MAX_FORMAT_CHARS before parsing it", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea></textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "<div class=\"wonk-json-editor-error\" role=\"alert\" hidden></div>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      const textarea = root.querySelector("textarea");
      // Valid JSON, but oversized -- proves the guard fires on length
      // alone, before JSON.parse ever runs (a parse of this much valid
      // JSON would otherwise succeed and reach JSON.stringify too).
      const big = "[" + Array(wonkCode.MAX_FORMAT_CHARS).fill("1").join(",") + "]";
      textarea.value = big;

      let parseCalled = false;
      const realParse = JSON.parse;
      JSON.parse = function (...args) { parseCalled = true; return realParse.apply(this, args); };
      try {
        editor.format();
      } finally {
        JSON.parse = realParse;
      }
      assert(!parseCalled, "expected the size guard to reject before JSON.parse ever runs");
      assert(textarea.value === big, "oversized draft must be left untouched");
      const errorEl = root.querySelector(".wonk-json-editor-error");
      assert(errorEl.hidden === false, "expected a visible error for an oversized draft");
      assert(/limit/i.test(errorEl.textContent), `expected the error to mention the size limit, got: ${errorEl.textContent}`);
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // large-integer / numeric precision: documented behavior, not a bug
  // ============================================================
  check("jsonEditor: documents native numeric rounding and displays a precision warning", () => {
    const host = withFixture(
      "<div class=\"wonk-json-editor\">" +
      "<textarea>{\"id\": 9007199254740993}</textarea>" +
      "<button type=\"button\" class=\"wonk-json-editor-format\">Format JSON</button>" +
      "</div>"
    );
    try {
      const root = host.querySelector(".wonk-json-editor");
      const editor = wonkCode.jsonEditor(root);
      editor.format();
      // This assertion documents current, expected behavior: JSON.parse
      // produces a JS number, so a value one past Number.MAX_SAFE_INTEGER
      // round-trips to the nearest representable double. This is not
      // silently "fixed" here; references/code.md documents it and
      // tells integrators to keep IDs as strings if exact round-trip
      // matters. This check exists so a future change to that behavior
      // (e.g. a real bigint-preserving parser) is a deliberate, visible
      // decision, not an accidental regression.
      const textarea = root.querySelector("textarea");
      assert(textarea.value.includes("9007199254740992"), `expected the documented double round-trip, got: ${textarea.value}`);
            assert(root.querySelector('.wonk-json-editor-note')?.textContent.includes('round'), 'precision warning must be visible');
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // size bound: oversized input is never tokenized, stays safe
  // ============================================================
  check("highlight() skips tokenizing past MAX_HIGHLIGHT_CHARS and stays safe", () => {
    const host = withFixture("<pre class=\"wonk-pre\"><code></code></pre>");
    try {
      const code = host.querySelector("code");
      const big = "\"" + "a".repeat(wonkCode.MAX_HIGHLIGHT_CHARS + 10) + "\"";
      code.textContent = big;
      const result = wonkCode.highlight(code, "json");
      assert(result.ok === true && result.skipped === "size-limit", `expected a size-limit skip, got ${JSON.stringify(result)}`);
      assert(code.dataset.wonkCodeSkipped === "size-limit", "expected the skip flag on the element");
      assert(code.textContent === big, "oversized source text must be preserved verbatim");
      assert(!code.querySelector("script"), "oversized input must never be parsed as live markup");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // vendor failure is always visible, never silent
  // ============================================================
  check("highlight() shows a visible error and plain source when Prism is unavailable", async () => {
    const instance = await loadIsolatedInstance(false);
    try {
      const doc = instance.win.document;
      const pre = doc.createElement("pre");
      const code = doc.createElement("code");
      code.textContent = "{\"a\": 1}";
      pre.appendChild(code);
      doc.body.appendChild(pre);

      let eventFired = false;
      code.addEventListener("wonk-code:error", () => { eventFired = true; });

      const result = instance.win.wonkCode.highlight(code, "json");
      assert(result.ok === false && result.reason === "vendor-unavailable", `expected vendor-unavailable, got ${JSON.stringify(result)}`);
      assert(code.textContent === "{\"a\": 1}", "plain source must remain visible");
      assert(!!code.dataset.wonkCodeError, "expected a visible error flag on the element");
      assert(eventFired, "expected a wonk-code:error event to fire");
    } finally {
      instance.cleanup();
    }
  });

  check("highlight() shows a visible error for an unsupported language", () => {
    const host = withFixture("<pre class=\"wonk-pre\"><code></code></pre>");
    try {
      const code = host.querySelector("code");
      code.textContent = "print('hi')";
      const result = wonkCode.highlight(code, "python");
      assert(result.ok === false && result.reason === "unsupported-language", `expected unsupported-language, got ${JSON.stringify(result)}`);
      assert(code.textContent === "print('hi')", "plain source must remain visible");
      assert(!!code.dataset.wonkCodeError, "expected a visible error flag on the element");
    } finally {
      host.remove();
    }
  });

  // ============================================================
  // runner
  // ============================================================
  async function run() {
    const results = [];
    for (const { name, fn } of checks) {
      try {
        await fn();
        results.push({ name, pass: true });
        console.log("PASS " + name);
      } catch (err) {
        results.push({ name, pass: false, message: (err && err.message) || String(err) });
        console.error("FAIL " + name + ": " + ((err && err.message) || err));
      }
    }
    try { console.table(results); } catch { /* console.table not available in some hosts */ }
    const failed = results.filter((r) => !r.pass);
    console.log(`wonkCodeChecks: ${results.length - failed.length}/${results.length} passed`);
    return { passed: results.length - failed.length, failed: failed.length, results };
  }

  window.wonkCodeChecks = { run };
})();
