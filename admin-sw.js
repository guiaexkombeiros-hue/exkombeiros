// Service Worker do Admin - Guia ExKombeiros
// Objetivo: permitir que a página admin-secreto.html abra mesmo sem internet,
// e guardar as bibliotecas externas (Firebase, jsPDF, html2canvas) já baixadas.
// NÃO mexe em fotos, vídeos ou envio de dados — isso continua exigindo internet.

var CACHE_NAME = 'admin-exkombeiros-cache-v1';

var LIBS_EXTERNAS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cacheia a própria página do admin (a URL que o navegador está usando agora)
      return cache.addAll(['./admin-secreto.html']).catch(function(){ /* ignora erro silenciosamente */ });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(nomes) {
      return Promise.all(
        nomes.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  var ehLibExterna = LIBS_EXTERNAS.indexOf(url) !== -1;
  var ehNavegacaoPagina = event.request.mode === 'navigate';

  if (ehLibExterna) {
    // Bibliotecas externas: cache primeiro (raramente mudam), rede como reforço
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(resp) {
          var copia = resp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copia); });
          return resp;
        }).catch(function(){ return cached; });
      })
    );
    return;
  }

  if (ehNavegacaoPagina) {
    // A própria página do admin: tenta internet primeiro (pra sempre pegar a versão mais nova),
    // se não tiver internet, usa a última cópia salva no celular.
    event.respondWith(
      fetch(event.request).then(function(resp) {
        var copia = resp.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copia); });
        return resp;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./admin-secreto.html');
        });
      })
    );
  }
});
