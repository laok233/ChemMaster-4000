"use strict";
/* ========================= STATO ========================= */
const STORE_KEY="chemmaster-4000-v1";
const STATE_VERSION=1;
const MAX_RAW_STATE_LENGTH=1024*1024;
const MAX_COUNTER=Math.floor(Number.MAX_SAFE_INTEGER/2);
const DAY=86400000;   // qui, non nelle flashcard: serve per gli intervalli dello storico
const BOX_DAYS=[0,1,3,7,21];
const defaultState = ()=>({
  version:STATE_VERSION,
  mastery:{}, leitner:{}, due:{},
  quiz:{correct:0,wrong:0,history:[]},
  write:{seqBest:0,solved:{}},
  wrongZ:[]
});
const isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
// numero o stringa numerica (non null/vuoto/booleano: +true===1 farebbe entrare i booleani)
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
  return Number.isSafeInteger(n)?Math.min(MAX_COUNTER,Math.max(0,n)):0;
};
// solo chiavi canoniche 1..118: evita eredità come "toString" e forme come "01"/"1.5"
const isElementKey=k=>{
  const z=Number(k);
  return Number.isInteger(z)&&z>=1&&z<=ELEMENTS.length&&String(z)===k;
};
const elementMap=o=>Object.fromEntries(Object.entries(o)
  .filter(([k,v])=>isElementKey(k)&&isNum(v)).map(([k,v])=>[k,+v]));

// Funzione unica per persistenza e import: valida la versione, copia soltanto
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
  const maxBox=Math.max(0,BOX_DAYS.length-1);
  Object.keys(out.leitner).forEach(z=>{
    out.leitner[z]=Math.min(maxBox,Math.max(0,Math.floor(out.leitner[z])));
  });
  const maxDue=now+Math.max(...BOX_DAYS)*DAY+DAY;
  out.due=Object.fromEntries(Object.entries(out.due)
    .filter(([,v])=>Number.isSafeInteger(v)&&v>=0&&v<=maxDue));
  // Una scadenza ha senso solo per una carta già assegnata a un mazzo.
  Object.keys(out.due).forEach(z=>{
    if(!Object.prototype.hasOwnProperty.call(out.leitner,z)) delete out.due[z];
  });
  // padroneggio entro 0..100 già al caricamento, non solo dopo il primo utilizzo.
  Object.keys(out.mastery).forEach(k=>{
    out.mastery[k]=Math.max(0,Math.min(100,Math.round(out.mastery[k])));
  });
  return {state:out,issue:"",unsupportedVersion:false};
}

document.documentElement.dataset.storageState="loading";
let state=defaultState();
let storageBackend="pending";
const progressStore=createProgressStore(STORE_KEY);
let storageBaseline=null, storageBaselineKnown=false;
let storageDirty=false, storageConflict=false, storageLoadIssue="", storageWriteBlocked=false;
let storageReconcileRequired=false;
let storageSavePending=0, storageEpoch=0, storageReadEpoch=0;
let storageStateRevision=0, storageEventRevision=0, lastSavedStateRevision=0;
let storageLegacyNeedsCleanup=false;
let saveQueue=Promise.resolve();
let appReady=false, pendingStorageEvent=null;

