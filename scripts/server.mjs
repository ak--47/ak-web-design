// ============================================================
// scripts/server.mjs · static file server for the repo root
//
// Shared by scripts/check.mjs (random port, headless checks) and
// scripts/serve.mjs (npm run serve, fixed port, local preview).
// Correct Content-Type per extension, Range requests (206) for media
// seeking, no caching, and no path may escape the repo root.
// No dependencies.
// ============================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

export function resolvePath(urlPath) {
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

// port 0 picks a free port; read it back with server.address().port
export function startServer(port = 0, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
