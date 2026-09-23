"use strict";
/* ========================= STATO ========================= */
const STORE_KEY="chemmaster-4000-v1";
const STATE_VERSION=1;
const DAY=86400000;   // qui, non nelle flashcard: load() serve per gli intervalli dello storico
const BOX_DAYS=[0,1,3,7,21];
const defaultState = ()=>({
  version:STATE_VERSION,
  mastery:{}, leitner:{}, due:{},
  quiz:{correct:0,wrong:0,history:[]},
  write:{seqBest:0,solved:{}},
  wrongZ:[]
});
const isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
// numero o stringa numerica (non null/vuoto/booleano: +true===1 farbbe entrare i booleani)
const isNum=v=>(typeof v==="number"||typeof v==="string")&&String(v).trim()!==""&&Number.isFinite(+v);
const isSafeNonNegativeInt=v=>{
  if(!isNum(v)) return false;
  const n=Number(v);
  return Number.isSafeInteger(n)&&n>=0;
};
// Il flag delle caselle è un booleano persistito come 1: accettare solo il
// valore canonico evita che uno stato corrotto (0, -1 o 0.5) riveli risposte.
const isSolvedFlag=v=>v===1||v==="1";
const uint=v=>{
  const n=Math.floor(Number(v));
  return Number.isSafeInteger(n)?Math.max(0,n):0;
};
// solo chiavi canoniche 1..118: evita eredità come "toString" e forme come "01"/"1.5"
const isElementKey=k=>{
  const z=Number(k);
  return Number.isInteger(z)&&z>=1&&z<=ELEMENTS.length&&String(z)===k;
};
const elementMap=o=>Object.fromEntries(Object.entries(o)
  .filter(([k,v])=>isElementKey(k)&&isNum(v)).map(([k,v])=>[k,+v]));

let storageBaseline=null, storageBaselineKnown=false;
let storageDirty=false, storageConflict=false, storageLoadIssue="", storageWriteBlocked=false;
let storageSavePending=0, storageEpoch=0;
let appReady=false, pendingStorageEvent=null;
// Funzione unica per localStorage e import: valida la versione, copia soltanto
// campi noti e mantiene coerenti i dati derivati (risposte, punteggio, errori).
function sanitizeState(value){
  if(!isObj(value)) return {
    state:defaultState(),
    issue:"I dati non contengono un oggetto di stato valido.",
    unsupportedVersion:false
  };
  // Gli stati precedenti alla versione non avevano il campo: sono la migrazione v0→v1.
  // Le versioni future vengono rifiutate, non reinterpretate con lo schema attuale.
  if(value.version!==undefined&&value.version!==STATE_VERSION) return {
    state:defaultState(),
    issue:"I dati usano una versione non supportata e sono stati ignorati.",
    unsupportedVersion:true
  };

  const q=isObj(value.quiz)?value.quiz:{};
  const w=isObj(value.write)?value.write:{};
  const out={
    version:STATE_VERSION,
    mastery:isObj(value.mastery)?value.mastery:{},
    leitner:isObj(value.leitner)?value.leitner:{},
    due:isObj(value.due)?value.due:{},
    quiz:{correct:q.correct,wrong:q.wrong,history:Array.isArray(q.history)?q.history:[]},
    write:{seqBest:w.seqBest,solved:isObj(w.solved)?w.solved:{}},
    wrongZ:Array.isArray(value.wrongZ)?value.wrongZ:[]
  };

  // solo elementi reali, senza duplicati (stato corrotto o chiavi residue):
  // un Z fantasma gonfierebbe il contatore "Ripassa gli errori (n)".
  out.wrongZ=[...new Set(out.wrongZ.filter(isNum).map(v=>+v)
    .filter(v=>Number.isSafeInteger(v)&&BY_Z[v]))];
  // caselle scritte: solo elementi reali e il flag canonico 1 ("boh", true,
  // 0 o un valore negativo non devono rivelare una risposta).
  out.write.solved=Object.fromEntries(Object.entries(out.write.solved)
    .filter(([k,v])=>isElementKey(k)&&isSolvedFlag(v)).map(([k])=>[k,1]));
  // isNum accetta le stringhe numeriche, ma qui vanno proprio convertite:
  // correct+wrong nelle statistiche diventerebbe "5"+"3" = "53" domande.
  out.write.seqBest=isNum(out.write.seqBest)?Math.min(ELEMENTS.length,uint(out.write.seqBest)):0;
  out.quiz.correct=isNum(out.quiz.correct)?uint(out.quiz.correct):0;
  out.quiz.wrong=isNum(out.quiz.wrong)?uint(out.quiz.wrong):0;

  // Storico: una voce deve avere una data valida, almeno una risposta e un punteggio
  // multiplo di 10 non superiore alle risposte effettivamente date. Il numero di errori
  // è derivato da answered-score, così un array corrotto non genera statistiche assurde.
  const now=Date.now();
  // "Ultimi quiz" deve restare ordinato anche se un backup importato ha voci
  // mescolate: per questo il limite alle 10 record viene applicato dopo d.
  out.quiz.history=out.quiz.history.filter(isObj).flatMap(h=>{
    if(!isNum(h.d)) return [];
    const d=+h.d;
    if(!Number.isSafeInteger(d)||d<=0||d>now+DAY) return [];
    const total=isSafeNonNegativeInt(h.total)?Math.min(ELEMENTS.length,Number(h.total)):0;
    if(!total) return [];
    const answered=h.answered===undefined?total:
      isSafeNonNegativeInt(h.answered)?Math.min(total,Number(h.answered)):0;
    if(!answered) return [];
    // I record v0 senza score valgono zero; uno score esplicitamente presente
    // deve invece essere un intero non negativo multiplo di 10.
    if(h.score!==undefined&&!isSafeNonNegativeInt(h.score)) return [];
    const rawScore=h.score===undefined?0:Number(h.score);
    if(!Number.isSafeInteger(rawScore)||rawScore%10!==0) return [];
    const score=Math.min(rawScore,answered*10);
    const wrongCount=answered-score/10;
    const wrong=Array.isArray(h.wrong)?[...new Set(h.wrong.filter(isNum).map(v=>+v)
      .filter(v=>Number.isSafeInteger(v)&&BY_Z[v]))].slice(0,wrongCount):[];
    return [{d,score,total,answered,wrong}];
  }).sort((a,b)=>b.d-a.d).slice(0,10);

  // valori non numerici nelle mappe: scartati (evita "NaN%" nelle statistiche)
  ["mastery","leitner","due"].forEach(k=>{ out[k]=elementMap(out[k]); });
  const maxDue=now+Math.max(...BOX_DAYS)*DAY+DAY;
  out.due=Object.fromEntries(Object.entries(out.due)
    .filter(([,v])=>Number.isSafeInteger(v)&&v>=0&&v<=maxDue));
  // padroneggio entro 0..100 già al caricamento, non solo dopo il primo utilizzo.
  Object.keys(out.mastery).forEach(k=>{ out.mastery[k]=Math.max(0,Math.min(100,out.mastery[k])); });
  return {state:out,issue:"",unsupportedVersion:false};
}