function decodeStoredState(raw){
  if(raw===null||raw==="") return {state:defaultState(),issue:"",unsupportedVersion:false};
  if(typeof raw!=="string"||raw.length>MAX_RAW_STATE_LENGTH){
    return {state:defaultState(),issue:"I dati locali sono troppo grandi o non validi e sono stati ignorati.",unsupportedVersion:false};
  }
  try{
    const normalized=sanitizeState(JSON.parse(raw));
    return {
      state:normalized.state,
      issue:normalized.issue,
      unsupportedVersion:normalized.unsupportedVersion
    };
  }catch(_){
    return {
      state:defaultState(),
      issue:"I dati locali erano danneggiati e sono stati ignorati.",
      unsupportedVersion:false
    };
  }
}
function applyLoadedState(loaded){
  storageBaseline=loaded.raw;
  storageBaselineKnown=true;
  storageLoadIssue=loaded.normalized.issue;
  storageWriteBlocked=loaded.normalized.unsupportedVersion;
  storageDirty=false;
  storageConflict=false;
  state=loaded.normalized.state;
}
async function readActiveState(){
  const raw=await progressStore.read();
  return {raw,normalized:decodeStoredState(raw)};
}
async function initializeStorage(){
  const loaded=await progressStore.init();
  storageBackend=loaded.backend;
  const normalized=decodeStoredState(loaded.raw);
  applyLoadedState({raw:loaded.raw,normalized});
  storageReconcileRequired=!!loaded.reconcileRequired;
  if(loaded.migrated && !normalized.issue && !storageReconcileRequired){
    storageLegacyNeedsCleanup=!progressStore.clearLocal(loaded.raw);
    if(storageLegacyNeedsCleanup){
      storageReconcileRequired=true;
      storageConflict=true;
      storageLoadIssue="Il backup locale è cambiato durante la migrazione. Le copie sono diverse e l’app attende una scelta esplicita prima di scrivere.";
    }
  }else if(loaded.migrated && normalized.issue){
    // Mantiene il payload locale se la migrazione ha copiato dati non
    // validabili; il primo salvataggio valido lo rimuoverà in sicurezza.
    storageLegacyNeedsCleanup=true;
  }
  if(storageReconcileRequired){
    storageConflict=true;
    storageLoadIssue="Sono presenti copie diverse dei progressi in IndexedDB e localStorage. Per evitare perdita dati, l’app non sceglie una copia automaticamente: importa un backup o azzera i progressi.";
  }
  if(storageBackend==="localstorage"&&loaded.localAvailable===false){
    storageLoadIssue="Il browser non ha reso disponibile alcun archivio persistente.";
  }else if(storageBackend==="localstorage"&&loaded.error&&globalThis.indexedDB){
    storageLoadIssue="IndexedDB non è disponibile per una lettura sicura: per questa sessione i progressi useranno il fallback localStorage.";
    const locks=globalThis.navigator&&globalThis.navigator.locks;
    if(!locks||typeof locks.request!=="function"){
      storageLoadIssue+=" Web Locks non è disponibile: usa una sola scheda per evitare scritture concorrenti.";
    }
  }
  return state;
}
const storageReady=initializeStorage().catch(error=>{
  storageBackend="localstorage";
  storageBaseline=null;
  storageBaselineKnown=true;
  storageLoadIssue="Il browser non ha reso disponibile alcun archivio persistente.";
  storageWriteBlocked=false;
  return state;
});

