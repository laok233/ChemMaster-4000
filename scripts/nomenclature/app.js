"use strict";
/* ========================= GUIDA NOMENCLATURA ========================= */
const nomenclatureState={filter:"all",query:""};
const nomenclatureCardRecords=[];
const nomenclatureIndexNodes=new Map();
const nomenclatureIndexGroups=new Map();
let nomenclatureEventsBound=false;

function makeNomenclatureElement(tag,attrs={},...children){
  const node=document.createElement(tag);
  Object.entries(attrs).forEach(([name,value])=>{
    if(value===undefined||value===null||value===false) return;
    if(name==="class") node.className=value;
    else if(name==="text") node.textContent=value;
    else if(name==="dataset") Object.assign(node.dataset,value);
    else node.setAttribute(name,String(value));
  });
  children.forEach(child=>{ if(child!==undefined&&child!==null) node.append(child); });
  return node;
}

function nomenclatureText(value){
  if(Array.isArray(value)) return value.join(" ");
  return value===undefined||value===null ? "" : String(value);
}

// La ricerca deve tollerare la modalità di scrittura più comune: "CO2" per
// CO₂, formule senza pedici Unicode e testo con punteggiatura/accenti leggermente
// diversi. I testi dei dati vengono normalizzati una sola volta durante init.
function normalizeNomenclatureText(value){
  return nomenclatureText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[₀-₉]/g,char=>String(char.charCodeAt(0)-0x2080))
    .replace(/[⁰-⁹]/g,char=>String(char.charCodeAt(0)-0x2070))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim()
    .replace(/\s+/g," ");
}

function nomenclatureSearchText(card){
  const examples=Array.isArray(card.examples)?card.examples:[];
  const exampleText=examples.flatMap(example=>[example.formula,example.name,example.note]);
  const tableText=card.table ? [
    card.table.caption,...card.table.headers,
    ...card.table.rows.flat()
  ] : [];
  return normalizeNomenclatureText([
    card.title,card.topic,card.summary,card.rule,
    ...(card.steps||[]),...exampleText,...(card.notes||[]),...tableText
  ]);
}

function nomenclatureMatches(record,query){
  if(!query || record.searchText.includes(query)) return true;
  // Il nome dell'area ("organica") è confrontato per parole: un semplice
  // includes lo renderebbe parte di "inorganica" e falserebbe i risultati.
  return query.split(" ").every(term=>
    record.areaWords.some(word=>word.startsWith(term)));
}

function nomenclatureAreaLabel(area){
  return NOMENCLATURE_FILTERS.find(filter=>filter.id===area)?.label || area;
}

function nomenclatureCardMatchesFilter(card,filter){
  if(filter==="all") return true;
  if(filter==="traditional") return card.traditional===true;
  return card.area===filter;
}

function nomenclatureCardIdFromHash(){
  let elementId;
  try{ elementId=decodeURIComponent(globalThis.location.hash.slice(1)); }
  catch(_){ return null; }
  const node=document.getElementById(elementId);
  return elementId.startsWith("nom-") && node?.classList.contains("nomenclature-card") ?
    elementId.slice(4) : null;
}

