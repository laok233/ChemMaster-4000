module.exports = context => {
  const {win, d, html, css, ok, section, ev, click, view, makeApp} = context;
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
};
