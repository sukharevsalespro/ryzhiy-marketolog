/* Оферта: оглавление в <details open> — без JS открыто везде; на телефоне и планшете (≤1100) сворачиваем,
   а после перехода по пункту — сворачиваем снова, чтобы текст не прятался под списком. */
(function () {
  'use strict';
  var toc = document.querySelector('.svx-toc');
  if (!toc) return;
  var narrow = window.matchMedia('(max-width: 1100px)');
  function sync() { toc.open = !narrow.matches; }
  sync();
  narrow.addEventListener('change', sync);
  toc.addEventListener('click', function (e) {
    if (narrow.matches && e.target.closest('a')) toc.open = false;
  });
})();