let state = load();
function load(){
  let raw;
  storageWriteBlocked=false;
  try{
    raw=localStorage.getItem(STORE_KEY);
    storageBaseline=raw;
    storageBaselineKnown=true;
  }catch(e){
    storageBaselineKnown=false;
    storageLoadIssue="Il browser non ha reso disponibile localStorage.";
    return defaultState();
  }
  try{
    if(!raw){ storageLoadIssue=""; return defaultState(); }
    const normalized=sanitizeState(JSON.parse(raw));
    storageLoadIssue=normalized.issue;
    storageWriteBlocked=normalized.unsupportedVersion;
    return normalized.state;
  }catch(e){
    storageLoadIssue="I dati locali erano danneggiati e sono stati ignorati.";
    return defaultState();
  }
}
function showStorageWarning(kind,message){
  const box=document.getElementById("storageWarning");
  box.dataset.kind=kind;
  document.getElementById("storageWarningText").textContent=message;
  document.getElementById("storageImport").hidden=kind!=="load"&&kind!=="conflict"&&kind!=="error"&&kind!=="version";
  document.getElementById("storageExport").hidden=kind!=="conflict"&&kind!=="error";
  document.getElementById("storageReload").hidden=kind!=="conflict";
  box.hidden=false;
}
function hideStorageWarning(){ document.getElementById("storageWarning").hidden=true; }
function showStorageLoadIssue(){
  if(storageLoadIssue) showStorageWarning(storageWriteBlocked?"version":"load",storageLoadIssue);
  else hideStorageWarning();
}
function storageWriteError(){
  storageDirty=true;
  showStorageWarning("error",
    "Impossibile salvare i progressi nel browser. Puoi importare o esportare una copia, ma il ripristino automatico non sarà disponibile.");
}
function saveNow(){
  if(storageWriteBlocked){
    storageDirty=true;
    showStorageWarning("version",
      "I dati salvati appartengono a una versione non supportata e non verranno sovrascritti. Importa un backup compatibile oppure azzera i progressi da «Progressi».");
    return false;
  }
  try{
    const disk=localStorage.getItem(STORE_KEY);
    if(!storageBaselineKnown){ storageBaseline=disk; storageBaselineKnown=true; }
    if(disk!==storageBaseline){
      // Un'altra scheda ha scritto dopo l'ultimo salvataggio noto: non la sovrascriviamo.
      storageDirty=true;
      storageConflict=true;
      showStorageWarning("conflict",
        "I progressi sono cambiati in un’altra scheda. Questa scheda non ha sovrascritto nulla: esporta la copia o ricarica da disco.");
      return false;
    }
    const raw=JSON.stringify(state);
    localStorage.setItem(STORE_KEY,raw);
    storageBaseline=raw;
    storageBaselineKnown=true;
    storageDirty=false;
    storageConflict=false;
    storageLoadIssue="";
    hideStorageWarning();
    return true;
  }catch(e){
    storageWriteError();
    return false;
  }
}
async function saveWithLock(epoch,locks){
  try{
    return await locks.request(`${STORE_KEY}:write`,()=>epoch===storageEpoch?saveNow():false);
  }catch(e){
    if(epoch===storageEpoch) storageWriteError();
    return false;
  }finally{
    storageSavePending=Math.max(0,storageSavePending-1);
  }
}
function save(){
  storageDirty=true;
  const epoch=storageEpoch;
  const locks=globalThis.navigator&&globalThis.navigator.locks;
  // Web Locks serializza get+set tra tutte le schede della stessa origin.
  // Senza Web Locks il confronto del baseline rileva la maggior parte degli snapshot
  // obsoleti, ma non è atomico: due scritture simultanee possono comunque gareggiare.
  if(locks&&typeof locks.request==="function"){
    storageSavePending++;
    return saveWithLock(epoch,locks);
  }
  const saved=epoch===storageEpoch?saveNow():false;
  return saved;
}
function exportProgress(){
  let url="";
  try{
    if(typeof globalThis.Blob!=="function"||
       !globalThis.URL||typeof globalThis.URL.createObjectURL!=="function"){
      alert("Questo browser non supporta l’esportazione del file JSON.");
      return false;
    }
    const blob=new globalThis.Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    url=globalThis.URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`chemmaster-4000-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    try{ a.click(); } finally { a.remove(); }
    setTimeout(()=>{
      try{ if(typeof globalThis.URL.revokeObjectURL==="function") globalThis.URL.revokeObjectURL(url); }
      catch(e){ /* il download è già stato avviato */ }
    },0);
    return true;
  }catch(e){
    if(url&&typeof globalThis.URL?.revokeObjectURL==="function"){
      try{ globalThis.URL.revokeObjectURL(url); }catch(_){ }
    }
    alert("Impossibile esportare una copia dei progressi.");
    return false;
  }
}
function applyImportedState(raw){
  let value;
  try{ value=JSON.parse(raw); }
  catch(e){ alert("Il file selezionato non contiene JSON valido."); return false; }
  const normalized=sanitizeState(value);
  if(normalized.issue){ alert(`Import non riuscito: ${normalized.issue}`); return false; }
  if(!confirm("Importare questa copia sostituirà i progressi attualmente salvati. Vuoi continuare?")) return false;

  // Annulla eventuali salvataggi in volo e ricostruisce tutta la UI sul nuovo stato.
  storageEpoch++;
  state=normalized.state;
  storageLoadIssue="";
  storageWriteBlocked=false;
  storageConflict=false;
  renderPersistedState();
  save();
  return true;
}
async function importProgress(file){
  if(!file) return;
  // Lo stato reale occupa pochi KB: un limite evita che un file accidentale
  // enorme blocchi il thread durante JSON.parse.
  if(file.size>1024*1024){
    alert("Il file è troppo grande: il backup deve pesare al massimo 1 MB.");
    return;
  }
  try{ applyImportedState(await file.text()); }
  catch(e){ alert("Impossibile leggere il file selezionato."); }
}
function hasPendingTransientState(){
  return !document.getElementById("cardsStage").classList.contains("hidden") ||
    !document.getElementById("cardsDone").classList.contains("hidden") ||
    !document.getElementById("quizStage").classList.contains("hidden") ||
    !document.getElementById("quizDone").classList.contains("hidden") ||
    seq.i>0 || document.getElementById("seqInput").value.trim()!=="" ||
    wSel!==null || document.getElementById("wCellInput").value.trim()!=="";
}
function resetTransientUI(){
  cards={queue:[],dir:null,total:0,done:0,ok:0,flipped:false};
  resetCardsUI();
  quiz={list:[],i:0,score:0,streak:0,best:0,wrong:[],answered:false};
  document.getElementById("quizStage").classList.add("hidden");
  document.getElementById("quizDone").classList.add("hidden");
  document.getElementById("quizSetup").classList.remove("hidden");
  refreshQuizScopes();
  seq={i:0,ok:0,bad:0,marks:[],last:""};
  document.getElementById("seqInput").value="";
  wMsg("","");
  seqRender();
}
function renderPersistedState(){
  const focused=document.activeElement;
  const focusedCell=focused&&focused.closest?focused.closest(".cell"):null;
  const focusHost=focusedCell?focusedCell.closest("#ptable,#wtable")?.id:null;
  const focusZ=focusedCell?focusedCell.dataset.z:null;
  resetTransientUI(); clearCellSelection();
  buildGrid(document.getElementById("ptable"),{});
  initWriteGrid();
  renderDetail(detailZ);
  applyFilter(); updateHead(); refreshCardScopes(); refreshQuizScopes(); renderStats();
  if(focusHost&&focusZ){
    const next=document.getElementById(focusHost)?.querySelector(`.cell[data-z="${focusZ}"]`);
    if(next) next.focus({preventScroll:true});
  }
}
function reloadFromDisk(){
  if(storageConflict&&!confirm("Ricaricare da disco chiuderà la sessione aperta e scarterà eventuali cambiamenti non salvati. Continuare?")) return;
  storageEpoch++;
  state=load(); storageDirty=false; storageConflict=false;
  renderPersistedState();
  showStorageLoadIssue();
  const h=document.querySelector("section.view.active h2");
  if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
}
const openImportDialog=()=>document.getElementById("progressFile").click();
document.getElementById("storageImport").onclick=openImportDialog;
document.getElementById("importBackup").onclick=openImportDialog;
document.getElementById("storageExport").onclick=exportProgress;
document.getElementById("exportBackup").onclick=exportProgress;
document.getElementById("storageReload").onclick=reloadFromDisk;
document.getElementById("progressFile").addEventListener("change",e=>{
  const file=e.target.files&&e.target.files[0];
  e.target.value="";
  importProgress(file);
});
function isRelevantStorageEvent(e){
  if(e.key!==STORE_KEY&&e.key!==null) return false;
  // Un evento con storageArea nullo viene accettato per compatibilità con
  // eventi sintetici; quelli espliciti devono però provenire da localStorage.
  // sessionStorage può infatti emettere un evento con la stessa chiave.
  if(!e.storageArea) return true;
  try{ return e.storageArea===localStorage; }
  catch(_){ return false; }
}
function handleStorageEvent(e){
  if(!isRelevantStorageEvent(e)) return;
  if(e.newValue===storageBaseline) return;
  if(storageDirty){
    storageConflict=true;
    showStorageWarning("conflict",
      "Un’altra scheda ha aggiornato i progressi. Esporta questa copia o ricarica da disco.");
    return;
  }
  if(hasPendingTransientState()){
    storageConflict=true;
    showStorageWarning("conflict",
      "Un’altra scheda ha aggiornato i progressi mentre una sessione era aperta. Ricarica da disco per continuare senza mescolare stati.");
    return;
  }
  state=load(); storageDirty=false; storageConflict=false;
  renderPersistedState();
  showStorageLoadIssue();
}
globalThis.addEventListener("storage",e=>{
  if(!isRelevantStorageEvent(e)) return;
  // L'evento può arrivare tra storage.js e app.js: conserva l'ultimo senza
  // chiamare funzioni UI che non sono ancora state inizializzate.
  if(!appReady){ pendingStorageEvent=e; return; }
  handleStorageEvent(e);
});
globalThis.addEventListener("beforeunload",e=>{
  if(!storageDirty&&!storageSavePending) return;
  e.preventDefault(); e.returnValue="";
});
function mastery(z){ const v=+state.mastery[z]; return Number.isFinite(v)?Math.round(v):0; }
function addMastery(z,d){
  const v=Math.max(0,Math.min(100,mastery(z)+d));
  state.mastery[z]=Math.round(v);
}
// soglia unica di "padroneggiato": usata dal contatore in testa, dagli ambiti
// flashcard/quiz e dall'etichetta delle statistiche (prima era replicata in 4 punti)
const MASTERY_THRESHOLD=70;
function masteredCount(){ return ELEMENTS.filter(e=>mastery(e.z)>=MASTERY_THRESHOLD).length; }
function avgMastery(){ return Math.round(ELEMENTS.reduce((s,e)=>s+mastery(e.z),0)/ELEMENTS.length); }
