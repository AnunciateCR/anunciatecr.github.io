/* Service worker de AnunciateCR: navegación network-first,
   estáticos cache-first. Sin librerías y sin tocar datos remotos. */
const CACHE = 'anunciatecr-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.indexOf('/n/') === 0) return;

  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./', copy));
        }
        return res;
      }).catch(() => caches.match('./').then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  if (!/\.(?:html|css|js|json|png|jpe?g|webp|svg|ico|woff2?)$/i.test(u.pathname)) return;

  e.respondWith(
    caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(r, copy));
      }
      return res;
    }))
  );
});
