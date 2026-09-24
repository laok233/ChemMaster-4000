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
