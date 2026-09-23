"use strict";
// Piccolo costruttore DOM per mantenere testo e attributi fuori dai template HTML.
function makeElement(tag,attrs={},...children){
  const node=document.createElement(tag);
  Object.entries(attrs).forEach(([name,value])=>{
    if(value===undefined||value===null||value===false) return;
    if(name==="class") node.className=value;
    else if(name==="text") node.textContent=value;
    else if(name==="style") Object.assign(node.style,value);
    else if(name==="dataset") Object.assign(node.dataset,value);
    else if(name.startsWith("on")&&typeof value==="function") node.addEventListener(name.slice(2),value);
    else node.setAttribute(name,String(value));
  });
  children.forEach(child=>{ if(child!==undefined&&child!==null) node.append(child); });
  return node;
}
/* ========================= NAV ========================= */
function go(v){
  // le viste le decide il DOM: un data-view senza sezione (o una sezione dimenticata)
  // non deve nascondere la pagina intera
  const sections=[...document.querySelectorAll("main section.view")];
  if(!sections.some(s=>s.id==="view-"+v)) return;
  sections.forEach(s=>s.classList.toggle("active",s.id==="view-"+v));
  document.querySelectorAll("#tabs button").forEach(b=>{
    const on=b.dataset.view===v;
    b.classList.toggle("active",on);
    // aria-current: senza uno screen reader la vista attiva non è annunciable
    if(on) b.setAttribute("aria-current","true"); else b.removeAttribute("aria-current");
  });
  if(v==="stats") renderStats();
  if(v==="cards") refreshCardScopes();
  if(v==="quiz") refreshQuizScopes();
  // il focus segue la vista: da tastiera si continua dall'indirizzo della nuova pagina
  const h=document.querySelector("#view-"+v+" h2");
  if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
  const reduceMotion=!!(globalThis.matchMedia&&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches);
  window.scrollTo({top:0,behavior:reduceMotion?"auto":"smooth"});
}
document.getElementById("tabs").addEventListener("click",e=>{
  const b=e.target.closest("button[data-view]"); if(b) go(b.dataset.view);
});
document.body.addEventListener("click",e=>{
  const b=e.target.closest("[data-goto]"); if(b) go(b.dataset.goto);
});
function updateHead(){
  const p=masteredCount(), tot=ELEMENTS.length;
  const pct=tot?p/tot*100:0;
  document.getElementById("headPctTxt").textContent = `${p}/${tot} padroneggiati`;
  const track=document.getElementById("headPctTrack");
  track.setAttribute("aria-valuemax",String(tot));
  track.setAttribute("aria-valuenow",String(p));
  track.setAttribute("aria-valuetext",`${p} di ${tot} elementi padroneggiati`);
  document.getElementById("headPctBar").style.width = pct+"%";
}

