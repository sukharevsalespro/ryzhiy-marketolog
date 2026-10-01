/* /networking/: выбор даты, текст для мессенджеров, прошедшие даты из events.json. */
(function () {
  'use strict';
  var tickets = Array.prototype.slice.call(document.querySelectorAll('.nw-ticket'));
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-msg]'));
  if (!tickets.length) return;

  function bind(name) { return document.querySelector('[data-bind="' + name + '"]'); }
  function checked() { return document.querySelector('input[name="nw-date"]:checked'); }
  function message(tariff, suffix) {
    var input = checked();
    var head = 'Хочу на нетворкинг' + (input ? ' ' + input.value : '');
    var body = head + (tariff ? ', тариф «' + tariff + '»' : '');
    return body + (suffix ? '. ' + suffix : '');
  }

  function sync() {
    var input = checked();
    if (input) bind('picked').textContent = input.value + ', ' + input.dataset.weekday;
    /* ссылка оплаты — своя у каждой даты (data-pay на input «Даты»). Нет ссылки → тариф «Стандарт»
       переключается на предварительную запись в Telegram/MAX вместо кнопки оплаты. */
    var hasPay = !!(input && input.dataset.pay);
    if (hasPay) {
      var payBtn = document.querySelector('[data-pay-btn]');
      if (payBtn) payBtn.href = input.dataset.pay;
      if (bind('paydate')) bind('paydate').textContent = input.value;
    }
    document.querySelectorAll('[data-pay-el]').forEach(function (el) { el.hidden = !hasPay; });
    document.querySelectorAll('[data-prereg-el]').forEach(function (el) { el.hidden = hasPay; });
    links.forEach(function (a) {
      var base = a.href.split('?')[0];
      a.href = base + '?text=' + encodeURIComponent(message(a.dataset.tariff, a.dataset.prereg));
    });
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
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      if (ok) resolve(); else reject(new Error('execCommand copy failed'));
    });
  }

  function say(text, kind) {
    if (window.rmToast) window.rmToast(text, kind, 6000);
  }

  /* Telegram подставляет текст из ?text= (документировано, t.me/<user>?text=).
     У MAX параметр не документирован: ссылку отдаём с ?text=, но текст всегда
     копируем в буфер и говорим об этом тостом. Переход по ссылке не блокируем. */
  links.forEach(function (a) {
    a.addEventListener('click', function () {
      var text = message(a.dataset.tariff, a.dataset.prereg);
      var isMax = a.dataset.msg === 'max';
      copy(text).then(function () {
        say(isMax ? 'Текст скопирован — вставьте в чат MAX.'
                  : 'Открываю Telegram. Текст подставится в чат, копия в буфере обмена.', 'ok');
      }, function (err) {
        console.error('Не удалось скопировать текст:', err);
        say('Не получилось скопировать. Напишите в чате: «' + text + '»', 'err');
      });
    });
  });

  document.addEventListener('change', function (e) {
    if (e.target.name === 'nw-date') sync();
  });

  /* билет первого экрана выбирает ту же дату в блоке «Даты» и ведёт к тарифам */
  document.querySelectorAll('[data-pick]').forEach(function (a) {
    a.addEventListener('click', function () {
      var input = document.querySelector('input[name="nw-date"][value="' + a.dataset.pick + '"]');
      if (input && !input.disabled) { input.checked = true; sync(); }
    });
  });

  /* появление блоков при прокрутке; без поддержки IntersectionObserver или при reduced-motion блоки сразу видны */
  var reveal = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reveal.length && 'IntersectionObserver' in window && !calm) {
    document.documentElement.classList.add('nw-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveal.forEach(function (el) { io.observe(el); });
  }

  function applyEvents(events) {
    var now = Date.now();
    var ended = {};
    events.forEach(function (ev) { ended[ev.id] = new Date(ev.end || ev.start).getTime() < now; });
    var pastList = bind('past');
    var visible = tickets.filter(function (t) {
      if (!ended[t.dataset.ev]) return true;
      var input = t.querySelector('input');
      input.checked = false;
      input.disabled = true;
      t.hidden = true;
      var nb = input.value.replace(' ', '\u00a0');
      if (pastList && pastList.textContent.indexOf(nb) === -1) pastList.textContent += ', ' + nb;
      return false;
    });
    document.querySelectorAll('.nw-tag').forEach(function (tag) { tag.remove(); });
    if (!visible.length) {
      document.querySelector('.nw-tickets').hidden = true;
      document.querySelector('.nw-empty').hidden = false;
      var nx = document.querySelector('[data-next]'); if (nx) nx.hidden = true;
      bind('picked').textContent = 'новые даты скоро';
      sync();
      return;
    }
    var first = visible[0].querySelector('input');
    var tag = document.createElement('span');
    tag.className = 'nw-tag';
    tag.textContent = 'Ближайший';
    visible[0].querySelector('.nw-t-stub').insertBefore(tag, visible[0].querySelector('.nw-t-pick'));
    if (!checked()) first.checked = true;
    var parts = first.value.split(' ');
    /* первый экран (новый дизайн): билеты прошедших встреч скрываются, «Ближайший» — на первом оставшемся */
    var hero = Array.prototype.slice.call(document.querySelectorAll('[data-hero-ev]'));
    var heroLeft = hero.filter(function (li) { var gone = ended[li.dataset.heroEv]; li.hidden = !!gone; return !gone; });
    hero.forEach(function (li) { li.classList.remove('is-next'); var t = li.querySelector('.nd-t-tag'); if (t) t.remove(); });
    if (heroLeft.length) {
      heroLeft[0].classList.add('is-next');
      var ht = document.createElement('span'); ht.className = 'nd-t-tag'; ht.textContent = 'Ближайший';
      heroLeft[0].querySelector('.nd-t-mon').appendChild(ht);
    }
    if (bind('day')) bind('day').textContent = parts[0];
    if (bind('mon')) bind('mon').textContent = parts[1];
    if (bind('wd')) bind('wd').textContent = first.dataset.weekday.charAt(0).toUpperCase() + first.dataset.weekday.slice(1);
    var ev = events.filter(function (e) { return e.id === visible[0].dataset.ev; })[0];
    /* Время в фактах: список по датам (из того же events.json), одна строка на встречу. */
    var timesEl = bind('times');
    var fut = events.filter(function (e) { return e.type === 'networking' && !ended[e.id]; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (timesEl && fut.length) {
      timesEl.textContent = '';
      fut.forEach(function (e) {
        var d = new Date(e.start);
        var date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'Europe/Moscow' });
        var parts = date.split(', ');
        var row = document.createElement('span');
        row.className = 'nw-time-row';
        var b = document.createElement('b');
        b.textContent = parts[1] + ', ' + parts[0];
        row.appendChild(b);
        var dash = document.createElement('span');
        dash.className = 'nw-time-dash';
        dash.textContent = ' — ';
        row.appendChild(dash);
        var hm = document.createElement('span');
        hm.className = 'nw-time-hm';
        hm.textContent = e.time.replace(/\s*МСК$/, '');
        row.appendChild(hm);
        timesEl.appendChild(row);
      });
    }
    var timeEl = bind('time');
    if (ev && timeEl) timeEl.textContent = ev.time.replace(/\s*МСК$/, '');
    sync();
  }

  sync();
  if (window.fetch) {
    fetch('/assets/data/events.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('events.json: HTTP ' + r.status); return r.json(); })
      .then(function (data) { applyEvents(data.events || []); })
      .catch(function (err) { console.error('Даты остаются из разметки:', err); });
  }
})();
