/* Посадочные (body.lp): текст для мессенджеров из <body data-msg-text> — копия в буфер + тост (механизм /networking/). */
(function () {
  'use strict';
  var TEXT = document.body.dataset.msgText || '';
  if (!TEXT) return;
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      if (ok) resolve(); else reject(new Error('execCommand copy failed'));
    });
  }
  function say(text, kind) { if (window.rmToast) window.rmToast(text, kind, 6000); }
  document.querySelectorAll('[data-msg]').forEach(function (a) {
    a.addEventListener('click', function () {
      var isMax = a.dataset.msg === 'max';
      var text = a.dataset.msgText || TEXT; /* у ссылки может быть свой текст (окно «Долями») */
      copy(text).then(function () {
        say(isMax ? 'Текст скопирован — вставьте в чат MAX.'
                  : 'Открываю Telegram. Текст подставится в чат, копия в буфере обмена.', 'ok');
      }, function (err) {
        console.error('Не удалось скопировать текст:', err);
        say('Не получилось скопировать. Напишите в чате: «' + text + '»', 'err');
      });
    });
  });
})();