/* ========================= TAVOLA ========================= */
const activeCats=new Set(CAT_DEF.map(c=>c.id));
let placeholderTimer=null;
// evidenziazione "biorilevanti": come i filtri di categoria, non persistita
let bioOn=false;
function cellChildren(e){
  return [
    makeElement("span",{class:"n",text:e.z}),
    makeElement("span",{class:"s",text:e.sym}),
    makeElement("span",{class:"nm",text:e.name}),
    makeElement("span",{class:"mbar",style:{width:`${mastery(e.z)}%`}})
  ];
}
function setCellA11y(cell,e,kind){
  const status=kind==="solved"?"casella completata, ":
    kind==="table"?`categoria ${CAT_LABEL[e.cat]}, `:"";
  cell.setAttribute("aria-label",
    `${status}${e.name}, simbolo ${e.sym}, numero atomico ${e.z}, padroneggiamento ${mastery(e.z)}%`);
}
function buildGrid(host, opts={}){
  // Costruisci la griglia fuori dal DOM e sostituiscila in una sola operazione:
  // 118 celle vengono rigenerate a ogni reset/reload senza provocare una
  // sequenza di 140+ mutazioni sulla griglia già montata.
  const fragment=document.createDocumentFragment();
  for(let g=1;g<=18;g++){
    const d=document.createElement("div"); d.className="gnum"; d.textContent=g;
    d.style.gridColumn=g+1; d.style.gridRow=1; fragment.appendChild(d);
  }
  for(let p=1;p<=7;p++){
    const d=document.createElement("div"); d.className="pnum"; d.textContent=p;
    d.style.gridColumn=1; d.style.gridRow=p+1; fragment.appendChild(d);
  }
  ["6","7"].forEach((t,i)=>{
    const d=document.createElement("div"); d.className="pnum"; d.textContent=t+"*";
    d.style.gridColumn=1; d.style.gridRow=10+i; fragment.appendChild(d);
  });
  ELEMENTS.forEach(e=>{
    const b=document.createElement("button");
    b.type="button"; b.className="cell cat-"+e.cat;
    if(opts.blank && !state.write.solved[e.z]) b.classList.add("blank");
    if(opts.blank && state.write.solved[e.z]) b.classList.add("solved");
    if(opts.blank) b.setAttribute("aria-pressed","false");
    else if(e.z===detailZ){ b.setAttribute("aria-current","true"); b.classList.add("sel"); }
    b.dataset.z=e.z;
    b.style.gridColumn=e.x+1; b.style.gridRow=e.y+1;
    b.append(...cellChildren(e));
    // nella "tavola vuota" il tooltip non deve svelare nome e simbolo
    if(opts.blank && !state.write.solved[e.z]){
      b.setAttribute("aria-label",
        `Casella vuota, periodo ${e.period}`+(e.group?`, gruppo ${e.group}`:", elementi f"));
    }else{
      b.title=`${e.name} (${e.sym}) — Z=${e.z}`;
      setCellA11y(b,e,opts.blank?"solved":"table");
    }
    fragment.appendChild(b);
  });
  if(!opts.blank){
    [[6,"57–71",57],[7,"89–103",89]].forEach(([y,label,firstZ])=>{
      const d=document.createElement("button");
      d.type="button"; d.className="ph"; d.textContent=label;
      d.style.gridColumn=4; d.style.gridRow=y+1;
      d.onclick=()=>{
        clearTimeout(placeholderTimer);
        for(let z=firstZ;z<=firstZ+14;z++){
          const c=host.querySelector(`[data-z="${z}"]`);
          if(c) c.classList.add("match");
        }
        // dopo l'evidenziazione si torna allo stato deciso dalla ricerca attiva,
        // così la sottolineatura di una query in corso non viene persa
        placeholderTimer=setTimeout(applyFilter,1600);
      };
      fragment.appendChild(d);
    });
  }else{
    // segnaposto anche nella tavola vuota: altrimenti restano due celle vuote
    // nel gruppo 3 (periodi 6 e 7). Non interattivi: qui applyFilter gira solo
    // su #ptable, l'evidenziazione resterebbe appiccicata
    [[6,"57–71"],[7,"89–103"]].forEach(([y,label])=>{
      const d=document.createElement("div");
      d.className="ph static"; d.textContent=label;
      d.style.gridColumn=4; d.style.gridRow=y+1;
      fragment.appendChild(d);
    });
  }
  host.replaceChildren(fragment);
}
function applyFilter(){
  const q=document.getElementById("searchEl").value.trim().toLowerCase();
  // se la query coincide con un simbolo, siacciono solo i simboli:
  // evita che "fe" illumini anche Fermio
  const symExact = !!q && ELEMENTS.some(x=>x.sym.toLowerCase()===q);
  let visible=0;
  document.querySelectorAll("#ptable .cell").forEach(c=>{
    const e=BY_Z[c.dataset.z];
    const matchQ = !q || String(e.z)===q ||
                   e.sym.toLowerCase()===q || e.sym.toLowerCase().startsWith(q) ||
                   (!symExact && e.name.toLowerCase().includes(q));
    const matchC = activeCats.has(e.cat);
    // con il chip acceso i biorilevanti restano accesi, tutti gli altri si oscurano
    const matchB = !bioOn || BIO_Z.has(e.z);
    const ok = matchQ && matchC && matchB;
    if(ok) visible++;
    c.classList.toggle("dim",!ok);
    c.classList.toggle("match", ok && (!!q || (bioOn && BIO_Z.has(e.z))));
  });
  const status=document.getElementById("filterStatus");
  if(status) status.textContent=visible===0?
    "Nessun elemento corrisponde ai filtri.":
    visible===ELEMENTS.length?`Tutti i ${visible} elementi sono mostrati.`:
      `${visible} elementi mostrati su ${ELEMENTS.length}.`;
}
function setBio(on){
  bioOn=!!on;
  const b=document.getElementById("bioToggle");
  b.classList.toggle("on",bioOn);
  b.setAttribute("aria-pressed",String(bioOn));
  applyFilter();
}
function renderLegend(){
  const host=document.getElementById("legend"); host.replaceChildren();
  CAT_DEF.forEach(c=>{
    const b=document.createElement("button");
    b.type="button"; b.className="chip on"; b.dataset.cat=c.id; b.setAttribute("aria-pressed","true");
    b.append(makeElement("i",{style:{background:`var(--${c.v})`}}),c.label);
    b.onclick=()=>{ activeCats.has(c.id)?activeCats.delete(c.id):activeCats.add(c.id);
      const on=activeCats.has(c.id);
      b.classList.toggle("on",on); b.classList.toggle("off",!on);
      b.setAttribute("aria-pressed",String(on)); applyFilter(); };
    host.appendChild(b);
  });
}
let detailZ=1;   // elemento mostrato nel pannello dettagli
function renderDetail(z){
  detailZ=z;
  const e=BY_Z[z]; const host=document.getElementById("detail");
  const posTxt = (e.y===9||e.y===10)
    ? `Periodo ${e.period} · ${e.y===9?"Lantanoidi":"Attinoidi"} (riga separata)`
    : `Gruppo ${e.group} · Periodo ${e.period}`;
  // Il valore tra parentesi quadre non è un peso in u: è il numero di massa
  // dell'isotopo indicato da IUPAC per gli elementi senza isotopi stabili.
  const radioactive=e.mass.startsWith("[");
  const massLabel=radioactive?"Numero di massa":"Massa atomica";
  const massValue=radioactive?e.mass:`${e.mass} u`;
  const box=boxOf(z);
  const category=makeElement("div",{class:"detail-cat"},CAT_LABEL[e.cat],
    BIO_Z.has(e.z)?makeElement("span",{class:"bio-badge",text:"🧬 biorilevante"}):null);
  const hero=makeElement("div",{class:"detail-hero"},
    makeElement("div",{class:`detail-sym cat-${e.cat}`},
      makeElement("b",{text:e.sym}),makeElement("span",{text:e.z})),
    makeElement("div",{},makeElement("p",{class:"detail-name",text:e.name}),category));
  const boxText=box===null?"— (nuovo)":box+"° mazzo · "+
    (box===0?"oggi":BOX_DAYS[box]+(BOX_DAYS[box]===1?" giorno":" giorni"));
  const pairs=[
    ["Numero atomico",e.z],[massLabel,massValue],["Posizione",posTxt],
    ["Padroneggio",`${mastery(e.z)}%`],["Mazzo flashcard",boxText]
  ];
  const details=makeElement("dl",{class:"kv"},...pairs.flatMap(([label,value])=>[
    makeElement("dt",{text:label}),makeElement("dd",{text:value})
  ]));
  host.replaceChildren(
    hero,
    details,
    makeElement("div",{class:"cfg",text:prettyCfg(e.cfg)}),
    makeElement("div",{class:"shells"},...e.shells.map((s,i)=>makeElement("span",{text:`n${i+1}: ${s}`}))),
    makeElement("p",{class:"legend-note",text:"Configurazione elettronica e gusci (modello a gusci)."}),
    makeElement("div",{class:"row",style:{marginTop:"12px"}},
      makeElement("button",{type:"button",class:"btn sm","data-goto":"cards",text:"Studia con le flashcard"}))
  );
}
function refreshCellMastery(z){
  document.querySelectorAll(`.cell[data-z="${z}"]`).forEach(c=>{
    const bar=c.querySelector(".mbar"); if(bar) bar.style.width=mastery(z)+"%";
    if(!c.classList.contains("blank")) setCellA11y(c,BY_Z[z],c.closest("#wtable")?"solved":"table");
  });
  // se il pannello dettagli mostra questo elemento, anche % e mazzo devono aggiornarsi
  if(detailZ===z) renderDetail(z);
}

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
function dueNow(z){ const d=state.due[z]; return !d || d<=Date.now(); }
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
  if(cards.flipped && ["1","2","3"].includes(e.key)) gradeCard(+e.key-1);
});

