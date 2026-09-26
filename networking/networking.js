/* /networking/: выбор даты, текст для мессенджеров, прошедшие даты из events.json. */
(function () {
  'use strict';
  var tickets = Array.prototype.slice.call(document.querySelectorAll('.nw-ticket'));
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-msg]'));
  if (!tickets.length) return;

  function bind(name) { return document.querySelector('[data-bind="' + name + '"]'); }
  function checked() { return document.querySelector('input[name="nw-date"]:checked'); }
  function message(tariff) {
    var input = checked();
    var head = 'Хочу на нетворкинг' + (input ? ' ' + input.value : '');
    return head + (tariff ? ', тариф «' + tariff + '»' : '');
  }

  function sync() {
    var input = checked();
    if (input) bind('picked').textContent = input.value + ', ' + input.dataset.weekday;
    links.forEach(function (a) {
      var base = a.href.split('?')[0];
      a.href = base + '?text=' + encodeURIComponent(message(a.dataset.tariff));
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
      var text = message(a.dataset.tariff);
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
      document.querySelector('[data-next]').hidden = true;
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
    bind('day').textContent = parts[0];
    bind('mon').textContent = parts[1];
    bind('wd').textContent = first.dataset.weekday.charAt(0).toUpperCase() + first.dataset.weekday.slice(1);
    sync();
  }

  /* Эксперимент со стеклом на обложке: только по ?glass=1, по умолчанию выключен. */
  if (/[?&]glass=1(&|$)/.test(location.search)) {
    document.querySelector('.nw-hero').classList.add('nw-cover--glass');
    document.body.classList.add('nw-glass');
  }

  sync();
  if (window.fetch) {
    fetch('/assets/data/events.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('events.json: HTTP ' + r.status); return r.json(); })
      .then(function (data) { applyEvents(data.events || []); })
      .catch(function (err) { console.error('Даты остаются из разметки:', err); });
  }
})();
