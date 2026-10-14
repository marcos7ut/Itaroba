/* ============================================================
   Acervo de Palestras — lógica do app (sem dependências)
   ============================================================ */
(() => {
  "use strict";

  const CFG = window.ACERVO_CONFIG || {};
  const POR_PAGINA = 30;
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  const $ = (s) => document.querySelector(s);
  const el = {
    busca: $("#campo-busca"), limpar: $("#limpar-busca"), completa: $("#busca-completa"),
    temas: $("#temas"), anos: $("#anos"), ordem: $("#ordem"),
    lista: $("#lista"), vazio: $("#vazio"), resultado: $("#resultado"), mais: $("#carregar-mais"),
    numeros: $("#numeros"), vistaLista: $("#vista-lista"), vistaPalestra: $("#vista-palestra"),
    aviso: $("#aviso"),
  };

  const estado = {
    palestras: [], porId: new Map(), textos: null, carregandoTextos: null,
    termo: "", tema: "", ano: "", ordem: "recentes",
    soSalvas: false, mostrando: POR_PAGINA, filtradas: [],
    aba: "resumo", rolagemLista: 0,
  };

  // ---------- Armazenamento local (protegido) ----------
  const guardar = {
    ler(chave, padrao) { try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; } },
    gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ } },
  };
  let salvas = new Set(guardar.ler("acervo:salvas", []));
  const tamanhoLetra = { atual: guardar.ler("acervo:letra", 1.1875) };

  // ---------- Utilidades ----------
  const normalizar = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const escapar = (s) => (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const escRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function partesData(iso) {
    if (!iso) return null;
    const [a, m, d] = iso.split("-").map(Number);
    return { a, m, d };
  }
  function dataLonga(iso) {
    const p = partesData(iso);
    if (!p) return "";
    if (!p.m) return String(p.a);
    if (!p.d) return `${MESES_LONGOS[p.m - 1]} de ${p.a}`;
    return `${p.d} de ${MESES_LONGOS[p.m - 1]} de ${p.a}`;
  }

  // Destaca os termos buscados (ignorando acentos)
  function destacar(texto, termos) {
    const seguro = escapar(texto);
    if (!termos.length) return seguro;
    const norm = normalizar(seguro);
    const marcas = [];
    termos.forEach((t) => {
      const re = new RegExp(escRegex(normalizar(escapar(t))), "g");
      let m;
      while ((m = re.exec(norm))) { marcas.push([m.index, m.index + m[0].length]); if (m[0].length === 0) break; }
    });
    if (!marcas.length) return seguro;
    marcas.sort((x, y) => x[0] - y[0]);
    let out = "", pos = 0;
    for (const [i, f] of marcas) {
      if (i < pos) continue;
      out += seguro.slice(pos, i) + "<mark>" + seguro.slice(i, f) + "</mark>";
      pos = f;
    }
    return out + seguro.slice(pos);
  }

  function trechoCom(texto, termos) {
    const n = normalizar(texto);
    for (const t of termos) {
      const i = n.indexOf(normalizar(t));
      if (i >= 0) {
        const ini = Math.max(0, n.lastIndexOf(" ", Math.max(0, i - 70)));
        const fim = Math.min(texto.length, i + 140);
        return (ini > 0 ? "…" : "") + texto.slice(ini, fim).trim() + (fim < texto.length ? "…" : "");
      }
    }
    return "";
  }

  function avisar(msg) {
    el.aviso.textContent = msg;
    el.aviso.hidden = false;
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => (el.aviso.hidden = true), 2400);
  }

  // ---------- Dados ----------
  async function carregarDados() {
    const r = await fetch("data/palestras.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("Não foi possível ler data/palestras.json");
    const lista = await r.json();
    estado.palestras = lista.map((p) => ({
      ...p,
      temas: p.temas || [],
      topicos: p.topicos || [],
      _busca: normalizar([p.titulo, p.palestrante, p.resumo, (p.topicos || []).join(" "), (p.temas || []).join(" "), p.palavras_chave?.join(" ")].join(" ")),
    }));
    estado.palestras.forEach((p) => estado.porId.set(p.id, p));
  }

  function carregarTextos() {
    if (estado.textos) return Promise.resolve(estado.textos);
    if (!estado.carregandoTextos) {
      estado.carregandoTextos = fetch("data/textos.json")
        .then((r) => (r.ok ? r.json() : {}))
        .then((t) => {
          estado.textos = t;
          estado.textosNorm = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, normalizar(v)]));
          return t;
        })
        .catch(() => (estado.textos = {}));
    }
    return estado.carregandoTextos;
  }

  // ---------- Filtros ----------
  function montarFiltros() {
    const contagem = new Map();
    const anos = new Set();
    estado.palestras.forEach((p) => {
      p.temas.forEach((t) => contagem.set(t, (contagem.get(t) || 0) + 1));
      const d = partesData(p.data); if (d) anos.add(d.a);
    });
    const temas = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
    el.temas.innerHTML =
      `<button type="button" class="tema" data-tema="" aria-pressed="true">Todos os temas</button>` +
      temas.map(([t, n]) => `<button type="button" class="tema" data-tema="${escapar(t)}" aria-pressed="false">${escapar(t)}<span class="tema__n">${n}</span></button>`).join("");

    const anosOrd = [...anos].sort((a, b) => a - b);
    el.anos.innerHTML = `<button type="button" class="ano" data-ano="" aria-pressed="true">Todos</button>` +
      anosOrd.map((a) => `<button type="button" class="ano" data-ano="${a}" aria-pressed="false">${a}</button>`).join("");

    const nAnos = anos.size ? Math.max(...anos) - Math.min(...anos) + 1 : 0;
    const plural = (n, s, p) => `<strong>${n}</strong> ${n === 1 ? s : p}`;
    const partes = [plural(estado.palestras.length, "palestra", "palestras")];
    if (anos.size === 1) partes.push(`de ${[...anos][0]}`);
    if (nAnos > 1) partes.push(plural(nAnos, "ano de estudo", "anos de estudo"));
    el.numeros.innerHTML = partes.join(anos.size === 1 ? " " : ", ") + ".";

    // Ladrilhos do herói e atalhos para a mais recente
    $("#t-palestras").textContent = estado.palestras.length;
    $("#t-temas").textContent = contagem.size;
    $("#t-anos").textContent = anosOrd.length > 1 ? `${anosOrd[0]} – ${anosOrd[anosOrd.length - 1]}` : (anosOrd[0] || "—");
    const recente = [...estado.palestras].sort(ordemCrono).pop();
    if (recente) {
      const href = `#/palestra/${encodeURIComponent(recente.id)}`;
      $("#t-recente").href = href; $("#nav-recente").href = href;
      $("#t-recente-titulo").textContent = `${recente.semana ? "Nº " + recente.semana + " · " : ""}${recente.titulo}`;
    }
  }

  const ordemCrono = (x, y) => (x.data || "").localeCompare(y.data || "") || (x.semana || 0) - (y.semana || 0);

  function termosBusca() {
    if (/^(n[ºo°.]?\s*)?\d{1,4}$/i.test(estado.termo.trim())) return [];
    return estado.termo.trim().split(/\s+/).filter((t) => t.length > 1);
  }

  function filtrar() {
    const termos = termosBusca().map(normalizar);
    const numero = /^(n[ºo°.]?\s*)?\d{1,4}$/i.test(estado.termo.trim()) ? parseInt(estado.termo.replace(/\D/g, ""), 10) : null;
    const usarTexto = el.completa.checked && estado.textosNorm;
    let r = estado.palestras.filter((p) => {
      if (estado.soSalvas && !salvas.has(p.id)) return false;
      if (estado.tema && !p.temas.includes(estado.tema)) return false;
      if (estado.ano && String(partesData(p.data)?.a) !== estado.ano) return false;
      if (numero !== null) return p.semana === numero;
      if (termos.length) {
        const alvo = usarTexto ? p._busca + " " + (estado.textosNorm[p.id] || "") : p._busca;
        return termos.every((t) => alvo.includes(t));
      }
      return true;
    });
    // Relevância: título conta mais
    if (numero !== null) { estado.filtradas = r; return; }
    const pont = (p) => termos.reduce((s, t) => s + (normalizar(p.titulo).includes(t) ? 3 : 0) + (p._busca.includes(t) ? 1 : 0), 0);
    r.sort((a, b) => {
      if (termos.length) { const d = pont(b) - pont(a); if (d) return d; }
      if (estado.ordem === "titulo") return a.titulo.localeCompare(b.titulo, "pt");
      const c = ordemCrono(a, b);
      return estado.ordem === "antigas" ? c : -c;
    });
    estado.filtradas = r;
  }

  // ---------- Lista ----------
  function renderLista() {
    filtrar();
    const termos = termosBusca();
    const usarTexto = el.completa.checked && estado.textos;
    const visiveis = estado.filtradas.slice(0, estado.mostrando);

    const semFiltro = !termos.length && !estado.termo.trim() && !estado.tema && !estado.ano && !estado.soSalvas && estado.ordem === "recentes";
    const icoCal = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`;
    const icoPdf = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`;
    const icoSalva = `<svg class="salva-marca" viewBox="0 0 24 24" role="img" aria-label="Salva"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`;
    el.lista.innerHTML = visiveis.map((p, i) => {
      const d = partesData(p.data);
      const num = p.semana ? `<span class="cartao__num"><small>nº</small>${p.semana}</span>` : `<span></span>`;
      const ano = `<span class="cartao__ano">${salvas.has(p.id) ? icoSalva : ""}${icoCal}${d ? (d.d ? `${d.d} ${MESES[d.m - 1]} ${d.a}` : d.m ? `${MESES_LONGOS[d.m - 1]} ${d.a}` : d.a) : ""}</span>`;
      let trecho = "";
      if (usarTexto && termos.length && !termos.every((t) => p._busca.includes(normalizar(t)))) {
        const t = trechoCom(estado.textos[p.id] || "", termos);
        if (t) trecho = `<p class="trecho">${destacar(t, termos)}</p>`;
      }
      const autor = p.palestrante && p.palestrante !== "Babalorixá" ? `<p class="cartao__autor">${destacar(p.palestrante, termos)}</p>` : "";
      const temas = p.temas.length ? `<ul class="cartao__temas">${p.temas.map((t) => `<li class="etiqueta">${escapar(t)}</li>`).join("")}</ul>` : "";
      const href = `#/palestra/${encodeURIComponent(p.id)}`;
      const pdfBtn = p.pdf ? `<a class="cartao__pdf" href="${encodeURI(p.pdf)}" target="_blank" rel="noopener" aria-label="Abrir o PDF original de ${escapar(p.titulo)}">${icoPdf}<span>PDF</span></a>` : "";
      if (semFiltro && i === 0) {
        return `<li class="item item--destaque"><div class="cartao">
          <div class="cartao__cabeca">
            <div class="cartao__topo"><span class="cartao__selo">Palestra mais recente</span>${num}</div>
            <h3 class="cartao__titulo"><a class="cartao__link" href="${href}">${escapar(p.titulo)}</a></h3>
            ${p.palestrante ? `<p class="cartao__autor">${escapar(p.palestrante)}</p>` : ""}
          </div>
          <div class="cartao__lado">
            ${p.resumo ? `<p class="cartao__resumo">${escapar(p.resumo)}</p>` : ""}
            <div class="cartao__botoes"><span class="cartao__ler">Ler palestra <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>${pdfBtn}</div>
          </div>
        </div></li>`;
      }
      return `<li class="item"><div class="cartao">
          <div class="cartao__topo">${num}${ano}</div>
          <h3 class="cartao__titulo"><a class="cartao__link" href="${href}">${destacar(p.titulo, termos)}</a></h3>
          ${autor}
          ${p.resumo ? `<p class="cartao__resumo">${destacar(p.resumo, termos)}</p>` : ""}
          ${trecho}
          <div class="cartao__rodape">${temas}${pdfBtn}</div>
        </div></li>`;
    }).join("");

    const n = estado.filtradas.length;
    el.vazio.hidden = n > 0;
    if (estado.soSalvas && n === 0 && !termos.length) {
      el.vazio.querySelector("h2").textContent = "Você ainda não salvou nenhuma palestra";
      el.vazio.querySelector("p").textContent = "Abra uma palestra e toque em “Salvar” para guardá-la aqui.";
    } else {
      el.vazio.querySelector("h2").textContent = "Nenhuma palestra encontrada";
      el.vazio.querySelector("p").textContent = "Tente outra palavra, tire algum filtro ou ligue “Procurar também dentro do texto completo”.";
    }
    el.resultado.innerHTML = estado.soSalvas
      ? `<strong>${n}</strong> ${n === 1 ? "palestra salva" : "palestras salvas"}`
      : `<strong>${n}</strong> ${n === 1 ? "palestra" : "palestras"}${n !== estado.palestras.length ? ` de ${estado.palestras.length}` : ""}`;
    el.mais.hidden = n <= estado.mostrando;
  }

  // ---------- Leitura ----------
  function paragrafos(texto, termos) {
    return (texto || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      .map((p) => `<p>${destacar(p.replace(/\s*\n\s*/g, " "), termos)}</p>`).join("");
  }

  function trocarAba(nome, foco) {
    estado.aba = nome;
    ["resumo", "topicos", "texto", "pdf"].forEach((a) => {
      const b = $("#aba-" + a), painel = $("#painel-" + a), ativa = a === nome;
      b.setAttribute("aria-selected", ativa); b.tabIndex = ativa ? 0 : -1; painel.hidden = !ativa;
      if (ativa && foco) b.focus();
    });
    if (nome === "texto") preencherTexto();
    if (nome === "pdf") preencherPdf();
  }

  let palestraAtual = null;
  function preencherPdf() {
    const painel = $("#painel-pdf"), p = palestraAtual;
    if (!p || painel.dataset.id === p.id) return;
    painel.dataset.id = p.id;
    if (!p.pdf) { painel.innerHTML = `<p class="carregando">Esta palestra ainda não tem o PDF original.</p>`; return; }
    const url = encodeURI(p.pdf);
    painel.innerHTML = `<div class="pdf__barra"><span>${escapar(p.pdf.split("/").pop())} · ${p.paginas || 1} ${p.paginas > 1 ? "páginas" : "página"}</span>
        <a class="botao botao--pinho botao--compacto" href="${url}" target="_blank" rel="noopener"><span>Abrir em tela cheia</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a></div>
      <iframe class="pdf__quadro" src="${url}#view=FitH" title="PDF original: ${escapar(p.titulo)}" loading="lazy"></iframe>
      <p class="nota pdf__nota">Se o documento não aparecer aqui (alguns celulares não mostram PDF dentro da página), toque em “Abrir em tela cheia”.</p>`;
  }
  function preencherTexto() {
    const painel = $("#painel-texto");
    const p = palestraAtual;
    if (!p || painel.dataset.id === p.id) return;
    painel.innerHTML = `<p class="carregando">Carregando o texto completo…</p>`;
    carregarTextos().then((t) => {
      if (palestraAtual !== p) return;
      const txt = t[p.id];
      painel.dataset.id = p.id;
      painel.innerHTML = txt
        ? paragrafos(txt, termosBusca()) + (p.pdf ? `<p class="nota">Transcrição do documento original${p.ocr ? ", feita automaticamente e ainda não revisada" : ""}. Em caso de dúvida, consulte o PDF.</p>` : "")
        : `<p class="carregando">O texto completo desta palestra ainda não foi adicionado.${p.pdf ? " Use o botão “Abrir PDF original”." : ""}</p>`;
    });
  }

  function abrirPalestra(id) {
    const p = estado.porId.get(id);
    if (!p) { location.hash = "#/"; return; }
    palestraAtual = p;
    const termos = termosBusca();

    document.title = `${p.titulo} | ${CFG.nomeAcervo || "Acervo de Palestras"}`;
    $("#p-data").textContent = [p.semana ? `Palestra nº ${p.semana}` : "", dataLonga(p.data)].filter(Boolean).join(" · ");
    $("#p-titulo").textContent = p.titulo;
    $("#p-autor").textContent = p.palestrante ? `Por ${p.palestrante}` : "";
    $("#p-temas").innerHTML = p.temas.map((t) => `<li><a class="etiqueta" href="#/tema/${encodeURIComponent(t)}">${escapar(t)}</a></li>`).join("");

    const pdf = $("#p-pdf");
    if (p.pdf) { pdf.href = encodeURI(p.pdf); pdf.hidden = false; } else pdf.hidden = true;
    atualizarBotaoSalvar();

    $("#painel-resumo").innerHTML = p.resumo
      ? `<p class="resumo-destaque">${destacar(p.resumo, termos)}</p>` +
        (p.resumo_longo ? paragrafos(p.resumo_longo, termos) : "") +
        `<p class="nota">Resumo preparado a partir do texto original. Para estudo aprofundado, leia o texto completo.</p>`
      : `<p class="carregando">O resumo desta palestra ainda não foi preparado. Veja o texto completo.</p>`;

    $("#painel-topicos").innerHTML = p.topicos.length
      ? `<ol class="topicos">${p.topicos.map((t) => `<li>${destacar(t, termos)}</li>`).join("")}</ol>`
      : `<p class="carregando">Os pontos principais desta palestra ainda não foram preparados.</p>`;

    delete $("#painel-pdf").dataset.id; $("#painel-pdf").innerHTML = "";
    $("#aba-pdf").hidden = !p.pdf;
    const painelTexto = $("#painel-texto");
    delete painelTexto.dataset.id;
    painelTexto.innerHTML = "";

    // Anterior / próxima em ordem cronológica (respeitando os filtros ativos)
    const base = estado.filtradas.includes(p) ? estado.filtradas : estado.palestras;
    const ordem = [...base].sort(ordemCrono);
    const i = ordem.indexOf(p);
    const ant = ordem[i - 1], prox = ordem[i + 1];
    // Palestras ligadas (ex.: parte I e parte II)
    const rel = (p.relacionadas || []).map((r) => ({ ...r, p: estado.porId.get(r.id) })).filter((r) => r.p);
    $("#p-relacionadas").hidden = !rel.length;
    $("#p-relacionadas").innerHTML = rel.map((r) => `<a class="ligada" href="#/palestra/${encodeURIComponent(r.id)}">
        <span class="ligada__icone"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></span>
        <span class="ligada__texto"><small>${escapar(r.rotulo || "Palestra relacionada")}</small><strong>${escapar(r.p.titulo)}</strong><em>Palestra nº ${r.p.semana} · ${escapar(r.p.data)}</em></span>
        <svg class="ligada__seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`).join("");

    $("#vizinhas").innerHTML = !ant && !prox ? "" :
      (ant ? `<a href="#/palestra/${encodeURIComponent(ant.id)}"><span>Anterior</span><strong>${escapar(ant.titulo)}</strong></a>` : "<span></span>") +
      (prox ? `<a class="prox" href="#/palestra/${encodeURIComponent(prox.id)}"><span>Próxima</span><strong>${escapar(prox.titulo)}</strong></a>` : "");

    trocarAba(termos.length && el.completa.checked ? "texto" : "resumo");
  }

  function atualizarBotaoSalvar() {
    const b = $("#p-salvar"), on = palestraAtual && salvas.has(palestraAtual.id);
    b.setAttribute("aria-pressed", on);
    b.querySelector("span").textContent = on ? "Salva" : "Salvar";
  }

  // ---------- Rotas ----------
  function rota() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [secao, ...resto] = h.split("/");
    const valor = resto.join("/");
    const linkSalvas = document.querySelector('[data-nav="favoritas"]');
    const linkInicio = document.querySelector('[data-nav="inicio"]');
    // Pontos: "#/pontos" abre o Xirê e "#/pontos/outras-linhas" as Outras linhas
    const OUTRAS = ["outras-linhas", "segunda-linha"];
    const ehPontos = secao === "pontos" || secao === "xire" || OUTRAS.includes(secao);
    const linksPontos = document.querySelectorAll('[data-nav="pontos"]');
    const vistaPontos = $("#vista-pontos");
    const pontos = window.PontosApp;

    if (ehPontos) {
      const segunda = OUTRAS.includes(secao) || OUTRAS.includes(valor);
      const aba = segunda ? "segunda" : "xire", nomeAba = segunda ? "Outras linhas" : "Xirê";
      if (!el.vistaLista.hidden) estado.rolagemLista = scrollY;
      el.vistaLista.hidden = true; el.vistaPalestra.hidden = true; vistaPontos.hidden = false;
      linkSalvas.removeAttribute("aria-current"); linkInicio.removeAttribute("aria-current");
      linksPontos.forEach((a) => a.setAttribute("aria-current", "page"));
      palestraAtual = null;
      document.title = `Pontos · ${nomeAba} | ${CFG.nomeCasa || "Templo"}`;
      if (pontos) pontos.mostrar(aba);
      scrollTo(0, 0);
      return;
    }
    vistaPontos.hidden = true;
    linksPontos.forEach((a) => a.removeAttribute("aria-current"));
    if (pontos) pontos.esconder();

    if (secao === "palestra" && valor) {
      if (!el.vistaLista.hidden) estado.rolagemLista = scrollY;
      el.vistaLista.hidden = true; el.vistaPalestra.hidden = false;
      linkSalvas.removeAttribute("aria-current"); linkInicio.removeAttribute("aria-current");
      abrirPalestra(valor);
      scrollTo(0, 0);
      return;
    }
    document.title = CFG.nomeAcervo || "Acervo de Palestras";
    const vindoDeLeitura = el.vistaLista.hidden;
    el.vistaPalestra.hidden = true; el.vistaLista.hidden = false;
    palestraAtual = null;

    estado.soSalvas = secao === "favoritas";
    if (estado.soSalvas) { linkSalvas.setAttribute("aria-current", "page"); linkInicio.removeAttribute("aria-current"); }
    else { linkSalvas.removeAttribute("aria-current"); linkInicio.setAttribute("aria-current", "page"); }
    $("#olho-texto").textContent = estado.soSalvas ? "Suas palestras salvas" : "Palestras";
    if (secao === "tema") { estado.tema = valor; marcarTema(); }

    estado.mostrando = POR_PAGINA;
    renderLista();
    if (vindoDeLeitura && secao !== "tema") scrollTo(0, estado.rolagemLista);
    else if (secao === "tema" || secao === "favoritas") $("#acervo").scrollIntoView({ block: "start" });
  }

  function marcarAno() {
    el.anos.querySelectorAll(".ano").forEach((b) => b.setAttribute("aria-pressed", b.dataset.ano === estado.ano));
  }

  function marcarTema() {
    el.temas.querySelectorAll(".tema").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tema === estado.tema));
  }

  // ---------- Eventos ----------
  function ligarEventos() {
    let t;
    el.busca.addEventListener("input", () => {
      clearTimeout(t);
      el.limpar.hidden = !el.busca.value;
      t = setTimeout(() => { estado.termo = el.busca.value; estado.mostrando = POR_PAGINA; renderLista(); }, 140);
    });
    el.limpar.addEventListener("click", () => {
      el.busca.value = ""; estado.termo = ""; el.limpar.hidden = true; renderLista(); el.busca.focus();
    });
    el.completa.addEventListener("change", () => {
      if (el.completa.checked && !estado.textos) {
        el.resultado.textContent = "Carregando os textos completos…";
        carregarTextos().then(renderLista);
      } else renderLista();
    });
    el.temas.addEventListener("click", (e) => {
      const b = e.target.closest(".tema"); if (!b) return;
      estado.tema = b.dataset.tema; estado.mostrando = POR_PAGINA; marcarTema(); renderLista();
    });
    el.anos.addEventListener("click", (e) => {
      const b = e.target.closest(".ano"); if (!b) return;
      estado.ano = b.dataset.ano; estado.mostrando = POR_PAGINA; marcarAno(); renderLista();
    });
    $("#form-busca").addEventListener("submit", (e) => {
      e.preventDefault();
      estado.termo = el.busca.value; estado.mostrando = POR_PAGINA; renderLista();
      $("#acervo").scrollIntoView({ block: "start" });
    });
    el.ordem.addEventListener("change", () => { estado.ordem = el.ordem.value; renderLista(); });
    el.mais.addEventListener("click", () => { estado.mostrando += POR_PAGINA; renderLista(); });
    $("#limpar-tudo").addEventListener("click", () => {
      Object.assign(estado, { termo: "", tema: "", ano: "", mostrando: POR_PAGINA });
      el.busca.value = ""; el.limpar.hidden = true;
      marcarTema(); marcarAno();
      if (estado.soSalvas) location.hash = "#/"; else renderLista();
    });

    // Abas (com setas do teclado)
    const abas = ["resumo", "topicos", "texto", "pdf"];
    abas.forEach((a) => $("#aba-" + a).addEventListener("click", () => trocarAba(a)));
    document.querySelector(".abas").addEventListener("keydown", (e) => {
      const i = abas.indexOf(estado.aba);
      if (e.key === "ArrowRight") trocarAba(abas[(i + 1) % 4], true);
      if (e.key === "ArrowLeft") trocarAba(abas[(i + 3) % 4], true);
    });

    $("#p-salvar").addEventListener("click", () => {
      if (!palestraAtual) return;
      const id = palestraAtual.id;
      if (salvas.has(id)) { salvas.delete(id); avisar("Removida das salvas"); }
      else { salvas.add(id); avisar("Palestra salva"); }
      guardar.gravar("acervo:salvas", [...salvas]);
      atualizarBotaoSalvar();
    });

    $("#p-compartilhar").addEventListener("click", async () => {
      if (!palestraAtual) return;
      const dados = { title: palestraAtual.titulo, text: palestraAtual.resumo || palestraAtual.titulo, url: location.href };
      try {
        if (navigator.share) await navigator.share(dados);
        else { await navigator.clipboard.writeText(location.href); avisar("Link copiado"); }
      } catch { /* cancelado */ }
    });

    const aplicarLetra = () => document.documentElement.style.setProperty("--letra-leitura", tamanhoLetra.atual + "rem");
    $("#letra-menor").addEventListener("click", () => { tamanhoLetra.atual = Math.max(.95, tamanhoLetra.atual - .125); aplicarLetra(); guardar.gravar("acervo:letra", tamanhoLetra.atual); });
    $("#letra-maior").addEventListener("click", () => { tamanhoLetra.atual = Math.min(1.8, tamanhoLetra.atual + .125); aplicarLetra(); guardar.gravar("acervo:letra", tamanhoLetra.atual); });
    aplicarLetra();

    // "Voltar" mantém o tema escolhido e a posição na lista
    $("#voltar").addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = estado.soSalvas ? "#/favoritas" : "#/";
    });

    addEventListener("hashchange", rota);
  }

  // ---------- Início ----------
  function aplicarConfig() {
    document.querySelectorAll("[data-config]").forEach((n) => {
      const v = CFG[n.dataset.config]; if (v !== undefined) n.textContent = v;
    });
    const desde = document.getElementById("rodape-desde");
    if (desde && CFG.anoFundacao) desde.textContent = ` Acervo mantido com carinho desde ${CFG.anoFundacao}.`;
    if (CFG.modoExemplo) {
      const a = document.createElement("p");
      a.className = "aviso-exemplo";
      a.textContent = "Você está vendo palestras de exemplo. Coloque os PDFs da casa na pasta “pdfs” e siga o passo a passo do README para substituí-las.";
      $(".corpo").prepend(a);
    }
  }

  // ---------- Atmosfera do topo: chuva fina e brilho que segue o ponteiro ----------
  function atmosfera() {
    const tela = $("#chuva"), brilho = $("#brilho");
    const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (brilho && !calmo) {
      addEventListener("pointermove", (e) => {
        const x = (e.clientX / innerWidth - .5) * 60, y = (e.clientY / innerHeight - .5) * 40;
        brilho.style.transform = `translate(${x}px, ${y}px)`;
      }, { passive: true });
    }
    if (!tela || !tela.getContext) return;
    const ctx = tela.getContext("2d");
    let gotas = [], w = 0, h = 0, cores = [];
    const lerCores = () => { const cs = getComputedStyle(document.documentElement); cores = ["--chuva-1", "--chuva-2", "--chuva-3"].map((v) => cs.getPropertyValue(v).trim()); };
    const medir = () => {
      const r = tela.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height; tela.width = w * dpr; tela.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, w / 22));
      gotas = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, c: 8 + Math.random() * 16, v: .25 + Math.random() * .6, k: Math.random() < .55 ? 0 : Math.random() < .6 ? 1 : 2, a: .35 + Math.random() * .6 }));
    };
    const desenhar = () => {
      ctx.clearRect(0, 0, w, h);
      for (const g of gotas) {
        ctx.globalAlpha = g.a * Math.min(1, (h - g.y) / (h * .45));
        ctx.strokeStyle = cores[g.k]; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y + g.c); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const passo = () => {
      if (!el.vistaLista.hidden) {
        for (const g of gotas) { g.y += g.v; if (g.y > h) { g.y = -g.c; g.x = Math.random() * w; } }
        desenhar();
      }
      requestAnimationFrame(passo);
    };
    lerCores(); medir(); desenhar();
    addEventListener("resize", () => { medir(); desenhar(); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { lerCores(); desenhar(); });
    if (!calmo) requestAnimationFrame(passo);
  }

  async function iniciar() {
    aplicarConfig();
    ligarEventos();
    atmosfera();
    try {
      await carregarDados();
    } catch (e) {
      el.lista.innerHTML = `<li class="vazio"><h2>Não foi possível carregar o acervo</h2><p>${escapar(e.message)}. Se você abriu o arquivo direto do computador, use um servidor local (veja o README).</p></li>`;
      return;
    }
    montarFiltros();
    rota();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  iniciar();
})();
