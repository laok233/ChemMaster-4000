module.exports = context => {
  const {win, d, ok, section, ev, click, key, keyOn, view} = context;
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
};
