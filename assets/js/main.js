/* Рыжий маркетолог — макет главной. Появление плиток, тосты, отправка заявки.
   Логика формы и CONFIG.LEADS_ENDPOINT перенесены из assets/js/main.js как есть. */
(function () {
  'use strict';

  var CONFIG = {
    // URL Яндекс.Функции для приёма заявок.
    LEADS_ENDPOINT: 'https://functions.yandexcloud.net/d4eut85le1co28mu0lc6'
  };

  document.documentElement.classList.add('js');

  /* ---------- Появление плиток при скролле (каскад 45мс) ---------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealables = [].slice.call(document.querySelectorAll('.r'));

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var batch = [];
    var flush = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        batch.push(entry.target);
      });
      if (flush) return;
      flush = setTimeout(function () {
        batch.forEach(function (el, i) {
          setTimeout(function () { el.classList.add('is-in'); }, i * 45);
        });
        batch = [];
        flush = null;
      }, 20);
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Тосты: кнопка никогда не молчит ---------- */
  var host = null;
  function toastHost() {
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(html, kind, ms) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    var body = document.createElement('div');
    body.innerHTML = html;
    var close = document.createElement('button');
    close.className = 'toast-x';
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть уведомление');
    close.textContent = '×';
    close.addEventListener('click', function () { el.remove(); });
    el.appendChild(body);
    el.appendChild(close);
    toastHost().appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 7000);
  }

  /* ---------- Форма заявки ---------- */
  var form = document.querySelector('[data-lead-form]');
  if (!form) return;

  var TG = 'https://t.me/valentina_promarketing';
  var TG_LINK = '<a href="' + TG + '" target="_blank" rel="noopener">написать в Telegram</a>';
  var btn = form.querySelector('button[type="submit"]');
  var btnText = btn ? btn.textContent : '';

  function utmFields(fd) {
    var params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      var value = params.get(key);
      if (value) fd.append(key, value);
    });
  }

  function pending(on) {
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? 'Отправляю…' : btnText;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var name = form.elements.name.value.trim();
    var contact = form.elements.contact.value.trim();
    var consent = form.elements.consent.checked;

    if (!name) {
      toast('Не заполнено имя — напишите, как к вам обращаться.', 'err');
      form.elements.name.focus();
      return;
    }
    if (!contact) {
      toast('Нужен контакт для ответа: телефон или ник в Telegram.', 'err');
      form.elements.contact.focus();
      return;
    }
    if (!consent) {
      toast('Отметьте согласие на обработку персональных данных — без него не смогу принять заявку.', 'err');
      form.elements.consent.focus();
      return;
    }

    if (!CONFIG.LEADS_ENDPOINT) {
      toast('Форма ещё подключается — пожалуйста, ' + TG_LINK + '.', 'err', 12000);
      return;
    }

    var fd = new FormData();
    fd.append('product', 'site');
    fd.append('name', name);
    fd.append('contact', contact);
    fd.append('source_page', window.location.pathname);
    utmFields(fd);

    pending(true);
    fetch(CONFIG.LEADS_ENDPOINT, { method: 'POST', mode: 'no-cors', body: fd })
      .then(function () {
        form.reset();
        toast('Заявка отправлена. Валентина свяжется с вами — обычно в течение дня.', 'ok');
      })
      .catch(function () {
        toast('Не получилось отправить — похоже, пропала сеть. Попробуйте ещё раз или ' + TG_LINK + '.', 'err', 12000);
      })
      .then(function () { pending(false); });
  });
})();
