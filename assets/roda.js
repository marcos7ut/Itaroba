/* Roda do Xirê · interface (roda, ficha, matriz, apostilas e glossário).
   Depende de RodaBusca e RodaDados. O roteador do app (app.js) chama window.RodaApp.mostrar(valor) em #/roda/... */
(function () {
  'use strict';
  var B = window.RodaBusca, norm = B.norm, esc = B.esc;
  var RAIZ = document.getElementById('vista-roda');
  var $ = function (i) { return document.getElementById('rd-' + i); };
  var Q, O, M, D, LN, LV, G, DU, AP = [], CTX;
  var L = ['Posição', 'Caráter', 'Combinação', 'Senhor', 'Quadrante', 'Direção', 'Plano', 'Sentido', 'Atua em', 'Dualidade'];
  var NS = 'http://www.w3.org/2000/svg', svg = $('wheel'), cx = 200, cy = 200, r1 = 52, r2 = 170;
  var S = 0, fv = null, view = 'linhas', qs = '', T = [], PQ = null, ok = [], hl = [], ai = -1, open = false, wg = [], ws = [], tf = null, dopen = false, tb = 'roda', apId = '', comTexto = false, HX = [];
  var hv = matchMedia('(hover:hover)').matches;
  var ABAS = ['roda', 'matriz', 'apostilas', 'glossario'];

  function adaptar(d) {
    var n = d.nucleo;
    Q = n.quadrantes;
    O = n.orixas.map(function (o) { return [o.nome, o.carater, o.combinacao, o.senhor]; });
    M = n.orixas.map(function (o) { return [o.origem, o.significado]; });
    D = n.orixas.map(function (o) { return [o.atuaEm, o.caracteristica, o.deficiencia]; });
    DU = n.orixas.map(function (o) { return o.dualidade; });
    LN = n.linhas.nomes; LV = n.linhas.valores;
    G = {}; n.glossario.forEach(function (g) { G[g.id] = [g.termo, g.texto]; });
    AP = d.apostilas || [];
    CTX = B.contexto(Q, O);
  }

  /* ---------- Dados derivados ---------- */
  function slug(i) { return norm(O[i][0]); }
  function curto(a) { return a.curto || a.titulo; }
  function qual(a, i) { return (a.qualidades || []).filter(function (x) { return x.orixa === i; })[0]; }
  function V(i) {
    var o = O[i], q = Q[i >> 2];
    return [(i + 1) + '°' + ((i + 1) % 4 ? '' : ' ★'), o[1], o[2], o[3], q.n, q.d, q.p, q.s, D[i][0], DU[i] < 0 ? 'A confirmar' : DU[i] === i ? 'Ele mesmo' : O[DU[i]][0]];
  }
  function E(i) {
    var v = V(i), q = Q[i >> 2], ap = [];
    AP.forEach(function (a) { var x = qual(a, i); if (x) { ap.push([curto(a), x.nome]); if (x.dual) ap.push([curto(a) + ' · Oxum', x.dual.nome]); } });
    return [['Orixá', O[i][0]]].concat(L.slice(1).map(function (l, k) { return [l, v[k + 1]]; }),
      LN.map(function (n, k) { return ['Linha de ' + n, LV[i][k]]; }),
      [['Característica', D[i][1]], ['Deficiência', D[i][2]], ['Besta', q.b], ['Átomo', q.a], ['Origem', M[i][0]], ['Significado', M[i][1]]], ap);
  }
  function corpo(i) { /* texto das apostilas, só quando o usuário liga a opção */
    var t = [];
    AP.forEach(function (a) { var x = qual(a, i); if (x) { t.push(x.texto.join(' ')); if (x.dual) t.push(x.dual.texto.join(' ')); if (x.oferenda) t.push(x.oferenda); } });
    return t.join(' | ');
  }
  function hx(i) {
    return HX[i] || (HX[i] = B.words(E(i).filter(function (x) { return x[0] !== 'Dualidade'; }).map(function (x) { return x[1]; }).join(' | ') + (comTexto ? ' | ' + corpo(i) : '')));
  }
  function dual(i) {
    var p = DU[i];
    if (p < 0) return '<span class="mu">A confirmar</span>';
    if (p === i) return i === 2 ? 'Dualiza consigo mesmo: a cobra de duas cabeças, masculino e feminino. O feminino é Bessen.' : 'Dualiza consigo mesmo (Omolu).';
    return '<button type="button" class="lnk" data-go="' + p + '">' + O[p][0] + '</button>';
  }
  function term(k, l) { return '<button type="button" class="term" data-t="' + k + '">' + l + '</button>'; }
  function paras(a) { return (a || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join(''); }
  function est(e) { return 'style="--c:var(--e' + e + ');--co:var(--e' + e + '-on);--cb:var(--e' + e + '-bg);--ct:var(--e' + e + '-tx)"'; }

  /* ---------- Roda ---------- */
  function P(a, r) { var t = a * Math.PI / 180; return [cx - r * Math.sin(t), cy + r * Math.cos(t)]; }
  function f(p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
  function mk(t, at, par) { var e = document.createElementNS(NS, t); for (var k in at) e.setAttribute(k, at[k]); (par || svg).appendChild(e); return e; }
  function arc(a0, a1, ra, rb) { return 'M ' + f(P(a0, rb)) + ' A ' + rb + ' ' + rb + ' 0 0 1 ' + f(P(a1, rb)) + ' L ' + f(P(a1, ra)) + ' A ' + ra + ' ' + ra + ' 0 0 0 ' + f(P(a0, ra)) + ' Z'; }
  function rot(a) { var r = a * Math.PI / 180, d = Math.atan2(Math.cos(r), -Math.sin(r)) * 180 / Math.PI; return d > 90 || d <= -90 ? d + 180 : d; }
  function tx(v, am, r, cls, s, turn) { var p = P(am, r), x = p[0].toFixed(1), y = p[1].toFixed(1), t = mk('text', { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': cls }, v); if (turn) t.setAttribute('transform', 'rotate(' + rot(am).toFixed(1) + ' ' + x + ' ' + y + ')'); t.textContent = s; }
  var xn;
  function desenharRoda() {
    O.forEach(function (o, i) {
      var e = i >> 2, a0 = i * 22.5, a1 = a0 + 22.5, am = a0 + 11.25;
      var g = mk('g', { 'class': 'wg', tabindex: -1, role: 'button', 'aria-pressed': 'false', 'aria-label': o[0] + ', ' + (i + 1) + '° na roda, quadrante ' + Q[e].n, style: '--c:var(--e' + e + ');--co:var(--e' + e + '-on);--cb:var(--e' + e + '-bg);--ct:var(--e' + e + '-tx)' });
      var v = mk('g', { 'class': 'vis' }, g);
      mk('path', { 'class': 'w', d: arc(a0, a1, r1, r2) }, v);
      tx(v, am, 108, 'wn', o[0], 1); tx(v, am, 160, 'wk', String(i + 1));
      if ((i + 1) % 4 === 0) tx(v, am, r1 + 11, 'wk', '★');
      mk('path', { 'class': 'ht', d: arc(a0, a1, r1 - 10, r2 + 14) }, g);
      g.addEventListener('click', function () { pick(i); });
      g.addEventListener('keydown', function (ev) {
        var k = ev.key, n = null;
        if (k === 'Enter' || k === ' ') n = i; else if (k === 'ArrowRight' || k === 'ArrowDown') n = (i + 1) % 16;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') n = (i + 15) % 16; else if (k === 'Home') n = 0; else if (k === 'End') n = 15;
        if (n === null) return; ev.preventDefault(); pick(n); wg[n].focus();
      });
      wg.push(g); ws.push({ g: g, v: v });
    });
    mk('circle', { cx: cx, cy: cy, 'r': r1 - 4, 'class': 'hub' });
    var xr = mk('text', { x: cx, y: cy - 8, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': 'hx' }); xr.textContent = 'Xirê';
    xn = mk('text', { x: cx, y: cy + 13, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': 'hn' });
    [['N', cx, cy - r2 - 22], ['S', cx, cy + r2 + 22], ['L', cx + r2 + 22, cy], ['O', cx - r2 - 22, cy]].forEach(function (c) { var t = mk('text', { x: c[1], y: c[2], 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': 'cp' }); t.textContent = c[0]; });
  }

  /* ---------- Seleção, abas e rotas ---------- */
  function sel(i) {
    S = i;
    ws.forEach(function (x, k) {
      var on = k === i, a = (k * 22.5 + 11.25) * Math.PI / 180, pp = k === DU[i] && k !== i;
      x.g.classList.toggle('on', on); x.g.classList.toggle('pr', pp);
      x.v.style.transform = on ? 'translate(' + (-8 * Math.sin(a)).toFixed(1) + 'px,' + (8 * Math.cos(a)).toFixed(1) + 'px)' : 'none';
      x.g.setAttribute('aria-pressed', on); x.g.setAttribute('tabindex', on ? 0 : -1);
    });
    xn.textContent = (i + 1) + ' / 16';
    [].forEach.call($('lgq').children, function (b, e) { b.setAttribute('aria-pressed', e === (i >> 2)); });
    card(); rows();
    try { localStorage.setItem('itaroba.roda.ultimo', i); } catch (e) { /* sem armazenamento */ }
  }
  function tab(t) {
    tb = t;
    ABAS.forEach(function (k) { var on = k === t; $('p-' + k).hidden = !on; $('t-' + k).setAttribute('aria-selected', on); $('t-' + k).tabIndex = on ? 0 : -1; });
    if (t === 'apostilas') biblioteca(); else if (RAIZ) imgs(RAIZ);
  }
  function go(h) { h = '/roda/' + h; if (location.hash.slice(1) !== h) location.hash = h; }
  function pick(i) { sel(i); tab('roda'); ai = -1; open = false; list(); go(slug(i)); }
  function abrirApostila(id) { apId = id || ''; tab('apostilas'); go(apId ? 'apostilas/' + apId : 'apostilas'); }
  function aplicar(sub) {
    var h = decodeURIComponent(String(sub || '')).replace(/^\//, ''), p = h.split('/');
    if (p[0] === 'matriz' || p[0] === 'glossario') { tab(p[0]); return; }
    if (p[0] === 'apostilas') { apId = p[1] || ''; tab('apostilas'); return; }
    var i = O.findIndex(function (o, k) { return slug(k) === norm(p[0]); });
    if (i > -1 && i !== S) sel(i);
    tab('roda');
  }

  /* ---------- Ficha do orixá ---------- */
  function apostilasCard(i) {
    var h = '';
    AP.forEach(function (a) {
      var x = qual(a, i); if (!x) return;
      h += '<details class="ap"><summary><span class="ap-t">' + esc(curto(a)) + '</span><span class="ap-n">' + esc(x.nome) + '</span></summary><div class="ap-c">'
        + (x.titulo ? '<p class="car">' + esc(x.titulo) + '</p>' : '') + paras(x.texto)
        + (x.oferenda ? '<div class="of"><b>Oferenda</b>' + esc(x.oferenda) + '</div>' : '')
        + (x.dual ? '<h4>Dualidade · ' + esc(x.dual.nome) + '</h4>' + paras(x.dual.texto) : '')
        + '<button type="button" class="lnk" data-ap="' + a.id + '">Ler a apostila completa</button></div></details>';
    });
    return h ? '<section class="sx"><h3>' + term('apostila', 'Nas apostilas') + '</h3>' + h + '</section>' : '';
  }
  function card() {
    var i = S, o = O[i], q = Q[i >> 2], e = i >> 2, m = M[i], st = (i + 1) % 4 === 0, b = i & ~3, pv = (i + 15) % 16, nx = (i + 1) % 16, h;
    h = '<article class="fi" ' + est(e) + '>'
      + '<header class="fh"><p class="kick"><b>' + String(i + 1).padStart(2, '0') + '</b>' + q.n + ' · ' + q.d + (st ? ' · ' + term('luz', '★ Luz do quadrante') : '') + '</p>'
      + '<h2 class="nm">' + esc(o[0]) + '</h2><p class="car">' + esc(o[1]) + '</p></header>'
      + '<dl class="kv"><dt>' + term('senhor', 'Senhor') + '</dt><dd>' + esc(o[3]) + '</dd><dt>' + term('combinacao', 'Combinação') + '</dt><dd>' + esc(o[2]) + '</dd>'
      + '<dt>' + term('dualidade', 'Dualidade') + '</dt><dd>' + dual(i) + '</dd><dt>Atua em</dt><dd>' + esc(D[i][0]) + '</dd></dl>'
      + '<section class="sx"><h3>Característica</h3><p>' + esc(D[i][1]) + '</p></section>'
      + '<section class="sx neg"><h3>Deficiência / negativo</h3><p>' + esc(D[i][2]) + '</p></section>'
      + '<section class="sx"><h3>' + term('linha', 'Linhas') + '</h3><div class="lg">' + LN.map(function (n, k) { return '<div><span>' + esc(n) + '</span>' + esc(LV[i][k]) + '</div>'; }).join('') + '</div></section>'
      + apostilasCard(i)
      + '<details' + (dopen ? ' open' : '') + '><summary>Significado e origem</summary><dl class="kv"><dt>Significado</dt><dd>' + esc(m[1]) + '</dd><dt>Origem do nome</dt><dd>' + esc(m[0]) + '</dd>'
      + '<dt>Plano</dt><dd>' + q.p + '</dd><dt>Sentido</dt><dd>' + q.s + '</dd><dt>Na roda</dt><dd>' + ((i & 3) + 1) + 'ª do quadrante ' + q.n + ', entre ' + O[pv][0] + ' e ' + O[nx][0] + '.' + (st ? ' Acende a vela do quadrante no Xirê.' : '') + '</dd>'
      + '<dt>' + term('besta', 'Besta') + '</dt><dd>' + q.b + '</dd><dt>Átomo</dt><dd>' + q.a + '</dd></dl></details>'
      + '<div class="navs"><div class="xnav"><button type="button" data-go="' + pv + '" aria-label="Anterior: ' + O[pv][0] + '">‹ ' + O[pv][0] + '</button><button type="button" data-go="' + nx + '" aria-label="Próximo: ' + O[nx][0] + '">' + O[nx][0] + ' ›</button></div>'
      + '<div class="xnav" role="group" aria-label="Orixás do quadrante ' + q.n + '">';
    for (var k = b; k < b + 4; k++) h += '<button type="button" class="chip" data-go="' + k + '" aria-pressed="' + (k === i) + '">' + O[k][0] + '</button>';
    $('card').innerHTML = h + '</div></div></article>';
  }

  /* ---------- Figuras e diagramas ---------- */
  function onda(x0, w, cy, amp, ciclos, n) {
    var d = '';
    for (var k = 0; k <= n; k++) { var x = x0 + w * k / n, y = cy - amp * Math.sin(2 * Math.PI * ciclos * k / n); d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    return d;
  }
  var SETA = '<svg class="dg-seta" viewBox="0 0 48 12" aria-hidden="true"><path d="M2 6h42M38 1l6 5-6 5"/></svg>';
  var DG = {
    'espaco': function () {
      return '<figure class="dg dg-esp"><div class="dg-no"><b>Iemanjá</b><span>Fertilidade</span></div><div class="dg-lig"><em>Espaço</em></div><div class="dg-no"><b>Xirê</b><span>dos Orixás</span></div></figure>';
    },
    'composicao-malele': function () {
      return '<figure class="dg dg-comp"><div class="dg-eq"><div class="n"><b>Fertilidade</b><small>Iemanjá</small></div><i>+</i>'
        + '<div class="n"><b>Elegbara</b><small>Libido e potência provocada pelos sonhos, delírios, desejos e intuições</small></div><i>=</i>'
        + '<div class="n fim"><b>Malelê</b><small>Potencial fértil (espiritual, sexual, intelectual)</small></div></div><p class="dg-nasce">Desta composição nasce Malelê</p></figure>';
    },
    'correntes': function (f) {
      return '<figure class="dg dg-cor"><div class="dg-lab l"><span>Corrente vinda do continente</span>' + SETA + '</div>'
        + '<div class="dg-foto"><img data-src="' + esc(f.arquivo) + '" alt="' + esc(f.alt) + '" loading="lazy"><figcaption>' + esc(f.legenda) + '</figcaption></div>'
        + '<div class="dg-lab r"><span>Corrente vinda do próprio mar</span>' + SETA + '</div></figure>';
    },
    'solar-lunar': function () {
      var d = onda(20, 300, 80, 46, 3, 120);
      return '<figure class="dg"><svg class="ch" viewBox="0 0 440 170" role="img" aria-label="Curva com três ciclos: o topo é o período solar e o vale é o período lunar">'
        + '<line class="eixo" x1="20" y1="80" x2="320" y2="80"/><path class="onda" d="' + d + '"/>'
        + '<circle class="sol" cx="53" cy="34" r="9"/><circle class="sol" cx="153" cy="34" r="9"/><circle class="sol" cx="253" cy="34" r="9"/>'
        + '<path class="lua" d="M103 138a10 10 0 1 0 10 -14a8 8 0 0 1 -10 14z"/>'
        + '<text x="336" y="38">PERÍODO SOLAR</text><text x="336" y="132">PERÍODO LUNAR</text></svg>'
        + '<div class="dg-leg"><div><b>Período solar</b>Fomos criados para estarmos sempre bem, nunca em depressão.</div>'
        + '<div><b>Período lunar</b>Fase difícil, dependendo da forma que se relaciona com ela. É um período de reflexão, a fase das elaborações: elabora à noite (sonho) e realiza de dia.</div></div>'
        + '<figcaption>Esta curva é inevitável e imutável naturalmente: deve-se entrar em harmonia com ela, e não lutar contra.</figcaption></figure>';
    },
    'desequilibrio': function () {
      return '<figure class="dg dg-des"><div class="dg-ond">'
        + '<svg viewBox="0 0 140 70" role="img" aria-label="Oscilação rápida demais"><path class="onda" d="' + onda(8, 124, 35, 24, 7, 140) + '"/></svg>'
        + '<svg viewBox="0 0 140 70" role="img" aria-label="Linha reta, sem oscilação"><path class="onda" d="M8 35H132"/></svg></div>'
        + '<svg class="seta" viewBox="0 0 48 12" aria-hidden="true"><path d="M2 6h42M38 1l6 5-6 5"/></svg>'
        + '<div class="dg-box"><b>Desequilíbrio</b>Se a dinâmica estiver ocorrendo de uma dessas duas formas, deve haver intervenção espiritual.</div></figure>';
    }
  };
  function fig(f) {
    if (f.tipo === 'foto') return '<figure class="fg"><img data-src="' + esc(f.arquivo) + '" alt="' + esc(f.alt || f.legenda || '') + '" loading="lazy"><figcaption>' + esc(f.legenda || '') + '</figcaption></figure>';
    if (f.tipo === 'par') return '<div class="fg-par">' + f.fotos.map(fig).join('') + '</div>';
    if (f.tipo === 'diagrama' && DG[f.id]) return DG[f.id](f.foto);
    return '';
  }
  function figs(l) { return (l || []).map(fig).join(''); }
  /* as imagens ficam no acervo privado: o link temporário é pedido só quando a figura entra na tela */
  function imgs(raiz) {
    [].forEach.call(raiz.querySelectorAll('img[data-src]'), function (im) {
      var c = im.getAttribute('data-src'); im.removeAttribute('data-src');
      var A = window.ACERVO_ARQ, p = A ? A.esperar().then(function () { return A.url(c); }) : Promise.resolve(encodeURI(c));
      p.then(function (u) { im.src = u; }).catch(function () { im.alt = (im.alt || '') + ' (imagem indisponível)'; });
    });
  }

  /* ---------- Biblioteca de apostilas ---------- */
  function etiqueta(a) { return (a.tipo === 'linha' ? 'Linha de trabalho' : 'Quadrante') + (a.revisao ? ' · em revisão' : ''); }
  function qualHtml(x, mostrarFig) {
    return (x.titulo ? '<p class="car">' + esc(x.titulo) + '</p>' : '')
      + (x.tambem && norm(x.tambem) !== norm(x.nome) ? '<p class="tambem">Na tabela do Quadrante: ' + esc(x.tambem) + '</p>' : '')
      + (mostrarFig ? figs(x.figuras) : '') + paras(x.texto)
      + (x.oferenda ? '<div class="of"><b>Oferenda</b>' + esc(x.oferenda) + '</div>' : '')
      + (x.dual ? '<h4>Dualidade · ' + esc(x.dual.nome) + '</h4>' + paras(x.dual.texto) : '');
  }
  function biblioteca() {
    var a = AP.filter(function (x) { return x.id === apId; })[0], h;
    if (!a) {
      h = '<p class="mu" style="margin:0">Apostilas do Templo Itarobá ligadas à roda. As qualidades de cada apostila aparecem também na ficha de cada orixá.</p><div class="bib">'
        + AP.map(function (x) {
          var n = x.qualidades ? x.qualidades.length + ' qualidades' : (x.povos ? x.povos.length + ' povos' : '');
          return '<button type="button" class="bc" data-ap="' + x.id + '">' + (x.capa ? '<img class="mini" data-src="' + esc(x.capa) + '" alt="" loading="lazy">' : '') + '<span class="tag">' + etiqueta(x) + '</span><h3>' + esc(x.titulo) + '</h3><p>' + esc(x.resumo) + '</p><span class="mu">' + n + (x.autor ? ' · ' + esc(x.autor) : '') + '</span></button>';
        }).join('') + '</div>';
      $('ap-corpo').innerHTML = h; imgs($('ap-corpo')); return;
    }
    h = '<div class="rd"><div class="xnav" style="margin:0 0 .6rem"><button type="button" data-ap="">‹ Todas as apostilas</button></div>'
      + '<div class="hero-ap' + (a.capa ? ' com-capa' : '') + '"><div><span class="tag">' + etiqueta(a) + '</span><h2>' + esc(a.titulo) + '</h2><p class="lead">' + esc(a.resumo) + '</p>'
      + (a.fonte ? '<p class="mu" style="margin:.2rem 0">Fonte: ' + esc(a.fonte) + (a.autor ? ' · ' + esc(a.autor) : '') + '</p>' : (a.autor ? '<p class="mu" style="margin:.2rem 0">' + esc(a.autor) + '</p>' : ''))
      + (a.atualizacao ? '<p class="xnota">' + esc(a.atualizacao) + '</p>' : '')
      + (a.digitalizacao ? '<p class="xnota">Transcrição resumida a partir da cópia digitalizada. Confira com o PDF original.</p>' : '')
      + (a.revisao ? '<p class="xnota">Conteúdo em revisão: confira as tabelas com o PDF original.</p>' : '')
      + (a.pdf ? '<p><button type="button" class="btn" data-pdf="' + esc(a.pdf) + '" data-titulo="' + esc(a.titulo) + '">Abrir o PDF original</button></p>' : '') + '</div>'
      + (a.capa ? '<img class="capa" data-src="' + esc(a.capa) + '" alt="Capa da apostila de ' + esc(a.titulo) + '" loading="lazy">' : '') + '</div>';
    if (a.intro && a.intro.length) h += '<details open><summary>Introdução</summary>' + paras(a.intro) + figs(a.figurasIntro) + '</details>';
    (a.secoes || []).forEach(function (s) { h += '<details><summary>' + esc(s.titulo) + '</summary>' + paras(s.texto) + '</details>'; });
    if (a.qualidades) {
      h += '<h3 style="font:600 1.3rem var(--ser);margin:1.4rem 0 .4rem">As 16 qualidades</h3>';
      a.qualidades.forEach(function (x) {
        var e = x.orixa >> 2;
        h += '<details class="aq" ' + est(e) + '><summary><i class="dot"></i><span class="on">' + esc(O[x.orixa][0]) + '</span><span class="qn">' + esc(x.nome) + '</span></summary><div class="ap-c">'
          + qualHtml(x, true) + '<button type="button" class="lnk" data-go="' + x.orixa + '">Abrir ' + esc(O[x.orixa][0]) + ' na roda</button></div></details>';
      });
    }
    if (a.povos) {
      h += '<h3 style="font:600 1.3rem var(--ser);margin:1.4rem 0 .2rem">Linhas dos Pretos-Velhos</h3><div class="pv">' + a.povos.map(function (p) {
        return '<article><h4>' + esc(p.nome) + '</h4>' + (p.texto ? '<p style="margin:0">' + esc(p.texto) + '</p>' : '') + '<dl><dt>Campo de atuação</dt><dd>' + esc(p.campo) + '</dd><dt>Cores</dt><dd>' + esc(p.cores) + '</dd><dt>Oferendas</dt><dd>' + esc(p.oferenda) + '</dd></dl></article>';
      }).join('') + '</div>';
    }
    if (a.fim && a.fim.length) h += '<details><summary>Atribuições e características</summary>' + paras(a.fim) + '</details>';
    $('ap-corpo').innerHTML = h + '</div>'; imgs($('ap-corpo'));
  }

  /* ---------- Busca + matriz ---------- */
  function render() {
    PQ = B.parse(qs, CTX); T = PQ.hl; hl = [];
    for (var i = 0; i < 16; i++) { ok[i] = !T.length || B.match(i, PQ, hx(i)); if (T.length && ok[i]) hl.push(i); }
    wg.forEach(function (g, i) { g.classList.toggle('dim', !!T.length && !ok[i]); });
    $('qx').style.display = qs ? 'block' : 'none';
    var c = qs.trim(), qn = PQ.ql.length && !PQ.rest.length && !PQ.cb.length ? ' (quadrante ' + PQ.ql.map(function (e) { return Q[e].n; }).join(' e ') + ')' : '';
    $('st').textContent = !T.length ? '' : hl.length ? hl.length + ' de 16 orixás correspondem a “' + c + '”' + qn + '.' : 'Nenhum orixá corresponde a “' + c + '”. Tente o nome, o Senhor ou o quadrante.';
    list(); rows();
  }
  function list() {
    var u = $('res'), emp = open && !T.length, sh = open && !!T.length; u.hidden = !(emp || sh); $('q').setAttribute('aria-expanded', !!(emp || sh));
    if (emp) { u.innerHTML = '<li class="sc" role="presentation">Experimente: ' + Q.map(function (q) { return '<button type="button" class="chip" data-s="' + q.n + '">' + q.n + '</button>'; }).join('') + '<br>ou digite “do Fogo”, um Senhor como Lonan, ou “Fogo do Ar”.</li>'; return; }
    if (!sh) return;
    u.innerHTML = hl.length ? hl.map(function (i, k) {
      var m = E(i).slice(1).filter(function (x) { var h = B.words(x[1]); return T.some(function (t) { return B.has(h, t); }); }).slice(0, 3);
      return '<li role="option" id="rd-r' + i + '" data-i="' + i + '"' + (k === ai ? ' aria-selected="true"' : '') + '><b>' + B.destacar(O[i][0], T) + '</b> <span class="mu">' + (i + 1) + '° · ' + Q[i >> 2].n + '</span>'
        + (m.length ? '<br><small class="mu">' + m.map(function (x) { return esc(x[0]) + ': ' + B.destacar(x[1].length > 70 ? x[1].slice(0, 70) + '…' : x[1], T); }).join(' · ') + '</small>' : (comTexto ? '<br><small class="mu">Encontrado no texto das apostilas</small>' : '')) + '</li>';
    }).join('') : '<li class="mu">Sem resultados</li>';
    $('q').setAttribute('aria-activedescendant', ai > -1 ? 'rd-r' + hl[ai] : '');
  }
  function cols() { return view === 'linhas' ? LN : L; }
  function vals(i) { return view === 'linhas' ? LV[i] : V(i); }
  function cl(k) { return view === 'linhas' ? 'Linha de ' + LN[k] : L[k]; }
  function head() { $('th').innerHTML = '<tr><th scope="col">Orixá</th>' + cols().map(function (l) { return '<th scope="col">' + l + '</th>'; }).join('') + '</tr>'; }
  function rows() {
    var h = '', s0 = view === 'linhas' ? 0 : 1;
    $('mi').textContent = view === 'linhas' ? '128 correspondências (16 orixás × 8 linhas). Toque num valor para filtrar; toque no nome para abrir na roda.' : 'Atributos de cada orixá (16 × 10). Toque num valor para filtrar; toque no nome para abrir na roda.';
    $('fc').innerHTML = fv ? '<button type="button" class="chip" id="rd-fx" aria-pressed="true">Filtro: ' + cl(fv.k) + ' = ' + esc(fv.v) + ' ✕</button>' : '';
    for (var i = 0; i < 16; i++) {
      if (!ok[i] || (fv && vals(i)[fv.k] !== fv.v)) continue; var e = i >> 2;
      h += '<tr' + (i === S ? ' class="on" aria-current="true"' : '') + '><th scope="row" style="border-left:4px solid var(--e' + e + '-bd)"><button type="button" class="nmb" data-i="' + i + '">' + B.destacar(O[i][0], T) + '</button></th>'
        + vals(i).map(function (x, k) {
          var c = (view === 'dados' && k === 4) ? '<span class="pill" style="background:var(--e' + e + '-bg);border-color:var(--e' + e + '-bd);color:var(--e' + e + '-tx)">' + B.destacar(x, T) + '</span>' : B.destacar(x, T);
          return '<td data-l="' + cl(k) + '">' + (k >= s0 ? '<button type="button" class="cv" data-k="' + k + '" data-v="' + esc(x) + '" title="Filtrar por ' + cl(k) + '">' + c + '</button>' : c) + '</td>';
        }).join('') + '</tr>';
    }
    $('tb').innerHTML = h || '<tr><td colspan="' + (cols().length + 1) + '">Nenhum orixá para esta busca e filtro.</td></tr>';
  }

  /* ---------- Glossário ---------- */
  var GG = [['A roda', 'e3', ['xire', 'orixa', 'posicao', 'luz', 'polaridade', 'dualidade']], ['Cada orixá', 'e1', ['carater', 'combinacao', 'senhor', 'linha', 'atua', 'deficiencia', 'apostila']], ['O quadrante', 'e2', ['quadrante', 'direcao', 'plano', 'sentido', 'besta']]];
  function glos() {
    var t = norm($('gq').value.trim()), h = '';
    GG.forEach(function (g) {
      var it = g[2].filter(function (k) { return G[k] && (!t || norm(G[k][0] + ' ' + G[k][1]).indexOf(t) > -1); }); if (!it.length) return;
      h += '<h2 class="gh" style="color:var(--' + g[1] + '-tx);border-color:var(--' + g[1] + '-bd)">' + g[0] + '</h2><div class="gg">' + it.map(function (k) { return '<div class="gi" id="rd-g-' + k + '"><h3>' + esc(G[k][0]) + '</h3><p>' + esc(G[k][1]) + '</p></div>'; }).join('') + '</div>';
    });
    $('gl').innerHTML = h || '<p class="mu">Nenhum termo encontrado.</p>';
  }

  /* ---------- Tooltips do glossário ---------- */
  var tip, tt;
  function tipHide() { clearTimeout(tt); tip.hidden = true; if (tf) { tf.removeAttribute('aria-describedby'); tf = null; } }
  function tipShow(b) {
    var g = G[b.dataset.t]; if (!g) return; tipHide();
    tip.innerHTML = '<b>' + esc(g[0]) + '</b><br>' + esc(g[1]) + '<br><button type="button" class="tl" data-g="' + b.dataset.t + '">Ver no glossário</button>'; tip.hidden = false;
    var r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8), y = r.bottom + 8;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8); tip.style.left = x + 'px'; tip.style.top = y + 'px'; tf = b; b.setAttribute('aria-describedby', 'rd-tip');
  }

  /* ---------- Eventos ---------- */
  function eventos() {
    var qi = $('q'), sx, sy;
    qi.addEventListener('input', function () { qs = qi.value; open = true; ai = -1; render(); });
    qi.addEventListener('focus', function () { open = true; list(); });
    qi.addEventListener('keydown', function (ev) {
      var k = ev.key, n = hl.length;
      if ((k === 'ArrowDown' || k === 'ArrowUp') && n && T.length) { ev.preventDefault(); open = true; ai = k === 'ArrowDown' ? (ai + 1) % n : (ai < 1 ? n - 1 : ai - 1); list(); var a = $('r' + hl[ai]); if (a) a.scrollIntoView({ block: 'nearest' }); }
      else if (k === 'Enter' && n && T.length) { ev.preventDefault(); pick(hl[ai > -1 ? ai : 0]); }
      else if (k === 'Escape') { if (open) { open = false; list(); } else if (qs) { qs = qi.value = ''; render(); } }
    });
    $('qx').addEventListener('click', function () { qs = qi.value = ''; ai = -1; render(); qi.focus(); });
    $('qt').addEventListener('change', function (ev) { comTexto = ev.target.checked; HX = []; render(); });
    $('res').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-s]'); if (b) { qs = qi.value = b.dataset.s; ai = -1; render(); return; }
      var li = ev.target.closest('li[data-i]'); if (li) pick(+li.dataset.i);
    });
    $('p-matriz').addEventListener('click', function (ev) {
      var n = ev.target.closest('.nmb'), c = ev.target.closest('.cv');
      if (n) pick(+n.dataset.i); else if (c) { fv = { k: +c.dataset.k, v: c.dataset.v }; rows(); } else if (ev.target.closest('#rd-fx')) { fv = null; rows(); }
      else { var w = ev.target.closest('[data-vw]'); if (w) { view = w.dataset.vw; fv = null;[].forEach.call($('vw').children, function (b) { b.setAttribute('aria-pressed', b === w); }); head(); rows(); } }
    });
    $('card').addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-ap]'); if (a) { abrirApostila(a.dataset.ap); return; }
      var b = ev.target.closest('[data-go]'); if (b) pick(+b.dataset.go);
    });
    $('p-apostilas').addEventListener('click', function (ev) {
      var pdf = ev.target.closest('[data-pdf]'); if (pdf) { if (window.LeitorPDF) window.LeitorPDF.abrir(pdf.dataset.pdf, pdf.dataset.titulo || 'Apostila'); return; }
      var a = ev.target.closest('[data-ap]'); if (a) { abrirApostila(a.dataset.ap); scrollTo(0, 0); return; }
      var b = ev.target.closest('[data-go]'); if (b) pick(+b.dataset.go);
    });
    $('card').addEventListener('toggle', function (ev) { if (ev.target.matches && ev.target.matches('details:not(.ap)')) dopen = ev.target.open; }, true);
    $('card').addEventListener('touchstart', function (ev) { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, { passive: true });
    $('card').addEventListener('touchend', function (ev) { var t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.abs(dx) > 60 && Math.abs(dy) < 40) pick((S + (dx < 0 ? 1 : 15)) % 16); }, { passive: true });
    $('tabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-t]'); if (b) { var t = b.dataset.t; tab(t); go(t === 'roda' ? slug(S) : t === 'apostilas' && apId ? 'apostilas/' + apId : t); } });
    $('tabs').addEventListener('keydown', function (ev) {
      var k = ABAS.indexOf(tb); if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var n = ABAS[(k + (ev.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length]; tab(n); go(n === 'roda' ? slug(S) : n); $('t-' + n).focus();
    });
    $('hb').addEventListener('click', function () { $('help').showModal(); });
    function hclose() { $('help').close(); } $('hx').addEventListener('click', hclose); $('hc').addEventListener('click', hclose); $('help').addEventListener('click', function (ev) { if (ev.target === $('help')) hclose(); });
    document.addEventListener('click', function (ev) {
      var l = ev.target.closest('.tl');
      if (l) { var k = l.dataset.g; tipHide(); $('gq').value = ''; glos(); tab('glossario'); go('glossario'); var el = $('g-' + k); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('fl'); setTimeout(function () { el.classList.remove('fl'); }, 1900); } return; }
      var b = ev.target.closest('.term');
      if (b) { if (!hv && tf === b) tipHide(); else tipShow(b); }
      else { if (!tip.contains(ev.target)) tipHide(); if (!$('sw').contains(ev.target) && open) { open = false; list(); } }
    });
    document.addEventListener('mouseover', function (ev) { if (!hv) return; var b = ev.target.closest('.term'); if (b) { clearTimeout(tt); if (tf !== b) tipShow(b); } });
    tip.addEventListener('mouseenter', function () { clearTimeout(tt); }); tip.addEventListener('mouseleave', function () { if (hv) tipHide(); });
    document.addEventListener('mouseout', function (ev) { if (hv && tf && ev.target.closest('.term')) tt = setTimeout(tipHide, 250); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') tipHide(); });
    addEventListener('scroll', tipHide, true); addEventListener('resize', tipHide);
    $('lgq').innerHTML = Q.map(function (q, e) { return '<button type="button" class="qc" data-q="' + e + '" style="--c:var(--e' + e + ');--co:var(--e' + e + '-on)"><i></i>' + q.n + ' · ' + q.d + '</button>'; }).join('');
    $('lgq').addEventListener('click', function (ev) { var b = ev.target.closest('[data-q]'); if (b && (S >> 2) !== +b.dataset.q) pick(+b.dataset.q * 4); });
    var Z = [1, 1.15, 1.3, 1.5], zi = 1, zs = null; try { zs = localStorage.getItem('itaroba.roda.zoom'); } catch (e) { /* sem armazenamento */ }
    if (zs !== null) zi = Math.max(0, Math.min(3, +zs || 0));
    function zoom(d) { zi = Math.max(0, Math.min(3, zi + d)); RAIZ.style.setProperty('--z', Z[zi]); $('zm').disabled = zi === 0; $('zp').disabled = zi === 3; try { localStorage.setItem('itaroba.roda.zoom', zi); } catch (e) { /* sem armazenamento */ } }
    $('zm').addEventListener('click', function () { zoom(-1); }); $('zp').addEventListener('click', function () { zoom(1); }); zoom(0);
    document.addEventListener('keydown', function (ev) { if (ev.key === '/' && !RAIZ.hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !$('help').open) { ev.preventDefault(); qi.focus(); } });
    $('gq').addEventListener('input', glos);
  }

  var pronto = false, arrancou = false, pendente = '';
  function iniciar(dados) {
    adaptar(dados); tip = $('tip');
    desenharRoda(); head(); glos(); eventos();
    var st0 = 0; try { st0 = +localStorage.getItem('itaroba.roda.ultimo') || 0; } catch (e) { /* sem armazenamento */ }
    sel(st0); render(); aplicar(pendente); pronto = true;
    RAIZ.setAttribute('data-roda', 'pronto');
  }
  function arrancar() {
    if (arrancou) return; arrancou = true;
    window.RodaDados.carregar().then(iniciar).catch(function (e) {
      arrancou = false;
      $('card').innerHTML = '<p class="xnota">Não foi possível carregar a Roda do Xirê agora. Confira a internet e tente de novo.</p>'; if (window.console) console.error(e);
    });
  }
  window.RodaApp = {
    mostrar: function (sub) { pendente = sub || ''; if (pronto) aplicar(pendente); else arrancar(); },
    selecionar: function (i) { if (pronto) pick(i); }
  };
})();
