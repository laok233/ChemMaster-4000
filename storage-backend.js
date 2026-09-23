"use strict";
/* Repository di persistenza: IndexedDB atomico con fallback a localStorage. */
function createProgressStore(key,options={}){
  const dbName=options.dbName||"chemmaster-4000";
  const storeName=options.storeName||"progress";
  const channelName=options.channelName||`${key}:updates`;
  const listeners=new Set();
  let db=null, backend="localstorage", channel=null;

  function readLocal(){
    try{ return {available:true,raw:globalThis.localStorage.getItem(key)}; }
    catch(error){ return {available:false,raw:null,error}; }
  }
  function removeLocal(){
    try{ globalThis.localStorage.removeItem(key); }
    catch(_){ /* IndexedDB è già la copia primaria */ }
  }
  function openDatabase(){
    return new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){ reject(new Error("IndexedDB non disponibile")); return; }
      let settled=false;
      let request;
      const fail=error=>{
        if(settled) return;
        settled=true;
        reject(error||new Error("Apertura IndexedDB fallita"));
      };
      try{ request=globalThis.indexedDB.open(dbName,1); }
      catch(error){ fail(error); return; }
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(storeName)){
          request.result.createObjectStore(storeName,{keyPath:"key"});
        }
      };
      request.onsuccess=()=>{
        if(settled){ request.result.close(); return; }
        settled=true;
        const opened=request.result;
        opened.onversionchange=()=>opened.close();
        resolve(opened);
      };
      request.onerror=()=>fail(request.error);
      request.onblocked=()=>fail(new Error("Aggiornamento IndexedDB bloccato"));
    });
  }
  function idbRead(){
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(storeName,"readonly");
      const request=transaction.objectStore(storeName).get(key);
      request.onsuccess=()=>resolve(request.result?request.result.raw:null);
      request.onerror=()=>reject(request.error);
      transaction.onabort=()=>reject(transaction.error||new Error("Lettura IndexedDB annullata"));
    });
  }
  function idbPut(raw){
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(storeName,"readwrite");
      transaction.objectStore(storeName).put({key,raw,updatedAt:Date.now()});
      transaction.oncomplete=()=>resolve(true);
      transaction.onabort=()=>reject(transaction.error||new Error("Scrittura IndexedDB annullata"));
      transaction.onerror=()=>reject(transaction.error||new Error("Scrittura IndexedDB fallita"));
    });
  }
  // Una transazione readwrite serializza il get+put: il confronto con il
  // baseline e la scrittura non possono essere separati da un'altra scheda.
  function idbCompareAndSet(expected,raw){
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(storeName,"readwrite");
      const store=transaction.objectStore(storeName);
      const request=store.get(key);
      let conflict=false;
      request.onsuccess=()=>{
        const current=request.result?request.result.raw:null;
        if(current!==expected){
          conflict=true;
          transaction.abort();
          return;
        }
        store.put({key,raw,updatedAt:Date.now()});
      };
      transaction.oncomplete=()=>{
        if(channel){
          try{ channel.postMessage({type:"updated",raw}); }
          catch(_){ /* il canale è solo una notifica: il CAS resta valido */ }
        }
        resolve({ok:true,current:raw});
      };
      transaction.onabort=()=>{
        if(conflict) resolve({ok:false,current:request.result?request.result.raw:null});
        else reject(transaction.error||new Error("Confronto IndexedDB annullato"));
      };
      transaction.onerror=()=>{
        if(!conflict) reject(transaction.error||new Error("Confronto IndexedDB fallito"));
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
    try{
      db=await openDatabase();
      backend="indexeddb";
      setupChannel();
      let raw=await idbRead();
      let migrated=false;
      if(raw===null){
        const legacy=readLocal();
        if(legacy.available&&legacy.raw!==null){
          await idbPut(legacy.raw);
          removeLocal();
          raw=legacy.raw;
          migrated=true;
        }
      }
      return {backend,raw,migrated};
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
    subscribe(listener){ listeners.add(listener); },
    get backend(){ return backend; }
  };
}
