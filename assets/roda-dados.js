/* Roda do Xirê · carregamento dos dados.
   Os JSON ficam no acervo privado (data/roda/) e chegam pelo mesmo caminho das palestras e dos pontos
   (window.ACERVO_ARQ): só membros aprovados leem. Os dados só são buscados quando a pessoa abre a Roda. */
(function (g) {
  'use strict';
  function json(caminho) {
    var A = g.ACERVO_ARQ;
    if (A) return A.esperar().then(function () { return A.json(caminho); });
    return fetch(caminho, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(caminho + ' · ' + r.status); return r.json(); });
  }
  function carregar(base) {
    var emb = document.getElementById('roda-dados'); /* só na prévia de arquivo único */
    if (emb) { try { return Promise.resolve(JSON.parse(emb.textContent)); } catch (e) { return Promise.reject(e); } }
    base = base || 'data/roda/';
    return Promise.all([json(base + 'nucleo.json'), json(base + 'indice.json')]).then(function (r) {
      return Promise.all(r[1].apostilas.map(function (a) { return json(base + a.arquivo); })).then(function (ap) {
        return { nucleo: r[0], apostilas: ap };
      });
    });
  }
  g.RodaDados = { carregar: carregar };
})(window);
