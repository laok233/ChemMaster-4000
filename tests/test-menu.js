// Test del menu principale (hub multipagina): struttura e link, nessuno script.
// Esecuzione: bun tests/test-menu.js
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg, extra) {
  if (cond) pass++;
  else { fail++; failures.push(msg + (extra ? " :: " + extra : "")); }
}
function section(t) { console.log("== " + t + " =="); }

const MENU = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(MENU, "utf8");
const d = new JSDOM(html, { url: "http://localhost/index.html" }).window.document;

/* ================= STRUTTURA ================= */
section("Menu: struttura");
ok(/ChemMaster 4000/.test(d.title), "titolo della pagina menu", d.title);
ok(html.includes('lang="it"'), "pagina dichiara lang=it");
const h1 = d.querySelector("header h1");
ok(!!h1 && /ChemMaster\s*4000/.test(h1.textContent.replace(/\s+/g, " ")),
  "h1 con il nome del progetto", h1 && h1.textContent);
ok(/Piattaforma di studio della chimica/.test(d.body.textContent), "sottotitolo piattaforma");

/* ================= TESSERE ================= */
section("Menu: tessere");
const tiles = d.querySelectorAll("a.tile");
ok(tiles.length === 1, "1 funzione disponibile per ora (ottenute " + tiles.length + ")", String(tiles.length));
const tav = d.querySelector('a.tile[href="tavola.html"]');
ok(!!tav, "tessera 'Tavola periodica' che punta a tavola.html");
ok(!!tav && /Tavola periodica/i.test(tav.textContent), "nome della funzione nella tessera",
  tav && tav.textContent.replace(/\s+/g, " ").trim());

/* ================= LINK ================= */
section("Menu: link");
const links = [...d.querySelectorAll('a[href$=".html"]')];
ok(links.length >= 1, "almeno un link a una pagina", String(links.length));
links.forEach(a => {
  const target = a.getAttribute("href").split("#")[0];
  ok(fs.existsSync(path.join(__dirname, "..", target)), "link esistente: " + target);
});

console.log("\n================ RISULTATO ================");
console.log("PASS: " + pass + "   FAIL: " + fail);
if (failures.length) { console.log("\nFallimenti:"); failures.forEach(f => console.log("  x " + f)); }
process.exit(fail ? 1 : 0);
