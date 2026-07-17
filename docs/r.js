const C='fl-r-3.3.8';
const S=['./','./index.html','./manifest.webmanifest','./icons/192.png','./icons/512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(x=>x.addAll(S)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET')return;const u=new URL(q.url);if(u.origin!==self.location.origin)return;if(q.mode==='navigate'){e.respondWith(fetch(q,{cache:'no-store'}).then(z=>{const y=z.clone();caches.open(C).then(c=>c.put('./index.html',y));return z}).catch(()=>caches.match('./index.html')));return}e.respondWith(caches.match(q).then(z=>z||fetch(q).then(v=>{const y=v.clone();caches.open(C).then(c=>c.put(q,y));return v}))) });
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});

self.addEventListener('sync',e=>{if(e.tag!=='field-ledger-resume-sync')return;e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>Promise.all(list.map(c=>c.postMessage({type:'FIELD_LEDGER_SYNC_REQUESTED',at:Date.now()})))));});
