/* ============================================================
   Leitor de PDF dentro do app (PDF.js)
   - Mostra as páginas como imagem, com zoom; sem botão de baixar.
   - "Baixar PDF" só aparece para administradores e para quem a
     administração liberou no Painel ("Pode baixar PDFs").
   - O botão voltar do celular fecha o leitor.
   ============================================================ */
(() => {
  "use strict";
  const PDFJS = "assets/vendor/pdfjs-3.11.174.min.js";
  const WORKER = "assets/vendor/pdfjs-3.11.174.worker.min.js";
  const ARQ = () => window.ACERVO_ARQ;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const podeBaixar = () => (window.ACESSO && typeof window.ACESSO.podeBaixar === "function" ? window.ACESSO.podeBaixar() : true);

  let lib = null;
  function carregar() {
    if (lib) return Promise.resolve(lib);
    if (window.pdfjsLib) { lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = WORKER; return Promise.resolve(lib); }
    return new Promise((ok, falha) => {
      const s = document.createElement("script"); s.src = PDFJS;
      s.onload = () => { lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = WORKER; ok(lib); };
      s.onerror = () => falha(new Error("leitor"));
      document.head.appendChild(s);
    });
  }

  const ICO = {
    voltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
    menos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>',
  };

  const el = document.createElement("div");
  el.className = "lpdf"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Leitor de PDF");
  document.body.appendChild(el);

  let atual = null; // { caminho, titulo, doc, zoom, obs, tarefas }
  const ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3];

  function desenharMoldura() {
    el.innerHTML = `
      <header class="lpdf__topo">
        <button type="button" class="lpdf__btn" data-lpdf="fechar" aria-label="Fechar o PDF">${ICO.voltar}</button>
        <div class="lpdf__titulo"><b>${esc(atual.titulo || "PDF original")}</b><small class="lpdf__info">Carregando…</small></div>
        <div class="lpdf__acoes">
          <button type="button" class="lpdf__btn" data-lpdf="menos" aria-label="Diminuir">${ICO.menos}</button>
          <button type="button" class="lpdf__btn" data-lpdf="mais" aria-label="Aumentar">${ICO.mais}</button>
          ${podeBaixar() ? `<button type="button" class="lpdf__btn lpdf__btn--baixar" data-lpdf="baixar" aria-label="Baixar PDF">${ICO.baixar}<span>Baixar</span></button>` : ""}
        </div>
      </header>
      <div class="lpdf__paginas" tabindex="0"><p class="lpdf__aviso"><i class="lpdf__girando" aria-hidden="true"></i>Abrindo o documento…</p></div>`;
  }

  async function abrir(caminho, titulo) {
    if (atual) fechar(true);
    atual = { caminho, titulo, doc: null, zoom: 0, obs: null, tarefas: new Map() };
    desenharMoldura();
    el.hidden = false; document.documentElement.classList.add("com-lpdf");
    history.pushState({ lpdf: true }, "");
    el.querySelector('[data-lpdf="fechar"]').focus();
    const meu = atual;
    try {
      const [L, link] = await Promise.all([carregar(), ARQ().pdf(caminho)]);
      const doc = await L.getDocument({ url: link.url, isEvalSupported: false }).promise;
      if (atual !== meu) { doc.destroy(); return; }
      meu.doc = doc;
      el.querySelector(".lpdf__info").textContent = `${doc.numPages} ${doc.numPages > 1 ? "páginas" : "página"}`;
      await montarPaginas();
    } catch (e) {
      if (atual !== meu) return;
      el.querySelector(".lpdf__paginas").innerHTML = `<p class="lpdf__aviso">Não deu para abrir o PDF agora. Confira a internet e tente de novo.</p>`;
      el.querySelector(".lpdf__info").textContent = "";
    }
  }

  async function montarPaginas() {
    const a = atual, box = el.querySelector(".lpdf__paginas");
    if (a.obs) a.obs.disconnect();
    box.innerHTML = "";
    const largura = Math.min(box.clientWidth - 24, 900) * ZOOMS[a.zoom];
    for (let n = 1; n <= a.doc.numPages; n++) {
      const pg = await a.doc.getPage(n);
      if (atual !== a) return;
      const v = pg.getViewport({ scale: 1 }), h = Math.round((v.height / v.width) * largura);
      const div = document.createElement("div");
      div.className = "lpdf__pagina"; div.dataset.n = n; div.style.width = Math.round(largura) + "px"; div.style.height = h + "px";
      div.innerHTML = `<span class="lpdf__num">${n}</span>`;
      box.appendChild(div);
    }
    // desenha só as páginas perto da tela (economiza memória no celular)
    a.obs = new IntersectionObserver((itens) => itens.forEach((i) => { if (i.isIntersecting) desenhar(+i.target.dataset.n, i.target); }), { root: box, rootMargin: "600px 0px" });
    box.querySelectorAll(".lpdf__pagina").forEach((d) => a.obs.observe(d));
  }

  async function desenhar(n, div) {
    const a = atual; if (!a || !a.doc || div.querySelector("canvas") || a.tarefas.has(n)) return;
    a.tarefas.set(n, true);
    try {
      const pg = await a.doc.getPage(n);
      const largura = div.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = pg.getViewport({ scale: (largura / pg.getViewport({ scale: 1 }).width) * dpr });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); c.style.width = "100%"; c.style.height = "100%";
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      if (atual === a) div.appendChild(c);
    } catch (e) { /* tenta de novo quando voltar à tela */ }
    finally { a.tarefas.delete(n); }
  }

  function fechar(semHistorico) {
    if (!atual) return;
    if (atual.obs) atual.obs.disconnect();
    if (atual.doc) atual.doc.destroy();
    atual = null; el.hidden = true; el.innerHTML = ""; document.documentElement.classList.remove("com-lpdf");
    if (!semHistorico && history.state && history.state.lpdf) history.back();
  }
  addEventListener("popstate", () => { if (atual) fechar(true); });
  document.addEventListener("keydown", (e) => { if (atual && e.key === "Escape") fechar(); });

  async function baixar(btn) {
    if (!podeBaixar()) return;
    const span = btn.querySelector("span"); btn.disabled = true; if (span) span.textContent = "Baixando…";
    try {
      const b = await ARQ().blob(atual.caminho);
      const u = URL.createObjectURL(new Blob([b], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = u; a.download = "Itaroba-" + atual.caminho.split("/").pop();
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60e3);
    } catch (e) { alert("Não deu para baixar agora. Confira a internet."); }
    finally { btn.disabled = false; if (span) span.textContent = "Baixar"; }
  }

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lpdf]"); if (!b || !atual) return;
    const acao = b.dataset.lpdf;
    if (acao === "fechar") fechar();
    if (acao === "baixar") baixar(b);
    if ((acao === "mais" && atual.zoom < ZOOMS.length - 1) || (acao === "menos" && atual.zoom > 0)) {
      atual.zoom += acao === "mais" ? 1 : -1;
      if (atual.doc) montarPaginas();
    }
  });
  // leitura, não cópia: sem menu de "salvar imagem" ao segurar o dedo
  el.addEventListener("contextmenu", (e) => { if (e.target.closest(".lpdf__paginas")) e.preventDefault(); });

  window.LeitorPDF = { abrir, fechar: () => fechar() };
})();
