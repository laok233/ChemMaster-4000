module.exports = context => {
  const {win, d, html, css, ok, section, ev, click, type} = context;
  /* ================= INIT ================= */
  section("Init / rendering");
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

  /* un numero di massa tra parentesi quadre non va presentato come peso in u */
  click(win, d.querySelector('#ptable .cell[data-z="26"]'));
  const feDetail=d.getElementById("detail").textContent.replace(/\s+/g," ");
  ok(/Massa atomica55\.845 u/.test(feDetail), "dettaglio Fe mostra il peso atomico in unità atomica", feDetail);
  click(win, d.querySelector('#ptable .cell[data-z="43"]'));
  const tcDetail=d.getElementById("detail").textContent.replace(/\s+/g," ");
  ok(/Numero di massa\[97\]/.test(tcDetail) && !/\[97\] u/.test(tcDetail),
    "dettaglio Tc distingue il numero di massa dal peso atomico", tcDetail);

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
};