function buildNomenclatureCard(card){
  const titleId=`nom-title-${card.id}`;
  const article=makeNomenclatureElement("article",{
    id:`nom-${card.id}`,
    class:"nomenclature-card",
    "aria-labelledby":titleId,
    dataset:{area:card.area,traditional:String(card.traditional===true)}
  });
  const meta=makeNomenclatureElement("div",{class:"nomenclature-card-meta"},
    makeNomenclatureElement("span",{
      class:`nomenclature-area nomenclature-area-${card.area}`,
      text:nomenclatureAreaLabel(card.area)
    }),
    card.traditional===true?makeNomenclatureElement("span",{
      class:"nomenclature-traditional",
      text:"Nome tradizionale"
    }):null,
    makeNomenclatureElement("span",{class:"nomenclature-topic",text:card.topic})
  );
  const header=makeNomenclatureElement("header",{class:"nomenclature-card-header"},
    meta,
    makeNomenclatureElement("h3",{id:titleId,text:card.title}),
    makeNomenclatureElement("p",{text:card.summary})
  );

  const details=makeNomenclatureElement("details",{class:"nomenclature-details"});
  details.append(
    makeNomenclatureElement("summary",{},"Apri regola ed esempi"),
    makeNomenclatureElement("div",{class:"nomenclature-card-body"},
      makeNomenclatureElement("div",{class:"nomenclature-rule"},
        makeNomenclatureElement("h4",{text:"Regola"}),
        makeNomenclatureElement("p",{text:card.rule})
      ),
      makeNomenclatureElement("h4",{text:"Procedimento"}),
      makeNomenclatureElement("ol",{class:"nomenclature-procedure"},
        ...(card.steps||[]).map(step=>makeNomenclatureElement("li",{text:step}))
      )
    )
  );

  if(card.examples?.length){
    const examples=makeNomenclatureElement("section",{class:"nomenclature-examples-section","aria-label":`Esempi per ${card.title}`},
      makeNomenclatureElement("h4",{text:"Esempi"})
    );
    const list=makeNomenclatureElement("ul",{class:"nomenclature-examples"});
    card.examples.forEach(example=>{
      list.append(makeNomenclatureElement("li",{},
        makeNomenclatureElement("code",{class:"nomenclature-formula",text:example.formula}),
        makeNomenclatureElement("strong",{text:example.name}),
        makeNomenclatureElement("small",{text:example.note})
      ));
    });
    examples.append(list);
    details.lastChild.append(examples);
  }

  if(card.table){
    const tableWrap=makeNomenclatureElement("div",{class:"nomenclature-table-wrap"});
    const table=makeNomenclatureElement("table");
    table.append(
      makeNomenclatureElement("caption",{text:card.table.caption}),
      makeNomenclatureElement("thead",{},makeNomenclatureElement("tr",{},
        ...card.table.headers.map((header,index)=>makeNomenclatureElement("th",{
          scope:"col",text:header
        }))
      )),
      makeNomenclatureElement("tbody",{},
        ...card.table.rows.map(row=>makeNomenclatureElement("tr",{},
          ...row.map((value,index)=>makeNomenclatureElement(index===0?"th":"td",{
            ...(index===0?{scope:"row"}:{}),text:String(value)
          }))
        ))
      )
    );
    tableWrap.append(table);
    details.lastChild.append(tableWrap);
  }

  if(card.notes?.length){
    const notes=makeNomenclatureElement("aside",{class:"nomenclature-notes","aria-label":`Note su ${card.title}`},
      makeNomenclatureElement("h4",{text:"Da ricordare"}),
      makeNomenclatureElement("ul",{},
        ...card.notes.map(note=>makeNomenclatureElement("li",{text:note}))
      )
    );
    details.lastChild.append(notes);
  }

  article.append(header,details);
  return article;
}

function buildNomenclatureFilters(){
  const host=document.getElementById("nomenclatureFilters");
  host.replaceChildren();
  NOMENCLATURE_FILTERS.forEach(filter=>{
    const button=makeNomenclatureElement("button",{
      type:"button",
      class:"chip nomenclature-filter",
      "data-filter":filter.id,
      "aria-pressed":String(filter.id===nomenclatureState.filter)
    },filter.label);
    button.addEventListener("click",()=>{
      nomenclatureState.filter=filter.id;
      updateNomenclatureFilter();
    });
    host.append(button);
  });
}

function buildNomenclatureIndex(){
  const host=document.getElementById("nomenclatureIndex");
  host.replaceChildren();
  nomenclatureIndexNodes.clear();
  nomenclatureIndexGroups.clear();
  const areas=[...new Set(NOMENCLATURE_CARDS.map(card=>card.area))];
  const groups=areas.map(area=>({
    id:area,
    label:nomenclatureAreaLabel(area).replace(/^Nomenclatura\s+/i,"")
  }));
  groups.forEach(group=>{
    const groupNode=makeNomenclatureElement("section",{class:"nomenclature-index-group","aria-labelledby":`nom-index-${group.id}`});
    const heading=makeNomenclatureElement("h3",{id:`nom-index-${group.id}`,text:group.label});
    const list=makeNomenclatureElement("ul",{});
    NOMENCLATURE_CARDS.filter(card=>card.area===group.id).forEach(card=>{
      const item=makeNomenclatureElement("li",{});
      const link=makeNomenclatureElement("a",{href:`#nom-${card.id}`,text:card.title});
      item.append(link);
      list.append(item);
      nomenclatureIndexNodes.set(card.id,item);
    });
    groupNode.append(heading,list);
    host.appendChild(groupNode);
    nomenclatureIndexGroups.set(group.id,groupNode);
  });
}

