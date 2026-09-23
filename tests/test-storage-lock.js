// Verifica della serializzazione multi-tab tramite Web Locks.
// Due finestre condividono storage e lock; la seconda deve venire rifiutata
// invece di sovrascrivere la prima scrittura.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "tavola.html"), "utf8");
const readScript = name => fs.readFileSync(path.join(root, name), "utf8");
const code = ["data.js", "storage-backend.js", "storage.js", "app.js"].map(readScript).join("\n");
const KEY = "chemmaster-4000-v1";
const seed = JSON.stringify({
  version:1, mastery:{}, leitner:{}, due:{},
  quiz:{correct:0,wrong:0,history:[]}, write:{seqBest:0,solved:{}}, wrongZ:[]
});

const values = new Map([[KEY, seed]]);
let localWrites = 0;
const storage = {
  get length() { return values.size; },
  key(index) { return [...values.keys()][index] ?? null; },
  getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
  setItem(key, value) { localWrites++; values.set(String(key), String(value)); },
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

async function makeApp() {
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
  try {
    dom.window.eval(code + ";globalThis.__run=s=>eval(s);");
    await dom.window.__appReadyPromise;
  } catch (error) { errors.push(String(error && error.stack || error)); }
  return { window:dom.window, errors };
}

let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) pass++;
  else { fail++; console.log("FAIL: " + message); }
}

