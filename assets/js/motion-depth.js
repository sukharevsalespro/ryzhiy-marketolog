/* 002 motion-depth — МАКЕТ T000: шапка А/Б (?hdr=a|b), стекло при прокрутке, активный пункт,
   ближайшее событие в CTA, мобильное меню на <dialog>, «письмо пером» рукописи на обложке.
   Без scroll-обработчиков: только IntersectionObserver. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Направление шапки для макета: ?hdr=a|b (по умолчанию А). */
  var v = (location.search.match(/[?&]hdr=([ab])\b/) || [])[1] || 'a';
  root.dataset.hdr = v;

  /* iOS: без слушателя touchstart :active не срабатывает — нужен для оттиска при нажатии. */
  document.addEventListener('touchstart', function () {}, { passive: true });

  var band = document.querySelector('[data-hdr-band]');
  if (band && window.IntersectionObserver) {
    /* Стекло: сторож высотой 8px в самом верху страницы. Ушёл из вида — шапка «стеклянная». */
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (e) {
      band.classList.toggle('is-stuck', !e[0].isIntersecting);
    }).observe(sentinel);

    /* Активный пункт: секция, пересекающая середину экрана. */
    var links = Array.prototype.slice.call(band.querySelectorAll('.hdr-menu a[href^="#"]'));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = byId[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        } else if (a.getAttribute('aria-current')) {
          a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* CTA «Ближайшее событие» — из того же events.json, что календарь и анонс обложки. */
  var ctas = document.querySelectorAll('[data-next-event]');
  if (ctas.length && window.fetch) {
    fetch('/assets/data/events.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('events.json: HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var now = Date.now();
        var next = (data.events || []).filter(function (ev) { return new Date(ev.end || ev.start).getTime() >= now; })
          .sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
        if (!next) return;
        var day = new Date(next.start).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
        var kind = next.type === 'networking' ? 'Нетворкинг' : next.type === 'webinar' ? 'Вебинар' : 'Встреча';
        Array.prototype.forEach.call(ctas, function (a) {
          a.href = next.url;
          a.setAttribute('aria-label', 'Ближайшее событие: ' + kind + ', ' + day);
          a.querySelector('.hdr-cta-text').innerHTML = '<b>' + day + '</b> · ' + kind;
        });
      })
      .catch(function (err) { console.error('CTA ближайшего события остаётся статичной:', err); });
  }

  /* Мобильное меню. */
  var dlg = document.getElementById('hdr-dialog');
  var burger = document.querySelector('.hdr-burger');
  if (dlg && burger && typeof dlg.showModal === 'function') {
    var closing = false;
    burger.addEventListener('click', function () {
      dlg.showModal();
      if (reduce || !dlg.animate) return;
      dlg.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
      Array.prototype.forEach.call(dlg.querySelectorAll('.hdr-dialog-nav a, .hdr-dialog-foot'), function (el, i) {
        el.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }],
          { duration: 360, delay: 120 + i * 60, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      });
    });
    function close(then) {
      if (closing) return;
      if (reduce || !dlg.animate) { dlg.close(); if (then) then(); return; }
      closing = true;
      dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-in' }).onfinish = function () {
        closing = false; dlg.close(); if (then) then();
      };
    }
    dlg.querySelector('.hdr-close').addEventListener('click', function () { close(); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dlg.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      var target = document.querySelector(a.getAttribute('href'));
      close(function () { if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
    });
  }

  /* «Письмо пером»: маска из штрихов по средней линии букв (служебная геометрия, видимый контур
     тот же). Маска ставится только на время анимации и снимается после — итог = исходный вектор. */
  var hand = document.querySelector('.hero-hand[data-md="pen"]');
  var ink = hand && hand.querySelector('.hand-ink');
  if (hand && ink && !reduce && window.IntersectionObserver) {
    var paths = hand.querySelectorAll('.hand-pen path');
    var end = 0;
    Array.prototype.forEach.call(paths, function (p) {
      var t = parseFloat(p.style.getPropertyValue('--d')) + parseFloat(p.style.getPropertyValue('--t'));
      if (t > end) end = t;
    });
    ink.setAttribute('mask', 'url(#hand-pen)');
    var started = false;
    new IntersectionObserver(function (e, obs) {
      if (!e[0].isIntersecting || started) return;
      started = true; obs.disconnect();
      setTimeout(function () {
        hand.classList.add('is-writing');
        setTimeout(function () { ink.removeAttribute('mask'); hand.classList.remove('is-writing'); }, end + 120);
      }, 380);
    }, { threshold: .3 }).observe(hand);
  }
})();