/* ========================= QUIZ ========================= */
const questionFieldLabel=f=>f==="symbol"?"Simbolo":f==="name"?"Nome":"Numero";
const QTYPES=[
  {id:"n2s", from:"name",   to:"symbol", prompt:e=>["Qual è il simbolo di ",makeElement("em",{text:e.name}),"?"]},
  {id:"s2n", from:"symbol", to:"name",   prompt:e=>["Che elemento è ",makeElement("em",{text:e.sym}),"?"]},
  {id:"z2s", from:"number", to:"symbol", prompt:e=>["Qual è il simbolo dell’elemento ",makeElement("em",{text:e.z}),"?"]},
  {id:"s2z", from:"symbol", to:"number", prompt:e=>["Qual è il numero atomico di ",makeElement("em",{text:e.sym}),"?"]},
  {id:"n2z", from:"name",   to:"number", prompt:e=>["Qual è il numero atomico di ",makeElement("em",{text:e.name}),"?"]},
  {id:"z2n", from:"number", to:"name",   prompt:e=>["Che elemento ha numero atomico ",makeElement("em",{text:e.z}),"?"]}
];
function buildQuizTypes(){
  const host=document.getElementById("quizTypes"); host.replaceChildren();
  QTYPES.forEach(t=>{
    const input=makeElement("input",{type:"checkbox",value:t.id,checked:true});
    const label=makeElement("label",{},input,
      ` ${questionFieldLabel(t.from)} → ${questionFieldLabel(t.to)}`);
    host.appendChild(label);
  });
}
let quizScopeBuilt=false;
function refreshQuizScopes(){
  if(!quizScopeBuilt){ scopeOptions(document.getElementById("quizScope")); quizScopeBuilt=true; }
  document.getElementById("wrongCount").textContent=state.wrongZ.length;
}

