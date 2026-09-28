/* Рыжий маркетолог: календарь, валидация и подтверждённая отправка заявки. */
(function () {
  'use strict';

  var CONFIG = {
    // Общий nginx-лимит перед Яндекс.Функцией. Секрет остаётся на сервере.
    LEADS_ENDPOINT: 'https://crm.xn--80abbgkqqiqk5bzb.xn--p1ai/public/ryzhiy-lead'
  };

  document.documentElement.classList.add('js');

  /* Календарь встреч: события из /assets/data/events.json, даты по Москве.
     Вариант C3: лента встреч + вертикальное слово месяца + мини-календарь (от 1280).
     Прошедшие приглушены, ближайшая с бейджем. Без JS остаётся статичная афиша месяца ближайшей встречи.
     Анонс на обложке (.hero-announcement) — та же ближайшая дата, из тех же данных. */
  var agenda = document.querySelector('[data-agenda]');
  var hero = document.querySelector('.hero-announcement');
  var fmtCards = document.querySelectorAll('[data-fmt-type]');
  if ((agenda || hero || fmtCards.length) && window.fetch) {
    fetch('/assets/data/events.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('events.json: HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var events = data.events || [];
        if (agenda) initAgenda(events);
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

  function initAgenda(events) {
    if (!events.length) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var now = Date.now();
    var FORMAT = { networking: 'Нетворкинг', webinar: 'Вебинар' };
    var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    var ARROW = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
    var CHEV = function (d) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (d < 0 ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6') + '"/></svg>'; };

    var items = events.map(function (ev) {
      var p = mskParts(ev.start);
      return {
        ev: ev, y: p.y, m: p.m, d: p.d, past: isPast(ev, now),
        wd: new Date(ev.start).toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'Europe/Moscow' }),
        gen: ruMonthGen(ev.start),
        time: ev.time.replace(/\s*МСК$/, ''),
        fmt: FORMAT[ev.type] || ev.label
      };
    }).sort(function (a, b) { return new Date(a.ev.start) - new Date(b.ev.start); });
    var nearest = items.filter(function (e) { return !e.past; })[0] || null;
    var anchor = nearest || items[items.length - 1];
    var first = items[0], last = items[items.length - 1];
    var minKey = key(first.y, first.m), maxKey = key(last.y, last.m) + 1; /* +1: месяц «анонс скоро» */
    var cur = key(anchor.y, anchor.m);

    function key(y, m) { return y * 12 + m; }
    function inMonth(k) { return items.filter(function (e) { return key(e.y, e.m) === k; }); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function plural(n) {
      var a = n % 10, b = n % 100;
      return n + ' ' + (a === 1 && b !== 11 ? 'встреча' : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'встречи' : 'встреч');
    }
    function tag(it) {
      return it === nearest ? ' <span class="ag-badge">Ближайшая</span>' : it.past ? ' <span class="ag-tag">Прошла</span>' : '';
    }
    function foot(it, cls) {
      var ev = it.ev;
      return it.past
        ? '<div class="' + cls + '"><a class="ag-more" href="' + esc(ev.url) + '">Подробнее</a></div>'
        : '<div class="' + cls + '"><span class="ag-price">' + esc(ev.price) + '</span><a class="ag-cta" href="' + esc(ev.url) + '">Записаться ' + ARROW + '</a></div>';
    }
    function state(it) { return (it === nearest ? ' is-near' : '') + (it.past ? ' is-past' : ''); }
    function monthTitle(k) { return '<b>' + MONTHS[k % 12] + '</b> ' + Math.floor(k / 12); }
    /* Куда ведёт стрелка месяца — только по месяцам со встречами: слово, мини-календарь и лента
       всегда показывают один месяц, а пустой месяц ленте показать нечем. */
    function stepTarget(step) {
      var ks = items.map(function (e) { return key(e.y, e.m); }).filter(function (k) { return step > 0 ? k > cur : k < cur; });
      return ks.length ? ks[step > 0 ? 0 : ks.length - 1] : null;
    }
    function navBtn(step) {
      var t = stepTarget(step), off = t === null;
      return '<button type="button" class="ag-nav" data-step="' + step + '"' + (off ? ' disabled' : '') +
        ' aria-label="' + (step < 0 ? 'Предыдущий' : 'Следующий') + ' месяц' + (off ? '' : ': ' + MONTHS[t % 12]) + '">' + CHEV(step) + '</button>';
    }
    /* Слово месяца подгоняется под высоту колонки карточек (на мобиле — под ширину). */
    function fitMonth() {
      var box = agenda.querySelector('.c1-month'), word = box && box.firstChild;
      if (!word) return;
      var vertical = getComputedStyle(word).writingMode.indexOf('vertical') === 0;
      word.style.fontSize = '100px';
      var main = agenda.querySelector('.c2-feed');
      var room = vertical ? Math.max(main.offsetHeight, 420) : box.clientWidth;
      var size = vertical ? word.offsetHeight : word.offsetWidth;
      var fs = Math.max(56, Math.min(vertical ? 260 : 140, 97 * room / size));
      /* Колонка слова фиксированной ширины — лента не прыгает при смене месяца. */
      if (vertical) fs = Math.min(fs, 97 * box.clientWidth / word.offsetWidth);
      word.style.fontSize = fs.toFixed(1) + 'px';
    }

    /* ---------- Лента + мини-календарь ---------- */
    function c2Card(it) {
      var ev = it.ev;
      return '<li class="c2-card' + state(it) + '" id="c2-' + esc(ev.id) + '">' +
        '<p class="c2-wd">' + esc(it.wd) + '</p><b class="c2-day">' + it.d + '</b><p class="c2-mon">' + esc(it.gen) + '</p>' +
        '<p class="c2-time">' + esc(it.time) + '</p><p class="c2-fmt">' + esc(it.fmt) + tag(it) + '</p>' +
        '<h3>' + esc(ev.title) + '</h3><p class="c2-desc">' + esc(ev.desc) + '</p>' + foot(it, 'c2-foot') + '</li>';
    }
    function miniMonth() {
      var y = Math.floor(cur / 12), m = cur % 12, list = inMonth(cur);
      var offset = (new Date(y, m, 1).getDay() + 6) % 7, count = new Date(y, m + 1, 0).getDate();
      var today = mskParts(new Date(now).toISOString());
      var rows = '';
      for (var i = 0; i < Math.ceil((offset + count) / 7) * 7; i++) {
        if (i % 7 === 0) rows += '<tr>';
        var day = i - offset + 1, valid = day > 0 && day <= count;
        var hit = valid && list.filter(function (e) { return e.d === day; })[0];
        var isToday = valid && today.y === y && today.m === m && today.d === day;
        if (hit) rows += '<td><button type="button" class="c2-dayb' + state(hit) + '" data-ev="' + esc(hit.ev.id) + '" aria-label="' + day + ' ' + esc(hit.gen) + ', ' + esc(hit.fmt.toLowerCase()) + (hit.past ? ', прошла' : hit === nearest ? ', ближайшая' : '') + '">' + day + '</button></td>';
        else rows += '<td' + (isToday ? ' class="is-today" aria-current="date"' : '') + '>' + (valid ? day : '') + '</td>';
        if (i % 7 === 6) rows += '</tr>';
      }
      return '<div class="ag-bar">' + navBtn(-1) + '<p class="ag-title" aria-live="polite">' + monthTitle(cur) + '</p>' + navBtn(1) + '</div>' +
        '<table class="c2-grid"><caption class="skip">' + MONTHS[m] + ' ' + y + ', ' + (list.length ? plural(list.length) : 'встреч нет') + '</caption>' +
        '<thead><tr><th scope="col">Пн</th><th scope="col">Вт</th><th scope="col">Ср</th><th scope="col">Чт</th><th scope="col">Пт</th><th scope="col">Сб</th><th scope="col">Вс</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
        '<p class="c2-legend"><span class="lg-near">ближайшая</span><span class="lg-up">встреча</span><span class="lg-past">прошла</span></p>';
    }
    function renderC2(first) {
      if (first) {
        var feed = '<div class="c2-feed"><div class="c2-fbar"><p class="c2-count">' + plural(items.length) + '</p>' +
          '<span class="c2-arrows"><button type="button" class="ag-nav" data-scroll="-1" aria-label="Прокрутить к прошлым встречам">' + CHEV(-1) + '</button>' +
          '<button type="button" class="ag-nav" data-scroll="1" aria-label="Прокрутить к следующим встречам">' + CHEV(1) + '</button></span></div>' +
          '<ol class="c2-track" tabindex="0" aria-label="Лента встреч, листается стрелками">' + items.map(c2Card).join('') + '</ol></div>';
        agenda.innerHTML = '<div class="c3"><p class="c1-month" aria-hidden="true"><span>' + MONTHS[cur % 12] + '</span></p>' + feed + '<div class="c2-mini">' + miniMonth() + '</div></div>';
        var track = agenda.querySelector('.c2-track');
        var near = document.getElementById('c2-' + anchor.ev.id);
        track.scrollLeft += near.getBoundingClientRect().left - track.getBoundingClientRect().left;
        track.addEventListener('scroll', function () {
          arrows();
          clearTimeout(syncT); syncT = setTimeout(syncFocus, 140);
        }, { passive: true });
        arrows();
        fitMonth(); setPressed();
      } else {
        agenda.querySelector('.c2-mini').innerHTML = miniMonth();
      }
    }
    /* ---------- Месяц встречи в фокусе ленты ---------- */
    var focusIt = anchor, syncT = null, progUntil = 0;
    function setPressed() {
      agenda.querySelectorAll('.c2-dayb').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ev === focusIt.ev.id)); });
    }
    function setWord(dir) {
      var w = agenda.querySelector('.c3 .c1-month span');
      if (!w || w.textContent === MONTHS[cur % 12]) return;
      w.textContent = MONTHS[cur % 12];
      fitMonth();
      animate([w], dir, true);
    }
    /* После ручной прокрутки: фокус остаётся на своей карточке, пока она целиком видна,
       иначе переходит на крайнюю левую целиком видимую. Прокрутку от клика/стрелок месяца не трогаем. */
    function syncFocus() {
      if (Date.now() < progUntil) return;
      var t = agenda.querySelector('.c2-track'), tr = t.getBoundingClientRect();
      var seen = items.filter(function (it) {
        var r = document.getElementById('c2-' + it.ev.id).getBoundingClientRect();
        return r.left >= tr.left - 2 && r.right <= tr.right + 2;
      });
      if (!seen.length || seen.indexOf(focusIt) !== -1) return;
      focusIt = seen[0];
      var k = key(focusIt.y, focusIt.m);
      if (k !== cur) { var dir = k > cur ? 1 : -1; cur = k; renderC2(false); setWord(dir); }
      setPressed();
    }
    function toCard(card) {
      var track = agenda.querySelector('.c2-track');
      progUntil = Date.now() + 900;
      track.scrollTo({ left: track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left, behavior: reduce ? 'auto' : 'smooth' });
    }
    function arrows() {
      var t = agenda.querySelector('.c2-track');
      if (!t) return;
      agenda.querySelector('[data-scroll="-1"]').disabled = t.scrollLeft < 4;
      var end = t.scrollLeft + t.clientWidth > t.scrollWidth - 4;
      agenda.querySelector('[data-scroll="1"]').disabled = end;
      t.classList.toggle('is-end', end);
    }
    function reveal(card) {
      focusIt = items.filter(function (it) { return card.id === 'c2-' + it.ev.id; })[0] || focusIt;
      toCard(card);
      var r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) card.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      card.classList.remove('is-picked');
      void card.offsetWidth;
      card.classList.add('is-picked');
      agenda.querySelectorAll('.c2-dayb').forEach(function (b) { b.setAttribute('aria-pressed', String(card.id === 'c2-' + b.dataset.ev)); });
    }

    /* ---------- общее ---------- */
    function animate(nodes, dir, word) {
      if (reduce || !Element.prototype.animate || !dir) return;
      Array.prototype.forEach.call(nodes, function (n, i) {
        n.animate([{ opacity: 0, transform: word ? 'translateY(' + 40 * dir + 'px)' : 'translateX(' + 24 * dir + 'px)' }, { opacity: 1, transform: 'none' }],
          { duration: 360, delay: Math.min(i, 6) * 50, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      });
    }
    function go(k) {
      if (k === null || k < minKey || k > maxKey || k === cur) return;
      var dir = k > cur ? 1 : -1;
      cur = k;
      renderC2(false);
      if (inMonth(cur).length) {
        focusIt = inMonth(cur)[0];
        setWord(dir);
        setPressed();
        toCard(document.getElementById('c2-' + focusIt.ev.id));
      }
      var focus = agenda.querySelector('.ag-nav[data-step="' + dir + '"]:not(:disabled)') || agenda.querySelector('.ag-nav[data-step]:not(:disabled)');
      if (focus) focus.focus();
    }
    agenda.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !agenda.contains(b)) return;
      if (b.dataset.step) go(stepTarget(Number(b.dataset.step)));
      else if (b.dataset.scroll) {
        var t = agenda.querySelector('.c2-track');
        t.scrollBy({ left: Number(b.dataset.scroll) * t.firstElementChild.offsetWidth, behavior: reduce ? 'auto' : 'smooth' });
      } else if (b.dataset.ev) reveal(document.getElementById('c2-' + b.dataset.ev));
    });
    /* Стрелки клавиатуры: по дням со встречами в мини-календаре, по месяцам — на кнопках месяцев. */
    agenda.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var d = e.key === 'ArrowLeft' ? -1 : 1, t = e.target;
      if (t.classList.contains('c2-track')) {
        e.preventDefault();
        t.scrollBy({ left: d * t.firstElementChild.offsetWidth, behavior: reduce ? 'auto' : 'smooth' });
      } else if (t.classList.contains('c2-dayb')) {
        var all = Array.prototype.slice.call(agenda.querySelectorAll('.c2-dayb')), n = all[all.indexOf(t) + d];
        e.preventDefault();
        if (n) { n.focus(); return; }
        go(stepTarget(d));
        var days = agenda.querySelectorAll('.c2-dayb');
        if (days.length) days[d > 0 ? 0 : days.length - 1].focus();
      } else if (t.dataset && t.dataset.step) { e.preventDefault(); go(stepTarget(d)); }
    });
    agenda.closest('.agenda').classList.add('is-c3');
    renderC2(true);
    if (window.ResizeObserver) new ResizeObserver(function () { fitMonth(); }).observe(agenda);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMonth);
    /* Первое появление карточек — когда секция доходит до экрана. */
    if (!reduce && window.IntersectionObserver) {
      new IntersectionObserver(function (en, obs) {
        if (!en[0].isIntersecting) return;
        obs.disconnect();
        animate(agenda.querySelectorAll('.c2-card'), 1);
        animate(agenda.querySelectorAll('.c1-month span'), 1, true);
      }, { threshold: 0.15 }).observe(agenda);
    }
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

