"use strict";
/* ========================= SCRIVI: TAVOLA VUOTA ========================= */
let wSel=null, writeGridBound=false;
function initWriteGrid(){
  buildGrid(document.getElementById("wtable"),{blank:true});
  updateWFilled();
  if(writeGridBound) return;
  writeGridBound=true;
  document.getElementById("wtable").addEventListener("click",e=>{
    const c=e.target.closest(".cell"); if(!c) return;
    document.querySelectorAll("#wtable .cell.sel").forEach(x=>{
      x.classList.remove("sel"); x.setAttribute("aria-pressed","false");
    });
    c.classList.add("sel"); c.setAttribute("aria-pressed","true"); wSel=+c.dataset.z;
    const inp=document.getElementById("wCellInput");
    inp.disabled=false; inp.value=""; inp.focus();
    const el=BY_Z[wSel];
    wMsg(state.write.solved[wSel] ? `${el.name} è già corretto.` : `Casella Z=${wSel} selezionata.`, "");
  });
}
function wMsg(t,cls){ const m=document.getElementById("wMsg"); m.textContent=t; m.className="wmsg "+(cls||""); }
function updateWFilled(){
  const n=ELEMENTS.filter(e=>state.write.solved[e.z]).length;
  document.getElementById("wFilled").textContent=n;
}
function clearCellSelection(focusNext=false){
  document.querySelectorAll("#wtable .cell.sel").forEach(x=>{
    x.classList.remove("sel"); x.setAttribute("aria-pressed","false");
  });
  wSel=null;
  const inp=document.getElementById("wCellInput"); inp.value=""; inp.disabled=true;
  if(focusNext){
    const next=document.querySelector("#wtable .cell.blank") || document.getElementById("wHint");
    next?.focus({preventScroll:true});
  }
}
function checkCell(){
  if(!wSel) return;
  const inp=document.getElementById("wCellInput");
  const val=inp.value.trim().toUpperCase();
  if(!val) return;
  const el=BY_Z[wSel];
  const cell=document.querySelector(`#wtable .cell[data-z="${wSel}"]`);
  const solved=!!state.write.solved[wSel];
  if(val===el.name.toUpperCase()){
    // nome giusto ma la casella chiede il simbolo: nessuna penalità, nessuna soluzione
    wMsg(`Il nome è giusto, ma qui serve il simbolo di ${el.name}.`,"");
    inp.select();
    return;
  }
  if(val===el.sym.toUpperCase()){
    if(!solved){
      state.write.solved[wSel]=1; addMastery(wSel,12);
      cell.classList.remove("blank","hinted","wrong"); cell.classList.add("solved");
      cell.replaceChildren(...cellChildren(el));
      cell.title=`${el.name} (${el.sym}) — Z=${el.z}`;
      setCellA11y(cell,el,"solved");
      save(); updateHead(); refreshCellMastery(wSel); updateWFilled();
      wMsg(`Corretto! ${el.name} → ${el.sym}`,"ok");
    }else{
      // già risolto: via gli stati d'errore e d'indizio residui, altrimenti
      // .wrong (definita DOPO .solved nella CSS) lascerebbe la casella rossa per sempre
      cell.classList.remove("wrong","hinted");
      wMsg("Già compilato correttamente.","ok");
    }
    clearCellSelection(true);
  }else if(solved){
    // cella già risolta: la risposta è in vista, sbagliarla non deve costare
    // padroneggio né segnare in rosso una casella che è corretta
    wMsg(`${el.name} è già corretto: qui il simbolo è ${el.sym}.`,"");
    inp.select();
  }else{
    addMastery(wSel,-3); save(); updateHead(); refreshCellMastery(wSel);
    cell.classList.remove("wrong"); void cell.offsetWidth; cell.classList.add("wrong");
    wMsg(`No: ${el.sym} è il simbolo di ${el.name}. Riprova.`,"no");
    inp.select();
  }
}
document.getElementById("wCellInput").addEventListener("keydown",e=>{
  if(e.key!=="Enter") return;
  e.preventDefault();
  if(!e.repeat) checkCell();
});
document.getElementById("wHint").onclick=()=>{
  if(!wSel){ wMsg("Seleziona prima una casella.",""); return; }
  const el=BY_Z[wSel];
  if(state.write.solved[wSel]){
    // niente righe di indizio su una casella già risolta: la risposta è già lì
    wMsg(`${el.name} è già compilato correttamente (${el.sym}).`,"ok"); return;
  }
  document.querySelector(`#wtable .cell[data-z="${wSel}"]`).classList.add("hinted");
  wMsg(`Indizio: ${el.name} — inizia per «${el.name[0]}», Z=${el.z}, ${CAT_LABEL[el.cat]}.`,"");
};
document.getElementById("wReset").onclick=()=>{
  if(!confirm("Azzerare la tavola compilata?")) return;
  state.write.solved={}; const persistence=save();
  clearCellSelection();   // la griglia viene ricostruita: niente selezione/input residui
  initWriteGrid(); wMsg("Tavola azzerata in questa scheda; eventuali errori di salvataggio sono segnalati sopra.","");
  persistence.catch(()=>{});
};

