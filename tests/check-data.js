// Verifica dei dati della tavola periodica (nessuna dipendenza esterna).
// Esecuzione: node tests/check-data.js   oppure   bun tests/check-data.js
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const code = html.slice(html.indexOf("<script>") + 8, html.indexOf("</scr" + "ipt>"));
const data = code.slice(0, code.indexOf("// END DATA"));

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  data + "\n;globalThis.__out={SYMBOLS,NAMES,MASSES,CAT_DEF,posOf,CFG_EXC,baseConfig,shellsOf,catOf,ELEMENTS};",
  sandbox
);
const o = sandbox.__out;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL: " + msg); fails++; } };

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

/* --- le classi CSS delle categorie devono esistere davvero ---
   (cat-lantanoidi vs cat-lanthanoidi lasciava le celle dei lantanoidi senza colore) */
o.CAT_DEF.forEach(c => ok(new RegExp("\\.cat-" + c.id + "\\{").test(html), "regola CSS mancante: .cat-" + c.id));

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

/* --- masse: solo cifre o [numero] --- */
o.MASSES.forEach((m, i) => ok(/^\[\d+\]$|^\d+(\.\d+)?$/.test(m), "formato massa: " + o.SYMBOLS[i] + " " + m));

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

console.log("Dati: " + (fails === 0 ? "OK" : fails + " ERRORI"));
process.exit(fails ? 1 : 0);
