/* Рыжий маркетолог — минимальный клиентский слой:
   появление плиток, тосты, отправка заявки. Без зависимостей. */
(function () {
  'use strict';

  /* ---------- Появление плиток при скролле ---------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealables = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
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

  /* ---------- Конфиг ---------- */
  var CONFIG = {
    // URL Яндекс.Функции для приёма заявок. Пусто — форма отправляет в Telegram.
    LEADS_ENDPOINT: 'https://functions.yandexcloud.net/d4eut85le1co28mu0lc6'
  };
})();
