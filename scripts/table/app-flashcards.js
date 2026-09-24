"use strict";
/* ========================= FLASHCARD ========================= */
const DIRS=[
  {id:"n2s", from:"name",   to:"symbol", label:"Nome → Simbolo"},
  {id:"s2n", from:"symbol", to:"name",   label:"Simbolo → Nome"},
  {id:"z2s", from:"number", to:"symbol", label:"Numero atomico → Simbolo"},
  {id:"s2z", from:"symbol", to:"number", label:"Simbolo → Numero atomico"},
  {id:"n2z", from:"name",   to:"number", label:"Nome → Numero atomico"},
  {id:"z2n", from:"number", to:"name",   label:"Numero atomico → Nome"}
];
function fieldValue(e,f){
  if(f==="symbol") return e.sym;
  if(f==="name") return e.name;
  return String(e.z);
}
function fieldLabel(f){ return f==="symbol"?"Simbolo":f==="name"?"Nome":"Numero atomico"; }
function scopeOptions(sel){
  sel.replaceChildren();
  const add=(v,t)=>{const o=document.createElement("option");o.value=v;o.textContent=t;sel.appendChild(o);};
  add("all",`Tutti gli elementi (${ELEMENTS.length})`);
  add("due","Nuovi e da ripassare");
  add("weak",`Non padroneggiati (< ${MASTERY_THRESHOLD}%)`);
  CAT_DEF.forEach(c=>add("cat:"+c.id,c.label));
}
// ultimo mazzetto, derivato dalle scadenze: aggiungere/togliere una scadenza
// in BOX_DAYS deve bastare (i vecchi clamp sul 5° mazzo bloccavano le carte
// e in Progressi facevano apparire "undefined" nell'etichetta)
const MAX_BOX=BOX_DAYS.length-1;
// null = carta mai assegnata; 0 = box reale, da ripassare oggi
function boxOf(z){
  if(!Object.prototype.hasOwnProperty.call(state.leitner,String(z))) return null;
  const v=Math.floor(Number(state.leitner[z]));
  return Number.isFinite(v)?Math.min(MAX_BOX,Math.max(0,v)):null;
}
function dueNow(z){
  // Una scadenza senza scheda assegnata non può nascondere una carta nuova.
  if(boxOf(z)===null) return true;
  const d=state.due[z];
  return !d || d<=Date.now();
}
function scopePool(scope){
  if(scope==="all") return ELEMENTS.slice();
  if(scope==="due") return ELEMENTS.filter(e=>dueNow(e.z));
  if(scope==="weak") return ELEMENTS.filter(e=>mastery(e.z)<MASTERY_THRESHOLD);
  if(scope.startsWith("cat:")) return ELEMENTS.filter(e=>e.cat===scope.slice(4));
  return ELEMENTS.slice();
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];} return a; }

let cards={queue:[],dir:null,total:0,done:0,ok:0,flipped:false};
let cardScopesBuilt=false;
function refreshCardScopes(){
  if(!cardScopesBuilt){
    scopeOptions(document.getElementById("cardScope"));
    const sel=document.getElementById("cardDir");
    DIRS.forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=d.label;sel.appendChild(o);});
    sel.value="n2s";
    cardScopesBuilt=true;
  }
  updateCardInfo();
}
function updateCardInfo(){
  const pool=scopePool(document.getElementById("cardScope").value);
  document.getElementById("cardScopeInfo").textContent=
    `Elementi nell'ambito: ${pool.length} · da ripassare adesso: ${pool.filter(e=>dueNow(e.z)).length}`;
}
document.getElementById("cardScope").addEventListener("change",updateCardInfo);

