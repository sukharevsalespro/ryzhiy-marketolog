/* Тема сайта: «как на устройстве» (по умолчанию) / светлая / тёмная, ручной выбор — в localStorage.
   Подключается СИНХРОННО в <head> после всех <link rel="stylesheet">: браузер выполняет его, когда CSS уже
   загружен, а <body> ещё не разобран, — поэтому сохранённая тема применяется до первой отрисовки, без мигания.
   Тёмные правила в CSS остаются обычными @media (prefers-color-scheme: dark): при ручном выборе скрипт
   переписывает условия этих media-правил в CSSOM (dark → всегда/никогда). Без JS всё работает по устройству.
   Внимание: matchMedia('(prefers-color-scheme: dark)') в JS по-прежнему отвечает про устройство —
   тему страницы читать из document.documentElement.dataset.theme. */
(function () {
  'use strict';
  var KEY = 'theme';
  var root = document.documentElement;
  var FEATURE = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i;
  var NAMES = { auto: 'как на устройстве', light: 'светлая', dark: 'тёмная' };
  var rules = null; /* [{ media: MediaList, text: исходное условие }] */

  function load() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function save(pref) {
    try { if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch (e) { /* приватный режим: выбор живёт до перезагрузки */ }
  }

  function collect() {
    var out = [];
    function walk(list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.media && FEATURE.test(r.media.mediaText)) out.push({ media: r.media, text: r.media.mediaText });
        if (r.cssRules) walk(r.cssRules);
      }
    }
    for (var i = 0; i < document.styleSheets.length; i++) {
      try { walk(document.styleSheets[i].cssRules); } catch (e) { console.error('theme.js: стиль недоступен для CSSOM', e); }
    }
    return out;
  }

  /* Каждое условие из списка через запятую: своя схема → (min-width:0) (всегда истинно), чужая → not all. */
  function rewrite(text, pref) {
    return text.split(',').map(function (q) {
      var m = q.match(FEATURE);
      if (!m) return q;
      return m[1].toLowerCase() === pref ? q.replace(FEATURE, '(min-width: 0px)') : 'not all';
    }).join(',');
  }

  function apply(pref, initial) {
    if (!rules) {
      if (pref === 'auto') { root.setAttribute('data-theme', 'auto'); return; } /* по умолчанию CSSOM не трогаем */
      rules = collect();
    }
    var still;
    if (!initial) { /* смена темы не должна «размазываться» переходами цвета по всей странице */
      still = document.createElement('style');
      still.textContent = '*:not(.tt-ico),*::before,*::after{transition:none!important}'; /* иконка темы анимируется */
      document.head.appendChild(still);
    }
    rules.forEach(function (r) { r.media.mediaText = pref === 'auto' ? r.text : rewrite(r.text, pref); });
    var metas = document.querySelectorAll('meta[name="theme-color"][media]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (!m.hasAttribute('data-media')) m.setAttribute('data-media', m.getAttribute('media'));
      m.setAttribute('media', pref === 'auto' ? m.getAttribute('data-media') : rewrite(m.getAttribute('data-media'), pref));
    }
    root.setAttribute('data-theme', pref);
    if (still) { void getComputedStyle(root).color; requestAnimationFrame(function () { still.remove(); }); }
  }

  function sync(pref, announce) {
    var btns = document.querySelectorAll('[data-theme-set]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-theme-set') === pref));
    var opener = document.querySelectorAll('[data-theme-open],[data-theme-cycle]');
    for (var j = 0; j < opener.length; j++) opener[j].setAttribute('aria-label', 'Тема оформления: ' + NAMES[pref]);
    if (!announce) return;
    var live = document.querySelectorAll('[data-theme-status]');
    for (var k = 0; k < live.length; k++) live[k].textContent = 'Тема: ' + NAMES[pref];
  }

  function set(pref) { save(pref); apply(pref, false); sync(pref, true); }

  function closeMenus(except) {
    var open = document.querySelectorAll('[data-theme-open][aria-expanded="true"]');
    for (var i = 0; i < open.length; i++) if (open[i] !== except) open[i].setAttribute('aria-expanded', 'false');
  }

  apply(load(), true);

  document.addEventListener('DOMContentLoaded', function () { sync(root.getAttribute('data-theme'), false); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-theme-set],[data-theme-cycle],[data-theme-open]');
    if (!t) { closeMenus(); return; }
    if (t.hasAttribute('data-theme-open')) {
      var open = t.getAttribute('aria-expanded') === 'true';
      closeMenus(t);
      t.setAttribute('aria-expanded', String(!open));
      return;
    }
    if (t.hasAttribute('data-theme-cycle')) { /* вариант-прототип «иконка-цикл»: авто → тёмная → светлая → авто */
      var order = ['auto', 'dark', 'light'];
      set(order[(order.indexOf(root.getAttribute('data-theme')) + 1) % order.length]);
      return;
    }
    set(t.getAttribute('data-theme-set'));
    var menu = t.closest('[data-theme-menu]');
    if (menu) { var b = menu.querySelector('[data-theme-open]'); closeMenus(); if (b) b.focus(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var b = document.querySelector('[data-theme-open][aria-expanded="true"]');
    if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); }
  });
})();
