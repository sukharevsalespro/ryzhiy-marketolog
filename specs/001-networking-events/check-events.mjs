// Сверка копий данных с assets/data/events.json (ФТ-8). Без зависимостей.
// Запуск из корня репо: node specs/001-networking-events/check-events.mjs
// Код выхода 1 и список расхождений, если что-то не совпало.
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const data = JSON.parse(read('assets/data/events.json'));
const nw = read('networking/index.html');
const home = read('index.html');
const errors = [];
const expect = (ok, msg) => { if (!ok) errors.push(msg); };

const fmt = (iso, opts) => new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', ...opts });
const hm = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
const rub = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// 1. События: время в поле time совпадает со start/end.
for (const ev of data.events) {
  const t = ev.end ? `${hm(ev.start)}–${hm(ev.end)} МСК` : `${hm(ev.start)} МСК`;
  expect(ev.time === t, `${ev.id}: time "${ev.time}" ≠ ${t} из start/end`);
}

// 2. /networking/: билеты = будущие нетворкинги на дату сборки, JSON-LD, текст.
const cutoff = process.env.CHECK_NOW ? new Date(process.env.CHECK_NOW) : new Date('2026-09-26T00:00:00+03:00');
const nets = data.events.filter((e) => e.type === 'networking');
const future = nets.filter((e) => new Date(e.end || e.start) >= cutoff);
const past = nets.filter((e) => new Date(e.end || e.start) < cutoff);
const tickets = [...nw.matchAll(/<label class="nw-ticket" data-ev="([^"]+)"><input[^>]*value="([^"]+)" data-weekday="([^"]+)"[\s\S]*?<span class="nw-t-time">([^<]+)<\/span>/g)];
expect(tickets.length === future.length, `/networking/: билетов ${tickets.length}, будущих нетворкингов ${future.length}`);
future.forEach((ev, i) => {
  const t = tickets[i];
  if (!t) return;
  const dayMon = fmt(ev.start, { day: 'numeric', month: 'long' });
  expect(t[1] === ev.id, `билет ${i + 1}: id ${t[1]} ≠ ${ev.id}`);
  expect(t[2] === dayMon, `билет ${ev.id}: дата "${t[2]}" ≠ "${dayMon}"`);
  expect(t[3] === fmt(ev.start, { weekday: 'long' }), `билет ${ev.id}: день недели "${t[3]}"`);
  expect(t[4] === ev.time, `билет ${ev.id}: время "${t[4]}" ≠ "${ev.time}"`);
  expect(nw.includes(`<b class="nw-t-day">${dayMon.split(' ')[0]}</b><span class="nw-t-mon">${dayMon.split(' ')[1]}</span>`), `билет ${ev.id}: крупная дата не совпадает`);
});
const pastLine = ((nw.match(/data-bind="past">([^<]*)</) || [])[1] || '').replace(/\u00a0/g, ' ');
expect(pastLine === past.map((e) => fmt(e.start, { day: 'numeric', month: 'long' })).join(', '), `/networking/: строка прошедших "${pastLine}"`);

