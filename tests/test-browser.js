// Smoke test browser e audit accessibilità WCAG A/AA con Chromium + axe-core.
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const ROOT = path.join(__dirname, "..");
const MIME = {
  ".css":"text/css; charset=utf-8",
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml"
};

let pass = 0;
const failures = [];
function ok(condition, message, extra) {
  if (condition) pass++;
  else failures.push(message + (extra ? " :: " + extra : ""));
}

function startServer() {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const file = path.resolve(ROOT, relative);
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const body = fs.readFileSync(file);
      response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function formatViolations(results) {
  return results.violations.map(violation => {
    const targets = violation.nodes.slice(0, 3).map(node => node.target.join(" ")).join(", ");
    return `${violation.id} (${violation.impact}): ${violation.help} — ${targets}`;
  }).join("\n");
}

async function assertA11y(page, name) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  ok(results.violations.length === 0, `${name}: nessuna violazione WCAG A/AA`, formatViolations(results));
}

async function main() {
  const server = await startServer();
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") runtimeErrors.push(message.text()); });

  try {
    await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    ok(await page.getByRole("heading", { level: 1 }).textContent() === "⚛ ChemMaster 4000",
      "menu: titolo principale nel browser reale");
    await assertA11y(page, "Menu");

    await page.goto(`${base}/tavola.html`, { waitUntil: "networkidle" });
    ok(await page.locator("#ptable .cell").count() === 118, "tavola: 118 celle renderizzate");
    await assertA11y(page, "Tavola");

    for (const [label, view] of [
      ["Flashcard", "cards"], ["Quiz", "quiz"], ["Scrivi la tavola", "write"],
      ["Progressi", "stats"], ["Tavola", "table"]
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      ok(await page.locator(`#tabs button[data-view="${view}"]`).getAttribute("aria-current") === "true",
        `navigazione: vista ${label} attiva`);
      await assertA11y(page, `Vista ${label}`);
    }
    ok(runtimeErrors.length === 0, "nessun errore JavaScript nel browser", runtimeErrors.join(" | "));
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  console.log(`Browser + axe: ${failures.length ? "ERRORI" : "OK"} (${pass}/${pass + failures.length})`);
  failures.forEach(failure => console.log("FAIL: " + failure));
  process.exit(failures.length ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
