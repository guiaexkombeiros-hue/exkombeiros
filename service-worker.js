// Service Worker — Guia ExKombeiros de Camping
// Cache básico para permitir instalação como app e funcionamento offline parcial.
// Também processa notificações push em background (app fechado/minimizado).

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCFeqtsuT-4Q4e8EyrsEPRcIo3I6AmfEzE",
  authDomain: "exkombeiros-24a9a.firebaseapp.com",
  databaseURL: "https://exkombeiros-24a9a-default-rtdb.firebaseio.com",
  projectId: "exkombeiros-24a9a",
  storageBucket: "exkombeiros-24a9a.firebasestorage.app",
  messagingSenderId: "507759690855",
  appId: "1:507759690855:web:8a6ec18c9a98d7ee9900c2"
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var titulo = (payload.notification && payload.notification.title) || 'Guia ExKombeiros';
  var opcoes = {
    body: (payload.notification && payload.notification.body) || 'Novidade no guia!',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: (payload.data && payload.data.url) || './index.html' }
  };
  self.registration.showNotification(titulo, opcoes);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function (listaJanelas) {
      for (var i = 0; i < listaJanelas.length; i++) {
        if (listaJanelas[i].url.indexOf(url) !== -1 && 'focus' in listaJanelas[i]) {
          return listaJanelas[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

var CACHE_NOME = 'exkombeiros-v1';
var ARQUIVOS_CACHE = [
  './index.html',
  './manifest.json',
  './logo.png',
  './selo-ouro.png',
  './selo-prata.png',
  './selo-bronze.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NOME).then(function (cache) {
      return cache.addAll(ARQUIVOS_CACHE).catch(function (erro) {
        console.warn('Service Worker: alguns arquivos não foram cacheados:', erro);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nomesCache) {
      return Promise.all(
        nomesCache
          .filter(function (nome) { return nome !== CACHE_NOME; })
          .map(function (nome) { return caches.delete(nome); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  // Não interceptar chamadas ao Firebase ou a CDNs externos — sempre buscar da rede.
  var url = event.request.url;
  if (url.indexOf('firebaseio.com') !== -1 ||
      url.indexOf('googleapis.com') !== -1 ||
      url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('cdnjs.cloudflare.com') !== -1 ||
      url.indexOf('googletagmanager.com') !== -1 ||
      url.indexOf('pagead2.googlesyndication.com') !== -1 ||
      url.indexOf('fonts.googleapis.com') !== -1 ||
      url.indexOf('fonts.gstatic.com') !== -1) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (respostaCache) {
      if (respostaCache) return respostaCache;
      return fetch(event.request).then(function (respostaRede) {
        if (event.request.method === 'GET' && respostaRede && respostaRede.status === 200) {
          var copiaResposta = respostaRede.clone();
          caches.open(CACHE_NOME).then(function (cache) {
            cache.put(event.request, copiaResposta);
          });
        }
        return respostaRede;
      }).catch(function () {
        return respostaCache;
      });
    })
  );
});