const ld = JSON.parse(nw.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const ldEvents = ld['@graph'].filter((n) => n['@type'] === 'Event');
expect(ldEvents.length === future.length, `JSON-LD: Event ${ldEvents.length}, ожидалось ${future.length}`);
const offers = data.tariffs.flatMap((t) => t.offers.map((o) => String(o.price))).join(',');
future.forEach((ev) => {
  const n = ldEvents.find((x) => x.startDate === ev.start);
  expect(n, `JSON-LD: нет Event со startDate ${ev.start}`);
  if (!n) return;
  expect(n.endDate === ev.end, `JSON-LD ${ev.id}: endDate ${n.endDate}`);
  expect(n.location && n.location.name === 'Контур.Толк', `JSON-LD ${ev.id}: location.name`);
  const nTime = ev.time.replace(/\s*МСК$/, '');
  expect(n.description.includes(`${nTime} по московскому времени`), `JSON-LD ${ev.id}: описание не содержит "${nTime} по московскому времени"`);
  expect(n.offers.map((o) => o.price).join(',') === offers, `JSON-LD ${ev.id}: цены offers ${n.offers.map((o) => o.price)} ≠ ${offers}`);
  expect(n.offers.every((o) => o.priceCurrency === 'RUB'), `JSON-LD ${ev.id}: валюта`);
});

// Цены тарифов в видимом тексте.
const body = text(nw);
for (const t of data.tariffs) for (const o of t.offers) expect(body.includes(rub(o.price)), `/networking/: нет цены "${rub(o.price)}" (${t.name})`);
// Время у каждой даты своё (ФТ-9): в тексте страницы должно быть время каждого будущего нетворкинга,
// а не единое "12:00–14:00" на все даты.
for (const ev of future) expect(body.includes(ev.time), `/networking/: нет времени "${ev.time}" (${ev.id})`);

// Факт «Время» на /networking/: список по датам, одна строка на встречу (ФТ-9, не мешать общее
// время с исключением по дате — переделка 27.09.2026), МСК вынесена в общую подпись один раз.
{
  const want = future
    .map((e) => `${fmt(e.start, { day: 'numeric', month: 'long' })}, ${fmt(e.start, { weekday: 'short' })} — ${e.time.replace(/\s*МСК$/, '')}`)
    .join(' ');
  const dd = (nw.match(/<dd data-bind="times">([\s\S]*?)<\/dd>/) || [])[1] || '';
  expect(text(dd).trim() === want, `/networking/: факт «Время» не "${want}"`);
  expect(nw.includes('class="nw-facts-note">По московскому времени.</p>'), '/networking/: нет общей подписи "По московскому времени." у факта «Время»');
}

// Ближайшая дата в обложке и ссылки мессенджеров без JS.
const near = future[0];
if (near) {
  const [d, m] = fmt(near.start, { day: 'numeric', month: 'long' }).split(' ');
  expect(nw.includes(`<b data-bind="day">${d}</b><span data-bind="mon">${m}</span>`), `обложка: ближайшая дата не ${d} ${m}`);
  const nearTime = near.time.replace(/\s*МСК$/, '');
  expect(nw.includes(`data-bind="time">${nearTime}</span>`), `обложка: плашка времени не "${nearTime}" (ближайшая дата ${near.id})`);
  const want = encodeURIComponent(`Хочу на нетворкинг ${d} ${m}`);
  // 7: у «Стандарта» с 58e172b оплата через Prodamus, мессенджеры — только у остальных тарифов.
  const hrefs = [...nw.matchAll(/data-msg="[^"]+"[^>]*href="[^"]*\?text=([^"]+)"/g)].map((x) => x[1]);
  expect(hrefs.length === 7 && hrefs.every((h) => h.startsWith(want)), `кнопки мессенджеров: текст не на ${d} ${m} (${hrefs.length} ссылок)`);
}

// 3. Главная: статичная афиша месяца ближайшего события (фолбэк без JS; с JS main.js перерисует из events.json).
const all = data.events.filter((e) => new Date(e.end || e.start) >= cutoff);
const next = all[0];
if (next) {
  const month = fmt(next.start, { month: 'long' });
  const title = month.charAt(0).toUpperCase() + month.slice(1);
  const year = fmt(next.start, { year: 'numeric' }).replace(' г.', '');
  const [d, m] = fmt(next.start, { day: 'numeric', month: 'long' }).split(' ');
  // Статичная разметка = снимок C3 (слово месяца + лента + мини-календарь), снимается с отрисовки main.js.
  expect(home.includes(`<p class="c1-month" aria-hidden="true"><span>${title}</span></p>`), `главная: слово месяца не "${title}"`);
  expect(home.includes(`<p class="ag-title" aria-live="polite"><b>${title}</b> ${year}</p>`), `главная: мини-календарь не на "${title} ${year}"`);
  expect(home.includes(`data-ev="${next.id}"`), `главная: в мини-календаре нет дня ${next.id}`);
  const at = home.indexOf(`<li class="c2-card is-near" id="c2-${next.id}">`);
  expect(at !== -1, `главная: нет карточки ближайшей встречи c2-${next.id} с is-near`);
  const cardHtml = at === -1 ? '' : home.slice(at, home.indexOf('</li>', at));
  expect(cardHtml.includes(`<b class="c2-day">${d}</b><p class="c2-mon">${m}</p>`), `главная: карточка не на ${d} ${m}`);
  expect(cardHtml.includes(`<p class="c2-time">${next.time.replace(/\s*МСК$/, '')}</p>`), `главная: время карточки не "${next.time}"`);
  expect(cardHtml.includes(`<p class="c2-wd">${fmt(next.start, { weekday: 'short' })}</p>`), 'главная: день недели карточки');
  expect(cardHtml.includes(`<span class="ag-price">${next.price}</span>`), `главная: цена карточки не "${next.price}"`);
  expect(cardHtml.includes(`<h3>${next.title}</h3>`), 'главная: название карточки');
  expect(cardHtml.includes(next.desc), 'главная: описание карточки');
  expect(cardHtml.includes(`<a class="ag-cta" href="${next.url}">Записаться`), `главная: кнопка карточки не на "${next.url}"`);
  // Все встречи из данных есть в ленте, прошедшие помечены.
  for (const ev of data.events) {
    const pastEv = new Date(ev.end || ev.start) < cutoff;
    expect(new RegExp(`<li class="c2-card[^"]*${pastEv ? ' is-past' : ''}[^"]*" id="c2-${ev.id}">`).test(home), `главная: в ленте нет ${ev.id}${pastEv ? ' с is-past' : ''}`);
  }

  // С новой обложки (bbd3a7c, 28.09) анонса на первом экране нет; если вернётся — обязан совпадать с данными.
  const heroStart = home.indexOf('<a class="hero-announcement"');
  if (heroStart !== -1) {
    const heroHtml = home.slice(heroStart, home.indexOf('</a>', heroStart) + 4);
    expect(heroHtml.includes(`href="${next.url}"`), `анонс обложки: ссылка не "${next.url}"`);
    expect(heroHtml.includes(`>${d}<small>${m}</small>`), `анонс обложки: дата не "${d} ${m}"`);
    expect(heroHtml.includes(`class="label">${next.label}<`), `анонс обложки: надзаголовок не "${next.label}"`);
    expect(heroHtml.includes(`<span>${next.title}</span>`), `анонс обложки: название не "${next.title}"`);
  }
} else {
  expect(!home.includes('<a class="hero-announcement"'), 'главная: анонс обложки должен быть скрыт — будущих событий нет');
}

if (errors.length) {
  console.error(`check-events: ${errors.length} расхождений\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(`check-events: ok (${data.events.length} событий, ${future.length} билетов, ${ldEvents.length} Event в JSON-LD, срез ${cutoff.toISOString()})`);