function showStorageWarning(kind,message){
  const box=document.getElementById("storageWarning");
  box.dataset.kind=kind;
  document.getElementById("storageWarningText").textContent=message;
  document.getElementById("storageImport").hidden=kind!=="load"&&kind!=="conflict"&&kind!=="error"&&kind!=="version"&&kind!=="read";
  document.getElementById("storageExport").hidden=kind!=="conflict"&&kind!=="error"&&kind!=="read";
  document.getElementById("storageReload").hidden=kind!=="conflict"&&kind!=="read";
  box.hidden=false;
}
function hideStorageWarning(){ document.getElementById("storageWarning").hidden=true; }
function showStorageLoadIssue(){
  if(storageLoadIssue) showStorageWarning(
    storageWriteBlocked?"version":storageReconcileRequired?"conflict":"load",storageLoadIssue);
  else hideStorageWarning();
}
function storageWriteError(){
  storageDirty=true;
  showStorageWarning("error",
    "Impossibile salvare i progressi nel browser. Puoi importare o esportare una copia, ma il ripristino automatico non sarà disponibile.");
}
function storageReadError(){
  // Un errore in lettura non deve inventare uno stato locale dirty: avvisa,
  // ma conserva il flag che riflette soltanto modifiche non persistite.
  showStorageWarning("read",
    "Impossibile leggere i progressi dal browser. Puoi esportare la copia corrente e riprovare il caricamento.");
}
function completeSuccessfulSave(epoch,raw,stateRevision,eventRevision){
  // Anche una scrittura avviata prima di un reset/import può completarsi dopo:
  // il suo raw deve diventare il baseline per la task successiva, ma non deve
  // cancellare dirty/conflict o l'avviso appartenenti allo stato più recente.
  if(epoch===storageEpoch && storageLegacyNeedsCleanup && progressStore.clearLocal(storageBaseline)){
    storageLegacyNeedsCleanup=false;
  }
  storageBaseline=raw;
  storageBaselineKnown=true;
  lastSavedStateRevision=Math.max(lastSavedStateRevision,stateRevision);
  if(epoch!==storageEpoch) return;
  if(stateRevision===storageStateRevision) storageDirty=false;
  // Un annuncio ricevuto durante la transazione può indicare un conflitto:
  // solo la stessa revisione di evento autorizza a pulire l'avviso.
  if(stateRevision===storageStateRevision&&eventRevision===storageEventRevision){
    storageConflict=false;
    storageLoadIssue="";
    hideStorageWarning();
  }
}
async function saveNow(epoch){
  if(storageReconcileRequired){
    storageDirty=true;
    showStorageWarning("conflict",
      "Le copie IndexedDB e localStorage sono diverse. Importa una copia o azzera i progressi prima di continuare a scrivere.");
    return false;
  }
  if(storageWriteBlocked){
    storageDirty=true;
    showStorageWarning("version",
      "I dati salvati appartengono a una versione non supportata e non verranno sovrascritti. Importa un backup compatibile oppure azzera i progressi da «Progressi».");
    return false;
  }
  const eventRevision=storageEventRevision;
  try{
    let expected=storageBaseline;
    if(!storageBaselineKnown){
      expected=await progressStore.read();
      storageBaseline=expected;
      storageBaselineKnown=true;
    }
    if(epoch!==storageEpoch) return false;
    // La revisione va acquisita subito prima della serializzazione: se un'altra
    // azione modifica lo stato mentre la transazione è in volo, il completamento
    // non potrà più dichiarare pulito quel nuovo stato.
    const stateRevision=storageStateRevision;
    const raw=JSON.stringify(state);
    const result=await progressStore.compareAndSet(expected,raw);
    if(epoch!==storageEpoch) return false;
    if(result.error) throw result.error;
    if(!result.ok){
      // Un'altra scheda ha scritto dopo l'ultimo salvataggio noto: non la sovrascriviamo.
      storageDirty=true;
      storageConflict=true;
      showStorageWarning("conflict",
        "I progressi sono cambiati in un’altra scheda. Questa scheda non ha sovrascritto nulla: esporta la copia o ricarica da disco.");
      return false;
    }
    completeSuccessfulSave(epoch,raw,stateRevision,eventRevision);
    return true;
  }catch(_){
    if(epoch===storageEpoch) storageWriteError();
    return false;
  }
}
async function saveWithLock(epoch,locks){
  let timer;
  try{
    const request=locks.request(`${STORE_KEY}:write`,()=>epoch===storageEpoch?saveNow(epoch):false);
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error("Timeout durante il lock di persistenza")),
        progressStore.operationTimeoutMs||5000);
    });
    return await Promise.race([request,timeout]);
  }catch(_){
    if(epoch===storageEpoch){
      // Un lock che non risponde potrebbe eseguire il callback più tardi:
      // invalida l'epoca prima di segnalare l'errore per fencing.
      storageEpoch++;
      storageWriteError();
    }
    return false;
  }finally{
    clearTimeout(timer);
  }
}
function enqueueSave(epoch,stateRevision,replace=false){
  storageSavePending++;
  const task=saveQueue.then(async()=>{
    if(epoch!==storageEpoch) return false;
    if(replace){
      try{
        // Reset/import sono sostituzioni esplicite: se un'altra scheda ha
        // scritto dopo il baseline, prendiamo il valore corrente e lo
        // confrontiamo comunque con CAS, senza perdere la conferma utente.
        const current=await progressStore.read();
        if(epoch!==storageEpoch) return false;
        storageBaseline=current;
        storageBaselineKnown=true;
      }catch(_){
        if(epoch===storageEpoch) storageWriteError();
        return false;
      }
    }
    // Se una task precedente ha già serializzato questa revisione (o una più
    // recente), la richiesta è soddisfatta: evita transazioni e annunci duplicati.
    if(stateRevision<=lastSavedStateRevision) return true;
    if(storageBackend==="indexeddb") return saveNow(epoch);
    const locks=globalThis.navigator&&globalThis.navigator.locks;
    return locks&&typeof locks.request==="function"?saveWithLock(epoch,locks):saveNow(epoch);
  });
  // La catena deve restare risolvibile anche quando una singola operazione
  // fallisce: le salvataggi successivi devono comunque poter proseguire.
  saveQueue=task.catch(()=>false);
  return task.finally(()=>{ storageSavePending=Math.max(0,storageSavePending-1); });
}
function save(){
  // Un'azione locale invalida eventuali letture remote già in volo.
  storageReadEpoch++;
  storageStateRevision++;
  storageDirty=true;
  if(storageBackend==="pending") return storageReady.then(()=>save());
  const epoch=storageEpoch;
  // Le scritture rapide della stessa scheda sono serializzate. Una task già
  // inclusa nello snapshot precedente viene risolta senza una seconda scrittura.
  return enqueueSave(epoch,storageStateRevision);
}
function saveReplacement(){
  // Le sostituzioni esplicite invalidano le task precedenti e usano il
  // baseline più recente al momento della loro esecuzione.
  const epoch=++storageEpoch, stateRevision=++storageStateRevision;
  storageReadEpoch++;
  storageDirty=true;
  if(storageBackend==="pending"){
    return storageReady.then(()=>enqueueSave(epoch,stateRevision,true));
  }
  return enqueueSave(epoch,stateRevision,true);
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
      catch(_){ /* il download è già stato avviato */ }
    },0);
    return true;
  }catch(_){
    if(url&&typeof globalThis.URL?.revokeObjectURL==="function"){
      try{ globalThis.URL.revokeObjectURL(url); }catch(__){ }
    }
    alert("Impossibile esportare una copia dei progressi.");
    return false;
  }
}
async function applyImportedState(raw){
  let value;
  try{ value=JSON.parse(raw); }
  catch(_){ alert("Il file selezionato non contiene JSON valido."); return false; }
  const normalized=sanitizeState(value);
  if(normalized.issue){ alert(`Import non riuscito: ${normalized.issue}`); return false; }
  if(!confirm("Importare questa copia sostituirà i progressi attualmente salvati. Vuoi continuare?")) return false;

  // Annulla eventuali salvataggi in volo e ricostruisce tutta la UI sul nuovo stato.
  state=normalized.state;
  storageLoadIssue="";
  storageWriteBlocked=false;
  storageReconcileRequired=false;
  storageLegacyNeedsCleanup=false;
  storageConflict=false;
  progressStore.clearLocal();
  renderPersistedState();
  return await saveReplacement();
}
async function importProgress(file){
  if(!file) return;
  // Lo stato reale occupa pochi KB: un limite evita che un file accidentale
  // enorme blocchi il thread durante JSON.parse.
  if(file.size>MAX_RAW_STATE_LENGTH){
    alert("Il file è troppo grande: il backup deve pesare al massimo 1 MB.");
    return;
  }
  try{ await applyImportedState(await file.text()); }
  catch(_){ alert("Impossibile leggere il file selezionato."); }
}
function hasActiveTransientState(){
  return !document.getElementById("cardsStage").classList.contains("hidden") ||
    !document.getElementById("quizStage").classList.contains("hidden") ||
    seq.i>0 || document.getElementById("seqInput").value.trim()!=="" ||
    wSel!==null || document.getElementById("wCellInput").value.trim()!=="";
}
function hasPendingTransientState(){
  // Le schermate di riepilogo non contengono input non salvati, ma proteggono
  // comunque da un aggiornamento remoto finché non vengono chiuse.
  return hasActiveTransientState() ||
    !document.getElementById("cardsDone").classList.contains("hidden") ||
    !document.getElementById("quizDone").classList.contains("hidden");
}
function transientStateSignature(){
  const visible=id=>!document.getElementById(id).classList.contains("hidden");
  return JSON.stringify([
    visible("cardsStage"),visible("cardsDone"),
    visible("quizStage"),visible("quizDone"),
    cards.done,cards.queue.length,cards.flipped,
    quiz.i,quiz.answered,seq.i,seq.ok,seq.bad,seq.marks.length,
    document.getElementById("seqInput").value,
    wSel,document.getElementById("wCellInput").value
  ]);
}
function resetTransientUI(){
  cards={queue:[],dir:null,total:0,done:0,ok:0,flipped:false};
  resetCardsUI();
  quiz={list:[],i:0,score:0,streak:0,best:0,wrong:[],answered:false,finished:false};
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
function showTransientReadConflict(message){
  storageConflict=true;
  showStorageWarning("conflict",message ||
    "Un’altra scheda ha aggiornato i progressi mentre una sessione era aperta. Ricarica da disco per continuare senza mescolare stati.");
}

async function reloadFromDisk(){
  const hasUnsavedState=storageDirty || hasPendingTransientState();
  if((storageConflict||hasUnsavedState) &&
     !confirm("Ricaricare da disco chiuderà eventuali sessioni aperte e scarterà eventuali cambiamenti non salvati. Continuare?")) return;
  const transientSignature=transientStateSignature();
  const epoch=++storageEpoch, readEpoch=++storageReadEpoch, eventRevision=storageEventRevision;
  try{
    // Attendi le transazioni già avviate: una scrittura stale che termina dopo
    // la lettura potrebbe rimettere su disco lo snapshot precedente.
    await saveQueue.catch(()=>{});
    if(epoch!==storageEpoch) return;
    const loaded=await readActiveState();
    if(epoch!==storageEpoch||readEpoch!==storageReadEpoch||eventRevision!==storageEventRevision) return;
    if(transientStateSignature()!==transientSignature){
      showTransientReadConflict(
        "Una sessione è iniziata o è cambiata mentre i progressi venivano ricaricati. Ricarica di nuovo per confermare la sostituzione.");
      return;
    }
    applyLoadedState(loaded);
    renderPersistedState();
    showStorageLoadIssue();
    const h=document.querySelector("section.view.active h2");
    if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
  }catch(_){
    if(epoch===storageEpoch&&readEpoch===storageReadEpoch&&eventRevision===storageEventRevision) storageReadError();
  }
}
const openImportDialog=()=>document.getElementById("progressFile").click();
document.getElementById("storageImport").onclick=openImportDialog;
document.getElementById("importBackup").onclick=openImportDialog;
document.getElementById("storageExport").onclick=exportProgress;
document.getElementById("exportBackup").onclick=exportProgress;
document.getElementById("storageReload").onclick=()=>{ reloadFromDisk(); };
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
  try{ return e.storageArea===globalThis.localStorage; }
  catch(_){ return false; }
}
async function handleProgressEvent(announced){
  // Un remote reset (`newValue:null`) è significativo anche se coincide con
  // un baseline vuoto: ignorarlo permetterebbe a una tab dirty di sovrascriverlo.
  // Per un valore non nullo identico al baseline possiamo invece ignorare
  // l'annuncio quando la tab è pulita.
  if(announced.raw!==undefined && announced.raw!==null &&
     announced.raw===storageBaseline && !storageDirty) return;
  // Un annuncio rimane rilevante anche se una scrittura locale è ancora in
  // volo: evita che il suo completamento cancelli il conflitto appena visto.
  storageEventRevision++;
  if(storageDirty){
    storageReadEpoch++;
    storageConflict=true;
    showStorageWarning("conflict",
      "Un’altra scheda ha aggiornato i progressi. Esporta questa copia o ricarica da disco.");
    return;
  }
  if(hasPendingTransientState()){
    storageReadEpoch++;
    showTransientReadConflict();
    return;
  }
  const readEpoch=++storageReadEpoch;
  try{
    const loaded=await readActiveState();
    if(readEpoch!==storageReadEpoch) return;
    if(storageDirty){
      storageConflict=true;
      showStorageWarning("conflict",
        "Un’altra scheda ha aggiornato i progressi. Esporta questa copia o ricarica da disco.");
      return;
    }
    // La sessione può iniziare mentre la lettura è in volo: applicare lo snapshot
    // chiamerebbe renderPersistedState() e cancellerebbe silenziosamente cards, quiz o input.
    if(hasPendingTransientState()){
      showTransientReadConflict();
      return;
    }
    applyLoadedState(loaded);
    renderPersistedState();
    showStorageLoadIssue();
  }catch(_){
    if(readEpoch===storageReadEpoch) storageReadError();
  }
}
function handleStorageEvent(e){
  if(!isRelevantStorageEvent(e)) return;
  if(storageBackend==="indexeddb" && e.newValue!==storageBaseline && e.newValue!==null){
    // Un fallback locale divergente non può essere risolto leggendo solo IDB:
    // segnalalo e blocca scritture automatiche finché l'utente non sceglie.
    storageEventRevision++;
    storageReadEpoch++;
    storageReconcileRequired=true;
    storageConflict=true;
    storageLoadIssue="È comparso un aggiornamento localStorage diverso dalla copia IndexedDB. Per evitare perdita dati, l’app chiede di importare o azzerare prima di scrivere.";
    showStorageWarning("conflict",storageLoadIssue);
    return;
  }
  handleProgressEvent({raw:e.newValue});
}
progressStore.subscribe(event=>{
  if(event && event.type==="backend-lost"){
    storageBackend="localstorage";
    storageReadEpoch++;
    storageLoadIssue="IndexedDB è stato chiuso da un’altra scheda. I progressi passano al fallback localStorage; verifica la copia locale prima di continuare.";
    if(appReady) showStorageWarning("load",storageLoadIssue);
    return;
  }
  if(!appReady){ pendingStorageEvent=event; return; }
  handleProgressEvent(event);
});
globalThis.addEventListener("storage",e=>{
  if(!isRelevantStorageEvent(e)) return;
  // L'evento può arrivare tra storage.js e i moduli app: conserva l'ultimo senza
  // chiamare funzioni UI che non sono ancora state inizializzate.
  if(!appReady){ pendingStorageEvent=e; return; }
  handleStorageEvent(e);
});
globalThis.addEventListener("beforeunload",e=>{
  if(!storageDirty&&!storageSavePending&&!hasActiveTransientState()) return;
  e.preventDefault(); e.returnValue="";
});
function mastery(z){ const v=+state.mastery[z]; return Number.isFinite(v)?Math.round(v):0; }
function addMastery(z,d){
  const v=Math.max(0,Math.min(100,mastery(z)+d));
  state.mastery[z]=Math.round(v);
}
// soglia unica di "padroneggiato": usata dal contatore in testa, dagli ambiti
// flashcard/quiz e dall'etichetta delle statistiche
const MASTERY_THRESHOLD=70;
function masteredCount(){ return ELEMENTS.filter(e=>mastery(e.z)>=MASTERY_THRESHOLD).length; }
function avgMastery(){ return Math.round(ELEMENTS.reduce((s,e)=>s+mastery(e.z),0)/ELEMENTS.length); }
