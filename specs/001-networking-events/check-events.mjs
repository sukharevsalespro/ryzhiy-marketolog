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
  expect(n.offers.map((o) => o.price).join(',') === offers, `JSON-LD ${ev.id}: цены offers ${n.offers.map((o) => o.price)} ≠ ${offers}`);
  expect(n.offers.every((o) => o.priceCurrency === 'RUB'), `JSON-LD ${ev.id}: валюта`);
});

// Цены тарифов в видимом тексте.
const body = text(nw);
for (const t of data.tariffs) for (const o of t.offers) expect(body.includes(rub(o.price)), `/networking/: нет цены "${rub(o.price)}" (${t.name})`);
expect(body.includes('12:00–14:00 МСК'), '/networking/: нет времени 12:00–14:00 МСК');

// Ближайшая дата в обложке и ссылки мессенджеров без JS.
const near = future[0];
if (near) {
  const [d, m] = fmt(near.start, { day: 'numeric', month: 'long' }).split(' ');
  expect(nw.includes(`<b data-bind="day">${d}</b><span data-bind="mon">${m}</span>`), `обложка: ближайшая дата не ${d} ${m}`);
  const want = encodeURIComponent(`Хочу на нетворкинг ${d} ${m}`);
  const hrefs = [...nw.matchAll(/data-msg="[^"]+"[^>]*href="[^"]*\?text=([^"]+)"/g)].map((x) => x[1]);
  expect(hrefs.length === 8 && hrefs.every((h) => h.startsWith(want)), `кнопки мессенджеров: текст не на ${d} ${m} (${hrefs.length} ссылок)`);
}

// 3. Главная: статичный календарь на месяце ближайшего события + карточка.
const all = data.events.filter((e) => new Date(e.end || e.start) >= cutoff);
const next = all[0];
if (next) {
  const month = fmt(next.start, { month: 'long', year: 'numeric' }).replace(' г.', '');
  const title = month.charAt(0).toUpperCase() + month.slice(1);
  const [d, m] = fmt(next.start, { day: 'numeric', month: 'long' }).split(' ');
  expect(home.includes(`<b>${title}</b>`), `главная: заголовок месяца не "${title}"`);
  expect(home.includes(`<td class="has-ev is-day"><a href="${next.url}"`) && home.includes(`>${d}</a></td>`), `главная: выделенный день не ${d}`);
  const cardHtml = home.slice(home.indexOf('<article class="event"'), home.indexOf('</article>', home.indexOf('<article class="event"')));
  expect(cardHtml.includes(`<b>${d}</b><span>${m}</span>`), `главная: карточка не на ${d} ${m}`);
  expect(cardHtml.includes(next.time), `главная: время карточки не "${next.time}"`);
  expect(cardHtml.includes(`<b>${next.price}</b>`), `главная: цена карточки не "${next.price}"`);
  expect(cardHtml.includes(next.desc), 'главная: описание карточки');
}

if (errors.length) {
  console.error(`check-events: ${errors.length} расхождений\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(`check-events: ok (${data.events.length} событий, ${future.length} билетов, ${ldEvents.length} Event в JSON-LD, срез ${cutoff.toISOString()})`);
