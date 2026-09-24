"use strict";
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
          if(c && !c.classList.contains("dim")) c.classList.add("match");
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
    // Le celle escluse restano visibili per l'esplorazione con il mouse,
    // ma non rubano il tab order: la navigazione da tastiera segue i match.
    c.tabIndex=ok?0:-1;
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
