"use strict";

// Verifica strutturale dei dati di nomenclatura e dei suoi riferimenti UI/CSS.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const dataCode = fs.readFileSync(path.join(ROOT, "scripts/nomenclature/data.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "pages/nomenclatura.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  dataCode + "\n;globalThis.__out={NOMENCLATURE_FILTERS,NOMENCLATURE_CARDS};",
  sandbox
);
const { NOMENCLATURE_FILTERS: filters, NOMENCLATURE_CARDS: cards } = sandbox.__out;

let failures = 0;
const ok = (condition, message, extra) => {
  if (condition) return;
  failures++;
  console.log(`FAIL: ${message}${extra ? ` :: ${extra}` : ""}`);
};
const isText = value => typeof value === "string" && value.trim() !== "";
const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const formulaKey = formula => String(formula)
  .replace(/[₀-₉]/g, char => String(char.charCodeAt(0) - 0x2080))
  .replace(/[⁰-⁹]/g, char => String(char.charCodeAt(0) - 0x2070))
  .replace(/[–—−]/g, "-")
  .replace(/\s+/g, "")
  .toLowerCase();

ok(Array.isArray(filters) && filters.length === 4, "quattro filtri nomenclatura", String(filters.length));
ok(new Set(filters.map(filter => filter.id)).size === filters.length, "ID filtri univoci");
ok(filters.every(filter => isText(filter.id) && isText(filter.label) && isText(filter.quizLabel)),
  "filtri completi");
ok(Array.isArray(cards) && cards.length === 17, "17 schede nomenclatura", String(cards.length));
ok(new Set(cards.map(card => card.id)).size === cards.length, "ID schede univoci");

const areas = new Set(["inorganic", "organic"]);
const cardIds = new Set();
const canonicalByScope = new Map([
  ["all", new Map()],
  ["traditional", new Map()],
  ["inorganic", new Map()],
  ["organic", new Map()]
]);
for (const card of cards) {
  ok(slug(card.id) && !cardIds.has(card.id), "ID scheda slug e univoco", card.id);
  cardIds.add(card.id);
  ok(areas.has(card.area), "area valida", `${card.id}: ${card.area}`);
  ok(card.traditional === undefined || card.traditional === true,
    "flag tradizionale valido", card.id);
  ok(isText(card.title) && isText(card.topic) && isText(card.summary) && isText(card.rule),
    "campi descrittivi completi", card.id);
  ok(Array.isArray(card.examples) && card.examples.length > 0, "scheda con esempi", card.id);
  const addToScope = (scope, entry) => {
    const key = formulaKey(entry.formula);
    const group = canonicalByScope.get(scope);
    if (!group.has(key)) group.set(key, { formula:entry.formula, names:[] });
    const names = group.get(key).names;
    if (!names.includes(entry.name)) names.push(entry.name);
  };
  for (const example of card.examples || []) {
    ok(isText(example.formula) && isText(example.name) && isText(example.note),
      "esempio nomenclatura completo", `${card.id}: ${JSON.stringify(example)}`);
    addToScope("all", example);
    addToScope(card.area, example);
    if (card.traditional === true) addToScope("traditional", example);
  }
  if (card.table) {
    ok(isText(card.table.caption) && Array.isArray(card.table.headers) && card.table.headers.length > 0,
      "tabella con caption e intestazioni", card.id);
    ok(Array.isArray(card.table.rows) && card.table.rows.length > 0,
      "tabella con righe", card.id);
    const width = card.table.headers?.length;
    ok(card.table.rows?.every(row => Array.isArray(row) && row.length === width),
      "righe tabella allineate alle intestazioni", card.id);
  }
}

const corpus=cards.map(card=>JSON.stringify(card)).join(" ");
[
  ["idruri", /idru/i],
  ["ossidi basici", /ossidi basici/i],
  ["anidridi", /anidrid/i],
  ["idrossidi", /idrossid/i],
  ["ossiacidi", /ossiacid/i],
  ["idracidi", /idracid/i],
  ["sali", /sali|sale/i],
  ["sali ternari", /ternari|ternario/i]
].forEach(([topic,pattern])=>ok(pattern.test(corpus), `contenuto presente: ${topic}`));

