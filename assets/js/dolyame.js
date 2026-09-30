/* Информационный виджет «Долями» (Т-Банк) у цены: 4 платежа раз в 2 недели.
   Оплаты/оформления на сайте нет, сторонних скриптов нет. Сумма — один атрибут body[data-dl-amount]. */
(function () {
  'use strict';
  var PARTS = 4, STEP_DAYS = 14;

  /* Делим сумму на доли в рублях; остаток от деления — в первый платёж. */
  function split(total, parts) {
    var base = Math.floor(total / parts), out = [];
    for (var i = 0; i < parts; i++) out.push(base);
    out[0] += total - base * parts;
    return out;
  }
  if (typeof module !== 'undefined') { module.exports = { split: split }; return; }

  var rub = function (n) { return n.toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽'; };
  var MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var day = function (d) { return d.getDate() + '\u00a0' + MON[d.getMonth()]; };

  var total = parseInt(document.body.dataset.dlAmount, 10);
  if (!(total > 0)) return;
  var amounts = split(total, PARTS);
  var dates = amounts.map(function (_, i) {
    var d = new Date(); d.setDate(d.getDate() + i * STEP_DAYS); return i ? day(d) : 'сегодня';
  });
  var rest = amounts[PARTS - 1];
  var summary = rub(amounts[0]) + ' сейчас, затем по ' + rub(rest) + ' раз в 2 недели';

  function setup(root) {
    var segs = [].slice.call(root.querySelectorAll('.dl-seg'));
    var sum = root.querySelector('.dl-sum');
    var sticky = -1;
    segs.forEach(function (seg, i) {
      seg.querySelector('.dl-amt').textContent = rub(amounts[i]);
      seg.querySelector('.dl-date').textContent = dates[i];
      seg.setAttribute('aria-label', 'Платёж ' + (i + 1) + ' из ' + PARTS + ': ' + dates[i] + ', ' + rub(amounts[i]));
      seg.addEventListener('pointerenter', function () { show(i); });
      seg.addEventListener('focus', function () { show(i); });
      seg.addEventListener('click', function () { sticky = sticky === i ? -1 : i; show(sticky); });
    });
    root.querySelector('.dl-scale').addEventListener('pointerleave', function () { show(sticky); });
    root.querySelector('.dl-scale').addEventListener('focusout', function (e) {
      if (!e.currentTarget.contains(e.relatedTarget)) show(sticky);
    });
    function show(i) {
      segs.forEach(function (s, j) { s.classList.toggle('is-sel', j === i); s.setAttribute('aria-pressed', String(j === i)); });
      sum.textContent = i < 0 ? summary
        : 'Платёж ' + (i + 1) + ' из ' + PARTS + ' · ' + (i ? dates[i] : 'сегодня') + ' · ' + rub(amounts[i]);
    }
    show(-1);
  }

  var full = document.querySelector('.dl-full');
  var dlg = document.getElementById('dl-dlg');
  document.querySelectorAll('[data-dl-part]').forEach(function (el) { el.textContent = rub(rest); });
  if (full) {
    setup(full);
    if (dlg) {
      var copy = full.cloneNode(true);
      copy.classList.remove('dl--dark'); copy.classList.add('dl--auto');
      dlg.querySelector('.dl-dlg-body').appendChild(copy);
      setup(copy);
    }
  }
  if (!dlg || typeof dlg.showModal !== 'function') return;
  document.querySelectorAll('.dl-chip').forEach(function (chip) {
    chip.hidden = false;
    var fb = chip.parentNode.querySelector('.dl-fallback'); if (fb) fb.hidden = true;
    chip.addEventListener('click', function () { dlg.showModal(); });
  });
  dlg.querySelector('.dl-x').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