function startCards(){
  const dir=DIRS.find(d=>d.id===document.getElementById("cardDir").value);
  const scope=document.getElementById("cardScope").value;
  let pool=scopePool(scope);
  const n=Math.max(1, Math.min(+document.getElementById("cardCount").value || pool.length, pool.length));
  // ordina: scaduti/primi mazzi per primi; a parità di priorità si sorteggia
  // (shuffle preliminare + sort stabile), così le nuove carte non sono sempre le stesse
  pool=shuffle(pool);
  pool.sort((a,b)=>{
    const ba=boxOf(a.z)??0, bb=boxOf(b.z)??0;
    if(ba!==bb) return ba-bb;
    const da=state.due[a.z]||0, db=state.due[b.z]||0;
    if(da!==db) return da-db;
    return 0;
  });
  pool=pool.slice(0,n);
  if(!pool.length){ alert("Nessun elemento nell'ambito selezionato."); return; }
  cards={queue:shuffle(pool),dir,total:pool.length,done:0,ok:0,flipped:false};
  document.getElementById("cardsSetup").classList.add("hidden");
  document.getElementById("cardsDone").classList.add("hidden");
  document.getElementById("cardsStage").classList.remove("hidden");
  showCard();
}
function setCardA11y(e,dir,flipped){
  const answer=flipped?`, risposta ${fieldValue(e,dir.to)}`:"";
  const action=flipped?"Usa i pulsanti o i tasti 1, 2 e 3 per giudicarla.":
    "Premi Spazio o Invio per girarla.";
  const card=document.getElementById("card");
  card.setAttribute("aria-expanded",String(flipped));
  if(flipped) card.removeAttribute("aria-keyshortcuts");
  else card.setAttribute("aria-keyshortcuts","Space Enter");
  card.setAttribute("aria-label",
    `Carta ${cards.done+1} di ${cards.total}. ${fieldLabel(dir.from)}: ${fieldValue(e,dir.from)}${answer}. ${action}`);
}
function updateCardMeter(){
  const meterPct=cards.total?Math.round(cards.done/cards.total*100):0;
  const meter=document.getElementById("cardMeterTrack");
  meter.setAttribute("aria-valuenow",String(meterPct));
  meter.setAttribute("aria-valuetext",`${cards.done} di ${cards.total} carte, ${meterPct}%`);
  document.getElementById("cardMeter").style.width=meterPct+"%";
}
function showCard(){
  // Aggiorna il valore anche quando la coda è vuota: l'ultima carta appena
  // valutata deve portare semanticamente la barra al 100% prima del riepilogo.
  updateCardMeter();
  if(!cards.queue.length){ finishCards(); return; }
  cards.flipped=false;
  const e=cards.queue[0], dir=cards.dir;
  document.getElementById("cardTag").textContent=fieldLabel(dir.from);
  document.getElementById("cardIdx").textContent=`${cards.done+1}/${cards.total}`;
  document.getElementById("cardFront").textContent=fieldValue(e,dir.from);
  document.getElementById("cardFront").className="front"+(dir.from==="name"?" small":"");
  const back=document.getElementById("cardBack");
  back.classList.add("hidden"); back.replaceChildren();
  document.getElementById("cardGrade").classList.add("hidden");
  document.getElementById("cardTap").classList.remove("hidden");
  document.getElementById("cardLeft").textContent=`Rimaste: ${cards.queue.length-1}`;
  const box=boxOf(e.z);
  document.getElementById("cardBox").textContent=box===null?"Nuova":
    `${box}° mazzo · ${BOX_DAYS[box]} ${BOX_DAYS[box]===1?"giorno":"giorni"}`;
  setCardA11y(e,dir,false);
  document.getElementById("card").focus({preventScroll:true});
}
function flipCard(){
  if(cards.flipped) return;
  cards.flipped=true;
  const e=cards.queue[0], dir=cards.dir, back=document.getElementById("cardBack");
  back.classList.remove("hidden");
  back.replaceChildren(
    makeElement("div",{class:"big",text:fieldValue(e,dir.to)}),
    makeElement("div",{class:"meta",text:`${e.z} · ${e.sym} · ${e.name} · ${CAT_LABEL[e.cat]}`})
  );
  document.getElementById("cardGrade").classList.remove("hidden");
  document.getElementById("cardTap").classList.add("hidden");
  setCardA11y(e,dir,true);
}
function gradeCard(g){
  if(!cards.flipped) return;
  const e=cards.queue.shift();
  cards.done++;
  const currentBox=boxOf(e.z)??0;
  let box;
  if(g===0){ box=0; addMastery(e.z,-15); }
  else if(g===1){ box=Math.min(MAX_BOX,currentBox+1); addMastery(e.z,12); cards.ok++; }
  else { box=Math.min(MAX_BOX,currentBox+2); addMastery(e.z,20); cards.ok++; }
  state.leitner[e.z]=box;
  state.due[e.z]=Date.now()+BOX_DAYS[box]*DAY;
  save(); updateHead(); refreshCellMastery(e.z);
  showCard();
}
function finishCards(){
  // evita elaborazioni duplicate se il controllo di fine sessione riceve due eventi
  if(document.getElementById("cardsStage").classList.contains("hidden")) return;
  document.getElementById("cardsStage").classList.add("hidden");
  const done=document.getElementById("cardsDone");
  done.classList.remove("hidden");
  // sulle carte effettivamente svolte: fermarsi a metà non deve abbassare la %
  const pct=cards.done?Math.round(cards.ok/cards.done*100):0;
  document.getElementById("cardsScore").textContent=pct+"%";
  document.getElementById("cardsSummary").textContent=
    `Hai rivisto ${cards.done} elementi, ${cards.ok} conosciuti al primo colpo. Le carte sbagliate tornano prima.`;
  document.getElementById("cardsScore").focus({preventScroll:true});
}
function resetCardsUI(){
  document.getElementById("cardsStage").classList.add("hidden");
  document.getElementById("cardsDone").classList.add("hidden");
  document.getElementById("cardsSetup").classList.remove("hidden");
  updateCardInfo();
}
document.getElementById("startCards").onclick=startCards;
document.getElementById("againCards").onclick=()=>{ resetCardsUI(); startCards(); };
document.getElementById("stopCards").onclick=finishCards;
document.getElementById("card").onclick=flipCard;
document.getElementById("cardGrade").addEventListener("click",e=>{
  const b=e.target.closest("button[data-g]"); if(b) gradeCard(+b.dataset.g);
});
document.addEventListener("keydown",e=>{
  // scorciatoie solo senza tasti modificatori: Ctrl/Cmd/Alt/Shift+Spazio
  // (o gli stessi tasti + 1..3) non deve girare la carta o giudicarla
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey) return;
  if(!document.getElementById("view-cards").classList.contains("active")) return;
  if(document.getElementById("cardsStage").classList.contains("hidden")) return;
  // con il focus su un bottone o un campo (es. "Termina sessione", i giudizi)
  // Enter/Spazio devono attivare quell'elemento, non girare la carta
  const onControl=!!(e.target && e.target.closest && e.target.closest("button,select,input,textarea,a[href]"));
  if(!onControl && (e.code==="Space"||e.key==="Enter")){ e.preventDefault(); flipCard(); }
  if(cards.flipped && ["1","2","3"].includes(e.key)){
    e.preventDefault(); gradeCard(+e.key-1);
  }
});