function updateNomenclatureIndex(){
  const visibleIds=new Set();
  const visibleAreas=new Set();
  nomenclatureCardRecords.forEach(record=>{
    if(!record.node.hidden){
      visibleIds.add(record.card.id);
      visibleAreas.add(record.card.area);
    }
  });
  const currentId=nomenclatureCardIdFromHash();
  nomenclatureIndexNodes.forEach((item,id)=>{
    item.hidden=!visibleIds.has(id);
    const link=item.querySelector("a");
    if(id===currentId) link.setAttribute("aria-current","location");
    else link.removeAttribute("aria-current");
  });
  nomenclatureIndexGroups.forEach((group,area)=>{
    group.hidden=!visibleAreas.has(area);
  });
}

function updateNomenclatureFilter(){
  const query=normalizeNomenclatureText(nomenclatureState.query);
  const visibleIds=new Set();
  nomenclatureCardRecords.forEach(record=>{
    const matchFilter=nomenclatureCardMatchesFilter(record.card,nomenclatureState.filter);
    const matchQuery=nomenclatureMatches(record,query);
    const visible=matchFilter && matchQuery;
    record.node.hidden=!visible;
    if(visible) visibleIds.add(record.card.id);
  });

  const count=visibleIds.size;
  const total=NOMENCLATURE_CARDS.length;
  const status=document.getElementById("nomenclatureStatus");
  status.textContent=count===0?
    "Nessuna scheda corrisponde alla ricerca o al filtro selezionato.":
    count===total?`Tutte le ${total} schede sono mostrate.`:
      `${count} schede mostrate su ${total}.`;
  status.dataset.empty=String(count===0);
  document.getElementById("clearNomenclature").disabled=
    nomenclatureState.filter==="all" && !nomenclatureState.query.trim();

  document.querySelectorAll("#nomenclatureFilters [data-filter]").forEach(button=>{
    const on=button.dataset.filter===nomenclatureState.filter;
    button.classList.toggle("on",on);
    button.classList.toggle("off",!on);
    button.setAttribute("aria-pressed",String(on));
  });
  updateNomenclatureIndex();
}

function clearNomenclature(){
  nomenclatureState.filter="all";
  nomenclatureState.query="";
  document.getElementById("nomenclatureSearch").value="";
  updateNomenclatureFilter();
  document.getElementById("nomenclatureSearch").focus();
}

