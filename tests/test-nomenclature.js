// Test della guida di nomenclatura: struttura, dati, ricerca e filtri.
// Esecuzione: bun tests/test-nomenclature.js
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "pages/nomenclatura.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const dataCode = fs.readFileSync(path.join(ROOT, "scripts/nomenclature/data.js"), "utf8");
const appCode = fs.readFileSync(path.join(ROOT, "scripts/nomenclature/app.js"), "utf8");
const testHtml = html.replace('<link rel="stylesheet" href="../assets/css/style.css">', `<style>${css}</style>`);

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
  url: "http://localhost/pages/nomenclatura.html"
});
const win = dom.window;
const d = win.document;
const errors = [];
try {
  win.scrollTo = () => {};
  win.HTMLElement.prototype.focus = function () {};
  win.eval(dataCode + "\n" + appCode +
    ";globalThis.__nomenclatureData=NOMENCLATURE_CARDS;globalThis.__nomenclatureUpdateIndex=updateNomenclatureIndex;" +
    "globalThis.__nomenclatureBuildPool=buildNomenclatureQuizPool;globalThis.__nomenclatureFormulaKey=nomenclatureFormulaKey;" +
    "globalThis.__nomenclatureMakeQuestion=makeNomenclatureQuizQuestion;globalThis.__nomenclatureFinishQuiz=finishNomenclatureQuiz;" +
    "globalThis.__nomenclatureQuiz=nomenclatureQuiz;");
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
const skipLink=d.querySelector('body > a.skip-link[href="#main-content"]');
ok(!!skipLink && d.body.firstElementChild===skipLink && d.getElementById("main-content")?.tabIndex===-1,
  "skip link iniziale verso il contenuto della nomenclatura");
ok(html.includes('<link rel="stylesheet" href="../assets/css/style.css">') && !html.includes("<style>"),
  "CSS esterno senza stili inline");
const scriptSources = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
ok(JSON.stringify(scriptSources) === JSON.stringify(["../scripts/nomenclature/data.js", "../scripts/nomenclature/app.js"]) &&
  !html.includes("<script>"), "script esterni separati e caricati nell'ordine", scriptSources.join(","));
ok(!!d.querySelector('a[href="../index.html"]') && /Menu/.test(d.querySelector('a[href="../index.html"]').textContent),
  "link al menu presente");
ok(!d.getElementById("nomenclatureSearch").hasAttribute("aria-label"),
  "il campo di ricerca ha un'etichetta visibile associata");
ok(d.querySelector("label.nomenclature-search-label #nomenclatureSearch"), "etichetta del campo di ricerca");
ok(d.getElementById("nomenclatureStatus").getAttribute("aria-live") === "polite" &&
   !d.getElementById("nomenclatureStatus").classList.contains("sr-only"),
  "conteggio dei risultati annunciato e visibile");
ok(d.querySelectorAll("#nomenclatureContent article").length === 14, "14 schede iniziali",
  String(d.querySelectorAll("#nomenclatureContent article").length));
ok(d.getElementById("nomenclatureBootstrap").hidden,
  "il messaggio di bootstrap viene nascosto dopo l'inizializzazione");
ok(d.querySelectorAll("#nomenclatureContent details").length === 14, "ogni scheda ha un pannello espandibile");
ok(d.querySelectorAll("#nomenclatureIndex a").length === 14, "indice con un link per ogni scheda");
ok(!d.querySelector("#nomenclatureIndex a[aria-current]"),
  "l'indice non marca una posizione corrente senza un hash reale");
ok([...d.querySelectorAll("#nomenclatureFilters button")].every(button =>
  button.type === "button" && button.hasAttribute("aria-pressed")),
"filtri navigabili da tastiera con stato esposto");
ok(d.querySelectorAll("#nomenclatureContent table caption").length === 6, "tabelle di riferimento presenti");
const cardHeader=d.querySelector(".nomenclature-card-header");
ok(win.getComputedStyle(cardHeader).position !== "sticky" &&
   win.getComputedStyle(cardHeader).display === "block",
  "header delle card non eredita lo sticky del header pagina");
const nomenclatureTabs = [...d.querySelectorAll("#nomenclatureTabs [data-nomenclature-view]")];
ok(nomenclatureTabs.length === 2 &&
    nomenclatureTabs.map(button => button.textContent).join(",") === "Guida,Quiz",
  "Guida e Quiz sono schede nella barra superiore", nomenclatureTabs.map(button => button.textContent).join(","));
ok(nomenclatureTabs[0].classList.contains("active") &&
    nomenclatureTabs[0].getAttribute("aria-current") === "true" &&
    !d.getElementById("nomenclatureGuideView").hidden && d.getElementById("nomenclatureQuizView").hidden,
  "all'avvio è attiva la scheda Guida");
ok(!!d.getElementById("nomenclatureQuiz") && d.querySelector("label.ctl #nomenclatureQuizScope") &&
    d.querySelector("label.ctl #nomenclatureQuizLength") &&
    [...d.querySelectorAll("#nomenclatureQuizScope option")].map(option => option.value).join(",") ===
      "all,traditional,inorganic,organic",
  "sezione quiz presente con ambiti derivati dagli stessi filtri della guida");
ok([...d.querySelectorAll("#nomenclatureQuizLength option")].map(option => option.value).join(",") === "5,10,15",
  "quiz: durate da 5, 10 o 15 domande");
ok(d.getElementById("nomenclatureQuizSetup") &&
    !d.getElementById("nomenclatureQuizSetup").classList.contains("hidden") &&
    d.getElementById("nomenclatureQuizStage").classList.contains("hidden") &&
    d.getElementById("nomenclatureQuizDone").classList.contains("hidden"),
  "quiz: la configurazione è pronta nella propria scheda");
ok(/^[1-9][0-9]* esempi$/.test(d.getElementById("nomenclatureQuizPoolCount").textContent),
  "quiz: numero di esempi disponibili annunciato", d.getElementById("nomenclatureQuizPoolCount").textContent);
ok(d.getElementById("nomenclatureQuizFeedback").getAttribute("role") === "status" &&
    d.getElementById("nomenclatureQuizProgress").getAttribute("aria-live") === "polite" &&
    d.getElementById("nomenclatureQuizMeterTrack").getAttribute("role") === "progressbar",
  "quiz: feedback e avanzamento accessibili");
const cardData = win.__nomenclatureData;
ok(new Set(cardData.map(card => card.id)).size === cardData.length,
  "ID delle schede univoci", cardData.map(card => card.id).join(","));
ok(cardData.every(card => ["inorganic", "organic"].includes(card.area) &&
    (card.traditional===true || card.traditional===undefined)),
  "aree e flag tradizionali validi");
const hydrochloricExamples=cardData.flatMap(card => card.examples)
  .filter(example => example.name === "acido cloridrico");
ok(hydrochloricExamples.length > 0 && hydrochloricExamples.every(example => example.formula === "HCl(aq)"),
  "HCl acido conserva la fase acquosa nel dataset",
  hydrochloricExamples.map(example => example.formula).join(","));
const acidCard=cardData.find(card => card.id === "acidi");
ok(acidCard && !/numero di atomi di ossigeno.*-oso.*-ico/.test(acidCard.rule) &&
   acidCard.examples.some(example => example.formula === "HClO₂"),
  "regola degli ossiacidi evita il conteggio come legge universale");
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
search("acido organica");
ok(visibleCards().some(card => card.id === "nom-acidi-esteri"),
  "ricerca AND tra contenuto e area", visibleCards().map(card => card.id).join(","));
click(d.getElementById("clearNomenclature"));
search("ferro inorganica");
ok(visibleCards().length > 0 && visibleCards().every(card => card.dataset.area === "inorganic"),
  "ricerca con un termine nell'area e uno nel contenuto", visibleCards().map(card => card.id).join(","));
click(d.getElementById("clearNomenclature"));
ok(d.getElementById("nomenclatureSearch").value === "" && visibleCards().length === 14,
  "Mostra tutte azzera ricerca e filtri");
ok(d.getElementById("clearNomenclature").disabled, "pulsante reset disabilitato quando non serve");

search("fenolo");
ok(visibleCards().length === 1 && visibleCards()[0].id === "nom-alcoli" &&
   d.getElementById("nomenclatureStatus").textContent === "1 scheda mostrata su 14.",
  "ricerca di un esempio organico e conteggio singolare",
  `${visibleCards().map(card => card.id).join(",")} / ${d.getElementById("nomenclatureStatus").textContent}`);
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
search("composto binario");
ok(![...d.querySelectorAll('#nomenclatureIndex a[aria-current="location"]')]
  .some(link => link.closest("li").hidden),
  "un link indice nascosto non mantiene aria-current");
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
ok([...d.querySelectorAll(".nomenclature-table-wrap")].every(wrapper =>
  wrapper.getAttribute("role") === "region" && wrapper.tabIndex === 0 && wrapper.hasAttribute("aria-label")),
"tabelle orizzontali focalizzabili e nominate");
ok([...d.querySelectorAll(".nomenclature-card")].every(card => card.tabIndex === -1),
  "card indicizzabili per il focus programmatico");
ok(/toluene/.test(d.querySelector("#nom-organici-tradizionali").textContent) &&
   /metilbenzene/.test(d.querySelector("#nom-organici-tradizionali").textContent) &&
   /acido etanoico/.test(d.querySelector("#nom-organici-tradizionali").textContent),
  "confronti tra nomi organici tradizionali e sistematici");
ok(/ossido ferroso/.test(d.querySelector("#nom-metalli-tradizionali").textContent) &&
   /cloruro ferrico/.test(d.querySelector("#nom-metalli-tradizionali").textContent),
  "esempi dei suffissi tradizionali dei metalli");

section("Nomenclatura: quiz");
const quizState = win.__nomenclatureQuiz;
const quizScope = d.getElementById("nomenclatureQuizScope");
const quizLength = d.getElementById("nomenclatureQuizLength");
const quizTab = nomenclatureTabs.find(button => button.dataset.nomenclatureView === "quiz");
click(quizTab);
ok(d.getElementById("nomenclatureGuideView").hidden && !d.getElementById("nomenclatureQuizView").hidden &&
    quizTab.getAttribute("aria-current") === "true" && !nomenclatureTabs[0].hasAttribute("aria-current"),
  "la scheda Quiz della barra superiore apre il quiz e aggiorna lo stato attivo");
ok(quizLength.value === "10", "il quiz parte da una durata di 10 domande");
click(d.getElementById("nomenclatureQuizStart"));
ok(!d.getElementById("nomenclatureQuizStage").classList.contains("hidden") &&
    d.getElementById("nomenclatureQuizSetup").classList.contains("hidden"),
  "avvio: il quiz passa dalla configurazione alla domanda");
ok(quizState.questions.length === 10 && quizState.index === 0 &&
   d.getElementById("nomenclatureQuizMeterTrack").getAttribute("aria-valuenow") === "10",
  "quiz avviato con 10 domande e avanzamento esposto", String(quizState.questions.length));
ok(quizState.questions.every(question => question.options.length === 4) &&
    d.querySelectorAll("#nomenclatureQuizOptions .opt").length === 5,
  "ogni domanda offre 4 alternative e Non so");
ok(quizState.questions.every(question => new Set(question.options).size === 4) &&
    quizState.questions.every(question => question.options.includes(question.answer)),
  "alternative univoche e risposta presente");
const exampleNames = new Set(cardData.flatMap(card => card.examples.map(example => example.name)));
const exampleFormulas = new Set(cardData.flatMap(card => card.examples.map(example => example.formula)));
const canonicalPool=win.__nomenclatureBuildPool("all");
ok(new Set(canonicalPool.map(entry => entry.canonicalId)).size === canonicalPool.length &&
   canonicalPool.every(entry => entry.acceptedNames.includes(entry.name)),
  "pool quiz deduplicato per formula canonica con alias espliciti",
  `${canonicalPool.length} voci / ${new Set(canonicalPool.map(entry => entry.canonicalId)).size} canoniche`);
const traditionalPool=win.__nomenclatureBuildPool("traditional");
ok(new Set(traditionalPool.map(entry => entry.canonicalId)).size === traditionalPool.length,
  "il pool dei nomi tradizionali non contiene formule duplicate",
  `${traditionalPool.length} voci`);
const acetic=canonicalPool.find(entry => entry.formula === "CH₃–COOH");
const aceticQuestion=win.__nomenclatureMakeQuestion(acetic,canonicalPool,0);
ok(aceticQuestion.options.includes("acido etanoico") &&
   !aceticQuestion.options.includes("acido acetico"),
  "un alias non viene offerto come distrattore chimicamente ambiguo");
ok(aceticQuestion.acceptedAnswers.includes("acido acetico"),
  "gli alias validi restano accettati dal modello del quiz");
ok(quizState.questions.every(question => question.options.every(option =>
    (question.direction === "formulaToName" ? exampleNames : exampleFormulas).has(option))),
  "le alternative contengono tutte nomi oppure tutte formule");
ok(quizState.questions[0].direction === "formulaToName" &&
    quizState.questions[1].direction === "nameToFormula",
  "domande alternate tra formula→nome e nome→formula");
d.dispatchEvent(new win.KeyboardEvent("keydown", { key:"1", code:"Digit1", ctrlKey:true, bubbles:true }));
ok(!quizState.answeredCurrent, "Ctrl+1 non risponde nel quiz di nomenclatura");

const firstQuestion = quizState.questions[0];
click([...d.querySelectorAll("#nomenclatureQuizOptions .opt")]
  .find(button => button.dataset.answer === firstQuestion.answer));
ok(quizState.correct === 1 && quizState.answered === 1 &&
    /Esatto!/.test(d.getElementById("nomenclatureQuizFeedback").textContent),
  "risposta corretta: punteggio e feedback aggiornati");
ok(d.querySelectorAll("#nomenclatureQuizOptions .opt.correct").length === 1 &&
    [...d.querySelectorAll("#nomenclatureQuizOptions .opt")].every(button => button.disabled),
  "dopo la risposta viene mostrata quella corretta e le opzioni sono bloccate");
click(d.getElementById("nomenclatureQuizNext"));
const secondQuestion = quizState.questions[1];
const wrongButton = [...d.querySelectorAll("#nomenclatureQuizOptions .opt")]
  .find(button => button.dataset.answer !== secondQuestion.answer);
click(wrongButton);
ok(quizState.correct === 1 && quizState.wrong.length === 1 &&
    wrongButton.classList.contains("wrong"),
  "risposta errata: il tentativo viene segnato e conteggiato");
click(d.getElementById("nomenclatureQuizNext"));
d.dispatchEvent(new win.KeyboardEvent("keydown", { key:"5", code:"Digit5", bubbles:true }));
ok(quizState.answeredCurrent && quizState.answered === 3 && quizState.wrong.length === 2,
  "il tasto 5 risponde Non so e lo registra come errore");
ok(d.querySelector("#nomenclatureQuizOptions .opt.skip").classList.contains("chosen"),
  "Non so viene evidenziato come scelta");
click(d.getElementById("nomenclatureQuizEnd"));
win.__nomenclatureFinishQuiz();
ok(d.getElementById("nomenclatureQuizStage").classList.contains("hidden") &&
    !d.getElementById("nomenclatureQuizDone").classList.contains("hidden") && quizState.finished,
  "Termina chiude il quiz e la fine sessione è idempotente");
ok(d.getElementById("nomenclatureQuizResult").textContent === "1/10" &&
    /^33% di risposte giuste/.test(d.getElementById("nomenclatureQuizSummary").textContent),
  "riepilogo calcolato sulle 3 risposte effettivamente date",
  d.getElementById("nomenclatureQuizSummary").textContent);
ok(d.querySelectorAll("#nomenclatureQuizWrong li").length === 2 &&
    !d.getElementById("nomenclatureQuizReview").hidden,
  "il riepilogo elenca i due errori da ripassare");
click(d.getElementById("nomenclatureQuizAgain"));
ok(!d.getElementById("nomenclatureQuizSetup").classList.contains("hidden") &&
    d.getElementById("nomenclatureQuizDone").classList.contains("hidden"),
  "Ricomincia torna alla configurazione");

quizScope.value = "inorganic";
quizScope.dispatchEvent(new win.Event("change", { bubbles:true }));
click(d.getElementById("nomenclatureQuizStart"));
ok(quizState.questions.every(question => question.area === "inorganic"),
  "il filtro Quiz solo inorganica limita il pool di domande");
click(d.getElementById("nomenclatureQuizEnd"));
ok(d.getElementById("nomenclatureQuizResult").textContent === "0/10" &&
    /^Nessuna risposta data/.test(d.getElementById("nomenclatureQuizSummary").textContent),
  "un quiz terminato senza risposte non mostra una percentuale falsa");
ok(d.getElementById("nomenclatureQuizReview").hidden,
  "senza errori non viene mostrato il riepilogo di ripasso");
click(d.querySelector("#nomenclatureQuizDone [data-nomenclature-view='guide']"));
ok(!d.getElementById("nomenclatureGuideView").hidden &&
    d.getElementById("nomenclatureQuizView").hidden &&
    nomenclatureTabs[0].getAttribute("aria-current") === "true",
  "il riepilogo permette di tornare alla Guida dalla barra in alto");

console.log("\n================ RISULTATO ================");
console.log("PASS: " + pass + "   FAIL: " + fail);
if (failures.length) {
  console.log("\nFallimenti:");
  failures.forEach(failure => console.log("  x " + failure));
}
process.exit(fail ? 1 : 0);
