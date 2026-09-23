// Verifica dei dati della tavola periodica (nessuna dipendenza esterna).
// Esecuzione: bun tests/check-data.js
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "tavola.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const dataCode = fs.readFileSync(path.join(root, "data.js"), "utf8");
const storageCode = fs.readFileSync(path.join(root, "storage.js"), "utf8");
const appCode = fs.readFileSync(path.join(root, "app.js"), "utf8");
const code = [dataCode, storageCode, appCode].join("\n");
const data = dataCode.slice(0, dataCode.indexOf("// END DATA"));

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  data + "\n;globalThis.__out={SYMBOLS,NAMES,MASSES,CAT_DEF,posOf,CFG_EXC,AUFBAU,baseConfig,shellsOf,catOf,ELEMENTS,BIO_SYMS,BIO_Z};",
  sandbox
);
const o = sandbox.__out;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL: " + msg); fails++; } };
ok(html.includes('<link rel="stylesheet" href="style.css">') && !html.includes("<style>"),
  "CSS esterno collegato e nessun blocco inline residuo");
ok(["data.js", "storage-backend.js", "storage.js", "app.js"].every(f=>html.includes(`<script src="${f}" defer></script>`)) &&
   !html.includes("<script>"),
  "script esterni separati e nessun blocco inline residuo");
ok(!/\.innerHTML\s*=/.test(appCode), "rendering applicativo senza innerHTML");

/* --- struttura --- */
ok(o.SYMBOLS.length === 118, "118 simboli (ottenuti " + o.SYMBOLS.length + ")");
ok(o.NAMES.length === 118, "118 nomi (ottenuti " + o.NAMES.length + ")");
ok(o.MASSES.length === 118, "118 masse (ottenute " + o.MASSES.length + ")");
ok(new Set(o.SYMBOLS).size === 118, "simboli univoci");
ok(new Set(o.NAMES).size === 118, "nomi univoci");

/* --- categorie: copertura esatta, niente duplicati --- */
const seen = {};
o.CAT_DEF.forEach(c => c.syms.split(" ").forEach(sym => {
  if (seen[sym]) { console.log("FAIL: " + sym + " in due categorie (" + seen[sym] + ", " + c.id + ")"); fails++; }
  seen[sym] = c.id;
}));
ok(Object.keys(seen).length === 118, "categorie: 118 elementi distinti (ottenuti " + Object.keys(seen).length + ")");
o.ELEMENTS.forEach(e => ok(!!e.cat, "categoria mancante: " + e.sym));

/* --- elementi biorilevanti: simboli reali, senza duplicati, insieme coerente --- */
ok(Array.isArray(o.BIO_SYMS) && o.BIO_SYMS.length > 0, "BIO_SYMS definito");
const bioUnknown = o.BIO_SYMS.filter(s => !o.SYMBOLS.includes(s));
ok(bioUnknown.length === 0, "BIO_SYMS solo simboli reali" + (bioUnknown.length ? ": " + bioUnknown.join(",") : ""));
ok(new Set(o.BIO_SYMS).size === o.BIO_SYMS.length, "BIO_SYMS senza duplicati");
ok(o.BIO_SYMS.length === 26, "26 elementi biorilevanti (ottenuti " + o.BIO_SYMS.length + ")");
// niente instanceof: il sandbox vm ha un altro realm, Set non è lo stesso costruttore
ok(o.BIO_Z && typeof o.BIO_Z.size === "number" && o.BIO_Z.size === o.BIO_SYMS.length,
  "BIO_Z con lo stesso numero di Z di BIO_SYMS (ottenuti " + (o.BIO_Z && o.BIO_Z.size) + ")");
o.BIO_SYMS.forEach(s => ok(o.BIO_Z.has(o.SYMBOLS.indexOf(s) + 1), "BIO_Z privo di " + s));
// i 6 bioelementi strutturali non possono mancare dall'elenco esteso
["H", "C", "N", "O", "P", "S"].forEach(s => ok(o.BIO_Z.has(o.SYMBOLS.indexOf(s) + 1), "bioelemento strutturale mancante: " + s));
// una cella biorilevante deve poter essere colorata: la categoria esiste e la regola CSS pure
o.BIO_SYMS.forEach(s => {
  ok(!!o.catOf[s], "categoria mancante per il biorilevante " + s);
  ok(new RegExp("\\.cat-" + o.catOf[s] + "\\{").test(css), "regola CSS mancante per il biorilevante " + s);
});

/* --- le classi CSS delle categorie devono esistere davvero ---
   (cat-lantanoidi vs cat-lanthanoidi lasciava le celle dei lantanoidi senza colore) */
o.CAT_DEF.forEach(c => ok(new RegExp("\\.cat-" + c.id + "\\{").test(css), "regola CSS mancante: .cat-" + c.id));

/* --- posizioni: nessuna collisione, coordinate valide --- */
const pos = {};
o.ELEMENTS.forEach(e => {
  const k = e.x + "," + e.y;
  if (pos[k]) { console.log("FAIL: collisione " + k + " tra " + pos[k] + " e " + e.sym); fails++; }
  pos[k] = e.sym;
  ok(e.x >= 1 && e.x <= 18, "colonna fuori tavola: " + e.sym);
  ok([1, 2, 3, 4, 5, 6, 7, 9, 10].includes(e.y), "riga non valida: " + e.sym + " y=" + e.y);
  if (e.group === null) ok([6, 7].includes(e.period), "periodo f-block: " + e.sym);
  else { ok(e.group >= 1 && e.group <= 18, "gruppo: " + e.sym); ok(e.period >= 1 && e.period <= 7, "periodo: " + e.sym); }
});
ok(Object.keys(pos).length === 118, "118 posizioni distinte");

