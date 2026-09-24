"use strict";
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
  const scope=document.getElementById("quizScope").value;
  const allOption=[...document.getElementById("quizLen").options].find(option=>option.value==="999");
  if(allOption) allOption.textContent=`Tutte (${scopePool(scope).length})`;
  document.getElementById("wrongCount").textContent=state.wrongZ.length;
}
document.getElementById("quizScope").addEventListener("change",refreshQuizScopes);

let quiz={list:[],i:0,score:0,streak:0,best:0,wrong:[],answered:false,finished:false};
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
  quiz={list:[],i:0,score:0,streak:0,best:0,wrong:[],answered:false,finished:false};
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
  if(!quiz.answered || quiz.finished) return;
  if(quiz.i+1<quiz.list.length){ quiz.i++; renderQuestion(); }
  else finishQuiz();
}
function finishQuiz(){
  // Il pulsante può ricevere eventi duplicati (doppio click, richiamo da una
  // scorciatoia): la fine sessione è una transizione terminale idempotente.
  if(quiz.finished || !quiz.list.length) return;
  quiz.finished=true;
  const answered=quiz.score/10+quiz.wrong.length;   // domande effettivamente risposte
  if(answered>0){
    state.quiz.history.unshift({d:Date.now(),score:quiz.score,total:quiz.list.length,answered,wrong:quiz.wrong});
    state.quiz.history=state.quiz.history.slice(0,10);
    save();
  }
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
    if(b && !b.disabled){ e.preventDefault(); answerQuiz(b.dataset.v); }
  }
  // focus su "Prossima"/"Termina": Enter/Spazio attivano il bottone, non avanzano in automatico
  const onControl=!!(e.target && e.target.closest && e.target.closest("button,select,input,textarea,a[href]"));
  if(quiz.answered && !onControl && (e.key==="Enter"||e.key===" ")) { e.preventDefault(); nextQuestion(); }
});
