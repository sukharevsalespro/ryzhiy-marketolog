/* Яндекс.Метрика 112475322 + цели кликов. Подключается на всех страницах сайта. */
(function (m, e, t, r, i, k, a) {
  m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
  m[i].l = 1 * new Date();
  for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) { return; } }
  k = e.createElement(t); a = e.getElementsByTagName(t)[0];
  k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

(function () {
  'use strict';
  var ID = 112475322;

  ym(ID, 'init', { ssr: true, webvisor: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, trackHash: true });

  /* Общая точка отправки цели: зовётся и отсюда, и из main.js после успешной отправки формы. */
  window.ymGoal = function (goal) {
    if (typeof window.ym === 'function') { window.ym(ID, 'reachGoal', goal); }
  };

  var PAY_GOALS = { qvcwvzr: 'pay_webinar', e0cjdjM: 'pay_zapis' };

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';

    if (href.indexOf('payform.ru') !== -1) {
      for (var key in PAY_GOALS) {
        if (href.indexOf(key) !== -1) { window.ymGoal(PAY_GOALS[key]); return; }
      }
      return;
    }

    /* Мессенджеры: Telegram и MAX. Instagram — соцсеть, отдельной целью не считаем. */
    if (href.indexOf('t.me/') === -1 && href.indexOf('max.ru/') === -1) return;
    if (link.closest('header, .topbar, .header-social')) window.ymGoal('messenger_header');
    else if (link.closest('.messengers, .contact, #contacts, footer, .footer-social')) window.ymGoal('messenger_contacts');
  }, true);
})();
