// Test funzionali della app (jsdom): clic, digitazione, scorciatoie, persistenza.
// Esecuzione: bun install && bun run test
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "tavola.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const readScript = name => fs.readFileSync(path.join(root, name), "utf8");
const KEY = "chemmaster-4000-v1";
const PAGE_CODE = ["data.js", "storage.js", "app.js"].map(readScript).join("\n");
// JSDOM non carica gli asset esterni senza un server: li inseriamo/valutiamo nel test.
const TEST_HTML = html.replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`);
// il codice della pagina è strict-mode: le let/const restano private all'eval.
// L'hook riesegue espressioni nello stesso scope lessicale per l'ispezione.
const HOOK = ";globalThis.__t={run:(s)=>eval(s)};";

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg, extra) {
  if (cond) pass++;
  else { fail++; failures.push(msg + (extra ? " :: " + extra : "")); }
}
function section(t) { console.log("== " + t + " =="); }

function makeApp(seed, pageUrl = "http://localhost/tavola.html") {
  const errors = [];
  const dom = new JSDOM(TEST_HTML, {
    runScripts: "outside-only",
    url: pageUrl,
    beforeParse(w) {
      w.scrollTo = () => {};
      w.alert = m => { w.__lastAlert = m; };
      w.confirm = () => true;
      // jsdom+Bun: focus() lancia sull'EventTarget Window. Teniamo traccia della
      // richiesta senza renderizzarla davvero, così i test possono verificare il focus.
      w.__lastFocus = null;
      w.HTMLElement.prototype.focus = function () { w.__lastFocus = this; };
      if (seed) { try { w.localStorage.setItem(KEY, seed); } catch (e) {} }
    }
  });
  const win = dom.window;
  try { win.eval(PAGE_CODE + HOOK); } catch (e) { errors.push(String(e && e.stack || e)); }
  win.__errors = errors;
  return win;
}
const ev = (win, code) => win.__t.run(code);
const click = (win, el) => el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
const type = (win, el, value) => { el.value = value; el.dispatchEvent(new win.Event("input", { bubbles: true })); };
// restituisce l'evento (non il valore di dispatchEvent) per poterne leggere defaultPrevented
const keyOn = (win, el, init) => {
  const ev = new win.KeyboardEvent("keydown", Object.assign({ bubbles: true, cancelable: true }, init));
  el.dispatchEvent(ev);
  return ev;
};
const key = (win, init) => keyOn(win, win.document, init);
const view = (win, name) => [...win.document.querySelectorAll("#tabs button")].find(b => b.dataset.view === name);

/* ================= INIT ================= */
section("Init / rendering");
const win = makeApp();
const d = win.document;
ok(win.__errors.length === 0, "nessun errore JS al caricamento", win.__errors.join(" | "));
ok(html.includes('<link rel="stylesheet" href="style.css">') && !html.includes("<style>"),
  "tavola usa il CSS esterno senza stili inline");
const scriptSources=[...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(m=>m[1]);
ok(JSON.stringify(scriptSources)===JSON.stringify(["data.js", "storage.js", "app.js"]) &&
   !html.includes("<script>"),
  "tavola carica i tre script esterni nell'ordine corretto senza codice inline");
ok(win.getComputedStyle(d.body).display !== "flex",
  "stili del menu non invadono il layout della tavola", win.getComputedStyle(d.body).display);
ok(d.querySelectorAll("#ptable .cell").length === 118, "118 celle nella tavola");
ok(d.querySelectorAll("#wtable .cell").length === 118, "118 celle nella tavola vuota");
ok(d.querySelectorAll("#wtable .cell.blank").length === 118, "tutte le celle di scrittura vuote");
ok(win.getComputedStyle(d.getElementById("ptable")).display === "grid", "tavola principale in griglia CSS");
ok(win.getComputedStyle(d.getElementById("wtable")).display === "grid",
  "tavola vuota in griglia (stesso layout della tavola principale)",
  win.getComputedStyle(d.getElementById("wtable")).display);
ok(win.getComputedStyle(d.getElementById("wtable")).minWidth === "960px",
  "tavola vuota con min-width per lo scroll orizzontale",
  win.getComputedStyle(d.getElementById("wtable")).minWidth);
ok(d.querySelectorAll("#legend .chip").length === 10, "10 voci in legenda");
ok([...d.querySelectorAll("#legend .chip")].every(c => c.tagName === "BUTTON" && c.type === "button"),
  "chip legenda come <button>: raggiungibili da tastiera");
ok([...d.querySelectorAll("#legend .chip")].every(c => c.getAttribute("aria-pressed") === "true"),
  "filtri legenda inizialmente premuti");
ok(d.querySelectorAll("#quizTypes input").length === 6, "6 tipi di domanda");
ok(d.querySelectorAll("#ptable .ph").length === 2, "2 placeholder (57-71 / 89-103)");
ok(d.getElementById("headPctTxt").textContent === "0/118 padroneggiati", "barra iniziale", d.getElementById("headPctTxt").textContent);
const headTrack=d.getElementById("headPctTrack");
ok(headTrack.getAttribute("role")==="progressbar" && headTrack.getAttribute("aria-valuenow")==="0" &&
   headTrack.getAttribute("aria-valuemax")==="118",
  "barra di padroneggio esposta come progressbar", headTrack.outerHTML);
ok(d.getElementById("filterStatus").getAttribute("aria-live")==="polite" &&
   /118 elementi/.test(d.getElementById("filterStatus").textContent),
  "lo stato dei filtri viene annunciato", d.getElementById("filterStatus").textContent);
ok(d.querySelector("#detail .detail-sym b").textContent === "H", "dettaglio iniziale = H");
ok(d.getElementById("searchEl").hasAttribute("aria-label"), "input ricerca con aria-label");
ok(d.getElementById("storageWarning").hidden &&
   win.getComputedStyle(d.getElementById("storageWarning")).display === "none",
  "nessun avviso persistenza quando localStorage è disponibile");
ok(d.getElementById("storageImport").hidden,
  "import dal banner nascosto quando lo storage è regolare");
ok(!!d.getElementById("importBackup") && !d.getElementById("importBackup").hidden,
  "import JSON sempre disponibile nella sezione Progressi");
ok(!!d.getElementById("exportBackup") && !d.getElementById("exportBackup").hidden,
  "export JSON sempre disponibile nella sezione Progressi");
ok(d.getElementById("progressFile").accept.includes("application/json"),
  "file picker limitato ai backup JSON");
ok(d.querySelector('#ptable .cell[data-z="1"]').getAttribute("aria-current") === "true" &&
   d.querySelector('#ptable .cell[data-z="1"]').classList.contains("sel"),
  "tavola iniziale: elemento del dettaglio marcato e selezionato");

/* ================= LEGENDA (variabili CSS) ================= */
section("Legenda colori");
const rootVars = new Set([...css.match(/:root\{[\s\S]*?\}/)[0].matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const legendBad = [];
d.querySelectorAll("#legend .chip").forEach(chip => {
  const m = (chip.querySelector("i").getAttribute("style") || "").match(/var\((--[\w-]+)\)/);
  if (!m || !rootVars.has(m[1])) legendBad.push(chip.textContent.trim());
});
ok(legendBad.length === 0, "tutti i pallini legenda usano variabili CSS definite", "rotti: " + legendBad.join(", "));

/* ================= TAVOLA ================= */
section("Tavola: dettaglio, ricerca, filtri");
click(win, d.querySelector('#ptable .cell[data-z="26"]'));
ok(/Ferro/.test(d.getElementById("detail").textContent), "clic su Z=26 mostra Ferro");
ok(/Gruppo 8/.test(d.getElementById("detail").textContent), "Ferro gruppo 8");
ok(/Periodo 4/.test(d.getElementById("detail").textContent), "Ferro periodo 4");
ok(d.querySelector('#ptable .cell[data-z="26"]').getAttribute("aria-current") === "true",
  "cella selezionata esposta con aria-current");

click(win, d.querySelector('#ptable .cell[data-z="60"]'));
ok(/Periodo 6/.test(d.getElementById("detail").textContent) && /Lantanoidi/.test(d.getElementById("detail").textContent),
  "f-block: periodo mostrato", d.querySelector("#detail .kv").textContent.replace(/\s+/g, " "));

/* badge "biorilevante" nel pannello dettagli: presente solo per gli elementi dell'elenco */
const bioBadge = () => d.querySelector("#detail .bio-badge");
click(win, d.querySelector('#ptable .cell[data-z="26"]'));
ok(!!bioBadge() && /biorilevante/.test(bioBadge().textContent),
  "badge biorilevante per Ferro", bioBadge() ? bioBadge().textContent : "assente");
click(win, d.querySelector('#ptable .cell[data-z="2"]'));
ok(!bioBadge(), "nessun badge per Elio (non biorilevante)", bioBadge() ? bioBadge().textContent : "ok");
click(win, d.querySelector('#ptable .cell[data-z="60"]'));
ok(!bioBadge(), "nessun badge per un lantanotide", bioBadge() ? bioBadge().textContent : "ok");

const search = q => { type(win, d.getElementById("searchEl"), q); d.getElementById("searchEl").dispatchEvent(new win.Event("input", { bubbles: true })); };
const matchedSyms = () => [...d.querySelectorAll("#ptable .cell.match")].map(c => c.querySelector(".s").textContent);
search("fe");
ok(JSON.stringify(matchedSyms()) === JSON.stringify(["Fe"]), "ricerca 'fe' evidenzia solo Ferro", matchedSyms().join(","));
search("fer");
ok(matchedSyms().length === 2 && matchedSyms().includes("Fe") && matchedSyms().includes("Fm"),
  "ricerca 'fer' evidenzia Ferro e Fermio", matchedSyms().join(","));
search("26");
ok(JSON.stringify(matchedSyms()) === JSON.stringify(["Fe"]), "ricerca per numero atomico", matchedSyms().join(","));
search("nessun-elemento");
ok(/^Nessun elemento/.test(d.getElementById("filterStatus").textContent),
  "ricerca senza risultati annunciata", d.getElementById("filterStatus").textContent);
click(win, d.getElementById("clearFilter"));
ok(d.querySelectorAll("#ptable .cell.dim").length === 0, "Mostra tutti azzera il filtro");
ok([...d.querySelectorAll("#legend .chip")].every(c => c.getAttribute("aria-pressed") === "true"),
  "Mostra tutti riattiva semanticamente tutti i filtri");

const firstCategory = d.querySelector("#legend .chip");
click(win, firstCategory);
ok(d.querySelector('#ptable .cell[data-z="3"]').classList.contains("dim"), "toggle categoria nasconde Li");
ok(firstCategory.getAttribute("aria-pressed") === "false", "filtro categoria spenti esposto con aria-pressed");
click(win, firstCategory);
ok(!d.querySelector('#ptable .cell[data-z="3"]').classList.contains("dim"), "re-toggle riporta Li");
ok(firstCategory.getAttribute("aria-pressed") === "true", "filtro categoria riattivato esposto con aria-pressed");

click(win, d.querySelectorAll("#ptable .ph")[0]);
const phMatch = [...d.querySelectorAll("#ptable .cell.match")].map(c => +c.dataset.z);
ok(phMatch.length === 15 && phMatch.includes(57) && phMatch.includes(71),
  "placeholder evidenzia l'intera serie 57-71", phMatch.join(","));

/* il ripristino del placeholder deve ricreare lo stato dalla ricerca attiva,
   non cancellare la sottolineatura di una query in corso */
search("fer");
const realSetTimeout = win.setTimeout;
win.setTimeout = fn => { fn(); return 0; };   // esegue il ripristino in sincrono
click(win, d.querySelectorAll("#ptable .ph")[0]);
win.setTimeout = realSetTimeout;
ok([...d.querySelectorAll("#ptable .cell.match")].map(c => c.querySelector(".s").textContent).join(",") === "Fe,Fm",
  "dopo il placeholder la sottolineatura della ricerca è preservata",
  [...d.querySelectorAll("#ptable .cell.match")].map(c => c.querySelector(".s").textContent).join(","));
click(win, d.getElementById("clearFilter"));

/* ================= EVIDENZIAZIONE BIORILEVANTI ================= */
section("Evidenziazione biorilevanti");
const bioBtn = d.getElementById("bioToggle");
ok(!!bioBtn, "chip biorilevanti presente nella toolbar");
ok(bioBtn.tagName === "BUTTON" && bioBtn.type === "button", "chip come <button>: raggiungibile da tastiera",
  bioBtn.tagName + "/" + bioBtn.type);
ok(bioBtn.getAttribute("aria-pressed") === "false", "aria-pressed iniziale false", bioBtn.getAttribute("aria-pressed"));
ok(/\(26\)/.test(bioBtn.textContent), "conteggio degli elementi nel testo del chip", bioBtn.textContent);
ok(!bioBtn.classList.contains("on"), "chip inizialmente spento", bioBtn.className);

click(win, bioBtn);
ok(ev(win, "bioOn") === true, "clic: evidenziazione attiva");
ok(bioBtn.getAttribute("aria-pressed") === "true" && bioBtn.classList.contains("on"),
  "stato del chip aggiornato (aria-pressed + classe on)",
  bioBtn.className + " / " + bioBtn.getAttribute("aria-pressed"));
const bioMatch = [...d.querySelectorAll("#ptable .cell.match")].map(c => +c.dataset.z);
const bioDim = [...d.querySelectorAll("#ptable .cell.dim")].map(c => +c.dataset.z);
ok(bioMatch.length === 26, "26 celle evidenziate", "match=" + bioMatch.length);
ok(bioDim.length === 92, "92 celle oscurate", "dim=" + bioDim.length);
ok(bioMatch.includes(6) && bioMatch.includes(26) && bioMatch.includes(53) && bioMatch.includes(30),
  "C, Fe, I e Zn tra i biorilevanti", bioMatch.join(","));
ok(!bioMatch.includes(2) && bioDim.includes(2), "He non biorilevante oscurato",
  "match=" + bioMatch.includes(2) + " dim=" + bioDim.includes(2));
ok(ev(win, "BIO_Z.size") === 26, "BIO_Z con 26 elementi", String(ev(win, "BIO_Z.size")));

/* i filtri di categoria restano sopra: spenti gli alcalini, Na NON deve
   restare evidenziato come biorilevante, deve restare oscurato */
const chipAlkali = [...d.querySelectorAll("#legend .chip")].find(c => c.dataset.cat === "alcalini");
click(win, chipAlkali);
const naCell = d.querySelector('#ptable .cell[data-z="11"]');
ok(!naCell.classList.contains("match") && naCell.classList.contains("dim"),
  "Na (categoria spenta): oscurato, non evidenziato", naCell.className);
ok(d.querySelector('#ptable .cell[data-z="6"]').classList.contains("match"),
  "C (categoria attiva): resta evidenziato");
click(win, chipAlkali);   // riaccende i metalli alcalini

/* la ricerca continua a funzionare con il chip acceso */
search("fer");
ok(matchedSyms().join(",") === "Fe",
  "ricerca + chip: solo Ferro (Fm non è biorilevante)", matchedSyms().join(","));

click(win, bioBtn);
ok(ev(win, "bioOn") === false, "secondo clic spegne l'evidenziazione");
ok(matchedSyms().join(",") === "Fe,Fm", "chip spento: torna la sola ricerca", matchedSyms().join(","));

click(win, bioBtn);   // riaccende il chip per provare "Mostra tutti"
ok(ev(win, "bioOn") === true, "il chip si riaccende");
click(win, d.getElementById("clearFilter"));
ok(ev(win, "bioOn") === false, "'Mostra tutti' spegne il chip biorilevanti");
ok(bioBtn.getAttribute("aria-pressed") === "false" && !bioBtn.classList.contains("on"),
  "'Mostra tutti': stato del chip resettato", bioBtn.className + " / " + bioBtn.getAttribute("aria-pressed"));
ok(d.querySelectorAll("#ptable .cell.match").length === 0 && d.querySelectorAll("#ptable .cell.dim").length === 0,
  "'Mostra tutti': tavola completamente ripristinata",
  "match=" + d.querySelectorAll("#ptable .cell.match").length +
  " dim=" + d.querySelectorAll("#ptable .cell.dim").length);

/* ================= FLASHCARD ================= */
section("Flashcard");
click(win, view(win, "cards"));
ok(d.getElementById("view-cards").classList.contains("active"), "navigazione a flashcard");
ok(d.querySelectorAll("#cardScope option").length === 13, "13 ambiti", d.querySelectorAll("#cardScope option").length);
ok(d.querySelectorAll("#cardDir option").length === 6, "6 direzioni");
ok(d.getElementById("card").hasAttribute("tabindex"), "flashcard focusabile da tastiera");
ok(d.getElementById("card").getAttribute("role") === "button", "flashcard esposta come pulsante");
ok(d.getElementById("card").getAttribute("aria-keyshortcuts")==="Space Enter" &&
   d.getElementById("cardMeterTrack").getAttribute("role")==="progressbar",
  "scorciatoie e avanzamento flashcard accessibili");

d.getElementById("cardCount").value = "10";
click(win, d.getElementById("startCards"));
ok(!d.getElementById("cardsStage").classList.contains("hidden"), "sessione avviata");
ok(win.__lastFocus === d.getElementById("card"), "all'avvio delle flashcard il focus passa alla carta");
ok(/Carta 1 di 10\./.test(d.getElementById("card").getAttribute("aria-label") || ""),
  "nome accessibile della carta dinamico", d.getElementById("card").getAttribute("aria-label"));
const z1 = ev(win, "cards.queue[0].z");
ok(d.getElementById("cardFront").textContent === ev(win, "ELEMENTS.find(e=>e.z===" + z1 + ").name"),
  "fronte = nome (direzione n2s)", d.getElementById("cardFront").textContent);
ok(d.getElementById("cardBack").classList.contains("hidden"), "retro nascosto all'inizio");

click(win, d.getElementById("card"));
ok(!d.getElementById("cardBack").classList.contains("hidden"), "clic gira la carta");
ok(!d.getElementById("card").hasAttribute("aria-keyshortcuts"),
  "shortcut della carta rimossi dopo il flip", d.getElementById("card").getAttribute("aria-keyshortcuts"));
ok(/risposta .*1, 2 e 3/.test(d.getElementById("card").getAttribute("aria-label") || ""),
  "la carta girata annuncia risposta e controlli di giudizio");
ok(!d.getElementById("cardGrade").classList.contains("hidden"), "bottoni giudizio visibili");

const before = ev(win, "mastery(" + z1 + ")");
click(win, d.querySelector('#cardGrade button[data-g="2"]'));
ok(d.getElementById("card").getAttribute("aria-keyshortcuts")==="Space Enter",
  "shortcut della carta ripristinati sulla carta successiva");
ok(ev(win, "mastery(" + z1 + ")") === before + 20, "Facile = +20", before + "->" + ev(win, "mastery(" + z1 + ")"));
ok(ev(win, "state.leitner[" + z1 + "]") === 2, "Facile salta di 2 mazzi", ev(win, "state.leitner[" + z1 + "]"));
ok(ev(win, "state.due[" + z1 + "]") - Date.now() > 2 * 86400000, "scadenza ~3 giorni (mazzo 2)");

/* mazzo fuori scala (localStorage corrotto): nessun "undefined" nel riepilogo carta */
ev(win, "state.leitner[cards.queue[0].z]=99; showCard()");
ok(!/undefined|NaN/.test(d.getElementById("cardBox").textContent),
  "mazzo corrotto: etichetta carta senza undefined", d.getElementById("cardBox").textContent);
ev(win, "state.leitner[cards.queue[0].z]=0; showCard()");
ok(/0° mazzo/.test(d.getElementById("cardBox").textContent),
  "box 0 reale non viene più mostrato come carta nuova", d.getElementById("cardBox").textContent);

/* scorciatoie con tasti modificatori ignorate: Ctrl/Cmd/Alt+Spazio o +1..3
   (Ctrl+Spazio è il caso tipico) non devono girare né giudicare la carta */
key(win, { code: "Space", key: " ", ctrlKey: true });
ok(ev(win, "cards.flipped") === false, "Ctrl+Spazio non gira la carta", "flipped=" + ev(win, "cards.flipped"));
key(win, { code: "Space", key: " ", metaKey: true });
ok(ev(win, "cards.flipped") === false, "Cmd+Spazio non gira la carta", "flipped=" + ev(win, "cards.flipped"));
key(win, { code: "Space", key: " ", shiftKey: true });
ok(ev(win, "cards.flipped") === false, "Shift+Spazio non gira la carta", "flipped=" + ev(win, "cards.flipped"));
key(win, { key: "1", code: "Digit1", ctrlKey: true });
ok(ev(win, "cards.done") === 1, "Ctrl+1 non giudica la carta", "done=" + ev(win, "cards.done"));

key(win, { code: "Space", key: " " });
ok(!d.getElementById("cardBack").classList.contains("hidden"), "Spazio gira la carta");
const z2 = ev(win, "cards.queue[0].z");
key(win, { key: "1" });
ok(ev(win, "cards.done") === 2, "tasto 1 giudica la carta", "done=" + ev(win, "cards.done"));
ok(ev(win, "state.leitner[" + z2 + "]") === 0, "Non sapevo azzera il mazzo");

/* Enter/Spazio con il focus su un bottone: il gestore globale non deve intercettarli */
const kEnterBtn = keyOn(win, d.getElementById("stopCards"), { key: "Enter", code: "Enter" });
ok(!kEnterBtn.defaultPrevented, "Enter su 'Termina sessione' non intercettato", "defaultPrevented=" + kEnterBtn.defaultPrevented);
const kSpaceBtn = keyOn(win, d.getElementById("stopCards"), { key: " ", code: "Space" });
ok(!kSpaceBtn.defaultPrevented, "Spazio su un bottone non intercettato", "defaultPrevented=" + kSpaceBtn.defaultPrevented);
const kEnterCard = keyOn(win, d.getElementById("card"), { key: "Enter", code: "Enter" });
ok(kEnterCard.defaultPrevented && !d.getElementById("cardBack").classList.contains("hidden"),
  "Enter sulla carta (non su un bottone) la gira comunque");

click(win, d.getElementById("stopCards"));
ok(!d.getElementById("cardsDone").classList.contains("hidden"), "riepilogo sessione");
ok(win.__lastFocus === d.getElementById("cardsScore"), "il focus passa al riepilogo flashcard");
// 2 carte svolte su 10 pianificate, 1 giusta: la % è sulle svolte (50%), non sulle pianificate
ok(d.getElementById("cardsScore").textContent === "50%",
  "sessione interrotta: % calcolata sulle carte svolte", d.getElementById("cardsScore").textContent);

d.getElementById("cardScope").value = "weak";
d.getElementById("cardScope").dispatchEvent(new win.Event("change", { bubbles: true }));
ok(/Elementi nell'ambito: 118/.test(d.getElementById("cardScopeInfo").textContent), "info ambito aggiornata",
  d.getElementById("cardScopeInfo").textContent);

const winMeter=makeApp();
ev(winMeter, "cards={queue:[{z:1}],dir:DIRS[0],total:1,done:0,ok:0,flipped:true}; gradeCard(2)");
ok(winMeter.document.getElementById("cardMeterTrack").getAttribute("aria-valuenow")==="100" &&
   /1 di 1 carte, 100%/.test(winMeter.document.getElementById("cardMeterTrack").getAttribute("aria-valuetext") || ""),
  "progressbar flashcard aggiornata al 100% dopo l'ultima carta");

/* ================= QUIZ ================= */
section("Quiz");
click(win, view(win, "quiz"));
d.getElementById("quizLen").value = "10";
click(win, d.getElementById("startQuiz"));
ok(!d.getElementById("quizStage").classList.contains("hidden"), "quiz avviato");
ok(win.__lastFocus === d.getElementById("qText"), "il focus passa al testo della prima domanda");
ok(d.querySelectorAll("#qOptions .opt").length === 5, "4 opzioni + 'Non so'");
ok([...d.querySelectorAll("#qOptions .opt")].every((b,i)=>b.getAttribute("aria-keyshortcuts")===String(i+1)),
  "shortcut numerici dichiarati sulle opzioni quiz");

/* scorciatoie con modificatore: Ctrl/Cmd+1..5 non devono rispondere */
key(win, { key: "1", code: "Digit1", ctrlKey: true });
ok(ev(win, "quiz.answered") === false, "Ctrl+1 non risponde alla domanda", "answered=" + ev(win, "quiz.answered"));
key(win, { key: "5", code: "Digit5", metaKey: true });
ok(ev(win, "quiz.answered") === false, "Cmd+5 non risponde con 'Non so'", "answered=" + ev(win, "quiz.answered"));

const zQ1 = ev(win, "quiz.list[0].e.z");
const rightVal = ev(win, "quiz.list[0].answer");
const mBefore = ev(win, "mastery(" + zQ1 + ")");
click(win, [...d.querySelectorAll("#qOptions .opt")].find(b => b.dataset.v === rightVal));
ok([...d.querySelectorAll("#qOptions .opt")].every(b=>!b.hasAttribute("aria-keyshortcuts")),
  "shortcut quiz rimossi dopo la risposta");
ok(ev(win, "quiz.score") === 10, "risposta giusta = 10 punti");
ok(ev(win, "quiz.streak") === 1, "serie incrementata");
ok(ev(win, "mastery(" + zQ1 + ")") === mBefore + 8, "quiz giusto +8");
ok(ev(win, "state.quiz.correct") === 1, "contatore corretti salvato");
ok(win.__lastFocus === d.getElementById("qNext"), "dopo la risposta il focus passa a Prossima");

/* focus su "Prossima": Enter deve attivare il bottone, non essere intercettato */
key(win, { key: " ", code: "Space", shiftKey: true });
ok(ev(win, "quiz.i") === 0, "Shift+Spazio non avanza nel quiz");
const kEnterNext = keyOn(win, d.getElementById("qNext"), { key: "Enter", code: "Enter" });
ok(!kEnterNext.defaultPrevented, "Enter su 'Prossima' non intercettato", "defaultPrevented=" + kEnterNext.defaultPrevented);

click(win, d.getElementById("qNext"));
ok(win.__lastFocus === d.getElementById("qText"), "il focus torna sul testo dopo Prossima");
const ans2 = ev(win, "quiz.list[1].answer");
const opts2 = [...d.querySelectorAll("#qOptions .opt")].map(b => b.dataset.v);
const wrongIdx = opts2.findIndex(v => v !== ans2);
const zQ2 = ev(win, "quiz.list[1].e.z");
key(win, { key: String(wrongIdx + 1) });
ok(ev(win, "quiz.answered") === true, "tasto 1-4 risponde");
ok(ev(win, "quiz.wrong.length") === 1, "errore registrato in sessione");
ok(ev(win, "state.wrongZ").includes(zQ2), "errore salvato subito (non a fine quiz)", JSON.stringify(ev(win, "state.wrongZ")));
key(win, { key: "Enter" });
ok(ev(win, "quiz.i") === 2, "Invio va alla domanda successiva");

click(win, d.getElementById("qEnd"));
ok(win.__lastFocus === d.getElementById("quizScoreBig"), "il focus passa al riepilogo quiz");
const summary = d.getElementById("quizSummary").textContent;
ok(/^50% di risposte giuste/.test(summary), "percentuale calcolata sulle date (2 risposte, 1 giusta)", summary);
ok(/risposte 2\/10/.test(summary), "indicate le risposte date rispetto al totale", summary);
ok(d.getElementById("quizScoreBig").textContent === "1/10", "punteggio assoluto", d.getElementById("quizScoreBig").textContent);
ok(ev(win, "state.quiz.history[0].answered") === 2, "storico con quante risposte sono state date");
ok(!d.getElementById("quizFix").classList.contains("hidden"), "bottone ripassa errori visibile");
ok(d.getElementById("wrongCount").textContent === "1", "contatore errori aggiornato", d.getElementById("wrongCount").textContent);

/* risposta giusta nella modalità "ripassa gli errori" */
click(win, d.getElementById("quizFix"));
ok(ev(win, "quiz.list.length") === 1, "ripassa 1 errore", ev(win, "quiz.list.length"));
const rightVal2 = ev(win, "quiz.list[0].answer");
click(win, [...d.querySelectorAll("#qOptions .opt")].find(b => b.dataset.v === rightVal2));
ok(!ev(win, "state.wrongZ").includes(zQ2), "risposta giusta toglie l'elemento dagli errori", JSON.stringify(ev(win, "state.wrongZ")));
click(win, d.getElementById("qNext"));

/* quiz subito terminato: nessuna risposta -> nessuno storico spurio */
click(win, d.getElementById("quizAgain"));
ok(win.__lastFocus === d.getElementById("startQuiz"),
  "nuovo quiz: il focus torna al pulsante di avvio");
click(win, d.getElementById("startQuiz"));
click(win, d.getElementById("qEnd"));
const histLen = ev(win, "state.quiz.history.length");
ok(/^Nessuna risposta data/.test(d.getElementById("quizSummary").textContent), "quiz terminato subito: nessuna % falsa",
  d.getElementById("quizSummary").textContent);
ok(histLen === 2, "quiz senza risposte non finisce nello storico", "voci=" + histLen);

/* quinta opzione "Non so": conta come errore ed è salvata subito nel ripasso */
click(win, d.getElementById("quizAgain"));
click(win, d.getElementById("startQuiz"));
const skipBtn = [...d.querySelectorAll("#qOptions .opt")].find(b => b.classList.contains("skip"));
ok(!!skipBtn && skipBtn.textContent === "Non so", "bottone 'Non so' presente tra le opzioni",
  skipBtn && skipBtn.textContent);
const zQ3 = ev(win, "quiz.list[0].e.z");
ev(win, "state.wrongZ=state.wrongZ.filter(z=>z!==" + zQ3 + ")");   // parte da zero per questo elemento
ev(win, "state.mastery[" + zQ3 + "]=50");
const wrongBefore3 = ev(win, "state.quiz.wrong");
key(win, { key: "5" });
ok(ev(win, "quiz.answered") === true, "tasto 5 risponde con 'Non so'");
ok(ev(win, "quiz.score") === 0 && ev(win, "quiz.streak") === 0, "'Non so': nessun punto e serie azzerata",
  "score=" + ev(win, "quiz.score") + " streak=" + ev(win, "quiz.streak"));
ok(ev(win, "quiz.wrong.length") === 1, "'Non so' registrato come errore in sessione");
ok(ev(win, "state.wrongZ").includes(zQ3), "'Non so' salvato subito nel ripasso errori",
  JSON.stringify(ev(win, "state.wrongZ")));
ok(ev(win, "state.quiz.wrong") === wrongBefore3 + 1, "contatore errori salvato incrementato",
  wrongBefore3 + "->" + ev(win, "state.quiz.wrong"));
ok(ev(win, "mastery(" + zQ3 + ")") === 44, "'Non so' applica -6 di padroneggio",
  ev(win, "mastery(" + zQ3 + ")"));
ok(/^Non sapevi: la risposta era/.test(d.getElementById("qFeedback").textContent), "feedback 'Non sapevi'",
  d.getElementById("qFeedback").textContent);
ok([...d.querySelectorAll("#qOptions .opt.correct")].length === 1, "svelata la risposta giusta");
ok(d.querySelector("#qOptions .opt.skip").classList.contains("chosen"), "'Non so' marcato come scelto");
ok([...d.querySelectorAll("#qOptions .opt")].every(b => b.disabled), "opzioni disabilitate dopo la risposta");
click(win, d.getElementById("qEnd"));
click(win, d.getElementById("quizAgain"));

/* ================= SCRIVI: griglia ================= */
section("Scrivi la tavola (griglia)");
click(win, view(win, "write"));
const writeModeButtons = [...d.querySelectorAll("#writeMode button")];
ok(writeModeButtons[0].getAttribute("aria-pressed") === "true" &&
   writeModeButtons[1].getAttribute("aria-pressed") === "false",
  "modalità scrittura iniziale esposta con aria-pressed");

/* i segnaposto 57-71 / 89-103 servono anche qui: senza resterebbero due buchi
   nel gruppo 3 (periodi 6 e 7), ma non sono interattivi (applyFilter gira su #ptable) */
const wph = [...d.querySelectorAll("#wtable .ph")];
ok(wph.length === 2, "tavola vuota: 2 segnaposto, niente buchi nella griglia", String(wph.length));
ok(wph.every(p => p.tagName === "DIV"), "segnaposto tavola vuota non sono pulsanti", wph.map(p => p.tagName).join(","));
ok(wph.map(p => p.style.gridColumn + "/" + p.style.gridRow).join(",") === "4/7,4/8",
  "segnaposto in gruppo 3, periodi 6 e 7", wph.map(p => p.style.gridColumn + "/" + p.style.gridRow).join(","));
click(win, wph[0]);
ok(d.querySelectorAll("#wtable .cell.match").length === 0, "segnaposto tavola vuota: il clic non lascia evidenziazioni");
ok(d.querySelectorAll("#wtable .cell.sel").length === 0, "segnaposto tavola vuota: il clic non seleziona caselle");

const cell1 = d.querySelector('#wtable .cell[data-z="1"]');
// i valori di padroneggio qui sopra (flashcard/quiz) dipendono da elementi sorteggiati:
// le asserzioni che seguono confrontano quindi DELTA, non valori assoluti.
const mCell1Before = ev(win, "mastery(1)");
ok(!cell1.hasAttribute("title"), "casella vuota senza tooltip che svela la risposta", cell1.getAttribute("title"));
ok(/^Casella vuota/.test(cell1.getAttribute("aria-label") || ""), "casella vuota con aria-label descrittiva",
  cell1.getAttribute("aria-label"));
click(win, cell1);
ok(cell1.classList.contains("sel"), "casella selezionata");
ok(cell1.getAttribute("aria-pressed") === "true", "casella selezionata esposta con aria-pressed");
ok(d.getElementById("wCellInput").disabled === false, "input abilitato");

type(win, d.getElementById("wCellInput"), "h");
keyOn(win, d.getElementById("wCellInput"), { key: "Enter" });
ok(cell1.classList.contains("solved"), "simbolo minuscolo accettato");
ok(/Idrogeno \(H\) — Z=1/.test(cell1.getAttribute("title") || ""), "casella risolta con tooltip completo",
  cell1.getAttribute("title"));
ok(d.getElementById("wFilled").textContent === "1", "contatore 1/118");
ok(cell1.getAttribute("aria-pressed") === "false", "casella risolta: selezione azzerata");
ok(/casella completata.*Idrogeno/.test(cell1.getAttribute("aria-label") || ""),
  "casella risolta: aria-label aggiornato senza svelarla inizialmente",
  cell1.getAttribute("aria-label"));
ok(ev(win, "state.write.cellOk") === undefined, "rimosso il contatore cellOk mai mostrato");
ok(ev(win, "mastery(1)") === mCell1Before + 12, "griglia giusta +12",
  mCell1Before + "->" + ev(win, "mastery(1)"));

const cell2 = d.querySelector('#wtable .cell[data-z="2"]');
click(win, cell2);
type(win, d.getElementById("wCellInput"), "X");
keyOn(win, d.getElementById("wCellInput"), { key: "Enter" });
ok(d.getElementById("wMsg").classList.contains("no"), "feedback negativo");
ok(/No: He è il simbolo di Elio/.test(d.getElementById("wMsg").textContent), "correzione immediata", d.getElementById("wMsg").textContent);
ok(ev(win, "state.write.cellBad") === undefined, "rimosso il contatore cellBad mai mostrato");
const mCell2AfterWrong = ev(win, "mastery(2)");   // quota dopo il tentativo sbagliato
const repeatedEnter = keyOn(win, d.getElementById("wCellInput"), { key: "Enter", repeat: true });
ok(repeatedEnter.defaultPrevented, "Invio ripetuto viene prevenuto");
ok(ev(win, "mastery(2)") === mCell2AfterWrong,
  "tenere premuto Invio non applica penalità multiple", mCell2AfterWrong + "->" + ev(win, "mastery(2)"));

type(win, d.getElementById("wCellInput"), "Elio");
keyOn(win, d.getElementById("wCellInput"), { key: "Enter" });
ok(!cell2.classList.contains("solved"), "il nome non vale come simbolo (la casella chiede il simbolo)");
ok(/serve il simbolo/.test(d.getElementById("wMsg").textContent), "messaggio di richiamo senza penalità",
  d.getElementById("wMsg").textContent);
ok(ev(win, "mastery(2)") === mCell2AfterWrong, "nessuna penalità per il nome corretto",
  mCell2AfterWrong + "->" + ev(win, "mastery(2)"));

type(win, d.getElementById("wCellInput"), "He");
keyOn(win, d.getElementById("wCellInput"), { key: "Enter" });
ok(cell2.classList.contains("solved"), "poi il simbolo risolve la casella");

/* un errore nella griglia può far scendere sotto la soglia: anche il
   contatore globale deve aggiornarsi, non soltanto la cella e il dettaglio */
const winHead = makeApp();
const dHead = winHead.document;
ev(winHead, "state.mastery[2]=72; updateHead()");
click(winHead, view(winHead, "write"));
click(winHead, dHead.querySelector('#wtable .cell[data-z="2"]'));
type(winHead, dHead.getElementById("wCellInput"), "X");
keyOn(winHead, dHead.getElementById("wCellInput"), { key: "Enter" });
ok(ev(winHead, "mastery(2)") === 69 && dHead.getElementById("headPctTxt").textContent === "0/118 padroneggiati",
  "errore nella tavola vuota aggiorna la barra globale quando passa la soglia",
  `mastery=${ev(winHead, "mastery(2)")} head=${dHead.getElementById("headPctTxt").textContent}`);

/* cella GIA risolta: un errore non deve lasciarla rossa (.wrong sta dopo .solved
   nella CSS) né costare padroneggio su una risposta che gia si vede */
const mCell1Solved = ev(win, "mastery(1)");
click(win, cell1);
type(win, d.getElementById("wCellInput"), "Xe");
keyOn(win, d.getElementById("wCellInput"), { key: "Enter" });
ok(!cell1.classList.contains("wrong"), "cella risolta: l'errore non la segna in rosso", cell1.className);
ok(ev(win, "mastery(1)") === mCell1Solved, "cella risolta: nessuna penalità per l'errore",
  mCell1Solved + "->" + ev(win, "mastery(1)"));
ok(!d.getElementById("wMsg").classList.contains("no"),
  "cella risolta: nessun feedback d'errore", d.getElementById("wMsg").className);

type(win, d.getElementById("wCellInput"), "h");
keyOn(win, d.getElementById("wCellInput"), { key: "Enter" });
ok(/Già compilato/.test(d.getElementById("wMsg").textContent),
  "cella risolta: simbolo corretto riconosciuto", d.getElementById("wMsg").textContent);
ok(!cell1.classList.contains("wrong") && !cell1.classList.contains("hinted")
  && cell1.classList.contains("solved"),
  "cella risolta: nessuno stato d'errore residuo dopo la correzione", cell1.className);
ok(ev(win, "mastery(1)") === mCell1Solved, "cella risolta: la correzione non tocca il padroneggio",
  mCell1Solved + "->" + ev(win, "mastery(1)"));

click(win, cell1);   // la risposta corretta qui sopra ha ripulito la selezione
click(win, d.getElementById("wHint"));
ok(!cell1.classList.contains("hinted"), "suggerimento su cella risolta: niente righe d'indizio",
  cell1.className);
ok(/già compilato/i.test(d.getElementById("wMsg").textContent),
  "suggerimento su cella risolta: feedback dedicato", d.getElementById("wMsg").textContent);

click(win, cell2);
click(win, d.querySelector('#wtable .cell[data-z="3"]'));
click(win, d.getElementById("wHint"));
ok(d.querySelector('#wtable .cell[data-z="3"]').classList.contains("hinted"), "suggerimento applicato");
ok(/Litio/.test(d.getElementById("wMsg").textContent), "testo indizio", d.getElementById("wMsg").textContent);
click(win, d.getElementById("wReset"));
ok(d.querySelectorAll("#wtable .cell.solved").length === 0, "azzera tavola");
ok(d.getElementById("wFilled").textContent === "0", "contatore azzerato");
ok(d.querySelectorAll("#wtable .cell.sel").length === 0, "azzera tavola: nessuna selezione residua");
ok(d.getElementById("wCellInput").disabled === true,
  "azzera tavola: input disabilitato (niente selezione fantasma)", String(d.getElementById("wCellInput").disabled));

/* ================= SCRIVI: sequenza ================= */
section("Scrivi la tavola (sequenza)");
click(win, [...d.querySelectorAll('#writeMode button')].find(b => b.dataset.mode === "seq"));
ok(!d.getElementById("wSeqMode").classList.contains("hidden"), "modalità sequenza attiva");
ok(win.__lastFocus === d.getElementById("seqInput"),
  "il focus entra nell'input sequenza senza timer", String(win.__lastFocus && win.__lastFocus.id));
ok(writeModeButtons[0].getAttribute("aria-pressed") === "false" &&
   writeModeButtons[1].getAttribute("aria-pressed") === "true",
  "cambio modalità aggiorna aria-pressed");
type(win, d.getElementById("seqInput"), "H");
keyOn(win, d.getElementById("seqInput"), { key: "Enter" });
ok(ev(win, "seq.i") === 1 && ev(win, "seq.ok") === 1, "H corretto");
ok(/Elio/.test(d.getElementById("seqName").textContent), "prossimo nome come indizio", d.getElementById("seqName").textContent);
type(win, d.getElementById("seqInput"), "Z");
keyOn(win, d.getElementById("seqInput"), { key: "Enter" });
ok(ev(win, "seq.i") === 2 && ev(win, "seq.bad") === 1, "errore: comunque si avanza");
ok(/Era He \(Elio\)/.test(d.getElementById("seqHint").textContent), "feedback errore", d.getElementById("seqHint").textContent);
ok(ev(win, "state.write.seqBest") === 2, "miglior posizione salvata");
ok(d.getElementById("seqBar").querySelectorAll("span").length === 2, "barra progresso segmentata");
ok(ev(win, "state.write.seqOk") === undefined, "rimosso seqOk mai mostrato");
d.getElementById("seqShowName").checked = false;
d.getElementById("seqShowName").dispatchEvent(new win.Event("change", { bubbles: true }));
ok(d.getElementById("seqName").textContent === "—", "indizio nome disattivabile");
d.getElementById("seqShowName").checked = true;
d.getElementById("seqShowName").dispatchEvent(new win.Event("change", { bubbles: true }));
click(win, d.getElementById("seqRestart"));
ok(ev(win, "seq.i") === 0, "riavvio sequenza");

/* nome completo: stesso richiamo della tavola vuota, senza penalità */
const seqMasteryBefore = ev(win, "mastery(1)");
type(win, d.getElementById("seqInput"), "Idrogeno");
keyOn(win, d.getElementById("seqInput"), { key: "Enter" });
ok(ev(win, "seq.i") === 0, "sequenza: il nome non fa avanzare", "i=" + ev(win, "seq.i"));
ok(ev(win, "seq.bad") === 0 && ev(win, "seq.ok") === 0, "sequenza: il nome non conta come errore",
  "ok=" + ev(win, "seq.ok") + " bad=" + ev(win, "seq.bad"));
ok(/serve il simbolo/.test(d.getElementById("seqHint").textContent), "sequenza: richiamo per il simbolo",
  d.getElementById("seqHint").textContent);
ok(ev(win, "mastery(1)") === seqMasteryBefore, "sequenza: nessuna penalità per il nome",
  seqMasteryBefore + "->" + ev(win, "mastery(1)"));

/* indizio-nome: la chip segue la casella e il toggle non cancella quanto digitato */
type(win, d.getElementById("seqInput"), "H");
const chipHint = d.getElementById("seqHintToggle");
d.getElementById("seqShowName").checked = false;
d.getElementById("seqShowName").dispatchEvent(new win.Event("change", { bubbles: true }));
ok(d.getElementById("seqInput").value === "H", "indizio-nome spento: risposta digitata conservata",
  JSON.stringify(d.getElementById("seqInput").value));
ok(!chipHint.classList.contains("on"), "indizio-nome spento: la chip non resta accesa", chipHint.className);
d.getElementById("seqShowName").checked = true;
d.getElementById("seqShowName").dispatchEvent(new win.Event("change", { bubbles: true }));
ok(chipHint.classList.contains("on"), "indizio-nome acceso: la chip è accesa", chipHint.className);
ok(d.getElementById("seqInput").value === "H", "indizio-nome acceso: risposta ancora conservata",
  JSON.stringify(d.getElementById("seqInput").value));

/* una risposta effettiva (e solo quella) svuota l'input */
keyOn(win, d.getElementById("seqInput"), { key: "Enter" });
ok(ev(win, "seq.i") === 1 && ev(win, "seq.ok") === 1, "risposta giusta registrata",
  "i=" + ev(win, "seq.i") + " ok=" + ev(win, "seq.ok"));
ok(d.getElementById("seqInput").value === "", "dopo la risposta l'input è svuotato",
  JSON.stringify(d.getElementById("seqInput").value));

/* l'errore indica il simbolo mancato ma non svela il nome del prossimo elemento */
d.getElementById("seqShowName").checked = false;
d.getElementById("seqShowName").dispatchEvent(new win.Event("change", { bubbles: true }));
type(win, d.getElementById("seqInput"), "Z");
keyOn(win, d.getElementById("seqInput"), { key: "Enter" });
ok(ev(win, "seq.i") === 2 && ev(win, "seq.bad") === 1, "errore registrato e avanzamento",
  "i=" + ev(win, "seq.i") + " bad=" + ev(win, "seq.bad"));
ok(/Era He \(Elio\)/.test(d.getElementById("seqHint").textContent),
  "errore: nel feedback c'è il nome dell'elemento mancato", d.getElementById("seqHint").textContent);
ok(!/Litio/.test(d.getElementById("seqHint").textContent),
  "errore: nessun nome del prossimo elemento (niente fuga di risposta)",
  d.getElementById("seqHint").textContent);
ok(d.getElementById("seqName").textContent === "—", "errore: indizio-nome spento resta spento",
  d.getElementById("seqName").textContent);
d.getElementById("seqShowName").checked = true;
d.getElementById("seqShowName").dispatchEvent(new win.Event("change", { bubbles: true }));

/* ================= PROGRESSI ================= */
section("Progressi");
click(win, view(win, "stats"));
ok(d.querySelectorAll("#statCards .stat").length === 6, "6 card statistiche");
ok(d.querySelectorAll("#catStats .catbar").length === 10, "10 barre categoria");
const boxRows = [...d.querySelectorAll("#boxStats .catbar")].map(r => r.querySelector("span").textContent);
ok(boxRows.length === 5, "5 righe mazzi", boxRows.length);
ok(boxRows[0] === "0 · oggi", "box 0 mostrato come box reale, non come 'Non assegnato'", boxRows[0]);
const days = ev(win, "JSON.stringify(BOX_DAYS)");
const boxDays = JSON.parse(days);
const labelBad = [];
boxRows.forEach((label, i) => {
  if (i === 0) return;
  const m = label.match(/(\d+)\s*giorn/);
  if (!m || Number(m[1]) !== boxDays[i]) labelBad.push(`box${i}: "${label}" vs ${boxDays[i]} gg`);
});
ok(labelBad.length === 0, "etichette mazzi coerenti con BOX_DAYS", labelBad.join(" | ") + " | " + boxRows.join(" / "));
ok(!boxRows.some(t => /undefined|NaN/.test(t)), "nessuna etichetta undefined/NaN", boxRows.join(" / "));
const boxWidths = [...d.querySelectorAll("#boxStats .track i")].map(i => i.style.width);
ok(boxWidths.length === 5 && boxWidths.every(w => /^\d+%$/.test(w)),
  "barre mazzi con larghezze valide (nessun NaN)", boxWidths.join(","));
// due carte assegnate in tutto (una nel mazzo 0 e una nel 2): le barre misurano
// le carte presenti, non le 118 caselle della tavola
ok(boxWidths.join(",") === "50%,0%,50%,0%,0%",
  "barre mazzi proporzionali alle carte assegnate", boxWidths.join(","));
ok(/risposte 2/.test(d.getElementById("quizHist").innerHTML), "storico: quiz interrotto indica quante risposte",
  d.getElementById("quizHist").textContent.replace(/\s+/g, " "));

/* ================= PERSISTENZA ================= */
section("Persistenza e robustezza");
const raw = win.localStorage.getItem(KEY);
ok(!!raw, "stato salvato in localStorage");
const parsed = JSON.parse(raw);
ok(typeof parsed.mastery === "object" && typeof parsed.leitner === "object", "chiavi principali presenti");
ok(parsed.version === 1, "schema dello stato versionato");
ok(Array.isArray(parsed.quiz.history), "storico quiz salvato");

/* conflitto multi-tab: uno snapshot obsoleto non deve sovrascrivere il disco */
const conflictSeed = JSON.stringify({
  version:1, mastery:{1:10}, leitner:{}, due:{},
  quiz:{correct:0,wrong:0,history:[]}, write:{seqBest:0,solved:{}}, wrongZ:[]
});
const remoteState = JSON.parse(conflictSeed); remoteState.mastery[1]=80;
const winConflict = makeApp(conflictSeed);
winConflict.localStorage.setItem(KEY, JSON.stringify(remoteState));
const rejectedSave = ev(winConflict, "addMastery(1,5); save()");
ok(rejectedSave === false, "salvataggio respinto quando un'altra scheda ha scritto");
ok(winConflict.localStorage.getItem(KEY) === JSON.stringify(remoteState),
  "il conflitto non sovrascrive i progressi remoti");
ok(ev(winConflict, "storageDirty") === true && ev(winConflict, "storageConflict") === true,
  "conflitto conservato come dirty per non perdere la copia locale");
const conflictWarning = winConflict.document.getElementById("storageWarning");
ok(!conflictWarning.hidden && !winConflict.document.getElementById("storageExport").hidden &&
   !winConflict.document.getElementById("storageReload").hidden,
  "avviso conflitto con export e ricarica");
click(winConflict, winConflict.document.getElementById("storageReload"));
ok(ev(winConflict, "mastery(1)") === 80 && conflictWarning.hidden,
  "ricarica esplicita risolve il conflitto dal disco");

/* aggiornamento ricevuto da un'altra scheda senza conflicti locali */
const winRemoteEvent = makeApp(conflictSeed);
const remoteRaw = JSON.stringify(remoteState);
winRemoteEvent.localStorage.setItem(KEY, remoteRaw);
ev(winRemoteEvent, `globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteRaw)},storageArea:localStorage}))`);
ok(ev(winRemoteEvent, "mastery(1)") === 80,
  "evento storage aggiorna una tab che non ha modifiche locali");
ok(winRemoteEvent.document.getElementById("storageWarning").hidden,
  "aggiornamento remoto silenzioso senza warning di conflitto");

/* un aggiornamento remoto non deve mescolarsi a una sessione ancora aperta */
const winPendingEvent = makeApp(conflictSeed);
click(winPendingEvent, view(winPendingEvent, "cards"));
click(winPendingEvent, winPendingEvent.document.getElementById("startCards"));
winPendingEvent.localStorage.setItem(KEY, remoteRaw);
ev(winPendingEvent, `globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteRaw)},storageArea:localStorage}))`);
ok(ev(winPendingEvent, "mastery(1)") === 10 &&
   !winPendingEvent.document.getElementById("cardsStage").classList.contains("hidden"),
  "sessione aperta: aggiornamento remoto rimane in attesa");
ok(winPendingEvent.document.getElementById("storageWarning").dataset.kind === "conflict",
  "sessione aperta: l'evento storage segnala un conflitto");
click(winPendingEvent, winPendingEvent.document.getElementById("storageReload"));
ok(ev(winPendingEvent, "mastery(1)") === 80 &&
   winPendingEvent.document.getElementById("cardsStage").classList.contains("hidden") &&
   ev(winPendingEvent, "cards.queue.length") === 0,
  "ricarica remota chiude la sessione e carica uno stato coerente");

/* storage non disponibile: avviso e possibilità di esportare */
const winNoStorage = makeApp(null, "file:///tavola.html");
const failedSave = ev(winNoStorage, "addMastery(2,5); save()");
ok(failedSave === false && ev(winNoStorage, "storageDirty") === true,
  "errore di scrittura segnalato e stato marcato dirty");
ok(!winNoStorage.document.getElementById("storageWarning").hidden &&
   !winNoStorage.document.getElementById("storageExport").hidden &&
   !winNoStorage.document.getElementById("storageImport").hidden,
  "errore storage mostra import ed esportazione della copia");

/* export: click, nome file e contenuto JSON */
const winExport = makeApp();
ev(winExport, `(()=>{
  const NativeBlob=globalThis.Blob;
  globalThis.Blob=function(parts,options){globalThis.__exportParts=parts;return new NativeBlob(parts,options);};
  globalThis.URL.createObjectURL=()=> "blob:test";
  globalThis.URL.revokeObjectURL=()=> {};
  globalThis.HTMLAnchorElement.prototype.click=function(){globalThis.__exportName=this.download;};
})()`);
click(winExport, winExport.document.getElementById("exportBackup"));
ok(/^chemmaster-4000-\d{4}-\d{2}-\d{2}\.json$/.test(ev(winExport, "__exportName") || ""),
  "export avvia il download con nome file datato", ev(winExport, "__exportName"));
ok(JSON.parse(ev(winExport, "__exportParts[0]")).version === 1,
  "export contiene lo stato versionato come JSON");

const winExportUnsupported=makeApp();
ev(winExportUnsupported, "Object.defineProperty(globalThis.URL,'createObjectURL',{value:undefined, configurable:true})");
const unsupportedExport=ev(winExportUnsupported, "exportProgress()");
ok(unsupportedExport===false && /non supporta/.test(winExportUnsupported.__lastAlert||""),
  "export su browser senza Blob URL mostra un errore comprensibile", winExportUnsupported.__lastAlert);

/* import: lo stesso backup deve superare validazione, rendering e persistenza */
const importedAt=Date.now();
const backup=JSON.stringify({
  version:1,
  mastery:{1:42}, leitner:{1:2}, due:{},
  quiz:{correct:3,wrong:1,history:[
    {d:importedAt,score:20,total:4,answered:4,wrong:[26]}
  ]},
  write:{seqBest:7,solved:{1:1}}, wrongZ:[26], unknown:"scartato"
});
const winImport=makeApp();
const imported=ev(winImport, `applyImportedState(${JSON.stringify(backup)})`);
ok(imported===true, "backup valido importato dopo conferma");
ok(ev(winImport, "JSON.stringify([state.mastery[1],state.write.seqBest,state.wrongZ])")==='[42,7,[26]]',
  "stato importato applicato e sanificato", ev(winImport, "JSON.stringify(state)"));
ok(ev(winImport, "Object.prototype.hasOwnProperty.call(state,'unknown')")===false,
  "campi sconosciuti del backup scartati");
ok(JSON.parse(winImport.localStorage.getItem(KEY)).mastery["1"]===42,
  "stato importato salvato nello storage");
ok(winImport.document.getElementById("headPctTxt").textContent==="0/118 padroneggiati",
  "sezione Progressi aggiornata dopo l'import");
ok(winImport.document.getElementById("storageWarning").hidden,
  "import riuscito senza lasciare l'avviso di errore");

const winImportBad=makeApp();
const beforeBad=ev(winImportBad, "JSON.stringify(state)");
ok(ev(winImportBad, `applyImportedState(${JSON.stringify(JSON.stringify({version:99,mastery:{1:99}}))})`)===false,
  "versione futura rifiutata durante l'import");
ok(ev(winImportBad, "JSON.stringify(state)")===beforeBad,
  "import rifiutato non modifica lo stato corrente");
ok(/non supportata/.test(winImportBad.__lastAlert||""),
  "import di versione futura spiega il motivo del rifiuto", winImportBad.__lastAlert);
ok(ev(winImportBad, "applyImportedState('{non-json')")===false &&
   /JSON valido/.test(winImportBad.__lastAlert||""),
  "import JSON malformato rifiutato con messaggio");

/* "Cancella tutto" con una casella selezionata non deve lasciare l'input attivo */
click(win, view(win, "write"));
click(win, d.querySelector('#wtable .cell[data-z="5"]'));
click(win, view(win, "stats"));
click(win, d.getElementById("resetAll"));
ok(d.getElementById("wCellInput").disabled === true, "dopo 'Cancella tutto' l'input è disabilitato");
ok(d.querySelectorAll("#wtable .cell.sel").length === 0, "nessuna selezione residua");
ok(d.querySelector('#ptable .cell[data-z="1"]').getAttribute("aria-current") === "true" &&
   !d.querySelector('#ptable .cell[data-z="5"]').hasAttribute("aria-current"),
  "dopo il reset aria-current torna all'elemento iniziale");
ok(d.getElementById("wMsg").textContent === "", "dopo 'Cancella tutto' via il messaggio sotto la tavola vuota",
  d.getElementById("wMsg").textContent);

/* "Cancella tutto" con un quiz aperto deve chiuderlo (come le flashcard) */
click(win, view(win, "quiz"));
click(win, d.getElementById("startQuiz"));
ok(!d.getElementById("quizStage").classList.contains("hidden"), "quiz in corso prima dell'azzeramento");
click(win, view(win, "stats"));
click(win, d.getElementById("resetAll"));
ok(d.getElementById("quizStage").classList.contains("hidden"), "dopo 'Cancella tutto' il quiz aperto è chiuso");
ok(!d.getElementById("quizSetup").classList.contains("hidden"), "dopo 'Cancella tutto' torna la schermata di avvio");
ok(ev(win, "quiz.i") === 0 && ev(win, "quiz.wrong.length") === 0, "sessione quiz azzerata");
ok(d.getElementById("wrongCount").textContent === "0", "contatore errori azzerato", d.getElementById("wrongCount").textContent);

/* stato corrotto: box fuori scala */
const win2 = makeApp(JSON.stringify({ mastery: {}, leitner: { "1": 99 }, due: {}, quiz: { correct: 1, wrong: 1, history: [] }, write: { seqBest: 3, solved: {} }, wrongZ: [999] }));
const d2 = win2.document;
ok(win2.__errors.length === 0, "nessun crash con box=99", win2.__errors.join("|"));
click(win2, view(win2, "stats"));
const rows2 = [...d2.querySelectorAll("#boxStats .catbar")].map(r => r.querySelector("span").textContent);
ok(rows2.length === 5, "box corrotto: righe sempre 5", "righe=" + rows2.length + " -> " + rows2.join("/"));
ok(!rows2.some(t => /undefined|NaN/.test(t)), "box corrotto: nessuna etichetta undefined/NaN", rows2.join("/"));

/* chiave leitner fantasma (es. 999): non è un elemento, non va contata nei mazzi */
const win8 = makeApp(JSON.stringify({ leitner: { 1: 0, 999: 3 } }));
click(win8, view(win8, "stats"));
const boxCounts8 = [...win8.document.querySelectorAll("#boxStats .catbar")]
  .map(r => +r.querySelector(".pct").textContent);
ok(boxCounts8.reduce((a, b) => a + b, 0) === 1,
  "chiave leitner fantasma non conteggiata nei mazzi", JSON.stringify(boxCounts8));
ok(win8.document.querySelectorAll("#statCards .stat")[4].querySelector(".v").textContent === "1",
  "'Elementi nelle flashcard' conta solo chiavi di elementi reali",
  win8.document.querySelectorAll("#statCards .stat")[4].querySelector(".v").textContent);

/* chiavi non canoniche/proprietà ereditate e numeri troppo grandi */
const winEdges = makeApp(JSON.stringify({
  mastery:{toString:50, "01":100}, leitner:{toString:3, "01":2, 1:1},
  due:{toString:1, "01":2, 1:3, 9:Number.MAX_SAFE_INTEGER},
  quiz:{correct:1e308, wrong:1e308, history:[
    {d:Date.now(),score:0,total:0,wrong:[]},
    {d:Date.now(),score:1180,total:Number.MAX_SAFE_INTEGER,wrong:[]},
    {d:Date.now(),score:0,total:1,wrong:[26,26,27]},
    {d:Date.now(),score:0,total:1,answered:true,wrong:[]}
  ]},
  write:{seqBest:0, solved:{}}, wrongZ:[]
}));
ok(ev(winEdges, "JSON.stringify(state.leitner)") === '{"1":1}',
  "mappe sanitizzate: solo chiavi canoniche di elementi reali",
  ev(winEdges, "JSON.stringify(state.leitner)"));
ok(ev(winEdges, "JSON.stringify(state.due)") === '{"1":3}',
  "scadenze oltre il massimo configurabile scartate",
  ev(winEdges, "JSON.stringify(state.due)"));
ok(ev(winEdges, "JSON.stringify([state.quiz.correct,state.quiz.wrong,state.quiz.history.length,state.quiz.history[0].total])") === "[0,0,2,118]",
  "contatori enormi scartati, quiz vuoti rimossi e totali clampati a 118");
ok(ev(winEdges, "JSON.stringify(state.quiz.history[1].wrong)") === "[26]",
  "errori storici deduplicati e limitati al numero di domande",
  ev(winEdges, "JSON.stringify(state.quiz.history[1].wrong)"));
click(winEdges, view(winEdges, "stats"));
ok(!/Infinity|NaN/.test(winEdges.document.getElementById("statCards").textContent),
  "nessun totale impossibile nelle statistiche");

/* lo storico deve rispettare gli invarianti interi, anche su dati importati */
const winStrictHistory = makeApp(JSON.stringify({
  quiz:{history:[
    {d:Date.now(),score:20,total:4,answered:4,wrong:[26]},
    {d:Date.now(),score:10.5,total:4,answered:4,wrong:[]},
    {d:Date.now(),score:-10,total:4,answered:4,wrong:[]}
  ]}
}));
ok(ev(winStrictHistory, "JSON.stringify(state.quiz.history.map(h=>[h.score,h.total,h.answered]))")
   === '[[20,4,4]]',
  "storico: score frazionari o negativi rifiutati",
  ev(winStrictHistory, "JSON.stringify(state.quiz.history)"));

/* versioni non supportate: avviso, stato predefinito e possibilità di importare */
const winFuture=makeApp(JSON.stringify({version:99,mastery:{1:99},extra:"futuro"}));
const futureWarning=winFuture.document.getElementById("storageWarning");
ok(winFuture.__errors.length===0, "stato con versione futura avviato senza crash", winFuture.__errors.join("|"));
ok(ev(winFuture, "JSON.stringify([state.version,mastery(1),state.unknown])")==='[1,0,null]',
  "versione futura non reinterpretata e campi sconosciuti scartati",
  ev(winFuture, "JSON.stringify(state)"));
ok(!futureWarning.hidden && /non supportata/.test(futureWarning.textContent),
  "versione futura comunicata senza perdere il backup grezzo su disco");
ok(futureWarning.dataset.kind==="version",
  "avviso iniziale distingue lo schema non supportato");
ok(!winFuture.document.getElementById("storageImport").hidden,
  "avviso versione futura offre l'import di un backup compatibile");
const futureRaw=winFuture.localStorage.getItem(KEY);
ok(ev(winFuture, "addMastery(1,10); save()")===false,
  "salvataggio automatico bloccato per uno stato con versione futura");
ok(winFuture.localStorage.getItem(KEY)===futureRaw,
  "stato con versione futura non viene sovrascritto da un'azione dell'app");
ok(futureWarning.dataset.kind==="version" && /non verranno sovrascritti/.test(futureWarning.textContent),
  "tentativo di salvataggio spiega come sbloccare il ripristino", futureWarning.textContent);
click(winFuture, view(winFuture, "stats"));
click(winFuture, winFuture.document.getElementById("resetAll"));
ok(ev(winFuture, "storageWriteBlocked")===false && futureWarning.hidden,
  "azzeramento esplicito sblocca e chiude lo stato non supportato");
ok(JSON.parse(winFuture.localStorage.getItem(KEY)).version===1,
  "azzeramento sostituisce lo stato futuro solo dopo conferma");

/* membri null in localStorage: l'app deve avviarsi lo stesso */
const win5 = makeApp(JSON.stringify({ mastery: null, leitner: null, due: null, quiz: null, write: null, wrongZ: null }));
ok(win5.__errors.length === 0, "nessun crash con membri null in localStorage", win5.__errors.join("|"));
ok(ev(win5, "JSON.stringify([typeof state.mastery, typeof state.leitner, typeof state.due, Array.isArray(state.wrongZ), typeof state.write.solved])")
    === '["object","object","object",true,"object"]',
  "membri null rimpiazzati dai default",
  ev(win5, "JSON.stringify([typeof state.mastery, typeof state.leitner, typeof state.due, Array.isArray(state.wrongZ), typeof state.write.solved])"));
click(win5, view(win5, "stats"));
ok(win5.document.querySelectorAll("#statCards .stat").length === 6,
  "statistiche renderizzate con stato precedentemente null");

/* write.solved corrotto: solo il flag canonico 1 viene accettato; valori
   numerici non validi, booleani e chiavi fantasma non devono svelare risposte */
const winSolved = makeApp(JSON.stringify({ write:{seqBest:0, solved:{"1":0,"2":-1,"3":0.5,"4":"1","5":"01", "999":1}} }));
ok(ev(winSolved, "JSON.stringify(state.write.solved)") === '{"4":1}',
  "solved corrotto ripulito (solo flag 1 di elementi reali)",
  ev(winSolved, "JSON.stringify(state.write.solved)"));
click(winSolved, view(winSolved, "write"));
ok(winSolved.document.querySelectorAll("#wtable .cell.solved").length === 1,
  "solved corrotto: solo la casella valida risolta",
  String(winSolved.document.querySelectorAll("#wtable .cell.solved").length));
ok(winSolved.document.querySelector('#wtable .cell[data-z="2"]').classList.contains("blank"),
  "solved corrotto: la casella He resta vuota (niente risposta svelata)");
ok(winSolved.document.getElementById("wFilled").textContent === "1",
  "solved corrotto: contatore basato solo sulle caselle valide",
  winSolved.document.getElementById("wFilled").textContent);

/* membri ANNIDATI null: la sanitizzazione deve scendere di un livello */const win6 = makeApp(JSON.stringify({
  write:{seqBest:3, solved:null},
  quiz:{correct:1, wrong:1, history:null},
  mastery:{1:"abc"}, leitner:{1:"abc"}
}));
const d6 = win6.document;
ok(win6.__errors.length === 0, "nessun crash con membri annidati null", win6.__errors.join("|"));
click(win6, view(win6, "stats"));
ok(d6.querySelectorAll("#statCards .stat").length === 6,
  "statistiche renderizzate con write.solved/quiz.history null");
ok(!/NaN/.test(d6.getElementById("statCards").textContent),
  "nessun NaN con mastery non numerico", d6.getElementById("statCards").textContent.replace(/\s+/g, " "));
ok(win6.document.querySelectorAll("#boxStats .catbar").length === 5,
  "righe mazzi con leitner non numerico",
  [...win6.document.querySelectorAll("#boxStats .catbar")].map(r => r.textContent).join("/"));

/* padroneggio fuori scala in localStorage: clamp a 0..100 già al caricamento */
const win10 = makeApp(JSON.stringify({ mastery: { "1": 500, "2": -80, "3": "9999" } }));
ok(win10.__errors.length === 0, "nessun crash con mastery fuori scala", win10.__errors.join("|"));
ok(ev(win10, "JSON.stringify([mastery(1),mastery(2),mastery(3)])") === "[100,0,100]",
  "mastery fuori scala clamped a 0..100 al caricamento",
  ev(win10, "JSON.stringify([mastery(1),mastery(2),mastery(3)])"));
const avg10 = ev(win10, "avgMastery()");
ok(avg10 >= 0 && avg10 <= 100, "padroneggio medio sempre 0..100", "avg=" + avg10);
click(win10, view(win10, "table"));
const width10 = win10.document.querySelector('#ptable .cell[data-z="1"] .mbar').style.width;
ok(width10 === "100%", "barretta padroneggio mai oltre 100%", "width=" + width10);

/* contatori salvati come stringhe numeriche: isNum le considera valide, ma vanno
   convertite — altrimenti correct+wrong nelle statistiche fa "5"+"3" = "53" domande */
const winNum = makeApp(JSON.stringify({
  quiz: { correct: "5", wrong: "3", history: [] },
  write: { seqBest: "42", solved: {} }
}));
ok(ev(winNum, "JSON.stringify([typeof state.quiz.correct, typeof state.quiz.wrong, typeof state.write.seqBest])")
    === '["number","number","number"]',
  "contatori quiz/sequenza stringa numerica convertiti in numero",
  ev(winNum, "JSON.stringify([typeof state.quiz.correct, typeof state.quiz.wrong, typeof state.write.seqBest])"));
click(winNum, view(winNum, "stats"));
const statTexts = [...winNum.document.querySelectorAll("#statCards .stat")]
  .map(s => s.textContent.replace(/\s+/g, " "));
const quizStat = statTexts.find(t => /Quiz risposti/.test(t)) || "";
ok(/^63%Quiz risposti bene \(8 domande\)/.test(quizStat),
  "statistiche quiz: 5+3 = 8 domande, nessuna concatenazione di stringhe", quizStat);
ok(statTexts.some(t => /^42Posizione massima nella sequenza/.test(t)),
  "miglior posizione sequenza renderizzata come numero", statTexts.join(" | "));

/* storico con una voce priva del campo "wrong" */
const win7 = makeApp(JSON.stringify({ quiz:{correct:1, wrong:0, history:[{d:Date.now(), score:10, total:10}]} }));
click(win7, view(win7, "stats"));
ok(/1\/10/.test(win7.document.getElementById("quizHist").textContent),
  "storico senza 'wrong' renderizzato", win7.document.getElementById("quizHist").textContent.replace(/\s+/g, " "));

/* contatori e storico fuori scala: clampati a valori plausibili, altrimenti
   le statistiche mostrano "67% su -15 domande", "Posizione 1000000000" e "Invalid Date" */
const TS_OK = 1700000000000;   // timestamp fisso: Date.now() nel seed e nell'attesa divergerebbero
const winClamp = makeApp(JSON.stringify({
  mastery: {}, leitner: {}, due: {},
  quiz: { correct: -10, wrong: -5, history: [
    { d: 1e30, score: 7, total: 3, wrong: [999, 26], answered: 99 },
    { d: TS_OK, score: 500, total: 10, wrong: [7] },
    { d: TS_OK + 1, score: 100, total: 10, answered: 1, wrong: [1, 2, 3] }
  ] },
  write: { seqBest: 1e9, solved: {} },
  wrongZ: []
}));
ok(ev(winClamp, "JSON.stringify([state.quiz.correct, state.quiz.wrong])") === "[0,0]",
  "contatori quiz negativi azzerati", ev(winClamp, "JSON.stringify([state.quiz.correct, state.quiz.wrong])"));
ok(ev(winClamp, "state.write.seqBest") === 118, "seqBest clampato a 118",
  String(ev(winClamp, "state.write.seqBest")));
ok(ev(winClamp, "JSON.stringify(state.quiz.history.map(h=>[h.d,h.score,h.total,h.answered,h.wrong]))")
  === JSON.stringify([[TS_OK+1,10,10,1,[]], [TS_OK,100,10,10,[]]]),
  "storico coerente e ordinato dal più recente: data invalida scartata, answered derivato e Z in eccesso rimosso",
  ev(winClamp, "JSON.stringify(state.quiz.history.map(h=>[h.d,h.score,h.total,h.answered,h.wrong]))"));
click(winClamp, view(winClamp, "stats"));
const clampStats = winClamp.document.getElementById("statCards").textContent
  + winClamp.document.getElementById("quizHist").textContent;
ok(!/Invalid Date/.test(clampStats) && !/1000000000/.test(clampStats) && !/\(-\d+ domande\)/.test(clampStats),
  "nessun valore impossibile renderizzato nelle statistiche", clampStats.replace(/\s+/g, " "));

/* JSON malformato */
const win3 = makeApp("{non-json");
ok(win3.__errors.length === 0, "nessun crash con JSON malformato", win3.__errors.join("|"));
ok(ev(win3, "state.quiz.correct") === 0, "stato di default ripristinato");
ok(!win3.document.getElementById("storageWarning").hidden,
  "JSON malformato non viene più ignorato silenziosamente");
ok(!win3.document.getElementById("storageImport").hidden,
  "stato malformato: avviso con import del backup compatibile");
ok(ev(win3, "save()") === true && win3.document.getElementById("storageWarning").hidden,
  "il primo salvataggio valido sostituisce lo stato corrotto e chiude l'avviso");

/* wrongZ con Z inesistente: scartato al caricamento, così il contatore
   "Ripassa gli errori (n)" non promette errori che poi non ci sono */
const win4 = makeApp(JSON.stringify({ wrongZ: [1234] }));
click(win4, view(win4, "quiz"));
ok(ev(win4, "JSON.stringify(state.wrongZ)") === "[]", "wrongZ fantasma scartato al caricamento",
  ev(win4, "JSON.stringify(state.wrongZ)"));
ok(win4.document.getElementById("wrongCount").textContent === "0",
  "contatore errori ignora gli Z inesistenti", win4.document.getElementById("wrongCount").textContent);
click(win4, win4.document.getElementById("quizWrongBtn"));
ok(/Nessun elemento/.test(win4.__lastAlert || "") || win4.document.getElementById("quizStage").classList.contains("hidden"),
  "wrongZ con Z inesistente gestito senza crash", win4.__lastAlert);

/* wrongZ con duplicati o voci non numeriche: deduplicato e ripulito al caricamento */
const win9 = makeApp(JSON.stringify({ wrongZ: [26, 26, "27", null, "abc"] }));
ok(ev(win9, "JSON.stringify(state.wrongZ)") === "[26,27]",
  "wrongZ ripulito (duplicati e non numerici tolti)", ev(win9, "JSON.stringify(state.wrongZ)"));
click(win9, view(win9, "quiz"));
ok(win9.document.getElementById("wrongCount").textContent === "2",
  "contatore errori = sole voci valide", win9.document.getElementById("wrongCount").textContent);

/* ================= VARI ================= */
section("Vari");
/* il pannello dettagli deve seguire il padroneggio, non restare indietro */
ev(win, "renderDetail(26)");
const mDetailBefore = ev(win, "mastery(26)");
ev(win, "addMastery(26,7); refreshCellMastery(26)");
ok(new RegExp("Padroneggio\\s*" + (mDetailBefore + 7) + "%").test(d.getElementById("detail").textContent),
  "pannello dettagli aggiornato dopo un cambio di padroneggio",
  d.querySelector("#detail .kv").textContent.replace(/\s+/g, " "));
ok(new RegExp("padroneggiamento " + (mDetailBefore + 7) + "%")
  .test(d.querySelector('#ptable .cell[data-z="26"]').getAttribute("aria-label") || ""),
  "aria-label della cella aggiornato insieme al padroneggio",
  d.querySelector('#ptable .cell[data-z="26"]').getAttribute("aria-label"));

/* booleani in localStorage: scartati (mastery {1:true} e wrongZ [true,26]) */
const win11 = makeApp(JSON.stringify({ mastery: { "1": true }, wrongZ: [true, 26] }));
ok(ev(win11, "mastery(1)") === 0, "mastery booleano scartato", String(ev(win11, "mastery(1)")));
ok(ev(win11, "JSON.stringify(state.wrongZ)") === "[26]", "wrongZ booleano scartato",
  ev(win11, "JSON.stringify(state.wrongZ)"));

ok(html.includes('lang="it"'), "pagina dichiara lang=it");
ok(ev(win, "ELEMENTS.length") === 118, "118 elementi");
ok(ev(win, "new Set(ELEMENTS.map(e=>e.sym)).size") === 118, "simboli univoci");
ok(ev(win, "ELEMENTS.every(e=>e.cfg.split(' ').reduce((a,t)=>a+ +t.match(/(\\d+)$/)[1],0)===e.z)") === true,
  "somma elettroni = Z per tutti e 118");

/* ================= NAVIGAZIONE E ACCESSIBILITÀ ================= */
section("Navigazione e accessibilità");
/* una vista senza sezione corrispondente non deve nascondere la pagina intera */
ev(win, 'go("non-esiste")');
const activeViews = () => [...d.querySelectorAll("main section.view")]
  .filter(s => s.classList.contains("active")).map(s => s.id);
ok(activeViews().length === 1, "go() con vista ignota: nessuno schermo vuoto", activeViews().join(","));
ev(win, 'go("table")');

/* aria-current: uno screen reader deve poter annunciare la vista attiva */
click(win, view(win, "quiz"));
ok(view(win, "quiz").getAttribute("aria-current") === "true",
  "aria-current sulla vista attiva", String(view(win, "quiz").getAttribute("aria-current")));
ok(!view(win, "table").hasAttribute("aria-current"),
  "aria-current tolto alle viste inattive", String(view(win, "table").getAttribute("aria-current")));
ok(d.querySelector("#view-quiz h2").getAttribute("tabindex") === "-1",
  "heading della vista predisposto per ricevere il focus al cambio vista");

/* le regioni che cambiano in corso d'opera devono essere annunciate */
["detail", "qFeedback", "wMsg", "seqHint", "cardBack"].forEach(id => {
  const el = d.getElementById(id);
  ok(!!el && el.getAttribute("aria-live") === "polite", "aria-live=polite su #" + id,
    el ? String(el.getAttribute("aria-live")) : "elemento mancante");
});

/* "Termina" deve poter abbandonare il quiz anche prima della prima risposta */
click(win, d.getElementById("startQuiz"));
ok(!d.getElementById("qEnd").classList.contains("hidden"),
  "Termina visibile già prima di rispondere", d.getElementById("qEnd").className);
const histBeforeQuit = ev(win, "state.quiz.history.length");
click(win, d.getElementById("qEnd"));
ok(ev(win, "state.quiz.history.length") === histBeforeQuit,
  "abbandono senza risposte: nessuna voce spuria nello storico", String(histBeforeQuit));
ok(!d.getElementById("quizDone").classList.contains("hidden"), "abbandono: riepilogo mostrato");

/* lo scorrimento al cambio vista rispetta prefers-reduced-motion */
const scrollCalls=[];
win.scrollTo=opts=>scrollCalls.push(opts);
win.matchMedia=()=>({matches:true});
ev(win, 'go("table")');
ok(scrollCalls.at(-1).behavior==="auto", "reduced motion: cambio vista senza animazione", JSON.stringify(scrollCalls.at(-1)));
win.matchMedia=()=>({matches:false});
ev(win, 'go("stats")');
ok(scrollCalls.at(-1).behavior==="smooth", "senza reduced motion: cambio vista con animazione", JSON.stringify(scrollCalls.at(-1)));
ok(/#detail\{position:static\}/.test(css), "pannello dettagli non sticky nel layout mobile");

console.log("\n================ RISULTATO ================");
console.log("PASS: " + pass + "   FAIL: " + fail);
if (failures.length) { console.log("\nFallimenti:"); failures.forEach(f => console.log("  x " + f)); }
process.exit(fail ? 1 : 0);
