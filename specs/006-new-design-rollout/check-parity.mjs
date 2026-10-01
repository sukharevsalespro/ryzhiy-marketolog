#!/usr/bin/env node
// Сверка «до / после» перевода страниц на новый дизайн (spec.md §6, пункты 1–9). Без зависимостей.
//   node check-parity.mjs snapshot <out.json> [siteRoot]   — снять снимок
//   node check-parity.mjs diff <before.json> [siteRoot]    — сравнить текущий сайт со снимком (код 1 при расхождении)
//   node check-parity.mjs selftest [siteRoot]              — проверить, что порча ловится
// ponytail: HTML разбирается регулярками — хватает для статичных страниц сайта; при шаблонизаторе/JS-рендере нужен DOM-парсер.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGES = [
  'index.html', 'master-gruppa-lichnyj-brend/index.html', 'networking/index.html',
  'raspakovka-lichnosti/index.html', 'razvitie-lichnogo-brenda/index.html',
  'zapis-lichnyj-brend/index.html', 'zapis-marketing-doveriya/index.html',
  'pozicionirovanie/index.html', 'otzyvy/index.html', 'rekvizity/index.html',
  'legal/oferta/index.html', 'legal/privacy/index.html', 'legal/soglasie/index.html', '404.html',
];
// Разрешённые владельцем изменения (spec.md §11): '+значение' — можно добавить, '-значение' — можно убрать.
const ALLOW = {
  'zapis-marketing-doveriya/index.html': { prices: ['+888 ₽'] },
  '404.html': { internalLinks: ['+/#calendar', '-/zapis-lichnyj-brend/'] },
};

const decode = (s) => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
const norm = (s) => decode(s).replace(/[\s  ]+/g, ' ').trim();
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const all = (re, s) => [...s.matchAll(re)];
const uniqSorted = (a) => [...new Set(a)].sort();
const counts = (a) => a.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {});

function metaMap(html, keyAttr, prefix) {
  const m = {};
  for (const [tag] of all(/<meta\b[^>]*>/g, html)) {
    const k = attr(tag, keyAttr);
    if (k && k.startsWith(prefix)) m[k] = decode(attr(tag, 'content') || '');
  }
  return m;
}

function walkLd(node, out) {
  if (Array.isArray(node)) return node.forEach((n) => walkLd(n, out));
  if (!node || typeof node !== 'object') return;
  for (const t of [].concat(node['@type'] || [])) out.types.add(t);
  if (node.price !== undefined) out.prices.add(`${node.price} ${node.priceCurrency || ''}`.trim());
  if (node['@type'] === 'Event' && node.startDate) out.events.add(`${node.name || ''} @ ${node.startDate}`);
  Object.values(node).forEach((v) => walkLd(v, out));
}

