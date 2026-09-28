/* «Мысли о маркетинге» — акриловые пластины (макет). T1: наклон и блик за курсором, лента на мобиле.
   T2: стопка с перетасовкой (клик по нижней пластине, свайп, кнопка). Вариант для показа: ?th=t2. */
(function () {
  'use strict';
  var sec = document.getElementById('thoughts');
  if (!sec || !sec.classList.contains('th')) return;
  var q = /[?&]th=(t[12])\b/.exec(location.search);
  if (q) sec.setAttribute('data-th', q[1]);

  var mq = function (s) { return window.matchMedia ? matchMedia(s) : { matches: false }; };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  var wide = mq('(min-width: 900px)');
  var list = sec.querySelector('.th-list');
  var items = [].slice.call(sec.querySelectorAll('.th-item'));
  var dots = [].slice.call(sec.querySelectorAll('.th-dot'));
  var mode = function () { return sec.getAttribute('data-th'); };

  function setDots(i) {
    dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
  }

  /* ---------- T1: блик и наклон за курсором (только мышь, без reduced-motion) ---------- */
  items.forEach(function (li) {
    var plate = li.querySelector('.th-plate');
    var raf = 0, ev = null;
    function paint() {
      raf = 0;
      var r = plate.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      plate.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      plate.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      li.style.setProperty('--hx', ((x - .5) * 6).toFixed(2) + 'deg');
      li.style.setProperty('--hy', ((.5 - y) * 6).toFixed(2) + 'deg');
    }
    li.addEventListener('pointerenter', function (e) {
      if (mode() !== 't1' || !fine.matches || !wide.matches || reduce.matches) return;
      li.classList.add('is-hot'); ev = e; paint();
    });
    li.addEventListener('pointermove', function (e) {
      if (!li.classList.contains('is-hot')) return;
      ev = e; if (!raf) raf = requestAnimationFrame(paint);
    });
    li.addEventListener('pointerleave', function () {
      li.classList.remove('is-hot');
      li.style.removeProperty('--hx'); li.style.removeProperty('--hy');
      plate.style.removeProperty('--gx'); plate.style.removeProperty('--gy');
    });
  });

  /* ---------- T1 на узких: лента, соседние пластины уходят в стопку ---------- */
  var sraf = 0;
  function onScroll() {
    sraf = 0;
    if (mode() !== 't1' || wide.matches) return;
    var box = list.getBoundingClientRect(), pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    var best = 0, bestD = 1e9;
    items.forEach(function (li, i) {
      var r = li.getBoundingClientRect();
      var p = (r.left - box.left - pad) / r.width;           /* 0 — текущая, 1 — следующая справа */
      p = Math.max(-1, Math.min(1, p));
      li.style.setProperty('--p', reduce.matches ? 0 : p.toFixed(3));
      li.style.setProperty('--pa', reduce.matches ? 0 : Math.abs(p).toFixed(3));
      li.style.setProperty('--d', Math.round(Math.abs(p) * 3));
      if (Math.abs(p) < bestD) { bestD = Math.abs(p); best = i; }
    });
    setDots(best);
  }
  list.addEventListener('scroll', function () { if (!sraf) sraf = requestAnimationFrame(onScroll); }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- T2: стопка ---------- */
  var order = items.slice();                                /* order[0] — сверху */
  function apply() {
    order.forEach(function (li, pos) {
      li.setAttribute('data-pos', pos);
      var top = pos === 0;
      li.inert = mode() === 't2' && !top;                    /* нижние — не в фокусе; те же ссылки есть списком */
      li.setAttribute('aria-hidden', mode() === 't2' && !top ? 'true' : 'false');
    });
    setDots(items.indexOf(order[0]));
  }
  function animate(li, cls, from) {
    if (reduce.matches) return;
    if (from) li.style.setProperty('--from', from);
    li.classList.remove('is-leaving', 'is-rising'); void li.offsetWidth;
    li.classList.add(cls);
    li.addEventListener('animationend', function done() {
      li.classList.remove(cls); li.style.removeProperty('--from');
      li.removeEventListener('animationend', done);
    });
  }
  function next() {
    var top = order.shift(); order.push(top);
    animate(top, 'is-leaving'); apply();
  }
  function bring(i) {
    var li = items[i], at = order.indexOf(li);
    if (at <= 0) return;
    var from = 'var(--t' + at + ')';
    order.splice(at, 1); order.unshift(li);
    animate(li, 'is-rising', from); apply();
  }
  if (mode() === 't2') {
    apply();
    sec.querySelector('.th-next').addEventListener('click', next);
    items.forEach(function (li, i) {
      li.addEventListener('click', function (e) {
        if (order[0] === li) return;
        e.preventDefault(); bring(i);
      });
    });
    /* свайп по верхней пластине: влево/вправо больше 50 px — следующая */
    var sx = 0, sy = 0, moved = false;
    list.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; moved = false; });
    list.addEventListener('pointerup', function (e) {
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { moved = true; next(); }
    });
    list.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    list.style.touchAction = 'pan-y';
    sec.querySelectorAll('.th-index a[data-to]').forEach(function (a) {
      a.addEventListener('pointerenter', function () { if (fine.matches) bring(+a.getAttribute('data-to')); });
    });
  }

  dots.forEach(function (d, i) {
    d.addEventListener('click', function () {
      if (mode() === 't2') { bring(i); return; }
      var li = items[i], pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
      list.scrollTo({ left: li.offsetLeft - pad, behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  });
})();
