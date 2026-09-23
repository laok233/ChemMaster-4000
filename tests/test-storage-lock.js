// Verifica della serializzazione multi-tab tramite Web Locks.
// Due finestre condividono storage e lock; la seconda deve venire rifiutata
// invece di sovrascrivere la prima scrittura.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "tavola.html"), "utf8");
const readScript = name => fs.readFileSync(path.join(root, name), "utf8");
const code = ["data.js", "storage.js", "app.js"].map(readScript).join("\n");
const KEY = "chemmaster-4000-v1";
const seed = JSON.stringify({
  version:1, mastery:{}, leitner:{}, due:{},
  quiz:{correct:0,wrong:0,history:[]}, write:{seqBest:0,solved:{}}, wrongZ:[]
});

const values = new Map([[KEY, seed]]);
const storage = {
  get length() { return values.size; },
  key(index) { return [...values.keys()][index] ?? null; },
  getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
  setItem(key, value) { values.set(String(key), String(value)); },
  removeItem(key) { values.delete(String(key)); },
  clear() { values.clear(); }
};

let lockTail = Promise.resolve();
const locks = {
  request(_name, callback) {
    const result = lockTail.then(callback);
    lockTail = result.catch(() => {});
    return result;
  }
};

function makeApp() {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost/tavola.html",
    beforeParse(w) {
      Object.defineProperty(w, "localStorage", { configurable:true, value:storage });
      Object.defineProperty(w.navigator, "locks", { configurable:true, value:locks });
      w.scrollTo = () => {};
      w.alert = () => {};
      w.confirm = () => true;
      w.HTMLElement.prototype.focus = function () {};
    }
  });
  try { dom.window.eval(code + ";globalThis.__run=s=>eval(s);"); }
  catch (error) { errors.push(String(error && error.stack || error)); }
  return { window:dom.window, errors };
}

let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) pass++;
  else { fail++; console.log("FAIL: " + message); }
}

const a = makeApp(), b = makeApp();
ok(a.errors.length === 0 && b.errors.length === 0,
  "inizializzazione delle due finestre senza errori");

const saveA = a.window.__run("addMastery(1,10); save()");
const saveB = b.window.__run("addMastery(1,20); save()");

Promise.all([saveA, saveB]).then(async ([resultA,resultB]) => {
  let disk = JSON.parse(storage.getItem(KEY));
  ok(resultA === true, "prima scheda salva sotto il lock");
  ok(resultB === false, "seconda scheda rifiuta lo snapshot obsoleto");
  ok(disk.mastery["1"] === 10, "la seconda scrittura non annulla la prima");

  // Un reset avviato mentre un salvataggio è ancora in coda deve invalidare
  // quel lock: il callback pre-reset non deve più essere considerato corrente.
  const c = makeApp();
  const staleSave = c.window.__run("addMastery(3,10); save()");
  c.window.__run("document.getElementById('resetAll').onclick()");
  const staleResult = await staleSave;
  await lockTail;
  disk = JSON.parse(storage.getItem(KEY));
  ok(staleResult === false, "reset invalida il salvataggio già in coda");
  ok(!Object.hasOwn(disk.mastery, "1") && !Object.hasOwn(disk.mastery, "3"),
    "il salvataggio finale del reset non contiene dati precedenti");
  ok(c.window.__run("storageSavePending") === 0, "nessun lock resta pendente dopo il reset");

  console.log("Storage lock: " + (fail ? fail + " ERRORI" : "OK (" + pass + "/" + pass + ")"));
  process.exit(fail ? 1 : 0);
});