async function main(){
  const a = await makeApp(), b = await makeApp();
  ok(a.errors.length === 0 && b.errors.length === 0,
    "inizializzazione delle due finestre senza errori");

  const saveA = a.window.__run("addMastery(1,10); save()");
  const saveB = b.window.__run("addMastery(1,20); save()");

  const [resultA,resultB] = await Promise.all([saveA,saveB]);
  let disk = JSON.parse(storage.getItem(KEY));
  ok(resultA === true, "prima scheda salva sotto il lock");
  ok(resultB === false, "seconda scheda rifiuta lo snapshot obsoleto");
  ok(disk.mastery["1"] === 10, "la seconda scrittura non annulla la prima");

  const replacement = JSON.stringify({
    version:1, mastery:{1:77}, leitner:{}, due:{},
    quiz:{correct:0,wrong:0,history:[]}, write:{seqBest:0,solved:{}}, wrongZ:[]
  });
  const imported = await b.window.__run(`applyImportedState(${JSON.stringify(replacement)})`);
  ok(imported===true, "import esplicito dopo conflitto viene persistito", String(imported));
  ok(JSON.parse(storage.getItem(KEY)).mastery["1"]===77,
    "l'import esplicito aggiorna il baseline invece di fallire sul conflitto");

  const reloadWindow = await makeApp();
  const reloadPromise = reloadWindow.window.__run(`
    storageDirty=true;
    globalThis.__reloadReadStarted=new Promise(resolve=>{globalThis.__markReloadRead=resolve});
    globalThis.__reloadReadGate=new Promise(resolve=>{globalThis.__releaseReloadRead=resolve});
    progressStore.read=()=>{
      globalThis.__markReloadRead();
      return globalThis.__reloadReadGate.then(()=>localStorage.getItem(${JSON.stringify(KEY)}));
    };
    reloadFromDisk()
  `);
  await reloadWindow.window.__reloadReadStarted;
  const remoteReload = JSON.stringify({
    version:1, mastery:{1:88}, leitner:{}, due:{},
    quiz:{correct:0,wrong:0,history:[]}, write:{seqBest:0,solved:{}}, wrongZ:[]
  });
  values.set(KEY, remoteReload);
  reloadWindow.window.__run(`globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteReload)},storageArea:null}))`);
  reloadWindow.window.__releaseReloadRead();
  await reloadPromise;
  ok(reloadWindow.window.__run("mastery(1)")===77,
    "reload annullato da un annuncio remoto avvenuto durante la lettura", reloadWindow.window.__run("JSON.stringify(state)"));
  ok(reloadWindow.window.__run("storageConflict")===true,
    "l'annuncio durante reload conserva il conflitto invece di applicare uno snapshot stale");

  // L'azzeramento della sola griglia non deve sostituire lo stato completo:
  // una scheda stale deve ricevere un conflitto, non sovrascrivere la scrittura remota.
  const gridA = await makeApp(), gridB = await makeApp();
  const remoteGridSave = gridB.window.__run("addMastery(3,50); save()");
  ok(await remoteGridSave===true, "la seconda scheda salva un aggiornamento remoto");
  gridA.window.__run("state.write.solved={1:1}");
  gridA.window.document.getElementById("wReset").dispatchEvent(new gridA.window.MouseEvent("click", { bubbles:true, cancelable:true }));
  await new Promise(resolve=>setTimeout(resolve,0));
  await lockTail;
  const gridDisk = JSON.parse(storage.getItem(KEY));
  ok(gridDisk.mastery["3"]===50, "azzeramento griglia non sovrascrive il mastery remoto", JSON.stringify(gridDisk.mastery));
  ok(gridA.window.__run("storageConflict")===true,
    "azzeramento griglia stale segnala il conflitto senza perdere i dati locali");

  // Un reset avviato mentre un salvataggio è ancora in coda deve invalidare
  // quel lock: il callback pre-reset non deve più essere considerato corrente.
  const c = await makeApp();
  const staleSave = c.window.__run("addMastery(3,10); save()");
  c.window.__run("document.getElementById('resetAll').onclick()");
  const staleResult = await staleSave;
  await lockTail;
  await new Promise(resolve=>setTimeout(resolve,0));
  disk = JSON.parse(storage.getItem(KEY));
  ok(staleResult === false, "reset invalida il salvataggio già in coda");
  ok(!Object.hasOwn(disk.mastery, "1") && !Object.hasOwn(disk.mastery, "3"),
    "il salvataggio finale del reset non contiene dati precedenti");
  ok(c.window.__run("storageSavePending") === 0, "nessun lock resta pendente dopo il reset");

  // Un'azione successiva durante una transazione non deve essere dichiarata
  // pulita dal completamento della vecchia scrittura.
  const inFlightSave = c.window.__run(`
    globalThis.__saveGate=new Promise(resolve=>{globalThis.__releaseSave=resolve});
    globalThis.__saveStarted=new Promise(resolve=>{globalThis.__markSaveStarted=resolve});
    globalThis.__compareAndSetCalls=0;
    progressStore.compareAndSet=(expected,raw)=>{
      globalThis.__compareAndSetCalls++;
      globalThis.__markSaveStarted();
      return globalThis.__saveGate.then(()=>({ok:true,current:raw}));
    };
    addMastery(4,1); save()
  `);
  await c.window.__saveStarted;
  const newerSave = c.window.__run("addMastery(4,1); save()");
  ok(c.window.__run("storageDirty") === true,
    "una modifica avvenuta durante una scrittura resta dirty finché non viene salvata");
  c.window.__releaseSave();
  const inFlightResults = await Promise.all([inFlightSave,newerSave]);
  ok(inFlightResults.every(result=>result===true), "scrittura vecchia e nuova entrambe risolte", JSON.stringify(inFlightResults));
  ok(c.window.__run("__compareAndSetCalls") === 2,
    "la modifica successiva esegue una seconda transazione necessaria", c.window.__run("__compareAndSetCalls"));
  ok(c.window.__run("storageBaseline") === c.window.__run("JSON.stringify(state)") &&
     c.window.__run("storageDirty") === false,
    "al termine il baseline riflette lo stato più recente");

  // Due save() sincroni sono già coperti dal primo snapshot: una sola scrittura.
  const d = await makeApp();
  const writesBefore = localWrites;
  const rapidA = d.window.__run("addMastery(5,1); save()");
  const rapidB = d.window.__run("addMastery(5,1); save()");
  const rapidResults = await Promise.all([rapidA,rapidB]);
  ok(rapidResults.every(result=>result===true), "salvataggi rapidi compatibili risolti entrambi", JSON.stringify(rapidResults));
  ok(localWrites===writesBefore+1, "salvataggi rapidi già inclusi nello snapshot scrivono una sola volta", `${localWrites-writesBefore} scritture`);
  ok(JSON.parse(storage.getItem(KEY)).mastery["5"]===2, "la scrittura compatta mantiene lo stato finale");

  console.log("Storage lock: " + (fail ? fail + " ERRORI" : "OK (" + pass + "/" + pass + ")"));
  process.exit(fail ? 1 : 0);
}

main().catch(error=>{ console.error(error); process.exit(1); });
