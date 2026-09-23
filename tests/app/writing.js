module.exports = context => {
  const {win, d, ok, section, ev, click, type, keyOn, view, makeApp} = context;
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
};
