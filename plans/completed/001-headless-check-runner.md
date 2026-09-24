# Plan 001: One command runs every WONK browser check headless, and CI blocks a broken deploy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Your reviewer maintains `plans/README.md`; do not
> edit it.
>
> **Drift check (run first)**: `git diff --stat ea62dcd..HEAD -- demo/ .github/ README.md`
> If any in-scope file changed, compare the "Current state" excerpts against
> the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1 (every later plan uses this as its verification gate)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `ea62dcd`, 2026-09-23

## Why this matters

WONK (this repo, `/Users/ak/.agents/skills/ak-web-design`) is a vanilla
CSS/JS design system with no build step. Its behavior checks exist only as
browser-console scripts that a human runs by hand on three gallery pages.
Nothing runs them automatically, so regressions ship, and an agent building
with WONK cannot verify its own work in one pass. After this plan,
`npm test` serves the repo, opens each gallery in headless Chromium, runs
every check suite, and exits non-zero on any failure. The GitHub Pages
deploy runs the same command first.

## Current state

- No `package.json`, no `.gitignore`, no test job.
- `.github/workflows/pages.yml` — deploys the whole repo (`path: .`) to
  GitHub Pages on push to `main`. One job, `deploy`. No checks.
- Three check suites, each a browser global with an async `run()`:
  - `demo/controls-checks.js` → `window.wonkControlsChecks.run()`, loaded
    by `demo/instruments.html:17`. Returns an **array**
    `[{name, pass, message}]` (see `demo/controls-checks.js:574-591`).
  - `demo/motion-checks.js` → `window.wonkMotionChecks.run()`, loaded by
    `demo/motion.html:20`. Returns `{passed, failed, results}` where a
    failing result has `error` (not `message`) — `demo/motion-checks.js:348-363`.
  - `demo/code-checks.js` → `window.wonkCodeChecks.run()`, loaded by
    `demo/index.html:77`. Returns `{passed, failed, results}` with
    `message` — `demo/code-checks.js:719-735`.
  - Each suite's checks are `{name, fn}` entries run in sequence with
    try/catch. Match that structure for any new suite.
- `demo/index.html:52-53` loads d3 and Observable Plot from jsDelivr
  (network needed; that is fine for now — another plan vendors them).
- All gallery scripts use `defer` and paths relative to `demo/`
  (`../assets/wonk.js`). The pages only work over http, not `file://`.
- Base behaviors in `assets/wonk.js` (`window.wonk`: `toast`, `tabs`,
  `setTheme`, `setPair`, `spark`, `init`, `live`, …) have **no** checks.
- README `## validation` section (around `README.md:322-336`) tells the
  user to run the three suites in the console by hand.
- Local machine: Node v24, Playwright 1.63 available via npx, Chromium
  browsers cached in `~/Library/Caches/ms-playwright`.

