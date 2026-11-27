/* Roda do Xirê · busca estruturada (funções puras, sem DOM).
   Quadrante e combinação filtram campos próprios; o resto procura no início das palavras. */
(function (g) {
  'use strict';
  var STOP = { de: 1, do: 1, da: 1, dos: 1, das: 1, o: 1, a: 1, os: 1, as: 1, e: 1, no: 1, na: 1, em: 1 };

  function norm(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function words(t) { return ' ' + norm(t).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function has(h, t) { return h.indexOf(' ' + t) > -1; }

  /* ctx = { QN: {termo → índice do quadrante}, CB: [combinação normalizada de cada orixá] } */
  function contexto(quadrantes, orixas) {
    var QN = {};
    quadrantes.forEach(function (q, e) { [q.n, q.d, q.p, q.s].forEach(function (w) { QN[norm(w)] = e; }); });
    return { QN: QN, CB: orixas.map(function (o) { return norm(o[2]); }) };
  }

  function parse(q, ctx) {
    var n = norm(q).replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim(), r = { cb: [], ql: [], rest: [], hl: [] };
    if (!n) return r;
    ctx.CB.forEach(function (c, i) {
      if ((' ' + n + ' ').indexOf(' ' + c + ' ') > -1) { r.cb.push(i); r.hl.push(c); n = (' ' + n + ' ').replace(' ' + c + ' ', ' ').trim(); }
    });
    n.split(' ').filter(function (t) { return t && !STOP[t]; }).forEach(function (t) {
      if (t in ctx.QN && !r.cb.length) { if (r.ql.indexOf(ctx.QN[t]) < 0) r.ql.push(ctx.QN[t]); r.hl.push(t); }
      else { r.rest.push(t); r.hl.push(t); }
    });
    return r;
  }

  /* h = texto do orixá já passado por words() */
  function match(i, p, h) {
    if (p.cb.length && p.cb.indexOf(i) < 0) return false;
    if (p.ql.length && p.ql.indexOf(i >> 2) < 0) return false;
    if (!p.rest.length) return true;
    if (p.rest.every(function (t) { return has(h, t); })) return true;
    return p.rest.length > 1 && h.replace(/ /g, '').indexOf(p.rest.join('')) > -1;
  }

  function destacar(s, termos) {
    if (!termos.length) return esc(s);
    var n = '', m = [], j, k;
    for (j = 0; j < s.length; j++) { var c = norm(s[j]); for (k = 0; k < c.length; k++) { n += c[k]; m.push(j); } }
    var on = [];
    termos.forEach(function (t) {
      var p = -1;
      while ((p = n.indexOf(t, p + 1)) > -1) { if (p > 0 && /[a-z0-9]/.test(n[p - 1])) continue; for (k = 0; k < t.length; k++) on[m[p + k]] = 1; }
    });
    var r = '', o = 0;
    for (j = 0; j < s.length; j++) { var b = on[j] ? 1 : 0; if (b && !o) r += '<mark>'; if (!b && o) r += '</mark>'; o = b; r += esc(s[j]); }
    return r + (o ? '</mark>' : '');
  }

  g.RodaBusca = { norm: norm, esc: esc, words: words, has: has, contexto: contexto, parse: parse, match: match, destacar: destacar };
})(window);