export function extract(html) {
  const errors = [];
  const ld = { types: new Set(), prices: new Set(), events: new Set() };
  for (const [, body] of all(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g, html)) {
    try { walkLd(JSON.parse(body), ld); } catch (e) { errors.push(`JSON-LD не парсится: ${e.message}`); }
  }
  const text = norm(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/g, ' ').replace(/<head[\s\S]*?<\/head>/, ' ')
    .replace(/<[^>]+>/g, ' '));
  const hrefs = all(/<a\b[^>]*\shref="([^"]*)"/g, html).map((m) => decode(m[1]));
  const linkTag = (rel) => (html.match(new RegExp(`<link\\b[^>]*rel="${rel}"[^>]*>`)) || [''])[0];
  return {
    title: norm((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
    description: decode(attr((html.match(/<meta\b[^>]*name="description"[^>]*>/) || [''])[0], 'content') || ''),
    robots: attr((html.match(/<meta\b[^>]*name="robots"[^>]*>/) || [''])[0], 'content') || '',
    canonical: attr(linkTag('canonical'), 'href') || '',
    lang: (html.match(/<html[^>]*\slang="([^"]*)"/) || [])[1] || '',
    h1: all(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g, html).map((m) => norm(m[1].replace(/<[^>]+>/g, ' '))),
    og: metaMap(html, 'property', 'og:'),
    twitter: metaMap(html, 'name', 'twitter:'),
    ldTypes: [...ld.types].sort(),
    ldPrices: [...ld.prices].sort(),
    ldEvents: [...ld.events].sort(),
    ldErrors: errors,
    payLinks: counts(hrefs.filter((h) => /payform\.ru|cbrpay\.ru/.test(h))),
    tgLinks: counts(hrefs.filter((h) => h.includes('t.me/'))),
    maxLinks: counts(hrefs.filter((h) => h.includes('max.ru/'))),
    msgText: uniqSorted(all(/data-msg-text="([^"]*)"/g, html).map((m) => decode(m[1]))),
    goals: counts(all(/data-goal="([^"]*)"/g, html).map((m) => m[1])),
    metrika: /\/assets\/js\/metrika\.js/.test(html),
    prices: uniqSorted(all(/\d[\d   ]*\s?₽/g, text).map((m) => norm(m[0]))),
    internalLinks: uniqSorted(hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//'))),
    imgNoAlt: all(/<img\b[^>]*>/g, html).filter(([t]) => attr(t, 'alt') === undefined).length,
    // набор фото по базовому имени файла (без -600/-1200/… и расширения): потеря фото = FAIL, новое фото — только сообщение
    images: uniqSorted(all(/<(?:img|source)\b[^>]*>/g, html).flatMap(([t]) => [attr(t, 'src'), ...(attr(t, 'srcset') || '').split(',').map((x) => x.trim().split(/\s+/)[0])])
      .filter(Boolean).map((u) => u.split('?')[0].split('/').pop().replace(/\.(webp|avif|jpe?g|png|svg|gif)$/i, '').replace(/-\d{2,5}$/, ''))),
  };
}

export function snapshot(root) {
  return Object.fromEntries(PAGES.map((p) => [p, extract(fs.readFileSync(path.join(root, p), 'utf8'))]));
}

// Сравнение: скаляры/массивы по JSON; «множества» (массивы строк и карты счётчиков) — по элементам с учётом ALLOW.
export function compare(before, after, allow = ALLOW) {
  const problems = [];
  for (const page of Object.keys(before)) {
    const a = before[page], b = after[page];
    if (!b) { problems.push(`${page}: страница пропала`); continue; }
    const ok = allow[page] || {};
    for (const key of Object.keys(a)) {
      const x = a[key], y = b[key];
      if (key === 'images') {
        const gone = (x || []).filter((v) => !(y || []).includes(v) && !(ok.images || []).includes('-' + v));
        gone.forEach((v) => problems.push(`${page}: images -${v} (фото пропало)`));
        (y || []).filter((v) => !(x || []).includes(v)).forEach((v) => console.log(`инфо: ${page}: новое фото ${v}`));
        continue;
      }
      const isSet = Array.isArray(x) && ['prices', 'internalLinks', 'msgText', 'ldTypes', 'ldPrices', 'ldEvents'].includes(key);
      const isMap = x && typeof x === 'object' && !Array.isArray(x) && !['og', 'twitter'].includes(key);
      if (isSet || isMap) {
        const fx = isSet ? counts(x) : x, fy = isSet ? counts(y || []) : (y || {});
        for (const v of new Set([...Object.keys(fx), ...Object.keys(fy)])) {
          const d = (fy[v] || 0) - (fx[v] || 0);
          if (!d) continue;
          const sign = d > 0 ? '+' : '-';
          if (!(ok[key] || []).includes(sign + v)) problems.push(`${page}: ${key} ${sign}${v} (было ${fx[v] || 0}, стало ${fy[v] || 0})`);
        }
      } else if (JSON.stringify(x) !== JSON.stringify(y)) {
        problems.push(`${page}: ${key} было ${JSON.stringify(x)} → стало ${JSON.stringify(y)}`);
      }
    }
    if (b.h1.length !== 1) problems.push(`${page}: H1 должно быть ровно 1, сейчас ${b.h1.length}`);
    if (b.ldErrors.length) problems.push(`${page}: ${b.ldErrors.join('; ')}`);
  }
  return problems;
}

function selftest(root) {
  const base = snapshot(root);
  const cases = [
    ['networking/index.html', (h) => h.replaceAll('payform.ru/6ccEnWO', 'payform.ru/XXXX'), /payLinks/],
    ['raspakovka-lichnosti/index.html', (h) => h.replace(/ data-goal="raspakovka_msg"/, ''), /goals -raspakovka_msg/],
    ['zapis-lichnyj-brend/index.html', (h) => h.replace(/<h1\b([^>]*)>/, '<h1$1>Другой '), /h1/],
    ['otzyvy/index.html', (h) => h.replace('application/ld+json">', 'application/ld+json">{'), /JSON-LD/],
    ['networking/index.html', (h) => h.replaceAll('990', '999'), /: prices -990 ₽/],
    ['networking/index.html', (h) => h.replace(/<figure class="nw-cta-photo">[\s\S]*?<\/figure>/, ''), /images -portrait-pink-coat-phone/],
  ];
  let failed = 0;
  for (const [page, mutate, expect] of cases) {
    const after = { ...base, [page]: extract(mutate(fs.readFileSync(path.join(root, page), 'utf8'))) };
    const probs = compare(base, after);
    const hit = probs.some((p) => expect.test(p));
    console.log(`${hit ? 'ok  ' : 'FAIL'} порча ${page} ${expect} → ${probs[0] || 'не поймано'}`);
    if (!hit) failed++;
  }
  const clean = compare(base, snapshot(root));
  console.log(`${clean.length ? 'FAIL' : 'ok  '} без порчи: ${clean.length} расхождений`);
  const allowed = compare(base, { ...base, '404.html': { ...base['404.html'], internalLinks: [...base['404.html'].internalLinks, '/#calendar'] } });
  console.log(`${allowed.length ? 'FAIL' : 'ok  '} разрешённое изменение (404 → /#calendar) не считается ошибкой`);
  process.exit(failed || clean.length || allowed.length ? 1 : 0);
}

const [cmd, file, rootArg] = process.argv.slice(2);
const root = path.resolve(cmd === 'selftest' ? (file || path.join(HERE, '../..')) : (rootArg || path.join(HERE, '../..')));
if (cmd === 'snapshot' && file) {
  fs.writeFileSync(file, JSON.stringify(snapshot(root), null, 1) + '\n');
  console.log(`снимок ${PAGES.length} страниц → ${file}`);
} else if (cmd === 'diff' && file) {
  const probs = compare(JSON.parse(fs.readFileSync(file, 'utf8')), snapshot(root));
  probs.forEach((p) => console.log(p));
  console.log(probs.length ? `РАСХОЖДЕНИЙ: ${probs.length}` : 'расхождений нет');
  process.exit(probs.length ? 1 : 0);
} else if (cmd === 'selftest') {
  selftest(root);
} else {
  console.log('usage: check-parity.mjs snapshot <out.json> [root] | diff <before.json> [root] | selftest [root]');
  process.exit(2);
}
