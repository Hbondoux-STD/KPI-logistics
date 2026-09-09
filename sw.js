/* =====================================================
   Service Worker — S.T. Dupont Pilotage Logistique
   Stratégie : Network-First pour les pages (une mise à jour
   publiée est visible immédiatement), Cache-First pour les
   ressources statiques. Fonctionnement offline conservé.
   ===================================================== */

const CACHE_NAME = 'stdupont-logistique-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

// ---- Installation ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Mise en cache initiale');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ---- Activation : purge de TOUS les anciens caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

const OFFLINE_PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S.T. Dupont · Hors ligne</title>
<style>
body{background:#0c0c0e;color:#f4f1e9;font-family:Georgia,serif;
display:flex;align-items:center;justify-content:center;
min-height:100vh;margin:0;text-align:center;padding:20px}
h1{color:#c9a14a;font-size:1.4rem;letter-spacing:3px;margin-bottom:1rem}
p{color:#9a968c;font-size:.9rem;line-height:1.6}
button{margin-top:1.5rem;padding:10px 24px;background:rgba(201,161,74,.14);
border:1px solid #c9a14a;color:#e8c97a;border-radius:8px;
font-family:Georgia,serif;font-size:.9rem;cursor:pointer;letter-spacing:1px}
button:hover{background:#c9a14a;color:#0c0c0e}
</style></head><body>
<div>
<h1>S.T. DUPONT · PARIS</h1>
<p>Le dashboard est disponible hors ligne.<br>
Veuillez vérifier votre connexion puis réessayer.</p>
<button onclick="location.reload()">Réessayer</button>
</div></body></html>`;

// ---- Fetch ----
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Pages HTML : réseau d'abord, pour qu'une publication soit vue tout de suite
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'))
            .then(cached => cached || new Response(OFFLINE_PAGE, {
              headers: { 'Content-Type': 'text/html;charset=utf-8' }
            }))
        )
    );
    return;
  }

  // Ressources statiques : cache d'abord, rafraîchi en arrière-plan
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
