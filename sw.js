// Service worker: deixa o app abrir mais rápido e funcionar sem internet
// depois da primeira visita. Mude a VERSAO sempre que atualizar o app.
const VERSAO = "acervo-v50";
const ESSENCIAIS = [
  "./", "index.html", "config.js", "manifest.webmanifest",
  "assets/styles.css", "assets/acesso.css", "assets/acesso.js", "assets/vendor/supabase-2.117.3.js", "assets/app.js", "assets/pontos.js", "assets/icone.svg",
  "assets/icone-192.png", "assets/icone-512.png", "assets/logo-96.png", "assets/logo-192.png", "assets/logo-512.webp", "assets/favicon.png", "assets/grao.png",
  "assets/fonts/intertight.woff2", "assets/fonts/playfair.woff2", "assets/fonts/playfair-it.woff2",
];

self.addEventListener("install", (e) => {
  // Guarda cada arquivo separadamente: se um faltar no site, os outros continuam valendo
  e.waitUntil(caches.open(VERSAO).then((c) => Promise.allSettled(ESSENCIAIS.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estratégia:
// - Visual, fontes, imagens e PDFs: usa o que já está guardado na hora (abre instantâneo)
//   e atualiza em segundo plano. Eles só mudam quando a VERSAO muda.
// - Página e dados (palestras, pontos): tenta a internet, mas se ela demorar mais de
//   3 segundos (sinal fraco) usa a cópia guardada e atualiza para a próxima vez.
const ESPERA_REDE = 3000;

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Áudio pedido em pedaços (Range) vai direto pela rede; os pontos salvos ficam no próprio app.
  if (e.request.headers.has("range")) return;
  const url = new URL(e.request.url);
  const mesmoSite = url.origin === location.origin;
  if (!mesmoSite && !url.hostname.includes("fonts.g")) return;
  // Áudios: o app já guarda os pontos salvos no próprio aparelho; não duplicar aqui.
  if (mesmoSite && url.pathname.includes("/audio/")) return;
  const fixo = mesmoSite && /\/(assets|pdfs)\//.test(url.pathname);

  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const salvo = await cache.match(e.request);
    const rede = fetch(e.request).then((r) => {
      if (r.ok && r.status !== 206) cache.put(e.request, r.clone());
      return r;
    });
    e.waitUntil(rede.then(() => {}, () => {}));
    if (!salvo) return rede;
    if (fixo) return salvo;
    return Promise.race([
      rede.catch(() => salvo),
      new Promise((ok) => setTimeout(() => ok(salvo), ESPERA_REDE)),
    ]);
  })());
});
