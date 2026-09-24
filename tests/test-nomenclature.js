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
  win.eval(dataCode + "\n" + appCode +
    ";globalThis.__nomenclatureData=NOMENCLATURE_CARDS;globalThis.__nomenclatureUpdateIndex=updateNomenclatureIndex;");
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
ok(d.getElementById("nomenclatureStatus").getAttribute("aria-live") === "polite" &&
   !d.getElementById("nomenclatureStatus").classList.contains("sr-only"),
  "conteggio dei risultati annunciato e visibile");
ok(d.querySelectorAll("#nomenclatureContent article").length === 14, "14 schede iniziali",
  String(d.querySelectorAll("#nomenclatureContent article").length));
ok(d.querySelectorAll("#nomenclatureContent details").length === 14, "ogni scheda ha un pannello espandibile");
ok(d.querySelectorAll("#nomenclatureIndex a").length === 14, "indice con un link per ogni scheda");
ok(!d.querySelector("#nomenclatureIndex a[aria-current]"),
  "l'indice non marca una posizione corrente senza un hash reale");
ok([...d.querySelectorAll("#nomenclatureFilters button")].every(button =>
  button.type === "button" && button.hasAttribute("aria-pressed")),
"filtri navigabili da tastiera con stato esposto");
ok(d.querySelectorAll("#nomenclatureContent table caption").length === 6, "tabelle di riferimento presenti");
const cardData = win.__nomenclatureData;
ok(new Set(cardData.map(card => card.id)).size === cardData.length,
  "ID delle schede univoci", cardData.map(card => card.id).join(","));
ok(cardData.every(card => ["inorganic", "organic"].includes(card.area) &&
    (card.traditional===true || card.traditional===undefined)),
  "aree e flag tradizionali validi");
ok(d.querySelectorAll('#nomenclatureContent article[data-traditional="true"]').length === 3 &&
   d.querySelectorAll(".nomenclature-traditional").length === 3,
"tre schede e tre badge per i nomi tradizionali");
ok(d.getElementById("nomenclatureStatus").textContent === "Tutte le 14 schede sono mostrate." &&
   d.getElementById("nomenclatureStatus").dataset.empty === "false",
  "conteggio iniziale dei risultati", d.getElementById("nomenclatureStatus").textContent);

section("Nomenclatura: filtri e ricerca");
const filters = [...d.querySelectorAll("#nomenclatureFilters button")];
const filterById = Object.fromEntries(filters.map(button => [button.dataset.filter, button]));
ok(filters.length === 4, "quattro filtri: tutte, tradizionali, inorganica, organica", String(filters.length));
ok(filters.every((button,index) => button.getAttribute("aria-pressed") === String(index === 0)),
  "filtro iniziale: tutte");
click(filterById.traditional);
ok(visibleCards().length === 3 && visibleCards().every(card => card.dataset.traditional === "true"),
  "il filtro tradizionale mostra le tre schede dedicate", visibleCards().map(card => card.id).join(","));
ok(visibleCards().some(card => card.dataset.area === "inorganic") &&
   visibleCards().some(card => card.dataset.area === "organic") &&
   [...d.querySelectorAll(".nomenclature-index-group")].every(group => !group.hidden),
  "i nomi tradizionali restano collegati a entrambe le aree");
ok(d.getElementById("nomenclatureStatus").textContent === "3 schede mostrate su 14.",
  "conteggio dei nomi tradizionali", d.getElementById("nomenclatureStatus").textContent);
click(filterById.all);
click(filterById.organic);
ok(visibleCards().length === 7 && visibleCards().every(card => card.dataset.area === "organic"),
  "filtro organica mostra solo le schede organiche", visibleCards().length + " schede");
ok(d.querySelector("#nomenclatureIndex [aria-labelledby='nom-index-inorganic']").hidden &&
   !d.querySelector("#nomenclatureIndex [aria-labelledby='nom-index-organic']").hidden,
  "l'indice nasconde il gruppo vuoto dopo il filtro organica");
ok(d.getElementById("nomenclatureStatus").textContent === "7 schede mostrate su 14.",
  "conteggio filtrato", d.getElementById("nomenclatureStatus").textContent);
click(filterById.all);
search("non serve un numero romano");
ok(visibleCards().length === 1 && visibleCards()[0].id === "nom-cationi-anioni",
  "ricerca case-insensitive nei nomi e nelle note", visibleCards().map(card => card.id).join(","));
