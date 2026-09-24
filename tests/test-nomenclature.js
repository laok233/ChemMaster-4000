// Test della guida di nomenclatura: struttura, dati, ricerca e filtri.
// Esecuzione: bun tests/test-nomenclature.js
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "nomenclatura.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const dataCode = fs.readFileSync(path.join(ROOT, "nomenclatura-data.js"), "utf8");
const appCode = fs.readFileSync(path.join(ROOT, "nomenclatura.js"), "utf8");
const testHtml = html.replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`);

let pass = 0;
let fail = 0;
const failures = [];
function ok(condition, message, extra) {
  if (condition) pass++;
  else { fail++; failures.push(message + (extra ? " :: " + extra : "")); }
}
function section(title) { console.log("== " + title + " =="); }

const dom = new JSDOM(testHtml, {
  runScripts: "outside-only",
  url: "http://localhost/nomenclatura.html"
});
const win = dom.window;
const d = win.document;
const errors = [];
try {
  win.scrollTo = () => {};
  win.HTMLElement.prototype.focus = function () {};
  win.eval(dataCode + "\n" + appCode);
} catch (error) {
  errors.push(String(error && error.stack || error));
}

const visibleCards = () => [...d.querySelectorAll("#nomenclatureContent article")].filter(card => !card.hidden);
const search = value => {
  const input = d.getElementById("nomenclatureSearch");
  input.value = value;
  input.dispatchEvent(new win.Event("input", { bubbles: true }));
};
const click = element => element.dispatchEvent(new win.MouseEvent("click", {
  bubbles: true,
  cancelable: true
}));

section("Nomenclatura: struttura e contenuti");
ok(errors.length === 0, "pagina senza errori JavaScript", errors.join(" | "));
ok(d.documentElement.lang === "it", "pagina dichiara lang=it");
ok(/Nomenclatura chimica/.test(d.title), "titolo della pagina", d.title);
ok(html.includes('<link rel="stylesheet" href="style.css">') && !html.includes("<style>"),
  "CSS esterno senza stili inline");
const scriptSources = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
ok(JSON.stringify(scriptSources) === JSON.stringify(["nomenclatura-data.js", "nomenclatura.js"]) &&
  !html.includes("<script>"), "script esterni separati e caricati nell'ordine", scriptSources.join(","));
ok(!!d.querySelector('a[href="index.html"]') && /Menu/.test(d.querySelector('a[href="index.html"]').textContent),
  "link al menu presente");
ok(!d.getElementById("nomenclatureSearch").hasAttribute("aria-label"),
  "il campo di ricerca ha un'etichetta visibile associata");
ok(d.querySelector("label.nomenclature-search-label #nomenclatureSearch"), "etichetta del campo di ricerca");
ok(d.getElementById("nomenclatureStatus").getAttribute("aria-live") === "polite",
  "stato dei risultati annunciato");
ok(d.querySelectorAll("#nomenclatureContent article").length === 11, "11 schede iniziali",
  String(d.querySelectorAll("#nomenclatureContent article").length));
ok(d.querySelectorAll("#nomenclatureContent details").length === 11, "ogni scheda ha un pannello espandibile");
ok(d.querySelectorAll("#nomenclatureIndex a").length === 11, "indice con un link per ogni scheda");
ok([...d.querySelectorAll("#nomenclatureFilters button")].every(button =>
  button.type === "button" && button.hasAttribute("aria-pressed")),
"filtri navigabili da tastiera con stato esposto");
ok(d.querySelectorAll("#nomenclatureContent table caption").length === 4, "tabelle di riferimento presenti");

section("Nomenclatura: filtri e ricerca");
const filters = [...d.querySelectorAll("#nomenclatureFilters button")];
ok(filters.length === 3, "tre filtri: tutte, inorganica, organica", String(filters.length));
ok(filters[0].getAttribute("aria-pressed") === "true" && filters[1].getAttribute("aria-pressed") === "false" &&
  filters[2].getAttribute("aria-pressed") === "false", "filtro iniziale: tutte");
click(filters[2]);
ok(visibleCards().length === 6 && visibleCards().every(card => card.dataset.area === "organic"),
  "filtro organica mostra solo le schede organiche", visibleCards().length + " schede");
ok(d.getElementById("nomenclatureStatus").textContent === "6 schede mostrate su 11.",
  "conteggio filtrato", d.getElementById("nomenclatureStatus").textContent);
click(filters[0]);
search("non serve un numero romano");
ok(visibleCards().length === 1 && visibleCards()[0].id === "nom-cationi-anioni",
  "ricerca case-insensitive nei nomi e nelle note", visibleCards().map(card => card.id).join(","));
search("nessun gruppo");
ok(visibleCards().length === 0 && /Nessuna scheda/.test(d.getElementById("nomenclatureStatus").textContent),
  "ricerca senza risultati e stato accessibile", d.getElementById("nomenclatureStatus").textContent);
click(d.getElementById("clearNomenclature"));
ok(d.getElementById("nomenclatureSearch").value === "" && visibleCards().length === 11,
  "Mostra tutte azzera ricerca e filtri");
ok(d.getElementById("clearNomenclature").disabled, "pulsante reset disabilitato quando non serve");

search("fenolo");
ok(visibleCards().length === 1 && visibleCards()[0].id === "nom-alcoli",
  "ricerca di un esempio organico", visibleCards().map(card => card.id).join(","));
const indexVisible = [...d.querySelectorAll("#nomenclatureIndex li")].filter(item => !item.hidden);
ok(indexVisible.length === 1 && indexVisible[0].querySelector("a").getAttribute("aria-current") === "location",
  "indice sincronizzato con la ricerca");
click(d.getElementById("clearNomenclature"));

section("Nomenclatura: schede espandibili");
const firstDetails = d.querySelector("#nom-compositi-ionici details");
firstDetails.open = true;
ok(firstDetails.open && /cloruro di ferro\(III\)/.test(firstDetails.textContent),
  "apertura della scheda e visibilità degli esempi");
ok(d.querySelector("#nom-composti-binari table caption").textContent === "Prefissi per il numero di atomi",
  "tabella dei prefissi renderizzata");
ok(d.querySelector("#nom-suffissi-priorita table th[scope='row']"),
  "intestazioni di riga accessibili nella tabella");

console.log("\n================ RISULTATO ================");
console.log("PASS: " + pass + "   FAIL: " + fail);
if (failures.length) {
  console.log("\nFallimenti:");
  failures.forEach(failure => console.log("  x " + failure));
}
process.exit(fail ? 1 : 0);
