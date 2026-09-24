module.exports = async context => {
  const {win, d, KEY, ok, section, ev, click, makeApp, view, settle} = context;
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
  const winConflict = await makeApp(conflictSeed);
  winConflict.localStorage.setItem(KEY, JSON.stringify(remoteState));
  const rejectedSave = await ev(winConflict, "addMastery(1,5); save()");
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
  await settle();
  ok(ev(winConflict, "mastery(1)") === 80 && conflictWarning.hidden,
    "ricarica esplicita risolve il conflitto dal disco");

  /* aggiornamento ricevuto da un'altra scheda senza conflicti locali */
  const winRemoteEvent = await makeApp(conflictSeed);
  const remoteRaw = JSON.stringify(remoteState);
  winRemoteEvent.localStorage.setItem(KEY, remoteRaw);
  ev(winRemoteEvent, `globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteRaw)},storageArea:localStorage}))`);
  await settle();
  ok(ev(winRemoteEvent, "mastery(1)") === 80,
    "evento storage aggiorna una tab che non ha modifiche locali");
  ok(winRemoteEvent.document.getElementById("storageWarning").hidden,
    "aggiornamento remoto silenzioso senza warning di conflitto");

  /* sessionStorage emette StorageEvent nello stesso ambito: non deve essere
     confuso con un aggiornamento della persistenza locale */
  const winSessionEvent = await makeApp(conflictSeed);
  winSessionEvent.localStorage.setItem(KEY, remoteRaw);
  ev(winSessionEvent, `globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteRaw)},storageArea:sessionStorage}))`);
  ok(ev(winSessionEvent, "mastery(1)") === 10 &&
     winSessionEvent.document.getElementById("storageWarning").hidden,
    "evento sessionStorage ignorato senza falso conflitto");

  /* un aggiornamento remoto non deve mescolarsi a una sessione ancora aperta */
  const winPendingEvent = await makeApp(conflictSeed);
  click(winPendingEvent, view(winPendingEvent, "cards"));
  click(winPendingEvent, winPendingEvent.document.getElementById("startCards"));
  winPendingEvent.localStorage.setItem(KEY, remoteRaw);
  ev(winPendingEvent, `globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteRaw)},storageArea:localStorage}))`);
  await settle();
  ok(ev(winPendingEvent, "mastery(1)") === 10 &&
     !winPendingEvent.document.getElementById("cardsStage").classList.contains("hidden"),
    "sessione aperta: aggiornamento remoto rimane in attesa");
  ok(winPendingEvent.document.getElementById("storageWarning").dataset.kind === "conflict",
    "sessione aperta: l'evento storage segnala un conflitto");
  click(winPendingEvent, winPendingEvent.document.getElementById("storageReload"));
  await settle();
  ok(ev(winPendingEvent, "mastery(1)") === 80 &&
     winPendingEvent.document.getElementById("cardsStage").classList.contains("hidden") &&
     ev(winPendingEvent, "cards.queue.length") === 0,
    "ricarica remota chiude la sessione e carica uno stato coerente");

  /* race: la lettura remota inizia prima della sessione e termina dopo */
  const winReadRace = await makeApp(conflictSeed);
  let releaseRemoteRead;
  const remoteReadGate = new Promise(resolve => { releaseRemoteRead=resolve; });
  winReadRace.__remoteReadGate = remoteReadGate;
  ev(winReadRace,
    `progressStore.read=()=>globalThis.__remoteReadGate.then(()=>${JSON.stringify(remoteRaw)})`);
  winReadRace.localStorage.setItem(KEY, remoteRaw);
  ev(winReadRace,
    `globalThis.dispatchEvent(new StorageEvent("storage",{key:${JSON.stringify(KEY)},newValue:${JSON.stringify(remoteRaw)},storageArea:localStorage}))`);
  click(winReadRace, view(winReadRace, "cards"));
  click(winReadRace, winReadRace.document.getElementById("startCards"));
  releaseRemoteRead();
  await settle();
  ok(ev(winReadRace, "mastery(1)") === 10 &&
     !winReadRace.document.getElementById("cardsStage").classList.contains("hidden") &&
     ev(winReadRace, "cards.queue.length") > 0,
    "lettura remota terminata dopo l’avvio: la sessione non viene cancellata");
  ok(ev(winReadRace, "storageConflict") === true &&
     winReadRace.document.getElementById("storageWarning").dataset.kind === "conflict",
    "race della lettura remota: conflitto segnalato senza applicare lo snapshot");

  /* race analoga durante reloadFromDisk avviato mentre non vi erano sessioni */
  const winReloadRace = await makeApp(conflictSeed);
  let releaseReloadRead;
  const reloadReadGate = new Promise(resolve => { releaseReloadRead=resolve; });
  winReloadRace.__reloadReadGate = reloadReadGate;
  ev(winReloadRace,
    `progressStore.read=()=>globalThis.__reloadReadGate.then(()=>${JSON.stringify(remoteRaw)})`);
  const reloadPromise = ev(winReloadRace, "reloadFromDisk()");
  await settle();
  click(winReloadRace, view(winReloadRace, "cards"));
  click(winReloadRace, winReloadRace.document.getElementById("startCards"));
  releaseReloadRead();
  await reloadPromise;
  ok(ev(winReloadRace, "mastery(1)") === 10 &&
     !winReloadRace.document.getElementById("cardsStage").classList.contains("hidden"),
    "reload completato dopo l’avvio: non sovrascrive una nuova sessione");
  ok(ev(winReloadRace, "storageConflict") === true,
    "reload con sessione iniziata durante la lettura richiede una conferma esplicita");

  /* storage non disponibile: avviso e possibilità di esportare */
  const winNoStorage = await makeApp(null, "file:///pages/tavola.html");
  const failedSave = await ev(winNoStorage, "addMastery(2,5); save()");
  ok(failedSave === false && ev(winNoStorage, "storageDirty") === true,
    "errore di scrittura segnalato e stato marcato dirty");
  ok(!winNoStorage.document.getElementById("storageWarning").hidden &&
     !winNoStorage.document.getElementById("storageExport").hidden &&
     !winNoStorage.document.getElementById("storageImport").hidden,
    "errore storage mostra import ed esportazione della copia");

  /* export: click, nome file e contenuto JSON */
  const winExport = await makeApp();
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

  const winExportUnsupported=await makeApp();
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
  const winImport=await makeApp();
  const imported=await ev(winImport, `applyImportedState(${JSON.stringify(backup)})`);
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

  const winImportBad=await makeApp();
  const beforeBad=ev(winImportBad, "JSON.stringify(state)");
  ok(await ev(winImportBad, `applyImportedState(${JSON.stringify(JSON.stringify({version:99,mastery:{1:99}}))})`)===false,
    "versione futura rifiutata durante l'import");
  ok(ev(winImportBad, "JSON.stringify(state)")===beforeBad,
    "import rifiutato non modifica lo stato corrente");
  ok(/non supportata/.test(winImportBad.__lastAlert||""),
    "import di versione futura spiega il motivo del rifiuto", winImportBad.__lastAlert);
  ok(await ev(winImportBad, "applyImportedState('{non-json')")===false &&
     /JSON valido/.test(winImportBad.__lastAlert||""),
    "import JSON malformato rifiutato con messaggio");

  /* "Cancella tutto" con una casella selezionata non deve lasciare l'input attivo */
  click(win, view(win, "write"));
  click(win, d.querySelector('#wtable .cell[data-z="5"]'));
  click(win, view(win, "stats"));
  click(win, d.getElementById("resetAll"));
  await settle();
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
  await settle();
  ok(d.getElementById("quizStage").classList.contains("hidden"), "dopo 'Cancella tutto' il quiz aperto è chiuso");
  ok(!d.getElementById("quizSetup").classList.contains("hidden"), "dopo 'Cancella tutto' torna la schermata di avvio");
  ok(ev(win, "quiz.i") === 0 && ev(win, "quiz.wrong.length") === 0, "sessione quiz azzerata");
  ok(d.getElementById("wrongCount").textContent === "0", "contatore errori azzerato", d.getElementById("wrongCount").textContent);

  /* stato corrotto: box fuori scala */
  const win2 = await makeApp(JSON.stringify({ mastery: {}, leitner: { "1": 99 }, due: {}, quiz: { correct: 1, wrong: 1, history: [] }, write: { seqBest: 3, solved: {} }, wrongZ: [999] }));
  const d2 = win2.document;
  ok(win2.__errors.length === 0, "nessun crash con box=99", win2.__errors.join("|"));
  click(win2, view(win2, "stats"));
  const rows2 = [...d2.querySelectorAll("#boxStats .catbar")].map(r => r.querySelector("span").textContent);
  ok(rows2.length === 5, "box corrotto: righe sempre 5", "righe=" + rows2.length + " -> " + rows2.join("/"));
  ok(!rows2.some(t => /undefined|NaN/.test(t)), "box corrotto: nessuna etichetta undefined/NaN", rows2.join("/"));

  /* chiave leitner fantasma (es. 999): non è un elemento, non va contata nei mazzi */
  const win8 = await makeApp(JSON.stringify({ leitner: { 1: 0, 999: 3 } }));
  click(win8, view(win8, "stats"));
  const boxCounts8 = [...win8.document.querySelectorAll("#boxStats .catbar")]
    .map(r => +r.querySelector(".pct").textContent);
  ok(boxCounts8.reduce((a, b) => a + b, 0) === 1,
    "chiave leitner fantasma non conteggiata nei mazzi", JSON.stringify(boxCounts8));
  ok(win8.document.querySelectorAll("#statCards .stat")[4].querySelector(".v").textContent === "1",
    "'Elementi nelle flashcard' conta solo chiavi di elementi reali",
    win8.document.querySelectorAll("#statCards .stat")[4].querySelector(".v").textContent);

  /* chiavi non canoniche/proprietà ereditate e numeri troppo grandi */
  const winEdges = await makeApp(JSON.stringify({
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
  const winStrictHistory = await makeApp(JSON.stringify({
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
  const winFuture=await makeApp(JSON.stringify({version:99,mastery:{1:99},extra:"futuro"}));
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
  ok(await ev(winFuture, "addMastery(1,10); save()")===false,
    "salvataggio automatico bloccato per uno stato con versione futura");
  ok(winFuture.localStorage.getItem(KEY)===futureRaw,
    "stato con versione futura non viene sovrascritto da un'azione dell'app");
  ok(futureWarning.dataset.kind==="version" && /non verranno sovrascritti/.test(futureWarning.textContent),
    "tentativo di salvataggio spiega come sbloccare il ripristino", futureWarning.textContent);
  click(winFuture, view(winFuture, "stats"));
  click(winFuture, winFuture.document.getElementById("resetAll"));
  await settle();
  ok(ev(winFuture, "storageWriteBlocked")===false && futureWarning.hidden,
    "azzeramento esplicito sblocca e chiude lo stato non supportato");
  ok(JSON.parse(winFuture.localStorage.getItem(KEY)).version===1,
    "azzeramento sostituisce lo stato futuro solo dopo conferma");

  /* membri null in localStorage: l'app deve avviarsi lo stesso */
  const win5 = await makeApp(JSON.stringify({ mastery: null, leitner: null, due: null, quiz: null, write: null, wrongZ: null }));
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
  const winSolved = await makeApp(JSON.stringify({ write:{seqBest:0, solved:{"1":0,"2":-1,"3":0.5,"4":"1","5":"01", "999":1}} }));
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

  /* membri ANNIDATI null: la sanitizzazione deve scendere di un livello */const win6 = await makeApp(JSON.stringify({
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
  const win10 = await makeApp(JSON.stringify({ mastery: { "1": 500, "2": -80, "3": "9999" } }));
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
  const winNum = await makeApp(JSON.stringify({
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
  const win7 = await makeApp(JSON.stringify({ quiz:{correct:1, wrong:0, history:[{d:Date.now(), score:10, total:10}]} }));
  click(win7, view(win7, "stats"));
  ok(/1\/10/.test(win7.document.getElementById("quizHist").textContent),
    "storico senza 'wrong' renderizzato", win7.document.getElementById("quizHist").textContent.replace(/\s+/g, " "));

  /* contatori e storico fuori scala: clampati a valori plausibili, altrimenti
     le statistiche mostrano "67% su -15 domande", "Posizione 1000000000" e "Invalid Date" */
  const TS_OK = 1700000000000;   // timestamp fisso: Date.now() nel seed e nell'attesa divergerebbero
  const winClamp = await makeApp(JSON.stringify({
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
  const win3 = await makeApp("{non-json");
  ok(win3.__errors.length === 0, "nessun crash con JSON malformato", win3.__errors.join("|"));
  ok(ev(win3, "state.quiz.correct") === 0, "stato di default ripristinato");
  ok(!win3.document.getElementById("storageWarning").hidden,
    "JSON malformato non viene più ignorato silenziosamente");
  ok(!win3.document.getElementById("storageImport").hidden,
    "stato malformato: avviso con import del backup compatibile");
  ok(await ev(win3, "save()") === true && win3.document.getElementById("storageWarning").hidden,
    "il primo salvataggio valido sostituisce lo stato corrotto e chiude l'avviso");

  const oversized = "x".repeat(1024*1024+1);
  const winOversized = await makeApp(oversized);
  ok(winOversized.__errors.length===0, "un payload locale enorme non blocca l’avvio", winOversized.__errors.join("|"));
  ok(!winOversized.document.getElementById("storageWarning").hidden &&
     /troppo grandi/.test(winOversized.document.getElementById("storageWarningText").textContent),
    "payload locale oltre 1 MB rifiutato prima del parse");

  /* wrongZ con Z inesistente: scartato al caricamento, così il contatore
     "Ripassa gli errori (n)" non promette errori che poi non ci sono */
  const win4 = await makeApp(JSON.stringify({ wrongZ: [1234] }));
  click(win4, view(win4, "quiz"));
  ok(ev(win4, "JSON.stringify(state.wrongZ)") === "[]", "wrongZ fantasma scartato al caricamento",
    ev(win4, "JSON.stringify(state.wrongZ)"));
  ok(win4.document.getElementById("wrongCount").textContent === "0",
    "contatore errori ignora gli Z inesistenti", win4.document.getElementById("wrongCount").textContent);
  click(win4, win4.document.getElementById("quizWrongBtn"));
  ok(/Nessun elemento/.test(win4.__lastAlert || "") || win4.document.getElementById("quizStage").classList.contains("hidden"),
    "wrongZ con Z inesistente gestito senza crash", win4.__lastAlert);

  /* wrongZ con duplicati o voci non numeriche: deduplicato e ripulito al caricamento */
  const win9 = await makeApp(JSON.stringify({ wrongZ: [26, 26, "27", null, "abc"] }));
  ok(ev(win9, "JSON.stringify(state.wrongZ)") === "[26,27]",
    "wrongZ ripulito (duplicati e non numerici tolti)", ev(win9, "JSON.stringify(state.wrongZ)"));
  click(win9, view(win9, "quiz"));
  ok(win9.document.getElementById("wrongCount").textContent === "2",
    "contatore errori = sole voci valide", win9.document.getElementById("wrongCount").textContent);
};