search("nessun gruppo");
ok(visibleCards().length === 0 && /Nessuna scheda/.test(d.getElementById("nomenclatureStatus").textContent),
  "ricerca senza risultati e stato accessibile", d.getElementById("nomenclatureStatus").textContent);
ok(d.getElementById("nomenclatureStatus").dataset.empty === "true" &&
   [...d.querySelectorAll(".nomenclature-index-group")].every(group => group.hidden),
  "stato vuoto visibile e gruppi dell'indice nascosti");
click(d.getElementById("clearNomenclature"));
search("N2O4");
ok(visibleCards().length === 1 && visibleCards()[0].id === "nom-composti-binari",
  "ricerca normalizzata trova formule con pedici Unicode", visibleCards().map(card => card.id).join(","));
click(d.getElementById("clearNomenclature"));
search("inorganica");
ok(visibleCards().length === 7 && visibleCards().every(card => card.dataset.area === "inorganic"),
  "la ricerca include l'etichetta dell'area", visibleCards().map(card => card.id).join(","));
click(d.getElementById("clearNomenclature"));
search("organica");
ok(visibleCards().length === 7 && visibleCards().every(card => card.dataset.area === "organic"),
  "la ricerca non confonde organica e inorganica", visibleCards().map(card => card.id).join(","));
click(d.getElementById("clearNomenclature"));
ok(d.getElementById("nomenclatureSearch").value === "" && visibleCards().length === 14,
  "Mostra tutte azzera ricerca e filtri");
ok(d.getElementById("clearNomenclature").disabled, "pulsante reset disabilitato quando non serve");

search("fenolo");
ok(visibleCards().length === 1 && visibleCards()[0].id === "nom-alcoli",
  "ricerca di un esempio organico", visibleCards().map(card => card.id).join(","));
const indexVisible = [...d.querySelectorAll("#nomenclatureIndex li")].filter(item => !item.hidden);
ok(indexVisible.length === 1 && !indexVisible[0].querySelector("a").hasAttribute("aria-current"),
  "indice sincronizzato con la ricerca senza un falso aria-current");
ok(d.querySelector("#nomenclatureIndex [aria-labelledby='nom-index-inorganic']").hidden &&
   !d.querySelector("#nomenclatureIndex [aria-labelledby='nom-index-organic']").hidden,
  "indice mostra solo il gruppo con risultati");
click(d.getElementById("clearNomenclature"));
win.history.replaceState(null,"","#nom-compositi-ionici");
win.__nomenclatureUpdateIndex();
ok(d.querySelectorAll('#nomenclatureIndex a[aria-current="location"]').length === 1 &&
   d.querySelector('#nomenclatureIndex a[href="#nom-compositi-ionici"]').getAttribute("aria-current") === "location",
  "aria-current segue la scheda indicata dall'hash");

section("Nomenclatura: schede espandibili");
const firstDetails = d.querySelector("#nom-compositi-ionici details");
firstDetails.open = true;
ok(firstDetails.open && /cloruro di ferro\(III\)/.test(firstDetails.textContent),
  "apertura della scheda e visibilità degli esempi");
ok(d.querySelector("#nom-composti-binari table caption").textContent === "Prefissi per il numero di atomi",
  "tabella dei prefissi renderizzata");
ok(d.querySelector("#nom-suffissi-priorita table th[scope='row']"),
  "intestazioni di riga accessibili nella tabella");
ok(/toluene/.test(d.querySelector("#nom-organici-tradizionali").textContent) &&
   /metilbenzene/.test(d.querySelector("#nom-organici-tradizionali").textContent) &&
   /acido etanoico/.test(d.querySelector("#nom-organici-tradizionali").textContent),
  "confronti tra nomi organici tradizionali e sistematici");
ok(/ossido ferroso/.test(d.querySelector("#nom-metalli-tradizionali").textContent) &&
   /cloruro ferrico/.test(d.querySelector("#nom-metalli-tradizionali").textContent),
  "esempi dei suffissi tradizionali dei metalli");

console.log("\n================ RISULTATO ================");
console.log("PASS: " + pass + "   FAIL: " + fail);
if (failures.length) {
  console.log("\nFallimenti:");
  failures.forEach(failure => console.log("  x " + failure));
}
process.exit(fail ? 1 : 0);
