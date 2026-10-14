/* ============================================================
   Pontos cantados — aba de músicas do app (sem dependências)
   Os pontos ficam em data/pontos.json e os áudios na pasta audio/.
   ============================================================ */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const el = {
    abasEl: $("#pt-abas"), resumo: $("#pt-resumo"), busca: $("#pt-campo-busca"), linhas: $("#pt-linhas"),
    offline: $("#pt-offline"), conteudo: $("#pt-conteudo"),
    player: $("#pt-player"), pp: $("#pt-pp"), nome: $("#pt-p-nome"), linha: $("#pt-p-linha"),
    atual: $("#pt-p-atual"), total: $("#pt-p-total"), vezes: $("#pt-p-vezes"),
    repetir: $("#pt-repetir"), btnLetra: $("#pt-btn-letra"), ant: $("#pt-ant"), prox: $("#pt-prox"), barra: $("#pt-barra"),
    fundo: $("#pt-fundo"), folha: $("#pt-folha"), fLinha: $("#pt-f-linha"), fTitulo: $("#pt-f-titulo"),
    fLetra: $("#pt-f-letra"), fFechar: $("#pt-f-fechar"), aviso: $("#aviso"),
  };
  const audio = new Audio();
  audio.preload = "metadata";

  const estado = {
    abas: [], aba: "xire", linhas: [], quadrantes: [], pontos: [], carregou: null,
    filtro: "", termo: "",
    atual: null, carregado: null, fila: [],
    repetir: false, vezes: 1,
    naPagina: false, arrastando: false, urlBlob: null,
  };
  // Linhas abertas (os pontos só aparecem ao tocar no nome do orixá)
  const CHAVE_ABERTAS = "pt-linhas-abertas";
  estado.abertas = new Set();
  try { (JSON.parse(localStorage.getItem(CHAVE_ABERTAS) || "[]") || []).forEach((id) => estado.abertas.add(id)); } catch (e) {}
  const guardarAbertas = () => { try { localStorage.setItem(CHAVE_ABERTAS, JSON.stringify([...estado.abertas])); } catch (e) {} };
  const salvos = new Map();   // id -> tamanho em bytes
  const salvando = new Set();

  // ---------- Utilidades ----------
  const normalizar = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const escapar = (s) => (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tempo = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const mb = (b) => (b / 1048576).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MB";
  const ponto = (id) => estado.pontos.find((p) => p.id === id);
  const linhaDe = (id) => estado.linhas.find((l) => l.id === id) || { id, nome: id, saudacao: "" };
  // Cada aba (Xirê, Outras linhas) mostra só as suas linhas
  const abaDe = (l) => l.aba || "xire";
  const linhasDaAba = () => estado.linhas.filter((l) => abaDe(l) === estado.aba);
  const pontosDaAba = () => { const ids = new Set(linhasDaAba().map((l) => l.id)); return estado.pontos.filter((p) => ids.has(p.linha)); };

  const ICO = {
    play: `<svg class="pt-cheio" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`,
    pause: `<svg class="pt-cheio" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`,
    baixar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>`,
    salvo: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="pt-cheio" cx="12" cy="12" r="9.5"/><path class="pt-check" d="m7.8 12.3 2.9 2.9 5.6-5.9"/></svg>`,
    nuvem: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.5 4.3 4.3 0 0 0 7 18z"/><path d="m9.5 13.5 2 2 3.5-3.5"/></svg>`,
    check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
    seta: `<svg class="pt-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9.5 6 6 6-6"/></svg>`,
  };

  // ---------- Aviso (usa a mesma pílula do app) ----------
  let avisoT = null;
  function avisar(msg, acao, fn) {
    el.aviso.innerHTML = `<span>${escapar(msg)}</span>${acao ? ` <button type="button" class="aviso__acao">${escapar(acao)}</button>` : ""}`;
    if (acao) el.aviso.querySelector("button").onclick = () => { el.aviso.hidden = true; fn(); };
    el.aviso.hidden = false;
    clearTimeout(avisoT);
    avisoT = setTimeout(() => (el.aviso.hidden = true), acao ? 5000 : 3000);
  }

  // ---------- Guardar áudios no celular (IndexedDB) ----------
  let dbp = null;
  function banco() {
    if (!dbp) dbp = new Promise((ok, erro) => {
      try {
        const r = indexedDB.open("pontos-cantados", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("audios");
        r.onsuccess = () => ok(r.result);
        r.onerror = () => erro(r.error);
      } catch (e) { erro(e); }
    });
    return dbp;
  }
  async function operar(modo, fn) {
    const db = await banco();
    return new Promise((ok, erro) => {
      const tx = db.transaction("audios", modo);
      const req = fn(tx.objectStore("audios"));
      tx.oncomplete = () => ok(req && req.result);
      tx.onerror = () => erro(tx.error);
    });
  }
  const lerAudio = (id) => operar("readonly", (s) => s.get(id));
  const gravarAudio = (id, b) => operar("readwrite", (s) => s.put(b, id));
  const apagarAudio = (id) => operar("readwrite", (s) => s.delete(id));
  async function tamanhosSalvos() {
    const db = await banco();
    return new Promise((ok, erro) => {
      const out = new Map();
      const req = db.transaction("audios").objectStore("audios").openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.set(c.key, (c.value && c.value.size) || 0); c.continue(); } else ok(out); };
      req.onerror = () => erro(req.error);
    });
  }

  // ---------- Dados ----------
  function carregar() {
    if (!estado.carregou) {
      estado.carregou = fetch("data/pontos.json", { cache: "no-cache" })
        .then((r) => { if (!r.ok) throw new Error("Não foi possível ler data/pontos.json"); return r.json(); })
        .then((d) => {
          estado.abas = d.abas || [];
          estado.linhas = d.linhas || [];
          estado.quadrantes = d.quadrantes || [];
          estado.pontos = (d.pontos || []).map((p) => ({ ...p, letra: p.letra || "", _busca: normalizar(p.titulo + " " + (p.letra || "")) }));
          estado.atual = estado.pontos[0] ? estado.pontos[0].id : null;
          estado.fila = estado.pontos.map((p) => p.id);
          return tamanhosSalvos().then((m) => m.forEach((v, k) => { if (ponto(k)) salvos.set(k, v); })).catch(() => {});
        });
    }
    return estado.carregou;
  }

  // ---------- Tela ----------
  function visiveis() {
    const t = normalizar(estado.termo.trim());
    return pontosDaAba().filter((p) => (!estado.filtro || p.linha === estado.filtro) && (!t || p._busca.includes(t)));
  }

  function renderFiltros() {
    const n = (id) => estado.pontos.filter((p) => p.linha === id).length;
    el.linhas.innerHTML =
      `<button type="button" class="tema" data-pt-linha="" aria-pressed="${!estado.filtro}">Todas as linhas<span class="tema__n">${pontosDaAba().length}</span></button>` +
      linhasDaAba().map((l) => `<button type="button" class="tema pt-cor-${escapar(l.id)}" data-pt-linha="${escapar(l.id)}" aria-pressed="${estado.filtro === l.id}"><i class="pt-conta" aria-hidden="true"></i>${escapar(l.nome)}<span class="tema__n">${n(l.id)}</span></button>`).join("");
  }

  function botaoSalvar(p) {
    if (salvando.has(p.id)) return `<button type="button" class="pt-salvar" disabled aria-label="Salvando no celular"><span class="pt-girando"></span></button>`;
    if (salvos.has(p.id)) return `<button type="button" class="pt-salvar pt-salvar--ok" data-pt-salvar="${p.id}" aria-label="Salvo no celular. Toque para remover">${ICO.salvo}</button>`;
    return `<button type="button" class="pt-salvar" data-pt-salvar="${p.id}" aria-label="Salvar no celular para ouvir sem internet">${ICO.baixar}</button>`;
  }

  function cartao(p) {
    const atual = p.id === estado.atual && estado.carregado === p.id;
    const tocando = atual && !audio.paused;
    return `<li class="pt-ponto pt-cor-${escapar(p.linha)}${atual ? " pt-ponto--atual" : ""}${tocando ? " pt-ponto--tocando" : ""}">
      <button type="button" class="pt-tocar" data-pt-tocar="${p.id}" aria-label="${tocando ? "Pausar" : "Tocar"}: ${escapar(p.titulo)}">
        <span class="pt-circulo">${ICO.play}<span class="pt-ondas" aria-hidden="true"><i></i><i></i><i></i></span></span>
        <span class="pt-ponto__texto">
          <span class="pt-ponto__nome">${escapar(p.titulo)}</span>
          <span class="pt-ponto__meta">${tempo(p.duracao)}${salvos.has(p.id) ? ` <span class="pt-ponto__salvo">· toca sem internet</span>` : ""}${p.letra ? ` · com letra` : ""}</span>
        </span>
      </button>
      ${botaoSalvar(p)}
    </li>`;
  }

  function render() {
    if (!estado.linhas.length) return;
    // Seletor Xirê | Outras linhas
    if (el.abasEl) el.abasEl.innerHTML = estado.abas.map((a) => {
      const n = estado.pontos.filter((p) => abaDe(linhaDe(p.linha)) === a.id).length;
      const href = a.id === "xire" ? "#/pontos" : `#/pontos/${escapar(a.rota || a.id)}`;
      return `<a class="pt-aba" href="${href}"${a.id === estado.aba ? ' aria-current="page"' : ""}>${escapar(a.nome)}<span class="pt-aba__n">${n}</span></a>`;
    }).join("");
    const daAba = pontosDaAba(), lin = linhasDaAba();
    const nP = daAba.length, nL = lin.length;
    if (el.resumo) el.resumo.innerHTML = `<strong>${nP}</strong> ${nP === 1 ? "ponto" : "pontos"}, <strong>${nL}</strong> ${nL === 1 ? "linha" : "linhas"}.`;

    let total = 0, nS = 0; daAba.forEach((p) => { if (salvos.has(p.id)) { nS++; total += salvos.get(p.id); } });
    el.offline.hidden = !nP;
    el.offline.innerHTML = `${ICO.nuvem}<span>Sem internet: <strong>${nS}</strong> de ${nP} salvos no celular${nS ? " · " + mb(total) : ""}</span>`;

    const vs = visiveis();
    const buscando = !!estado.termo.trim();
    if (!vs.length && (buscando || !estado.filtro)) {
      el.conteudo.innerHTML = `<div class="vazio"><h2>Nenhum ponto encontrado</h2><p>Tente outra palavra ou escolha “Todas as linhas”.</p></div>`;
      return;
    }
    const secao = (l) => {
      const todos = estado.pontos.filter((p) => p.linha === l.id);
      const dur = todos.reduce((a, p) => a + (p.duracao || 0), 0);
      const faltam = todos.filter((p) => !salvos.has(p.id)).length;
      const ocupado = todos.some((p) => salvando.has(p.id));
      const btn = !todos.length ? ""
        : faltam === 0
        ? `<span class="pt-linha__pronto">${ICO.check}Todos salvos</span>`
        : `<button type="button" class="botao botao--branco botao--compacto" data-pt-salvar-linha="${escapar(l.id)}"${ocupado ? " disabled" : ""}>${ICO.baixar}<span>Salvar todos</span></button>`;
      const aberta = estado.abertas.has(l.id) || estado.filtro === l.id || !!estado.termo.trim();
      return `<section class="pt-linha pt-cor-${escapar(l.id)}${aberta ? " pt-linha--aberta" : ""}">
        <header class="pt-linha__cabeca" data-pt-abrir="${escapar(l.id)}">
          <div class="pt-linha__titulos">
            <h3 class="pt-linha__nome"><button type="button" class="pt-linha__abrir" data-pt-abrir="${escapar(l.id)}" aria-expanded="${aberta}" aria-controls="pt-lista-${escapar(l.id)}"><i class="pt-conta" aria-hidden="true"></i>${escapar(l.nome)}${ICO.seta}</button></h3>
            ${l.saudacao ? `<p class="pt-linha__saudacao">${escapar(l.saudacao)}</p>` : ""}
            <p class="pt-linha__meta">${todos.length ? `${todos.length} ${todos.length === 1 ? "ponto" : "pontos"} · ${tempo(dur)}` : "Pontos em breve"}</p>
          </div>
          ${btn}
        </header>
        <ul class="pt-lista" id="pt-lista-${escapar(l.id)}"${aberta ? "" : " hidden"}>${aberta ? (todos.length ? vs.filter((p) => p.linha === l.id).map(cartao).join("") : `<li class="pt-embreve">Os pontos de ${escapar(l.nome)} ainda vão ser adicionados.</li>`) : ""}</ul>
      </section>`;
    };
    // Sem busca, mostra todas as linhas da aba (até as que ainda não têm áudio)
    const comPontos = lin.filter((l) => (estado.filtro ? l.id === estado.filtro : true) && (buscando ? vs.some((p) => p.linha === l.id) : true));
    const qs = estado.quadrantes.filter((q) => (q.aba || "xire") === estado.aba);
    const quads = qs.length ? qs : [{ id: "", nome: "" }];
    el.conteudo.innerHTML = quads.map((q) => {
      const ls = comPontos.filter((l) => (q.id ? (l.quadrante || "outras") === q.id : true));
      if (!ls.length) return "";
      if (!q.id) return `<div class="pt-grupo">${ls.map(secao).join("")}</div>`;
      return `<div class="pt-quadrante pt-quadrante--${escapar(q.id)}">${q.nome ? `<h2 class="pt-quadrante__nome"><span>${escapar(q.nome)}</span></h2>` : ""}${ls.map(secao).join("")}</div>`;
    }).join("");
  }

  function renderPlayer() {
    const p = ponto(estado.atual);
    const mostrar = !!p && (estado.naPagina || estado.carregado !== null);
    el.player.hidden = !mostrar;
    document.body.classList.toggle("com-player", mostrar);
    if (!p) return;
    el.player.className = `pt-player pt-cor-${p.linha}`;
    el.nome.textContent = p.titulo;
    el.linha.textContent = linhaDe(p.linha).nome;
    const tocando = estado.carregado === p.id && !audio.paused;
    el.pp.innerHTML = tocando ? ICO.pause : ICO.play;
    el.pp.setAttribute("aria-label", tocando ? "Pausar" : "Tocar");
    const i = estado.fila.indexOf(p.id);
    el.ant.disabled = i <= 0 && !(estado.carregado === p.id && audio.currentTime > 3);
    el.prox.disabled = i < 0 || i >= estado.fila.length - 1;
    const d = estado.carregado === p.id && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : p.duracao;
    el.barra.max = d || 1;
    el.total.textContent = tempo(d);
    if (estado.carregado !== p.id) { el.barra.value = 0; el.atual.textContent = "0:00"; }
    el.repetir.setAttribute("aria-pressed", estado.repetir);
    el.repetir.setAttribute("aria-label", estado.repetir ? "Repetir ligado. Toque para desligar" : "Repetir este ponto");
    el.vezes.textContent = estado.repetir ? ` · repetindo${estado.vezes > 1 ? `, ${estado.vezes}ª vez` : ""}` : "";
  }

  function atualizar() { renderPlayer(); if (estado.naPagina) render(); }

  // ---------- Tocar ----------
  async function preparar(id) {
    const p = ponto(id);
    let src = p.audio;
    if (salvos.has(id)) {
      try {
        const b = await lerAudio(id);
        if (b) { if (estado.urlBlob) URL.revokeObjectURL(estado.urlBlob); estado.urlBlob = URL.createObjectURL(b); src = estado.urlBlob; }
      } catch (e) { /* toca pela internet */ }
    }
    audio.src = src;
    estado.carregado = id;
    sessaoMidia(p);
  }

  async function tocar(id, fila) {
    if (fila) estado.fila = fila;
    if (id === estado.atual && estado.carregado === id) {
      if (audio.paused) audio.play().catch(falhou); else audio.pause();
      return;
    }
    estado.atual = id;
    estado.vezes = 1;
    atualizar();
    await preparar(id);
    audio.play().catch(falhou);
  }

  function falhou(e) {
    if (e && e.name === "AbortError") return;
    avisar("Não deu pra tocar agora. Confira a internet ou salve o ponto no celular.");
    atualizar();
  }

  function pular(passo) {
    if (passo < 0 && estado.carregado === estado.atual && audio.currentTime > 3) { audio.currentTime = 0; return; }
    const i = estado.fila.indexOf(estado.atual) + passo;
    if (i >= 0 && i < estado.fila.length) tocar(estado.fila[i]);
  }

  function sessaoMidia(p) {
    try {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: p.titulo, artist: linhaDe(p.linha).nome, album: "Pontos cantados" });
      navigator.mediaSession.setActionHandler("play", () => audio.play().catch(falhou));
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () => pular(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => pular(1));
    } catch (e) { /* recurso indisponível */ }
  }

  audio.addEventListener("play", atualizar);
  audio.addEventListener("pause", atualizar);
  audio.addEventListener("loadedmetadata", renderPlayer);
  audio.addEventListener("timeupdate", () => {
    if (estado.arrastando) return;
    el.barra.value = audio.currentTime;
    el.atual.textContent = tempo(audio.currentTime);
    el.ant.disabled = estado.fila.indexOf(estado.atual) <= 0 && audio.currentTime <= 3;
  });
  audio.addEventListener("ended", () => {
    if (estado.repetir) {
      estado.vezes += 1;
      audio.currentTime = 0;
      audio.play().catch(falhou);
      renderPlayer();
      return;
    }
    const i = estado.fila.indexOf(estado.atual);
    if (i >= 0 && i < estado.fila.length - 1) pular(1);
    else { audio.currentTime = 0; atualizar(); }
  });

  // ---------- Salvar / remover ----------
  async function salvar(id, quieto) {
    if (salvos.has(id) || salvando.has(id)) return true;
    salvando.add(id); atualizar();
    try {
      const r = await fetch(ponto(id).audio);
      if (!r.ok) throw new Error(r.status);
      const b = await r.blob();
      await gravarAudio(id, b);
      salvos.set(id, b.size);
      return true;
    } catch (e) {
      if (!quieto) avisar(`Não deu pra salvar “${ponto(id).titulo}”. Confira a internet e tente de novo.`);
      return false;
    } finally {
      salvando.delete(id); atualizar();
    }
  }

  async function remover(id) {
    let b = null;
    try { b = await lerAudio(id); await apagarAudio(id); }
    catch (e) { avisar("Não deu pra remover agora. Tente de novo."); return; }
    salvos.delete(id); atualizar();
    avisar("Removido do celular.", "Desfazer", async () => {
      if (!b) return;
      try { await gravarAudio(id, b); salvos.set(id, b.size); atualizar(); } catch (e) { /* ignora */ }
    });
  }

  async function salvarLinha(lid) {
    const lista = estado.pontos.filter((p) => p.linha === lid && !salvos.has(p.id));
    let falhas = 0;
    for (const p of lista) if (!(await salvar(p.id, true))) falhas++;
    const nome = linhaDe(lid).nome;
    avisar(falhas ? `${lista.length - falhas} de ${lista.length} pontos de ${nome} salvos. Toque de novo pra tentar o resto.` : `Os pontos de ${nome} tocam sem internet.`);
  }

  // ---------- Letra ----------
  function abrirLetra() {
    const p = ponto(estado.atual); if (!p) return;
    el.folha.className = `pt-folha pt-cor-${p.linha}`;
    el.fLinha.textContent = linhaDe(p.linha).nome;
    el.fTitulo.textContent = p.titulo;
    if (p.letra) { el.fLetra.textContent = p.letra; el.fLetra.classList.remove("pt-folha__letra--vazia"); }
    else { el.fLetra.textContent = "A letra deste ponto ainda não foi cadastrada."; el.fLetra.classList.add("pt-folha__letra--vazia"); }
    el.fundo.hidden = false; el.folha.hidden = false;
    el.fFechar.focus();
  }
  function fecharLetra() { el.fundo.hidden = true; el.folha.hidden = true; el.btnLetra.focus(); }

  // ---------- Eventos ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-pt-tocar],[data-pt-salvar],[data-pt-salvar-linha],[data-pt-linha],[data-pt-abrir]");
    if (!t) return;
    if (t.dataset.ptAbrir) {
      const id = t.dataset.ptAbrir;
      if (estado.abertas.has(id) || estado.filtro === id) { estado.abertas.delete(id); if (estado.filtro === id) { estado.filtro = ""; renderFiltros(); } }
      else estado.abertas.add(id);
      guardarAbertas(); render();
      return;
    }
    if (t.dataset.ptTocar) tocar(t.dataset.ptTocar, visiveis().map((p) => p.id));
    else if (t.dataset.ptSalvar) { const id = t.dataset.ptSalvar; salvos.has(id) ? remover(id) : salvar(id); }
    else if (t.dataset.ptSalvarLinha) salvarLinha(t.dataset.ptSalvarLinha);
    else if (t.dataset.ptLinha !== undefined) { estado.filtro = t.dataset.ptLinha; renderFiltros(); render(); }
  });
  let espera;
  el.busca.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(() => { estado.termo = el.busca.value; render(); }, 120); });
  el.pp.addEventListener("click", () => estado.atual && tocar(estado.atual));
  el.ant.addEventListener("click", () => pular(-1));
  el.prox.addEventListener("click", () => pular(1));
  el.repetir.addEventListener("click", () => {
    estado.repetir = !estado.repetir;
    estado.vezes = 1;
    renderPlayer();
    avisar(estado.repetir ? "Este ponto vai repetir até você desligar." : "Repetir desligado.");
  });
  el.barra.addEventListener("input", () => { estado.arrastando = true; el.atual.textContent = tempo(el.barra.value); });
  el.barra.addEventListener("change", async () => {
    estado.arrastando = false;
    if (estado.carregado !== estado.atual) await preparar(estado.atual);
    audio.currentTime = Number(el.barra.value);
  });
  el.btnLetra.addEventListener("click", abrirLetra);
  el.fFechar.addEventListener("click", fecharLetra);
  el.fundo.addEventListener("click", fecharLetra);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.folha.hidden) fecharLetra(); });

  // ---------- Ligação com o app ----------
  window.PontosApp = {
    mostrar(aba) {
      estado.naPagina = true;
      if (aba && aba !== estado.aba) {
        estado.aba = aba; estado.filtro = ""; estado.termo = ""; el.busca.value = "";
      }
      carregar()
        .then(() => {
          // Se nada tocou ainda, o player mostra o primeiro ponto da aba aberta
          if (estado.carregado === null) { const ps = pontosDaAba(); if (ps.length) { estado.atual = ps[0].id; estado.fila = ps.map((p) => p.id); } }
          renderFiltros(); render(); renderPlayer();
        })
        .catch((e) => { el.conteudo.innerHTML = `<div class="vazio"><h2>Não foi possível carregar os pontos</h2><p>${escapar(e.message)}.</p></div>`; });
    },
    esconder() {
      estado.naPagina = false;
      renderPlayer();
    },
  };
})();
