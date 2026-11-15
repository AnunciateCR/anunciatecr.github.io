/* Service worker mínimo: permite instalar la página como app.
   No guarda copias (siempre trae la versión más nueva). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