let quiz={list:[],i:0,score:0,streak:0,best:0,wrong:[],answered:false};
// valore sentinella della quinta opzione: non può collidere con simboli, nomi o numeri
const NON_SO="__nons__";
function makeQuestion(e,type,pool){
  const answer=fieldValue(e,type.to);
  const opts=new Set([answer]);
  const src = pool.length>=6 ? pool : ELEMENTS;
  const others=shuffle(src.filter(x=>x.z!==e.z));
  for(const o of others){
    const v=fieldValue(o,type.to);
    if(!opts.has(v)) opts.add(v);
    if(opts.size===4) break;
  }
  return {e,type,options:shuffle([...opts]),answer};
}
function startQuiz(onlyWrong){
  const types=[...document.querySelectorAll("#quizTypes input:checked")].map(i=>i.value)
    .map(id=>QTYPES.find(t=>t.id===id));
  if(!types.length){ alert("Seleziona almeno un tipo di domanda."); return; }
  let pool = onlyWrong ? state.wrongZ.map(z=>BY_Z[z]).filter(Boolean) : scopePool(document.getElementById("quizScope").value);
  if(!pool.length){ alert("Nessun elemento in questo ambito."); return; }
  pool=shuffle(pool);
  const n=Math.max(1,Math.min(+document.getElementById("quizLen").value || pool.length, pool.length));
  quiz={list:[],i:0,score:0,streak:0,best:0,wrong:[],answered:false};
  for(let k=0;k<n;k++) quiz.list.push(makeQuestion(pool[k],types[k%types.length],pool));
  document.getElementById("quizSetup").classList.add("hidden");
  document.getElementById("quizDone").classList.add("hidden");
  document.getElementById("quizStage").classList.remove("hidden");
  renderQuestion();
}
function renderQuestion(){
  const q=quiz.list[quiz.i];
  quiz.answered=false;
  document.getElementById("qIdx").textContent=`Domanda ${quiz.i+1}/${quiz.list.length}`;
  document.getElementById("qStreak").textContent=`🔥 Serie: ${quiz.streak}`;
  document.getElementById("qScore").textContent=`Punti: ${quiz.score}`;
  document.getElementById("qText").replaceChildren(...q.type.prompt(q.e));
  const host=document.getElementById("qOptions"); host.replaceChildren();
  q.options.forEach((v,i)=>{
    const b=document.createElement("button");
    b.className="opt"; b.type="button"; b.textContent=v; b.dataset.v=v;
    b.setAttribute("aria-keyshortcuts",String(i+1));
    host.appendChild(b);
  });
  // quinta opzione: rinunciare in partenza è meglio che indovinare a caso
  const skip=document.createElement("button");
  skip.className="opt skip"; skip.type="button"; skip.textContent="Non so"; skip.dataset.v=NON_SO;
  skip.setAttribute("aria-keyshortcuts","5");
  host.appendChild(skip);
  document.getElementById("qFeedback").textContent="";
  document.getElementById("qFeedback").className="feedback";
  document.getElementById("qNext").classList.add("hidden");
  // "Termina" è sempre lì: un quiz si deve poter abbandonare anche
  // senza aver risposto alla prima domanda
  document.getElementById("qEnd").classList.remove("hidden");
  document.getElementById("qText").focus({preventScroll:true});
}
function answerQuiz(v){
  if(quiz.answered) return;
  quiz.answered=true;
  const q=quiz.list[quiz.i];
  const skipped = v===NON_SO;              // "Non so": nessun tentativo di indovinare
  const ok = !skipped && v===q.answer;
  document.querySelectorAll("#qOptions .opt").forEach(b=>{
    b.disabled=true;
    b.removeAttribute("aria-keyshortcuts");
    if(b.dataset.v===q.answer) b.classList.add("correct");
    else if(skipped){ if(b.dataset.v===NON_SO) b.classList.add("chosen"); }
    else if(b.dataset.v===v) b.classList.add("wrong");
  });
  const fb=document.getElementById("qFeedback");
  if(ok){
    quiz.score+=10; quiz.streak++; quiz.best=Math.max(quiz.best,quiz.streak);
    addMastery(q.e.z,8);
    state.quiz.correct++;
    state.wrongZ=state.wrongZ.filter(z=>z!==q.e.z);   // risposta giusta: tolto dagli errori
    fb.textContent=`Esatto! ${q.e.name} (${q.e.sym}) — Z=${q.e.z}`; fb.className="feedback ok";
  }else{
    quiz.streak=0; quiz.wrong.push(q.e.z);
    addMastery(q.e.z,-6);
    state.quiz.wrong++;
    if(!state.wrongZ.includes(q.e.z)) state.wrongZ.push(q.e.z);   // salvato subito, non a fine quiz
    fb.textContent=`${skipped?"Non sapevi":"No"}: la risposta era ${q.answer}. ${q.e.name} (${q.e.sym})`;
    fb.className="feedback no";
  }
  save(); updateHead(); refreshCellMastery(q.e.z);
  document.getElementById("qScore").textContent=`Punti: ${quiz.score}`;
  document.getElementById("qStreak").textContent=`🔥 Serie: ${quiz.streak}`;
  const nx=document.getElementById("qNext");
  nx.classList.remove("hidden");
  nx.textContent = quiz.i+1<quiz.list.length ? "Prossima →" : "Risultati →";
  nx.focus({preventScroll:true});
  document.getElementById("qEnd").classList.remove("hidden");
}
function nextQuestion(){
  if(quiz.i+1<quiz.list.length){ quiz.i++; renderQuestion(); }
  else finishQuiz();
}
function finishQuiz(){
  const answered=quiz.score/10+quiz.wrong.length;   // domande effettivamente risposte
  if(answered>0){
    state.quiz.history.unshift({d:Date.now(),score:quiz.score,total:quiz.list.length,answered,wrong:quiz.wrong});
    state.quiz.history=state.quiz.history.slice(0,10);
  }
  save();
  document.getElementById("quizStage").classList.add("hidden");
  const d=document.getElementById("quizDone"); d.classList.remove("hidden");
  document.getElementById("quizScoreBig").textContent=`${quiz.score/10}/${quiz.list.length}`;
  const pct=answered?Math.round((answered-quiz.wrong.length)/answered*100):0;
  document.getElementById("quizSummary").textContent =
    (answered?`${pct}% di risposte giuste`:"Nessuna risposta data") +
    (answered<quiz.list.length?` · risposte ${answered}/${quiz.list.length}`:"") +
    ` · miglior serie: ${quiz.best}` +
    (quiz.wrong.length?` · ${quiz.wrong.length} elementi da ripassare`
      :(answered?" · nessun errore, ottimo!":""));
  document.getElementById("quizFix").classList.toggle("hidden",quiz.wrong.length===0);
  document.getElementById("wrongCount").textContent=state.wrongZ.length;
  document.getElementById("quizScoreBig").focus({preventScroll:true});
}
document.getElementById("startQuiz").onclick=()=>startQuiz(false);
document.getElementById("quizWrongBtn").onclick=()=>{
  if(!state.wrongZ.length){ alert("Non hai ancora errori da ripassare."); return; }
  startQuiz(true);
};
document.getElementById("quizFix").onclick=()=>startQuiz(true);
document.getElementById("qOptions").addEventListener("click",e=>{
  const b=e.target.closest(".opt"); if(b && !b.disabled) answerQuiz(b.dataset.v);
});
document.getElementById("qNext").onclick=nextQuestion;
document.getElementById("qEnd").onclick=finishQuiz;
document.getElementById("quizAgain").onclick=()=>{
  document.getElementById("quizDone").classList.add("hidden");
  document.getElementById("quizSetup").classList.remove("hidden");
  document.getElementById("startQuiz").focus({preventScroll:true});
};
document.addEventListener("keydown",e=>{
  // come nelle flashcard: Ctrl/Cmd/Alt/Shift+1..5 non deve rispondere al posto nostro
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey) return;
  if(!document.getElementById("view-quiz").classList.contains("active")) return;
  if(document.getElementById("quizStage").classList.contains("hidden")) return;
  if(!quiz.answered && ["1","2","3","4","5"].includes(e.key)){
    const b=document.querySelectorAll("#qOptions .opt")[+e.key-1];
    if(b && !b.disabled) answerQuiz(b.dataset.v);
  }
  // focus su "Prossima"/"Termina": Enter/Spazio attivano il bottone, non avanzano in automatico
  const onControl=!!(e.target && e.target.closest && e.target.closest("button,select,input,textarea,a[href]"));
  if(quiz.answered && !onControl && (e.key==="Enter"||e.key===" ")) { e.preventDefault(); nextQuestion(); }
});

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
function clearCellSelection(){
  document.querySelectorAll("#wtable .cell.sel").forEach(x=>{
    x.classList.remove("sel"); x.setAttribute("aria-pressed","false");
  });
  wSel=null;
  const inp=document.getElementById("wCellInput"); inp.value=""; inp.disabled=true;
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
    clearCellSelection();
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
  state.write.solved={}; save();
  clearCellSelection();   // la griglia viene ricostruita: niente selezione/input residui
  initWriteGrid(); wMsg("Tavola azzerata.","");
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
  inp.focus();
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
  storageEpoch++;
  state=defaultState(); storageWriteBlocked=false; save(); updateHead();
  clearCellSelection();
  renderDetail(1);   // prima della griglia: aria-current deve tornare su H
  buildGrid(document.getElementById("ptable"),{});
  initWriteGrid();
  applyFilter(); renderStats();
  resetTransientUI();   // chiude carte, quiz e sequenza anche durante il reset
};

