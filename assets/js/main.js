/* Рыжий маркетолог: календарь, валидация и подтверждённая отправка заявки. */
(function () {
  'use strict';

  var CONFIG = {
    // URL Яндекс.Функции для приёма заявок.
    LEADS_ENDPOINT: 'https://functions.yandexcloud.net/d4eut85le1co28mu0lc6'
  };

  document.documentElement.classList.add('js');

  /* Календарь: месяц открывается на дате объявленного вебинара. */
  var calendar = document.querySelector('.cal');
  if (calendar) {
    var month = 8;
    var year = 2026;
    calendar.querySelectorAll('[data-month]').forEach(function (control) {
      control.disabled = false;
      control.addEventListener('click', function () {
        var date = new Date(year, month + Number(control.dataset.month), 1);
        year = date.getFullYear();
        month = date.getMonth();
        var title = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
        calendar.querySelector('.cal-head b').textContent = title.charAt(0).toUpperCase() + title.slice(1);
        calendar.querySelector('caption').textContent = title;
        var offset = (date.getDay() + 6) % 7;
        var count = new Date(year, month + 1, 0).getDate();
        calendar.classList.toggle('is-long-month', Math.ceil((offset + count) / 7) === 6);
        var rows = '';
        for (var i = 0; i < Math.ceil((offset + count) / 7) * 7; i++) {
          if (i % 7 === 0) rows += '<tr>';
          var day = i - offset + 1;
          var valid = day > 0 && day <= count;
          var selected = valid && day === 21 && month === 8 && year === 2026;
          rows += selected ? '<td class="is-day"><a href="/webinar/" aria-label="21 сентября — вебинар">21</a></td>' : '<td>' + (valid ? day : '') + '</td>';
          if (i % 7 === 6) rows += '</tr>';
        }
        calendar.querySelector('tbody').innerHTML = rows;
      });
    });
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

  function toast(message, kind, ms, telegram) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    var body = document.createElement('div');
    body.textContent = message;
    if (telegram) {
      var link = document.createElement('a');
      link.href = TG;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'написать в Telegram';
      body.appendChild(document.createTextNode(' Можно '));
      body.appendChild(link);
      body.appendChild(document.createTextNode('.'));
    }
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
  var btn = form.querySelector('button[type="submit"]');
  var btnContent = btn ? Array.from(btn.childNodes).map(function (node) { return node.cloneNode(true); }) : [];
  if (btn) btn.disabled = false;
  var submitting = false;

  function utmFields(fd) {
    var params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      var value = params.get(key);
      if (value) fd.append(key, value.slice(0, 200));
    });
  }

  function pending(on) {
    if (!btn) return;
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
    if (on) btn.textContent = 'Отправляю…';
    else btn.replaceChildren.apply(btn, btnContent.map(function (node) { return node.cloneNode(true); }));
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitting) return;
    [form.elements.name, form.elements.contact, form.elements.consent].forEach(function (field) { field.removeAttribute('aria-invalid'); });

    var name = form.elements.name.value.trim();
    var contact = form.elements.contact.value.trim();
    var consent = form.elements.consent.checked;

    if (!name) {
      toast('Не заполнено имя — напишите, как к вам обращаться.', 'err');
      form.elements.name.setAttribute('aria-invalid', 'true');
      form.elements.name.focus();
      return;
    }
    if (!contact) {
      toast('Нужен контакт для ответа: телефон или ник в Telegram.', 'err');
      form.elements.contact.setAttribute('aria-invalid', 'true');
      form.elements.contact.focus();
      return;
    }
    if (name.length > 200 || contact.length > 200) {
      toast('Имя и контакт должны содержать не больше 200 символов.', 'err');
      return;
    }
    if (!consent) {
      toast('Отметьте согласие на обработку персональных данных — без него не смогу принять заявку.', 'err');
      form.elements.consent.setAttribute('aria-invalid', 'true');
      form.elements.consent.focus();
      return;
    }

    if (!CONFIG.LEADS_ENDPOINT) {
      toast('Форма ещё подключается.', 'err', 12000, true);
      return;
    }

    var fd = new FormData();
    fd.append('product', 'site');
    fd.append('name', name);
    fd.append('contact', contact);
    fd.append('consent', 'true');
    fd.append('source_page', window.location.pathname);
    utmFields(fd);

    submitting = true;
    pending(true);
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    fetch(CONFIG.LEADS_ENDPOINT, { method: 'POST', body: fd, signal: controller.signal })
      .then(function (response) {
        return response.json().catch(function () {
          throw new Error('Сервер вернул некорректный ответ. Попробуйте позже.');
        }).then(function (result) {
          if (!response.ok || result.ok !== true) {
            var reasons = {
              'consent required': 'Сервер отклонил заявку: требуется согласие на обработку персональных данных.',
              'body too large': 'Заявка слишком большая. Сократите имя и контакт.',
              'empty lead': 'Сервер отклонил заявку: проверьте имя и контакт.',
              'delivery failed': 'Сервер не смог доставить заявку. Попробуйте позже.'
            };
            throw new Error(reasons[result.error] || 'Сервер отклонил заявку (код ' + response.status + '). Попробуйте позже.');
          }
        });
      })
      .then(function () {
        form.reset();
        toast('Заявка отправлена. Валентина свяжется с вами.', 'ok');
      })
      .catch(function (error) {
        var message = error.name === 'AbortError' ? 'Сервер не ответил вовремя. Попробуйте позже.' : error instanceof TypeError ? 'Не получилось отправить — проверьте подключение к сети.' : error.message;
        toast(message, 'err', 12000, true);
      })
      .finally(function () {
        clearTimeout(timeout);
        submitting = false;
        pending(false);
      });
  });
})();

/* Motion: progressive enhancement; no form/network work. */
(function(){
const q=matchMedia('(prefers-reduced-motion: reduce)');
if(q.matches||!window.IntersectionObserver||!Element.prototype.animate)return;
const items=[...document.querySelectorAll('[data-motion]')],running=new Set(),pending=new Set(items);
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)show(e.target)}),{threshold:.08});
function show(el,play=true){
 if(!pending.delete(el))return;
 io.unobserve(el);el.classList.remove('motion-pending');
 if(!play)return;
 const kind=el.dataset.motion,t=kind==='hand'?el.querySelector('.hand-window'):el;
 const base=getComputedStyle(t).transform.replace('none','');
 const from=kind==='hand'?'scaleX(0)':kind==='photo'?base+' scale(1.06)':kind==='number'?base+' scale(.94)':'translateY(20px) '+base;
 t.style.willChange='transform, opacity';
 const a=t.animate([{transform:from,opacity:kind==='photo'||kind==='hand'?1:0},{transform:base||'none',opacity:1}],{duration:kind==='photo'?700:kind==='hand'?600:420,delay:Number(el.dataset.delay)||0,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
 running.add(a);a.onfinish=a.oncancel=()=>{t.style.willChange='';running.delete(a)};
 if(el.matches('.cal')){el.classList.add('date-pulse');setTimeout(()=>el.classList.remove('date-pulse'),650)}
}
items.forEach(el=>io.observe(el));
document.addEventListener('focusin',e=>items.forEach(el=>{if(el.contains(e.target))show(el,false)}));
q.addEventListener('change',()=>{if(q.matches){io.disconnect();items.forEach(el=>show(el,false));running.forEach(a=>a.cancel())}});
})();