for (const [scope, groups] of canonicalByScope) {
  ok(groups.size >= 4, `scope ${scope}: almeno quattro composti canonici`, String(groups.size));
  ok([...groups.values()].every(group => group.names.length >= 1),
    `scope ${scope}: ogni composto ha almeno un nome`, scope);
}
const hydrochloric = cards.flatMap(card => card.examples || [])
  .filter(example => example.name === "acido cloridrico");
ok(hydrochloric.length > 0 && hydrochloric.every(example => example.formula === "HCl(aq)"),
  "acido cloridrico sempre espresso in fase acquosa",
  hydrochloric.map(example => example.formula).join(","));
const hydrogenChlorideGas=cards.flatMap(card => card.examples || [])
  .find(example => example.formula === "HCl(g)");
ok(hydrogenChlorideGas && hydrogenChlorideGas.name === "cloruro di idrogeno" &&
   formulaKey(hydrogenChlorideGas.formula)!==formulaKey("HCl(aq)"),
  "fasi gassosa e acquosa di HCl restano distinte");
const anhydrideCard=cards.find(card => card.id === "anidridi");
const expectedAnhydrides={
  "SO₂":"anidride solforosa",
  "SO₃":"anidride solforica",
  "N₂O₅":"anidride nitrica",
  "CO₂":"anidride carbonica",
  "P₄O₁₀":"anidride fosforica",
  "Cl₂O₇":"anidride perclorica"
};
ok(anhydrideCard && anhydrideCard.area === "inorganic" &&
   Object.entries(expectedAnhydrides).every(([formula,name]) =>
     anhydrideCard.examples.some(example => example.formula === formula && example.name === name)),
  "scheda Anidridi con coppie formula/nome attese");
ok(anhydrideCard?.table?.rows?.length === Object.keys(expectedAnhydrides).length,
  "tabella delle anidridi allineata agli esempi");
const hydrideCard=cards.find(card => card.id === "idruri");
const basicOxideCard=cards.find(card => card.id === "basi-ossidi");
const saltCard=cards.find(card => card.id === "compositi-ionici");
ok(hydrideCard && ["LiH","NaH","CaH₂","AlH₃"].every(formula =>
  hydrideCard.examples.some(example => example.formula === formula)),
  "copertura idruri metallici");
ok(basicOxideCard && ["Na₂O","CaO","FeO","Fe₂O₃"].every(formula =>
  basicOxideCard.examples.some(example => example.formula === formula)),
  "copertura ossidi basici");
ok(saltCard && saltCard.title === "Sali e composti ionici" &&
   ["NaCl","K₂SO₄","Na₂CO₃","NH₄Cl"].every(formula =>
     saltCard.examples.some(example => example.formula === formula)),
  "copertura sali con cationi e anioni");
const ternarySaltCard=cards.find(card => card.id === "sali-ternari");
ok(ternarySaltCard && ["Na₂CO₃","K₂SO₄","CaCO₃","NaNO₃","Ca(NO₃)₂","K₃PO₄"].every(formula =>
  ternarySaltCard.examples.some(example => example.formula === formula)),
  "copertura sali ternari con anioni poliatomici");
const acetic = canonicalByScope.get("all").get(formulaKey("CH₃–COOH"));
ok(acetic && ["acido etanoico", "acido acetico"].every(name => acetic.names.includes(name)),
  "alias acido etanoico/acetico associati allo stesso composto");
// Gli option del quiz sono generati da FILTERS; la pagina conserva solo il select.
ok(html.includes('id="nomenclatureQuizScope"') && !html.includes('value="traditional">Nomi tradizionali</option>'),
  "opzioni quiz non duplicano i dati della guida");
for (const area of areas) {
  ok(new RegExp(`\\.nomenclature-area-${area}\\b`).test(css),
    "stile area nomenclatura presente", area);
}

console.log(`Nomenclatura data: ${failures ? "ERRORI" : "OK"}`);
process.exit(failures ? 1 : 0);
