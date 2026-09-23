module.exports = context => {
  const {win, d, ok, section, ev, click, view} = context;
  /* ================= PROGRESSI ================= */
  section("Progressi");
  click(win, view(win, "stats"));
  ok(d.querySelectorAll("#statCards .stat").length === 6, "6 card statistiche");
  ok(d.querySelectorAll("#catStats .catbar").length === 10, "10 barre categoria");
  const catTracks=[...d.querySelectorAll("#catStats .track")];
  ok(catTracks.length===10 && catTracks.every(t=>t.getAttribute("role")==="progressbar" &&
     t.getAttribute("aria-valuemin")==="0" && t.getAttribute("aria-valuemax")==="100" &&
     /^\d+%$/.test(t.getAttribute("aria-valuetext")||"")),
  "barre categoria accessibili con valore e testo", catTracks.map(t=>t.outerHTML).join(" "));
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
  const boxTracks=[...d.querySelectorAll("#boxStats .track")];
  ok(boxTracks.length===5 && boxTracks.every(t=>{
    const max=Number(t.getAttribute("aria-valuemax")), now=Number(t.getAttribute("aria-valuenow"));
    return t.getAttribute("role")==="progressbar" && max>0 && now>=0 && now<=max &&
      /\d+ (?:carta|carte)(, \d+% del totale)?/.test(t.getAttribute("aria-valuetext")||"");
  }), "barre mazzi accessibili con conteggio e percentuale", boxTracks.map(t=>t.outerHTML).join(" "));
  // due carte assegnate in tutto (una nel mazzo 0 e una nel 2): le barre misurano
  // le carte presenti, non le 118 caselle della tavola
  ok(boxWidths.join(",") === "50%,0%,50%,0%,0%",
    "barre mazzi proporzionali alle carte assegnate", boxWidths.join(","));
  ok(/risposte 2/.test(d.getElementById("quizHist").innerHTML), "storico: quiz interrotto indica quante risposte",
    d.getElementById("quizHist").textContent.replace(/\s+/g, " "));
};
