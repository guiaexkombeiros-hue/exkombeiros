// Service Worker — Guia ExKombeiros de Camping
// Cache básico para permitir instalação como app e funcionamento offline parcial.

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
