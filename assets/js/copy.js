/* Служебные страницы (реквизиты): кнопка «Копировать» у каждого значения — копия в буфер + тост.
   Без JS кнопки скрыты (атрибут hidden), чтобы не было кнопки, которая ничего не делает. Тост — разметка и стили тостов main.js. */
(function () {
  'use strict';
  var buttons = document.querySelectorAll('.svx-copy[data-copy]');
  var all = document.querySelector('[data-copy-all]');
  if (!buttons.length && !all) return;
  var host = null;
  function toast(message, kind) {
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      area.remove();
      if (ok) resolve(); else reject(new Error('execCommand copy failed'));
    });
  }
  function run(btn, text) {
    copy(text).then(function () {
      btn.classList.add('is-done');
      setTimeout(function () { btn.classList.remove('is-done'); }, 1600);
      toast('Скопировано', 'ok');
    }, function (err) {
      console.error('copy.js:', err);
      toast('Не получилось скопировать — выделите текст и скопируйте вручную.', 'err');
    });
  }
  Array.prototype.forEach.call(buttons, function (btn) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      run(btn, document.getElementById(btn.dataset.copy).textContent.trim());
    });
  });
  /* «Скопировать все реквизиты»: строки «Поле: значение» в порядке листа */
  if (all) {
    all.hidden = false;
    all.addEventListener('click', function () {
      var lines = Array.prototype.map.call(document.querySelectorAll('.svx-doc dl > div'), function (row) {
        return row.querySelector('dt').textContent.trim() + ': ' + row.querySelector('.svx-val').textContent.trim();
      });
      run(all, lines.join('\n'));
    });
  }
})();
