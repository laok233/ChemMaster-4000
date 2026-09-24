"use strict";
/* Repository di persistenza: IndexedDB atomico con fallback a localStorage. */
function createProgressStore(key,options={}){
  const dbName=options.dbName||"chemmaster-4000";
  const storeName=options.storeName||"progress";
  const channelName=options.channelName||`${key}:updates`;
  const configuredTimeout=Number(options.initTimeoutMs);
  const initTimeoutMs=Number.isFinite(configuredTimeout)&&configuredTimeout>0?configuredTimeout:5000;
  const configuredOperationTimeout=Number(options.operationTimeoutMs);
  const operationTimeoutMs=Number.isFinite(configuredOperationTimeout)&&configuredOperationTimeout>0?
    configuredOperationTimeout:initTimeoutMs;
  const listeners=new Set();
  let db=null, backend="localstorage", channel=null;

  function readLocal(){
    try{ return {available:true,raw:globalThis.localStorage.getItem(key)}; }
    catch(error){ return {available:false,raw:null,error}; }
  }
  function removeLocal(expectedRaw){
    try{
      // Non cancellare un valore modificato dopo la lettura: un'altra scheda
      // potrebbe aver scritto un fallback più recente nel frattempo.
      if(expectedRaw!==undefined && globalThis.localStorage.getItem(key)!==expectedRaw) return false;
      globalThis.localStorage.removeItem(key);
      return true;
    }
    catch(_){ return false; }
  }
  function openDatabase(timeoutMs){
    return new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){ reject(new Error("IndexedDB non disponibile")); return; }
      let settled=false;
      let request;
      let timer;
      const fail=error=>{
        if(settled) return;
        settled=true;
        clearTimeout(timer);
        reject(error||new Error("Apertura IndexedDB fallita"));
      };
      try{ request=globalThis.indexedDB.open(dbName,1); }
      catch(error){ fail(error); return; }
      timer=setTimeout(()=>fail(
        new Error(`Apertura IndexedDB scaduta dopo ${timeoutMs} ms`)),timeoutMs);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(storeName)){
          request.result.createObjectStore(storeName,{keyPath:"key"});
        }
      };
      request.onsuccess=()=>{
        clearTimeout(timer);
        if(settled){ request.result.close(); return; }
        settled=true;
        const opened=request.result;
        opened.onversionchange=()=>{
          try{ opened.close(); }catch(_){ }
          if(db===opened){
            db=null;
            backend="localstorage";
            if(channel){ channel.close(); channel=null; }
            listeners.forEach(listener=>listener({type:"backend-lost"}));
          }
        };
        resolve(opened);
      };
      request.onerror=()=>fail(request.error);
      request.onblocked=()=>fail(new Error("Aggiornamento IndexedDB bloccato"));
    });
  }
  function idbRead(timeoutMs=operationTimeoutMs){
    return new Promise((resolve,reject)=>{
      let transaction;
      try{ transaction=db.transaction(storeName,"readonly"); }
      catch(error){ reject(error); return; }
      let settled=false, timer;
      const finish=(callback,value)=>{
        if(settled) return;
        settled=true; clearTimeout(timer); callback(value);
      };
      const fail=error=>finish(reject,error||new Error("Lettura IndexedDB fallita"));
      const succeed=value=>finish(resolve,value);
      timer=setTimeout(()=>{
        try{ transaction.abort(); }catch(_){ }
        fail(new Error(`Lettura IndexedDB scaduta dopo ${timeoutMs} ms`));
      },Math.max(1,timeoutMs));
      let request;
      try{ request=transaction.objectStore(storeName).get(key); }
      catch(error){ try{ transaction.abort(); }catch(_){ } fail(error); return; }
      request.onsuccess=()=>succeed(request.result?request.result.raw:null);
      request.onerror=()=>fail(request.error);
      transaction.onabort=()=>fail(transaction.error||new Error("Lettura IndexedDB annullata"));
      transaction.onerror=()=>fail(transaction.error||new Error("Lettura IndexedDB fallita"));
    });
  }
  // Una transazione readwrite serializza il get+put: il confronto con il
  // baseline e la scrittura non possono essere separati da un'altra scheda.
  function idbCompareAndSet(expected,raw,timeoutMs=operationTimeoutMs){
    return new Promise((resolve,reject)=>{
      let transaction;
      try{ transaction=db.transaction(storeName,"readwrite"); }
      catch(error){ reject(error); return; }
      const store=transaction.objectStore(storeName);
      let request;
      try{ request=store.get(key); }
      catch(error){ try{ transaction.abort(); }catch(_){ } reject(error); return; }
      let conflict=false, settled=false, timer;
      const finish=(callback,value)=>{
        if(settled) return;
        settled=true; clearTimeout(timer); callback(value);
      };
      const fail=error=>finish(reject,error||new Error("Confronto IndexedDB fallito"));
      const succeed=value=>finish(resolve,value);
      timer=setTimeout(()=>{
        try{ transaction.abort(); }catch(_){ }
        fail(new Error(`Confronto IndexedDB scaduto dopo ${timeoutMs} ms`));
      },Math.max(1,timeoutMs));
      request.onsuccess=()=>{
        if(settled) return;
        const current=request.result?request.result.raw:null;
        if(current!==expected){
          conflict=true;
          try{ transaction.abort(); }
          catch(_){ succeed({ok:false,current}); }
          return;
        }
        try{ store.put({key,raw,updatedAt:Date.now()}); }
        catch(error){ try{ transaction.abort(); }catch(_){ } fail(error); }
      };
      transaction.oncomplete=()=>{
        if(channel){
          try{ channel.postMessage({type:"updated",raw}); }
          catch(_){ /* il canale è solo una notifica: il CAS resta valido */ }
        }
        succeed({ok:true,current:raw});
      };
      transaction.onabort=()=>{
        if(conflict) succeed({ok:false,current:request.result?request.result.raw:null});
        else fail(transaction.error||new Error("Confronto IndexedDB annullato"));
      };
      transaction.onerror=()=>{
        if(!conflict) fail(transaction.error||new Error("Confronto IndexedDB fallito"));
      };
    });
  }
  function setupChannel(){
    if(typeof globalThis.BroadcastChannel!=="function") return;
    try{
      channel=new globalThis.BroadcastChannel(channelName);
      channel.addEventListener("message",event=>{
        listeners.forEach(listener=>listener(event.data||{}));
      });
    }catch(_){ channel=null; }
  }
  function closeDatabase(){
    if(channel){ channel.close(); channel=null; }
    if(db){ db.close(); db=null; }
  }
  async function init(){
    const deadline=Date.now()+initTimeoutMs;
    const remaining=()=>Math.max(1,deadline-Date.now());
    try{
      db=await openDatabase(remaining());
      backend="indexeddb";
      setupChannel();
      let raw=await idbRead(remaining());
      let migrated=false;
      let legacy=readLocal();
      if(raw===null){
        if(legacy.available&&legacy.raw!==null){
          // La migrazione usa la stessa transazione CAS dei salvataggi: se
          // un'altra scheda ha già scritto in IndexedDB, non la sovrascriviamo.
          const result=await idbCompareAndSet(null,legacy.raw,remaining());
          if(result.error) throw result.error;
          if(result.ok){
            raw=legacy.raw;
            migrated=true;
            // La validazione e la rimozione del backup sono delegate allo
            // strato applicativo: un payload corrotto/oversized deve restare
            // recuperabile invece di essere cancellato prima della sanitizzazione.
          }else{
            raw=result.current;
          }
        }
      }
      const reconcileRequired=raw!==null && legacy.available && legacy.raw!==null && legacy.raw!==raw;
      return {backend,raw,migrated,legacyRaw:legacy.raw,reconcileRequired};
    }catch(error){
      closeDatabase();
      backend="localstorage";
      const legacy=readLocal();
      return {backend,raw:legacy.raw,migrated:false,localAvailable:legacy.available,error:legacy.available?error:legacy.error||error};
    }
  }
  function read(){
    if(backend==="indexeddb") return idbRead();
    const local=readLocal();
    if(!local.available) return Promise.reject(local.error);
    return Promise.resolve(local.raw);
  }
  function compareAndSet(expected,raw){
    if(backend==="indexeddb") return idbCompareAndSet(expected,raw);
    const disk=readLocal();
    if(!disk.available) return Promise.resolve({ok:false,current:null,error:disk.error});
    if(disk.raw!==expected) return Promise.resolve({ok:false,current:disk.raw});
    try{
      globalThis.localStorage.setItem(key,raw);
      return Promise.resolve({ok:true,current:raw});
    }catch(error){
      return Promise.resolve({ok:false,current:disk.raw,error});
    }
  }
  return {
    init,
    read,
    compareAndSet,
    clearLocal(expectedRaw){ return removeLocal(expectedRaw); },
    subscribe(listener){ listeners.add(listener); },
    get backend(){ return backend; },
    get operationTimeoutMs(){ return operationTimeoutMs; }
  };
}
