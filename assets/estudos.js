/* ============================================================
   Estudos: questionário por palestra, simulado a cada 5 e progresso
   - Aba "Questionário" em cada palestra (5 perguntas).
   - A cada 5 palestras respondidas: simulado (10 perguntas, 7 para passar).
     Enquanto ele estiver pendente, não dá para responder palestra nova
     (ler e ouvir continua liberado). As regras e o gabarito ficam no banco.
   - "Meus estudos" (#/estudos): progresso de quem estuda, "continuar de onde parei"
     e o caderno de revisão (#/revisao): perguntas erradas voltam em 1, 3, 7 e 15 dias.
   - Palestras salvas e posição da leitura ficam na nuvem (mesmo membro, qualquer aparelho).
   - "Estudos dos membros" (#/estudos-admin): progresso de todos (administração).
   - "Relatório" (#/relatorio): perguntas que mais gente erra, quem parou, estudos por mês.
   Só funciona com o acesso restrito ligado (precisa saber quem é a pessoa).
   ============================================================ */
(() => {
  "use strict";
  const A = window.ACESSO;
  if (!A || !A.ligado) return;

  const sb = () => A.sb;
  const raiz = document.documentElement;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const palestra = (id) => (window.ACERVO_PALESTRAS && window.ACERVO_PALESTRAS.get(id)) || null;
  const tituloDe = (id) => { const p = palestra(id); return p ? p.titulo : "Palestra"; };
  const numeroDe = (id) => { const p = palestra(id); return p && p.semana ? `Nº ${p.semana}` : ""; };
  const LETRAS = ["A", "B", "C", "D", "E"];
  const GIRAS = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", "sabado-10h": "Sábado · 10h30", "sabado-16h": "Sábado · 16h", "sabado-20h30": "Sábado · 20h30" };
  const data = (t) => (t ? new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
  const dia = (d) => (d ? String(d).slice(0, 10).split("-").reverse().slice(0, 2).join("/") : "—");
  const quando = (t) => {
    if (!t) return "nunca";
    const d = Math.floor((Date.now() - new Date(t)) / 864e5);
    return d <= 0 ? "hoje" : d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : data(t);
  };
  const msgErro = (e) => (e && e.message && !/fetch|network/i.test(e.message) ? e.message : "Não deu certo agora. Confira a internet e tente de novo.");
  async function rpc(nome, args) { const { data: d, error } = await sb().rpc(nome, args || {}); if (error) throw error; return d; }
  const pontinhos = (n) => `<span class="eq-lote" aria-label="${n} de 5 palestras">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;

  /* ---------- formulário de perguntas (questionário e simulado) ---------- */
  function formulario(perguntas, opcoes = {}) {
    return `<form class="eq-form" novalidate>
      <ol class="eq-lista">${perguntas.map((q, i) => `
        <li class="eq-q" data-id="${q.id}">
          ${opcoes.comPalestra ? `<p class="eq-q__de">${esc(numeroDe(q.palestra_id))} · ${esc(tituloDe(q.palestra_id))}</p>` : ""}
          <p class="eq-q__enun"><span class="eq-q__n">${i + 1}</span>${esc(q.enunciado)}</p>
          <div class="eq-ops" role="radiogroup" aria-label="Pergunta ${i + 1}">${(q.opcoes || []).map((o, k) => `
            <label class="eq-op"><input type="radio" name="q${q.id}" value="${k}"><span class="eq-op__letra">${LETRAS[k]}</span><span class="eq-op__txt">${esc(o)}</span></label>`).join("")}
          </div>
          <p class="eq-q__exp" hidden></p>
        </li>`).join("")}
      </ol>
      <div class="eq-enviar">
        <button type="submit" class="eq-botao" disabled>${esc(opcoes.botao || "Enviar respostas")}</button>
        <p class="eq-falta">Responda todas as ${perguntas.length} perguntas.</p>
      </div>
    </form>`;
  }
  function ligarFormulario(caixa, aoEnviar) {
    const f = caixa.querySelector(".eq-form"), btn = f.querySelector(".eq-botao"), falta = f.querySelector(".eq-falta");
    const total = f.querySelectorAll(".eq-q").length;
    f.addEventListener("change", () => {
      const feitas = f.querySelectorAll(".eq-q input:checked").length;
      btn.disabled = feitas < total;
      falta.textContent = feitas < total ? `Faltam ${total - feitas} de ${total} perguntas.` : "Tudo respondido. Pode enviar.";
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (btn.disabled) return;
      const respostas = [...f.querySelectorAll(".eq-q")].map((li) => ({ id: +li.dataset.id, escolha: +(li.querySelector("input:checked") || {}).value }));
      btn.disabled = true; btn.textContent = "Corrigindo…";
      try { await aoEnviar(respostas, f); }
      catch (err) { btn.disabled = false; btn.textContent = "Enviar respostas"; falta.textContent = msgErro(err); falta.classList.add("eq-falta--erro"); }
    });
  }
  // mostra certo/errado e a explicação de cada pergunta
  function corrigir(f, correcao) {
    const por = new Map((correcao || []).map((c) => [String(c.id), c]));
    f.querySelectorAll(".eq-q").forEach((li) => {
      const c = por.get(li.dataset.id); if (!c) return;
      li.classList.add(c.escolha === c.correta ? "eq-q--certa" : "eq-q--errada");
      li.querySelectorAll(".eq-op").forEach((op, k) => {
        op.querySelector("input").disabled = true;
        if (k === c.correta) op.classList.add("eq-op--certa");
        else if (k === c.escolha) op.classList.add("eq-op--errada");
      });
      const ex = li.querySelector(".eq-q__exp");
      if (c.explicacao) { ex.innerHTML = `<b>${c.escolha === c.correta ? "Certo!" : "Resposta certa: " + LETRAS[c.correta] + "."}</b> ${esc(c.explicacao)}`; ex.hidden = false; }
    });
    f.querySelector(".eq-enviar").remove();
  }

  function avisoSituacao(sit) {
    if (!sit) return "";
    if (sit.bloqueado) return `<div class="eq-aviso eq-aviso--simulado">
        <b>Você completou 5 palestras. Hora do simulado! 🎯</b>
        <p>São 10 perguntas sobre as últimas 5 palestras estudadas. Para passar, acerte 7. Até lá, dá para ler e ouvir à vontade, mas não responder palestra nova.</p>
        <a class="eq-botao" href="#/simulado">Fazer o simulado</a></div>`;
    const falta = 5 - (sit.no_lote || 0);
    return `<div class="eq-aviso">${pontinhos(sit.no_lote || 0)}<p>${falta === 5 ? "A cada 5 palestras estudadas, você faz um simulado de revisão." : `Faltam <b>${falta}</b> ${falta === 1 ? "palestra" : "palestras"} para o próximo simulado.`} <a href="#/estudos">Ver meus estudos</a></p></div>`;
  }

  function avisoRevisao(sit) {
    if (!sit) return "";
    if (sit.revisao_hoje > 0) return `<div class="eq-aviso eq-aviso--simulado">
        <b>Revisão do dia: ${sit.revisao_hoje} ${sit.revisao_hoje === 1 ? "pergunta" : "perguntas"} 🔁</b>
        <p>São perguntas que você errou antes. Acertando, elas voltam em 3, 7 e 15 dias, até ficarem aprendidas.</p>
        <a class="eq-botao" href="#/revisao">Fazer a revisão</a></div>`;
    if (sit.revisao_total > 0) return `<div class="eq-aviso"><p>Seu caderno de revisão tem <b>${sit.revisao_total}</b> ${sit.revisao_total === 1 ? "pergunta" : "perguntas"}${sit.proxima_revisao ? `. A próxima revisão é dia <b>${dia(sit.proxima_revisao)}</b>` : ""}.${sit.aprendidas ? ` Já aprendidas: <b>${sit.aprendidas}</b>.` : ""}</p></div>`;
    return "";
  }
  const notaRevisao = (n) => (n > 0 ? ` ${n === 1 ? "A que você errou entra" : `As ${n} que você errou entram`} no seu <a href="#/revisao">caderno de revisão</a> e ${n === 1 ? "volta" : "voltam"} amanhã.` : "");

  /* ---------- aba "Questionário" de uma palestra ---------- */
  async function questionario(p, painel, refazer) {
    if (!p) return;
    painel.dataset.id = p.id;
    painel.innerHTML = `<p class="eq-carregando">Carregando o questionário…</p>`;
    try {
      const uid = A.perfil && A.perfil.id;
      const [sit, perguntas, meu] = await Promise.all([
        rpc("situacao_estudos"),
        rpc("perguntas_da_palestra", { p_palestra: p.id }),
        sb().from("estudos").select("*").eq("membro", uid).eq("palestra_id", p.id).maybeSingle().then((r) => r.data),
      ]);
      if (painel.dataset.id !== p.id) return;
      if (!perguntas || !perguntas.length) { painel.innerHTML = `<div class="eq-vazio"><b>Questionário em preparação</b><p>As perguntas desta palestra ainda vão ser adicionadas. Enquanto isso, aproveite a leitura.</p></div>`; return; }
      if (sit.bloqueado && !meu) {
        painel.innerHTML = `<div class="eq-aviso eq-aviso--simulado">
          <b>Antes de seguir, faça o simulado 🎯</b>
          <p>Você já estudou 5 palestras. O questionário desta palestra libera depois do simulado de revisão:</p>
          <ol class="eq-lote-lista">${(sit.lote || []).map((id) => `<li><a href="#/palestra/${encodeURIComponent(id)}">${esc(tituloDe(id))}</a></li>`).join("")}</ol>
          <a class="eq-botao" href="#/simulado">Fazer o simulado</a></div>`;
        return;
      }
      if (meu && !refazer) {
        painel.innerHTML = `<div class="eq-feito">
            <span class="eq-nota${meu.acertos === meu.total ? " eq-nota--cheia" : ""}">${meu.acertos}<small>/${meu.total}</small></span>
            <div><b>Você já estudou esta palestra</b><p>Última vez ${quando(meu.respondido_em)} · melhor resultado ${meu.melhor} de ${meu.total}${meu.tentativas > 1 ? ` · ${meu.tentativas} tentativas` : ""}</p></div>
          </div>
          <button type="button" class="eq-botao eq-botao--claro" data-eq="refazer">Refazer o questionário</button>
          ${avisoSituacao(sit)}`;
        painel.querySelector('[data-eq="refazer"]').onclick = () => questionario(p, painel, true);
        return;
      }
      painel.innerHTML = `<div class="eq-intro"><b>Questionário</b><p>${perguntas.length} perguntas sobre esta palestra. Se precisar, releia o resumo ou o texto completo antes.</p></div>${formulario(perguntas)}`;
      ligarFormulario(painel, async (respostas, f) => {
        const r = await rpc("responder_questionario", { p_palestra: p.id, respostas });
        corrigir(f, r.correcao);
        const res = document.createElement("div");
        res.innerHTML = `<div class="eq-resultado${r.acertos === r.total ? " eq-resultado--cheio" : ""}"><span class="eq-nota">${r.acertos}<small>/${r.total}</small></span><div><b>${r.acertos === r.total ? "Perfeito! Você acertou tudo." : r.acertos >= Math.ceil(r.total * 0.6) ? "Muito bem!" : "Vale reler a palestra."}</b><p>Veja abaixo a explicação de cada resposta.${notaRevisao(r.para_revisao)}</p></div></div>${avisoSituacao(r.situacao)}`;
        painel.prepend(res);
        painel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      painel.innerHTML = `<div class="eq-vazio"><b>Não deu para carregar</b><p>${esc(msgErro(e))}</p><button type="button" class="eq-botao eq-botao--claro" data-eq="tentar">Tentar de novo</button></div>`;
      painel.querySelector('[data-eq="tentar"]').onclick = () => questionario(p, painel, refazer);
    }
  }

  /* ---------- páginas: Meus estudos, Simulado, Estudos dos membros ---------- */
  const pagina = document.createElement("section");
  pagina.id = "eq-pagina"; pagina.className = "eq-pagina"; pagina.hidden = true;
  document.body.appendChild(pagina);
  const moldura = (rotulo, titulo, html, voltar = "#/") => `<div class="eq-inner">
    <header class="eq-topo"><div><p class="eq-rotulo">${rotulo}</p><h1 class="eq-titulo">${titulo}</h1></div>
      <a class="eq-fechar" href="${voltar}" aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a></header>
    ${html}</div>`;
  const carregando = (rotulo, titulo) => moldura(rotulo, titulo, `<p class="eq-carregando">Carregando…</p>`);
  function mostrarPagina(navAtivo) {
    pagina.hidden = false; raiz.classList.add("com-estudos"); scrollTo(0, 0);
    setTimeout(() => {
      document.querySelectorAll(".nav__link[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
      document.querySelector(navAtivo)?.setAttribute("aria-current", "page");
    }, 0);
  }
  function esconderPagina() { if (pagina.hidden) return; pagina.hidden = true; pagina.innerHTML = ""; raiz.classList.remove("com-estudos"); }

  async function meusEstudos() {
    mostrarPagina('[data-nav="estudos"]');
    pagina.innerHTML = carregando("Seu caminho", "Meus <em>estudos</em>");
    try {
      const uid = A.perfil.id;
      const [sit, comQuest, est, sims, prog] = await Promise.all([
        rpc("situacao_estudos"), rpc("palestras_com_questionario"),
        sb().from("estudos").select("*").eq("membro", uid).order("respondido_em", { ascending: false }).then((r) => r.data || []),
        sb().from("simulados").select("*").eq("membro", uid).not("respondido_em", "is", null).order("id", { ascending: false }).then((r) => r.data || []),
        rpc("meu_progresso").catch(() => progresso),
      ]);
      progresso = prog || progresso;
      const meio = (progresso.leituras || []).filter((l) => !l.lida && l.posicao >= 0.02 && palestra(l.id)).slice(0, 3);
      const feitas = new Set(est.map((e) => e.palestra_id));
      const ordem = (ids) => ids.map((id) => palestra(id)).filter(Boolean).sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.semana || 0) - (a.semana || 0));
      const proximas = ordem((comQuest || []).filter((id) => !feitas.has(id)));
      const media = est.length ? Math.round((100 * est.reduce((s, e) => s + e.melhor, 0)) / est.reduce((s, e) => s + e.total, 0)) : 0;
      const item = (p, direita) => `<li><a class="eq-item" href="#/palestra/${encodeURIComponent(p.id)}" data-eq-quest="${esc(p.id)}"><span class="eq-item__txt"><small>${esc(p.semana ? "Nº " + p.semana + " · " : "")}${esc((p.data || "").slice(0, 4))}</small><b>${esc(p.titulo)}</b></span>${direita}</a></li>`;
      pagina.innerHTML = moldura("Seu caminho", "Meus <em>estudos</em>", `
        <div class="eq-numeros">
          <div><b>${est.length}</b><span>palestras estudadas</span></div>
          <div><b>${media}%</b><span>de acertos</span></div>
          <div><b>${sit.aprovados}</b><span>simulados aprovados</span></div>
        </div>
        ${meio.length ? `<h2 class="eq-sub">Continuar de onde parei</h2>
          <ul class="eq-itens">${meio.map((l) => { const p = palestra(l.id); return `<li><a class="eq-item" href="#/palestra/${encodeURIComponent(p.id)}" data-eq-retomar="${esc(p.id)}" data-pos="${l.posicao}"><span class="eq-item__txt"><small>${esc(p.semana ? "Nº " + p.semana + " · " : "")}leitura ${quando(l.em)}</small><b>${esc(p.titulo)}</b></span><span class="eq-pill">${Math.round(l.posicao * 100)}%</span></a></li>`; }).join("")}</ul>` : ""}
        ${avisoRevisao(sit)}
        ${avisoSituacao(sit)}
        <h2 class="eq-sub">Continue estudando <span>${proximas.length}</span></h2>
        ${proximas.length ? `<ul class="eq-itens">${proximas.slice(0, 6).map((p) => item(p, `<span class="eq-seta">›</span>`)).join("")}</ul>
          ${proximas.length > 6 ? `<details class="eq-mais"><summary>Ver mais ${proximas.length - 6}</summary><ul class="eq-itens">${proximas.slice(6).map((p) => item(p, `<span class="eq-seta">›</span>`)).join("")}</ul></details>` : ""}`
          : `<p class="eq-vazio-txt">${(comQuest || []).length ? "Você já respondeu todos os questionários disponíveis. 🎉" : "Os questionários ainda estão sendo preparados."}</p>`}
        <h2 class="eq-sub">Já estudadas <span>${est.length}</span></h2>
        ${sit.lidas ? `<p class="eq-vazio-txt">Você leu o texto completo de <b>${sit.lidas}</b> ${sit.lidas === 1 ? "palestra" : "palestras"} até o fim.</p>` : ""}
        ${est.length ? `<ul class="eq-itens">${est.map((e) => { const p = palestra(e.palestra_id) || { id: e.palestra_id, titulo: "Palestra", data: "" }; return item(p, `<span class="eq-pill${e.melhor === e.total ? " eq-pill--cheia" : ""}">${e.melhor}/${e.total}</span>`); }).join("")}</ul>` : `<p class="eq-vazio-txt">Abra uma palestra e responda o questionário para começar.</p>`}
        ${sims.length ? `<h2 class="eq-sub">Simulados <span>${sims.length}</span></h2>
          <ul class="eq-itens">${sims.map((s) => `<li><div class="eq-item"><span class="eq-item__txt"><small>${data(s.respondido_em)}</small><b>${s.palestras.map((id) => esc(numeroDe(id) || "")).filter(Boolean).join(", ") || "5 palestras"}</b></span><span class="eq-pill ${s.aprovado ? "eq-pill--cheia" : "eq-pill--erro"}">${s.acertos}/${s.total} ${s.aprovado ? "✓" : "✗"}</span></div></li>`).join("")}</ul>` : ""}
      `);
    } catch (e) { pagina.innerHTML = moldura("Seu caminho", "Meus <em>estudos</em>", `<div class="eq-vazio"><b>Não deu para carregar</b><p>${esc(msgErro(e))}</p></div>`); }
  }

  async function simulado() {
    mostrarPagina('[data-nav="estudos"]');
    pagina.innerHTML = carregando("Revisão", "Simulado");
    try {
      const s = await rpc("iniciar_simulado");
      const lista = (s.palestras || []).map((id) => `<li><a href="#/palestra/${encodeURIComponent(id)}">${esc(tituloDe(id))}</a></li>`).join("");
      pagina.innerHTML = moldura("Revisão das últimas 5 palestras", "Simulado", `
        <div class="eq-intro"><b>${(s.perguntas || []).length} perguntas · para passar, acerte ${Math.ceil((s.perguntas || []).length * 0.7)}</b>
          <p>As perguntas são das palestras abaixo. Se não passar, dá para revisar e tentar de novo.</p><ol class="eq-lote-lista">${lista}</ol></div>
        <div id="eq-sim">${formulario(s.perguntas || [], { comPalestra: true, botao: "Entregar o simulado" })}</div>`, "#/estudos");
      const caixa = pagina.querySelector("#eq-sim");
      ligarFormulario(caixa, async (respostas, f) => {
        const r = await rpc("responder_simulado", { p_simulado: s.id, respostas });
        corrigir(f, r.correcao);
        const res = document.createElement("div");
        res.innerHTML = r.aprovado
          ? `<div class="eq-resultado eq-resultado--cheio"><span class="eq-nota">${r.acertos}<small>/${r.total}</small></span><div><b>Aprovado! 🎉</b><p>Pode seguir para as próximas palestras.${notaRevisao(r.para_revisao)}</p></div></div><a class="eq-botao" href="#/estudos">Continuar estudando</a>`
          : `<div class="eq-resultado eq-resultado--baixo"><span class="eq-nota">${r.acertos}<small>/${r.total}</small></span><div><b>Quase! Precisa de ${r.minimo} acertos.</b><p>Releia as palestras, confira as explicações abaixo e tente de novo. O próximo simulado sorteia outras perguntas.${notaRevisao(r.para_revisao)}</p></div></div>
             <button type="button" class="eq-botao" data-eq="de-novo">Tentar de novo</button>`;
        caixa.prepend(res);
        res.querySelector('[data-eq="de-novo"]')?.addEventListener("click", simulado);
        pagina.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      const nada = /Ainda não há simulado pendente/i.test(e.message || "");
      pagina.innerHTML = moldura("Revisão", "Simulado", `<div class="eq-vazio"><b>${nada ? "Nenhum simulado pendente" : "Não deu para abrir o simulado"}</b><p>${nada ? "O simulado aparece quando você completar 5 palestras estudadas." : esc(msgErro(e))}</p><a class="eq-botao eq-botao--claro" href="#/estudos">Ver meus estudos</a></div>`, "#/estudos");
    }
  }

  async function revisao() {
    mostrarPagina('[data-nav="estudos"]');
    const ROT = "Caderno de revisão", TIT = "Revisão do <em>dia</em>";
    pagina.innerHTML = carregando(ROT, TIT);
    try {
      const r = await rpc("revisao_do_dia"), sit = r.situacao || {}, qs = r.perguntas || [];
      if (!qs.length) {
        pagina.innerHTML = moldura(ROT, TIT, `<div class="eq-vazio"><b>Nada para revisar hoje ✨</b>
          <p>${sit.revisao_total ? `Seu caderno tem ${sit.revisao_total} ${sit.revisao_total === 1 ? "pergunta" : "perguntas"}.${sit.proxima_revisao ? ` A próxima revisão é dia ${dia(sit.proxima_revisao)}.` : ""}` : "Quando você errar uma pergunta, ela entra aqui para você revisar nos dias seguintes."}${sit.aprendidas ? ` Já aprendidas: ${sit.aprendidas}.` : ""}</p>
          <a class="eq-botao eq-botao--claro" href="#/estudos">Ver meus estudos</a></div>`, "#/estudos");
        return;
      }
      pagina.innerHTML = moldura(ROT, TIT, `
        <div class="eq-intro"><b>${qs.length} ${qs.length === 1 ? "pergunta" : "perguntas"} para revisar${sit.revisao_hoje > qs.length ? ` (de ${sit.revisao_hoje} de hoje)` : ""}</b>
          <p>São perguntas que você errou antes. Acertou: ela volta em alguns dias (3, 7 e 15) até ficar aprendida. Errou: volta amanhã.</p></div>
        <div id="eq-rev">${formulario(qs, { comPalestra: true, botao: "Conferir" })}</div>`, "#/estudos");
      const caixa = pagina.querySelector("#eq-rev");
      ligarFormulario(caixa, async (respostas, f) => {
        const x = await rpc("responder_revisao", { respostas });
        corrigir(f, x.correcao);
        const resta = (x.situacao || {}).revisao_hoje || 0, aprendidas = (x.correcao || []).filter((c) => c.acertou && c.nivel >= 3).length;
        const res = document.createElement("div");
        res.innerHTML = `<div class="eq-resultado${x.acertos === x.total ? " eq-resultado--cheio" : ""}"><span class="eq-nota">${x.acertos}<small>/${x.total}</small></span>
            <div><b>${x.acertos === x.total ? "Tudo certo na revisão!" : "Revisão feita."}</b><p>${aprendidas ? `${aprendidas === 1 ? "Uma pergunta ficou aprendida" : `${aprendidas} perguntas ficaram aprendidas`} e saiu do caderno. ` : ""}${x.total - x.acertos ? "As que você errou voltam amanhã." : "As que você acertou voltam daqui a alguns dias."}</p></div></div>
          ${resta ? `<button type="button" class="eq-botao" data-eq="mais">Revisar mais ${resta}</button>` : `<a class="eq-botao" href="#/estudos">Continuar estudando</a>`}`;
        caixa.prepend(res);
        res.querySelector('[data-eq="mais"]')?.addEventListener("click", revisao);
        pagina.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      pagina.innerHTML = moldura(ROT, TIT, `<div class="eq-vazio"><b>Não deu para abrir a revisão</b><p>${esc(msgErro(e))}</p><a class="eq-botao eq-botao--claro" href="#/estudos">Ver meus estudos</a></div>`, "#/estudos");
    }
  }

  /* ---------- progresso na nuvem: palestras salvas e leitura ---------- */
  const DONO = "acervo:salvas-dono", FILA = "acervo:salvas-fila";
  const lerLS = (k, p) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : p; } catch (e) { return p; } };
  const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
  let progresso = { salvas: [], leituras: [] };
  async function sincronizar() {
    const S = window.ACERVO_SALVAS, uid = A.perfil && A.perfil.id; if (!uid) return;
    try {
      // primeiro manda o que ficou pendente sem internet
      const fila = lerLS(FILA, {});
      for (const [id, on] of Object.entries(fila)) await rpc("definir_salva", { p_palestra: id, p_salva: on });
      gravarLS(FILA, {});
      progresso = await rpc("meu_progresso");
      if (!S) return;
      const nuvem = progresso.salvas || [];
      // só na primeira vez neste aparelho: leva para a nuvem as salvas que estavam no celular
      const dono = lerLS(DONO, null), novas = dono === null ? S.lista().filter((id) => !nuvem.includes(id)) : [];
      if (novas.length) await rpc("importar_salvas", { p_ids: novas });
      gravarLS(DONO, uid);
      S.trocar([...nuvem, ...novas]);
    } catch (e) { /* sem internet: fica com as do celular e tenta de novo na próxima vez */ }
  }
  addEventListener("salva-mudou", async (e) => {
    const { id, salva } = e.detail || {}; if (!id || !liberado) return;
    try { await rpc("definir_salva", { p_palestra: id, p_salva: salva }); }
    catch (x) { const f = lerLS(FILA, {}); f[id] = salva; gravarLS(FILA, f); }
  });

  // posição da leitura no texto completo: 0 = começo, 1 = fim
  const painelTexto = () => document.getElementById("painel-texto");
  function posicaoLeitura() {
    const pt = painelTexto(), vista = document.getElementById("vista-palestra");
    if (!pt || pt.hidden || !pt.dataset.id || (vista && vista.hidden)) return null;
    const r = pt.getBoundingClientRect(); if (r.height < 80) return null;
    return { id: pt.dataset.id, pos: Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / r.height)) };
  }
  let leitura = null, enviadaEm = 0, enviada = null;
  async function enviarLeitura(forcar) {
    const l = leitura; if (!l || !liberado) return;
    if (enviada && enviada.id === l.id && Math.abs(enviada.pos - l.pos) < 0.02) return;
    if (!forcar && Date.now() - enviadaEm < 15000) return;
    enviadaEm = Date.now(); enviada = { ...l };
    const lista = (progresso.leituras || []).filter((x) => x.id !== l.id), antes = (progresso.leituras || []).find((x) => x.id === l.id);
    progresso.leituras = [{ id: l.id, posicao: l.pos, lida: (antes && antes.lida) || l.pos >= 0.9, em: new Date().toISOString() }, ...lista];
    try { await rpc("marcar_leitura", { p_palestra: l.id, p_posicao: l.pos }); } catch (e) { enviada = null; }
  }
  let rolando = null;
  addEventListener("scroll", () => {
    if (rolando) return;
    rolando = setTimeout(() => { rolando = null; const p = posicaoLeitura(); if (p) { leitura = p; enviarLeitura(false); } }, 400);
  }, { passive: true });
  const sairDaLeitura = () => { enviarLeitura(true); };
  addEventListener("hashchange", sairDaLeitura);
  addEventListener("pagehide", sairDaLeitura);
  document.addEventListener("visibilitychange", () => { if (document.hidden) sairDaLeitura(); });
  // "Continuar de onde parei": abre o texto completo e rola até onde a pessoa parou
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-eq-retomar]");
    if (a) sessionStorage.setItem("eq:retomar", JSON.stringify({ id: a.dataset.eqRetomar, pos: +a.dataset.pos || 0 }));
  });
  addEventListener("texto-pronto", (e) => {
    let r = null; try { r = JSON.parse(sessionStorage.getItem("eq:retomar")); } catch (x) { /* nada */ }
    if (!r || r.id !== (e.detail || {}).id) return;
    sessionStorage.removeItem("eq:retomar");
    requestAnimationFrame(() => {
      const pt = painelTexto(); if (!pt) return;
      const topo = pt.getBoundingClientRect().top + scrollY;
      scrollTo({ top: Math.max(0, topo + r.pos * pt.offsetHeight - innerHeight * 0.85), behavior: "smooth" });
    });
  });

  const ADM = { busca: "", gira: "", lista: [] };
  async function estudosMembros(detalhe) {
    if (!A.ehAdmin()) { location.hash = "#/"; return; }
    mostrarPagina("#ac-nav");
    if (detalhe) return detalheMembro(detalhe);
    pagina.innerHTML = carregando("Administração", "Estudos dos <em>membros</em>");
    try { ADM.lista = await rpc("progresso_membros"); desenharAdm(); }
    catch (e) { pagina.innerHTML = moldura("Administração", "Estudos dos <em>membros</em>", `<div class="eq-vazio"><b>Não deu para carregar</b><p>${esc(msgErro(e))}</p></div>`, "#/painel"); }
  }
  function desenharAdm() {
    const l = ADM.lista || [], estudando = l.filter((m) => m.respondidas > 0);
    pagina.innerHTML = moldura("Administração", "Estudos dos <em>membros</em>", `
      <div class="eq-numeros">
        <div><b>${estudando.length}</b><span>estudando</span></div>
        <div><b>${l.reduce((s, m) => s + Number(m.respondidas), 0)}</b><span>questionários feitos</span></div>
        <div><b>${l.filter((m) => m.bloqueado).length}</b><span>com simulado pendente</span></div>
      </div>
      <div class="eq-filtros"><input type="search" class="eq-busca" placeholder="Buscar pelo nome" value="${esc(ADM.busca)}" aria-label="Buscar membro">
        <select class="eq-gira" aria-label="Filtrar por gira"><option value="">Todas as giras</option>${Object.entries(GIRAS).map(([k, v]) => `<option value="${k}"${ADM.gira === k ? " selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="eq-barra"><a class="eq-mini" href="#/painel">‹ Voltar ao painel</a><a class="eq-mini" href="#/relatorio">Relatório</a><button type="button" class="eq-mini" data-eq="csv">Baixar planilha</button></div>
      <ul class="eq-membros" id="eq-membros"></ul>`, "#/painel");
    pagina.querySelector(".eq-busca").oninput = (e) => { ADM.busca = e.target.value; listarAdm(); };
    pagina.querySelector(".eq-gira").onchange = (e) => { ADM.gira = e.target.value; listarAdm(); };
    pagina.querySelector('[data-eq="csv"]').onclick = csvAdm;
    listarAdm();
  }
  /* ---------- relatório para a administração ---------- */
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  async function relatorio() {
    if (!A.ehAdmin()) { location.hash = "#/"; return; }
    mostrarPagina("#ac-nav");
    const ROT = "Administração", TIT = "Relatório de <em>estudos</em>";
    pagina.innerHTML = carregando(ROT, TIT);
    try {
      const r = await rpc("relatorio_estudos"), z = r.resumo || {};
      const meses = r.por_mes || [], maior = Math.max(1, ...meses.map((m) => m.questionarios));
      const lista = (itens, vazio) => (itens.length ? `<ul class="eq-itens">${itens.join("")}</ul>` : `<p class="eq-vazio-txt">${vazio}</p>`);
      pagina.innerHTML = moldura(ROT, TIT, `
        <div class="eq-barra"><a class="eq-mini" href="#/estudos-admin">‹ Estudos dos membros</a></div>
        <div class="eq-numeros">
          <div><b>${z.estudando_30d || 0}</b><span>estudaram nos últimos 30 dias</span></div>
          <div><b>${z.parados || 0}</b><span>parados ou sem começar</span></div>
          <div><b>${z.media || 0}%</b><span>de acertos na corrente</span></div>
        </div>
        <div class="eq-numeros">
          <div><b>${z.questionarios || 0}</b><span>questionários feitos</span></div>
          <div><b>${z.simulados_aprovados || 0}/${z.simulados_feitos || 0}</b><span>simulados aprovados</span></div>
          <div><b>${z.aprendidas || 0}</b><span>perguntas aprendidas na revisão</span></div>
        </div>

        <h2 class="eq-sub">Estudos por mês</h2>
        ${lista(meses.slice().reverse().filter((m) => m.questionarios || m.membros || m.simulados).map((m) => { const [a, mm] = m.mes.split("-"); return `<li><div class="eq-item"><span class="eq-item__txt"><small>${m.membros} ${m.membros === 1 ? "membro estudou" : "membros estudaram"} · ${m.simulados} ${m.simulados === 1 ? "simulado aprovado" : "simulados aprovados"}</small><b>${MESES[+mm - 1]} de ${a}</b></span><span class="eq-pill${m.questionarios === maior && maior > 1 ? " eq-pill--cheia" : ""}">${m.questionarios} ${m.questionarios === 1 ? "palestra" : "palestras"}</span></div></li>`; }), "Ainda sem estudos.")}

        <h2 class="eq-sub">Perguntas que mais gente erra <span>${(r.perguntas_dificeis || []).length}</span></h2>
        <p class="eq-vazio-txt">Muita gente errando a mesma pergunta pode ser pergunta confusa ou um ensinamento que vale reforçar na gira.</p>
        ${lista((r.perguntas_dificeis || []).map((q) => `<li><a class="eq-item" href="#/palestra/${encodeURIComponent(q.palestra_id)}"><span class="eq-item__txt"><small>${esc(numeroDe(q.palestra_id))} · ${esc(tituloDe(q.palestra_id))}</small><b>${esc(q.enunciado)}</b></span><span class="eq-pill eq-pill--alerta">${q.membros} ${q.membros === 1 ? "errou" : "erraram"}</span></a></li>`), "Ninguém errou pergunta ainda (ou o caderno de revisão começou agora).")}

        <h2 class="eq-sub">Palestras mais estudadas</h2>
        ${lista((r.palestras_estudadas || []).map((p) => `<li><a class="eq-item" href="#/palestra/${encodeURIComponent(p.palestra_id)}"><span class="eq-item__txt"><small>${esc(numeroDe(p.palestra_id))} · ${p.media}% de acertos</small><b>${esc(tituloDe(p.palestra_id))}</b></span><span class="eq-pill">${p.membros} ${p.membros === 1 ? "membro" : "membros"}</span></a></li>`), "Ainda sem estudos.")}

        <h2 class="eq-sub">Parados há mais de 30 dias <span>${(r.parados || []).length}</span></h2>
        ${lista((r.parados || []).map((m) => `<li><a class="eq-membro" href="#/estudos-admin/${m.id}">
            <span class="eq-ini" aria-hidden="true">${esc(((m.nome || "?")[0] + (m.sobrenome || "")[0]).toUpperCase())}</span>
            <span class="eq-membro__txt"><b>${esc(m.nome)} ${esc(m.sobrenome)}</b><small>Gira de ${esc(GIRAS[m.gira] || m.gira)} · ${m.ultimo ? `último estudo ${quando(m.ultimo)} · ${m.respondidas} ${m.respondidas === 1 ? "palestra" : "palestras"}` : "ainda não começou"}</small></span>
            <span class="eq-seta">›</span></a></li>`), "Todo mundo estudou nos últimos 30 dias. 🎉")}`, "#/estudos-admin");
    } catch (e) { pagina.innerHTML = moldura(ROT, TIT, `<div class="eq-vazio"><b>Não deu para carregar</b><p>${esc(msgErro(e))}</p></div>`, "#/estudos-admin"); }
  }

  function listarAdm() {
    const t = ADM.busca.trim().toLowerCase();
    const vs = (ADM.lista || []).filter((m) => (!ADM.gira || m.gira === ADM.gira) && (!t || `${m.nome} ${m.sobrenome}`.toLowerCase().includes(t)));
    const ul = pagina.querySelector("#eq-membros"); if (!ul) return;
    ul.innerHTML = vs.length ? vs.map((m) => `<li><a class="eq-membro" href="#/estudos-admin/${m.id}">
        <span class="eq-ini" aria-hidden="true">${esc(((m.nome || "?")[0] + (m.sobrenome || "")[0]).toUpperCase())}</span>
        <span class="eq-membro__txt"><b>${esc(m.nome)} ${esc(m.sobrenome)}</b><small>Gira de ${esc(GIRAS[m.gira] || m.gira)} · último estudo ${quando(m.ultimo_estudo)}</small>
          <span class="eq-membro__nums"><span><b>${m.respondidas}</b> palestras</span><span><b>${m.media}%</b> acertos</span><span><b>${m.simulados_aprovados}</b>/${m.simulados_feitos} simulados</span></span>
          ${m.bloqueado ? `<span class="eq-pill eq-pill--alerta">Simulado pendente</span>` : ""}</span>
        <span class="eq-seta">›</span></a></li>`).join("") : `<li class="eq-vazio-txt">Ninguém por aqui.</li>`;
  }
  async function detalheMembro(id) {
    const m = (ADM.lista || []).find((x) => x.id === id) || {};
    pagina.innerHTML = carregando("Estudos de", esc(`${m.nome || ""} ${m.sobrenome || ""}`.trim() || "membro"));
    try {
      if (!ADM.lista.length) ADM.lista = await rpc("progresso_membros");
      const mm = ADM.lista.find((x) => x.id === id) || m;
      const [est, sims] = await Promise.all([
        sb().from("estudos").select("*").eq("membro", id).order("respondido_em", { ascending: false }).then((r) => r.data || []),
        sb().from("simulados").select("*").eq("membro", id).not("respondido_em", "is", null).order("id", { ascending: false }).then((r) => r.data || []),
      ]);
      pagina.innerHTML = moldura("Estudos de", esc(`${mm.nome || ""} ${mm.sobrenome || ""}`), `
        <div class="eq-numeros">
          <div><b>${mm.respondidas || 0}</b><span>palestras</span></div>
          <div><b>${mm.media || 0}%</b><span>de acertos</span></div>
          <div><b>${mm.simulados_aprovados || 0}/${mm.simulados_feitos || 0}</b><span>simulados</span></div>
        </div>
        <div class="eq-barra"><a class="eq-mini" href="#/estudos-admin">‹ Todos os membros</a></div>
        <h2 class="eq-sub">Palestras estudadas <span>${est.length}</span></h2>
        ${est.length ? `<ul class="eq-itens">${est.map((e) => `<li><div class="eq-item"><span class="eq-item__txt"><small>${data(e.respondido_em)}${e.tentativas > 1 ? ` · ${e.tentativas} tentativas` : ""}</small><b>${esc(tituloDe(e.palestra_id))}</b></span><span class="eq-pill${e.melhor === e.total ? " eq-pill--cheia" : ""}">${e.melhor}/${e.total}</span></div></li>`).join("")}</ul>` : `<p class="eq-vazio-txt">Ainda não respondeu nenhum questionário.</p>`}
        <h2 class="eq-sub">Simulados <span>${sims.length}</span></h2>
        ${sims.length ? `<ul class="eq-itens">${sims.map((s) => `<li><div class="eq-item"><span class="eq-item__txt"><small>${data(s.respondido_em)}</small><b>${s.palestras.map((p) => esc(numeroDe(p))).filter(Boolean).join(", ") || "5 palestras"}</b></span><span class="eq-pill ${s.aprovado ? "eq-pill--cheia" : "eq-pill--erro"}">${s.acertos}/${s.total} ${s.aprovado ? "✓" : "✗"}</span></div></li>`).join("")}</ul>` : `<p class="eq-vazio-txt">Nenhum simulado feito.</p>`}`, "#/estudos-admin");
    } catch (e) { pagina.innerHTML = moldura("Estudos de", "membro", `<div class="eq-vazio"><b>Não deu para carregar</b><p>${esc(msgErro(e))}</p></div>`, "#/estudos-admin"); }
  }
  function csvAdm() {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["Nome", "Sobrenome", "Gira", "Palestras estudadas", "Acertos (%)", "Simulados feitos", "Simulados aprovados", "Simulado pendente", "Último estudo"]]
      .concat((ADM.lista || []).map((m) => [m.nome, m.sobrenome, GIRAS[m.gira] || m.gira, m.respondidas, m.media, m.simulados_feitos, m.simulados_aprovados, m.bloqueado ? "sim" : "não", m.ultimo_estudo ? data(m.ultimo_estudo) : ""]));
    const blob = new Blob(["﻿" + linhas.map((l) => l.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `estudos-itaroba-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  /* ---------- rotas e ligações ---------- */
  let liberado = false;
  function rota() {
    if (!liberado) return;
    const h = location.hash.replace(/^#\/?/, "");
    if (h === "estudos") return meusEstudos();
    if (h === "simulado") return simulado();
    if (h === "revisao") return revisao();
    if (h === "relatorio") return relatorio();
    if (h === "estudos-admin" || h.startsWith("estudos-admin/")) return estudosMembros(h.split("/")[1]);
    esconderPagina();
    // veio de "Continue estudando": abre direto a aba do questionário
    const m = h.match(/^palestra\/(.+)$/);
    if (m && (sessionStorage.getItem("eq:retomar") || "").includes(JSON.stringify(decodeURIComponent(m[1])))) {
      setTimeout(() => document.getElementById("aba-texto")?.click(), 60);
    } else if (m && sessionStorage.getItem("eq:abrir") === decodeURIComponent(m[1])) {
      sessionStorage.removeItem("eq:abrir");
      setTimeout(() => document.getElementById("aba-questoes")?.click(), 60);
    }
  }
  addEventListener("hashchange", rota);
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-eq-quest]"); if (a) sessionStorage.setItem("eq:abrir", a.dataset.eqQuest); });
  addEventListener("acesso-liberado", () => {
    liberado = true;
    document.querySelectorAll('[data-nav="estudos"]').forEach((a) => (a.hidden = false));
    const aba = document.getElementById("aba-questoes"); if (aba) aba.hidden = false;
    rota();
    sincronizar();
  });

  window.Estudos = { questionario };
})();
