"use strict";
/* ========================= INIT ========================= */
function initApp(){
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
  document.documentElement.removeAttribute("data-storage-state");
  if(pendingStorageEvent){
    const event=pendingStorageEvent;
    pendingStorageEvent=null;
    if(Object.prototype.hasOwnProperty.call(event,"newValue")) handleStorageEvent(event);
    else handleProgressEvent(event);
  }
}
const appReadyPromise=storageReady.then(initApp);
// Espone il bootstrap anche ai test che valutano gli script classici separatamente.
globalThis.__appReadyPromise=appReadyPromise;
