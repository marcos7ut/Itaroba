/* ============================================================
   Acesso restrito aos membros do Templo Itarobá
   - Entrar com Google ou com código enviado por e-mail (Supabase Auth).
   - Primeiro acesso: pedido com nome, sobrenome, gira e WhatsApp.
   - O administrador aprova, nega ou remove no Painel (#/painel).
   - Quem é removido perde o acesso e o app apaga o que estava salvo no celular.
   Fica DESLIGADO enquanto config.js não tiver as chaves do Supabase.
   As regras de segurança de verdade ficam no banco (supabase/1-acesso.sql).
   ============================================================ */
(() => {
  "use strict";
  const C = (window.ACERVO_CONFIG || {}).acesso || {};
  const ligado = !!(C.supabaseUrl && C.supabaseChave);
  window.ACESSO = { ligado, perfil: null };

  /* ---------- arquivos do acervo (textos, PDFs, áudios) ----------
     Com arquivosNaNuvem ligado, tudo vem da pasta PRIVADA "acervo" do Supabase:
     só membros aprovados conseguem baixar, e os links dos PDFs e áudios vencem em 1 hora.
     Desligado, vem das pastas do próprio site (como era antes). */
  const NUVEM = ligado && !!C.arquivosNaNuvem;
  let sb = null, liberarArquivos = null;
  const arquivosProntos = new Promise((ok) => (liberarArquivos = ok));
  if (!ligado) liberarArquivos();
  const PASTA = "acervo", GUARDA = "acervo-dados", links = new Map();
  const chaveGuarda = (caminho) => new Request(new URL("__acervo/" + caminho, location.href).href);
  const linkGuardado = (caminho) => { const l = links.get(caminho); return l && l.ate > Date.now() ? l.url : null; };
  window.ACERVO_ARQ = {
    nuvem: NUVEM,
    esperar: () => arquivosProntos,
    // textos e listas (JSON); sem internet, usa a última cópia guardada no celular
    async json(caminho) {
      if (!NUVEM) { const r = await fetch(caminho, { cache: "no-cache" }); if (!r.ok) throw new Error("Não foi possível ler " + caminho); return r.json(); }
      try {
        const { data, error } = await sb.storage.from(PASTA).download(caminho);
        if (error) throw error;
        const txt = await data.text(), obj = JSON.parse(txt);
        try { const c = await caches.open(GUARDA); await c.put(chaveGuarda(caminho), new Response(txt, { headers: { "content-type": "application/json" } })); } catch (e) {}
        return obj;
      } catch (e) {
        try { const c = await caches.open(GUARDA), r = await c.match(chaveGuarda(caminho)); if (r) return r.json(); } catch (x) {}
        throw new Error("Não foi possível carregar o acervo. Confira a internet");
      }
    },
    // link temporário (1 hora) para PDF ou áudio
    async url(caminho) {
      if (!NUVEM) return encodeURI(caminho);
      const pronto = linkGuardado(caminho); if (pronto) return pronto;
      const { data, error } = await sb.storage.from(PASTA).createSignedUrl(caminho, 3600);
      if (error) throw error;
      links.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60e3 });
      return data.signedUrl;
    },
    // prepara vários links de uma vez (ex.: todos os áudios), para o play sair na hora
    async preparar(caminhos) {
      if (!NUVEM || !sb) return;
      const faltam = [...new Set(caminhos)].filter((c) => c && !linkGuardado(c));
      for (let i = 0; i < faltam.length; i += 100) {
        const { data } = await sb.storage.from(PASTA).createSignedUrls(faltam.slice(i, i + 100), 3600);
        (data || []).forEach((d) => { if (d.signedUrl && !d.error) links.set(d.path, { url: d.signedUrl, ate: Date.now() + 50 * 60e3 }); });
      }
    },
    // arquivo inteiro (para salvar o ponto no celular e ouvir sem internet)
    async blob(caminho) {
      if (!NUVEM) { const r = await fetch(caminho); if (!r.ok) throw new Error(r.status); return r.blob(); }
      const { data, error } = await sb.storage.from(PASTA).download(caminho);
      if (error) throw error;
      return data;
    },
  };
  if (!ligado) return;

  const raiz = document.documentElement;
  raiz.classList.add("acesso-travado");

  const GIRAS = [
    ["segunda", "Segunda"], ["terca", "Terça"], ["quarta", "Quarta"], ["quinta", "Quinta"], ["sexta", "Sexta"],
    ["sabado-10h", "Sábado · 10h30"], ["sabado-16h", "Sábado · 16h"], ["sabado-20h30", "Sábado · 20h30"],
  ];
  const nomeGira = (id) => (GIRAS.find((g) => g[0] === id) || [id, id])[1];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const soDigitos = (s) => String(s || "").replace(/\D/g, "");
  const formatarZap = (d) => { d = soDigitos(d).replace(/^55(?=\d{10,11}$)/, ""); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };
  const linkZap = (d) => { d = soDigitos(d); return "https://wa.me/" + (d.length <= 11 ? "55" + d : d); };
  const dataHora = (t) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
  const quando = (t) => {
    if (!t) return "nunca";
    const s = (Date.now() - new Date(t)) / 1000;
    if (s < 3600) return "agora há pouco"; if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    const d = Math.floor(s / 86400); return d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : dataHora(t).slice(0, 8);
  };
  const LOGO = "assets/logo-192.png";
  const CACHE = "acesso:perfil";
  const OFFLINE_DIAS = 30; // sem internet, quem já foi aprovado continua usando por até 30 dias

  /* ---------- tela de acesso (por cima do app) ---------- */
  const tela = document.createElement("div");
  tela.id = "acesso"; tela.className = "ac"; tela.setAttribute("role", "dialog"); tela.setAttribute("aria-modal", "true"); tela.setAttribute("aria-labelledby", "ac-titulo");
  document.body.appendChild(tela);
  function mostrar(html) {
    tela.innerHTML = `<div class="ac__fundo" aria-hidden="true"></div><div class="ac__caixa">${html}</div>`;
    tela.hidden = false; raiz.classList.add("acesso-travado");
    const f = tela.querySelector("[autofocus]"); if (f) setTimeout(() => f.focus(), 50);
  }
  const cabeca = (rotulo, titulo, texto) => `
    <img class="ac__logo" src="${LOGO}" width="84" height="84" alt="">
    <p class="ac__rotulo">${rotulo}</p>
    <h1 class="ac__titulo" id="ac-titulo">${titulo}</h1>
    ${texto ? `<p class="ac__texto">${texto}</p>` : ""}`;
  const erroHtml = '<p class="ac__erro" role="alert" hidden></p>';
  function erro(msg) { const e = tela.querySelector(".ac__erro"); if (e) { e.textContent = msg; e.hidden = !msg; } }
  function ocupado(btn, sim, texto) { if (!btn) return; btn.disabled = sim; if (texto) btn.dataset.txt = btn.dataset.txt || btn.textContent; btn.textContent = sim ? texto || btn.textContent : btn.dataset.txt || btn.textContent; }

  /* ---------- Supabase ---------- */
  let perfil = null, relogio = 0;
  function carregarBiblioteca() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement("script"); s.src = "assets/vendor/supabase-2.117.3.js"; s.onload = ok; s.onerror = () => falha(new Error("biblioteca"));
      document.head.appendChild(s);
    });
  }
  const BASE = location.origin + location.pathname;

  async function iniciar() {
    mostrar(`${cabeca("Templo Itarobá", "Acervo da casa", "Conferindo o seu acesso…")}<div class="ac__girando" aria-hidden="true"></div>`);
    try {
      await carregarBiblioteca();
      sb = window.supabase.createClient(C.supabaseUrl, C.supabaseChave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
      sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { perfil = null; telaEntrar(); } });
      await verificar();
    } catch (e) { semConexao(); }
  }

  function guardar(p) { try { localStorage.setItem(CACHE, JSON.stringify({ status: p.status, papel: p.papel, nome: p.nome, t: Date.now() })); } catch (e) {} }
  function guardado() { try { return JSON.parse(localStorage.getItem(CACHE)); } catch (e) { return null; } }

  function semConexao() {
    const g = guardado();
    if (g && g.status === "aprovado" && Date.now() - g.t < OFFLINE_DIAS * 864e5) { liberar({ ...g, offline: true }); return; }
    mostrar(`${cabeca("Sem conexão", "Não deu para conferir o seu acesso", "Verifique a internet e tente de novo.")}
      <button type="button" class="ac__botao" data-ac="tentar">Tentar de novo</button>`);
  }

  async function verificar() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return telaEntrar();
    const usuario = session.user;
    const { data, error } = await sb.from("membros").select("*").eq("id", usuario.id).maybeSingle();
    if (error) { if (/JWT|token/i.test(error.message)) { await sb.auth.signOut(); return; } return semConexao(); }
    perfil = data;
    if (!perfil) return telaPedido(usuario.email);
    guardar(perfil);
    if (perfil.status === "aprovado") return liberar(perfil);
    if (perfil.status === "pendente") return telaAguardando();
    if (perfil.status === "negado") return telaNegado();
    if (perfil.status === "removido") return telaRemovido();
  }

  /* ---------- 1. entrar ---------- */
  function telaEntrar() {
    travar();
    const google = C.entrarComGoogle !== false, email = C.entrarComEmail !== false;
    mostrar(`${cabeca("Templo Itarobá · acesso restrito", "Acervo da casa", "Palestras e pontos cantados são exclusivos para os membros do terreiro. Entre para pedir o seu acesso.")}
      ${google ? `<button type="button" class="ac__botao ac__botao--google" data-ac="google">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
        Entrar com Google</button>` : ""}
      ${google && email ? '<p class="ac__ou"><span>ou</span></p>' : ""}
      ${email ? `<form class="ac__form" data-form="email" novalidate>
        <label class="ac__campo"><span>Seu e-mail</span><input type="email" name="email" inputmode="email" autocomplete="email" placeholder="nome@exemplo.com" required ${google ? "" : "autofocus"}></label>
        <button class="ac__botao ac__botao--claro" type="submit">Receber código por e-mail</button>
      </form>` : ""}
      ${erroHtml}
      <p class="ac__nota">Seu pedido é analisado pela administração da casa.</p>`);
  }

  function telaCodigo(email) {
    mostrar(`${cabeca("Confira seu e-mail", "Digite o código", `Enviamos um código para <b>${esc(email)}</b>. Pode levar um minuto; veja também a caixa de spam.`)}
      <form class="ac__form" data-form="codigo" data-email="${esc(email)}" novalidate>
        <label class="ac__campo"><span>Código</span><input name="codigo" class="ac__codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••" required autofocus></label>
        <button class="ac__botao" type="submit">Entrar</button>
      </form>
      ${erroHtml}
      <button type="button" class="ac__link" data-ac="voltar">Usar outro e-mail</button>`);
  }

  /* ---------- 2. pedido de acesso ---------- */
  function telaPedido(email, atual) {
    const p = atual || {};
    mostrar(`${cabeca("Primeiro acesso", "Pedir acesso", `Preencha seus dados. Assim que a administração aprovar, o acervo abre neste celular.`)}
      <form class="ac__form" data-form="pedido" novalidate>
        <div class="ac__dupla">
          <label class="ac__campo"><span>Nome</span><input name="nome" autocomplete="given-name" maxlength="60" value="${esc(p.nome)}" required autofocus></label>
          <label class="ac__campo"><span>Sobrenome</span><input name="sobrenome" autocomplete="family-name" maxlength="80" value="${esc(p.sobrenome)}" required></label>
        </div>
        <fieldset class="ac__giras">
          <legend>Gira que você frequenta</legend>
          <div class="ac__giras-grade">${GIRAS.map(([id, nome]) => `<label class="ac__gira${id.startsWith("sabado") ? " ac__gira--sab" : ""}"><input type="radio" name="gira" value="${id}"${p.gira === id ? " checked" : ""} required><span>${nome}</span></label>`).join("")}</div>
        </fieldset>
        <label class="ac__campo"><span>WhatsApp com DDD</span><input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 91234-5678" value="${esc(p.whatsapp ? formatarZap(p.whatsapp) : "")}" required></label>
        <label class="ac__aceite"><input type="checkbox" name="aceite" required${atual ? " checked" : ""}><span>Concordo que estes dados sejam usados só para controlar o acesso ao acervo da casa (<a href="privacidade.html" target="_blank" rel="noopener">privacidade e regras de uso</a>).</span></label>
        <button class="ac__botao" type="submit">${atual ? "Enviar de novo" : "Enviar pedido"}</button>
      </form>
      ${erroHtml}
      <p class="ac__nota">Entrou como <b>${esc(email || "")}</b> · <button type="button" class="ac__link" data-ac="sair">sair</button></p>`);
    const zap = tela.querySelector('[name="whatsapp"]');
    zap.addEventListener("input", () => { const d = soDigitos(zap.value).slice(0, 11); zap.value = d.length > 2 ? `(${d.slice(0, 2)}) ${d.length > 10 ? d.slice(2, 7) + "-" + d.slice(7) : d.length > 6 ? d.slice(2, 6) + "-" + d.slice(6) : d.slice(2)}` : d; });
  }

  /* ---------- 3. esperando aprovação / negado / removido ---------- */
  function telaAguardando() {
    mostrar(`${cabeca("Pedido enviado", `Obrigado, ${esc(perfil.nome)}!`, "Seu pedido está com a administração da casa. Quando for aprovado, o acervo abre sozinho aqui.")}
      <dl class="ac__resumo">
        <div><dt>Nome</dt><dd>${esc(perfil.nome)} ${esc(perfil.sobrenome)}</dd></div>
        <div><dt>Gira</dt><dd>${esc(nomeGira(perfil.gira))}</dd></div>
        <div><dt>WhatsApp</dt><dd>${esc(formatarZap(perfil.whatsapp))}</dd></div>
      </dl>
      <p class="ac__espera"><i aria-hidden="true"></i>Aguardando aprovação</p>
      <div class="ac__acoes"><button type="button" class="ac__link" data-ac="corrigir">Corrigir meus dados</button><button type="button" class="ac__link" data-ac="sair">Sair</button></div>`);
    vigiar(15000);
  }
  function telaNegado() {
    mostrar(`${cabeca("Pedido não aprovado", "Acesso não liberado", "Seu pedido não foi aprovado. Se acha que foi engano, fale com a administração da casa ou confira seus dados e envie de novo.")}
      <button type="button" class="ac__botao" data-ac="corrigir">Conferir e enviar de novo</button>
      <button type="button" class="ac__link" data-ac="sair">Sair</button>`);
    vigiar(60000);
  }
  async function telaRemovido() {
    await apagarDados();
    mostrar(`${cabeca("Acesso encerrado", "Seu acesso foi encerrado", "Os conteúdos salvos neste celular foram apagados. Em caso de dúvida, fale com a administração da casa.")}
      <button type="button" class="ac__link" data-ac="sair">Sair</button>`);
  }
  function vigiar(ms) { clearInterval(relogio); relogio = setInterval(() => verificar().catch(() => {}), ms); }

  // Apaga tudo o que o acervo guardou no celular (pontos salvos, palestras salvas, cache)
  async function apagarDados() {
    try { Object.keys(localStorage).forEach((k) => { if (!k.startsWith("sb-")) localStorage.removeItem(k); }); } catch (e) {}
    try { indexedDB.deleteDatabase("pontos-cantados"); } catch (e) {}
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
  }

  /* ---------- 4. liberado ---------- */
  function travar() { clearInterval(relogio); raiz.classList.add("acesso-travado"); document.getElementById("ac-nav")?.remove(); }
  function liberar(p) {
    perfil = p; window.ACESSO.perfil = p;
    tela.hidden = true; tela.innerHTML = ""; raiz.classList.remove("acesso-travado");
    if (!p.offline) sb.rpc("registrar_acesso").then(() => {}, () => {});
    linkPainel();
    rodape();
    window.dispatchEvent(new CustomEvent("acesso-liberado", { detail: p }));
    liberarArquivos();
    // confere de novo de tempos em tempos e quando o app volta para a tela (ex.: foi removido)
    clearInterval(relogio); relogio = setInterval(reconferir, 10 * 60e3);
    rota();
  }
  async function reconferir() {
    if (!sb || document.visibilityState !== "visible") return;
    try {
      const { data: { session } } = await sb.auth.getSession(); if (!session) return telaEntrar();
      const { data, error } = await sb.from("membros").select("*").eq("id", session.user.id).maybeSingle();
      if (error) return; // sem internet: segue com o que tem
      if (!data || data.status !== "aprovado") { perfil = data; if (data) guardar(data); return data ? verificar() : telaPedido(session.user.email); }
      perfil = data; guardar(data); linkPainel();
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", reconferir);

  function rodape() {
    if (document.getElementById("ac-conta")) return;
    const r = document.querySelector(".rodape__painel"); if (!r) return;
    const d = document.createElement("p"); d.id = "ac-conta"; d.className = "ac-conta";
    d.innerHTML = `Conectado como <b>${esc(perfil.nome || "")}</b> · <button type="button" class="ac__link" data-ac="sair">Sair da conta</button>`;
    r.appendChild(d);
  }

  /* ---------- painel do administrador ---------- */
  const ehAdmin = () => perfil && perfil.papel === "admin" && perfil.status === "aprovado" && !perfil.offline;
  function linkPainel() {
    const nav = document.querySelector(".nav__links");
    let a = document.getElementById("ac-nav");
    if (!ehAdmin()) { a?.remove(); return; }
    if (!a && nav) {
      a = document.createElement("a"); a.id = "ac-nav"; a.href = "#/painel"; a.className = "nav__link ac-nav"; a.setAttribute("aria-label", "Painel de acesso");
      a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/></svg><span class="ac-nav__txt">Painel</span><span class="ac-nav__n" hidden></span>`;
      nav.appendChild(a);
    }
    contarPendentes();
  }
  async function contarPendentes() {
    if (!ehAdmin()) return;
    const { count } = await sb.from("membros").select("id", { count: "exact", head: true }).eq("status", "pendente");
    const n = document.querySelector(".ac-nav__n"); if (n) { n.textContent = count || ""; n.hidden = !count; }
  }

  const painel = document.createElement("section");
  painel.id = "ac-painel"; painel.className = "acp"; painel.hidden = true; painel.setAttribute("aria-labelledby", "acp-titulo");
  document.body.appendChild(painel);
  const P = { aba: "pendente", busca: "", gira: "", lista: [], carregando: false, timer: 0 };
  const ABAS = [["pendente", "Pendentes"], ["aprovado", "Aprovados"], ["negado", "Negados"], ["removido", "Removidos"]];

  function rota() {
    const quer = location.hash.replace(/^#\/?/, "") === "painel";
    if (quer && ehAdmin()) { if (painel.hidden) abrirPainel(); }
    else if (!painel.hidden) fecharPainel();
  }
  addEventListener("hashchange", rota);
  function abrirPainel() {
    painel.hidden = false; raiz.classList.add("com-painel"); scrollTo(0, 0);
    document.querySelectorAll('.nav__link[aria-current]').forEach((a) => a.removeAttribute("aria-current"));
    document.getElementById("ac-nav")?.setAttribute("aria-current", "page");
    desenharPainel(); carregarLista();
    clearInterval(P.timer); P.timer = setInterval(carregarLista, 30000);
  }
  function fecharPainel() { painel.hidden = true; raiz.classList.remove("com-painel"); clearInterval(P.timer); document.getElementById("ac-nav")?.removeAttribute("aria-current"); }

  async function carregarLista() {
    P.carregando = true; desenharLista();
    const { data, error } = await sb.from("membros").select("*").order("criado_em", { ascending: false });
    P.carregando = false;
    if (error) { P.erro = "Não foi possível carregar. Confira a internet."; } else { P.erro = ""; P.lista = data || []; }
    desenharPainel();
    contarPendentes();
  }

  function desenharPainel() {
    const n = (s) => P.lista.filter((m) => m.status === s).length;
    painel.innerHTML = `<div class="acp__inner">
      <header class="acp__topo">
        <div><p class="acp__rotulo">Administração</p><h1 class="acp__titulo" id="acp-titulo">Painel de <em>acesso</em></h1></div>
        <a class="acp__fechar" href="#/" aria-label="Fechar o painel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a>
      </header>
      <div class="acp__numeros">
        <div><b>${n("aprovado")}</b><span>membros</span></div>
        <div class="${n("pendente") ? "acp__alerta" : ""}"><b>${n("pendente")}</b><span>pendentes</span></div>
        <div><b>${n("removido") + n("negado")}</b><span>fora</span></div>
      </div>
      <nav class="acp__abas" role="tablist">${ABAS.map(([id, nome]) => `<button type="button" role="tab" class="acp__aba" data-acp-aba="${id}" aria-selected="${P.aba === id}">${nome}<span>${n(id)}</span></button>`).join("")}</nav>
      <div class="acp__filtros">
        <input type="search" class="acp__busca" placeholder="Buscar por nome, e-mail ou WhatsApp" value="${esc(P.busca)}" aria-label="Buscar membro">
        <select class="acp__gira" aria-label="Filtrar por gira"><option value="">Todas as giras</option>${GIRAS.map(([id, nome]) => `<option value="${id}"${P.gira === id ? " selected" : ""}>${nome}</option>`).join("")}</select>
      </div>
      <div class="acp__barra"><button type="button" class="acp__mini" data-acp="atualizar">Atualizar</button><button type="button" class="acp__mini" data-acp="csv">Baixar lista (planilha)</button></div>
      <ul class="acp__lista" id="acp-lista"></ul>
    </div>`;
    desenharLista();
  }

  function desenharLista() {
    const ul = painel.querySelector("#acp-lista"); if (!ul) return;
    if (P.erro) { ul.innerHTML = `<li class="acp__vazio">${esc(P.erro)}</li>`; return; }
    if (P.carregando && !P.lista.length) { ul.innerHTML = `<li class="acp__vazio">Carregando…</li>`; return; }
    const t = P.busca.trim().toLowerCase(), td = soDigitos(t);
    const vs = P.lista.filter((m) => m.status === P.aba && (!P.gira || m.gira === P.gira) &&
      (!t || `${m.nome} ${m.sobrenome} ${m.email}`.toLowerCase().includes(t) || (td && m.whatsapp.includes(td))));
    if (!vs.length) { ul.innerHTML = `<li class="acp__vazio">${P.aba === "pendente" && !t && !P.gira ? "Nenhum pedido esperando. ☕" : "Ninguém por aqui."}</li>`; return; }
    ul.innerHTML = vs.map((m) => {
      const ini = ((m.nome || "?")[0] + (m.sobrenome || "")[0]).toUpperCase();
      const eu = m.id === perfil.id, admin = m.papel === "admin";
      const acoes = eu || admin ? `<span class="acp__selo">Administrador</span>` : {
        pendente: `<button type="button" class="acp__btn acp__btn--sim" data-acp-acao="aprovar" data-id="${m.id}">Aprovar</button><button type="button" class="acp__btn" data-acp-acao="negar" data-id="${m.id}">Negar</button>`,
        aprovado: `<button type="button" class="acp__btn acp__btn--perigo" data-acp-acao="remover" data-id="${m.id}">Remover acesso</button>`,
        negado: `<button type="button" class="acp__btn acp__btn--sim" data-acp-acao="aprovar" data-id="${m.id}">Aprovar</button><button type="button" class="acp__btn" data-acp-acao="excluir" data-id="${m.id}">Excluir pedido</button>`,
        removido: `<button type="button" class="acp__btn acp__btn--sim" data-acp-acao="reativar" data-id="${m.id}">Reativar</button><button type="button" class="acp__btn" data-acp-acao="excluir" data-id="${m.id}">Excluir</button>`,
      }[m.status];
      return `<li class="acp__membro acp__membro--${m.status}">
        <span class="acp__ini" aria-hidden="true">${esc(ini)}</span>
        <div class="acp__dados">
          <b>${esc(m.nome)} ${esc(m.sobrenome)}</b>
          <span class="acp__gira-selo">Gira de ${esc(nomeGira(m.gira))}</span>
          <a class="acp__zap" href="${linkZap(m.whatsapp)}" target="_blank" rel="noopener">${esc(formatarZap(m.whatsapp))}</a>
          <small>${esc(m.email)}</small>
          <small>${m.status === "pendente" ? "Pediu" : "Pedido"} em ${dataHora(m.criado_em)}${m.status === "aprovado" ? ` · último acesso ${quando(m.ultimo_acesso)}` : m.decidido_em ? ` · decidido em ${dataHora(m.decidido_em)}` : ""}</small>
        </div>
        <div class="acp__acoes">${acoes}</div>
      </li>`;
    }).join("");
  }

  const PERGUNTA = {
    negar: (m) => `Negar o pedido de ${m.nome} ${m.sobrenome}?`,
    remover: (m) => `Remover o acesso de ${m.nome} ${m.sobrenome}?\n\nO acervo fecha para essa pessoa e o que ela salvou no celular é apagado.`,
    excluir: (m) => `Excluir o cadastro de ${m.nome} ${m.sobrenome}?\n\nA pessoa poderá fazer um novo pedido depois.`,
  };
  const FEITO = { aprovar: "aprovado(a)", reativar: "reativado(a)", negar: "negado(a)", remover: "removido(a)", excluir: "excluído(a)" };
  async function agir(btn) {
    const id = btn.dataset.id, acao = btn.dataset.acpAcao, m = P.lista.find((x) => x.id === id); if (!m) return;
    if (PERGUNTA[acao] && !confirm(PERGUNTA[acao](m))) return;
    btn.closest(".acp__acoes").querySelectorAll("button").forEach((b) => (b.disabled = true));
    const { error } = acao === "excluir" ? await sb.rpc("excluir_pedido", { alvo: id }) : await sb.rpc("decidir", { alvo: id, acao });
    if (error) { alert("Não deu certo: " + error.message); btn.closest(".acp__acoes").querySelectorAll("button").forEach((b) => (b.disabled = false)); return; }
    avisar(`${m.nome} ${FEITO[acao]}`);
    await carregarLista();
  }
  function avisar(msg) {
    let a = document.getElementById("acp-aviso");
    if (!a) { a = document.createElement("div"); a.id = "acp-aviso"; a.className = "acp__aviso"; a.setAttribute("role", "status"); document.body.appendChild(a); }
    a.textContent = msg; a.hidden = false; clearTimeout(avisar.t); avisar.t = setTimeout(() => (a.hidden = true), 2600);
  }
  function baixarCsv() {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["Nome", "Sobrenome", "Gira", "WhatsApp", "E-mail", "Situação", "Pedido em", "Último acesso"]]
      .concat(P.lista.map((m) => [m.nome, m.sobrenome, nomeGira(m.gira), formatarZap(m.whatsapp), m.email, m.status, dataHora(m.criado_em), m.ultimo_acesso ? dataHora(m.ultimo_acesso) : ""]));
    const blob = new Blob(["﻿" + linhas.map((l) => l.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `membros-itaroba-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  painel.addEventListener("click", (e) => {
    const aba = e.target.closest("[data-acp-aba]"); if (aba) { P.aba = aba.dataset.acpAba; desenharPainel(); return; }
    const ac = e.target.closest("[data-acp-acao]"); if (ac) { agir(ac); return; }
    const b = e.target.closest("[data-acp]"); if (!b) return;
    if (b.dataset.acp === "atualizar") carregarLista();
    if (b.dataset.acp === "csv") baixarCsv();
  });
  painel.addEventListener("input", (e) => {
    if (e.target.matches(".acp__busca")) { P.busca = e.target.value; desenharLista(); }
  });
  painel.addEventListener("change", (e) => { if (e.target.matches(".acp__gira")) { P.gira = e.target.value; desenharLista(); } });

  /* ---------- ações das telas de acesso ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ac]"); if (!b) return;
    const a = b.dataset.ac;
    if (a === "tentar") return iniciar();
    if (a === "voltar") return telaEntrar();
    if (a === "sair") { clearInterval(relogio); fecharPainel(); try { localStorage.removeItem(CACHE); } catch (x) {} await sb.auth.signOut(); return telaEntrar(); }
    if (a === "corrigir") { const { data: { session } } = await sb.auth.getSession(); return telaPedido(session?.user.email, perfil); }
    if (a === "google") {
      ocupado(b, true, "Abrindo o Google…");
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: BASE } });
      if (error) { ocupado(b, false); erro("Não foi possível abrir o login do Google."); }
    }
  });

  tela.addEventListener("input", () => erro(""));
  tela.addEventListener("change", () => erro(""));
  tela.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('[type="submit"]'); erro("");
    if (f.dataset.form === "email") {
      const email = f.email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro("Confira o e-mail.");
      ocupado(btn, true, "Enviando…");
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      ocupado(btn, false);
      if (error) return erro(/rate|limit|seconds/i.test(error.message) ? "Muitas tentativas. Espere um minuto e tente de novo." : "Não deu para enviar o código. Tente de novo.");
      return telaCodigo(email);
    }
    if (f.dataset.form === "codigo") {
      const token = soDigitos(f.codigo.value);
      if (token.length < 6) return erro("O código tem 6 números.");
      ocupado(btn, true, "Conferindo…");
      const { error } = await sb.auth.verifyOtp({ email: f.dataset.email, token, type: "email" });
      ocupado(btn, false);
      if (error) return erro("Código errado ou vencido. Confira ou peça outro.");
      return verificar();
    }
    if (f.dataset.form === "pedido") {
      const d = { nome: f.nome.value.trim(), sobrenome: f.sobrenome.value.trim(), gira: (f.querySelector('[name="gira"]:checked') || {}).value, whatsapp: soDigitos(f.whatsapp.value) };
      if (!d.nome) return erro("Preencha o nome."), f.nome.focus();
      if (!d.sobrenome) return erro("Preencha o sobrenome."), f.sobrenome.focus();
      if (!d.gira) return erro("Escolha a gira que você frequenta.");
      if (d.whatsapp.length < 10 || d.whatsapp.length > 11) return erro("Confira o WhatsApp com DDD."), f.whatsapp.focus();
      if (!f.aceite.checked) return erro("Marque a concordância para enviar.");
      ocupado(btn, true, "Enviando…");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return telaEntrar();
      const r = perfil
        ? await sb.rpc("atualizar_pedido", { p_nome: d.nome, p_sobrenome: d.sobrenome, p_gira: d.gira, p_whatsapp: d.whatsapp })
        : await sb.from("membros").insert({ id: session.user.id, email: session.user.email, ...d });
      ocupado(btn, false);
      if (r.error && !/duplicate|unique/i.test(r.error.message)) return erro("Não deu para enviar. Confira a internet e tente de novo.");
      return verificar();
    }
  });

  iniciar();
})();