Conventions: 2-space indent, double quotes, `"use strict"` IIFEs in browser
files, short `// ----` section comments. Look at `demo/code-checks.js` as
the model for a check file (header comment explaining how to run it,
`checks` array, `run()` at the bottom, global on `window`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` (repo root) | exit 0, creates `node_modules/` |
| Browsers | `npx playwright install chromium` | exit 0 (may be a no-op) |
| All checks | `npm test` | exit 0, prints one line per check, summary line `N passed, 0 failed` |
| One suite | `npm test -- controls` | runs only the suite named `controls` |

## Scope

**In scope**:
- `package.json` (create) — `"private": true`, `"type": "module"`,
  `scripts.test = "node scripts/check.mjs"`, devDependency `playwright`
  (current major). No runtime dependencies.
- `package-lock.json` (created by npm)
- `.gitignore` (create) — `node_modules/`, `test-results/`, `.playwright-mcp/`
- `scripts/check.mjs` (create) — the runner
- `demo/base-checks.js` (create) — checks for `assets/wonk.js` base behaviors
- `demo/index.html` — add ONE `<script defer src="base-checks.js"></script>`
  line next to the existing `code-checks.js` tag. No other change.
- `demo/controls-checks.js`, `demo/motion-checks.js`, `demo/code-checks.js` —
  only the `run()` function's return shape and its header comment.
- `.github/workflows/pages.yml`
- `README.md` — only the `## validation` section.

**Out of scope** (do NOT touch):
- Anything in `assets/`. This plan measures; it fixes nothing. If a check
  shows a product bug, report it.
- Check assertions inside the existing suites.
- Other files a parallel executor may be creating right now:
  `assets/wonk-radio.*`, `demo/radio.html`, `demo/radio-checks.js`,
  `references/radio.md`. Never `git add -A`; never delete untracked files
  you did not create.

## Git workflow

Do not commit. Your reviewer commits after review.

## Steps

### Step 1: package.json, .gitignore, install

Create the files described in Scope. Run `npm install`.

**Verify**: `npm install && node -e "import('playwright').then(()=>console.log('ok'))"` → prints `ok`.

### Step 2: Normalize the three `run()` return shapes

Every suite's `run()` returns `{ passed, failed, results }` where each
result is `{ name, pass, message }` (`message` is `"ok"` on pass, the error
text on failure). Change only `run()` and the header comment in each file.
Keep the console printing.

**Verify**: `grep -n "return results;" demo/controls-checks.js` → no match;
`grep -n "error:" demo/motion-checks.js` → no match inside `run()`.

### Step 3: Write `scripts/check.mjs`

Zero dependencies besides `playwright`. Behavior:

1. Start a static file server with `node:http` on `127.0.0.1`, port 0
   (random), serving the repo root. Correct `Content-Type` for `.html`,
   `.js`, `.mjs`, `.css`, `.json`, `.svg`, `.woff2`, `.mp3`, `.wav`. Support
   `Range` requests for media files (return 206 with `Content-Range`) —
   a later audio suite needs it. Reject paths that escape the repo root.
2. Launch headless Chromium with
   `args: ["--autoplay-policy=no-user-gesture-required"]`.
3. A `SUITES` array, one entry per suite, easy to extend:
   ```js
   const SUITES = [
     { name: "base",     page: "/demo/index.html",       global: "wonkBaseChecks" },
     { name: "code",     page: "/demo/index.html",       global: "wonkCodeChecks" },
     { name: "controls", page: "/demo/instruments.html", global: "wonkControlsChecks" },
     { name: "motion",   page: "/demo/motion.html",      global: "wonkMotionChecks" },
   ];
   ```
   If a suite's page file does not exist on disk, skip it with a printed
   `SKIP` line (lets later plans add suites before pages land).
4. For each suite: new page (viewport 1280×900), collect `pageerror`
   events and `console` messages of type `error`, `goto` the page, wait
   for `window[global]` (timeout 15s), `evaluate` `window[global].run()`,
   print `PASS|FAIL suite › check — message` per result.
5. An uncaught `pageerror` during a suite counts as a failure of that
   suite (print it). Console errors are printed as warnings only, except
   ones whose text starts with `Uncaught`.
6. Optional CLI filter: `node scripts/check.mjs controls motion` runs only
   those suite names.
7. Print `N passed, M failed` and exit 1 if `M > 0` or any suite could not
   run. Always close the browser and server (try/finally).

**Verify**: `npm test -- controls motion code` → exit 0 and every existing
check reported PASS.

### Step 4: Add `demo/base-checks.js`

A new suite, `window.wonkBaseChecks = { run, checks }`, same structure as
`demo/code-checks.js`. It runs on `demo/index.html`. Each check builds its
own fixture in a hidden container appended to `document.body` and removes
it in `finally`. Cover the base behaviors that work today:

- `wonk.toast("x", "ok")` appends an element with class `wonk-toast--ok`
  and text `x` inside `.wonk-toasts` (remove it afterwards).
- `wonk.setTheme("paper")` sets `data-theme="paper"` on `<html>`;
  `wonk.setTheme("dark")` removes it. Restore the original value after.
- `wonk.setPair("glorpla")` sets `data-pair`; restore the original after.
- Tabs: a fixture `.wonk-tabs` with two `.wonk-tab` buttons pointing at two
  panels; after `wonk.tabs(root)` and a click on tab 2, panel 1 is `hidden`,
  panel 2 is not, and tab 2 has `aria-selected="true"`.
- `wonk.spark(el, [1, 3, 2])` renders an `svg` with a `polyline` whose
  `points` attribute contains no `NaN`.

Do NOT write checks for known bugs (init idempotency, tab ARIA roles, toast
live region, spark with 0/1 values, contrast). Another plan adds those.

Add the script tag to `demo/index.html` (one line, after `code-checks.js`).

**Verify**: `npm test -- base` → exit 0, 5 checks PASS.

### Step 5: CI gate

In `.github/workflows/pages.yml` add a `check` job (ubuntu-latest):
`actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22`,
`npm ci`, `npx playwright install --with-deps chromium`, `npm test`.
Make `deploy` depend on it (`needs: check`). Keep the existing
permissions, concurrency, and deploy steps unchanged.

**Verify**: `node -e "const s=require('fs').readFileSync('.github/workflows/pages.yml','utf8'); if(!/needs:\s*check/.test(s)) process.exit(1); console.log('ok')"` → `ok`.

### Step 6: README validation section

Replace the manual-console instructions in `## validation` with:
`npm install` once, then `npm test` (all suites) or `npm test -- <suite>`,
a table of suites → page → global, and one sentence that the console path
(`await wonkControlsChecks.run()`) still works and returns
`{passed, failed, results}`. Keep the drift-audit grep block and the
self-audit checklist exactly as they are.

**Verify**: `grep -n "npm test" README.md` → at least one match inside `## validation`.

## Test plan

- `demo/base-checks.js`: 5 checks listed in Step 4.
- Runner self-test: temporarily make one base check throw, run
  `npm test -- base`, confirm exit code 1 and a FAIL line, then revert.

## Done criteria

- [ ] `npm test` exits 0; output lists base, code, controls, motion suites, all PASS
- [ ] `npm test -- base` runs only the base suite
- [ ] Temporarily failing check → exit 1 (then reverted)
- [ ] `git status --short` shows only in-scope paths changed/added (ignore
      radio files created by another executor)
- [ ] `grep -rn "assets/" <(git diff --name-only)` → no assets files modified

## STOP conditions

- An existing check fails in headless Chromium and a runner config change
  (viewport, reduced-motion emulation, waiting for fonts) does not fix it.
  Report the check names and messages. Do not edit the assertions or assets.
- `npm install` cannot fetch Playwright.
- A suite global never appears on its page within 15s.

## Maintenance notes

- New suites: add one line to `SUITES`. Later plans add `radio` and suites
  for new components.
- The runner's static server is also the easiest local preview:
  consider it the reference for how galleries must be served (http, repo root).
