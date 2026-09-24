// Smoke test browser e audit accessibilità WCAG A/AA con Chromium + axe-core.
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const ROOT = path.join(__dirname, "..");
const REAL_ROOT = fs.realpathSync(ROOT);
const KEY = "chemmaster-4000-v1";
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
      // Il controllo lessicale da solo seguirebbe anche un symlink verso
      // l'esterno del repository: validare anche il percorso reale.
      const realFile = fs.realpathSync(file);
      if (realFile !== REAL_ROOT && !realFile.startsWith(REAL_ROOT + path.sep)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const body = fs.readFileSync(realFile);
      response.writeHead(200, { "Content-Type": MIME[path.extname(realFile)] || "application/octet-stream" });
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
  const watchRuntimeErrors = target => {
    target.on("pageerror", error => runtimeErrors.push(error.message));
    target.on("console", message => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  };
  watchRuntimeErrors(page);

  try {
    await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    ok(await page.getByRole("heading", { level: 1 }).textContent() === "⚛ ChemMaster 4000",
      "menu: titolo principale nel browser reale");
    await page.keyboard.press("Tab");
    const visibleSkipLink=await page.locator(".skip-link").evaluate(element =>
      element===element.ownerDocument.activeElement && element.getBoundingClientRect().width>1);
    await page.keyboard.press("Enter");
    const mainFocused=await page.evaluate(() => globalThis.document.activeElement?.id==="main-content");
    ok(visibleSkipLink && mainFocused, "menu: skip link visibile al primo Tab e focus sul contenuto");
    await assertA11y(page, "Menu");

    await page.locator('a.tile[href="pages/tavola.html"]').click();
    ok(new URL(page.url()).pathname === "/pages/tavola.html",
      "menu: collegamento alla tavola dal nuovo percorso");
    await page.locator('header a[href="../index.html"]').click();
    ok(new URL(page.url()).pathname === "/index.html",
      "tavola: collegamento relativo al menu");
    await page.locator('a.tile[href="pages/nomenclatura.html"]').click();
    ok(new URL(page.url()).pathname === "/pages/nomenclatura.html",
      "menu: collegamento alla nomenclatura dal nuovo percorso");
    await page.waitForLoadState("networkidle");
    ok(await page.locator("#nomenclatureContent article").count() === 14,
      "nomenclatura: 14 schede renderizzate");
    const nomenclatureIndexLink=page.locator('#nomenclatureIndex a[href="#nom-composti-binari"]');
    await nomenclatureIndexLink.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => globalThis.document.activeElement?.id === "nom-composti-binari");
    ok(true, "nomenclatura: il link dell'indice sposta il focus sulla card");
    await page.locator('#nomenclatureFilters [data-filter="traditional"]').click();
    ok(await page.locator('#nomenclatureContent article:not([hidden])[data-traditional="true"]').count() === 3 &&
      await page.locator(".nomenclature-traditional:visible").count() === 3,
    "nomenclatura: filtro dei nomi tradizionali nel browser reale");
    await assertA11y(page, "Nomenclatura tradizionale");
    await page.locator("#clearNomenclature").click();
    await page.locator('#nomenclatureFilters [data-filter="organic"]').click();
    ok(await page.locator("#nomenclatureContent article:not([hidden])").count() === 7,
      "nomenclatura: filtro organica funziona nel browser reale");
    await page.locator("#clearNomenclature").click();
    await page.locator("#nomenclatureSearch").fill("N2O4");
    ok(await page.locator("#nomenclatureContent article:not([hidden])").count() === 1 &&
      await page.locator("#nomenclatureContent article:not([hidden])").getAttribute("id") === "nom-composti-binari",
    "nomenclatura: ricerca normalizzata nel browser reale");
    await page.locator("#nomenclatureSearch").fill("nessun risultato");
    ok(await page.locator("#nomenclatureContent article:not([hidden])").count() === 0 &&
      await page.locator("#nomenclatureStatus").isVisible() &&
      await page.locator(".nomenclature-index-group:visible").count() === 0,
    "nomenclatura: stato vuoto visibile e indice senza gruppi vuoti");
    await assertA11y(page, "Nomenclatura senza risultati");
    await page.locator("#clearNomenclature").click();
    await page.setViewportSize({ width:320, height:568 });
    await page.locator("#nom-composti-binari details").evaluate(element => { element.open = true; });
    const nomenclatureTableWrap=page.locator("#nom-composti-binari .nomenclature-table-wrap");
    await nomenclatureTableWrap.focus();
    await page.keyboard.press("ArrowRight");
    const narrowNomenclature=await nomenclatureTableWrap.evaluate(element => ({
      focused:element===element.ownerDocument.activeElement,
      clientWidth:element.clientWidth,
      scrollWidth:element.scrollWidth,
      scrollLeft:element.scrollLeft,
      documentWidth:element.ownerDocument.documentElement.scrollWidth,
      viewport:element.ownerDocument.defaultView.innerWidth
    }));
    ok(narrowNomenclature.focused && narrowNomenclature.scrollWidth>narrowNomenclature.clientWidth &&
      narrowNomenclature.documentWidth===narrowNomenclature.viewport,
    "nomenclatura stretta: tabella regionale focalizzabile e senza overflow pagina",
    JSON.stringify(narrowNomenclature));
    await page.setViewportSize({ width:1280, height:720 });
    await page.locator('#nomenclatureTabs [data-nomenclature-view="quiz"]').click();
    ok(await page.locator("#nomenclatureQuizView").isVisible() &&
      await page.locator("#nomenclatureGuideView").isHidden() &&
      await page.locator('#nomenclatureTabs [data-nomenclature-view="quiz"]').getAttribute("aria-current") === "true",
    "nomenclatura: Quiz aperto dalla barra superiore");
    await page.locator("#nomenclatureQuizStart").click();
    ok(await page.locator("#nomenclatureQuizStage").isVisible() &&
      await page.locator("#nomenclatureQuizOptions .opt").count() === 5,
    "nomenclatura: quiz avviato con 4 alternative e Non so");
    await page.locator("#nomenclatureQuizOptions .opt").first().click();
    ok(await page.locator("#nomenclatureQuizFeedback").isVisible() &&
      await page.locator("#nomenclatureQuizNext").isVisible(),
    "nomenclatura: feedback e controllo successivo mostrati dopo la risposta");
    await page.locator("#nomenclatureQuizNext").click();
    await page.locator("#nomenclatureQuizEnd").click();
    ok(await page.locator("#nomenclatureQuizDone").isVisible() &&
      /risposte corrette/.test(await page.locator("#nomenclatureQuizSummary").textContent()),
    "nomenclatura: riepilogo del quiz completato nel browser reale");
    await assertA11y(page, "Quiz nomenclatura");
    await page.locator("#nomenclatureQuizAgain").click();
    ok(await page.locator("#nomenclatureQuizSetup").isVisible(),
      "nomenclatura: nuovo quiz torna alla configurazione");
    await page.locator('#nomenclatureTabs [data-nomenclature-view="guide"]').click();
    ok(await page.locator("#nomenclatureGuideView").isVisible() &&
      await page.locator("#nomenclatureQuizView").isHidden(),
    "nomenclatura: Guida aperta dalla barra superiore");
    await assertA11y(page, "Nomenclatura");

    await page.goto(`${base}/pages/tavola.html`, { waitUntil: "networkidle" });
    ok(await page.evaluate(() => eval("storageBackend")) === "indexeddb", "browser: IndexedDB selezionato come backend");
    ok(await page.evaluate(key => localStorage.getItem(key), KEY) === null, "browser: nessun backup localStorage residuo");
    ok(await page.locator("#ptable .cell").count() === 118, "tavola: 118 celle renderizzate");
    await page.locator("#searchEl").fill("fer");
    ok(await page.locator('#ptable .cell[data-z="2"]').getAttribute("tabindex") === "-1" &&
       await page.locator('#ptable .cell[data-z="26"]').getAttribute("tabindex") === "0",
    "browser: il filtro della tavola esclude le celle non corrispondenti dal tab order");
    await page.locator("#clearFilter").click();
    await page.getByRole("button", { name:"Scrivi la tavola", exact:true }).click();
    await page.locator('#wtable .cell[data-z="1"]').click();
    await page.locator("#wCellInput").fill("H");
    await page.locator("#wCellInput").press("Enter");
    ok(await page.locator("#wCellInput").evaluate(element =>
      element.ownerDocument.activeElement?.dataset.z==="2"),
    "browser: la risposta corretta porta il focus alla prossima casella");
    await page.getByRole("button", { name:"Tavola", exact:true }).click();
    const reducedMotionCell = page.locator("#ptable .cell").first();
    await reducedMotionCell.hover();
    ok(await reducedMotionCell.evaluate(element =>
      element.ownerDocument.defaultView.getComputedStyle(element).transform === "none"),
    "motion ridotto: l'hover non applica trasformazioni immediate");

    const secondPage = await context.newPage();
    watchRuntimeErrors(secondPage);
    await secondPage.goto(`${base}/pages/tavola.html`, { waitUntil: "networkidle" });
    const syncMasteryBefore=await page.evaluate(() => eval("mastery(1)"));
    await page.evaluate(() => eval("addMastery(1,10); save()"));
    await secondPage.waitForFunction(expected => eval("mastery(1)") === expected,
      syncMasteryBefore + 10, { timeout:5000 });
    ok(true, "browser: BroadcastChannel sincronizza due schede IndexedDB");
    await secondPage.close();
    await assertA11y(page, "Tavola");

    await page.setViewportSize({ width:320, height:568 });
    const narrowTable = await page.evaluate(() => {
      const wrap = globalThis.document.querySelector("#view-table .table-wrap");
      return {
        viewport: globalThis.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
        clientWidth: wrap.clientWidth,
        contentWidth: wrap.scrollWidth
      };
    });
    ok(narrowTable.documentWidth === narrowTable.viewport,
      "tavola stretta: nessun overflow della pagina", JSON.stringify(narrowTable));
    ok(narrowTable.contentWidth > narrowTable.clientWidth,
      "tavola stretta: la tabella scorre dentro il proprio contenitore", JSON.stringify(narrowTable));
    await page.setViewportSize({ width:1280, height:720 });

    for (const [label, view] of [
      ["Flashcard", "cards"], ["Quiz", "quiz"], ["Scrivi la tavola", "write"],
      ["Progressi", "stats"], ["Tavola", "table"]
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      ok(await page.locator(`#tabs button[data-view="${view}"]`).getAttribute("aria-current") === "true",
        `navigazione: vista ${label} attiva`);
      await assertA11y(page, `Vista ${label}`);
    }

    const offlineNomenclaturePage = await context.newPage();
    watchRuntimeErrors(offlineNomenclaturePage);
    await offlineNomenclaturePage.goto(pathToFileURL(path.join(ROOT, "pages", "nomenclatura.html")).href);
    await offlineNomenclaturePage.waitForFunction(() => globalThis.__nomenclatureReady === true, null,
      { timeout:10000 });
    ok(await offlineNomenclaturePage.locator("#nomenclatureContent article").count() === 14,
      "nomenclatura: apertura file:// senza server e asset riorganizzati");
    await offlineNomenclaturePage.close();

    const offlinePage = await context.newPage();
    watchRuntimeErrors(offlinePage);
    await offlinePage.goto(pathToFileURL(path.join(ROOT, "pages/tavola.html")).href);
    await offlinePage.waitForFunction(
      () => !globalThis.document.documentElement.hasAttribute("data-storage-state"),
      null,
      { timeout:10000 }
    );
    await offlinePage.evaluate(() => globalThis.__appReadyPromise);
    ok(await offlinePage.locator("#ptable .cell").count() === 118,
      "tavola: apertura file:// senza server e bootstrap completato");
    await offlinePage.close();

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
