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
// Only dependency: playwright.
// ============================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- suites: add one line per suite ----
const SUITES = [
  { name: "base",     page: "/demo/index.html",       global: "wonkBaseChecks" },
  { name: "code",     page: "/demo/index.html",       global: "wonkCodeChecks" },
  { name: "controls", page: "/demo/instruments.html", global: "wonkControlsChecks" },
  { name: "motion",   page: "/demo/motion.html",      global: "wonkMotionChecks" },
  { name: "radio",    page: "/demo/radio.html",       global: "wonkRadioChecks" },
  { name: "data",     page: "/demo/index.html",       global: "wonkDataChecks" },
];

const GLOBAL_TIMEOUT_MS = 15000;
const VIEWPORT = { width: 1280, height: 900 };

// ---- static server ----
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function resolvePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const file = path.resolve(ROOT, "." + decoded);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  return file;
}

// Parses a single "bytes=start-end" range. Returns {start, end},
// "unsatisfiable", or null (no usable range: serve the whole file).
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start;
  let end;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

function handle(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const { pathname } = new URL(req.url, "http://localhost");
  let file = resolvePath(pathname);
  if (!file) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let stat;
  try {
    stat = fs.statSync(file);
    if (stat.isDirectory()) {
      file = path.join(file, "index.html");
      stat = fs.statSync(file);
    }
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  const headers = {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
  const range = parseRange(req.headers.range, stat.size);
  if (range === "unsatisfiable") {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${stat.size}` }).end();
    return;
  }
  let status = 200;
  let streamOpts = {};
  if (range) {
    status = 206;
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${stat.size}`;
    headers["Content-Length"] = range.end - range.start + 1;
    streamOpts = { start: range.start, end: range.end };
  } else {
    headers["Content-Length"] = stat.size;
  }
  res.writeHead(status, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(file, streamOpts).pipe(res);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

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
      console.log(`SKIP ${suite.name} › ${suite.page} does not exist`);
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