/* --- configurazioni elettroniche: somma elettroni = Z, gusci coerenti --- */
o.ELEMENTS.forEach(e => {
  const toks = e.cfg.split(" ");
  const sum = toks.reduce((a, t) => {
    const m = t.match(/^(\d+)[a-z]+(\d+)$/);
    if (!m) { console.log("FAIL: token " + e.sym + " " + t); fails++; return a; }
    return a + +m[2];
  }, 0);
  ok(sum === e.z, "somma elettroni != Z per " + e.sym + " (" + sum + " vs " + e.z + ")");
  ok(e.shells.reduce((a, b) => a + b, 0) === e.z, "somma gusci != Z per " + e.sym);
  const maxn = Math.max(...toks.map(t => +t.match(/^(\d+)/)[1]));
  ok(e.shells.length === maxn, "numero di gusci incoerente per " + e.sym);
});

/* --- le eccezioni devono differire dall'ordinamento di Aufbau --- */
Object.keys(o.CFG_EXC).forEach(z => {
  ok(o.CFG_EXC[z] !== o.baseConfig(+z), "eccezione identica al base per Z=" + z);
});

/* --- tutte le configurazioni (base ed eccezioni) in un unico ordine di Aufbau:
       altrimenti il pannello dettagli mostrerebbe "4s2 3d6" per Fe e "3d5 4s1" per Cr --- */
const AUF_POS = Object.fromEntries(o.AUFBAU.map(([orb], i) => [orb, i]));
o.ELEMENTS.forEach(e => {
  const orbs = e.cfg.split(" ").map(t => t.match(/^(\d+[a-z]+)/)[1]);
  orbs.forEach(sym => ok(sym in AUF_POS, "orbitale sconosciuto " + sym + " in " + e.sym));
  const seq = orbs.map(s => AUF_POS[s]);
  ok(seq.every((v, i) => i === 0 || v > seq[i - 1]),
    "configurazione fuori ordine di Aufbau per " + e.sym + ": " + e.cfg);
});

/* --- masse: solo cifre o [numero] --- */
o.MASSES.forEach((m, i) => ok(/^\[\d+\]$|^\d+(\.\d+)?$/.test(m), "formato massa: " + o.SYMBOLS[i] + " " + m));
// Valori abridgiati IUPAC: tabella 2021 e revisione 2024 di Zr. I numeri tra
// parentesi quadre sono quelli scelti dalla tavola per gli elementi radioattivi.
const EXPECTED_MASSES = { 18:"39.95", 40:"91.222", 43:"[97]", 103:"[262]", 109:"[277]", 114:"[290]" };
Object.entries(EXPECTED_MASSES).forEach(([z,mass]) => {
  ok(o.MASSES[Number(z)-1] === mass,
    `massa IUPAC Z=${z}: atteso ${mass}, trovato ${o.MASSES[Number(z)-1]}`);
});

/* --- controlli incrociati noti (errori tipici delle tavole) --- */
const byS = Object.fromEntries(o.ELEMENTS.map(e => [e.sym, e]));
ok(byS.Ar.mass > byS.K.mass, "Ar > K (ordine delle masse invertito è un errore classico)");
ok(byS.Co.mass > byS.Ni.mass, "Co > Ni");
ok(byS.Te.mass > byS.I.mass, "Te > I");
ok(byS.He.group === 18 && byS.He.period === 1, "He in 18/1");
ok(byS.H.group === 1, "H in gruppo 1");
ok(byS.La.x === 3 && byS.La.y === 9, "La nella prima riga separata");
ok(byS.Lu.x === 17 && byS.Lu.y === 9, "Lu ultima cella lantanoidi");
ok(byS.Ac.x === 3 && byS.Ac.y === 10, "Ac nella seconda riga separata");
ok(byS.Lr.x === 17 && byS.Lr.y === 10, "Lr ultima cella attinoidi");
ok(byS.Rf.group === 4, "Rf in gruppo 4");
ok(byS.Og.group === 18 && byS.Og.period === 7, "Og in 18/7");
ok(o.catOf.C === "nonmetallo", "C è non metallo");
ok(o.catOf.He === "gasnobile", "He è gas nobile");
ok(o.catOf.B === "semimetallo", "B è semimetallo");
ok(o.catOf.Al === "post", "Al è post-transizione");

/* --- i mazzetti devono derivare davvero da BOX_DAYS (il README promette che
       cambiare BOX_DAYS basta): un Math.min(4,…) hardcoded bloccava le carte al
       5° mazzo e un boxes=[0,0,0,0,0] faceva apparire "undefined" in Progressi --- */
ok(/const MAX_BOX=BOX_DAYS\.length-1/.test(code), "MAX_BOX derivato da BOX_DAYS.length");
ok(!/Math\.min\(4,/.test(code), "nessun Math.min(4,) hardcoded sui mazzetti");
ok(!/boxes=\[0,0,0,0,0\]/.test(code), "righe dei mazzi dimensionate su BOX_DAYS");

/* --- la soglia di padroneggio è unica (era replicata in 4 punti) --- */
ok(/const MASTERY_THRESHOLD=\s*70/.test(code), "MASTERY_THRESHOLD definita");

console.log("Dati: " + (fails === 0 ? "OK" : fails + " ERRORI"));
process.exit(fails ? 1 : 0);
