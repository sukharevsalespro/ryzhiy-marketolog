/* Плашка про cookie и Яндекс Метрику (23.10.2026). Только информирует: Метрику не блокирует и не откладывает.
   Показывается, пока посетитель не нажал «Понятно» (флаг в localStorage, без него — до конца вкладки).
   Не перекрывает кнопки: появляется, только когда в её полосе внизу экрана нет ссылок и кнопок
   (IntersectionObserver по этой полосе); если на первом экране там кнопка — ждёт прокрутки.
   В конце страницы под подвалом держит место своей высоты, чтобы не закрывать нижние ссылки. */
(function () {
  'use strict';
  var KEY = 'cookie-note';
  var memo = false;

  function seen() {
    try { if (localStorage.getItem(KEY) === '1') return true; } catch (e) { /* хранилище недоступно */ }
    try { if (sessionStorage.getItem(KEY) === '1') return true; } catch (e) { /* то же */ }
    return memo;
  }
  function remember() {
    memo = true;
    try { localStorage.setItem(KEY, '1'); return; } catch (e) { /* приватный режим */ }
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* остаётся флаг в памяти страницы */ }
  }
  if (seen()) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var box = document.createElement('section');
  box.className = 'ck';
  box.setAttribute('aria-label', 'Уведомление о cookie');
  box.innerHTML = '<p class="ck-t">Сайт использует cookie и Яндекс Метрику для статистики. <a href="/legal/privacy/#cookies">Подробнее</a></p>' +
    '<button type="button" class="ck-b md-plate">Понятно</button>';

  /* Место под плашкой в самом конце страницы, цветом последней полосы — подвал не уходит под плашку. */
  var room = document.createElement('div');
  room.setAttribute('aria-hidden', 'true');
  room.style.height = '0px';

  var shown = false, io = null, free = new Set(), timer = 0, ready = false;
  var TARGETS = 'a[href],button,input,select,textarea,summary,[role="button"]'; /* не [tabindex]: прокручиваемые области с фокусом — не кнопки */

  function zone() {
    var r = box.getBoundingClientRect(); /* плашка уже в разметке, но невидима: её размеры известны */
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  }
  function watch() {
    if (io) io.disconnect();
    free = new Set();
    var z = zone(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var margin = -Math.max(0, Math.floor(z.top - 8)) + 'px ' + -Math.max(0, Math.floor(vw - z.right - 8)) + 'px ' +
      -Math.max(0, Math.floor(vh - z.bottom - 8)) + 'px ' + -Math.max(0, Math.floor(z.left - 8)) + 'px';
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) free.add(en.target); else free.delete(en.target); });
      tryShow();
    }, { rootMargin: margin, threshold: 0 });
    document.querySelectorAll(TARGETS).forEach(function (el) { if (!box.contains(el)) io.observe(el); });
  }
  /* IO видит и скрытые узлы (visibility:hidden) — мешают только видимые. opacity не проверяем: у появляющихся при прокрутке блоков она временно 0. */
  function blocks(el) {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ visibilityProperty: true })) return false;
    var r = el.getBoundingClientRect(), z = zone();
    return r.width > 0 && r.height > 0 && r.left < z.right && r.right > z.left && r.top < z.bottom && r.bottom > z.top;
  }
  function tryShow() {
    if (shown || !ready) return;
    var busy = false;
    free.forEach(function (el) { if (!busy && blocks(el)) busy = true; });
    if (busy) return;
    shown = true;
    if (io) { io.disconnect(); io = null; }
    window.removeEventListener('resize', onResize);
    var last = document.body.lastElementChild, bg = '';
    for (var el = last; el; el = el.previousElementSibling) {
      if (el === box || el === room || el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT' || el.tagName === 'DIALOG') continue;
      bg = getComputedStyle(el).backgroundColor; break;
    }
    if (bg && bg !== 'rgba(0, 0, 0, 0)') room.style.background = bg;
    room.style.height = (box.offsetHeight + 2 * parseFloat(getComputedStyle(box).bottom || 0)) + 'px';
    box.setAttribute('data-state', 'in');
  }
  function onResize() { clearTimeout(timer); timer = setTimeout(watch, 150); }

  box.querySelector('.ck-b').addEventListener('click', function () {
    remember();
    box.setAttribute('data-state', 'out');
    /* место в конце страницы остаётся до перехода: иначе у того, кто внизу, прыгнет подвал */
    setTimeout(function () { box.remove(); }, reduce ? 0 : 200);
  });

  function init() {
    document.body.appendChild(room);
    document.body.appendChild(box);
    watch();
    window.addEventListener('resize', onResize);
    /* не первым кадром: сначала страница, потом плашка */
    setTimeout(function () { ready = true; tryShow(); }, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
