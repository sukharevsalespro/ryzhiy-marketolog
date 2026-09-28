/* Рыжий маркетолог: календарь, валидация и подтверждённая отправка заявки. */
(function () {
  'use strict';

  var CONFIG = {
    // Общий nginx-лимит перед Яндекс.Функцией. Секрет остаётся на сервере.
    LEADS_ENDPOINT: 'https://crm.xn--80abbgkqqiqk5bzb.xn--p1ai/public/ryzhiy-lead'
  };

  document.documentElement.classList.add('js');

  /* Календарь: события из /assets/data/events.json. Открывается на месяце
     ближайшего непрошедшего события (все прошли — на последнем), листается
     от первого до последнего месяца с событиями. Даты считаются по Москве.
     Анонс на обложке (.hero-announcement) — та же ближайшая дата, из тех же данных. */
  var calendar = document.querySelector('.cal');
  var card = document.getElementById('event');
  var hero = document.querySelector('.hero-announcement');
  var fmtCards = document.querySelectorAll('[data-fmt-type]');
  if ((calendar && card || hero || fmtCards.length) && window.fetch) {
    fetch('/assets/data/events.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('events.json: HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var events = data.events || [];
        if (calendar && card) initCalendar(events);
        if (hero) fillHero(events);
        if (fmtCards.length) fillFormats(events);
      })
      .catch(function (err) { console.error('Календарь/анонс остаются статичными:', err); });
  }

  function fillHero(events) {
    var now = Date.now();
    var next = events.filter(function (ev) { return !isPast(ev, now); })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
    if (!next) { hero.remove(); return; }
    var p = mskParts(next.start);
    hero.href = next.url;
    hero.querySelector('.strip-date').firstChild.textContent = p.d;
    hero.querySelector('.strip-date small').textContent = ruMonthGen(next.start);
    hero.querySelector('.strip-text .label').textContent = next.label;
    hero.querySelector('.strip-text span:last-child').textContent = next.title;
  }

  /* Карточки «Форматов»: ближайшая непрошедшая дата своего типа и цена. Нет такой — остаётся текст из разметки. */
  function fillFormats(events) {
    var now = Date.now();
    fmtCards.forEach(function (el) {
      var next = events.filter(function (ev) { return ev.type === el.dataset.fmtType && !isPast(ev, now); })
        .sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
      var meta = el.querySelector('.fmt-meta');
      if (!next || !meta) return;
      var day = new Date(next.start).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
      meta.textContent = '';
      [day, next.price].filter(Boolean).forEach(function (t, i) {
        var sp = document.createElement('span'); sp.textContent = t;
        if (i) meta.appendChild(document.createTextNode(' '));
        meta.appendChild(sp);
      });
    });
  }

  function mskParts(iso) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = Number(x.value); });
    return { y: p.year, m: p.month - 1, d: p.day };
  }
  function ruMonthGen(iso) {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).split(' ')[1];
  }
  function isPast(ev, now) { return new Date(ev.end || ev.start).getTime() < now; }

  function initCalendar(events) {
    if (!events.length) return;
    var now = Date.now();
    events = events.map(function (ev) {
      var p = mskParts(ev.start);
      return { ev: ev, y: p.y, m: p.m, d: p.d, past: isPast(ev, now) };
    }).sort(function (a, b) { return new Date(a.ev.start) - new Date(b.ev.start); });
    var nearest = events.filter(function (e) { return !e.past; })[0] || null;
    var shown = nearest || events[events.length - 1];
    var first = events[0], last = events[events.length - 1];
    var year = shown.y, month = shown.m;
    var prev = calendar.querySelector('[data-month="-1"]');
    var next = calendar.querySelector('[data-month="1"]');

    function key(y, m) { return y * 12 + m; }
    function render() {
      var date = new Date(year, month, 1);
      var title = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
      var inMonth = events.filter(function (e) { return e.y === year && e.m === month; });
      calendar.querySelector('.cal-head b').textContent = title;
      calendar.querySelector('caption').textContent = title + (inMonth.length ? ', событий: ' + inMonth.length : ', событий нет');
      var offset = (date.getDay() + 6) % 7;
      var count = new Date(year, month + 1, 0).getDate();
      var weeks = Math.ceil((offset + count) / 7);
      calendar.classList.toggle('is-long-month', weeks === 6);
      var rows = '';
      for (var i = 0; i < weeks * 7; i++) {
        if (i % 7 === 0) rows += '<tr>';
        var day = i - offset + 1;
        var valid = day > 0 && day <= count;
        var hit = valid && inMonth.filter(function (e) { return e.d === day; })[0];
        if (hit) {
          var cls = 'has-ev' + (hit === nearest ? ' is-day' : '') + (hit.past ? ' is-past' : '');
          var label = day + ' ' + ruMonthGen(hit.ev.start) + ' — ' + hit.ev.label.toLowerCase() + (hit.past ? ', прошло' : '');
          rows += '<td class="' + cls + '"><button type="button" data-ev="' + hit.ev.id + '" aria-pressed="false" aria-label="' + label + '">' + day + '</button></td>';
        } else {
          rows += '<td>' + (valid ? day : '') + '</td>';
        }
        if (i % 7 === 6) rows += '</tr>';
      }
      calendar.querySelector('tbody').innerHTML = rows;
      prev.disabled = key(year, month) <= key(first.y, first.m);
      next.disabled = key(year, month) >= key(last.y, last.m);
      var pick = inMonth.filter(function (e) { return !e.past; })[0] || inMonth[inMonth.length - 1];
      if (pick) select(pick);
    }

    function select(item) {
      calendar.querySelectorAll('[data-ev]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.ev === item.ev.id));
      });
      fillCard(item);
    }

    function fillCard(item) {
      var ev = item.ev;
      var label = card.querySelector('.label');
      label.textContent = ev.label;
      if (item.past) {
        var tag = document.createElement('span');
        tag.className = 'ev-tag';
        tag.textContent = 'Прошло';
        label.appendChild(document.createTextNode(' '));
        label.appendChild(tag);
      }
      card.classList.toggle('is-past', item.past);
      card.querySelector('.event-date b').textContent = item.d;
      card.querySelector('.event-date span').textContent = ruMonthGen(ev.start);
      var meta = card.querySelectorAll('.event-meta p');
      meta[0].lastChild.textContent = ev.time;
      meta[1].lastChild.textContent = ev.price;
      meta[1].style.display = item.past ? 'none' : '';
      card.querySelector('h3').textContent = ev.type === 'networking' ? 'Онлайн-нетворкинг «' + ev.title + '»' : ev.title;
      card.querySelector('.event-desc').textContent = ev.desc;
      var act = card.querySelector('.event-act');
      var arrow = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
      act.innerHTML = item.past
        ? '<a class="details" href="' + ev.url + '">Подробнее</a>'
        : '<a class="btn btn--fill md-plate" href="' + ev.url + '">' + ev.cta + ' ' + arrow + '</a>';
    }

    calendar.querySelector('tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ev]');
      if (!b) return;
      select(events.filter(function (x) { return x.ev.id === b.dataset.ev; })[0]);
    });
    [prev, next].forEach(function (control) {
      control.addEventListener('click', function () {
        var d = new Date(year, month + Number(control.dataset.month), 1);
        year = d.getFullYear();
        month = d.getMonth();
        render();
      });
    });
    render();
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

  window.rmToast = toast; /* общий тост для страниц со своим скриптом (/networking/) */

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
        if (window.ymGoal) window.ymGoal('lead_form');
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
let qn=0,qt=0;
function queue(){const n=performance.now();if(n-qt>400)qn=0;qt=n;return Math.min(qn++,5)*100}
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)show(e.target)}),{threshold:.08});
function show(el,play=true){
 if(!pending.delete(el))return;
 io.unobserve(el);el.classList.remove('motion-pending');
 if(!play)return;
 const kind=el.dataset.motion,t=kind==='hand'?el.querySelector('.hand-window'):el;
 /* Пузыри прилетают как входящие сообщения: снизу, с лёгким перелётом по
    масштабу, друг за другом. Очередь сбрасывается, если между появлениями
    прошло больше 400 мс, и обрезается шестью — иначе последний в длинной
    стене ждал бы секунду. */
 if(kind==='bubble'){
  const a=t.animate([{transform:'translateY(22px) scale(.985)',opacity:0},
                     {transform:'translateY(0) scale(1.02)',opacity:1,offset:.62},
                     {transform:'none',opacity:1}],
   {duration:300,delay:queue(),easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
  t.style.willChange='transform, opacity';
  running.add(a);a.onfinish=a.oncancel=()=>{t.style.willChange='';running.delete(a)};
  /* пометка появляется следом за пузырём — как будто её дописали от руки */
  const note=el.querySelector('.rev-note');
  if(note){
   const na=note.animate([{opacity:0,transform:'rotate(var(--tilt)) scale(.92)'},
                          {opacity:1,transform:'rotate(var(--tilt)) scale(1)'}],
    {duration:260,delay:(a.effect.getTiming().delay||0)+170,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
   running.add(na);na.onfinish=na.oncancel=()=>running.delete(na);
  }
  return;
 }
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

/* Отзывы: лайтбокс с полным необрезанным оригиналом переписки.
   Нативный <dialog> — Esc, ловушка фокуса и возврат фокуса на вызвавшую
   карточку работают без библиотек. Без JS карточка остаётся обычной
   ссылкой и открывает оригинал прямо в браузере. */
(function () {
  'use strict';
  var section = document.querySelector('.reviews');
  if (!section) return;
  var dialog = document.getElementById('shot');
  var shot = dialog && dialog.querySelector('.shot-img');
  if (!dialog || !shot || typeof dialog.showModal !== 'function') return;

  section.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-shot]');
    if (!link) return;
    event.preventDefault();
    shot.src = link.getAttribute('href');
    shot.alt = link.dataset.alt || 'Оригинал переписки';
    dialog.showModal();
  });
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog || event.target.closest('.shot-x')) dialog.close();
  });
  dialog.addEventListener('close', function () { shot.removeAttribute('src'); });
})();

