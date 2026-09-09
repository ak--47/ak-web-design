/* ============================================================
   wonk-code.js · syntax highlighting + JSON editor for WONK
   Requires wonk-tokens.css + wonk.css already loaded, and Prism
   (core + grammars) loaded before this script. See
   references/code.md for the exact vendor load order and the
   full API contract. No custom tokenizer: all highlighting goes
   through Prism.highlight. No eval, no network calls, no
   auto-fetched code or data.

   API:
     wonkCode.highlight(el, language?)   -> { ok, skipped?, reason? }
     wonkCode.render(el, value, language = 'json') -> same shape
     wonkCode.init(scope = document)     -> wires code blocks + editors
     wonkCode.destroy(scope = document)  -> tears down editors
     wonkCode.jsonEditor(el)             -> { format(), value, destroy() }
     wonkCode.vendorReady()              -> boolean
     wonkCode.SUPPORTED_LANGUAGES        -> frozen array
     wonkCode.MAX_HIGHLIGHT_CHARS        -> number
     wonkCode.MAX_FORMAT_CHARS           -> number
     wonkCode.PRISM_VERSION              -> "1.29.0"
   ============================================================ */
(() => {
  "use strict";

  // Canonical Prism grammar keys this pack vendors. "clike" is a
  // building block for javascript, not usually requested directly,
  // but it is a real, working grammar so it stays supported.
  const CORE_LANGUAGES = ["markup", "css", "clike", "javascript", "json", "sql", "bash"];
  // Aliases resolve to one of the core keys above. These match the
  // aliases Prism itself registers for these exact grammar files.
  const ALIASES = {
    html: "markup", xml: "markup", svg: "markup",
    js: "javascript",
    sh: "bash", shell: "bash",
  };
  const SUPPORTED_LANGUAGES = Object.freeze([...CORE_LANGUAGES, ...Object.keys(ALIASES)]);

  // Above this many characters, highlight() skips tokenizing and
  // shows plain (but still safe) text instead. Regex-based
  // tokenizing runs on the main thread with no worker; past this
  // size it can visibly block input on typical hardware.
  const MAX_HIGHLIGHT_CHARS = 200000;
  // Same bound, kept as a separate name because it gates a different
  // operation: JSON.parse/JSON.stringify on the raw textarea draft,
  // before any highlighting happens. format() checks this first so a
  // huge paste never reaches JSON.parse at all.
  const MAX_FORMAT_CHARS = MAX_HIGHLIGHT_CHARS;

  const PRISM_VERSION = "1.29.0";

  function resolveLanguage(name) {
    if (!name) return null;
    const key = ALIASES[name] || name;
    return CORE_LANGUAGES.includes(key) ? key : null;
  }

  function vendorReady() {
    return (
      typeof window.Prism === "object" &&
      typeof window.Prism.highlight === "function" &&
      typeof window.Prism.languages === "object"
    );
  }

  // Marks `el` as degraded (vendor missing, language unsupported, or
  // a Prism error) without ever hiding the failure: the plain source
  // text stays visible, a CSS-rendered inline note appears (see
  // wonk-code.css), the failure is logged, and a bubbling event lets
  // a host app show its own banner if it wants one.
  function markUnavailable(el, text, reason, message) {
    el.textContent = text;
    el.dataset.wonkCodeError = message;
    delete el.dataset.wonkCodeSkipped;
    console.error(`wonkCode: ${message}`);
    el.dispatchEvent(
      new CustomEvent("wonk-code:error", { detail: { el, reason, message }, bubbles: true })
    );
  }

  /**
   * Highlights `el` from its own current textContent (never from
   * cached markup), so calling this again after changing the
   * element's text always re-highlights the new content. Never
   * throws for a missing vendor or unsupported language; it falls
   * back to visible plain text instead (see markUnavailable).
   */
  function highlight(el, language) {
    if (!(el instanceof Element)) {
      throw new TypeError(`wonkCode.highlight: el must be a DOM Element, got ${el === null ? "null" : typeof el}.`);
    }
    const lang = language || el.dataset.language || "json";
    const text = el.textContent;

    if (!vendorReady()) {
      markUnavailable(el, text, "vendor-unavailable", "Prism did not load; showing plain source.");
      return { ok: false, reason: "vendor-unavailable" };
    }

    const grammarKey = resolveLanguage(lang);
    const grammar = grammarKey && window.Prism.languages[grammarKey];
    if (!grammar) {
      markUnavailable(
        el, text, "unsupported-language",
        `"${lang}" is not a supported language (${SUPPORTED_LANGUAGES.join(", ")}); showing plain source.`
      );
      return { ok: false, reason: "unsupported-language" };
    }

    if (text.length > MAX_HIGHLIGHT_CHARS) {
      el.textContent = text; // still safe, just not tokenized
      el.dataset.wonkCodeSkipped = "size-limit";
      delete el.dataset.wonkCodeError;
      return { ok: true, skipped: "size-limit" };
    }

    try {
      const html = window.Prism.highlight(text, grammar, grammarKey);
      el.innerHTML = html;
    } catch (err) {
      markUnavailable(el, text, "highlight-error", `Prism failed to highlight this block: ${err.message}`);
      return { ok: false, reason: "highlight-error" };
    }

    el.dataset.language = lang;
    el.classList.add("wonk-code-highlighted");
    delete el.dataset.wonkCodeError;
    delete el.dataset.wonkCodeSkipped;
    return { ok: true };
  }

  // Finds (or creates) the <code> element that should hold rendered
  // text: `el` itself if it already is one, a child of `el` if `el`
  // is a <pre>, or a fresh .wonk-pre > code pair appended into a
  // generic container. Never touches unrelated siblings outside a
  // <pre>/<code> target. When a <pre> has no existing <code> child,
  // any of its own stray content (e.g. plain text placed there before
  // this pack was wired in) is replaced, not left dangling alongside
  // the new element -- otherwise the old text and the newly rendered
  // text would both be visible at once.
  function resolveCodeTarget(el) {
    if (el.tagName === "CODE") return el;
    if (el.tagName === "PRE") {
      let code = el.querySelector(":scope > code");
      if (!code) {
        code = document.createElement("code");
        el.replaceChildren(code);
      }
      return code;
    }
    let pre = el.querySelector(":scope > pre.wonk-pre");
    if (!pre) {
      pre = document.createElement("pre");
      pre.className = "wonk-pre";
      el.appendChild(pre);
    }
    let code = pre.querySelector(":scope > code");
    if (!code) { code = document.createElement("code"); pre.appendChild(code); }
    return code;
  }

  /**
   * Renders `value` (an object, JSON.stringify'd with 2-space
   * indent, or a string used verbatim) into `el`, then highlights
   * it. `el` may be a <code>, a <pre>, or a generic container (a
   * .wonk-pre > code pair is created inside it once). This is the
   * shared entry point other WONK surfaces (event log rows, the data
   * workbench's record inspector) should use instead of building
   * their own <pre><code> and calling JSON.stringify directly -- see
   * references/code.md for the drop-in replacement.
   *
   * Throws a TypeError if `value` cannot become a string: `undefined`
   * at the top level, or a value (function, symbol) JSON.stringify
   * itself turns into `undefined`. A circular object throws too, with
   * JSON.stringify's own native error -- neither case is ever
   * silently coerced into the literal text "undefined".
   */
  function render(el, value, language = "json") {
    if (!(el instanceof Element)) {
      throw new TypeError(`wonkCode.render: el must be a DOM Element, got ${el === null ? "null" : typeof el}.`);
    }
    let text;
    if (typeof value === "string") {
      text = value;
    } else {
      const serialized = JSON.stringify(value, null, 2);
      if (serialized === undefined) {
        throw new TypeError(
          `wonkCode.render: value of type "${typeof value}" cannot be JSON-serialized. Pass a string, or a plain JSON-compatible value.`
        );
      }
      text = serialized;
    }
    const codeEl = resolveCodeTarget(el);
    codeEl.textContent = text;
    codeEl.dataset.language = language;
    return { el: codeEl, ...highlight(codeEl, language) };
  }

  // ---- JSON editor ----
  // Markup contract (see references/code.md for the full example):
  //   .wonk-json-editor
  //     textarea                              -- the draft source, required
  //     .wonk-json-editor-format (or [data-wonk-json-format]) -- required
  //     .wonk-json-editor-preview pre > code   -- optional, auto-created
  //     .wonk-json-editor-error[role=alert]    -- optional, auto-created
  function ensureErrorNode(root) {
    let errorEl = root.querySelector(".wonk-json-editor-error, [role='alert']");
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.className = "wonk-json-editor-error";
      errorEl.setAttribute("role", "alert");
      errorEl.hidden = true;
      root.appendChild(errorEl);
    }
    return errorEl;
  }

  function wireJsonEditor(root) {
    if (root.wonkJsonEditor) return root.wonkJsonEditor;

    // A malformed editor is a markup bug in the calling app, not a
    // recoverable runtime state -- fail loud with a specific fix
    // instead of returning null and leaving the button dead with no
    // explanation.
    const textarea = root.querySelector("textarea");
    if (!textarea) {
      throw new Error("wonkCode.jsonEditor: .wonk-json-editor requires exactly one <textarea> for the draft source.");
    }
    const formatBtn = root.querySelector(".wonk-json-editor-format, [data-wonk-json-format]");
    if (!formatBtn) {
      throw new Error(
        "wonkCode.jsonEditor: .wonk-json-editor requires a Format button matching .wonk-json-editor-format or [data-wonk-json-format]."
      );
    }
    // A <button> with no explicit type defaults to "submit" inside a
    // <form>, which would submit the form instead of formatting.
    // Force it to "button" unless the author explicitly chose
    // something else (e.g. a deliberate "reset").
    if (formatBtn.tagName === "BUTTON" && !formatBtn.hasAttribute("type")) {
      formatBtn.type = "button";
    }

    const previewHost = root.querySelector(".wonk-json-editor-preview") || root;
    const errorEl = ensureErrorNode(root);
    if (!root.querySelector('.wonk-json-editor-note')) {
      const note = document.createElement('p');
      note.className = 'wonk-help wonk-json-editor-note';
      note.textContent = 'Formatting uses JavaScript JSON rules: large numbers can round, duplicate keys collapse, and numeric keys reorder. Keep exact IDs as strings.';
      root.insertBefore(note, root.firstChild);
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      textarea.setAttribute("aria-invalid", "true");
      console.error(`wonkCode: ${message}`);
    }
    function hideError() {
      errorEl.hidden = true;
      errorEl.textContent = "";
      textarea.removeAttribute("aria-invalid");
    }

    // "empty": nothing has ever rendered successfully, so there is no
    // preview to mislabel. "fresh": the preview matches the textarea
    // exactly as last formatted. "stale": the textarea has changed
    // (by typing or by a failed reformat) since that render, so the
    // preview may no longer match the draft -- wonk-code.css shows a
    // visible label for this state, it is never left ambiguous.
    let previewState = "empty";
    function setPreviewState(state) {
      previewState = state;
      previewHost.dataset.wonkJsonPreviewState = state;
    }

    function onInput() {
      textarea.removeAttribute("aria-invalid");
      if (previewState === "fresh") setPreviewState("stale");
    }
    textarea.addEventListener("input", onInput);

    // Reentrancy guard: format() is synchronous today, so this only
    // matters if a future change makes it async (e.g. yielding for a
    // very large paste). The real "no double format" guarantee is
    // that wireJsonEditor() only ever attaches one click listener, no
    // matter how many times init() runs on the same element.
    let formatting = false;
    function format() {
      if (formatting) return;
      // Native [disabled] on the textarea/button (or an ancestor
      // fieldset) already blocks the click and typing that would
      // normally reach here. This guard covers the one path native
      // disabling can't: calling editor.format() directly from code
      // while the control is disabled.
      if (textarea.matches(":disabled") || formatBtn.matches(":disabled")) return;
      formatting = true;
      try {
        const raw = textarea.value;

        // Guard BEFORE JSON.parse: a multi-hundred-thousand-character
        // draft would otherwise pay for both a parse and a re-stringify
        // synchronously on the main thread. This is a distinct bound
        // from MAX_HIGHLIGHT_CHARS -- it exists so a huge paste never
        // reaches JSON.parse/JSON.stringify at all, not just so the
        // resulting preview skips tokenizing.
        if (raw.length > MAX_FORMAT_CHARS) {
          showError(
            `Draft is ${raw.length.toLocaleString()} characters, over the ${MAX_FORMAT_CHARS.toLocaleString()}-character formatting limit. Formatting was skipped to avoid blocking the page; reduce the input size.`
          );
          if (previewState !== "empty") setPreviewState("stale");
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          // Invalid JSON: the draft in the textarea is never
          // touched, and the last successfully rendered preview (if
          // any) is left in place, but relabeled stale rather than
          // silently implying it matches this draft.
          showError(`Invalid JSON: ${err.message}`);
          if (previewState !== "empty") setPreviewState("stale");
          return;
        }
        const pretty = JSON.stringify(parsed, null, 2);
        textarea.value = pretty;
        hideError();
        render(previewHost, pretty, "json");
        setPreviewState("fresh");
      } finally {
        formatting = false;
      }
    }

    formatBtn.addEventListener("click", format);

    const api = {
      format,
      get value() { return textarea.value; },
      destroy() {
        formatBtn.removeEventListener("click", format);
        textarea.removeEventListener("input", onInput);
        root.wonkJsonEditor = null;
      },
    };
    root.wonkJsonEditor = api;
    return api;
  }

  function jsonEditor(el) {
    if (!(el instanceof Element)) {
      throw new TypeError(`wonkCode.jsonEditor: el must be a DOM Element, got ${el === null ? "null" : typeof el}.`);
    }
    return wireJsonEditor(el);
  }

  // ---- lifecycle ----
  function init(scope = document) {
    const root = scope.nodeType === 1 ? scope : document;

    const codeBlocks = [...root.querySelectorAll("pre code[data-language]")];
    if (root.nodeType === 1 && root.matches?.("pre code[data-language]")) codeBlocks.push(root);
    codeBlocks.forEach((code) => {
      if (code.dataset.wonkCodeAuto) return; // idempotent: init() never re-processes a block it already wired
      code.dataset.wonkCodeAuto = "1";
      highlight(code, code.dataset.language);
    });

    const editors = [...root.querySelectorAll(".wonk-json-editor")];
    if (root.nodeType === 1 && root.matches?.(".wonk-json-editor")) editors.push(root);
    editors.forEach((el) => {
      try {
        wireJsonEditor(el); // idempotent per element
      } catch (err) {
        // A single malformed editor in a larger injected subtree must
        // not take down the wiring of everything else in that scope --
        // but it is still a real markup bug, so it is reported loudly,
        // never silently skipped.
        console.error(`wonkCode.init: ${err.message}`);
      }
    });
  }

  function destroy(scope = document) {
    const root = scope.nodeType === 1 ? scope : document;
    const all = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
    all.forEach((el) => { el.wonkJsonEditor?.destroy(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  window.wonkCode = {
    highlight, render, init, destroy, jsonEditor, vendorReady,
    SUPPORTED_LANGUAGES, MAX_HIGHLIGHT_CHARS, MAX_FORMAT_CHARS, PRISM_VERSION,
  };
})();
