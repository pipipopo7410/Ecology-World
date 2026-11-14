/* 生態世界 v0.4 — 本地資源優先、完整下載才啟用新版。 */
'use strict';
const APP_VERSION='0.4.0';
const SHELL_CACHE='ecology-world-shell-'+APP_VERSION;
const SHARED_CACHE='ecology-world-three-r149';
const LIBRARY='./vendor/three.min.js';
const APP_FILES=[
  './','./index.html','./styles/app.css',
  './js/world-data.js','./js/world-engine.js','./js/main.js','./js/pwa.js',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'
];
const url=path=>new URL(path,self.registration.scope).href;
const libraryUrl=url(LIBRARY);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    // Stable Three.js only downloads the first time. New app versions reuse this copy.
    const shared=await caches.open(SHARED_CACHE);
    if(!(await shared.match(libraryUrl))){
      const r=await fetch(new Request(libraryUrl,{cache:'reload'}));
      if(!r.ok)throw Error('3D 引擎下載失敗：'+r.status);
      await shared.put(libraryUrl,r.clone());
    }
    const shell=await caches.open(SHELL_CACHE);
    // Any failure aborts install. A previously working offline version is preserved.
    await shell.addAll(APP_FILES.map(path=>new Request(url(path),{cache:'reload'})));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('ecology-world-')&&name!==SHELL_CACHE&&name!==SHARED_CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const target=new URL(req.url);
  const scope=new URL(self.registration.scope);
  if(target.origin!==scope.origin||!target.pathname.startsWith(scope.pathname))return;
  event.respondWith((async()=>{
    const store=await caches.open(req.url===libraryUrl?SHARED_CACHE:SHELL_CACHE);
    const saved=await store.match(req);
    if(saved)return saved;
    try{
      const response=await fetch(req);
      if(response.ok)await store.put(req,response.clone());
      return response;
    }catch(err){
      if(req.mode==='navigate'){
        const fallback=await (await caches.open(SHELL_CACHE)).match(url('./index.html'));
        if(fallback)return fallback;
      }
      return Response.error();
    }
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_CACHE_STATUS'){
    event.waitUntil((async()=>{
      const c=await caches.open(SHELL_CACHE);const shared=await caches.open(SHARED_CACHE);
      const hits=await Promise.all(APP_FILES.map(path=>c.match(url(path))));
      const lib=await shared.match(libraryUrl);
      event.source?.postMessage({type:'ECO_CACHE_STATUS',version:APP_VERSION,ready:hits.every(Boolean)&&!!lib,files:hits.filter(Boolean).length+Number(!!lib),expected:APP_FILES.length+1});
    })());
  }
});