/* Обложка главной: «письмо пером» рукописи «Больше, чем маркетинг» (спека 002, 1.56 с — исключение
   из «вход ≤700 мс»: авторский момент). */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* «Письмо пером»: маска из штрихов по средней линии букв (служебная геометрия, видимый контур
     тот же). Маска ставится только на время анимации и снимается после — итог = исходный вектор. */
  var hand = document.querySelector('.hero-hand[data-md="pen"]');
  var ink = hand && hand.querySelector('.hand-ink');
  if (!hand || !ink) return;
  function reveal() { hand.classList.add('pen-done'); }
  if (reduce || !window.IntersectionObserver || !window.fetch) { reveal(); return; }
  /* Маска (9 КБ штрихов) грузится отдельно после первой отрисовки, чтобы не утяжелять HTML. */
  fetch('/assets/img/hand-pen-mask.svg')
    .then(function (r) { if (!r.ok) throw new Error('hand-pen-mask: HTTP ' + r.status); return r.text(); })
    .then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      var mask = doc.querySelector('mask');
      if (!mask) throw new Error('hand-pen-mask: нет <mask>');
      hand.querySelector('defs').appendChild(document.importNode(mask, true));
      var end = 0;
      Array.prototype.forEach.call(hand.querySelectorAll('.hand-pen path'), function (p) {
        var t = parseFloat(p.style.getPropertyValue('--d')) + parseFloat(p.style.getPropertyValue('--t'));
        if (t > end) end = t;
      });
      ink.setAttribute('mask', 'url(#hand-pen)');
      hand.classList.add('pen-ready');
      new IntersectionObserver(function (e, obs) {
        if (!e[0].isIntersecting) return;
        obs.disconnect();
        setTimeout(function () {
          hand.classList.add('is-writing');
          setTimeout(function () { ink.removeAttribute('mask'); hand.classList.remove('is-writing'); reveal(); }, end + 120);
        }, 380);
      }, { threshold: .3 }).observe(hand);
    })
    .catch(function (err) { console.error('Рукопись показана без анимации:', err); ink.removeAttribute('mask'); reveal(); });
})();