function showNomenclatureView(view){
  if(view!=="guide" && view!=="quiz") return;
  const guide=document.getElementById("nomenclatureGuideView");
  const quiz=document.getElementById("nomenclatureQuizView");
  const active=view==="quiz"?quiz:guide;
  guide.hidden=active!==guide;
  quiz.hidden=active!==quiz;
  document.querySelectorAll("#nomenclatureTabs [data-nomenclature-view]").forEach(button=>{
    const on=button.dataset.nomenclatureView===view;
    button.classList.toggle("active",on);
    if(on) button.setAttribute("aria-current","true");
    else button.removeAttribute("aria-current");
  });
  const heading=active.querySelector("h2");
  if(heading){
    heading.setAttribute("tabindex","-1");
    heading.focus({preventScroll:true});
  }
  const reduceMotion=!!(globalThis.matchMedia&&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if(typeof globalThis.scrollTo==="function"){
    globalThis.scrollTo({top:0,behavior:reduceMotion?"auto":"smooth"});
  }
}

const NOMENCLATURE_NOT_KNOWN="__nomenclature_not_known__";
const nomenclatureQuiz={questions:[],index:0,correct:0,answered:0,wrong:[],answeredCurrent:false};

function nomenclatureShuffle(values){
  const result=values.slice();
  for(let index=result.length-1;index>0;index--){
    const other=Math.random()*(index+1)|0;
    [result[index],result[other]]=[result[other],result[index]];
  }
  return result;
}

function buildNomenclatureQuizPool(scope){
  return NOMENCLATURE_CARDS.flatMap(card=>{
    const inScope=scope==="all" || (scope==="traditional"?card.traditional===true:card.area===scope);
    if(!inScope) return [];
    return (card.examples||[]).map((example,index)=>({
      id:`${card.id}:${index}`,
      cardId:card.id,
      area:card.area,
      traditional:card.traditional===true,
      topic:card.topic,
      formula:example.formula,
      name:example.name,
      note:example.note||""
    }));
  });
}

function makeNomenclatureQuizQuestion(entry,pool,index){
  const direction=index%2===0?"formulaToName":"nameToFormula";
  const answerField=direction==="formulaToName"?"name":"formula";
  const answer=entry[answerField];
  const optionSet=new Set([answer]);
  let sources=pool;
  if(sources.length<4) sources=buildNomenclatureQuizPool("all");
  sources.forEach(candidate=>{
    const value=candidate[answerField];
    if(optionSet.size<4 && value!==answer) optionSet.add(value);
  });
  if(optionSet.size<4){
    buildNomenclatureQuizPool("all").forEach(candidate=>{
      const value=candidate[answerField];
      if(optionSet.size<4 && value!==answer) optionSet.add(value);
    });
  }
  return {...entry,direction,answer,options:nomenclatureShuffle([...optionSet])};
}

function nomenclatureQuizPrompt(question){
  const formulaToName=question.direction==="formulaToName";
  return [
    makeNomenclatureElement("span",{},formulaToName?
      "Qual è il nome del composto con formula ":
      "Quale formula corrisponde al nome "),
    makeNomenclatureElement("code",{
      class:"nomenclature-quiz-term",
      text:formulaToName?question.formula:question.name
    }),
    makeNomenclatureElement("span",{},"?")
  ];
}

function updateNomenclatureQuizSetup(){
  const scope=document.getElementById("nomenclatureQuizScope").value;
  const length=document.getElementById("nomenclatureQuizLength");
  const pool=buildNomenclatureQuizPool(scope);
  [...length.options].forEach(option=>{ option.disabled=Number(option.value)>pool.length; });
  if(Number(length.value)>pool.length) length.value=String(Math.min(10,pool.length));
  document.getElementById("nomenclatureQuizPoolCount").textContent=`${pool.length} esempi`;
  document.getElementById("nomenclatureQuizHint").textContent=pool.length?
    `${pool.length} coppie formula–nome disponibili in questo ambito.`:
    "Non ci sono esempi disponibili per questo ambito.";
  document.getElementById("nomenclatureQuizStart").disabled=pool.length===0;
}

function startNomenclatureQuiz(){
  const pool=buildNomenclatureQuizPool(document.getElementById("nomenclatureQuizScope").value);
  if(!pool.length){ updateNomenclatureQuizSetup(); return; }
  const requested=Number(document.getElementById("nomenclatureQuizLength").value)||10;
  const count=Math.max(1,Math.min(requested,pool.length));
  const questions=nomenclatureShuffle(pool).slice(0,count)
    .map((entry,index)=>makeNomenclatureQuizQuestion(entry,pool,index));
  Object.assign(nomenclatureQuiz,{questions,index:0,correct:0,answered:0,wrong:[],answeredCurrent:false});
  document.getElementById("nomenclatureQuizSetup").classList.add("hidden");
  document.getElementById("nomenclatureQuizDone").classList.add("hidden");
  document.getElementById("nomenclatureQuizStage").classList.remove("hidden");
  renderNomenclatureQuizQuestion();
}

function renderNomenclatureQuizQuestion(){
  const question=nomenclatureQuiz.questions[nomenclatureQuiz.index];
  if(!question) return;
  nomenclatureQuiz.answeredCurrent=false;
  document.getElementById("nomenclatureQuizProgress").textContent=
    `Domanda ${nomenclatureQuiz.index+1}/${nomenclatureQuiz.questions.length}`;
  document.getElementById("nomenclatureQuizScore").textContent=`Corrette: ${nomenclatureQuiz.correct}`;
  document.getElementById("nomenclatureQuizMeter").style.width=
    `${(nomenclatureQuiz.index+1)/nomenclatureQuiz.questions.length*100}%`;
  document.getElementById("nomenclatureQuizQuestion").replaceChildren(...nomenclatureQuizPrompt(question));
  const options=document.getElementById("nomenclatureQuizOptions");
  options.replaceChildren();
  question.options.forEach((answer,index)=>{
    const button=makeNomenclatureElement("button",{
      type:"button",
      class:"opt",
      "aria-keyshortcuts":String(index+1),
      dataset:{answer}
    },answer);
    options.append(button);
  });
  const skip=makeNomenclatureElement("button",{
    type:"button",
    class:"opt skip",
    "aria-keyshortcuts":"5",
    dataset:{answer:NOMENCLATURE_NOT_KNOWN}
  },"Non so");
  options.append(skip);
  const feedback=document.getElementById("nomenclatureQuizFeedback");
  feedback.textContent="";
  feedback.className="feedback";
  const next=document.getElementById("nomenclatureQuizNext");
  next.classList.add("hidden");
  document.getElementById("nomenclatureQuizEnd").classList.remove("hidden");
  document.getElementById("nomenclatureQuizQuestion").focus({preventScroll:true});
}

function answerNomenclatureQuiz(answer){
  if(nomenclatureQuiz.answeredCurrent) return;
  const question=nomenclatureQuiz.questions[nomenclatureQuiz.index];
  if(!question) return;
  nomenclatureQuiz.answeredCurrent=true;
  nomenclatureQuiz.answered++;
  const skipped=answer===NOMENCLATURE_NOT_KNOWN;
  const correct=!skipped && answer===question.answer;
  if(correct) nomenclatureQuiz.correct++;
  else nomenclatureQuiz.wrong.push(question);

  document.querySelectorAll("#nomenclatureQuizOptions .opt").forEach(button=>{
    button.disabled=true;
    button.removeAttribute("aria-keyshortcuts");
    if(button.dataset.answer===question.answer) button.classList.add("correct");
    else if(skipped && button.classList.contains("skip")) button.classList.add("chosen");
    else if(button.dataset.answer===answer) button.classList.add("wrong");
  });

  const relation=question.direction==="formulaToName"?
    `${question.formula} si chiama ${question.name}.`:
    `${question.name} ha formula ${question.formula}.`;
  const feedback=document.getElementById("nomenclatureQuizFeedback");
  feedback.textContent=`${correct?"Esatto!":skipped?"Non sapevi.":"Non è corretto."} ${relation} ${question.note}`;
  feedback.className=`feedback ${correct?"ok":"no"}`;
  document.getElementById("nomenclatureQuizScore").textContent=`Corrette: ${nomenclatureQuiz.correct}`;
  const next=document.getElementById("nomenclatureQuizNext");
  next.textContent=nomenclatureQuiz.index+1<nomenclatureQuiz.questions.length?
    "Prossima →":"Risultati →";
  next.classList.remove("hidden");
  next.focus({preventScroll:true});
}

function nextNomenclatureQuizQuestion(){
  if(!nomenclatureQuiz.answeredCurrent) return;
  if(nomenclatureQuiz.index+1<nomenclatureQuiz.questions.length){
    nomenclatureQuiz.index++;
    renderNomenclatureQuizQuestion();
  }else finishNomenclatureQuiz();
}

function finishNomenclatureQuiz(){
  const total=nomenclatureQuiz.questions.length;
  if(!total) return;
  const percentage=nomenclatureQuiz.answered?
    Math.round(nomenclatureQuiz.correct/nomenclatureQuiz.answered*100):0;
  document.getElementById("nomenclatureQuizStage").classList.add("hidden");
  document.getElementById("nomenclatureQuizDone").classList.remove("hidden");
  document.getElementById("nomenclatureQuizResult").textContent=
    `${nomenclatureQuiz.correct}/${total}`;
  document.getElementById("nomenclatureQuizSummary").textContent=
    `${nomenclatureQuiz.answered?`${percentage}% di risposte giuste`:"Nessuna risposta data"}`+
    ` · domande svolte ${nomenclatureQuiz.answered}/${total}`+
    ` · risposte corrette ${nomenclatureQuiz.correct}`;

  const review=document.getElementById("nomenclatureQuizReview");
  const wrongList=document.getElementById("nomenclatureQuizWrong");
  wrongList.replaceChildren();
  nomenclatureQuiz.wrong.forEach(question=>{
    wrongList.append(makeNomenclatureElement("li",{},
      makeNomenclatureElement("span",{class:"nomenclature-quiz-review-topic",text:question.topic}),
      makeNomenclatureElement("strong",{text:`${question.formula} — ${question.name}`}),
      makeNomenclatureElement("small",{text:question.note})
    ));
  });
  review.hidden=nomenclatureQuiz.wrong.length===0;
  document.getElementById("nomenclatureQuizResult").focus({preventScroll:true});
}

function resetNomenclatureQuiz(){
  document.getElementById("nomenclatureQuizDone").classList.add("hidden");
  document.getElementById("nomenclatureQuizStage").classList.add("hidden");
  document.getElementById("nomenclatureQuizSetup").classList.remove("hidden");
  updateNomenclatureQuizSetup();
  document.getElementById("nomenclatureQuizStart").focus({preventScroll:true});
}

function initNomenclatureQuiz(){
  document.body.addEventListener("click",event=>{
    const control=event.target.closest("[data-nomenclature-view]");
    if(control) showNomenclatureView(control.dataset.nomenclatureView);
  });
  document.getElementById("nomenclatureQuizScope").addEventListener("change",updateNomenclatureQuizSetup);
  document.getElementById("nomenclatureQuizStart").addEventListener("click",startNomenclatureQuiz);
  document.getElementById("nomenclatureQuizOptions").addEventListener("click",event=>{
    const button=event.target.closest(".opt");
    if(button&&!button.disabled) answerNomenclatureQuiz(button.dataset.answer);
  });
  document.getElementById("nomenclatureQuizNext").addEventListener("click",nextNomenclatureQuizQuestion);
  document.getElementById("nomenclatureQuizEnd").addEventListener("click",finishNomenclatureQuiz);
  document.getElementById("nomenclatureQuizAgain").addEventListener("click",resetNomenclatureQuiz);
  document.addEventListener("keydown",event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey) return;
    if(document.getElementById("nomenclatureQuizStage").classList.contains("hidden")) return;
    if(event.target?.closest?.("input,select,textarea,[contenteditable='true']")) return;
    if(!nomenclatureQuiz.answeredCurrent && /^[1-5]$/.test(event.key)){
      const buttons=document.querySelectorAll("#nomenclatureQuizOptions .opt");
      const button=buttons[Number(event.key)-1];
      if(button&&!button.disabled){
        event.preventDefault();
        answerNomenclatureQuiz(button.dataset.answer);
      }
    }
    const onControl=!!event.target?.closest?.("button,select,input,textarea,a[href]");
    if(nomenclatureQuiz.answeredCurrent && !onControl && (event.key==="Enter"||event.key===" ")){
      event.preventDefault();
      nextNomenclatureQuizQuestion();
    }
  });
  updateNomenclatureQuizSetup();
}

