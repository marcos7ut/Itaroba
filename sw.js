// Service worker: deixa o app abrir mais rápido e funcionar sem internet
// depois da primeira visita. Mude a VERSAO sempre que atualizar o app.
const VERSAO = "acervo-v28";
const ESSENCIAIS = [
  "./", "index.html", "config.js", "manifest.webmanifest",
  "assets/styles.css", "assets/app.js", "assets/pontos.js", "assets/icone.svg",
  "assets/icone-192.png", "assets/icone-512.png", "data/palestras.json", "data/pontos.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (conteúdo sempre atualizado); se estiver sem internet, usa o que foi guardado.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Áudio pedido em pedaços (Range) vai direto pela rede; os pontos salvos ficam no próprio app.
  if (e.request.headers.has("range")) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && r.status !== 206 && (new URL(e.request.url).origin === location.origin || e.request.url.includes("fonts.g"))) {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
