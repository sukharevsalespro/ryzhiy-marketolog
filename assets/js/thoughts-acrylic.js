/* «Мысли о маркетинге» — акриловые пластины (вариант T1): наклон и блик за курсором, лента на мобиле. */
(function () {
  'use strict';
  var sec = document.getElementById('thoughts');
  if (!sec || !sec.classList.contains('th')) return;

  var mq = function (s) { return window.matchMedia ? matchMedia(s) : { matches: false }; };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  var wide = mq('(min-width: 900px)');
  var list = sec.querySelector('.th-list');
  var items = [].slice.call(sec.querySelectorAll('.th-item'));
  var dots = [].slice.call(sec.querySelectorAll('.th-dot'));

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
      if (!fine.matches || !wide.matches || reduce.matches) return;
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
    if (wide.matches) return;
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

  dots.forEach(function (d, i) {
    d.addEventListener('click', function () {
      var li = items[i], pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
      list.scrollTo({ left: li.offsetLeft - pad, behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  });
})();