/* ========================= INIT ========================= */
showStorageLoadIssue();
document.getElementById("searchEl").addEventListener("input",applyFilter);
// il conteggio viene dai dati: non può divergere da BIO_SYMS
document.getElementById("bioToggle").textContent=`🧬 Biorilevanti (${BIO_SYMS.length})`;
document.getElementById("bioToggle").onclick=()=>setBio(!bioOn);
document.getElementById("clearFilter").onclick=()=>{
  clearTimeout(placeholderTimer);
  document.getElementById("searchEl").value="";
  activeCats.clear(); CAT_DEF.forEach(c=>activeCats.add(c.id));
  document.querySelectorAll("#legend .chip").forEach(c=>{
    c.classList.add("on"); c.classList.remove("off"); c.setAttribute("aria-pressed","true");
  });
  setBio(false);   // "Mostra tutti" ripristina la tavola anche dal chip biorilevanti
};
document.getElementById("ptable").addEventListener("click",e=>{
  const c=e.target.closest(".cell"); if(!c) return;
  document.querySelectorAll("#ptable .cell.sel").forEach(x=>{
    x.classList.remove("sel"); x.removeAttribute("aria-current");
  });
  c.classList.add("sel"); c.setAttribute("aria-current","true"); renderDetail(+c.dataset.z);
});

buildQuizTypes();
renderLegend();
buildGrid(document.getElementById("ptable"),{});
initWriteGrid();
renderDetail(1);
applyFilter();
updateHead();
refreshCardScopes();
refreshQuizScopes();
seqRender();
appReady=true;
if(pendingStorageEvent){
  const event=pendingStorageEvent;
  pendingStorageEvent=null;
  handleStorageEvent(event);
}
