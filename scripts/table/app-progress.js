"use strict";
/* ========================= PROGRESSI ========================= */
function renderStats(){
  const avg=avgMastery(), m=masteredCount();
  const q=state.quiz, qtot=q.correct+q.wrong;
  // solo chiavi canoniche riferite a elementi reali: una chiave anomala in
  // localStorage non deve far superare 118 la somma dei mazzi
  const leitnerEntries=Object.entries(state.leitner).filter(([k])=>isElementKey(k));
  const assignedCards=leitnerEntries.length;
  const boxes=Array(BOX_DAYS.length).fill(0);   // una riga per ogni box reale 0..MAX_BOX
  leitnerEntries.forEach(([,v])=>{
    const b=Math.min(MAX_BOX,Math.max(0,Math.floor(+v)||0));   // difende da valori corrotti in localStorage
    boxes[b]++;
  });
  const solvedN=ELEMENTS.filter(e=>state.write.solved[e.z]).length;
  const statValues=[
    [`${avg}%`,"Padroneggio medio"],
    [`${m}/${ELEMENTS.length}`,`Elementi padroneggiati (≥${MASTERY_THRESHOLD}%)`],
    [`${qtot?Math.round(q.correct/qtot*100):0}%`,`Quiz risposti bene (${qtot} domande)`],
    [`${solvedN}/${ELEMENTS.length}`,"Caselle scritte nella tavola"],
    [String(assignedCards),"Elementi nelle flashcard"],
    [String(state.write.seqBest),"Posizione massima nella sequenza"]
  ];
  document.getElementById("statCards").replaceChildren(...statValues.map(([value,label])=>
    makeElement("div",{class:"stat"},
      makeElement("div",{class:"v",text:value}),makeElement("div",{class:"l",text:label}))));
  const cs=document.getElementById("catStats"); cs.replaceChildren();
  CAT_DEF.forEach(c=>{
    const els=ELEMENTS.filter(e=>e.cat===c.id);
    const p=Math.round(els.reduce((s,e)=>s+mastery(e.z),0)/els.length);
    const track=makeElement("span",{class:`track cat-${c.id}`,role:"progressbar",
      "aria-label":`Padroneggio ${c.label}`,"aria-valuemin":"0","aria-valuemax":"100",
      "aria-valuenow":String(p),"aria-valuetext":`${p}%`},
      makeElement("i",{style:{width:`${p}%`}}));
    cs.appendChild(makeElement("div",{class:"catbar"},
      makeElement("span",{text:c.label}),track,makeElement("span",{class:"pct",text:`${p}%`})));
  });
  const bs=document.getElementById("boxStats"); bs.replaceChildren();
  const names=BOX_DAYS.map((n,i)=>i===0?"0 · oggi":
    `${i} · ${n} ${n===1?"giorno":"giorni"}`);
  boxes.forEach((n,i)=>{
    // proporzionale alle carte effettivamente assegnate: con pochi mazzetti
    // attivi usare 118 come denominatore lascerebbe tutte le barre quasi vuote
    const p=assignedCards?Math.round(n/assignedCards*100):0;
    const valueText=`${n} ${n===1?"carta":"carte"}${assignedCards?`, ${p}% del totale`:""}`;
    const track=makeElement("span",{class:"track",role:"progressbar",
      "aria-label":`Carte nel mazzo ${names[i]}`,"aria-valuemin":"0",
      "aria-valuemax":String(assignedCards||1),"aria-valuenow":String(n),
      "aria-valuetext":valueText},
      makeElement("i",{style:{width:`${p}%`,background:"var(--accent)"}}));
    bs.appendChild(makeElement("div",{class:"catbar"},
      makeElement("span",{text:names[i]}),track,makeElement("span",{class:"pct",text:String(n)})));
  });
  const history=q.history.map(x=>{
    const dt=new Date(x.d).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"});
    const answered=x.answered??x.total;
    const wrong=Math.max(0,answered-x.score/10);
    const ans=answered<x.total?` · risposte ${answered}`:"";
    return makeElement("div",{},makeElement("span",{text:dt}),
      makeElement("span",{text:`${x.score/10}/${x.total}${ans}${wrong?` · ${wrong} errori`:""}`}));
  });
  document.getElementById("quizHist").replaceChildren(...(history.length?history:[
    makeElement("div",{style:{border:"none"},text:"Nessun quiz completato finora."})
  ]));
}
document.getElementById("resetAll").onclick=()=>{
  if(!confirm("Cancellare tutti i progressi? L’azione non è reversibile.")) return;
  // Invalida eventuali callback già in coda: dopo un azzeramento non devono
  // più essere considerati salvataggi correnti né aggiungere scritture obsolete.
  state=defaultState(); storageWriteBlocked=false; const persistence=saveReplacement(); updateHead();
  clearCellSelection();
  renderDetail(1);   // prima della griglia: aria-current deve tornare su H
  buildGrid(document.getElementById("ptable"),{});
  initWriteGrid();
  applyFilter(); renderStats();
  resetTransientUI();   // chiude carte, quiz e sequenza anche durante il reset
  persistence.catch(()=>{});
};
