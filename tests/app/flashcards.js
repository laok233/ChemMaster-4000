module.exports = async context => {
  const {win, d, ok, section, ev, click, key, keyOn, view, makeApp} = context;
  /* ================= FLASHCARD ================= */
  section("Flashcard");
  click(win, view(win, "cards"));
  ok(d.getElementById("view-cards").classList.contains("active"), "navigazione a flashcard");
  ok(d.querySelectorAll("#cardScope option").length === 13, "13 ambiti", d.querySelectorAll("#cardScope option").length);
  ok(d.querySelectorAll("#cardDir option").length === 6, "6 direzioni");
  ok(d.getElementById("card").hasAttribute("tabindex"), "flashcard focusabile da tastiera");
  ok(d.getElementById("card").getAttribute("role") === "button", "flashcard esposta come pulsante");
  ok(d.getElementById("card").getAttribute("aria-keyshortcuts")==="Space Enter" &&
     d.getElementById("card").getAttribute("aria-expanded")==="false" &&
     d.getElementById("card").getAttribute("aria-controls")==="cardBack" &&
     d.getElementById("cardMeterTrack").getAttribute("role")==="progressbar",
    "scorciatoie, stato espanso e avanzamento flashcard accessibili");

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
  ok(!d.getElementById("card").hasAttribute("aria-keyshortcuts") &&
     d.getElementById("card").getAttribute("aria-expanded")==="true",
    "stato della carta aggiornato dopo il flip",
    `${d.getElementById("card").getAttribute("aria-keyshortcuts")} / ${d.getElementById("card").getAttribute("aria-expanded")}`);
  ok(/risposta .*1, 2 e 3/.test(d.getElementById("card").getAttribute("aria-label") || ""),
    "la carta girata annuncia risposta e controlli di giudizio");
  ok(!d.getElementById("cardGrade").classList.contains("hidden"), "bottoni giudizio visibili");

  const before = ev(win, "mastery(" + z1 + ")");
  click(win, d.querySelector('#cardGrade button[data-g="2"]'));
  ok(d.getElementById("card").getAttribute("aria-keyshortcuts")==="Space Enter" &&
     d.getElementById("card").getAttribute("aria-expanded")==="false",
    "stato della carta ripristinato sulla carta successiva");
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
  const kGrade=key(win, { key: "1" });
  ok(ev(win, "cards.done") === 2 && kGrade.defaultPrevented,
    "tasto 1 giudica la carta e impedisce l'azione predefinita",
    `done=${ev(win, "cards.done")} defaultPrevented=${kGrade.defaultPrevented}`);
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

  const winMeter=await makeApp();
  ev(winMeter, "cards={queue:[{z:1}],dir:DIRS[0],total:1,done:0,ok:0,flipped:true}; gradeCard(2)");
  ok(winMeter.document.getElementById("cardMeterTrack").getAttribute("aria-valuenow")==="100" &&
     /1 di 1 carte, 100%/.test(winMeter.document.getElementById("cardMeterTrack").getAttribute("aria-valuetext") || ""),
    "progressbar flashcard aggiornata al 100% dopo l'ultima carta");

  const orphanDue=await makeApp(JSON.stringify({due:{1:Date.now()+86400000}}));
  ok(ev(orphanDue, "scopePool('due').some(e=>e.z===1)") &&
     ev(orphanDue, "Object.keys(state.due).length") === 0,
    "una scadenza orfana non esclude una carta non assegnata e viene ripulita");

  const unloadWindow=await makeApp();
  click(unloadWindow, view(unloadWindow, "cards"));
  click(unloadWindow, unloadWindow.document.getElementById("startCards"));
  const activeUnloadPrevented=ev(unloadWindow,
    "(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented;})()");
  ok(activeUnloadPrevented, "beforeunload avvisa per una sessione flashcard attiva");
  click(unloadWindow, unloadWindow.document.getElementById("stopCards"));
  const resultUnloadPrevented=ev(unloadWindow,
    "(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented;})()");
  ok(!resultUnloadPrevented, "il riepilogo finale non viene trattato come sessione attiva");
};