/* Досчёт чисел при появлении в экране (спека 002, T005; обобщено на полосу обложки).
   [data-count] — итоговое число; data-count-dec — знаков после запятой в процессе (0,1→1);
   data-count-late — «+»/«млн» появляются только с финальным значением; data-count-delay — каскад, мс.
   В HTML стоят финальные значения (SEO, без JS); при reduced-motion ничего не трогаем.
   Контейнер [data-count-group] получает .is-counted после последнего числа (старт блика). */
(function () {
  'use strict';
  var els = [].slice.call(document.querySelectorAll('[data-count]'));
  var groups = [].slice.call(document.querySelectorAll('[data-count-group]'));
  function done(g) { g.classList.add('is-counted'); }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!els.length || reduce || !window.IntersectionObserver || !window.requestAnimationFrame) { groups.forEach(done); return; }
  function fmt(v, dec) { return dec ? v.toFixed(dec).replace('.', ',') : String(Math.round(v)); }
  els.forEach(function (el) {
    var to = parseFloat(el.dataset.count);
    if (!to) return;
    var finalText = el.textContent, dec = parseInt(el.dataset.countDec || '0', 10);
    var late = el.hasAttribute('data-count-late'), delay = parseInt(el.dataset.countDelay || '0', 10);
    var suffix = finalText.replace(/^[\d\s]+/, '');
    var group = el.closest('[data-count-group]');
    el.style.minWidth = el.getBoundingClientRect().width + 'px';  /* ширина ячейки не прыгает */
    el.setAttribute('aria-label', finalText);
    el.textContent = fmt(0, dec) + (late ? '' : suffix);
    new IntersectionObserver(function (e, obs) {
      if (!e[0].isIntersecting) return;
      obs.disconnect();
      setTimeout(function () {
        var t0 = performance.now(), dur = 1600;
        (function tick(now) {
          var k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
          el.textContent = k < 1 ? fmt(eased * to, dec) + (late ? '' : suffix) : finalText;
          if (k < 1) { requestAnimationFrame(tick); return; }
          el.dataset.counted = '';
          if (group && !group.querySelector('[data-count]:not([data-counted])')) done(group);
        })(t0);
      }, delay);
    }, { threshold: .4 }).observe(el);
  });
})();

