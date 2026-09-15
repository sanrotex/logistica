/*
 * Service worker minimal pentru trackerul de licitatii.
 *
 * Scop: sa poti deschide aplicatia si fara semnal. NU incearca sa fie inteligent.
 *  - shell-ul (index.html, manifest) = network-first cu revenire la cache.
 *    Asa primesti mereu ultima versiune cand ai net, si ultima salvata cand nu ai.
 *  - raspunsurile Supabase = tot network-first, cu copie in cache. Fara net, vezi
 *    ultima lista descarcata, marcata ca atare de aplicatie.
 *  - restul (CDN-uri) = lasat in seama browserului.
 *
 * Datele din cache sunt un instantaneu, nu adevarul curent. Aplicatia afiseaza
 * momentul ultimei sincronizari ca sa nu iei o lista veche drept actuala.
 */
const CACHE = 'licitatii-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const eShell = url.origin === self.location.origin;
  const eDate = url.hostname.endsWith('.supabase.co');
  if (!eShell && !eDate) return;   // CDN-uri: lasa browserul sa se descurce

  e.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok) {
          const copie = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copie));
        }
        return resp;
      })
      .catch(() => caches.match(req).then(hit => hit || (eShell ? caches.match('./index.html') : Response.error())))
  );
});