/* ========================= SCRIVI: SEQUENZA ========================= */
let seq={i:0,ok:0,bad:0,marks:[],last:""};
function seqRender(){
  const tot=ELEMENTS.length;
  const done=seq.i>=tot;
  const e=BY_Z[Math.min(seq.i+1,tot)];
  document.getElementById("seqZ").textContent= done ? "Sequenza completata!" : `Z = ${e.z}`;
  if(done){
    document.getElementById("seqName").textContent = seq.bad===0 ? "Tavola perfetta 🎉" : `Hai finito i ${tot} elementi`;
  }else{
    document.getElementById("seqName").textContent =
      document.getElementById("seqShowName").checked ? e.name : "—";
  }
  document.getElementById("seqHint").textContent = seq.last || "";
  document.getElementById("seqPos").textContent=Math.min(seq.i+1,tot);
  document.getElementById("seqOk").textContent=seq.ok;
  document.getElementById("seqBad").textContent=seq.bad;
  document.getElementById("seqBest").textContent=state.write.seqBest;
  const bar=document.getElementById("seqBar");
  bar.replaceChildren(...seq.marks.map(m=>makeElement("span",{class:m})));
  // l'input si svuota solo a fine corsa: cambiare l'indizio-nome non deve
  // cancellare una risposta che l'utente aveva già digitato
  const inp=document.getElementById("seqInput");
  if(done){ inp.disabled=true; inp.value=""; }
  else { inp.disabled=false; }
}
function seqCheck(){
  if(seq.i>=ELEMENTS.length) return;
  const e=BY_Z[seq.i+1];
  const inp=document.getElementById("seqInput");
  const v=inp.value.trim().toUpperCase();
  if(!v) return;
  if(v===e.name.toUpperCase()){
    // nome giusto ma la sequenza chiede il simbolo: nessuna penalità, nessun avanzamento
    seq.last=`Il nome è giusto, ma qui serve il simbolo di ${e.name}.`;
    document.getElementById("seqHint").textContent=seq.last;
    inp.select();
    return;
  }
  if(v===e.sym.toUpperCase()){
    seq.ok++; seq.marks.push("ok"); addMastery(e.z,10);
    seq.last = `✔ ${e.sym} — ${e.name}`;
  }else{
    seq.bad++; seq.marks.push("skip"); addMastery(e.z,-3);
    // il nome dell'elemento mancato è già nel feedback: aggiungere un "Indizio"
    // con lo stesso nome sarebbe ridondante
    seq.last = `✘ Era ${e.sym} (${e.name}).`;
  }
  seq.i++;
  if(seq.i>state.write.seqBest) state.write.seqBest=seq.i;
  save(); updateHead(); refreshCellMastery(e.z); seqRender();
  // niente nome del prossimo elemento qui: con l'indizio-nome spento sarebbe
  // una fuga di risposta (il nome è già nel campo grande quando è acceso)
  if(seq.i<ELEMENTS.length){
    seq.last += `  Continua con Z=${BY_Z[seq.i+1].z}`;
    document.getElementById("seqHint").textContent=seq.last;
  }
  inp.value="";   // svuotato solo qui, cioè dopo una risposta effettiva
  if(seq.i<ELEMENTS.length) inp.focus();
  else document.getElementById("seqRestart").focus({preventScroll:true});
}
document.getElementById("seqInput").addEventListener("keydown",e=>{
  if(e.key!=="Enter") return;
  e.preventDefault();
  if(!e.repeat) seqCheck();
});
document.getElementById("seqRestart").onclick=()=>{
  seq={i:0,ok:0,bad:0,marks:[],last:""};
  document.getElementById("seqInput").value="";
  seqRender();
};
// l'etichetta segue la casella: spenta, il chip non deve restare evidenziato
document.getElementById("seqShowName").addEventListener("change",e=>{
  document.getElementById("seqHintToggle").classList.toggle("on",e.target.checked);
  seqRender();
});
document.getElementById("writeMode").addEventListener("click",e=>{
  const b=e.target.closest("button[data-mode]"); if(!b) return;
  document.querySelectorAll("#writeMode button").forEach(x=>{
    const on=x===b;
    x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on));
  });
  const grid=b.dataset.mode==="grid";
  document.getElementById("wGridMode").classList.toggle("hidden",!grid);
  document.getElementById("wSeqMode").classList.toggle("hidden",grid);
  if(!grid) document.getElementById("seqInput").focus({preventScroll:true});
});
