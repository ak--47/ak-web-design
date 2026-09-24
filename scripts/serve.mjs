// ============================================================
// scripts/serve.mjs · local preview of the galleries and template
//
//   npm run serve               http://127.0.0.1:4748
//   PORT=5000 npm run serve     another port
//
// Same server as npm test (scripts/server.mjs). Ctrl-C stops it.
// ============================================================
import { startServer } from "./server.mjs";

const port = Number(process.env.PORT || 4748);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT must be an integer from 1 to 65535, got "${process.env.PORT}"`);
}

const server = await startServer(port);
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`WONK is served at ${base}`);
for (const page of [
  "/demo/index.html",
  "/demo/instruments.html",
  "/demo/workbench.html",
  "/demo/motion.html",
  "/demo/radio.html",
  "/templates/app.html",
]) {
  console.log(`  ${base}${page}`);
}
