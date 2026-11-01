// Recibe los avisos del celular (me gusta, comentarios, seguidores y novedades) aunque la app esté cerrada.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: "AIzaSyB9X9eYTC0rblwc-hIXNqsqy6d-NMAm9RU",
  authDomain: "anunciatecr.firebaseapp.com",
  projectId: "anunciatecr",
  storageBucket: "anunciatecr.firebasestorage.app",
  messagingSenderId: "69765426845",
  appId: "1:69765426845:web:1d17c09ae1d936c6fdee74"
});
firebase.messaging(); // Firebase muestra solo la notificación cuando la app está cerrada
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow('/');
  }));
});
