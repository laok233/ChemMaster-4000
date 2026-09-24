// Verifica IndexedDB: migrazione, CAS multi-finestra e timeout del bootstrap.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { IDBFactory } = require("fake-indexeddb");
const { APP_SCRIPTS } = require("./helpers/app-scripts");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "pages/tavola.html"), "utf8");
const readScript = name => fs.readFileSync(path.join(root, name), "utf8");
const code = APP_SCRIPTS.map(readScript).join("\n");
const KEY = "chemmaster-4000-v1";
const seed = JSON.stringify({
  version:1, mastery:{1:42}, leitner:{}, due:{},
  quiz:{correct:0,wrong:0,history:[]}, write:{seqBest:0,solved:{}}, wrongZ:[]
});

let pass = 0, fail = 0;
const failures = [];
function ok(condition, message, extra) {
  if (condition) pass++;
  else failures.push(message + (extra ? " :: " + extra : ""));
}

async function makeApp(factory, localSeed) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost/pages/tavola.html",
    beforeParse(window) {
      Object.defineProperty(window, "indexedDB", { configurable:true, value:factory });
      window.scrollTo = () => {};
      window.alert = () => {};
      window.confirm = () => true;
      window.HTMLElement.prototype.focus = function () {};
      if (localSeed) window.localStorage.setItem(KEY, localSeed);
    }
  });
  try {
    dom.window.eval(code + ";globalThis.__run=s=>eval(s);");
    await dom.window.__appReadyPromise;
  } catch (error) {
    errors.push(String(error && error.stack || error));
  }
  dom.window.__errors = errors;
  return dom.window;
}

async function main() {
  const factory = new IDBFactory();
  const a = await makeApp(factory, seed);
  ok(a.__errors.length === 0, "prima finestra IndexedDB inizializzata senza errori", a.__errors.join(" | "));
  ok(a.__run("storageBackend") === "indexeddb", "backend primario IndexedDB");
  ok(a.localStorage.getItem(KEY) === null, "backup locale rimosso dopo la migrazione");
  ok(a.__run("mastery(1)") === 42, "stato legacy migrato in IndexedDB");

  const b = await makeApp(factory);
  ok(b.__errors.length === 0, "seconda finestra IndexedDB inizializzata senza errori", b.__errors.join(" | "));
  ok(b.__run("mastery(1)") === 42, "seconda finestra legge lo stesso database");
  ok(a.__run("decodeStoredState(0).issue") && a.__run("decodeStoredState(false).issue"),
    "record IndexedDB con raw falsi vengono rifiutati", JSON.stringify(a.__run("[decodeStoredState(0),decodeStoredState(false)]")));

  const saveA = a.__run("addMastery(1,10); save()");
  const saveB = b.__run("addMastery(1,20); save()");
  const [resultA, resultB] = await Promise.all([saveA, saveB]);
  ok(resultA === true, "prima scrittura IndexedDB salvata", String(resultA));
  ok(resultB === false, "seconda scrittura con baseline obsoleto rifiutata", String(resultB));
  ok(a.__run("mastery(1)") === 52, "stato della prima finestra conservato");
  ok(b.__run("mastery(1)") === 62, "stato locale della seconda finestra non sovrascritto");

  const rapidA = a.__run("addMastery(1,1); save()");
  const rapidB = a.__run("addMastery(1,1); save()");
  const [rapidResultA,rapidResultB] = await Promise.all([rapidA,rapidB]);
  ok(rapidResultA === true && rapidResultB === true,
    "salvataggi rapidi della stessa scheda serializzati senza falsi conflitti",
    `${rapidResultA}/${rapidResultB}`);
  ok(a.__run("mastery(1)") === 54, "entrambi i salvataggi rapidi applicati");
  ok(a.__run("storageSavePending") === 0 && b.__run("storageSavePending") === 0,
    "nessuna transazione IndexedDB resta pendente");

  /* bootstrap: un open() che non completa non può lasciare l'app invisibile */
  Object.defineProperty(a, "indexedDB", {
    configurable:true,
    value:{ open(){ return {}; } }
  });
  const timeoutStarted=Date.now();
  const timedOut=await a.__run(
    'createProgressStore("timeout-test",{dbName:"timeout-db",initTimeoutMs:20}).init()');
  ok(timedOut.backend==="localstorage" && /scaduta/.test(timedOut.error.message) &&
    Date.now()-timeoutStarted<250,
    "init: open IndexedDB pendente scade e attiva il fallback", timedOut.error?.message);

  /* una risposta tardiva dell'open deve chiudere il database, non riaprirlo */
  let lateCloses=0;
  Object.defineProperty(a, "indexedDB", {
    configurable:true,
    value:{
      open(){
        const request={};
        setTimeout(()=>{
          request.result={close(){ lateCloses++; }};
          request.onsuccess?.();
        },40);
        return request;
      }
    }
  });
  await a.__run(
    'createProgressStore("late-timeout-test",{dbName:"late-timeout-db",initTimeoutMs:20}).init()');
  await new Promise(resolve => setTimeout(resolve,60));
  ok(lateCloses===1,
    "init: il database aperto dopo il timeout viene chiuso", String(lateCloses));

  console.log(`IndexedDB: ${fail ? "ERRORI" : "OK"} (${pass}/${pass + failures.length})`);
  failures.forEach(failure => console.log("FAIL: " + failure));
  process.exit(fail ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });
