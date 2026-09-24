// ============================================================
// scripts/check.mjs · headless runner for every WONK check suite
//
//   npm test                    all suites
//   npm test -- controls motion only the named suites
//
// Serves the repo root over http on 127.0.0.1 (random port), opens
// each suite's gallery page in headless Chromium, calls
// window[global].run() (which returns { passed, failed, results }),
// prints one line per check, and exits 1 on any failure.
// A smoke suite ({ smoke: true, selectors: [...] }, no global) loads its
// page, waits for DOMContentLoaded plus 1s, and passes when every
// selector matches an element and the page threw no error.
// Before any browser starts, checkVersion() compares VERSION with every
// asset header, wonk.version, and --wonk-version, and exits 1 on a mismatch.
// The static server lives in scripts/server.mjs (shared with npm run serve).
// Only dependency: playwright.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { ROOT, resolvePath, startServer } from "./server.mjs";

// ---- suites: add one line per suite ----
const SUITES = [
  { name: "base",     page: "/demo/index.html",       global: "wonkBaseChecks" },
  { name: "code",     page: "/demo/index.html",       global: "wonkCodeChecks" },
  { name: "controls", page: "/demo/instruments.html", global: "wonkControlsChecks" },
  { name: "motion",   page: "/demo/motion.html",      global: "wonkMotionChecks" },
  { name: "radio",    page: "/demo/radio.html",       global: "wonkRadioChecks" },
  { name: "data",     page: "/demo/index.html",       global: "wonkDataChecks" },
  { name: "charts",   page: "/demo/index.html",       global: "wonkChartsChecks" },
  {
    name: "template", page: "/templates/app.html", smoke: true,
    selectors: [".wonk-shell", "button.wonk-stat", ".wonk-table", "[data-wonk-radio] .wonk-radio-scope", "#trend-chart > [role='img']"],
  },
];

const GLOBAL_TIMEOUT_MS = 15000;
const SMOKE_SETTLE_MS = 1000;
const VIEWPORT = { width: 1280, height: 900 };

// ---- version stamp: runs before the browser starts ----
// VERSION must match the "WONK vX.Y.Z" stamp in the first header line
// of every top-level asset, wonk.version in wonk.js, and
// --wonk-version in wonk-tokens.css. Vendored files are not stamped.
function checkVersion() {
  const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
  const bad = [];
  const assetsDir = path.join(ROOT, "assets");
  const assets = fs.readdirSync(assetsDir).filter((f) => /\.(css|js)$/.test(f)).sort();
  for (const f of assets) {
    const src = fs.readFileSync(path.join(assetsDir, f), "utf8");
    const head = src.split("\n").slice(0, 2).join("\n");
    const m = /WONK v(\d+\.\d+\.\d+)/.exec(head);
    if (!m) bad.push(`assets/${f}: no "WONK v${version}" in its first header line`);
    else if (m[1] !== version) bad.push(`assets/${f}: header says v${m[1]}`);
    if (f === "wonk.js") {
      const v = /version: "([^"]*)"/.exec(src);
      if (!v || v[1] !== version) bad.push(`assets/wonk.js: wonk.version is ${v ? `"${v[1]}"` : "missing"}`);
    }
    if (f === "wonk-tokens.css") {
      const v = /--wonk-version:\s*"([^"]*)"/.exec(src);
      if (!v || v[1] !== version) bad.push(`assets/wonk-tokens.css: --wonk-version is ${v ? `"${v[1]}"` : "missing"}`);
    }
  }
  for (const line of bad) console.log(`FAIL version › ${line} (VERSION is ${version})`);
  if (bad.length) process.exit(1);
  console.log(`PASS version › VERSION ${version} matches ${assets.length} asset headers, wonk.version, and --wonk-version`);
}
checkVersion();

// ---- suite selection ----
const filter = process.argv.slice(2);
const unknown = filter.filter((n) => !SUITES.some((s) => s.name === n));
if (unknown.length) {
  console.error(`unknown suite(s): ${unknown.join(", ")}. known: ${SUITES.map((s) => s.name).join(", ")}`);
  process.exit(1);
}
const selected = filter.length ? SUITES.filter((s) => filter.includes(s.name)) : SUITES;

// ---- run one suite ----
async function runSuite(browser, base, suite) {
  const out = { passed: 0, failed: 0, ran: false };
  const page = await browser.newPage({ viewport: VIEWPORT });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.startsWith("Uncaught")) pageErrors.push(new Error(text));
    else console.warn(`WARN ${suite.name} › console.error — ${text}`);
  });
  try {
    if (suite.smoke) {
      await page.goto(base + suite.page, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(SMOKE_SETTLE_MS);
      out.ran = true;
      for (const sel of suite.selectors) {
        const count = await page.locator(sel).count();
        console.log(`${count ? "PASS" : "FAIL"} ${suite.name} › selector ${sel} — ${count ? `${count} found` : "no element matches"}`);
        if (count) out.passed++;
        else out.failed++;
      }
      return out;
    }
    await page.goto(base + suite.page);
    try {
      await page.waitForFunction((g) => !!window[g], suite.global, { timeout: GLOBAL_TIMEOUT_MS });
    } catch (err) {
      console.log(`FAIL ${suite.name} › window.${suite.global} did not appear within ${GLOBAL_TIMEOUT_MS / 1000}s — ${err.message.split("\n")[0]}`);
      return out;
    }
    const summary = await page.evaluate((g) => window[g].run(), suite.global);
    if (!summary || !Array.isArray(summary.results)) {
      console.log(`FAIL ${suite.name} › run() did not return { passed, failed, results } — got ${JSON.stringify(summary)}`);
      return out;
    }
    out.ran = true;
    for (const r of summary.results) {
      console.log(`${r.pass ? "PASS" : "FAIL"} ${suite.name} › ${r.name} — ${r.message}`);
      if (r.pass) out.passed++;
      else out.failed++;
    }
  } finally {
    for (const err of pageErrors) {
      console.log(`FAIL ${suite.name} › uncaught page error — ${err.message}`);
      out.failed++;
    }
    await page.close();
  }
  return out;
}

// ---- main ----
let passed = 0;
let failed = 0;
const couldNotRun = [];
const server = await startServer();
let browser;
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  for (const suite of selected) {
    const pageFile = resolvePath(suite.page);
    if (!pageFile || !fs.existsSync(pageFile)) {
      console.log(`FAIL ${suite.name} › page not found: ${suite.page}`);
      failed++;
      continue;
    }
    let r;
    try {
      r = await runSuite(browser, base, suite);
    } catch (err) {
      console.log(`FAIL ${suite.name} › could not run — ${err.message}`);
      couldNotRun.push(suite.name);
      continue;
    }
    passed += r.passed;
    failed += r.failed;
    if (!r.ran) couldNotRun.push(suite.name);
  }
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`${passed} passed, ${failed} failed`);
if (couldNotRun.length) console.log(`could not run: ${couldNotRun.join(", ")}`);
if (failed > 0 || couldNotRun.length) process.exitCode = 1;