/* Отзывы: обрезка длинных переписок, «переписка целиком» в модалке, стрелки и точки у ленты,
   на /otzyvy/ — раскладка листков по колонкам по высоте с ровным низом. */
(function () {
  'use strict';
  var band = document.querySelector('.rv-band');
  if (!band) return;

  var grid = band.querySelector('.rv-grid');
  var cards = [].slice.call(band.querySelectorAll('.rv-grid > .rv-card'));
  var ctas = [].slice.call(band.querySelectorAll('.rv-cta'));
  var ctaHome = ctas.length ? ctas[0].parentNode : null;

  function clamp() {
    cards.forEach(function (c) {
      var chat = c.querySelector('.rv-chat');
      c.classList.remove('is-clamped');
      chat.style.maxHeight = '';
      var over = chat.scrollHeight - chat.clientHeight;
      /* обрезать ради одной-двух строк глупо — такую переписку показываем целиком */
      if (over > 0 && over < 72) chat.style.maxHeight = 'none';
      else if (over > 4) c.classList.add('is-clamped');
    });
  }

  /* Жадная раскладка: каждый листок — в самую короткую колонку. Разница низа ≤ 24px — оставляем;
     больше — короткую колонку добирает листок-призыв (если хватает места) или разрядка промежутков. */
  var GAP_OK = 24, CTA_MIN = 200;
  function masonry() {
    if (!band.classList.contains('rv--r1') || !ctaHome) return;
    grid.classList.remove('is-masonry');
    cards.forEach(function (c) { grid.appendChild(c); });
    ctas.forEach(function (c) { c.hidden = true; ctaHome.appendChild(c); });
    [].slice.call(grid.querySelectorAll('.rv-col')).forEach(function (col) { col.remove(); });
    var w = grid.clientWidth, n = w >= 1000 ? 3 : w >= 600 ? 2 : 1;
    if (n === 1) return;
    grid.classList.add('is-masonry');
    var cols = [];
    for (var k = 0; k < n; k++) { var col = document.createElement('div'); col.className = 'rv-col'; grid.appendChild(col); cols.push(col); }
    cards.forEach(function (c, i) { cols[i % n].appendChild(c); });
    var hs = cards.map(function (c) { var s = getComputedStyle(c); return c.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom); });
    var sums = cols.map(function () { return 0; });
    cards.forEach(function (c, i) {
      var j = sums.indexOf(Math.min.apply(null, sums));
      cols[j].appendChild(c); sums[j] += hs[i];
    });
    var max = Math.max.apply(null, sums), free = ctas.slice();
    cols.forEach(function (col, j) {
      var diff = max - sums[j];
      if (diff <= GAP_OK) return;
      if (diff >= CTA_MIN && free.length) { var cta = free.shift(); cta.hidden = false; col.appendChild(cta); }
      else col.classList.add('is-spread');
    });
  }

  var dlg = document.getElementById('rv-dlg');
  band.addEventListener('click', function (e) {
    var btn = e.target.closest('.rv-more');
    if (!btn || !dlg || typeof dlg.showModal !== 'function') return;
    var c = btn.closest('.rv-card');
    var h = dlg.querySelector('.rv-dlg-h'), body = dlg.querySelector('.rv-dlg-body');
    h.textContent = c.querySelector('.rv-sign b').textContent;
    var tag = document.createElement('span');
    tag.textContent = c.querySelector('.rv-tag').textContent;
    h.appendChild(tag);
    body.textContent = '';
    var chat = c.querySelector('.rv-chat').cloneNode(true);
    chat.removeAttribute('id');
    chat.style.maxHeight = '';
    body.appendChild(chat);
    body.appendChild(c.querySelector('.rv-orig').cloneNode(true));
    dlg.showModal();
  });
  if (dlg) dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('.rv-dlg-x')) dlg.close();
  });

  var nav = band.querySelector('.rv-nav');
  var dots = nav && nav.querySelector('.rv-dots');
  var prev = nav && nav.querySelector('.rv-prev'), next = nav && nav.querySelector('.rv-next');
  function syncNav() {
    if (!nav) return;
    var scrollable = getComputedStyle(grid).overflowX !== 'visible' && grid.scrollWidth > grid.clientWidth + 2;
    nav.hidden = !scrollable;
    if (!scrollable) return;
    var n = Math.max(1, Math.round(grid.scrollWidth / grid.clientWidth)), max = grid.scrollWidth - grid.clientWidth;
    var i = Math.round(grid.scrollLeft / max * (n - 1)) || 0;
    if (dots.children.length !== n) {
      dots.textContent = '';
      for (var k = 0; k < n; k++) dots.appendChild(document.createElement('i'));
    }
    [].forEach.call(dots.children, function (d, k) { d.classList.toggle('on', k === i); });
    prev.disabled = grid.scrollLeft < 4;
    next.disabled = grid.scrollLeft > max - 4;
  }
  function step(dir) {
    var card = grid.querySelector('.rv-card');
    var cw = card ? card.getBoundingClientRect().width : grid.clientWidth;
    var per = Math.max(1, Math.round(grid.clientWidth / cw));
    grid.scrollBy({ left: dir * (cw + 16) * per, behavior: 'smooth' });
  }
  if (nav) {
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    grid.addEventListener('scroll', function () { requestAnimationFrame(syncNav); }, { passive: true });
  }
  var t;
  function all() { clamp(); masonry(); syncNav(); }
  all();
  addEventListener('resize', function () { clearTimeout(t); t = setTimeout(all, 120); });
  addEventListener('load', all);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
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