function initNomenclature(){
  const content=document.getElementById("nomenclatureContent");
  content.replaceChildren();
  nomenclatureCardRecords.length=0;
  NOMENCLATURE_CARDS.forEach(card=>{
    const node=buildNomenclatureCard(card);
    const record={
      card,
      node,
      searchText:nomenclatureSearchText(card),
      areaWords:normalizeNomenclatureText(nomenclatureAreaLabel(card.area)).split(" ")
    };
    nomenclatureCardRecords.push(record);
    content.append(node);
  });
  buildNomenclatureFilters();
  buildNomenclatureIndex();
  if(!nomenclatureEventsBound){
    const search=document.getElementById("nomenclatureSearch");
    search.addEventListener("input",event=>{
      nomenclatureState.query=event.target.value;
      updateNomenclatureFilter();
    });
    search.addEventListener("keydown",event=>{
      if(event.key==="Escape" && nomenclatureState.query){
        event.preventDefault();
        clearNomenclature();
      }
    });
    document.getElementById("clearNomenclature").addEventListener("click",clearNomenclature);
    document.getElementById("nomenclatureIndex").addEventListener("click",event=>{
      if(event.target.closest('a[href^="#nom-"]')) queueMicrotask(updateNomenclatureIndex);
    });
    globalThis.addEventListener("hashchange",updateNomenclatureIndex);
    nomenclatureEventsBound=true;
  }
  updateNomenclatureFilter();
}

initNomenclature();
initNomenclatureQuiz();
globalThis.__nomenclatureReady=true;