/* «Спасибо» после Продамуса (спека 004): ?paid=1 / ?payfail=1 → модалка на главной.
   Native <dialog> + showModal(): фокус внутри и возврат фокуса — от браузера;
   добор — Esc (родное поведение dialog), клик по фону и крестик, как у #shot. */
(function () {
  'use strict';
  var dlg = document.getElementById('paid');
  if (!dlg || typeof dlg.showModal !== 'function') return;

  var params = new URLSearchParams(window.location.search);
  var state = params.get('paid') === '1' ? 'ok' : params.get('payfail') === '1' ? 'fail' : null;
  if (!state) return;

  var COPY = {
    ok: {
      title: 'Оплата прошла',
      text: 'Спасибо! Доступ и детали придут в Telegram или на почту, указанную при оплате. Если что-то не пришло в течение часа — напишите Валентине.',
      goal: 'paid_success'
    },
    fail: {
      title: 'Оплата не прошла',
      text: 'Деньги не списаны. Попробуйте ещё раз или напишите Валентине — поможем.',
      goal: 'paid_fail'
    }
  }[state];

  dlg.classList.toggle('paid--fail', state === 'fail');
  dlg.querySelector('#paid-h').textContent = COPY.title;
  dlg.querySelector('#paid-d').textContent = COPY.text;
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  dlg.showModal();

  /* main.js исполняется раньше metrika.js (оба defer, порядок тегов) — ymGoal
     на момент этого кода ещё не определён; ждём 'load', как весь остальной сайт дождался бы. */
  function fireGoal() { if (window.ymGoal) window.ymGoal(COPY.goal); }
  if (document.readyState === 'complete') fireGoal();
  else window.addEventListener('load', fireGoal);

  dlg.querySelector('.paid-x').addEventListener('click', function () { dlg.close(); });
  dlg.querySelector('.paid-close').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (event) { if (event.target === dlg) dlg.close(); });
})();
